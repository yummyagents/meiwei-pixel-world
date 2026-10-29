/**
 * 全区域世界地图：以出生点为中心，显示约 900×900 格的地貌和重要地点。
 * 第一次打开时生成一张低分辨率地貌底图，之后只重画玩家和标记。
 */

const MAP_RESOLUTION = 210;
const MAP_RANGE = 900;
const MAP_SIZE = 640;

const BIOME_COLORS = {
  plains: [112, 201, 91],
  cherry: [233, 163, 193],
  desert: [232, 203, 114],
  beach: [241, 221, 155],
  snow: [243, 251, 255],
  mountain: [157, 151, 140],
  jungle: [63, 141, 69],
  ocean: [71, 180, 226],
  river: [84, 194, 232],
};

const WATER_COLOR = [62, 164, 214];

function shade(rgb, amount) {
  return [
    Math.max(0, Math.min(255, rgb[0] + amount)),
    Math.max(0, Math.min(255, rgb[1] + amount)),
    Math.max(0, Math.min(255, rgb[2] + amount)),
  ];
}

export class WorldMap {
  constructor({ canvas, world, player }) {
    this.canvas = canvas;
    this.world = world;
    this.player = player;
    this.ctx = canvas?.getContext('2d') || null;
    this.baseCanvas = null;
    this.baseStats = null;
    this.spawn = world.spawn;
    this.lastStats = null;
    if (this.canvas) {
      this.canvas.width = MAP_SIZE;
      this.canvas.height = MAP_SIZE;
    }
  }

  _toPixel(x, z) {
    return {
      x: ((x - this.spawn.x) / MAP_RANGE + 0.5) * MAP_SIZE,
      y: ((z - this.spawn.z) / MAP_RANGE + 0.5) * MAP_SIZE,
    };
  }

  _inside(x, z, margin = 8) {
    return (
      Math.abs(x - this.spawn.x) <= MAP_RANGE / 2 - margin &&
      Math.abs(z - this.spawn.z) <= MAP_RANGE / 2 - margin
    );
  }

  _buildBase() {
    if (this.baseCanvas) return;
    const canvas = document.createElement('canvas');
    canvas.width = MAP_RESOLUTION;
    canvas.height = MAP_RESOLUTION;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(MAP_RESOLUTION, MAP_RESOLUTION);
    const data = image.data;
    const step = MAP_RANGE / MAP_RESOLUTION;
    const originX = this.spawn.x - MAP_RANGE / 2;
    const originZ = this.spawn.z - MAP_RANGE / 2;
    const seaLevel = this.world.seaLevel || 8;
    let highest = { height: -1, x: 0, z: 0 };

    for (let py = 0; py < MAP_RESOLUTION; py += 1) {
      const worldZ = originZ + (py + 0.5) * step;
      for (let px = 0; px < MAP_RESOLUTION; px += 1) {
        const worldX = originX + (px + 0.5) * step;
        const bx = Math.floor(worldX);
        const bz = Math.floor(worldZ);
        const height = this.world.heightAt(bx, bz);
        const biome = this.world.biomeAt(bx, bz);
        let color;
        if (height < seaLevel) {
          const depth = Math.min(6, seaLevel - height);
          color = shade(WATER_COLOR, -depth * 9);
        } else {
          let base = BIOME_COLORS[biome] || BIOME_COLORS.plains;
          if (biome === 'mountain' && height >= 23) base = BIOME_COLORS.snow;
          color = shade(base, ((height % 5) - 2) * 4);
        }
        if (biome === 'mountain' && height > highest.height) {
          highest = { height, x: bx, z: bz };
        }
        const i = (py * MAP_RESOLUTION + px) * 4;
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    this.baseCanvas = canvas;
    this.baseStats = { highestMountain: highest };
  }

  _renderPlaces() {
    const container = document.getElementById('worldmap-places');
    if (!container || !this.world) return [];
    const px = this.player?.position?.x ?? this.spawn.x;
    const pz = this.player?.position?.z ?? this.spawn.z;
    const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    const directionOf = (x, z) => {
      const angle = Math.atan2(x - px, -(z - pz));
      const index = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
      return directions[index];
    };
    const points = [];
    if (this.world.caveEntrance) {
      points.push({
        icon: '⛏',
        label: '洞穴入口',
        x: this.world.caveEntrance.x,
        z: this.world.caveEntrance.z,
      });
    }
    for (const mine of this.world.mineshafts || []) {
      const point = mine.entrance || mine;
      points.push({ icon: '🪜', label: '废弃矿井', x: point.x, z: point.z });
    }
    const geodes = (this.world.geodes || []).slice().sort(
      (a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz),
    );
    if (geodes[0]) {
      points.push({ icon: '💎', label: '最近的紫水晶洞', x: geodes[0].x, z: geodes[0].z });
    }
    if (this.world.ruinedPortal) {
      points.push({
        icon: '🌀',
        label: '神秘传送门',
        x: this.world.ruinedPortal.x,
        z: this.world.ruinedPortal.z,
      });
    }
    if (this.world.techCity) {
      points.push({
        icon: '⚙',
        label: '美味科技城',
        x: this.world.techCity.x,
        z: this.world.techCity.z,
      });
    }
    for (const village of this.world.villageSpots || []) {
      points.push({ icon: '🏠', label: '村庄', x: village.x, z: village.z });
    }
    points.forEach((point) => {
      point.distance = Math.hypot(point.x - px, point.z - pz);
      point.direction = directionOf(point.x, point.z);
    });
    points.sort((a, b) => a.distance - b.distance);
    const shown = points.slice(0, 7);
    container.innerHTML = shown
      .map(
        (point, index) => `
        <div class="worldmap-place ${index === 0 ? 'is-nearest' : ''}">
          <span class="worldmap-place-icon" aria-hidden="true">${point.icon}</span>
          <span><b>${point.label}</b><small>${point.direction} · ${Math.max(1, Math.round(point.distance))} 格</small></span>
        </div>
      `,
      )
      .join('');
    return shown.map((point) => ({
      label: point.label,
      distance: Math.round(point.distance),
      direction: point.direction,
    }));
  }

  render() {
    if (!this.ctx) return null;
    this._buildBase();
    const ctx = this.ctx;
    const size = MAP_SIZE;
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.baseCanvas, 0, 0, size, size);

    // 淡淡的 100 格网格，帮助看清区域范围。
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    for (let offset = -400; offset <= 400; offset += 100) {
      const px = ((offset / MAP_RANGE) + 0.5) * size;
      const startX = ((offset - 400) / MAP_RANGE + 0.5) * size;
      const endX = ((offset + 400) / MAP_RANGE + 0.5) * size;
      const startZ = ((offset - 400) / MAP_RANGE + 0.5) * size;
      const endZ = ((offset + 400) / MAP_RANGE + 0.5) * size;
      ctx.beginPath();
      ctx.moveTo(px, startZ);
      ctx.lineTo(px, endZ);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(startX, pyOffset(offset));
      ctx.lineTo(endX, pyOffset(offset));
      ctx.stroke();
    }
    ctx.restore();

    // 重要地点用色点标记，避免在缩小地图上文字互相遮挡。
    const markers = [];
    const addMarker = (x, z, color, radius = 5, shape = 'circle') => {
      if (!this._inside(x, z)) return;
      const point = this._toPixel(x, z);
      markers.push({ ...point, color, radius, shape });
    };

    for (const village of this.world.villageSpots || []) {
      addMarker(village.x, village.z, '#ffd85e', 5);
    }
    if (this.world.caveEntrance) {
      addMarker(this.world.caveEntrance.x, this.world.caveEntrance.z, '#f7f2dd', 3.5);
    }
    for (const fall of this.world.waterfalls || []) {
      addMarker(fall.x, fall.z, '#7fe7ff', 6);
    }
    if (this.world.techCity) {
      addMarker(this.world.techCity.x, this.world.techCity.z, '#8fffe3', 8);
    }
    for (const geode of this.world.geodes || []) {
      addMarker(geode.x, geode.z, '#d79bff', 6);
    }
    if (this.world.ruinedPortal) {
      addMarker(this.world.ruinedPortal.x, this.world.ruinedPortal.z, '#d38bff', 7);
    }
    for (const mine of this.world.mineshafts || []) {
      const point = mine.entrance || mine;
      addMarker(point.x, point.z, '#c79a66', 5);
    }
    if (this.world.landmarkSpot) {
      addMarker(this.world.landmarkSpot.x, this.world.landmarkSpot.z, '#ffffff', 4);
    }
    const highest = this.baseStats?.highestMountain;
    if (highest && highest.height >= 20) {
      addMarker(highest.x, highest.z, '#e8eef3', 6, 'triangle');
    }

    // 洞口和矿洞也加短标签，走到附近更容易确认。
    const labelMarker = (x, z, text, color, offsetX = 8, offsetY = -12) => {
      if (!this._inside(x, z)) return;
      const point = this._toPixel(x, z);
      ctx.save();
      ctx.font = 'bold 10px "PingFang SC", "Microsoft YaHei", sans-serif';
      const textWidth = ctx.measureText(text).width;
      const lx = point.x + offsetX;
      const ly = point.y + offsetY;
      ctx.strokeStyle = 'rgba(20, 22, 24, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(lx + (offsetX < 0 ? textWidth + 4 : -4), ly + 7);
      ctx.stroke();
      ctx.fillStyle = 'rgba(20, 22, 24, 0.82)';
      ctx.fillRect(lx, ly, textWidth + 7, 14);
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, lx + 4, ly + 7);
      ctx.restore();
    };
    if (this.world.caveEntrance) {
      labelMarker(this.world.caveEntrance.x, this.world.caveEntrance.z, '洞穴入口', '#ffd85e', -10, -25);
    }
    for (const geode of this.world.geodes || []) {
      labelMarker(geode.x, geode.z, '紫水晶洞', '#d79bff', 10, -22);
    }
    if (this.world.ruinedPortal) {
      labelMarker(this.world.ruinedPortal.x, this.world.ruinedPortal.z, '神秘传送门', '#d38bff', -10, 18);
    }
    for (const mine of this.world.mineshafts || []) {
      const point = mine.entrance || mine;
      labelMarker(point.x, point.z, '废弃矿井', '#c79a66', 10, 16);
    }

    // 科技城单独加一个小名字，避免和青色瀑布点混在一起。
    if (this.world.techCity && this._inside(this.world.techCity.x, this.world.techCity.z)) {
      const point = this._toPixel(this.world.techCity.x, this.world.techCity.z);
      ctx.save();
      ctx.font = 'bold 11px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const label = '美味科技城';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(22, 58, 61, 0.9)';
      ctx.fillRect(point.x - textWidth / 2 - 4, point.y - 25, textWidth + 8, 16);
      ctx.fillStyle = '#bffff4';
      ctx.fillText(label, point.x, point.y - 10);
      ctx.restore();
    }

    for (const marker of markers) {
      ctx.save();
      ctx.translate(marker.x, marker.y);
      ctx.strokeStyle = 'rgba(35, 32, 49, 0.85)';
      ctx.lineWidth = 2;
      if (marker.shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(0, -marker.radius - 1);
        ctx.lineTo(marker.radius + 1, marker.radius);
        ctx.lineTo(-marker.radius - 1, marker.radius);
        ctx.closePath();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, marker.radius, 0, Math.PI * 2);
      }
      ctx.fillStyle = marker.color;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 玩家位置和朝向。
    const playerPoint = this._toPixel(this.player.position.x, this.player.position.z);
    const clampedX = Math.max(12, Math.min(size - 12, playerPoint.x));
    const clampedY = Math.max(12, Math.min(size - 12, playerPoint.y));
    ctx.save();
    ctx.translate(clampedX, clampedY);
    ctx.rotate(-this.player.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 5);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fillStyle = '#fffdf4';
    ctx.strokeStyle = '#34314b';
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(35, 34, 58, 0.82)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('你在这里', Math.min(size - 70, clampedX + 10), Math.max(16, clampedY - 8));

    // 边框、北向和比例说明。
    ctx.strokeStyle = 'rgba(58, 53, 82, 0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, size - 4, size - 4);
    ctx.fillStyle = 'rgba(35, 34, 58, 0.78)';
    ctx.textAlign = 'center';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('范围约 900 × 900 格', size - 14, size - 28);

    const places = this._renderPlaces();

    this.lastStats = {
      markers: markers.length,
      places,
      highestMountain: highest,
      range: MAP_RANGE,
      resolution: MAP_RESOLUTION,
    };
    return this.lastStats;
  }

  dispose() {
    this.ctx = null;
    this.canvas = null;
    this.baseCanvas = null;
  }
}

function pyOffset(offset) {
  return ((offset / MAP_RANGE) + 0.5) * MAP_SIZE;
}
