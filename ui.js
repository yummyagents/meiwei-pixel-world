/**
 * 界面控制器：负责首页、角色选择、加载页、HUD、弹窗和提示。
 * 只操作 DOM，不直接操作 Three.js，方便单独测试界面。
 */

import { CHARACTERS, getCharacter } from './characters.js';
import { CREATIVE_BLOCKS, getBlock, getBlockColor } from './blocks.js';
import { HOTBAR_SIZE, MAGNET_SLOT } from './inventory.js';

export class GameUI {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.selectedCharacterId = null;
    this.selectedCharacter = null;
    this._toastTimer = 0;
    this._loadingPercent = 0;
    this._controlsOpen = false;
    this._hotbarState = {
      slots: new Array(HOTBAR_SIZE).fill(null),
      selectedIndex: 0,
    };
    this.pendingCreativeBlock = null;

    this.screens = {
      home: document.getElementById('screen-home'),
      select: document.getElementById('screen-select'),
      loading: document.getElementById('screen-loading'),
      game: document.getElementById('screen-game'),
      error: document.getElementById('screen-error'),
    };

    this.characterGrid = document.getElementById('character-grid');
    this.startButton = document.getElementById('btn-start');
    this.selectionPreview = document.getElementById('selection-preview');
    this.selectionPreviewPortrait = document.getElementById('selection-preview-portrait');
    this.selectionPreviewEmoji = document.querySelector('#selection-preview .preview-emoji');
    this.loadingBar = document.getElementById('loading-bar');
    this.loadingPercent = document.getElementById('loading-percent');
    this.loadingDetail = document.getElementById('loading-detail');
    this.loadingTrack = document.querySelector('.loading-track');
    this.toast = document.getElementById('toast');
    this.pointerHint = document.getElementById('pointer-hint');
    this.pointerHintText = document.getElementById('pointer-hint-text');
    this.pointerHintIcon = document.getElementById('pointer-hint-icon');

    this.tutorialOverlay = document.getElementById('overlay-tutorial');
    this.pauseOverlay = document.getElementById('overlay-pause');
    this.controlsOverlay = document.getElementById('overlay-controls');
    this.inventoryOverlay = document.getElementById('overlay-inventory');
    this.hotbar = document.getElementById('hotbar');
    this.inventoryHotbar = document.getElementById('inventory-hotbar');
    this.creativeGrid = document.getElementById('creative-grid');
    this.inventoryCarry = document.getElementById('inventory-carry');
    this.inventoryCarryIcon = document.getElementById('inventory-carry-icon');
    this.inventoryCarryTitle = document.getElementById('inventory-carry-title');
    this.inventoryCarryTip = document.getElementById('inventory-carry-tip');

    this.btnContinue = document.getElementById('btn-continue');
    this.btnNext = document.getElementById('btn-next');
    this.btnNextLabel = document.getElementById('btn-next-label');
    this.btnExportSave = document.getElementById('btn-export-save');
    this.btnImportSave = document.getElementById('btn-import-save');
    this.importSaveFile = document.getElementById('import-save-file');
    this.saveBar = document.getElementById('home-save-bar');
    this.saveTitle = document.getElementById('save-title');
    this.saveDetail = document.getElementById('save-detail');
    this.saveIcon = document.getElementById('save-icon');
    this.saveIndicator = document.getElementById('save-indicator');
    this.saveIndicatorText = document.getElementById('save-indicator-text');
    this.cameraFlash = document.getElementById('camera-flash');
    this.minimapPanel = document.getElementById('minimap-panel');
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.underwaterFilter = document.getElementById('underwater-filter');
    this.modeIndicator = document.getElementById('mode-indicator');
    this.modeIndicatorIcon = document.getElementById('mode-indicator-icon');
    this.modeIndicatorText = document.getElementById('mode-indicator-text');
    this.galleryOverlay = document.getElementById('overlay-gallery');
    this.galleryGrid = document.getElementById('gallery-grid');
    this.galleryEmpty = document.getElementById('gallery-empty');
    this.worldMapOverlay = document.getElementById('overlay-worldmap');
    this.worldMapCanvas = document.getElementById('worldmap-canvas');
    this.worldMapLoading = document.getElementById('worldmap-loading');
    this._saveIndicatorTimer = 0;
    this._flashTimer = 0;
    this._galleryPhotos = [];

    this.questPanel = document.getElementById('quest-panel');
    this.questTitle = document.getElementById('quest-title');
    this.questProgress = document.getElementById('quest-progress');
    this.questElements = {
      walk: {
        item: document.getElementById('quest-walk'),
        count: document.getElementById('quest-walk-count'),
      },
      place: {
        item: document.getElementById('quest-place'),
        count: document.getElementById('quest-place-count'),
      },
      animal: {
        item: document.getElementById('quest-animal'),
        count: document.getElementById('quest-animal-count'),
      },
    };

    this.hud = {
      characterEmoji: document.getElementById('hud-character-emoji'),
      characterName: document.getElementById('hud-character-name'),
      fps: document.getElementById('hud-fps'),
      coords: document.getElementById('hud-coords'),
      biome: document.getElementById('hud-biome'),
      time: document.getElementById('hud-time'),
      weather: document.getElementById('hud-weather'),
      weatherIcon: document.getElementById('hud-weather-icon'),
      chunks: document.getElementById('hud-chunks'),
    };

    this.errorTitle = document.getElementById('error-title');
    this.errorMessage = document.getElementById('error-message');
    this.errorDetails = document.getElementById('error-details');
    this.errorDetailsWrap = document.getElementById('error-details-wrap');

    this._bindBaseButtons();
    this._bindHotbarEvents();
    this._renderCharacters();
    this._renderCreativeGrid();
    this._renderHotbar();
    this.updateSelectionPreview(null);
  }

  _bindBaseButtons() {
    document.getElementById('btn-next')?.addEventListener('click', () => {
      this.showScreen('select');
      this.callbacks.onNext?.();
    });

    document.getElementById('btn-home-controls')?.addEventListener('click', () => {
      this.showControls();
    });

    document.getElementById('btn-select-back')?.addEventListener('click', () => {
      this.showScreen('home');
      this.callbacks.onBackHome?.();
    });

    this.startButton?.addEventListener('click', () => {
      if (!this.selectedCharacterId) return;
      this.callbacks.onStart?.(getCharacter(this.selectedCharacterId));
    });

    document.getElementById('btn-controls-close')?.addEventListener('click', () => {
      this.hideControls();
    });
    document.getElementById('btn-controls-close-x')?.addEventListener('click', () => {
      this.hideControls();
    });

    document.getElementById('btn-tutorial-go')?.addEventListener('click', () => {
      this.closeTutorial();
    });
    document.getElementById('btn-tutorial-close-x')?.addEventListener('click', () => {
      this.closeTutorial();
    });

    document.getElementById('btn-resume')?.addEventListener('click', () => {
      this.callbacks.onResume?.();
    });
    document.getElementById('btn-pause-controls')?.addEventListener('click', () => {
      this.showControls();
    });
    document.getElementById('btn-pause-home')?.addEventListener('click', () => {
      this.callbacks.onPauseHome?.();
    });

    document.getElementById('btn-retry')?.addEventListener('click', () => {
      this.callbacks.onRetry?.();
    });
    document.getElementById('btn-continue')?.addEventListener('click', () => {
      this.callbacks.onContinueSave?.();
    });

    this.btnExportSave?.addEventListener('click', () => {
      this.callbacks.onExportSave?.();
    });

    this.btnImportSave?.addEventListener('click', () => {
      this.importSaveFile?.click();
    });

    this.importSaveFile?.addEventListener('change', () => {
      const file = this.importSaveFile.files?.[0];
      if (file) this.callbacks.onImportSave?.(file);
      this.importSaveFile.value = '';
    });

    document.getElementById('btn-worldmap-close')?.addEventListener('click', () => {
      this.callbacks.onWorldMapClose?.();
    });
    document.getElementById('btn-worldmap-close-x')?.addEventListener('click', () => {
      this.callbacks.onWorldMapClose?.();
    });
    document.getElementById('btn-gallery-close')?.addEventListener('click', () => {
      this.callbacks.onGalleryClose?.();
    });
    document.getElementById('btn-gallery-close-x')?.addEventListener('click', () => {
      this.callbacks.onGalleryClose?.();
    });
    this.galleryGrid?.addEventListener('click', (event) => {
      const button = event.target.closest('.gallery-delete');
      if (!button) return;
      this.callbacks.onDeletePhoto?.(button.dataset.photoId);
    });

    document.getElementById('btn-error-home')?.addEventListener('click', () => {
      this.callbacks.onErrorHome?.();
    });
  }

  _bindHotbarEvents() {
    document.getElementById('btn-inventory-close-x')?.addEventListener('click', () => {
      this.callbacks.onInventoryClose?.();
    });
    document.getElementById('btn-inventory-done')?.addEventListener('click', () => {
      this.callbacks.onInventoryClose?.();
    });

    this.hotbar?.addEventListener('click', (event) => {
      const slot = event.target.closest('.hotbar-slot');
      if (!slot) return;
      const index = Number(slot.dataset.index);
      if (Number.isInteger(index)) this.callbacks.onHotbarSelect?.(index);
    });

    this.hotbar?.addEventListener('contextmenu', (event) => {
      const slot = event.target.closest('.hotbar-slot');
      if (!slot) return;
      event.preventDefault();
      const index = Number(slot.dataset.index);
      if (Number.isInteger(index)) this.callbacks.onHotbarClear?.(index);
    });

    this.inventoryHotbar?.addEventListener('click', (event) => {
      const slot = event.target.closest('.hotbar-slot');
      if (!slot) return;
      const index = Number(slot.dataset.index);
      if (!Number.isInteger(index)) return;

      if (this.pendingCreativeBlock !== null) {
        const accepted = this.callbacks.onInventoryAssign?.(
          index,
          this.pendingCreativeBlock,
        );
        if (accepted !== false) this._clearCreativePending();
        return;
      }
      this.callbacks.onHotbarSelect?.(index);
    });

    this.inventoryHotbar?.addEventListener('contextmenu', (event) => {
      const slot = event.target.closest('.hotbar-slot');
      if (!slot) return;
      event.preventDefault();
      const index = Number(slot.dataset.index);
      if (Number.isInteger(index)) this.callbacks.onHotbarClear?.(index);
    });
  }

  _renderCreativeGrid() {
    if (!this.creativeGrid) return;
    this.creativeGrid.innerHTML = CREATIVE_BLOCKS.map((blockId) => {
      const block = getBlock(blockId);
      if (!block) return '';
      return `
        <button
          class="creative-block"
          type="button"
          data-block-id="${blockId}"
          style="--block-color:${getBlockColor(blockId)}"
          aria-label="选择${block.name}"
          title="选择${block.name}"
        >
          <span class="creative-icon" aria-hidden="true">${block.icon}</span>
          <strong>${block.name}</strong>
        </button>
      `;
    }).join('');

    this.creativeGrid.querySelectorAll('.creative-block').forEach((tile) => {
      tile.addEventListener('click', () => {
        const blockId = Number(tile.dataset.blockId);
        this._pickCreativeBlock(blockId);
      });
    });
  }

  _pickCreativeBlock(blockId) {
    const block = getBlock(blockId);
    if (!block) return;
    this.pendingCreativeBlock = blockId;
    this.creativeGrid?.querySelectorAll('.creative-block').forEach((tile) => {
      tile.classList.toggle('is-picked', Number(tile.dataset.blockId) === blockId);
    });
    this._renderCreativeGridHint(block);
  }

  _clearCreativePending() {
    this.pendingCreativeBlock = null;
    this.creativeGrid?.querySelectorAll('.creative-block').forEach((tile) => {
      tile.classList.remove('is-picked');
    });
    this._renderCreativeGridHint(null);
  }

  _renderCreativeGridHint(block) {
    if (!this.inventoryCarry) return;
    this.inventoryCarry.classList.toggle('has-block', Boolean(block));
    if (this.inventoryCarryIcon) this.inventoryCarryIcon.textContent = block ? block.icon : '👆';
    if (this.inventoryCarryTitle) {
      this.inventoryCarryTitle.textContent = block ? `拿着：${block.name}` : '先挑一个方块吧';
    }
    if (this.inventoryCarryTip) {
      this.inventoryCarryTip.textContent = block
        ? '现在点下面一个快捷栏格子，把它放进去'
        : '点一点上面的方块，再点快捷栏格子';
    }
  }

  _slotDisplay(slot) {
    if (slot === MAGNET_SLOT) {
      return {
        icon: '🧲',
        name: '磁铁收集',
        color: '#ff7fa9',
        magnet: true,
        empty: false,
      };
    }
    if (typeof slot === 'number') {
      const block = getBlock(slot);
      if (block) {
        return {
          icon: block.icon,
          name: block.name,
          color: getBlockColor(slot),
          magnet: false,
          empty: false,
        };
      }
    }
    return {
      icon: '＋',
      name: '空格子',
      color: 'rgba(255,255,255,0.06)',
      magnet: false,
      empty: true,
    };
  }

  _makeSlotMarkup(slot, index, selected) {
    const display = this._slotDisplay(slot);
    const classes = [
      'hotbar-slot',
      selected ? 'is-selected' : '',
      display.empty ? 'is-empty' : '',
    ].filter(Boolean).join(' ');
    return `
      <button
        class="${classes}"
        type="button"
        data-index="${index}"
        aria-label="第 ${index + 1} 格：${display.name}"
        aria-pressed="${selected ? 'true' : 'false'}"
        title="第 ${index + 1} 格：${display.name}"
      >
        <span class="slot-number" aria-hidden="true">${index + 1}</span>
        <span class="slot-icon ${display.magnet ? 'is-magnet' : ''}" style="--slot-color:${display.color}" aria-hidden="true">${display.icon}</span>
        ${display.magnet ? '<span class="hotbar-badge">磁铁</span>' : ''}
      </button>
    `;
  }

  _renderHotbar() {
    const { slots, selectedIndex } = this._hotbarState;
    const markup = slots.map((slot, index) => {
      return this._makeSlotMarkup(slot, index, index === selectedIndex);
    }).join('');
    if (this.hotbar) this.hotbar.innerHTML = markup;
    if (this.inventoryHotbar) {
      this.inventoryHotbar.innerHTML = slots.map((slot, index) => {
        return this._makeSlotMarkup(slot, index, index === selectedIndex);
      }).join('');
    }
  }

  setHotbarState(state) {
    if (!state || !Array.isArray(state.slots)) return;
    this._hotbarState = {
      slots: state.slots.slice(0, HOTBAR_SIZE),
      selectedIndex: Number.isInteger(state.selectedIndex) ? state.selectedIndex : 0,
    };
    this._renderHotbar();
  }

  showInventory() {
    this.hidePause();
    this.tutorialOverlay?.classList.add('is-hidden');
    this.controlsOverlay?.classList.add('is-hidden');
    this.galleryOverlay?.classList.add('is-hidden');
    this.inventoryOverlay?.classList.remove('is-hidden');
    this.inventoryOverlay?.setAttribute('aria-hidden', 'false');
    this._clearCreativePending();
    this._renderHotbar();
    document.activeElement?.blur?.();
    window.setTimeout(() => {
      document.getElementById('btn-inventory-close-x')?.focus({ preventScroll: true });
    }, 30);
  }

  hideInventory() {
    this.inventoryOverlay?.classList.add('is-hidden');
    this.inventoryOverlay?.setAttribute('aria-hidden', 'true');
    this._clearCreativePending();
    document.activeElement?.blur?.();
  }

  isInventoryOpen() {
    return Boolean(this.inventoryOverlay && !this.inventoryOverlay.classList.contains('is-hidden'));
  }

  setSaveInfo(info) {
    const hasSave = Boolean(info);
    this.btnContinue?.classList.toggle('is-hidden', !hasSave);
    if (this.btnExportSave) this.btnExportSave.disabled = !hasSave;
    if (this.saveBar) this.saveBar.classList.toggle('has-save', hasSave);

    if (hasSave) {
      const timeText = this._formatSaveTime(info.savedAt);
      if (this.saveIcon) this.saveIcon.textContent = info.characterEmoji || '💾';
      if (this.saveTitle) this.saveTitle.textContent = `${info.characterName || '特工'}的世界`;
      if (this.saveDetail) {
        this.saveDetail.textContent = `上次保存：${timeText} · 改过 ${info.modificationCount || 0} 个方块 · 任务 ${info.questsCompleted || 0}/3`;
      }
      if (this.btnNextLabel) this.btnNextLabel.textContent = '开新世界：选特工';
      this.btnNext?.classList.add('pixel-button-light');
      this.btnNext?.classList.remove('pixel-button-primary');
    } else {
      if (this.saveIcon) this.saveIcon.textContent = '💾';
      if (this.saveTitle) this.saveTitle.textContent = '还没有存档';
      if (this.saveDetail) this.saveDetail.textContent = '开始冒险后会自动保存';
      if (this.btnNextLabel) this.btnNextLabel.textContent = '下一步：选特工';
      this.btnNext?.classList.add('pixel-button-primary');
      this.btnNext?.classList.remove('pixel-button-light');
    }
  }

  _formatSaveTime(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '刚刚';
    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    if (sameDay) {
      return `今天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  setUnderwater(active) {
    this.underwaterFilter?.classList.toggle('is-hidden', !active);
  }

  setModeIndicator({ flying = false, thirdPerson = false } = {}) {
    if (!this.modeIndicator) return;
    const visible = Boolean(flying || thirdPerson);
    this.modeIndicator.classList.toggle('is-hidden', !visible);
    if (!visible) return;
    if (this.modeIndicatorIcon) {
      this.modeIndicatorIcon.textContent = flying ? '🕊️' : '👁️';
    }
    if (this.modeIndicatorText) {
      this.modeIndicatorText.textContent = flying
        ? thirdPerson
          ? '飞行 / 第三视角'
          : '飞行模式'
        : '第三视角';
    }
  }

  setMobileToolActive(tool, active) {
    document.getElementById(`btn-mobile-${tool}`)?.classList.toggle('is-active', Boolean(active));
  }

  setMinimapVisible(visible) {
    this.minimapPanel?.classList.toggle('is-hidden', !visible);
  }

  isMinimapVisible() {
    return Boolean(this.minimapPanel && !this.minimapPanel.classList.contains('is-hidden'));
  }

  showSaveIndicator(text = '已保存') {
    if (!this.saveIndicator) return;
    window.clearTimeout(this._saveIndicatorTimer);
    if (this.saveIndicatorText) this.saveIndicatorText.textContent = text;
    this.saveIndicator.classList.remove('is-faded');
    this._saveIndicatorTimer = window.setTimeout(() => {
      this.saveIndicator.classList.add('is-faded');
    }, 1800);
  }

  flashCamera() {
    if (!this.cameraFlash) return;
    window.clearTimeout(this._flashTimer);
    this.cameraFlash.classList.remove('is-flashing');
    // 重新触发 CSS 动画。
    void this.cameraFlash.offsetWidth;
    this.cameraFlash.classList.add('is-flashing');
    this._flashTimer = window.setTimeout(() => {
      this.cameraFlash.classList.remove('is-flashing');
    }, 520);
  }

  showGallery(photos = []) {
    this.hidePause();
    this.tutorialOverlay?.classList.add('is-hidden');
    this.controlsOverlay?.classList.add('is-hidden');
    this.inventoryOverlay?.classList.add('is-hidden');
    this._galleryPhotos = Array.isArray(photos) ? photos.slice() : [];
    this._renderGallery();
    this.galleryOverlay?.classList.remove('is-hidden');
    this.galleryOverlay?.setAttribute('aria-hidden', 'false');
    document.activeElement?.blur?.();
    window.setTimeout(() => {
      document.getElementById('btn-gallery-close')?.focus({ preventScroll: true });
    }, 30);
  }

  hideGallery() {
    this.galleryOverlay?.classList.add('is-hidden');
    this.galleryOverlay?.setAttribute('aria-hidden', 'true');
    document.activeElement?.blur?.();
  }

  isGalleryOpen() {
    return Boolean(this.galleryOverlay && !this.galleryOverlay.classList.contains('is-hidden'));
  }

  updateGallery(photos) {
    this._galleryPhotos = Array.isArray(photos) ? photos.slice() : [];
    if (this.isGalleryOpen()) this._renderGallery();
  }

  _renderGallery() {
    if (!this.galleryGrid || !this.galleryEmpty) return;
    const photos = this._galleryPhotos;
    this.galleryEmpty.hidden = photos.length > 0;
    this.galleryGrid.hidden = photos.length === 0;
    this.galleryGrid.replaceChildren();

    for (const photo of photos) {
      const card = document.createElement('article');
      card.className = 'gallery-photo';

      const frame = document.createElement('div');
      frame.className = 'gallery-photo-frame';
      const image = document.createElement('img');
      image.src = photo.dataUrl;
      image.alt = `${photo.characterName || '特工'}拍下的方块世界`;
      image.loading = 'lazy';
      frame.appendChild(image);

      const meta = document.createElement('div');
      meta.className = 'gallery-photo-meta';
      const title = document.createElement('strong');
      title.textContent = `${photo.characterName || '特工'} · ${photo.biome || '方块世界'}`;
      const time = document.createElement('small');
      time.textContent = this._formatSaveTime(photo.createdAt);
      meta.append(title, time);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'gallery-delete';
      deleteButton.dataset.photoId = photo.id;
      deleteButton.textContent = '删除';
      deleteButton.setAttribute('aria-label', '删除这张照片');

      card.append(frame, meta, deleteButton);
      this.galleryGrid.appendChild(card);
    }
  }

  _renderCharacters() {
    if (!this.characterGrid) return;
    this.characterGrid.innerHTML = CHARACTERS.map(
      (character, index) => `
        <button
          class="character-card"
          type="button"
          data-character-id="${character.id}"
          style="--card-color:${character.color};--card-soft:${character.accent}"
          aria-pressed="false"
          aria-label="${character.name}，${character.title}"
        >
          <span class="character-number" aria-hidden="true">${index + 1}</span>
          <span class="character-avatar-wrap" aria-hidden="true">
            <img class="character-avatar-photo" src="${character.portrait}" alt="" loading="lazy">
          </span>
          <span class="character-copy">
            <strong>${character.name}</strong>
            <em>${character.title}</em>
            <small>${character.description}</small>
          </span>
          <span class="character-check" aria-hidden="true">✓</span>
        </button>
      `,
    ).join('');

    this.characterGrid.querySelectorAll('.character-card').forEach((card) => {
      card.addEventListener('click', () => {
        const characterId = card.dataset.characterId;
        this.selectCharacter(characterId);
      });
    });
  }

  showScreen(name) {
    const next = this.screens[name];
    if (!next) return;
    for (const screen of Object.values(this.screens)) {
      screen?.classList.remove('is-active');
    }
    next.classList.add('is-active');
    document.body.dataset.screen = name;

    if (name === 'home') {
      this.hideAllOverlays();
      this.setPointerHint(false);
    }
    if (name === 'select') {
      this.hideAllOverlays();
    }
  }

  selectCharacter(characterId) {
    const character = getCharacter(characterId);
    if (!character || !CHARACTERS.some((entry) => entry.id === character.id)) return;

    this.selectedCharacterId = character.id;
    this.selectedCharacter = character;

    this.characterGrid?.querySelectorAll('.character-card').forEach((card) => {
      const isSelected = card.dataset.characterId === character.id;
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-pressed', String(isSelected));
    });

    this.updateSelectionPreview(character);
    this.startButton?.classList.remove('is-hidden');
    this.callbacks.onCharacterSelected?.(character);
  }

  updateSelectionPreview(character) {
    if (!this.selectionPreview) return;
    const emoji = this.selectionPreview.querySelector('.preview-emoji');
    const strong = this.selectionPreview.querySelector('strong');
    const small = this.selectionPreview.querySelector('small');
    if (this.selectionPreviewPortrait) {
      this.selectionPreviewPortrait.classList.toggle('is-hidden', !character?.portrait);
      if (character?.portrait) this.selectionPreviewPortrait.src = character.portrait;
    }
    if (emoji) {
      emoji.classList.toggle('is-hidden', Boolean(character?.portrait));
      emoji.textContent = character ? character.emoji : '❓';
    }
    if (strong) strong.textContent = character ? character.name : '还没有选特工';
    if (small) small.textContent = character ? `${character.title} · 准备好啦` : '先点一张卡片吧';

    if (!character) {
      this.startButton?.classList.add('is-hidden');
    }
  }

  setCharacter(character) {
    if (!character) return;
    this.hud.characterEmoji.textContent = character.emoji;
    this.hud.characterName.textContent = character.name;
    document.getElementById('tutorial-character-emoji').textContent = character.emoji;
    document.getElementById('tutorial-character-name').textContent = character.name;
  }

  startLoading() {
    this.showScreen('loading');
    this.setLoading(0, '先种下一片软软的草地');
  }

  setLoading(progress, detail) {
    const percent = Math.max(0, Math.min(100, Math.round(progress)));
    this._loadingPercent = percent;
    if (this.loadingBar) this.loadingBar.style.width = `${percent}%`;
    if (this.loadingPercent) this.loadingPercent.textContent = `${percent}%`;
    if (this.loadingTrack) this.loadingTrack.setAttribute('aria-valuenow', String(percent));
    if (detail && this.loadingDetail) this.loadingDetail.textContent = detail;
  }

  updateQuests(state) {
    if (!state || !Array.isArray(state.steps)) return;
    for (const step of state.steps) {
      const elements = this.questElements[step.id];
      if (!elements) continue;
      elements.item?.classList.toggle('is-done', step.complete);
      if (elements.count) elements.count.textContent = step.detail;
      const check = elements.item?.querySelector('.quest-check');
      if (check) check.textContent = step.complete ? '✓' : '○';
    }
    if (this.questProgress) {
      this.questProgress.textContent = `${state.completedCount}/3`;
    }
    if (this.questTitle) {
      this.questTitle.textContent = state.allComplete ? '✨ 新手任务完成' : '🌱 新手任务';
    }
    this.questPanel?.classList.toggle('is-complete', state.allComplete);
  }

  updateHUD({ fps, position, biome, time, weather, weatherEmoji, chunks, character }) {
    if (this.hud.fps) this.hud.fps.textContent = String(Math.round(fps));
    if (this.hud.coords && position) {
      this.hud.coords.textContent =
        `X ${Math.floor(position.x)} · Y ${Math.floor(position.y)} · Z ${Math.floor(position.z)}`;
    }
    if (this.hud.biome && biome) this.hud.biome.textContent = biome;
    if (this.hud.time && time) this.hud.time.textContent = time;
    if (this.hud.weather && weather) this.hud.weather.textContent = weather;
    if (this.hud.weatherIcon && weatherEmoji) this.hud.weatherIcon.textContent = weatherEmoji;
    if (this.hud.chunks && Number.isFinite(chunks)) this.hud.chunks.textContent = String(chunks);
    if (character) this.setCharacter(character);
  }

  showTutorial(character) {
    if (character) this.setCharacter(character);
    this.hidePause();
    this.controlsOverlay?.classList.add('is-hidden');
    this.inventoryOverlay?.classList.add('is-hidden');
    this.galleryOverlay?.classList.add('is-hidden');
    this.tutorialOverlay?.classList.remove('is-hidden');
    this.tutorialOverlay?.setAttribute('aria-hidden', 'false');
    document.activeElement?.blur?.();
    window.setTimeout(() => {
      document.getElementById('btn-tutorial-go')?.focus({ preventScroll: true });
    }, 30);
  }

  closeTutorial() {
    this.tutorialOverlay?.classList.add('is-hidden');
    this.tutorialOverlay?.setAttribute('aria-hidden', 'true');
    document.activeElement?.blur?.();
    this.callbacks.onTutorialClose?.();
  }

  showPause() {
    this.tutorialOverlay?.classList.add('is-hidden');
    this.controlsOverlay?.classList.add('is-hidden');
    this.inventoryOverlay?.classList.add('is-hidden');
    this.galleryOverlay?.classList.add('is-hidden');
    this.pauseOverlay?.classList.remove('is-hidden');
    this.pauseOverlay?.setAttribute('aria-hidden', 'false');
    document.activeElement?.blur?.();
    window.setTimeout(() => {
      document.getElementById('btn-resume')?.focus({ preventScroll: true });
    }, 30);
  }

  hidePause() {
    this.pauseOverlay?.classList.add('is-hidden');
    this.pauseOverlay?.setAttribute('aria-hidden', 'true');
  }

  showControls() {
    this._controlsOpen = true;
    this.controlsOverlay?.classList.remove('is-hidden');
    this.controlsOverlay?.setAttribute('aria-hidden', 'false');
    document.activeElement?.blur?.();
    window.setTimeout(() => {
      document.getElementById('btn-controls-close')?.focus({ preventScroll: true });
    }, 30);
  }

  hideControls() {
    this._controlsOpen = false;
    this.controlsOverlay?.classList.add('is-hidden');
    this.controlsOverlay?.setAttribute('aria-hidden', 'true');
    document.activeElement?.blur?.();
  }

  hideAllOverlays() {
    for (const overlay of [
      this.tutorialOverlay,
      this.pauseOverlay,
      this.controlsOverlay,
      this.inventoryOverlay,
      this.galleryOverlay,
      this.worldMapOverlay,
    ]) {
      overlay?.classList.add('is-hidden');
      overlay?.setAttribute('aria-hidden', 'true');
    }
    this._controlsOpen = false;
    if (this.inventoryOverlay) {
      this._clearCreativePending();
    }
    document.activeElement?.blur?.();
  }

  showError({ title = '世界暂时没有打开', message = '请再试一次吧。', detail = '' }) {
    this.hideAllOverlays();
    this.controlsOverlay?.classList.add('is-hidden');
    if (this.errorTitle) this.errorTitle.textContent = title;
    if (this.errorMessage) this.errorMessage.textContent = message;
    if (this.errorDetails) this.errorDetails.textContent = detail || '';
    if (this.errorDetailsWrap) this.errorDetailsWrap.hidden = !detail;
    this.showScreen('error');
  }

  showWorldMap() {
    this.worldMapOverlay?.classList.remove('is-hidden');
    this.worldMapOverlay?.setAttribute('aria-hidden', 'false');
    this.setWorldMapLoading(true);
    document.activeElement?.blur?.();
    window.setTimeout(() => {
      document.getElementById('btn-worldmap-close')?.focus({ preventScroll: true });
    }, 30);
  }

  hideWorldMap() {
    this.worldMapOverlay?.classList.add('is-hidden');
    this.worldMapOverlay?.setAttribute('aria-hidden', 'true');
    this.setWorldMapLoading(false);
    document.activeElement?.blur?.();
  }

  setWorldMapLoading(loading) {
    this.worldMapLoading?.classList.toggle('is-hidden', !loading);
  }

  isWorldMapOpen() {
    return Boolean(this.worldMapOverlay && !this.worldMapOverlay.classList.contains('is-hidden'));
  }

  setPointerHint(visible, text) {
    if (!this.pointerHint) return;
    if (text && this.pointerHintText) this.pointerHintText.textContent = text;
    if (this.pointerHintIcon && text) {
      this.pointerHintIcon.textContent = text.includes('鼠标') ? '🖱️' : '💡';
    }
    this.pointerHint.classList.toggle('is-faded', !visible);
  }

  toastMessage(message, type = 'info', duration = 2800) {
    if (!this.toast) return;
    window.clearTimeout(this._toastTimer);
    this.toast.textContent = message;
    this.toast.classList.remove('is-hidden', 'toast-warn', 'toast-good');
    if (type === 'warn') this.toast.classList.add('toast-warn');
    if (type === 'good') this.toast.classList.add('toast-good');
    this.toast.classList.remove('is-hidden');

    if (duration > 0) {
      this._toastTimer = window.setTimeout(() => {
        this.toast.classList.add('is-hidden');
      }, duration);
    }
  }

  hideToast() {
    window.clearTimeout(this._toastTimer);
    this.toast?.classList.add('is-hidden');
  }
}
