// turn.js — 落地结算 + 回合推进（回合状态机核心）
import { TILES, isPropertyTile, JAIL_TURNS, HOSPITAL_FEE } from './board.js'
import { payMoney, addMoney } from './bank.js'
import { getRent } from './property.js'
import { alivePlayers, checkBankrupt, getWinnerByElimination, settleByTurns } from './gameOver.js'

// 机会事件池（数据驱动：加事件 = 加一行）
const EVENT_POOL = [
  { text: '捡到钱包，天降横财', delta: 300 },
  { text: '交通违章罚款', delta: -200 },
  { text: '股票小赚一笔', delta: 150 },
  { text: '手机摔坏，维修破财', delta: -100 },
  { text: '收到生日礼金', delta: 200 },
  { text: '房屋管道维修', delta: -250 },
  { text: '路边摆摊赚外快', delta: 180 },
  { text: '被偷了钱包', delta: -150 },
]

export function drawEvent() {
  return EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)]
}

// 玩家落地结算
export function handleLanding(state, player) {
  const tile = TILES[player.pos]

  if (isPropertyTile(tile)) {
    const owner = state.players.find(
      (p) => p.alive && p.properties.includes(tile.id)
    )
    if (!owner) {
      // 无主地：进入"待购买"阶段（UI/AI 发 BUY_PROPERTY 或 SKIP_BUY）
      state.pending = { kind: 'buy', tileId: tile.id }
      return
    }
    if (owner.id === player.id) {
      state.log.push(`${player.name} 回到自己的 ${tile.name}`)
      return
    }
    // 付租
    const level = owner.levels[tile.id] ?? 0
    const rent = getRent(state, tile, level)
    payMoney(state, player.id, owner.id, rent, `踩中 ${owner.name} 的 ${tile.name}（等级${level}），支付租金`)
    checkBankrupt(state, player)
    return
  }

  switch (tile.type) {
    case 'start':
      break
    case 'tax':
      payMoney(state, player.id, null, tile.amount, `缴纳${tile.name}`)
      checkBankrupt(state, player)
      break
    case 'event': {
      const ev = drawEvent()
      addMoney(state, player.id, ev.delta, ev.text)
      checkBankrupt(state, player)
      break
    }
    case 'jail':
      player.jailLeft = JAIL_TURNS
      state.log.push(`🚔 ${player.name} 进了监狱，停 ${JAIL_TURNS} 轮`)
      break
    case 'hospital':
      player.hospital = true
      payMoney(state, player.id, null, HOSPITAL_FEE, `入院治疗`)
      checkBankrupt(state, player)
      state.log.push(`🏥 ${player.name} 住院，下一轮休养`)
      break
  }
}

// 推进到下一存活玩家；返回 state（可能已结束）
export function nextTurn(state) {
  const alive = alivePlayers(state)
  if (alive.length === 0) return state

  const prev = state.turnIndex
  let next = (prev + 1) % state.players.length
  while (!state.players[next].alive) next = (next + 1) % state.players.length

  if (next <= prev) state.round += 1
  state.turnIndex = next
  state.dice = null
  state.pending = null
  state.phase = 'roll'

  // 胜负判定
  const winner = getWinnerByElimination(state)
  if (winner) {
    state.status = 'finished'
    state.winnerId = winner
    state.log.push(`🏆 ${state.players.find((p) => p.id === winner).name} 成为最后赢家！`)
    return state
  }
  if (state.settings.maxTurns && state.round > state.settings.maxTurns) {
    const w = settleByTurns(state)
    state.status = 'finished'
    state.winnerId = w
    const wName = state.players.find((p) => p.id === w)?.name ?? '?'
    state.log.push(`⏱ 已达 ${state.settings.maxTurns} 回合上限，按总资产结算，${wName} 获胜！`)
  }
  return state
}

// 当前轮到的玩家
export function currentPlayer(state) {
  return state.players[state.turnIndex]
}
