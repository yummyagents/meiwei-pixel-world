/** 游戏的一些固定设置。修改世界种子可以让同一套地形重新洗牌。 */
export const GAME_CONFIG = Object.freeze({
  worldSeed: 20261028,
  renderDistance: 3,
  cameraFar: 320,
  maxPixelRatio: 1.75,
  // 家长自愿赞助页地址。填好后首页“家长赞助”会打开它；留空则显示“渠道准备中”。
  supportUrl: '',
  supportLabel: '家长自愿赞助',
  shareTitle: '美味特工队：像素方块世界',
});
