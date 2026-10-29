/**
 * 方块定义 + 像素贴图图集。
 *
 * 这里只放“数据”和 2D 画布贴图，不引用 Three.js。
 * world.js 会把图集变成 Three.js 纹理，方便以后背包、合成等功能复用。
 */

export const TILE_SIZE = 16;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 8;

/** 贴图图集内的格子编号（从左到右、从上到下）。 */
export const TILES = Object.freeze({
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  LOG_SIDE: 6,
  LOG_TOP: 7,
  LEAVES: 8,
  BRICK: 9,
  GLASS: 10,
  BOOKSHELF: 11,
  FLOWER: 12,
  CACTUS_SIDE: 13,
  CACTUS_TOP: 14,
  SNOW: 15,
  CHERRY_LEAVES: 16,
  CHERRY_LOG: 17,
  PLANKS: 18,
  ROOF: 19,
  SNOW_SIDE: 20,
  COBBLESTONE: 21,
  MOSSY_STONE: 22,
  STONE_BRICKS: 23,
  GRAVEL: 24,
  COAL_ORE: 25,
  IRON_ORE: 26,
  DIAMOND_ORE: 27,
  BEDROCK: 28,
  MOSS: 29,
  AZALEA_LEAVES: 30,
  GLOW_BERRIES: 31,
  SULFUR: 32,
  BASALT: 33,
  SULFUR_CRYSTAL: 34,
  JUNGLE_WOOD: 35,
  JUNGLE_LEAVES: 36,
  VINE: 37,
  TORCH: 38,
  RAIL: 39,
  DARK_PLANKS: 40,
  WHEAT: 41,
  CHEST: 42,
  LAVA: 43,
  COPPER: 44,
  NEON: 45,
  AMETHYST: 46,
  CALCITE: 47,
  AMETHYST_CRYSTAL: 48,
  LANTERN: 49,
  COBWEB: 50,
  OBSIDIAN: 51,
  GOLD: 52,
  NETHERRACK: 53,
  SOUL_SAND: 54,
  NETHER_BRICK: 55,
});

export const BLOCK_IDS = Object.freeze({
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  WOOD: 6,
  LEAVES: 7,
  BRICK: 8,
  GLASS: 9,
  BOOKSHELF: 10,
  FLOWER: 11,
  CACTUS: 12,
  SNOW: 13,
  CHERRY_LEAVES: 14,
  CHERRY_WOOD: 15,
  PLANKS: 16,
  ROOF: 17,
  COBBLESTONE: 18,
  MOSSY_STONE: 19,
  STONE_BRICKS: 20,
  GRAVEL: 21,
  COAL_ORE: 22,
  IRON_ORE: 23,
  DIAMOND_ORE: 24,
  BEDROCK: 25,
  MOSS: 26,
  AZALEA_LEAVES: 27,
  GLOW_BERRIES: 28,
  SULFUR: 29,
  BASALT: 30,
  SULFUR_CRYSTAL: 31,
  JUNGLE_WOOD: 32,
  JUNGLE_LEAVES: 33,
  VINE: 34,
  TORCH: 35,
  RAIL: 36,
  DARK_PLANKS: 37,
  WHEAT: 38,
  CHEST: 39,
  LAVA: 40,
  COPPER: 41,
  NEON: 42,
  AMETHYST: 43,
  CALCITE: 44,
  AMETHYST_CRYSTAL: 45,
  LANTERN: 46,
  COBWEB: 47,
  OBSIDIAN: 48,
  GOLD: 49,
  NETHERRACK: 50,
  SOUL_SAND: 51,
  NETHER_BRICK: 52,
});

/**
 * 每个方块都有六面贴图信息、是否实心等属性。
 * solid=false 表示玩家可以穿过去（例如小花）。
 */
export const BLOCKS = Object.freeze({
  [BLOCK_IDS.GRASS]: {
    id: BLOCK_IDS.GRASS,
    key: 'grass',
    name: '草方块',
    icon: '🟩',
    solid: true,
    transparent: false,
    tiles: { top: TILES.GRASS_TOP, bottom: TILES.DIRT, side: TILES.GRASS_SIDE },
  },
  [BLOCK_IDS.DIRT]: {
    id: BLOCK_IDS.DIRT,
    key: 'dirt',
    name: '泥土',
    icon: '🟫',
    solid: true,
    transparent: false,
    tiles: { top: TILES.DIRT, bottom: TILES.DIRT, side: TILES.DIRT },
  },
  [BLOCK_IDS.STONE]: {
    id: BLOCK_IDS.STONE,
    key: 'stone',
    name: '石头',
    icon: '⬜',
    solid: true,
    transparent: false,
    tiles: { top: TILES.STONE, bottom: TILES.STONE, side: TILES.STONE },
  },
  [BLOCK_IDS.SAND]: {
    id: BLOCK_IDS.SAND,
    key: 'sand',
    name: '沙子',
    icon: '🟨',
    solid: true,
    transparent: false,
    tiles: { top: TILES.SAND, bottom: TILES.SAND, side: TILES.SAND },
  },
  [BLOCK_IDS.WATER]: {
    id: BLOCK_IDS.WATER,
    key: 'water',
    name: '水',
    icon: '🟦',
    solid: false,
    transparent: true,
    liquid: true,
    tiles: { top: TILES.WATER, bottom: TILES.WATER, side: TILES.WATER },
  },
  [BLOCK_IDS.WOOD]: {
    id: BLOCK_IDS.WOOD,
    key: 'wood',
    name: '木头',
    icon: '🪵',
    solid: true,
    transparent: false,
    tiles: { top: TILES.LOG_TOP, bottom: TILES.LOG_TOP, side: TILES.LOG_SIDE },
  },
  [BLOCK_IDS.LEAVES]: {
    id: BLOCK_IDS.LEAVES,
    key: 'leaves',
    name: '树叶',
    icon: '🌿',
    solid: true,
    transparent: false,
    tiles: { top: TILES.LEAVES, bottom: TILES.LEAVES, side: TILES.LEAVES },
  },
  [BLOCK_IDS.BRICK]: {
    id: BLOCK_IDS.BRICK,
    key: 'brick',
    name: '砖块',
    icon: '🧱',
    solid: true,
    transparent: false,
    tiles: { top: TILES.BRICK, bottom: TILES.BRICK, side: TILES.BRICK },
  },
  [BLOCK_IDS.GLASS]: {
    id: BLOCK_IDS.GLASS,
    key: 'glass',
    name: '玻璃',
    icon: '🪟',
    solid: true,
    transparent: true,
    tiles: { top: TILES.GLASS, bottom: TILES.GLASS, side: TILES.GLASS },
  },
  [BLOCK_IDS.BOOKSHELF]: {
    id: BLOCK_IDS.BOOKSHELF,
    key: 'bookshelf',
    name: '书架',
    icon: '📚',
    solid: true,
    transparent: false,
    tiles: { top: TILES.PLANKS, bottom: TILES.PLANKS, side: TILES.BOOKSHELF },
  },
  [BLOCK_IDS.FLOWER]: {
    id: BLOCK_IDS.FLOWER,
    key: 'flower',
    name: '小花',
    icon: '🌼',
    solid: false,
    transparent: true,
    cross: true,
    tiles: { top: TILES.FLOWER, bottom: TILES.FLOWER, side: TILES.FLOWER },
  },
  [BLOCK_IDS.CACTUS]: {
    id: BLOCK_IDS.CACTUS,
    key: 'cactus',
    name: '仙人掌',
    icon: '🌵',
    solid: true,
    transparent: false,
    tiles: { top: TILES.CACTUS_TOP, bottom: TILES.CACTUS_TOP, side: TILES.CACTUS_SIDE },
  },
  [BLOCK_IDS.SNOW]: {
    id: BLOCK_IDS.SNOW,
    key: 'snow',
    name: '雪块',
    icon: '⬜',
    solid: true,
    transparent: false,
    tiles: { top: TILES.SNOW, bottom: TILES.DIRT, side: TILES.SNOW_SIDE },
  },
  [BLOCK_IDS.CHERRY_LEAVES]: {
    id: BLOCK_IDS.CHERRY_LEAVES,
    key: 'cherry_leaves',
    name: '樱花叶',
    icon: '🌸',
    solid: true,
    transparent: false,
    tiles: {
      top: TILES.CHERRY_LEAVES,
      bottom: TILES.CHERRY_LEAVES,
      side: TILES.CHERRY_LEAVES,
    },
  },
  [BLOCK_IDS.CHERRY_WOOD]: {
    id: BLOCK_IDS.CHERRY_WOOD,
    key: 'cherry_wood',
    name: '樱木',
    icon: '🪵',
    solid: true,
    transparent: false,
    tiles: { top: TILES.LOG_TOP, bottom: TILES.LOG_TOP, side: TILES.CHERRY_LOG },
  },
  [BLOCK_IDS.PLANKS]: {
    id: BLOCK_IDS.PLANKS,
    key: 'planks',
    name: '木板',
    icon: '🟫',
    solid: true,
    transparent: false,
    tiles: { top: TILES.PLANKS, bottom: TILES.PLANKS, side: TILES.PLANKS },
  },
  [BLOCK_IDS.ROOF]: {
    id: BLOCK_IDS.ROOF,
    key: 'roof',
    name: '红屋顶',
    icon: '🟥',
    solid: true,
    transparent: false,
    tiles: { top: TILES.ROOF, bottom: TILES.ROOF, side: TILES.ROOF },
  },
  [BLOCK_IDS.COBBLESTONE]: {
    id: BLOCK_IDS.COBBLESTONE,
    key: 'cobblestone',
    name: '圆石',
    icon: '🪨',
    solid: true,
    transparent: false,
    tiles: { top: TILES.COBBLESTONE, bottom: TILES.COBBLESTONE, side: TILES.COBBLESTONE },
  },
  [BLOCK_IDS.MOSSY_STONE]: {
    id: BLOCK_IDS.MOSSY_STONE,
    key: 'mossy_stone',
    name: '苔石',
    icon: '🟩',
    solid: true,
    transparent: false,
    tiles: { top: TILES.MOSSY_STONE, bottom: TILES.MOSSY_STONE, side: TILES.MOSSY_STONE },
  },
  [BLOCK_IDS.STONE_BRICKS]: {
    id: BLOCK_IDS.STONE_BRICKS,
    key: 'stone_bricks',
    name: '石砖',
    icon: '🧱',
    solid: true,
    transparent: false,
    tiles: { top: TILES.STONE_BRICKS, bottom: TILES.STONE_BRICKS, side: TILES.STONE_BRICKS },
  },
  [BLOCK_IDS.GRAVEL]: {
    id: BLOCK_IDS.GRAVEL,
    key: 'gravel',
    name: '沙砾',
    icon: '🪨',
    solid: true,
    transparent: false,
    tiles: { top: TILES.GRAVEL, bottom: TILES.GRAVEL, side: TILES.GRAVEL },
  },
  [BLOCK_IDS.COAL_ORE]: {
    id: BLOCK_IDS.COAL_ORE,
    key: 'coal_ore',
    name: '煤矿石',
    icon: '⚫',
    solid: true,
    transparent: false,
    tiles: { top: TILES.COAL_ORE, bottom: TILES.COAL_ORE, side: TILES.COAL_ORE },
  },
  [BLOCK_IDS.IRON_ORE]: {
    id: BLOCK_IDS.IRON_ORE,
    key: 'iron_ore',
    name: '铁矿石',
    icon: '🟤',
    solid: true,
    transparent: false,
    tiles: { top: TILES.IRON_ORE, bottom: TILES.IRON_ORE, side: TILES.IRON_ORE },
  },
  [BLOCK_IDS.DIAMOND_ORE]: {
    id: BLOCK_IDS.DIAMOND_ORE,
    key: 'diamond_ore',
    name: '钻石矿',
    icon: '💎',
    solid: true,
    transparent: false,
    tiles: { top: TILES.DIAMOND_ORE, bottom: TILES.DIAMOND_ORE, side: TILES.DIAMOND_ORE },
  },
  [BLOCK_IDS.BEDROCK]: {
    id: BLOCK_IDS.BEDROCK,
    key: 'bedrock',
    name: '基岩',
    icon: '⬛',
    solid: true,
    transparent: false,
    unbreakable: true,
    tiles: { top: TILES.BEDROCK, bottom: TILES.BEDROCK, side: TILES.BEDROCK },
  },
  [BLOCK_IDS.MOSS]: {
    id: BLOCK_IDS.MOSS,
    key: 'moss',
    name: '苔藓块',
    icon: '🟩',
    solid: true,
    transparent: false,
    tiles: { top: TILES.MOSS, bottom: TILES.DIRT, side: TILES.MOSS },
  },
  [BLOCK_IDS.AZALEA_LEAVES]: {
    id: BLOCK_IDS.AZALEA_LEAVES,
    key: 'azalea_leaves',
    name: '杜鹃叶',
    icon: '🌺',
    solid: true,
    transparent: false,
    tiles: { top: TILES.AZALEA_LEAVES, bottom: TILES.AZALEA_LEAVES, side: TILES.AZALEA_LEAVES },
  },
  [BLOCK_IDS.GLOW_BERRIES]: {
    id: BLOCK_IDS.GLOW_BERRIES,
    key: 'glow_berries',
    name: '发光浆果',
    icon: '✨',
    solid: false,
    transparent: true,
    cross: true,
    tiles: { top: TILES.GLOW_BERRIES, bottom: TILES.GLOW_BERRIES, side: TILES.GLOW_BERRIES },
  },
  [BLOCK_IDS.SULFUR]: {
    id: BLOCK_IDS.SULFUR,
    key: 'sulfur',
    name: '硫磺块',
    icon: '🟨',
    solid: true,
    transparent: false,
    tiles: { top: TILES.SULFUR, bottom: TILES.SULFUR, side: TILES.SULFUR },
  },
  [BLOCK_IDS.BASALT]: {
    id: BLOCK_IDS.BASALT,
    key: 'basalt',
    name: '玄武岩',
    icon: '⬛',
    solid: true,
    transparent: false,
    tiles: { top: TILES.BASALT, bottom: TILES.BASALT, side: TILES.BASALT },
  },
  [BLOCK_IDS.SULFUR_CRYSTAL]: {
    id: BLOCK_IDS.SULFUR_CRYSTAL,
    key: 'sulfur_crystal',
    name: '硫磺晶簇',
    icon: '💛',
    solid: false,
    transparent: true,
    cross: true,
    tiles: { top: TILES.SULFUR_CRYSTAL, bottom: TILES.SULFUR_CRYSTAL, side: TILES.SULFUR_CRYSTAL },
  },
  [BLOCK_IDS.JUNGLE_WOOD]: {
    id: BLOCK_IDS.JUNGLE_WOOD,
    key: 'jungle_wood',
    name: '丛林木',
    icon: '🪵',
    solid: true,
    transparent: false,
    tiles: { top: TILES.LOG_TOP, bottom: TILES.LOG_TOP, side: TILES.JUNGLE_WOOD },
  },
  [BLOCK_IDS.JUNGLE_LEAVES]: {
    id: BLOCK_IDS.JUNGLE_LEAVES,
    key: 'jungle_leaves',
    name: '丛林叶',
    icon: '🌴',
    solid: true,
    transparent: false,
    tiles: { top: TILES.JUNGLE_LEAVES, bottom: TILES.JUNGLE_LEAVES, side: TILES.JUNGLE_LEAVES },
  },
  [BLOCK_IDS.VINE]: {
    id: BLOCK_IDS.VINE,
    key: 'vine',
    name: '藤蔓',
    icon: '🌿',
    solid: false,
    transparent: true,
    cross: true,
    tiles: { top: TILES.VINE, bottom: TILES.VINE, side: TILES.VINE },
  },
  [BLOCK_IDS.TORCH]: {
    id: BLOCK_IDS.TORCH,
    key: 'torch',
    name: '火把',
    icon: '🔥',
    solid: false,
    transparent: true,
    cross: true,
    tiles: { top: TILES.TORCH, bottom: TILES.TORCH, side: TILES.TORCH },
  },
  [BLOCK_IDS.RAIL]: {
    id: BLOCK_IDS.RAIL,
    key: 'rail',
    name: '铁轨',
    icon: '🛤️',
    solid: false,
    transparent: true,
    flat: true,
    tiles: { top: TILES.RAIL, bottom: TILES.RAIL, side: TILES.RAIL },
  },
  [BLOCK_IDS.DARK_PLANKS]: {
    id: BLOCK_IDS.DARK_PLANKS,
    key: 'dark_planks',
    name: '深色木板',
    icon: '🟫',
    solid: true,
    transparent: false,
    tiles: { top: TILES.DARK_PLANKS, bottom: TILES.DARK_PLANKS, side: TILES.DARK_PLANKS },
  },
  [BLOCK_IDS.WHEAT]: {
    id: BLOCK_IDS.WHEAT,
    key: 'wheat',
    name: '小麦',
    icon: '🌾',
    solid: false,
    transparent: true,
    cross: true,
    tiles: { top: TILES.WHEAT, bottom: TILES.WHEAT, side: TILES.WHEAT },
  },
  [BLOCK_IDS.CHEST]: {
    id: BLOCK_IDS.CHEST,
    key: 'chest',
    name: '宝箱',
    icon: '📦',
    solid: true,
    transparent: false,
    tiles: { top: TILES.CHEST, bottom: TILES.CHEST, side: TILES.CHEST },
  },
  [BLOCK_IDS.LAVA]: {
    id: BLOCK_IDS.LAVA,
    key: 'lava',
    name: '熔岩',
    icon: '🌋',
    solid: false,
    transparent: false,
    liquid: true,
    hot: true,
    tiles: { top: TILES.LAVA, bottom: TILES.LAVA, side: TILES.LAVA },
  },
  [BLOCK_IDS.COPPER]: {
    id: BLOCK_IDS.COPPER,
    key: 'copper',
    name: '铜块',
    icon: '🟠',
    solid: true,
    transparent: false,
    tiles: { top: TILES.COPPER, bottom: TILES.COPPER, side: TILES.COPPER },
  },
  [BLOCK_IDS.NEON]: {
    id: BLOCK_IDS.NEON,
    key: 'neon',
    name: '霓虹灯',
    icon: '💡',
    solid: true,
    transparent: false,
    bright: true,
    tiles: { top: TILES.NEON, bottom: TILES.NEON, side: TILES.NEON },
  },
  [BLOCK_IDS.AMETHYST]: {
    id: BLOCK_IDS.AMETHYST,
    key: 'amethyst',
    name: '紫水晶块',
    icon: '💜',
    solid: true,
    transparent: false,
    tiles: { top: TILES.AMETHYST, bottom: TILES.AMETHYST, side: TILES.AMETHYST },
  },
  [BLOCK_IDS.CALCITE]: {
    id: BLOCK_IDS.CALCITE,
    key: 'calcite',
    name: '方解石',
    icon: '🤍',
    solid: true,
    transparent: false,
    tiles: { top: TILES.CALCITE, bottom: TILES.CALCITE, side: TILES.CALCITE },
  },
  [BLOCK_IDS.AMETHYST_CRYSTAL]: {
    id: BLOCK_IDS.AMETHYST_CRYSTAL,
    key: 'amethyst_crystal',
    name: '紫水晶晶簇',
    icon: '🔮',
    solid: false,
    transparent: true,
    cross: true,
    bright: true,
    tiles: { top: TILES.AMETHYST_CRYSTAL, bottom: TILES.AMETHYST_CRYSTAL, side: TILES.AMETHYST_CRYSTAL },
  },
  [BLOCK_IDS.LANTERN]: {
    id: BLOCK_IDS.LANTERN,
    key: 'lantern',
    name: '暖光灯笼',
    icon: '🏮',
    solid: false,
    transparent: false,
    bright: true,
    tiles: { top: TILES.LANTERN, bottom: TILES.LANTERN, side: TILES.LANTERN },
  },
  [BLOCK_IDS.COBWEB]: {
    id: BLOCK_IDS.COBWEB,
    key: 'cobweb',
    name: '蜘蛛网',
    icon: '🕸️',
    solid: false,
    transparent: true,
    cross: true,
    tiles: { top: TILES.COBWEB, bottom: TILES.COBWEB, side: TILES.COBWEB },
  },
  [BLOCK_IDS.OBSIDIAN]: {
    id: BLOCK_IDS.OBSIDIAN,
    key: 'obsidian',
    name: '黑曜石',
    icon: '⬛',
    solid: true,
    transparent: false,
    tiles: { top: TILES.OBSIDIAN, bottom: TILES.OBSIDIAN, side: TILES.OBSIDIAN },
  },
  [BLOCK_IDS.GOLD]: {
    id: BLOCK_IDS.GOLD,
    key: 'gold',
    name: '金块',
    icon: '🟨',
    solid: true,
    transparent: false,
    tiles: { top: TILES.GOLD, bottom: TILES.GOLD, side: TILES.GOLD },
  },
  [BLOCK_IDS.NETHERRACK]: {
    id: BLOCK_IDS.NETHERRACK,
    key: 'netherrack',
    name: '下界岩',
    icon: '🟥',
    solid: true,
    transparent: false,
    tiles: { top: TILES.NETHERRACK, bottom: TILES.NETHERRACK, side: TILES.NETHERRACK },
  },
  [BLOCK_IDS.SOUL_SAND]: {
    id: BLOCK_IDS.SOUL_SAND,
    key: 'soul_sand',
    name: '灵魂沙',
    icon: '🟫',
    solid: true,
    transparent: false,
    tiles: { top: TILES.SOUL_SAND, bottom: TILES.SOUL_SAND, side: TILES.SOUL_SAND },
  },
  [BLOCK_IDS.NETHER_BRICK]: {
    id: BLOCK_IDS.NETHER_BRICK,
    key: 'nether_brick',
    name: '下界砖',
    icon: '🧱',
    solid: true,
    transparent: false,
    tiles: { top: TILES.NETHER_BRICK, bottom: TILES.NETHER_BRICK, side: TILES.NETHER_BRICK },
  },
});

/** 给背包按固定顺序展示的基础方块。 */
export const CREATIVE_BLOCKS = Object.freeze([
  BLOCK_IDS.GRASS,
  BLOCK_IDS.DIRT,
  BLOCK_IDS.STONE,
  BLOCK_IDS.SAND,
  BLOCK_IDS.WATER,
  BLOCK_IDS.LAVA,
  BLOCK_IDS.COPPER,
  BLOCK_IDS.NEON,
  BLOCK_IDS.AMETHYST,
  BLOCK_IDS.CALCITE,
  BLOCK_IDS.AMETHYST_CRYSTAL,
  BLOCK_IDS.LANTERN,
  BLOCK_IDS.COBWEB,
  BLOCK_IDS.OBSIDIAN,
  BLOCK_IDS.GOLD,
  BLOCK_IDS.NETHERRACK,
  BLOCK_IDS.SOUL_SAND,
  BLOCK_IDS.NETHER_BRICK,
  BLOCK_IDS.WOOD,
  BLOCK_IDS.CHERRY_WOOD,
  BLOCK_IDS.LEAVES,
  BLOCK_IDS.BRICK,
  BLOCK_IDS.GLASS,
  BLOCK_IDS.BOOKSHELF,
  BLOCK_IDS.FLOWER,
  BLOCK_IDS.CACTUS,
  BLOCK_IDS.SNOW,
  BLOCK_IDS.CHERRY_LEAVES,
  BLOCK_IDS.PLANKS,
  BLOCK_IDS.ROOF,
  BLOCK_IDS.COBBLESTONE,
  BLOCK_IDS.MOSSY_STONE,
  BLOCK_IDS.STONE_BRICKS,
  BLOCK_IDS.GRAVEL,
  BLOCK_IDS.COAL_ORE,
  BLOCK_IDS.IRON_ORE,
  BLOCK_IDS.DIAMOND_ORE,
  BLOCK_IDS.MOSS,
  BLOCK_IDS.AZALEA_LEAVES,
  BLOCK_IDS.GLOW_BERRIES,
  BLOCK_IDS.SULFUR,
  BLOCK_IDS.BASALT,
  BLOCK_IDS.SULFUR_CRYSTAL,
  BLOCK_IDS.JUNGLE_WOOD,
  BLOCK_IDS.JUNGLE_LEAVES,
  BLOCK_IDS.VINE,
  BLOCK_IDS.TORCH,
  BLOCK_IDS.RAIL,
  BLOCK_IDS.DARK_PLANKS,
  BLOCK_IDS.WHEAT,
  BLOCK_IDS.CHEST,
]);

/** 快捷栏小图标、破坏粒子等地方会用到的方块主色。 */
export const BLOCK_COLORS = Object.freeze({
  [BLOCK_IDS.GRASS]: '#6fcb57',
  [BLOCK_IDS.DIRT]: '#9b6644',
  [BLOCK_IDS.STONE]: '#8b9099',
  [BLOCK_IDS.SAND]: '#f2d483',
  [BLOCK_IDS.WATER]: '#45b7e8',
  [BLOCK_IDS.WOOD]: '#7b5233',
  [BLOCK_IDS.LEAVES]: '#3e9b3c',
  [BLOCK_IDS.BRICK]: '#b75243',
  [BLOCK_IDS.GLASS]: '#bfefff',
  [BLOCK_IDS.BOOKSHELF]: '#8b5b34',
  [BLOCK_IDS.FLOWER]: '#ffd84e',
  [BLOCK_IDS.CACTUS]: '#3f9e55',
  [BLOCK_IDS.SNOW]: '#f4fbff',
  [BLOCK_IDS.CHERRY_LEAVES]: '#f39ac0',
  [BLOCK_IDS.CHERRY_WOOD]: '#7b4d4d',
  [BLOCK_IDS.PLANKS]: '#bc8a55',
  [BLOCK_IDS.ROOF]: '#dd5d4f',
  [BLOCK_IDS.COBBLESTONE]: '#8b9099',
  [BLOCK_IDS.MOSSY_STONE]: '#7d9275',
  [BLOCK_IDS.STONE_BRICKS]: '#9da3ab',
  [BLOCK_IDS.GRAVEL]: '#9a948b',
  [BLOCK_IDS.COAL_ORE]: '#5f646c',
  [BLOCK_IDS.IRON_ORE]: '#b69a83',
  [BLOCK_IDS.DIAMOND_ORE]: '#67dfe0',
  [BLOCK_IDS.BEDROCK]: '#3f4148',
  [BLOCK_IDS.MOSS]: '#5f9b48',
  [BLOCK_IDS.AZALEA_LEAVES]: '#4f9b52',
  [BLOCK_IDS.GLOW_BERRIES]: '#e6bd4f',
  [BLOCK_IDS.SULFUR]: '#e7cf4a',
  [BLOCK_IDS.BASALT]: '#4d5058',
  [BLOCK_IDS.SULFUR_CRYSTAL]: '#f7dc58',
  [BLOCK_IDS.JUNGLE_WOOD]: '#6d5232',
  [BLOCK_IDS.JUNGLE_LEAVES]: '#2f7a3b',
  [BLOCK_IDS.VINE]: '#3b8a3f',
  [BLOCK_IDS.TORCH]: '#f5b73e',
  [BLOCK_IDS.RAIL]: '#b6a28b',
  [BLOCK_IDS.DARK_PLANKS]: '#765039',
  [BLOCK_IDS.WHEAT]: '#d8b34a',
  [BLOCK_IDS.CHEST]: '#9b6431',
  [BLOCK_IDS.LAVA]: '#ff6a2d',
  [BLOCK_IDS.COPPER]: '#c77738',
  [BLOCK_IDS.NEON]: '#55f4e0',
  [BLOCK_IDS.AMETHYST]: '#a85be4',
  [BLOCK_IDS.CALCITE]: '#e8e0d2',
  [BLOCK_IDS.AMETHYST_CRYSTAL]: '#d79bff',
  [BLOCK_IDS.LANTERN]: '#ffb75e',
  [BLOCK_IDS.COBWEB]: '#e9e9e9',
  [BLOCK_IDS.OBSIDIAN]: '#17101f',
  [BLOCK_IDS.GOLD]: '#f4c542',
  [BLOCK_IDS.NETHERRACK]: '#9e3030',
  [BLOCK_IDS.SOUL_SAND]: '#5b4035',
  [BLOCK_IDS.NETHER_BRICK]: '#5a3038',
});

export function getBlockColor(id) {
  return BLOCK_COLORS[id] || '#d6cfc2';
}

export function getBlock(id) {
  return BLOCKS[id] || null;
}

export function isSolidBlock(id) {
  const block = BLOCKS[id];
  return Boolean(block && block.solid);
}

export function isCrossBlock(id) {
  const block = BLOCKS[id];
  return Boolean(block && block.cross);
}

export function isFlatBlock(id) {
  const block = BLOCKS[id];
  return Boolean(block && block.flat);
}

export function isUnbreakableBlock(id) {
  const block = BLOCKS[id];
  return Boolean(block && block.unbreakable);
}

export function isOccludingBlock(id) {
  const block = BLOCKS[id];
  if (!block) return false;
  return block.solid && !block.transparent && !block.cross;
}

export function getBlockName(id) {
  return BLOCKS[id]?.name || '空气';
}


const blockIconCache = new Map();
let blockIconAtlas = null;

/** 从方块图集裁出一张像素图标，给快捷栏和创造背包使用。 */
export function getBlockIconDataUrl(blockId) {
  if (blockIconCache.has(blockId)) return blockIconCache.get(blockId);
  const block = getBlock(blockId);
  if (!block || typeof document === 'undefined') return '';
  try {
    if (!blockIconAtlas) blockIconAtlas = createBlockAtlasCanvas();
    const tile = block.tiles?.top ?? block.tiles?.side ?? 0;
    const sx = (tile % ATLAS_COLS) * TILE_SIZE;
    const sy = Math.floor(tile / ATLAS_COLS) * TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(blockIconAtlas, sx, sy, TILE_SIZE, TILE_SIZE, 0, 0, 32, 32);
    const dataUrl = canvas.toDataURL('image/png');
    blockIconCache.set(blockId, dataUrl);
    return dataUrl;
  } catch (error) {
    return '';
  }
}

/**
 * 画一张 8×4 格的像素图集。
 * 使用 Canvas 生成，不需要下载贴图，部署后不会出现 404。
 */
export function createBlockAtlasCanvas(themeId = 'classic') {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE_SIZE;
  canvas.height = ATLAS_ROWS * TILE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < ATLAS_COLS * ATLAS_ROWS; i += 1) {
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    ctx.save();
    ctx.translate(col * TILE_SIZE, row * TILE_SIZE);
    drawTile(ctx, i);
    ctx.restore();
  }

  applyAtlasThemeGrade(ctx, themeId);
  return canvas;
}

function applyAtlasThemeGrade(ctx, themeId) {
  if (themeId !== 'sakura' && themeId !== 'neon') return;
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    if (themeId === 'sakura') {
      const greenish = g > r * 1.12 && g > b * 1.12;
      if (greenish) {
        r = Math.min(255, r + (g - r) * 0.48);
        b = Math.min(255, b + (g - b) * 0.22);
        g = Math.min(255, g * 0.94 + 6);
      } else {
        r = Math.min(255, r * 1.05 + 8);
        g = Math.min(255, g * 1.01 + 4);
        b = Math.min(255, b * 1.04 + 6);
      }
    } else {
      // 深岩霓虹：压暗暖色，拉高高光和青蓝。
      r = Math.min(255, r * 0.68 + 4);
      g = Math.min(255, g * 0.94 + 8);
      b = Math.min(255, b * 1.18 + 18);
      if (g > r * 1.15 && g > b * 0.82) {
        r = Math.min(255, r * 0.75);
        b = Math.min(255, b + 18);
      }
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  ctx.putImageData(image, 0, 0);
}

/* ------------------------------------------------------------------ */
/* 下面是贴图绘制小工具，全部使用固定的伪随机数，刷新后图案也一样。       */
/* ------------------------------------------------------------------ */

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fill(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
}

function speckle(ctx, colors, seed, count = 34) {
  const random = makeRandom(seed);
  for (let i = 0; i < count; i += 1) {
    const x = Math.floor(random() * TILE_SIZE);
    const y = Math.floor(random() * TILE_SIZE);
    ctx.fillStyle = colors[Math.floor(random() * colors.length)];
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawTile(ctx, tile) {
  switch (tile) {
    case TILES.GRASS_TOP:
      fill(ctx, '#69c94e');
      speckle(ctx, ['#7bdb5c', '#58b640', '#8be56b', '#4ea638'], 101, 62);
      ctx.fillStyle = '#a4ee7e';
      ctx.fillRect(3, 4, 2, 1);
      ctx.fillRect(11, 10, 2, 1);
      break;

    case TILES.GRASS_SIDE:
      fill(ctx, '#8d5a3b');
      speckle(ctx, ['#9b6644', '#7a4b30', '#a8734e'], 202, 28);
      ctx.fillStyle = '#63c34a';
      ctx.fillRect(0, 0, TILE_SIZE, 4);
      ctx.fillStyle = '#7fdd5d';
      ctx.fillRect(1, 1, 5, 1);
      ctx.fillRect(9, 2, 4, 1);
      ctx.fillStyle = '#4fa937';
      for (let x = 0; x < TILE_SIZE; x += 3) {
        ctx.fillRect(x, 4, 1, 1 + (x % 2));
      }
      break;

    case TILES.DIRT:
      fill(ctx, '#8d5a3b');
      speckle(ctx, ['#9b6644', '#7a4b30', '#a8734e', '#6d4029'], 303, 54);
      break;

    case TILES.STONE:
      fill(ctx, '#8b9099');
      speckle(ctx, ['#7a808a', '#9da3ab', '#6e747d'], 404, 58);
      ctx.fillStyle = '#aab0b8';
      ctx.fillRect(2, 3, 4, 1);
      ctx.fillRect(10, 9, 3, 1);
      break;

    case TILES.SAND:
      fill(ctx, '#f2d483');
      speckle(ctx, ['#f8e099', '#dfbd6c', '#e9ca77'], 505, 54);
      break;

    case TILES.WATER:
      fill(ctx, '#45b7e8');
      speckle(ctx, ['#65d0f7', '#32a7df', '#80ddf9'], 606, 24);
      ctx.fillStyle = 'rgba(225, 250, 255, 0.55)';
      ctx.fillRect(2, 3, 5, 1);
      ctx.fillRect(9, 10, 4, 1);
      break;

    case TILES.LOG_SIDE:
      fill(ctx, '#7b5233');
      ctx.fillStyle = '#633f28';
      ctx.fillRect(3, 0, 2, TILE_SIZE);
      ctx.fillRect(10, 0, 2, TILE_SIZE);
      ctx.fillStyle = '#946642';
      ctx.fillRect(6, 0, 1, TILE_SIZE);
      ctx.fillRect(13, 0, 1, TILE_SIZE);
      break;

    case TILES.LOG_TOP:
      fill(ctx, '#a7774b');
      ctx.strokeStyle = '#6f4b2d';
      ctx.lineWidth = 1;
      ctx.strokeRect(3.5, 3.5, 9, 9);
      ctx.strokeRect(6.5, 6.5, 3, 3);
      break;

    case TILES.LEAVES:
      fill(ctx, '#3e9b3c');
      speckle(ctx, ['#4fb94b', '#2d7e32', '#61cd58', '#286e2d'], 707, 78);
      ctx.fillStyle = '#72db62';
      ctx.fillRect(2, 2, 2, 2);
      ctx.fillRect(11, 7, 2, 2);
      ctx.fillRect(6, 12, 1, 1);
      break;

    case TILES.BRICK:
      fill(ctx, '#b75243');
      ctx.fillStyle = '#dcc0aa';
      ctx.fillRect(0, 5, TILE_SIZE, 1);
      ctx.fillRect(0, 11, TILE_SIZE, 1);
      ctx.fillRect(7, 0, 1, 5);
      ctx.fillRect(3, 6, 1, 5);
      ctx.fillRect(11, 6, 1, 5);
      ctx.fillRect(7, 12, 1, 4);
      ctx.fillStyle = '#cb6251';
      ctx.fillRect(1, 1, 5, 3);
      ctx.fillRect(9, 7, 5, 3);
      break;

    case TILES.GLASS:
      ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = 'rgba(180, 238, 255, 0.18)';
      ctx.fillRect(1, 1, 14, 14);
      ctx.fillStyle = 'rgba(230, 252, 255, 0.92)';
      ctx.fillRect(0, 0, TILE_SIZE, 1);
      ctx.fillRect(0, 15, TILE_SIZE, 1);
      ctx.fillRect(0, 0, 1, TILE_SIZE);
      ctx.fillRect(15, 0, 1, TILE_SIZE);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fillRect(4, 3, 1, 5);
      ctx.fillRect(5, 3, 1, 3);
      ctx.fillRect(11, 8, 1, 4);
      break;

    case TILES.BOOKSHELF:
      fill(ctx, '#8b5b34');
      ctx.fillStyle = '#6b4224';
      ctx.fillRect(0, 0, TILE_SIZE, 2);
      ctx.fillRect(0, 7, TILE_SIZE, 2);
      ctx.fillRect(0, 14, TILE_SIZE, 2);
      ['#e45c5c', '#f4c84e', '#4b9be1', '#64c267', '#e98dc0'].forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(1 + i * 3, 2, 2, 5);
        ctx.fillRect(2 + ((i + 2) % 5) * 3, 9, 2, 5);
      });
      break;

    case TILES.FLOWER:
      ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#3e9b3c';
      ctx.fillRect(7, 8, 2, 7);
      ctx.fillStyle = '#57c84f';
      ctx.fillRect(4, 10, 3, 1);
      ctx.fillRect(10, 12, 3, 1);
      drawFlowerHead(ctx, 8, 5, '#ffd84e', '#ff8f3d');
      break;

    case TILES.CACTUS_SIDE:
      fill(ctx, '#3f9e55');
      ctx.fillStyle = '#2f7f43';
      for (let x = 2; x < TILE_SIZE; x += 4) ctx.fillRect(x, 0, 1, TILE_SIZE);
      ctx.fillStyle = '#d7efaa';
      ctx.fillRect(5, 3, 1, 1);
      ctx.fillRect(9, 8, 1, 1);
      ctx.fillRect(13, 12, 1, 1);
      break;

    case TILES.CACTUS_TOP:
      fill(ctx, '#4cae61');
      ctx.fillStyle = '#6bc47b';
      ctx.fillRect(5, 5, 6, 6);
      ctx.fillStyle = '#2f7f43';
      ctx.fillRect(5, 5, 1, 1);
      ctx.fillRect(10, 5, 1, 1);
      ctx.fillRect(5, 10, 1, 1);
      ctx.fillRect(10, 10, 1, 1);
      break;

    case TILES.SNOW:
      fill(ctx, '#f4fbff');
      speckle(ctx, ['#ffffff', '#dcecf6', '#e8f5ff'], 808, 34);
      break;

    case TILES.SNOW_SIDE:
      fill(ctx, '#8d5a3b');
      speckle(ctx, ['#9b6644', '#7a4b30'], 909, 21);
      ctx.fillStyle = '#edf9ff';
      ctx.fillRect(0, 0, TILE_SIZE, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(1, 1, 6, 1);
      ctx.fillRect(9, 2, 5, 1);
      ctx.fillStyle = '#d7e8f2';
      for (let x = 0; x < TILE_SIZE; x += 2) ctx.fillRect(x, 5, 1, 1);
      break;

    case TILES.CHERRY_LEAVES:
      fill(ctx, '#f39ac0');
      speckle(ctx, ['#ffb4d2', '#de7da8', '#ffd1e2', '#e889b3'], 1001, 80);
      ctx.fillStyle = '#fff0f6';
      ctx.fillRect(2, 3, 2, 2);
      ctx.fillRect(11, 9, 2, 2);
      ctx.fillRect(7, 13, 1, 1);
      break;

    case TILES.CHERRY_LOG:
      fill(ctx, '#7b4d4d');
      ctx.fillStyle = '#613838';
      ctx.fillRect(3, 0, 2, TILE_SIZE);
      ctx.fillRect(10, 0, 2, TILE_SIZE);
      ctx.fillStyle = '#9a6464';
      ctx.fillRect(6, 0, 1, TILE_SIZE);
      ctx.fillRect(13, 0, 1, TILE_SIZE);
      break;

    case TILES.PLANKS:
      fill(ctx, '#bc8a55');
      ctx.fillStyle = '#a67949';
      ctx.fillRect(0, 0, TILE_SIZE, 1);
      ctx.fillRect(0, 5, TILE_SIZE, 1);
      ctx.fillRect(0, 10, TILE_SIZE, 1);
      ctx.fillRect(0, 15, TILE_SIZE, 1);
      ctx.fillRect(5, 1, 1, 4);
      ctx.fillRect(11, 6, 1, 4);
      ctx.fillRect(3, 11, 1, 4);
      break;

    case TILES.ROOF:
      fill(ctx, '#dd5d4f');
      ctx.fillStyle = '#b9443b';
      for (let y = 2; y < TILE_SIZE; y += 5) {
        ctx.fillRect(0, y, TILE_SIZE, 1);
        const offset = y % 2 === 0 ? 4 : 10;
        ctx.fillRect(offset, y, 1, 4);
      }
      ctx.fillStyle = '#f07b68';
      ctx.fillRect(2, 3, 4, 1);
      ctx.fillRect(9, 8, 3, 1);
      break;


    case TILES.COBBLESTONE:
      fill(ctx, '#858b94');
      ctx.fillStyle = '#5e646c';
      ctx.fillRect(0, 7, 16, 1);
      ctx.fillRect(0, 14, 16, 1);
      ctx.fillRect(7, 0, 1, 7);
      ctx.fillRect(11, 8, 1, 6);
      ctx.fillRect(3, 15, 1, 1);
      speckle(ctx, ['#9ba2aa', '#707780', '#aab0b8'], 1101, 34);
      break;

    case TILES.MOSSY_STONE:
      fill(ctx, '#858b94');
      ctx.fillStyle = '#5e646c';
      ctx.fillRect(0, 7, 16, 1);
      ctx.fillRect(7, 0, 1, 7);
      ctx.fillRect(11, 8, 1, 6);
      speckle(ctx, ['#9ba2aa', '#707780'], 1111, 24);
      ctx.fillStyle = '#5f9b48';
      ctx.fillRect(1, 2, 5, 2);
      ctx.fillRect(9, 9, 5, 2);
      ctx.fillStyle = '#79b95b';
      ctx.fillRect(2, 3, 2, 1);
      ctx.fillRect(11, 10, 2, 1);
      break;

    case TILES.STONE_BRICKS:
      fill(ctx, '#9da3ab');
      ctx.fillStyle = '#747b84';
      for (let y = 0; y < 16; y += 5) ctx.fillRect(0, y, 16, 1);
      ctx.fillRect(4, 0, 1, 5);
      ctx.fillRect(12, 5, 1, 5);
      ctx.fillRect(6, 10, 1, 6);
      ctx.fillStyle = '#b4bac1';
      ctx.fillRect(1, 1, 3, 1);
      ctx.fillRect(9, 6, 2, 1);
      break;

    case TILES.GRAVEL:
      fill(ctx, '#9a948b');
      speckle(ctx, ['#6f6a63', '#b9b2a7', '#857f77', '#c8c0b2'], 1121, 72);
      break;

    case TILES.COAL_ORE:
      fill(ctx, '#8b9099');
      speckle(ctx, ['#7a808a', '#9da3ab'], 1131, 18);
      ctx.fillStyle = '#363a40';
      ctx.fillRect(2, 3, 4, 3);
      ctx.fillRect(9, 8, 5, 4);
      ctx.fillRect(5, 12, 3, 2);
      ctx.fillStyle = '#202329';
      ctx.fillRect(3, 4, 2, 1);
      ctx.fillRect(11, 9, 2, 1);
      break;

    case TILES.IRON_ORE:
      fill(ctx, '#8b9099');
      speckle(ctx, ['#7a808a', '#9da3ab'], 1141, 18);
      ctx.fillStyle = '#c99b78';
      ctx.fillRect(3, 3, 4, 3);
      ctx.fillRect(9, 9, 4, 3);
      ctx.fillStyle = '#e5bea0';
      ctx.fillRect(4, 4, 2, 1);
      ctx.fillRect(10, 10, 1, 1);
      break;

    case TILES.DIAMOND_ORE:
      fill(ctx, '#8b9099');
      speckle(ctx, ['#7a808a', '#9da3ab'], 1151, 18);
      ctx.fillStyle = '#55d6d8';
      ctx.fillRect(3, 4, 3, 3);
      ctx.fillRect(10, 9, 4, 3);
      ctx.fillStyle = '#c5ffff';
      ctx.fillRect(4, 5, 1, 1);
      ctx.fillRect(11, 10, 1, 1);
      break;

    case TILES.BEDROCK:
      fill(ctx, '#3f4148');
      speckle(ctx, ['#575a62', '#2a2c32', '#696c73'], 1161, 58);
      break;

    case TILES.MOSS:
      fill(ctx, '#5f9b48');
      speckle(ctx, ['#74b85a', '#4d833b', '#8aca69'], 1171, 68);
      ctx.fillStyle = '#a5df80';
      ctx.fillRect(2, 4, 3, 1);
      ctx.fillRect(10, 11, 3, 1);
      break;

    case TILES.AZALEA_LEAVES:
      fill(ctx, '#4f9b52');
      speckle(ctx, ['#65b567', '#3f8145', '#7bc87a'], 1181, 64);
      ctx.fillStyle = '#f6a1c1';
      ctx.fillRect(3, 3, 3, 2);
      ctx.fillRect(10, 9, 2, 2);
      ctx.fillStyle = '#ffd7e7';
      ctx.fillRect(4, 4, 1, 1);
      break;

    case TILES.GLOW_BERRIES:
      ctx.clearRect(0, 0, 16, 16);
      ctx.strokeStyle = '#3e7d42';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(5, 14);
      ctx.moveTo(11, 0);
      ctx.lineTo(10, 12);
      ctx.stroke();
      ctx.fillStyle = '#e8b93f';
      ctx.fillRect(3, 5, 2, 2);
      ctx.fillRect(5, 9, 2, 2);
      ctx.fillRect(9, 4, 2, 2);
      ctx.fillRect(9, 11, 2, 2);
      ctx.fillStyle = '#fff0a0';
      ctx.fillRect(3, 5, 1, 1);
      ctx.fillRect(9, 4, 1, 1);
      break;

    case TILES.SULFUR:
      fill(ctx, '#e7cf4a');
      speckle(ctx, ['#f6e46d', '#c8b12d', '#fff49a', '#a9931f'], 1191, 70);
      break;

    case TILES.BASALT:
      fill(ctx, '#4d5058');
      ctx.fillStyle = '#33363d';
      for (let x = 2; x < 16; x += 4) ctx.fillRect(x, 0, 2, 16);
      ctx.fillStyle = '#6b7079';
      ctx.fillRect(2, 2, 1, 10);
      ctx.fillRect(10, 3, 1, 9);
      break;

    case TILES.SULFUR_CRYSTAL:
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = '#d4b632';
      ctx.fillRect(7, 9, 2, 6);
      ctx.fillStyle = '#f8dc52';
      ctx.beginPath();
      ctx.moveTo(8, 1);
      ctx.lineTo(11, 9);
      ctx.lineTo(5, 9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff4a0';
      ctx.fillRect(7, 5, 1, 3);
      ctx.fillStyle = '#e7c83e';
      ctx.beginPath();
      ctx.moveTo(3, 7);
      ctx.lineTo(5, 12);
      ctx.lineTo(1, 12);
      ctx.closePath();
      ctx.fill();
      break;

    case TILES.JUNGLE_WOOD:
      fill(ctx, '#6d5232');
      ctx.fillStyle = '#4f3a21';
      ctx.fillRect(3, 0, 2, 16);
      ctx.fillRect(10, 0, 2, 16);
      ctx.fillStyle = '#8a6b42';
      ctx.fillRect(6, 0, 1, 16);
      ctx.fillStyle = '#5a8a3f';
      ctx.fillRect(0, 2, 2, 3);
      ctx.fillRect(13, 10, 2, 4);
      break;

    case TILES.JUNGLE_LEAVES:
      fill(ctx, '#2f7a3b');
      speckle(ctx, ['#3c954c', '#25632f', '#55ae5d', '#1d5528'], 1201, 78);
      ctx.fillStyle = '#73cc6d';
      ctx.fillRect(3, 3, 2, 1);
      ctx.fillRect(11, 10, 2, 1);
      break;

    case TILES.VINE:
      ctx.clearRect(0, 0, 16, 16);
      ctx.strokeStyle = '#3b8a3f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(5, 16);
      ctx.moveTo(11, 0);
      ctx.lineTo(10, 16);
      ctx.stroke();
      ctx.fillStyle = '#56a94e';
      ctx.fillRect(2, 3, 3, 2);
      ctx.fillRect(8, 7, 4, 2);
      ctx.fillRect(3, 12, 3, 2);
      ctx.fillStyle = '#76c765';
      ctx.fillRect(3, 3, 1, 1);
      ctx.fillRect(9, 7, 1, 1);
      break;

    case TILES.TORCH:
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = '#7b5233';
      ctx.fillRect(7, 6, 2, 10);
      ctx.fillStyle = '#ffca4a';
      ctx.fillRect(6, 2, 4, 5);
      ctx.fillStyle = '#ff7d31';
      ctx.fillRect(7, 1, 2, 3);
      ctx.fillStyle = '#fff2b5';
      ctx.fillRect(7, 3, 1, 2);
      break;

    case TILES.RAIL:
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = '#7d5a3c';
      for (let x = 1; x < 16; x += 5) ctx.fillRect(x, 2, 2, 12);
      ctx.fillStyle = '#b9c3c9';
      ctx.fillRect(0, 4, 16, 2);
      ctx.fillRect(0, 10, 16, 2);
      ctx.fillStyle = '#eef5f7';
      ctx.fillRect(0, 4, 16, 1);
      ctx.fillRect(0, 10, 16, 1);
      break;

    case TILES.DARK_PLANKS:
      fill(ctx, '#765039');
      ctx.fillStyle = '#5d3d2a';
      ctx.fillRect(0, 0, 16, 1);
      ctx.fillRect(0, 5, 16, 1);
      ctx.fillRect(0, 10, 16, 1);
      ctx.fillRect(0, 15, 16, 1);
      ctx.fillRect(6, 1, 1, 4);
      ctx.fillRect(12, 6, 1, 4);
      ctx.fillRect(3, 11, 1, 4);
      ctx.fillStyle = '#8b6244';
      ctx.fillRect(2, 2, 3, 1);
      ctx.fillRect(9, 7, 2, 1);
      break;

    case TILES.WHEAT:
      ctx.clearRect(0, 0, 16, 16);
      for (const x of [4, 8, 12]) {
        ctx.fillStyle = '#4d8a37';
        ctx.fillRect(x, 5, 1, 11);
        ctx.fillStyle = '#d8b34a';
        ctx.fillRect(x - 1, 2, 3, 4);
        ctx.fillStyle = '#f2d36c';
        ctx.fillRect(x, 2, 1, 2);
        ctx.fillStyle = '#8fbb4e';
        ctx.fillRect(x - 2, 7, 2, 1);
        ctx.fillRect(x + 1, 10, 2, 1);
      }
      break;

    case TILES.CHEST:
      fill(ctx, '#9b6431');
      ctx.fillStyle = '#6f4323';
      ctx.fillRect(0, 0, 16, 1);
      ctx.fillRect(0, 6, 16, 2);
      ctx.fillRect(0, 15, 16, 1);
      ctx.fillRect(0, 0, 1, 16);
      ctx.fillRect(15, 0, 1, 16);
      ctx.fillStyle = '#c18a4e';
      ctx.fillRect(2, 2, 12, 3);
      ctx.fillStyle = '#f0c65b';
      ctx.fillRect(7, 7, 2, 3);
      ctx.fillStyle = '#5b391f';
      ctx.fillRect(7, 9, 2, 1);
      break;

    case TILES.COPPER:
      fill(ctx, '#c77738');
      speckle(ctx, ['#e2944f', '#9e5728', '#f0b06a', '#7f4320'], 1401, 58);
      ctx.fillStyle = '#71401f';
      ctx.fillRect(0, 4, 16, 1);
      ctx.fillRect(0, 11, 16, 1);
      ctx.fillStyle = '#f1bd7b';
      ctx.fillRect(2, 2, 3, 1);
      ctx.fillRect(11, 9, 3, 1);
      break;

    case TILES.NEON:
      fill(ctx, '#163d4d');
      ctx.fillStyle = '#5af5e2';
      ctx.fillRect(1, 1, 14, 14);
      ctx.fillStyle = '#d6fff8';
      ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#1a8e93';
      ctx.fillRect(5, 5, 6, 6);
      ctx.fillStyle = '#79fff1';
      ctx.fillRect(6, 6, 4, 4);
      ctx.fillStyle = '#f4b8ff';
      ctx.fillRect(7, 1, 2, 14);
      break;

    case TILES.AMETHYST:
      fill(ctx, '#7d3fb0');
      speckle(ctx, ['#a95ce0', '#5d2a89', '#c98fff', '#8b4ac4'], 1601, 64);
      ctx.fillStyle = 'rgba(243, 211, 255, 0.9)';
      ctx.fillRect(3, 3, 3, 2);
      ctx.fillRect(9, 10, 4, 2);
      ctx.fillRect(12, 3, 2, 2);
      break;

    case TILES.CALCITE:
      fill(ctx, '#ded8cb');
      speckle(ctx, ['#f2eee5', '#bbb4a7', '#d2c9bb', '#9e978b'], 1701, 40);
      ctx.fillStyle = '#f7f3ea';
      ctx.fillRect(2, 2, 5, 1);
      ctx.fillRect(9, 12, 5, 1);
      break;

    case TILES.AMETHYST_CRYSTAL:
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = '#d99bff';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(13, 5);
      ctx.lineTo(10, 15);
      ctx.lineTo(5, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f4d8ff';
      ctx.beginPath();
      ctx.moveTo(8, 2);
      ctx.lineTo(11, 6);
      ctx.lineTo(9, 12);
      ctx.lineTo(7, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#9c51d0';
      ctx.fillRect(3, 10, 2, 4);
      ctx.fillRect(12, 8, 1, 3);
      break;

    case TILES.LANTERN:
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = '#5b3520';
      ctx.fillRect(5, 0, 6, 16);
      ctx.fillStyle = '#ffbd57';
      ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = '#fff0a8';
      ctx.fillRect(5, 4, 6, 8);
      ctx.fillStyle = '#7b4824';
      ctx.fillRect(4, 2, 1, 12);
      ctx.fillRect(11, 2, 1, 12);
      ctx.fillRect(2, 7, 12, 1);
      break;

    case TILES.COBWEB:
      ctx.clearRect(0, 0, 16, 16);
      ctx.strokeStyle = 'rgba(238, 238, 238, 0.86)';
      ctx.lineWidth = 1;
      for (const [x1, y1, x2, y2] of [[2, 0, 14, 16], [14, 0, 2, 16], [0, 2, 16, 14], [0, 14, 16, 2], [8, 0, 8, 16], [0, 8, 16, 8]]) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      break;

    case TILES.OBSIDIAN:
      fill(ctx, '#17101f');
      speckle(ctx, ['#2c1d40', '#09070c', '#4a2c6b', '#22152f'], 1801, 45);
      ctx.fillStyle = '#6a3ca3';
      ctx.fillRect(3, 3, 2, 1);
      ctx.fillRect(11, 10, 2, 1);
      break;

    case TILES.GOLD:
      fill(ctx, '#d7a927');
      speckle(ctx, ['#ffe36a', '#a97b1f', '#ffd75b', '#8d651a'], 1901, 38);
      ctx.fillStyle = '#fff1a0';
      ctx.fillRect(2, 2, 5, 2);
      ctx.fillRect(9, 11, 4, 2);
      break;

    case TILES.NETHERRACK:
      fill(ctx, '#9e3030');
      speckle(ctx, ['#bd4a3a', '#742322', '#c85c46', '#5c1b1d'], 2001, 52);
      ctx.fillStyle = '#e07455';
      ctx.fillRect(2, 3, 3, 1);
      ctx.fillRect(10, 11, 3, 1);
      break;

    case TILES.SOUL_SAND:
      fill(ctx, '#5b4035');
      speckle(ctx, ['#7a5847', '#42302a', '#8d6952', '#33241f'], 2101, 45);
      ctx.fillStyle = '#a17a60';
      ctx.fillRect(4, 4, 2, 2);
      ctx.fillRect(11, 9, 2, 2);
      break;

    case TILES.NETHER_BRICK:
      fill(ctx, '#3b2028');
      speckle(ctx, ['#5a3038', '#26151a', '#6c3b42', '#1c0e12'], 2201, 35);
      ctx.fillStyle = '#7a4a47';
      for (let y = 2; y < 16; y += 5) {
        ctx.fillRect(1, y, 14, 1);
        const offset = y % 2 === 0 ? 4 : 9;
        ctx.fillRect(offset, y, 1, 4);
      }
      break;

    case TILES.LAVA:
      fill(ctx, '#e54b20');
      speckle(ctx, ['#ff8a2d', '#c63417', '#ffb32e', '#8e2114'], 1301, 70);
      ctx.fillStyle = '#ffd45a';
      ctx.fillRect(3, 4, 4, 2);
      ctx.fillRect(10, 10, 3, 2);
      ctx.fillRect(7, 2, 2, 1);
      ctx.fillStyle = '#7d1c12';
      ctx.fillRect(1, 9, 2, 1);
      ctx.fillRect(12, 5, 2, 1);
      break;

    default:
      fill(ctx, '#d94f9c');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = '#d94f9c';
      ctx.fillRect(4, 4, 8, 8);
      break;
  }
}

function drawFlowerHead(ctx, cx, cy, petal, center) {
  ctx.fillStyle = petal;
  ctx.fillRect(cx - 3, cy - 1, 6, 3);
  ctx.fillRect(cx - 1, cy - 3, 3, 6);
  ctx.fillStyle = center;
  ctx.fillRect(cx - 1, cy - 1, 2, 2);
}
