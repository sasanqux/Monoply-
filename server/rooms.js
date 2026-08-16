// rooms.js — 房间管理：创建/加入/离开/查找/游戏操作
import { gameReducer, createInitialState, PLAYER_COLORS } from './game/reducer.js';
import { currentPlayer } from './game/turn.js';

const rooms = new Map();

// 生成 6 位房间码（大写字母+数字，去掉易混字符 0/O/1/I）
function genRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do {
    id = '';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(id));
  return id;
}

export function createRoom(hostName, settings = {}) {
  const roomId = genRoomId();
  const room = {
    roomId,
    status: 'waiting', // waiting | playing | finished
    hostId: null,
    settings: {
      maxTurns: settings.maxTurns ?? 40,
      startMoney: settings.startMoney ?? 20000,
      maxPlayers: settings.maxPlayers ?? 8,
    },
    players: [],
    gameState: null,
    chat: [],
    createdAt: Date.now(),
  };
  rooms.set(roomId, room);
  return room;
}

export function joinRoom(roomId, playerName, socketId, color) {
  const room = rooms.get(roomId);
  if (!room) return { error: '房间不存在' };
  if (room.status !== 'waiting') return { error: '游戏已开始，无法加入' };
  if (room.players.length >= room.settings.maxPlayers) return { error: '房间已满' };
  if (room.players.some(p => p.name === playerName)) return { error: '名字已被使用' };

  // 检查颜色是否重复
  const usedColors = room.players.map(p => p.color);
  let finalColor = color;
  if (!finalColor || usedColors.includes(finalColor)) {
    // 自动分配一个未使用的颜色
    finalColor = PLAYER_COLORS.find(c => !usedColors.includes(c)) || PLAYER_COLORS[0];
  }

  const playerId = 'p' + (room.players.length + 1);
  const player = {
    id: playerId,
    name: playerName,
    socketId,
    isAI: false,
    ready: false,
    color: finalColor,
  };
  room.players.push(player);

  // 第一个加入的是房主
  if (!room.hostId) {
    room.hostId = socketId;
    player.ready = true;
  }

  return { room, playerId };
}

export function leaveRoom(socketId) {
  for (const [roomId, room] of rooms) {
    const idx = room.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) continue;

    const wasHost = room.hostId === socketId;
    room.players.splice(idx, 1);

    if (wasHost && room.players.length > 0) {
      // 房主转移给下一个玩家
      room.hostId = room.players[0].socketId;
      room.players[0].ready = true;
    }

    // 房间空了 → 删除
    if (room.players.length === 0) {
      rooms.delete(roomId);
      return { roomId, closed: true };
    }

    return { roomId, closed: false, room };
  }
  return null;
}

export function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.socketId === socketId)) return room;
  }
  return null;
}

export function startGame(socketId) {
  const room = findRoomBySocket(socketId);
  if (!room) return { error: '不在房间' };
  if (room.hostId !== socketId) return { error: '你不是房主' };
  if (room.players.length < 2) return { error: '至少需要 2 名玩家' };

  // 用真实玩家数据创建初始状态
  room.gameState = createInitialState({
    players: room.players.map(p => ({ id: p.id, name: p.name, isAI: false })),
    maxTurns: room.settings.maxTurns,
    startMoney: room.settings.startMoney,
  });
  room.status = 'playing';
  return { ok: true, room, gameState: room.gameState };
}

export function handleAction(socketId, action) {
  const room = findRoomBySocket(socketId);
  if (!room || !room.gameState) return { error: '游戏未开始' };

  // 验证是当前玩家的回合
  const cur = currentPlayer(room.gameState);
  const player = room.players.find(p => p.socketId === socketId);
  if (!player || player.id !== cur.id) return { error: '还没轮到你' };

  // 执行 action
  room.gameState = gameReducer(room.gameState, action);
  return { ok: true, room, gameState: room.gameState };
}

export function addChat(socketId, text) {
  const room = findRoomBySocket(socketId);
  if (!room) return null;
  const player = room.players.find(p => p.socketId === socketId);
  const msg = {
    from: player?.name ?? '匿名',
    text: String(text).slice(0, 200),
    time: Date.now(),
  };
  room.chat.push(msg);
  if (room.chat.length > 100) room.chat.shift();
  return msg;
}

export function count() { return rooms.size; }
