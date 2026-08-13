// smoke-test.mjs — 冒烟：整局跑通 + 两江拦截 + 卡片/道具/载具/桥 单元验证
import {
  createInitialState,
  gameReducer,
  aiDecide,
  currentPlayer,
  totalAssets,
  TILES,
  movePlayer,
  VEHICLES,
} from '../src/game/index.js'

function makeState(players, maxTurns = 40, startMoney = 5000) {
  return createInitialState({ players, maxTurns, startMoney })
}

let pass = 0
let fail = 0
function check(name, cond) {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name}`)
  }
}

// ===== 1. 整局跑通（AI 买地/买桥/盖楼/过江/监狱/医院/卡牌道具格全覆盖） =====
console.log('▶ 整局跑通（3 人 · 40 回合）')
{
  let state = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'AI小蓝', isAI: true },
    { id: 'p3', name: 'AI小绿', isAI: true },
  ], 40)
  let steps = 0
  while (state.status === 'playing' && steps < 10000) {
    const cur = currentPlayer(state)
    const action = aiDecide(state, cur.id)
    state = gameReducer(state, action)
    steps++
  }
  check('游戏正常结束', state.status === 'finished' && steps < 10000)
  check('存活玩家现金不为负', state.players.every((p) => !p.alive || p.money >= 0))
  check('有胜者', !!state.winnerId)
  const bridgesOwned = state.players.reduce((n, p) => n + p.properties.filter((i) => TILES[i].type === 'bridge').length, 0)
  console.log(`    轮数 ${state.round} · 步数 ${steps} · 桥被购买 ${bridgesOwned} 座`)
}

// ===== 2. 两江拦截 =====
console.log('▶ 两江拦截')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const player = s.players[0]
  player.pos = 16 // 万州，riverEdge 去 17 朝天门大桥
  player.money = 10000
  const r1 = movePlayer(s, player, [1, 1]) // 走 2 步：16→17(桥)→18
  check('过桥格后可继续走', r1.pos === 18)
  player.pos = 4
  const r2 = movePlayer(s, player, [1, 1])
  check('无跨江正常移动', r2.pos === 6)
  s.closedBridges[17] = 2
  player.pos = 16
  player.money = 10000
  const r3 = movePlayer(s, player, [1, 1])
  check('封桥后被拦在江边', r3.blocked === true && r3.pos === 16)
  player.ferry = true
  const r4 = movePlayer(s, player, [1, 1])
  check('轮渡卡无视拦截', r4.pos === 18)
}

// ===== 3. 卡片效果 =====
console.log('▶ 卡片系统')
{
  let state = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  let a = state.players[0]
  let b = state.players[1]
  a.money = 5000
  b.money = 2000
  // 均富卡
  a.hand = [{ id: 'c1', type: 'equalize', name: '均富卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c1' })
  a = state.players[0]
  b = state.players[1]
  check('均富卡平分现金', a.money === b.money)
  check('已用卡从手牌移除', a.hand.length === 0)
  // 购地卡：买无主地产 1 号（观音桥）
  a.money = 10000
  a.hand = [{ id: 'c2', type: 'buy', name: '购地卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c2', target: { tileId: 1 } })
  a = state.players[0]
  check('购地卡买到观音桥', a.properties.includes(1))
  // 核弹卡：炸 b 的 20 号（丰都）
  b = state.players[1]
  b.properties = [20]
  b.levels = { 20: 2 }
  a.hand = [{ id: 'c3', type: 'nuke', name: '核弹卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c3', target: { tileId: 20 } })
  b = state.players[1]
  a = state.players[0]
  check('核弹卡炸平对手地产', !b.properties.includes(20))
  // 轮渡卡
  a.hand = [{ id: 'c4', type: 'ferry', name: '轮渡卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c4' })
  a = state.players[0]
  check('轮渡卡生效（ferry）', a.ferry === true)
  // 封桥卡
  a.hand = [{ id: 'c5', type: 'closeBridge', name: '封桥卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c5', target: { tileId: 6 } })
  check('封桥卡封闭千厮门大桥', state.closedBridges[6] === 2)
  // 陷害卡
  a = state.players[0]
  a.hand = [{ id: 'c6', type: 'frame', name: '陷害卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c6', target: { playerId: 'p2' } })
  b = state.players[1]
  check('陷害卡送人进监狱', b.jailLeft === 2)
}

// ===== 4. 道具系统 =====
console.log('▶ 道具系统')
{
  let state = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  let a = state.players[0]
  let b = state.players[1]
  // 路障：A 放置路障在 8，B 从 7 走 2 步应被挡在 8
  a.items = [{ id: 'i1', type: 'barrier', name: '路障', desc: '', icon: '' }]
  state.boardItems = []
  state = gameReducer(state, { type: 'USE_ITEM', itemId: 'i1', tileId: 8 })
  check('放置路障成功', state.boardItems.length === 1)
  b = state.players[1]
  b.pos = 7
  b.money = 5000
  const moved = movePlayer(state, b, [1, 1])
  check('路障挡停移动', moved.blocked === true && moved.pos === 8)
  check('路障被消耗', state.boardItems.length === 0)
  // 遥控骰子
  a = state.players[0]
  a.items = [{ id: 'i2', type: 'remoteDice', name: '遥控骰子', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_ITEM', itemId: 'i2', value: 7 })
  check('遥控骰子设定点数', state.players[0].remoteDice === 7)
  // 传送门
  a = state.players[0]
  a.items = [{ id: 'i3', type: 'portal', name: '传送门', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_ITEM', itemId: 'i3', tileId: 33 })
  check('传送门传送成功', state.players[0].pos === 33)
  // 定时炸弹：放置
  a = state.players[0]
  a.items = [{ id: 'i4', type: 'bomb', name: '定时炸弹', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_ITEM', itemId: 'i4', tileId: 10 })
  check('炸弹放置成功', state.boardItems.some((x) => x.type === 'bomb' && x.fuse === 3))
}

// ===== 5. 载具 =====
console.log('▶ 交通工具')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  check('初始走路 2 骰', VEHICLES.walk.dice === 2)
  check('自行车 3 骰', VEHICLES.bike.dice === 3)
  check('飞机 6 骰', VEHICLES.plane.dice === 6)
  const s2 = gameReducer(s, { type: 'ROLL_DICE' })
  check('掷骰/落地结算不崩溃', s2.status === 'playing' || s2.status === 'finished')
}

// ===== 6. 桥资产 =====
console.log('▶ 桥资产')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  const b = s.players[1]
  a.money = 10000
  a.properties.push(6)
  b.money = 5000
  b.pos = 5 // 杨家坪（riverEdge），走 1 步到 6 桥 → 交过路费
  const before = b.money
  const moved = movePlayer(s, b, [1, 0])
  check('过桥交纳过路费', b.money < 5000 && moved.pos === 6)
  const after = b.money
  check('桥主收到过路费', a.money === 10000 + (before - after))
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
if (fail > 0) process.exit(1)
console.log('SMOKE OK')
