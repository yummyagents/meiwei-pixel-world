/**
 * 云上科技城：浮空岛、玻璃穹顶、霓虹桥和瀑布。
 * 这里用轻量场景几何 + 平台碰撞，不生成整张体素地图。
 */

import * as THREE from 'three';
import { BLOCK_IDS } from './blocks.js';

const TOP = 10;

export class SkyCityRealm {
  constructor({ scene }) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'sky-city';
    this.group.visible = false;
    this.scene.add(this.group);
    this.time = 0;
    this.clouds = [];
    this.rings = [];
    this.waterfalls = [];
    this.spawn = { x: 0, y: TOP + 1.02, z: 24 };
    this.returnPortal = { x: 0, y: TOP + 1.02, z: -7 };
    this.biome = { emoji: '☁️', name: '云上科技城' };
    this.platforms = [
      { x: 0, z: 0, r: 13, top: TOP, main: true },
      { x: -28, z: 0, r: 6.5, top: 11 },
      { x: 28, z: 0, r: 7, top: 12 },
      { x: 0, z: -28, r: 6, top: 12 },
      { x: 0, z: 28, r: 6.5, top: 11 },
    ];
    this.bridges = [
      { axis: 'x', from: -28, to: 0, z: 0, top: TOP },
      { axis: 'x', from: 0, to: 28, z: 0, top: TOP },
      { axis: 'z', from: -28, to: 0, x: 0, top: TOP },
      { axis: 'z', from: 0, to: 28, x: 0, top: TOP },
    ];
    this._materials = {
      grass: new THREE.MeshStandardMaterial({ color: '#69c96f', roughness: 0.9 }),
      grassSide: new THREE.MeshStandardMaterial({ color: '#5a9c56', roughness: 0.95 }),
      stone: new THREE.MeshStandardMaterial({ color: '#6a7181', roughness: 0.85 }),
      darkStone: new THREE.MeshStandardMaterial({ color: '#3b4252', roughness: 0.8 }),
      dirt: new THREE.MeshStandardMaterial({ color: '#7b5b47', roughness: 1 }),
      white: new THREE.MeshStandardMaterial({ color: '#eaf7ff', roughness: 0.45, metalness: 0.15 }),
      silver: new THREE.MeshStandardMaterial({ color: '#aebccb', roughness: 0.35, metalness: 0.65 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#9fe9ff',
        transparent: true,
        opacity: 0.18,
        roughness: 0.08,
        metalness: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      cyan: new THREE.MeshStandardMaterial({ color: '#63f6ff', emissive: '#13b5d1', emissiveIntensity: 2.2 }),
      magenta: new THREE.MeshStandardMaterial({ color: '#ff8be8', emissive: '#c324a7', emissiveIntensity: 2 }),
      gold: new THREE.MeshStandardMaterial({ color: '#ffd76e', emissive: '#b87413', emissiveIntensity: 0.8 }),
      water: new THREE.MeshStandardMaterial({
        color: '#79dcff',
        transparent: true,
        opacity: 0.65,
        roughness: 0.15,
        metalness: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      leaf: new THREE.MeshStandardMaterial({ color: '#6fbf65', roughness: 0.85 }),
      trunk: new THREE.MeshStandardMaterial({ color: '#6c4a35', roughness: 0.9 }),
      cloud: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.72,
        roughness: 1,
        depthWrite: false,
      }),
      floor: new THREE.MeshStandardMaterial({ color: '#22394d', roughness: 0.38, metalness: 0.4 }),
      wood: new THREE.MeshStandardMaterial({ color: '#b56d3e', roughness: 0.7 }),
      orange: new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#a84e12', emissiveIntensity: 0.8 }),
      screen: new THREE.MeshBasicMaterial({ color: '#66e8ff', transparent: true, opacity: 0.95 }),
      beam: new THREE.MeshBasicMaterial({
        color: '#73f2ff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
      beamCore: new THREE.MeshBasicMaterial({
        color: '#e8ffff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    };
    this._buildSky();
    this._buildLights();
    this._buildIslands();
    this._buildCity();
    this._buildInterior();
    this._buildRingIsland();
    this._buildClouds();
    this._buildReturnGate();
  }

  _add(mesh) { this.group.add(mesh); return mesh; }

  _buildSky() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#153a6b');
    g.addColorStop(0.36, '#4f9bd2');
    g.addColorStop(0.62, '#ffc17b');
    g.addColorStop(0.78, '#ffd9a8');
    g.addColorStop(1, '#7ab8e6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 46; i += 1) {
      const x = (i * 137) % 1024;
      const y = 55 + (i * 71) % 230;
      ctx.fillRect(x, y, 4 + (i % 4) * 3, 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.background = texture;
  }

  _buildLights() {
    const ambient = new THREE.AmbientLight('#dff6ff', 1.25);
    const hemi = new THREE.HemisphereLight('#eafaff', '#8bbad2', 1.1);
    const sun = new THREE.DirectionalLight('#fff1cc', 2.1);
    sun.position.set(42, 58, 24);
    this.group.add(ambient, hemi, sun);
    const sunBall = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 24, 16),
      new THREE.MeshBasicMaterial({ color: '#fff6d2' }),
    );
    sunBall.position.set(55, 56, -45);
    this.group.add(sunBall);
    const glow = new THREE.PointLight('#61f3ff', 2.4, 34, 2);
    glow.position.set(0, 18, 0);
    this.group.add(glow);
  }

  _box(w, h, d, material, x, y, z, group = this.group) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  _cylinder(rt, rb, h, material, x, y, z, segments = 28, group = this.group) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  _buildIslands() {
    const m = this._materials;
    for (const p of this.platforms) {
      const top = p.top;
      this._cylinder(p.r, p.r * 0.96, 1.1, m.grass, p.x, top - 0.55, p.z, 32);
      this._cylinder(p.r * 0.95, p.r * 0.9, 1.4, m.grassSide, p.x, top - 1.7, p.z, 32);
      this._cylinder(p.r * 0.88, p.r * 0.32, 4.8, m.stone, p.x, top - 4.6, p.z, 24);
      // 底部悬挂的碎岩，让浮空岛更自然。
      for (let i = 0; i < 7; i += 1) {
        const angle = (i / 7) * Math.PI * 2 + p.x;
        const rr = p.r * (0.2 + (i % 3) * 0.1);
        this._box(0.8 + (i % 2) * 0.5, 1.2 + (i % 3) * 0.5, 0.8, m.darkStone,
          p.x + Math.cos(angle) * p.r * 0.55, top - 7.2 - (i % 3) * 0.7, p.z + Math.sin(angle) * p.r * 0.55);
      }
      // 岛上小树。
      if (!p.main && p.r > 5.5) {
        this._cylinder(0.22, 0.32, 3.2, m.trunk, p.x + 1.7, top + 1.6, p.z - 1.2, 8);
        this._box(2.5, 2, 2.5, m.leaf, p.x + 1.7, top + 3.2, p.z - 1.2);
        this._box(1.3, 1.2, 1.3, m.leaf, p.x + 0.5, top + 3.8, p.z - 0.8);
      }
      // 小岛边缘的发光环。
      if (!p.main) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r * 0.82, 0.12, 8, 40), m.cyan);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(p.x, top + 0.12, p.z);
        this._add(ring);
        this.rings.push(ring);
      }
    }
    // 桥面。
    for (const b of this.bridges) {
      if (b.axis === 'x') {
        const len = Math.abs(b.to - b.from);
        this._box(len, 0.4, 2.8, m.white, (b.from + b.to) / 2, b.top - 0.2, b.z);
        this._box(len, 0.18, 0.12, m.cyan, (b.from + b.to) / 2, b.top + 0.06, b.z + 1.0);
        this._box(len, 0.18, 0.12, m.magenta, (b.from + b.to) / 2, b.top + 0.06, b.z - 1.0);
        for (let x = Math.min(b.from, b.to) + 2; x < Math.max(b.from, b.to); x += 4) {
          this._box(0.14, 1.1, 0.14, m.silver, x, b.top + 0.5, b.z);
        }
      } else {
        const len = Math.abs(b.to - b.from);
        this._box(2.8, 0.4, len, m.white, b.x, b.top - 0.2, (b.from + b.to) / 2);
        this._box(0.12, 0.18, len, m.cyan, b.x + 1.0, b.top + 0.06, (b.from + b.to) / 2);
        this._box(0.12, 0.18, len, m.magenta, b.x - 1.0, b.top + 0.06, (b.from + b.to) / 2);
      }
    }
  }

  _buildCity() {
    const m = this._materials;
    // 玻璃穹顶。
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(11.5, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      m.glass,
    );
    dome.position.set(0, TOP, 0);
    this._add(dome);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.SphereGeometry(11.52, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
      new THREE.LineBasicMaterial({ color: '#a8f6ff', transparent: true, opacity: 0.35 }),
    );
    wire.position.set(0, TOP, 0);
    this._add(wire);

    // 穹顶内的中央能源塔。
    this._cylinder(2.4, 3.4, 2.2, m.silver, 0, TOP + 1.1, 0, 24);
    // 穹顶内部只保留一根细的能量塔芯，让中央光柱和全息屏成为主角。
    this._cylinder(0.32, 0.55, 16, m.silver, 0, TOP + 10, 0, 16);
    for (let y = TOP + 3; y <= TOP + 14; y += 3) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.1, 8, 32), y % 2 === 0 ? m.cyan : m.magenta);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      this._add(ring);
      this.rings.push(ring);
    }
    this._cylinder(0.25, 0.8, 7, m.silver, 0, TOP + 20, 0, 12);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), m.cyan);
    orb.position.y = TOP + 23.7;
    this._add(orb);
    const towerLight = new THREE.PointLight('#7dfcff', 3, 28, 2);
    towerLight.position.set(0, TOP + 13, 0);
    this._add(towerLight);

    // 穹顶外的霓虹环。
    for (const [y, radius, material] of [[TOP + 13, 14, m.cyan], [TOP + 17, 10, m.magenta]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.18, 10, 80), material);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      this._add(ring);
      this.rings.push(ring);
    }

    // 中央广场的全息光环。
    const floorRing = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.12, 8, 64), m.cyan);
    floorRing.rotation.x = Math.PI / 2;
    floorRing.position.y = TOP + 0.2;
    this._add(floorRing);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      this._box(0.35, 0.12, 3.6, m.cyan, Math.cos(angle) * 5.2, TOP + 0.18, Math.sin(angle) * 5.2).rotation.y = -angle;
    }

    // 玻璃温室管。
    for (const [x, z] of [[-7, 5], [7, 5], [-7, -5], [7, -5]]) {
      this._cylinder(1.2, 1.2, 7, m.glass, x, TOP + 3.5, z, 16);
      this._cylinder(0.9, 0.9, 6.2, m.grass, x, TOP + 3.2, z, 12);
      this._cylinder(1.35, 1.35, 0.25, m.cyan, x, TOP + 7.1, z, 16);
    }

    // 瀑布：从东、南两个浮空岛边缘落下。
    for (const [x, z, w] of [[21, 0, 3.4], [0, 22, 4.2], [-21, 0, 2.8]]) {
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(w, 24), m.water.clone());
      fall.position.set(x, TOP - 10, z + 1.2);
      fall.rotation.y = z === 0 ? Math.PI / 2 : 0;
      this._add(fall);
      this.waterfalls.push(fall);
    }

    // 小瀑布下的水花光点。
    const pointsGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 100; i += 1) {
      pts.push((Math.random() - 0.5) * 45, 4 + Math.random() * 22, (Math.random() - 0.5) * 45);
    }
    pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const points = new THREE.Points(pointsGeo, new THREE.PointsMaterial({
      color: '#8ff5ff', size: 0.18, transparent: true, opacity: 0.75, depthWrite: false,
    }));
    this._add(points);
  }

  _buildInterior() {
    const m = this._materials;
    // 科技地板覆盖中央草坪。
    this._cylinder(10.6, 10.6, 0.28, m.floor, 0, TOP + 0.06, 0, 48);
    for (const r of [4.2, 7.4, 10.1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.055, 6, 64), m.cyan);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = TOP + 0.23;
      this._add(ring);
    }
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      this._box(0.08, 0.01, 6.2, m.cyan, Math.cos(angle) * 6.4, TOP + 0.23, Math.sin(angle) * 6.4).rotation.y = -angle;
    }
    // 穹顶结构肋。
    for (let i = 0; i < 6; i += 1) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(11.5, 0.055, 5, 64, Math.PI),
        new THREE.MeshBasicMaterial({ color: '#d8fbff', transparent: true, opacity: 0.28 }),
      );
      arc.rotation.z = (i / 6) * Math.PI;
      arc.position.y = TOP;
      this._add(arc);
    }
    // 中央蓝色能量柱：外光柱 + 白色核心。
    this._cylinder(1.3, 1.6, 18, m.beam, 0, TOP + 9, 0, 24);
    this._cylinder(0.38, 0.52, 18, m.beamCore, 0, TOP + 9, 0, 16);
    const beamLight = new THREE.PointLight('#6df5ff', 3.4, 30, 2);
    beamLight.position.set(0, TOP + 7, 0);
    this._add(beamLight);
    const beamParticles = [];
    for (let i = 0; i < 90; i += 1) {
      beamParticles.push((Math.random() - 0.5) * 3.8, TOP + Math.random() * 18, (Math.random() - 0.5) * 3.8);
    }
    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(beamParticles, 3));
    const beamPoints = new THREE.Points(beamGeo, new THREE.PointsMaterial({
      color: '#c9ffff', size: 0.2, transparent: true, opacity: 0.85, depthWrite: false,
    }));
    this._add(beamPoints);
    this.beamPoints = beamPoints;

    // 全息地图屏。
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 512;
    screenCanvas.height = 256;
    const ctx = screenCanvas.getContext('2d');
    ctx.fillStyle = '#071c2d';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = 'rgba(90,235,255,0.3)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 512; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
    for (let y = 0; y < 256; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
    ctx.fillStyle = '#35d8e8';
    for (const [x, y, w, h] of [[60, 70, 95, 65], [180, 48, 120, 55], [310, 88, 125, 90], [225, 145, 55, 45], [390, 40, 60, 40]]) {
      ctx.fillRect(x, y, w, h);
    }
    ctx.fillStyle = '#07202b';
    for (const [x, y, w, h] of [[75, 84, 35, 25], [115, 100, 25, 17], [195, 65, 32, 20], [330, 105, 40, 35], [355, 122, 56, 28]]) {
      ctx.fillRect(x, y, w, h);
    }
    ctx.fillStyle = '#d6feff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('云上科技美食城 · 世界全息图', 26, 28);
    ctx.fillStyle = '#8ffaff';
    ctx.font = '13px sans-serif';
    ctx.fillText('CLOUD CITY  /  ONLINE', 372, 232);
    const screenTexture = new THREE.CanvasTexture(screenCanvas);
    screenTexture.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(10.5, 5.2),
      new THREE.MeshBasicMaterial({ map: screenTexture, side: THREE.DoubleSide }),
    );
    screen.position.set(0, TOP + 6.2, -10.4);
    this._add(screen);
    this._box(11.2, 0.2, 0.25, m.silver, 0, TOP + 3.55, -10.5);
    this._box(11.2, 0.2, 0.25, m.silver, 0, TOP + 8.85, -10.5);
    this._box(0.2, 5.5, 0.25, m.silver, -5.4, TOP + 6.2, -10.5);
    this._box(0.2, 5.5, 0.25, m.silver, 5.4, TOP + 6.2, -10.5);
    const screenLight = new THREE.PointLight('#4adfff', 2.0, 18, 2);
    screenLight.position.set(0, TOP + 7, -8.6);
    this._add(screenLight);

    // 左右两侧美食摊位。
    for (const side of [-1, 1]) {
      const x = side * 7.4;
      this._box(5.2, 0.35, 2.8, m.wood, x, TOP + 1.15, -1.8);
      this._box(5.2, 0.75, 0.35, m.orange, x, TOP + 1.55, -0.35);
      this._box(5.6, 0.18, 3.2, m.orange, x, TOP + 4.0, -1.8);
      this._box(0.16, 2.6, 0.16, m.silver, x - 2.4, TOP + 2.7, -3.0);
      this._box(0.16, 2.6, 0.16, m.silver, x + 2.4, TOP + 2.7, -3.0);
      this._box(0.16, 2.6, 0.16, m.silver, x - 2.4, TOP + 2.7, -0.6);
      this._box(0.16, 2.6, 0.16, m.silver, x + 2.4, TOP + 2.7, -0.6);
      const stallLight = new THREE.PointLight('#ffad54', 1.7, 10, 2);
      stallLight.position.set(x, TOP + 3.0, -1.2);
      this._add(stallLight);
      // 柜台上的食物小方块。
      for (const [ox, foodColor] of [[-1.2, '#ffd25a'], [0, '#f16a4f'], [1.2, '#ffe6a1']]) {
        this._box(0.65, 0.3, 0.65, new THREE.MeshStandardMaterial({ color: foodColor, emissive: foodColor, emissiveIntensity: 0.25 }), x + ox, TOP + 1.85, -1.9);
      }
      // 摊位招牌。
      this._box(3.4, 0.85, 0.12, m.screen, x, TOP + 3.2, -3.12);
    }

    // 霓虹广告牌和地面导视。
    for (const [x, z, color] of [[-4, -8, m.magenta], [4, -8, m.cyan], [-9, 4, m.cyan], [9, 4, m.magenta]]) {
      this._box(0.18, 3.4, 2.6, color, x, TOP + 2.2, z);
    }

    // 四座小食摊的暖光。
    this._box(4.5, 0.2, 0.2, m.cyan, 0, TOP + 8.6, -8.4);

    // 大厅里的游客小人。
    this.visitors = [];
    for (const [x, z, color] of [[-3.8, 3.2, '#ff8f5e'], [3.8, 2.4, '#7fdfff'], [0, -4.2, '#ffd36e'], [5.2, -5.2, '#d68cff']]) {
      const person = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      const skin = new THREE.MeshStandardMaterial({ color: '#c98a66', roughness: 0.9 });
      this._box(0.52, 0.72, 0.36, bodyMat, 0, 0.92, 0, person);
      this._box(0.42, 0.42, 0.4, skin, 0, 1.48, 0, person);
      this._box(0.12, 0.5, 0.12, skin, -0.34, 0.95, 0, person);
      this._box(0.12, 0.5, 0.12, skin, 0.34, 0.95, 0, person);
      this._box(0.16, 0.5, 0.16, m.darkStone, -0.14, 0.25, 0, person);
      this._box(0.16, 0.5, 0.16, m.darkStone, 0.14, 0.25, 0, person);
      person.position.set(x, TOP + 0.2, z);
      person.userData.phase = Math.random() * Math.PI * 2;
      this.group.add(person);
      this.visitors.push(person);
    }
  }

  _buildRingIsland() {
    const m = this._materials;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.9, 12, 64), m.white);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-38, 20, -8);
    this._add(ring);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.22, 10, 64), m.cyan);
    glow.rotation.x = Math.PI / 2;
    glow.position.set(-38, 20.8, -8);
    this._add(glow);
    this.rings.push(glow);
    this._cylinder(4.2, 4.2, 0.6, m.glass, -38, 20, -8, 32);
    // 右侧橙色六边形穹顶。
    const hex = new THREE.Mesh(
      new THREE.IcosahedronGeometry(4.2, 1),
      new THREE.MeshStandardMaterial({ color: '#ff9d36', emissive: '#c34d0a', emissiveIntensity: 0.9, transparent: true, opacity: 0.72 }),
    );
    hex.position.set(34, 23, -20);
    this._add(hex);
    const hexRing = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.12, 8, 48), m.orange);
    hexRing.position.set(34, 23, -20);
    this._add(hexRing);
    this.rings.push(hexRing);
  }

  _buildClouds() {
    const m = this._materials;
    for (let i = 0; i < 26; i += 1) {
      const angle = (i / 26) * Math.PI * 2;
      const radius = 26 + (i % 5) * 7;
      const cloud = new THREE.Group();
      for (let j = 0; j < 5; j += 1) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1.2 + (j % 3) * 0.6, 10, 8), m.cloud);
        puff.position.set((j - 2) * 1.5, (j % 2) * 0.35, (j % 3) * 0.5);
        puff.scale.set(1.8, 0.55, 1);
        cloud.add(puff);
      }
      cloud.position.set(Math.cos(angle) * radius, 0 + (i % 4) * 1.2, Math.sin(angle) * radius);
      cloud.userData.baseX = cloud.position.x;
      cloud.userData.baseZ = cloud.position.z;
      cloud.userData.phase = i * 0.37;
      this.group.add(cloud);
      this.clouds.push(cloud);
    }
  }

  _buildReturnGate() {
    const m = this._materials;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.18, 12, 48), m.cyan);
    ring.position.set(0, TOP + 2.7, -7);
    this._add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.1, 10, 48), m.magenta);
    ring2.position.set(0, TOP + 2.7, -7);
    this._add(ring2);
    this.rings.push(ring2);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 4.2),
      new THREE.MeshBasicMaterial({
        color: '#5cecff', transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false, fog: false,
      }),
    );
    plane.position.set(0, TOP + 2.8, -7);
    this._add(plane);
    const light = new THREE.PointLight('#68f5ff', 2.5, 18, 2);
    light.position.set(0, TOP + 3, -5.8);
    this._add(light);
    this.returnRing = ring;
  }

  /** 平台近似碰撞：中央岛、四座卫星岛和四条桥。 */
  getBlock(x, y, z) {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    for (const p of this.platforms) {
      if (Math.hypot(x - p.x, z - p.z) <= p.r && by <= p.top && by >= p.top - 6) {
        if (by === p.top) return BLOCK_IDS.GRASS;
        return BLOCK_IDS.STONE;
      }
    }
    for (const b of this.bridges) {
      if (b.axis === 'x' && Math.abs(z - b.z) <= 1.5 && x >= Math.min(b.from, b.to) - 1 && x <= Math.max(b.from, b.to) + 1) {
        if (by === b.top) return BLOCK_IDS.STONE_BRICKS;
      }
      if (b.axis === 'z' && Math.abs(x - b.x) <= 1.5 && z >= Math.min(b.from, b.to) - 1 && z <= Math.max(b.from, b.to) + 1) {
        if (by === b.top) return BLOCK_IDS.STONE_BRICKS;
      }
    }
    return BLOCK_IDS.AIR;
  }

  setBlock() { return false; }
  heightAt(x, z) {
    for (const p of this.platforms) if (Math.hypot(x - p.x, z - p.z) <= p.r) return p.top;
    return TOP;
  }
  getBiomeAt() { return this.biome; }
  biomeAt() { return 'sky'; }
  isInTechCity() { return false; }
  isBlockLoaded() { return true; }
  getLoadedChunkCount() { return 9; }
  getModifiedCount() { return 0; }
  renderDistance = 4;

  update(delta, playerPosition) {
    this.time += delta;
    for (const cloud of this.clouds) {
      cloud.position.x = cloud.userData.baseX + Math.sin(this.time * 0.035 + cloud.userData.phase) * 2.2;
      cloud.position.z = cloud.userData.baseZ + Math.cos(this.time * 0.03 + cloud.userData.phase) * 1.4;
    }
    for (let i = 0; i < this.rings.length; i += 1) {
      this.rings[i].rotation.z += delta * (i % 2 === 0 ? 0.12 : -0.16);
    }
    for (const fall of this.waterfalls) {
      fall.material.opacity = 0.55 + Math.sin(this.time * 2 + fall.position.x) * 0.08;
    }
    if (this.beamPoints) this.beamPoints.rotation.y += delta * 0.16;
    for (const visitor of this.visitors || []) {
      visitor.position.y = TOP + 0.2 + Math.sin(this.time * 1.6 + visitor.userData.phase) * 0.035;
      visitor.rotation.y += Math.sin(this.time * 0.4 + visitor.userData.phase) * delta * 0.2;
    }
    if (playerPosition && playerPosition.y < -8) {
      // 掉下云海时送回中央广场，小朋友不会卡在虚空里。
      return { respawn: true };
    }
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
  }
}
