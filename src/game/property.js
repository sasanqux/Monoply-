// property.js — 地产：买地 / 收租 / 盖楼 / 卖地 / 资产估值
import { TILES, isPropertyTile, GROUPS, UPGRADE_COST_RATIO, SELL_RATIO } from './board.js'

// 基础租金（按等级 0~3 递增）
export function baseRent(tile, level = 0) {
  return tile.rent * (1 + level)
}

// 实际应收租金：含同组加成（拥有同组全部 → ×2）
export function getRent(state, tile, level = 0) {
  let rent = baseRent(tile, level)
  if (groupCount(state, tile.group) === groupTotal(tile.group)) {
    rent *= 2
  }
  return rent
}

export function groupTotal(group) {
  return TILES.filter((t) => t.group === group && isPropertyTile(t)).length
}

export function groupCount(state, group) {
  let count = 0
  for (const p of state.players) {
    if (!p.alive) continue
    for (const idx of p.properties) {
      if (TILES[idx].group === group) count++
    }
  }
  return count
}

export function upgradeCost(tile) {
  return Math.round(tile.price * UPGRADE_COST_RATIO)
}

export function canUpgrade(state, player, tile) {
  if (!player.properties.includes(tile.id)) return false
  const level = player.levels[tile.id] ?? 0
  if (level >= 3) return false
  return player.money >= upgradeCost(tile)
}

// 总资产 = 现金 + 地产估值（价格 + 盖楼投入）
export function totalAssets(player) {
  let total = player.money
  for (const idx of player.properties) {
    const tile = TILES[idx]
    const level = player.levels[idx] ?? 0
    total += tile.price + Math.round(tile.price * UPGRADE_COST_RATIO * level)
  }
  return total
}
