/**
 * 单机存档：校验、localStorage、导入和导出。
 *
 * 世界是 seed 生成的，所以只需要保存“被玩家改过的方块”就够了。
 * 导入文件会先完整校验；坏文件只会得到错误提示，不会破坏现有存档。
 */

import { BLOCKS, getBlock } from './blocks.js';
import { CHARACTERS } from './characters.js';

export const SAVE_KEY = 'meiwei-save-v1';
export const SAVE_VERSION = 1;
export const MAX_MODIFICATIONS = 50000;
export const MAX_SAVE_BYTES = 5 * 1024 * 1024;

const ANIMAL_IDS = new Set(['rabbit', 'chicken', 'sheep', 'cow', 'horse', 'donkey', 'villager']);

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value) {
  return Number.isInteger(value);
}

function normalizePlayer(raw) {
  if (!raw || !isFiniteNumber(raw.x) || !isFiniteNumber(raw.y) || !isFiniteNumber(raw.z)) {
    return null;
  }
  if (raw.y < -10 || raw.y > 200) return null;
  if (Math.abs(raw.x) > 1000000 || Math.abs(raw.z) > 1000000) return null;
  return {
    x: raw.x,
    y: raw.y,
    z: raw.z,
    yaw: isFiniteNumber(raw.yaw) ? raw.yaw : 0,
    pitch: isFiniteNumber(raw.pitch) ? Math.max(-1.5, Math.min(1.5, raw.pitch)) : -0.06,
  };
}

function normalizeInventory(raw) {
  if (!raw || !Array.isArray(raw.slots) || raw.slots.length < 8) return null;
  const slots = raw.slots.slice(0, 9);
  while (slots.length < 9) slots.push(null);
  for (let i = 0; i < 8; i += 1) {
    const value = slots[i];
    if (value !== null && (!isInteger(value) || !getBlock(value))) {
      return null;
    }
  }
  slots[8] = 'magnet';
  return {
    slots,
    selectedIndex:
      isInteger(raw?.selectedIndex) && raw.selectedIndex >= 0 && raw.selectedIndex <= 8
        ? raw.selectedIndex
        : 0,
  };
}

function normalizeQuests(raw) {
  return {
    walkDistance: isFiniteNumber(raw?.walkDistance)
      ? Math.max(0, Math.min(10, raw.walkDistance))
      : 0,
    placed: Boolean(raw?.placed),
    animalFound: Boolean(raw?.animalFound),
  };
}

function normalizeModifications(raw) {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_MODIFICATIONS) return null;
  const map = new Map();
  for (const entry of raw) {
    if (!entry || !isInteger(entry.x) || !isInteger(entry.y) || !isInteger(entry.z)) {
      return null;
    }
    if (entry.y < 0 || entry.y >= 40) return null;
    if (!isInteger(entry.id) || (entry.id !== 0 && !BLOCKS[entry.id])) return null;
    map.set(`${entry.x},${entry.y},${entry.z}`, {
      x: entry.x,
      y: entry.y,
      z: entry.z,
      id: entry.id,
    });
  }
  return [...map.values()];
}

function normalizeAnimals(raw) {
  if (!Array.isArray(raw)) return [];
  if (raw.length > 20) return null;
  const animals = [];
  for (const entry of raw) {
    if (!entry || !ANIMAL_IDS.has(entry.type)) return null;
    if (!isFiniteNumber(entry.x) || !isFiniteNumber(entry.y) || !isFiniteNumber(entry.z)) {
      return null;
    }
    const home = entry.home || {};
    animals.push({
      type: entry.type,
      x: entry.x,
      y: entry.y,
      z: entry.z,
      yaw: isFiniteNumber(entry.yaw) ? entry.yaw : 0,
      home: {
        x: isFiniteNumber(home.x) ? home.x : entry.x,
        y: isFiniteNumber(home.y) ? home.y : entry.y,
        z: isFiniteNumber(home.z) ? home.z : entry.z,
      },
    });
  }
  return animals;
}

/** 把外部数据清洗成可信的存档对象；不合格时返回 null。 */
export function normalizeSave(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version !== SAVE_VERSION) return null;
  if (!CHARACTERS.some((character) => character.id === raw.characterId)) return null;
  if (!isInteger(raw.seed) || raw.seed <= 0) return null;

  const player = normalizePlayer(raw.player);
  if (!player) return null;
  const inventory = normalizeInventory(raw.inventory);
  if (!inventory) return null;
  if (!raw.world || !Array.isArray(raw.world.modifications)) return null;
  const modifications = normalizeModifications(raw.world.modifications);
  if (!modifications) return null;
  const animals = normalizeAnimals(raw.animals);
  if (!animals) return null;

  return {
    version: SAVE_VERSION,
    savedAt:
      typeof raw.savedAt === 'string' && raw.savedAt.length < 60
        ? raw.savedAt
        : new Date().toISOString(),
    characterId: raw.characterId,
    seed: raw.seed,
    player,
    inventory,
    quests: normalizeQuests(raw.quests),
    world: { modifications },
    animals,
    environment: {
      timeMinutes: isFiniteNumber(raw.environment?.timeMinutes)
        ? ((raw.environment.timeMinutes % 1440) + 1440) % 1440
        : 9 * 60 + 20,
      weather: ['sunny', 'rain', 'snow'].includes(raw.environment?.weather)
        ? raw.environment.weather
        : 'sunny',
    },
  };
}

export class SaveManager {
  constructor(storage = null) {
    try {
      this.storage = storage || window.localStorage;
    } catch (error) {
      this.storage = null;
    }
    this.lastError = '';
  }

  hasSave() {
    return Boolean(this.readSave());
  }

  readSave() {
    if (!this.storage) {
      this.lastError = '这个浏览器不允许保存存档。';
      return null;
    }
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return null;
      if (raw.length > MAX_SAVE_BYTES) {
        this.lastError = '存档太大，读取失败。';
        return null;
      }
      return normalizeSave(JSON.parse(raw));
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      return null;
    }
  }

  writeSave(data) {
    const normalized = normalizeSave(data);
    if (!normalized) {
      this.lastError = '这份存档缺少必要内容。';
      return { ok: false, error: this.lastError };
    }
    if (!this.storage) {
      return { ok: false, error: '这个浏览器不允许保存存档。' };
    }
    try {
      const serialized = JSON.stringify(normalized);
      if (serialized.length > MAX_SAVE_BYTES) {
        this.lastError = '存档太大了，浏览器存不下。';
        return { ok: false, error: this.lastError };
      }
      this.storage.setItem(SAVE_KEY, serialized);
      this.lastError = '';
      return { ok: true, data: normalized };
    } catch (error) {
      this.lastError =
        error?.name === 'QuotaExceededError'
          ? '浏览器空间不够啦，先清理一点照片吧。'
          : '保存失败，浏览器不允许写入存档。';
      return { ok: false, error: this.lastError };
    }
  }

  clearSave() {
    if (!this.storage) return { ok: false, error: '这个浏览器不允许保存存档。' };
    try {
      this.storage.removeItem(SAVE_KEY);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: '清除存档失败。' };
    }
  }

  exportSave(data) {
    const normalized = normalizeSave(data);
    if (!normalized) {
      return { ok: false, error: '还没有可以导出的存档。' };
    }
    try {
      const blob = new Blob([JSON.stringify(normalized, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const date = new Date();
      const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
        date.getDate(),
      ).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(
        date.getMinutes(),
      ).padStart(2, '0')}`;
      anchor.href = url;
      anchor.download = `美味特工队存档-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: '导出失败。' };
    }
  }

  async importFile(file) {
    if (!file) return { ok: false, error: '没有选择文件。' };
    if (file.size > MAX_SAVE_BYTES) {
      return { ok: false, error: '文件太大，不像是这个游戏的存档。' };
    }
    try {
      const text = await file.text();
      if (!text || text.length > MAX_SAVE_BYTES) {
        return { ok: false, error: '这不是有效存档' };
      }
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        return { ok: false, error: '这不是有效存档' };
      }
      const normalized = normalizeSave(parsed);
      if (!normalized) {
        return { ok: false, error: '这不是有效存档' };
      }
      return { ok: true, data: normalized };
    } catch (error) {
      return { ok: false, error: '读取文件失败，请再试一次。' };
    }
  }
}
