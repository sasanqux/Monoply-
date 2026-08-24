// rooms.js — 房间管理：创建/加入/离开/准备/开始/游戏操作/掉线托管/清理
// 游戏逻辑统一 import 自 shared/game（与前端共用同一份，消灭双副本漂移）
import { gameReducer, createInitialState, aiDecide, currentPlayer, PLAYER_COLORS, getWinnerByElimination } from '../shared/game/index.js'

const rooms = new Map()
const MAX_ROOMS = 100 // 房间数量上限（防无限制创建耗尽内存）

// 房间只读查询（供 index.js 的 requestState 等使用；Map 本体保持模块私有）
export function getRoom(roomId) {
  return rooms.get(roomId) || null
}

// 房主判定：按玩家 id（稳定标识）而非 socketId（掉线重连后会变）
function isHost(room, socketId) {
  const p = room.players.find((pl) => pl.socketId === socketId)
  return !!p && p.id === room.hostPlayerId
}

// ===== 设置白名单校验（防恶意 payload 注入负数/字符串/超大值）=====
function sanitizeSettings(settings = {}) {
  const clampInt = (v, min, max, dft) => {
    const n = Math.floor(Number(v))
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dft
  }
  return {
    maxTurns: clampInt(settings.maxTurns, 5, 200, 40),
    startMoney: clampInt(settings.startMoney, 1000, 1000000, 20000),
    maxPlayers: clampInt(settings.maxPlayers, 2, 8, 8),
  }
}

function sanitizeName(name) {
  return String(name ?? '').trim().slice(0, 12) || '玩家'
}

// 生成 6 位房间码（大写字母+数字，去掉易混字符 0/O/1/I）
function genRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id
  do {
    id = ''
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)]
  } while (rooms.has(id))
  return id
}

export function createRoom(hostName, settings = {}) {
  if (rooms.size >= MAX_ROOMS) return null // 服务器繁忙
  const roomId = genRoomId()
  const room = {
    roomId,
    status: 'waiting', // waiting | playing | finished
    hostId: null, // 房主当前 socketId（仅用于展示兼容；权限判定一律走 hostPlayerId）
    hostPlayerId: null, // 房主的玩家 id（稳定标识，掉线重连不丢失房主身份）
    settings: sanitizeSettings(settings),
    players: [],
    playerSeq: 0, // 玩家 ID 自增序号（防"退出再加人"ID 碰撞）
    gameState: null,
    chat: [],
    gameLog: [], // 游戏日志
    password: null, // 房间密码
    paused: false, // 是否暂停
    aiTakeover: false, // AI 托管：默认关闭，仅房主可开启
    turnTimer: null, // 回合倒计时定时器
    turnTimeLeft: 30, // 剩余秒数
    _timerTurnKey: null, // 倒计时所属回合标识（index.js 按 turnIndex@round 计算）：仅回合变化才重置 30 秒
    createdAt: Date.now(),
    _cleanupTimer: null,
    _aiTimer: null,
    _aiGuard: 0, // 连续 AI 托管动作计数（防死循环）
  }
  rooms.set(roomId, room)
  return room
}

export function joinRoom(roomId, playerName, socketId, color, password, playerId) {
  const room = rooms.get(roomId)
  if (!room) return { error: '房间不存在' }
  const name = sanitizeName(playerName)

  // 对局中断线重连：只按 playerId 找回原座位（稳定标识；不按昵称兜底，缩小座位顶替攻击面）。
  // 不再要求座位已标记 disconnected：服务端 ping 超时打标要 10-15 秒，客户端 1 秒内重连时
  // 座位还没标掉线，只要来的不是同一连接（p.socketId !== socketId）就允许认领重连。
  if (room.status === 'playing') {
    // 重连同样要验密码（否则知道房间码+playerId 即可顶替座位）
    if (room.password && room.password !== password) return { error: '房间密码错误' }
    const dc = playerId
      ? room.players.find((p) => p.id === playerId && p.socketId !== socketId)
      : null
    if (dc) {
      dc.socketId = socketId
      dc.disconnected = false
      const gp = room.gameState?.players.find((p) => p.id === dc.id)
      if (gp) gp.isAI = false
      room._aiGuard = 0
      // 如果重连的本来就是房主 → 恢复房主权限（按玩家 id 判定，不受 socketId 变化影响）
      if (dc.id === room.hostPlayerId) {
        room.hostId = socketId
      }
      return { room, playerId: dc.id, rejoined: true }
    }
    return { error: '游戏已开始，只能通过断线重连加入' }
  }

  if (room.status !== 'waiting') return { error: '游戏已开始，无法加入' }
  if (room.players.length >= room.settings.maxPlayers) return { error: '房间已满' }
  if (room.players.some((p) => p.name === name)) return { error: '名字已被使用' }
  // 检查房间密码
  if (room.password && room.password !== password) return { error: '房间密码错误' }

  // 检查颜色是否重复
  const usedColors = room.players.map((p) => p.color)
  let finalColor = color
  if (!finalColor || usedColors.includes(finalColor)) {
    // 自动分配一个未使用的颜色
    finalColor = PLAYER_COLORS.find((c) => !usedColors.includes(c)) || PLAYER_COLORS[0]
  }

  const newPlayerId = 'p' + ++room.playerSeq
  const player = {
    id: newPlayerId,
    name,
    socketId,
    isAI: false,
    ready: false,
    color: finalColor,
    disconnected: false,
  }
  room.players.push(player)

  // 第一个加入的是房主（记录稳定玩家 id，掉线重连不丢身份）
  if (!room.hostPlayerId) {
    room.hostPlayerId = newPlayerId
    room.hostId = socketId
    player.ready = true
  }

  return { room, playerId: newPlayerId }
}

// 准备/取消准备（非房主玩家）
export function toggleReady(socketId) {
  const room = findRoomBySocket(socketId)
  if (!room || room.status !== 'waiting') return null
  const player = room.players.find((p) => p.socketId === socketId)
  if (!player || isHost(room, socketId)) return room // 房主恒已准备
  player.ready = !player.ready
  return room
}

export function leaveRoom(socketId) {
  for (const [roomId, room] of rooms) {
    const idx = room.players.findIndex((p) => p.socketId === socketId)
    if (idx === -1) continue
    const player = room.players[idx]

    // 对局中离开/掉线：不删座位，转 AI 托管（可用原昵称重连找回）
    if (room.status === 'playing') {
      player.disconnected = true
      player.socketId = null
      const gp = room.gameState?.players.find((p) => p.id === player.id)
      if (gp) gp.isAI = true
      // 全员掉线 → 房间作废
      if (room.players.every((p) => p.disconnected)) {
        removeRoom(roomId)
        return { roomId, closed: true }
      }
      return { roomId, closed: false, room }
    }

    // 大厅阶段：真正移除
    const wasHost = room.hostPlayerId === player.id
    room.players.splice(idx, 1)
    if (wasHost && room.players.length > 0) {
      // 房主转移给下一个玩家（同步维护稳定 id 与 socketId 两份）
      room.hostPlayerId = room.players[0].id
      room.hostId = room.players[0].socketId
      room.players[0].ready = true
    }
    // 房间空了 → 删除
    if (room.players.length === 0) {
      removeRoom(roomId)
      return { roomId, closed: true }
    }
    return { roomId, closed: false, room }
  }
  return null
}

export function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.socketId === socketId)) return room
  }
  return null
}

export function startGame(socketId) {
  const room = findRoomBySocket(socketId)
  if (!room) return { error: '不在房间' }
  if (!isHost(room, socketId)) return { error: '你不是房主' }
  if (room.players.length < 2) return { error: '至少需要 2 名玩家' }
  if (room.players.some((p) => !p.ready)) return { error: '还有玩家未准备' }

  // 用真实玩家数据创建初始状态（含玩家选择的颜色）
  room.gameState = createInitialState({
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isAI: false,
      color: p.color, // 保留玩家自选颜色
    })),
    maxTurns: room.settings.maxTurns,
    startMoney: room.settings.startMoney,
  })
  room.status = 'playing'
  room._aiGuard = 0
  return { ok: true, room, gameState: room.gameState }
}

// ===== 游戏操作：按 phase 分权，再执行 =====
export function handleAction(socketId, action) {
  const room = findRoomBySocket(socketId)
  if (!room || !room.gameState) return { error: '游戏未开始' }
  if (room.paused) return { error: '游戏已暂停，无法操作' }
  const player = room.players.find((p) => p.socketId === socketId)
  if (!player) return { error: '不在房间' }
  const gs = room.gameState
  const cur = currentPlayer(gs)

  // 调试后门：联机一律拒绝（单机模式才可用）
  if (typeof action?.type === 'string' && action.type.startsWith('DEBUG_')) {
    return { error: '调试操作仅限单机模式' }
  }
  if (!action || typeof action.type !== 'string') return { error: '非法操作' }

  // 交易响应：只有交易对方（可能不是回合玩家）能接受/拒绝
  if (action.type === 'TRADE_ACCEPT' || action.type === 'TRADE_REJECT') {
    if (gs.pending?.kind !== 'trade') return { error: '当前没有待响应的交易' }
    if (player.id !== gs.pending.to) return { error: '只有交易对方能响应' }
    room._aiGuard = 0
    applyAction(room, action)
    return { ok: true, room }
  }

  // 拍卖阶段：出价权轮转给所有存活玩家（不只回合玩家），否则拍卖永远凑不齐人数
  if (gs.phase === 'auction' && gs.pending?.kind === 'auction') {
    const ap = gs.pending
    if (action.type === 'AUCTION_BID') {
      const bidder = gs.players[ap.turn]
      if (!bidder || player.id !== bidder.id) return { error: '还没轮到你出价' }
      room._aiGuard = 0
      applyAction(room, action)
      return { ok: true, room }
    }
    if (action.type === 'AUCTION_REVEAL') {
      // 揭晓由任一客户端触发（前端会限定由回合玩家客户端自动触发一次）
      if (ap.roundStep !== 1) return { error: '还没到揭晓阶段' }
      applyAction(room, action)
      return { ok: true, room }
    }
    return { error: '拍卖进行中，只能出价或等揭晓' }
  }

  // 开局掷骰定顺序：按 orderState.index 分权（轮到谁谁掷），否则非房主玩家永远掷不了
  if (gs.phase === 'order' && gs.orderState && !gs.orderState.done) {
    if (action.type !== 'ROLL_ORDER') return { error: '开局阶段只能掷骰定顺序' }
    const orderP = gs.players[gs.orderState.index]
    if (!orderP || player.id !== orderP.id) return { error: '还没轮到你掷骰' }
    room._aiGuard = 0
    applyAction(room, action)
    return { ok: true, room }
  }

  // 全员可见的信息弹窗：任何房间成员都可关闭（不等当前玩家走完回合才消失）
  const POPUP_CLOSE_ACTIONS = new Set([
    'GOD_CLOSE', 'CHANCE_CLOSE', 'BANKRUPT_CLOSE', 'BONUS_INFO_CLOSE', 'LOTTERY_DRAW_CLOSE',
  ])
  if (!POPUP_CLOSE_ACTIONS.has(action.type) && (!cur || player.id !== cur.id)) {
    return { error: '还没轮到你' }
  }

  room._aiGuard = 0

  // 掷骰/选岔后由服务器连续推进 STEP 直到稳定态（landed / fork / auction / roll），
  // 前端只按 walkPath 差量播放动画，不逐格发 STEP（避免分岔后无人推进的死锁）
  if (action.type === 'ROLL_DICE' || action.type === 'CHOOSE_FORK') {
    applyAction(room, action)
    return { ok: true, room }
  }

  applyAction(room, action)
  return { ok: true, room }
}

// 内部：执行 action 并自动推进残余 STEP
function applyAction(room, action) {
  room.gameState = gameReducer(room.gameState, action)
  autoStep(room)
}

// 自动推进 STEP：phase='step' 且还有剩余步数时一路走完（遇分岔/落地自然停）
function autoStep(room) {
  let guard = 0
  while (
    room.gameState.status === 'playing' &&
    room.gameState.phase === 'step' &&
    room.gameState.stepsRemaining > 0 &&
    guard++ < 200
  ) {
    // 注意：gameReducer 每次返回全新克隆，必须每轮重新取当前玩家（旧缓存的引用不会更新）
    room.gameState = gameReducer(room.gameState, { type: 'STEP' })
  }
}

// ===== 掉线托管：轮到掉线玩家时由服务器代打 =====
// 返回需要执行的 action；null 表示无需托管（都在等真人）
// 注意：需房主在游戏内开启 AI 托管才生效，否则掉线玩家会卡住
export function serverNextAction(room) {
  const gs = room.gameState
  if (!gs || gs.status !== 'playing') return null
  if (!room.aiTakeover) return null // AI 托管未开启 → 不代打
  const isDisconnected = (gp) =>
    !!gp && !!room.players.find((rp) => rp.id === gp.id)?.disconnected

  // 开局掷骰定顺序：轮到掉线玩家（或已出局玩家）也由服务器代掷
  if (gs.phase === 'order' && gs.orderState && !gs.orderState.done) {
    const orderP = gs.players[gs.orderState.index]
    if (!orderP || !orderP.alive || isDisconnected(orderP)) return { type: 'ROLL_ORDER' }
    return null
  }

  // 交易：对方掉线 → AI 评估响应
  if (gs.pending?.kind === 'trade') {
    const to = gs.players.find((p) => p.id === gs.pending.to)
    if (isDisconnected(to)) return aiDecide(gs, to.id)
    return null
  }

  if (gs.phase === 'auction' && gs.pending?.kind === 'auction') {
    const ap = gs.pending
    if (ap.roundStep === 1) {
      // 揭晓阶段：若回合玩家掉线则由服务器代触发，否则等客户端
      return isDisconnected(gs.players[gs.turnIndex]) ? { type: 'AUCTION_REVEAL' } : null
    }
    const bidder = gs.players[ap.turn]
    if (isDisconnected(bidder)) return aiDecide(gs, bidder.id)
    return null
  }

  if (gs.phase === 'fork' && gs.pending?.kind === 'fork') {
    const cp = currentPlayer(gs)
    if (!isDisconnected(cp)) return null
    // 掉线玩家卡在分岔：随机选一条（aiDecide 无分岔分支）
    const opts = gs.pending.options.length ? gs.pending.options : [gs.pending.chosen]
    return { type: 'CHOOSE_FORK', tileId: opts[Math.floor(Math.random() * opts.length)] }
  }

  const cp = currentPlayer(gs)
  if (isDisconnected(cp)) return aiDecide(gs, cp.id)
  return null
}

// 服务器执行托管动作（不走 handleAction 权限校验——动作来源可信）
export function applyServerAction(room, action) {
  applyAction(room, action)
}

export function addChat(socketId, text) {
  const room = findRoomBySocket(socketId)
  if (!room) return null
  const player = room.players.find((p) => p.socketId === socketId)
  const msg = {
    from: player?.name ?? '匿名',
    text: String(text ?? '').slice(0, 200),
    time: Date.now(),
  }
  if (!msg.text.trim()) return null
  room.chat.push(msg)
  if (room.chat.length > 100) room.chat.shift()
  return msg
}

// 删除房间（清定时器 + 出 Map）—— 供游戏结束清理/空房清理调用
export function removeRoom(roomId) {
  const room = rooms.get(roomId)
  if (!room) return false
  if (room._cleanupTimer) clearTimeout(room._cleanupTimer)
  if (room._aiTimer) clearTimeout(room._aiTimer)
  if (room.turnTimer) clearInterval(room.turnTimer) // 回合倒计时也是定时器，漏清会永久泄漏
  room._cleanupTimer = null
  room._aiTimer = null
  room.turnTimer = null
  return rooms.delete(roomId)
}

export function count() { return rooms.size }

// ===== 新增：游戏菜单功能 =====

// 添加游戏日志
export function addLog(roomId, message) {
  const room = rooms.get(roomId)
  if (!room) return null
  const msg = { time: Date.now(), message }
  room.gameLog = room.gameLog || []
  room.gameLog.push(msg)
  if (room.gameLog.length > 100) room.gameLog.shift()
  return msg
}

// 获取游戏日志
export function getLog(roomId) {
  const room = rooms.get(roomId)
  return room?.gameLog || []
}

// ===== 玩家出局清算（投降/被踢共用）=====
// 关键约束：不从 gameState.players 数组删除元素（避免 turnIndex/ap.turn 索引移位），
// 只标记 alive=false，让既有回合推进/拍卖/胜负逻辑自然跳过。
function checkEliminationWinner(gs) {
  const alive = gs.players.filter((p) => p.alive)
  if (alive.length === 1) {
    gs.status = 'finished'
    gs.winnerId = alive[0].id
    gs.log.push(`🏆 ${alive[0].name} 成为最后赢家！`)
  } else if (alive.length === 0) {
    gs.status = 'finished'
    gs.winnerId = null
    gs.log.push('🏳️ 已无存活玩家，对局结束')
  }
}

// 手动把回合推进到下一个存活玩家（玩家在走格/分岔/拍卖等中途出局时用；
// 不走 nextTurn —— 那套带回合结算副作用，出局路径不该触发）
function advanceTurnPastDead(gs) {
  const prev = gs.turnIndex
  let next = (prev + 1) % gs.players.length
  let guard = 0
  while (!gs.players[next]?.alive && guard++ <= gs.players.length) {
    next = (next + 1) % gs.players.length
  }
  if (!gs.players[next]?.alive) return // 没有存活玩家了（胜负判定兜底）
  if (next <= prev) gs.round += 1 // 绕圈 → 回合数 +1（与 nextTurn 口径一致）
  gs.turnIndex = next
  gs.dice = null
  gs.stepsRemaining = 0
  gs.pending = null
  gs.phase = 'roll'
  gs.shopShownTurn = false
  gs.lotteryBoughtTurn = false
  const np = gs.players[next]
  np.cardUsed = false
  gs.players[prev].firstTurn = false // 与 nextTurn 口径一致：清刚结束回合的 prev，不清下一位
  for (const p of gs.players) {
    if (p.upgradableTiles) p.upgradableTiles = []
  }
}

function eliminatePlayer(room, playerId, reason) {
  const gs = room.gameState
  if (!gs || gs.status !== 'playing') return
  const gp = gs.players.find((p) => p.id === playerId)
  if (!gp || !gp.alive) return

  // 资产清算（与破产同口径）
  gp.alive = false
  gp.bankrupt = true
  gp.properties = []
  gp.levels = {}
  gp.mortgaged = {}
  gp.stockHoldings = {}
  gp.loan = 0
  gp.loanDue = 0
  gp.loanRepay = 0
  gp.skipTurns = 0
  gp.jailLeft = 0
  gs.log.push(`${gp.name} ${reason}`)
  gs.log.push(`💸 ${gp.name} 出局！`)

  // 涉及出局者的待处理交易 → 取消
  if (gs.pending?.kind === 'trade' && (gs.pending.from === playerId || gs.pending.to === playerId)) {
    gs.log.push(`❌ 交易提案因 ${gp.name} 出局而取消`)
    gs.pending = null
  }
  // 拍卖中 → 流拍（出价轮转/计数依赖存活名单，简单起见直接取消）
  if (gs.pending?.kind === 'auction') {
    gs.log.push(`🔨 拍卖因 ${gp.name} 出局而流拍`)
    gs.pending = null
    gs.phase = 'roll'
  }

  // 开局定序阶段：不推进回合（出局者剩余的掷骰由托管调度自动代掷）
  if (gs.phase === 'order' && gs.orderState && !gs.orderState.done) {
    checkEliminationWinner(gs)
    return
  }

  // 出局者正是当前回合玩家 → 推进回合
  if (gs.players[gs.turnIndex]?.id === playerId) {
    if (gs.phase === 'landed') {
      gs.pending = null
      // 走标准 END_TURN（nextTurn 内含回合结算与胜负判定）
      room.gameState = gameReducer(gs, { type: 'END_TURN' })
      return
    }
    advanceTurnPastDead(gs) // 走格/分岔/拍卖中途出局
  }
  checkEliminationWinner(gs)
}

// 认输
export function surrender(socketId) {
  const room = findRoomBySocket(socketId)
  if (!room || !room.gameState) return { error: '游戏未开始' }
  const player = room.players.find(p => p.socketId === socketId)
  if (!player) return { error: '不在房间' }
  const gp = room.gameState.players.find(p => p.id === player.id)
  if (!gp?.alive) return { error: '你已出局，无需投降' }

  addLog(room.roomId, `${player.name} 投降了`)
  // 走完整出局清算：置 alive=false、清资产、处理 pending、推进回合、判胜负
  eliminatePlayer(room, player.id, '投降认输')
  return { ok: true, room, log: getLog(room.roomId) }
}

// 暂停/继续
export function togglePause(socketId) {
  const room = findRoomBySocket(socketId)
  if (!room) return { error: '不在房间' }
  if (!isHost(room, socketId)) return { error: '只有房主可以暂停' }
  room.paused = !room.paused
  addLog(room.roomId, room.paused ? '游戏已暂停' : '游戏继续')
  return { ok: true, room, paused: room.paused }
}

// AI 托管开关（仅房主）
export function toggleAITakeover(socketId) {
  const room = findRoomBySocket(socketId)
  if (!room) return { error: '不在房间' }
  if (!isHost(room, socketId)) return { error: '只有房主可以切换 AI 托管' }
  room.aiTakeover = !room.aiTakeover
  addLog(room.roomId, room.aiTakeover ? 'AI 托管已开启' : 'AI 托管已关闭')
  return { ok: true, room, aiTakeover: room.aiTakeover }
}

// 踢人
export function kickPlayer(socketId, targetId) {
  const room = findRoomBySocket(socketId)
  if (!room) return { error: '不在房间' }
  if (!isHost(room, socketId)) return { error: '只有房主可以踢人' }
  const kicker = room.players.find(p => p.socketId === socketId)
  if (kicker && kicker.id === targetId) return { error: '不能踢自己' }

  const target = room.players.find(p => p.id === targetId)
  if (!target) return { error: '玩家不存在' }

  const targetSocketId = target.socketId // 移除前留存，供 index.js 通知被踢客户端
  addLog(room.roomId, `${target.name} 被踢出房间`)

  if (room.status === 'playing') {
    // 对局中踢人 = 判出局（不从 gameState.players 删元素，避免索引移位卡死对局）
    eliminatePlayer(room, targetId, '被房主移出房间')
  }

  // 从房间名单移除（不可再重连找回座位）
  room.players = room.players.filter(p => p.id !== targetId)

  // 防御：万一被踢的是房主（正常路径踢不到），转移房主
  if (room.hostPlayerId === targetId && room.players.length > 0) {
    room.hostPlayerId = room.players[0].id
    room.hostId = room.players[0].socketId
    room.players[0].ready = true
  }
  return { ok: true, room, targetSocketId }
}

// 设置房间密码
export function setPassword(socketId, password) {
  const room = findRoomBySocket(socketId)
  if (!room) return { error: '不在房间' }
  if (!isHost(room, socketId)) return { error: '只有房主可以设置密码' }
  room.password = password || null
  return { ok: true, room }
}

// 获取房间密码
export function getPassword(roomId) {
  const room = rooms.get(roomId)
  return room?.password || null
}
