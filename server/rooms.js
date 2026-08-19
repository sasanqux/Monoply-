// rooms.js — 房间管理：创建/加入/离开/准备/开始/游戏操作/掉线托管/清理
// 游戏逻辑统一 import 自 shared/game（与前端共用同一份，消灭双副本漂移）
import { gameReducer, createInitialState, aiDecide, currentPlayer, PLAYER_COLORS } from '../shared/game/index.js'

const rooms = new Map()

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
  const roomId = genRoomId()
  const room = {
    roomId,
    status: 'waiting', // waiting | playing | finished
    hostId: null,
    settings: sanitizeSettings(settings),
    players: [],
    playerSeq: 0, // 玩家 ID 自增序号（防"退出再加人"ID 碰撞）
    gameState: null,
    chat: [],
    createdAt: Date.now(),
    _cleanupTimer: null,
    _aiTimer: null,
    _aiGuard: 0, // 连续 AI 托管动作计数（防死循环）
  }
  rooms.set(roomId, room)
  return room
}

export function joinRoom(roomId, playerName, socketId, color) {
  const room = rooms.get(roomId)
  if (!room) return { error: '房间不存在' }
  const name = sanitizeName(playerName)

  // 对局中断线重连：同名玩家找回原座位（掉线期间由 AI 托管）
  if (room.status === 'playing') {
    const dc = room.players.find((p) => p.disconnected && p.name === name)
    if (dc) {
      dc.socketId = socketId
      dc.disconnected = false
      const gp = room.gameState?.players.find((p) => p.id === dc.id)
      if (gp) gp.isAI = false
      room._aiGuard = 0
      return { room, playerId: dc.id, rejoined: true }
    }
    return { error: '游戏已开始，只能用掉线前的昵称重连' }
  }

  if (room.status !== 'waiting') return { error: '游戏已开始，无法加入' }
  if (room.players.length >= room.settings.maxPlayers) return { error: '房间已满' }
  if (room.players.some((p) => p.name === name)) return { error: '名字已被使用' }

  // 检查颜色是否重复
  const usedColors = room.players.map((p) => p.color)
  let finalColor = color
  if (!finalColor || usedColors.includes(finalColor)) {
    // 自动分配一个未使用的颜色
    finalColor = PLAYER_COLORS.find((c) => !usedColors.includes(c)) || PLAYER_COLORS[0]
  }

  const playerId = 'p' + ++room.playerSeq
  const player = {
    id: playerId,
    name,
    socketId,
    isAI: false,
    ready: false,
    color: finalColor,
    disconnected: false,
  }
  room.players.push(player)

  // 第一个加入的是房主
  if (!room.hostId) {
    room.hostId = socketId
    player.ready = true
  }

  return { room, playerId }
}

// 准备/取消准备（非房主玩家）
export function toggleReady(socketId) {
  const room = findRoomBySocket(socketId)
  if (!room || room.status !== 'waiting') return null
  const player = room.players.find((p) => p.socketId === socketId)
  if (!player || room.hostId === socketId) return room // 房主恒已准备
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
    const wasHost = room.hostId === socketId
    room.players.splice(idx, 1)
    if (wasHost && room.players.length > 0) {
      // 房主转移给下一个玩家
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
  if (room.hostId !== socketId) return { error: '你不是房主' }
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

  // 其余操作：仅当前回合玩家
  if (!cur || player.id !== cur.id) return { error: '还没轮到你' }

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
export function serverNextAction(room) {
  const gs = room.gameState
  if (!gs || gs.status !== 'playing') return null
  const isDisconnected = (gp) =>
    !!gp && !!room.players.find((rp) => rp.id === gp.id)?.disconnected

  // 开局掷骰定顺序：轮到掉线玩家也由服务器代掷
  if (gs.phase === 'order' && gs.orderState && !gs.orderState.done) {
    const orderP = gs.players[gs.orderState.index]
    if (isDisconnected(orderP)) return { type: 'ROLL_ORDER' }
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
  room._cleanupTimer = null
  room._aiTimer = null
  return rooms.delete(roomId)
}

export function count() { return rooms.size }
