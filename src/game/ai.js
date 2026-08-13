// ai.js — AI 决策（一档智能）：买地留 20% 安全垫、盖楼先低后高也留安全垫
import { TILES } from './board.js'
import { currentPlayer } from './turn.js'
import { canUpgrade, upgradeCost } from './property.js'

// 安全垫比例：保留至少 20% 现金，避免刚买/刚盖就破产的蠢操作
const SAFETY_RATIO = 0.2

// 返回 AI 想执行的动作；轮不到它则返回 null
export function aiDecide(state, playerId) {
  const cur = currentPlayer(state)
  if (cur.id !== playerId) return null

  if (state.phase === 'roll') {
    // 监狱/医院中的跳过由 reducer 的 ROLL_DICE 分支处理
    return { type: 'ROLL_DICE' }
  }

  if (state.phase === 'landed') {
    if (state.pending?.kind === 'buy') {
      const tile = TILES[state.pending.tileId]
      // 买完仍保留 20% 现金才买，否则放弃（避免购买被拒后陷入循环）
      if (cur.money >= tile.price && cur.money - tile.price >= cur.money * SAFETY_RATIO) {
        return { type: 'BUY_PROPERTY' }
      }
      return { type: 'SKIP_BUY' }
    }
    // 盖楼：按等级从低到高（成本低、回本快），且升级后仍保留 20% 现金
    const ownProps = [...cur.properties].sort(
      (a, b) => (cur.levels[a] ?? 0) - (cur.levels[b] ?? 0)
    )
    for (const idx of ownProps) {
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
