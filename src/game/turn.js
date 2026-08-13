// turn.js — 落地结算 + 回合推进（回合状态机核心）
import { TILES, isPropertyTile, isBridge, JAIL_TURNS, HOSPITAL_FEE, WORKSHOP_FEE, VEHICLES, VEHICLE_ORDER } from './board.js'
import { payMoney, addMoney } from './bank.js'
import { getRent } from './property.js'
import { randomCard, tryShield } from './card.js'
import { randomItem, tickBombs } from './item.js'
import { alivePlayers, checkBankrupt, getWinnerByElimination, settleByTurns } from './gameOver.js'

const HAND_LIMIT = 10
const ITEM_LIMIT = 5

// 机会事件池（含载具丢失）
const EVENT_POOL = [
  { text: '捡到钱包，天降横财', delta: 300, loseVehicle: false },
  { text: '交通违章罚款', delta: -200, loseVehicle: false },
  { text: '股票小赚一笔', delta: 150, loseVehicle: false },
  { text: '手机摔坏，维修破财', delta: -100, loseVehicle: false },
  { text: '收到生日礼金', delta: 200, loseVehicle: false },
  { text: '房屋管道维修', delta: -250, loseVehicle: false },
  { text: '路边摆摊赚外快', delta: 180, loseVehicle: false },
  { text: '被偷了钱包', delta: -150, loseVehicle: false },
  { text: '载具抛锚，只能走路了', delta: -80, loseVehicle: true },
  { text: '载具被拖走，含泪走路', delta: -120, loseVehicle: true },
]

export function drawEvent() {
  return EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)]
}

// 玩家落地结算
export function handleLanding(state, player) {
  const tile = TILES[player.pos]

  // 桥：无主可买（有主时过路费已在移动中收取）
  if (isBridge(tile)) {
    const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
    if (!owner) {
      state.pending = { kind: 'buy', tileId: tile.id, isBridge: true }
    }
    return
  }

  if (isPropertyTile(tile)) {
    const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
    if (!owner) {
      state.pending = { kind: 'buy', tileId: tile.id }
      return
    }
    if (owner.id === player.id) {
      state.log.push(`${player.name} 回到自己的「${tile.name}」`)
      return
    }
    const level = owner.levels[tile.id] ?? 0
    const rent = getRent(state, tile, level)
    payMoney(state, player.id, owner.id, rent, `踩中 ${owner.name} 的「${tile.name}」（等级${level}），支付租金`)
    checkBankrupt(state, player)
    return
  }

  switch (tile.type) {
    case 'start':
      break
    case 'tax': {
      if (tryShield(state, player)) break
      payMoney(state, player.id, null, tile.amount, `缴纳${tile.name}`)
      checkBankrupt(state, player)
      break
    }
    case 'event': {
      const ev = drawEvent()
      addMoney(state, player.id, ev.delta, ev.text)
      if (ev.loseVehicle && player.vehicle !== 'walk') {
        player.vehicle = 'walk'
        state.log.push(`🚶 ${player.name} 的载具没了，只能走路（${VEHICLES.walk.dice} 颗骰）`)
      }
      checkBankrupt(state, player)
      break
    }
    case 'jail':
      player.jailLeft = JAIL_TURNS
      state.log.push(`🚔 ${player.name} 进了拘留所，停 ${JAIL_TURNS} 轮`)
      break
    case 'hospital': {
      if (tryShield(state, player)) break
      player.hospital = true
      payMoney(state, player.id, null, HOSPITAL_FEE, `入院治疗`)
      checkBankrupt(state, player)
      state.log.push(`🏥 ${player.name} 住院，下一轮休养`)
      break
    }
    case 'card': {
      const card = randomCard()
      if (player.hand.length >= HAND_LIMIT) {
        addMoney(state, player.id, 100, '手牌满了，报刊亭给了点安慰费')
      } else {
        player.hand.push({ ...card, id: `c${player.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
        state.log.push(`🎴 ${player.name} 抽到「${card.name}」！`)
      }
      break
    }
    case 'item': {
      const item = randomItem()
      if (player.items.length >= ITEM_LIMIT) {
        addMoney(state, player.id, 80, '道具栏满了，卖了点旧货')
      } else {
        player.items.push({ ...item, id: `i${player.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
        state.log.push(`📦 ${player.name} 捡到「${item.name}」！`)
      }
      break
    }
    case 'vehicle': {
      const curIdx = VEHICLE_ORDER.indexOf(player.vehicle)
      if (curIdx < VEHICLE_ORDER.length - 1) {
        player.vehicle = VEHICLE_ORDER[curIdx + 1]
        const v = VEHICLES[player.vehicle]
        state.log.push(`🚗 ${player.name} 换乘${v.name}！以后掷 ${v.dice} 颗骰`)
      } else {
        addMoney(state, player.id, 300, '已是顶级载具，交通枢纽奖励一笔')
      }
      break
    }
    case 'workshop': {
      if (player.vehicle !== 'walk') {
        payMoney(state, player.id, null, WORKSHOP_FEE, '汽修站保养费')
        checkBankrupt(state, player)
      } else {
        state.log.push(`${player.name} 在汽修站歇了歇脚`)
      }
      break
    }
  }
}

// 推进到下一存活玩家
export function nextTurn(state) {
  const alive = alivePlayers(state)
  if (alive.length === 0) return state

  // 回合结束结算：炸弹倒计时、封桥倒计时
  tickBombs(state)
  for (const id of Object.keys(state.closedBridges)) {
    state.closedBridges[id] -= 1
    if (state.closedBridges[id] <= 0) {
      delete state.closedBridges[id]
      state.log.push(`🌉 ${TILES[Number(id)].name} 恢复通行`)
    }
  }

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

export function currentPlayer(state) {
  return state.players[state.turnIndex]
}
