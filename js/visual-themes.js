/**
 * 视觉主题：天空、雾、灯光、世界色调和界面的配色。
 * 不复制任何外部游戏素材，只调整自己生成的像素世界。
 */

export const VISUAL_THEME_STORAGE_KEY = 'meiwei-visual-theme-v1';
export const DEFAULT_VISUAL_THEME_ID = 'classic';

export const VISUAL_THEMES = Object.freeze([
  {
    id: 'classic',
    name: '原版晴天',
    subtitle: '明亮、清楚，像刚打开的方块世界',
    icon: '🌿',
    swatches: ['#72c95b', '#3f9ee8', '#f4c542'],
    environment: {
      dayTop: '#3f9ee8',
      dayHorizon: '#c8f1ff',
      nightTop: '#0b173c',
      nightHorizon: '#263c66',
      sunsetTop: '#6c7ccc',
      sunsetHorizon: '#ffb07f',
      hemiSky: '#c7ecff',
      hemiGround: '#6f8859',
      ambient: '#dcecff',
      sun: '#fff2d2',
      fogNear: 42,
      fogFar: 96,
      sunScale: 1,
      ambientScale: 1,
      hemiScale: 1,
      moteColor: '#fff0a8',
    },
    worldTint: '#ffffff',
    waterTint: '#ffffff',
    uiAccent: '#f4c542',
  },
  {
    id: 'sakura',
    name: '樱花柔光',
    subtitle: '粉金色的黄昏，柔柔的暖光',
    icon: '🌸',
    swatches: ['#e990b5', '#ffd7c2', '#f4a7bb'],
    environment: {
      dayTop: '#d98bb4',
      dayHorizon: '#ffe4df',
      nightTop: '#2b153d',
      nightHorizon: '#673453',
      sunsetTop: '#9d4f91',
      sunsetHorizon: '#ff9f9b',
      hemiSky: '#ffd2e2',
      hemiGround: '#806756',
      ambient: '#ffe4ee',
      sun: '#ffe1c7',
      fogNear: 36,
      fogFar: 92,
      sunScale: 0.92,
      ambientScale: 1.08,
      hemiScale: 1.02,
      moteColor: '#ffd3e6',
    },
    worldTint: '#fff0f4',
    waterTint: '#ffd9f0',
    uiAccent: '#ef9cbd',
  },
  {
    id: 'neon',
    name: '深岩霓虹',
    subtitle: '夜色、青蓝雾和粉色霓虹',
    icon: '🌌',
    swatches: ['#2de2d0', '#ff65b1', '#17314a'],
    environment: {
      dayTop: '#092a3d',
      dayHorizon: '#1d6b71',
      nightTop: '#040913',
      nightHorizon: '#0a2438',
      sunsetTop: '#193a69',
      sunsetHorizon: '#b04b92',
      hemiSky: '#5af4e7',
      hemiGround: '#2b1b3b',
      ambient: '#4bb9c8',
      sun: '#b6fff2',
      fogNear: 30,
      fogFar: 78,
      sunScale: 0.72,
      ambientScale: 1.35,
      hemiScale: 1.18,
      moteColor: '#79fff0',
    },
    worldTint: '#d8ffff',
    waterTint: '#8ffcff',
    uiAccent: '#ff6bb5',
  },
]);

export function getVisualTheme(id) {
  return VISUAL_THEMES.find((theme) => theme.id === id) || VISUAL_THEMES[0];
}
