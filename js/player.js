/**
 * 第一人称玩家：WASD / 方向键移动、鼠标看视角、跳跃、重力、方块碰撞。
 *
 * 所有移动都拆成小步进行，速度再快也不会穿过方块。
 */

import * as THREE from 'three';
import { BLOCK_IDS, isSolidBlock } from './blocks.js';

const PLAYER_WIDTH = 0.58;
const PLAYER_HEIGHT = 1.78;
const EYE_HEIGHT = 1.62;
const WALK_SPEED = 4.6;
const RUN_SPEED = 7.15;
const GRAVITY = 24;
const JUMP_SPEED = 8.1;
const FLY_SPEED = 8.4;
const THIRD_PERSON_DISTANCE = 4.4;
const MAX_FALL_SPEED = 30;
const MOUSE_SENSITIVITY = 0.00225;
const MAX_STEP = 0.16;
const EDGE_EPSILON = 0.0005;

const MOVE_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'ShiftLeft',
  'ShiftRight',
]);

const PREVENT_SCROLL_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);

function addCircleBand(parent, material, radiusTop, radiusBottom, height, color, y) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 12),
    material(color),
  );
  mesh.position.y = y;
  parent.add(mesh);
  return mesh;
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

export class Player {
  constructor({
    camera,
    world,
    scene = null,
    character = null,
    domElement,
    spawn,
    yaw = 0,
    pitch = -0.08,
    touchMode = false,
    onPointerLockChange = () => {},
    onPointerLockError = () => {},
    onFatalFall = () => {},
    onBlockAction = () => {},
  }) {
    this.camera = camera;
    this.world = world;
    this.scene = scene;
    this.character = character;
    this.domElement = domElement;
    this.spawn = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
    this.position = this.spawn.clone();
    this.velocity = new THREE.Vector3();
    this.yaw = yaw;
    this.pitch = pitch;
    this.enabled = false;
    this.touchMode = Boolean(touchMode);
    this.externalMove = { x: 0, z: 0 };
    this.onGround = false;
    this.inWater = false;
    this.headInWater = false;
    this.flying = false;
    this.cameraMode = 'first';
    this.avatar = null;
    this.avatarParts = null;
    this._avatarWalk = 0;
    this._thirdDistance = THIRD_PERSON_DISTANCE;
    this.isPointerLocked = false;
    this.pointerLockFailed = false;
    this.bobTime = 0;
    this.bobOffset = 0;
    this.jumpQueued = false;
    this.touchJumpHeld = false;
    this._keys = new Set();
    this._dragging = false;
    this._lastMouse = null;
    this._lastLockFailureNotice = 0;
    this._lockAttemptInFlight = false;
    this._pendingCanvasClick = null;
    this._callbacks = {
      onPointerLockChange,
      onPointerLockError,
      onFatalFall,
      onBlockAction,
    };

    this.camera.rotation.order = 'YXZ';
    this._createAvatar();
    this._updateCamera(0);

    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onBlur = this._handleBlur.bind(this);
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onPointerLockChange = this._handlePointerLockChange.bind(this);
    this._onPointerLockError = this._handlePointerLockError.bind(this);
    this._onWindowMouseUp = this._handlePointerUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp, { passive: false });
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('mouseup', this._onWindowMouseUp);
    this.domElement.addEventListener('mousedown', this._onPointerDown);
    window.addEventListener('mousemove', this._onPointerMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('pointerlockerror', this._onPointerLockError);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this._clearInput();
      this.externalMove.x = 0;
      this.externalMove.z = 0;
      this.touchJumpHeld = false;
    }
  }

  setTouchMode(enabled) {
    this.touchMode = Boolean(enabled);
  }

  setExternalMove(x, z) {
    const length = Math.hypot(Number(x) || 0, Number(z) || 0);
    if (length > 1) {
      this.externalMove.x = (Number(x) || 0) / length;
      this.externalMove.z = (Number(z) || 0) / length;
    } else {
      this.externalMove.x = Number(x) || 0;
      this.externalMove.z = Number(z) || 0;
    }
  }

  queueJump() {
    if (this.enabled) this.jumpQueued = true;
  }

  setFlying(flying) {
    this.flying = Boolean(flying);
    this.jumpQueued = false;
    if (this.flying) {
      this.onGround = false;
      this.velocity.y = 0;
    }
    if (this.avatar) this.avatar.visible = this.cameraMode === 'third';
    return this.flying;
  }

  toggleFlying() {
    return this.setFlying(!this.flying);
  }

  setCameraMode(mode) {
    this.cameraMode = mode === 'third' ? 'third' : 'first';
    if (this.avatar) this.avatar.visible = this.cameraMode === 'third';
    this._updateCamera(0);
    return this.cameraMode;
  }

  toggleCameraMode() {
    return this.setCameraMode(this.cameraMode === 'first' ? 'third' : 'first');
  }

  getViewOrigin() {
    return new THREE.Vector3(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
  }

  getLookDirection() {
    const cosPitch = Math.cos(this.pitch);
    return new THREE.Vector3(
      -Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cosPitch,
    ).normalize();
  }

  setTouchJumpHeld(held) {
    this.touchJumpHeld = Boolean(held) && this.enabled;
  }

  applyLookDelta(movementX, movementY, sensitivity = MOUSE_SENSITIVITY) {
    this.yaw -= movementX * sensitivity;
    this.pitch -= movementY * sensitivity;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    if (this.yaw > Math.PI * 2) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI * 2) this.yaw += Math.PI * 2;
  }

  setSpawn(spawn) {
    this.spawn.set(spawn.x, spawn.y, spawn.z);
  }

  respawn() {
    this.position.copy(this.spawn);
    this.velocity.set(0, 0, 0);
    this.onGround = false;
    this.flying = false;
    if (this.avatar) this.avatar.visible = this.cameraMode === 'third';
    this._updateCamera(0);
  }

  teleport(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this._updateCamera(0);
  }

  setLook(yaw, pitch) {
    if (Number.isFinite(yaw)) this.yaw = yaw;
    if (Number.isFinite(pitch)) {
      this.pitch = Math.max(-1.45, Math.min(1.45, pitch));
    }
    this._updateCamera();
  }

  intersectsBlock(blockX, blockY, blockZ) {
    const minX = this.position.x - PLAYER_WIDTH / 2 + EDGE_EPSILON;
    const maxX = this.position.x + PLAYER_WIDTH / 2 - EDGE_EPSILON;
    const minY = this.position.y + EDGE_EPSILON;
    const maxY = this.position.y + PLAYER_HEIGHT - EDGE_EPSILON;
    const minZ = this.position.z - PLAYER_WIDTH / 2 + EDGE_EPSILON;
    const maxZ = this.position.z + PLAYER_WIDTH / 2 - EDGE_EPSILON;
    return (
      blockX + 1 > minX &&
      blockX < maxX &&
      blockY + 1 > minY &&
      blockY < maxY &&
      blockZ + 1 > minZ &&
      blockZ < maxZ
    );
  }

  requestPointerLock() {
    if (!this.enabled || this.touchMode) return false;
    if (document.pointerLockElement === this.domElement) return true;
    if (typeof this.domElement.requestPointerLock !== 'function') {
      this._notifyPointerLockFailure('这个浏览器不支持锁定鼠标，可以按住左键拖动视角。');
      return false;
    }

    this._lockAttemptInFlight = true;
    try {
      const result = this.domElement.requestPointerLock();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          this._lockAttemptInFlight = false;
          this._notifyPointerLockFailure('鼠标锁定没有成功，可以按住左键拖动视角。');
        });
      }
      return true;
    } catch (error) {
      this._lockAttemptInFlight = false;
      this._notifyPointerLockFailure('鼠标锁定没有成功，可以按住左键拖动视角。', error);
      return false;
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement === this.domElement) {
      try {
        document.exitPointerLock();
      } catch (error) {
        // 忽略浏览器差异，不影响继续用键盘玩。
        console.warn('退出鼠标锁定失败：', error);
      }
    }
  }

  update(delta) {
    if (!this.enabled) {
      this._updateCamera(0);
      return;
    }

    const dt = Math.min(Math.max(delta, 0), 0.05);
    this.onGround = this._isOnGround();
    this.inWater = this._isInWaterAt(0.18) || this._isInWaterAt(0.95);
    this.headInWater = this._isInWaterAt(EYE_HEIGHT);

    const sprinting = this._keys.has('ShiftLeft') || this._keys.has('ShiftRight');
    const speed = this.flying
      ? FLY_SPEED
      : (sprinting ? RUN_SPEED : WALK_SPEED) * (this.inWater ? 0.62 : 1);
    let inputX =
      (this._keys.has('KeyD') || this._keys.has('ArrowRight') ? 1 : 0) -
      (this._keys.has('KeyA') || this._keys.has('ArrowLeft') ? 1 : 0);
    let inputZ =
      (this._keys.has('KeyW') || this._keys.has('ArrowUp') ? 1 : 0) -
      (this._keys.has('KeyS') || this._keys.has('ArrowDown') ? 1 : 0);
    inputX += this.externalMove.x;
    inputZ += this.externalMove.z;
    const inputLength = Math.hypot(inputX, inputZ);
    if (inputLength > 1) {
      inputX /= inputLength;
      inputZ /= inputLength;
    }

    let moveX = 0;
    let moveZ = 0;
    if (inputX !== 0 || inputZ !== 0) {
      const length = Math.hypot(inputX, inputZ);
      const normalizedX = inputX / length;
      const normalizedZ = inputZ / length;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      moveX = (cos * normalizedX - sin * normalizedZ) * speed;
      moveZ = (-sin * normalizedX - cos * normalizedZ) * speed;
    }

    const targetX = moveX;
    const targetZ = moveZ;
    const acceleration = 1 - Math.exp(-(inputX !== 0 || inputZ !== 0 ? 16 : 11) * dt);
    this.velocity.x += (targetX - this.velocity.x) * acceleration;
    this.velocity.z += (targetZ - this.velocity.z) * acceleration;

    if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
    if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;

    if (this.flying) {
      // 自由飞行：空格上升，Shift 下降，松手悬停。
      const up = this._keys.has('Space') || this.touchJumpHeld;
      const down = this._keys.has('ShiftLeft') || this._keys.has('ShiftRight');
      const verticalTarget = (up ? 1 : 0) - (down ? 1 : 0);
      const verticalAcceleration = 1 - Math.exp(-10 * dt);
      this.velocity.y += (verticalTarget * FLY_SPEED - this.velocity.y) * verticalAcceleration;
      this.onGround = false;
    } else if (this.inWater) {
      // 在水里按住空格/跳跃可以慢慢游上来，松开则轻轻下沉。
      if (this._keys.has('Space') || this.jumpQueued || this.touchJumpHeld) {
        this.velocity.y = 3.6;
        this.onGround = false;
      } else {
        this.velocity.y = Math.max(this.velocity.y - 5.5 * dt, -2.8);
      }
    } else {
      if (this.jumpQueued && this.onGround) {
        this.velocity.y = JUMP_SPEED;
        this.onGround = false;
      }
      if (!this.onGround) {
        this.velocity.y = Math.max(this.velocity.y - GRAVITY * dt, -MAX_FALL_SPEED);
      } else if (this.velocity.y < 0) {
        this.velocity.y = 0;
      }
    }
    this.jumpQueued = false;

    const dx = this.velocity.x * dt;
    const dz = this.velocity.z * dt;
    const dy = this.velocity.y * dt;
    const steps = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / MAX_STEP),
    );
    const stepX = dx / steps;
    const stepY = dy / steps;
    const stepZ = dz / steps;

    for (let i = 0; i < steps; i += 1) {
      this._moveHorizontal('x', stepX);
      this._moveHorizontal('z', stepZ);
      this._moveVertical(stepY);
    }

    this.onGround = this.flying ? false : this._isOnGround();

    if (this.position.y < -8) {
      this.respawn();
      this._callbacks.onFatalFall();
    }

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (!this.flying && this.onGround && horizontalSpeed > 0.5) {
      this.bobTime += dt * (sprinting ? 12.5 : 9.5);
    }
    const targetBob = !this.flying && this.onGround
      ? Math.sin(this.bobTime) * Math.min(horizontalSpeed / RUN_SPEED, 1) * 0.035
      : 0;
    this.bobOffset += (targetBob - this.bobOffset) * Math.min(1, dt * 14);

    this._updateAvatar(dt, horizontalSpeed, sprinting);
    this._updateCamera(0);
  }

  _moveHorizontal(axis, amount) {
    if (amount === 0) return;
    const oldValue = this.position[axis];
    const oldY = this.position.y;
    this.position[axis] += amount;

    if (!this._collidesAt(this.position)) return;

    if (this.onGround) {
      this.position.y = oldY + 1.02;
      if (!this._collidesAt(this.position)) {
        // 小台阶自动迈上去，小朋友不会老是卡在草坡前。
        return;
      }
      this.position.y = oldY;
    }

    this.position[axis] = oldValue;
  }

  _moveVertical(amount) {
    if (amount === 0) return;
    const oldY = this.position.y;
    this.position.y += amount;

    if (!this._collidesAt(this.position)) return;

    this.position.y = oldY;
    if (amount < 0) {
      this.onGround = true;
      this.velocity.y = 0;
    } else {
      this.velocity.y = Math.min(0, this.velocity.y);
    }
  }

  _isOnGround() {
    if (this.position.y <= -0.5) return true;
    return this._collidesAt({
      x: this.position.x,
      y: this.position.y - 0.075,
      z: this.position.z,
    });
  }

  _isInWaterAt(offsetY) {
    return this.world.getBlock(
      this.position.x,
      this.position.y + offsetY,
      this.position.z,
    ) === BLOCK_IDS.WATER;
  }

  _collidesAt(position) {
    const minX = position.x - PLAYER_WIDTH / 2 + EDGE_EPSILON;
    const maxX = position.x + PLAYER_WIDTH / 2 - EDGE_EPSILON;
    const minY = position.y + EDGE_EPSILON;
    const maxY = position.y + PLAYER_HEIGHT - EDGE_EPSILON;
    const minZ = position.z - PLAYER_WIDTH / 2 + EDGE_EPSILON;
    const maxZ = position.z + PLAYER_WIDTH / 2 - EDGE_EPSILON;

    const startX = Math.floor(minX);
    const endX = Math.floor(maxX);
    const startY = Math.floor(minY);
    const endY = Math.floor(maxY);
    const startZ = Math.floor(minZ);
    const endZ = Math.floor(maxZ);

    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        for (let z = startZ; z <= endZ; z += 1) {
          if (isSolidBlock(this.world.getBlock(x, y, z))) return true;
        }
      }
    }
    return false;
  }

  _updateCamera() {
    if (this.cameraMode !== 'third') {
      this.camera.position.set(
        this.position.x,
        this.position.y + EYE_HEIGHT + this.bobOffset,
        this.position.z,
      );
      this.camera.rotation.x = this.pitch;
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.z = 0;
      this._thirdDistance = THIRD_PERSON_DISTANCE;
      return;
    }

    const eyeX = this.position.x;
    const eyeY = this.position.y + EYE_HEIGHT;
    const eyeZ = this.position.z;
    const cosPitch = Math.cos(this.pitch);
    const forwardX = -Math.sin(this.yaw) * cosPitch;
    const forwardY = Math.sin(this.pitch);
    const forwardZ = -Math.cos(this.yaw) * cosPitch;
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    // 从肩膀后方看角色，镜头被墙挡住时会自动缩短。
    const offsetX = -forwardX * THIRD_PERSON_DISTANCE + rightX * 0.62;
    const offsetY = -forwardY * THIRD_PERSON_DISTANCE + 0.8;
    const offsetZ = -forwardZ * THIRD_PERSON_DISTANCE + rightZ * 0.62;
    const total = Math.hypot(offsetX, offsetY, offsetZ) || 1;
    let scale = 1;
    for (let distance = 0.6; distance <= total; distance += 0.35) {
      const px = eyeX + (offsetX / total) * distance;
      const py = eyeY + (offsetY / total) * distance;
      const pz = eyeZ + (offsetZ / total) * distance;
      if (isSolidBlock(this.world.getBlock(px, py, pz))) {
        scale = Math.max(0.18, (distance - 0.35) / total);
        break;
      }
    }
    this._thirdDistance = total * scale;
    this.camera.position.set(eyeX + offsetX * scale, eyeY + offsetY * scale, eyeZ + offsetZ * scale);
    this.camera.lookAt(
      eyeX + forwardX * 6.0,
      eyeY + forwardY * 6.0 + 0.06,
      eyeZ + forwardZ * 6.0,
    );
    if (this.avatar) this.avatar.visible = this._thirdDistance > 1.2;
  }

  _createAvatar() {
    if (!this.scene) return;
    const root = new THREE.Group();
    root.name = 'third-person-avatar';
    root.visible = false;
    const characterId = this.character?.id || 'burger';
    const skin = '#f1c49d';
    const materials = {};
    const material = (color) => {
      if (!materials[color]) {
        materials[color] = new THREE.MeshLambertMaterial({ color });
      }
      return materials[color];
    };
    const addBox = (parent, width, height, depth, color, x, y, z, rotation = null) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color));
      mesh.position.set(x, y, z);
      if (rotation) mesh.rotation.set(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0);
      parent.add(mesh);
      return mesh;
    };
    const addCone = (parent, radius, height, segments, color, x, y, z) => {
      const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(radius, height, segments),
        material(color),
      );
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    const addCylinder = (parent, radiusTop, radiusBottom, height, segments, color, x, y, z, rotation = null) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
        material(color),
      );
      mesh.position.set(x, y, z);
      if (rotation) mesh.rotation.set(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0);
      parent.add(mesh);
      return mesh;
    };

    const body = new THREE.Group();
    body.position.y = 0.95;
    root.add(body);
    const head = new THREE.Group();
    head.position.y = 1.56;
    root.add(head);

    const makeArm = (x, sleeve, cuff, handColor, extras = () => {}) => {
      const arm = new THREE.Group();
      arm.position.set(x, 1.02, 0);
      addBox(arm, 0.15, 0.52, 0.18, sleeve, 0, 0.02, 0);
      if (cuff) addBox(arm, 0.17, 0.11, 0.2, cuff, 0, -0.21, 0);
      addBox(arm, 0.16, 0.15, 0.16, handColor, 0, -0.32, -0.01);
      extras(arm);
      root.add(arm);
      return arm;
    };
    const makeLeg = (x, pants, shoe, trim = null) => {
      const leg = new THREE.Group();
      leg.position.set(x, 0.3, 0);
      addBox(leg, 0.19, 0.54, 0.2, pants, 0, 0, 0);
      addBox(leg, 0.22, 0.13, 0.28, shoe, 0, -0.27, -0.04);
      if (trim) addBox(leg, 0.16, 0.06, 0.06, trim, 0, -0.25, -0.2);
      root.add(leg);
      return leg;
    };

    let leftArm;
    let rightArm;
    let leftLeg;
    let rightLeg;

    if (characterId === 'fries') {
      // 薯条厨娘：绿围裙、白口罩、红头发，头上顶着一盒薯条。
      addBox(body, 0.58, 0.72, 0.36, '#3c9462', 0, 0, 0);
      addBox(body, 0.32, 0.48, 0.045, '#fff7ec', 0, -0.03, -0.205);
      addBox(body, 0.6, 0.09, 0.4, '#fff7ec', 0, -0.24, 0);
      addBox(body, 0.12, 0.12, 0.05, '#7c4f86', -0.1, -0.24, -0.23, [0, 0, 0.45]);
      addBox(body, 0.12, 0.12, 0.05, '#7c4f86', 0.1, -0.24, -0.23, [0, 0, -0.45]);
      addBox(body, 0.1, 0.1, 0.06, '#9d6cac', 0, -0.24, -0.25);
      addBox(body, 0.52, 0.05, 0.36, '#f6ead8', 0, 0.32, 0);
      leftArm = makeArm(-0.4, '#3c9462', null, '#f1c49d');
      rightArm = makeArm(0.4, '#3c9462', null, '#f1c49d', (arm) => {
        addCylinder(arm, 0.2, 0.2, 0.05, 10, '#2e7d51', 0, -0.42, -0.2, [Math.PI / 2, 0, 0]);
        addBox(arm, 0.055, 0.2, 0.055, '#2e7d51', 0, -0.34, -0.02);
      });
      leftLeg = makeLeg(-0.16, '#3c9462', '#3f8f61', '#f7f0e7');
      rightLeg = makeLeg(0.16, '#3c9462', '#3f8f61', '#f7f0e7');

      addBox(head, 0.5, 0.5, 0.48, skin, 0, 0, 0);
      addBox(head, 0.54, 0.42, 0.16, '#d94b42', 0, 0.02, 0.19);
      addBox(head, 0.56, 0.13, 0.1, '#d94b42', 0, 0.22, -0.2);
      addBox(head, 0.12, 0.26, 0.12, '#d94b42', -0.28, -0.03, -0.02);
      addBox(head, 0.12, 0.26, 0.12, '#d94b42', 0.28, -0.03, -0.02);
      addBox(head, 0.52, 0.18, 0.08, '#fff8ef', 0, -0.08, -0.27);
      addBox(head, 0.11, 0.08, 0.035, '#e05050', -0.12, 0.06, -0.265);
      addBox(head, 0.11, 0.09, 0.035, '#e05050', 0.1, 0.05, -0.265, [0, 0, -0.22]);
      addBox(head, 0.07, 0.14, 0.035, '#e05050', 0.14, 0.1, -0.265, [0, 0, 0.25]);
      // 头上的薯条
      const fryColors = ['#f2c442', '#f6cf52', '#eab936', '#f7d35a'];
      for (let i = 0; i < 7; i += 1) {
        const fx = -0.3 + i * 0.1;
        const fy = 0.5 + (i % 3) * 0.045;
        addBox(head, 0.075, 0.32 + (i % 2) * 0.12, 0.075, fryColors[i % fryColors.length], fx, fy, -0.01);
      }
      // 白色厨师帽
      const hatX = 0.28;
      addBox(head, 0.24, 0.15, 0.26, '#fffdf6', hatX, 0.44, 0.01);
      addBox(head, 0.26, 0.18, 0.28, '#fffdf6', hatX - 0.03, 0.58, 0.01);
      addBox(head, 0.18, 0.16, 0.2, '#fffdf6', hatX + 0.14, 0.58, 0.01);
    } else if (characterId === 'popcorn') {
      // 鸡米花小弟：橙色蓬松头发、紫色连帽衫、绿领口和橙色裤子。
      addBox(body, 0.58, 0.72, 0.36, '#6e467c', 0, 0, 0);
      addBox(body, 0.28, 0.25, 0.05, '#3f8b53', 0, 0.15, -0.21);
      addBox(body, 0.58, 0.12, 0.38, '#5a3768', 0, 0.34, 0.02);
      addBox(body, 0.28, 0.2, 0.08, '#5a3768', -0.33, 0.24, 0.1);
      addBox(body, 0.28, 0.2, 0.08, '#5a3768', 0.33, 0.24, 0.1);
      addBox(body, 0.6, 0.08, 0.4, '#e7a23e', 0, -0.3, 0);
      leftArm = makeArm(-0.4, '#6e467c', null, '#e7a23e');
      rightArm = makeArm(0.4, '#6e467c', null, '#e7a23e');
      leftLeg = makeLeg(-0.16, '#e7a23e', '#2f8053', '#f7f0e7');
      rightLeg = makeLeg(0.16, '#e7a23e', '#2f8053', '#f7f0e7');

      addBox(head, 0.5, 0.5, 0.48, skin, 0, 0, 0);
      // 后脑勺也铺满蓬松的橙色头发
      addBox(head, 0.54, 0.46, 0.08, '#e7a23e', 0, 0.03, 0.22);
      // 蓬松的橙色头发
      const hairBits = [
        [-0.3, 0.05, 0.02, 0.15, 0.25, 0.4],
        [0.3, 0.05, 0.02, 0.15, 0.25, 0.4],
        [-0.22, 0.24, 0.0, 0.26, 0.18, 0.44],
        [0.22, 0.24, 0.0, 0.26, 0.18, 0.44],
        [-0.28, -0.12, 0.02, 0.12, 0.2, 0.3],
        [0.28, -0.12, 0.02, 0.12, 0.2, 0.3],
        [0.0, 0.27, 0.06, 0.36, 0.16, 0.37],
        [-0.12, 0.14, 0.2, 0.2, 0.32, 0.16],
        [0.12, 0.12, 0.2, 0.2, 0.32, 0.16],
        [-0.2, 0.14, -0.2, 0.18, 0.22, 0.1],
        [0.2, 0.14, -0.2, 0.18, 0.22, 0.1],
      ];
      hairBits.forEach(([x, y, z, w, h, d]) => addBox(head, w, h, d, '#e7a23e', x, y, z));
      addBox(head, 0.12, 0.12, 0.035, '#fbf8ef', -0.11, 0.04, -0.255);
      addBox(head, 0.12, 0.12, 0.035, '#fbf8ef', 0.11, 0.04, -0.255);
      addBox(head, 0.08, 0.05, 0.03, '#d79b84', 0, -0.06, -0.255);
    } else if (characterId === 'witch') {
      // 魔法小女巫：粉色尖帽、棕色头发、粉色衣服和紫色裤子。
      addBox(body, 0.58, 0.72, 0.36, '#d77a9d', 0, 0, 0);
      addBox(body, 0.62, 0.08, 0.4, '#7b4b8e', 0, -0.2, 0);
      addBox(body, 0.72, 0.18, 0.44, '#cf6f91', 0, -0.33, 0);
      addBox(body, 0.58, 0.08, 0.38, '#a95d7c', 0, 0.3, 0);
      leftArm = makeArm(-0.4, '#d77a9d', null, skin);
      rightArm = makeArm(0.4, '#d77a9d', null, skin);
      leftLeg = makeLeg(-0.16, '#7b4b8e', '#9a5d9b');
      rightLeg = makeLeg(0.16, '#7b4b8e', '#9a5d9b');

      addBox(head, 0.5, 0.5, 0.48, skin, 0, 0, 0);
      // 棕色头发
      addBox(head, 0.6, 0.4, 0.18, '#694a36', 0, 0.05, 0.18);
      addBox(head, 0.18, 0.48, 0.2, '#694a36', -0.3, -0.02, 0.02);
      addBox(head, 0.18, 0.48, 0.2, '#694a36', 0.3, -0.02, 0.02);
      addBox(head, 0.54, 0.16, 0.1, '#694a36', 0, 0.23, -0.2);
      addBox(head, 0.09, 0.09, 0.03, '#4b3a35', -0.11, 0.06, -0.26);
      addBox(head, 0.09, 0.09, 0.03, '#4b3a35', 0.11, 0.06, -0.26);
      addBox(head, 0.1, 0.045, 0.03, '#c7907f', 0, -0.06, -0.26);
      // 尖帽、帽檐和绿色/橙色装饰
      addCylinder(head, 0.62, 0.68, 0.09, 12, '#d77a9d', 0, 0.35, 0);
      addCircleBand(head, material, 0.43, 0.36, 0.075, '#81b48c', 0.39);
      addBox(head, 0.16, 0.06, 0.08, '#e39b54', -0.24, 0.38, -0.34);
      addCone(head, 0.53, 1.08, 4, '#d77a9d', 0, 0.82, 0);
      addBox(head, 0.1, 0.22, 0.04, '#81b48c', 0.08, 0.72, -0.38);
    } else {
      // 汉堡特工：红色制服、紫色背带、黄绿腰带、绿色面罩和彩虹帽子。
      addBox(body, 0.58, 0.72, 0.36, '#d94b42', 0, 0, 0);
      addBox(body, 0.07, 0.54, 0.04, '#6d4a7a', -0.18, 0.04, -0.2);
      addBox(body, 0.07, 0.54, 0.04, '#6d4a7a', 0.18, 0.04, -0.2);
      addBox(body, 0.62, 0.09, 0.4, '#6d4a7a', 0, -0.22, 0);
      addBox(body, 0.58, 0.06, 0.4, '#f1c33e', 0, -0.28, 0);
      addBox(body, 0.15, 0.14, 0.05, '#3f9c60', 0, -0.28, -0.23);
      leftArm = makeArm(-0.4, '#d94b42', '#6d4a7a', '#3f9c60', (arm) => {
        addBox(arm, 0.1, 0.1, 0.04, '#fff6e8', 0, -0.22, -0.12);
      });
      rightArm = makeArm(0.4, '#d94b42', '#6d4a7a', '#3f9c60', (arm) => {
        addBox(arm, 0.1, 0.1, 0.04, '#fff6e8', 0, -0.22, -0.12);
      });
      leftLeg = makeLeg(-0.16, '#c7443d', '#3f9c60');
      rightLeg = makeLeg(0.16, '#c7443d', '#3f9c60');

      addBox(head, 0.5, 0.5, 0.48, skin, 0, 0, 0);
      addBox(head, 0.52, 0.34, 0.08, '#e8b13b', 0, 0.05, 0.21);
      addBox(head, 0.56, 0.18, 0.1, '#e8b13b', 0, 0.22, -0.2);
      addBox(head, 0.12, 0.3, 0.12, '#e8b13b', -0.28, -0.01, -0.03);
      addBox(head, 0.12, 0.3, 0.12, '#e8b13b', 0.28, -0.01, -0.03);
      addBox(head, 0.52, 0.2, 0.08, '#3f9c60', 0, -0.08, -0.27);
      addBox(head, 0.1, 0.1, 0.035, '#6c3b83', -0.11, 0.06, -0.265);
      addBox(head, 0.1, 0.1, 0.035, '#6c3b83', 0.11, 0.06, -0.265);
      // 彩虹帽
      addBox(head, 0.7, 0.1, 0.62, '#f1c33e', 0, 0.34, 0);
      addBox(head, 0.62, 0.11, 0.54, '#d94b42', 0, 0.43, 0);
      addBox(head, 0.57, 0.11, 0.5, '#3f9c60', 0, 0.52, 0);
      addBox(head, 0.5, 0.13, 0.44, '#f1c33e', 0, 0.62, 0);
      addBox(head, 0.34, 0.08, 0.34, '#d94b42', 0, 0.71, 0);
    }

    const shadowGeometry = new THREE.CircleGeometry(0.42, 18);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: '#2f4b2d',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    shadow.scale.set(1, 0.65, 1);
    root.add(shadow);

    this.avatar = root;
    this.avatarParts = { body, head, leftLeg, rightLeg, leftArm, rightArm };
    this.avatarShadow = { geometry: shadowGeometry, material: shadowMaterial };
    this._avatarMaterials = materials;
    this.avatar.position.copy(this.position);
    this.avatar.rotation.y = this.yaw;
    this.scene.add(root);
  }

  _updateAvatar(dt, horizontalSpeed, sprinting) {
    if (!this.avatar) return;
    this.avatar.visible = this.cameraMode === 'third' && this.enabled;
    this.avatar.position.copy(this.position);
    this.avatar.rotation.y = this.yaw;
    const moving = Math.min(1, horizontalSpeed / (sprinting ? RUN_SPEED : WALK_SPEED));
    if (moving > 0.05) {
      this._avatarWalk += dt * (sprinting ? 13 : 9);
    }
    const swing = Math.sin(this._avatarWalk) * 0.55 * moving;
    if (this.avatarParts) {
      const { leftLeg, rightLeg, leftArm, rightArm, body, head } = this.avatarParts;
      if (this.flying) {
        leftArm.rotation.z = 1.25;
        rightArm.rotation.z = -1.25;
        leftArm.rotation.x = 0;
        rightArm.rotation.x = 0;
        leftLeg.rotation.x = 0.18;
        rightLeg.rotation.x = -0.18;
        body.rotation.x = 0.12;
        head.rotation.x = -0.05;
      } else {
        leftArm.rotation.z = 0;
        rightArm.rotation.z = 0;
        body.rotation.x = 0;
        head.rotation.x = 0;
        leftLeg.rotation.x = swing;
        rightLeg.rotation.x = -swing;
        leftArm.rotation.x = -swing * 0.8;
        rightArm.rotation.x = swing * 0.8;
      }
    }
  }

  _handleKeyDown(event) {
    if (isTypingTarget(event.target)) return;
    const code = event.code;
    if (!MOVE_CODES.has(code)) return;

    if (this.enabled && PREVENT_SCROLL_CODES.has(code)) {
      event.preventDefault();
    }
    if (!this.enabled) return;

    if (code === 'Space') {
      if (!event.repeat) this.jumpQueued = true;
      this._keys.add(code);
      return;
    }
    this._keys.add(code);
  }

  _handleKeyUp(event) {
    if (this.enabled && PREVENT_SCROLL_CODES.has(event.code) && !isTypingTarget(event.target)) {
      event.preventDefault();
    }
    this._keys.delete(event.code);
  }

  _handleBlur() {
    this._clearInput();
    this._dragging = false;
    this._lastMouse = null;
    this._pendingCanvasClick = null;
  }

  _clearInput() {
    this._keys.clear();
    this.jumpQueued = false;
  }

  _handlePointerDown(event) {
    if (!this.enabled || this.touchMode) return;
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();

    if (document.pointerLockElement === this.domElement) {
      this._pendingCanvasClick = null;
      this._callbacks.onBlockAction(event.button);
      return;
    }

    // 没有锁定鼠标时：左键拖动看四周，轻轻一点也能操作方块。
    this._lastMouse = { x: event.clientX, y: event.clientY };
    if (event.button === 0) this._dragging = true;

    this._pendingCanvasClick = {
      button: event.button,
      startX: event.clientX,
      startY: event.clientY,
      moved: 0,
      startedAt: performance.now(),
      suppress: false,
    };

    if (!this.pointerLockFailed && !this._lockAttemptInFlight) {
      // 请求锁定鼠标，但不要把这次点击吞掉：
      // 锁定时在 mouseup 处理，锁定失败时仍按普通点击处理。
      this.requestPointerLock();
    }
  }

  _handlePointerMove(event) {
    if (!this.enabled || this.touchMode) return;

    if (document.pointerLockElement === this.domElement) {
      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;
      if (this._pendingCanvasClick) {
        this._pendingCanvasClick.moved += Math.abs(movementX) + Math.abs(movementY);
      }
      this._applyLook(movementX, movementY);
      return;
    }

    if (!this._lastMouse) {
      this._lastMouse = { x: event.clientX, y: event.clientY };
      return;
    }

    const movementX = event.clientX - this._lastMouse.x;
    const movementY = event.clientY - this._lastMouse.y;
    this._lastMouse = { x: event.clientX, y: event.clientY };

    if (this._pendingCanvasClick) {
      this._pendingCanvasClick.moved += Math.hypot(movementX, movementY);
    }
    if (this._dragging) {
      this._applyLook(movementX, movementY);
    }
  }

  _applyLook(movementX, movementY) {
    this.applyLookDelta(movementX, movementY);
  }

  _handlePointerUp(event) {
    const pending = this._pendingCanvasClick;
    if (
      document.pointerLockElement === this.domElement &&
      pending &&
      !pending.suppress &&
      pending.button === event.button &&
      pending.moved < 8 &&
      performance.now() - pending.startedAt < 650
    ) {
      this._callbacks.onBlockAction(pending.button);
    }

    if (document.pointerLockElement === this.domElement) {
      this._dragging = false;
      this._lastMouse = null;
      this._pendingCanvasClick = null;
      return;
    }
    if (
      pending &&
      !pending.suppress &&
      pending.button === event.button &&
      pending.moved < 8 &&
      performance.now() - pending.startedAt < 650
    ) {
      this._callbacks.onBlockAction(pending.button);
    }

    if (event.button === 0 || pending?.button === event.button || event.type === 'mouseup') {
      this._dragging = false;
      this._lastMouse = null;
    }
    this._pendingCanvasClick = null;
  }

  _handlePointerLockChange() {
    const wasLocked = this.isPointerLocked;
    this.isPointerLocked = document.pointerLockElement === this.domElement;
    this._lockAttemptInFlight = false;
    if (this.isPointerLocked) {
      this.pointerLockFailed = false;
      this._dragging = false;
      this._lastMouse = null;
    }
    this._callbacks.onPointerLockChange({
      locked: this.isPointerLocked,
      wasLocked,
    });
  }

  _handlePointerLockError() {
    this._lockAttemptInFlight = false;
    this._notifyPointerLockFailure('鼠标锁定没有成功，可以按住左键拖动视角。');
  }

  _notifyPointerLockFailure(message, error) {
    this.pointerLockFailed = true;
    this._lockAttemptInFlight = false;
    const now = performance.now();
    if (now - this._lastLockFailureNotice < 1500) return;
    this._lastLockFailureNotice = now;
    this._callbacks.onPointerLockError({ message, error });
  }

  getDebugState() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      onGround: this.onGround,
      pointerLocked: document.pointerLockElement === this.domElement,
      pointerLockFailed: this.pointerLockFailed,
      enabled: this.enabled,
      touchMode: this.touchMode,
      flying: this.flying,
      cameraMode: this.cameraMode,
      thirdDistance: this._thirdDistance,
      avatarVisible: Boolean(this.avatar?.visible),
      inWater: this.inWater,
      headInWater: this.headInWater,
      externalMove: { ...this.externalMove },
    };
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('mouseup', this._onWindowMouseUp);
    this.domElement.removeEventListener('mousedown', this._onPointerDown);
    window.removeEventListener('mousemove', this._onPointerMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('pointerlockerror', this._onPointerLockError);
    this.exitPointerLock();
    this._clearInput();
  }
}
