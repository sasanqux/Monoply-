// net-smoke.mjs — 联机端到端冒烟：验证房间协议 / 权限矩阵 / 拍卖 / 交易 / 掉线托管 / 重连
// 用法：node scripts/net-smoke.mjs（自带起停服务器，端口 8091）
import { spawn } from 'child_process'
import { io } from 'socket.io-client'

const PORT = 8091
const URL = `http://localhost:${PORT}`

const pass = []
const fail = []
function check(name, cond, extra = '') {
  if (cond) { pass.push(name); console.log(`  ✓ ${name}`) }
  else { fail.push(name); console.log(`  ✗ ${name} ${extra}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 等待某事件的一次性 promise
function once(emitter, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`等待 ${event} 超时`)), timeout)
    emitter.once(event, (data) => { clearTimeout(t); resolve(data) })
  })
}

// 客户端封装：自动跟踪最新 gameState / myPlayerId
function makeClient() {
  const sock = io(URL, { transports: ['websocket'] })
  const c = { sock, state: null, myId: null, currentPlayerId: null }
  sock.on('gameState', ({ state, currentPlayerId, myPlayerId }) => {
    c.state = state
    c.currentPlayerId = currentPlayerId
    if (myPlayerId) c.myId = myPlayerId
  })
  c.emit = (ev, payload) => new Promise((resolve) => sock.emit(ev, payload, resolve))
  c.nextState = () => {
    const before = c.state
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('等待 gameState 超时')), 5000)
      const iv = setInterval(() => {
        if (c.state && c.state !== before) { clearTimeout(t); clearInterval(iv); resolve(c.state) }
      }, 10)
    })
  }
  return c
}

// 依据当前 phase 推进一个"人类回合"的所有动作，返回本回合执行的 action 数
// onLanded(c)：落地且无 pending 时的钩子，返回 true 表示已执行自定义动作（交易测试用）
async function playTurn(c, onLanded) {
  let n = 0
  for (let guard = 0; guard < 30; guard++) {
    const st = c.state
    if (!st || st.status !== 'playing') break
    const curId = c.currentPlayerId
    if (curId !== c.myId) break // 不是我的回合
    if (st.phase === 'roll') { await act(c, { type: 'ROLL_DICE' }); n++; continue }
    if (st.phase === 'fork' && st.pending?.kind === 'fork') {
      await act(c, { type: 'CHOOSE_FORK', tileId: st.pending.options[0] }); n++; continue
    }
    if (st.phase === 'step') { check('phase 不应卡在 step（服务器应自动推进）', false); break }
    if (st.phase === 'auction') break // 拍卖由专门流程处理
    const pk = st.pending?.kind
    if (pk === 'buy') { await act(c, { type: 'SKIP_BUY' }); n++; continue }
    if (pk === 'shop') { await act(c, { type: 'SHOP_CLOSE' }); n++; continue }
    if (pk === 'lottery') { await act(c, { type: 'LOTTERY_CLOSE' }); n++; continue }
    if (pk === 'checkin') { await act(c, { type: 'CHECKIN_SKIP' }); n++; continue }
    if (st.phase === 'landed') {
      if (onLanded && !st.pending) {
        const handled = await onLanded()
        if (handled) { n++; continue }
      }
      await act(c, { type: 'END_TURN' }); n++; continue
    }
    break
  }
  return n
}

// 发 action 并等待广播回流
async function act(c, action) {
  const p = c.nextState()
  const res = await c.emit('action', action)
  if (res?.error) throw new Error(`action ${action.type} 被拒: ${res.error}`)
  await p
}

// ============ 启动服务器 ============
const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
})
server.stdout.on('data', (d) => process.env.NETSMOKE_VERBOSE && process.stdout.write(`[srv] ${d}`))
server.stderr.on('data', (d) => process.stdout.write(`[srv:err] ${d}`))

try {
  // 等服务器就绪
  let up = false
  for (let i = 0; i < 50; i++) {
    await sleep(200)
    try {
      const r = await fetch(`http://localhost:${PORT}/health`)
      if (r.ok) { up = true; break }
    } catch { /* retry */ }
  }
  if (!up) throw new Error('服务器启动失败')
  console.log('▶ 服务器就绪')

  // ============ P0-1：创建/加入/准备/开始 ============
  console.log('▶ 房间与准备协议（P0-1）')
  const A = makeClient()
  const created = await A.emit('createRoom', { playerName: 'Alice', settings: { maxTurns: 12, startMoney: 100000 } })
  check('创建房间成功', !!created.ok && /^[A-Z2-9]{6}$/.test(created.roomId))
  const roomId = created.roomId

  const B = makeClient()
  const joined = await B.emit('joinRoom', { roomId, playerName: 'Bob' })
  check('加入房间成功', !!joined.ok && !!joined.playerId)

  // 未准备就开局 → 应被拒
  const early = await A.emit('startGame')
  check('未全部准备时不能开局', !!early.error)

  const r1 = await B.emit('ready')
  check('准备协议可用', !!r1.ok)
  const started = await A.emit('startGame')
  check('全员准备后房主可开局', !!started.ok)

  // ============ P1-9：gameStart 不带手牌，gameState 脱敏 ============
  console.log('▶ 状态脱敏（P1-9）')
  const gs1 = await once(A.sock, 'gameState', 3000).catch(() => null) || A.state
  for (let i = 0; i < 20 && !A.state; i++) await sleep(100)
  check('开局收到 gameState', !!A.state)
  if (A.state) {
    const myHand = A.state.players.find((p) => p.id === A.myId)?.hand
    const bobHand = A.state.players.find((p) => p.id === B.myId)?.hand
    check('自己的手牌可见', Array.isArray(myHand) && myHand.length >= 2)
    check('他人的手牌被隐藏', bobHand === undefined)
  }

  // ============ P1-10：调试后门拒绝 ============
  console.log('▶ 调试后门（P1-10）')
  const dbg = await A.emit('action', { type: 'DEBUG_MONEY', playerId: A.myId, amount: 999999 })
  check('联机拒绝 DEBUG_* 操作', !!dbg.error)

  // ============ 对局主循环：跑完 12 回合，途中做交易 / 断线托管 / 拍卖 ============
  console.log('▶ 对局推进（含分岔不死锁 P0-4 / 拍卖 P0-5 / 交易 / 掉线托管）')
  const bobId = B.myId
  let Bc = B
  let auctionDone = false
  let auctionSeen = false
  const phase1 = { tradeTested: false, disconnectStarted: false, rejoined: false }
  const maxActions = 900
  for (let i = 0; i < maxActions; i++) {
    const st = A.state
    if (!st) break
    if (st.status === 'finished') break

    // ---- 拍卖：轮转出价 + 揭晓 ----
    if (st.phase === 'auction' && st.pending?.kind === 'auction') {
      auctionSeen = true
      const ap = st.pending
      if (ap.roundStep === 0) {
        const bidderId = st.players[ap.turn].id
        const bidder = bidderId === A.myId ? A : bidderId === Bc.myId ? Bc : null
        if (bidder && bidder.sock.connected) {
          const res = await bidder.emit('action', { type: 'AUCTION_BID', amount: 100 })
          if (res?.error) { check('拍卖出价被错误拒绝: ' + res.error, false); break }
        } else {
          await sleep(1200) // 掉线托管出价
        }
      } else {
        const turnId = A.currentPlayerId
        const actor = turnId === A.myId ? A : turnId === Bc.myId ? Bc : null
        if (actor && actor.sock.connected) await actor.emit('action', { type: 'AUCTION_REVEAL' })
        else await sleep(1200)
        if (A.state && A.state.phase !== 'auction') auctionDone = true
      }
      await sleep(150)
      continue
    }

    // ---- 掉线托管（P0-6）：round>=2 后断开 B，轮到 B 时等服务器代打，然后重连 ----
    if (!phase1.disconnectStarted && st.round >= 2 && phase1.tradeTested) {
      phase1.disconnectStarted = true
      Bc.sock.disconnect()
      console.log('  · Bob 已断线，等待服务器托管…')
    }
    if (phase1.disconnectStarted && !phase1.rejoined && A.currentPlayerId === bobId) {
      await sleep(400)
      if (A.currentPlayerId === bobId) continue // 托管动作间隔 900ms，继续等
      // Bob 的回合被服务器代打完毕 → 验证重连
      check('掉线玩家回合由服务器托管推进', true)
      const B2 = makeClient()
      const rejoin = await B2.emit('joinRoom', { roomId, playerName: 'Bob' })
      check('同名重连找回座位', !!rejoin.ok && !!rejoin.rejoined && rejoin.playerId === bobId)
      for (let k = 0; k < 20 && !B2.state; k++) await sleep(100)
      check('重连后立即收到 gameState', !!B2.state && !!B2.myId)
      if (B2.state) {
        const me = B2.state.players.find((p) => p.id === B2.myId)
        check('重连后手牌恢复可见', Array.isArray(me?.hand))
        check('重连后恢复真人身份（isAI=false）', me?.isAI === false)
      }
      Bc = B2
      phase1.rejoined = true
      continue
    }

    // ---- 正常回合 ----
    if (A.currentPlayerId === A.myId) {
      await playTurn(A, async () => {
        // 交易测试（P0-3/P0-5）：A 落地无 pending 时做一轮交易
        if (phase1.tradeTested || !Bc.sock.connected) return false
        phase1.tradeTested = true
        await act(A, {
          type: 'TRADE_OFFER',
          targetPlayerId: bobId,
          offer: { lands: [49], money: 0, cards: [] }, // 解放碑不属于 Alice
          request: { lands: [], money: 100, cards: [] },
        })
        check('献出不拥有的地 → 不产生交易 pending', A.state.pending?.kind !== 'trade')
        const bobMoneyBefore = Bc.state.players.find((p) => p.id === bobId).money
        await act(A, {
          type: 'TRADE_OFFER',
          targetPlayerId: bobId,
          offer: { lands: [], money: 100, cards: [] },
          request: { lands: [], money: 0, cards: [] },
        })
        check('合法交易创建 pending', A.state.pending?.kind === 'trade')
        const bad = await A.emit('action', { type: 'TRADE_ACCEPT' })
        check('发起方不能自 accept', !!bad.error || A.state.pending?.kind !== 'trade')
        if (A.state.pending?.kind === 'trade') {
          const p2 = Bc.nextState()
          await Bc.emit('action', { type: 'TRADE_ACCEPT' })
          await p2
          check('交易对方（非回合玩家）可 accept', Bc.state.pending?.kind !== 'trade')
          const bobMoneyAfter = Bc.state.players.find((p) => p.id === bobId).money
          check('交易资金到账（+100）', bobMoneyAfter === bobMoneyBefore + 100, `${bobMoneyBefore}→${bobMoneyAfter}`)
        }
        return true
      })
    } else if (A.currentPlayerId === bobId && Bc.sock.connected) {
      await playTurn(Bc)
    } else {
      await sleep(300) // 等服务器托管
    }
    await sleep(60)
  }
  check('对局正常推进（未死锁）', !!A.state && (A.state.status === 'finished' || A.state.round >= 3),
    `status=${A.state?.status} round=${A.state?.round}`)
  check('交易流程已验证', phase1.tradeTested)
  check('掉线托管+重连已验证', phase1.disconnectStarted && phase1.rejoined)
  if (auctionSeen) check('拍卖流程完成（凑齐出价并揭晓）', auctionDone)
  if (A.state) check(`对局结束（round=${A.state.round}）`, A.state.status === 'finished')

  A.sock.disconnect()
  Bc.sock.disconnect()
} catch (e) {
  fail.push('异常: ' + e.message)
  console.error('  ✗ 异常:', e.message)
} finally {
  server.kill()
  await sleep(300)
}

console.log(`\n结果：${pass.length} 通过 / ${fail.length} 失败`)
if (fail.length) {
  fail.forEach((f) => console.log('  ✗ ' + f))
  process.exit(1)
}
console.log('NET-SMOKE OK')
