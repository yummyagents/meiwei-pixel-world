/**
 * 四位可选特工的数据。
 * 角色卡片、HUD、暂停菜单都从这里读取，避免在多个文件里写重复名字。
 */
export const CHARACTERS = Object.freeze([
  {
    id: 'burger',
    name: '汉堡特工',
    emoji: '🍔',
    title: '勇敢的领队',
    description: '胆子大、跑得快，最喜欢探索新地方。',
    theme: 'tomato',
    color: '#d94b42',
    accent: '#f4c542',
    portrait: './assets/images/characters/burger.jpg',
  },
  {
    id: 'fries',
    name: '薯条厨娘',
    emoji: '🍟',
    title: '元气建造家',
    description: '手很巧，能把普通方块变成漂亮小屋。',
    theme: 'sunny',
    color: '#3d9e6a',
    accent: '#f2c442',
    portrait: './assets/images/characters/fries.jpg',
  },
  {
    id: 'popcorn',
    name: '鸡米花小弟',
    emoji: '🍗',
    title: '蹦蹦跳跳的伙伴',
    description: '活泼又好奇，总能发现藏在草丛里的小惊喜。',
    theme: 'leaf',
    color: '#80518f',
    accent: '#e7a23e',
    portrait: './assets/images/characters/popcorn.jpg',
  },
  {
    id: 'witch',
    name: '魔法小女巫',
    emoji: '🧙‍♀️',
    title: '星星魔法师',
    description: '会一点点小魔法，能让樱花和雪花一起跳舞。',
    theme: 'grape',
    color: '#d77a9d',
    accent: '#9257b4',
    portrait: './assets/images/characters/witch.jpg',
  },
]);

export const DEFAULT_CHARACTER_ID = 'burger';

export function getCharacter(id) {
  return CHARACTERS.find((character) => character.id === id) || CHARACTERS[0];
}
