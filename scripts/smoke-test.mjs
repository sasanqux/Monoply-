// smoke-test.mjs — 规则冒烟：自动完整跑一局，验证账目与胜负逻辑
import {
  createInitialState,
  gameReducer,
  aiDecide,
  currentPlayer,
  totalAssets,
} from '../src/game/index.js'

function runGame(label, players, maxTurns) {
  const initialState = createInitialState({ players, maxTurns, startMoney: 5000 })
  let state = initialState
  let steps = 0
  const MAX_STEPS = 8000

  while (state.status === 'playing' && steps < MAX_STEPS) {
    const cur = currentPlayer(state)
    const action = aiDecide(state, cur.id)
    state = gameReducer(state, action)
    steps++
  }

  // 断言
  const alive = state.players.filter((p) => p.alive)
  if (alive.length === 0) throw new Error(`[${label}] 无人存活`)
  if (state.players.some((p) => p.alive && p.money < 0))
    throw new Error(`[${label}] 存活玩家现金为负`)
  if (state.status !== 'finished')
    throw new Error(`[${label}] 未结束（步数 ${steps}）`)
  if (steps >= MAX_STEPS) throw new Error(`[${label}] 疑似死循环`)

  const winner = state.players.find((p) => p.id === state.winnerId)
  if (!winner) throw new Error(`[${label}] 无胜者`)

  console.log(`✓ [${label}] 完成 | 轮数 ${state.round} | 步数 ${steps} | 胜者 ${winner.name}`)
  for (const p of state.players) {
    console.log(`    ${p.name}: 现金 ¥${p.money} | 总资产 ¥${totalAssets(p)} | 地产 ${p.properties.length} 块 | ${p.alive ? '存活' : '破产'}`)
  }
  return state
}

// 场景 1：3 人局（1 真人 + 2 AI），40 回合上限
runGame('3人局·40回合', [
  { id: 'p1', name: '玩家', isAI: false },
  { id: 'p2', name: 'AI小蓝', isAI: true },
  { id: 'p3', name: 'AI小绿', isAI: true },
], 40)

// 场景 2：4 人纯 AI，无回合上限（打到只剩一人）
runGame('4人局·淘汰到底', [
  { id: 'a1', name: 'AI一', isAI: true },
  { id: 'a2', name: 'AI二', isAI: true },
  { id: 'a3', name: 'AI三', isAI: true },
  { id: 'a4', name: 'AI四', isAI: true },
], null)

// 场景 3：2 人局，小初始资金（3000）快节奏
runGame('2人局·3000起步', [
  { id: 'x1', name: 'AI甲', isAI: true },
  { id: 'x2', name: 'AI乙', isAI: true },
], 20)

console.log('\nSMOKE OK — 全部通过')
