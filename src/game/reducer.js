// reducer.js — gameReducer 纯函数总入口（单机本地跑，联机时搬到服务器）
import { TILES, START_MONEY_DEFAULT } from './board.js'
import { rollDice, movePlayer } from './movement.js'
import { addMoney } from './bank.js'
import { upgradeCost } from './property.js'
import { handleLanding, nextTurn, currentPlayer } from './turn.js'

// 玩家棋子颜色（桌游棋子感，瑞士风克制色板）
export const PLAYER_COLORS = [
  '#E30613', // 红
  '#111111', // 黑
  '#185FA5', // 蓝
  '#0F6E56', // 绿
  '#EF9F27', // 橙
  '#534AB7', // 紫
  '#D4537E', // 粉
  '#3d3d3d', // 灰
]

// 创建初始局面
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
    players: players.map((pl, i) => ({
      id: pl.id,
      name: pl.name,
      isAI: !!pl.isAI,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      money: startMoney,
      pos: 0,
      properties: [],
      levels: {},
      jailLeft: 0,
      hospital: false,
      alive: true,
      bankrupt: false,
    })),
    log: [
      `🎮 开局！${players.map((p) => p.name).join('、')}，每人起始资金 ¥${startMoney}`,
      `第 1 回合，轮到 ${players[0].name}`,
    ],
  }
}

// 纯函数 reducer：输入旧局面 + 操作 → 新局面
export function gameReducer(state, action) {
  const s = structuredClone(state)
  if (s.status !== 'playing') return s
  const p = currentPlayer(s)

  switch (action.type) {
    case 'ROLL_DICE': {
      if (s.phase !== 'roll') return s
      // 监狱：跳过掷骰，停一轮
      if (p.jailLeft > 0) {
        p.jailLeft -= 1
        s.log.push(`🚔 ${p.name} 在监狱服刑（还剩 ${p.jailLeft} 轮）`)
        return nextTurn(s)
      }
      // 医院：休养一轮
      if (p.hospital) {
        p.hospital = false
        s.log.push(`🏥 ${p.name} 在医院休养，跳过本回合`)
        return nextTurn(s)
      }
      const dice = rollDice()
      s.dice = dice
      const sum = dice[0] + dice[1]
      movePlayer(s, p, dice)
      const tile = TILES[p.pos]
      s.log.push(`🎲 ${p.name} 掷出 ${dice[0]} + ${dice[1]} = ${sum}，走到「${tile.name}」`)
      s.phase = 'landed'
      handleLanding(s, p)
      return s
    }

    case 'BUY_PROPERTY': {
      if (s.pending?.kind !== 'buy') return s
      const tile = TILES[s.pending.tileId]
      if (p.money < tile.price) {
        s.log.push(`${p.name} 现金不足，无法购买 ${tile.name}`)
        return s
      }
      p.money -= tile.price
      p.properties.push(tile.id)
      p.levels[tile.id] = 0
      s.pending = null
      s.log.push(`🏠 ${p.name} 购入「${tile.name}」（¥${tile.price}，现 ¥${p.money}）`)
      return s
    }

    case 'SKIP_BUY': {
      if (s.pending?.kind === 'buy') {
        const tile = TILES[s.pending.tileId]
        s.log.push(`${p.name} 放弃购买「${tile.name}」`)
        s.pending = null
      }
      return s
    }

    case 'UPGRADE_PROPERTY': {
      const tile = TILES[action.tileId]
      if (!tile || !p.properties.includes(tile.id)) return s
      const level = p.levels[tile.id] ?? 0
      if (level >= 3) return s
      const cost = upgradeCost(tile)
      if (p.money < cost) return s
      p.money -= cost
      p.levels[tile.id] = level + 1
      s.log.push(`🏗 ${p.name} 将「${tile.name}」升级到 ${level + 1} 级（¥${cost}，现 ¥${p.money}）`)
      return s
    }

    case 'END_TURN': {
      if (s.pending?.kind === 'buy') {
        const tile = TILES[s.pending.tileId]
        s.log.push(`${p.name} 放弃购买「${tile.name}」`)
        s.pending = null
      }
      return nextTurn(s)
    }

    default:
      return s
  }
}
