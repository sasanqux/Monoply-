// bank.js — 资金统一出入账入口（保证账目一致、日志完整）+ 银行贷款系统
import { TILES, SELL_RATIO } from './board.js'

export const LOAN_TERM = 10        // 贷款期限（回合数）
export const LOAN_INTEREST = 1.2   // 还款倍数（借 100 还 120，20% 利息）
export const LOAN_MAX_RATIO = 0.5  // 贷款上限 = 总资产 × 50%

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

// 计算玩家可借额度（总资产 × 50% - 已借未还）
export function loanLimit(player, totalAssetsValue) {
  const maxByAsset = Math.floor(totalAssetsValue * LOAN_MAX_RATIO)
  return Math.max(0, maxByAsset - (player.loan || 0))
}

// 借款：给玩家现金，记录贷款（到期回合 = 当前回合 + 10）
export function takeLoan(state, player, amount) {
  const repayAmount = Math.round(amount * LOAN_INTEREST)
  player.money += amount
  player.loan = (player.loan || 0) + amount
  player.loanDue = state.round + LOAN_TERM
  player.loanRepay = (player.loanRepay || 0) + repayAmount
  state.log.push(`🏦 ${player.name} 向银行借款 ¥${amount}（到期还 ¥${repayAmount}，第 ${player.loanDue} 回合前）`)
}

// 还款：任意金额（不超过待还总额）
export function repayLoan(state, player, amount) {
  const owed = player.loanRepay || 0
  const actual = Math.min(amount, owed)
  player.money -= actual
  const ratio = actual / owed
  const principalPaid = Math.round((player.loan || 0) * ratio)
  player.loan = (player.loan || 0) - principalPaid
  player.loanRepay = owed - actual
  if (player.loanRepay <= 0) {
    player.loan = 0
    player.loanDue = 0
    player.loanRepay = 0
  }
  state.log.push(`💳 ${player.name} 还款 ¥${actual}（剩余待还 ¥${player.loanRepay}）`)
}

// 强制变卖：从最低价地产开始卖，直到凑够金额；返回 { enough, raised }
export function forceSellForLoan(state, player, amount) {
  let raised = 0
  const sellPrice = (tile) => Math.round(tile.price * SELL_RATIO)
  const sorted = [...player.properties]
    .filter((idx) => !player.mortgaged?.[idx])
    .sort((a, b) => TILES[a].price - TILES[b].price)

  for (const idx of sorted) {
    if (raised >= amount) break
    const tile = TILES[idx]
    const sp = sellPrice(tile)
    raised += sp
    player.properties = player.properties.filter((i) => i !== idx)
    delete player.levels[idx]
    state.log.push(`🏦 银行强制变卖 ${player.name} 的「${tile.name}」得 ¥${sp}（还贷）`)
  }
  return { enough: raised >= amount, raised }
}

// 贷款到期处理：能还就还，不能就强制变卖，再不够就破产
export function processLoanDue(state, player) {
  const owed = player.loanRepay || 0
  if (owed <= 0) return false // 无贷款

  // 现金够 → 直接扣
  if (player.money >= owed) {
    repayLoan(state, player, owed)
    return true
  }

  // 现金不够 → 强制变卖补差额
  const shortfall = owed - player.money
  const { raised } = forceSellForLoan(state, player, shortfall)

  // 用现金 + 卖地钱一起还
  player.money += raised

  if (player.money >= owed) {
    repayLoan(state, player, owed)
    return true
  }

  // 卖光+现金仍不够 → 剩余挂账，标记违约
  const remaining = owed - player.money
  player.money = 0
  player.loanRepay = remaining
  player.loan = remaining
  state.log.push(`🏦 ${player.name} 变卖全部资产仍无法还清贷款（欠 ¥${remaining}），已违约！`)
  return false
}
