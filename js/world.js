/**
 * 方块世界：地形生成、区块加载、网格合并、风车地标。
 *
 * 只把玩家附近的区块变成 Three.js 网格，远处的区块会自动卸载，
 * 所以世界可以慢慢变大，也不会一次创建太多东西。
 */

import * as THREE from 'three';
import {
  ATLAS_COLS,
  ATLAS_ROWS,
  BLOCK_IDS,
  BLOCKS,
  TILE_SIZE,
  createBlockAtlasCanvas,
  isCrossBlock,
  isFlatBlock,
  isOccludingBlock,
} from './blocks.js';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 40;
export const SEA_LEVEL = 8;
export const DEFAULT_WORLD_SEED = 20261028;

export const BIOMES = Object.freeze({
  plains: {
    id: 'plains',
    name: '平原',
    emoji: '🌿',
    top: BLOCK_IDS.GRASS,
    filler: BLOCK_IDS.DIRT,
  },
  desert: {
    id: 'desert',
    name: '沙漠',
    emoji: '🏜️',
    top: BLOCK_IDS.SAND,
    filler: BLOCK_IDS.SAND,
  },
  beach: {
    id: 'beach',
    name: '海边',
    emoji: '🏖️',
    top: BLOCK_IDS.SAND,
    filler: BLOCK_IDS.SAND,
  },
  cherry: {
    id: 'cherry',
    name: '樱花林',
    emoji: '🌸',
    top: BLOCK_IDS.GRASS,
    filler: BLOCK_IDS.DIRT,
  },
  snow: {
    id: 'snow',
    name: '雪地',
    emoji: '❄️',
    top: BLOCK_IDS.SNOW,
    filler: BLOCK_IDS.DIRT,
  },
  ocean: {
    id: 'ocean',
    name: '海洋',
    emoji: '🌊',
    top: BLOCK_IDS.SAND,
    filler: BLOCK_IDS.SAND,
  },
  river: {
    id: 'river',
    name: '河流',
    emoji: '🏞️',
    top: BLOCK_IDS.SAND,
    filler: BLOCK_IDS.SAND,
  },
  mountain: {
    id: 'mountain',
    name: '高山',
    emoji: '⛰️',
    top: BLOCK_IDS.STONE,
    filler: BLOCK_IDS.STONE,
  },
  jungle: {
    id: 'jungle',
    name: '丛林',
    emoji: '🌴',
    top: BLOCK_IDS.GRASS,
    filler: BLOCK_IDS.DIRT,
  },
});

const FACE_DEFINITIONS = Object.freeze([
  {
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    shade: 0.84,
    tile: 'side',
  },
  {
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    shade: 0.7,
    tile: 'side',
  },
  {
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    shade: 1,
    tile: 'top',
  },
  {
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    shade: 0.52,
    tile: 'bottom',
  },
  {
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    shade: 0.92,
    tile: 'side',
  },
  {
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    shade: 0.65,
    tile: 'side',
  },
]);

const NEXT_FRAME =
  typeof requestAnimationFrame === 'function'
    ? () => new Promise((resolve) => requestAnimationFrame(resolve))
    : () => new Promise((resolve) => setTimeout(resolve, 0));

export class World {
  constructor({ scene, seed = DEFAULT_WORLD_SEED, renderDistance = 3, visualTheme = null }) {
    this.scene = scene;
    this.seed = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : DEFAULT_WORLD_SEED;
    this.renderDistance = Math.max(2, Math.min(5, Number(renderDistance) || 3));
    this.seaLevel = SEA_LEVEL;
    this.chunks = new Map();
    this.pendingChunks = [];
    this.blockOverrides = new Map();
    this.overridesByChunk = new Map();
    this.chunkGroup = new THREE.Group();
    this.chunkGroup.name = 'chunks';
    this.scene.add(this.chunkGroup);

    this._lastCenter = null;
    this._checkTimer = 0;
    this._landmarkTime = 0;
    this._heightCache = new Map();

    this.spawn = this.findSpawn();
    this.landmarkSpot = this.findLandmarkSpot(this.spawn);
    this.exclusionZones = [
      { x: this.spawn.x, z: this.spawn.z, radius: 4.5 },
      { x: this.landmarkSpot.x, z: this.landmarkSpot.z, radius: 6.5 },
    ];
    this.structureBlocksByChunk = new Map();
    this.villageSpots = [];
    this.mineshafts = [];
    this.waterfalls = [];
    this.villageSpot = this.findVillageSpot(this.spawn);
    this.exclusionZones.push({
      x: this.villageSpot.x,
      z: this.villageSpot.z,
      radius: 10.5,
    });
    this._planVillage(this.villageSpot);
    this.caveEntrance = this.findCaveEntranceSpot(this.spawn);
    this._planCaveEntrance(this.caveEntrance);
    this.waterfallSpot = this.findWaterfallSpot(this.spawn);
    if (this.waterfallSpot) this._planWaterfall(this.waterfallSpot);
    this.techCity = this._planTechCity(this.waterfallSpot);

    this.atlasCanvas = createBlockAtlasCanvas();
    this.atlasTexture = new THREE.CanvasTexture(this.atlasCanvas);
    this.atlasTexture.magFilter = THREE.NearestFilter;
    this.atlasTexture.minFilter = THREE.NearestFilter;
    this.atlasTexture.generateMipmaps = false;
    this.atlasTexture.colorSpace = THREE.SRGBColorSpace;
    this.atlasTexture.needsUpdate = true;

    this.solidMaterial = new THREE.MeshLambertMaterial({
      map: this.atlasTexture,
      vertexColors: true,
      alphaTest: 0.5,
    });
    this.transparentMaterial = new THREE.MeshLambertMaterial({
      map: this.atlasTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      alphaTest: 0.04,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.landmarks = this._createLandmarks();
    this.scene.add(this.landmarks);
    this.waterfallVisual = this._createWaterfallVisual();
    if (this.waterfallVisual) this.scene.add(this.waterfallVisual);
    this.applyVisualTheme(visualTheme);
  }

  applyVisualTheme(theme) {
    this.visualTheme = theme || null;
    const tint = theme?.worldTint || '#ffffff';
    const waterTint = theme?.waterTint || '#ffffff';
    this.solidMaterial.color.set(tint);
    this.transparentMaterial.color.set(waterTint);
    if (this.waterfallMaterial) this.waterfallMaterial.color.set(waterTint);
  }

  /* ----------------------------- 种子与噪声 ----------------------------- */

  heightAt(x, z) {
    const key = `${Math.floor(x)},${Math.floor(z)}`;
    const cached = this._heightCache.get(key);
    if (cached !== undefined) return cached;

    const broad = fbm2(this.seed + 11, x * 0.006, z * 0.006, 4);
    const hills = fbm2(this.seed + 23, x * 0.026, z * 0.026, 3);
    const ridge = fbm2(this.seed + 31, x * 0.011, z * 0.011, 2);
    const continent = fbm2(this.seed + 7, x * 0.0032, z * 0.0032, 3);
    const mountainNoise = fbm2(this.seed + 71, x * 0.0045, z * 0.0045, 3);

    let height = 4 + broad * 11.5 + hills * 3.1 + ridge * ridge * 2.4;
    const oceanMask = 1 - smoothstepRange(0.32, 0.47, continent);
    height -= oceanMask * 14;

    const mountainMask = smoothstepRange(0.56, 0.78, mountainNoise);
    height += mountainMask * 19;

    const riverStrength = riverStrengthAt(this.seed, x, z);
    if (height > SEA_LEVEL + 1 && height < 21) {
      height -= riverStrength * 6.5;
      if (riverStrength > 0.62) height = Math.min(height, SEA_LEVEL - 1);
    }

    const finalHeight = Math.max(2, Math.min(CHUNK_HEIGHT - 8, Math.floor(height)));
    if (this._heightCache.size > 60000) this._heightCache.clear();
    this._heightCache.set(key, finalHeight);
    return finalHeight;
  }

  biomeAt(x, z) {
    const height = this.heightAt(x, z);
    const river = riverStrengthAt(this.seed, x, z);
    if (height < SEA_LEVEL - 2) return 'ocean';
    if (river > 0.52 && height <= 19) return 'river';
    if (height <= SEA_LEVEL + 1) return 'beach';
    if (height >= 22) return 'mountain';

    const temperature = fbm2(this.seed + 43, x * 0.0042, z * 0.0042, 3);
    const moisture = fbm2(this.seed + 59, x * 0.0052, z * 0.0052, 3);

    if (temperature < 0.28) return 'snow';
    if (height >= 18) return 'mountain';
    if (moisture > 0.6 && temperature > 0.48) return 'jungle';
    if (temperature > 0.63 && moisture < 0.44) return 'desert';
    if (moisture > 0.62) return 'cherry';
    return 'plains';
  }

  getBiomeInfo(x, z) {
    return BIOMES[this.biomeAt(x, z)] || BIOMES.plains;
  }

  findSpawn() {
    let cherryFallback = null;

    for (let radius = 0; radius <= 48; radius += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = dx;
          const z = dz;
          const height = this.heightAt(x, z);
          const biome = this.biomeAt(x, z);

          if (biome !== 'plains' && biome !== 'cherry') continue;
          if (height <= SEA_LEVEL + 2 || height >= 16) continue;

          let minHeight = height;
          let maxHeight = height;
          for (let ox = -2; ox <= 2; ox += 1) {
            for (let oz = -2; oz <= 2; oz += 1) {
              const h = this.heightAt(x + ox, z + oz);
              minHeight = Math.min(minHeight, h);
              maxHeight = Math.max(maxHeight, h);
            }
          }
          if (maxHeight - minHeight > 1) continue;

          const candidate = {
            x: x + 0.5,
            y: height + 1.03,
            z: z + 0.5,
            blockY: height,
            biome,
          };

          // 默认世界从软软的平原开始；如果附近真的没有平原，再使用樱花林。
          if (biome === 'plains') return candidate;
          if (!cherryFallback) cherryFallback = candidate;
        }
      }
    }

    if (cherryFallback) return cherryFallback;
    const safeHeight = Math.max(SEA_LEVEL + 2, this.heightAt(0, 0));
    return { x: 0.5, y: safeHeight + 1.03, z: 0.5, blockY: safeHeight, biome: 'plains' };
  }

  findLandmarkSpot(spawn) {
    const baseX = Math.round(spawn.x);
    const baseZ = Math.round(spawn.z);

    for (let radius = 18; radius <= 30; radius += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = baseX + dx;
          const z = baseZ + dz;
          const biome = this.biomeAt(x, z);
          if (biome !== 'plains' && biome !== 'cherry') continue;

          let minHeight = Infinity;
          let maxHeight = -Infinity;
          for (let ox = -2; ox <= 2; ox += 1) {
            for (let oz = -2; oz <= 2; oz += 1) {
              const h = this.heightAt(x + ox, z + oz);
              minHeight = Math.min(minHeight, h);
              maxHeight = Math.max(maxHeight, h);
            }
          }
          if (minHeight <= SEA_LEVEL + 1) continue;
          if (maxHeight - minHeight > 1) continue;

          return { x: x + 0.5, z: z + 0.5, blockY: maxHeight };
        }
      }
    }

    return { x: spawn.x + 18.5, z: spawn.z + 18.5, blockY: this.heightAt(spawn.x + 18, spawn.z + 18) };
  }

  findVillageSpot(spawn) {
    const baseX = Math.round(spawn.x);
    const baseZ = Math.round(spawn.z);
    let fallback = null;

    for (let radius = 20; radius <= 58; radius += 2) {
      for (let i = 0; i < Math.max(16, radius * 2); i += 1) {
        const angle = (i / Math.max(16, radius * 2)) * Math.PI * 2;
        const x = Math.round(baseX + Math.cos(angle) * radius);
        const z = Math.round(baseZ + Math.sin(angle) * radius);
        if (Math.hypot(x - this.landmarkSpot.x, z - this.landmarkSpot.z) < 10) continue;
        const biome = this.biomeAt(x, z);
        if (biome !== 'plains' && biome !== 'cherry') continue;
        const height = this.heightAt(x, z);
        if (height <= SEA_LEVEL + 2 || height >= 17) continue;

        let minHeight = height;
        let maxHeight = height;
        for (let ox = -5; ox <= 5; ox += 1) {
          for (let oz = -5; oz <= 5; oz += 1) {
            const h = this.heightAt(x + ox, z + oz);
            minHeight = Math.min(minHeight, h);
            maxHeight = Math.max(maxHeight, h);
          }
        }
        const flat = maxHeight - minHeight <= 2;
        const spot = { x: x + 0.5, z: z + 0.5, blockY: maxHeight };
        if (flat) return spot;
        if (!fallback) fallback = spot;
      }
    }

    if (fallback) return fallback;
    const x = spawn.x + 26;
    const z = spawn.z - 20;
    return { x, z, blockY: this.heightAt(Math.floor(x), Math.floor(z)) };
  }

  findCaveEntranceSpot(spawn) {
    const baseX = Math.round(spawn.x);
    const baseZ = Math.round(spawn.z);
    let fallback = null;
    for (let radius = 7; radius <= 30; radius += 1) {
      for (let i = 0; i < 32; i += 1) {
        const angle = (i / 32) * Math.PI * 2;
        const x = Math.round(baseX + Math.cos(angle) * radius);
        const z = Math.round(baseZ + Math.sin(angle) * radius);
        if (this._isExcluded(x, z)) continue;
        if (this._isExcluded(x, z + 12)) continue;
        if (this._isExcluded(x, z + 20)) continue;
        const biome = this.biomeAt(x, z);
        if (biome !== 'plains' && biome !== 'cherry' && biome !== 'jungle') continue;
        const height = this.heightAt(x, z);
        if (height < 11 || height > 17) continue;
        const spot = { x: x + 0.5, z: z + 0.5, startY: height };
        if (!fallback) fallback = spot;
        // 找一块入口附近比较平的地方，避免楼梯一开始就卡在陡坡里。
        const h2 = this.heightAt(x, z + 4);
        const h3 = this.heightAt(x - 2, z);
        const h4 = this.heightAt(x + 2, z);
        if (Math.abs(height - h2) <= 2 && Math.abs(height - h3) <= 2 && Math.abs(height - h4) <= 2) {
          return spot;
        }
      }
    }
    if (fallback) return fallback;
    return { x: spawn.x - 10.5, z: spawn.z + 6.5, startY: this.heightAt(Math.floor(spawn.x) - 10, Math.floor(spawn.z) + 6) };
  }

  _planCaveEntrance(spot) {
    const cx = Math.floor(spot.x);
    const cz = Math.floor(spot.z);
    const startY = spot.startY;
    const put = (x, y, z, id) => this._queueStructureBlock(x, y, z, id);
    const air = BLOCK_IDS.AIR;
    const stone = BLOCK_IDS.MOSSY_STONE;
    const brick = BLOCK_IDS.STONE_BRICKS;
    const cobble = BLOCK_IDS.COBBLESTONE;
    const dark = BLOCK_IDS.DARK_PLANKS;
    const torch = BLOCK_IDS.TORCH;

    // 入口石拱门，远远就能看到。
    for (const dx of [-2, 2]) {
      for (let y = startY + 1; y <= startY + 3; y += 1) put(cx + dx, y, cz, brick);
    }
    for (let dx = -2; dx <= 2; dx += 1) put(cx + dx, startY + 4, cz, brick);
    put(cx - 2, startY + 3, cz + 1, torch);
    put(cx + 2, startY + 3, cz + 1, torch);

    // 九级台阶向南慢慢下到地下。
    for (let i = 0; i <= 9; i += 1) {
      const stepY = startY - i;
      for (let dx = -1; dx <= 1; dx += 1) {
        put(cx + dx, stepY, cz + i, i === 0 ? brick : cobble);
        for (let y = stepY + 1; y <= stepY + 5; y += 1) {
          put(cx + dx, y, cz + i, air);
        }
      }
      for (const dx of [-2, 2]) {
        for (let y = stepY + 1; y <= stepY + 5; y += 1) {
          put(cx + dx, y, cz + i, stone);
        }
      }
      if (i === 3 || i === 6 || i === 9) {
        put(cx - 2, stepY + 2, cz + i, torch);
      }
    }

    // 楼梯底下的展示洞穴：左边繁茂，右边硫磺，中间还有一小段废弃矿车轨道。
    const floorY = startY - 9;
    const airStart = floorY + 1;
    const roomZ = cz + 16;
    for (let dx = -6; dx <= 6; dx += 1) {
      for (let dz = -6; dz <= 6; dz += 1) {
        for (let y = airStart; y <= airStart + 5; y += 1) {
          put(cx + dx, y, roomZ + dz, air);
        }
        put(cx + dx, floorY, roomZ + dz, dx < -1 ? BLOCK_IDS.MOSS : dx > 1 ? BLOCK_IDS.BASALT : cobble);
        put(cx + dx, airStart + 6, roomZ + dz, (dx + dz) % 4 === 0 ? BLOCK_IDS.COBBLESTONE : stone);
      }
    }
    // 房间外墙，避免破洞。
    for (let y = airStart; y <= airStart + 5; y += 1) {
      for (let dx = -6; dx <= 6; dx += 1) {
        put(cx + dx, y, roomZ - 7, (dx + y) % 3 === 0 ? BLOCK_IDS.COBBLESTONE : stone);
        put(cx + dx, y, roomZ + 7, (dx + y) % 3 === 0 ? BLOCK_IDS.COBBLESTONE : stone);
      }
      for (let dz = -6; dz <= 6; dz += 1) {
        put(cx - 7, y, roomZ + dz, (dz + y) % 3 === 0 ? BLOCK_IDS.COBBLESTONE : stone);
        put(cx + 7, y, roomZ + dz, (dz + y) % 3 === 0 ? BLOCK_IDS.COBBLESTONE : stone);
      }
    }
    // 在入口那一面墙上开一个门洞，不然楼梯会被墙挡住。
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let y = airStart; y <= airStart + 4; y += 1) {
        put(cx + dx, y, roomZ - 7, air);
      }
    }
    // 从楼梯底部通到房间。
    for (let dz = 10; dz <= 11; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let y = airStart; y <= airStart + 4; y += 1) put(cx + dx, y, cz + dz, air);
        put(cx + dx, floorY, cz + dz, cobble);
      }
    }
    // 繁茂洞穴：苔藓、杜鹃叶和发光浆果。
    for (let i = 0; i < 26; i += 1) {
      const dx = -6 + ((i * 7) % 5);
      const dz = -5 + ((i * 11) % 11);
      put(cx + dx, airStart + 1, roomZ + dz, i % 3 === 0 ? BLOCK_IDS.GLOW_BERRIES : BLOCK_IDS.AZALEA_LEAVES);
      if (i % 4 === 0) put(cx + dx, floorY, roomZ + dz, BLOCK_IDS.MOSS);
    }
    for (let i = 0; i < 20; i += 1) {
      const dx = 1 + ((i * 5) % 5);
      const dz = -5 + ((i * 7) % 11);
      if (i % 2 === 0) put(cx + dx, airStart + 1, roomZ + dz, BLOCK_IDS.SULFUR_CRYSTAL);
      if (i % 3 === 0) put(cx + dx, floorY, roomZ + dz, BLOCK_IDS.SULFUR);
    }
    // 一小段矿车轨道和木支架。
    for (let dz = -2; dz <= 2; dz += 1) put(cx, floorY + 1, roomZ + 3 + dz, BLOCK_IDS.RAIL);
    for (const [dx, dz] of [[-2, 2], [2, 2], [-2, 6], [2, 6]]) {
      for (let y = airStart; y <= airStart + 2; y += 1) put(cx + dx, y, roomZ + dz, dark);
      put(cx + dx, airStart + 3, roomZ + dz, BLOCK_IDS.DARK_PLANKS);
    }
    put(cx - 2, airStart + 2, roomZ + 2, torch);
    put(cx + 2, airStart + 2, roomZ + 6, torch);
    put(cx, floorY + 1, roomZ + 7, BLOCK_IDS.CHEST);
    // 水井似的小水潭，给繁茂洞穴一点水光。
    for (let dx = -4; dx <= -2; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        put(cx + dx, floorY + 1, roomZ + dz, BLOCK_IDS.WATER);
      }
    }

    this.caveEntrance = { x: cx + 0.5, z: cz + 0.5, y: floorY + 1, startY, roomZ };
    this.exclusionZones.push({ x: cx, z: cz, radius: 7 });
  }

  findWaterfallSpot(spawn) {
    const baseX = Math.round(spawn.x);
    const baseZ = Math.round(spawn.z);
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];
    let best = null;

    // 在出生点附近找一处有落差的悬崖。近一点的水帘比远处的高山更容易被小朋友发现。
    for (let radius = 30; radius <= 180; radius += 3) {
      const steps = Math.max(24, Math.floor(radius * 1.6));
      for (let i = 0; i < steps; i += 1) {
        const angle = (i / steps) * Math.PI * 2;
        const x = Math.round(baseX + Math.cos(angle) * radius);
        const z = Math.round(baseZ + Math.sin(angle) * radius);
        const biome = this.biomeAt(x, z);
        if (biome === 'ocean' || biome === 'river' || biome === 'beach') continue;
        if (biome === 'snow' && radius > 160) continue;
        if (this._isExcluded(x, z)) continue;
        const height = this.heightAt(x, z);
        if (height < 13) continue;

        for (const [dx, dz] of dirs) {
          for (let distance = 1; distance <= 3; distance += 1) {
            const nx = x + dx * distance;
            const nz = z + dz * distance;
            const lowHeight = this.heightAt(nx, nz);
            const drop = height - lowHeight;
            if (drop < 5) continue;
            const distanceToSpawn = Math.hypot(x - spawn.x, z - spawn.z);
            const score =
              drop * 3 -
              distanceToSpawn * 0.025 +
              (biome === 'mountain' ? 10 : 0) +
              (biome === 'jungle' ? 3 : 0);
            if (!best || score > best.score) {
              best = {
                x,
                z,
                height,
                biome,
                lowX: nx,
                lowZ: nz,
                lowHeight,
                score,
                distance,
              };
            }
            break;
          }
        }
      }
    }
    if (best) return best;

    // 个别种子没有很高的悬崖，也至少找一个小台阶做水帘，保证世界里有瀑布。
    for (let radius = 12; radius <= 100; radius += 4) {
      const steps = 24;
      for (let i = 0; i < steps; i += 1) {
        const angle = (i / steps) * Math.PI * 2;
        const x = Math.round(baseX + Math.cos(angle) * radius);
        const z = Math.round(baseZ + Math.sin(angle) * radius);
        if (this.biomeAt(x, z) === 'ocean' || this._isExcluded(x, z)) continue;
        const height = this.heightAt(x, z);
        if (height < SEA_LEVEL + 2) continue;
        for (const [dx, dz] of dirs) {
          const nx = x + dx * 2;
          const nz = z + dz * 2;
          const lowHeight = this.heightAt(nx, nz);
          if (height - lowHeight < 2) continue;
          return {
            x,
            z,
            height,
            biome: this.biomeAt(x, z),
            lowX: nx,
            lowZ: nz,
            lowHeight,
            score: -radius,
            distance: 2,
          };
        }
      }
    }
    return null;
  }

  _planWaterfall(spot) {
    const fall = {
      x: spot.lowX + 0.5,
      z: spot.lowZ + 0.5,
      top: { x: spot.x, y: spot.height, z: spot.z },
      bottom: { x: spot.lowX, y: spot.lowHeight, z: spot.lowZ },
    };
    this.waterfalls.push(fall);

    const put = (x, y, z, id) => this._queueStructureBlock(x, y, z, id);
    const water = BLOCK_IDS.WATER;
    const stone = BLOCK_IDS.COBBLESTONE;
    const mossy = BLOCK_IDS.MOSSY_STONE;

    // 先把水帘周围会穿模的树叶和树枝清掉。
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        for (let y = spot.height + 1; y <= spot.height + 5; y += 1) {
          put(spot.x + dx, y, spot.z + dz, BLOCK_IDS.AIR);
        }
      }
    }

    // 山顶的小水池。
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        if (Math.abs(dx) + Math.abs(dz) > 3) continue;
        put(spot.x + dx, spot.height + 1, spot.z + dz, water);
      }
    }

    // 顺着悬崖落下的一道水帘。
    const dx = Math.sign(spot.lowX - spot.x);
    const dz = Math.sign(spot.lowZ - spot.z);
    for (let y = spot.lowHeight + 1; y <= spot.height; y += 1) {
      put(spot.lowX, y, spot.lowZ, water);
      put(spot.lowX - dx, y, spot.lowZ - dz, water);
    }

    // 水池和石头边沿。
    for (let ox = -2; ox <= 2; ox += 1) {
      for (let oz = -2; oz <= 2; oz += 1) {
        const x = spot.lowX + ox;
        const z = spot.lowZ + oz;
        const h = this.heightAt(x, z);
        const isPool = Math.abs(ox) <= 1 && Math.abs(oz) <= 1;
        if (isPool) {
          put(x, h + 1, z, water);
        } else {
          put(x, h + 1, z, (ox + oz) % 2 === 0 ? stone : mossy);
        }
      }
    }

    // 瀑布旁的苔石和几块小石头。
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const x = spot.lowX + Math.round(Math.cos(angle) * 3);
      const z = spot.lowZ + Math.round(Math.sin(angle) * 3);
      const h = this.heightAt(x, z);
      if (this.getBlock(x, h, z) === BLOCK_IDS.AIR) {
        put(x, h + 1, z, i % 3 === 0 ? mossy : stone);
      }
    }

    this.exclusionZones.push({ x: fall.x, z: fall.z, radius: 8 });
  }


  _planTechCity(waterfallSpot) {
    if (!waterfallSpot) return null;

    const centerX = Math.round(waterfallSpot.lowX + 20);
    const centerZ = Math.round(waterfallSpot.lowZ - 12);
    const halfX = 14;
    const halfZ = 9;
    const minX = centerX - halfX;
    const maxX = centerX + halfX;
    const minZ = centerZ - halfZ;
    const maxZ = centerZ + halfZ;
    let baseY = 14;
    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        baseY = Math.max(baseY, this.heightAt(x, z));
      }
    }
    baseY = Math.min(18, baseY);

    const put = (x, y, z, id) => this._queueStructureBlock(x, y, z, id);
    const B = BLOCK_IDS;
    const isCornerCut = (x, z) => {
      const dx = Math.abs(x - centerX);
      const dz = Math.abs(z - centerZ);
      return (dx === halfX && dz > halfZ - 3) || (dz === halfZ && dx > halfX - 3);
    };

    // 先把山坡削成一块稳定的城市台地，并在南侧保留悬崖。
    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        if (isCornerCut(x, z)) continue;
        const ground = this.heightAt(x, z);
        for (let y = ground + 1; y < baseY; y += 1) {
          put(x, y, z, (x + z + y) % 5 === 0 ? B.STONE_BRICKS : B.COPPER);
        }
        for (let y = baseY + 1; y <= baseY + 26; y += 1) {
          put(x, y, z, B.AIR);
        }
        const dx = Math.abs(x - centerX);
        const dz = Math.abs(z - centerZ);
        let floor = B.STONE_BRICKS;
        if (dx <= 2 || dz <= 1) floor = B.DARK_PLANKS;
        else if (dx > 10 && dz > 4) floor = (x + z) % 3 === 0 ? B.MOSS : B.GRASS;
        else if ((x + z) % 9 === 0) floor = B.COPPER;
        put(x, baseY, z, floor);
      }
    }

    // 北侧三层花园台地，保留可走上去的台阶。
    for (let x = centerX - 11; x <= centerX + 11; x += 1) {
      for (let z = centerZ - 9; z <= centerZ - 5; z += 1) {
        put(x, baseY + 1, z, (x + z) % 3 === 0 ? B.MOSS : B.GRASS);
      }
    }
    for (let x = centerX - 7; x <= centerX + 7; x += 1) {
      for (let z = centerZ - 9; z <= centerZ - 7; z += 1) {
        put(x, baseY + 2, z, (x + z) % 2 === 0 ? B.MOSS : B.GRASS);
      }
    }
    // 台地挡墙和霓虹边线。
    for (let x = centerX - 11; x <= centerX + 11; x += 1) {
      put(x, baseY + 1, centerZ - 4, x % 4 === 0 ? B.COPPER : B.STONE_BRICKS);
      put(x, baseY + 2, centerZ - 6, x % 4 === 0 ? B.NEON : B.COPPER);
    }
    for (let z = centerZ - 4; z <= centerZ + 7; z += 1) {
      put(centerX - 11, baseY + 1, z, z % 5 === 0 ? B.COPPER : B.STONE_BRICKS);
      put(centerX + 11, baseY + 1, z, z % 5 === 0 ? B.COPPER : B.STONE_BRICKS);
    }
    // 从广场上花园的台阶。
    for (let z = centerZ - 4; z >= centerZ - 7; z -= 1) {
      const stepY = baseY + (centerZ - 4 - z >= 2 ? 2 : 1);
      for (let x = centerX - 1; x <= centerX + 1; x += 1) put(x, stepY, z, B.COPPER);
    }

    // 中央“汉堡能源塔”：铜色塔身、玻璃窗、霓虹带和汉堡屋顶。
    const towerX0 = centerX - 2;
    const towerX1 = centerX + 2;
    const towerZ0 = centerZ - 2;
    const towerZ1 = centerZ + 2;
    for (let y = baseY; y <= baseY + 8; y += 1) {
      for (let x = towerX0; x <= towerX1; x += 1) {
        for (let z = towerZ0; z <= towerZ1; z += 1) {
          const edge = x === towerX0 || x === towerX1 || z === towerZ0 || z === towerZ1;
          if (!edge) {
            if (y === baseY + 8) put(x, y, z, B.COPPER);
            else put(x, y, z, B.AIR);
            continue;
          }
          let id = (x + z + y) % 5 === 0 ? B.STONE_BRICKS : B.COPPER;
          if ((x === towerX0 || x === towerX1) && (z === towerZ0 || z === towerZ1)) id = B.COPPER;
          if (z === towerZ1 && x >= towerX0 + 1 && x <= towerX1 - 1 && y <= baseY + 2) id = B.AIR;
          else if ((y === baseY + 3 || y === baseY + 5) && (x === towerX0 || x === towerX1 || z === towerZ0)) id = B.GLASS;
          else if (y === baseY + 4 || y === baseY + 7) id = B.NEON;
          put(x, y, z, id);
        }
      }
    }
    for (let x = towerX0 - 1; x <= towerX1 + 1; x += 1) {
      for (let z = towerZ0 - 1; z <= towerZ1 + 1; z += 1) {
        put(x, baseY + 9, z, B.ROOF);
      }
    }
    for (let x = towerX0; x <= towerX1; x += 1) {
      for (let z = towerZ0; z <= towerZ1; z += 1) {
        put(x, baseY + 10, z, (x + z) % 3 === 0 ? B.NEON : B.COPPER);
      }
    }
    for (let x = towerX0 + 1; x <= towerX1 - 1; x += 1) {
      for (let z = towerZ0 + 1; z <= towerZ1 - 1; z += 1) {
        put(x, baseY + 11, z, B.ROOF);
      }
    }
    put(centerX, baseY + 12, centerZ, B.NEON);
    put(centerX, baseY + 13, centerZ, B.COPPER);

    // 西侧“汽水冷却塔”：玻璃水箱和铜色外框。
    const tankX0 = centerX - 11;
    const tankX1 = centerX - 7;
    const tankZ0 = centerZ - 2;
    const tankZ1 = centerZ + 2;
    for (let x = tankX0; x <= tankX1; x += 1) {
      for (let z = tankZ0; z <= tankZ1; z += 1) {
        put(x, baseY, z, B.COPPER);
        const edge = x === tankX0 || x === tankX1 || z === tankZ0 || z === tankZ1;
        for (let y = baseY + 1; y <= baseY + 5; y += 1) {
          if (edge) put(x, y, z, y === baseY + 5 || (x + z + y) % 7 === 0 ? B.COPPER : B.GLASS);
          else put(x, y, z, B.WATER);
        }
      }
    }
    for (let x = tankX0 - 1; x <= tankX1 + 1; x += 1) {
      for (let z = tankZ0 - 1; z <= tankZ1 + 1; z += 1) {
        put(x, baseY + 6, z, (x + z) % 4 === 0 ? B.NEON : B.COPPER);
      }
    }

    // 东侧“薯条信号塔”：铜色塔身，顶上竖着黄色薯条。
    const signalX0 = centerX + 7;
    const signalX1 = centerX + 9;
    const signalZ0 = centerZ - 3;
    const signalZ1 = centerZ - 1;
    for (let y = baseY; y <= baseY + 9; y += 1) {
      for (let x = signalX0; x <= signalX1; x += 1) {
        for (let z = signalZ0; z <= signalZ1; z += 1) {
          const edge = x === signalX0 || x === signalX1 || z === signalZ0 || z === signalZ1;
          if (!edge) { put(x, y, z, B.AIR); continue; }
          let id = (y === baseY + 4 || y === baseY + 7) ? B.NEON : B.COPPER;
          if (y === baseY + 2 && z === signalZ0 && x === signalX0 + 1) id = B.GLASS;
          put(x, y, z, id);
        }
      }
    }
    // 顶部做成一只红色薯条盒，黄色薯条分开放，不糊成一块。
    for (let x = signalX0 - 1; x <= signalX1 + 1; x += 1) {
      for (let z = signalZ0 - 1; z <= signalZ1 + 1; z += 1) {
        put(x, baseY + 10, z, (x + z) % 3 === 0 ? B.NEON : B.COPPER);
      }
    }
    for (let y = baseY + 11; y <= baseY + 13; y += 1) {
      for (let x = signalX0 - 1; x <= signalX1 + 1; x += 1) {
        for (let z = signalZ0 - 1; z <= signalZ1 + 1; z += 1) {
          const edge = x === signalX0 - 1 || x === signalX1 + 1 || z === signalZ0 - 1 || z === signalZ1 + 1;
          if (edge) put(x, y, z, y === baseY + 13 ? B.ROOF : B.COPPER);
        }
      }
    }
    const frySpots = [
      [signalX0 - 1, signalZ0, 4],
      [signalX0 + 1, signalZ0, 5],
      [signalX0, signalZ1 - 1, 3],
      [signalX0 + 2, signalZ1 - 1, 4],
    ];
    for (const [fx, fz, fh] of frySpots) {
      for (let y = baseY + 13; y <= baseY + 13 + fh; y += 1) put(fx, y, fz, B.SAND);
    }

    // 南侧入口拱门。
    for (const x of [centerX - 4, centerX + 4]) {
      for (let y = baseY + 1; y <= baseY + 4; y += 1) put(x, y, maxZ - 1, B.COPPER);
    }
    for (let x = centerX - 4; x <= centerX + 4; x += 1) {
      put(x, baseY + 4, maxZ - 1, x % 2 === 0 ? B.NEON : B.DARK_PLANKS);
    }

    // 中央输水管道，把水送到南侧河道上空，再形成主瀑布。
    const fallZ = maxZ + 6;
    for (let z = centerZ + 2; z <= fallZ; z += 1) {
      put(centerX, baseY + 6, z, B.WATER);
      put(centerX + 1, baseY + 6, z, B.WATER);
      put(centerX - 1, baseY + 6, z, B.COPPER);
      put(centerX + 2, baseY + 6, z, B.COPPER);
      put(centerX, baseY + 5, z, B.COPPER);
      put(centerX + 1, baseY + 5, z, B.COPPER);
      if ((z - centerZ) % 4 === 0) {
        for (let y = baseY + 1; y <= baseY + 4; y += 1) {
          put(centerX - 1, y, z, B.COPPER);
          put(centerX + 2, y, z, B.COPPER);
        }
      }
    }

    // 花园、路灯和小树。
    for (let x = centerX - 10; x <= centerX + 10; x += 2) {
      for (let z = centerZ - 8; z <= centerZ - 5; z += 2) {
        put(x, baseY + 2, z, B.FLOWER);
      }
    }
    for (const [lx, lz] of [[centerX - 12, centerZ + 5], [centerX + 12, centerZ + 5], [centerX - 12, centerZ - 3], [centerX + 12, centerZ - 3]]) {
      put(lx, baseY + 1, lz, B.COPPER);
      put(lx, baseY + 2, lz, B.COPPER);
      put(lx, baseY + 3, lz, B.NEON);
    }
    // 两侧抬高一级的花园平台，从正面也能看到层层绿意。
    for (const side of [-1, 1]) {
      const x0 = centerX + side * 8;
      const x1 = centerX + side * 13;
      const xa = Math.min(x0, x1);
      const xb = Math.max(x0, x1);
      for (let x = xa; x <= xb; x += 1) {
        for (let z = centerZ + 3; z <= maxZ - 2; z += 1) {
          put(x, baseY + 1, z, (x + z) % 3 === 0 ? B.MOSS : B.GRASS);
          if (x === xa || x === xb) put(x, baseY + 1, z, (z % 2 === 0) ? B.COPPER : B.STONE_BRICKS);
          if ((x + z) % 5 === 0) put(x, baseY + 2, z, B.FLOWER);
        }
      }
    }

    // 两侧的低矮花园，让科技城保留参考图里的绿意和橙色小花。
    for (let z = centerZ + 1; z <= maxZ - 2; z += 1) {
      for (const baseX of [centerX - 13, centerX + 13]) {
        put(baseX, baseY + 1, z, (z % 2 === 0) ? B.MOSS : B.GRASS);
        put(baseX - 1, baseY + 1, z, (z % 3 === 0) ? B.COPPER : B.STONE_BRICKS);
        put(baseX + 1, baseY + 1, z, (z % 3 === 0) ? B.COPPER : B.STONE_BRICKS);
        if (z % 3 === 0) put(baseX, baseY + 2, z, B.FLOWER);
      }
    }
    for (const [tx, tz] of [[centerX - 12, centerZ - 8], [centerX + 12, centerZ - 8]]) {
      put(tx, baseY + 1, tz, B.WOOD);
      put(tx, baseY + 2, tz, B.WOOD);
      for (let ox = -1; ox <= 1; ox += 1) {
        for (let oz = -1; oz <= 1; oz += 1) {
          put(tx + ox, baseY + 3, tz + oz, B.LEAVES);
        }
      }
      put(tx, baseY + 4, tz, B.LEAVES);
    }

    // 三道城市瀑布，连同原来的瀑布一共四处水景。
    const falls = [];
    const addFall = (x, topY, width = 2) => {
      const bottomY = this.heightAt(x, fallZ) + 1;
      const top = { x: x + 0.5, y: topY, z: fallZ + 0.5 };
      const bottom = { x: x + 0.5, y: bottomY, z: fallZ + 0.5 };
      for (let dx = 0; dx < width; dx += 1) {
        for (let y = bottomY + 1; y <= topY; y += 1) put(x + dx, y, fallZ, B.WATER);
      }
      falls.push({ x: x + 0.5, z: fallZ + 0.5, top, bottom });
      this.waterfalls.push({ x: x + 0.5, z: fallZ + 0.5, top, bottom });
      // 底部水池边沿
      for (let ox = -2; ox <= 2; ox += 1) {
        for (let oz = -1; oz <= 2; oz += 1) {
          if (Math.abs(ox) <= 1 && oz <= 1) continue;
          const h = this.heightAt(x + ox, fallZ + oz);
          put(x + ox, h + 1, fallZ + oz, (ox + oz) % 2 === 0 ? B.COPPER : B.MOSSY_STONE);
        }
      }
    };
    addFall(centerX, baseY + 6, 2);
    addFall(centerX + 9, baseY + 3, 1);
    addFall(centerX - 9, baseY + 4, 1);

    this.exclusionZones.push({ x: centerX, z: centerZ, radius: 18 });
    this.techCity = {
      x: centerX,
      z: centerZ,
      baseY,
      minX,
      maxX,
      minZ,
      maxZ,
      falls,
    };
    return this.techCity;
  }

  isInTechCity(x, z) {
    const city = this.techCity;
    if (!city) return false;
    return x >= city.minX && x <= city.maxX && z >= city.minZ && z <= city.maxZ;
  }

  /* ----------------------------- 区块生成 ----------------------------- */

  _key(cx, cz) {
    return `${cx},${cz}`;
  }

  _localIndex(lx, y, lz) {
    return lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  _isExcluded(x, z) {
    for (const zone of this.exclusionZones) {
      if (Math.hypot(x - zone.x, z - zone.z) < zone.radius) return true;
    }
    return false;
  }

  _queueStructureBlock(x, y, z, id) {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (by < 0 || by >= CHUNK_HEIGHT) return;
    const cx = Math.floor(bx / CHUNK_SIZE);
    const cz = Math.floor(bz / CHUNK_SIZE);
    const key = this._key(cx, cz);
    if (!this.structureBlocksByChunk.has(key)) {
      this.structureBlocksByChunk.set(key, new Map());
    }
    const lx = bx - cx * CHUNK_SIZE;
    const lz = bz - cz * CHUNK_SIZE;
    this.structureBlocksByChunk.get(key).set(this._localIndex(lx, by, lz), id);
  }

  _applyStructuresToChunk(data, cx, cz) {
    const blocks = this.structureBlocksByChunk.get(this._key(cx, cz));
    if (!blocks) return;
    for (const [index, id] of blocks) data[index] = id;
  }

  _planVillage(spot) {
    const centerX = Math.floor(spot.x);
    const centerZ = Math.floor(spot.z);
    let groundY = Number.NEGATIVE_INFINITY;
    for (let dx = -7; dx <= 7; dx += 1) {
      for (let dz = -7; dz <= 7; dz += 1) {
        groundY = Math.max(groundY, this.heightAt(centerX + dx, centerZ + dz));
      }
    }
    groundY = Math.min(groundY, CHUNK_HEIGHT - 12);
    const village = { x: centerX + 0.5, z: centerZ + 0.5, groundY };
    this.villageSpots.push(village);
    this.villageSpot = village;

    const put = (x, y, z, id) => this._queueStructureBlock(x, y, z, id);
    const air = BLOCK_IDS.AIR;
    const grass = BLOCK_IDS.GRASS;
    const dirt = BLOCK_IDS.DIRT;
    const path = BLOCK_IDS.GRAVEL;
    const stone = BLOCK_IDS.COBBLESTONE;
    const brick = BLOCK_IDS.STONE_BRICKS;
    const planks = BLOCK_IDS.PLANKS;
    const dark = BLOCK_IDS.DARK_PLANKS;
    const roof = BLOCK_IDS.ROOF;
    const glass = BLOCK_IDS.GLASS;
    const water = BLOCK_IDS.WATER;
    const wheat = BLOCK_IDS.WHEAT;

    // 平整村庄地面，并清掉会穿进房子的树和花。
    for (let dx = -7; dx <= 7; dx += 1) {
      for (let dz = -7; dz <= 7; dz += 1) {
        const x = centerX + dx;
        const z = centerZ + dz;
        const height = this.heightAt(x, z);
        for (let y = height + 1; y < groundY; y += 1) put(x, y, z, dirt);
        put(x, groundY, z, grass);
        for (let y = groundY + 1; y <= groundY + 7; y += 1) put(x, y, z, air);
      }
    }

    // 十字小路。
    for (let d = -7; d <= 7; d += 1) {
      put(centerX + d, groundY, centerZ, path);
      put(centerX + d, groundY, centerZ + 1, path);
      put(centerX, groundY, centerZ + d, path);
      put(centerX + 1, groundY, centerZ + d, path);
    }

    // 村中心的小水井。
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const edge = Math.abs(dx) === 1 || Math.abs(dz) === 1;
        put(centerX + dx, groundY + 1, centerZ + dz, edge ? brick : water);
      }
    }
    put(centerX - 1, groundY + 2, centerZ - 1, brick);
    put(centerX + 1, groundY + 2, centerZ - 1, brick);
    put(centerX - 1, groundY + 2, centerZ + 1, brick);
    put(centerX + 1, groundY + 2, centerZ + 1, brick);
    put(centerX, groundY + 3, centerZ, roof);

    const buildHouse = (x0, z0, width, depth) => {
      const y0 = groundY + 1;
      // 地台和墙。
      for (let x = x0; x < x0 + width; x += 1) {
        for (let z = z0; z < z0 + depth; z += 1) {
          put(x, groundY, z, dark);
          const edge = x === x0 || x === x0 + width - 1 || z === z0 || z === z0 + depth - 1;
          if (!edge) {
            for (let y = y0; y <= y0 + 3; y += 1) put(x, y, z, air);
            continue;
          }
          const corner = (x === x0 || x === x0 + width - 1) && (z === z0 || z === z0 + depth - 1);
          for (let y = y0; y <= y0 + 3; y += 1) put(x, y, z, corner ? dark : planks);
        }
      }
      // 前面的门和窗户。
      const doorX = x0 + Math.floor(width / 2);
      const frontZ = z0 + depth - 1;
      put(doorX, y0, frontZ, air);
      put(doorX, y0 + 1, frontZ, air);
      put(doorX - 1, y0 + 2, frontZ, glass);
      put(doorX + 1, y0 + 2, frontZ, glass);
      // 侧窗。
      for (const z of [z0 + 1, z0 + depth - 2]) {
        put(x0, y0 + 2, z, glass);
        put(x0 + width - 1, y0 + 2, z, glass);
      }
      // 小屋顶，两层方块。
      for (let x = x0 - 1; x < x0 + width + 1; x += 1) {
        for (let z = z0 - 1; z < z0 + depth + 1; z += 1) {
          put(x, y0 + 4, z, roof);
        }
      }
      for (let x = x0; x < x0 + width; x += 1) {
        for (let z = z0; z < z0 + depth; z += 1) {
          put(x, y0 + 5, z, roof);
        }
      }
      const ridgeY = y0 + 6;
      for (let x = x0 + 1; x < x0 + width - 1; x += 1) {
        for (let z = z0 + 1; z < z0 + depth - 1; z += 1) {
          put(x, ridgeY, z, roof);
        }
      }
      // 屋里的小火把。
      put(doorX - 1, y0 + 2, z0 + 2, BLOCK_IDS.TORCH);
    };

    buildHouse(centerX - 6, centerZ - 6, 5, 4);
    buildHouse(centerX + 2, centerZ - 6, 5, 4);
    buildHouse(centerX - 6, centerZ + 3, 5, 4);

    // 小农田：三行泥土，中间一条水沟。
    for (let dx = 1; dx <= 5; dx += 1) {
      for (let dz = 2; dz <= 5; dz += 1) {
        const x = centerX + dx;
        const z = centerZ + dz;
        put(x, groundY, z, dz === 3 ? water : dirt);
        if (dz !== 3) put(x, groundY + 1, z, wheat);
      }
    }

    // 路灯。
    for (const [dx, dz] of [[-7, 0], [7, 0], [0, -7], [0, 7]]) {
      put(centerX + dx, groundY + 1, centerZ + dz, dark);
      put(centerX + dx, groundY + 2, centerZ + dz, dark);
      put(centerX + dx, groundY + 3, centerZ + dz, BLOCK_IDS.TORCH);
    }

    // 宝箱放在水井旁边，里面装着村庄的小礼物（装饰）。
    put(centerX + 2, groundY, centerZ - 2, BLOCK_IDS.CHEST);

    this.exclusionZones.push({ x: centerX + 0.5, z: centerZ + 0.5, radius: 9 });
  }

  _generateChunk(cx, cz) {
    const key = this._key(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;
    let hasJungleColumn = false;

    for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
        const worldX = baseX + lx;
        const worldZ = baseZ + lz;
        const height = this.heightAt(worldX, worldZ);
        const biome = this.biomeAt(worldX, worldZ);
        if (biome === 'jungle') hasJungleColumn = true;
        const biomeData = BIOMES[biome];
        const topBlock = biomeData.top;
        const fillerBlock = biomeData.filler;

        for (let y = 0; y <= height; y += 1) {
          let blockId = BLOCK_IDS.STONE;
          if (y === height) blockId = topBlock;
          else if (y >= height - 2) blockId = fillerBlock;
          if (y === 0) blockId = BLOCK_IDS.BEDROCK;
          data[this._localIndex(lx, y, lz)] = blockId;
        }

        if (biome === 'mountain' && height >= 23 && height < CHUNK_HEIGHT - 2) {
          data[this._localIndex(lx, height, lz)] = BLOCK_IDS.SNOW;
        }

        if (height < SEA_LEVEL) {
          for (let y = height + 1; y <= SEA_LEVEL; y += 1) {
            data[this._localIndex(lx, y, lz)] = BLOCK_IDS.WATER;
          }
        }
      }
    }

    this._carveCaves(data, cx, cz);
    this._decorateChunk(data, cx, cz, { hasJungleColumn });
    this._applyStructuresToChunk(data, cx, cz);
    this._applyOverridesToChunk(data, cx, cz);
    const chunk = {
      cx,
      cz,
      key,
      data,
      mesh: null,
      waterMesh: null,
    };
    this.chunks.set(key, chunk);
    this._buildChunkMesh(chunk);
    return chunk;
  }

  _carveCaves(data, cx, cz) {
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;
    const snowLine = 22;
    const caveMaxY = CHUNK_HEIGHT - 10;
    const caveType = (wx, wy, wz) => {
      const lush = fbm3(this.seed + 611, wx * 0.018, wy * 0.022, wz * 0.018, 2);
      const sulfur = fbm3(this.seed + 631, wx * 0.02, wy * 0.024, wz * 0.02, 2);
      if (lush > 0.575) return 'lush';
      if (sulfur > 0.585) return 'sulfur';
      return 'stone';
    };
    const localGet = (lx, y, lz) => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return BLOCK_IDS.AIR;
      if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK_IDS.AIR;
      return data[this._localIndex(lx, y, lz)];
    };
    const localSet = (lx, y, lz, id) => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
      if (y < 0 || y >= CHUNK_HEIGHT) return;
      data[this._localIndex(lx, y, lz)] = id;
    };

    for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const surface = this.heightAt(wx, wz);
        const biome = this.biomeAt(wx, wz);
        const topY = Math.min(surface - 3, caveMaxY);
        if (biome === 'ocean' || biome === 'river') continue;

        for (let y = 2; y <= topY; y += 1) {
          const id = localGet(lx, y, lz);
          if (id === BLOCK_IDS.BEDROCK || id === BLOCK_IDS.WATER) continue;
          const n = fbm3(this.seed + 601, wx * 0.055, y * 0.09, wz * 0.055, 3);
          const tunnel = Math.abs(
            fbm3(this.seed + 621, wx * 0.034, y * 0.058, wz * 0.034, 2) - 0.5,
          );
          if (n > 0.625 || tunnel < 0.022) {
            localSet(lx, y, lz, BLOCK_IDS.AIR);
          }
        }
      }
    }

    // 给洞穴铺上苔藓、发光浆果、硫磺和晶簇，再放一点矿石。
    for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const surface = this.heightAt(wx, wz);
        if (this.biomeAt(wx, wz) === 'ocean' || this.biomeAt(wx, wz) === 'river') continue;
        const topY = Math.min(surface - 3, caveMaxY);
        for (let y = 2; y <= topY; y += 1) {
          const id = localGet(lx, y, lz);
          if (id === BLOCK_IDS.STONE || id === BLOCK_IDS.DIRT || id === BLOCK_IDS.SAND) {
            const ore = hash3(this.seed + 701, wx, y, wz);
            if (ore < 0.0012 && y < 13) localSet(lx, y, lz, BLOCK_IDS.DIAMOND_ORE);
            else if (ore < 0.007) localSet(lx, y, lz, BLOCK_IDS.IRON_ORE);
            else if (ore < 0.024) localSet(lx, y, lz, BLOCK_IDS.COAL_ORE);
            else if (y > snowLine && this.biomeAt(wx, wz) === 'mountain' && ore > 0.96) {
              localSet(lx, y, lz, BLOCK_IDS.GRAVEL);
            }
            continue;
          }
          if (id !== BLOCK_IDS.AIR) continue;

          const below = localGet(lx, y - 1, lz);
          const above = localGet(lx, y + 1, lz);
          const type = caveType(wx, y, wz);
          const roll = hash3(this.seed + 711, wx, y, wz);

          if (below !== BLOCK_IDS.AIR && below !== BLOCK_IDS.WATER) {
            if (type === 'lush') {
              localSet(lx, y - 1, lz, BLOCK_IDS.MOSS);
              if (roll < 0.09) localSet(lx, y, lz, BLOCK_IDS.AZALEA_LEAVES);
            } else if (type === 'sulfur') {
              localSet(lx, y - 1, lz, roll < 0.28 ? BLOCK_IDS.SULFUR : BLOCK_IDS.BASALT);
              if (roll > 0.86) localSet(lx, y, lz, BLOCK_IDS.SULFUR_CRYSTAL);
              else if (y <= 4 && roll > 0.72) localSet(lx, y, lz, BLOCK_IDS.LAVA);
            }
          }

          if (above !== BLOCK_IDS.AIR && type === 'lush' && roll > 0.9) {
            localSet(lx, y, lz, BLOCK_IDS.GLOW_BERRIES);
          }
        }
      }
    }

    // 偶尔出现一个废弃矿井：木支架、铁轨和宝箱。
    const mineRoll = hashInt(this.seed + 801, cx, cz) % 13;
    if (mineRoll === 0) {
      const roomY = 4 + (hashInt(this.seed + 811, cx, cz) % 4);
      const lx = 7;
      const lz = 7;
      const surface = this.heightAt(baseX + lx, baseZ + lz);
      if (surface > roomY + 7 && this.biomeAt(baseX + lx, baseZ + lz) !== 'ocean') {
        for (let dx = -4; dx <= 4; dx += 1) {
          for (let dz = -3; dz <= 3; dz += 1) {
            for (let dy = 0; dy <= 3; dy += 1) {
              localSet(lx + dx, roomY + dy, lz + dz, BLOCK_IDS.AIR);
            }
            localSet(lx + dx, roomY - 1, lz + dz, BLOCK_IDS.DARK_PLANKS);
          }
        }
        for (const [dx, dz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) {
          for (let dy = 0; dy <= 2; dy += 1) {
            localSet(lx + dx, roomY + dy, lz + dz, BLOCK_IDS.WOOD);
          }
          localSet(lx + dx, roomY + 3, lz + dz, BLOCK_IDS.DARK_PLANKS);
        }
        for (let dx = -4; dx <= 4; dx += 1) {
          localSet(lx + dx, roomY + 3, lz - 3, BLOCK_IDS.DARK_PLANKS);
          localSet(lx + dx, roomY + 3, lz + 3, BLOCK_IDS.DARK_PLANKS);
        }
        for (let dz = -2; dz <= 2; dz += 1) {
          localSet(lx, roomY, lz + dz, BLOCK_IDS.RAIL);
        }
        localSet(lx - 3, roomY + 2, lz, BLOCK_IDS.TORCH);
        localSet(lx + 3, roomY + 2, lz, BLOCK_IDS.TORCH);
        localSet(lx, roomY, lz + 3, BLOCK_IDS.CHEST);

        // 从房间东侧挖一个可以游进游出的水面竖井，并在草地里留下明显的矿井入口。
        const shaftX = lx + 6;
        const shaftZ = lz;
        const shaftXs = [shaftX, shaftX + 1];
        const shaftZs = [shaftZ, shaftZ + 1];
        const surface = Math.max(
          ...shaftXs.flatMap((x) => shaftZs.map((z) => this.heightAt(baseX + x, baseZ + z))),
        );
        // 清掉井口上方的树冠和石头，给矿井留出一块看得见的空地。
        for (let x = shaftX - 3; x <= shaftX + 4; x += 1) {
          for (let z = shaftZ - 3; z <= shaftZ + 4; z += 1) {
            for (let y = surface + 1; y <= surface + 6; y += 1) {
              localSet(x, y, z, BLOCK_IDS.AIR);
            }
          }
        }
        this.exclusionZones.push({ x: baseX + shaftX + 0.5, z: baseZ + shaftZ + 0.5, radius: 6 });

        // 连接房间和竖井
        for (let x = lx + 4; x <= shaftX - 1; x += 1) {
          for (let z = shaftZ; z <= shaftZ + 1; z += 1) {
            for (let y = roomY; y <= roomY + 2; y += 1) localSet(x, y, z, BLOCK_IDS.AIR);
          }
        }
        // 2×2 水柱，玩家可以直接潜下去
        for (const x of shaftXs) {
          for (const z of shaftZs) {
            for (let y = roomY + 1; y <= surface; y += 1) {
              localSet(x, y, z, y === surface ? BLOCK_IDS.WATER : BLOCK_IDS.WATER);
            }
          }
        }
        // 石砖/铜边和地表井口
        for (const x of [shaftX - 1, shaftX + 2]) {
          for (const z of [shaftZ - 1, shaftZ + 2]) {
            for (let y = roomY; y <= surface + 1; y += 1) {
              localSet(x, y, z, y > surface - 1 ? BLOCK_IDS.STONE_BRICKS : BLOCK_IDS.COBBLESTONE);
            }
          }
        }
        for (let x = shaftX - 1; x <= shaftX + 2; x += 1) {
          for (let z = shaftZ - 1; z <= shaftZ + 2; z += 1) {
            if (x === shaftX - 1 || x === shaftX + 2 || z === shaftZ - 1 || z === shaftZ + 2) {
              localSet(x, surface + 1, z, (x + z) % 3 === 0 ? BLOCK_IDS.COPPER : BLOCK_IDS.STONE_BRICKS);
            }
          }
        }
        // 四根木柱和深色木顶，远处也能看出“矿井”
        for (const x of [shaftX - 1, shaftX + 2]) {
          for (const z of [shaftZ - 1, shaftZ + 2]) {
            for (let y = surface + 1; y <= surface + 4; y += 1) localSet(x, y, z, BLOCK_IDS.WOOD);
          }
        }
        for (let x = shaftX - 1; x <= shaftX + 2; x += 1) {
          for (let z = shaftZ - 1; z <= shaftZ + 2; z += 1) localSet(x, surface + 5, z, BLOCK_IDS.DARK_PLANKS);
        }
        localSet(shaftX, surface + 2, shaftZ - 1, BLOCK_IDS.TORCH);
        localSet(shaftX + 1, surface + 2, shaftZ + 2, BLOCK_IDS.TORCH);

        const entrance = {
          x: baseX + shaftX + 0.5,
          y: surface,
          z: baseZ + shaftZ + 0.5,
        };
        this.mineshafts.push({
          x: baseX + lx + 0.5,
          y: roomY + 1,
          z: baseZ + lz + 0.5,
          cx,
          cz,
          entrance,
        });
        if (this.landmarks) {
          this._addWaypointMarker(
            this.landmarks,
            entrance.x,
            entrance.y + 7,
            entrance.z,
            '🪜 废弃矿井',
            '#7fe7ff',
            1.7,
          );
        }
      }
    }
  }

  _decorateChunk(data, cx, cz, { hasJungleColumn = false } = {}) {
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;
    const random = mulberry32(hashInt(this.seed + 901, cx, cz));
    const localSet = (lx, y, lz, id) => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
      if (y < 0 || y >= CHUNK_HEIGHT) return;
      data[this._localIndex(lx, y, lz)] = id;
    };
    const localGet = (lx, y, lz) => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return BLOCK_IDS.AIR;
      if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK_IDS.AIR;
      return data[this._localIndex(lx, y, lz)];
    };

    const placedTrees = [];
    let jungleTreesPlaced = 0;
    const centerBiome = this.biomeAt(baseX + 8, baseZ + 8);
    const attempts = centerBiome === 'jungle' ? 7 : 4;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const lx = 3 + Math.floor(random() * 10);
      const lz = 3 + Math.floor(random() * 10);
      const worldX = baseX + lx;
      const worldZ = baseZ + lz;
      const biome = this.biomeAt(worldX, worldZ);
      const groundY = this.heightAt(worldX, worldZ);

      if (groundY <= SEA_LEVEL + 1) continue;
      if (this._isExcluded(worldX + 0.5, worldZ + 0.5)) continue;
      if (placedTrees.some((tree) => Math.abs(tree.lx - lx) + Math.abs(tree.lz - lz) < 5)) continue;

      const surface = localGet(lx, groundY, lz);
      const treeRoll = random();

      if ((biome === 'plains' || biome === 'cherry' || biome === 'snow' || biome === 'jungle') && treeRoll < 0.78) {
        const trunkHeight = 4 + Math.floor(random() * 3);
        if (biome === 'snow') {
          this._placeSpruce(data, localSet, localGet, lx, groundY, lz, trunkHeight, random);
        } else if (biome === 'cherry') {
          this._placeRoundTree(
            data,
            localSet,
            localGet,
            lx,
            groundY,
            lz,
            trunkHeight,
            BLOCK_IDS.CHERRY_WOOD,
            BLOCK_IDS.CHERRY_LEAVES,
            random,
            true,
          );
        } else if (biome === 'jungle') {
          this._placeJungleTree(data, localSet, localGet, lx, groundY, lz, random);
          jungleTreesPlaced += 1;
        } else if (surface === BLOCK_IDS.GRASS) {
          this._placeRoundTree(
            data,
            localSet,
            localGet,
            lx,
            groundY,
            lz,
            trunkHeight,
            BLOCK_IDS.WOOD,
            BLOCK_IDS.LEAVES,
            random,
            false,
          );
        }
        placedTrees.push({ lx, lz });
      } else if (biome === 'desert' && surface === BLOCK_IDS.SAND && treeRoll < 0.5) {
        const cactusHeight = 2 + Math.floor(random() * 2);
        for (let i = 1; i <= cactusHeight; i += 1) {
          localSet(lx, groundY + i, lz, BLOCK_IDS.CACTUS);
        }
        placedTrees.push({ lx, lz });
      }
    }

    // 丛林区块至少保证一棵高高的丛林树，避免小片丛林看起来空荡荡。
    if ((centerBiome === 'jungle' || hasJungleColumn) && jungleTreesPlaced === 0) {
      let planted = false;
      for (let lx = 1; lx < CHUNK_SIZE - 1 && !planted; lx += 1) {
        for (let lz = 1; lz < CHUNK_SIZE - 1 && !planted; lz += 1) {
          const wx = baseX + lx;
          const wz = baseZ + lz;
          if (this.biomeAt(wx, wz) !== 'jungle') continue;
          if (this._isExcluded(wx + 0.5, wz + 0.5)) continue;
          const groundY = this.heightAt(wx, wz);
          if (localGet(lx, groundY, lz) !== BLOCK_IDS.GRASS) continue;
          if (localGet(lx, groundY + 1, lz) !== BLOCK_IDS.AIR) continue;
          this._placeJungleTree(data, localSet, localGet, lx, groundY, lz, random);
          placedTrees.push({ lx, lz });
          planted = true;
        }
      }
    }

    // 花朵是十字面片，不挡路，却能让草地更热闹。
    const flowerTries = this.biomeAt(baseX + 8, baseZ + 8) === 'cherry' ? 20 : 13;
    for (let i = 0; i < flowerTries; i += 1) {
      const lx = 1 + Math.floor(random() * 14);
      const lz = 1 + Math.floor(random() * 14);
      const wx = baseX + lx;
      const wz = baseZ + lz;
      const biome = this.biomeAt(wx, wz);
      if (biome !== 'plains' && biome !== 'cherry' && biome !== 'jungle') continue;
      if (this._isExcluded(wx + 0.5, wz + 0.5)) continue;
      const groundY = this.heightAt(wx, wz);
      if (localGet(lx, groundY, lz) !== BLOCK_IDS.GRASS) continue;
      if (localGet(lx, groundY + 1, lz) !== BLOCK_IDS.AIR) continue;
      const roll = random();
      if (roll < 0.4) {
        localSet(lx, groundY + 1, lz, BLOCK_IDS.FLOWER);
      } else if (biome === 'jungle' && roll < 0.5) {
        localSet(lx, groundY + 1, lz, BLOCK_IDS.VINE);
      } else if ((biome === 'plains' || biome === 'cherry') && roll < 0.48) {
        localSet(lx, groundY + 1, lz, BLOCK_IDS.LEAVES);
        if (random() < 0.3) localSet(lx, groundY + 2, lz, BLOCK_IDS.LEAVES);
      }
    }

    // 高山上的小雪堆和小石堆。
    if (centerBiome === 'mountain') {
      for (let i = 0; i < 7; i += 1) {
        const lx = Math.floor(random() * CHUNK_SIZE);
        const lz = Math.floor(random() * CHUNK_SIZE);
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const h = this.heightAt(wx, wz);
        if (h < 20 || localGet(lx, h + 1, lz) !== BLOCK_IDS.AIR) continue;
        if (random() < 0.4) {
          localSet(lx, h + 1, lz, BLOCK_IDS.SNOW);
        } else {
          localSet(lx, h, lz, BLOCK_IDS.GRAVEL);
        }
      }
    }
  }

  _placeJungleTree(data, localSet, localGet, lx, groundY, lz, random) {
    const height = Math.min(6 + Math.floor(random() * 4), CHUNK_HEIGHT - groundY - 5);
    if (height < 4) return;
    for (let i = 1; i <= height; i += 1) {
      localSet(lx, groundY + i, lz, BLOCK_IDS.JUNGLE_WOOD);
    }
    const top = groundY + height;
    for (let layer = 0; layer < 3; layer += 1) {
      const y = top - 1 + layer;
      const radius = layer === 2 ? 1 : 3 - layer;
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
          if (dx === 0 && dz === 0) continue;
          if (localGet(lx + dx, y, lz + dz) === BLOCK_IDS.AIR) {
            localSet(lx + dx, y, lz + dz, BLOCK_IDS.JUNGLE_LEAVES);
          }
        }
      }
    }
    // 从树冠垂下来的藤蔓。
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const dx = -2 + Math.floor(random() * 5);
      const dz = -2 + Math.floor(random() * 5);
      if (dx === 0 && dz === 0) continue;
      const length = 1 + Math.floor(random() * 3);
      for (let i = 0; i < length; i += 1) {
        const y = top - 2 - i;
        if (localGet(lx + dx, y, lz + dz) === BLOCK_IDS.AIR) {
          localSet(lx + dx, y, lz + dz, BLOCK_IDS.VINE);
        }
      }
    }
  }

  _placeRoundTree(
    data,
    localSet,
    localGet,
    lx,
    groundY,
    lz,
    trunkHeight,
    trunkBlock,
    leafBlock,
    random,
    pink,
  ) {
    const maxTrunk = Math.min(trunkHeight, CHUNK_HEIGHT - groundY - 4);
    for (let i = 1; i <= maxTrunk; i += 1) {
      localSet(lx, groundY + i, lz, trunkBlock);
    }

    const canopyY = groundY + maxTrunk;
    const baseRadius = pink ? 2 : Math.min(2, 1 + Math.floor(random() * 2));
    for (let layer = 0; layer < 3; layer += 1) {
      const y = canopyY - 1 + layer;
      const radius = layer === 2 ? 1 : baseRadius;
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && layer < 2) continue;
          if (dx === 0 && dz === 0 && layer < 3) continue;
          if (localGet(lx + dx, y, lz + dz) === BLOCK_IDS.AIR) {
            localSet(lx + dx, y, lz + dz, leafBlock);
          }
        }
      }
    }

    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        if (Math.abs(dx) + Math.abs(dz) > 1) continue;
        if (localGet(lx + dx, canopyY + 2, lz + dz) === BLOCK_IDS.AIR) {
          localSet(lx + dx, canopyY + 2, lz + dz, leafBlock);
        }
      }
    }
  }

  _placeSpruce(data, localSet, localGet, lx, groundY, lz, trunkHeight, random) {
    const safeHeight = Math.min(trunkHeight + 2, CHUNK_HEIGHT - groundY - 4);
    for (let i = 1; i <= safeHeight; i += 1) {
      localSet(lx, groundY + i, lz, BLOCK_IDS.WOOD);
    }

    const top = groundY + safeHeight;
    for (let layer = 0; layer < 4; layer += 1) {
      const y = top - layer * 2;
      const radius = layer === 3 ? 0 : 2 - Math.floor(layer / 2);
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && radius > 0) continue;
          if (dx === 0 && dz === 0 && y < top) continue;
          if (localGet(lx + dx, y, lz + dz) === BLOCK_IDS.AIR) {
            localSet(lx + dx, y, lz + dz, BLOCK_IDS.LEAVES);
          }
        }
      }
    }

    if (random() < 0.75) {
      localSet(lx, top + 1, lz, BLOCK_IDS.SNOW);
    }
  }

  _buildChunkMesh(chunk) {
    this._removeChunkMesh(chunk);
    const solid = createGeometryArrays();
    const clear = createGeometryArrays();
    const data = chunk.data;

    for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
        for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
          const id = data[this._localIndex(lx, y, lz)];
          if (id === BLOCK_IDS.AIR) continue;
          const block = BLOCKS[id];
          if (!block) continue;

          if (isCrossBlock(id)) {
            addFlowerGeometry(solid, lx, y, lz, block.tiles.top);
            continue;
          }

          if (isFlatBlock(id)) {
            addFlatGeometry(solid, lx, y, lz, block.tiles.top);
            continue;
          }

          const target = block.transparent ? clear : solid;
          for (const face of FACE_DEFINITIONS) {
            const nx = lx + face.dir[0];
            const ny = y + face.dir[1];
            const nz = lz + face.dir[2];
            let neighbor = BLOCK_IDS.AIR;
            if (
              nx >= 0 &&
              nx < CHUNK_SIZE &&
              nz >= 0 &&
              nz < CHUNK_SIZE &&
              ny >= 0 &&
              ny < CHUNK_HEIGHT
            ) {
              neighbor = data[this._localIndex(nx, ny, nz)];
            }

            if (isOccludingBlock(neighbor)) continue;
            if (block.transparent && neighbor === id) continue;

            addFace(
              target,
              lx,
              y,
              lz,
              face.corners,
              face.dir,
              block.tiles[face.tile],
              face.shade,
            );
          }
        }
      }
    }

    if (solid.positions.length > 0) {
      chunk.mesh = this._makeChunkMesh(chunk, solid, this.solidMaterial, false, 0);
    }
    if (clear.positions.length > 0) {
      chunk.waterMesh = this._makeChunkMesh(chunk, clear, this.transparentMaterial, true, 2);
    }
  }

  _makeChunkMesh(chunk, arrays, material, transparent, renderOrder) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(arrays.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(arrays.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(arrays.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(arrays.colors, 3));
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
    mesh.frustumCulled = true;
    mesh.renderOrder = renderOrder;
    mesh.userData.transparent = transparent;
    this.chunkGroup.add(mesh);
    return mesh;
  }

  _removeChunkMesh(chunk) {
    for (const mesh of [chunk.mesh, chunk.waterMesh]) {
      if (!mesh) continue;
      this.chunkGroup.remove(mesh);
      mesh.geometry.dispose();
    }
    chunk.mesh = null;
    chunk.waterMesh = null;
  }

  _unloadChunk(key) {
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    this._removeChunkMesh(chunk);
    this.chunks.delete(key);
  }

  /* ----------------------------- 加载与更新 ----------------------------- */

  async loadInitial(onProgress = () => {}, center = this.spawn) {
    const safeCenter =
      center && Number.isFinite(center.x) && Number.isFinite(center.z) ? center : this.spawn;
    const centerX = Math.floor(safeCenter.x / CHUNK_SIZE);
    const centerZ = Math.floor(safeCenter.z / CHUNK_SIZE);
    const coords = this._chunkCoords(centerX, centerZ, this.renderDistance);
    const total = coords.length;

    for (let i = 0; i < coords.length; i += 1) {
      const [cx, cz] = coords[i];
      this._generateChunk(cx, cz);
      onProgress((i + 1) / total);
      // 每 2 个区块让浏览器喘口气，加载条才会动起来。
      if (i % 2 === 1) await NEXT_FRAME();
    }

    this._lastCenter = `${centerX},${centerZ}`;
    this.pendingChunks = [];
    onProgress(1);
  }

  _chunkCoords(centerX, centerZ, radius) {
    const coords = [];
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        coords.push([centerX + dx, centerZ + dz]);
      }
    }
    coords.sort((a, b) => {
      const da = (a[0] - centerX) ** 2 + (a[1] - centerZ) ** 2;
      const db = (b[0] - centerX) ** 2 + (b[1] - centerZ) ** 2;
      return da - db;
    });
    return coords;
  }

  update(delta, playerPosition) {
    this._landmarkTime += delta;
    if (this.animatedBlades) {
      this.animatedBlades.rotation.z -= delta * 0.75;
    }
    if (this.waypointSprites) {
      const labels = this.waypointSprites.filter((sprite) => sprite.userData.isLabel);
      let nearestLabel = null;
      let nearestLabelDistance = Infinity;
      for (const sprite of labels) {
        const distance = Math.hypot(sprite.position.x - playerPosition.x, sprite.position.z - playerPosition.z);
        if (distance < nearestLabelDistance) {
          nearestLabelDistance = distance;
          nearestLabel = sprite;
        }
      }
      for (const sprite of this.waypointSprites) {
        sprite.position.y = sprite.userData.baseY + Math.sin(this._landmarkTime * 1.8 + sprite.userData.phase) * 0.18;
        if (sprite.userData.isLabel) {
          const distance = Math.hypot(sprite.position.x - playerPosition.x, sprite.position.z - playerPosition.z);
          sprite.visible = sprite === nearestLabel && distance > 10.5 && distance < 110;
        }
      }
    }
    if (this.waterfallTexture) {
      this.waterfallTexture.offset.y -= delta * 0.8;
    }

    this._checkTimer -= delta;
    if (this._checkTimer <= 0) {
      this._checkTimer = 0.25;
      const centerX = Math.floor(playerPosition.x / CHUNK_SIZE);
      const centerZ = Math.floor(playerPosition.z / CHUNK_SIZE);
      const centerKey = `${centerX},${centerZ}`;

      if (centerKey !== this._lastCenter) {
        this._lastCenter = centerKey;
        this._refreshQueue(centerX, centerZ);
      }
    }

    // 每帧最多花约 6 毫秒补区块，既不会一口气卡住，也不会让地面空太久。
    if (this.pendingChunks.length > 0) {
      const start = performance.now();
      let generated = 0;
      while (
        this.pendingChunks.length > 0 &&
        generated < 3 &&
        performance.now() - start < 6
      ) {
        const next = this.pendingChunks.shift();
        if (!next) continue;
        if (!this.chunks.has(this._key(next[0], next[1]))) {
          this._generateChunk(next[0], next[1]);
        }
        generated += 1;
      }
    }
  }

  _refreshQueue(centerX, centerZ) {
    const desired = new Set();
    const queue = [];

    for (let dx = -this.renderDistance; dx <= this.renderDistance; dx += 1) {
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz += 1) {
        const cx = centerX + dx;
        const cz = centerZ + dz;
        const key = this._key(cx, cz);
        desired.add(key);
        if (!this.chunks.has(key)) queue.push([cx, cz]);
      }
    }

    queue.sort((a, b) => {
      const da = (a[0] - centerX) ** 2 + (a[1] - centerZ) ** 2;
      const db = (b[0] - centerX) ** 2 + (b[1] - centerZ) ** 2;
      return da - db;
    });
    this.pendingChunks = queue;

    for (const key of [...this.chunks.keys()]) {
      if (desired.has(key)) continue;
      const [cx, cz] = key.split(',').map(Number);
      const distance = Math.max(Math.abs(cx - centerX), Math.abs(cz - centerZ));
      if (distance > this.renderDistance + 1) {
        this._unloadChunk(key);
      }
    }
  }

  getLoadedChunkCount() {
    return this.chunks.size;
  }

  /** 性能不足时缩小渲染距离，保留玩家附近最重要的区块。 */
  setRenderDistance(distance) {
    const next = Math.max(2, Math.min(5, Number(distance) || this.renderDistance));
    if (next === this.renderDistance) return false;
    this.renderDistance = next;

    const [centerX, centerZ] = (this._lastCenter || '0,0').split(',').map(Number);
    for (const key of [...this.chunks.keys()]) {
      const [cx, cz] = key.split(',').map(Number);
      const range = Math.max(Math.abs(cx - centerX), Math.abs(cz - centerZ));
      if (range > next) this._unloadChunk(key);
    }
    this.pendingChunks = [];
    this._refreshQueue(centerX, centerZ);
    return true;
  }

  getBlock(x, y, z) {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (by < 0) return BLOCK_IDS.STONE;
    if (by >= CHUNK_HEIGHT) return BLOCK_IDS.AIR;

    const cx = Math.floor(bx / CHUNK_SIZE);
    const cz = Math.floor(bz / CHUNK_SIZE);
    const chunk = this.chunks.get(this._key(cx, cz));
    if (!chunk) return BLOCK_IDS.AIR;

    const lx = bx - cx * CHUNK_SIZE;
    const lz = bz - cz * CHUNK_SIZE;
    return chunk.data[this._localIndex(lx, by, lz)];
  }

  /**
   * 修改一个方块，并只重建受影响的区块网格。
   * 如果方块正好在区块边缘，还会顺手修复邻居区块的侧面。
   */
  /**
   * 读档时把玩家改过的方块重新登记。
   * 区块生成时会自动套用这些覆盖值。
   */
  loadModifications(modifications = []) {
    this.blockOverrides.clear();
    this.overridesByChunk.clear();
    if (!Array.isArray(modifications)) return 0;

    let count = 0;
    const loadedChunksToRebuild = new Set();
    for (const entry of modifications) {
      if (!entry) continue;
      const x = Math.floor(entry.x);
      const y = Math.floor(entry.y);
      const z = Math.floor(entry.z);
      const id = Math.floor(entry.id);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      if (y < 0 || y >= CHUNK_HEIGHT) continue;
      if (!Number.isInteger(id) || (id !== BLOCK_IDS.AIR && !BLOCKS[id])) continue;

      const key = `${x},${y},${z}`;
      if (this.blockOverrides.has(key)) continue;
      const override = { x, y, z, id };
      this.blockOverrides.set(key, override);

      const cx = Math.floor(x / CHUNK_SIZE);
      const cz = Math.floor(z / CHUNK_SIZE);
      const chunkKey = this._key(cx, cz);
      if (!this.overridesByChunk.has(chunkKey)) {
        this.overridesByChunk.set(chunkKey, new Map());
      }
      const lx = x - cx * CHUNK_SIZE;
      const lz = z - cz * CHUNK_SIZE;
      this.overridesByChunk.get(chunkKey).set(this._localIndex(lx, y, lz), id);
      if (this.chunks.has(chunkKey)) loadedChunksToRebuild.add(chunkKey);
      count += 1;
    }

    for (const chunkKey of loadedChunksToRebuild) {
      const chunk = this.chunks.get(chunkKey);
      if (!chunk) continue;
      const overrides = this.overridesByChunk.get(chunkKey);
      if (!overrides) continue;
      for (const [index, id] of overrides) chunk.data[index] = id;
      this._buildChunkMesh(chunk);
    }
    return count;
  }

  _applyOverridesToChunk(data, cx, cz) {
    const overrides = this.overridesByChunk.get(this._key(cx, cz));
    if (!overrides) return;
    for (const [index, id] of overrides) {
      data[index] = id;
    }
  }

  _recordModification(x, y, z, id) {
    const key = `${x},${y},${z}`;
    this.blockOverrides.set(key, { x, y, z, id });
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunkKey = this._key(cx, cz);
    if (!this.overridesByChunk.has(chunkKey)) {
      this.overridesByChunk.set(chunkKey, new Map());
    }
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    this.overridesByChunk.get(chunkKey).set(this._localIndex(lx, y, lz), id);
  }

  getModifiedBlocks() {
    return [...this.blockOverrides.values()];
  }

  getModifiedCount() {
    return this.blockOverrides.size;
  }

  setBlock(x, y, z, blockId) {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (by < 0 || by >= CHUNK_HEIGHT) return false;
    if (
      !Number.isInteger(blockId) ||
      blockId < 0 ||
      (blockId !== BLOCK_IDS.AIR && !BLOCKS[blockId])
    ) {
      return false;
    }

    const cx = Math.floor(bx / CHUNK_SIZE);
    const cz = Math.floor(bz / CHUNK_SIZE);
    const key = this._key(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return false;

    const lx = bx - cx * CHUNK_SIZE;
    const lz = bz - cz * CHUNK_SIZE;
    const index = this._localIndex(lx, by, lz);
    if (chunk.data[index] === blockId) return false;
    chunk.data[index] = blockId;
    this._recordModification(bx, by, bz, blockId);

    const rebuildKeys = new Set([key]);
    if (lx === 0) rebuildKeys.add(this._key(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) rebuildKeys.add(this._key(cx + 1, cz));
    if (lz === 0) rebuildKeys.add(this._key(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) rebuildKeys.add(this._key(cx, cz + 1));

    for (const rebuildKey of rebuildKeys) {
      const target = this.chunks.get(rebuildKey);
      if (target) this._buildChunkMesh(target);
    }
    return true;
  }

  isBlockLoaded(x, y, z) {
    const by = Math.floor(y);
    if (by < 0 || by >= CHUNK_HEIGHT) return false;
    const cx = Math.floor(Math.floor(x) / CHUNK_SIZE);
    const cz = Math.floor(Math.floor(z) / CHUNK_SIZE);
    return this.chunks.has(this._key(cx, cz));
  }

  getBiomeAt(x, z) {
    return this.getBiomeInfo(x, z);
  }

  /* ----------------------------- 风车地标 ----------------------------- */

  _createLandmarks() {
    const group = new THREE.Group();
    group.name = 'landmarks';
    const spot = this.landmarkSpot;

    const materials = {
      stone: new THREE.MeshLambertMaterial({ color: '#8a8f98' }),
      cream: new THREE.MeshLambertMaterial({ color: '#f4e6c6' }),
      wood: new THREE.MeshLambertMaterial({ color: '#9b633e' }),
      darkWood: new THREE.MeshLambertMaterial({ color: '#6b422a' }),
      roof: new THREE.MeshLambertMaterial({ color: '#d95b4d' }),
      white: new THREE.MeshLambertMaterial({ color: '#fff8df' }),
      window: new THREE.MeshLambertMaterial({ color: '#8bd9f2', emissive: '#275874' }),
      bush: new THREE.MeshLambertMaterial({ color: '#62b957' }),
    };
    this.landmarkMaterials = materials;

    const baseY = spot.blockY + 1;
    const windmill = new THREE.Group();
    windmill.position.set(spot.x, baseY, spot.z);

    const foundation = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.8, 5.6), materials.stone);
    foundation.position.y = -1.65;
    windmill.add(foundation);

    const body = new THREE.Mesh(new THREE.BoxGeometry(4.3, 6.5, 4.3), materials.cream);
    body.position.y = 3.45;
    windmill.add(body);

    for (const y of [1.2, 4.1, 6.2]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.18, 4.5), materials.wood);
      band.position.y = y;
      windmill.add(band);
    }

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 0.22), materials.darkWood);
    door.position.set(0, 1.4, 2.22);
    windmill.add(door);

    for (const x of [-1.15, 1.15]) {
      const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.82, 0.16), materials.window);
      windowMesh.position.set(x, 4.35, 2.2);
      windmill.add(windowMesh);
      const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 0.08), materials.darkWood);
      windowFrame.position.set(x, 4.35, 2.12);
      windmill.add(windowFrame);
    }

    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.65, 2.5, 4), materials.roof);
    roof.position.y = 7.95;
    roof.rotation.y = Math.PI / 4;
    windmill.add(roof);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.42, 8), materials.darkWood);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(0, 5.7, 2.45);
    windmill.add(hub);

    const blades = new THREE.Group();
    blades.position.set(0, 5.7, 2.7);
    for (let i = 0; i < 4; i += 1) {
      const blade = new THREE.Group();
      blade.rotation.z = (Math.PI / 2) * i;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 4.1, 0.2), materials.white);
      arm.position.y = 2.05;
      blade.add(arm);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.35, 0.25), materials.wood);
      tip.position.set(0, 3.35, 0.02);
      blade.add(tip);
      blades.add(blade);
    }
    windmill.add(blades);
    this.animatedBlades = blades;

    const bushA = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 1.1), materials.bush);
    bushA.position.set(3.8, 0.25, 0.9);
    windmill.add(bushA);
    const bushB = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.8), materials.bush);
    bushB.position.set(-3.7, 0.12, -1.5);
    windmill.add(bushB);

    const target = new THREE.Vector2(this.spawn.x - spot.x, this.spawn.z - spot.z);
    windmill.rotation.y = Math.atan2(target.x, target.y);
    group.add(windmill);

    // 几朵永远停在家门口的小白云，让远处也有层次。
    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.94,
      fog: false,
    });
    this.landmarkMaterials.cloud = cloudMaterial;
    for (let i = 0; i < 3; i += 1) {
      const cloud = new THREE.Group();
      const px = spot.x - 18 + i * 11;
      const pz = spot.z - 17 - i * 4;
      const py = baseY + 16 + i * 2.5;
      for (let j = 0; j < 4; j += 1) {
        const puff = new THREE.Mesh(
          new THREE.BoxGeometry(2.6 + (j % 2) * 1.2, 1.2, 1.8),
          cloudMaterial,
        );
        puff.position.set(j * 1.7 - 2.5, (j % 2) * 0.55, 0);
        cloud.add(puff);
      }
      cloud.position.set(px, py, pz);
      group.add(cloud);
    }

    // 洞穴入口和废弃矿井的远处路标：光柱 + 悬浮名牌。
    this.waypointSprites = [];
    this.waypointMaterials = [];
    this.waypointTextures = [];
    if (this.caveEntrance) {
      this._addWaypointMarker(
        group,
        this.caveEntrance.x,
        this.caveEntrance.startY + 5.5,
        this.caveEntrance.z,
        '⛏ 洞穴入口',
        '#ffd85e',
        0,
      );
    }
    for (const mine of this.mineshafts) {
      const entrance = mine.entrance || mine;
      this._addWaypointMarker(
        group,
        entrance.x,
        (entrance.y || this.heightAt(entrance.x, entrance.z)) + 7,
        entrance.z,
        '🪜 废弃矿井',
        '#7fe7ff',
        1.7,
      );
    }

    return group;
  }

  _addWaypointMarker(parent, x, y, z, label, color, phase) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(20, 22, 24, 0.9)';
    ctx.fillRect(4, 8, 504, 112);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 8, 504, 112);
    ctx.fillStyle = color;
    ctx.fillRect(18, 20, 6, 88);
    ctx.fillStyle = '#fffdf4';
    ctx.font = 'bold 43px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 67);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4.4, 1.1, 1);
    sprite.position.set(x, y, z);
    sprite.userData.baseY = y;
    sprite.userData.phase = phase;
    sprite.userData.isLabel = true;
    sprite.userData.markerX = x;
    sprite.userData.markerZ = z;
    sprite.renderOrder = 20;
    parent.add(sprite);
    this.waypointSprites.push(sprite);
    this.waypointMaterials.push(material);
    this.waypointTextures.push(texture);

    const beamMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      depthTest: false,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.36, 17, 8), beamMaterial);
    beam.position.set(x, y + 5.5, z);
    beam.renderOrder = 19;
    parent.add(beam);
    this.waypointMaterials.push(beamMaterial);
    this.waypointSprites.push(beam);
    beam.userData.baseY = y + 5.5;
    beam.userData.phase = phase + 0.7;
  }

  _createWaterfallVisual() {
    if (!this.waterfalls.length) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, 'rgba(190, 246, 255, 0.62)');
    gradient.addColorStop(0.5, 'rgba(107, 212, 244, 0.7)');
    gradient.addColorStop(1, 'rgba(236, 253, 255, 0.82)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 128);
    for (let i = 0; i < 16; i += 1) {
      const x = (i * 7 + 3) % 32;
      const h = 24 + ((i * 31) % 70);
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(197,245,255,0.55)';
      ctx.fillRect(x, 0, 2, h);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 2.4);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.waterfallTexture = texture;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.waterfallMaterial = material;
    const group = new THREE.Group();
    group.name = 'waterfall-visual';

    for (const fall of this.waterfalls) {
      const height = Math.max(2, fall.top.y - fall.bottom.y + 1.2);
      const geometry = new THREE.PlaneGeometry(2.7, height);
      const mesh = new THREE.Mesh(geometry, material);
      const dx = fall.top.x - fall.bottom.x;
      const dz = fall.top.z - fall.bottom.z;
      mesh.position.set(
        fall.bottom.x + 0.5 - dx * 0.05,
        (fall.top.y + fall.bottom.y) / 2 + 0.35,
        fall.bottom.z + 0.5 - dz * 0.05,
      );
      mesh.rotation.y = Math.atan2(dx, dz);
      mesh.renderOrder = 3;
      mesh.name = 'waterfall-sheet';
      group.add(mesh);
      if (!this.waterfallMesh) this.waterfallMesh = mesh;
    }
    return group;
  }

  /* ----------------------------- 释放资源 ----------------------------- */

  dispose() {
    for (const chunk of this.chunks.values()) {
      this._removeChunkMesh(chunk);
    }
    this.chunks.clear();
    this.pendingChunks = [];
    this.blockOverrides.clear();
    this.overridesByChunk.clear();
    this.scene.remove(this.chunkGroup);
    this.scene.remove(this.landmarks);
    if (this.waterfallVisual) this.scene.remove(this.waterfallVisual);

    this.atlasTexture.dispose();
    this.solidMaterial.dispose();
    this.transparentMaterial.dispose();

    if (this.landmarkMaterials) {
      for (const material of Object.values(this.landmarkMaterials)) {
        material.dispose();
      }
    }
    if (this.landmarks) {
      this.landmarks.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
      });
    }
    for (const material of this.waypointMaterials || []) material.dispose();
    for (const texture of this.waypointTextures || []) texture.dispose();
    if (this.waterfallVisual) {
      this.waterfallVisual.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
      });
    }
    this.waterfallTexture?.dispose();
    this.waterfallMaterial?.dispose();
  }
}

/* ----------------------------- 几何工具 ----------------------------- */

function createGeometryArrays() {
  return { positions: [], normals: [], uvs: [], colors: [] };
}

function addFace(target, x, y, z, corners, normal, tile, shade) {
  const [u0, v0, u1, v1] = getTileUv(tile);
  const quadUv = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];

  for (const index of [0, 1, 2, 0, 2, 3]) {
    const corner = corners[index];
    target.positions.push(x + corner[0], y + corner[1], z + corner[2]);
    target.normals.push(normal[0], normal[1], normal[2]);
    target.uvs.push(quadUv[index][0], quadUv[index][1]);
    target.colors.push(shade, shade, shade);
  }
}

function addQuad(target, corners, normal, tile, shade) {
  const [u0, v0, u1, v1] = getTileUv(tile);
  const quadUv = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];
  for (const index of [0, 1, 2, 0, 2, 3]) {
    const corner = corners[index];
    target.positions.push(corner[0], corner[1], corner[2]);
    target.normals.push(normal[0], normal[1], normal[2]);
    target.uvs.push(quadUv[index][0], quadUv[index][1]);
    target.colors.push(shade, shade, shade);
  }
}

function addFlatGeometry(target, x, y, z, tile) {
  const [u0, v0, u1, v1] = getTileUv(tile);
  const lift = 0.035;
  const corners = [
    [x + 0.06, y + lift, z + 0.06],
    [x + 0.94, y + lift, z + 0.06],
    [x + 0.94, y + lift, z + 0.94],
    [x + 0.06, y + lift, z + 0.94],
  ];
  const uvs = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];
  for (const index of [0, 1, 2, 0, 2, 3]) {
    target.positions.push(corners[index][0], corners[index][1], corners[index][2]);
    target.normals.push(0, 1, 0);
    target.uvs.push(uvs[index][0], uvs[index][1]);
    target.colors.push(1, 1, 1);
  }
}

function addFlowerGeometry(target, x, y, z, tile) {
  const minX = x + 0.16;
  const maxX = x + 0.84;
  const minZ = z + 0.16;
  const maxZ = z + 0.84;
  const bottom = y + 0.03;
  const top = y + 0.95;
  const midX = x + 0.5;
  const midZ = z + 0.5;

  addQuad(
    target,
    [
      [minX, bottom, midZ],
      [maxX, bottom, midZ],
      [maxX, top, midZ],
      [minX, top, midZ],
    ],
    [0, 0, 1],
    tile,
    0.94,
  );
  addQuad(
    target,
    [
      [maxX, bottom, midZ],
      [minX, bottom, midZ],
      [minX, top, midZ],
      [maxX, top, midZ],
    ],
    [0, 0, -1],
    tile,
    0.8,
  );
  addQuad(
    target,
    [
      [midX, bottom, minZ],
      [midX, bottom, maxZ],
      [midX, top, maxZ],
      [midX, top, minZ],
    ],
    [-1, 0, 0],
    tile,
    0.88,
  );
  addQuad(
    target,
    [
      [midX, bottom, maxZ],
      [midX, bottom, minZ],
      [midX, top, minZ],
      [midX, top, maxZ],
    ],
    [1, 0, 0],
    tile,
    0.88,
  );
}

function getTileUv(tile) {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  const width = ATLAS_COLS * TILE_SIZE;
  const height = ATLAS_ROWS * TILE_SIZE;
  const padX = 0.35 / width;
  const padY = 0.35 / height;
  const u0 = col / ATLAS_COLS + padX;
  const u1 = (col + 1) / ATLAS_COLS - padX;
  const v1 = 1 - row / ATLAS_ROWS - padY;
  const v0 = 1 - (row + 1) / ATLAS_ROWS + padY;
  return [u0, v0, u1, v1];
}

/* ----------------------------- 噪声工具 ----------------------------- */

function hashInt(seed, x, z) {
  let h = seed >>> 0;
  h = Math.imul(h ^ (x | 0), 0x27d4eb2d);
  h = Math.imul(h ^ (z | 0), 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

function hash2(seed, x, z) {
  return hashInt(seed, Math.floor(x), Math.floor(z)) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function smoothstepRange(min, max, value) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

function riverStrengthAt(seed, x, z) {
  const n = fbm2(seed + 97, x * 0.0085, z * 0.0085, 2);
  const distance = Math.abs(n - 0.5);
  return 1 - smoothstepRange(0.015, 0.08, distance);
}

function valueNoise2(seed, x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const tz = smooth(z - z0);
  const a = hash2(seed, x0, z0);
  const b = hash2(seed, x0 + 1, z0);
  const c = hash2(seed, x0, z0 + 1);
  const d = hash2(seed, x0 + 1, z0 + 1);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * tz;
}

function fbm2(seed, x, z, octaves = 3) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i += 1) {
    value += valueNoise2(seed + i * 1013, x * frequency, z * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / total;
}

function hash3(seed, x, y, z) {
  let h = hashInt(seed, Math.floor(x), Math.floor(z));
  h = Math.imul(h ^ (Math.floor(y) | 0), 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function smooth3(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise3(seed, x, y, z) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = smooth3(x - x0);
  const ty = smooth3(y - y0);
  const tz = smooth3(z - z0);
  const c000 = hash3(seed, x0, y0, z0);
  const c100 = hash3(seed, x0 + 1, y0, z0);
  const c010 = hash3(seed, x0, y0 + 1, z0);
  const c110 = hash3(seed, x0 + 1, y0 + 1, z0);
  const c001 = hash3(seed, x0, y0, z0 + 1);
  const c101 = hash3(seed, x0 + 1, y0, z0 + 1);
  const c011 = hash3(seed, x0, y0 + 1, z0 + 1);
  const c111 = hash3(seed, x0 + 1, y0 + 1, z0 + 1);
  const x00 = c000 + (c100 - c000) * tx;
  const x10 = c010 + (c110 - c010) * tx;
  const x01 = c001 + (c101 - c001) * tx;
  const x11 = c011 + (c111 - c011) * tx;
  const y0v = x00 + (x10 - x00) * ty;
  const y1v = x01 + (x11 - x01) * ty;
  return y0v + (y1v - y0v) * tz;
}

function fbm3(seed, x, y, z, octaves = 2) {
  let value = 0;
  let amplitude = 0.55;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i += 1) {
    value += valueNoise3(seed + i * 1877, x * frequency, y * frequency, z * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / total;
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export { hashInt, hash2 };
