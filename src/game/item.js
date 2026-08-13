// item.js — 5 种道具：数据 + 放置/触发
import { TILES } from './board.js'
import { addMoney } from './bank.js'
import { checkBankrupt } from './gameOver.js'

export const ITEMS = [
  { type: 'barrier', name: '路障', desc: '挡停踩中的玩家', icon: '🚧' },
  { type: 'mine', name: '地雷', desc: '炸伤踩中的玩家', icon: '💣' },
  { type: 'bomb', name: '定时炸弹', desc: '3 回合后爆炸', icon: '🧨' },
  { type: 'remoteDice', name: '遥控骰子', desc: '指定下次掷骰点数', icon: '🎲' },
  { type: 'portal', name: '传送门', desc: '传送到任意格', icon: '🌀' },
]

export const BOMB_FUSE = 3
export const BOMB_DAMAGE = 400
export const MINE_DAMAGE = 300

export function randomItem() {
  return ITEMS[Math.floor(Math.random() * ITEMS.length)]
}

// 道具是否可立即使用（无需放置）
export function isInstantItem(type) {
  return type === 'remoteDice' || type === 'portal'
}

// 放置道具到棋盘（路障/地雷/定时炸弹）
export function placeItem(state, player, itemType, tileId) {
  const tile = TILES[tileId]
  if (!tile) return false
  // 同类型道具每人限放 1 个
  const hasOne = state.boardItems.some((b) => b.ownerId === player.id && b.type === itemType)
  if (hasOne) {
    state.log.push(`${player.name} 已放置过同类道具`)
    return false
  }
  state.boardItems.push({
    id: `${itemType}-${player.id}-${Date.now()}`,
    type: itemType,
    tileId,
    ownerId: player.id,
    fuse: itemType === 'bomb' ? BOMB_FUSE : 0,
  })
  state.log.push(`${player.name} 放置了「${ITEMS.find((i) => i.type === itemType).name}」在 ${tile.name}`)
  return true
}

// 遥控骰子：设置指定点数（2-12）
export function applyRemoteDice(state, player, value) {
  const v = Math.max(2, Math.min(12, Math.floor(value)))
  player.remoteDice = v
  state.log.push(`${player.name} 使用遥控骰子，下次掷 ${v} 点`)
  return true
}

// 传送门：传送到指定格
export function applyPortal(state, player, tileId) {
  const tile = TILES[tileId]
  if (!tile) return false
  player.pos = tileId
  state.log.push(`🌀 ${player.name} 穿过传送门，瞬间来到「${tile.name}」`)
  return true
}

// 回合结束时：炸弹倒计时 + 爆炸判定
export function tickBombs(state) {
  for (const b of [...state.boardItems]) {
    if (b.type !== 'bomb') continue
    b.fuse -= 1
    if (b.fuse <= 0) {
      state.boardItems = state.boardItems.filter((x) => x.id !== b.id)
      const victim = state.players.find((p) => p.alive && p.pos === b.tileId)
      const ownerName = state.players.find((p) => p.id === b.ownerId)?.name ?? '?'
      if (victim) {
        addMoney(state, victim.id, -BOMB_DAMAGE, `被 ${ownerName} 的定时炸弹炸伤`)
        checkBankrupt(state, victim)
      } else {
        state.log.push(`🧨 ${ownerName} 的定时炸弹在「${TILES[b.tileId].name}」爆炸，没有伤到人`)
      }
    }
  }
}
