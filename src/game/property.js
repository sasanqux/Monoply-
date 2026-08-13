// property.js — 地产：买地 / 收租（商圈加成）/ 开店升级 / 卖地 / 资产估值
import { TILES, isPropertyTile, isBridge, GROUPS, groupTiles, UPGRADE_COST_RATIO, SELL_RATIO } from './board.js'

// 基础租金（按等级 0~3：空地/小面馆/火锅店/串串店）
export function baseRent(tile, level = 0) {
  return tile.rent * (1 + level)
}

// 实际应收租金：商圈加成（组内地产全被同一玩家拥有 → ×2）
export function getRent(state, tile, level = 0) {
  let rent = baseRent(tile, level)
  if (tile.group && isGroupComplete(state, tile.group)) {
    rent *= 2
  }
  return rent
}

// 商圈是否被某玩家集齐
export function isGroupComplete(state, group) {
  const tiles = groupTiles(group)
  if (tiles.length === 0) return false
  let ownerId = null
  for (const t of tiles) {
    const o = state.players.find((p) => p.alive && p.properties.includes(t.id))
    if (!o) return false
    if (ownerId && o.id !== ownerId) return false
    ownerId = o.id
  }
  return ownerId != null
}

// 组内已拥有数量（用于 UI 显示"3/4"）
export function groupOwned(state, player, group) {
  return groupTiles(group).filter((t) => player.properties.includes(t.id)).length
}

export function upgradeCost(tile) {
  return Math.round(tile.price * UPGRADE_COST_RATIO)
}

// 能否开店升级：地产且可升级（metro 仅李子坝可升级），等级 <3
export function canUpgrade(state, player, tile) {
  if (!isPropertyTile(tile) || !player.properties.includes(tile.id)) return false
  if (tile.type === 'metro' && !tile.upgradable) return false
  const level = player.levels[tile.id] ?? 0
  if (level >= 3) return false
  return player.money >= upgradeCost(tile)
}

// 总资产 = 现金 + 地产估值（价格 + 开店投入）
export function totalAssets(player) {
  let total = player.money
  for (const idx of player.properties) {
    const tile = TILES[idx]
    const level = player.levels[idx] ?? 0
    total += tile.price + Math.round(tile.price * UPGRADE_COST_RATIO * level)
  }
  return total
}
