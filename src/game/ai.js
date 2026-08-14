// ai.js — AI 决策（一档智能·会用卡/道具/轻轨）
// 决策优先级：买地 → 乘轻轨 → 即时卡 → 攻击卡 → 放道具 → 升级 → 结束
import { TILES, isPropertyTile, isMetro, METRO_FEE } from './board.js'
import { currentPlayer } from './turn.js'
import { canUpgrade, upgradeCost } from './property.js'

const SAFETY_RATIO = 0.2

// ===== 工具：选目标 =====
function ownProps(cur) {
  return cur.properties.filter((i) => isPropertyTile(TILES[i]))
}

// 对手拥有的最高级地产（用于拆楼/怪兽）
function bestEnemyProp(state, cur) {
  let best = null
  let bestScore = -1
  for (const p of state.players) {
    if (!p.alive || p.id === cur.id) continue
    for (const idx of p.properties) {
      const t = TILES[idx]
      if (!isPropertyTile(t)) continue
      const lv = p.levels[idx] ?? 0
      if (lv >= 1 && lv > bestScore) {
        bestScore = lv
        best = { tileId: idx, lv, owner: p }
      }
    }
  }
  return best
}

// 有手牌的对手（用于抢夺）
function enemyWithCard(state, cur) {
  const others = state.players.filter((p) => p.alive && p.id !== cur.id && p.hand.length > 0)
  if (others.length === 0) return null
  return others[Math.floor(Math.random() * others.length)].id
}

// 随机存活对手（用于陷害/停留）
function randomEnemy(state, cur) {
  const others = state.players.filter((p) => p.alive && p.id !== cur.id)
  if (others.length === 0) return null
  return others[Math.floor(Math.random() * others.length)].id
}

// 图结构前驱（沿图回退一格）
function predecessorOf(id) {
  for (const t of TILES) {
    if (!t) continue
    if (t.next === id || (t.forks && t.forks.includes(id))) return t.id
  }
  return id
}

// 自己最高级地产的"前一格"（放路障/地雷/炸弹，坑来踩地的对手）
function myHighPropPrevTile(state, cur) {
  let best = null
  let bestLv = -1
  for (const idx of ownProps(cur)) {
    const lv = cur.levels[idx] ?? 0
    if (lv > bestLv) { bestLv = lv; best = idx }
  }
  if (best == null) return null
  return predecessorOf(best)
}

// 分岔选路：AI 默认走直行（tile.next），让对局稳定可复现
export function aiChooseFork(state, player, tile, options) {
  if (options.includes(tile.next)) return tile.next
  return options[0]
}

export function aiDecide(state, playerId) {
  const cur = currentPlayer(state)
  if (cur.id !== playerId) return null

  if (state.phase === 'roll') {
    return { type: 'ROLL_DICE' }
  }

  if (state.phase === 'landed') {
    // 1. 买地/买桥（留安全垫）
    if (state.pending?.kind === 'buy') {
      const tile = TILES[state.pending.tileId]
      if (cur.money >= tile.price && cur.money - tile.price >= cur.money * SAFETY_RATIO) {
        return { type: 'BUY_PROPERTY' }
      }
      return { type: 'SKIP_BUY' }
    }

    // 2. 乘轻轨（在轻轨站且有钱 → 去另一站）
    if (state.pending?.kind === 'metro') {
      if (cur.money >= METRO_FEE) {
        const stations = TILES.filter((t) => t && isMetro(t) && t.id !== cur.pos)
        if (stations.length > 0) {
          const target = stations[Math.floor(Math.random() * stations.length)]
          return { type: 'TRAVEL_METRO', targetTileId: target.id }
        }
      }
      return { type: 'END_TURN' } // 轻轨站不买则直接结束（pending 会清理）
    }

    // 3. 即时卡（无需目标）
    const instant = cur.hand.find((c) =>
      c.type === 'shield' ? true
        : c.type === 'steal' ? enemyWithCard(state, cur) != null
          : c.type === 'freeUpgrade' ? cur.properties.some((i) => isPropertyTile(TILES[i]) && (cur.levels[i] ?? 0) < 3)
            : c.type === 'escape' ? cur.jailLeft > 0
              : false
    )
    if (instant) return { type: 'USE_CARD', cardId: instant.id }

    // 4. 攻击卡（需要目标）
    const attack = cur.hand.find((c) =>
      c.type === 'demolish' ? bestEnemyProp(state, cur)?.lv >= 1
        : c.type === 'monster' ? bestEnemyProp(state, cur) != null
          : (c.type === 'frame' || c.type === 'hold') ? randomEnemy(state, cur) != null
            : false
    )
    if (attack) {
      if (attack.type === 'demolish' || attack.type === 'monster') {
        const t = bestEnemyProp(state, cur)
        if (t) return { type: 'USE_CARD', cardId: attack.id, target: { tileId: t.tileId } }
      }
      if (attack.type === 'frame' || attack.type === 'hold') {
        const t = randomEnemy(state, cur)
        if (t != null) return { type: 'USE_CARD', cardId: attack.id, target: { playerId: t } }
      }
    }

    // 5. 放道具（路障/地雷/炸弹 → 自己高价值地产前一格）
    const placeable = cur.items.find((it) => it.type === 'barrier' || it.type === 'mine' || it.type === 'bomb')
    if (placeable && !state.boardItems.some((b) => b.ownerId === cur.id && b.type === placeable.type)) {
      const prev = myHighPropPrevTile(state, cur)
      if (prev != null) {
        return { type: 'USE_ITEM', itemId: placeable.id, tileId: prev }
      }
    }

    // 6. 升级（先盖低级楼）
    const ownPropsList = [...ownProps(cur)].sort((a, b) => (cur.levels[a] ?? 0) - (cur.levels[b] ?? 0))
    for (const idx of ownPropsList) {
      const tile = TILES[idx]
      if (canUpgrade(state, cur, tile)) {
        const cost = upgradeCost(tile)
        if (cur.money - cost >= cur.money * SAFETY_RATIO) {
          return { type: 'UPGRADE_PROPERTY', tileId: idx }
        }
      }
    }

    return { type: 'END_TURN' }
  }

  return null
}
