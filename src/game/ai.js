// ai.js — AI 决策（一档智能）：买地/买桥留安全垫、先盖低级楼
import { TILES, isPropertyTile } from './board.js'
import { currentPlayer } from './turn.js'
import { canUpgrade, upgradeCost } from './property.js'

const SAFETY_RATIO = 0.2

export function aiDecide(state, playerId) {
  const cur = currentPlayer(state)
  if (cur.id !== playerId) return null

  if (state.phase === 'roll') {
    return { type: 'ROLL_DICE' }
  }

  if (state.phase === 'landed') {
    if (state.pending?.kind === 'buy') {
      const tile = TILES[state.pending.tileId]
      if (cur.money >= tile.price && cur.money - tile.price >= cur.money * SAFETY_RATIO) {
        return { type: 'BUY_PROPERTY' }
      }
      return { type: 'SKIP_BUY' }
    }
    const ownProps = [...cur.properties]
      .filter((i) => isPropertyTile(TILES[i]))
      .sort((a, b) => (cur.levels[a] ?? 0) - (cur.levels[b] ?? 0))
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
