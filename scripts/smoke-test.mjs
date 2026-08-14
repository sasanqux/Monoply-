// smoke-test.mjs — 冒烟：52 格图结构整局 + 分岔路口(暂停/续走/链式) + 轻轨 + 商圈 + 卡片/道具/载具
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
  aiChooseFork,
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

console.log('▶ 地图数据完整性（52 格图结构）')
{
  check('总格子数 = 52', TILES.length - 1 === 52)
  let ok = true
  for (let i = 1; i <= 52; i++) {
    const t = TILES[i]
    if (!t) { ok = false; break }
    if (!t.next || !TILES[t.next]) { ok = false; break }
    if (t.forks) for (const f of t.forks) if (!TILES[f]) { ok = false; break }
  }
  check('每格 next / forks 指向有效格子', ok)
  const starts = TILES.filter((t) => t && t.type === 'start')
  check('唯一起点 = 朝天门(id 1)', starts.length === 1 && starts[0].id === 1)
  const forks = TILES.filter((t) => t && t.forks && t.forks.length)
  console.log(`    起点 1 个 · 分岔路口 ${forks.length} 个：${forks.map((f) => f.name).join('、')}`)
}

console.log('▶ 整局跑通（3 AI · 52 格 · 40 回合）')
{
  let state = makeState([
    { id: 'p1', name: 'AI小蓝', isAI: true },
    { id: 'p2', name: 'AI小绿', isAI: true },
    { id: 'p3', name: 'AI小橙', isAI: true },
  ], 40)
  let steps = 0
  while (state.status === 'playing' && steps < 20000) {
    const cur = currentPlayer(state)
    const action = aiDecide(state, cur.id)
    state = gameReducer(state, action)
    steps++
  }
  check('游戏正常结束', state.status === 'finished' && steps < 20000)
  check('存活玩家现金不为负', state.players.every((p) => !p.alive || p.money >= 0))
  check('有胜者', !!state.winnerId)
  const metrosOwned = state.players.reduce((n, p) => n + p.properties.filter((i) => TILES[i].type === 'station').length, 0)
  const mallsOwned = state.players.reduce((n, p) => n + p.properties.filter((i) => TILES[i].type === 'mall').length, 0)
  console.log(`    轮数 ${state.round} · 步数 ${steps} · 轻轨站 ${metrosOwned} 个 · 商圈 ${mallsOwned} 处`)
}

console.log('▶ 过起点发工资（绕城回朝天门 +300）')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  a.pos = 49 // 解放碑（新拓扑：解放碑 next=1，是朝天门的前一格）
  a.money = 1000
  const before = a.money
  const r = movePlayer(s, a, 1, aiChooseFork, 49)
  check('走 1 步到达朝天门(id 1)', a.pos === 1 && r.paused === false)
  check('回到朝天门领取工资 +300', a.money === before + 300)
}

console.log('▶ 分岔路口：人类暂停 / AI 自动选路')
{
  const s = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  a.pos = 1 // 朝天门，forks=[50,49], next=2(弹子石)
  // 开局：从朝天门出发直接弹窗选洪崖洞/解放碑（不含弹子石），不直行外圈
  const r = movePlayer(s, a, 1, null, 1) // 人类 chooser=null → 暂停
  check('人类从朝天门(开局)出发分岔暂停', r.paused === true)
  check('朝天门分岔选项仅洪崖洞/解放碑(不含弹子石)', s.pending?.kind === 'fork' && s.pending.options.includes(50) && s.pending.options.includes(49) && !s.pending.options.includes(2))
  // AI 自动选路：走 tile.next
  const s2 = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const b = s2.players[0]
  b.pos = 1
  const r2 = movePlayer(s2, b, 1, (t, opts) => aiChooseFork(s2, b, t, opts), 1)
  check('AI 从朝天门(开局)出发不暂停（自动选洪崖洞/解放碑之一）', r2.paused === false && (b.pos === 50 || b.pos === 49))
}

console.log('▶ 分岔路口：CHOOSE_FORK 续走 + 链式分岔')
{
  // 石桥铺(13) 直行 14 / 分叉 51，剩余 3 步选直行 → 14→15→16 落点
  let s = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.phase = 'fork'
  s.pending = { kind: 'fork', tileId: 13, options: [14, 51], stepsLeft: 3, cameFrom: 13 }
  s.players[0].pos = 13
  s.players[0].walkPath = [13]
  s = gameReducer(s, { type: 'CHOOSE_FORK', tileId: 14 })
  check('选直行后继续走到 17（14→15→16→17）', s.players[0].pos === 17)
  check('续走后落地结算', s.phase === 'landed')

  // 三峡广场(43) 直行 44 / 分叉 17、18；选 17 后剩 3 步：17→18→19(磁器口 分岔) 再暂停
  s = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.phase = 'fork'
  s.pending = { kind: 'fork', tileId: 43, options: [17, 18], stepsLeft: 3, cameFrom: 43 }
  s.players[0].pos = 43
  s.players[0].walkPath = [43]
  s = gameReducer(s, { type: 'CHOOSE_FORK', tileId: 17 })
  check('链式分岔：走到磁器口(19)再次暂停', s.players[0].pos === 19 && s.phase === 'fork')
  check('链式分岔 pending 在磁器口', s.pending?.tileId === 19)
}

console.log('▶ 轻轨系统')
{
  let state = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = state.players[0]
  a.pos = 5 // 茶园（station）
  a.money = 2000
  state.pending = { kind: 'metro', tileId: 5 }
  state = gameReducer(state, { type: 'TRAVEL_METRO', targetTileId: 27 }) // 中央公园东
  check('乘轻轨传送到目标站', state.players[0].pos === 27)
  check('乘轻轨扣费 150', state.players[0].money === 1850)
  check('乘轻轨后 pending 清空', state.pending === null)
  state = gameReducer(state, { type: 'TRAVEL_METRO', targetTileId: 44 })
  check('无 pending 不能乘轻轨', state.players[0].pos === 27)
}

console.log('▶ 商圈组合')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  check('渝中核心未集齐', isGroupComplete(s, 'g1 渝中核心') === false)
  a.properties = [44, 45, 46, 47, 48, 49, 50]
  a.levels = { 44: 0, 45: 0, 46: 0, 47: 0, 48: 0, 49: 0, 50: 0 }
  check('集齐渝中核心(含洪崖洞共7格)', isGroupComplete(s, 'g1 渝中核心') === true)
}

console.log('▶ 卡片效果')
{
  let state = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  let a = state.players[0]
  a.money = 10000
  a.hand = [{ id: 'c2', type: 'buy', name: '购地卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c2', target: { tileId: 2 } }) // 弹子石
  a = state.players[0]
  check('购地卡买到弹子石', a.properties.includes(2))
  a.hand = [{ id: 'c6', type: 'frame', name: '陷害卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c6', target: { playerId: 'p2' } })
  check('陷害卡送人进监狱', state.players[1].jailLeft === 2)
}

console.log('▶ 即时卡（免费升级 / 逃狱卡）')
{
  let s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  let a = s.players[0]
  a.properties = [2]
  a.levels = { 2: 0 }
  a.hand = [{ id: 'n2', type: 'freeUpgrade', name: '免费升级', desc: '', icon: '' }]
  s = gameReducer(s, { type: 'USE_CARD', cardId: 'n2' })
  check('免费升级 弹子石→1级', s.players[0].levels[2] === 1)

  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  a = s.players[0]
  a.jailLeft = 2
  a.hand = [{ id: 'n3', type: 'escape', name: '逃狱卡', desc: '', icon: '' }]
  s = gameReducer(s, { type: 'USE_CARD', cardId: 'n3' })
  check('逃狱卡出狱', s.players[0].jailLeft === 0)
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
  state = gameReducer(state, { type: 'USE_ITEM', itemId: 'i1', tileId: 8 }) // 南坪
  check('放置路障成功', state.boardItems.length === 1)
  b = state.players[1]
  b.pos = 7
  b.money = 5000
  movePlayer(state, b, 2, null, 7) // 7→8 撞路障停下
  check('路障挡停在 8', b.pos === 8)
  check('路障被消耗', state.boardItems.length === 0)
  a = state.players[0]
  a.items = [{ id: 'i2', type: 'remoteDice', name: '遥控骰子', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_ITEM', itemId: 'i2', value: 6 })
  check('遥控骰子设定点数（走路 1 颗最大 6）', state.players[0].remoteDice === 6)
  a = state.players[0]
  a.items = [{ id: 'i2b', type: 'remoteDice', name: '遥控骰子', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_ITEM', itemId: 'i2b', value: 99 })
  check('遥控骰子越界 clamp（走路 1 颗 → 6）', state.players[0].remoteDice === 6)
  a = state.players[0]
  a.items = [{ id: 'i3', type: 'portal', name: '传送门', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_ITEM', itemId: 'i3', tileId: 33 }) // 江北城
  check('传送门传送成功', state.players[0].pos === 33)
  a = state.players[0]
  a.items = [{ id: 'i4', type: 'bomb', name: '定时炸弹', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_ITEM', itemId: 'i4', tileId: 10 }) // 巴南
  check('炸弹放置成功（引信 3）', state.boardItems.some((x) => x.type === 'bomb' && x.fuse === 3))
}

console.log('▶ 交通工具')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  check('初始走路 1 骰', VEHICLES.walk.dice === 1)
  check('飞机 5 骰', VEHICLES.plane.dice === 5)
  const s2 = { ...s, players: s.players.map((p) => ({ ...p, pos: 2 })) } // 放到非分岔格避免暂停
  const r2 = gameReducer(s2, { type: 'ROLL_DICE' })
  check('掷骰/落地结算不崩溃', r2.status === 'playing' || r2.status === 'finished')
}

console.log('▶ 转向卡反向移动（方向 bug 回归）')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  a.pos = 2 // 弹子石，新拓扑反向走 2→50(洪崖洞)→1（洪崖洞 next=2，解放碑 next=1，主环连续无分岔）
  a.direction = -1
  const r = movePlayer(s, a, 2, null, 2)
  check('反向移动 2 步到达 1', r.paused === false && a.pos === 1)
}

console.log('▶ AI 会用卡/道具/乘轻轨')
{
  // 拆除卡
  let s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].hand = [{ id: 'c2', type: 'demolish', name: '拆除卡', desc: '', icon: '' }]
  s.players[1].properties = [20] // 歌乐山
  s.players[1].levels = { 20: 2 }
  s.phase = 'landed'
  const a2 = aiDecide(s, 'p1')
  check('AI 持拆除卡且对手有楼 → 用拆除卡', a2?.type === 'USE_CARD' && a2?.target?.tileId === 20)
  // 放路障（放到自己地产前一格）
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].items = [{ id: 'i1', type: 'barrier', name: '路障', desc: '', icon: '' }]
  s.players[0].properties = [5] // 茶园
  s.players[0].levels = { 5: 2 }
  s.phase = 'landed'
  const a3 = aiDecide(s, 'p1')
  check('AI 有路障且有地产 → 放地产前一格(4)', a3?.type === 'USE_ITEM' && a3?.tileId === 4)
  // 乘轻轨
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].pos = 5
  s.players[0].money = 2000
  s.pending = { kind: 'metro', tileId: 5 }
  s.phase = 'landed'
  const a4 = aiDecide(s, 'p1')
  check('AI 在轻轨站有钱 → 乘轻轨', a4?.type === 'TRAVEL_METRO' && TILES[a4.targetTileId]?.type === 'station')
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

console.log('▶ 数值套用检查（自动套地价/租金）')
{
  check('解放碑(商圈) 价 2100 / 租 420', TILES[49].price === 2100 && TILES[49].rent === 420)
  check('朝天门 起点无价', TILES[1].type === 'start' && TILES[1].price == null)
  check('大渡口 普通地产 价 700 / 租 140', TILES[11].price === 700 && TILES[11].rent === 140)
  check('江北机场 价 1050（繁华）', TILES[29].price === 1050)
  check('轻轨站 价 1100 / 过路费 150', TILES[5].price === 1100 && TILES[5].metroFee === 150)
}

console.log('▶ reducer 能处理 Proxy（浏览器真实场景）')
{
  const proxy = new Proxy(createInitialState({ players: [{ id: 'p1', name: 'A', isAI: false }], maxTurns: 40, startMoney: 5000 }), {
    get(t, k) { return Reflect.get(t, k) },
    ownKeys(t) { return Reflect.ownKeys(t) },
  })
  proxy.players[0].pos = 2 // 放到非分岔格，避免人类在朝天门暂停
  let didThrow = false
  let s
  try {
    s = gameReducer(proxy, { type: 'ROLL_DICE' })
    check('Reducer 不崩', !!s)
    check('掷骰后 phase=landed', s.phase === 'landed')
  } catch (e) { didThrow = true; console.log('    error:', e.message) }
  check('不抛 DataCloneError', !didThrow)
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
if (fail > 0) process.exit(1)
console.log('SMOKE OK')
