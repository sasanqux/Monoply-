// reducer.js — gameReducer 纯函数总入口（单机本地跑，联机时搬到服务器）
import { TILES, START_MONEY_DEFAULT, isPropertyTile, isBridge } from './board.js'
import { rollForPlayer, movePlayer } from './movement.js'
import { addMoney } from './bank.js'
import { upgradeCost } from './property.js'
import { applyCard, cardTargetKind, CARDS } from './card.js'
import { placeItem, applyRemoteDice, applyPortal, isInstantItem, ITEMS } from './item.js'
import { handleLanding, nextTurn, currentPlayer } from './turn.js'

export const PLAYER_COLORS = [
  '#ef4444', // 红
  '#1a1a1a', // 黑
  '#3b82f6', // 蓝
  '#22c55e', // 绿
  '#f97316', // 橙
  '#a855f7', // 紫
  '#ec4899', // 粉
  '#64748b', // 灰
]

const MAX_LOG = 200

export function createInitialState({ players, maxTurns = 40, startMoney = START_MONEY_DEFAULT }) {
  return {
    status: 'playing',
    settings: { maxTurns, startMoney },
    round: 1,
    turnIndex: 0,
    phase: 'roll',
    dice: null,
    pending: null,
    winnerId: null,
    closedBridges: {},
    boardItems: [],
    players: players.map((pl, i) => ({
      id: pl.id,
      name: pl.name,
      isAI: !!pl.isAI,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      money: startMoney,
      pos: 0,
      properties: [],
      levels: {},
      hand: [],
      items: [],
      vehicle: 'walk',
      shield: false,
      skipTurns: 0,
      ferry: false,
      direction: 1,
      remoteDice: null,
      jailLeft: 0,
      hospital: false,
      alive: true,
      bankrupt: false,
    })),
    log: [
      `🎮 重庆大富翁！${players.map((p) => p.name).join('、')}，每人起始资金 ¥${startMoney}`,
      `🌉 过江要走桥，桥可以买！`,
      `第 1 回合，轮到 ${players[0].name}`,
    ],
  }
}

export function gameReducer(state, action) {
  const s = structuredClone(state)
  if (s.status !== 'playing') return s
  const p = currentPlayer(s)
  let result = s

  switch (action.type) {
    case 'ROLL_DICE': {
      if (s.phase !== 'roll') break
      // 监狱/停留/医院：跳过
      if (p.jailLeft > 0) {
        p.jailLeft -= 1
        s.log.push(`🚔 ${p.name} 在拘留所服刑（还剩 ${p.jailLeft} 轮）`)
        result = nextTurn(s)
        break
      }
      if (p.skipTurns > 0) {
        p.skipTurns -= 1
        s.log.push(`✋ ${p.name} 被停留卡定住，跳过本回合`)
        result = nextTurn(s)
        break
      }
      if (p.hospital) {
        p.hospital = false
        s.log.push(`🏥 ${p.name} 在医院休养，跳过本回合`)
        result = nextTurn(s)
        break
      }
      const dice = rollForPlayer(p)
      s.dice = dice
      const sum = dice.reduce((a, b) => a + b, 0)
      const from = p.pos
      const moved = movePlayer(s, p, dice)
      s.log.push(`🎲 ${p.name} 掷出 ${dice.join(' + ')} = ${sum}，从「${TILES[from].name}」走到「${TILES[moved.pos].name}」`)
      s.phase = 'landed'
      handleLanding(s, p)
      break
    }

    case 'BUY_PROPERTY': {
      if (s.pending?.kind !== 'buy') break
      const tile = TILES[s.pending.tileId]
      if (p.money < tile.price) {
        s.log.push(`${p.name} 现金不足，无法购买「${tile.name}」`)
        break
      }
      p.money -= tile.price
      p.properties.push(tile.id)
      if (isPropertyTile(tile)) p.levels[tile.id] = 0
      s.pending = null
      s.log.push(`${isBridge(tile) ? '🌉' : '🏠'} ${p.name} 购入「${tile.name}」（¥${tile.price}，现 ¥${p.money}）`)
      break
    }

    case 'SKIP_BUY': {
      if (s.pending?.kind === 'buy') {
        const tile = TILES[s.pending.tileId]
        s.log.push(`${p.name} 放弃购买「${tile.name}」`)
        s.pending = null
      }
      break
    }

    case 'UPGRADE_PROPERTY': {
      const tile = TILES[action.tileId]
      if (!tile || !isPropertyTile(tile) || !p.properties.includes(tile.id)) break
      const level = p.levels[tile.id] ?? 0
      if (level >= 3) break
      const cost = upgradeCost(tile)
      if (p.money < cost) break
      p.money -= cost
      p.levels[tile.id] = level + 1
      s.log.push(`🏗 ${p.name} 将「${tile.name}」升级到 ${level + 1} 级（¥${cost}，现 ¥${p.money}）`)
      break
    }

    case 'USE_CARD': {
      const idx = p.hand.findIndex((c) => c.id === action.cardId)
      if (idx === -1) break
      const card = p.hand[idx]
      const kind = cardTargetKind(card.type)
      if (kind !== 'none' && !action.target) break
      if (applyCard(s, p, card, action.target)) {
        p.hand.splice(idx, 1)
      }
      break
    }

    case 'USE_ITEM': {
      const idx = p.items.findIndex((it) => it.id === action.itemId)
      if (idx === -1) break
      const item = p.items[idx]
      if (item.type === 'remoteDice') {
        if (action.value == null) break
        applyRemoteDice(s, p, action.value)
        p.items.splice(idx, 1)
      } else if (item.type === 'portal') {
        if (action.tileId == null) break
        applyPortal(s, p, action.tileId)
        p.items.splice(idx, 1)
      } else {
        // 放置型（路障/地雷/炸弹）
        if (action.tileId == null) break
        if (placeItem(s, p, item.type, action.tileId)) {
          p.items.splice(idx, 1)
        }
      }
      break
    }

    case 'END_TURN': {
      if (s.phase !== 'landed') break
      if (s.pending?.kind === 'buy') {
        const tile = TILES[s.pending.tileId]
        s.log.push(`${p.name} 放弃购买「${tile.name}」`)
        s.pending = null
      }
      result = nextTurn(s)
      break
    }

    default:
      break
  }

  if (result.log.length > MAX_LOG) {
    result.log.splice(0, result.log.length - MAX_LOG)
  }
  return result
}

export { CARDS, ITEMS, isInstantItem }
