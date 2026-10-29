/**
 * 快捷栏和创造背包的数据。
 *
 * 前 8 格放方块，第 9 格固定是“磁铁收集”模式。
 * 这个模块不操作 DOM，也不依赖 Three.js，方便单独测试。
 */

import { BLOCK_IDS, getBlock } from './blocks.js';

export const HOTBAR_SIZE = 9;
export const MAGNET_SLOT = 'magnet';
export const MAGNET_SLOT_INDEX = HOTBAR_SIZE - 1;

export function createDefaultSlots() {
  return [
    BLOCK_IDS.GRASS,
    BLOCK_IDS.DIRT,
    BLOCK_IDS.STONE,
    BLOCK_IDS.SAND,
    BLOCK_IDS.WATER,
    BLOCK_IDS.LAVA,
    BLOCK_IDS.WOOD,
    BLOCK_IDS.LEAVES,
    MAGNET_SLOT,
  ];
}

export class Inventory {
  constructor(slots = createDefaultSlots()) {
    this.slots = createDefaultSlots();
    this.selectedIndex = 0;
    this._listeners = new Set();
    this.loadSlots(slots);
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _emit() {
    const state = this.getState();
    for (const listener of this._listeners) {
      try {
        listener(state);
      } catch (error) {
        console.warn('[美味特工队] 快捷栏监听器出错：', error);
      }
    }
  }

  loadSlots(slots) {
    if (!Array.isArray(slots)) return;
    for (let i = 0; i < HOTBAR_SIZE; i += 1) {
      if (i === MAGNET_SLOT_INDEX) {
        this.slots[i] = MAGNET_SLOT;
        continue;
      }
      const value = slots[i];
      this.slots[i] = typeof value === 'number' && getBlock(value) ? value : null;
    }
  }

  loadState(state) {
    if (!state) return;
    this.loadSlots(state.slots);
    const index = Number(state.selectedIndex);
    this.selectedIndex =
      Number.isInteger(index) && index >= 0 && index < HOTBAR_SIZE ? index : 0;
    this._emit();
  }

  select(index) {
    if (!Number.isInteger(index)) return false;
    if (index < 0 || index >= HOTBAR_SIZE) return false;
    this.selectedIndex = index;
    this._emit();
    return true;
  }

  cycle(direction = 1) {
    const step = direction < 0 ? -1 : 1;
    this.selectedIndex = (this.selectedIndex + step + HOTBAR_SIZE) % HOTBAR_SIZE;
    this._emit();
    return this.selectedIndex;
  }

  setSlot(index, blockId) {
    if (!Number.isInteger(index) || index < 0 || index >= HOTBAR_SIZE) return false;
    if (index === MAGNET_SLOT_INDEX) return false;
    if (typeof blockId !== 'number' || !getBlock(blockId)) return false;
    this.slots[index] = blockId;
    this._emit();
    return true;
  }

  clearSlot(index) {
    if (!Number.isInteger(index) || index < 0 || index >= HOTBAR_SIZE) return false;
    if (index === MAGNET_SLOT_INDEX) return false;
    this.slots[index] = null;
    this._emit();
    return true;
  }

  getSlot(index) {
    return this.slots[index] ?? null;
  }

  getSelectedSlot() {
    return this.getSlot(this.selectedIndex);
  }

  getSelectedBlockId() {
    const value = this.getSelectedSlot();
    return typeof value === 'number' ? value : null;
  }

  isMagnetSelected() {
    return this.selectedIndex === MAGNET_SLOT_INDEX;
  }

  getState() {
    return {
      slots: [...this.slots],
      selectedIndex: this.selectedIndex,
      selectedSlot: this.getSelectedSlot(),
      selectedBlockId: this.getSelectedBlockId(),
      magnet: this.isMagnetSelected(),
    };
  }
}
