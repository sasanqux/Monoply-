// verify-fixes.mjs — 修复后行为验证（临时）
import { createInitialState, gameReducer } from '../shared/game/index.js'
const mk = (n = 2) => {
  const s = createInitialState({ players: Array.from({ length: n }, (_, i) => ({ id: 'p' + (i + 1), name: 'P' + (i + 1), isAI: false })), maxTurns: 40, startMoney: 20000 })
  s.bonusTile = { id: 0, amount: 0 }
  return s
}

// 1. END_TURN 在 shield pending 时被拦截
let s = mk(); s.phase = 'landed'; s.pending = { kind: 'shield', tileId: 2, ownerId: 'p2', feeName: '租金' }
let r = gameReducer(s, { type: 'END_TURN' })
console.log('1 END_TURN+shield 拦截:', r.turnIndex === 0 && r.pending?.kind === 'shield' ? 'PASS' : 'FAIL')

// 2. TRAVEL_METRO 在 shield pending 时被拦截
s = mk(); s.players[0].pos = 5; s.phase = 'landed'; s.players[0].money = 2000
s.pending = { kind: 'shield', tileId: 5, ownerId: 'p2', feeName: '轻轨使用费' }
r = gameReducer(s, { type: 'TRAVEL_METRO', targetTileId: 27 })
console.log('2 TRAVEL_METRO+shield 拦截:', r.players[0].pos === 5 && r.pending?.kind === 'shield' ? 'PASS' : 'FAIL')

// 3. STEP 在 fork 阶段被拦截
s = mk(); s.phase = 'fork'; s.stepsRemaining = 3; s.pending = { kind: 'fork', tileId: 13, options: [14, 51], stepsLeft: 3, canPick: true }
r = gameReducer(s, { type: 'STEP' })
console.log('3 STEP+fork 拦截:', r.phase === 'fork' ? 'PASS' : 'FAIL')

// 4. 交易抵押标记转移
s = mk(); s.phase = 'landed'
s.players[0].properties = [2]; s.players[1].properties = [3]
s.players[0].mortgaged = { 2: true }
s.pending = { kind: 'trade', from: 'p1', to: 'p2', offer: { lands: [2], money: 0 }, request: { lands: [3], money: 0 } }
r = gameReducer(s, { type: 'TRADE_ACCEPT' })
console.log('4 交易抵押转移:', r.players[1].properties.includes(2) && r.players[1].mortgaged?.[2] === true && !r.players[0].mortgaged?.[2] ? 'PASS' : 'FAIL', JSON.stringify({ p1m: r.players[0].mortgaged, p2m: r.players[1].mortgaged }))

// 5. 交易重复 id 去重
s = mk(); s.phase = 'landed'
s.players[0].properties = [2]; s.players[0].money = 30000
r = gameReducer(s, { type: 'TRADE_OFFER', targetPlayerId: 'p2', offer: { lands: [2, 2], money: 0 }, request: { lands: [], money: 1000 } })
console.log('5 交易去重:', r.pending?.kind === 'trade' && JSON.stringify(r.pending.offer.lands) === '[2]' ? 'PASS' : 'FAIL')

// 6. 换地卡等级跟地走
s = mk(); s.players.forEach(p => (p.firstTurn = false))
s.players[0].properties = [2]; s.players[0].levels = { 2: 3 }
s.players[1].properties = [3]; s.players[1].levels = { 3: 1 }
s.phase = 'landed'
s.players[0].hand = [{ id: 'sw', type: 'swap', name: '换地卡', desc: '', icon: '' }]
r = gameReducer(s, { type: 'USE_CARD', cardId: 'sw', target: { myTile: 2, theirTile: 3 } })
console.log('6 换地卡等级跟地:', r.players[0].levels[3] === 1 && r.players[1].levels[2] === 3 ? 'PASS' : 'FAIL')

// 7. UPGRADE 绕过被堵（未踩过不能升）
s = mk(); s.players[0].properties = [2]; s.players[0].levels = { 2: 0 }; s.players[0].money = 20000
s.players[0].upgradableTiles = []; s.phase = 'landed'
r = gameReducer(s, { type: 'UPGRADE_PROPERTY', tileId: 2 })
console.log('7 UPGRADE 需踩过:', (r.players[0].levels[2] ?? 0) === 0 ? 'PASS' : 'FAIL')

// 8. 全员破产可结束
s = mk(); s.phase = 'landed'
s.players.forEach(p => { p.alive = false }) // 模拟全员已被 checkBankrupt 判定出局
r = gameReducer(s, { type: 'END_TURN' })
console.log('8 全员破产结束:', r.status === 'finished' ? 'PASS' : 'FAIL')

// 9. 租金无小数（商圈 ×1.5）
s = mk(); s.players[1].properties = [10, 2, 3, 4, 7]; s.players[1].levels = { 10: 0 }
r = gameReducer(s, { type: 'DEBUG_TELEPORT', playerId: 'p1', tileId: 10 })
const m = r.players[0].money
console.log('9 租金整数:', Number.isInteger(m) ? 'PASS' : 'FAIL', 'money=' + m)

// 10. 抵押地升级被堵（踩过但抵押）
s = mk(); s.players[0].properties = [2]; s.players[0].levels = { 2: 0 }; s.players[0].money = 20000
s.players[0].upgradableTiles = [2]; s.players[0].mortgaged = { 2: true }; s.phase = 'landed'
r = gameReducer(s, { type: 'UPGRADE_PROPERTY', tileId: 2 })
console.log('10 抵押地不能升:', (r.players[0].levels[2] ?? 0) === 0 ? 'PASS' : 'FAIL')
console.log('DONE')
