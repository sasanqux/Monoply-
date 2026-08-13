// board.js — 重庆 48 格闭环地图（蛇形盘山路布局 · 两江 · 轻轨 · 商圈 · 数据驱动）
// 类型：start 起点 / land 地产 / bridge 桥梁 / metro 轻轨站 / event 事件
// 商圈组：同组地产全拥有 → 租金 ×2；riverEdge[i]=true 表示 i→i+1 跨江（i+1 必须是桥/通道格）
// 布局：6 行 × 8 列蛇形折返（山城盘山路），左侧回程线 48→1 闭环

export const START_MONEY_DEFAULT = 5000
export const PASS_START_SALARY = 300
export const JAIL_TURNS = 2
export const HOSPITAL_FEE = 200
export const WORKSHOP_FEE = 50
export const UPGRADE_COST_RATIO = 0.5
export const SELL_RATIO = 0.5
export const METRO_FEE = 150
export const METRO_USE_FEE = 150

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

// 蛇形坐标（6 行 × 8 列）：行 y=12/25/38/51/64/77，列 x=12/23/34/45/56/67/78/89
// 偶数行（2/4/6）从右到左折返 → 盘山路蜿蜒感
export const TILE_COUNT = 48
export const TILES = [
  null, // 索引 0 留空，索引 1-48 = 格子 id
  { id: 1, type: 'start', name: '解放碑', sub: '起点·渝中', x: 12, y: 12 },
  { id: 2, type: 'land', group: 'g1', name: '临江门', sub: '渝中核心', price: 500, rent: 90, x: 23, y: 12 },
  { id: 3, type: 'land', group: 'g1', name: '大溪沟', sub: '渝中核心', price: 550, rent: 100, x: 34, y: 12, riverEdge: true },
  { id: 4, type: 'bridge', name: '黄花园大桥', sub: '跨嘉陵江', price: 700, toll: 120, x: 45, y: 12 },
  { id: 5, type: 'land', group: 'g2', name: '江北嘴', sub: '两江商业', price: 1600, rent: 300, x: 56, y: 12 },
  { id: 6, type: 'land', group: 'g2', name: '大剧院', sub: '两江商业', price: 1300, rent: 240, x: 67, y: 12 },
  { id: 7, type: 'land', group: 'g2', name: '观音桥', sub: '两江商业', price: 1100, rent: 200, x: 78, y: 12 },
  { id: 8, type: 'land', group: 'g2', name: '九街', sub: '两江商业', price: 1000, rent: 190, x: 89, y: 12 },
  { id: 9, type: 'metro', name: '红土地', sub: '轻轨站', price: 1200, rent: 200, x: 89, y: 25 },
  { id: 10, type: 'land', name: '五里店', sub: '普通', price: 600, rent: 110, x: 78, y: 25 },
  { id: 11, type: 'land', name: '寸滩', sub: '普通', price: 650, rent: 120, x: 67, y: 25 },
  { id: 12, type: 'land', name: '江北机场', sub: '交通', price: 1200, rent: 220, x: 56, y: 25 },
  { id: 13, type: 'land', name: '渝北中央公园', sub: '高级', price: 1700, rent: 320, x: 45, y: 25 },
  { id: 14, type: 'land', name: '礼嘉', sub: '普通', price: 700, rent: 130, x: 34, y: 25 },
  { id: 15, type: 'land', name: '金山寺', sub: '普通', price: 750, rent: 140, x: 23, y: 25 },
  { id: 16, type: 'event', name: '山城奇遇', sub: '事件', x: 12, y: 25 },
  { id: 17, type: 'land', group: 'g3', name: '沙坪坝', sub: '人文旅游', price: 1000, rent: 190, x: 12, y: 38 },
  { id: 18, type: 'land', group: 'g3', name: '三峡广场', sub: '人文旅游', price: 1500, rent: 280, x: 23, y: 38 },
  { id: 19, type: 'land', group: 'g3', name: '磁器口', sub: '人文旅游', price: 1200, rent: 220, x: 34, y: 38 },
  { id: 20, type: 'land', name: '石井坡', sub: '普通', price: 600, rent: 110, x: 45, y: 38 },
  { id: 21, type: 'land', name: '重庆西站', sub: '交通枢纽', price: 1300, rent: 240, x: 56, y: 38 },
  { id: 22, type: 'land', name: '大渡口', sub: '普通', price: 650, rent: 120, x: 67, y: 38 },
  { id: 23, type: 'land', name: '九宫庙', sub: '普通', price: 700, rent: 130, x: 78, y: 38 },
  { id: 24, type: 'land', group: 'g5', name: '杨家坪', sub: '九龙商业', price: 1100, rent: 200, x: 89, y: 38 },
  { id: 25, type: 'land', group: 'g5', name: '谢家湾', sub: '九龙商业', price: 700, rent: 130, x: 89, y: 51 },
  { id: 26, type: 'land', group: 'g5', name: '袁家岗', sub: '九龙商业', price: 750, rent: 140, x: 78, y: 51 },
  { id: 27, type: 'land', name: '鹅岭', sub: '景观', price: 1100, rent: 200, x: 67, y: 51 },
  { id: 28, type: 'metro', name: '李子坝', sub: '轻轨+地标', price: 1400, rent: 260, upgradable: true, x: 56, y: 51, riverEdge: true },
  { id: 29, type: 'bridge', name: '菜园坝大桥', sub: '跨长江', price: 800, toll: 140, x: 45, y: 51 },
  { id: 30, type: 'land', group: 'g4', name: '南坪', sub: '南岸滨江', price: 1050, rent: 195, x: 34, y: 51 },
  { id: 31, type: 'land', group: 'g4', name: '南滨路', sub: '南岸滨江', price: 1600, rent: 300, x: 23, y: 51 },
  { id: 32, type: 'land', group: 'g4', name: '弹子石', sub: '南岸滨江', price: 750, rent: 140, x: 12, y: 51, riverEdge: true },
  { id: 33, type: 'bridge', name: '东水门大桥', sub: '跨长江', price: 850, toll: 150, x: 12, y: 64 },
  { id: 34, type: 'land', group: 'g4', name: '龙门浩', sub: '南岸滨江', price: 800, rent: 150, x: 23, y: 64 },
  { id: 35, type: 'land', name: '黄桷垭', sub: '山城', price: 1100, rent: 200, x: 34, y: 64 },
  { id: 36, type: 'land', name: '南山', sub: '景区', price: 1400, rent: 260, x: 45, y: 64 },
  { id: 37, type: 'land', group: 'g6', name: '长生桥', sub: '南部新城', price: 700, rent: 130, x: 56, y: 64 },
  { id: 38, type: 'land', group: 'g6', name: '茶园', sub: '南部新城', price: 750, rent: 140, x: 67, y: 64 },
  { id: 39, type: 'land', group: 'g6', name: '巴南万达', sub: '南部新城', price: 1000, rent: 190, x: 78, y: 64 },
  { id: 40, type: 'land', group: 'g6', name: '鱼洞', sub: '南部新城', price: 650, rent: 120, x: 89, y: 64 },
  { id: 41, type: 'land', name: '大江', sub: '普通', price: 600, rent: 110, x: 89, y: 77 },
  { id: 42, type: 'event', name: '重庆火锅', sub: '特色事件', x: 78, y: 77 },
  { id: 43, type: 'land', name: '巴南滨江', sub: '普通', price: 700, rent: 130, x: 67, y: 77, riverEdge: true },
  { id: 44, type: 'metro', name: '山城电梯', sub: '特殊交通', price: 1300, rent: 240, x: 56, y: 77 },
  { id: 45, type: 'land', group: 'g5', name: '九龙坡', sub: '九龙商业', price: 750, rent: 140, x: 45, y: 77 },
  { id: 46, type: 'land', name: '歇台子', sub: '普通', price: 700, rent: 130, x: 34, y: 77 },
  { id: 47, type: 'land', name: '上清寺', sub: '高级', price: 1500, rent: 280, x: 23, y: 77, riverEdge: true },
  { id: 48, type: 'bridge', name: '千厮门大桥', sub: '跨嘉陵江', price: 750, toll: 130, x: 12, y: 77 },
]

// 跨江边界（出发格 → 桥/通道格）：3→4 / 28→29 / 32→33 / 43→44 / 47→48
// 蛇形折返拐弯处（8→9、16→17、24→25、32→33、40→41）由路径线自动连接

// 两江背景：嘉陵江（左上→黄花园桥→左下落千厮门桥），长江（右上→菜园坝→东水门→左下）
export const RIVERS = [
  { name: '嘉陵江', d: 'M 4 0 Q 26 6 44 11 Q 50 15 47 26 Q 43 38 32 46 Q 20 54 12 64 Q 6 72 12 77 Q 17 84 9 90' },
  { name: '长江', d: 'M 96 4 Q 80 10 70 18 Q 60 28 54 38 Q 50 46 45 51 Q 36 58 24 60 Q 16 62 12 64 Q 8 68 14 84' },
]

// 轻轨线路（红土地 9 → 李子坝 28 → 山城电梯 44 虚线连接，立体交通）
export const METRO_LINE = 'M 89 25 Q 82 36 68 43 Q 58 48 56 51 Q 54 62 56 77'

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
