// board.js — 重庆 48 格闭环地图（两江 · 轻轨 · 商圈 · 数据驱动）
// 类型：start 起点 / land 地产 / bridge 桥梁 / metro 轻轨站 / event 事件
// 商圈组：同组地产全拥有 → 租金 ×2；riverEdge[i]=true 表示 i→i+1 跨江（i+1 必须是桥/通道格）

export const START_MONEY_DEFAULT = 5000
export const PASS_START_SALARY = 300
export const JAIL_TURNS = 2
export const HOSPITAL_FEE = 200
export const WORKSHOP_FEE = 50
export const UPGRADE_COST_RATIO = 0.5
export const SELL_RATIO = 0.5
export const METRO_FEE = 150 // 乘轻轨费
export const METRO_USE_FEE = 150 // 使用他人轻轨站的费用

// 商圈组合（group 字段）→ 名称
export const GROUPS = {
  g1: { name: '渝中核心', color: '#ef4444' },
  g2: { name: '两江商业', color: '#3b82f6' },
  g3: { name: '人文旅游', color: '#f59e0b' },
  g4: { name: '南岸滨江', color: '#10b981' },
  g5: { name: '九龙商业', color: '#8b5cf6' },
  g6: { name: '南部新城', color: '#06b6d4' },
}

// 特色建筑：盖楼改为开店（等级 0-3）
export const SHOPS = [
  { level: 0, name: '空地', icon: '' },
  { level: 1, name: '小面馆', icon: '🍜' },
  { level: 2, name: '火锅店', icon: '🍲' },
  { level: 3, name: '串串店', icon: '🍢' },
]

// 载具 → 掷骰数
export const VEHICLES = {
  walk: { name: '走路', dice: 2, icon: '🏃' },
  bike: { name: '自行车', dice: 3, icon: '🚲' },
  moto: { name: '摩托', dice: 4, icon: '🛵' },
  car: { name: '汽车', dice: 5, icon: '🚗' },
  plane: { name: '飞机', dice: 6, icon: '✈️' },
}
export const VEHICLE_ORDER = ['walk', 'bike', 'moto', 'car', 'plane']

// 48 格（顺时针闭环）：数组索引 = 格子 id（0 位留空），pos 直接用 id
export const TILE_COUNT = 48
export const TILES = [
  null, // 索引 0 留空，索引 1-48 = 格子 id 1-48
  { id: 1, type: 'start', name: '解放碑', sub: '起点·渝中', x: 32, y: 46 },
  { id: 2, type: 'land', group: 'g1', name: '临江门', sub: '渝中核心', price: 500, rent: 90, x: 37, y: 39 },
  { id: 3, type: 'land', group: 'g1', name: '大溪沟', sub: '渝中核心', price: 550, rent: 100, x: 33, y: 31, riverEdge: true },
  { id: 4, type: 'bridge', name: '黄花园大桥', sub: '跨嘉陵江', price: 700, toll: 120, x: 38, y: 24 },
  { id: 5, type: 'land', group: 'g2', name: '江北嘴', sub: '两江商业', price: 1600, rent: 300, x: 46, y: 21 },
  { id: 6, type: 'land', group: 'g2', name: '大剧院', sub: '两江商业', price: 1300, rent: 240, x: 53, y: 18 },
  { id: 7, type: 'land', group: 'g2', name: '观音桥', sub: '两江商业', price: 1100, rent: 200, x: 60, y: 17 },
  { id: 8, type: 'land', group: 'g2', name: '九街', sub: '两江商业', price: 1000, rent: 190, x: 67, y: 20 },
  { id: 9, type: 'metro', name: '红土地', sub: '轻轨站', price: 1200, rent: 200, x: 72, y: 26 },
  { id: 10, type: 'land', name: '五里店', sub: '普通', price: 600, rent: 110, x: 78, y: 24 },
  { id: 11, type: 'land', name: '寸滩', sub: '普通', price: 650, rent: 120, x: 84, y: 28 },
  { id: 12, type: 'land', name: '江北机场', sub: '交通', price: 1200, rent: 220, x: 89, y: 34 },
  { id: 13, type: 'land', name: '渝北中央公园', sub: '高级', price: 1700, rent: 320, x: 92, y: 42 },
  { id: 14, type: 'land', name: '礼嘉', sub: '普通', price: 700, rent: 130, x: 90, y: 50 },
  { id: 15, type: 'land', name: '金山寺', sub: '普通', price: 750, rent: 140, x: 85, y: 57 },
  { id: 16, type: 'event', name: '山城奇遇', sub: '事件', x: 78, y: 62 },
  { id: 17, type: 'land', group: 'g3', name: '沙坪坝', sub: '人文旅游', price: 1000, rent: 190, x: 71, y: 66 },
  { id: 18, type: 'land', group: 'g3', name: '三峡广场', sub: '人文旅游', price: 1500, rent: 280, x: 64, y: 68 },
  { id: 19, type: 'land', group: 'g3', name: '磁器口', sub: '人文旅游', price: 1200, rent: 220, x: 57, y: 72 },
  { id: 20, type: 'land', name: '石井坡', sub: '普通', price: 600, rent: 110, x: 50, y: 74 },
  { id: 21, type: 'land', name: '重庆西站', sub: '交通枢纽', price: 1300, rent: 240, x: 43, y: 78 },
  { id: 22, type: 'land', name: '大渡口', sub: '普通', price: 650, rent: 120, x: 36, y: 81 },
  { id: 23, type: 'land', name: '九宫庙', sub: '普通', price: 700, rent: 130, x: 29, y: 79 },
  { id: 24, type: 'land', group: 'g5', name: '杨家坪', sub: '九龙商业', price: 1100, rent: 200, x: 22, y: 76 },
  { id: 25, type: 'land', group: 'g5', name: '谢家湾', sub: '九龙商业', price: 700, rent: 130, x: 16, y: 70 },
  { id: 26, type: 'land', group: 'g5', name: '袁家岗', sub: '九龙商业', price: 750, rent: 140, x: 11, y: 63 },
  { id: 27, type: 'land', name: '鹅岭', sub: '景观', price: 1100, rent: 200, x: 7, y: 55 },
  { id: 28, type: 'metro', name: '李子坝', sub: '轻轨+地标', price: 1400, rent: 260, upgradable: true, x: 6, y: 47, riverEdge: true },
  { id: 29, type: 'bridge', name: '菜园坝大桥', sub: '跨长江', price: 800, toll: 140, x: 10, y: 39 },
  { id: 30, type: 'land', group: 'g4', name: '南坪', sub: '南岸滨江', price: 1050, rent: 195, x: 16, y: 33 },
  { id: 31, type: 'land', group: 'g4', name: '南滨路', sub: '南岸滨江', price: 1600, rent: 300, x: 13, y: 25 },
  { id: 32, type: 'land', group: 'g4', name: '弹子石', sub: '南岸滨江', price: 750, rent: 140, x: 10, y: 17, riverEdge: true },
  { id: 33, type: 'bridge', name: '东水门大桥', sub: '跨长江', price: 850, toll: 150, x: 17, y: 12 },
  { id: 34, type: 'land', group: 'g4', name: '龙门浩', sub: '南岸滨江', price: 800, rent: 150, x: 25, y: 10 },
  { id: 35, type: 'land', name: '黄桷垭', sub: '山城', price: 1100, rent: 200, x: 33, y: 8 },
  { id: 36, type: 'land', name: '南山', sub: '景区', price: 1400, rent: 260, x: 41, y: 7 },
  { id: 37, type: 'land', group: 'g6', name: '长生桥', sub: '南部新城', price: 700, rent: 130, x: 50, y: 7 },
  { id: 38, type: 'land', group: 'g6', name: '茶园', sub: '南部新城', price: 750, rent: 140, x: 58, y: 9 },
  { id: 39, type: 'land', group: 'g6', name: '巴南万达', sub: '南部新城', price: 1000, rent: 190, x: 65, y: 14 },
  { id: 40, type: 'land', group: 'g6', name: '鱼洞', sub: '南部新城', price: 650, rent: 120, x: 71, y: 20 },
  { id: 41, type: 'land', name: '大江', sub: '普通', price: 600, rent: 110, x: 76, y: 28 },
  { id: 42, type: 'event', name: '重庆火锅', sub: '特色事件', x: 80, y: 36 },
  { id: 43, type: 'land', name: '巴南滨江', sub: '普通', price: 700, rent: 130, x: 79, y: 44, riverEdge: true },
  { id: 44, type: 'metro', name: '山城电梯', sub: '特殊交通', price: 1300, rent: 240, x: 75, y: 52 },
  { id: 45, type: 'land', group: 'g5', name: '九龙坡', sub: '九龙商业', price: 750, rent: 140, x: 69, y: 58 },
  { id: 46, type: 'land', name: '歇台子', sub: '普通', price: 700, rent: 130, x: 62, y: 62 },
  { id: 47, type: 'land', name: '上清寺', sub: '高级', price: 1500, rent: 280, x: 54, y: 60, riverEdge: true },
  { id: 48, type: 'bridge', name: '千厮门大桥', sub: '跨嘉陵江', price: 750, toll: 130, x: 45, y: 55 },
]

// 跨江边界（出发格 → 桥/通道格）：
// 3→4 黄花园大桥(嘉陵江) / 28→29 菜园坝大桥(长江) / 32→33 东水门大桥(长江) / 43→44 山城电梯(长江·特殊通道) / 47→48 千厮门大桥(嘉陵江)

// 两江背景（0-100 坐标系 SVG path）
export const RIVERS = [
  { name: '嘉陵江', d: 'M 20 0 Q 30 12 28 24 Q 26 36 38 44 Q 50 50 52 62 Q 53 74 48 88' },
  { name: '长江', d: 'M 40 0 Q 56 8 66 20 Q 76 32 84 40 Q 92 48 94 62 Q 95 76 88 90' },
]

export function getTile(index) {
  return TILES[((index - 1 + TILE_COUNT) % TILE_COUNT) + 1]
}

// 从格 i 顺时针走到下一格（1-48 闭环）
export function nextTileIndex(i) {
  return (i % TILE_COUNT) + 1
}

export function isPropertyTile(tile) {
  return tile.type === 'land' || tile.type === 'metro'
}

export function isBridge(tile) {
  return tile.type === 'bridge'
}

export function isMetro(tile) {
  return tile.type === 'metro'
}

// 商圈组合：该组所有可买地产是否全被同一玩家拥有
export function groupTiles(group) {
  return TILES.filter((t) => t && t.group === group)
}
