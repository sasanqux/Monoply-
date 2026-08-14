// turn.js — 落地结算 + 回合推进（52 格 · 图结构 · 轻轨 · 商圈）
import { TILES, isPropertyTile, isMetro, GROUPS } from './board.js'
import { payMoney, addMoney } from './bank.js'
import { getRent, isGroupComplete } from './property.js'
import { randomCard, tryShield } from './card.js'
import { randomItem, tickBombs } from './item.js'
import { alivePlayers, checkBankrupt, getWinnerByElimination, settleByTurns } from './gameOver.js'

const HAND_LIMIT = 10
const ITEM_LIMIT = 5
const CORNER_BONUS = 200

// 通用事件池（山城奇遇，含抽卡/得道具/载具丢失/重庆特色）
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
  { text: '洪崖洞夜景直播，收了一波打赏', delta: 280 },
  { text: '长江索道排队太久，改打车破财', delta: -220 },
  { text: '磁器口试吃麻花，顺手买了两袋', delta: -130 },
  { text: '南山一棵树帮游客拍照，赚了外快', delta: 160 },
  { text: '轻轨穿楼拍视频火了，流量变现', delta: 240 },
  { text: '火锅太辣肠胃罢工，看病花了一笔', delta: -320 },
]

export function drawEvent() {
  return EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)]
}

// 落地结算
export function handleLanding(state, player) {
  const tile = TILES[player.pos]

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
      if (tile.group && isGroupComplete(state, tile.group) && !state.announcedGroups[tile.group]) {
        state.announcedGroups[tile.group] = true
        state.log.push(`🏙️ 「${GROUPS[tile.group]?.name ?? tile.group}」商圈已建成，${owner.name} 坐地收租！`)
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
      state.log.push(`${player.name} 回到朝天门，重整旗鼓`)
      break
    case 'corner':
      addMoney(state, player.id, CORNER_BONUS, `在「${tile.name}」逛了一圈，领到奖励 ¥${CORNER_BONUS}`)
      break
    case 'event': {
      const ev = drawEvent()
      addMoney(state, player.id, ev.delta, ev.text)
      if (ev.loseVehicle && player.vehicle !== 'walk') {
        player.vehicle = 'walk'
        state.log.push(`🚶 ${player.name} 的载具没了，只能走路`)
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
      break
    }
    default:
      break
  }
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
