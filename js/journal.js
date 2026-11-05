/**
 * 探索手账：记录孩子在世界里真正做过的事情。
 * 只保存在本地存档里，不做账号上传，也不做排名。
 */
export class ExplorationJournal {
  constructor({ game }) {
    this.game = game;
    this.entries = [];
    this.seen = new Set();
    this.overlay = document.getElementById('overlay-journal');
    this.list = document.getElementById('journal-list');
    this.count = document.getElementById('journal-count');
    this._bound = false;
    this._bind();
  }

  _bind() {
    if (this._bound) return;
    this._bound = true;
    document.getElementById('btn-journal-close')?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', (event) => {
      if (event.target === this.overlay) this.close();
    });
  }

  add(entry) {
    if (!entry || !entry.id || this.seen.has(entry.id)) return false;
    this.seen.add(entry.id);
    this.entries.push({
      id: entry.id,
      icon: entry.icon || '📝',
      title: entry.title || '新的发现',
      detail: entry.detail || '',
      time: entry.time || this._timeLabel(),
    });
    if (this.entries.length > 80) this.entries = this.entries.slice(-80);
    this.render();
    return true;
  }

  _timeLabel() {
    const minutes = this.game?.environment?.timeMinutes;
    if (Number.isFinite(minutes)) {
      const hours = Math.floor(minutes / 60) % 24;
      const mins = Math.floor(minutes % 60);
      return `游戏时间 ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
    return '';
  }

  render() {
    if (this.count) this.count.textContent = String(this.entries.length);
    if (!this.list) return;
    if (!this.entries.length) {
      this.list.innerHTML = '<div class="journal-empty">还没有记录。去溪谷书屋找找散落的故事吧。</div>';
      return;
    }
    this.list.replaceChildren(...this.entries.slice().reverse().map((entry) => {
      const item = document.createElement('article');
      item.className = 'journal-entry';
      const icon = document.createElement('span');
      icon.className = 'journal-entry-icon';
      icon.textContent = entry.icon;
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = entry.title;
      const detail = document.createElement('p');
      detail.textContent = entry.detail;
      const time = document.createElement('time');
      time.textContent = entry.time;
      copy.append(title, detail, time);
      item.append(icon, copy);
      return item;
    }));
  }

  open() {
    this.render();
    this.overlay?.classList.remove('is-hidden');
    this.overlay?.setAttribute('aria-hidden', 'false');
    this.game?.player?.exitPointerLock?.();
  }

  close() {
    this.overlay?.classList.add('is-hidden');
    this.overlay?.setAttribute('aria-hidden', 'true');
  }

  isOpen() {
    return this.overlay ? !this.overlay.classList.contains('is-hidden') : false;
  }

  restore(data) {
    if (!data?.entries) return;
    this.entries = data.entries.filter((entry) => entry?.id).slice(-80);
    this.seen = new Set(this.entries.map((entry) => entry.id));
    this.render();
  }

  getSaveData() {
    return { entries: this.entries };
  }

  getEntries() {
    return this.entries.map((entry) => ({ ...entry }));
  }
}
