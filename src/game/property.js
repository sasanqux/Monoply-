// property.js — 地产：买地 / 收租（商圈加成）/ 开店升级 / 卖地 / 资产估值
import { TILES, isPropertyTile, groupTiles, UPGRADE_COST_RATIO, GROUPS } from './board.js'

// 基础租金（按等级 0~3）
export function baseRent(tile, level = 0) {
  return tile.rent * (1 + level)
}

// 组合达成所需地块数（从 GROUPS 读取 threshold）
export function groupRequired(group) {
  return GROUPS[group]?.threshold ?? 5
}

// 某玩家拥有该组合的地块数（抵押地不计入）
export function groupCount(player, group) {
  return groupTiles(group).filter((t) => player.properties.includes(t.id) && !isMortgaged(player, t.id)).length
}

// 实际应收租金：组合加成（地块组合达成 → ×1.5；景区之王/轻轨大亨 类型组合达成 → ×1.5，不叠加）+ 八中租金加成
export function getRent(state, tile, level = 0) {
  let rent = baseRent(tile, level)
  const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
  if (tile.group && ownerGroupComplete(state, tile)) {
    rent *= 1.5
  } else if (owner && typeGroupComplete(tile, owner)) {
    rent *= 1.5
  }
  // 八中主宰租金加成
  if (owner && owner._rentBonus) {
    rent += owner._rentBonus
  }
  return rent
}

// 该格的主人是否达成地块组合（拥有达到阈值）
function ownerGroupComplete(state, tile) {
  const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
  if (!owner) return false
  return groupCount(owner, tile.group) >= groupRequired(tile.group)
}

// 类型组合：景区之王（集齐所有景点 scenic）/ 轻轨大亨（集齐所有轻轨站 station）
export function typeGroupComplete(tile, owner) {
  if (tile.type === 'scenic') {
    return TILES.filter((t) => t && !t.removed && t.type === 'scenic').every((t) => owner.properties.includes(t.id))
  }
  if (tile.type === 'station') {
    return TILES.filter((t) => t && t.type === 'station').every((t) => owner.properties.includes(t.id))
  }
  return false
}

// 类型组合进度（UI 显示）
export function typeGroupInfo(player, type) {
  const tiles = TILES.filter((t) => t && !t.removed && t.type === type)
  const owned = tiles.filter((t) => player.properties.includes(t.id)).length
  return {
    name: type === 'scenic' ? '景区之王' : '轻轨大亨',
    n: owned,
    total: tiles.length,
    need: tiles.length,
    done: tiles.length > 0 && owned === tiles.length,
  }
}

// 组合是否已被某玩家达成（拥有达到阈值）
export function isGroupComplete(state, group) {
  if (groupTiles(group).length === 0) return false
  return state.players.some((p) => p.alive && groupCount(p, group) >= groupRequired(group))
}

// 组内已拥有数量（用于 UI 显示"3/4"）
export function groupOwned(state, player, group) {
  return groupTiles(group).filter((t) => player.properties.includes(t.id)).length
}

export function upgradeCost(tile) {
  return Math.round(tile.price * UPGRADE_COST_RATIO)
}

// 能否开店升级：地产且可升级、等级<3、钱够、未抵押、且本回合踩过该地块
export function canUpgrade(state, player, tile) {
  if (!isPropertyTile(tile) || !player.properties.includes(tile.id)) return false
  if (tile.type === 'station' && !tile.upgradable) return false
  const level = player.levels[tile.id] ?? 0
  if (level >= 3) return false
  if (player.money < upgradeCost(tile)) return false
  if (isMortgaged(player, tile.id)) return false
  // 必须本回合踩在该地块上（upgradableTiles 由 handleLanding 维护）
  if (!player.upgradableTiles || !player.upgradableTiles.includes(tile.id)) return false
  return true
}

// 总资产 = 现金 + 地产估值（价格 + 开店投入，抵押地按50%估值）
export function totalAssets(player) {
  let total = player.money
  for (const idx of player.properties) {
    const tile = TILES[idx]
    const level = player.levels[idx] ?? 0
    const mortgaged = player.mortgaged?.[idx]
    if (mortgaged) {
      total += Math.round(tile.price * 0.5)
    } else {
      total += tile.price + Math.round(tile.price * UPGRADE_COST_RATIO * level)
    }
  }
  return total
}

// 抵押地产：获得50%现金，抵押期间不收租、不能升级、不计组合
export function mortgageTile(state, player, tileId) {
  const tile = TILES[tileId]
  if (!tile || !isPropertyTile(tile)) return { ok: false, msg: '不是地产格' }
  if (!player.properties.includes(tileId)) return { ok: false, msg: '不是你的地产' }
  if (player.mortgaged?.[tileId]) return { ok: false, msg: '已经抵押了' }
  const level = player.levels[tileId] ?? 0
  if (level > 0) return { ok: false, msg: '请先拆到0级再抵押' }
  const amount = Math.round(tile.price * 0.5)
  player.money += amount
  if (!player.mortgaged) player.mortgaged = {}
  player.mortgaged[tileId] = true
  state.log.push(`🏦 ${player.name} 抵押「${tile.name}」获得 ¥${amount}`)
  return { ok: true, amount }
}

// 赎回地产：支付抵押金额×110%
export function unmortgageTile(state, player, tileId) {
  const tile = TILES[tileId]
  if (!tile) return { ok: false, msg: '地产不存在' }
  if (!player.mortgaged?.[tileId]) return { ok: false, msg: '没有抵押' }
  const mortgageAmount = Math.round(tile.price * 0.5)
  const redeemCost = Math.round(mortgageAmount * 1.1)
  if (player.money < redeemCost) return { ok: false, msg: `现金不足（需 ¥${redeemCost}）` }
  player.money -= redeemCost
  delete player.mortgaged[tileId]
  state.log.push(`🔓 ${player.name} 赎回「${tile.name}」（¥${redeemCost}）`)
  return { ok: true, cost: redeemCost }
}

// 能否抵押
export function canMortgage(player, tileId) {
  const tile = TILES[tileId]
  if (!tile || !isPropertyTile(tile)) return false
  if (!player.properties.includes(tileId)) return false
  if (player.mortgaged?.[tileId]) return false
  const level = player.levels[tileId] ?? 0
  if (level > 0) return false
  return true
}

// 能否赎回
export function canUnmortgage(player, tileId) {
  if (!player.mortgaged?.[tileId]) return false
  const tile = TILES[tileId]
  const cost = Math.round(tile.price * 0.5 * 1.1)
  return player.money >= cost
}

// 抵押地不收租：在收租处判断
export function isMortgaged(player, tileId) {
  return !!(player.mortgaged?.[tileId])
}
