// card.js — 14 种卡片：数据 + 效果（大宇 4 代 + 过江配合）
import { TILES, isPropertyTile, isBridge, GROUPS, groupTiles } from './board.js'
import { payMoney } from './bank.js'
import { alivePlayers } from './gameOver.js'
import { isGroupComplete } from './property.js'

export const CARDS = [
  { type: 'buy', name: '购地卡', desc: '强买一块无主地产', icon: 'tag' },
  { type: 'swap', name: '换地卡', desc: '与对方交换一块地', icon: 'swap' },
  { type: 'equalize', name: '均富卡', desc: '全场现金平分', icon: 'equalize' },
  { type: 'steal', name: '抢夺卡', desc: '抢对方一张手牌', icon: 'steal' },
  { type: 'demolish', name: '拆除卡', desc: '拆对方一栋楼', icon: 'demolish' },
  { type: 'frame', name: '陷害卡', desc: '送对手进监狱', icon: 'frame' },
  { type: 'shield', name: '免罪卡', desc: '免一次税/过桥费', icon: 'shield' },
  { type: 'reverse', name: '转向卡', desc: '本次移动反向走', icon: 'reverse' },
  { type: 'hold', name: '停留卡', desc: '让对手停一轮', icon: 'hold' },
  { type: 'transfer', name: '嫁祸卡', desc: '把监狱转给别人', icon: 'transfer' },
  { type: 'monster', name: '怪兽卡', desc: '拆平对手的楼', icon: 'monster' },
  { type: 'nuke', name: '核弹卡', desc: '炸平一块地产', icon: 'nuke' },
  { type: 'ferry', name: '轮渡卡', desc: '免费过江一次', icon: 'ferry' },
  { type: 'closeBridge', name: '封桥卡', desc: '封一座桥两回合', icon: 'closed' },
  { type: 'cashGain', name: '天降横财', desc: '白捡 ¥600', icon: 'gold' },
  { type: 'freeUpgrade', name: '免费升级', desc: '随机一块自己的地升 1 级', icon: 'upgrade' },
  { type: 'escape', name: '逃狱卡', desc: '立即出狱', icon: 'escape' },
  { type: 'refurbish', name: '整修卡', desc: '自己最高级地产整修到顶', icon: 'hammer' },
  { type: 'seize', name: '收购令', desc: '花钱强买对手未升级地', icon: 'buy' },
  { type: 'monopoly', name: '垄断红利', desc: '集齐商圈则其地全升 1 级', icon: 'crown' },
  { type: 'audit', name: '查税卡', desc: '对手随机一块地补税', icon: 'audit' },
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
    case 'audit':
      return 'player'
    case 'seize':
      return 'tile'
    default:
      return 'none' // equalize/steal/shield/reverse/ferry/cashGain/freeUpgrade/escape/refurbish/monopoly 无需目标
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
    case 'cashGain': {
      player.money += 600
      state.log.push(`💰 ${player.name} 用天降横财卡，白捡 ¥600！`)
      return true
    }
    case 'freeUpgrade': {
      const mine = player.properties.filter((i) => isPropertyTile(TILES[i]) && (player.levels[i] ?? 0) < 3)
      if (mine.length === 0) return false
      const t = TILES[mine[Math.floor(Math.random() * mine.length)]]
      player.levels[t.id] = (player.levels[t.id] ?? 0) + 1
      state.log.push(`🔧 ${player.name} 用免费升级卡，「${t.name}」升至 ${player.levels[t.id]} 级！`)
      return true
    }
    case 'escape': {
      if (player.jailLeft <= 0) return false
      player.jailLeft = 0
      state.log.push(`🚪 ${player.name} 用逃狱卡，立马出狱！`)
      return true
    }
    case 'refurbish': {
      let best = null
      let bestLv = -1
      for (const i of player.properties) {
        if (!isPropertyTile(TILES[i])) continue
        const lv = player.levels[i] ?? 0
        if (lv > bestLv) { bestLv = lv; best = i }
      }
      if (best == null) return false
      player.levels[best] = 3
      state.log.push(`🏗️ ${player.name} 用整修卡，「${TILES[best].name}」整修到顶（3 级）！`)
      return true
    }
    case 'seize': {
      const tile = TILES[target?.tileId]
      if (!tile || !isPropertyTile(tile)) return false
      const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
      if (!owner || owner.id === player.id) return false
      if ((owner.levels[tile.id] ?? 0) >= 1) return false // 只收未升级地
      const price = Math.floor(tile.price * 1.2)
      if (player.money < price) return false
      player.money -= price
      owner.money += price
      owner.properties = owner.properties.filter((i) => i !== tile.id)
      delete owner.levels[tile.id]
      player.properties.push(tile.id)
      player.levels[tile.id] = 0
      state.log.push(`💼 ${player.name} 用收购令，花 ¥${price} 从 ${owner.name} 强买「${tile.name}」！`)
      return true
    }
    case 'monopoly': {
      let done = false
      for (const g of Object.keys(GROUPS)) {
        if (isGroupComplete(state, g)) {
          for (const t of groupTiles(g)) {
            const idx = player.properties.indexOf(t.id)
            if (idx !== -1 && (player.levels[t.id] ?? 0) < 3) {
              player.levels[t.id] = (player.levels[t.id] ?? 0) + 1
              done = true
            }
          }
        }
      }
      if (!done) return false
      state.log.push(`👑 ${player.name} 用垄断红利卡，旗下商圈地产全面升级！`)
      return true
    }
    case 'audit': {
      const them = state.players.find((p) => p.id === target?.playerId && p.alive)
      if (!them || them.id === player.id) return false
      const theirProps = them.properties.filter((i) => isPropertyTile(TILES[i]))
      if (theirProps.length === 0) return false
      const t = TILES[theirProps[Math.floor(Math.random() * theirProps.length)]]
      const tax = Math.floor(t.price * 0.3)
      if (them.money < tax) return false
      them.money -= tax
      state.log.push(`🧾 ${player.name} 用查税卡，${them.name}「${t.name}」补缴税款 ¥${tax}！`)
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
