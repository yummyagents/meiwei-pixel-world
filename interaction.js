/**
 * 方块交互：准星射线、目标方框、破坏、放置、粒子掉落和音效。
 *
 * 左键：破坏方块  右键：放置方块
 * 每次操作只处理一个方块，并且有很短的冷却，连续点击也不会一次删掉一排。
 */

import * as THREE from 'three';
import { BLOCK_IDS, getBlock, getBlockColor, isUnbreakableBlock } from './blocks.js';
import { MAGNET_SLOT } from './inventory.js';

const REACH = 6;
const ACTION_COOLDOWN_MS = 150;
const MISS_MESSAGE_COOLDOWN_MS = 1800;

export class InteractionController {
  constructor({
    scene,
    camera,
    world,
    player,
    inventory,
    audio,
    ui,
    isBlocked,
    onBlockPlaced = () => {},
  }) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.player = player;
    this.inventory = inventory;
    this.audio = audio;
    this.ui = ui;
    this.isBlocked = isBlocked || (() => false);
    this.onBlockPlaced = onBlockPlaced || (() => {});

    this.target = null;
    this._lastActionTime = -Infinity;
    this._lastMissMessageTime = -Infinity;
    this.particles = [];

    this._particleGroup = new THREE.Group();
    this._particleGroup.name = 'block-particles';
    this.scene.add(this._particleGroup);

    this._particleGeometry = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    this._particleMaterials = new Map();

    const outlineGeometry = new THREE.BoxGeometry(1.006, 1.006, 1.006);
    const outlineEdges = new THREE.EdgesGeometry(outlineGeometry);
    this._outlineGeometry = outlineGeometry;
    this._outlineEdges = outlineEdges;
    this._outlineMaterial = new THREE.LineBasicMaterial({
      color: '#fff2a3',
      transparent: true,
      opacity: 0.95,
    });
    this.outline = new THREE.LineSegments(outlineEdges, this._outlineMaterial);
    this.outline.name = 'block-highlight';
    this.outline.visible = false;
    this.outline.renderOrder = 5;
    this.scene.add(this.outline);

    this._onContextMenu = (event) => {
      // 画布上永远不要弹出浏览器右键菜单。
      event.preventDefault();
    };
    this.player.domElement.addEventListener('contextmenu', this._onContextMenu);
  }

  update(delta = 0) {
    this.target = this._raycast();
    if (this.target && !this.isBlocked()) {
      this.outline.visible = true;
      this.outline.position.set(
        this.target.x + 0.5,
        this.target.y + 0.5,
        this.target.z + 0.5,
      );
    } else {
      this.outline.visible = false;
    }
    this._updateParticles(delta);
  }

  hideTarget() {
    this.outline.visible = false;
  }

  isTargeting() {
    return Boolean(this.target);
  }

  getTargetInfo() {
    if (!this.target) return null;
    const placement = this.getPlacementPosition();
    return {
      block: { ...this.target },
      placement,
      blockName: getBlock(this.target.id)?.name || '方块',
    };
  }

  getPlacementPosition() {
    if (!this.target) return null;
    const normal = this.target.normal;
    if (!normal || (normal[0] === 0 && normal[1] === 0 && normal[2] === 0)) return null;
    return {
      x: this.target.x + normal[0],
      y: this.target.y + normal[1],
      z: this.target.z + normal[2],
    };
  }

  handleAction(button) {
    if (this.isBlocked()) return false;
    const now = performance.now();
    if (now - this._lastActionTime < ACTION_COOLDOWN_MS) return false;

    this.target = this._raycast();
    if (!this.target) {
      if (now - this._lastMissMessageTime > MISS_MESSAGE_COOLDOWN_MS) {
        this._lastMissMessageTime = now;
        this.ui?.toastMessage('走近一点，把准星对准方块吧。', 'info', 1600);
      }
      this.outline.visible = false;
      return false;
    }

    this._lastActionTime = now;
    if (button === 0) return this._breakBlock(this.target);
    if (button === 2) return this._placeBlock(this.target);
    return false;
  }

  _breakBlock(target) {
    if (target.y <= 0) {
      this.audio?.playError();
      this.ui?.toastMessage('最底下的石头很结实，换一块吧。', 'warn', 1800);
      return false;
    }

    const block = getBlock(target.id);
    if (!block) return false;
    if (isUnbreakableBlock(target.id)) {
      this.audio?.playError();
      this.ui?.toastMessage('这块基石太硬啦，挖不动它。', 'info', 1700);
      return false;
    }
    const magnet = this.inventory.isMagnetSelected();
    const color = getBlockColor(target.id);
    const changed = this.world.setBlock(target.x, target.y, target.z, BLOCK_IDS.AIR);
    if (!changed) return false;

    this.audio?.playBreak();
    this._spawnParticles(
      target.x + 0.5,
      target.y + 0.5,
      target.z + 0.5,
      color,
      magnet ? 10 : 8,
      magnet,
    );
    if (magnet) this.audio?.playMagnet();
    this.outline.visible = false;
    return true;
  }

  _placeBlock(target) {
    const selected = this.inventory.getSelectedSlot();
    if (selected === null) {
      this.audio?.playError();
      this.ui?.toastMessage('先按 1–9 选一个方块格子吧。', 'warn', 1900);
      return false;
    }
    if (selected === MAGNET_SLOT) {
      this.audio?.playError();
      this.ui?.toastMessage('第 9 格是磁铁，只收集方块，不放置方块。', 'info', 2200);
      return false;
    }

    const placement = this.getPlacementPosition();
    if (!placement) return false;
    if (placement.y < 0 || placement.y >= 40) {
      this.audio?.playError();
      return false;
    }

    const existing = this.world.getBlock(placement.x, placement.y, placement.z);
    if (existing !== BLOCK_IDS.AIR && existing !== BLOCK_IDS.WATER) {
      this.audio?.playError();
      this.ui?.toastMessage('这里已经有方块啦，换个地方试试。', 'info', 1600);
      return false;
    }

    if (this.player.intersectsBlock(placement.x, placement.y, placement.z)) {
      this.audio?.playError();
      this.ui?.toastMessage('不能把方块放到自己身上哦！', 'warn', 1900);
      return false;
    }

    const destX = placement.x + 0.5;
    const destY = placement.y + 0.5;
    const destZ = placement.z + 0.5;
    const eye = this.player.getViewOrigin
      ? this.player.getViewOrigin()
      : this.camera.position;
    const distance = eye.distanceTo(new THREE.Vector3(destX, destY, destZ));
    if (distance > REACH + 1) {
      this.audio?.playError();
      this.ui?.toastMessage('太远啦，再靠近一点吧。', 'warn', 1600);
      return false;
    }

    const changed = this.world.setBlock(placement.x, placement.y, placement.z, selected);
    if (!changed) return false;

    this.audio?.playPlace();
    this._spawnParticles(destX, placement.y + 0.92, destZ, getBlockColor(selected), 6, false);
    try {
      this.onBlockPlaced({
        blockId: selected,
        x: placement.x,
        y: placement.y,
        z: placement.z,
      });
    } catch (error) {
      console.warn('[美味特工队] 放置回调出错：', error);
    }
    return true;
  }

  _raycast() {
    const origin = this.player.getViewOrigin
      ? this.player.getViewOrigin()
      : this.camera.position;
    const direction = this.player.getLookDirection
      ? this.player.getLookDirection()
      : new THREE.Vector3();
    if (!this.player.getLookDirection) this.camera.getWorldDirection(direction);
    if (direction.lengthSq() < 0.0001) return null;
    direction.normalize();

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = direction.x > 0 ? 1 : -1;
    const stepY = direction.y > 0 ? 1 : -1;
    const stepZ = direction.z > 0 ? 1 : -1;

    const deltaX = direction.x === 0 ? Infinity : Math.abs(1 / direction.x);
    const deltaY = direction.y === 0 ? Infinity : Math.abs(1 / direction.y);
    const deltaZ = direction.z === 0 ? Infinity : Math.abs(1 / direction.z);

    let maxX =
      direction.x === 0
        ? Infinity
        : direction.x > 0
          ? (x + 1 - origin.x) / direction.x
          : (origin.x - x) / -direction.x;
    let maxY =
      direction.y === 0
        ? Infinity
        : direction.y > 0
          ? (y + 1 - origin.y) / direction.y
          : (origin.y - y) / -direction.y;
    let maxZ =
      direction.z === 0
        ? Infinity
        : direction.z > 0
          ? (z + 1 - origin.z) / direction.z
          : (origin.z - z) / -direction.z;

    let normal = [0, 0, 0];
    let distance = 0;

    for (let i = 0; i < 96 && distance <= REACH; i += 1) {
      const blockId = this.world.getBlock(x, y, z);
      if (blockId !== BLOCK_IDS.AIR) {
        return { x, y, z, id: blockId, normal: [...normal], distance };
      }

      if (maxX < maxY && maxX < maxZ) {
        x += stepX;
        distance = maxX;
        maxX += deltaX;
        normal = [-stepX, 0, 0];
      } else if (maxY < maxZ) {
        y += stepY;
        distance = maxY;
        maxY += deltaY;
        normal = [0, -stepY, 0];
      } else {
        z += stepZ;
        distance = maxZ;
        maxZ += deltaZ;
        normal = [0, 0, -stepZ];
      }
    }
    return null;
  }

  _getParticleMaterial(color) {
    if (!this._particleMaterials.has(color)) {
      this._particleMaterials.set(
        color,
        new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      );
    }
    return this._particleMaterials.get(color);
  }

  _spawnParticles(x, y, z, color, count, magnet) {
    const material = this._getParticleMaterial(color);
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(this._particleGeometry, material);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.7,
        y + (Math.random() - 0.5) * 0.7,
        z + (Math.random() - 0.5) * 0.7,
      );
      const scale = 0.75 + Math.random() * 0.7;
      mesh.scale.setScalar(scale);
      this._particleGroup.add(mesh);
      this.particles.push({
        mesh,
        age: 0,
        life: 0.7 + Math.random() * 0.35,
        magnet,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2.4,
          1.5 + Math.random() * 2.1,
          (Math.random() - 0.5) * 2.4,
        ),
      });
    }
    // 避免特别密集的点击让粒子堆得太多。
    while (this.particles.length > 90) {
      const oldest = this.particles.shift();
      this._particleGroup.remove(oldest.mesh);
    }
  }

  _updateParticles(delta) {
    if (this.particles.length === 0) return;
    const dt = Math.min(Math.max(delta, 0), 0.05);
    const playerTarget = new THREE.Vector3(
      this.player.position.x,
      this.player.position.y + 1.2,
      this.player.position.z,
    );

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      const mesh = particle.mesh;
      particle.age += dt;

      if (particle.magnet) {
        const direction = playerTarget.clone().sub(mesh.position);
        const distance = direction.length();
        if (distance < 0.45 || particle.age > particle.life) {
          this._particleGroup.remove(mesh);
          this.particles.splice(i, 1);
          continue;
        }
        direction.normalize().multiplyScalar(10 * dt);
        mesh.position.add(direction);
      } else {
        particle.velocity.y -= 15 * dt;
        mesh.position.addScaledVector(particle.velocity, dt);
        const lifeRatio = particle.age / particle.life;
        mesh.scale.setScalar(Math.max(0.05, 1 - lifeRatio));
        if (particle.age >= particle.life) {
          this._particleGroup.remove(mesh);
          this.particles.splice(i, 1);
        }
      }
    }
  }

  dispose() {
    this.player.domElement.removeEventListener('contextmenu', this._onContextMenu);
    this.scene.remove(this.outline);
    this.scene.remove(this._particleGroup);
    this._particleGroup.clear();
    this.particles = [];
    this._outlineEdges.dispose();
    this._outlineGeometry.dispose();
    this._outlineMaterial.dispose();
    this._particleGeometry.dispose();
    for (const material of this._particleMaterials.values()) {
      material.dispose();
    }
    this._particleMaterials.clear();
  }
}
