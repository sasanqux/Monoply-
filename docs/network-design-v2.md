# M4 联机设计方案 v3 · 2026-08-16

> 目标：2-8 人联机对局，房间码加入，服务器权威同步。
> 原则：先补地基（P0），再搭框架（Phase 1-2），最后同步（Phase 3）。

---

## 零、首页流程设计（UI/UX）

### 完整用户流程

```
┌──────────────────────────────────┐
│         重庆大富翁               │
│      （大 logo + 漫画背景）        │
│                                  │
│         [ 开始游戏 ]              │
│                                  │
└──────────────────────────────────┘
              │ 点击
              ▼
┌──────────────────────────────────┐
│         选择模式                  │
│                                  │
│   [ 单机模式 ]  [ 创建房间 ]  [ 加入房间 ]  │
│                                  │
└──────────────────────────────────┘
      │              │              │
      ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ 单机设置  │  │ 创建房间  │  │ 输入房码  │
│ • 昵称    │  │ • 昵称    │  │ • 房码    │
│ • 人数    │  │ • 回合    │  │ • 昵称    │
│ • 回合    │  │ • 资金    │  │           │
│ • 资金    │  │           │  │ [加入]    │
│ • 颜色    │  │ [创建]    │  └─────┬─────┘
│           │  └─────┬─────┘        │
│ [开始游戏] │        │              │
└─────┬─────┘        ▼              ▼
      │        ┌──────────────────────┐
      │        │      联机大厅          │
      │        │  房间码: ABC123       │
      │        │  • 房主(你) ✅        │
      │        │  • 玩家2 ✅           │
      │        │  等待玩家... (2/8)    │
      │        │  [开始游戏] [离开]     │
      │        └──────────┬───────────┘
      │                   │
      ▼                   ▼
┌──────────────────────────────────┐
│         游戏棋盘（共用）           │
│     单机和联机最终都进这里          │
└──────────────────────────────────┘
```

### 页面状态机

```
Home（大logo首页）
  → 点击"开始游戏"
  → ModeSelect（选模式）
      → 单机模式 → SetupPanel（参数+昵称+颜色）→ 游戏
      → 创建房间 → 输昵称+参数 → 等待大厅 → 游戏
      → 加入房间 → 输房码+昵称 → 等待大厅 → 游戏
```

### 新增/修改组件

| 组件 | 说明 |
|------|------|
| `Home.vue` | 大 logo 首页，只有"开始游戏"按钮 |
| `ModeSelect.vue` | 选模式（单机/创建/加入） |
| `SetupPanel.vue` | 扩展：加昵称+颜色选择 |
| `Lobby.vue` | 联机大厅（房间码+玩家列表+聊天） |
| `App.vue` | 路由控制：home → mode → setup/lobby → game |

---

## 一、P0 地基（必须先做，否则联机必崩）

### P0-1：5 处绕过 dispatch 的直调 → 全部改走 dispatch

**问题**：App.vue 里有 5 处直接 `state.value = gameReducer(...)`，不走 dispatch。联机时这些动作不会发到服务器，导致状态分裂。

| 函数 | 当前问题 | 修改方案 |
|------|----------|----------|
| `onDiceThrow` | 本地算 ROLL_DICE | 改成 `dispatch({ type: 'ROLL_DICE' })` |
| `startStepping` | 本地循环 STEP | 改成 `dispatch({ type: 'STEP' })` |
| `onForkClose` | 本地算 CHOOSE_FORK | 改成 `dispatch({ type: 'CHOSE_FORK', tileId })` |
| `scheduleAI` | 本地跑 aiDecide | 改成 `dispatch(action)` |
| `fastForward` | 调试快进 | 联机模式禁用 |

**dispatch 函数改造**：

```javascript
function dispatch(action) {
  if (netMode.value) {
    // 联机：发给服务器
    socket.emit('action', action)
  } else {
    // 单机：本地算
    const prevMap = lastWalkPaths.value
    state.value = gameReducer(state.value, action)
    // ...动画逻辑...
  }
}
```

### P0-2：isMyTurn 改成基于 myPlayerId

**问题**：`isMyTurn = computed(() => cur.value && !cur.value.isAI)` —— 联机里多人都是非 AI，这个判断失效。

**修改**：

```javascript
// 新增状态
const myPlayerId = ref(null) // 当前玩家在联机的 id

// 修改 isMyTurn
const isMyTurn = computed(() => {
  if (!state.value) return false
  const cur = currentPlayer(state.value)
  if (!cur) return false
  if (netMode.value) {
    return cur.id === myPlayerId.value  // 联机：匹配我的 id
  }
  return !cur.isAI  // 单机：非 AI 就是我
})
```

**波及**：`canThrowDice`、`showForkCard`、`showShop`、`showAuction`、`showCheckin`、`showLottery` 等所有基于 `isMyTurn` 的 computed 自动跟着变。

### P0-3：广播前脱敏（盲拍泄密）

**问题**：整个 state 广播时 `bids` 字段暴露给所有人。

**修改**：广播前对非当前出价方的 state 做浅拷贝，隐藏 `bids`：

```javascript
function broadcastState(room) {
  for (const p of room.players) {
    const gs = room.gameState
    if (gs.phase === 'auction' && gs.pending?.kind === 'auction') {
      // 拍卖中：只给自己看 bids，他人看不到
      const masked = { ...gs, pending: { ...gs.pending, bids: {} } }
      io.to(p.socketId).emit('gameState', { state: masked })
    } else {
      io.to(p.socketId).emit('gameState', { state: gs })
    }
  }
}
```

---

## 二、Phase 1：后端基础

### 新增文件

```
server/
  index.js          ← Express + Socket.IO 入口
  rooms.js          ← 房间管理
  game/             ← 从 src/game/ 复制 14 个文件
```

### server/index.js 核心逻辑

```javascript
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const app = express()
app.use(cors())
app.use(express.json())

// 服务 dist/ 静态文件
const __dirname = dirname(fileURLToPath(import.meta.url))
app.use(express.static(join(__dirname, '../dist')))

app.get('/health', (req, res) => res.json({ ok: true }))

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })

io.on('connection', (socket) => {
  console.log('[connect]', socket.id)

  socket.on('createRoom', ({ playerName, settings }, cb) => {
    // 创建房间 + 加入 + 广播
  })

  socket.on('joinRoom', ({ roomId, playerName }, cb) => {
    // 校验 + 加入 + 广播
  })

  socket.on('startGame', (cb) => {
    // 校验房主 + 创建初始状态 + 广播 gameStart
  })

  socket.on('action', (action, cb) => {
    // 校验是当前玩家 + gameReducer + 广播 gameState（脱敏）
  })

  socket.on('chat', ({ text }) => {
    // 广播聊天
  })

  socket.on('disconnect', () => {
    // 房主转移 / 离开 / 清理空房
  })
})

const PORT = 8888  // 高位端口避免占用
httpServer.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`))
```

### rooms.js 核心

```javascript
import { gameReducer, createInitialState } from './game/reducer.js'

const rooms = new Map()

export function createRoom(hostName, settings) { /* 创建+返回房间 */ }
export function joinRoom(roomId, playerName, socketId) { /* 校验+加入 */ }
export function leaveRoom(socketId) { /* 离开+房主转移+清理 */ }
export function findRoomBySocket(socketId) { /* 查找 */ }
export function startGame(roomId) { /* createInitialState 用真实玩家数据 */ }
export function handleAction(room, socketId, action) { /* 验证+执行+返回结果 */ }
export function addChat(room, socketId, text) { /* 添加+返回消息 */ }
export function count() { return rooms.size }
```

### 验证

```bash
node server/index.js
# 浏览器 http://localhost:8888 → 看到游戏界面（联机前的版本）
# curl http://localhost:8888/health → {"ok":true}
```

---

## 三、Phase 2：前端大厅

### 新增/修改文件

```
src/
  net/socket.js         ← Socket.IO 客户端
  components/
    Home.vue            ← 大 logo 首页
    ModeSelect.vue      ← 选模式
    Lobby.vue           ← 联机大厅
    SetupPanel.vue      ← 扩展（加昵称+颜色）
  App.vue               ← 改路由+dispatch
```

### App.vue 路由

```javascript
const view = ref('home') // 'home' | 'mode' | 'setup' | 'lobby' | 'game'

// Home → ModeSelect
// ModeSelect → 单机: view='setup' | 创建/加入: view='lobby'
// SetupPanel @start → startGame → view='game'
// Lobby @enterGame → view='game' + netMode=true
```

### Lobby.vue 核心 UI

- 房间码（大字，可复制）
- 玩家列表（名字+准备状态+房主标识）
- 聊天框（复用之前的 UI）
- "开始游戏"按钮（仅房主可见）
- "离开房间"按钮

### 验证

- 浏览器 A：创建房间 → 看到房间码
- 浏览器 B：输入房间码 → 看到两个玩家
- 两人都在大厅 → 房主点开始 → 两人都进入游戏

---

## 四、Phase 3：游戏同步

### 核心问题：逐格 STEP 同步不能照搬

**问题**：450ms 一次全量广播，8 人房走 8 步 = 8 次全量 state 广播，卡顿+乱序。

**方案**：服务器只广播**关键事件**，前端本地插值动画。

| 事件 | 服务器广播 | 前端处理 |
|------|-----------|---------|
| 掷骰 | `{ type: 'ROLL_DICE', dice, steps }` | 本地播放走格动画 |
| 走完 | `{ type: 'LANDED', pos }` | 显示落地结算 |
| 分岔暂停 | `{ type: 'FORK', options }` | 当前玩家弹选路 |
| 买地/用卡 | `{ type: 'BUY/USE_CARD', ... }` | 更新状态 |

**dispatch 改造**：

```javascript
function dispatch(action) {
  if (netMode.value) {
    socket.emit('action', action) // 发给服务器，等广播回来再更新
    return
  }
  // 单机：本地算
  const prevMap = lastWalkPaths.value
  state.value = gameReducer(state.value, action)
  // 动画逻辑...
}
```

### 验证

- 2 个浏览器标签对局
- 玩家 A 掷骰 → B 看到棋子同步移动
- 所有操作（买地/用卡/交租）完全同步

---

## 五、Phase 4：聊天

- 复用之前预留的 ChatPanel UI
- `socket.emit('chat', text)` → 服务器广播

---

## 六、Phase 5：上线

- Cloudflare Tunnel 内网穿透（免费，固定域名，支持 WebSocket）
- 安装 cloudflared → `cloudflared tunnel --url http://localhost:8888`

---

## 七、关键避坑

| 坑 | 解决方案 |
|----|---------|
| 端口被占用 | 用 8888 端口 + Play.bat 启动前 taskkill |
| socket.io-client 打包失败 | 动态 import：`const { io } = await import('socket.io-client')` |
| App.vue 初始化崩溃 | 所有 socket 操作放在 onMounted 里 |
| 房主掉线 | disconnect 事件里检测+转房主 |
| 重连恢复 | 加入时服务器主动发一次 gameState |
| createInitialState 接真实玩家 | 用房间的 players 数组生成，含 id/color/name/isAI |
| 盲拍泄密 | 广播前对 bids 脱敏 |
| STEP 卡顿 | 服务器只广播关键事件，前端本地插值 |
| AI 托管 | 先不做，掉线玩家"冻结"回合 |

---

## 八、工时估算

| 阶段 | 内容 | 工时 |
|------|------|------|
| **P0** | 地基：dispatch 统一 + isMyTurn + 脱敏 | 3h |
| Phase 1 | 后端基础 | 3h |
| Phase 2 | 前端大厅+首页 | 3h |
| Phase 3 | 游戏同步 | 5h |
| Phase 4 | 聊天 | 1h |
| Phase 5 | Cloudflare Tunnel 上线 | 1h |
| **合计** | | **~16h** |

---

## 九、验收标准

- [x] P0-1：5 处直调改走 dispatch ✅
- [x] P0-2：isMyTurn 用 myPlayerId ✅
- [x] Phase 1：服务器启动，浏览器能访问静态页面 ✅
- [x] Phase 2：2-8 人可通过房间码加入同一房间 ✅
- [ ] Phase 2.5：socket 冲突/监听残留修复 ✅
- [x] Phase 3：掷骰一次性算完路径+广播，isMyTurn 用 myPlayerId ✅
- [ ] Phase 4：聊天消息实时广播
- [ ] Phase 5：公网可通过 Cloudflare Tunnel 访问
- [ ] 房主掉线自动转房主
- [ ] 拍卖盲拍不泄密

---

## 十、推进顺序

```
P0（地基）→ Phase 1（后端）→ Phase 2（大厅）→ Phase 3（同步）→ Phase 4（聊天）→ Phase 5（上线）
```

**绝不跳步**。每完成一个阶段验证通过了再开下一个。

---

## 十一、审查修订记录

### v3.1 · 2026-08-16（第一次审查）

### 审查发现的 🔴 P0 问题（已修复）

| # | 问题 | 修复文件 | 修复方式 |
|---|------|---------|---------|
| 1 | Lobby 自己 connect socket，与 App 级冲突 | `Lobby.vue` | 改用 `getSocket()` 获取 App 级 socket，不自己 connect |
| 2 | onEnterNetGame 重复 connect + 监听残留 | `App.vue` | 新增 `ensureSocket()` + `socket.off('gameState')` |
| 3 | Lobby 销毁时没清理事件监听 | `Lobby.vue` | `onBeforeUnmount` 里 `s.off()` 所有事件 |
| 4 | ModeSelect 进 Lobby 前没 connect | `App.vue` | `@create/@join` 事件里加 `ensureSocket()` |
| 5 | lobbyServerUrl 从未被赋值 | `App.vue` | 删除，改用 `connect()` 默认 origin |

### 审查发现的 🟠 P1 问题（待后续修复）

| # | 问题 | 修复方案 |
|---|------|---------|
| 6 | broadcastRoom 每人一份深拷贝 | Phase 3 优化：先 clone 一次 base，再微调 hand |
| 7 | findRoomBySocket 是 O(N) | 维护 socketToRoom 反向索引 |

### 当前进度（v3.4 更新）

- ✅ P0-1：5 处直调改走 dispatch
- ✅ P0-2：isMyTurn 改成基于 myPlayerId
- ✅ P0-3：盲拍脱敏（broadcastGameState 隐藏 bids）
- ✅ Phase 1：后端基础（Express+Socket.IO+静态文件服务）
- ✅ Phase 2：首页+大厅（Home/ModeSelect/Lobby/SetupPanel 颜色选择）
- ✅ Phase 3：游戏同步（handleRollDice 算完整路径+广播一次）
- ✅ Phase 4：聊天（SidePanel 接入 socket）
- ✅ 游戏结束清理：60s 后 rooms.delete
- ⏳ Phase 5：Cloudflare Tunnel 上线
