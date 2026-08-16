// stockEvents.js — 股票事件池：每5回合随机触发，涨跌均衡
// 规则：每5回合抽取1-2条事件，影响特定股票1-3回合，不与机会格/神仙系统挂钩

export const STOCK_EVENTS = [
  // ---- cqbj 重庆啤酒 ----
  { text: '重庆马拉松赞助', code: 'cqbj', delta: 0.10, turns: 1, icon: '🏃' },
  { text: '换帅动荡', code: 'cqbj', delta: -0.15, turns: 1, icon: '📉' },
  { text: '夏季销量暴增', code: 'cqbj', delta: 0.12, turns: 2, icon: '🍺' },

  // ---- cqca 长安汽车 ----
  { text: '新车大卖', code: 'cqca', delta: 0.20, turns: 2, icon: '🚗' },
  { text: '召回事件', code: 'cqca', delta: -0.12, turns: 1, icon: '⚠️' },
  { text: '新能源补贴', code: 'cqca', delta: 0.15, turns: 2, icon: '🔋' },

  // ---- zlc 涪陵榨菜 ----
  { text: '出口受阻', code: 'zlc', delta: -0.10, turns: 1, icon: '📉' },
  { text: '新口味大受欢迎', code: 'zlc', delta: 0.18, turns: 2, icon: '🥬' },
  { text: '原料涨价', code: 'zlc', delta: -0.08, turns: 1, icon: '💸' },

  // ---- tj 太极集团 ----
  { text: '新药获批', code: 'tj', delta: 0.25, turns: 2, icon: '💊' },
  { text: '生产线事故', code: 'tj', delta: -0.10, turns: 1, icon: '⚠️' },

  // ---- yyy 重庆银行 ----
  { text: '降息', code: 'yyy', delta: -0.08, turns: 1, icon: '📉' },
  { text: '房贷松绑', code: 'yyy', delta: 0.12, turns: 2, icon: '🏠' },
  { text: '坏账率上升', code: 'yyy', delta: -0.10, turns: 1, icon: '💔' },

  // ---- yb 重庆百货 ----
  { text: '双十一爆款', code: 'yb', delta: 0.15, turns: 1, icon: '🛒' },
  { text: '电商冲击', code: 'yb', delta: -0.12, turns: 2, icon: '📉' },
  { text: '新店开业', code: 'yb', delta: 0.10, turns: 1, icon: '🎉' },

  // ---- jk 金科地产 ----
  { text: '债务违约', code: 'jk', delta: -0.30, turns: 3, icon: '📉' },
  { text: '政策松绑', code: 'jk', delta: 0.20, turns: 2, icon: '📈' },
  { text: '项目烂尾', code: 'jk', delta: -0.15, turns: 2, icon: '🏚️' },

  // ---- bz 八中教育 ----
  { text: '上市', code: 'bz', delta: 0.18, turns: 2, icon: '📚' },
  { text: '双减政策', code: 'bz', delta: -0.20, turns: 2, icon: '📉' },
  { text: '分校扩张', code: 'bz', delta: 0.12, turns: 1, icon: '🏫' },

  // ---- jgj 重庆建工 ----
  { text: '中标签大单', code: 'jgj', delta: 0.12, turns: 2, icon: '🏛️' },
  { text: '安全事故', code: 'jgj', delta: -0.15, turns: 1, icon: '⚠️' },
  { text: '基建投资加大', code: 'jgj', delta: 0.15, turns: 2, icon: '📈' },

  // ---- xz 西南证券 ----
  { text: '牛市来了', code: 'xz', delta: 0.35, turns: 3, icon: '📊' },
  { text: '熊市崩盘', code: 'xz', delta: -0.25, turns: 2, icon: '📉' },
  { text: 'IPO热潮', code: 'xz', delta: 0.20, turns: 2, icon: '🚀' },
]

// 抽取1-2条随机事件（不重复股票）
export function drawStockEvents() {
  const count = Math.random() < 0.4 ? 2 : 1 // 40%概率出2条
  const shuffled = [...STOCK_EVENTS].sort(() => Math.random() - 0.5)
  const picked = []
  const usedCodes = new Set()
  for (const ev of shuffled) {
    if (picked.length >= count) break
    if (usedCodes.has(ev.code)) continue // 同一轮不重复影响同一只股
    picked.push(ev)
    usedCodes.add(ev.code)
  }
  return picked
}

// 应用事件到股票运行时
export function applyStockEvent(state, event) {
  const rt = state.stockRuntime[event.code]
  if (!rt) return
  if (!rt.activeEvents) rt.activeEvents = []
  rt.activeEvents.push({
    text: event.text,
    icon: event.icon,
    delta: event.delta,
    turnsLeft: event.turns,
  })
}

// 获取某股票当前事件修正系数总和
export function stockEventMultiplier(stockRuntime, code) {
  const rt = stockRuntime[code]
  if (!rt?.activeEvents || rt.activeEvents.length === 0) return 0
  let total = 0
  for (const ev of rt.activeEvents) {
    total += ev.delta
  }
  return total
}

// 每回合结束：事件倒计时减1，到期移除
export function tickStockEvents(state) {
  for (const code of Object.keys(state.stockRuntime)) {
    const rt = state.stockRuntime[code]
    if (!rt.activeEvents || rt.activeEvents.length === 0) continue
    for (const ev of rt.activeEvents) {
      ev.turnsLeft -= 1
    }
    const expired = rt.activeEvents.filter((e) => e.turnsLeft <= 0)
    for (const ev of expired) {
      state.log.push(`📰 「${ev.text}」影响消退，${rt.name}恢复正常波动`)
    }
    rt.activeEvents = rt.activeEvents.filter((e) => e.turnsLeft > 0)
  }
}
