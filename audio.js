/**
 * 很小的合成音效系统。
 * 不需要下载音频文件，部署时不会有音频 404。
 */

export class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.unlocked = false;
  }

  unlock() {
    const context = this._ensureContext();
    if (!context) return false;
    this.unlocked = true;
    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }
    return true;
  }

  _ensureContext() {
    if (this.context) return this.context;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    try {
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.14;
      this.master.connect(this.context.destination);
      return this.context;
    } catch (error) {
      console.warn('[美味特工队] 音频初始化失败，游戏仍可继续：', error);
      return null;
    }
  }

  _tone({
    frequency = 440,
    endFrequency = frequency,
    duration = 0.1,
    type = 'triangle',
    volume = 0.2,
    delay = 0,
  } = {}) {
    const context = this._ensureContext();
    if (!context || !this.master) return;
    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }

    try {
      const startTime = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(40, frequency), startTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(40, endFrequency),
        startTime + duration,
      );
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration + 0.02);
    } catch (error) {
      // 音频失败永远不能阻止游戏继续。
    }
  }

  playSelect() {
    this._tone({ frequency: 620, endFrequency: 760, duration: 0.07, volume: 0.12 });
  }

  playPlace() {
    this._tone({ frequency: 190, endFrequency: 260, duration: 0.12, volume: 0.22, type: 'triangle' });
    this._tone({ frequency: 380, endFrequency: 420, duration: 0.08, volume: 0.08, delay: 0.02 });
  }

  playBreak() {
    this._tone({ frequency: 210, endFrequency: 95, duration: 0.14, volume: 0.22, type: 'square' });
    this._tone({ frequency: 520, endFrequency: 260, duration: 0.07, volume: 0.08, type: 'triangle' });
  }

  playMagnet() {
    this._tone({ frequency: 760, endFrequency: 1180, duration: 0.12, volume: 0.12 });
    this._tone({ frequency: 1180, endFrequency: 1560, duration: 0.1, volume: 0.08, delay: 0.08 });
  }

  playError() {
    this._tone({ frequency: 180, endFrequency: 120, duration: 0.14, volume: 0.16, type: 'sawtooth' });
  }

  playInventory() {
    this._tone({ frequency: 330, endFrequency: 480, duration: 0.09, volume: 0.1, type: 'sine' });
  }

  playCamera() {
    this._tone({ frequency: 1250, endFrequency: 420, duration: 0.06, volume: 0.13, type: 'square' });
    this._tone({ frequency: 380, endFrequency: 240, duration: 0.07, volume: 0.07, type: 'triangle', delay: 0.06 });
  }

  playSuccess() {
    this._tone({ frequency: 520, endFrequency: 660, duration: 0.12, volume: 0.14 });
    this._tone({ frequency: 660, endFrequency: 880, duration: 0.14, volume: 0.12, delay: 0.11 });
    this._tone({ frequency: 880, endFrequency: 1040, duration: 0.2, volume: 0.1, delay: 0.23 });
  }
}
