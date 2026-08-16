// stock.js — 股票系统
// 10只股票，每回合末波动，玩家可随时买卖
// 规则：买入收1%手续费，卖出不限，持股上限5家，限价20%~250%
import { stockEventMultiplier } from './stockEvents.js'

// 股票定义
export const STOCKS = {
  cqbj: { code: 'cqbj', name: '重庆啤酒', price: 30, min: 6, max: 75, range: [-0.05, 0.10], icon: '🍺' },
  cqca: { code: 'cqca', name: '长安汽车', price: 20, min: 4, max: 50, range: [-0.08, 0.12], icon: '🚗' },
  zlc:  { code: 'zlc',  name: '涪陵榨菜', price: 25, min: 5, max: 63, range: [-0.06, 0.10], icon: '🥬' },
  tj:   { code: 'tj',   name: '太极集团', price: 35, min: 7, max: 88, range: [-0.10, 0.15], icon: '💊' },
  yyy:  { code: 'yyy',  name: '重庆银行', price: 15, min: 3, max: 38, range: [-0.05, 0.08], icon: '🏦' },
  yb:   { code: 'yb',   name: '重庆百货', price: 18, min: 4, max: 45, range: [-0.08, 0.12], icon: '🛒' },
  jk:   { code: 'jk',   name: '金科地产', price: 12, min: 2, max: 30, range: [-0.15, 0.25], icon: '🏗️' },
  bz:   { code: 'bz',   name: '八中教育', price: 40, min: 8, max: 100, range: [-0.12, 0.20], icon: '📚' },
  jgj:  { code: 'jgj',  name: '重庆建工', price: 22, min: 4, max: 55, range: [-0.10, 0.15], icon: '🏛️' },
  xz:   { code: 'xz',   name: '西南证券', price: 10, min: 2, max: 25, range: [-0.15, 0.30], icon: '📊' },
}

export const STOCK_CODES = Object.keys(STOCKS)
export const MAX_HOLDINGS = 5  // 最多持有5家不同股票
export const BUY_FEE_RATE = 0.01  // 买入手续费1%

// 初始化股票运行时状态（股价/历史/连续涨跌）
export function initStockRuntime() {
  const rt = {}
  for (const [code, def] of Object.entries(STOCKS)) {
    rt[code] = {
      current: def.price,    // 当前价
      prev: def.price,       // 上一回合价
      trend: 0,              // 连续同向次数（正=连涨，负=连跌）
      history: [],           // 价格历史
      name: def.name,        // 股票名称
      activeEvents: [],      // 活跃事件 [{text, icon, delta, turnsLeft}]
    }
  }
  return rt
}

// 买入股票
export function buyStock(state, player, code, shares) {
  const def = STOCKS[code]
  if (!def) return { ok: false, msg: '股票代码不存在' }
  const sharesNum = Math.floor(shares)
  if (sharesNum < 1) return { ok: false, msg: '至少买1股' }

  const price = state.stockRuntime[code].current
  const cost = price * sharesNum
  const fee = Math.max(1, Math.floor(cost * BUY_FEE_RATE))
  const total = cost + fee

  if (player.money < total) {
    return { ok: false, msg: `现金不足（需 ¥${total}，含手续费 ¥${fee}）` }
  }

  // 检查持股上限（不同股票数）
  const holdings = player.stockHoldings || {}
  const heldCodes = Object.keys(holdings).filter(c => holdings[c] > 0)
  if (!heldCodes.includes(code) && heldCodes.length >= MAX_HOLDINGS) {
    return { ok: false, msg: `最多持有 ${MAX_HOLDINGS} 家股票` }
  }

  // 执行买入
  player.money -= total
  if (!player.stockHoldings) player.stockHoldings = {}
  player.stockHoldings[code] = (player.stockHoldings[code] || 0) + sharesNum

  state.log.push(`📈 ${player.name} 买入 ${def.name} ${sharesNum} 股 @ ¥${price.toFixed(2)}（手续费 ¥${fee}，共 ¥${total}）`)
  return { ok: true, cost: total, fee }
}

// 卖出股票
export function sellStock(state, player, code, shares) {
  const def = STOCKS[code]
  if (!def) return { ok: false, msg: '股票代码不存在' }
  const sharesNum = Math.floor(shares)
  if (sharesNum < 1) return { ok: false, msg: '至少卖1股' }

  const holdings = player.stockHoldings || {}
  const held = holdings[code] || 0
  if (held < sharesNum) {
    return { ok: false, msg: `持仓不足（持有 ${held} 股）` }
  }

  const price = state.stockRuntime[code].current
  const revenue = Math.floor(price * sharesNum)

  // 执行卖出（卖出无手续费）
  player.money += revenue
  holdings[code] = held - sharesNum
  if (holdings[code] <= 0) delete holdings[code]

  state.log.push(`📉 ${player.name} 卖出 ${def.name} ${sharesNum} 股 @ ¥${price.toFixed(2)}（到账 ¥${revenue}）`)
  return { ok: true, revenue }
}

// 每回合结束调用：股价波动（受事件修正）
export function tickStockPrices(state) {
  for (const code of STOCK_CODES) {
    const def = STOCKS[code]
    const rt = state.stockRuntime[code]

    let [lo, hi] = def.range

    // 事件修正
    const eventDelta = stockEventMultiplier(state.stockRuntime, code)
    if (eventDelta !== 0) {
      lo += eventDelta
      hi += eventDelta
    }

    // 连续同向修正（微调）
    if (rt.trend >= 2) hi -= 0.05       // 连涨 → 上限减 5%
    else if (rt.trend <= -2) lo += 0.05 // 连跌 → 下限加 5%

    // 触底/触顶保护
    if (rt.current <= def.min) lo = Math.max(lo, 0)    // 触底只涨不跌
    if (rt.current >= def.max) hi = Math.min(hi, 0)    // 触顶只跌不涨

    // 随机波动
    const change = lo + Math.random() * (hi - lo)
    const newPrice = Math.max(def.min, Math.min(def.max, rt.current * (1 + change)))
    const roundedPrice = Math.round(newPrice * 100) / 100

    // 更新趋势
    if (roundedPrice > rt.current) rt.trend = rt.trend >= 0 ? rt.trend + 1 : 1
    else if (roundedPrice < rt.current) rt.trend = rt.trend <= 0 ? rt.trend - 1 : -1
    else rt.trend = 0

    rt.prev = rt.current
    rt.current = roundedPrice
    rt.history.push(roundedPrice)
    if (rt.history.length > 50) rt.history.shift()
  }
}

// 获取玩家持仓总市值
export function stockPortfolioValue(player, stockRuntime) {
  const holdings = player.stockHoldings || {}
  let total = 0
  for (const [code, shares] of Object.entries(holdings)) {
    if (shares > 0 && stockRuntime[code]) {
      total += stockRuntime[code].current * shares
    }
  }
  return Math.round(total)
}

// 卡片效果：黑市卡（涨停 +20%）
export function applyBlackStock(state, code) {
  const def = STOCKS[code]
  if (!def) return false
  const rt = state.stockRuntime[code]
  rt.pendingBoost = 0.20  // 下回合额外 +20%
  state.log.push(`📈 黑市卡生效！${def.name} 下回合将涨停！`)
  return true
}

// 卡片效果：红市卡（涨10%~30%）
export function applyRedStock(state, code) {
  const def = STOCKS[code]
  if (!def) return false
  const rt = state.stockRuntime[code]
  rt.pendingBoost = 0.10 + Math.random() * 0.20  // 10%~30%
  state.log.push(`📈 红市卡生效！${def.name} 下回合将大涨！`)
  return true
}
