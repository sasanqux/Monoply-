// board.js — 重庆 48 格蜿蜒闭环地图（极坐标三叶波浪环 · 两江 · 轻轨 · 商圈 · 数据驱动）
// 类型：start 起点 / land 地产 / bridge 桥梁 / metro 轻轨站 / event 事件
// 商圈组：同组地产全拥有 → 租金 ×2；riverEdge[i]=true 表示 i→i+1 跨江（i+1 必须是桥/通道格）
// 布局：闭环波浪环（非矩形），起点 1 解放碑在左上（渝中方向），顺时针绕一圈回起点

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
  { level: 1, name: '小面馆', icon: 'noodle' },
  { level: 2, name: '火锅店', icon: 'hotpot' },
  { level: 3, name: '串串店', icon: 'skewer' },
]

// 载具 → 掷骰数
export const VEHICLES = {
  walk: { name: '走路', dice: 2, icon: 'bike' },
  bike: { name: '自行车', dice: 3, icon: 'bike' },
  moto: { name: '摩托', dice: 4, icon: 'moto' },
  car: { name: '汽车', dice: 5, icon: 'car' },
  plane: { name: '飞机', dice: 6, icon: 'plane' },
}
export const VEHICLE_ORDER = ['walk', 'bike', 'moto', 'car', 'plane']

export const TILE_COUNT = 48

// ===== 棱角分明的折线路径（环线轻轨图风格 · 渝中在中心 · 零自交） =====
// 渝中半岛在地图中心（解放碑起点 36,48 中心偏左，两江交汇处），江北/渝北在北、沙坪坝九龙坡在西、南岸巴南在南
// 全水平/垂直段（地铁图标准），48 格按每段分配整数格子、段内居中
const SEGMENTS = [
  [36, 48], [36, 16], [64, 16], [64, 8], [92, 8], [92, 34], [84, 34], [84, 52],
  [92, 52], [92, 76], [64, 76], [36, 76], [36, 84], [12, 84], [12, 60], [20, 60],
  [20, 48], [28, 48], [36, 48],
]
// 每段分配的格子数（Σ=48；段内间距均 ≥6，适配横长条格子）
const ASSIGN = [5, 4, 1, 4, 4, 1, 3, 1, 4, 4, 4, 1, 3, 4, 1, 2, 1, 1]
const _segLen = SEGMENTS.slice(0, -1).map((a, i) =>
  Math.hypot(SEGMENTS[i + 1][0] - a[0], SEGMENTS[i + 1][1] - a[1])
)
const _tileStart = [0]
for (let i = 0; i < ASSIGN.length; i++) _tileStart.push(_tileStart[i] + ASSIGN[i])

// 折线本身（用于 Board.vue 画路径）
export const PATH_POLYLINE = SEGMENTS.map((s) => s.join(',')).join(' ')

export function tilePosition(id) {
  let si = 0
  for (let j = 0; j < ASSIGN.length; j++) {
    if (_tileStart[j + 1] >= id) { si = j; break }
  }
  if (ASSIGN[si] === 0) {
    si--
    while (ASSIGN[si] === 0) si--
  }
  const k = id - 1 - _tileStart[si]
  const t = (k + 1) / (ASSIGN[si] + 1)
  const a = SEGMENTS[si], b = SEGMENTS[si + 1]
  return {
    x: +(a[0] + (b[0] - a[0]) * t).toFixed(1),
    y: +(a[1] + (b[1] - a[1]) * t).toFixed(1),
  }
}

// 48 格（索引 = 格子 id，1-48）
export const TILES = [
  null,
  { id: 1, type: 'start', name: '解放碑', sub: '起点·渝中' },
  { id: 2, type: 'land', group: 'g1', name: '临江门', sub: '渝中核心', price: 500, rent: 90 },
  { id: 3, type: 'land', group: 'g1', name: '大溪沟', sub: '渝中核心', price: 550, rent: 100, riverEdge: true },
  { id: 4, type: 'bridge', name: '黄花园大桥', sub: '跨嘉陵江', price: 700, toll: 120 },
  { id: 5, type: 'land', group: 'g2', name: '江北嘴', sub: '两江商业', price: 1600, rent: 300 },
  { id: 6, type: 'land', group: 'g2', name: '大剧院', sub: '两江商业', price: 1300, rent: 240 },
  { id: 7, type: 'land', group: 'g2', name: '观音桥', sub: '两江商业', price: 1100, rent: 200 },
  { id: 8, type: 'land', group: 'g2', name: '九街', sub: '两江商业', price: 1000, rent: 190 },
  { id: 9, type: 'metro', name: '红土地', sub: '轻轨站', price: 1200, rent: 200 },
  { id: 10, type: 'land', name: '五里店', sub: '普通', price: 600, rent: 110 },
  { id: 11, type: 'land', name: '寸滩', sub: '普通', price: 650, rent: 120 },
  { id: 12, type: 'land', name: '江北机场', sub: '交通', price: 1200, rent: 220 },
  { id: 13, type: 'land', name: '渝北中央公园', sub: '高级', price: 1700, rent: 320 },
  { id: 14, type: 'land', name: '礼嘉', sub: '普通', price: 700, rent: 130 },
  { id: 15, type: 'land', name: '金山寺', sub: '普通', price: 750, rent: 140 },
  { id: 16, type: 'event', name: '山城奇遇', sub: '事件' },
  { id: 17, type: 'land', group: 'g3', name: '沙坪坝', sub: '人文旅游', price: 1000, rent: 190 },
  { id: 18, type: 'land', group: 'g3', name: '三峡广场', sub: '人文旅游', price: 1500, rent: 280 },
  { id: 19, type: 'land', group: 'g3', name: '磁器口', sub: '人文旅游', price: 1200, rent: 220 },
  { id: 20, type: 'land', name: '石井坡', sub: '普通', price: 600, rent: 110 },
  { id: 21, type: 'land', name: '重庆西站', sub: '交通枢纽', price: 1300, rent: 240 },
  { id: 22, type: 'land', name: '大渡口', sub: '普通', price: 650, rent: 120 },
  { id: 23, type: 'land', name: '九宫庙', sub: '普通', price: 700, rent: 130 },
  { id: 24, type: 'land', group: 'g5', name: '杨家坪', sub: '九龙商业', price: 1100, rent: 200 },
  { id: 25, type: 'land', group: 'g5', name: '谢家湾', sub: '九龙商业', price: 700, rent: 130 },
  { id: 26, type: 'land', group: 'g5', name: '袁家岗', sub: '九龙商业', price: 750, rent: 140 },
  { id: 27, type: 'land', name: '鹅岭', sub: '景观', price: 1100, rent: 200 },
  { id: 28, type: 'metro', name: '李子坝', sub: '轻轨+地标', price: 1400, rent: 260, upgradable: true, riverEdge: true },
  { id: 29, type: 'bridge', name: '菜园坝大桥', sub: '跨长江', price: 800, toll: 140 },
  { id: 30, type: 'land', group: 'g4', name: '南坪', sub: '南岸滨江', price: 1050, rent: 195 },
  { id: 31, type: 'land', group: 'g4', name: '南滨路', sub: '南岸滨江', price: 1600, rent: 300 },
  { id: 32, type: 'land', group: 'g4', name: '弹子石', sub: '南岸滨江', price: 750, rent: 140, riverEdge: true },
  { id: 33, type: 'bridge', name: '东水门大桥', sub: '跨长江', price: 850, toll: 150 },
  { id: 34, type: 'land', group: 'g4', name: '龙门浩', sub: '南岸滨江', price: 800, rent: 150 },
  { id: 35, type: 'land', name: '黄桷垭', sub: '山城', price: 1100, rent: 200 },
  { id: 36, type: 'land', name: '南山', sub: '景区', price: 1400, rent: 260 },
  { id: 37, type: 'land', group: 'g6', name: '长生桥', sub: '南部新城', price: 700, rent: 130 },
  { id: 38, type: 'land', group: 'g6', name: '茶园', sub: '南部新城', price: 750, rent: 140 },
  { id: 39, type: 'land', group: 'g6', name: '巴南万达', sub: '南部新城', price: 1000, rent: 190 },
  { id: 40, type: 'land', group: 'g6', name: '鱼洞', sub: '南部新城', price: 650, rent: 120 },
  { id: 41, type: 'land', name: '大江', sub: '普通', price: 600, rent: 110 },
  { id: 42, type: 'event', name: '重庆火锅', sub: '特色事件' },
  { id: 43, type: 'land', name: '巴南滨江', sub: '普通', price: 700, rent: 130, riverEdge: true },
  { id: 44, type: 'metro', name: '山城电梯', sub: '特殊交通', price: 1300, rent: 240 },
  { id: 45, type: 'land', group: 'g5', name: '九龙坡', sub: '九龙商业', price: 750, rent: 140 },
  { id: 46, type: 'land', name: '歇台子', sub: '普通', price: 700, rent: 130 },
  { id: 47, type: 'land', name: '上清寺', sub: '高级', price: 1500, rent: 280, riverEdge: true },
  { id: 48, type: 'bridge', name: '千厮门大桥', sub: '跨嘉陵江', price: 750, toll: 130 },
]

// 跨江边界（出发格 → 桥/通道格）：3→4 / 28→29 / 32→33 / 43→44 / 47→48

// 两江背景（0-100 坐标）：江把棋盘分成 渝中半岛(中心)/江北(北)/江南(南) 三大区域
// 嘉陵江：渝中北侧，穿黄花园桥(4,~36,22)与千厮门桥(48,~32,48)；长江：南侧，穿菜园坝(29,~53,76)/东水门(33,~26,84)
export const RIVERS = [
  { name: '嘉陵江', d: 'M 20 2 Q 28 8 36 22 Q 34 30 33 38 Q 32 44 32 48 Q 28 52 20 54' },
  { name: '长江', d: 'M 8 58 Q 24 66 40 70 Q 50 73 53 76 Q 46 82 33 84 Q 20 88 10 90' },
]

// 三大区域（渝中半岛在中心）
export const REGIONS = [
  { name: '渝中半岛', d: 'M 30 58 L 52 56 L 54 30 L 40 26 L 24 40 Z', color: '#fef3c7' },
  { name: '江北', d: 'M 34 12 L 94 6 L 96 18 L 36 20 Z', color: '#dbeafe' },
  { name: '江南', d: 'M 10 58 L 94 50 L 96 90 L 10 90 Z', color: '#dcfce7' },
]

// 轻轨站列表（9 红土地 / 28 李子坝 / 44 山城电梯），连线由 Board 用 tilePosition 动态生成
export const METRO_STATIONS = [9, 28, 44]

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
