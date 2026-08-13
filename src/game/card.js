// card.js — 14 种卡片：数据 + 效果（大宇 4 代 + 过江配合）
import { TILES, isPropertyTile, isBridge } from './board.js'
import { payMoney } from './bank.js'
import { alivePlayers } from './gameOver.js'

export const CARDS = [
  { type: 'buy', name: '购地卡', desc: '强买一块无主地产', icon: '🏷️' },
  { type: 'swap', name: '换地卡', desc: '与对方交换一块地', icon: '🔁' },
  { type: 'equalize', name: '均富卡', desc: '全场现金平分', icon: '⚖️' },
  { type: 'steal', name: '抢夺卡', desc: '抢对方一张手牌', icon: '👊' },
  { type: 'demolish', name: '拆除卡', desc: '拆对方一栋楼', icon: '🔨' },
  { type: 'frame', name: '陷害卡', desc: '送对手进监狱', icon: '⛓️' },
  { type: 'shield', name: '免罪卡', desc: '免一次税/过桥费', icon: '🛡️' },
  { type: 'reverse', name: '转向卡', desc: '本次移动反向走', icon: '↩️' },
  { type: 'hold', name: '停留卡', desc: '让对手停一轮', icon: '✋' },
  { type: 'transfer', name: '嫁祸卡', desc: '把监狱转给别人', icon: '🎭' },
  { type: 'monster', name: '怪兽卡', desc: '拆平对手的楼', icon: '👾' },
  { type: 'nuke', name: '核弹卡', desc: '炸平一块地产', icon: '☢️' },
  { type: 'ferry', name: '轮渡卡', desc: '免费过江一次', icon: '⛵' },
  { type: 'closeBridge', name: '封桥卡', desc: '封一座桥两回合', icon: '🚧' },
]

export function randomCard() {
  return CARDS[Math.floor(Math.random() * CARDS.length)]
}

// 该卡是否需要目标选择及选择类型
export function cardTargetKind(cardType) {
  switch (cardType) {
    case 'buy':
    case 'demolish':
    case 'monster':
    case 'nuke':
    case 'closeBridge':
      return 'tile'
    case 'swap':
      return 'swap'
    case 'frame':
    case 'hold':
    case 'transfer':
      return 'player'
    default:
      return 'none' // equalize/steal/shield/reverse/ferry 无需目标
  }
}

// 执行卡牌效果；target 依卡型而异。返回 false 表示使用无效（卡保留）
export function applyCard(state, player, card, target) {
  switch (card.type) {
    case 'buy': {
      const tile = TILES[target?.tileId]
      if (!tile || !isPropertyTile(tile)) return false
      const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
      if (owner || player.money < tile.price) return false
      player.money -= tile.price
      player.properties.push(tile.id)
      player.levels[tile.id] = 0
      state.log.push(`🏷️ ${player.name} 用购地卡强买「${tile.name}」（¥${tile.price}）`)
      return true
    }
    case 'swap': {
      const myIdx = player.properties.indexOf(target?.myTile)
      const theirTile = TILES[target?.theirTile]
      if (myIdx === -1 || !theirTile || !isPropertyTile(theirTile)) return false
      const them = state.players.find((p) => p.alive && p.properties.includes(theirTile.id))
      if (!them || them.id === player.id) return false
      const theirIdx = them.properties.indexOf(theirTile.id)
      const myTile = TILES[player.properties[myIdx]]
      // 交换（含等级）
      const myLevel = player.levels[myTile.id] ?? 0
      const theirLevel = them.levels[theirTile.id] ?? 0
      player.properties[myIdx] = theirTile.id
      them.properties[theirIdx] = myTile.id
      if (myLevel) {
        player.levels[theirTile.id] = myLevel
        delete player.levels[myTile.id]
      } else delete player.levels[theirTile.id]
      if (theirLevel) {
        them.levels[myTile.id] = theirLevel
        delete them.levels[theirTile.id]
      } else delete them.levels[myTile.id]
      state.log.push(`🔁 ${player.name} 用换地卡与 ${them.name} 交换了「${myTile.name}」和「${theirTile.name}」`)
      return true
    }
    case 'equalize': {
      const alive = alivePlayers(state)
      const total = alive.reduce((sum, p) => sum + p.money, 0)
      const each = Math.floor(total / alive.length)
      for (const p of alive) p.money = each
      state.log.push(`⚖️ ${player.name} 用均富卡！全员资金平分（每人 ¥${each}）`)
      return true
    }
    case 'steal': {
      const others = alivePlayers(state).filter((p) => p.id !== player.id && p.hand.length > 0)
      if (others.length === 0) return false
      const them = others[Math.floor(Math.random() * others.length)]
      const card = them.hand.splice(Math.floor(Math.random() * them.hand.length), 1)[0]
      player.hand.push(card)
      state.log.push(`👊 ${player.name} 用抢夺卡抢走了 ${them.name} 的「${card.name}」`)
      return true
    }
    case 'demolish': {
      const tile = TILES[target?.tileId]
      if (!tile) return false
      const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
      if (!owner || owner.id === player.id) return false
      const level = owner.levels[tile.id] ?? 0
      if (level < 1) return false
      owner.levels[tile.id] = level - 1
      state.log.push(`🔨 ${player.name} 用拆除卡拆了 ${owner.name}「${tile.name}」一级（现 ${level - 1} 级）`)
      return true
    }
    case 'frame': {
      const them = state.players.find((p) => p.id === target?.playerId && p.alive)
      if (!them || them.id === player.id) return false
      them.jailLeft = 2
      state.log.push(`⛓️ ${player.name} 用陷害卡把 ${them.name} 送进监狱！`)
      return true
    }
    case 'shield':
      player.shield = true
      state.log.push(`🛡️ ${player.name} 使用免罪卡，获得一次豁免（税/过桥费）`)
      return true
    case 'reverse':
      player.direction = -1
      state.log.push(`↩️ ${player.name} 使用转向卡，本次移动反向！`)
      return true
    case 'hold': {
      const them = state.players.find((p) => p.id === target?.playerId && p.alive)
      if (!them || them.id === player.id) return false
      them.skipTurns += 1
      state.log.push(`✋ ${player.name} 用停留卡让 ${them.name} 停一轮！`)
      return true
    }
    case 'transfer': {
      if (player.jailLeft <= 0) return false
      const them = state.players.find((p) => p.id === target?.playerId && p.alive && p.id !== player.id)
      if (!them) return false
      player.jailLeft = 0
      them.jailLeft = 2
      state.log.push(`🎭 ${player.name} 用嫁祸卡把监狱甩给了 ${them.name}！`)
      return true
    }
    case 'monster': {
      const tile = TILES[target?.tileId]
      if (!tile) return false
      const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
      if (!owner || owner.id === player.id) return false
      owner.levels[tile.id] = 0
      state.log.push(`👾 ${player.name} 召唤怪兽，踏平了 ${owner.name}「${tile.name}」的楼！`)
      return true
    }
    case 'nuke': {
      const tile = TILES[target?.tileId]
      if (!tile || !isPropertyTile(tile)) return false
      const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
      if (!owner) return false
      owner.properties = owner.properties.filter((i) => i !== tile.id)
      delete owner.levels[tile.id]
      state.log.push(`☢️ ${player.name} 发射核弹，炸平了「${tile.name}」（${owner.name} 的资产）！`)
      return true
    }
    case 'ferry':
      player.ferry = true
      state.log.push(`⛵ ${player.name} 使用轮渡卡，本次过江畅通无阻！`)
      return true
    case 'closeBridge': {
      const tile = TILES[target?.tileId]
      if (!tile || !isBridge(tile)) return false
      state.closedBridges[tile.id] = 2
      state.log.push(`🚧 ${player.name} 用封桥卡封闭了「${tile.name}」，两回合内不能过桥！`)
      return true
    }
    default:
      return false
  }
}

// 桥格过路费豁免检查：免罪护盾（在 payMoney 前调用）
export function tryShield(state, player) {
  if (player.shield) {
    player.shield = false
    state.log.push(`🛡️ ${player.name} 的免罪卡生效，豁免本次扣款！`)
    return true
  }
  return false
}
