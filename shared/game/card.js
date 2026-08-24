// card.js — 13 种卡片：数据 + 效果（大宇 4 代 + 过江配合 + 送神/股票）
import { TILES, isPropertyTile } from './board.js'
import { alivePlayers } from './gameOver.js'
import { sendGod, handleGodTile, applyPovertyPenalty } from './god.js'
import { applyBlackStock, applyRedStock } from './stock.js'

export const CARDS = [
  { type: 'buy', name: '购地卡', desc: '强买一块无主地产', icon: 'tag', howto: '点一张无人拥有的地产格，直接按标价买下', price: 50 },
  { type: 'swap', name: '换地卡', desc: '与对方交换一块地', icon: 'swap', howto: '先点自己的一块地，再点对方的一块地，两者互换', price: 100 },
  { type: 'steal', name: '抢夺卡', desc: '抢对方一张手牌', icon: 'steal', howto: '点一下直接用：随机抢走对方手牌里的一张卡片', price: 40 },
  { type: 'demolish', name: '拆除卡', desc: '拆对方一栋楼', icon: 'demolish', howto: '点对方一块有楼的地，拆掉一层', price: 50 },
  { type: 'barrier', name: '路障卡', desc: '在任意地块放路障，玩家踩中扣50积分并截停', icon: 'barrier', howto: '点一块地产格放置路障', price: 50 },
  { type: 'shield', name: '免租卡', desc: '免一次租金/轻轨使用费', icon: 'shield', howto: '被动触发：落到对手地产付租金时弹出询问，可选择豁免本次租金或轻轨使用费', price: 30 },
  { type: 'hold', name: '停留卡', desc: '让对手停一轮', icon: 'hold', howto: '选一个对手，让他跳过下一回合', price: 40 },
  { type: 'monster', name: '怪兽卡', desc: '拆平对手的楼', icon: 'monster', howto: '点对方一块地，拆平上面所有楼（归零）', price: 200 },
  { type: 'freeUpgrade', name: '免费升级', desc: '随机一块自己的地升 1 级', icon: 'upgrade', howto: '点一下直接用：随机一块自己的地产免费升 1 级', price: 80 },
  { type: 'sendGod', name: '送神卡', desc: '让附身的神离开', icon: 'sendGod', howto: '点一下直接用：让自己被附身的神仙离开', price: 50 },
  { type: 'blackStock', name: '黑市卡', desc: '选一只股票：下回合涨停', icon: 'stock', howto: '用卡时选一只股票：该股票下回合涨停 20%', price: 80 },
  { type: 'redStock', name: '红市卡', desc: '选一只股票：下回合大涨', icon: 'stock', howto: '用卡时选一只股票：该股票下回合涨 20%-40%', price: 80 },
  { type: 'summonGod', name: '请神卡', desc: '随机被一名神仙附身', icon: 'summonGod', howto: '点一下直接用：随机召唤一只神仙附身（含崔斯特即时效果）', price: 80 },
  { type: 'moto', name: '摩托卡', desc: '获得摩托（2骰子），覆盖当前载具', icon: 'moto', howto: '点一下直接用：载具变为摩托（掷2颗骰子）', price: 50 },
  { type: 'car', name: '汽车卡', desc: '获得汽车（3骰子），覆盖当前载具', icon: 'car', howto: '点一下直接用：载具变为汽车（掷3颗骰子）', price: 80 },
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
    case 'barrier':
      return 'tile'
    case 'swap':
      return 'swap'
    case 'hold':
    case 'steal':
      return 'player'
    case 'blackStock':
    case 'redStock':
      return 'stock'
    default:
      return 'none' // steal/shield/freeUpgrade/sendGod/summonGod/moto/car 无需目标
  }
}

// 执行卡牌效果；target 依卡型而异。返回 false 表示使用无效（卡保留）
export function applyCard(state, player, card, target) {
  switch (card.type) {
    case 'buy': {
      const tile = TILES[target?.tileId]
      if (!tile || !isPropertyTile(tile) || tile.removed) return false
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
      const myLevel = player.levels[myTile.id] ?? 0
      const theirLevel = them.levels[theirTile.id] ?? 0
      player.properties[myIdx] = theirTile.id
      them.properties[theirIdx] = myTile.id
      // 等级跟地走：换来的地保留它原来的等级（不跟人搬家，否则 3 级楼换 0 级空地会凭空升/降级）
      player.levels[theirTile.id] = theirLevel
      them.levels[myTile.id] = myLevel
      // 抵押标记跟地走到新主人（抵押中的地换手后仍处于抵押状态，不能凭空"洗白"）
      player.mortgaged = player.mortgaged || {}
      them.mortgaged = them.mortgaged || {}
      const myMort = !!player.mortgaged[myTile.id]
      const theirMort = !!them.mortgaged[theirTile.id]
      if (myMort) { delete player.mortgaged[myTile.id]; them.mortgaged[myTile.id] = true }
      if (theirMort) { delete them.mortgaged[theirTile.id]; player.mortgaged[theirTile.id] = true }
      state.log.push(`🔁 ${player.name} 用换地卡与 ${them.name} 交换了「${myTile.name}」和「${theirTile.name}」`)
      return true
    }
    case 'steal': {
      const them = state.players.find((p) => p.id === target?.playerId && p.alive && p.hand.length > 0)
      if (!them || them.id === player.id) return false
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
    case 'shield':
      // 免租卡改为被动触发（付租金时询问），不再主动使用
      state.log.push(`🛡️ 免租卡请在支付租金时使用（被动触发）`)
      return false
    case 'hold': {
      const them = state.players.find((p) => p.id === target?.playerId && p.alive)
      if (!them || them.id === player.id) return false
      them.skipTurns += 1
      state.log.push(`✋ ${player.name} 用停留卡让 ${them.name} 停一轮！`)
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
    case 'freeUpgrade': {
      const mine = player.properties.filter((i) => isPropertyTile(TILES[i]) && (player.levels[i] ?? 0) < 3)
      if (mine.length === 0) return false
      const t = TILES[mine[Math.floor(Math.random() * mine.length)]]
      player.levels[t.id] = (player.levels[t.id] ?? 0) + 1
      state.log.push(`🔧 ${player.name} 用免费升级卡，「${t.name}」升至 ${player.levels[t.id]} 级！`)
      return true
    }
    case 'sendGod': {
      // 送神卡：移除附身的神仙
      return sendGod(state, player)
    }
    case 'escape': {
      // 逃狱卡：立即出狱
      if (player.jailLeft <= 0) {
        state.log.push(`🔓 ${player.name} 又不在监狱，逃狱卡白费了`)
        return false
      }
      player.jailLeft = 0
      state.log.push(`🔓 ${player.name} 用逃狱卡成功越狱！`)
      return true
    }
    case 'blackStock': {
      // 黑市卡：指定股票下回合涨停 +20%（byPlayerId 用于服务器脱敏：只有用卡人能看到标记）
      if (!target?.code) {
        state.log.push('黑市卡需要指定股票代码')
        return false
      }
      return applyBlackStock(state, target.code, player.id)
    }
    case 'redStock': {
      // 红市卡：指定股票下回合涨 10%~30%（同上脱敏）
      if (!target?.code) {
        state.log.push('红市卡需要指定股票代码')
        return false
      }
      return applyRedStock(state, target.code, player.id)
    }
    case 'summonGod': {
      // 请神卡：随机附身一只神仙
      const godId = handleGodTile(state, player)
      // 与踩神仙格路径一致：抽中穷神立即扣现金 20%
      if (player.god === 'godOfPoverty') applyPovertyPenalty(state, player)
      return godId
    }
    case 'barrier': {
      // 路障卡：在指定地产格放置路障，踩中者扣50积分并截停（存 state.barriers，随对局隔离）
      const tile = TILES[target?.tileId]
      if (!tile || !isPropertyTile(tile)) return false
      if (!state.barriers) state.barriers = {}
      if (state.barriers[tile.id]) return false // 已有路障
      state.barriers[tile.id] = { owner: player.id, turnsLeft: 3 } // 3回合后自动消失
      state.log.push(`🚧 ${player.name} 在「${tile.name}」放置了路障！`)
      return true
    }
    case 'moto': {
      // 摩托卡：获得摩托（2骰子），持续10回合
      player.vehicle = 'moto'
      player.vehicleTurnsLeft = 10
      state.log.push(`🏍 ${player.name} 骑上摩托！（2颗骰子，持续10回合）`)
      return true
    }
    case 'car': {
      // 汽车卡：获得汽车（3骰子），持续10回合
      player.vehicle = 'car'
      player.vehicleTurnsLeft = 10
      state.log.push(`🚗 ${player.name} 开上汽车！（3颗骰子，持续10回合）`)
      return true
    }
    default:
      return false
  }
}

// 免租卡检查：玩家手中有免租卡时触发
// 返回 'used'(AI自动使用) / 'ask'(人类弹询问) / 'none'(无卡)
export function checkShieldCard(state, player) {
  const idx = player.hand.findIndex((c) => c.type === 'shield')
  if (idx === -1) return 'none'
  if (player.isAI) {
    // AI 自动使用
    player.hand.splice(idx, 1)
    state.log.push(`🛡️ ${player.name} 使用免租卡，豁免本次扣款！`)
    return 'used'
  }
  return 'ask'
}
