// lottery.js — 彩票系统
// 规则：路过彩票站可购买彩票（¥500/张，选 1-100 数字，全局唯一）
// 每 5 回合公布一个中奖数字，有人中→拿全部奖金，重置基础¥10000，新一轮
// 无人中→下一回合换一个新数字直到有人中
// 中奖那回合的下一回合直接开始新一轮
import { TILES } from './board.js'

const BASE_PRIZE = 10000
const TICKET_PRICE = 500

// 彩票状态存储在 state.lottery 中：
// { round: 当前期数开始回合, pool: 当前奖池, pickedNumbers: {playerId: [数字]}, currentWinning: 当前中奖数字|null, phase: 'buying'|'drawing' }

// 初始化彩票状态
export function initLotteryState() {
  return {
    round: 1,          // 当前期开始回合
    pool: BASE_PRIZE,  // 当前奖池（基础 + 购票金额）
    pickedNumbers: {}, // { playerId: [num1, num2, ...] }
    currentWinning: null, // 当前开奖数字
    phase: 'buying',   // 'buying'=可购买期, 'drawing'=开奖中期
    drawnThisRound: false, // 本期是否已开过奖
  }
}

// 购买彩票（单张）
export function buyTicket(state, playerId, number) {
  const lot = state.lottery
  if (!lot) return { ok: false, msg: '彩票系统未初始化' }

  // 检查数字范围
  if (number < 1 || number > 100 || !Number.isInteger(number)) {
    return { ok: false, msg: '数字必须在 1-100 之间' }
  }

  // 检查是否已被选
  for (const [pid, nums] of Object.entries(lot.pickedNumbers)) {
    if (nums.includes(number)) {
      return { ok: false, msg: `数字 ${number} 已被玩家选走` }
    }
  }

  // 检查钱
  const player = state.players.find(p => p.id === playerId)
  if (!player || player.money < TICKET_PRICE) {
    return { ok: false, msg: `现金不足 ¥${TICKET_PRICE}` }
  }

  // 扣钱 + 加入奖池
  player.money -= TICKET_PRICE
  lot.pool += TICKET_PRICE

  // 记录彩票
  if (!lot.pickedNumbers[playerId]) lot.pickedNumbers[playerId] = []
  lot.pickedNumbers[playerId].push(number)

  state.log.push(`🎫 ${player.name} 花 ¥${TICKET_PRICE} 买了彩票，选了数字 ${number}（奖池 ¥${lot.pool}）`)
  return { ok: true }
}

// 批量购买彩票（选号后一次买多张）
export function buyTickets(state, playerId, numbers) {
  const lot = state.lottery
  if (!lot) return { ok: false, msg: '彩票系统未初始化', count: 0 }

  const player = state.players.find(p => p.id === playerId)
  if (!player) return { ok: false, msg: '玩家不存在', count: 0 }

  let count = 0
  let failedMsg = ''
  for (const number of numbers) {
    const res = buyTicket(state, playerId, number)
    if (res.ok) {
      count++
    } else {
      failedMsg = res.msg
      break // 钱不够或重复时停止
    }
  }

  if (count > 0) {
    state.log.push(`🎫 ${player.name} 批量购买了 ${count} 张彩票（共 ¥${count * TICKET_PRICE}）`)
    return { ok: true, count, msg: `成功购买 ${count} 张` }
  }
  return { ok: false, count: 0, msg: failedMsg || '购买失败' }
}

// 每回合调用：判断是否需要开奖或换号码
// 在 nextTurn 之后、phase='roll' 时调用
export function tickLottery(state) {
  const lot = state.lottery
  if (!lot) return

  if (lot.phase === 'buying') {
    // 检查是否到了开奖回合（每 5 回合）
    if (state.round > lot.round && (state.round - lot.round) % 5 === 0 && !lot.drawnThisRound) {
      // 进入开奖
      drawNumber(state)
    }
  } else if (lot.phase === 'drawing') {
    // 开奖中期：无人中奖则换一个新号码
    drawNumber(state)
  }
}

// 抽取中奖数字并判定
function drawNumber(state) {
  const lot = state.lottery

  // 随机 1-100
  const winning = 1 + Math.floor(Math.random() * 100)
  lot.currentWinning = winning
  lot.drawnThisRound = true

  state.log.push(`🎰 第 ${state.round} 回合彩票开奖！中奖数字：${winning}`)

  // 检查是否有人中奖
  let winnerId = null
  let winnerName = null
  for (const [pid, nums] of Object.entries(lot.pickedNumbers)) {
    if (nums.includes(winning)) {
      winnerId = pid
      break
    }
  }

  if (winnerId) {
    // 中奖！
    const winner = state.players.find(p => p.id === winnerId)
    if (winner && winner.alive) {
      const prize = lot.pool
      winner.money += prize
      winnerName = winner.name
      state.log.push(`🎉🎊 ${winner.name} 的彩票「${winning}」中了头奖！获得 ¥${prize}！🎊🎉`)
    }
    // 中奖后：下一回合开始新一轮
    lot.phase = 'drawing_won' // 标记：下回合重置
    // 弹出开奖弹窗（含庆祝）
    state.pending = { kind: 'lottery_draw', winning, winnerId, winnerName, prize: lot.pool, pool: lot.pool }
  } else {
    // 无人中奖
    state.log.push(`😢 无人中奖，下一回合重新开奖...`)
    lot.phase = 'drawing' // 保持开奖状态，下回合继续抽
    // 弹出开奖弹窗（无庆祝）
    state.pending = { kind: 'lottery_draw', winning, winnerId: null, winnerName: null, prize: 0, pool: lot.pool }
  }
}

// 在 nextTurn 最开始调用：检查是否需要开始新一轮
export function resetLotteryIfWon(state) {
  const lot = state.lottery
  if (!lot) return

  if (lot.phase === 'drawing_won') {
    // 中奖后的下一回合：重置
    lot.pool = BASE_PRIZE
    lot.pickedNumbers = {}
    lot.currentWinning = null
    lot.drawnThisRound = false
    lot.round = state.round
    lot.phase = 'buying'
    state.log.push(`🔄 新一轮彩票开始！基础奖池 ¥${BASE_PRIZE}`)
  }
}

// 获取彩票站格子 ids（用于路过检测）
export const LOTTERY_TILES = [45, 41]

// 检查并触发彩票购买弹窗
export function tryTriggerLottery(state, player) {
  const lot = state.lottery
  if (!lot) return false
  if (lot.phase !== 'buying') return false
  // 检查路径是否经过彩票站
  const passed = player.walkPath?.find(id => LOTTERY_TILES.includes(id))
  if (!passed) return false
  // 已有彩票 pending 则不重复弹
  if (state.pending?.kind === 'lottery') return false
  // 本回合已买过
  if (state.lotteryBoughtTurn) return false

  state.pending = { kind: 'lottery', tileId: passed }
  state.log.push(`🎫 ${player.name} 路过彩票站，可以购买彩票！`)
  return true
}

// 延迟触发彩票弹窗：路过彩票站后，当玩家停下（分岔/落地）时弹出
export function tryTriggerLotteryDeferred(state) {
  if (state.pending || !state._lotteryTile) return false
  if (state.lotteryBoughtTurn) return false
  if (state.lottery?.phase !== 'buying') return false
  const tileId = state._lotteryTile
  state.pending = { kind: 'lottery', tileId }
  state._lotteryTile = null
  const p = state.players.find((pl) => pl.alive && pl.pos === tileId) || state.players[state.turnIndex]
  state.log.push(`🎫 ${p.name} 路过彩票站（${TILES[tileId].name}），可以购买彩票！`)
  return true
}
