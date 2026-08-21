// socket.js — Socket.IO 客户端封装
import { io } from 'socket.io-client';

let socket = null;

// App 端默认服务器（可被设置覆盖）
const DEFAULT_SERVER = 'http://110.42.227.121:8080';

export function connect(serverUrl) {
  if (socket) return socket;
  // 优先级：传入参数 > localStorage 设置 > 默认地址
  // 注意：Capacitor App 里 window.location.origin 是 file:// 或 localhost，不能作为 fallback
  const url = serverUrl || localStorage.getItem('monopoly_server') || DEFAULT_SERVER;
  socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity, // 回合制游戏：掉线就无限重试，不轻易放弃座位
  });
  return socket;
}

// 允许 App 端设置/更换服务器地址
export function setServerUrl(url) {
  localStorage.setItem('monopoly_server', url);
}

export function disconnect() {
  if (socket) { socket.disconnect(); socket = null; }
}

export function getSocket() { return socket; }
export function isConnected() { return socket?.connected ?? false; }
