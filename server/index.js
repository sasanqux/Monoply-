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
} from './rooms.js';

const app = express();
app.use(cors());
app.use(express.json());

// 服务 dist/ 静态文件
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, '../dist')));

// 健康检查
app.get('/health', (req, res) => res.json({ ok: true, rooms: count() }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// 大厅视角的玩家列表（不含 socketId 等内部字段）
function lobbyPlayers(room) {
  return room.players.map((pl) => ({
    id: pl.id,
    name: pl.name,
    color: pl.color,
    ready: pl.ready,
    disconnected: !!pl.disconnected,
    isHost: pl.socketId === room.hostId,
  }));
}

// 广播房间状态（大厅用；对局中掉线的玩家标出"重新连接中"）
function broadcastRoom(room) {
  for (const p of room.players) {
    if (!p.socketId) continue;
    io.to(p.socketId).emit('roomUpdate', {
      roomId: room.roomId,
      status: room.status,
      hostId: room.hostId,
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

  return {
    ...stateToSend,
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
  });
}

// 广播游戏状态（全员视角各一份）+ 结束清理 + 掉线托管调度
function broadcastGameState(room) {
  for (const p of room.players) {
    emitGameStateTo(room, p);
  }

  if (room.gameState?.status === 'finished' && !room._cleanupTimer) {
    const roomId = room.roomId;
    room._cleanupTimer = setTimeout(() => {
      removeRoom(roomId); // 清定时器 + 出 Map（不直接摸模块私有 rooms）
      console.log(`[cleanupRoom] ${roomId} (game finished)`);
    }, 60000);
  }

  scheduleServerAI(room);
}

// ===== 掉线托管调度：轮到掉线玩家时服务器代打，直到回到真人回合 =====
function scheduleServerAI(room) {
  if (!room?.gameState || room.gameState.status !== 'playing') return;
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
    try {
      const room = createRoom(playerName || '房主', settings);
      const { playerId } = joinRoom(room.roomId, playerName || '房主', socket.id, color);
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
  socket.on('joinRoom', ({ roomId, playerName, color }, cb) => {
    try {
      const result = joinRoom(roomId, playerName, socket.id, color);
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
    try {
      const result = handleAction(socket.id, action);
      if (result.error) {
        if (cb) cb({ error: result.error });
        return;
      }
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
    if (result?.room && result.room.status === 'playing') {
      // 对局中主动离开：转托管并广播最新视角
      broadcastGameState(result.room);
    } else if (result?.room) {
      broadcastRoom(result.room);
    }
  });

  // 聊天
  socket.on('chat', ({ text }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const msg = addChat(socket.id, text);
    if (msg) io.to(room.roomId).emit('chat', msg);
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
httpServer.listen(PORT, () => {
  console.log(`\n🎮 大富翁——重庆之旅服务器: http://localhost:${PORT}\n`);
});
