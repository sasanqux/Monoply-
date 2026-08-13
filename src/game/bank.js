// bank.js — 资金统一出入账入口（保证账目一致、日志完整）

export function addMoney(state, playerId, amount, reason) {
  const p = state.players.find((x) => x.id === playerId)
  if (!p || !p.alive) return
  p.money += amount
  state.log.push(`${p.name} ${reason}，资金 ${amount > 0 ? '+' : ''}${amount}（现 ${p.money}）`)
}

// 付款：fromId 支付 amount 给 toId（toId 为 null 表示交给银行）
export function payMoney(state, fromId, toId, amount, reason) {
  const from = state.players.find((x) => x.id === fromId)
  const to = toId ? state.players.find((x) => x.id === toId) : null
  if (!from || !from.alive) return
  from.money -= amount
  if (to) to.money += amount
  const toName = to ? to.name : '银行'
  state.log.push(`${from.name} ${reason}，支付 ${amount} 给 ${toName}（${from.name} 现 ${from.money}）`)
}

export function hasMoney(state, playerId, amount) {
  const p = state.players.find((x) => x.id === playerId)
  return !!p && p.money >= amount
}
