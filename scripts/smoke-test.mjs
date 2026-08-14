// smoke-test.mjs — 冒烟：48 格整局 + 两江拦截 + 轻轨 + 商圈 + 卡片/道具/载具/桥
import {
  createInitialState,
  gameReducer,
  aiDecide,
  currentPlayer,
  totalAssets,
  TILES,
  movePlayer,
  VEHICLES,
  isGroupComplete,
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

console.log('▶ 整局跑通（3 人 · 48 格 · 40 回合）')
{
  let state = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'AI小蓝', isAI: true },
    { id: 'p3', name: 'AI小绿', isAI: true },
  ], 40)
  let steps = 0
  while (state.status === 'playing' && steps < 12000) {
    const cur = currentPlayer(state)
    const action = aiDecide(state, cur.id)
    state = gameReducer(state, action)
    steps++
  }
  check('游戏正常结束', state.status === 'finished' && steps < 12000)
  check('存活玩家现金不为负', state.players.every((p) => !p.alive || p.money >= 0))
  check('有胜者', !!state.winnerId)
  const bridgesOwned = state.players.reduce((n, p) => n + p.properties.filter((i) => TILES[i].type === 'bridge').length, 0)
  const metrosOwned = state.players.reduce((n, p) => n + p.properties.filter((i) => TILES[i].type === 'metro').length, 0)
  console.log(`    轮数 ${state.round} · 步数 ${steps} · 桥 ${bridgesOwned} 座 · 轻轨站 ${metrosOwned} 个`)
}

console.log('▶ 两江拦截')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const player = s.players[0]
  player.pos = 3 // 大溪沟 riverEdge → 4 黄花园大桥
  player.money = 10000
  const r1 = movePlayer(s, player, [1, 1]) // 3→4(桥)→5
  check('过桥格后可继续走', r1.pos === 5)
  s.closedBridges[4] = 2
  player.pos = 3
  player.money = 10000
  const r2 = movePlayer(s, player, [1, 1])
  check('封桥后被拦在江边', r2.blocked === true && r2.pos === 3)
  player.ferry = true
  const r3 = movePlayer(s, player, [1, 1])
  check('轮渡卡无视拦截', r3.pos === 5)
  // 47 上清寺 → 48 千厮门大桥
  player.ferry = false
  player.pos = 47
  player.money = 10000
  const r4 = movePlayer(s, player, [1, 1])
  check('48→1 闭环可达', r4.pos === 48 || r4.pos === 1)
}

console.log('▶ 轻轨系统')
{
  let state = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = state.players[0]
  // A 在 9 号红土地（metro），可乘轻轨去 28 李子坝
  a.pos = 9
  a.money = 2000
  state.pending = { kind: 'metro', tileId: 9 }
  state = gameReducer(state, { type: 'TRAVEL_METRO', targetTileId: 28 })
  check('乘轻轨传送到目标站', state.players[0].pos === 28)
  check('乘轻轨扣费 150', state.players[0].money === 1850)
  check('乘轻轨后 pending 清空', state.pending === null)
  // 无 pending 时不能乘
  state = gameReducer(state, { type: 'TRAVEL_METRO', targetTileId: 44 })
  check('无 pending 不能乘轻轨', state.players[0].pos === 28)
}

console.log('▶ 商圈组合')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  check('渝中核心未集齐', isGroupComplete(s, 'g1') === false)
  a.properties = [2, 3]
  a.levels = { 2: 0, 3: 0 }
  check('临江门+大溪沟集齐渝中核心', isGroupComplete(s, 'g1') === true)
}

console.log('▶ 卡片效果')
{
  let state = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  let a = state.players[0]
  let b = state.players[1]
  a.money = 5000
  b.money = 2000
  a.hand = [{ id: 'c1', type: 'equalize', name: '均富卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c1' })
  a = state.players[0]
  b = state.players[1]
  check('均富卡平分现金', a.money === b.money)
  a.money = 10000
  a.hand = [{ id: 'c2', type: 'buy', name: '购地卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c2', target: { tileId: 2 } })
  a = state.players[0]
  check('购地卡买到临江门', a.properties.includes(2))
  b.properties = [20]
  b.levels = { 20: 2 }
  a.hand = [{ id: 'c3', type: 'nuke', name: '核弹卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c3', target: { tileId: 20 } })
  b = state.players[1]
  check('核弹卡炸平对手地产', !b.properties.includes(20))
  a = state.players[0]
  a.hand = [{ id: 'c4', type: 'ferry', name: '轮渡卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c4' })
  check('轮渡卡生效', state.players[0].ferry === true)
  a = state.players[0]
  a.hand = [{ id: 'c5', type: 'closeBridge', name: '封桥卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c5', target: { tileId: 4 } })
  check('封桥卡封闭黄花园大桥', state.closedBridges[4] === 2)
  a = state.players[0]
  a.hand = [{ id: 'c6', type: 'frame', name: '陷害卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c6', target: { playerId: 'p2' } })
  check('陷害卡送人进监狱', state.players[1].jailLeft === 2)
}

console.log('▶ 道具系统')
{
  let state = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  let a = state.players[0]
  let b = state.players[1]
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
  a = state.players[0]
  a.items = [{ id: 'i2', type: 'remoteDice', name: '遥控骰子', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_ITEM', itemId: 'i2', value: 6 })
  check('遥控骰子设定点数（走路 1 颗最大 6）', state.players[0].remoteDice === 6)
  // 越界值 clamp 到合法范围
  a = state.players[0]
  a.items = [{ id: 'i2b', type: 'remoteDice', name: '遥控骰子', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_ITEM', itemId: 'i2b', value: 99 })
  check('遥控骰子越界 clamp（走路 1 颗 → 6）', state.players[0].remoteDice === 6)
  a = state.players[0]
  a.items = [{ id: 'i3', type: 'portal', name: '传送门', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_ITEM', itemId: 'i3', tileId: 33 })
  check('传送门传送成功', state.players[0].pos === 33)
  a = state.players[0]
  a.items = [{ id: 'i4', type: 'bomb', name: '定时炸弹', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_ITEM', itemId: 'i4', tileId: 10 })
  check('炸弹放置成功', state.boardItems.some((x) => x.type === 'bomb' && x.fuse === 3))
}

console.log('▶ 交通工具')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  check('初始走路 1 骰', VEHICLES.walk.dice === 1)
  check('飞机 5 骰', VEHICLES.plane.dice === 5)
  const s2 = gameReducer(s, { type: 'ROLL_DICE' })
  check('掷骰/落地结算不崩溃', s2.status === 'playing' || s2.status === 'finished')
}

console.log('▶ 桥资产')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  const b = s.players[1]
  a.money = 10000
  a.properties.push(4)
  b.money = 5000
  b.pos = 3 // 大溪沟 riverEdge → 4 桥
  const before = b.money
  const moved = movePlayer(s, b, [1, 0])
  check('过桥交纳过路费', b.money < 5000 && moved.pos === 4)
  const after = b.money
  check('桥主收到过路费', a.money === 10000 + (before - after))
}

console.log('▶ 转向卡反向移动（方向 bug 回归）')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  a.pos = 3 // 大溪沟 riverEdge，反向走不跨江
  a.direction = -1 // 转向卡
  s.closedBridges[4] = 2 // 桥被封
  a.money = 10000
  const r = movePlayer(s, a, [1, 1]) // 反向 3→2→1，应不受封桥影响
  check('反向移动不被江边封桥拦截', r.pos === 1 && r.blocked !== true)
  // 正向移动仍被拦
  const s2 = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a2 = s2.players[0]
  a2.pos = 3
  a2.money = 10000
  s2.closedBridges[4] = 2
  const r2 = movePlayer(s2, a2, [1, 1])
  check('正向移动仍被江边封桥拦截', r2.blocked === true && r2.pos === 3)
}

console.log('▶ 免罪卡豁免过桥费')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0] // 桥主
  const b = s.players[1]
  a.properties.push(4)
  a.money = 10000
  b.money = 5000
  b.pos = 3
  b.shield = true // 免罪卡
  const before = b.money
  const moved = movePlayer(s, b, [1, 0])
  check('免罪卡豁免过桥费（现金不变）', b.money === before)
  check('免罪卡一次性消耗', b.shield === false)
  check('仍正常到达桥格', moved.pos === 4)
}

console.log('▶ AI 会用卡/道具/乘轻轨')
{
  // 封桥卡
  let s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].hand = [{ id: 'c1', type: 'closeBridge', name: '封桥卡', desc: '', icon: '' }]
  s.players[1].properties = [4]
  s.phase = 'landed'
  const a1 = aiDecide(s, 'p1')
  check('AI 持封桥卡且对手有桥 → 用封桥卡', a1?.type === 'USE_CARD' && a1?.target?.tileId === 4)
  // 拆除卡
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].hand = [{ id: 'c2', type: 'demolish', name: '拆除卡', desc: '', icon: '' }]
  s.players[1].properties = [20]
  s.players[1].levels = { 20: 2 }
  s.phase = 'landed'
  const a2 = aiDecide(s, 'p1')
  check('AI 持拆除卡且对手有楼 → 用拆除卡', a2?.type === 'USE_CARD' && a2?.target?.tileId === 20)
  // 放路障
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].items = [{ id: 'i1', type: 'barrier', name: '路障', desc: '', icon: '' }]
  s.players[0].properties = [5]
  s.players[0].levels = { 5: 2 }
  s.phase = 'landed'
  const a3 = aiDecide(s, 'p1')
  check('AI 有路障且有地产 → 放地产前一格', a3?.type === 'USE_ITEM' && a3?.tileId === 4)
  // 乘轻轨
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].pos = 9
  s.players[0].money = 2000
  s.pending = { kind: 'metro', tileId: 9 }
  s.phase = 'landed'
  const a4 = aiDecide(s, 'p1')
  check('AI 在轻轨站有钱 → 乘轻轨', a4?.type === 'TRAVEL_METRO' && TILES[a4.targetTileId]?.type === 'metro')
  // 轮渡卡（在江边）
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].pos = 3
  s.players[0].hand = [{ id: 'c5', type: 'ferry', name: '轮渡卡', desc: '', icon: '' }]
  s.phase = 'landed'
  const a5 = aiDecide(s, 'p1')
  check('AI 在江边持轮渡卡 → 用轮渡卡', a5?.type === 'USE_CARD')
  // 无适用操作
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].hand = [{ id: 'c6', type: 'reverse', name: '转向卡', desc: '', icon: '' }]
  s.phase = 'landed'
  const a6 = aiDecide(s, 'p1')
  check('AI 无适用操作 → 结束回合', a6?.type === 'END_TURN')
}

console.log('▶ reducer 能处理 Proxy（浏览器真实场景）')
{
  // 浏览器里 state.value 是 Vue reactive proxy，structuredClone 不能克隆 Proxy 会抛 DataCloneError
  // 修复后用 JSON 深拷贝，必须能处理 Proxy
  const proxy = new Proxy(createInitialState({ players: [{ id: 'p1', name: 'A', isAI: false }], maxTurns: 40, startMoney: 5000 }), {
    get(t, k) { return Reflect.get(t, k) },
    ownKeys(t) { return Reflect.ownKeys(t) },
  })
  let didThrow = false
  try {
    const s = gameReducer(proxy, { type: 'ROLL_DICE' })
    check('Reducer 不崩', !!s)
    check('掷骰后 phase=landed', s.phase === 'landed')
  } catch (e) { didThrow = true }
  check('不抛 DataCloneError', !didThrow)
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
if (fail > 0) process.exit(1)
console.log('SMOKE OK')

