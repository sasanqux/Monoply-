// turn.js — 落地结算 + 回合推进（48 格 · 轻轨 · 商圈）
import { TILES, isPropertyTile, isBridge, isMetro, JAIL_TURNS, METRO_FEE } from './board.js'
import { payMoney, addMoney } from './bank.js'
import { getRent, isGroupComplete } from './property.js'
import { randomCard, tryShield } from './card.js'
import { randomItem, tickBombs } from './item.js'
import { alivePlayers, checkBankrupt, getWinnerByElimination, settleByTurns } from './gameOver.js'

const HAND_LIMIT = 10
const ITEM_LIMIT = 5

// 通用事件池（山城奇遇，含抽卡/得道具/载具丢失）
const EVENT_POOL = [
  { text: '捡到钱包，天降横财', delta: 300 },
  { text: '交通违章罚款', delta: -200 },
  { text: '股票小赚一笔', delta: 150 },
  { text: '手机摔坏，维修破财', delta: -100 },
  { text: '收到生日礼金', delta: 200 },
  { text: '房屋管道维修', delta: -250 },
  { text: '路边摆摊赚外快', delta: 180 },
  { text: '被偷了钱包', delta: -150 },
  { text: '载具抛锚，只能走路了', delta: -80, loseVehicle: true },
  { text: '载具被拖走，含泪走路', delta: -120, loseVehicle: true },
  { text: '偶遇神秘人，送了一张卡片！', delta: 0, card: true },
  { text: '在旧货堆里捡到一件道具！', delta: 0, item: true },
]

// 火锅事件池（重庆火锅格）
const HOTPOT_POOL = [
  { text: '吃了顿正宗火锅，香！', delta: -150 },
  { text: '给火锅店代言，赚了代言费', delta: 250 },
  { text: '朋友请客白吃一顿火锅', delta: 0 },
  { text: '火锅太辣，肚子拉得够呛', delta: -100 },
  { text: '火锅店抽奖中免单，还倒赚', delta: 120 },
]

export function drawEvent() {
  return EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)]
}

export function drawHotpot() {
  return HOTPOT_POOL[Math.floor(Math.random() * HOTPOT_POOL.length)]
}

// 落地结算
export function handleLanding(state, player) {
  const tile = TILES[player.pos]

  // 桥梁：无主可买（有主收费已在移动中处理）
  if (isBridge(tile)) {
    const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
    if (!owner) state.pending = { kind: 'buy', tileId: tile.id }
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
    } else {
      const level = owner.levels[tile.id] ?? 0
      const fee = getRent(state, tile, level)
      const feeName = isMetro(tile) ? '轻轨使用费' : '租金'
      payMoney(state, player.id, owner.id, fee, `使用 ${owner.name} 的「${tile.name}」支付${feeName}`)
      checkBankrupt(state, player)
      if (tile.group && isGroupComplete(state, tile.group)) {
        state.log.push(`🏙️ 「${GROUPS_OF(tile.group)}」商圈已建成，${owner.name} 坐地收租！`)
      }
    }
    // 轻轨站：可乘轻轨去其他站（购买决策优先，买完不再弹乘轻轨）
    if (isMetro(tile) && !state.pending) {
      state.pending = { kind: 'metro', tileId: tile.id }
    }
    return
  }

  switch (tile.type) {
    case 'start':
      state.log.push(`${player.name} 路过解放碑，歇歇脚`)
      break
    case 'event': {
      if (tile.id === 42) {
        // 重庆火锅：特色事件
        const ev = drawHotpot()
        addMoney(state, player.id, ev.delta, ev.text)
        checkBankrupt(state, player)
      } else {
        // 山城奇遇：通用事件（可抽卡/得道具/丢载具）
        const ev = drawEvent()
        addMoney(state, player.id, ev.delta, ev.text)
        if (ev.loseVehicle && player.vehicle !== 'walk') {
          player.vehicle = 'walk'
          state.log.push(`🚶 ${player.name} 的载具没了，只能走路（2 颗骰）`)
        }
        if (ev.card) {
          const card = randomCard()
          if (player.hand.length >= HAND_LIMIT) {
            addMoney(state, player.id, 100, '手牌满了，卡片换成了安慰费')
          } else {
            player.hand.push({ ...card, id: `c${player.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
          }
        }
        if (ev.item) {
          const item = randomItem()
          if (player.items.length >= ITEM_LIMIT) {
            addMoney(state, player.id, 80, '道具栏满了，卖了点旧货')
          } else {
            player.items.push({ ...item, id: `i${player.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
          }
        }
        checkBankrupt(state, player)
      }
      break
    }
    case 'jail':
      player.jailLeft = JAIL_TURNS
      state.log.push(`🚔 ${player.name} 进了拘留所，停 ${JAIL_TURNS} 轮`)
      break
    case 'hospital': {
      if (tryShield(state, player)) break
      player.hospital = true
      payMoney(state, player.id, null, 200, `入院治疗`)
      checkBankrupt(state, player)
      state.log.push(`🏥 ${player.name} 住院，下一轮休养`)
      break
    }
  }
}

// 商圈名（local helper）
function GROUPS_OF(g) {
  const map = { g1: '渝中核心', g2: '两江商业', g3: '人文旅游', g4: '南岸滨江', g5: '九龙商业', g6: '南部新城' }
  return map[g] ?? g
}

// 推进到下一存活玩家
export function nextTurn(state) {
  const alive = alivePlayers(state)
  if (alive.length === 0) return state

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

export { METRO_FEE }
