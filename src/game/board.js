// board.js — 24 格都市地图静态配置（数据驱动：加格子 = 加一行）

export const START_MONEY_DEFAULT = 5000
export const PASS_START_SALARY = 300
export const JAIL_TURNS = 2
export const HOSPITAL_FEE = 200
export const UPGRADE_COST_RATIO = 0.5 // 盖楼费 = 价格 × 0.5
export const SELL_RATIO = 0.5 // 卖地价 = 价格 × 0.5

// 地段分组：拥有同组全部地产 → 租金 ×2
export const GROUPS = {
  A: { name: '街道', color: '#185FA5' },
  B: { name: '商圈', color: '#0F6E56' },
  C: { name: '写字楼', color: '#534AB7' },
}

// 24 格地图：index 即格子位置（0 = 起点）
export const TILES = [
  { id: 0, type: 'start', name: '起点', sub: 'START' },
  { id: 1, type: 'street', group: 'A', name: '解放大道', sub: '街道', price: 400, rent: 60 },
  { id: 2, type: 'tax', name: '个人所得税', sub: '缴税', amount: 150 },
  { id: 3, type: 'street', group: 'A', name: '中山路', sub: '街道', price: 450, rent: 70 },
  { id: 4, type: 'event', name: '机会', sub: 'EVENT' },
  { id: 5, type: 'plaza', group: 'B', name: '中央广场', sub: '商圈', price: 1300, rent: 220 },
  { id: 6, type: 'street', group: 'A', name: '建设路', sub: '街道', price: 500, rent: 80 },
  { id: 7, type: 'jail', name: '监狱', sub: '停留两轮' },
  { id: 8, type: 'tower', group: 'C', name: '环球中心', sub: '写字楼', price: 2800, rent: 560 },
  { id: 9, type: 'event', name: '机会', sub: 'EVENT' },
  { id: 10, type: 'street', group: 'A', name: '春熙路', sub: '街道', price: 550, rent: 90 },
  { id: 11, type: 'tax', name: '物业税', sub: '缴税', amount: 200 },
  { id: 12, type: 'street', group: 'A', name: '南京路', sub: '街道', price: 600, rent: 100 },
  { id: 13, type: 'hospital', name: '医院', sub: '医疗费' },
  { id: 14, type: 'plaza', group: 'B', name: '时代广场', sub: '商圈', price: 1500, rent: 260 },
  { id: 15, type: 'street', group: 'A', name: '淮海路', sub: '街道', price: 650, rent: 110 },
  { id: 16, type: 'event', name: '机会', sub: 'EVENT' },
  { id: 17, type: 'tower', group: 'C', name: '国际金融中心', sub: '写字楼', price: 3200, rent: 640 },
  { id: 18, type: 'street', group: 'A', name: '陆家嘴', sub: '街道', price: 700, rent: 120 },
  { id: 19, type: 'plaza', group: 'B', name: '万象城', sub: '商圈', price: 1700, rent: 300 },
  { id: 20, type: 'event', name: '机会', sub: 'EVENT' },
  { id: 21, type: 'street', group: 'A', name: '滨江大道', sub: '街道', price: 750, rent: 130 },
  { id: 22, type: 'tax', name: '奢侈税', sub: '缴税', amount: 250 },
  { id: 23, type: 'event', name: '机会', sub: 'EVENT' },
]

export function getTile(index) {
  return TILES[index % TILES.length]
}

export function isPropertyTile(tile) {
  return tile.type === 'street' || tile.type === 'plaza' || tile.type === 'tower'
}
