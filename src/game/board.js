// board.js — 重庆 52 格网格地图（用户地图为准 · 图结构支持分岔路口）
// 类型：start 起点 / land 普通地产 / scenic 景点 / station 轻轨站 / mall 商圈 / chance 事件 / corner 奖励格
// 走棋为图结构：每格有 next（直行后继）；forks 非空则为分岔格，剩余步数>0 时暂停让玩家选方向
// 坐标：网格 (col,row)，大块占 w×h 格；tilePosition 由网格换算为 0-100 百分比

export const START_MONEY_DEFAULT = 5000
export const PASS_START_SALARY = 300
export const JAIL_TURNS = 2
export const HOSPITAL_FEE = 200
export const WORKSHOP_FEE = 50
export const UPGRADE_COST_RATIO = 0.5
export const SELL_RATIO = 0.4
export const METRO_FEE = 150
export const METRO_USE_FEE = 150
export const START_ID = 1
export const TILE_COUNT = 52

// 商圈组合（group 字段）→ 名称；同组地产全拥有 → 租金 ×2
export const GROUPS = {
  "g1 \u6e1d\u4e2d\u6838\u5fc3": { name: "g1 \u6e1d\u4e2d\u6838\u5fc3", color: '#ef4444' },
  "g2 \u4e24\u6c5f\u5546\u4e1a": { name: "g2 \u4e24\u6c5f\u5546\u4e1a", color: '#3b82f6' },
  "g3 \u4eba\u6587\u65c5\u6e38": { name: "g3 \u4eba\u6587\u65c5\u6e38", color: '#22c55e' },
  "g4 \u5357\u5cb8\u6ee8\u6c5f": { name: "g4 \u5357\u5cb8\u6ee8\u6c5f", color: '#f59e0b' },
  "g5 \u4e5d\u9f99\u5546\u4e1a": { name: "g5 \u4e5d\u9f99\u5546\u4e1a", color: '#8b5cf6' },
  "g6 \u5317\u90e8\u65b0\u57ce": { name: "g6 \u5317\u90e8\u65b0\u57ce", color: '#06b6d4' },
}

export const SHOPS = [
  { level: 0, name: '空地', icon: '' },
  { level: 1, name: '小面馆', icon: 'noodle' },
  { level: 2, name: '火锅店', icon: 'hotpot' },
  { level: 3, name: '串串店', icon: 'skewer' },
]

export const VEHICLES = {
  walk: { name: '走路', dice: 1, icon: 'bike' },
  bike: { name: '自行车', dice: 2, icon: 'bike' },
  moto: { name: '摩托', dice: 3, icon: 'moto' },
  car: { name: '汽车', dice: 4, icon: 'car' },
  plane: { name: '飞机', dice: 5, icon: 'plane' },
}
export const VEHICLE_ORDER = ['walk', 'bike', 'moto', 'car', 'plane']

// 52 格（索引 = 格子 id，1-52；id 1 = 朝天门起点）
export const TILES = [
  null,
  { id: 1, type: "start", name: "\u671d\u5929\u95e8", col: 8, row: 3, w: 1, h: 3, icon: "flag", next: 50, forks: [50, 49], },
  { id: 2, type: "land", name: "\u5f39\u5b50\u77f3", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 700, rent: 140, col: 9, row: 3, w: 1, h: 1, icon: "house", next: 3, },
  { id: 3, type: "land", name: "\u4e0a\u65b0\u8857", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 700, rent: 140, col: 9, row: 4, w: 1, h: 1, icon: "house", next: 4, },
  { id: 4, type: "land", name: "\u5357\u5c71", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 700, rent: 140, col: 9, row: 5, w: 1, h: 1, icon: "house", next: 5, },
  { id: 5, type: "station", name: "\u8336\u56ed", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 1100, rent: 150, metroFee: 150, col: 9, row: 6, w: 1, h: 1, icon: "metro", next: 6, },
  { id: 6, type: "chance", name: "\u547d\u8fd0", col: 9, row: 7, w: 1, h: 1, icon: "event", next: 7, },
  { id: 7, type: "land", name: "\u5357\u5f6d", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 700, rent: 140, col: 9, row: 8, w: 1, h: 1, icon: "house", next: 8, },
  { id: 8, type: "mall", name: "\u5357\u576a", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 1400, rent: 280, col: 8, row: 8, w: 1, h: 1, icon: "shop", next: 9, },
  { id: 9, type: "land", name: "\u674e\u5bb6\u6cb1", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 700, rent: 140, col: 7, row: 8, w: 1, h: 1, icon: "house", next: 10, },
  { id: 10, type: "land", name: "\u5df4\u5357", group: "g4 \u5357\u5cb8\u6ee8\u6c5f", price: 700, rent: 140, col: 6, row: 8, w: 1, h: 1, icon: "house", next: 11, },
  { id: 11, type: "land", name: "\u5927\u6e21\u53e3", group: "g5 \u4e5d\u9f99\u5546\u4e1a", price: 700, rent: 140, col: 4, row: 8, w: 2, h: 1, icon: "house", next: 12, },
  { id: 12, type: "station", name: "\u6768\u5bb6\u576a", group: "g5 \u4e5d\u9f99\u5546\u4e1a", price: 1100, rent: 150, metroFee: 150, col: 3, row: 8, w: 1, h: 1, icon: "metro", next: 13, },
  { id: 13, type: "land", name: "\u77f3\u6865\u94fa", group: "g5 \u4e5d\u9f99\u5546\u4e1a", price: 700, rent: 140, col: 2, row: 8, w: 1, h: 1, icon: "house", next: 14, forks: [51], },
  { id: 14, type: "scenic", name: "\u4e2d\u6881\u5c71", group: "g5 \u4e5d\u9f99\u5546\u4e1a", price: 900, rent: 180, col: 1, row: 8, w: 1, h: 1, icon: "tree", next: 15, },
  { id: 15, type: "land", name: "\u534e\u5ca9", group: "g5 \u4e5d\u9f99\u5546\u4e1a", price: 700, rent: 140, col: 0, row: 8, w: 1, h: 1, icon: "house", next: 16, },
  { id: 16, type: "land", name: "\u91cd\u5e86\u897f\u7ad9", group: "g5 \u4e5d\u9f99\u5546\u4e1a", price: 700, rent: 140, col: 0, row: 7, w: 1, h: 1, icon: "house", next: 17, },
  { id: 17, type: "mall", name: "\u6c99\u576a\u575d", group: "g3 \u4eba\u6587\u65c5\u6e38", price: 2100, rent: 420, col: 0, row: 6, w: 1, h: 1, icon: "shop", next: 18, },
  { id: 18, type: "land", name: "\u91cd\u5927", group: "g3 \u4eba\u6587\u65c5\u6e38", price: 700, rent: 140, col: 0, row: 4, w: 1, h: 1, icon: "house", next: 19, },
  { id: 19, type: "scenic", name: "\u78c1\u5668\u53e3", group: "g3 \u4eba\u6587\u65c5\u6e38", price: 900, rent: 180, col: 0, row: 3, w: 1, h: 1, icon: "tree", next: 20, forks: [41], },
  { id: 20, type: "scenic", name: "\u6b4c\u4e50\u5c71", group: "g3 \u4eba\u6587\u65c5\u6e38", price: 900, rent: 180, col: 0, row: 2, w: 1, h: 1, icon: "tree", next: 21, },
  { id: 21, type: "station", name: "\u53cc\u7891", group: "g3 \u4eba\u6587\u65c5\u6e38", price: 1100, rent: 150, metroFee: 150, col: 0, row: 1, w: 1, h: 1, icon: "metro", next: 22, },
  { id: 22, type: "corner", name: "\u94dc\u6881", col: 0, row: 0, w: 1, h: 1, icon: "plaza", next: 23, },
  { id: 23, type: "land", name: "\u5317\u789a", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 700, rent: 140, col: 1, row: 0, w: 2, h: 1, icon: "house", next: 24, },
  { id: 24, type: "scenic", name: "\u4e5d\u66f2\u6cb3", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 900, rent: 180, col: 3, row: 0, w: 1, h: 1, icon: "tree", next: 25, },
  { id: 25, type: "land", name: "\u56ed\u535a\u4e2d\u5fc3", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 700, rent: 140, col: 4, row: 0, w: 1, h: 1, icon: "house", next: 26, },
  { id: 26, type: "chance", name: "\u673a\u4f1a", col: 5, row: 0, w: 1, h: 1, icon: "event", next: 27, forks: [36], },
  { id: 27, type: "station", name: "\u4e2d\u592e\u516c\u56ed\u4e1c", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 1100, rent: 150, metroFee: 150, col: 6, row: 0, w: 1, h: 1, icon: "metro", next: 28, },
  { id: 28, type: "land", name: "\u91cd\u5e86\u516b\u4e2d", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 700, rent: 140, col: 7, row: 0, w: 1, h: 1, icon: "house", next: 29, },
  { id: 29, type: "land", name: "\u6c5f\u5317\u673a\u573a", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 1050, rent: 210, col: 8, row: 0, w: 1, h: 1, icon: "house", next: 30, },
  { id: 30, type: "corner", name: "\u94c1\u5c71\u576a", col: 9, row: 0, w: 1, h: 1, icon: "plaza", next: 31, },
  { id: 31, type: "land", name: "\u5bf8\u6ee9", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 700, rent: 140, col: 9, row: 1, w: 1, h: 1, icon: "house", next: 32, },
  { id: 32, type: "scenic", name: "\u5e7f\u9633\u5c9b", group: "g6 \u5317\u90e8\u65b0\u57ce", price: 900, rent: 180, col: 9, row: 2, w: 1, h: 1, icon: "tree", next: 33, },
  { id: 33, type: "land", name: "\u6c5f\u5317\u57ce", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 1050, rent: 210, col: 7, row: 2, w: 1, h: 1, icon: "house", next: 34, },
  { id: 34, type: "land", name: "\u4e94\u91cc\u5e97", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 700, rent: 140, col: 6, row: 2, w: 1, h: 1, icon: "house", next: 35, },
  { id: 35, type: "land", name: "\u9f99\u5934\u5bfa", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 700, rent: 140, col: 5, row: 2, w: 1, h: 1, icon: "house", next: 36, forks: [37], },
  { id: 36, type: "land", name: "\u9e33\u9e2f", price: 700, rent: 140, col: 5, row: 1, w: 1, h: 1, icon: "house", next: 37, },
  { id: 37, type: "land", name: "\u9ec4\u6ce5\u78c5", price: 700, rent: 140, col: 4, row: 2, w: 1, h: 1, icon: "house", next: 38, },
  { id: 38, type: "mall", name: "\u89c2\u97f3\u6865", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 1400, rent: 280, col: 3, row: 2, w: 1, h: 1, icon: "shop", next: 39, },
  { id: 39, type: "station", name: "\u5927\u9f99\u5c71", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 1100, rent: 150, metroFee: 150, col: 2, row: 2, w: 1, h: 1, icon: "metro", next: 40, },
  { id: 40, type: "land", name: "\u9e3f\u6069\u5bfa", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 700, rent: 140, col: 2, row: 3, w: 1, h: 1, icon: "house", next: 41, },
  { id: 41, type: "land", name: "\u5357\u6865\u5bfa", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 700, rent: 140, col: 1, row: 3, w: 1, h: 1, icon: "house", next: 42, },
  { id: 42, type: "land", name: "\u5927\u77f3\u575d", group: "g2 \u4e24\u6c5f\u5546\u4e1a", price: 700, rent: 140, col: 1, row: 5, w: 1, h: 1, icon: "house", next: 43, },
  { id: 43, type: "land", name: "\u4e09\u5ce1\u5e7f\u573a", price: 700, rent: 140, col: 0, row: 5, w: 1, h: 1, icon: "house", next: 44, forks: [17, 18], },
  { id: 44, type: "land", name: "\u5316\u9f99\u6865", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 700, rent: 140, col: 2, row: 5, w: 1, h: 1, icon: "house", next: 45, forks: [52], },
  { id: 45, type: "land", name: "\u4e24\u8def\u53e3", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 700, rent: 140, col: 3, row: 5, w: 1, h: 1, icon: "house", next: 46, },
  { id: 46, type: "land", name: "\u83dc\u56ed\u575d", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 700, rent: 140, col: 4, row: 5, w: 1, h: 1, icon: "house", next: 47, },
  { id: 47, type: "scenic", name: "\u5927\u793c\u5802", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 900, rent: 180, col: 5, row: 5, w: 1, h: 1, icon: "tree", next: 48, },
  { id: 48, type: "land", name: "\u8f83\u573a\u53e3", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 700, rent: 140, col: 6, row: 5, w: 1, h: 1, icon: "house", next: 49, },
  { id: 49, type: "mall", name: "\u89e3\u653e\u7891", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 2100, rent: 420, col: 7, row: 5, w: 1, h: 1, icon: "shop", next: 1, },
  { id: 50, type: "scenic", name: "\u6d2a\u5d16\u6d1e", group: "g1 \u6e1d\u4e2d\u6838\u5fc3", price: 900, rent: 180, col: 7, row: 3, w: 1, h: 1, icon: "tree", next: 2, },
  { id: 51, type: "land", name: "\u8881\u5bb6\u5c97", group: "g5 \u4e5d\u9f99\u5546\u4e1a", price: 700, rent: 140, col: 2, row: 7, w: 1, h: 1, icon: "house", next: 52, },
  { id: 52, type: "land", name: "\u5927\u576a", group: "g5 \u4e5d\u9f99\u5546\u4e1a", price: 700, rent: 140, col: 2, row: 6, w: 1, h: 1, icon: "house", next: 44, },
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
  const ids = [1, 50, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49]  // 走格环：1→50→2…→49→1
  return ids.map((i) => { const p = tilePosition(i); return p.x + ',' + p.y }).join(' ')
})()

export function getTile(index) { return TILES[index] }
export function isPropertyTile(tile) { return tile && ['land','scenic','station','mall'].includes(tile.type) }
export function isBridge() { return false }
export function isMetro(tile) { return tile && tile.type === 'station' }
export function isEvent(tile) { return tile && tile.type === 'chance' }
export function groupTiles(group) { return TILES.filter((t) => t && t.group === group) }
export const METRO_STATIONS = TILES.filter((t) => t && t.type === 'station').map((t) => t.id)