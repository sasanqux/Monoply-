// socket.js — Socket.IO 客户端封装
import { io } from 'socket.io-client';

let socket = null;

export function connect(serverUrl) {
  if (socket) return socket;
  socket = io(serverUrl || window.location.origin, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });
  return socket;
}

export function disconnect() {
  if (socket) { socket.disconnect(); socket = null; }
}

export function getSocket() { return socket; }
export function isConnected() { return socket?.connected ?? false; }
