/**
 * 手机触屏控制：左摇杆、拖动画面看四周、破坏/放置/跳跃按钮。
 * 这个模块不直接移动相机，只把输入交给 Player。
 */

export class MobileControls {
  constructor({ player, interaction, isBlocked = () => false }) {
    this.player = player;
    this.interaction = interaction;
    this.isBlocked = isBlocked;
    this.canvas = player.domElement;
    this.enabled = false;
    this.joystickPointer = null;
    this.lookPointer = null;
    this.lookLast = null;
    this.jumpHeld = false;

    this.zone = document.getElementById('joystick-zone');
    this.base = document.getElementById('joystick-base');
    this.knob = document.getElementById('joystick-knob');
    this.breakButton = document.getElementById('btn-touch-break');
    this.placeButton = document.getElementById('btn-touch-place');
    this.jumpButton = document.getElementById('btn-touch-jump');

    this._bind();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.reset();
  }

  reset() {
    this.joystickPointer = null;
    this.lookPointer = null;
    this.lookLast = null;
    this.jumpHeld = false;
    if (this.knob) {
      this.knob.style.transform = 'translate(-50%, -50%)';
    }
    this.player.setExternalMove(0, 0);
  }

  _canUse() {
    return this.enabled && this.player.enabled && !this.isBlocked();
  }

  _bind() {
    this._onJoystickDown = (event) => {
      if (!this._canUse()) return;
      event.preventDefault();
      this.joystickPointer = event.pointerId;
      try {
        this.zone.setPointerCapture(event.pointerId);
      } catch (error) {
        // 某些浏览器不支持 setPointerCapture，不影响拖动。
      }
      this._updateJoystick(event);
    };
    this._onJoystickMove = (event) => {
      if (this.joystickPointer !== event.pointerId) return;
      event.preventDefault();
      this._updateJoystick(event);
    };
    this._onJoystickEnd = (event) => {
      if (this.joystickPointer !== event.pointerId) return;
      event.preventDefault();
      this.resetJoystick();
    };

    this._onLookDown = (event) => {
      if (!this._canUse()) return;
      if (this.lookPointer !== null) return;
      event.preventDefault();
      this.lookPointer = event.pointerId;
      this.lookLast = { x: event.clientX, y: event.clientY };
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // 不影响继续玩。
      }
    };
    this._onLookMove = (event) => {
      if (this.lookPointer !== event.pointerId || !this.lookLast) return;
      event.preventDefault();
      const dx = event.clientX - this.lookLast.x;
      const dy = event.clientY - this.lookLast.y;
      this.lookLast = { x: event.clientX, y: event.clientY };
      this.player.applyLookDelta(dx, dy, 0.0042);
    };
    this._onLookEnd = (event) => {
      if (this.lookPointer !== event.pointerId) return;
      event.preventDefault();
      this.lookPointer = null;
      this.lookLast = null;
    };

    this._onBreak = (event) => {
      event.preventDefault();
      if (!this._canUse()) return;
      this.interaction.handleAction(0);
    };
    this._onPlace = (event) => {
      event.preventDefault();
      if (!this._canUse()) return;
      this.interaction.handleAction(2);
    };
    this._onJumpDown = (event) => {
      event.preventDefault();
      if (!this._canUse()) return;
      this.jumpHeld = true;
      this.player.setTouchJumpHeld(true);
      this.player.queueJump();
      try {
        this.jumpButton.setPointerCapture(event.pointerId);
      } catch (error) {
        // 不支持捕获也不影响短按跳跃。
      }
    };
    this._onJumpEnd = (event) => {
      if (event.pointerId !== undefined) event.preventDefault();
      this.jumpHeld = false;
      this.player.setTouchJumpHeld(false);
    };

    this.zone?.addEventListener('pointerdown', this._onJoystickDown);
    this.zone?.addEventListener('pointermove', this._onJoystickMove);
    this.zone?.addEventListener('pointerup', this._onJoystickEnd);
    this.zone?.addEventListener('pointercancel', this._onJoystickEnd);
    this.zone?.addEventListener('lostpointercapture', this._onJoystickEnd);
    this.canvas.addEventListener('pointerdown', this._onLookDown);
    this.canvas.addEventListener('pointermove', this._onLookMove);
    this.canvas.addEventListener('pointerup', this._onLookEnd);
    this.canvas.addEventListener('pointercancel', this._onLookEnd);
    this.breakButton?.addEventListener('pointerdown', this._onBreak);
    this.placeButton?.addEventListener('pointerdown', this._onPlace);
    this.jumpButton?.addEventListener('pointerdown', this._onJumpDown);
    this.jumpButton?.addEventListener('pointerup', this._onJumpEnd);
    this.jumpButton?.addEventListener('pointercancel', this._onJumpEnd);
    this.jumpButton?.addEventListener('lostpointercapture', this._onJumpEnd);

    // 阻止双指缩放和长按菜单。
    this._onTouchStart = (event) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    document.addEventListener('touchstart', this._onTouchStart, { passive: false });
  }

  _updateJoystick(event) {
    if (!this.base) return;
    const rect = this.base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const maxRadius = rect.width * 0.33;
    const length = Math.hypot(dx, dy);
    if (length > maxRadius) {
      dx = (dx / length) * maxRadius;
      dy = (dy / length) * maxRadius;
    }
    if (this.knob) {
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
    const nx = dx / maxRadius;
    const ny = dy / maxRadius;
    const deadZone = 0.12;
    if (Math.abs(nx) < deadZone) this.player.setExternalMove(0, -ny);
    else if (Math.abs(ny) < deadZone) this.player.setExternalMove(nx, 0);
    else this.player.setExternalMove(nx, -ny);
  }

  resetJoystick() {
    this.joystickPointer = null;
    if (this.knob) this.knob.style.transform = 'translate(-50%, -50%)';
    this.player.setExternalMove(0, 0);
  }

  dispose() {
    this.zone?.removeEventListener('pointerdown', this._onJoystickDown);
    this.zone?.removeEventListener('pointermove', this._onJoystickMove);
    this.zone?.removeEventListener('pointerup', this._onJoystickEnd);
    this.zone?.removeEventListener('pointercancel', this._onJoystickEnd);
    this.zone?.removeEventListener('lostpointercapture', this._onJoystickEnd);
    this.canvas.removeEventListener('pointerdown', this._onLookDown);
    this.canvas.removeEventListener('pointermove', this._onLookMove);
    this.canvas.removeEventListener('pointerup', this._onLookEnd);
    this.canvas.removeEventListener('pointercancel', this._onLookEnd);
    this.breakButton?.removeEventListener('pointerdown', this._onBreak);
    this.placeButton?.removeEventListener('pointerdown', this._onPlace);
    this.jumpButton?.removeEventListener('pointerdown', this._onJumpDown);
    this.jumpButton?.removeEventListener('pointerup', this._onJumpEnd);
    this.jumpButton?.removeEventListener('pointercancel', this._onJumpEnd);
    this.jumpButton?.removeEventListener('lostpointercapture', this._onJumpEnd);
    document.removeEventListener('touchstart', this._onTouchStart);
    this.reset();
  }
}
