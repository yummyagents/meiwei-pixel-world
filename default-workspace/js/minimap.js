/**
 * 2D 小地图：只读取附近地形的高度和群系，用 Canvas 画出来。
 * 不参与 3D 渲染，关闭时完全不画，避免浪费性能。
 */

const MAP_SIZE = 180;
const GRID = 36;
const RADIUS_BLOCKS = 48;

const BIOME_COLORS = {
  plains: '#70c95b',
  cherry: '#e9a3c1',
  desert: '#e8cb72',
  beach: '#f1dd9b',
  snow: '#f3fbff',
  mountain: '#9d978c',
  jungle: '#3f8d45',
  ocean: '#47b4e2',
  river: '#54c2e8',
};

function shadeColor(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (value >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (value & 0xff) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

export class Minimap {
  constructor({ canvas, world, player }) {
    this.canvas = canvas;
    this.world = world;
    this.player = player;
    this.visible = false;
    this._updateTimer = 0;
    if (this.canvas) {
      this.canvas.width = MAP_SIZE;
      this.canvas.height = MAP_SIZE;
      this.ctx = this.canvas.getContext('2d');
    } else {
      this.ctx = null;
    }
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    if (this.visible) this.render([]);
    return this.visible;
  }

  toggle(animals = []) {
    this.visible = !this.visible;
    if (this.visible) this.render(animals);
    return this.visible;
  }

  update(delta, animals = []) {
    if (!this.visible || !this.ctx) return;
    this._updateTimer -= delta;
    if (this._updateTimer > 0) return;
    this._updateTimer = 0.28;
    this.render(animals);
  }

  render(animals = []) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const centerX = this.player.position.x;
    const centerZ = this.player.position.z;
    const cell = MAP_SIZE / GRID;
    const blockStep = (RADIUS_BLOCKS * 2) / GRID;
    const seaLevel = this.world.seaLevel || 8;

    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.imageSmoothingEnabled = false;

    for (let gx = 0; gx < GRID; gx += 1) {
      for (let gz = 0; gz < GRID; gz += 1) {
        const worldX = centerX + (gx - GRID / 2) * blockStep;
        const worldZ = centerZ + (gz - GRID / 2) * blockStep;
        const height = this.world.heightAt(Math.floor(worldX), Math.floor(worldZ));
        let color;
        if (height < seaLevel) {
          const depth = Math.min(4, seaLevel - height);
          color = shadeColor('#47b4e2', -depth * 10);
        } else {
          const biome = this.world.biomeAt(Math.floor(worldX), Math.floor(worldZ));
          color = shadeColor(BIOME_COLORS[biome] || BIOME_COLORS.plains, (height % 4) * 4 - 6);
        }
        ctx.fillStyle = color;
        ctx.fillRect(Math.floor(gx * cell), Math.floor(gz * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }

    // 小动物用金色小点标出来。
    for (const animal of animals) {
      const dx = animal.position.x - centerX;
      const dz = animal.position.z - centerZ;
      if (Math.abs(dx) > RADIUS_BLOCKS || Math.abs(dz) > RADIUS_BLOCKS) continue;
      const px = MAP_SIZE / 2 + (dx / RADIUS_BLOCKS) * (MAP_SIZE / 2);
      const py = MAP_SIZE / 2 + (dz / RADIUS_BLOCKS) * (MAP_SIZE / 2);
      ctx.beginPath();
      ctx.arc(px, py, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe15c';
      ctx.fill();
      ctx.strokeStyle = '#6e4b23';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 玩家朝向箭头。
    ctx.save();
    ctx.translate(MAP_SIZE / 2, MAP_SIZE / 2);
    ctx.rotate(-this.player.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6.5, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6.5, 7);
    ctx.closePath();
    ctx.fillStyle = '#fffdf4';
    ctx.strokeStyle = '#39445f';
    ctx.lineWidth = 2.2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 边框和北向标记。
    ctx.strokeStyle = 'rgba(58, 53, 82, 0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, MAP_SIZE - 3, MAP_SIZE - 3);
    ctx.fillStyle = 'rgba(47, 44, 72, 0.82)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', MAP_SIZE / 2, 16);
  }

  dispose() {
    this.ctx = null;
    this.canvas = null;
  }
}
