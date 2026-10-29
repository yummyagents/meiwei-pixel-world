/**
 * 下界维度：一个独立的方块小世界。
 * 使用自己的网格数据和网格生成器，避免把主世界的村庄/洞穴生成带进来。
 */

import * as THREE from 'three';
import {
  ATLAS_COLS,
  BLOCK_IDS,
  TILE_SIZE,
  createBlockAtlasCanvas,
  getBlock,
  getBlockColor,
  isSolidBlock,
} from './blocks.js';

const W = 72;
const H = 28;
const D = 72;
const FACE_DEFS = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.78 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.78 },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.58 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.86 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.86 },
];

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class NetherRealm {
  constructor({ scene, theme = null }) {
    this.scene = scene;
    this.theme = theme;
    this.width = W;
    this.height = H;
    this.depth = D;
    this.data = new Uint8Array(W * H * D);
    this.random = makeRandom(0x6e746865);
    this.group = new THREE.Group();
    this.group.name = 'nether-realm';
    this.group.visible = false;
    this.scene.add(this.group);
    this.mobs = [];
    this.lights = [];
    this._portalTime = 0;
    this._generate();
    this._buildAtlas();
    this._buildMesh();
    this._buildReturnPortal();
    this._buildLights();
    this._buildMobs();
    this.spawn = { x: 36.5, y: 8.02, z: 55.5 };
    this.returnPortal = { x: 36.5, y: 8, z: 64.5 };
    this.biome = { emoji: '🔥', name: '下界' };
  }

  _index(x, y, z) {
    return x + z * W + y * W * D;
  }

  getBlock(x, y, z) {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (bx < 0 || bx >= W || by < 0 || by >= H || bz < 0 || bz >= D) return BLOCK_IDS.AIR;
    return this.data[this._index(bx, by, bz)];
  }

  setBlock(x, y, z, id) {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (bx < 0 || bx >= W || by < 0 || by >= H || bz < 0 || bz >= D) return false;
    const index = this._index(bx, by, bz);
    if (this.data[index] === id) return false;
    this.data[index] = id;
    this._buildMesh();
    return true;
  }

  _set(x, y, z, id) {
    if (x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) return;
    this.data[this._index(x, y, z)] = id;
  }

  _generate() {
    const B = BLOCK_IDS;
    // 更大的下界洞穴：地面、天花板、四周岩壁。
    for (let x = 0; x < W; x += 1) {
      for (let z = 0; z < D; z += 1) {
        for (let y = 0; y <= 7; y += 1) this._set(x, y, z, B.NETHERRACK);
        for (let y = 8; y <= 19; y += 1) this._set(x, y, z, B.AIR);
        for (let y = 20; y < H; y += 1) this._set(x, y, z, B.NETHERRACK);
      }
    }
    for (let y = 8; y <= 19; y += 1) {
      for (let x = 0; x < W; x += 1) {
        this._set(x, y, 0, B.NETHERRACK);
        this._set(x, y, D - 1, B.NETHERRACK);
      }
      for (let z = 0; z < D; z += 1) {
        this._set(0, y, z, B.NETHERRACK);
        this._set(W - 1, y, z, B.NETHERRACK);
      }
    }

    // 大型岩柱和悬挂岩块。
    for (let i = 0; i < 64; i += 1) {
      const x = 4 + Math.floor(this.random() * (W - 8));
      const z = 4 + Math.floor(this.random() * (D - 8));
      const top = 19 - Math.floor(this.random() * 6);
      const bottom = 9 + Math.floor(this.random() * 4);
      for (let y = bottom; y <= top; y += 1) this._set(x, y, z, B.NETHERRACK);
      if (i % 4 === 0) {
        for (let dx = -1; dx <= 1; dx += 1) {
          for (let dz = -1; dz <= 1; dz += 1) this._set(x + dx, top, z + dz, B.NETHERRACK);
        }
      }
    }

    // 灵魂沙谷：下界里最安静的一片区域。
    for (let x = 43; x <= 64; x += 1) {
      for (let z = 40; z <= 62; z += 1) {
        if (this.random() < 0.78) this._set(x, 7, z, B.SOUL_SAND);
      }
    }

    // 分布在洞穴里的岩浆湖。
    const pools = [
      [4, 10, 10, 22], [44, 52, 6, 14], [8, 22, 48, 62],
      [30, 40, 26, 34], [50, 64, 28, 38], [18, 28, 36, 44],
    ];
    for (const [x0, x1, z0, z1] of pools) {
      for (let x = x0; x <= x1; x += 1) {
        for (let z = z0; z <= z1; z += 1) {
          this._set(x, 7, z, B.NETHERRACK);
          this._set(x, 8, z, B.LAVA);
        }
      }
    }

    // 下界堡垒：更大的三层平台、塔楼和桥。
    for (let x = 12; x <= 30; x += 1) {
      for (let z = 12; z <= 30; z += 1) {
        this._set(x, 8, z, B.NETHER_BRICK);
        for (let y = 9; y <= 17; y += 1) this._set(x, y, z, B.AIR);
      }
    }
    for (const [tx, tz] of [[15, 15], [27, 15], [21, 27], [21, 15]]) {
      for (let x = tx - 2; x <= tx + 2; x += 1) {
        for (let z = tz - 2; z <= tz + 2; z += 1) {
          for (let y = 9; y <= 14; y += 1) {
            const edge = x === tx - 2 || x === tx + 2 || z === tz - 2 || z === tz + 2;
            this._set(x, y, z, edge ? B.NETHER_BRICK : B.AIR);
          }
          this._set(x, 15, z, B.NETHER_BRICK);
        }
      }
      this._set(tx, 16, tz, B.GOLD);
      this._set(tx, 9, tz, B.LANTERN);
    }
    for (let x = 15; x <= 27; x += 1) {
      this._set(x, 12, 15, B.NETHER_BRICK);
      this._set(x, 13, 15, B.NETHER_BRICK);
      this._set(x, 10, 27, B.NETHER_BRICK);
      this._set(x, 11, 27, B.GOLD);
    }

    // 出生点附近的下界砖哨塔。
    for (let x = 47; x <= 51; x += 1) {
      for (let z = 38; z <= 42; z += 1) {
        const edge = x === 47 || x === 51 || z === 38 || z === 42;
        for (let y = 8; y <= 13; y += 1) this._set(x, y, z, edge ? B.NETHER_BRICK : B.AIR);
        this._set(x, 14, z, B.NETHER_BRICK);
      }
    }
    this._set(49, 15, 40, B.GOLD);
    this._set(49, 9, 39, B.LANTERN);

    // 传送门附近留空。
    for (let x = 32; x <= 40; x += 1) {
      for (let z = 61; z <= 68; z += 1) {
        for (let y = 8; y <= 15; y += 1) this._set(x, y, z, B.AIR);
      }
    }

    // 洞顶和地面的灯笼。
    for (const [x, y, z] of [[21, 18, 15], [52, 18, 34], [60, 17, 50], [30, 16, 54], [37, 15, 28]]) {
      this._set(x, y, z, B.LANTERN);
    }
  }

  _buildAtlas() {
    const canvas = createBlockAtlasCanvas('classic');
    this.atlas = new THREE.CanvasTexture(canvas);
    this.atlas.magFilter = THREE.NearestFilter;
    this.atlas.minFilter = THREE.NearestFilter;
    this.atlas.generateMipmaps = false;
    this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.solidMaterial = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true });
    this.lavaMaterial = new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, fog: false });
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
    const color = new THREE.Color(getBlockColor(id));
    color.multiplyScalar(face.shade);
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
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (this.lavaMesh) {
      this.group.remove(this.lavaMesh);
      this.lavaMesh.geometry.dispose();
      this.lavaMesh = null;
    }
    const solid = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
    const lava = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
    for (let x = 0; x < W; x += 1) {
      for (let z = 0; z < D; z += 1) {
        for (let y = 0; y < H; y += 1) {
          const id = this.data[this._index(x, y, z)];
          if (id === BLOCK_IDS.AIR) continue;
          const target = id === BLOCK_IDS.LAVA ? lava : solid;
          for (const face of FACE_DEFS) {
            const nx = x + face.n[0];
            const ny = y + face.n[1];
            const nz = z + face.n[2];
            const neighbor = nx < 0 || nx >= W || ny < 0 || ny >= H || nz < 0 || nz >= D
              ? BLOCK_IDS.AIR
              : this.data[this._index(nx, ny, nz)];
            if (neighbor !== BLOCK_IDS.AIR) continue;
            this._addFace(target, x, y, z, face, id);
          }
        }
      }
    }
    const makeMesh = (data, material) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
      geometry.setIndex(data.indices);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    };
    this.mesh = makeMesh(solid, this.solidMaterial);
    this.lavaMesh = makeMesh(lava, this.lavaMaterial);
  }

  _buildReturnPortal() {
    const B = BLOCK_IDS;
    for (const x of [33, 39]) {
      for (let y = 8; y <= 14; y += 1) this._set(x, y, 64, B.OBSIDIAN);
    }
    for (let x = 33; x <= 39; x += 1) {
      this._set(x, 14, 64, B.OBSIDIAN);
      this._set(x, 15, 64, B.NETHER_BRICK);
    }
    for (let x = 34; x <= 38; x += 1) {
      for (let y = 8; y <= 13; y += 1) this._set(x, y, 64, B.AIR);
    }
    this._set(32, 8, 65, B.GOLD);
    this._set(40, 8, 65, B.GOLD);
    this._buildMesh();
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 96);
    gradient.addColorStop(0, '#29052f');
    gradient.addColorStop(0.5, '#a139d7');
    gradient.addColorStop(1, '#e07aff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 96);
    for (let i = 0; i < 16; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(246,190,255,0.24)';
      ctx.fillRect((i * 21) % 64, (i * 31) % 96, 2, 18);
    }
    this.portalTexture = new THREE.CanvasTexture(canvas);
    this.portalTexture.wrapS = THREE.RepeatWrapping;
    this.portalTexture.wrapT = THREE.RepeatWrapping;
    this.portalTexture.repeat.set(1.1, 1.3);
    this.portalMaterial = new THREE.MeshBasicMaterial({
      map: this.portalTexture,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    this.portalMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 5.7), this.portalMaterial);
    this.portalMesh.position.set(36.5, 11.2, 63.96);
    this.portalMesh.renderOrder = 4;
    this.group.add(this.portalMesh);
    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.12, 10, 56),
      new THREE.MeshBasicMaterial({ color: '#d36bff', transparent: true, opacity: 0.85 }),
    );
    ringA.position.set(36.5, 11.2, 64.0);
    this.group.add(ringA);
    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(3.5, 0.06, 8, 56),
      new THREE.MeshBasicMaterial({ color: '#78f5ff', transparent: true, opacity: 0.65 }),
    );
    ringB.position.set(36.5, 11.2, 64.0);
    this.group.add(ringB);
    this.portalRings = [ringA, ringB];
    const light = new THREE.PointLight('#d36bff', 2.4, 22, 2);
    light.position.set(36.5, 11.2, 62.5);
    this.group.add(light);
  }

  _buildLights() {
    const ambient = new THREE.AmbientLight('#ff7048', 1.35);
    const hemi = new THREE.HemisphereLight('#ff6844', '#2a0707', 1.25);
    this.group.add(ambient, hemi);
    this.lights.push(ambient, hemi);
    for (const [x, y, z] of [[36, 12, 64], [20, 15, 20], [55, 14, 45], [16, 12, 52], [50, 13, 52], [35, 11, 32], [21, 15, 28]]) {
      const light = new THREE.PointLight('#ff7a32', 1.25, 18, 2);
      light.position.set(x, y, z);
      this.group.add(light);
      this.lights.push(light);
    }
  }

  _buildMobs() {
    const addBox = (parent, w, h, d, color, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    // 恶魂：白灰色身体、红色眼睛、垂下的触手。
    for (const [x, y, z] of [[21, 16, 36], [54, 17, 22], [58, 15, 50], [32, 16, 44], [36, 13, 48], [48, 15, 30]]) {
      const g = new THREE.Group();
      addBox(g, 1.3, 1.1, 1.2, '#e1ded2', 0, 0, 0);
      addBox(g, 0.22, 0.18, 0.12, '#ff3020', -0.28, 0.15, 0.62);
      addBox(g, 0.22, 0.18, 0.12, '#ff3020', 0.28, 0.15, 0.62);
      for (const ox of [-0.38, 0, 0.38]) addBox(g, 0.12, 0.8, 0.12, '#b8b4aa', ox, -0.9, 0.1);
      g.position.set(x, y, z);
      g.userData.baseY = y;
      g.userData.phase = this.random() * Math.PI * 2;
      g.userData.type = 'ghast';
      this.group.add(g);
      this.mobs.push(g);
    }
    // 猪灵：粉色身体、金色护甲、在金块堡垒附近巡逻。
    for (const [x, z] of [[15, 15], [27, 15], [21, 27], [21, 15], [50, 41], [56, 46], [14, 52], [48, 58]]) {
      const g = new THREE.Group();
      addBox(g, 0.56, 0.78, 0.38, '#b9795e', 0, 0.92, 0);
      addBox(g, 0.48, 0.46, 0.44, '#c88d6c', 0, 1.52, 0);
      addBox(g, 0.14, 0.16, 0.2, '#d9a07c', 0, 1.46, 0.3);
      addBox(g, 0.06, 0.06, 0.04, '#251b1a', -0.1, 1.58, 0.23);
      addBox(g, 0.06, 0.06, 0.04, '#251b1a', 0.1, 1.58, 0.23);
      addBox(g, 0.6, 0.2, 0.44, '#e2b63d', 0, 1.15, 0);
      addBox(g, 0.14, 0.52, 0.14, '#c88d6c', -0.34, 0.95, 0);
      addBox(g, 0.14, 0.52, 0.14, '#c88d6c', 0.34, 0.95, 0);
      for (const ox of [-0.14, 0.14]) addBox(g, 0.16, 0.56, 0.16, '#513326', ox, 0.28, 0);
      g.position.set(x, 8.02, z);
      g.userData.home = { x, z };
      g.userData.phase = this.random() * Math.PI * 2;
      g.userData.type = 'piglin';
      this.group.add(g);
      this.mobs.push(g);
    }
  }

  getBiomeAt() { return this.biome; }
  biomeAt() { return 'nether'; }
  isInTechCity() { return false; }
  getLoadedChunkCount() { return 16; }
  getModifiedCount() { return 0; }
  renderDistance = 3;
  isBlockLoaded() { return true; }
  heightAt(x, z) {
    for (let y = H - 1; y >= 0; y -= 1) if (isSolidBlock(this.getBlock(x, y, z))) return y;
    return 7;
  }

  update(delta, playerPosition) {
    this._portalTime += delta;
    if (this.portalTexture) this.portalTexture.offset.y -= delta * 0.45;
    if (this.portalRings) {
      this.portalRings[0].rotation.z += delta * 0.55;
      this.portalRings[1].rotation.z -= delta * 0.4;
    }
    for (const mob of this.mobs) {
      const phase = mob.userData.phase || 0;
      if (mob.userData.type === 'ghast') {
        mob.position.y = mob.userData.baseY + Math.sin(this._portalTime * 1.2 + phase) * 0.8;
        mob.rotation.y = Math.sin(this._portalTime * 0.5 + phase) * 0.4;
      } else {
        const home = mob.userData.home;
        const t = this._portalTime * 0.35 + phase;
        mob.position.x = home.x + Math.sin(t) * 2.4;
        mob.position.z = home.z + Math.cos(t * 0.8) * 2.1;
        mob.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t * 0.8));
      }
    }
  }

  setVisible(visible) { this.group.visible = Boolean(visible); }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) object.material.dispose();
    });
    this.atlas?.dispose();
    this.portalTexture?.dispose();
  }
}
