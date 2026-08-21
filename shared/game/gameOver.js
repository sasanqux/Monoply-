// gameOver.js — 破产判定与胜负判定
import { totalAssets } from './property.js'
import { TILES, SELL_RATIO } from './board.js'

// 自动卖地自救：先卖低等级地（保留已投入升级资金的高等级地，卖价不区分等级），
// 直到现金为正；仍不足则破产。抵押地不参与卖地（抵押地直接归银行）
export function checkBankrupt(state, player) {
  if (!player.alive || player.money >= 0) return

  // 先卖空地/低等级地，保留已投入升级资金的高等级地（卖价不区分等级，先卖等级低的更划算）
  // 抵押地不参与卖地（抵押地直接归银行）
  const owned = [...player.properties]
    .filter((idx) => !player.mortgaged?.[idx])
    .sort((a, b) => {
      const la = player.levels[a] ?? 0
      const lb = player.levels[b] ?? 0
      return la - lb
    })

  for (const idx of owned) {
    if (player.money >= 0) break
    const tile = TILES[idx]
    const level = player.levels[idx] ?? 0
    const upgradeCost = Math.round(tile.price * 0.5) // UPGRADE_COST_RATIO = 0.5
    const sellPrice = Math.round((tile.price + upgradeCost * level) * SELL_RATIO)
    player.money += sellPrice
    player.properties = player.properties.filter((i) => i !== idx)
    delete player.levels[idx]
    state.log.push(`${player.name} 资金不足，被迫卖掉 ${tile.name} 得 ${sellPrice}（现 ${player.money}）`)
  }

  if (player.money < 0) {
    // 破产：抵押地直接归银行，其余地产全部清空
    const mortgagedIds = Object.keys(player.mortgaged || {})
    for (const idx of mortgagedIds) {
      state.log.push(`🏦 ${player.name} 抵押中的「${TILES[idx].name}」被银行收回`)
    }
    player.alive = false
    player.bankrupt = true
    player.properties = []
    player.levels = {}
    player.mortgaged = {}
    state.log.push(`💸 ${player.name} 破产出局！`)
    // 记录破产提示（供弹窗展示）
    state._bankruptPopup = { playerId: player.id, playerName: player.name }
  }
}

// 当前存活玩家列表
export function alivePlayers(state) {
  return state.players.filter((p) => p.alive)
}

// 判断是否已有胜者（只剩一人存活）
export function getWinnerByElimination(state) {
  const alive = alivePlayers(state)
  if (alive.length === 1) return alive[0].id
  return null
}

// 回合数到点：按总资产排名，第一名胜
export function settleByTurns(state) {
  const ranked = [...state.players]
    .filter((p) => p.alive)
    .sort((a, b) => totalAssets(b) - totalAssets(a))
  return ranked[0]?.id ?? null
}
