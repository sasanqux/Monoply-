# M4 联机设计方案 · 2026-08-15

> 目标：实现 2-8 人联机对局，服务器权威，房间码加入，断线重连。

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    玩家浏览器（Vue 前端）                    │
│                                                         │
│  玩家 A (房主)          玩家 B           玩家 C          │
│  ┌──────────┐        ┌──────────┐    ┌──────────┐     │
│  │ 创建房间  │        │ 输入房码  │    │ 输入房码  │     │
│  │ → 房间码  │        │ → 加入   │    │ → 加入   │     │
│  └────┬─────┘        └────┬─────┘    └────┬─────┘     │
│       │                   │               │            │
│       └───────── Socket.IO WebSocket ─────┘            │
│                         │                              │
└─────────────────────────┼──────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Node.js 服务器        │
              │   server/index.js       │
              │                         │
              │  ┌───────────────────┐  │
              │  │   Socket.IO        │  │
              │  │   (实时双向通信)     │  │
              │  └───────────────────┘  │
              │                         │
              │  ┌───────────────────┐  │
              │  │   rooms.js         │  │
              │  │   Map<id, Room>    │  │
              │  └───────────────────┘  │
              │                         │
              │  ┌───────────────────┐  │
              │  │   gameReducer()    │  │
              │  │   (规则计算引擎)     │  │
              │  │   从前端搬过来       │  │
              │  └───────────────────┘  │
              └─────────────────────────┘
```

**核心原则**：前端只发"操作指令"，服务器算完广播"最新局面"。

---

## 二、通信协议

### 客户端 → 服务器（emit）

| 事件名 | 携带数据 | 说明 |
|--------|----------|------|
| `createRoom` | `{ playerName, settings }` | 创建房间，返回房间码 |
| `joinRoom` | `{ roomId, playerName }` | 加入房间 |
| `leaveRoom` | — | 离开房间 |
| `startGame` | — | 房主开始游戏 |
| `action` | `{ type, ...payload }` | 游戏操作（掷骰/买地/用卡/...） |
| `chat` | `{ text }` | 聊天消息 |
| `disconnect` | — | 断线（自动触发） |

### 服务器 → 客户端（emit）

| 事件名 | 携带数据 | 说明 |
|--------|----------|------|
| `roomCreated` | `{ roomId, roomState }` | 房间创建成功 |
| `roomJoined` | `{ playerId, roomState }` | 加入成功 |
| `roomUpdate` | `roomState` | 房间状态变化（玩家加入/离开/准备） |
| `gameState` | `gameState` | 游戏局面广播（核心） |
| `yourTurn` | `{ actions }` | 轮到你了，列出可用操作 |
| `chat` | `{ from, text, time }` | 聊天消息 |
| `playerDisconnected` | `{ playerId }` | 有人断线 |
| `gameOver` | `{ winnerId, stats }` | 游戏结束 |
| `error` | `{ message }` | 错误提示 |

---

## 三、房间状态

```javascript
{
  roomId: "ABC123",           // 6位房间码
  status: "waiting" | "playing" | "finished",
  hostId: "p1",               // 房主 socket.id
  settings: { maxTurns, startMoney, players },
  players: [
    { id: "p1", name: "我", socketId: "xxx", ready: true, alive: true },
    { id: "p2", name: "阿蓝", socketId: "yyy", ready: true, alive: true },
    // ...
  ],
  gameState: { ... },         // 与单机版完全相同的 gameReducer 状态
  chat: [],                   // 聊天历史（上限 100 条）
  createdAt: 1723737600000,
}
```

---

## 四、游戏同步流程

```
房主点"开始"
  → 服务器 status: "waiting" → "playing"
  → 服务器广播 gameState（初始局面）

轮到玩家 A:
  → 服务器 emit "yourTurn" 给 A
  → A 的客户端显示操作按钮
  → A 拖骰子扔出 → emit "action: ROLL_DICE"
  → 服务器 gameReducer 计算 → dice/stepsRemaining
  → 服务器广播 gameState（dice 已出，等 STEP）
  → A 每 450ms emit "action: STEP"
  → 每次 STEP 服务器广播 gameState
  → 走完 → phase: "landed" → 广播最终局面
  → 下一个玩家...

轮到玩家 B:
  → 同 A
```

---

## 五、服务器文件结构

```
server/
  index.js              ← Express + Socket.IO 入口
  rooms.js              ← 房间管理（创建/加入/离开/查找）
  game/
    index.js            ← 统一出口（直接复制前端 game/index.js）
    reducer.js          ← 游戏规则（从前端搬来，去掉 Vue 依赖）
    board.js            ← 直接复制
    movement.js         ← 直接复制
    property.js         ← 直接复制
    card.js             ← 直接复制
    god.js              ← 直接复制
    stock.js            ← 直接复制
    stockEvents.js      ← 直接复制
    lottery.js          ← 直接复制
    turn.js             ← 直接复制
    ai.js               ← 直接复制
    gameOver.js         ← 直接复制
```

---

## 六、前端改动

### 新增文件

```
src/
  net/
    socket.js           ← Socket.IO 客户端封装
    lobby.js            ← 房间大厅状态管理
```

### 新增组件

```
src/components/
  Lobby.vue             ← 大厅界面（创建/加入房间/玩家列表）
  ChatPanel.vue         ← 聊天面板（复用之前预留的 UI）
```

### 修改 App.vue

```javascript
// 旧：本地算
function dispatch(action) {
  state.value = gameReducer(state.value, action)
}

// 新：发给服务器
function dispatch(action) {
  socket.emit('action', action)
}

// 监听服务器广播
socket.on('gameState', (newState) => {
  state.value = newState
})
```

### 路由

```
/                       ← 大厅（创建/加入房间）
/game/:roomId            ← 游戏界面（棋盘 + 操作面板）
```

---

## 七、断线重连

```
玩家断线:
  → 服务器标记 player.disconnected = true
  → 广播 "playerDisconnected"
  → 该玩家回合由 AI 托管（用 ai.js 决策）

玩家重连:
  → 输入房间码 + 名字重新加入
  → 服务器匹配到同一 playerId
  → 推送完整 gameState
  → 如果当前是 AI 托管中，交还控制权
```

---

## 八、上线方案

### 阶段 1：本地测试（零成本）
- `npm run dev` 跑前端 + `node server/index.js` 跑后端
- 本机多开浏览器标签页模拟多人
- 验证联机逻辑正确

### 阶段 2：内网穿透测试（零成本）
- 用 Cloudflare Tunnel 暴露本机服务
- 朋友通过链接访问
- 验证公网联机稳定

### 阶段 3：部署上线（可选）
- 方案 A：Cloudflare Tunnel + 自托管（¥0，电脑开机即可）
- 方案 B：Render.com / Zeabur 部署（¥0，有免费额度）
- 方案 C：腾讯云服务器（¥50/月，最稳定）

---

## 九、依赖

```json
{
  "express": "^4.21.0",
  "socket.io": "^4.8.0",
  "socket.io-client": "^4.8.0",
  "cors": "^2.8.5",
  "nanoid": "^5.0.0"
}
```

---

## 十、验收标准

- [ ] 2-8 人可通过房间码加入同一房间
- [ ] 所有玩家看到的游戏局面完全一致
- [ ] 分岔选路只在当前玩家客户端暂停，其他人等待
- [ ] 断线后 AI 托管，重连后交还控制权
- [ ] 聊天消息实时广播
- [ ] 游戏结束正确判定胜负并显示结果
- [ ] 公网可通过 Cloudflare Tunnel 访问

---

## 十一、工作量估算

| 阶段 | 内容 | 工时 |
|------|------|------|
| Phase 1 | 后端基础（Socket.IO + rooms + 规则搬迁） | 4h |
| Phase 2 | 前端大厅 + 房间 UI | 3h |
| Phase 3 | 前端 dispatch → socket 适配 | 3h |
| Phase 4 | 断线重连 + AI 托管 | 2h |
| Phase 5 | 聊天功能 | 1h |
| Phase 6 | Cloudflare Tunnel 上线测试 | 1h |
| **合计** | | **~14h** |
