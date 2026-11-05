/**
 * 《美味特工队》多人房间服务。
 * 无第三方依赖：Node http + 原生 WebSocket 帧处理。
 * 启动：node server/server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(__dirname, 'data', 'rooms');
const MAX_PLAYERS = 6;
const rooms = new Map();
const clients = new Map();
const saveTimers = new Map();

fs.mkdirSync(DATA_DIR, { recursive: true });
for (const file of fs.readdirSync(DATA_DIR)) {
  if (!file.endsWith('.json')) continue;
  try {
    const room = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    if (room?.code && Number.isFinite(room.seed)) {
      room.players = new Map();
      room.blocks = new Map(room.blocks || []);
      room.chat = Array.isArray(room.chat) ? room.chat.slice(-30) : [];
      rooms.set(room.code, room);
    }
  } catch (error) {
    console.warn('[rooms] 读取失败', file, error.message);
  }
}

function saveRoom(room) {
  const data = {
    code: room.code,
    seed: room.seed,
    createdAt: room.createdAt,
    updatedAt: new Date().toISOString(),
    blocks: [...room.blocks.entries()],
    chat: room.chat.slice(-30),
  };
  fs.writeFileSync(path.join(DATA_DIR, `${room.code}.json`), JSON.stringify(data));
}
function scheduleSave(room) {
  clearTimeout(saveTimers.get(room.code));
  saveTimers.set(room.code, setTimeout(() => {
    saveTimers.delete(room.code);
    try { saveRoom(room); } catch (error) { console.warn('[rooms] 保存失败', error.message); }
  }, 350));
}
function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  do {
    out = '';
    for (let i = 0; i < 6; i += 1) out += chars[crypto.randomInt(0, chars.length)];
  } while (rooms.has(out));
  return out;
}
function roomSummary(room) {
  return {
    code: room.code,
    seed: room.seed,
    players: room.players.size,
    blocks: [...room.blocks.values()],
    chat: room.chat.slice(-30),
  };
}
function sanitizeName(raw) {
  return String(raw || '小特工').replace(/[^\p{L}\p{N}_ -]/gu, '').trim().slice(0, 14) || '小特工';
}
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}
function json(res, code, body) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function serveStatic(req, res, pathname) {
  let file = pathname === '/' ? '/index.html' : pathname;
  try { file = decodeURIComponent(file); } catch (error) { return json(res, 400, { error: 'bad path' }); }
  const target = path.resolve(ROOT, `.${file}`);
  if (!target.startsWith(ROOT + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  cors(res);
  res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }
  if (req.method === 'POST' && url.pathname === '/api/rooms') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 2048) req.destroy(); });
    req.on('end', () => {
      const code = randomCode();
      const seed = crypto.randomInt(1, 2000000000);
      const room = { code, seed, players: new Map(), blocks: new Map(), chat: [], createdAt: new Date().toISOString() };
      rooms.set(code, room); saveRoom(room);
      json(res, 200, { code, seed });
    });
    return;
  }
  const match = /^\/api\/rooms\/([A-Z0-9]{4,8})$/.exec(url.pathname);
  if (req.method === 'GET' && match) {
    const room = rooms.get(match[1]);
    if (!room) return json(res, 404, { error: '房间不存在' });
    json(res, 200, roomSummary(room));
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/health') {
    json(res, 200, { ok: true, rooms: rooms.size, players: clients.size });
    return;
  }
  serveStatic(req, res, url.pathname);
});

function wsAccept(key) {
  return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}
function encodeFrame(text) {
  const payload = Buffer.from(text);
  const length = payload.length;
  let header;
  if (length < 126) header = Buffer.from([0x81, length]);
  else if (length < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(length), 2); }
  return Buffer.concat([header, payload]);
}
function send(socket, message) {
  if (socket.destroyed) return;
  try { socket.write(encodeFrame(JSON.stringify(message))); } catch (error) { socket.destroy(); }
}
function broadcast(room, message, exceptId = null) {
  for (const player of room.players.values()) {
    if (player.id !== exceptId) send(player.socket, message);
  }
}
function safeNumber(v, fallback = 0, min = -100000, max = 100000) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function publicPlayer(player) {
  return { id: player.id, name: player.name, characterId: player.characterId, x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch, dimension: player.dimension };
}

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws') { socket.destroy(); return; }
  const code = (url.searchParams.get('room') || '').toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); socket.destroy(); return;
  }
  if (room.players.size >= MAX_PLAYERS) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return;
  }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${wsAccept(key)}`,
    '\r\n',
  ].join('\r\n'));
  const id = crypto.randomBytes(6).toString('hex');
  const player = {
    id,
    name: sanitizeName(url.searchParams.get('name')),
    characterId: (url.searchParams.get('character') || 'burger').slice(0, 20),
    x: 0, y: 13, z: 0, yaw: 0, pitch: 0, dimension: 'overworld',
    socket, buffer: Buffer.alloc(0), alive: true,
  };
  room.players.set(id, player); clients.set(id, player);
  send(socket, {
    type: 'welcome', id, seed: room.seed,
    players: [...room.players.values()].map(publicPlayer),
    blocks: [...room.blocks.values()],
    chat: room.chat.slice(-30),
  });
  broadcast(room, { type: 'join', player: publicPlayer(player) }, id);
  broadcast(room, { type: 'players', players: [...room.players.values()].map(publicPlayer) });
  scheduleSave(room);

  socket.on('data', (chunk) => {
    player.buffer = Buffer.concat([player.buffer, chunk]);
    while (player.buffer.length >= 2) {
      const first = player.buffer[0];
      const second = player.buffer[1];
      let offset = 2;
      let length = second & 0x7f;
      if (length === 126) { if (player.buffer.length < 4) return; length = player.buffer.readUInt16BE(2); offset = 4; }
      else if (length === 127) { if (player.buffer.length < 10) return; length = Number(player.buffer.readBigUInt64BE(2)); offset = 10; }
      const masked = (second & 0x80) !== 0;
      const maskLength = masked ? 4 : 0;
      if (player.buffer.length < offset + maskLength + length) return;
      const mask = masked ? player.buffer.subarray(offset, offset + 4) : null;
      offset += maskLength;
      const raw = Buffer.from(player.buffer.subarray(offset, offset + length));
      player.buffer = player.buffer.subarray(offset + length);
      if (mask) for (let i = 0; i < raw.length; i += 1) raw[i] ^= mask[i % 4];
      const opcode = first & 0x0f;
      if (opcode === 8) { socket.destroy(); return; }
      if (opcode === 9) { /* ping */ }
      if (opcode !== 1) continue;
      let message;
      try { message = JSON.parse(raw.toString('utf8')); } catch (error) { continue; }
      if (message.type === 'state') {
        player.x = safeNumber(message.x); player.y = safeNumber(message.y); player.z = safeNumber(message.z);
        player.yaw = safeNumber(message.yaw, 0, -100, 100);
        player.pitch = safeNumber(message.pitch, 0, -2, 2);
        if (['overworld', 'ember', 'sky'].includes(message.dimension)) player.dimension = message.dimension;
        broadcast(room, { type: 'state', id, player: publicPlayer(player) }, id);
      } else if (message.type === 'block') {
        const dim = ['overworld', 'ember', 'sky'].includes(message.dimension) ? message.dimension : 'overworld';
        const x = Math.floor(safeNumber(message.x)); const y = Math.floor(safeNumber(message.y)); const z = Math.floor(safeNumber(message.z));
        const blockId = Math.floor(safeNumber(message.id, 0, 0, 64));
        const keyBlock = `${dim}:${x},${y},${z}`;
        if (blockId === 0) room.blocks.delete(keyBlock); else room.blocks.set(keyBlock, { dimension: dim, x, y, z, id: blockId });
        broadcast(room, { type: 'block', dimension: dim, x, y, z, id: blockId }, id);
        scheduleSave(room);
      } else if (message.type === 'chat') {
        const text = String(message.text || '').replace(/[\r\n]/g, ' ').trim().slice(0, 60);
        if (!text) continue;
        const entry = { id: crypto.randomBytes(4).toString('hex'), name: player.name, text, at: Date.now() };
        room.chat.push(entry); room.chat = room.chat.slice(-30);
        broadcast(room, { type: 'chat', message: entry });
        scheduleSave(room);
      }
    }
  });
  socket.on('close', () => {
    room.players.delete(id); clients.delete(id);
    broadcast(room, { type: 'leave', id, players: [...room.players.values()].map(publicPlayer) });
    scheduleSave(room);
  });
  socket.on('error', () => {});
});

server.listen(PORT, () => {
  console.log(`[美味特工队] 多人服务：http://127.0.0.1:${PORT}`);
  console.log(`[美味特工队] 房间数据：${DATA_DIR}`);
});
