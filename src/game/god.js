// god.js — 神仙系统：附身/效果/持续时间/送神
// 6种神仙：财神/衰神/崔斯特/土地公/天使/恶魔/穷神
import { TILES, isPropertyTile } from './board.js'
import { randomCard } from './card.js'

// 神仙定义
export const GODS = {
  godOfWealth: {
    id: 'godOfWealth', name: '财神', icon: '💰',
    desc: '收租/租金收入 ×2', duration: 3, kind: 'buff',
  },
  godOfMisfortune: {
    id: 'godOfMisfortune', name: '衰神', icon: '👿',
    desc: '收租/租金收入 ×0.5', duration: 3, kind: 'debuff',
  },
  trickster: {
    id: 'trickster', name: '崔斯特', icon: '🎲',
    desc: '随机获得4张卡牌', duration: 0, kind: 'instant',
  },
  tuDiGong: {
    id: 'tuDiGong', name: '土地公', icon: '🏴',
    desc: '走到地块直接据为己有（有房变0级）', duration: 2, kind: 'buff',
  },
  angel: {
    id: 'angel', name: '天使', icon: '😇',
    desc: '走到地产加盖1间房（无论谁的）', duration: 3, kind: 'buff',
  },
  devil: {
    id: 'devil', name: '恶魔', icon: '😈',
    desc: '走到地产摧毁所有房子（无论谁的）', duration: 3, kind: 'debuff',
  },
  godOfPoverty: {
    id: 'godOfPoverty', name: '穷神', icon: '💸',
    desc: '现金扣20%，过路费×2', duration: 3, kind: 'debuff',
  },
}

// 全部神仙 id 列表
export const GOD_IDS = Object.keys(GODS)

// 随机抽取一只神仙
export function randomGod() {
  return GOD_IDS[Math.floor(Math.random() * GOD_IDS.length)]
}

// 处理神仙格落地
// 返回 { applied: bool, log: string }
export function handleGodTile(state, player) {
  const godId = randomGod()
  const god = GODS[godId]
  if (player.god) {
    const old = GODS[player.god]
    state.log.push(`🔄 ${player.name} 身上的「${old.icon}${old.name}」被「${god.icon}${god.name}」挤走了！`)
  } else {
    state.log.push(`✨ ${player.name} 撞见了「${god.icon}${god.name}」！`)
  }

  if (god.kind === 'instant') {
    // 崔斯特：即时生效，不附身
    applyInstantGod(state, player, godId)
  } else {
    // 其他神仙：附身
    player.god = godId
    player.godTurnsLeft = god.duration
    state.log.push(`${god.icon} ${god.name}附身了 ${player.name}（持续 ${god.duration} 回合）：${god.desc}`)
  }
  return true
}

// 即时生效型神仙（崔斯特）
function applyInstantGod(state, player, godId) {
  if (godId === 'trickster') {
    state.log.push(`🎲 崔斯特抛给你一把卡牌！`)
    let count = 0
    for (let i = 0; i < 4; i++) {
      if ((player.hand?.length ?? 0) >= 10) {
        // 手牌满了给 50 积分/张
        player.points = (player.points ?? 0) + 50
        state.log.push(`  📜 手牌满了，换成 50 积分`)
      } else {
        const card = randomCard()
        player.hand = player.hand || []
        player.hand.push({ ...card, id: `god-${player.id}-${++state._cardSeq}` })
        count++
      }
    }
    state.log.push(`🎲 ${player.name} 从崔斯特手中获得 ${count} 张卡牌${count < 4 ? ` + ${(4 - count) * 50} 积分` : ''}！`)
  }
}

// 每回合结束时调用：神仙倒计时减1，到期送神
export function tickGod(state, player) {
  if (!player.god) return
  player.godTurnsLeft -= 1
  if (player.godTurnsLeft <= 0) {
    const god = GODS[player.god]
    state.log.push(`👋 ${god.icon}${god.name} 离开了 ${player.name}（时间到）`)
    player.god = null
    player.godTurnsLeft = 0
  }
}

// 送神卡：主动送神
export function sendGod(state, player) {
  if (!player.god) return false
  const god = GODS[player.god]
  state.log.push(`🙏 ${player.name} 用送神卡送走了「${god.icon}${god.name}」！`)
  player.god = null
  player.godTurnsLeft = 0
  return true
}

// 落地结算时，处理神仙效果
// 在 handleLanding 的地产结算逻辑中调用
export function applyGodOnLand(state, player, tile, phase) {
  // phase: 'beforePay' | 'afterPay' | 'onArrive'
  if (!player.god) return null
  const godId = player.god

  switch (godId) {
    case 'tuDiGong':
      // 土地公：走到地产格时据为己有
      if (phase === 'onArrive' && isPropertyTile(tile)) {
        return applyTuDiGong(state, player, tile)
      }
      break
    case 'angel':
      // 天使：走到地产格时加盖1间房
      if (phase === 'onArrive' && isPropertyTile(tile)) {
        return applyAngel(state, player, tile)
      }
      break
    case 'devil':
      // 恶魔：走到地产格时摧毁所有房子
      if (phase === 'onArrive' && isPropertyTile(tile)) {
        return applyDevil(state, player, tile)
      }
      break
    case 'godOfPoverty':
      // 穷神：现金扣20%（仅在首次附身时已在 handleGodTile 中处理？不——穷神是持续效果，扣20%只扣一次）
      // 穷神的"扣20%"是即时生效，在附身后立即执行
      break
  }
  return null
}

// 财神：租金收入 ×2（收租时调用）
export function godRentMultiplier(player) {
  if (player.god === 'godOfWealth') return 2
  if (player.god === 'godOfMisfortune') return 0.5
  return 1
}

// 穷神：过路费 ×2
export function godFeeMultiplier(player) {
  if (player.god === 'godOfPoverty') return 2
  return 1
}

// 穷神：现金扣20%（附身后立即执行一次）
export function applyPovertyPenalty(state, player) {
  const penalty = Math.floor((player.money || 0) * 0.2)
  if (penalty > 0) {
    player.money -= penalty
    state.log.push(`💸 穷神搜刮了 ${player.name} 的钱包：-¥${penalty}（现 ¥${player.money}）`)
  }
}

// 土地公效果
function applyTuDiGong(state, player, tile) {
  const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
  if (!owner) {
    // 无主地：直接获得
    player.properties = player.properties || []
    player.properties.push(tile.id)
    player.levels = player.levels || {}
    player.levels[tile.id] = 0
    state.log.push(`🏴 土地公显灵！${player.name} 无偿占据「${tile.name}」！`)
  } else if (owner.id !== player.id) {
    // 有主地：抢夺（有房变0级）
    owner.properties = owner.properties.filter((i) => i !== tile.id)
    delete owner.levels[tile.id]
    player.properties = player.properties || []
    player.properties.push(tile.id)
    player.levels = player.levels || {}
    player.levels[tile.id] = 0
    state.log.push(`🏴 土地公显灵！${player.name} 从 ${owner.name} 手中夺走「${tile.name}」（楼房清零）！`)
  }
  // 自己的地：什么都不做
}

// 天使效果
function applyAngel(state, player, tile) {
  const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
  if (!owner) return // 无主地不加盖
  const currentLevel = owner.levels[tile.id] ?? 0
  if (currentLevel >= 3) {
    state.log.push(`😇 天使飞来，「${tile.name}」已满级无法再加！`)
    return
  }
  owner.levels[tile.id] = currentLevel + 1
  state.log.push(`😇 天使显灵！「${tile.name}」加盖到 ${currentLevel + 1} 级！`)
}

// 恶魔效果
function applyDevil(state, player, tile) {
  const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
  if (!owner) return // 无主地不拆
  const currentLevel = owner.levels[tile.id] ?? 0
  if (currentLevel === 0) return // 无房可拆
  owner.levels[tile.id] = 0
  state.log.push(`😈 恶魔降临！「${tile.name}」的楼房被夷为平地！`)
}
