/**
 * 云上科技美食城：真正的体素建筑。
 * 所有岛、桥、穹顶、塔楼和摊位都由方块网格生成，和主世界同一套像素贴图。
 */

import * as THREE from 'three';
import {
  ATLAS_COLS,
  BLOCK_IDS,
  TILE_SIZE,
  createBlockAtlasCanvas,
  getBlock,
  getBlockColor,
} from './blocks.js';

const W = 88;
const H = 32;
const D = 88;
const TOP = 12;
const CX = 44;
const CZ = 44;
const FOOD_SPOTS = {
  burger: { x: 36, y: 14, z: 44 },
  fries: { x: 52, y: 14, z: 72 },
  popcorn: { x: 20, y: 15, z: 44 },
};
const FACE_DEFS = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.82 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.82 },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.58 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.88 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.88 },
];

export class SkyCityRealm {
  constructor({ scene }) {
    this.scene = scene;
    this.width = W;
    this.depth = D;
    this.height = H;
    this.data = new Uint8Array(W * H * D);
    this.group = new THREE.Group();
    this.group.name = 'sky-city-voxel';
    this.group.visible = false;
    this.scene.add(this.group);
    this.time = 0;
    this.biome = { emoji: '☁️', name: '云上科技美食城' };
    this.spawn = { x: 44.5, y: TOP + 1.02, z: 82.5 };
    this.returnPortal = { x: CX + 0.5, y: TOP + 1.02, z: 34.5 };
    this.foodSpots = FOOD_SPOTS;
    this.energyCores = [
      { key: 'west', x: 10, y: 15, z: 44 },
      { key: 'east', x: 78, y: 16, z: 44 },
      { key: 'north', x: 44, y: 15, z: 10 },
      { key: 'south', x: 50, y: 13, z: 72 },
      { key: 'center', x: 44, y: 13, z: 60 },
    ];
    this.delivery = { x: 44, y: 14, z: 38 };
    this._generate();
    this._buildAtlas();
    this._buildMesh();
    this._buildPortal();
    this._buildLights();
    this._buildBackground();
    this._buildSkyEffects();
  }

  _index(x, y, z) { return x + z * W + y * W * D; }
  _getRaw(x, y, z) {
    if (x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) return 0;
    return this.data[this._index(x, y, z)];
  }
  _set(x, y, z, id) {
    if (x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) return;
    this.data[this._index(x, y, z)] = id;
  }
  getBlock(x, y, z) { return this._getRaw(Math.floor(x), Math.floor(y), Math.floor(z)); }
  setBlock(x, y, z, id) {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (bx < 0 || bx >= W || by < 0 || by >= H || bz < 0 || bz >= D) return false;
    const i = this._index(bx, by, bz);
    if (this.data[i] === id) return false;
    this.data[i] = id;
    this._buildMesh();
    return true;
  }
  getBiomeAt() { return this.biome; }
  biomeAt() { return 'sky'; }
  isInTechCity() { return false; }
  isBlockLoaded() { return true; }
  getLoadedChunkCount() { return 16; }
  getModifiedCount() { return 0; }
  renderDistance = 5;

  _island(cx, cz, radius, top, style = 'tech') {
    for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1) {
      for (let z = Math.floor(cz - radius); z <= cz + radius; z += 1) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > radius) continue;
        const depth = Math.max(1, Math.floor((1 - d / radius) * 7));
        for (let y = top - depth; y <= top; y += 1) {
          let id = BLOCK_IDS.TECH_DARK;
          if (y === top) {
            id = style === 'green' ? BLOCK_IDS.GRASS : style === 'orange' ? BLOCK_IDS.TECH_ORANGE : BLOCK_IDS.TECH_DARK;
          } else if (y === top - 1) id = style === 'green' ? BLOCK_IDS.DIRT : BLOCK_IDS.STONE_BRICKS;
          else if (y === top - 2) id = BLOCK_IDS.STONE_BRICKS;
          else id = (x + z + y) % 7 === 0 ? BLOCK_IDS.TECH_CYAN : BLOCK_IDS.TECH_DARK;
          this._set(x, y, z, id);
        }
        // 边缘霓虹灯带。
        if (d > radius - 1.2 && style !== 'green') {
          this._set(x, top, z, (x + z) % 5 === 0 ? BLOCK_IDS.TECH_CYAN : BLOCK_IDS.TECH_DARK);
        }
        // 悬挂的碎岩。
        if (d > radius * 0.35 && d < radius * 0.8 && (x + z) % 9 === 0) {
          this._set(x, top - depth - 1 - ((x * 3 + z) % 3), z, BLOCK_IDS.TECH_DARK);
        }
      }
    }
  }

  _bridge(x0, x1, z0, z1, width = 2) {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minZ = Math.min(z0, z1);
    const maxZ = Math.max(z0, z1);
    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        if (Math.abs(z - (minZ + maxZ) / 2) > width) continue;
        this._set(x, TOP, z, BLOCK_IDS.TECH_DARK);
        this._set(x, TOP - 1, z, BLOCK_IDS.STONE_BRICKS);
        if (Math.abs(z - (minZ + maxZ) / 2) > width - 0.6) {
          this._set(x, TOP, z, (x % 4 === 0) ? BLOCK_IDS.TECH_CYAN : BLOCK_IDS.TECH_MAGENTA);
        }
      }
    }
  }

  _dome(cx, cz, radius, y0) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      for (let z = cz - radius; z <= cz + radius; z += 1) {
        for (let y = y0; y <= y0 + radius; y += 1) {
          const dx = x - cx;
          const dy = y - y0;
          const dz = z - cz;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < radius - 1.35 || d > radius) continue;
          // 南侧开门，让玩家可以走进去。
          if (dz > radius * 0.72 && dx > -3 && dx < 3 && dy < 5) {
            this._set(x, y, z, BLOCK_IDS.AIR);
            continue;
          }
          const angle = Math.atan2(dz, dx);
          const rib = Math.abs(Math.sin(angle * 4)) < 0.11 || Math.abs(dy - 7.5) < 0.6;
          this._set(x, y, z, rib ? BLOCK_IDS.TECH_WHITE : BLOCK_IDS.GLASS);
        }
      }
    }
    for (let x = cx - radius - 1; x <= cx + radius + 1; x += 1) {
      for (let z = cz - radius - 1; z <= cz + radius + 1; z += 1) {
        if (Math.hypot(x - cx, z - cz) <= radius + 1) this._set(x, y0, z, BLOCK_IDS.TECH_WHITE);
      }
    }
  }

  _generate() {
    const B = BLOCK_IDS;
    this._island(CX, CZ, 21, TOP, 'tech');
    this._island(14, 44, 9, 14, 'tech');
    this._island(74, 44, 10, 15, 'orange');
    this._island(44, 14, 8, 14, 'orange');
    this._island(44, 74, 10, TOP, 'green');
    this._island(14, 74, 6, 13, 'tech');
    this._island(44, 82, 4, TOP, 'tech');

    // 四座主桥。
    this._bridge(CX - 21, 14, CZ, CZ, 2);
    this._bridge(CX + 21, 74, CZ, CZ, 2);
    this._bridge(CX, CZ - 21, CX, 14, 2);
    this._bridge(CX, CZ + 21, CX, 74, 2);
    this._bridge(74, 82, CZ, CZ, 2);
    this._bridge(CX, 74, CX, 82, 2);
    this._bridge(CX, CZ, CX, 34, 2);

    // 中央穹顶大厅。
    this._dome(CX, CZ, 15, TOP);
    // 穹顶内部地板和科技纹路。
    for (let x = CX - 13; x <= CX + 13; x += 1) {
      for (let z = CZ - 13; z <= CZ + 13; z += 1) {
        if (Math.hypot(x - CX, z - CZ) > 13) continue;
        this._set(x, TOP, z, (Math.abs(x - CX) < 2 || Math.abs(z - CZ) < 2) ? B.TECH_CYAN : B.TECH_DARK);
      }
    }
    // 中央能量柱：只保留一根细塔芯，避免挡住全息屏。
    this._set(CX, TOP + 1, CZ, B.TECH_WHITE);
    for (let y = TOP + 2; y <= TOP + 22; y += 1) {
      this._set(CX, y, CZ, y % 4 === 0 ? B.TECH_CYAN : B.TECH_WHITE);
    }
    this._set(CX, TOP + 23, CZ, B.TECH_CYAN);

    // 穹顶内部美食大厅：吧台、招牌和隐藏汉堡。
    for (const side of [-1, 1]) {
      const x0 = CX + side * 7;
      for (let z = CZ - 7; z <= CZ - 3; z += 1) {
        for (let x = x0 - 2; x <= x0 + 2; x += 1) {
          this._set(x, TOP + 1, z, B.COPPER);
          this._set(x, TOP + 2, z, B.TECH_WHITE);
        }
      }
      for (let x = x0 - 3; x <= x0 + 3; x += 1) this._set(x, TOP + 4, CZ - 8, B.TECH_ORANGE);
      this._set(x0 - 3, TOP + 2, CZ - 8, B.TECH_MAGENTA);
      this._set(x0 + 3, TOP + 2, CZ - 8, B.TECH_CYAN);
    }
    // 隐藏汉堡：吧台侧面的发光展示台。
    this._set(FOOD_SPOTS.burger.x, FOOD_SPOTS.burger.y - 1, FOOD_SPOTS.burger.z, B.TECH_DARK);
    this._set(FOOD_SPOTS.burger.x, FOOD_SPOTS.burger.y, FOOD_SPOTS.burger.z, B.BURGER);

    // 南侧温室岛。
    for (let x = 40; x <= 48; x += 1) {
      for (let z = 68; z <= 76; z += 1) {
        if (Math.hypot(x - 44, z - 72) > 6) continue;
        this._set(x, 13, z, (x + z) % 4 === 0 ? B.GLASS : B.GRASS);
      }
    }
    for (const [x, z] of [[41, 69], [44, 69], [47, 69]]) {
      for (let y = 13; y <= 19; y += 1) {
        this._set(x, y, z, y === 19 ? B.TECH_WHITE : B.GLASS);
      }
      this._set(x, 14, z, B.GRASS);
    }
    this._set(FOOD_SPOTS.fries.x, FOOD_SPOTS.fries.y, FOOD_SPOTS.fries.z, B.FRIES);

    // 西侧 DNA 塔。
    for (let i = 0; i < 22; i += 1) {
      const y = 15 + i;
      const a = i * 0.55;
      for (const off of [0, Math.PI]) {
        this._set(14 + Math.round(Math.cos(a + off) * 2), y, 44 + Math.round(Math.sin(a + off) * 2),
          i % 2 === 0 ? B.TECH_CYAN : B.TECH_MAGENTA);
      }
    }
    this._set(FOOD_SPOTS.popcorn.x, FOOD_SPOTS.popcorn.y, FOOD_SPOTS.popcorn.z, B.POPCORN);

    // 东侧蓝晶摩天楼。
    for (let x = 71; x <= 77; x += 1) {
      for (let z = 41; z <= 47; z += 1) {
        if (x !== 71 && x !== 77 && z !== 41 && z !== 47) continue;
        for (let y = 16; y <= 31; y += 1) {
          this._set(x, y, z, y % 4 === 0 ? B.TECH_CYAN : B.GLASS);
        }
      }
    }
    this._set(74, 32, 44, B.TECH_WHITE);

    // 北侧橙色六边形穹顶。
    for (let x = 39; x <= 49; x += 1) {
      for (let z = 9; z <= 19; z += 1) {
        for (let y = 14; y <= 22; y += 1) {
          const d = Math.hypot(x - 44, y - 17, z - 14);
          if (d >= 4 && d <= 5.2) this._set(x, y, z, B.TECH_ORANGE);
        }
      }
    }

    // 环形浮空岛（西侧远处）。
    for (let i = 0; i < 48; i += 1) {
      const a = (i / 48) * Math.PI * 2;
      const x = Math.round(14 + Math.cos(a) * 7);
      const z = Math.round(74 + Math.sin(a) * 7);
      this._set(x, 13, z, i % 3 === 0 ? B.TECH_CYAN : B.TECH_WHITE);
      this._set(x, 12, z, B.TECH_DARK);
    }

    // 隐藏食物周围的提示灯和承托方块。
    for (const spot of Object.values(FOOD_SPOTS)) {
      this._set(spot.x, spot.y - 1, spot.z, B.TECH_DARK);
      this._set(spot.x - 1, spot.y - 1, spot.z, B.TECH_MAGENTA);
      this._set(spot.x + 1, spot.y - 1, spot.z, B.TECH_CYAN);
    }

    // 先搭好手工建筑，再把能量核心嵌进去，避免被建筑覆盖。
    this._buildHandcraftedDetails();
    for (const core of this.energyCores) {
      this._set(core.x, core.y - 1, core.z, B.TECH_DARK);
      this._set(core.x, core.y, core.z, B.TECH_ORANGE);
    }
    this._set(44, 13, 38, B.TECH_DARK);
    this._set(44, 14, 38, B.TECH_CYAN);
    this._set(43, 13, 38, B.TECH_WHITE);
    this._set(45, 13, 38, B.TECH_WHITE);

    // 空中的体素云朵。
    const clouds = [[10, 3, 14], [70, 2, 16], [12, 5, 70], [70, 4, 72], [30, 6, 8], [58, 5, 80]];
    for (const [cx, cy, cz] of clouds) {
      for (let x = cx - 5; x <= cx + 5; x += 1) {
        for (let z = cz - 3; z <= cz + 3; z += 1) {
          const d = Math.hypot(x - cx, z - cz);
          if (d > 5 || (x + z) % 3 === 0) continue;
          this._set(x, cy, z, B.SNOW);
          this._set(x, cy + 1, z, B.SNOW);
        }
      }
    }

    // 岛屿边缘的瀑布水柱。
    for (const [x, z] of [[34, 72], [54, 72], [23, 44], [65, 44]]) {
      for (let y = 2; y <= 10; y += 1) this._set(x, y, z, B.WATER);
    }
  }

  _buildHandcraftedDetails() {
    const B = BLOCK_IDS;
    const top = TOP;
    const stationTop = 15;
    const cafeTop = 14;
    const northTop = 14;
    // 南侧入口的霓虹拱门。
    for (const side of [-1, 1]) {
      for (let y = top + 1; y <= top + 5; y += 1) this._set(44 + side * 4, y, 64, B.TECH_WHITE);
      this._set(44 + side * 4, top + 6, 64, B.TECH_CYAN);
    }
    for (let x = 40; x <= 48; x += 1) this._set(x, top + 6, 64, x % 2 === 0 ? B.TECH_CYAN : B.TECH_MAGENTA);
    for (let x = 41; x <= 47; x += 2) this._set(x, top + 7, 64, B.TECH_DARK);

    // 东侧空中列车站：站台、顶棚、立柱、铁轨和长椅。
    for (let x = 68; x <= 80; x += 1) {
      for (let z = 51; z <= 58; z += 1) {
        if (x === 68 || x === 80 || z === 51 || z === 58) this._set(x, stationTop + 1, z, B.TECH_WHITE);
        else this._set(x, stationTop, z, B.TECH_DARK);
      }
    }
    for (const x of [69, 73, 77, 80]) {
      for (let y = stationTop + 1; y <= stationTop + 4; y += 1) this._set(x, y, 51, B.TECH_WHITE);
      this._set(x, stationTop + 5, 51, B.TECH_CYAN);
    }
    for (let x = 68; x <= 80; x += 1) {
      this._set(x, stationTop + 5, 55, B.TECH_WHITE);
      this._set(x, stationTop, 56, x % 3 === 0 ? B.COPPER : B.TECH_DARK);
    }
    for (const x of [70, 74, 78]) {
      this._set(x, stationTop + 1, 55, B.DARK_PLANKS);
      this._set(x, stationTop + 1, 54, B.NEON);
    }
    // 站牌和广告屏。
    this._set(70, stationTop + 3, 57, B.TECH_CYAN);
    this._set(76, stationTop + 3, 57, B.TECH_MAGENTA);
    this._set(74, stationTop + 4, 57, B.TECH_ORANGE);

    // 西侧咖啡露台：桌、椅、遮阳伞和花盆。
    for (const [x, z] of [[8, 38], [12, 38], [10, 40], [10, 43]]) {
      this._set(x, cafeTop, z, B.TECH_WHITE);
      this._set(x, cafeTop + 1, z, B.TECH_DARK);
      this._set(x, cafeTop + 2, z, B.COPPER);
      this._set(x, cafeTop + 3, z, B.TECH_ORANGE);
      this._set(x + 2, cafeTop, z, B.DARK_PLANKS);
      this._set(x + 2, cafeTop + 1, z, B.DARK_PLANKS);
      this._set(x + 1, cafeTop + 2, z, B.TECH_ORANGE);
    }
    for (const [x, z] of [[6, 36], [14, 36], [6, 44], [16, 44]]) {
      this._set(x, cafeTop + 1, z, B.TECH_WHITE);
      this._set(x, cafeTop + 2, z, B.FLOWER);
      this._set(x + 1, cafeTop + 2, z, B.LEAVES);
    }

    // 中央广场花坛、长椅、路灯和全息广告柱。
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const x = Math.round(44 + Math.cos(a) * 15.5);
      const z = Math.round(44 + Math.sin(a) * 15.5);
      this._set(x, top + 1, z, B.TECH_WHITE);
      this._set(x, top + 2, z, i % 2 === 0 ? B.FLOWER : B.LEAVES);
    }
    for (const [x, z] of [[44, 66], [44, 22], [28, 44], [60, 44], [32, 60], [56, 28]]) {
      this._set(x, top + 1, z, B.TECH_WHITE);
      this._set(x, top + 2, z, B.TECH_WHITE);
      this._set(x, top + 3, z, B.LANTERN);
      this._set(x + 1, top + 1, z, B.TECH_CYAN);
    }
    // 连接桥上的灯带和护栏。
    for (let x = 24; x <= 64; x += 4) {
      this._set(x, top + 1, 44, B.TECH_CYAN);
      this._set(x, top + 1, 45, B.TECH_DARK);
    }
    for (let z = 24; z <= 64; z += 4) {
      this._set(44, top + 1, z, B.TECH_MAGENTA);
      this._set(45, top + 1, z, B.TECH_DARK);
    }

    // 瞭望台：北侧小塔和望远镜。
    for (let x = 42; x <= 46; x += 1) {
      for (let z = 9; z <= 13; z += 1) {
        this._set(x, northTop + 1, z, B.TECH_WHITE);
      }
    }
    for (let y = northTop + 2; y <= northTop + 5; y += 1) {
      this._set(44, y, 11, B.TECH_WHITE);
      this._set(44, y, 12, B.TECH_DARK);
    }
    this._set(44, northTop + 6, 11, B.TECH_CYAN);
    this._set(43, northTop + 2, 11, B.COPPER);
    this._set(45, northTop + 2, 11, B.COPPER);
  }

  _buildAtlas() {
    const canvas = createBlockAtlasCanvas('classic');
    this.atlas = new THREE.CanvasTexture(canvas);
    this.atlas.magFilter = THREE.NearestFilter;
    this.atlas.minFilter = THREE.NearestFilter;
    this.atlas.generateMipmaps = false;
    this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.solidMaterial = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true });
    this.glowMaterial = new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, fog: false });
    this.glassMaterial = new THREE.MeshLambertMaterial({
      map: this.atlas, vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide,
    });
    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: this.atlas, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide,
    });
  }

  _addFace(target, x, y, z, face, id) {
    const block = getBlock(id);
    if (!block) return;
    const tile = face.n[1] === 1 ? block.tiles.top : face.n[1] === -1 ? block.tiles.bottom : block.tiles.side;
    const col = tile % ATLAS_COLS;
    const row = Math.floor(tile / ATLAS_COLS);
    const u0 = col / ATLAS_COLS;
    const u1 = (col + 1) / ATLAS_COLS;
    const v1 = 1 - row / ATLAS_COLS;
    const v0 = 1 - (row + 1) / ATLAS_COLS;
    const color = new THREE.Color(getBlockColor(id)).multiplyScalar(face.shade);
    const base = target.positions.length / 3;
    for (const [vx, vy, vz] of face.v) {
      target.positions.push(x + vx, y + vy, z + vz);
      target.normals.push(...face.n);
      target.colors.push(color.r, color.g, color.b);
    }
    target.uvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
    target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  _buildMesh() {
    for (const old of this.renderMeshes || []) {
      this.group.remove(old);
      old.geometry.dispose();
    }
    this.renderMeshes = [];
    const sets = {
      solid: { positions: [], normals: [], uvs: [], colors: [], indices: [] },
      glow: { positions: [], normals: [], uvs: [], colors: [], indices: [] },
      glass: { positions: [], normals: [], uvs: [], colors: [], indices: [] },
      water: { positions: [], normals: [], uvs: [], colors: [], indices: [] },
    };
    const glowIds = new Set([BLOCK_IDS.NEON, BLOCK_IDS.TECH_CYAN, BLOCK_IDS.TECH_MAGENTA, BLOCK_IDS.TECH_ORANGE, BLOCK_IDS.LANTERN]);
    for (let x = 0; x < W; x += 1) {
      for (let z = 0; z < D; z += 1) {
        for (let y = 0; y < H; y += 1) {
          const id = this.data[this._index(x, y, z)];
          if (id === BLOCK_IDS.AIR) continue;
          let key = 'solid';
          if (id === BLOCK_IDS.GLASS) key = 'glass';
          else if (id === BLOCK_IDS.WATER) key = 'water';
          else if (glowIds.has(id)) key = 'glow';
          const target = sets[key];
          for (const face of FACE_DEFS) {
            const nx = x + face.n[0];
            const ny = y + face.n[1];
            const nz = z + face.n[2];
            const neighbor = nx < 0 || nx >= W || ny < 0 || ny >= H || nz < 0 || nz >= D
              ? BLOCK_IDS.AIR : this.data[this._index(nx, ny, nz)];
            if (neighbor !== BLOCK_IDS.AIR) continue;
            this._addFace(target, x, y, z, face, id);
          }
        }
      }
    }
    const make = (set, material) => {
      if (!set.positions.length) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(set.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(set.normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(set.uvs, 2));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(set.colors, 3));
      geometry.setIndex(set.indices);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.renderMeshes.push(mesh);
    };
    make(sets.solid, this.solidMaterial);
    make(sets.glow, this.glowMaterial);
    make(sets.glass, this.glassMaterial);
    make(sets.water, this.waterMaterial);
  }

  _buildPortal() {
    const B = BLOCK_IDS;
    const x0 = 41;
    const x1 = 47;
    const z = 34;
    for (const x of [x0, x1]) for (let y = TOP + 1; y <= TOP + 5; y += 1) this._set(x, y, z, B.OBSIDIAN);
    for (let x = x0; x <= x1; x += 1) this._set(x, TOP + 5, z, B.OBSIDIAN);
    for (let x = x0 + 1; x < x1; x += 1) for (let y = TOP + 1; y <= TOP + 4; y += 1) this._set(x, y, z, B.AIR);
    this._buildMesh();
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 96;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#06243a'); g.addColorStop(0.45, '#20d8ff'); g.addColorStop(0.75, '#b55cff'); g.addColorStop(1, '#e8ffff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 96);
    for (let i = 0; i < 20; i += 1) {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.25)' : 'rgba(130,250,255,0.2)';
      ctx.fillRect((i * 17) % 64, (i * 23) % 96, 2, 14);
    }
    this.portalTexture = new THREE.CanvasTexture(canvas);
    this.portalTexture.wrapS = THREE.RepeatWrapping;
    this.portalTexture.wrapT = THREE.RepeatWrapping;
    this.portalTexture.repeat.set(1.1, 1.3);
    this.portalMaterial = new THREE.MeshBasicMaterial({
      map: this.portalTexture, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, fog: false,
    });
    this.portalMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 5.4), this.portalMaterial);
    this.portalMesh.position.set(44, TOP + 3.5, z + 0.02);
    this.group.add(this.portalMesh);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.1, 8, 48), new THREE.MeshBasicMaterial({
      color: '#64f4ff', transparent: true, opacity: 0.9,
    }));
    ring.position.set(44, TOP + 3.5, z + 0.05);
    this.group.add(ring);
    this.portalRing = ring;
    const light = new THREE.PointLight('#61f3ff', 3, 20, 2);
    light.position.set(44, TOP + 4, z + 2);
    this.group.add(light);
  }

  _buildLights() {
    const ambient = new THREE.AmbientLight('#e9f8ff', 1.1);
    const hemi = new THREE.HemisphereLight('#eaf9ff', '#4f7c8d', 1.1);
    const sun = new THREE.DirectionalLight('#fff0c8', 2.0);
    sun.position.set(35, 55, 20);
    this.group.add(ambient, hemi, sun);
    for (const [x, y, z, color] of [[44, 14, 78, '#ffb347'], [14, 18, 44, '#68f5ff'], [74, 20, 44, '#ff75e0'], [44, 16, 14, '#ff9f3e']]) {
      const light = new THREE.PointLight(color, 2.2, 24, 2);
      light.position.set(x, y, z);
      this.group.add(light);
    }
  }

  _buildBackground() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#0d2b55');
    g.addColorStop(0.38, '#4f8fc7');
    g.addColorStop(0.62, '#ffbd7b');
    g.addColorStop(0.8, '#ffd9a8');
    g.addColorStop(1, '#7eb6de');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 80; i += 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect((i * 137) % 1024, 40 + (i * 71) % 220, 3, 1);
    }
    this.background = new THREE.CanvasTexture(canvas);
    this.background.colorSpace = THREE.SRGBColorSpace;
  }

  _buildSkyEffects() {
    // 中央能量光柱：这是效果层，建筑本体仍然是方块。
    const beamMat = new THREE.MeshBasicMaterial({
      color: '#71f4ff', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 22, 16, 1, true), beamMat);
    beam.position.set(44, TOP + 11, 44);
    this.group.add(beam);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 22, 12, 1, true), new THREE.MeshBasicMaterial({
      color: '#e8ffff', transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    core.position.set(44, TOP + 11, 44);
    this.group.add(core);
    // 全息世界地图屏。
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#061c2c'; ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = 'rgba(75,235,255,0.3)';
    for (let x = 0; x < 512; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
    for (let y = 0; y < 256; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
    ctx.fillStyle = '#36dbe9';
    for (const [x, y, w, h] of [[55, 70, 100, 60], [180, 48, 120, 55], [315, 88, 120, 88], [225, 145, 55, 45], [390, 40, 60, 40]]) ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#061c2c';
    for (const [x, y, w, h] of [[75, 84, 35, 25], [115, 100, 25, 17], [195, 65, 32, 20], [330, 105, 40, 35], [355, 122, 56, 28]]) ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#d6feff'; ctx.font = 'bold 22px sans-serif'; ctx.fillText('云上科技美食城 · 世界全息图', 26, 28);
    ctx.fillStyle = '#8ffaff'; ctx.font = '13px sans-serif'; ctx.fillText('CLOUD CITY  /  ONLINE', 372, 232);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 5.2), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    screen.position.set(44, TOP + 7.2, 31.6);
    this.group.add(screen);
    // 科技光点。
    const pts = [];
    for (let i = 0; i < 220; i += 1) {
      pts.push(8 + Math.random() * 72, 3 + Math.random() * 28, 8 + Math.random() * 72);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: '#8df7ff', size: 0.2, transparent: true, opacity: 0.8, depthWrite: false,
    }));
    this.group.add(this.points);
  }

  heightAt(x, z) {
    for (let y = H - 1; y >= 0; y -= 1) if (this.getBlock(x, y, z) !== BLOCK_IDS.AIR) return y;
    return TOP;
  }

  update(delta) {
    this.time += delta;
    if (this.portalTexture) this.portalTexture.offset.y -= delta * 0.5;
    if (this.portalRing) this.portalRing.rotation.z += delta * 0.5;
    if (this.points) this.points.rotation.y += delta * 0.02;
    return { respawn: false };
  }

  setVisible(visible) { this.group.visible = Boolean(visible); }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose());
        else object.material.dispose();
      }
    });
    this.atlas?.dispose();
    this.portalTexture?.dispose();
    this.background?.dispose();
  }
}
