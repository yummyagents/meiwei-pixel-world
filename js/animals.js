/**
 * 可爱的小动物：兔子、小鸡、小羊。
 *
 * 它们在草地上随机散步、避开水和高坎，不会攻击玩家。
 * 头顶的小星星会帮小朋友更快找到它们。
 */

import * as THREE from 'three';
import { BLOCK_IDS, isSolidBlock } from './blocks.js';
import { SEA_LEVEL } from './world.js';

export const ANIMAL_TYPES = Object.freeze({
  rabbit: {
    id: 'rabbit',
    name: '小兔子',
    icon: '🐰',
    width: 0.52,
    height: 0.82,
    speed: 1.05,
    markerHeight: 1.45,
  },
  chicken: {
    id: 'chicken',
    name: '小鸡',
    icon: '🐤',
    width: 0.44,
    height: 0.75,
    speed: 0.92,
    markerHeight: 1.18,
  },
  sheep: {
    id: 'sheep',
    name: '小羊',
    icon: '🐑',
    width: 0.78,
    height: 0.98,
    speed: 0.78,
    markerHeight: 1.6,
  },
  cow: {
    id: 'cow',
    name: '奶牛',
    icon: '🐄',
    width: 1.15,
    height: 1.35,
    speed: 0.56,
    markerHeight: 1.95,
  },
  horse: {
    id: 'horse',
    name: '小马',
    icon: '🐴',
    width: 1.05,
    height: 1.62,
    speed: 0.95,
    markerHeight: 2.2,
  },
  donkey: {
    id: 'donkey',
    name: '小驴',
    icon: '🫏',
    width: 0.95,
    height: 1.38,
    speed: 0.72,
    markerHeight: 2.0,
  },
  villager: {
    id: 'villager',
    name: '村民',
    icon: '🧑‍🌾',
    width: 0.62,
    height: 1.72,
    speed: 0.52,
    markerHeight: 2.05,
  },
});

const GRAVITY = 20;
const MAX_FALL = 18;
const EDGE_EPSILON = 0.0005;
const CURIOUS_DISTANCE = 3.8;
const MARKER_DISTANCE = 17;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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

function angleLerp(current, target, amount) {
  let difference = ((target - current + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return current + difference * amount;
}

export class AnimalManager {
  constructor({ scene, world, player, seed = 20261028, savedAnimals = null }) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.seed = seed;
    this.random = makeRandom((seed ^ 0x51ed270b) >>> 0);
    this.animals = [];
    this.group = new THREE.Group();
    this.group.name = 'animals';
    this.scene.add(this.group);

    this._geometryCache = new Map();
    this._materialCache = new Map();
    this._markerTexture = this._createMarkerTexture();
    this._markerMaterial = new THREE.SpriteMaterial({
      map: this._markerTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.95,
    });

    if (!(Array.isArray(savedAnimals) && this._restoreAnimals(savedAnimals))) {
      this._spawnAnimals();
    }
  }

  _restoreAnimals(savedAnimals) {
    const valid = [];
    for (const entry of savedAnimals) {
      if (!entry || !ANIMAL_TYPES[entry.type]) continue;
      if (![entry.x, entry.y, entry.z].every(Number.isFinite)) continue;
      valid.push(entry);
    }
    if (valid.length < 3) return false;

    for (const entry of valid) {
      const animal = new Animal({
        manager: this,
        type: entry.type,
        spot: { x: entry.x, y: entry.y, z: entry.z },
        home: entry.home,
        yaw: entry.yaw,
        random: this.random,
      });
      this.animals.push(animal);
      this.group.add(animal.group);
    }
    return true;
  }

  getSaveData() {
    return this.animals.map((animal) => ({
      type: animal.type,
      x: animal.position.x,
      y: animal.position.y,
      z: animal.position.z,
      yaw: animal.yaw,
      home: {
        x: animal.home.x,
        y: animal.home.y,
        z: animal.home.z,
      },
    }));
  }

  _spawnAnimals() {
    const spawn = this.world.spawn;
    const specs = [
      { type: 'rabbit', preferred: true },
      { type: 'rabbit' },
      { type: 'chicken' },
      { type: 'chicken' },
      { type: 'sheep' },
      { type: 'cow' },
      { type: 'cow' },
      { type: 'horse' },
      { type: 'donkey' },
    ];

    const forwardX = this.world.landmarkSpot.x - spawn.x;
    const forwardZ = this.world.landmarkSpot.z - spawn.z;
    const forwardLength = Math.hypot(forwardX, forwardZ) || 1;
    const nx = forwardX / forwardLength;
    const nz = forwardZ / forwardLength;

    for (const spec of specs) {
      let spot = null;
      if (spec.preferred) {
        const targetX = spawn.x + nx * 8;
        const targetZ = spawn.z + nz * 8;
        spot = this._findSpotAround(targetX, targetZ, 5, 4.5);
      }

      if (!spot) {
        for (let attempt = 0; attempt < 60 && !spot; attempt += 1) {
          const angle = this.random() * Math.PI * 2;
          const radius = 9 + this.random() * 13;
          const x = spawn.x + Math.cos(angle) * radius;
          const z = spawn.z + Math.sin(angle) * radius;
          spot = this._findSpotAround(x, z, 3, 4.2);
        }
      }

      if (!spot) {
        for (let radius = 5; radius <= 16 && !spot; radius += 1) {
          for (let i = 0; i < 16 && !spot; i += 1) {
            const angle = (i / 16) * Math.PI * 2;
            spot = this._findSpotAround(
              spawn.x + Math.cos(angle) * radius,
              spawn.z + Math.sin(angle) * radius,
              1,
              3.8,
            );
          }
        }
      }

      if (!spot) continue;
      const animal = new Animal({
        manager: this,
        type: spec.type,
        spot,
        random: this.random,
      });
      this.animals.push(animal);
      this.group.add(animal.group);
    }

    this._spawnVillagers();
  }

  _spawnVillagers() {
    const village = this.world.villageSpots?.[0];
    if (!village) return;
    const offsets = [
      [-2.5, 0.5],
      [2.5, 0.5],
      [-0.5, 2.5],
      [3.5, 0.5],
      [-4.5, -1.5],
      [4.5, -1.5],
    ];
    for (let variant = 0; variant < offsets.length; variant += 1) {
      const [ox, oz] = offsets[variant];
      const x = village.x + ox;
      const z = village.z + oz;
      const groundY = village.groundY;
      if (this.world.getBlock(x, groundY + 1, z) !== BLOCK_IDS.AIR) continue;
      if (this.world.getBlock(x, groundY + 2, z) !== BLOCK_IDS.AIR) continue;
      if (!this._hasAnimalClearance(Math.floor(x), groundY, Math.floor(z), 0.9, 1.8)) continue;
      const spot = { x, y: groundY + 1.02, z };
      const animal = new Animal({
        manager: this,
        type: 'villager',
        spot,
        random: this.random,
        variant,
      });
      this.animals.push(animal);
      this.group.add(animal.group);
    }
  }

  _findSpotAround(centerX, centerZ, radius, minPlayerDistance) {
    for (let attempt = 0; attempt < 28; attempt += 1) {
      const angle = this.random() * Math.PI * 2;
      const distance = Math.sqrt(this.random()) * radius;
      const gx = Math.floor(centerX + Math.cos(angle) * distance);
      const gz = Math.floor(centerZ + Math.sin(angle) * distance);
      const height = this.world.heightAt(gx, gz);
      if (height <= SEA_LEVEL + 1) continue;

      const biome = this.world.biomeAt(gx, gz);
      if (biome !== 'plains' && biome !== 'cherry' && biome !== 'jungle') continue;
      if (!this.world.isBlockLoaded(gx, height + 1, gz)) continue;
      if (this.world.getBlock(gx, height, gz) !== BLOCK_IDS.GRASS) continue;
      if (this.world.getBlock(gx, height + 1, gz) !== BLOCK_IDS.AIR) continue;
      if (this.world.getBlock(gx, height + 2, gz) !== BLOCK_IDS.AIR) continue;
      if (this.world.getBlock(gx, height + 3, gz) === BLOCK_IDS.WATER) continue;
      if (!this._hasAnimalClearance(gx, height, gz, 1.2, 1.7)) continue;
      if (
        Math.hypot(gx + 0.5 - this.world.spawn.x, gz + 0.5 - this.world.spawn.z) <
        minPlayerDistance
      ) {
        continue;
      }
      if (
        this.animals.some(
          (animal) =>
            Math.hypot(animal.position.x - (gx + 0.5), animal.position.z - (gz + 0.5)) < 2,
        )
      ) {
        continue;
      }

      return {
        x: gx + 0.5,
        y: height + 1.02,
        z: gz + 0.5,
      };
    }
    return null;
  }

  _hasAnimalClearance(gx, groundY, gz, width, height) {
    const half = width / 2;
    const centerX = gx + 0.5;
    const centerZ = gz + 0.5;
    const minX = Math.floor(centerX - half + 0.001);
    const maxX = Math.floor(centerX + half - 0.001);
    const minZ = Math.floor(centerZ - half + 0.001);
    const maxZ = Math.floor(centerZ + half - 0.001);
    const minY = groundY + 1;
    const maxY = Math.floor(groundY + 1 + height + 0.001);
    for (let bx = minX; bx <= maxX; bx += 1) {
      for (let bz = minZ; bz <= maxZ; bz += 1) {
        for (let by = minY; by <= maxY; by += 1) {
          if (this.world.getBlock(bx, by, bz) !== BLOCK_IDS.AIR) return false;
        }
      }
    }
    return true;
  }

  update(delta, playerPosition) {
    let nearestDistance = Infinity;
    let nearestAnimal = null;

    for (const animal of this.animals) {
      animal.update(delta, playerPosition);
      const distance = animal.distanceTo(playerPosition);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestAnimal = animal;
      }
    }

    return {
      nearestDistance,
      nearestAnimal,
      nearestName: nearestAnimal?.data.name || '',
      nearestType: nearestAnimal?.type || '',
    };
  }

  getCount() {
    return this.animals.length;
  }

  getDebugState() {
    return {
      count: this.animals.length,
      animals: this.animals.map((animal) => ({
        type: animal.type,
        name: animal.data.name,
        x: animal.position.x,
        y: animal.position.y,
        z: animal.position.z,
        home: { x: animal.home.x, y: animal.home.y, z: animal.home.z },
        state: animal.state,
        curious: animal.curious,
        onGround: animal.onGround,
        colliding: animal._collidesAt(animal.position.x, animal.position.y, animal.position.z),
        markerVisible: animal.marker.visible,
        moved: animal.totalMoved,
        thinkTimer: animal.thinkTimer,
        velocity: { x: animal.velocity.x, y: animal.velocity.y, z: animal.velocity.z },
        loaded: this.world.isBlockLoaded(
          animal.position.x,
          animal.position.y + 0.2,
          animal.position.z,
        ),
      })),
    };
  }

  dispose() {
    for (const animal of this.animals) {
      animal.dispose();
    }
    this.animals = [];
    this.scene.remove(this.group);
    this.group.clear();
    for (const geometry of this._geometryCache.values()) geometry.dispose();
    this._geometryCache.clear();
    for (const material of this._materialCache.values()) material.dispose();
    this._materialCache.clear();
    this._markerTexture.dispose();
    this._markerMaterial.dispose();
  }

  _geometry(width, height, depth) {
    const key = `${width.toFixed(3)}:${height.toFixed(3)}:${depth.toFixed(3)}`;
    if (!this._geometryCache.has(key)) {
      this._geometryCache.set(key, new THREE.BoxGeometry(width, height, depth));
    }
    return this._geometryCache.get(key);
  }

  _material(color) {
    if (!this._materialCache.has(color)) {
      this._materialCache.set(color, new THREE.MeshLambertMaterial({ color }));
    }
    return this._materialCache.get(color);
  }

  _part(parent, width, height, depth, color, x, y, z) {
    const mesh = new THREE.Mesh(this._geometry(width, height, depth), this._material(color));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  _buildModel(type, variant = 0) {
    const model = new THREE.Group();
    const legs = [];

    if (type === 'rabbit') {
      this._part(model, 0.54, 0.42, 0.72, '#f5eddf', 0, 0.4, 0);
      this._part(model, 0.22, 0.16, 0.42, '#fffaf0', 0, 0.62, 0.18);
      this._part(model, 0.4, 0.38, 0.38, '#f7f0e4', 0, 0.7, 0.36);
      this._part(model, 0.1, 0.34, 0.09, '#f7f0e4', -0.12, 1.0, 0.32).rotation.z = 0.14;
      this._part(model, 0.1, 0.34, 0.09, '#f7f0e4', 0.12, 1.0, 0.32).rotation.z = -0.14;
      this._part(model, 0.045, 0.23, 0.025, '#ffb8cb', -0.12, 1.0, 0.37).rotation.z = 0.14;
      this._part(model, 0.045, 0.23, 0.025, '#ffb8cb', 0.12, 1.0, 0.37).rotation.z = -0.14;
      this._part(model, 0.055, 0.055, 0.035, '#3d3245', -0.11, 0.75, 0.555);
      this._part(model, 0.055, 0.055, 0.035, '#3d3245', 0.11, 0.75, 0.555);
      this._part(model, 0.07, 0.055, 0.04, '#ffa8bf', 0, 0.63, 0.565);
      this._part(model, 0.15, 0.15, 0.15, '#fffaf0', 0, 0.43, -0.43);
      const legPositions = [
        [-0.17, 0.23],
        [0.17, 0.23],
        [-0.17, -0.24],
        [0.17, -0.24],
      ];
      legPositions.forEach(([x, z]) => {
        const leg = this._part(model, 0.12, 0.24, 0.13, '#eadbc8', x, 0.13, z);
        legs.push(leg);
      });
    } else if (type === 'chicken') {
      this._part(model, 0.48, 0.4, 0.58, '#f5c94d', 0, 0.38, 0);
      this._part(model, 0.32, 0.3, 0.3, '#ffda64', 0, 0.67, 0.28);
      this._part(model, 0.13, 0.09, 0.17, '#f08a32', 0, 0.64, 0.47);
      this._part(model, 0.1, 0.13, 0.2, '#e55a4b', 0, 0.84, 0.28);
      this._part(model, 0.07, 0.07, 0.035, '#3d3245', -0.09, 0.72, 0.435);
      this._part(model, 0.07, 0.07, 0.035, '#3d3245', 0.09, 0.72, 0.435);
      this._part(model, 0.06, 0.1, 0.06, '#e55a4b', 0, 0.55, 0.44);
      const leftWing = this._part(model, 0.07, 0.24, 0.32, '#eab83f', -0.27, 0.4, 0);
      const rightWing = this._part(model, 0.07, 0.24, 0.32, '#eab83f', 0.27, 0.4, 0);
      leftWing.rotation.z = 0.12;
      rightWing.rotation.z = -0.12;
      this._part(model, 0.17, 0.22, 0.08, '#e7ae34', -0.12, 0.5, -0.34).rotation.x = -0.35;
      this._part(model, 0.17, 0.22, 0.08, '#f4c54b', 0.12, 0.5, -0.34).rotation.x = 0.2;
      const legPositions = [
        [-0.1, 0.05],
        [0.1, 0.05],
      ];
      legPositions.forEach(([x, z]) => {
        const leg = this._part(model, 0.06, 0.23, 0.06, '#e88a32', x, 0.12, z);
        legs.push(leg);
      });
    } else if (type === 'cow') {
      this._part(model, 1.05, 0.62, 1.35, '#f5efe1', 0, 0.82, 0);
      this._part(model, 0.38, 0.34, 0.5, '#3f3b3a', -0.28, 1.02, -0.18);
      this._part(model, 0.3, 0.4, 0.55, '#5a5450', 0.34, 0.82, 0.24);
      this._part(model, 0.56, 0.52, 0.56, '#f5efe1', 0, 1.0, 0.78);
      this._part(model, 0.42, 0.28, 0.22, '#e7b8b0', 0, 0.86, 1.06);
      this._part(model, 0.09, 0.18, 0.09, '#e8dec5', -0.22, 1.3, 0.76);
      this._part(model, 0.09, 0.18, 0.09, '#e8dec5', 0.22, 1.3, 0.76);
      this._part(model, 0.09, 0.13, 0.06, '#3a3031', -0.14, 1.02, 1.08);
      this._part(model, 0.09, 0.13, 0.06, '#3a3031', 0.14, 1.02, 1.08);
      this._part(model, 0.26, 0.22, 0.3, '#e8b7b2', 0, 0.55, -0.12);
      this._part(model, 0.08, 0.58, 0.08, '#8c6d55', 0, 0.58, -0.73).rotation.x = 0.2;
      const legPositions = [
        [-0.36, 0.44], [0.36, 0.44], [-0.36, -0.46], [0.36, -0.46],
      ];
      legPositions.forEach(([x, z]) => {
        const leg = this._part(model, 0.17, 0.56, 0.17, '#3f3b3a', x, 0.3, z);
        legs.push(leg);
      });
    } else if (type === 'horse') {
      this._part(model, 0.92, 0.64, 1.42, '#9a633d', 0, 1.03, 0);
      this._part(model, 0.38, 0.8, 0.42, '#9a633d', 0, 1.32, 0.64);
      this._part(model, 0.42, 0.42, 0.64, '#9a633d', 0, 1.58, 0.92);
      this._part(model, 0.1, 0.42, 0.5, '#5f3b27', 0, 1.72, 0.62);
      this._part(model, 0.08, 0.2, 0.08, '#3a2c26', -0.16, 1.83, 0.94);
      this._part(model, 0.08, 0.2, 0.08, '#3a2c26', 0.16, 1.83, 0.94);
      this._part(model, 0.07, 0.07, 0.04, '#2f2522', -0.14, 1.62, 1.24);
      this._part(model, 0.07, 0.07, 0.04, '#2f2522', 0.14, 1.62, 1.24);
      this._part(model, 0.1, 0.62, 0.1, '#5f3b27', 0, 0.86, -0.74).rotation.x = 0.25;
      const legPositions = [
        [-0.3, 0.48], [0.3, 0.48], [-0.3, -0.48], [0.3, -0.48],
      ];
      legPositions.forEach(([x, z]) => {
        const leg = this._part(model, 0.15, 0.74, 0.15, '#7d4c30', x, 0.38, z);
        legs.push(leg);
      });
    } else if (type === 'donkey') {
      this._part(model, 0.82, 0.56, 1.25, '#8b8b89', 0, 0.89, 0);
      this._part(model, 0.34, 0.64, 0.38, '#8b8b89', 0, 1.2, 0.55);
      this._part(model, 0.38, 0.38, 0.56, '#8b8b89', 0, 1.4, 0.8);
      this._part(model, 0.08, 0.36, 0.12, '#6d6d6b', -0.16, 1.68, 0.68).rotation.z = -0.1;
      this._part(model, 0.08, 0.36, 0.12, '#6d6d6b', 0.16, 1.68, 0.68).rotation.z = 0.1;
      this._part(model, 0.12, 0.3, 0.14, '#4c4c4b', 0, 1.4, 1.02);
      this._part(model, 0.07, 0.07, 0.04, '#2d2b2a', -0.13, 1.47, 1.07);
      this._part(model, 0.07, 0.07, 0.04, '#2d2b2a', 0.13, 1.47, 1.07);
      this._part(model, 0.08, 0.46, 0.08, '#5c5a56', 0, 0.72, -0.65);
      const legPositions = [
        [-0.28, 0.4], [0.28, 0.4], [-0.28, -0.4], [0.28, -0.4],
      ];
      legPositions.forEach(([x, z]) => {
        const leg = this._part(model, 0.14, 0.62, 0.14, '#757573', x, 0.32, z);
        legs.push(leg);
      });
    } else if (type === 'villager') {
      const villagerPalettes = [
        { shirt: '#7a5b3e', hat: '#5f4931', apron: '#d8c29a' },
        { shirt: '#4f7d68', hat: '#3f5f4d', apron: '#e8e0c8' },
        { shirt: '#6a5688', hat: '#49365d', apron: '#d8c8d8' },
        { shirt: '#8f5a4f', hat: '#623b35', apron: '#f0d9bf' },
        { shirt: '#526f91', hat: '#354a65', apron: '#dce7f0' },
        { shirt: '#7a6b3e', hat: '#5d502c', apron: '#eee1b8' },
      ];
      const palette = villagerPalettes[variant % villagerPalettes.length];
      this._part(model, 0.56, 0.78, 0.38, palette.shirt, 0, 0.92, 0);
      this._part(model, 0.32, 0.3, 0.04, palette.apron, 0, 0.92, 0.2);
      this._part(model, 0.48, 0.48, 0.48, '#c58f64', 0, 1.52, 0);
      this._part(model, 0.12, 0.18, 0.13, '#b77d55', 0, 1.47, 0.29);
      this._part(model, 0.07, 0.07, 0.035, '#302925', -0.11, 1.58, 0.245);
      this._part(model, 0.07, 0.07, 0.035, '#302925', 0.11, 1.58, 0.245);
      this._part(model, 0.5, 0.16, 0.5, palette.hat, 0, 1.78, 0);
      this._part(model, 0.14, 0.52, 0.14, '#c58f64', -0.34, 0.95, 0);
      this._part(model, 0.14, 0.52, 0.14, '#c58f64', 0.34, 0.95, 0);
      const legPositions = [
        [-0.14, 0.0], [0.14, 0.0],
      ];
      legPositions.forEach(([x, z]) => {
        const leg = this._part(model, 0.16, 0.56, 0.16, '#4e3725', x, 0.28, z);
        legs.push(leg);
      });
    } else {
      // 小羊：羊毛由几个小方块拼成，软乎乎的感觉。
      this._part(model, 0.72, 0.5, 0.9, '#f5efdf', 0, 0.5, 0);
      this._part(model, 0.32, 0.28, 0.32, '#fffaf0', -0.38, 0.58, 0.13);
      this._part(model, 0.3, 0.26, 0.3, '#fffaf0', 0.38, 0.55, -0.12);
      this._part(model, 0.28, 0.22, 0.28, '#fffaf0', 0.1, 0.8, -0.15);
      this._part(model, 0.24, 0.2, 0.24, '#fffaf0', -0.15, 0.82, 0.08);
      this._part(model, 0.4, 0.38, 0.36, '#5b4842', 0, 0.64, 0.55);
      this._part(model, 0.1, 0.2, 0.08, '#4b3934', -0.26, 0.71, 0.53).rotation.z = 0.35;
      this._part(model, 0.1, 0.2, 0.08, '#4b3934', 0.26, 0.71, 0.53).rotation.z = -0.35;
      this._part(model, 0.06, 0.06, 0.035, '#2f2830', -0.1, 0.68, 0.74);
      this._part(model, 0.06, 0.06, 0.035, '#2f2830', 0.1, 0.68, 0.74);
      this._part(model, 0.08, 0.055, 0.04, '#c69e89', 0, 0.57, 0.745);
      const legPositions = [
        [-0.24, 0.26],
        [0.24, 0.26],
        [-0.24, -0.26],
        [0.24, -0.26],
      ];
      legPositions.forEach(([x, z]) => {
        const leg = this._part(model, 0.13, 0.31, 0.14, '#5b4842', x, 0.16, z);
        legs.push(leg);
      });
    }

    return { model, legs };
  }

  _createMarkerTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? 25 : 11;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = 32 + Math.cos(angle) * radius;
      const y = 32 + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffe56b';
    ctx.strokeStyle = '#a96b28';
    ctx.lineWidth = 4;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(26, 23, 5, 0, Math.PI * 2);
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}

class Animal {
  constructor({ manager, type, spot, home = null, yaw = null, random, variant = 0 }) {
    this.manager = manager;
    this.world = manager.world;
    this.type = type;
    this.data = ANIMAL_TYPES[type];
    this.random = random;
    this.variant = variant;
    this.position = new THREE.Vector3(spot.x, spot.y, spot.z);
    this.home = home
      ? new THREE.Vector3(
          Number.isFinite(home.x) ? home.x : spot.x,
          Number.isFinite(home.y) ? home.y : spot.y,
          Number.isFinite(home.z) ? home.z : spot.z,
        )
      : this.position.clone();
    this.velocity = new THREE.Vector3();
    this.onGround = true;
    this.state = 'idle';
    this.curious = false;
    this.thinkTimer = 0.3 + random() * 0.7;
    this.walkPhase = random() * Math.PI * 2;
    this.yaw = Number.isFinite(yaw) ? yaw : random() * Math.PI * 2;
    this.totalMoved = 0;
    this._stuckTime = 0;
    this._movementThisThink = 0;

    const built = manager._buildModel(type, this.variant || 0);
    this.model = built.model;
    this.legs = built.legs;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.group.add(this.model);

    const shadowGeometry = new THREE.CircleGeometry(
      Math.max(0.36, (this.data.width || 0.7) * 0.46),
      18,
    );
    // 阴影需要透明材质，所以单独建一个，不放进颜色缓存。
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: '#2f4b2d',
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    shadow.scale.set(1, 0.62, 1);
    this.group.add(shadow);
    this._shadow = { geometry: shadowGeometry, material: shadowMaterial };

    this.marker = new THREE.Sprite(manager._markerMaterial);
    this.marker.scale.set(0.36, 0.36, 0.36);
    this.marker.position.set(0, this.data.markerHeight, 0);
    this.group.add(this.marker);
  }

  _hasAnimalClearance(gx, groundY, gz, width, height) {
    const half = width / 2;
    const centerX = gx + 0.5;
    const centerZ = gz + 0.5;
    const minX = Math.floor(centerX - half + 0.001);
    const maxX = Math.floor(centerX + half - 0.001);
    const minZ = Math.floor(centerZ - half + 0.001);
    const maxZ = Math.floor(centerZ + half - 0.001);
    const minY = groundY + 1;
    const maxY = Math.floor(groundY + 1 + height + 0.001);
    for (let bx = minX; bx <= maxX; bx += 1) {
      for (let bz = minZ; bz <= maxZ; bz += 1) {
        for (let by = minY; by <= maxY; by += 1) {
          if (this.world.getBlock(bx, by, bz) !== BLOCK_IDS.AIR) return false;
        }
      }
    }
    return true;
  }

  update(delta, playerPosition) {
    if (!this.world.isBlockLoaded(this.position.x, this.position.y + 0.2, this.position.z)) {
      this.marker.visible = false;
      return;
    }

    const dt = Math.min(Math.max(delta, 0), 0.05);
    const distanceToPlayer = this.distanceTo(playerPosition);
    this.curious = distanceToPlayer < CURIOUS_DISTANCE;
    this.thinkTimer -= dt;

    if (this.curious) {
      this.state = 'curious';
      this.velocity.x *= 0.75;
      this.velocity.z *= 0.75;
    } else if (this.thinkTimer <= 0) {
      this._chooseAction();
    }

    if (this.state === 'walk' && !this.curious) {
      if (this.onGround && !this._safeAhead()) {
        this._chooseAction(true);
      }
      const speed = this.data.speed;
      const targetX = Math.sin(this.yaw) * speed;
      const targetZ = Math.cos(this.yaw) * speed;
      this.velocity.x += (targetX - this.velocity.x) * Math.min(1, dt * 7);
      this.velocity.z += (targetZ - this.velocity.z) * Math.min(1, dt * 7);
    } else {
      this.velocity.x += (0 - this.velocity.x) * Math.min(1, dt * 9);
      this.velocity.z += (0 - this.velocity.z) * Math.min(1, dt * 9);
    }

    this.onGround = this._isOnGround();
    if (!this.onGround) {
      this.velocity.y = Math.max(this.velocity.y - GRAVITY * dt, -MAX_FALL);
    } else if (this.velocity.y < 0) {
      this.velocity.y = 0;
    }

    const dx = this.velocity.x * dt;
    const dz = this.velocity.z * dt;
    const dy = this.velocity.y * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.12));
    const sx = dx / steps;
    const sy = dy / steps;
    const sz = dz / steps;
    const beforeX = this.position.x;
    const beforeZ = this.position.z;

    let blocked = false;
    for (let i = 0; i < steps; i += 1) {
      if (!this._moveHorizontal('x', sx)) blocked = true;
      if (!this._moveHorizontal('z', sz)) blocked = true;
      this._moveVertical(sy);
    }

    const moved = Math.hypot(this.position.x - beforeX, this.position.z - beforeZ);
    this.totalMoved += moved;
    this._movementThisThink += moved;
    this.onGround = this._isOnGround();

    if (this.state === 'walk' && !this.curious) {
      if (blocked || (this._movementThisThink < 0.03 && this.thinkTimer < 1.4)) {
        this._stuckTime += dt;
      } else {
        this._stuckTime = Math.max(0, this._stuckTime - dt * 2);
      }
      if (this._stuckTime > 1.1) {
        this._stuckTime = 0;
        this._chooseAction(true);
      }
    }

    if (this.position.y < -8 || this.distanceToHome() > 24) {
      this.position.copy(this.home);
      this.velocity.set(0, 0, 0);
      this.state = 'idle';
      this.thinkTimer = 1;
      this.group.position.copy(this.position);
    }

    let targetYaw = this.yaw;
    if (this.curious) {
      targetYaw = Math.atan2(
        playerPosition.x - this.position.x,
        playerPosition.z - this.position.z,
      );
    } else if (Math.hypot(this.velocity.x, this.velocity.z) > 0.08) {
      targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
    }
    this.yaw = angleLerp(this.yaw, targetYaw, Math.min(1, dt * 7));
    this.group.rotation.y = this.yaw;
    this.group.position.copy(this.position);

    this._animate(dt);
    this.marker.visible =
      distanceToPlayer > 4.2 && distanceToPlayer < MARKER_DISTANCE;
    this.marker.position.y =
      this.data.markerHeight + Math.sin(performance.now() * 0.003 + this.walkPhase) * 0.08;
  }

  _chooseAction(forceWalk = false) {
    const fromHome = this.distanceToHome();
    const shouldGoHome = fromHome > 6.5;
    this._movementThisThink = 0;

    if (!forceWalk && this.random() < 0.2) {
      this.state = 'idle';
      this.thinkTimer = 0.8 + this.random() * 1.4;
      return;
    }

    this.state = 'walk';
    this.thinkTimer = 1.5 + this.random() * 2.4;
    if (shouldGoHome) {
      this.yaw = Math.atan2(this.home.x - this.position.x, this.home.z - this.position.z);
    } else {
      this.yaw = this.random() * Math.PI * 2;
    }
  }

  _safeAhead() {
    const aheadX = this.position.x + Math.sin(this.yaw) * 0.85;
    const aheadZ = this.position.z + Math.cos(this.yaw) * 0.85;
    const gx = Math.floor(aheadX);
    const gz = Math.floor(aheadZ);
    const groundHeight = this.world.heightAt(gx, gz);
    const groundTop = groundHeight + 1;
    if (Math.abs(groundTop - this.position.y) > 1.12) return false;
    if (this.world.getBlock(gx, groundHeight + 1, gz) === BLOCK_IDS.WATER) return false;
    return true;
  }

  _moveHorizontal(axis, amount) {
    if (amount === 0) return true;
    const oldValue = this.position[axis];
    const oldY = this.position.y;
    this.position[axis] += amount;

    if (!this._collidesAt(this.position.x, this.position.y, this.position.z)) return true;

    if (this.onGround) {
      this.position.y = oldY + 1.02;
      if (!this._collidesAt(this.position.x, this.position.y, this.position.z)) {
        return true;
      }
      this.position.y = oldY;
    }

    this.position[axis] = oldValue;
    return false;
  }

  _moveVertical(amount) {
    if (amount === 0) return true;
    const oldY = this.position.y;
    this.position.y += amount;
    if (!this._collidesAt(this.position.x, this.position.y, this.position.z)) return true;

    this.position.y = oldY;
    if (amount < 0) {
      this.onGround = true;
      this.velocity.y = 0;
    } else {
      this.velocity.y = Math.min(0, this.velocity.y);
    }
    return false;
  }

  _isOnGround() {
    return this._collidesAt(this.position.x, this.position.y - 0.07, this.position.z);
  }

  _collidesAt(x, y, z) {
    const halfWidth = this.data.width / 2;
    const minX = x - halfWidth + EDGE_EPSILON;
    const maxX = x + halfWidth - EDGE_EPSILON;
    const minY = y + EDGE_EPSILON;
    const maxY = y + this.data.height - EDGE_EPSILON;
    const minZ = z - halfWidth + EDGE_EPSILON;
    const maxZ = z + halfWidth - EDGE_EPSILON;

    for (let bx = Math.floor(minX); bx <= Math.floor(maxX); bx += 1) {
      for (let by = Math.floor(minY); by <= Math.floor(maxY); by += 1) {
        for (let bz = Math.floor(minZ); bz <= Math.floor(maxZ); bz += 1) {
          if (isSolidBlock(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }

  _animate(dt) {
    const moving = Math.hypot(this.velocity.x, this.velocity.z);
    if (moving > 0.08) {
      this.walkPhase += dt * (5.5 + moving * 3);
    }
    const walkAmount = clamp(moving / this.data.speed, 0, 1);
    this.model.position.y =
      Math.abs(Math.sin(this.walkPhase)) * (this.curious ? 0.055 : 0.026) * (0.3 + walkAmount);
    this.legs.forEach((leg, index) => {
      leg.rotation.x = Math.sin(this.walkPhase + (index % 2 === 0 ? 0 : Math.PI)) * 0.42 * walkAmount;
    });
    this.model.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.018;
  }

  distanceTo(playerPosition) {
    return Math.hypot(
      playerPosition.x - this.position.x,
      playerPosition.y - this.position.y,
      playerPosition.z - this.position.z,
    );
  }

  distanceToHome() {
    return Math.hypot(this.position.x - this.home.x, this.position.z - this.home.z);
  }

  dispose() {
    this.group.clear();
    this._shadow.geometry.dispose();
    this._shadow.material.dispose();
  }
}
