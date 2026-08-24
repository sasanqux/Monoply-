// verify-lows.mjs — 回归低危修复验证：L8 护盾跳过致死 → 破产弹窗立即出现 + 关闭后推进回合
// 注意 gameReducer 返回深克隆新 state，断言一律读返回值，不持旧引用
import {
  createInitialState,
  gameReducer,
  currentPlayer,
  TILES,
} from '../shared/game/index.js'

let pass = 0
let fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}`) }
}

// 构造：3 人局，当前玩家（p1）踩到 p2 的高租地块，弹出了免租询问（shield pending）
function makeScenario(p1Money = 0) {
  const s = createInitialState({
    players: [
      { id: 'p1', name: '甲' },
      { id: 'p2', name: '乙' },
      { id: 'p3', name: '丙' },
    ],
    maxTurns: 40,
    startMoney: 20000,
  })
  s.phase = 'landed'
  const me = s.players[0]
  me.money = p1Money
  me.properties = []
  me.levels = {}
  me.mortgaged = {}
  me.stockHoldings = {}
  const owner = s.players[1]
  const tile = TILES.find((t) => t && t.type === 'land')
  owner.properties = [tile.id]
  owner.levels[tile.id] = 3
  s.turnIndex = 0
  s.barriers = {}
  s.pending = { kind: 'shield', tileId: tile.id, ownerId: owner.id, feeName: '租金' }
  return { s, tile }
}

console.log('▶ L8: SHIELD_SKIP 致死 → 破产弹窗立即转正')
{
  const { s } = makeScenario(0)
  const r1 = gameReducer(s, { type: 'SHIELD_SKIP' })
  const me1 = r1.players.find((x) => x.id === 'p1')
  check('支付后当前玩家已破产出局', me1 && !me1.alive)
  check('破产弹窗立即出现（不再等下一次落地）', r1.pending?.kind === 'bankrupt')
  check('弹窗指向破产玩家', r1.pending?.playerId === 'p1')

  console.log('▶ L8: BANKRUPT_CLOSE 后回合推进（死者无需点结束回合）')
  const r2 = gameReducer(r1, { type: 'BANKRUPT_CLOSE' })
  check('回合已推进到下一位存活玩家', currentPlayer(r2).id !== 'p1' && currentPlayer(r2).alive)
  check('阶段进入 roll', r2.phase === 'roll')

  console.log('▶ 回归：付得起租金的 SHIELD_SKIP 不弹破产窗、回合不推进')
  const s3r = makeScenario(999999)
  const r3 = gameReducer(s3r.s, { type: 'SHIELD_SKIP' })
  check('玩家存活', r3.players[0].alive)
  check('无破产弹窗、无其他残留挂起', r3.pending === null)
  check('仍停留在 landed 等待结束回合', r3.phase === 'landed')

  console.log('▶ 回归：非当前玩家破产的弹窗，关闭时不动别人的回合')
  const s4 = createInitialState({
    players: [
      { id: 'p1', name: '甲' },
      { id: 'p2', name: '乙' },
      { id: 'p3', name: '丙' },
    ],
    maxTurns: 40,
    startMoney: 20000,
  })
  s4.phase = 'landed'
  s4.turnIndex = 0
  s4.pending = { kind: 'bankrupt', playerId: 'p2', playerName: '乙' }
  const r4 = gameReducer(s4, { type: 'BANKRUPT_CLOSE' })
  check('弹窗已关闭', r4.pending === null)
  check('回合仍是甲的', currentPlayer(r4).id === 'p1')
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
