// board.js — 重庆 52 格网格地图（用户地图为准 · 图结构支持分岔路口）
// 类型：start 起点 / land 普通地产 / scenic 景点 / station 轻轨站 / mall 商圈 / chance 事件 / corner 奖励格
// 走棋为图结构：每格有 next（直行后继）；forks 非空则为分岔格，剩余步数>0 时暂停让玩家选方向
// 坐标：网格 (col,row)，大块占 w×h 格；tilePosition 由网格换算为 0-100 百分比

export const START_MONEY_DEFAULT = 20000
export const JAIL_TURNS = 2
export const HOSPITAL_FEE = 800
export const WORKSHOP_FEE = 200
export const UPGRADE_COST_RATIO = 0.5
export const SELL_RATIO = 0.4
export const METRO_FEE = 150 // 轻轨使用费（乘坐费 + 落到他人均为同一价格）
export const START_ID = 1
export const TILE_COUNT = 52

// 商圈组合（group 字段）→ 名称；拥有达到阈值 → 租金 ×1.5
// 阈值规则：≤8块组需5块，9块组需5块
export const GROUPS = {
  "g1 \u6e1d\u4e2d\u6838\u5fc3": { name: "渝中核心", color: '#ef4444', threshold: 5 },
  "g2 \u4e24\u6c5f\u5546\u4e1a": { name: "两江商业", color: '#3b82f6', threshold: 5 },
  "g4 \u5357\u5cb8\u6ee8\u6c5f": { name: "南岸滨江", color: '#f59e0b', threshold: 5 },
  "g5 \u4e5d\u9f99\u8d70\u5eca": { name: "九龙走廊", color: '#8b5cf6', threshold: 5 },
  "g6 \u5317\u90e8\u65b0\u57ce": { name: "北部新城", color: '#06b6d4', threshold: 5 },
  "g7 \u5df4\u6e1d\u6587\u65c5": { name: "巴渝文旅", color: '#10b981', threshold: 5 },
}

export const SHOPS = [
  { level: 0, name: '等级0', icon: '' },
  { level: 1, name: '等级1', icon: '' },
  { level: 2, name: '等级2', icon: '' },
  { level: 3, name: '等级3', icon: '' },
]

// 载具系统：预留接口（当前版本仅走路，载具获得/切换机制待实现）
export const VEHICLES = {
  walk: { name: '走路', dice: 1, icon: 'walk' },
  moto: { name: '摩托', dice: 2, icon: 'moto' },
  car: { name: '汽车', dice: 3, icon: 'car' },
  plane: { name: '飞机', dice: 5, icon: 'plane' },
}
export const VEHICLE_ORDER = ['walk', 'bike', 'moto', 'car', 'plane']

// 52 格（索引 = 格子 id，1-52；id 1 = 朝天门起点）
export const TILES = [
  null,
  { id: 1, type: "start", name: "\u671d\u5929\u95e8", col: 8, row: 3, w: 0.67, h: 3, icon: "flag", next: 50, forks: [50, 49], },
  { id: 2, type: "land", name: "\u5f39\u5b50\u77f3", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 4000, rent: 800, col: 9, row: 3, w: 1, h: 1, icon: "house", next: 3,  points: 40 },
  { id: 3, type: "land", name: "\u4e0a\u65b0\u8857", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 4000, rent: 800, col: 9, row: 4, w: 1, h: 1, icon: "house", next: 4,  points: 40 },
  { id: 4, type: "land", name: "\u5357\u5c71", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 4000, rent: 800, col: 9, row: 5, w: 1, h: 1, icon: "house", next: 5,  points: 40 },
  { id: 5, type: "station", name: "\u8336\u56ed", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 4000, rent: 300, col: 9, row: 6, w: 1, h: 1, icon: "metro", next: 6,  points: 40 },
  { id: 6, type: "chance", name: "\u5947\u9047", col: 9, row: 7, w: 1, h: 1, icon: "event", next: 7, },
  { id: 7, type: "land", name: "\u5357\u5f6d", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 2000, rent: 400, col: 9, row: 8, w: 1, h: 1, icon: "house", next: 8,  points: 100 },
  { id: 8, type: "mall", name: "\u5357\u576a", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 6000, rent: 1200, col: 8, row: 8, w: 1, h: 1, icon: "shop", next: 9,  points: 10 },
  { id: 9, type: "land", name: "\u674e\u5bb6\u6cb1", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 2000, rent: 400, col: 7, row: 8, w: 1, h: 1, icon: "house", next: 10,  points: 60 },
  { id: 10, type: "land", name: "\u5df4\u5357", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 3000, rent: 600, col: 6, row: 8, w: 1, h: 1, icon: "house", next: 11,  points: 60, shop: true },
  { id: 11, type: "land", name: "\u5927\u6e21\u53e3", group: "g5 \u4e5d\u9f99\u8d70\u5eca", price: 4000, rent: 800, col: 4, row: 8, w: 2, h: 1, icon: "house", next: 12,  points: 20 },
  { id: 12, type: "station", name: "\u6768\u5bb6\u576a", group: "g5 \u4e5d\u9f99\u8d70\u5eca", price: 6000, rent: 300, col: 3, row: 8, w: 1, h: 1, icon: "metro", next: 13,  points: 10 },
  { id: 13, type: "land", name: "\u77f3\u6865\u94fa", group: "g5 \u4e5d\u9f99\u8d70\u5eca", price: 4000, rent: 800, col: 2, row: 8, w: 1, h: 1, icon: "house", next: 14, forks: [51],  points: 20 },
  { id: 14, type: "scenic", name: "\u4e2d\u6881\u5c71", group: "g5 \u4e5d\u9f99\u8d70\u5eca", price: 3000, rent: 600, col: 1, row: 8, w: 1, h: 1, icon: "tree", next: 15,  points: 60 },
  { id: 15, type: "land", name: "\u534e\u5ca9", group: "g5 \u4e5d\u9f99\u8d70\u5eca", price: 3000, rent: 600, col: 0, row: 8, w: 1, h: 1, icon: "house", next: 16,  points: 60 },
  { id: 16, type: "land", name: "\u91cd\u5e86\u897f\u7ad9", group: "g5 \u4e5d\u9f99\u8d70\u5eca", price: 3000, rent: 600, col: 0, row: 7, w: 1, h: 1, icon: "house", next: 17,  points: 60 },
  { id: 17, type: "mall", name: "\u6c99\u576a\u575d", group: "g7 \u5df4\u6e1d\u6587\u65c5", price: 6000, rent: 1200, col: 0, row: 6, w: 1, h: 1, icon: "shop", next: 18,  points: 10 },
  { id: 18, type: "land", name: "\u91cd\u5e86\u5927\u5b66", group: "g7 \u5df4\u6e1d\u6587\u65c5", price: 4000, rent: 800, col: 0, row: 4, w: 1, h: 1, icon: "house", next: 19,  points: 20, god: true },
  { id: 19, type: "scenic", name: "\u78c1\u5668\u53e3", group: "g7 \u5df4\u6e1d\u6587\u65c5", price: 4000, rent: 800, col: 0, row: 3, w: 1, h: 1, icon: "tree", next: 20, forks: [41],  points: 20 },
  { id: 20, type: "scenic", name: "\u6b4c\u4e50\u5c71", group: "g7 \u5df4\u6e1d\u6587\u65c5", price: 3000, rent: 600, col: 0, row: 2, w: 1, h: 1, icon: "tree", next: 21,  points: 60 },
  { id: 21, type: "station", name: "\u53cc\u7891", group: "g7 \u5df4\u6e1d\u6587\u65c5", price: 3000, rent: 300, col: 0, row: 1, w: 1, h: 1, icon: "metro", next: 22,  points: 40 },
  { id: 22, type: "land", name: "\u94dc\u6881", group: "g7 \u5df4\u6e1d\u6587\u65c5", price: 2000, rent: 400, col: 0, row: 0, w: 1, h: 1, icon: "plaza", next: 23,  points: 100 },
  { id: 23, type: "land", name: "\u5317\u789a", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 2000, rent: 400, col: 1, row: 0, w: 2, h: 1, icon: "house", next: 24,  points: 80 },
  { id: 24, type: "scenic", name: "\u4e5d\u66f2\u6cb3", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 4000, rent: 800, col: 3, row: 0, w: 1, h: 1, icon: "tree", next: 25,  points: 20 },
  { id: 25, type: "land", name: "\u56fd\u535a\u4e2d\u5fc3", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 2000, rent: 400, col: 4, row: 0, w: 1, h: 1, icon: "house", next: 26,  points: 80 },
  { id: 26, type: "land", name: "\u60a6\u6765", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 3000, rent: 600, col: 5, row: 0, w: 1, h: 1, icon: "house", next: 27, forks: [36], points: 60 },
  { id: 27, type: "station", name: "\u4e2d\u592e\u516c\u56ed", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 5000, rent: 300, col: 6, row: 0, w: 1, h: 1, icon: "metro", next: 28,  points: 10 },
  { id: 28, type: "land", name: "\u91cd\u5e86\u516b\u4e2d", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 2000, rent: 400, col: 7, row: 0, w: 1, h: 1, icon: "house", next: 29,  points: 80 },
  { id: 29, type: "land", name: "\u6c5f\u5317\u673a\u573a", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 6000, rent: 1200, col: 8, row: 0, w: 1, h: 1, icon: "house", next: 30,  points: 10 },
  { id: 30, type: "scenic", name: "\u94c1\u5c71\u576a", group: "g7 \u5df4\u6e1d\u6587\u65c5", price: 3000, rent: 600, col: 9, row: 0, w: 1, h: 1, icon: "tree", next: 31,  points: 40 },
  { id: 31, type: "land", name: "\u5bf8\u6ee9", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 2000, rent: 400, col: 9, row: 1, w: 1, h: 1, icon: "house", next: 32,  points: 80, shop: true },
  { id: 32, type: "scenic", name: "\u5e7f\u9633\u5c9b", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 4000, rent: 800, col: 9, row: 2, w: 1, h: 1, icon: "tree", next: 1,  points: 20 },
  { id: 33, type: "land", name: "\u6c5f\u5317\u57ce", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 6000, rent: 1200, col: 7, row: 2, w: 1, h: 1, icon: "house", next: 34,  points: 10 },
  { id: 34, type: "land", name: "\u4e94\u91cc\u5e97", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 5000, rent: 1000, col: 6, row: 2, w: 1, h: 1, icon: "house", next: 35,  points: 10 },
  { id: 35, type: "land", name: "\u9f99\u5934\u5bfa", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 5000, rent: 1000, col: 5, row: 2, w: 1, h: 1, icon: "house", next: 36, forks: [37],  points: 10 },
  { id: 36, type: "land", name: "\u9e33\u9e2f", group: "g7 \u5df4\u6e1d\u6587\u65c5", price: 2000, rent: 400, col: 5, row: 1, w: 1, h: 1, icon: "house", next: 37,  points: 60 },
  { id: 37, type: "land", name: "\u9ec4\u6ce5\u78c5", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 2000, rent: 400, col: 4, row: 2, w: 1, h: 1, icon: "house", next: 38,  points: 60 },
  { id: 38, type: "mall", name: "\u89c2\u97f3\u6865", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 8000, rent: 1600, col: 3, row: 2, w: 1, h: 1, icon: "shop", next: 39,  points: 10 },
  { id: 39, type: "station", name: "\u5927\u9f99\u5c71", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 3000, rent: 300, col: 2, row: 2, w: 1, h: 1, icon: "metro", next: 40,  points: 40 },
  { id: 40, type: "land", name: "\u9e3f\u6069\u5bfa", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 3000, rent: 600, col: 2, row: 3, w: 1, h: 1, icon: "house", next: 41,  points: 40 },
  { id: 41, type: "land", name: "\u5357\u6865\u5bfa", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 3000, rent: 600, col: 1, row: 3, w: 1, h: 1, icon: "house", next: 43,  points: 40, lottery: true },
  { id: 42, type: "land", name: "\u5927\u77f3\u575d", price: 350, rent: 70, col: 1, row: 5, w: 1, h: 1, icon: "house", next: 43, removed: true, },
  { id: 43, type: "land", name: "\u4e09\u5ce1\u5e7f\u573a", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 4000, rent: 800, col: 0, row: 5, w: 1, h: 1, icon: "house", next: 44, forks: [17, 18],  points: 20 },
  { id: 44, type: "land", name: "\u5316\u9f99\u6865", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 6000, rent: 1200, col: 2, row: 5, w: 1, h: 1, icon: "house", next: 45, forks: [52],  points: 10 },
  { id: 45, type: "land", name: "\u4e24\u8def\u53e3", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 5000, rent: 1000, col: 3, row: 5, w: 1, h: 1, icon: "house", next: 46,  points: 20, lottery: true },
  { id: 46, type: "land", name: "\u83dc\u56ed\u575d", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 5000, rent: 1000, col: 4, row: 5, w: 1, h: 1, icon: "house", next: 47,  points: 20 },
  { id: 47, type: "land", name: "\u5927\u793c\u5802", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 5000, rent: 1000, col: 5, row: 5, w: 1, h: 1, icon: "tree", next: 48,  points: 20 },
  { id: 48, type: "land", name: "\u8f83\u573a\u53e3", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 6000, rent: 1200, col: 6, row: 5, w: 1, h: 1, icon: "house", next: 49,  points: 10 },
  { id: 49, type: "mall", name: "\u89e3\u653e\u7891", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 10000, rent: 2000, col: 7, row: 5, w: 1, h: 1, icon: "shop", next: 2,  points: 10 },
  { id: 50, type: "land", name: "\u6d2a\u5d16\u6d1e", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 8000, rent: 1600, col: 7, row: 3, w: 1, h: 1, icon: "tree", next: 33,  points: 10 },
  { id: 51, type: "land", name: "\u8881\u5bb6\u5c97", group: "g5 \u4e5d\u9f99\u8d70\u5eca", price: 3000, rent: 600, col: 2, row: 7, w: 1, h: 1, icon: "house", next: 52,  points: 40 },
  { id: 52, type: "land", name: "\u5927\u576a", group: "g5 \u4e5d\u9f99\u8d70\u5eca", price: 4000, rent: 800, col: 2, row: 6, w: 1, h: 1, icon: "house", next: 44,  points: 20 },
]

// 网格 → 0-100 百分比坐标（大块居中）
export function tilePosition(id) {
  const t = TILES[id]
  if (!t) return { x: 0, y: 0 }
  const x = ((t.col + (t.w - 1) / 2 + 0.5) / 10) * 100
  const y = ((t.row + (t.h - 1) / 2 + 0.5) / 9) * 100
  return { x: +x.toFixed(2), y: +y.toFixed(2) }
}

// 外圈主环折线（供 Board 画路径线）——按实际走格顺序：朝天门→洪崖洞→弹子石→…→解放碑→朝天门
export const PATH_POLYLINE = (() => {
  const ids = [1, 50, 33, 34, 35, 36, 37, 38, 39, 40, 41, 43, 44, 45, 46, 47, 48, 49, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]  // 走格环：1→50→33…→41→43…→32→1（大石坝已移除）
  return ids.map((i) => { const p = tilePosition(i); return p.x + ',' + p.y }).join(' ')
})()

export function getTile(index) { return TILES[index] }
export function isPropertyTile(tile) { return tile && ['land','scenic','station','mall'].includes(tile.type) }
export function isBridge() { return false }
export function isMetro(tile) { return tile && tile.type === 'station' }
export function isEvent(tile) { return tile && tile.type === 'chance' }
export function isGod(tile) { return tile && tile.god === true }
export function isLottery(tile) { return tile && tile.lottery === true }
export function groupTiles(group) { return TILES.filter((t) => t && t.group === group) }
export const METRO_STATIONS = TILES.filter((t) => t && t.type === 'station').map((t) => t.id)