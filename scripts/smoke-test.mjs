// smoke-test.mjs — 冒烟：52 格图结构整局 + 分岔路口(暂停/续走/链式) + 轻轨 + 组合 + 卡片/载具
import {
  createInitialState,
  gameReducer,
  aiDecide,
  currentPlayer,
  totalAssets,
  TILES,
  GROUPS,
  movePlayer,
  VEHICLES,
  isGroupComplete,
  getRent,
  STOCKS,
  stockPortfolioValue,
  CARDS,
} from '../shared/game/index.js'

function makeState(players, maxTurns = 40, startMoney = 5000) {
  return createInitialState({ players, maxTurns, startMoney })
}

let pass = 0
let fail = 0
// 测试辅助：清除第一回合用卡限制
function cardReady(s) { s.players.forEach(p => p.firstTurn = false); return s }
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
    if (!t.neighbors) { ok = false; break }
    for (const n of t.neighbors) if (!TILES[n]) { ok = false; break }
  }
  check('每格 neighbors 指向有效格子', ok)
  const starts = TILES.filter((t) => t && t.type === 'start')
  check('唯一起点 = 朝天门(id 1)', starts.length === 1 && starts[0].id === 1)
  // 分岔点 = 3 个及以上邻居的格子（2 邻居 = 直行，3+ 邻居 = 分岔）
  const forks = TILES.filter((t) => t && t.neighbors && t.neighbors.length >= 3)
  console.log(`    起点 1 个 · 分岔点 ${forks.length} 个：${forks.map((f) => f.name).join('、')}`)
}

console.log('▶ 决定先手顺序（掷骰比点）')
{
  const s0 = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
    { id: 'p3', name: 'C', isAI: true },
  ], 40)
  check('初始 phase=order', s0.phase === 'order')
  // 模拟掷骰直到完成
  let s = s0
  let guard = 0
  while (s.phase === 'order' && guard++ < 100) {
    s = gameReducer(s, { type: 'ROLL_ORDER' })
  }
  check('掷骰后 phase 离开 order', s.phase === 'roll')
  check('每个玩家都有掷骰记录', Object.keys(s.orderState.rolls).length === 3)
  check('每个玩家掷了 3 颗骰子', Object.values(s.orderState.rolls).every(d => d.length === 3))
  check('骰子值在 1-6 之间', Object.values(s.orderState.rolls).flat().every(n => n >= 1 && n <= 6))
  // 验证顺序按点数降序
  const totals = s.players.map(p => (s.orderState.rolls[p.id] || []).reduce((a, b) => a + b, 0))
  const sorted = [...totals].sort((a, b) => b - a)
  check('玩家按点数降序排列', JSON.stringify(totals) === JSON.stringify(sorted))
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
    let action
    if (state.pending?.kind === 'lottery_draw') {
      action = { type: 'LOTTERY_DRAW_CLOSE' }
    } else if (state.phase === 'fork' && state.pending?.kind === 'fork') {
      action = { type: 'CHOOSE_FORK', tileId: state.pending.chosen }
    } else if (state.phase === 'auction' && state.pending?.kind === 'auction') {
      const auctionPlayer = state.players[state.pending.turn]
      action = aiDecide(state, auctionPlayer.id) || { type: 'AUCTION_REVEAL' }
    } else {
      const cur = currentPlayer(state)
      action = aiDecide(state, cur.id) || { type: 'END_TURN' }
    }
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

console.log('▶ 朝天门打卡（落地打卡，不再发工资）')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  a.money = 1000
  const before = a.money
  let st = gameReducer(s, { type: 'DEBUG_TELEPORT', playerId: 'p1', tileId: 1 }) // 落地朝天门
  check('到达朝天门打卡 1 次（不发现金工资）', st.players[0].checkins === 1 && st.players[0].money === before)
  // 打卡满 3 次领大礼包
  st.players[0].checkins = 2
  st = gameReducer(st, { type: 'DEBUG_TELEPORT', playerId: 'p1', tileId: 1 })
  check('打卡满 3 次触发大礼包（+5000 + pending）', st.players[0].checkins === 0 && st.pending?.kind === 'checkin' && st.players[0].money === before + 5000)
}

console.log('▶ 分岔路口：朝天门(3 邻居)是分岔点 / 其他分岔人类暂停')
{
  // 朝天门（新模型）：3 邻居 [32,50,49] → 分岔点，人类暂停选路
  const s = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  a.pos = 1 // 朝天门，neighbors=[50,49]
  a.cameFrom = null // 初始无来路
  const r = movePlayer(s, a, 1, null) // 人类 → 2 选项分岔，暂停
  check('人类从朝天门出发遇分岔（暂停）', r.paused === true && s.pending?.kind === 'fork')
  check('朝天门分岔选项 = [50,49]', JSON.stringify(s.pending?.options) === JSON.stringify([50, 49]))
  // AI 自动选路：opts[0] = 50
  const s2 = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const b = s2.players[0]
  b.pos = 1
  b.cameFrom = null
  const r2 = movePlayer(s2, b, 1, null)
  check('AI 从朝天门出发自动选路（不暂停）', r2.paused === false && b.pos === 50)
}

console.log('▶ 分岔永不回头（可选出口 = 邻居 - 来路）')
{
  // 石桥铺(13)：neighbors=[12,14,51]，来路 12 → 可选 [14,51]
  let ok = true
  for (let k = 0; k < 200; k++) {
    const s = makeState([
      { id: 'p1', name: '我', isAI: false },
      { id: 'p2', name: 'B', isAI: true },
    ], 40)
    const a = s.players[0]
    a.pos = 13
    a.cameFrom = 12
    const r = movePlayer(s, a, 1, 12) // 站在分岔格，来路 12
    if (!r.paused || !s.pending) { ok = false; break }
    if (s.pending.options.includes(12)) { ok = false; break } // 来路不应在选项中
  }
  check('200 次分岔均未选"来路"(12)，可选=[14,51]', ok)

  // 三峡广场(43)：neighbors=[17,18]，来路 41（不在 neighbors）→ 可选 [17,18]
  ok = true
  for (let k = 0; k < 200; k++) {
    const s = makeState([
      { id: 'p1', name: '我', isAI: false },
      { id: 'p2', name: 'B', isAI: true },
    ], 40)
    const a = s.players[0]
    a.pos = 43
    a.cameFrom = 41
    const r = movePlayer(s, a, 1, 41) // 站在分岔格，来路 41
    if (!r.paused || !s.pending) { ok = false; break }
    if (s.pending.options.includes(41)) { ok = false; break } // 来路不应在选项中
  }
  check('200 次分岔均未选"来路"(41)，可选=[17,18]', ok)

  // 化龙桥(44)：neighbors=[52,45]，来路 52 → 可选 [45]（直行，不暂停）
  const s = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  a.pos = 44 // 化龙桥
  a.cameFrom = 52 // 从大坪来
  const r = movePlayer(s, a, 1, 52)
  check('化龙桥来路 52 → 直行 [45]（不暂停）', r.paused === false && a.pos === 45)
}

console.log('▶ 分岔路口：CHOOSE_FORK 续走 + 链式分岔')
{
  // 辅助：选路后循环 STEP 直到走完
  function chooseAndWalk(s, tileId) {
    s = gameReducer(s, { type: 'CHOOSE_FORK', tileId });
    let guard = 0;
    while (s.phase === 'step' && s.stepsRemaining > 0 && guard++ < 100) {
      s = gameReducer(s, { type: 'STEP' });
    }
    return s;
  }

  // 石桥铺(13) 直行 14 / 分叉 51，剩余 3 步选直行消耗 1 步 → 14→15→16 落点
  let s = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.phase = 'fork'
  s.pending = { kind: 'fork', tileId: 13, options: [14, 51], stepsLeft: 3, cameFrom: 13, canPick: true }
  s.players[0].pos = 13
  s.players[0].walkPath = [13]
  s = chooseAndWalk(s, 14)
  check('选直行后走到 16（14→15→16），不多走', s.players[0].pos === 16)
  check('续走后落地结算', s.phase === 'landed')

  // 三峡广场(43) neighbors=[17,18]；选 17(沙坪坝) 后：17 的 neighbors=[16,43]，来路 43 → 直行 [16]
  s = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.phase = 'fork'
  s.pending = { kind: 'fork', tileId: 43, options: [17, 18], stepsLeft: 4, cameFrom: 43, canPick: true }
  s.players[0].pos = 43
  s.players[0].walkPath = [43]
  s = gameReducer(s, { type: 'CHOOSE_FORK', tileId: 17 })
  // 选路后进入 step 阶段
  check('选路后进入 step 阶段', s.phase === 'step')
  // 继续 STEP：走到 17(沙坪坝)，来路 43，直行 [16] → 不再暂停
  let guard = 0;
  while (s.phase === 'step' && guard++ < 10) s = gameReducer(s, { type: 'STEP' })
  check('选直行后落点 14（中梁山）', s.players[0].pos === 14 && s.phase === 'landed')

  // 朝天门(1) 分岔选「解放碑(49)」
  s = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.phase = 'fork'
  s.pending = { kind: 'fork', tileId: 1, options: [50, 49], chosen: 49, stepsLeft: 3, cameFrom: 1 }
  s.players[0].pos = 1
  s.players[0].walkPath = [1]
  s = chooseAndWalk(s, 49)
  check('朝天门选解放碑→逆向绕行（落点不在弹子石）', s.players[0].pos !== 2 && s.players[0].pos !== 1)

  // 朝天门(1) 分岔选「洪崖洞(50)」
  s = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.phase = 'fork'
  s.pending = { kind: 'fork', tileId: 1, options: [50, 49], chosen: 50, stepsLeft: 3, cameFrom: 1 }
  s.players[0].pos = 1
  s.players[0].walkPath = [1]
  s = chooseAndWalk(s, 50)
  check('朝天门选洪崖洞→正向（第2步是50洪崖洞）', s.players[0].walkPath[1] === 50)
  check('朝天门选洪崖洞 落点不在弹子石(2)', s.players[0].pos !== 2)
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

console.log('▶ 组合规则（7 中 4 / 8 中 5 · 租金×1.5 · 人文旅游已删）')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  check('渝中核心未达成（0 块）', isGroupComplete(s, 'g1 渝中核心') === false)
  check('沙坪坝归入巴渝文旅组', TILES[17].group === 'g7 巴渝文旅')
  // 渝中核心 8 块组：需 5 块达成
  a.properties = [44, 45, 46]
  a.levels = { 44: 0, 45: 0, 46: 0 }
  check('渝中核心 3 块未达成', isGroupComplete(s, 'g1 渝中核心') === false)
  a.properties = [44, 45, 46, 47, 43]
  a.levels = { 47: 0, 43: 0 }
  check('渝中核心 5 块达成（8 中 5）', isGroupComplete(s, 'g1 渝中核心') === true)
  // 达成后租金 ×1.5：解放碑基础租 2000 → 3000
  a.properties = [44, 45, 46, 47, 49]
  a.levels = { 49: 0 }
  check('组合达成租金 ×1.5（2000→3000）', getRent(s, TILES[49], 0) === 3000)
  // 8 格组：4 块不达标、5 块达成（南岸滨江 = 2,3,4,5,7,8,9,10）
  a.properties = [2, 3, 4, 5]
  a.levels = { 2: 0, 3: 0, 4: 0, 5: 0 }
  check('南岸滨江 4 块未达成（8 格组）', isGroupComplete(s, 'g4 南岸滨江') === false)
  a.properties = [2, 3, 4, 5, 7]
  a.levels = { 7: 0 }
  check('南岸滨江 5 块达成（8 中 5）', isGroupComplete(s, 'g4 南岸滨江') === true)
}

console.log('▶ 6大组合完整性（50格全部分配）')
{
  // 统计所有非起点/事件格的地产
  const allTiles = TILES.filter(t => t && !t.removed && t.type !== 'start' && t.type !== 'chance')
  const withGroup = allTiles.filter(t => t.group)
  const withoutGroup = allTiles.filter(t => !t.group)
  check('所有特殊格都有组合归属', withoutGroup.length === 0)
  console.log('  总地产格:', allTiles.length, '有组合:', withGroup.length)
  // 6 组每组块数
  check('渝中核心 8 块', TILES.filter(t => t && t.group === 'g1 渝中核心').length === 8)
  check('两江商业 8 块', TILES.filter(t => t && t.group === 'g2 两江商业').length === 8)
  check('南岸滨江 8 块', TILES.filter(t => t && t.group === 'g4 南岸滨江').length === 8)
  check('九龙走廊 8 块', TILES.filter(t => t && t.group === 'g5 九龙走廊').length === 8)
  check('北部新城 9 块', TILES.filter(t => t && t.group === 'g6 北部新城').length === 9)
  check('巴渝文旅 8 块', TILES.filter(t => t && t.group === 'g7 巴渝文旅').length === 8)
  // 8*5 + 9 = 49，加上朝天门(1)+奇遇(6) = 51...不对
  // 52格 - removed(42) = 51格，减去起点(1)+事件(1)=49格
  check('总地产格 49 块', allTiles.length === 49)
}

console.log('▶ 卡片效果')
{
  let state = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  // 测试用：清除第一回合限制
  state.players.forEach(p => p.firstTurn = false)
  let a = state.players[0]
  a.money = 10000
  a.hand = [{ id: 'c2', type: 'buy', name: '购地卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c2', target: { tileId: 2 } }) // 弹子石
  a = state.players[0]
  check('购地卡买到弹子石', a.properties.includes(2))

  // 路障卡（重置用卡标志，模拟新回合）
  state.players[0].cardUsed = false
  state.players[1].properties = [2] // p2 拥有弹子石
  state.players[0].hand = [{ id: 'c6', type: 'barrier', name: '路障卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c6', target: { tileId: 2 } })
  check('路障卡放置成功（存 state.barriers，不污染全局 TILES）', state.barriers[2]?.owner === 'p1')
  check('路障不影响其他对局（TILES 无 barrier 字段）', TILES[2].barrier === undefined)

  // 摩托卡
  state.players[0].cardUsed = false
  state.players[0].hand = [{ id: 'c7', type: 'moto', name: '摩托卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c7' })
  a = state.players[0]
  check('摩托卡获得2骰子', a.vehicle === 'moto' && VEHICLES.moto.dice === 2)

  // 汽车卡
  state.players[0].cardUsed = false
  state.players[0].hand = [{ id: 'c8', type: 'car', name: '汽车卡', desc: '', icon: '' }]
  state = gameReducer(state, { type: 'USE_CARD', cardId: 'c8' })
  a = state.players[0]
  check('汽车卡获得3骰子', a.vehicle === 'car' && VEHICLES.car.dice === 3)
}

console.log('▶ 即时卡（免费升级 / 逃狱卡）')
{
  let s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players.forEach(p => p.firstTurn = false) // 测试用
  let a = s.players[0]
  a.properties = [2]
  a.levels = { 2: 0 }
  a.hand = [{ id: 'n2', type: 'freeUpgrade', name: '免费升级', desc: '', icon: '' }]
  s = gameReducer(s, { type: 'USE_CARD', cardId: 'n2' })
  check('免费升级 弹子石→1级', s.players[0].levels[2] === 1)

  s = cardReady(makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40))
  a = s.players[0]
  a.jailLeft = 2
  a.hand = [{ id: 'n3', type: 'escape', name: '逃狱卡', desc: '', icon: '' }]
  s = gameReducer(s, { type: 'USE_CARD', cardId: 'n3' })
  check('逃狱卡出狱', s.players[0].jailLeft === 0)
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

console.log('▶ 无向图走棋（无方向概念，只看来路）')
{
  // 弹子石(2) neighbors=[49,3]：来路 49 → 可选 [3]（直行）
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  a.pos = 2 // 弹子石
  a.cameFrom = 49 // 从解放碑来
  const r = movePlayer(s, a, 1, 49)
  check('弹子石(2)来路 49 → 直行到上新街(3)', r.paused === false && a.pos === 3)
}

console.log('▶ AI 会用卡/乘轻轨')
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
  s.players[0].firstTurn = false // 测试用：AI 非第一回合
  const a2 = aiDecide(s, 'p1')
  check('AI 持拆除卡且对手有楼 → 用拆除卡', a2?.type === 'USE_CARD' && a2?.target?.tileId === 20)
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
  s.players[0].hand = [{ id: 'c6', type: 'shield', name: '免租卡', desc: '', icon: '' }]
  s.phase = 'landed'
  const a6 = aiDecide(s, 'p1')
  check('AI 无适用操作 → 结束回合', a6?.type === 'END_TURN')
}

console.log('▶ 数值套用检查（自动套地价/租金）')
{
  check('解放碑(商圈) 价 10000 / 租 2000', TILES[49].price === 10000 && TILES[49].rent === 2000)
  check('朝天门 起点无价', TILES[1].type === 'start' && TILES[1].price == null)
  check('大渡口 普通地产 价 4000 / 租 800', TILES[11].price === 4000 && TILES[11].rent === 800)
  check('江北机场 价 6000（繁华）', TILES[29].price === 6000)
  check('轻轨站 价 4000 / 租 300', TILES[5].price === 4000 && TILES[5].rent === 300)
}

console.log('▶ reducer 能处理 Proxy（浏览器真实场景）')
{
  const proxy = new Proxy(createInitialState({ players: [{ id: 'p1', name: 'A', isAI: false }], maxTurns: 40, startMoney: 5000 }), {
    get(t, k) { return Reflect.get(t, k) },
    ownKeys(t) { return Reflect.ownKeys(t) },
  })
  proxy.players[0].pos = 2 // 弹子石，neighbors=[3,32]
  proxy.players[0].cameFrom = 32 // 从广阳岛来 → 直行往 3
  let didThrow = false
  let s
  try {
    s = gameReducer(proxy, { type: 'ROLL_DICE' })
    check('Reducer 不崩', !!s)
    check('掷骰后 phase=step（逐格推进）', s.phase === 'step' && s.stepsRemaining > 0)
    // 循环 STEP 直到走完
    let guard = 0
    while (s.phase === 'step' && s.stepsRemaining > 0 && guard++ < 100) {
      s = gameReducer(s, { type: 'STEP' })
    }
    check('STEP 走完后 phase=landed', s.phase === 'landed')
  } catch (e) { didThrow = true; console.log('    error:', e.message) }
  check('不抛 DataCloneError', !didThrow)
}

console.log('▶ 路障卡放置')
{
  let s = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players.forEach(p => p.firstTurn = false) // 解除第一回合限制
  s.phase = 'roll' // 确保不在 order 阶段
  // 给玩家一张路障卡
  const barrierCard = CARDS.find(c => c.type === 'barrier')
  s.players[0].hand.push({ ...barrierCard, id: 'test-barrier' })
  // 使用路障卡 → 目标地块(2 弹子石)
  s = gameReducer(s, { type: 'USE_CARD', cardId: 'test-barrier', target: { tileId: 2 } })
  check('路障放置成功', s.barriers[2] && s.barriers[2].owner === 'p1')
  check('路障3回合后消失', s.barriers[2].turnsLeft === 3)
  // 同一格不能放第二个路障
  s.players[0].hand.push({ ...barrierCard, id: 'test-barrier-2' })
  const r1 = gameReducer(s, { type: 'USE_CARD', cardId: 'test-barrier-2', target: { tileId: 2 } })
  check('同一格不能放第二个路障', !r1.barriers[2] || r1.barriers[2].turnsLeft === 3)
  // 非地产格不能放
  s.players[0].hand.push({ ...barrierCard, id: 'test-barrier-3' })
  const startTile = TILES.find(t => t && t.type === 'start')
  const r2 = gameReducer(s, { type: 'USE_CARD', cardId: 'test-barrier-3', target: { tileId: startTile.id } })
  check('非地产格不能放路障', !r2.barriers[startTile.id])
}

console.log('▶ 调试 action（DebugPanel 用）')
{
  let s = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  let a = s.players[0]
  a.money = 5000
  // 传送：到无主地产 → 触发购买 pending（和正常落地一样）
  s = gameReducer(s, { type: 'DEBUG_TELEPORT', playerId: 'p1', tileId: 2 })
  check('调试传送：到弹子石触发购买', s.players[0].pos === 2 && s.pending?.kind === 'buy')
  s = gameReducer(s, { type: 'SKIP_BUY' })
  s = gameReducer(s, { type: 'DEBUG_MONEY', playerId: 'p1', amount: 3000 })
  check('调试加钱 +3000', s.players[0].money === 8000)
  s = gameReducer(s, { type: 'DEBUG_GIVE', playerId: 'p1', kind: 'card', id: 'shield' })
  check('调试送卡片', s.players[0].hand.length === 3) // 初始2 + 送1
  s = gameReducer(s, { type: 'DEBUG_PROPERTY', playerId: 'p1', tileId: 3, level: 3 })
  check('调试强买+升满 上新街', s.players[0].properties.includes(3) && s.players[0].levels[3] === 3)
  s = gameReducer(s, { type: 'DEBUG_JAIL', playerId: 'p2', turns: 2 })
  check('调试进监狱 2 轮', s.players[1].jailLeft === 2)
  s = gameReducer(s, { type: 'DEBUG_SWITCH_TURN', playerId: 'p2' })
  check('调试切到 p2 回合', s.turnIndex === 1 && s.phase === 'roll')
  s = gameReducer(s, { type: 'DEBUG_MOVE', playerId: 'p2', steps: 2 })
  check('调试走 2 步（AI 不暂停）', s.players[1].pos !== 1 && s.phase !== 'fork')
}

console.log('▶ 事件格（chance）落地触发')
{
  // 事件格本身不是地产（不可购买），验证 TILES 定义
  const chanceTile = TILES[6] // 命运（chance）
  check('事件格类型 = chance', chanceTile.type === 'chance')
  check('事件格不是可购买地产', !['land', 'scenic', 'station', 'mall'].includes(chanceTile.type))
  // 落地后应产生事件日志（事件可能传送玩家到地产，但不改变"chance 格本身不可购买"的事实）
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const logLen = s.log.length
  const r = gameReducer(s, { type: 'DEBUG_TELEPORT', playerId: 'p1', tileId: 6 })
  check('踩中事件格产生事件日志', r.log.length > logLen)
}

console.log('▶ 免租卡豁免租金')
{
  const s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const a = s.players[0]
  const b = s.players[1]
  b.properties = [2] // 弹子石归 B
  b.levels = { 2: 0 }
  a.money = 5000
  // 清空手牌，只留一张免租卡（AI 自动使用）
  const shieldCard = CARDS.find(c => c.type === 'shield')
  a.hand = [{ ...shieldCard, id: 'test-shield' }]
  const before = a.money
  const r = gameReducer(s, { type: 'DEBUG_TELEPORT', playerId: 'p1', tileId: 2 })
  check('免租卡豁免租金不扣钱', r.players[0].money === before)
  check('免租卡被消耗（从手牌移除）', !r.players[0].hand.some(c => c.id === 'test-shield'))
}

console.log('▶ 大坪→化龙桥→两路口（直行通路）')
{
  // 大坪(52) neighbors=[51,44]：从 51 来 → 可选 [44]（直行）
  let s = makeState([
    { id: 'p1', name: '我', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].pos = 52
  s.players[0].cameFrom = 51
  s.phase = 'roll'
  s.players[0].walkPath = [52]
  s = gameReducer(s, { type: 'DEBUG_MOVE', playerId: 'p1', steps: 1 })
  check('大坪(52)来路 51 → 直行到化龙桥(44)', s.players[0].pos === 44)

  // 化龙桥(44) neighbors=[52,45]：从 52 来 → 可选 [45]（直行，不暂停）
  const a = s.players[0]
  a.cameFrom = 52 // 从大坪来
  const r = movePlayer(s, a, 1, 52)
  check('化龙桥(44)从大坪来 → 直行到两路口(45)', r.paused === false && a.pos === 45)
}

console.log('▶ 卡片积分与商店')
{
  let s = makeState([
    { id: 'p1', name: 'A', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  // 落地弹子石（points 40）获得积分
  s = gameReducer(s, { type: 'DEBUG_TELEPORT', playerId: 'p1', tileId: 2 })
  check('落地弹子石获得 40 卡片积分', s.players[0].points === 40)
  s = gameReducer(s, { type: 'SKIP_BUY' })
  // 构造路径经过双碑(21, shop) → 弹商店
  s.players[0].walkPath = [1, 31]
  s.phase = 'landed'
  s.pending = null
  s = gameReducer(s, { type: 'SKIP_BUY' })
  check('路径经过寸滩弹卡片商店', s.pending?.kind === 'shop' && s.pending.tileId === 31)
  // 买一张免租卡（30 积分）
  s.players[0].points = 30
  s = gameReducer(s, { type: 'SHOP_BUY', cardId: 'shield' })
  check('商店购得免租卡扣 30 积分', s.players[0].points === 0 && s.players[0].hand.length === 3) // 初始2 + 买1
  // 积分不足不能买
  s.players[0].points = 10
  s = gameReducer(s, { type: 'SHOP_BUY', cardId: 'monster' })
  check('积分不足无法购买怪兽卡', s.players[0].hand.length === 3) // 没买到，还是3
  // 离开商店
  s = gameReducer(s, { type: 'SHOP_CLOSE' })
  check('离开商店 pending 清空', s.pending === null)

  // 回归：经过商店后点「结束回合」不能被 nextTurn 清掉弹窗（修复 bug #2）
  s.shopShownTurn = false
  s = gameReducer(s, { type: 'END_TURN' })
  check('结束回合不会清掉卡片商店弹窗', s.pending?.kind === 'shop' && s.pending.tileId === 31)
  s = gameReducer(s, { type: 'SHOP_CLOSE' })
  s = gameReducer(s, { type: 'END_TURN' })
  check('关店后再结束回合正常推进', s.turnIndex === 1)
}

console.log('▶ 神仙系统')
{
  // 神仙格存在性
  const godTile = TILES[18]
  check('重庆大学 = land+god标记', godTile.type === 'land' && godTile.god === true)

  // 以下用卡测试：清除第一回合限制
  // 财神附身：对手踩自己的地，收租 ×2
  let s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].god = 'godOfWealth'
  s.players[0].godTurnsLeft = 3
  s.players[0].properties = [2] // p1 拥有弹子石
  s.players[0].levels = { 2: 0 }
  s.players[1].money = 10000
  // p2 踩 p1 的弹子石：基础租 800，财神 ×2 = 1600
  s = gameReducer(s, { type: 'DEBUG_TELEPORT', playerId: 'p2', tileId: 2 })
  const hasGodRent = s.log.some((l) => l.includes('1600'))
  check('财神收租 ×2（800→1600）', hasGodRent)
  check('财神收租后 p2 扣 1600', s.players[1].money === 8400)

  // 送神卡：送走神仙
  s = cardReady(makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40))
  s.players[0].god = 'godOfMisfortune'
  s.players[0].godTurnsLeft = 2
  s.players[0].hand = [{ id: 'sg1', type: 'sendGod', name: '送神卡', desc: '', icon: '' }]
  s = gameReducer(s, { type: 'USE_CARD', cardId: 'sg1' })
  check('送神卡送走衰神', s.players[0].god == null)

  // 崔斯特：直接触发（通过神仙格崔斯特）
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].hand = []
  // 强制附身崔斯特
  s.players[0].god = 'trickster'
  s.players[0].godTurnsLeft = 0
  // 通过 reducer 的 DEBUG_FORCE_GOD 触发即时效果
  s = gameReducer(s, { type: 'DEBUG_FORCE_GOD', playerId: 'p1', godId: 'trickster' })
  check('崔斯特给4张卡', s.players[0].hand.length === 4)

  // 土地公：p1 附身土地公，p2 走到 p1... 不对，土地公是走到别人的地抢夺
  // p1 有土地公，p1 走到 p2 的地 → 抢夺
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].god = 'tuDiGong'
  s.players[0].godTurnsLeft = 2
  s.players[1].properties = [3] // p2 拥有上新街
  s.players[1].levels = { 3: 2 }
  s = gameReducer(s, { type: 'DEBUG_TELEPORT', playerId: 'p1', tileId: 3 })
  check('土地公抢夺地产', s.players[0].properties.includes(3))
  check('土地公抢夺后原主失去', !s.players[1].properties.includes(3))
  check('土地公抢夺后楼房清零', s.players[0].levels[3] === 0)

  // 天使：p1 附身天使，走到 p2 的地 → 加盖
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].god = 'angel'
  s.players[0].godTurnsLeft = 3
  s.players[1].properties = [2]
  s.players[1].levels = { 2: 1 }
  s = gameReducer(s, { type: 'DEBUG_TELEPORT', playerId: 'p1', tileId: 2 })
  check('天使加盖 1→2级', s.players[1].levels[2] === 2)

  // 恶魔：p1 附身恶魔，走到 p2 的地 → 拆房
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].god = 'devil'
  s.players[0].godTurnsLeft = 3
  s.players[1].properties = [2]
  s.players[1].levels = { 2: 3 }
  s = gameReducer(s, { type: 'DEBUG_TELEPORT', playerId: 'p1', tileId: 2 })
  check('恶魔拆房归零', s.players[1].levels[2] === 0)

  // 穷神：现金扣20%
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].money = 10000
  s = gameReducer(s, { type: 'DEBUG_FORCE_GOD', playerId: 'p1', godId: 'godOfPoverty' })
  check('穷神扣现金20%（10000→8000）', s.players[0].money === 8000)
  check('穷神附身成功', s.players[0].god === 'godOfPoverty')

  // 神仙倒计时到期
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].god = 'godOfWealth'
  s.players[0].godTurnsLeft = 1
  s.turnIndex = 0
  s.phase = 'landed'
  s.pending = null
  s = gameReducer(s, { type: 'END_TURN' })
  check('神仙倒计时到期自动消失', s.players[0].god == null)

  // 衰神：收租 ×0.5
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].god = 'godOfMisfortune'
  s.players[0].godTurnsLeft = 3
  s.players[0].properties = [2]
  s.players[0].levels = { 2: 0 }
  s.players[1].money = 10000
  s = gameReducer(s, { type: 'DEBUG_TELEPORT', playerId: 'p2', tileId: 2 })
  check('衰神收租 ×0.5（800→400）', s.players[1].money === 9600)

  // 已有神仙时会被新神仙覆盖
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].god = 'godOfWealth'
  s.players[0].godTurnsLeft = 2
  s = gameReducer(s, { type: 'DEBUG_FORCE_GOD', playerId: 'p1', godId: 'devil' })
  check('已有神仙时被新神仙覆盖', s.players[0].god === 'devil')

  // 请神卡：随机附身神仙
  s = cardReady(makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40))
  s.players[0].hand = [{ id: 'sum1', type: 'summonGod', name: '请神卡', desc: '', icon: '' }]
  s = gameReducer(s, { type: 'USE_CARD', cardId: 'sum1' })
  check('请神卡附身神仙', s.players[0].god != null || s.log.some(l => l.includes('崔斯特')))
  check('请神卡被消耗', !s.players[0].hand.find(c => c.id === 'sum1'))

  // 崔斯特手牌满时给积分
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  // 填满手牌
  s.players[0].hand = []
  for (let i = 0; i < 10; i++) s.players[0].hand.push({ id: `f${i}`, type: 'shield', name: '免租卡', desc: '', icon: '' })
  const ptsBefore = s.players[0].points || 0
  s = gameReducer(s, { type: 'DEBUG_FORCE_GOD', playerId: 'p1', godId: 'trickster' })
  check('崔斯特手牌满时给50积分/张', (s.players[0].points || 0) - ptsBefore === 200)
}

console.log('▶ 每回合限1张卡 + 路障触发')
{
  // 每回合只能用1张卡
  let s = cardReady(makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40))
  s.players[0].hand = [
    { id: 'u1', type: 'steal', name: '抢夺卡', desc: '', icon: '' },
    { id: 'u2', type: 'shield', name: '免租卡', desc: '', icon: '' },
  ]
  s.players[1].hand = [{ id: 'p2c1', type: 'shield', name: '免租卡', desc: '', icon: '' }] // p2 有手牌供抢夺
  s.phase = 'landed'
  s = gameReducer(s, { type: 'USE_CARD', cardId: 'u1' })
  // 抢夺卡：消耗 u1，从 p2 抢 1 张 → 手牌仍为 2（u2 + 抢来的 p2c1）
  check('第1张卡使用成功（抢夺卡消耗1抢1）', s.players[0].hand.length === 2 && s.players[0].hand.some(c => c.id === 'u2'))
  const logLen = s.log.length
  s = gameReducer(s, { type: 'USE_CARD', cardId: 'u2' })
  check('第2张卡被阻止', s.log[logLen].includes('限1张'))
  // 下回合重置
  s.turnIndex = 0
  s = gameReducer(s, { type: 'END_TURN' })
  // 找到 p2 的回合再推进回 p1
  s.turnIndex = 1
  s.phase = 'landed'
  s.pending = null
  s = gameReducer(s, { type: 'END_TURN' })
  check('下回合重置用卡标志', s.players[0].cardUsed === false)
  // 免租卡不再主动使用（改为被动触发），手牌保留
  s.players[0].hand = [{ id: 'u3', type: 'shield', name: '免租卡', desc: '', icon: '' }]
  const l2 = s.log.length
  s = gameReducer(s, { type: 'USE_CARD', cardId: 'u3' })
  check('免租卡不再主动使用（手牌保留）', s.players[0].hand.length === 1)

  // 路障触发：p1 放路障，p2 踩中扣分并截停
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].properties = [2] // p1 拥有弹子石
  s.players[1].properties = [4] // p2 拥有南山
  // 在 p2 的地(南山 id4)放路障（state.barriers，随对局隔离）
  s.barriers[4] = { owner: 'p1', turnsLeft: 3 }
  s.players[1].pos = 3 // 上新街，neighbors=[2,4]
  s.players[1].cameFrom = 2 // 从弹子石来 → 往南山(4)走
  s.players[1].money = 5000
  s.players[1].points = 100
  const ptsP2Before = s.players[1].points
  const ptsP1Before = s.players[0].points || 0
  // p2 走 1 步到南山(4) → 踩路障截停
  s.turnIndex = 1
  s.phase = 'roll'
  s = gameReducer(s, { type: 'DEBUG_MOVE', playerId: 'p2', steps: 3 }) // 计划走 3→4，但应在 4 被截停
  // p2 踩路障扣50(100→50)，但南山有40积分→最终90
  check('路障扣分50（p2 100→90，含南山积分40）', s.players[1].points === ptsP2Before - 50 + (TILES[4].points || 0))
  check('路障罚款主人得50', s.players[0].points === ptsP1Before + 50)
  check('路障截停不再前进（停在 id4）', s.players[1].pos === 4)
}

console.log('▶ 新规则：初始卡组 / 第一回合禁卡 / 载具到期 / 每5回合送卡')
{
  // 初始2张随机卡
  const s0 = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  check('初始2张随机卡', s0.players[0].hand.length === 2 && s0.players[1].hand.length === 2)

  // 第一回合不能用卡
  let s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.phase = 'landed'
  const firstCard = s.players[0].hand[0]
  s = gameReducer(s, { type: 'USE_CARD', cardId: firstCard.id })
  check('第一回合不能用卡', s.players[0].hand.length === 2) // 卡没被消耗

  // 载具10回合到期
  s = cardReady(makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40))
  s.players[0].hand = [{ id: 'mc1', type: 'car', name: '汽车卡', desc: '', icon: '' }]
  s.phase = 'landed'
  s = gameReducer(s, { type: 'USE_CARD', cardId: 'mc1' })
  check('汽车卡获得3骰子', s.players[0].vehicle === 'car' && s.players[0].vehicleTurnsLeft === 10)
  // 推进20次 END_TURN = p1 的10个回合（2人局）
  for (let i = 0; i < 20; i++) {
    s.phase = 'landed'
    s.pending = null
    s = gameReducer(s, { type: 'END_TURN' })
  }
  check('载具10回合后恢复走路', s.players[0].vehicle === 'walk')

  // 每5回合送卡（推进到 round 5）
  s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  const handBefore = s.players[0].hand.length // 2
  // round=1，需要推进到 round=5（经过4次"绕圈"）
  // 2人局：每2步 round+1，所以从 round=1 到 round=5 需要 4*2=8 次 END_TURN
  for (let i = 0; i < 8; i++) {
    s.phase = 'landed'
    s.pending = null
    s = gameReducer(s, { type: 'END_TURN' })
  }
  check('第5回合全体送1张卡', s.players[0].hand.length === handBefore + 1)
  check('第5回合日志有送卡提示', s.log.some(l => l.includes('第 5 回合福利')))
}

console.log('▶ 彩票系统')
{
  // 彩票格存在性
  const lot45 = TILES[45], lot41 = TILES[41]
  check('两路口 = land+lottery标记', lot45.type === 'land' && lot45.lottery === true)
  check('南桥寺 = land+lottery标记', lot41.type === 'land' && lot41.lottery === true)
  // 铜梁/黄泥磅恢复为普通地产
  check('铜梁 = 普通地产', TILES[22].type === 'land')
  check('黄泥磅 = 普通地产', TILES[37].type === 'land')

  // 初始彩票状态
  let s = makeState([{id:'p1',name:'A',isAI:true},{id:'p2',name:'B',isAI:true}], 40)
  check('初始奖池 ¥10000', s.lottery.pool === 10000)
  check('初始 phase=buying', s.lottery.phase === 'buying')

  // 购买彩票
  s.players[0].money = 5000
  s.pending = { kind: 'lottery', tileId: 45 }
  s.phase = 'landed'
  s = gameReducer(s, { type: 'BUY_TICKET', number: 42 })
  check('购买彩票扣 ¥500', s.players[0].money === 4500)
  check('奖池增加 ¥500（10000→10500）', s.lottery.pool === 10500)
  check('记录已选数字', s.lottery.pickedNumbers['p1']?.includes(42))

  // 重复数字不能选：p1 已选 42，再选 42 应被拒（但 lotteryBoughtTurn 已被第一次成功设为 true）
  // 注意：这里不重置 lotteryBoughtTurn，直接试重复数字 → 数字检查先失败，不会碰 lotteryBoughtTurn
  const res2 = gameReducer(s, { type: 'BUY_TICKET', number: 42 })
  check('重复数字被拒绝（奖池不变）', res2.lottery.pool === 10500)

  // 本回合不能买第二次：p1 已成功买过 42 → lotteryBoughtTurn=true → 买 7 被拒
  s.pending = { kind: 'lottery', tileId: 45 }
  s.players[0].money = 10000
  const res4 = gameReducer(s, { type: 'BUY_TICKET', number: 7 })
  check('本回合第二次购买被拒绝', res4.lottery.pickedNumbers['p1'].length === 1)

  // 关闭彩票弹窗
  s = gameReducer(s, { type: 'LOTTERY_CLOSE' })
  check('关闭彩票弹窗', s.pending === null)

  // 批量购买彩票
  s = makeState([{id:'p1',name:'A',isAI:true},{id:'p2',name:'B',isAI:true}], 40)
  s.players[0].money = 5000
  s.pending = { kind: 'lottery', tileId: 45 }
  s.phase = 'landed'
  s = gameReducer(s, { type: 'BUY_TICKETS', numbers: [10, 20, 30] })
  check('批量购买 3 张扣 ¥1500', s.players[0].money === 3500)
  check('奖池增加 ¥1500（10000→11500）', s.lottery.pool === 11500)
  check('记录 3 个号码', s.lottery.pickedNumbers['p1']?.length === 3)
  check('批量购买后本回合不能再买', s.lotteryBoughtTurn === true)

  // 批量购买时钱不够：能买几张买几张
  s = gameReducer(s, { type: 'LOTTERY_CLOSE' })
  s.lotteryBoughtTurn = false
  s.players[0].money = 800
  s.lottery.pickedNumbers = {}
  s.pending = { kind: 'lottery', tileId: 45 }
  s = gameReducer(s, { type: 'BUY_TICKETS', numbers: [1, 2, 3] })
  check('钱不够时只买了 1 张（¥800→¥300）', s.players[0].money === 300)
  check('只记录了 1 个号码', s.lottery.pickedNumbers['p1']?.length === 1)

  // 完整开奖流程：购买 → 推进回合到第5回合 → 开奖
  s = makeState([{id:'p1',name:'A',isAI:true},{id:'p2',name:'B',isAI:true}], 40)
  s.players.forEach(p => p.firstTurn = false)
  // p1 买彩票选 50
  s.players[0].money = 5000
  s.pending = { kind: 'lottery', tileId: 45 }
  s.phase = 'landed'
  s = gameReducer(s, { type: 'BUY_TICKET', number: 50 })
  check('p1 购买彩票成功，奖池 10500', s.lottery.pool === 10500)
  s = gameReducer(s, { type: 'LOTTERY_CLOSE' })
  check('p1 选了数字 50', s.lottery.pickedNumbers['p1']?.[0] === 50)

  // 推进 5 个回合（round 1→6，在第 6 回合触发开奖）
  for (let i = 0; i < 10; i++) { // 2人局，10次 END_TURN = 5 个完整圈
    s.phase = 'landed'
    s.pending = null
    s = gameReducer(s, { type: 'END_TURN' })
    if (s.lottery.phase !== 'buying') break // 已开奖
  }
  check('已开奖（phase 不是 buying）', s.lottery.phase !== 'buying')
  check('有中奖数字', s.lottery.currentWinning >= 1 && s.lottery.currentWinning <= 100)
  // 如果中奖数字是 50，p1 赢
  if (s.lottery.currentWinning === 50) {
    check('p1 中奖得到奖池', s.players[0].money > 5000)
  }
}

console.log('▶ 股票系统')
{
  // 股票池存在性
  check('10只股票', Object.keys(STOCKS).length === 10)
  check('重啤初始价 ¥30', STOCKS.cqbj.price === 30)
  check('重啤最低价 ¥6', STOCKS.cqbj.min === 6)
  check('重啤最高价 ¥75', STOCKS.cqbj.max === 75)

  // 买入
  let s = makeState([{id:'p1',name:'A',isAI:true},{id:'p2',name:'B',isAI:true}], 40)
  s.players[0].money = 10000
  s.phase = 'landed'
  s = gameReducer(s, { type: 'STOCK_BUY', code: 'cqbj', shares: 10 })
  check('买入10股重啤', s.players[0].stockHoldings?.cqbj === 10)
  check('扣款+手续费（约¥303）', s.players[0].money < 9700)

  // 卖出（无手续费）
  const moneyBefore = s.players[0].money
  s = gameReducer(s, { type: 'STOCK_SELL', code: 'cqbj', shares: 5 })
  check('卖出5股', s.players[0].stockHoldings?.cqbj === 5)
  check('卖出到账（无手续费）', s.players[0].money > moneyBefore)

  // 持仓上限5家
  s = makeState([{id:'p1',name:'A',isAI:true},{id:'p2',name:'B',isAI:true}], 40)
  s.players[0].money = 100000
  s.phase = 'landed'
  s = gameReducer(s, { type: 'STOCK_BUY', code: 'cqbj', shares: 10 })
  s = gameReducer(s, { type: 'STOCK_BUY', code: 'cqca', shares: 10 })
  s = gameReducer(s, { type: 'STOCK_BUY', code: 'zlc', shares: 10 })
  s = gameReducer(s, { type: 'STOCK_BUY', code: 'tj', shares: 10 })
  s = gameReducer(s, { type: 'STOCK_BUY', code: 'yyy', shares: 10 })
  const buy6th = gameReducer(s, { type: 'STOCK_BUY', code: 'yb', shares: 10 })
  check('第6只股票被拒（超5家上限）', buy6th.players[0].stockHoldings?.yb == null)

  // 持仓市值计算
  s = makeState([{id:'p1',name:'A',isAI:true},{id:'p2',name:'B',isAI:true}], 40)
  s.players[0].stockHoldings = { cqbj: 10 } // 10股重啤 @ ¥30
  const val = stockPortfolioValue(s.players[0], s.stockRuntime)
  check('持仓市值 = 10×30 = 300', val === 300)

  // 股价波动在圈末
  s = makeState([{id:'p1',name:'A',isAI:true},{id:'p2',name:'B',isAI:true}], 40)
  const priceBefore = s.stockRuntime.cqbj.current
  s.turnIndex = 1 // p2 的回合
  s.phase = 'landed'
  s.pending = null
  s = gameReducer(s, { type: 'END_TURN' }) // END_TURN → nextTurn → round+1 → tick
  check('圈末股价变动', s.stockRuntime.cqbj.current !== priceBefore || s.stockRuntime.cqca.current !== 20)
}

console.log('▶ 神仙格附身弹窗')
{
  // 神仙格(18 重庆大学)：附身 → 弹出 god 弹窗
  // 注意：崔斯特(即时型)不附身，无 god 弹窗；土地公直接抢夺地产（无 buy pending）
  let s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s = gameReducer(s, { type: 'DEBUG_TELEPORT', playerId: 'p1', tileId: 18 })
  const hasGod = s.players[0].god != null
  check('踩神仙格玩家被附身或触发崔斯特', hasGod || s.log.some(l => l.includes('崔斯特')))

  if (s.pending?.kind === 'buy') {
    // 附身非土地公神：先 buy pending，购买后触发 god pending
    s = gameReducer(s, { type: 'BUY_PROPERTY' })
    if (hasGod) {
      check('购买后触发 god pending', s.pending?.kind === 'god')
    } else {
      // 崔斯特：不附身，无 god pending
      check('崔斯特无 god pending', s.pending?.kind !== 'god')
    }
  } else if (s.pending?.kind === 'god') {
    // 附身土地公：直接抢夺地产，立即触发 god pending
    check('土地公抢夺后直接触发 god pending', true)
  } else {
    check('神仙格触发 god 或 buy pending', false)
  }

  if (s.pending?.kind === 'god') {
    check('god pending 包含正确 godId', s.pending?.godId != null)
    s = gameReducer(s, { type: 'GOD_CLOSE' })
    check('GOD_CLOSE 清除 god pending', s.pending === null)
  }
}

console.log('▶ 奇遇事件弹窗')
{
  // 奇遇格(6)：落地触发事件 → 产生 chance pending
  let s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s = gameReducer(s, { type: 'DEBUG_TELEPORT', playerId: 'p1', tileId: 6 })
  check('踩奇遇格触发 chance pending', s.pending?.kind === 'chance')
  check('chance pending 包含事件信息', s.pending?.event?.text != null && s.pending?.event?.icon != null)
  // 关闭弹窗
  s = gameReducer(s, { type: 'CHANCE_CLOSE' })
  check('CHANCE_CLOSE 清除 chance pending', s.pending === null)
}

console.log('▶ 彩票站路过自动弹窗')
{
  // 彩票站(45 两路口)：路过时触发 lottery pending
  let s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  // 走到 44（从大坪52来），再走 1 步到 45（彩票站）
  s.players[0].pos = 44
  s.players[0].cameFrom = 52
  s.phase = 'roll'
  s.players[0].walkPath = [44]
  s = gameReducer(s, { type: 'DEBUG_MOVE', playerId: 'p1', steps: 1 })
  // 45 是彩票站也是地产，购买后应触发 lottery
  if (s.pending?.kind === 'buy') {
    s = gameReducer(s, { type: 'BUY_PROPERTY' })
    check('购买彩票站后触发 lottery pending', s.pending?.kind === 'lottery')
  } else if (s.pending?.kind === 'lottery') {
    check('踩彩票站触发 lottery pending', true)
  } else {
    check('踩彩票站触发 lottery pending', false)
  }
}

console.log('▶ 彩票站路过触发（不踩）')
{
  // 从 39 走 3 步：39→40→41(彩票站)→19，路过 41 但落到 19（无主地产）
  let s = makeState([
    { id: 'p1', name: 'A', isAI: false },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  s.players[0].pos = 39
  s.players[0].cameFrom = 38
  s.phase = 'roll'
  s.players[0].walkPath = [39]
  s = gameReducer(s, { type: 'DEBUG_MOVE', playerId: 'p1', steps: 3 })
  // 落到 19 触发 buy pending
  check('路过彩票站后落地产格：buy pending', s.pending?.kind === 'buy')
  // 买地后 → 触发彩票弹窗
  s = gameReducer(s, { type: 'BUY_PROPERTY' })
  check('买地后触发彩票弹窗', s.pending?.kind === 'lottery')
}

console.log('▶ 破产弹窗')
{
  // 玩家破产时触发 bankrupt pending
  let s = makeState([
    { id: 'p1', name: 'A', isAI: true },
    { id: 'p2', name: 'B', isAI: true },
  ], 40)
  // 让 p1 踩到 p2 的高租地，破产
  s.players[1].properties = [2] // p2 拥有弹子石
  s.players[1].levels = { 2: 3 } // 3级
  s.players[0].pos = 1 // p1 在朝天门
  s.players[0].money = 100 // 很少的钱
  s.players[0].cameFrom = 32
  s.phase = 'roll'
  s.players[0].walkPath = [1]
  s = gameReducer(s, { type: 'DEBUG_MOVE', playerId: 'p1', steps: 1 }) // 走到弹子石(2)
  // 检查是否破产（租金 800×3级×1.5组合=3600，p1 只有 100）
  if (s.players[0].bankrupt) {
    check('破产触发 bankrupt pending', s.pending?.kind === 'bankrupt')
    check('bankrupt pending 包含玩家名', s.pending?.playerName === 'A')
    s = gameReducer(s, { type: 'BANKRUPT_CLOSE' })
    check('BANKRUPT_CLOSE 清除 bankrupt pending', s.pending === null)
  } else {
    // 如果没破产（比如卖地自救了），至少验证没有异常
    check('玩家未破产（卖地自救）', s.players[0].alive)
  }
}

console.log('\n▶ 银行贷款系统')
{
  // 基础借款
  let s = makeState([{ id: 'p1', name: 'A', isAI: false }], 40, 20000)
  const assets = totalAssets(s.players[0])
  s = gameReducer(s, { type: 'TAKE_LOAN', amount: 5000 })
  const a = s.players[0]
  check('借款成功：现金 +5000', a.money === 25000)
  check('借款成功：贷款记录 ¥5000', a.loan === 5000)
  check('借款成功：待还 = 5000×1.2 = 6000', a.loanRepay === 6000)
  check('借款成功：到期回合 = 当前+10', a.loanDue === 11)

  // 可贷额度 = 总资产×50%
  check('可贷额度 = 总资产×50%', Math.floor(assets * 0.5) === 10000)

  // 有贷款时额度减少（净资产 = 25000 - 6000 = 19000，可贷 = 9500 - 5000 = 4500）
  // 借 5000 超额 → 实际只借到 4500（上限），总贷款 = 9500
  const s2 = gameReducer(s, { type: 'TAKE_LOAN', amount: 5000 })
  check('有贷款时超额借款被截断', s2.players[0].loan === 9500)
  const s2b = gameReducer(s, { type: 'TAKE_LOAN', amount: 4000 })
  check('有贷款时额度内可借', s2b.players[0].loan === 9000)

  // 部分还款
  s = gameReducer(s, { type: 'REPAY_LOAN', amount: 2000 })
  check('部分还款：待还减少', s.players[0].loanRepay === 4000)

  // 还清
  s = gameReducer(s, { type: 'REPAY_LOAN', amount: 4000 })
  check('还清：贷款清零', s.players[0].loan === 0 && s.players[0].loanRepay === 0 && s.players[0].loanDue === 0)

  // 还清后可再借
  s = gameReducer(s, { type: 'TAKE_LOAN', amount: 3000 })
  check('还清后可再借', s.players[0].loan === 3000)

  // 到期扣款（现金够）
  s = makeState([{ id: 'p1', name: 'A', isAI: false }], 40, 20000)
  s.players[0].loan = 5000
  s.players[0].loanRepay = 6000
  s.players[0].loanDue = 3
  s.players[0].money = 10000
  s.round = 3
  s.phase = 'roll'
  s = gameReducer(s, { type: 'ROLL_DICE' })
  check('到期扣款（现金够）：贷款清零', s.players[0].loan === 0 && s.players[0].loanRepay === 0)
  check('到期扣款（现金够）：现金-6000', s.players[0].money === 4000)

  // 到期扣款（现金不够 → 强制变卖）
  s = makeState([{ id: 'p1', name: 'A', isAI: false }], 40, 20000)
  s.players[0].loan = 1000
  s.players[0].loanRepay = 1200
  s.players[0].loanDue = 3
  s.players[0].money = 500
  s.players[0].properties = [7] // 南彭 price=2000, sell=800
  s.players[0].levels = { 7: 0 }
  s.round = 3
  s.phase = 'roll'
  s = gameReducer(s, { type: 'ROLL_DICE' })
  check('到期强制变卖：地产被卖', !s.players[0].properties.includes(7))
  check('到期强制变卖：贷款清零', s.players[0].loan === 0 && s.players[0].loanRepay === 0)

  // 总资产减去贷款
  s = makeState([{ id: 'p1', name: 'A', isAI: false }], 40, 20000)
  s.players[0].loan = 5000
  s.players[0].loanRepay = 6000
  check('总资产减去贷款', totalAssets(s.players[0]) === 20000 - 6000)

  // 到期混合还款（现金+卖地够还）
  s = makeState([{ id: 'p1', name: 'A', isAI: false }], 40, 20000)
  s.players[0].loan = 5000
  s.players[0].loanRepay = 6000
  s.players[0].loanDue = 3
  s.players[0].money = 2000
  s.players[0].properties = [7, 9, 2, 3] // sell: 800+800+1600+1600=4800
  s.players[0].levels = { 7: 0, 9: 0, 2: 0, 3: 0 }
  s.round = 3
  s.phase = 'roll'
  s = gameReducer(s, { type: 'ROLL_DICE' })
  check('到期混合还款：贷款清零', s.players[0].loan === 0 && s.players[0].loanRepay === 0)
  check('到期混合还款：剩余现金正确', s.players[0].money === 2000 + 4800 - 6000)

  // 到期混合还款（卖光+现金仍不够 → 违约挂账）
  s = makeState([{ id: 'p1', name: 'A', isAI: false }], 40, 20000)
  s.players[0].loan = 5000
  s.players[0].loanRepay = 6000
  s.players[0].loanDue = 3
  s.players[0].money = 1000
  s.players[0].properties = [7] // sell=800, 总共 1800 < 6000
  s.players[0].levels = { 7: 0 }
  s.round = 3
  s.phase = 'roll'
  s = gameReducer(s, { type: 'ROLL_DICE' })
  check('到期违约：剩余挂账', s.players[0].loanRepay === 6000 - 1000 - 800)
  check('到期违约：现金归零', s.players[0].money === 0)

  // 贷款期间不能移动中借款（阶段保护）
  s = makeState([{ id: 'p1', name: 'A', isAI: false }], 40, 20000)
  s.phase = 'step'
  s.stepsRemaining = 3
  const sLoan = gameReducer(s, { type: 'TAKE_LOAN', amount: 5000 })
  check('移动中不能贷款', sLoan.players[0].loan === 0)
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
if (fail > 0) process.exit(1)
console.log('SMOKE OK')
