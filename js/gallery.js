/**
 * 作品集：把当前 3D 画布拍照并保存到浏览器本地。
 * 最多保存 9 张，避免 localStorage 被图片塞满。
 */

export const GALLERY_KEY = 'meiwei-gallery-v1';
export const MAX_PHOTOS = 9;
const MAX_DATA_URL_LENGTH = 2200000;

function safeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isValidPhoto(photo) {
  return (
    photo &&
    typeof photo === 'object' &&
    typeof photo.id === 'string' &&
    typeof photo.dataUrl === 'string' &&
    photo.dataUrl.startsWith('data:image/') &&
    photo.dataUrl.length < MAX_DATA_URL_LENGTH &&
    typeof photo.createdAt === 'string'
  );
}

export class GalleryManager {
  constructor(storage = null) {
    try {
      this.storage = storage || window.localStorage;
    } catch (error) {
      this.storage = null;
    }
  }

  list() {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(GALLERY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidPhoto).slice(0, MAX_PHOTOS);
    } catch (error) {
      return [];
    }
  }

  count() {
    return this.list().length;
  }

  capture(canvas, meta = {}) {
    if (!canvas || typeof canvas.toDataURL !== 'function') {
      return null;
    }
    try {
      const sourceWidth = canvas.width;
      const sourceHeight = canvas.height;
      if (!sourceWidth || !sourceHeight) return null;
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));

      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const ctx = output.getContext('2d');
      ctx.fillStyle = '#9ad9ff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(canvas, 0, 0, width, height);
      const dataUrl = output.toDataURL('image/jpeg', 0.82);
      if (!dataUrl.startsWith('data:image/') || dataUrl.length > MAX_DATA_URL_LENGTH) {
        return null;
      }
      return {
        id: safeId(),
        dataUrl,
        createdAt: new Date().toISOString(),
        characterName: typeof meta.characterName === 'string' ? meta.characterName : '',
        biome: typeof meta.biome === 'string' ? meta.biome : '',
        coords: {
          x: Number(meta.coords?.x) || 0,
          y: Number(meta.coords?.y) || 0,
          z: Number(meta.coords?.z) || 0,
        },
      };
    } catch (error) {
      return null;
    }
  }

  addFromCanvas(canvas, meta = {}) {
    const photos = this.list();
    if (photos.length >= MAX_PHOTOS) {
      return { ok: false, error: `作品集满啦，最多保存 ${MAX_PHOTOS} 张，先删一张吧。` };
    }
    const photo = this.capture(canvas, meta);
    if (!photo) return { ok: false, error: '拍照失败，再试一次吧。' };
    photos.unshift(photo);
    const saved = this._write(photos);
    if (!saved.ok) return saved;
    return { ok: true, photo, photos };
  }

  remove(id) {
    const photos = this.list().filter((photo) => photo.id !== id);
    const saved = this._write(photos);
    if (!saved.ok) return saved;
    return { ok: true, photos };
  }

  clear() {
    return this._write([]);
  }

  _write(photos) {
    if (!this.storage) {
      return { ok: false, error: '这个浏览器不允许保存照片。' };
    }
    try {
      this.storage.setItem(GALLERY_KEY, JSON.stringify(photos.slice(0, MAX_PHOTOS)));
      return { ok: true, photos: photos.slice(0, MAX_PHOTOS) };
    } catch (error) {
      return {
        ok: false,
        error:
          error?.name === 'QuotaExceededError'
            ? '浏览器空间不够，照片没有保存。先删掉几张旧照片吧。'
            : '照片保存失败。',
      };
    }
  }
}
