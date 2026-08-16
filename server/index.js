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

// 广播房间状态（给每个玩家发自己的视角）
function broadcastRoom(room) {
  for (const p of room.players) {
    if (!p.socketId) continue;
    // 给每个玩家发一份 state（隐藏他人手牌）
    const gs = room.gameState;
    const masked = gs ? {
      ...gs,
      players: gs.players.map(pl => ({
        ...pl,
        hand: pl.id === p.id ? pl.hand : undefined,
      })),
    } : null;
    io.to(p.socketId).emit('roomUpdate', {
      roomId: room.roomId,
      status: room.status,
      hostId: room.hostId,
      settings: room.settings,
      players: room.players.map(pl => ({
        id: pl.id,
        name: pl.name,
        color: pl.color,
        ready: pl.ready,
        isHost: pl.socketId === room.hostId,
      })),
      gameState: masked,
      chat: room.chat,
    });
  }
}

// 广播游戏状态（拍卖脱敏）
function broadcastGameState(room, moveInfo = null) {
  for (const p of room.players) {
    if (!p.socketId) continue;
    const gs = room.gameState;
    let stateToSend = gs;

    // 拍卖中：对非当前出价方隐藏 bids
    if (gs?.phase === 'auction' && gs.pending?.kind === 'auction') {
      stateToSend = { ...gs, pending: { ...gs.pending, bids: {} } };
    }

    io.to(p.socketId).emit('gameState', {
      state: stateToSend,
      currentPlayerId: gs?.players[gs.turnIndex]?.id ?? null,
      myPlayerId: p.id,
      moveInfo,
    });
  }

  // 游戏结束 → 延迟清理房间（让客户端有时间显示结果）
  if (room.gameState?.status === 'finished' && !room._cleanupTimer) {
    room._cleanupTimer = setTimeout(() => {
      rooms.delete(room.roomId);
      console.log(`[cleanupRoom] ${room.roomId} (game finished)`);
    }, 60000);
  }
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

  // 加入房间
  socket.on('joinRoom', ({ roomId, playerName, color }, cb) => {
    try {
      const result = joinRoom(roomId, playerName || '玩家', socket.id, color);
      if (result.error) {
        if (cb) cb({ error: result.error });
        return;
      }
      socket.join(roomId);
      console.log(`[joinRoom] ${playerName} joined ${roomId}`);
      if (cb) cb({ ok: true, playerId: result.playerId });
      broadcastRoom(result.room);
    } catch (e) {
      console.error('[joinRoom] error:', e);
      if (cb) cb({ error: e.message });
    }
  });

  // 开始游戏
  socket.on('startGame', (cb) => {
    try {
      const result = startGame(socket.id);
      if (result.error) {
        if (cb) cb({ error: result.error });
        return;
      }
      console.log(`[startGame] ${result.room.roomId} started`);
      io.to(result.room.roomId).emit('gameStart', { room: result.room });
      broadcastGameState(result.room);
      if (cb) cb({ ok: true });
    } catch (e) {
      console.error('[startGame] error:', e);
      if (cb) cb({ error: e.message });
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
      broadcastGameState(result.room, result.moveInfo);
      if (cb) cb({ ok: true, moveInfo: result.moveInfo });
    } catch (e) {
      console.error('[action] error:', e);
      if (cb) cb({ error: e.message });
    }
  });

  // 离开房间
  socket.on('leaveRoom', () => {
    const room = leaveRoom(socket.id);
    if (room) broadcastRoom(room);
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
      broadcastRoom(result.room);
    }
  });
});

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
  console.log(`\n🎮 重庆大富翁服务器: http://localhost:${PORT}\n`);
});
