/**
 * 作品集：把当前 3D 画布拍照并保存到浏览器本地。
 * 最多保存 9 张，避免 localStorage 被图片塞满。
 */

export const GALLERY_KEY = 'meiwei-gallery-v1';
export const MAX_PHOTOS = 9;
export const GALLERY_SESSION_KEY = 'meiwei-gallery-session-v1';
const MAX_DATA_URL_LENGTH = 2200000;
const MAX_CAPTURE_SIDE = 960;
const CAPTURE_QUALITY = 0.72;

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
    try {
      this.sessionStorage = window.sessionStorage;
    } catch (error) {
      this.sessionStorage = null;
    }
    this._memoryPhotos = [];
    this._fallback = 'local';
  }

  _read(store) {
    if (!store) return [];
    try {
      const raw = store.getItem(GALLERY_KEY) || store.getItem(GALLERY_SESSION_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidPhoto).slice(0, MAX_PHOTOS);
    } catch (error) {
      return [];
    }
  }

  list() {
    if (this._fallback === 'memory') return this._memoryPhotos.slice();
    if (this._fallback === 'session') {
      const session = this._read(this.sessionStorage);
      if (session.length) return session;
    }
    const local = this._read(this.storage);
    if (local.length) return local;
    const session = this._read(this.sessionStorage);
    if (session.length) return session;
    return this._memoryPhotos.slice();
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
      const scale = Math.min(1, MAX_CAPTURE_SIDE / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));

      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const ctx = output.getContext('2d');
      ctx.fillStyle = '#9ad9ff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(canvas, 0, 0, width, height);
      const dataUrl = output.toDataURL('image/jpeg', CAPTURE_QUALITY);
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
    const saved = this._write(photos, { allowPrune: true });
    if (!saved.ok) return saved;
    return { ok: true, photo, photos: saved.photos, pruned: saved.pruned, storage: saved.storage };
  }

  remove(id) {
    const photos = this.list().filter((photo) => photo.id !== id);
    const saved = this._write(photos);
    if (!saved.ok) return saved;
    return { ok: true, photos: saved.photos };
  }

  clear() {
    return this._write([]);
  }

  _saveFallback(photos, pruned) {
    try {
      this.storage?.removeItem(GALLERY_KEY);
    } catch (error) {
      // 忽略清理失败。
    }
    try {
      if (this.sessionStorage) {
        this.sessionStorage.setItem(GALLERY_SESSION_KEY, JSON.stringify(photos));
        this._fallback = 'session';
        this._memoryPhotos = photos.slice();
        return { ok: true, photos: photos.slice(), pruned, storage: 'session' };
      }
    } catch (error) {
      // sessionStorage 也可能被浏览器禁用，继续退到内存。
    }
    this._memoryPhotos = photos.slice();
    this._fallback = 'memory';
    return { ok: true, photos: photos.slice(), pruned, storage: 'memory' };
  }

  _write(photos, { allowPrune = false } = {}) {
    let current = photos.slice(0, MAX_PHOTOS);
    let pruned = 0;
    for (;;) {
      if (this.storage) {
        try {
          this.storage.setItem(GALLERY_KEY, JSON.stringify(current));
          this._fallback = 'local';
          this._memoryPhotos = current.slice();
          try {
            this.sessionStorage?.removeItem(GALLERY_SESSION_KEY);
          } catch (error) {
            // 忽略清理失败。
          }
          return { ok: true, photos: current.slice(), pruned, storage: 'local' };
        } catch (error) {
          const quota = error?.name === 'QuotaExceededError' || error?.code === 22;
          if (quota && allowPrune && current.length > 1) {
            current = current.slice(0, -1);
            pruned += 1;
            continue;
          }
          // 旧相册可能已经损坏/过大，但列表里看不到；先释放这个 key 再重试一次。
          if (quota) {
            try {
              this.storage.removeItem(GALLERY_KEY);
              this.storage.setItem(GALLERY_KEY, JSON.stringify(current));
              this._fallback = 'local';
              this._memoryPhotos = current.slice();
              return { ok: true, photos: current.slice(), pruned, storage: 'local' };
            } catch (retryError) {
              // 继续尝试 sessionStorage / 内存。
            }
          }
          return this._saveFallback(current, pruned);
        }
      }
      return this._saveFallback(current, pruned);
    }
}
}
