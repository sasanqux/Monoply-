// board.js — 重庆 40 格蜿蜒地图（两江交汇 · 桥资产 · 数据驱动）
// 格子属性：type / name / sub / price / rent / group / x,y（0-100 相对坐标）/ riverEdge（本格→下一格跨江）

export const START_MONEY_DEFAULT = 5000
export const PASS_START_SALARY = 300
export const JAIL_TURNS = 2
export const HOSPITAL_FEE = 200
export const WORKSHOP_FEE = 50 // 维修站保养费
export const UPGRADE_COST_RATIO = 0.5
export const SELL_RATIO = 0.5

// 地段分组（同组全拥有 → 租金 ×2）
export const GROUPS = {
  A: { name: '主城商圈', color: '#3b82f6' },
  B: { name: '区县中心', color: '#22c55e' },
}

// 载具 → 掷骰数（走路 2 颗，载具递增）
export const VEHICLES = {
  walk: { name: '走路', dice: 2, icon: '🏃' },
  bike: { name: '自行车', dice: 3, icon: '🚲' },
  moto: { name: '摩托', dice: 4, icon: '🛵' },
  car: { name: '汽车', dice: 5, icon: '🚗' },
  plane: { name: '飞机', dice: 6, icon: '✈️' },
}
export const VEHICLE_ORDER = ['walk', 'bike', 'moto', 'car', 'plane']

// 40 格：21 地产（渝中起点 + 主城 8 + 区县 13）+ 19 功能格
// x,y 为棋盘 0-100 坐标；riverEdge[i]=true 表示从格 i 走向 i+1 需跨江（必须经桥格 i+1）
export const TILES = [
  { id: 0, type: 'start', name: '解放碑', sub: '渝中·起点', x: 30, y: 44 },
  { id: 1, type: 'street', group: 'A', name: '观音桥', sub: '江北', price: 500, rent: 90, x: 34, y: 36 },
  { id: 2, type: 'card', name: '报刊亭', sub: '抽卡', x: 30, y: 30 },
  { id: 3, type: 'street', group: 'A', name: '三峡广场', sub: '沙坪坝', price: 550, rent: 100, x: 36, y: 24 },
  { id: 4, type: 'tax', name: '高速收费站', sub: '缴税', amount: 150, x: 44, y: 22 },
  { id: 5, type: 'street', group: 'A', name: '杨家坪', sub: '九龙坡', price: 600, rent: 110, x: 50, y: 26, riverEdge: true },
  { id: 6, type: 'bridge', name: '千厮门大桥', sub: '跨嘉陵江', price: 700, toll: 120, x: 56, y: 30 },
  { id: 7, type: 'street', group: 'A', name: '南坪', sub: '南岸', price: 650, rent: 120, x: 60, y: 36 },
  { id: 8, type: 'vehicle', name: '长江索道', sub: '交通枢纽', x: 56, y: 44 },
  { id: 9, type: 'street', group: 'A', name: '龙洲湾', sub: '巴南', price: 700, rent: 130, x: 62, y: 50 },
  { id: 10, type: 'event', name: '洪崖洞', sub: '事件', x: 52, y: 52 },
  { id: 11, type: 'street', group: 'A', name: '步行街', sub: '大渡口', price: 750, rent: 140, x: 46, y: 58 },
  { id: 12, type: 'item', name: '杂货铺', sub: '道具', x: 38, y: 60 },
  { id: 13, type: 'street', group: 'A', name: '缙云山', sub: '北碚', price: 800, rent: 150, x: 32, y: 66 },
  { id: 14, type: 'street', group: 'A', name: '江北机场', sub: '渝北', price: 900, rent: 160, x: 28, y: 74 },
  { id: 15, type: 'card', name: '漫展', sub: '抽卡', x: 36, y: 80 },
  { id: 16, type: 'plaza', group: 'B', name: '万州', sub: '区县', price: 1000, rent: 180, x: 44, y: 82, riverEdge: true },
  { id: 17, type: 'bridge', name: '朝天门大桥', sub: '跨长江', price: 800, toll: 140, x: 52, y: 78 },
  { id: 18, type: 'plaza', group: 'B', name: '涪陵', sub: '区县', price: 1100, rent: 200, x: 58, y: 82 },
  { id: 19, type: 'workshop', name: '汽修站', sub: '保养费', x: 64, y: 78 },
  { id: 20, type: 'plaza', group: 'B', name: '丰都', sub: '区县', price: 1150, rent: 210, x: 70, y: 74 },
  { id: 21, type: 'event', name: '白象街', sub: '事件', x: 76, y: 70 },
  { id: 22, type: 'plaza', group: 'B', name: '忠县', sub: '区县', price: 1200, rent: 220, x: 82, y: 66 },
  { id: 23, type: 'tax', name: '物业税', sub: '缴税', amount: 200, x: 86, y: 60 },
  { id: 24, type: 'plaza', group: 'B', name: '奉节', sub: '区县', price: 1250, rent: 230, x: 84, y: 52, riverEdge: true },
  { id: 25, type: 'bridge', name: '鹅公岩大桥', sub: '跨长江', price: 900, toll: 160, x: 78, y: 48 },
  { id: 26, type: 'plaza', group: 'B', name: '巫山', sub: '区县', price: 1300, rent: 240, x: 72, y: 44 },
  { id: 27, type: 'item', name: '旧货市场', sub: '道具', x: 68, y: 38 },
  { id: 28, type: 'plaza', group: 'B', name: '黔江', sub: '区县', price: 1350, rent: 250, x: 74, y: 32 },
  { id: 29, type: 'plaza', group: 'B', name: '武隆', sub: '区县', price: 1400, rent: 260, x: 70, y: 24 },
  { id: 30, type: 'vehicle', name: '轨道环线', sub: '交通枢纽', x: 62, y: 20 },
  { id: 31, type: 'plaza', group: 'B', name: '綦江', sub: '区县', price: 1450, rent: 270, x: 54, y: 16 },
  { id: 32, type: 'jail', name: '拘留所', sub: '停留两轮', x: 46, y: 14 },
  { id: 33, type: 'plaza', group: 'B', name: '长寿', sub: '区县', price: 1500, rent: 280, x: 38, y: 12 },
  { id: 34, type: 'event', name: '李子坝轻轨', sub: '事件', x: 30, y: 14 },
  { id: 35, type: 'plaza', group: 'B', name: '璧山', sub: '区县', price: 1550, rent: 290, x: 22, y: 18 },
  { id: 36, type: 'hospital', name: '西南医院', sub: '医疗费', x: 16, y: 24 },
  { id: 37, type: 'plaza', group: 'B', name: '大足', sub: '区县', price: 1600, rent: 300, x: 10, y: 30 },
  { id: 38, type: 'vehicle', name: '公交枢纽', sub: '交通枢纽', x: 8, y: 40 },
  { id: 39, type: 'plaza', group: 'B', name: '江津', sub: '区县', price: 1650, rent: 310, x: 16, y: 46 },
]

// 跨江边界（riverEdge 标记在"出发格"）：5→6 千厮门大桥（嘉陵江）/ 16→17 朝天门大桥（长江）/ 24→25 鹅公岩大桥（长江）
// 39→0 不设跨江（绕行回渝中），保证路径闭环无死路

// 两江背景数据（SVG path，0-100 坐标系）：长江从东北蜿蜒南下，嘉陵江从西北汇入
export const RIVERS = [
  { name: '嘉陵江', d: 'M 8 0 Q 22 10 20 24 Q 18 38 34 44 Q 48 50 52 62 Q 55 72 50 84' },
  { name: '长江', d: 'M 62 0 Q 74 8 82 20 Q 90 32 88 46 Q 86 60 78 72 Q 70 82 58 85' },
]

export function getTile(index) {
  return TILES[((index % TILES.length) + TILES.length) % TILES.length]
}

export function isPropertyTile(tile) {
  return tile.type === 'street' || tile.type === 'plaza'
}

export function isBridge(tile) {
  return tile.type === 'bridge'
}

// 从格 i 走到 i+1 是否跨江（返回下一格，用于桥格检查）
export function nextTileIndex(i) {
  return (i + 1) % TILES.length
}
