/**
 * 溪谷书屋「三页书」：找书页、读故事、排顺序。
 * 书页是发光的小纸片，靠近会自动收进手账。
 */
import * as THREE from 'three';
import { isSolidBlock } from './blocks.js';

const PAGES = [
  {
    id: 1,
    title: '第一页 · 石缝里的水',
    text: '溪水从山上的石缝里醒来，先落进书屋下面的水潭。',
    icon: '💧',
    where: '下游水潭边',
    order: 1,
  },
  {
    id: 2,
    title: '第二页 · 玻璃上的水珠',
    text: '太阳把水潭晒暖，水汽升到玻璃屋顶，变成一颗颗小水珠。',
    icon: '☀️',
    where: '主厅挑台下方',
    order: 2,
  },
  {
    id: 3,
    title: '第三页 · 回到溪里',
    text: '水珠顺着屋檐回到溪里，书屋又听见了叮咚声。',
    icon: '🌧️',
    where: '屋顶杜鹃花箱旁',
    order: 3,
  },
];

export class LibraryQuest {
  constructor({ game, scene, ui, journal, library, callbacks = {} }) {
    this.game = game;
    this.scene = scene;
    this.ui = ui;
    this.journal = journal;
    this.library = library;
    this.callbacks = callbacks;
    this.pages = PAGES;
    this.found = new Set();
    this.completed = false;
    this.selected = [];
    this.groups = new Map();
    this.chip = document.getElementById('library-quest-chip');
    this.chipDetail = document.getElementById('library-quest-detail');
    this.overlay = document.getElementById('overlay-library');
    this.pagesEl = document.getElementById('library-pages');
    this.orderEl = document.getElementById('library-order-text');
    this.hintEl = document.getElementById('library-hint');
    this.leadEl = document.getElementById('library-lead');
    this._chipVisible = false;
    this._pageTimer = 0;
    this._bound = false;
    this._positions = this._buildPositions();
    this._buildVisuals();
    this._bindUi();
    this._updateChip();
  }

  _freeSpot(x, y, z) {
    for (let i = 0; i < 8; i += 1) {
      if (!isSolidBlock(this.game.world.getBlock(x, y + i, z))) return y + i;
    }
    return y + 8;
  }

  _buildPositions() {
    const lib = this.library;
    const y = lib.levels;
    return {
      1: { x: lib.x - 3.5, y: this._freeSpot(Math.floor(lib.x - 3.5), Math.floor(lib.groundY + 2), Math.floor(lib.z + 19)), z: lib.z + 19 },
      2: { x: lib.x + 7.5, y: this._freeSpot(Math.floor(lib.x + 7.5), Math.floor(y.lowerY + 2), Math.floor(lib.z + 6)), z: lib.z + 6 },
      3: { x: lib.x + 2.5, y: this._freeSpot(Math.floor(lib.x + 2.5), Math.floor(y.topY + 7), Math.floor(lib.z + 1)), z: lib.z + 1 },
    };
  }

  _glowTexture() {
    if (this._glow) return this._glow;
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(255, 244, 174, .95)');
    gradient.addColorStop(.4, 'rgba(255, 205, 94, .45)');
    gradient.addColorStop(1, 'rgba(255, 180, 50, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    this._glow = new THREE.CanvasTexture(canvas);
    this._glow.colorSpace = THREE.SRGBColorSpace;
    return this._glow;
  }

  _buildVisuals() {
    for (const page of this.pages) {
      if (this.found.has(page.id)) continue;
      const group = new THREE.Group();
      group.name = `library-page-${page.id}`;
      const paper = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.72, 0.045),
        new THREE.MeshBasicMaterial({ color: '#fff2b8' }),
      );
      paper.rotation.z = -0.12;
      group.add(paper);
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.035, 0.05),
        new THREE.MeshBasicMaterial({ color: '#b38b55' }),
      );
      line.position.set(0, 0.12, 0.03);
      group.add(line);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this._glowTexture(), transparent: true, depthWrite: false, opacity: 0.9,
      }));
      glow.scale.set(1.8, 1.8, 1);
      group.add(glow);
      const pos = this._positions[page.id];
      group.position.set(pos.x, pos.y + 0.4, pos.z);
      group.userData.baseY = pos.y + 0.4;
      group.userData.phase = page.id * 1.7;
      group.userData.pageId = page.id;
      this.scene.add(group);
      this.groups.set(page.id, group);
    }
  }

  _bindUi() {
    if (this._bound) return;
    this._bound = true;
    const close = () => this.closePuzzle();
    document.getElementById('btn-library-close')?.addEventListener('click', close);
    document.getElementById('btn-library-close-2')?.addEventListener('click', close);
    document.getElementById('btn-library-reset')?.addEventListener('click', () => this._resetSelection());
    this.overlay?.addEventListener('click', (event) => { if (event.target === this.overlay) this.closePuzzle(); });
    this.pagesEl?.addEventListener('click', (event) => {
      const card = event.target.closest('[data-page-order]');
      if (!card || this.completed) return;
      this._pick(Number(card.dataset.pageOrder));
    });
  }

  _pick(order) {
    if (this.completed || this.selected.includes(order)) return;
    this.selected.push(order);
    this._renderCards();
    const expected = this.selected.map((_, index) => index + 1);
    if (this.selected.some((value, index) => value !== expected[index])) {
      this._setHint('这一页好像还不是现在。再读一读，找找哪一页在讲开头。', 'bad');
      window.setTimeout(() => this._resetSelection(false), 760);
      return;
    }
    if (this.selected.length === 3) this._complete();
    else this._setHint('对啦，接着找下一页。', 'good');
  }

  _setHint(text, tone = '') {
    if (!this.hintEl) return;
    this.hintEl.textContent = text;
    this.hintEl.className = `library-hint${tone ? ` is-${tone}` : ''}`;
  }

  _resetSelection(announce = true) {
    this.selected = [];
    this._renderCards();
    if (announce) this._setHint('没关系，重新从开头读一遍。', '');
  }

  _renderCards() {
    if (!this.pagesEl) return;
    const display = [this.pages[1], this.pages[2], this.pages[0]];
    this.pagesEl.replaceChildren(...display.map((page) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `library-page-card${this.selected.includes(page.order) ? ' is-picked' : ''}`;
      button.dataset.pageOrder = String(page.order);
      const number = document.createElement('span');
      number.className = 'page-number';
      number.textContent = `${page.icon} ${page.where}`;
      const title = document.createElement('h3');
      title.textContent = page.title;
      const text = document.createElement('p');
      text.textContent = page.text;
      button.append(number, title, text);
      return button;
    }));
    if (this.orderEl) {
      this.orderEl.textContent = this.selected.length
        ? this.selected.map((order) => `第${order}页`).join(' → ')
        : '还没有选';
    }
  }

  openPuzzle() {
    if (!this.overlay) return;
    if (this.completed) { this._renderComplete(); return; }
    this.overlay.classList.remove('is-hidden');
    this.overlay.setAttribute('aria-hidden', 'false');
    this.game?.player?.exitPointerLock?.();
    this._resetSelection(false);
    this._setHint('先读一读每页，再决定哪一页是开头。');
    this._renderCards();
  }

  closePuzzle() {
    this.overlay?.classList.add('is-hidden');
    this.overlay?.setAttribute('aria-hidden', 'true');
  }

  _renderComplete(show = true) {
    if (show) this.overlay?.classList.remove('is-hidden');
    this.overlay?.setAttribute('aria-hidden', 'false');
    if (this.leadEl) this.leadEl.textContent = '三页故事重新连起来了。';
    if (this.pagesEl) {
      this.pagesEl.innerHTML = '<div class="library-reward">🌧️ 💧 ☀️<br><strong>《溪水去哪了》复原成功！</strong><br>你获得了「溪水观察员」印章。屋顶的灯笼亮起来了。</div>';
    }
    if (this.orderEl) this.orderEl.textContent = '第1页 → 第2页 → 第3页';
    this._setHint('故事会一直留在探索手账里。', 'good');
    document.getElementById('btn-library-reset')?.classList.add('is-hidden');
    const close = document.getElementById('btn-library-close-2');
    if (close) close.textContent = '收进手账';
  }

  _complete() {
    if (this.completed) return;
    this.completed = true;
    this._renderComplete();
    this.ui.toastMessage('📖 三页书复原成功！获得「溪水观察员」印章。', 'good', 5000);
    this.game?.audio?.playSuccess?.();
    this.journal.add({
      id: 'library-quest-complete',
      icon: '📚',
      title: '溪水观察员',
      detail: '在溪谷书屋把《溪水去哪了》的三页故事按顺序复原了。',
    });
    this._updateChip();
    this.callbacks.onComplete?.();
  }

  collect(pageId) {
    if (this.completed || this.found.has(pageId)) return;
    const page = this.pages.find((item) => item.id === pageId);
    if (!page) return;
    this.found.add(pageId);
    const group = this.groups.get(pageId);
    if (group) {
      this.scene.remove(group);
      group.traverse((object) => {
        object.geometry?.dispose?.();
        if (object.material && object.material !== this._glow) object.material.dispose?.();
      });
      this.groups.delete(pageId);
    }
    this.journal.add({
      id: `library-page-${pageId}`,
      icon: page.icon,
      title: `找到一页故事：${page.title}`,
      detail: `${page.text}（发现地点：${page.where}）`,
    });
    this.ui.toastMessage(`📖 找到第 ${this.found.size}/3 页：${page.title}`, 'good', 4200);
    this.game?.audio?.playSuccess?.();
    this._updateChip();
    this.callbacks.onProgress?.(this.getState());
    if (this.found.size === 3) window.setTimeout(() => this.openPuzzle(), 720);
  }

  update(delta) {
    this._pageTimer += delta;
    for (const [id, group] of this.groups) {
      group.rotation.y += delta * 0.7;
      group.position.y = group.userData.baseY + Math.sin(this._pageTimer * 2 + group.userData.phase) * 0.12;
      const dx = this.game.player.position.x - group.position.x;
      const dy = this.game.player.position.y + 1.2 - group.position.y;
      const dz = this.game.player.position.z - group.position.z;
      if (Math.hypot(dx, dy, dz) <= 2.5) this.collect(id);
    }
    const lib = this.library;
    const distance = Math.hypot(this.game.player.position.x - lib.x, this.game.player.position.z - lib.z);
    const shouldShow = this.found.size > 0 || distance < 34 || this.completed;
    if (shouldShow !== this._chipVisible) {
      this._chipVisible = shouldShow;
      this.chip?.classList.toggle('is-hidden', !shouldShow);
    }
  }

  _updateChip() {
    if (!this.chipDetail) return;
    if (this.completed) {
      this.chipDetail.textContent = '《溪水去哪了》已复原';
      return;
    }
    this.chipDetail.textContent = this.found.size === 3
      ? '三页都找到了，点这里排顺序'
      : `寻找散落的故事 ${this.found.size}/3`;
  }

  restore(data) {
    if (!data) return;
    this.found = new Set((data.found || []).filter((id) => this.pages.some((page) => page.id === id)));
    this.completed = Boolean(data.completed);
    for (const id of this.found) {
      const group = this.groups.get(id);
      if (group) { this.scene.remove(group); this.groups.delete(id); }
    }
    this._updateChip();
    if (this.completed) this._renderComplete(false);
  }

  getSaveData() {
    return { found: [...this.found], completed: this.completed };
  }

  getState() {
    return {
      found: [...this.found],
      completed: this.completed,
      positions: this._positions,
      pageCount: this.pages.length,
      chipVisible: this._chipVisible,
    };
  }

  dispose() {
    for (const group of this.groups.values()) this.scene.remove(group);
    this.groups.clear();
  }
}
