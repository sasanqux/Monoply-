// index.js — Express + Socket.IO 服务器入口
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  createRoom, joinRoom, leaveRoom, findRoomBySocket,
  startGame, handleAction, addChat, count,
  toggleReady, removeRoom, serverNextAction, applyServerAction,
  addLog, getLog, surrender, togglePause, toggleAITakeover, kickPlayer, setPassword, getPassword,
  getRoom, restoreAllRooms,
} from './rooms.js';
import { loadSnapshots } from './persist.js';
import { aiDecide, currentPlayer } from '../shared/game/index.js';

// ===== CORS 收紧 =====
// 生产环境（NODE_ENV=production）只允许 CORS_ORIGIN 配置的源跨域；
// 没配则拒绝所有跨域（前后端同源部署不受影响——同源请求不触发 CORS）。
// 开发环境全开，方便 vite dev server (5173) 连后端 (8080)。
// 多个源用逗号分隔：CORS_ORIGIN=https://a.com,https://b.com
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  : null
const corsOrigin = process.env.NODE_ENV === 'production'
  ? (allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : false)
  : true
const corsOptions = corsOrigin === true ? undefined : { origin: corsOrigin }

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

// 服务 dist/ 静态文件
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, '../dist')));

// 健康检查
app.get('/health', (req, res) => res.json({ ok: true, rooms: count() }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: corsOrigin },
  maxHttpBufferSize: 1e5, // 限制单次 payload 100KB（防超大包；正常 action 远小于此）
  pingInterval: 10000,
  pingTimeout: 5000,
});

// ===== 简单限流（per-socket 令牌桶，无第三方依赖）=====
// 每个 socket 一个桶；令牌按时间线性恢复；超限返回 false。
// WeakMap 以 socket 为 key，断开连接后自动 GC，不泄漏。
const limitBuckets = new WeakMap()
function rateLimit(socket, { max, windowMs }) {
  const now = Date.now()
  let b = limitBuckets.get(socket)
  if (!b) {
    b = { tokens: max, last: now }
    limitBuckets.set(socket, b)
  }
  const elapsed = now - b.last
  b.tokens = Math.min(max, b.tokens + (elapsed / windowMs) * max)
  b.last = now
  if (b.tokens < 1) return false
  b.tokens -= 1
  return true
}

// 各事件限流参数（要调改这里即可）
const LIMITS = {
  action: { max: 50, windowMs: 3000 },     // 突发 50、每秒回 ~17（真人远碰不到；挡 50+/秒 脚本洪水）
  chat: { max: 5, windowMs: 6000 },        // 约 1 秒 1 条聊天（突发 5 条）
  joinRoom: { max: 10, windowMs: 10000 },  // 10 秒 10 次尝试（防房间码/密码爆破）
  createRoom: { max: 3, windowMs: 60000 }, // 60 秒 3 个房间（防刷房占满）
  ready: { max: 5, windowMs: 1000 },       // 每秒 5 次准备切换（防 roomUpdate 广播放大）
  surrender: { max: 2, windowMs: 1000 },   // 每秒 2 次认输（防 logUpdate/gameState 广播放大）
}

// 大厅视角的玩家列表（不含 socketId 等内部字段）
function lobbyPlayers(room) {
  return room.players.map((pl) => ({
    id: pl.id,
    name: pl.name,
    color: pl.color,
    ready: pl.ready,
    disconnected: !!pl.disconnected,
    isHost: pl.id === room.hostPlayerId,
  }));
}

// 广播房间状态（大厅用；对局中掉线的玩家标出"重新连接中"）
function broadcastRoom(room) {
  for (const p of room.players) {
    if (!p.socketId) continue;
    io.to(p.socketId).emit('roomUpdate', {
      roomId: room.roomId,
      status: room.status,
      settings: room.settings,
      players: lobbyPlayers(room),
      gameState: null, // 大厅不带对局状态
      chat: room.chat,
    });
  }
}

// 按玩家视角生成 gameState（隐藏他人手牌；拍卖出价阶段只保留自己的出价）
function stateFor(room, viewer) {
  const gs = room.gameState;
  if (!gs) return null;
  let stateToSend = gs;

  // 盲拍出价阶段（roundStep=0）：他人出价不可见，自己的可见（确认已提交）
  if (gs.phase === 'auction' && gs.pending?.kind === 'auction' && gs.pending.roundStep === 0) {
    const own = gs.pending.bids[viewer.id];
    stateToSend = {
      ...gs,
      pending: {
        ...gs.pending,
        bids: own != null ? { [viewer.id]: own } : {},
      },
    };
  }

  // 股票事件脱敏：黑市/红市卡产生的事件（带 byPlayerId）只发给用卡人；随机公共事件全员可见
  const stockRuntime = {};
  for (const [code, rt] of Object.entries(stateToSend.stockRuntime || {})) {
    stockRuntime[code] = rt.activeEvents?.some((e) => e.byPlayerId)
      ? { ...rt, activeEvents: rt.activeEvents.filter((e) => !e.byPlayerId || e.byPlayerId === viewer.id) }
      : rt;
  }

  return {
    ...stateToSend,
    stockRuntime,
    players: stateToSend.players.map((pl) => ({
      ...pl,
      hand: pl.id === viewer.id ? pl.hand : undefined, // 手牌只发本人
    })),
  };
}

// 给单个玩家发一帧 gameState（重连/断线重入时补发）
function emitGameStateTo(room, player) {
  if (!player.socketId) return;
  const gs = room.gameState;
  io.to(player.socketId).emit('gameState', {
    state: stateFor(room, player),
    currentPlayerId: gs?.players[gs.turnIndex]?.id ?? null,
    myPlayerId: player.id,
    isHost: player.id === room.hostPlayerId, // 前端据此显示房主菜单（暂停/踢人/设密码）
  });
}

// 超时代打：覆盖所有 phase，找出"该行动的人"并替他走一步
// 关键：拍卖出价阶段该动的是 pending.turn 指向的出价者，不是 currentPlayer，
// 旧逻辑只对 currentPlayer 调 aiDecide 会在拍卖挂机时返回 null → 永久卡死
function timeoutAction(room) {
  const gs = room.gameState
  if (!gs || gs.status !== 'playing') return null
  // 开局定序：替 os.index 玩家掷骰（不管掉线与否）
  if (gs.phase === 'order' && gs.orderState && !gs.orderState.done) {
    const orderP = gs.players[gs.orderState.index]
    if (!orderP) return null
    return { type: 'ROLL_ORDER' }
  }
  // 交易 pending：对方超时未响应 → 拒绝（防止发起方回合被无限占用）
  if (gs.pending?.kind === 'trade') {
    return { type: 'TRADE_REJECT' }
  }
  // 拍卖
  if (gs.phase === 'auction' && gs.pending?.kind === 'auction') {
    const ap = gs.pending
    if (ap.roundStep === 1) return { type: 'AUCTION_REVEAL' } // 揭晓阶段卡住 → 代触发
    const bidder = gs.players[ap.turn]
    if (!bidder || !bidder.alive) return null
    // 超时代出 0（放弃）：不替玩家花冤枉钱
    return { type: 'AUCTION_BID', amount: 0 }
  }
  // 分岔：替当前玩家随机选一条
  if (gs.phase === 'fork' && gs.pending?.kind === 'fork') {
    const opts = gs.pending.options.length ? gs.pending.options : [gs.pending.chosen]
    return { type: 'CHOOSE_FORK', tileId: opts[Math.floor(Math.random() * opts.length)] }
  }
  // 其余：当前玩家走 AI 决策
  const cp = currentPlayer(gs)
  if (!cp) return null
  return aiDecide(gs, cp.id)
}

// 回合倒计时：仅当"该行动的人"变化（_timerTurnKey 变化）或定时器未启动时才重置 30 秒；
// 同一回合内的普通 action 广播不重置，剩余时间继续走（否则发交易/聊天等任意广播都会满血重置）
function startTurnTimer(room) {
  const gs = room.gameState
  if (!gs) return
  // 开局定序阶段"回合"= orderState.index（轮到谁掷）；正式对局 = turnIndex@round
  const turnKey = gs.phase === 'order' && gs.orderState && !gs.orderState.done
    ? `order@${gs.orderState.index}`
    : `${gs.turnIndex}@${gs.round}`
  // 同一回合且定时器还活着 → 不动，倒计时继续
  if (room.turnTimer && room._timerTurnKey === turnKey) return
  room._timerTurnKey = turnKey
  clearInterval(room.turnTimer)
  room.turnTimeLeft = 30
  room.turnTimer = setInterval(() => {
    try {
      if (room.paused) return
      // 对局已结束/房间已清 → 停表（防结束后继续倒计时并触发代打）
      if (!room.gameState || room.gameState.status !== 'playing') {
        clearInterval(room.turnTimer)
        room.turnTimer = null
        return
      }
      room.turnTimeLeft--
      io.to(room.roomId).emit('timerUpdate', { time: room.turnTimeLeft })
      if (room.turnTimeLeft <= 0) {
        clearInterval(room.turnTimer)
        room.turnTimer = null // 置空：超时代打若未推进回合，下次广播可凭空定时器重启
        // 超时代打：统一走 timeoutAction（覆盖拍卖/交易/分岔/定序等所有 phase），
        // 避免拍卖挂机时 aiDecide(currentPlayer) 返回 null 导致全桌永久卡死
        const action = timeoutAction(room)
        if (action) {
          applyServerAction(room, action)
          addLog(room.roomId, '⏰ 超时未操作，系统代打')
          broadcastGameState(room)
        }
      }
    } catch (e) {
      // 定时器异常绝不能击穿进程（历史上这里因缺 import 直接崩服）
      console.error('[turnTimer] error:', e)
      clearInterval(room.turnTimer)
      room.turnTimer = null
    }
  }, 1000)
}

// 广播游戏状态（全员视角各一份）+ 结束清理 + 掉线托管调度
function broadcastGameState(room) {
  for (const p of room.players) {
    emitGameStateTo(room, p);
  }

  // 发送日志更新
  io.to(room.roomId).emit('logUpdate', room.gameLog || [])

  if (room.gameState?.status === 'finished' && !room._cleanupTimer) {
    clearInterval(room.turnTimer) // 对局结束立即停表，不等 60s 后的房间清理
    room.turnTimer = null
    const roomId = room.roomId;
    room._cleanupTimer = setTimeout(() => {
      removeRoom(roomId); // 清定时器 + 清 Map（不直接摸模块私有 rooms）
      console.log(`[cleanupRoom] ${roomId} (game finished)`);
    }, 60000);
  }

  // 启动回合倒计时（startTurnTimer 内按 _timerTurnKey 判断：仅"该行动的人"变化才重置 30 秒）
  if (room.gameState?.status === 'playing' && !room.paused) {
    startTurnTimer(room)
  }

  scheduleServerAI(room);
}

// ===== 掉线托管调度：轮到掉线玩家时服务器代打，直到回到真人回合 =====
function scheduleServerAI(room) {
  if (!room?.gameState || room.gameState.status !== 'playing') return;
  if (room.paused) return; // 暂停期间不托管（否则暂停形同虚设）
  const action = serverNextAction(room);
  if (!action) return;
  // 防死循环：连续托管动作超限即停（正常对局一轮最多几十个动作）
  if (room._aiGuard > 500) {
    console.error(`[serverAI] ${room.roomId} 连续托管动作超限，暂停托管`);
    return;
  }
  clearTimeout(room._aiTimer);
  room._aiTimer = setTimeout(() => {
    try {
      if (!room.gameState || room.gameState.status !== 'playing') return;
      if (room.paused) return; // 到点时已暂停 → 不执行，也不重排（等恢复暂停时重新调度）
      const next = serverNextAction(room); // 定时器到点后重新确认仍需托管
      if (!next) return;
      applyServerAction(room, next);
      room._aiGuard += 1;
      console.log(`[serverAI] ${room.roomId} 托管执行 ${next.type}`);
      broadcastGameState(room);
      // 连续托管（AI 一回合内多动作 / 掉线玩家连续回合）继续推进
      scheduleServerAI(room);
    } catch (e) {
      console.error('[serverAI] error:', e);
    }
  }, 900);
}

io.on('connection', (socket) => {
  console.log('[connect]', socket.id);

  // 创建房间
  socket.on('createRoom', ({ playerName, settings, color }, cb) => {
    if (!rateLimit(socket, LIMITS.createRoom)) {
      if (cb) cb({ error: '创建太频繁，请稍后再试' });
      return;
    }
    try {
      const room = createRoom(playerName || '房主', settings);
      if (!room) {
        if (cb) cb({ error: '服务器房间已满，请稍后再试' });
        return;
      }
      const joinResult = joinRoom(room.roomId, playerName || '房主', socket.id, color);
      if (joinResult.error) {
        // 房主入座失败 → 回滚删除刚创建的空房，防幽灵房间占坑
        removeRoom(room.roomId);
        if (cb) cb({ error: joinResult.error });
        return;
      }
      const { playerId } = joinResult;
      socket.join(room.roomId);
      console.log(`[createRoom] ${room.roomId} by ${playerName}`);
      if (cb) cb({ ok: true, roomId: room.roomId, playerId });
      broadcastRoom(room);
    } catch (e) {
      console.error('[createRoom] error:', e);
      if (cb) cb({ error: e.message });
    }
  });

  // 加入房间（大厅加入 / 对局中断线重连）
  socket.on('joinRoom', ({ roomId, playerName, color, password, playerId }, cb) => {
    if (!rateLimit(socket, LIMITS.joinRoom)) {
      if (cb) cb({ error: '尝试太频繁，请稍后再试' });
      return;
    }
    try {
      const result = joinRoom(roomId, playerName, socket.id, color, password, playerId);
      if (result.error) {
        if (cb) cb({ error: result.error });
        return;
      }
      socket.join(roomId);
      console.log(`[joinRoom] ${playerName} joined ${roomId}${result.rejoined ? ' (rejoin)' : ''}`);
      if (cb) cb({ ok: true, playerId: result.playerId, rejoined: !!result.rejoined });
      if (result.rejoined) {
        // 重连：直接推入对局（不再回大厅）
        const player = result.room.players.find((p) => p.socketId === socket.id);
        io.to(socket.id).emit('gameStart', { roomId });
        emitGameStateTo(result.room, player);
        broadcastRoom(result.room); // 通知其他人"他回来了"
      } else {
        broadcastRoom(result.room);
      }
    } catch (e) {
      console.error('[joinRoom] error:', e);
      if (cb) cb({ error: e.message });
    }
  });

  // 准备/取消准备
  socket.on('ready', (_payload, cb) => {
    if (!rateLimit(socket, LIMITS.ready)) {
      if (typeof cb === 'function') cb({ error: '操作太频繁，请稍候' })
      return
    }
    try {
      const ack = typeof cb === 'function' ? cb : null
      const room = toggleReady(socket.id)
      if (room) broadcastRoom(room)
      if (ack) ack({ ok: true })
    } catch (e) {
      console.error('[ready] error:', e)
      if (typeof cb === 'function') cb({ error: e.message })
    }
  })

  // 开始游戏
  socket.on('startGame', (_payload, cb) => {
    try {
      const ack = typeof cb === 'function' ? cb : null
      const result = startGame(socket.id)
      if (result.error) {
        if (ack) ack({ error: result.error })
        return
      }
      console.log(`[startGame] ${result.room.roomId} started`)
      // gameStart 只发轻量信号（不带 gameState，防手牌泄漏）；状态由随后的 gameState 广播携带
      io.to(result.room.roomId).emit('gameStart', { roomId: result.room.roomId })
      broadcastGameState(result.room)
      if (ack) ack({ ok: true })
    } catch (e) {
      console.error('[startGame] error:', e)
      if (typeof cb === 'function') cb({ error: e.message })
    }
  });

  // 游戏操作
  socket.on('action', (action, cb) => {
    if (!rateLimit(socket, LIMITS.action)) {
      if (cb) cb({ error: '操作太频繁，请稍候' });
      return;
    }
    console.log('[action]', action?.type, 'from', socket.id);
    try {
      const result = handleAction(socket.id, action);
      if (result.error) {
        console.log('[action] rejected:', result.error);
        if (cb) cb({ error: result.error });
        return;
      }
      console.log('[action] ok, broadcasting');
      broadcastGameState(result.room);
      if (cb) cb({ ok: true });
    } catch (e) {
      console.error('[action] error:', e);
      if (cb) cb({ error: e.message });
    }
  });

  // 离开房间
  socket.on('leaveRoom', () => {
    const result = leaveRoom(socket.id);
    if (!result) return;
    socket.leave(result.roomId); // 退出 socket.io 房间（否则仍会收到旧房间的广播）
    if (result.room && result.room.status === 'playing') {
      // 对局中主动离开：转托管并广播最新视角
      broadcastGameState(result.room);
    } else if (result.room) {
      broadcastRoom(result.room);
    }
  });

  // 聊天
  socket.on('chat', ({ text }) => {
    if (!rateLimit(socket, LIMITS.chat)) return; // 限流静默丢弃，不打扰
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const msg = addChat(socket.id, text);
    if (msg) io.to(room.roomId).emit('chat', msg);
  });

  // 游戏日志
  socket.on('getLog', ({ roomId }, cb) => {
    // 成员校验：只允许读取自己所在房间的日志（防任意 socket 枚举房间码窃取日志）
    const room = findRoomBySocket(socket.id);
    if (!room || room.roomId !== roomId) {
      if (cb) cb([]);
      return;
    }
    const logs = getLog(roomId);
    if (cb) cb(logs);
  });

  // 认输
  socket.on('surrender', ({ roomId }, cb) => {
    if (!rateLimit(socket, LIMITS.surrender)) {
      if (cb) cb({ error: '操作太频繁，请稍候' });
      return;
    }
    try {
      const result = surrender(socket.id);
      if (result.error) {
        if (cb) cb({ error: result.error });
        return;
      }
      // 用服务端的房间号广播，不信任客户端传的 roomId（防跨房间骚扰）
      io.to(result.room.roomId).emit('logUpdate', getLog(result.room.roomId));
      broadcastGameState(result.room);
      if (cb) cb({ ok: true });
    } catch (e) {
      if (cb) cb({ error: e.message });
    }
  });

  // 暂停/继续
  socket.on('togglePause', ({ roomId }, cb) => {
    try {
      const result = togglePause(socket.id);
      if (result.error) {
        if (cb) cb({ error: result.error });
        return;
      }
      const rid = result.room.roomId;
      io.to(rid).emit('pauseUpdate', { paused: result.paused });
      io.to(rid).emit('logUpdate', getLog(rid));
      // 恢复时重启回合倒计时 + 重新调度掉线托管（暂停期间两者都停了）
      if (result.room.gameState?.status === 'playing' && !result.paused) {
        broadcastGameState(result.room);
      }
      if (cb) cb({ ok: true });
    } catch (e) {
      if (cb) cb({ error: e.message });
    }
  });

  // AI 托管开关（仅房主）
  socket.on('toggleAITakeover', ({ roomId }, cb) => {
    try {
      const result = toggleAITakeover(socket.id);
      if (result.error) {
        if (cb) cb({ error: result.error });
        return;
      }
      const rid = result.room.roomId;
      io.to(rid).emit('aiTakeoverUpdate', { aiTakeover: result.aiTakeover });
      io.to(rid).emit('logUpdate', getLog(rid));
      if (cb) cb({ ok: true });
    } catch (e) {
      if (cb) cb({ error: e.message });
    }
  });

  // 踢人
  socket.on('kick', ({ roomId, targetId }, cb) => {
    try {
      const result = kickPlayer(socket.id, targetId);
      if (result.error) {
        if (cb) cb({ error: result.error });
        return;
      }
      const rid = result.room.roomId;
      // 通知被踢客户端并让其退出 socket 房间（否则其界面还停留在对局里）
      if (result.targetSocketId) {
        const tSocket = io.sockets.sockets.get(result.targetSocketId);
        if (tSocket) {
          tSocket.leave(rid);
          tSocket.emit('kicked', { roomId: rid });
        }
      }
      io.to(rid).emit('logUpdate', getLog(rid));
      if (result.room.gameState) broadcastGameState(result.room);
      broadcastRoom(result.room);
      if (cb) cb({ ok: true });
    } catch (e) {
      console.error('[kick] error:', e);
      if (cb) cb({ error: e.message });
    }
  });

  // 设置密码
  socket.on('setPassword', ({ roomId, password }, cb) => {
    try {
      const result = setPassword(socket.id, password);
      if (result.error) {
        if (cb) cb({ error: result.error });
        return;
      }
      if (cb) cb({ ok: true });
    } catch (e) {
      if (cb) cb({ error: e.message });
    }
  });

  // 延迟检测
  socket.on('ping_check', () => {
    socket.emit('pong_check');
  });

  // 主动请求状态（修复同步问题）
  socket.on('requestState', ({ roomId }) => {
    try {
      const room = getRoom(roomId); // rooms.js 导出的只读查询（rooms Map 是模块私有）
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) emitGameStateTo(room, player);
    } catch (e) {
      console.error('[requestState] error:', e);
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('[disconnect]', socket.id);
    const result = leaveRoom(socket.id);
    if (result?.closed) {
      console.log(`[closeRoom] ${result.roomId}`);
    } else if (result?.room) {
      if (result.room.status === 'playing') {
        // 掉线：转 AI 托管，继续推游戏
        broadcastGameState(result.room);
      } else {
        broadcastRoom(result.room);
      }
    }
  });
});

const PORT = process.env.PORT || 8080;

// 先恢复磁盘上的进行中对局，再开始监听（重连玩家进来时房间已就绪）
try {
  const snapshots = await loadSnapshots();
  const n = restoreAllRooms(snapshots);
  if (n > 0) console.log(`[persist] 已从磁盘恢复 ${n} 个进行中的对局`);
} catch (e) {
  console.error('[persist] 恢复快照失败（服务器照常启动）:', e.message);
}

httpServer.listen(PORT, () => {
  console.log(`\n🎮 大富翁——重庆之旅服务器: http://localhost:${PORT}\n`);
});
