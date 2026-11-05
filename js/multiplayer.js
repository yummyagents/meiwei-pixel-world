/**
 * 多人联机客户端：房间状态、远程玩家、方块同步和快捷聊天。
 * 服务端地址通过 serverBase 指定；同源部署时默认为当前站点。
 */
import * as THREE from 'three';
import { BLOCK_IDS } from './blocks.js';
import { getCharacter } from './characters.js';

const SEND_INTERVAL = 0.1;

export class MultiplayerClient {
  constructor({ game, room, playerName, characterId, serverBase, callbacks = {} }) {
    this.game = game;
    this.room = room.toUpperCase();
    this.playerName = playerName || '小特工';
    this.characterId = characterId || 'burger';
    this.serverBase = serverBase;
    this.callbacks = callbacks;
    this.socket = null;
    this.id = null;
    this.players = new Map();
    this.remotePlayers = new Map();
    this.blocksByDimension = new Map();
    this.lastSend = 0;
    this.connected = false;
    this.closed = false;
    this._nameTextureCache = new Map();
  }

  _wsUrl() {
    const raw = this.serverBase || window.location.origin;
    const url = new URL(raw);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/ws?room=${encodeURIComponent(this.room)}&name=${encodeURIComponent(this.playerName)}&character=${encodeURIComponent(this.characterId)}`;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this._wsUrl());
      } catch (error) {
        reject(error);
        return;
      }
      let settled = false;
      this.socket.addEventListener('open', () => {
        this.connected = true;
        this.callbacks.onStatus?.('connected');
        this._sendState(true);
        if (!settled) { settled = true; resolve(); }
      });
      this.socket.addEventListener('message', (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch (error) { return; }
        this._handle(message);
      });
      this.socket.addEventListener('error', () => {
        this.callbacks.onStatus?.('error');
        if (!settled) { settled = true; reject(new Error('无法连接多人服务器')); }
      });
      this.socket.addEventListener('close', () => {
        this.connected = false;
        this.callbacks.onStatus?.('closed');
        if (!settled) { settled = true; reject(new Error('多人连接已关闭')); }
      });
    });
  }

  _handle(message) {
    if (message.type === 'welcome') {
      this.id = message.id;
      this.players = new Map((message.players || []).map((p) => [p.id, p]));
      for (const block of message.blocks || []) {
        const list = this.blocksByDimension.get(block.dimension) || [];
        list.push(block);
        this.blocksByDimension.set(block.dimension, list);
      }
      this.callbacks.onWelcome?.({ id: this.id, players: [...this.players.values()], chat: message.chat || [] });
      this._syncRemotePlayers();
      this.applyDimensionBlocks(this.game.dimension);
    } else if (message.type === 'join' || message.type === 'state') {
      if (!message.player) return;
      this.players.set(message.player.id, message.player);
      if (message.player.id !== this.id) this._ensureRemotePlayer(message.player);
      this.callbacks.onPlayers?.([...this.players.values()]);
    } else if (message.type === 'leave') {
      this.players.delete(message.id);
      this._removeRemotePlayer(message.id);
      this.callbacks.onPlayers?.([...this.players.values()]);
    } else if (message.type === 'players') {
      this.players = new Map((message.players || []).map((p) => [p.id, p]));
      this._syncRemotePlayers();
      this.callbacks.onPlayers?.([...this.players.values()]);
    } else if (message.type === 'block') {
      const dimension = message.dimension || 'overworld';
      const list = this.blocksByDimension.get(dimension) || [];
      const key = `${message.x},${message.y},${message.z}`;
      this.blocksByDimension.set(dimension, list.filter((b) => `${b.x},${b.y},${b.z}` !== key).concat({ ...message }));
      if (dimension === this.game.dimension) {
        this.game.world.setBlock(message.x, message.y, message.z, message.id);
      }
    } else if (message.type === 'chat') {
      this.callbacks.onChat?.(message.message);
    }
  }

  _syncRemotePlayers() {
    for (const player of this.players.values()) {
      if (player.id === this.id) continue;
      this._ensureRemotePlayer(player);
    }
    for (const [id] of this.remotePlayers) {
      if (!this.players.has(id)) this._removeRemotePlayer(id);
    }
  }

  _nameTexture(name) {
    if (this._nameTextureCache.has(name)) return this._nameTextureCache.get(name);
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(7, 20, 30, 0.74)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = 'rgba(120, 245, 255, 0.8)';
    ctx.lineWidth = 3; ctx.strokeRect(2, 2, 252, 60);
    ctx.fillStyle = '#eaffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name.slice(0, 10), 128, 34);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this._nameTextureCache.set(name, texture);
    return texture;
  }

  _ensureRemotePlayer(info) {
    let remote = this.remotePlayers.get(info.id);
    if (!remote) {
      const character = getCharacter(info.characterId) || getCharacter('burger');
      const group = new THREE.Group();
      group.name = `remote-${info.id}`;
      const material = (color) => new THREE.MeshLambertMaterial({ color });
      const box = (w, h, d, color, x, y, z, parent = group) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
        mesh.position.set(x, y, z); parent.add(mesh); return mesh;
      };
      const skin = '#e0b08a';
      box(0.55, 0.72, 0.38, character.color, 0, 0.92, 0);
      box(0.46, 0.46, 0.44, skin, 0, 1.54, 0);
      box(0.5, 0.16, 0.5, character.accent, 0, 1.8, 0);
      box(0.13, 0.5, 0.13, skin, -0.34, 0.95, 0);
      box(0.13, 0.5, 0.13, skin, 0.34, 0.95, 0);
      box(0.16, 0.56, 0.16, '#3b3346', -0.14, 0.28, 0);
      box(0.16, 0.56, 0.16, '#3b3346', 0.14, 0.28, 0);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this._nameTexture(info.name), transparent: true, depthWrite: false,
      }));
      sprite.scale.set(2.6, 0.65, 1);
      sprite.position.y = 2.35;
      group.add(sprite);
      this.game.scene.add(group);
      remote = { group, target: new THREE.Vector3(), info };
      this.remotePlayers.set(info.id, remote);
    }
    remote.info = info;
    remote.target.set(info.x || 0, info.y || 13, info.z || 0);
    if (remote.group.position.lengthSq() === 0) remote.group.position.copy(remote.target);
    remote.group.visible = info.dimension === this.game.dimension;
    return remote;
  }

  _removeRemotePlayer(id) {
    const remote = this.remotePlayers.get(id);
    if (!remote) return;
    this.game.scene.remove(remote.group);
    remote.group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) object.material.dispose();
    });
    this.remotePlayers.delete(id);
  }

  applyDimensionBlocks(dimension) {
    const blocks = this.blocksByDimension.get(dimension) || [];
    for (const block of blocks) {
      this.game.world.setBlock(block.x, block.y, block.z, block.id);
    }
    for (const [id, remote] of this.remotePlayers) {
      const info = this.players.get(id);
      remote.group.visible = info?.dimension === dimension;
    }
  }

  sendBlock({ x, y, z, id }) {
    if (!this.connected || !this.socket) return;
    this.socket.send(JSON.stringify({ type: 'block', dimension: this.game.dimension, x, y, z, id }));
  }

  sendDimension() {
    this._sendState(true);
  }

  sendChat(text) {
    if (!this.connected || !this.socket) return;
    this.socket.send(JSON.stringify({ type: 'chat', text: String(text).slice(0, 60) }));
  }

  _sendState(force = false) {
    if (!this.connected || !this.socket) return;
    const now = performance.now() / 1000;
    if (!force && now - this.lastSend < SEND_INTERVAL) return;
    this.lastSend = now;
    const player = this.game.player;
    this.socket.send(JSON.stringify({
      type: 'state', x: player.position.x, y: player.position.y, z: player.position.z,
      yaw: player.yaw, pitch: player.pitch, dimension: this.game.dimension,
    }));
  }

  update(delta) {
    this._sendState();
    for (const [id, remote] of this.remotePlayers) {
      const info = this.players.get(id);
      if (!info) continue;
      remote.target.set(info.x, info.y, info.z);
      remote.group.position.lerp(remote.target, Math.min(1, delta * 10));
      remote.group.rotation.y += this._angleDelta(remote.group.rotation.y, info.yaw) * Math.min(1, delta * 12);
      remote.group.visible = info.dimension === this.game.dimension;
    }
  }

  _angleDelta(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  }

  dispose() {
    this.closed = true;
    try { this.socket?.close(); } catch (error) {}
    for (const id of [...this.remotePlayers.keys()]) this._removeRemotePlayer(id);
    for (const texture of this._nameTextureCache.values()) texture.dispose();
  }
}
