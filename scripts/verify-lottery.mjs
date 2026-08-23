// 验证彩票新行为：基础池5000 + drawing阶段每圈只抽一次（不每回合抽）
import { createInitialState, gameReducer } from '../shared/game/index.js'

const s = createInitialState({
  players: [
    { id: 'p1', name: 'A', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
    { id: 'p3', name: 'C', isAI: true },
  ], maxTurns: 40, startMoney: 20000,
})
s.bonusTile = { id: 0, amount: 0 }

console.log('初始池:', s.lottery.pool)

// 买票
s.players[0].money = 20000
s.pending = { kind: 'lottery', tileId: 45 }
s.phase = 'landed'
let st = gameReducer(s, { type: 'BUY_TICKETS', numbers: [7, 15, 42] })
console.log('买3张后 pool:', st.lottery.pool)
st = gameReducer(st, { type: 'LOTTERY_CLOSE' })

// 推进60个回合，记录每次开奖的圈数和号码
let lastWinning = null
let lastDrawRound = null
const draws = []
for (let i = 0; i < 120; i++) {
  if (st.status !== 'playing') break
  st.phase = 'landed'; st.pending = null; st.turnIndex = i % 3
  const beforeWin = st.lottery.currentWinning
  const beforeRound = st.round
  st = gameReducer(st, { type: 'END_TURN' })
  // 检测 currentWinning 变化 = 发生了一次开奖
  if (st.lottery.currentWinning !== null && st.lottery.currentWinning !== beforeWin) {
    draws.push({ round: st.round, winning: st.lottery.currentWinning, phase: st.lottery.phase })
  }
}

console.log('\n=== 开奖记录 ===')
for (const d of draws) console.log(`round=${d.round} winning=${d.winning} phase=${d.phase}`)
console.log('总开奖次数:', draws.length)
console.log('最终状态: round=' + st.round, 'phase=' + st.lottery.phase, 'pool=' + st.lottery.pool)

if (draws.length >= 2) {
  const gaps = draws.slice(1).map((d, i) => d.round - draws[i].round)
  console.log('相邻两次开奖间隔的圈数:', gaps.join(', '))
  console.log(gaps.every(g => g >= 5) ? '✓ 每次间隔≥5圈' : '⚠ 存在间隔<5圈的连续抽奖')
}
