/**
 * 天空、太阳、月亮、星星、云朵和昼夜颜色。
 * 天气功能会在后续阶段接到这个环境系统上。
 */

import * as THREE from 'three';
import { DEFAULT_VISUAL_THEME_ID, getVisualTheme } from './visual-themes.js';

const DAY_TOP = new THREE.Color('#3f9ee8');
const DAY_HORIZON = new THREE.Color('#c8f1ff');
const NIGHT_TOP = new THREE.Color('#0b173c');
const NIGHT_HORIZON = new THREE.Color('#263c66');
const SUNSET_TOP = new THREE.Color('#6c7ccc');
const SUNSET_HORIZON = new THREE.Color('#ffb07f');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(min, max, value) {
  const x = clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
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

export class Environment {
  constructor({ scene, spawn, seed = 20261028, theme = null }) {
    this.scene = scene;
    this.seed = seed;
    this.spawn = spawn;
    this.timeMinutes = 9 * 60 + 20;
    this.minutesPerSecond = 1.5;
    this.weather = 'sunny';
    this.weatherLabel = '晴天';
    this.weatherEmoji = '☀️';

    this._dayFactor = 1;
    this._sunsetFactor = 0;

    this.skyUniforms = {
      topColor: { value: DAY_TOP.clone() },
      horizonColor: { value: DAY_HORIZON.clone() },
    };
    this._sky = this._createSky();
    this.scene.add(this._sky);

    this.stars = this._createStars();
    this.scene.add(this.stars);

    this.sunGroup = this._createCelestialBody('#fff2a0', 8, 44);
    this.moonGroup = this._createCelestialBody('#f2f3e4', 5.5, 30);
    this.scene.add(this.sunGroup, this.moonGroup);

    this.cloudGroup = this._createClouds();
    this.scene.add(this.cloudGroup);

    this.weatherEffects = this._createWeatherEffects();
    this.scene.add(this.weatherEffects.group);
    this._weatherElapsed = 0;
    this.setWeather('sunny');

    this.motes = this._createAmbientMotes();
    this.scene.add(this.motes.points);

    this.hemiLight = new THREE.HemisphereLight('#c7ecff', '#6f8859', 0.92);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight('#dcecff', 0.24);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight('#fff2d2', 1.35);
    this.sunLight.position.set(55, 90, 30);
    this.scene.add(this.sunLight);

    this.scene.fog = new THREE.Fog(DAY_HORIZON.clone(), 42, 96);
    this.setTheme(theme || getVisualTheme(DEFAULT_VISUAL_THEME_ID));
  }

  setTheme(theme) {
    this.theme = theme || getVisualTheme(DEFAULT_VISUAL_THEME_ID);
    const env = this.theme.environment || {};
    const make = (value, fallback) => new THREE.Color(value || fallback);
    this.themeColors = {
      dayTop: make(env.dayTop, DAY_TOP),
      dayHorizon: make(env.dayHorizon, DAY_HORIZON),
      nightTop: make(env.nightTop, NIGHT_TOP),
      nightHorizon: make(env.nightHorizon, NIGHT_HORIZON),
      sunsetTop: make(env.sunsetTop, SUNSET_TOP),
      sunsetHorizon: make(env.sunsetHorizon, SUNSET_HORIZON),
    };
    this.hemiLight.color.set(env.hemiSky || '#c7ecff');
    this.hemiLight.groundColor.set(env.hemiGround || '#6f8859');
    this.ambientLight.color.set(env.ambient || '#dcecff');
    this.sunLight.color.set(env.sun || '#fff2d2');
    if (this.motes) this.motes.material.color.set(env.moteColor || '#fff0a8');
    if (this.scene.fog) {
      this.scene.fog.near = Number(env.fogNear) || 42;
      this.scene.fog.far = Number(env.fogFar) || 96;
    }
    this._updateCelestialBodies();
  }

  getTheme() {
    return this.theme;
  }

  _createSky() {
    const geometry = new THREE.SphereGeometry(280, 28, 18);
    const material = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vSkyPosition;
        void main() {
          vSkyPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        varying vec3 vSkyPosition;
        void main() {
          float h = normalize(vSkyPosition).y;
          float blend = smoothstep(-0.08, 0.62, h);
          vec3 color = mix(horizonColor, topColor, blend);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'sky-dome';
    mesh.renderOrder = -1000;
    mesh.frustumCulled = false;
    return mesh;
  }

  _createStars() {
    const random = makeRandom(this.seed ^ 0x5f3759df);
    const count = 760;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(0.02 + random() * 0.9);
      const radius = 245;
      const x = Math.sin(phi) * Math.cos(theta) * radius;
      const y = Math.cos(phi) * radius * 0.95 + 10;
      const z = Math.sin(phi) * Math.sin(theta) * radius;
      positions[i * 3] = x;
      positions[i * 3 + 1] = Math.max(12, y);
      positions[i * 3 + 2] = z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: '#fffdf0',
      size: 1.6,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    const points = new THREE.Points(geometry, material);
    points.name = 'stars';
    points.renderOrder = -999;
    points.frustumCulled = false;
    return points;
  }

  _createCelestialBody(color, radius, glowSize) {
    const group = new THREE.Group();
    const bodyMaterial = new THREE.MeshBasicMaterial({ color, fog: false });
    const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), bodyMaterial);
    group.add(body);

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const ctx = glowCanvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 250, 194, 0.9)');
    gradient.addColorStop(0.3, 'rgba(255, 238, 145, 0.38)');
    gradient.addColorStop(1, 'rgba(255, 238, 145, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.setScalar(glowSize * 2.8);
    group.add(glow);
    group.userData.glowMaterial = glowMaterial;
    group.userData.bodyMaterial = bodyMaterial;
    group.userData.glowTexture = glowTexture;
    return group;
  }

  _createAmbientMotes() {
    const random = makeRandom(this.seed ^ 0x51a7c3);
    const count = 90;
    const positions = new Float32Array(count * 3);
    const motes = [];
    for (let i = 0; i < count; i += 1) {
      const mote = {
        x: (random() - 0.5) * 34,
        y: 1 + random() * 10,
        z: (random() - 0.5) * 34,
        phase: random() * Math.PI * 2,
        speed: 0.25 + random() * 0.55,
      };
      motes.push(mote);
      positions[i * 3] = mote.x;
      positions[i * 3 + 1] = mote.y;
      positions[i * 3 + 2] = mote.z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: '#fff0a8',
      size: 0.09,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      fog: true,
    });
    const points = new THREE.Points(geometry, material);
    points.name = 'ambient-motes';
    points.frustumCulled = false;
    return { points, material, geometry, positions, motes };
  }

  _updateAmbientMotes(delta, camera) {
    if (!this.motes || !camera) return;
    const range = 20;
    for (let i = 0; i < this.motes.motes.length; i += 1) {
      const mote = this.motes.motes[i];
      mote.phase += delta * mote.speed;
      mote.x += Math.cos(mote.phase * 0.7) * delta * 0.08;
      mote.z += Math.sin(mote.phase * 0.6) * delta * 0.08;
      if (mote.x - camera.position.x > range) mote.x -= range * 2;
      if (mote.x - camera.position.x < -range) mote.x += range * 2;
      if (mote.z - camera.position.z > range) mote.z -= range * 2;
      if (mote.z - camera.position.z < -range) mote.z += range * 2;
      const i3 = i * 3;
      this.motes.positions[i3] = mote.x;
      this.motes.positions[i3 + 1] = mote.y + Math.sin(mote.phase) * 0.3;
      this.motes.positions[i3 + 2] = mote.z;
    }
    this.motes.geometry.attributes.position.needsUpdate = true;
  }

  _createWeatherEffects() {
    const group = new THREE.Group();
    group.name = 'weather-effects';
    const random = makeRandom(this.seed ^ 0x7a11d4);

    // 雨：一根根短短的小线，围在玩家身边落下。
    const rainCount = 430;
    const rainPositions = new Float32Array(rainCount * 2 * 3);
    const rainDrops = [];
    for (let i = 0; i < rainCount; i += 1) {
      const drop = {
        x: (random() - 0.5) * 38,
        y: random() * 24 - 4,
        z: (random() - 0.5) * 38,
        length: 0.45 + random() * 0.7,
        speed: 15 + random() * 12,
      };
      rainDrops.push(drop);
      this._writeRainDrop(rainPositions, i, drop);
    }
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMaterial = new THREE.LineBasicMaterial({
      color: '#d9f3ff',
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      fog: false,
    });
    const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
    rain.name = 'rain';
    rain.frustumCulled = false;
    group.add(rain);

    // 雪：慢慢飘的小白点。
    const snowCount = 430;
    const snowPositions = new Float32Array(snowCount * 3);
    const snowFlakes = [];
    for (let i = 0; i < snowCount; i += 1) {
      const flake = {
        x: (random() - 0.5) * 34,
        y: random() * 22 - 3,
        z: (random() - 0.5) * 34,
        speed: 0.8 + random() * 1.3,
        phase: random() * Math.PI * 2,
      };
      snowFlakes.push(flake);
      snowPositions[i * 3] = flake.x;
      snowPositions[i * 3 + 1] = flake.y;
      snowPositions[i * 3 + 2] = flake.z;
    }
    const snowGeometry = new THREE.BufferGeometry();
    snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    const snowMaterial = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.16,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false,
    });
    const snow = new THREE.Points(snowGeometry, snowMaterial);
    snow.name = 'snow';
    snow.frustumCulled = false;
    group.add(snow);

    return {
      group,
      rain,
      rainDrops,
      rainPositions,
      snow,
      snowFlakes,
      snowPositions,
    };
  }

  _writeRainDrop(positions, index, drop) {
    const offset = index * 6;
    positions[offset] = drop.x;
    positions[offset + 1] = drop.y;
    positions[offset + 2] = drop.z;
    positions[offset + 3] = drop.x;
    positions[offset + 4] = drop.y - drop.length;
    positions[offset + 5] = drop.z;
  }

  _updateWeather(delta, camera) {
    this._weatherElapsed += delta;
    if (!camera) return;
    this.weatherEffects.group.position.copy(camera.position);

    if (this.weather === 'rain') {
      const { rainPositions, rainDrops, rain } = this.weatherEffects;
      for (let i = 0; i < rainDrops.length; i += 1) {
        const drop = rainDrops[i];
        drop.y -= drop.speed * delta;
        if (drop.y < -6) {
          drop.y += 24;
          drop.x = (Math.random() - 0.5) * 38;
          drop.z = (Math.random() - 0.5) * 38;
        }
        this._writeRainDrop(rainPositions, i, drop);
      }
      rain.geometry.attributes.position.needsUpdate = true;
    } else if (this.weather === 'snow') {
      const { snowPositions, snowFlakes, snow } = this.weatherEffects;
      for (let i = 0; i < snowFlakes.length; i += 1) {
        const flake = snowFlakes[i];
        flake.y -= flake.speed * delta;
        flake.x += Math.sin(this._weatherElapsed * 0.9 + flake.phase) * delta * 0.22;
        if (flake.y < -4) {
          flake.y += 22;
          flake.x = (Math.random() - 0.5) * 34;
          flake.z = (Math.random() - 0.5) * 34;
        }
        snowPositions[i * 3] = flake.x;
        snowPositions[i * 3 + 1] = flake.y;
        snowPositions[i * 3 + 2] = flake.z;
      }
      snow.geometry.attributes.position.needsUpdate = true;
    }
  }

  _createClouds() {
    const group = new THREE.Group();
    group.name = 'clouds';
    const random = makeRandom(this.seed + 77);
    const material = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.94,
      fog: false,
    });
    this.cloudMaterial = material;

    for (let i = 0; i < 11; i += 1) {
      const cloud = new THREE.Group();
      const pieces = 3 + Math.floor(random() * 3);
      for (let j = 0; j < pieces; j += 1) {
        const width = 3 + random() * 4.5;
        const height = 1.1 + random() * 1.2;
        const depth = 2 + random() * 2.2;
        const part = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
        part.position.set(j * 2.4 - pieces * 1.1, random() * 1.2, (random() - 0.5) * 1.5);
        cloud.add(part);
      }
      cloud.position.set(
        this.spawn.x + (random() - 0.5) * 140,
        25 + random() * 12,
        this.spawn.z + (random() - 0.6) * 130,
      );
      cloud.scale.setScalar(0.8 + random() * 0.8);
      cloud.userData.baseX = cloud.position.x;
      cloud.userData.speed = 0.55 + random() * 0.6;
      cloud.userData.wrapRadius = 84;
      group.add(cloud);
    }

    return group;
  }

  update(delta, camera) {
    this.timeMinutes = (this.timeMinutes + delta * this.minutesPerSecond) % (24 * 60);
    this._updateCelestialBodies();

    if (camera) {
      this._sky.position.copy(camera.position);
      this.stars.position.copy(camera.position);
    }

    for (const cloud of this.cloudGroup.children) {
      cloud.position.x += delta * cloud.userData.speed;
      const offset = cloud.position.x - this.spawn.x;
      if (offset > cloud.userData.wrapRadius) {
        cloud.position.x = this.spawn.x - cloud.userData.wrapRadius;
      }
    }

    this._updateWeather(delta, camera);
    this._updateAmbientMotes(delta, camera);
    if (this.motes) {
      this.motes.material.opacity = 0.16 + (1 - this._dayFactor) * 0.34;
    }
  }

  _updateCelestialBodies() {
    const hour = this.timeMinutes / 60;
    const theta = ((hour - 6) / 12) * Math.PI;
    const sunHeight = Math.sin(theta);
    const dayFactor = smoothstep(-0.16, 0.26, sunHeight);
    const sunsetFactor = Math.max(0, 1 - Math.abs(sunHeight) / 0.3);
    this._dayFactor = dayFactor;
    this._sunsetFactor = sunsetFactor;

    const sunX = Math.cos(theta) * 180;
    const sunY = sunHeight * 150;
    const sunZ = -78;
    this.sunGroup.position.set(sunX, sunY, sunZ);
    this.moonGroup.position.set(-sunX, -sunY, -88);
    this.sunGroup.visible = sunY > -18;
    this.moonGroup.visible = -sunY > -18;

    const themeColors = this.themeColors || {
      dayTop: DAY_TOP,
      dayHorizon: DAY_HORIZON,
      nightTop: NIGHT_TOP,
      nightHorizon: NIGHT_HORIZON,
      sunsetTop: SUNSET_TOP,
      sunsetHorizon: SUNSET_HORIZON,
    };
    const topColor = this.skyUniforms.topColor.value;
    const horizonColor = this.skyUniforms.horizonColor.value;
    topColor
      .copy(themeColors.nightTop)
      .lerp(themeColors.dayTop, dayFactor)
      .lerp(themeColors.sunsetTop, sunsetFactor * 0.22);
    horizonColor
      .copy(themeColors.nightHorizon)
      .lerp(themeColors.dayHorizon, dayFactor)
      .lerp(themeColors.sunsetHorizon, sunsetFactor * 0.72);

    if (this.weather === 'rain') {
      topColor.lerp(new THREE.Color('#627b90'), 0.42);
      horizonColor.lerp(new THREE.Color('#afc1ce'), 0.34);
    } else if (this.weather === 'snow') {
      topColor.lerp(new THREE.Color('#8fc5e8'), 0.12);
      horizonColor.lerp(new THREE.Color('#eef9ff'), 0.2);
    }

    if (this.scene.fog) {
      this.scene.fog.color.copy(horizonColor);
    }

    const env = this.theme?.environment || {};
    const sunBase = new THREE.Color(env.sun || '#fff2d2');
    const sunLightColor = sunBase.lerp(new THREE.Color('#ffb27b'), sunsetFactor * 0.55);
    this.sunLight.color.copy(sunLightColor);
    const weatherLightFactor = this.weather === 'rain' ? 0.58 : this.weather === 'snow' ? 0.84 : 1;
    this.sunLight.intensity = (0.06 + dayFactor * 1.28) * weatherLightFactor * (Number(env.sunScale) || 1);
    this.sunLight.position.set(sunX * 0.42, Math.max(12, sunY) * 0.52, sunZ * 0.42);

    this.hemiLight.intensity = (0.3 + dayFactor * 0.72) * (this.weather === 'rain' ? 0.82 : 1) * (Number(env.hemiScale) || 1);
    this.ambientLight.intensity = (0.13 + dayFactor * 0.2) * (this.weather === 'rain' ? 0.9 : 1) * (Number(env.ambientScale) || 1);

    this.cloudMaterial.color.copy(new THREE.Color('#aab9d8')).lerp(new THREE.Color('#ffffff'), dayFactor);
    if (this.weather === 'rain') this.cloudMaterial.color.lerp(new THREE.Color('#8d99a6'), 0.48);
    if (this.weather === 'snow') this.cloudMaterial.color.lerp(new THREE.Color('#f4fbff'), 0.2);
    this.cloudMaterial.opacity = 0.72 + dayFactor * 0.22;

    const starOpacity = clamp(1 - dayFactor * 1.6, 0, 1);
    this.stars.material.opacity = starOpacity * 0.92;
    this.stars.visible = starOpacity > 0.02;

    const sunGlow = this.sunGroup.userData.glowMaterial;
    if (sunGlow) sunGlow.opacity = 0.45 + dayFactor * 0.45;
    const moonGlow = this.moonGroup.userData.glowMaterial;
    if (moonGlow) moonGlow.opacity = 0.38 + (1 - dayFactor) * 0.4;
  }

  setWeather(type) {
    const next = type === 'rain' || type === 'snow' ? type : 'sunny';
    this.weather = next;
    if (next === 'rain') {
      this.weatherLabel = '下雨';
      this.weatherEmoji = '🌧️';
    } else if (next === 'snow') {
      this.weatherLabel = '下雪';
      this.weatherEmoji = '❄️';
    } else {
      this.weatherLabel = '晴天';
      this.weatherEmoji = '☀️';
    }
    this.weatherEffects.rain.visible = next === 'rain';
    this.weatherEffects.snow.visible = next === 'snow';
    if (this.sunLight) this._updateCelestialBodies();
    return {
      weather: next,
      label: this.weatherLabel,
      emoji: this.weatherEmoji,
    };
  }

  cycleWeather() {
    const order = ['sunny', 'rain', 'snow'];
    const index = order.indexOf(this.weather);
    return this.setWeather(order[(index + 1) % order.length]);
  }

  getWeather() {
    return {
      weather: this.weather,
      label: this.weatherLabel,
      emoji: this.weatherEmoji,
    };
  }

  setTimeMinutes(minutes) {
    if (!Number.isFinite(minutes)) return;
    this.timeMinutes = ((minutes % 1440) + 1440) % 1440;
    this._updateCelestialBodies();
  }

  getTimeString() {
    const total = Math.floor(this.timeMinutes) % (24 * 60);
    const hours = String(Math.floor(total / 60)).padStart(2, '0');
    const minutes = String(total % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  getTimeState() {
    return {
      time: this.getTimeString(),
      weather: this.weatherLabel,
      weatherEmoji: this.weatherEmoji,
    };
  }

  dispose() {
    this.scene.remove(this._sky, this.stars, this.sunGroup, this.moonGroup, this.cloudGroup);
    this.scene.remove(this.weatherEffects.group);
    this.scene.remove(this.hemiLight, this.ambientLight, this.sunLight);
    if (this.scene.fog) this.scene.fog = null;

    this._sky.geometry.dispose();
    this._sky.material.dispose();
    this.stars.geometry.dispose();
    this.stars.material.dispose();

    for (const group of [this.sunGroup, this.moonGroup]) {
      group.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
      });
      group.userData.glowTexture?.dispose();
    }

    this.cloudGroup.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
    });
    this.cloudMaterial.dispose();
    this.weatherEffects.rain.geometry.dispose();
    this.weatherEffects.rain.material.dispose();
    this.weatherEffects.snow.geometry.dispose();
    this.weatherEffects.snow.material.dispose();
    this.scene.remove(this.motes.points);
    this.motes.geometry.dispose();
    this.motes.material.dispose();
  }
}
