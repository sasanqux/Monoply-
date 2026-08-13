// ai.js — AI 决策（一档智能）：有钱买地、有钱盖楼、欠债自动卖地由 reducer 处理
import { TILES } from './board.js'
import { currentPlayer } from './turn.js'
import { canUpgrade } from './property.js'

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
      // 现金足够全额才买，否则放弃（避免购买被拒后陷入循环）
      if (cur.money >= tile.price) return { type: 'BUY_PROPERTY' }
      return { type: 'SKIP_BUY' }
    }
    // 盖楼：优先升级等级最低的楼（成本低、见效快）
    for (const idx of cur.properties) {
      const tile = TILES[idx]
      if (canUpgrade(state, cur, tile)) {
        return { type: 'UPGRADE_PROPERTY', tileId: idx }
      }
    }
    return { type: 'END_TURN' }
  }

  return null
}
