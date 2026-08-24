<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import SetupPanel from './components/SetupPanel.vue'
import Board from './components/Board.vue'
import ActionPanel from './components/ActionPanel.vue'
import SidePanel from './components/SidePanel.vue'
import Encyclopedia from './components/Encyclopedia.vue'
import BagsBar from './components/BagsBar.vue'
import MyPanelModal from './components/MyPanelModal.vue'
import ResultOverlay from './components/ResultOverlay.vue'
import LandInfoModal from './components/LandInfoModal.vue'
import DiceThrow from './components/DiceThrow.vue'
import ComicIcon from './components/ComicIcon.vue'
import DebugPanel from './components/DebugPanel.vue'
import TradeModal from './components/TradeModal.vue'
import GameMenu from './components/GameMenu.vue'
import { createInitialState, gameReducer, aiDecide, currentPlayer, TILES, isPropertyTile, cardTargetKind, VEHICLES, CARDS, STOCKS, GODS, loanLimit, totalAssets, tilePosition } from './game/index.js'
import { connect, disconnect, getSocket } from './net/socket.js'
import { initBackButton } from './composables/useBackButton.js'
import { sfx, vibrate } from './composables/useSound.js'
import Home from './components/Home.vue'
import ModeSelect from './components/ModeSelect.vue'
import Lobby from './components/Lobby.vue'

const AI_NAMES = ['闷墩', '宝器', '莽娃', '瓜娃', '耙耳朵', '胎神', '棒棒']

const view = ref('home') // home | mode | setup | lobby | game
const netMode = ref(false)
const myPlayerId = ref(null)
const lobbyMode = ref('') // 'create' | 'join'

const state = ref(null)
const lastOpts = ref(null)
const lastMove = ref(null) // { prevPos, nextPos } 供棋子飞行特效
const animating = ref(false) // 掷骰/走格动画播放中（期间暂不显示操作按钮，让玩家看清）
const animatingPids = ref([]) // 当前正在走动的玩家 id（这些玩家的棋子要隐藏，其他玩家正常显示）
let aiTimer = null
let animTimer = null

// ===== 新增：联机功能状态 =====
const currentRoomId = ref(null) // 当前房间号
const isHost = ref(false) // 是否是房主
const paused = ref(false) // 游戏是否暂停
const aiTakeover = ref(false) // AI 托管是否开启
const turnTimeLeft = ref(30) // 回合倒计时
const lobbyPlayers = ref([]) // 玩家列表（供踢人用）
const gameLog = ref([]) // 游戏日志
const playerName = ref('') // 玩家昵称（用于断线重连）
const playerColor = ref('') // 玩家颜色（用于断线重连）
const roomPassword = ref('') // 房间密码（密码房断线重连用；Lobby enter 事件若带上则存）

// localStorage 存房间信息（用于断线重连）
const STORAGE_KEY = 'monopoly_game'
function saveGameInfo() {
  if (state.value && myPlayerId.value && currentRoomId.value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      roomId: currentRoomId.value,
      playerName: playerName.value,
      color: playerColor.value,
      password: roomPassword.value || undefined, // 密码房掉线重连必需
      playerId: myPlayerId.value,
      savedAt: Date.now(),
    }))
  }
}
function loadGameInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const info = JSON.parse(raw)
    if (Date.now() - info.savedAt > 2 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return info
  } catch {
    return null
  }
}
function clearGameInfo() {
  localStorage.removeItem(STORAGE_KEY)
}

// 冷启动不自动跳进对局：存档保留（供 Home 的"返回游戏"按钮读取），手动重连走 onRejoinGame

// ===== 顶部通知栈：所有轻提示统一入口（规则限制/服务器拒绝/被踢等） =====
// 固定挂在屏幕最上层（z-index 压过一切弹窗），2.5 秒自动消失；多条排队堆叠，最多同屏 3 条
const notices = ref([]) // [{ id, msg, type }] type: 'info'(黄) | 'error'(红)
let noticeSeq = 0
function showNetNotice(msg, type = 'info') {
  const id = ++noticeSeq
  notices.value.push({ id, msg: msg || '操作失败，请重试', type })
  if (notices.value.length > 3) notices.value.shift()
  setTimeout(() => {
    notices.value = notices.value.filter((n) => n.id !== id)
  }, 2500)
}

// Android 返回键：① 关闭弹窗/选择模式 → ② 回上级页面 → ③ 双击退出
const backHint = ref('') // "再按一次退出"提示（App 端）
let lastBackAt = 0
let backHintTimer = null
onMounted(() => {
  initBackButton(() => {
    // ① 逐层关闭本地可关闭的弹窗/选择模式
    if (selecting.value) { cancelSelect(); return true }
    if (myModal.value) { myModal.value = null; return true }
    if (infoTile.value) { infoTile.value = null; return true }
    if (tradeTarget.value) { tradeTarget.value = null; return true }
    if (showEncyclopedia.value) { showEncyclopedia.value = false; return true }
    if (showLoan.value) { showLoan.value = false; return true }
    // ② 阻断性弹窗打开时：消费返回键但不退出（这些弹窗不能被返回键误关/误退游戏）
    if (
      showForkCard.value || showShop.value || showCheckin.value ||
      showAuction.value || showAuctionReveal.value || showLottery.value ||
      showGodPopup.value || showChancePopup.value || showShieldPopup.value ||
      showLotteryDraw.value || showBankruptPopup.value || showBonusInfo.value ||
      (netMode.value && state.value?.pending?.kind === 'trade') || // 联机交易提案弹窗
      isOrderPhase.value || showOrderResult.value ||
      state.value?.status === 'finished'
    ) return true
    // ③ 非首页视图回首页（game 例外：对局中防误触，走双击退出）
    if (view.value !== 'home' && view.value !== 'game') { view.value = 'home'; return true }
    // ④ 双击退出
    const now = Date.now()
    if (now - lastBackAt < 2000) return false
    lastBackAt = now
    backHint.value = '再按一次退出游戏'
    clearTimeout(backHintTimer)
    backHintTimer = setTimeout(() => { backHint.value = '' }, 2000)
    return true
  })
})

// ===== 棋盘自适应：JS 短边驱动（兜底旧 WebView 不支持容器查询单位 cqw/cqh 的机型） =====
// 棋盘宽 = min(容器宽, 容器高÷0.85, 600)：窄屏受宽度限制、短屏受高度限制，任意屏比例完整显示
const boardWrapEl = ref(null)
let boardRO = null
function fitBoard() {
  const wrap = boardWrapEl.value
  if (!wrap) return
  const board = wrap.querySelector('.board')
  if (!board || !wrap.clientWidth || !wrap.clientHeight) return
  // 最小 240px 兜底：容器被极端挤压时棋盘仍可玩（不缩成 0/负数）
  const ideal = Math.max(240, Math.min(wrap.clientWidth - 8, wrap.clientHeight / 0.85 - 8, 600))
  board.style.width = ideal + 'px'
  board.style.maxWidth = 'none'
  board.style.height = 'auto'
}
watch([view, () => !!state.value], ([v, hasState]) => {
  if (v === 'game' && hasState) {
    nextTick(() => {
      if (boardRO) boardRO.disconnect()
      if (!boardWrapEl.value) return
      if (typeof ResizeObserver !== 'undefined') {
        boardRO = new ResizeObserver(fitBoard)
        boardRO.observe(boardWrapEl.value)
      }
      fitBoard()
    })
  }
}, { flush: 'post' })
onBeforeUnmount(() => { boardRO?.disconnect() })

// ===== 金钱变动飘字：diff 前后玩家现金，在棋盘该玩家位置弹 +¥/-¥ 大字（颜色=玩家色，2s） =====
const moneyFxList = ref([])
let fxSeq = 0
function queueMoneyFx(prevState, newState) {
  if (!prevState?.players || !newState?.players) return
  for (const np of newState.players) {
    const pp = prevState.players.find((p) => p.id === np.id)
    if (!pp || pp.money === np.money) continue
    const delta = np.money - pp.money
    const pos = tilePosition(np.pos) || { x: 50, y: 50 }
    const key = ++fxSeq
    moneyFxList.value.push({ key, delta, x: pos.x, y: pos.y, color: np.color })
    if (delta > 0) sfx.coin(); else sfx.pay()
    setTimeout(() => {
      const i = moneyFxList.value.findIndex((f) => f.key === key)
      if (i >= 0) moneyFxList.value.splice(i, 1)
    }, 2300)
  }
  if (moneyFxList.value.length > 12) moneyFxList.value.splice(0, moneyFxList.value.length - 12)
}

function doRejoin(s, info) {
  s.emit('joinRoom', {
    roomId: info.roomId,
    playerName: info.playerName,
    color: info.color,
    password: info.password || undefined, // 密码房掉线重连必需
    playerId: info.playerId, // 优先按 playerId 匹配座位，不依赖可猜的昵称
  }, (res) => {
    if (res?.ok && res.rejoined) {
      myPlayerId.value = res.playerId
      currentRoomId.value = info.roomId
      view.value = 'game'
      onEnterNetGame({ playerName: info.playerName, color: info.color, roomId: info.roomId })
    } else {
      // 房间已不存在/对局结束：清存档并回首页（否则会卡在"正在同步对局…"）
      clearGameInfo()
      if (view.value === 'game' && !state.value) {
        view.value = 'home'
        netMode.value = false
      }
    }
  })
}

// 首页"返回游戏"按钮：用保存的信息重新加入
function onRejoinGame(info) {
  // 切换到游戏视图并等待 socket 连接后加入
  netMode.value = true
  view.value = 'game'
  const s = getSocket() || connect()
  const tryRejoin = () => {
    doRejoin(s, info)
    s.off('connect', tryRejoin)
  }
  if (s.connected) {
    tryRejoin()
  } else {
    s.on('connect', tryRejoin)
  }
}

// 联机中途断线重连：socket 重连后会拿到新 socketId，服务端已把旧座位标记为掉线托管；
// 不重发 joinRoom 玩家会"幽灵冻结"（收不到任何状态）。这里在每次重连后自动找回座位。
let rejoinRetryDone = false // 竞态重试只做一次，防重试风暴
function onNetReconnect() {
  const s = getSocket()
  if (!s) return
  if (currentRoomId.value && myPlayerId.value) {
    rejoinRetryDone = false
    emitRejoin(s)
  }
}
function emitRejoin(s) {
  s.emit('joinRoom', {
    roomId: currentRoomId.value,
    playerName: playerName.value,
    color: playerColor.value,
    password: roomPassword.value || undefined, // 密码房掉线重连必需
    playerId: myPlayerId.value,
  }, (res) => {
    if (res?.ok) { rejoinRetryDone = false; return }
    // 竞态窗口：服务端尚未把旧座位标记为掉线时会报"只能用掉线前的昵称"，延迟 3 秒重试一次（仅一次）
    if (res?.error && String(res.error).includes('只能用掉线前的昵称') && !rejoinRetryDone) {
      rejoinRetryDone = true
      setTimeout(() => {
        const sock = getSocket()
        if (sock && currentRoomId.value && myPlayerId.value) emitRejoin(sock)
      }, 3000)
    }
  })
}

// ===== 可拿取骰子 =====
const boardEl = ref(null)          // 棋盘 DOM（DiceThrow 算落点）
const actionPanelEl = ref(null)   // 操作面板 DOM（骰子初始位置锚点：面板右侧靠中间）
const diceThrowing = ref(false)   // 玩家投掷动画播放中（期间 BoardFx 不播骰子动画）
const diceRolled = ref(false)     // 本回合已投掷（防止重投）

// 观演骰子：别人掷骰时在屏幕中央自动翻滚（单机 AI 回合 + 联机其他玩家回合都触发）
const spectateDice = ref(null)    // null | { playerId, playerName, dice, diceCount }

// 监听骰子值变化：当前玩家不是"我"时触发观演动画（自己掷的由 DiceThrow 原生交互处理）
let lastSpectateTurnKey = null
watch(() => state.value?.dice, (dice) => {
  if (!dice || !Array.isArray(dice) || dice.length === 0) return
  const st = state.value
  if (!st || st.status !== 'playing') return
  if (st.phase === 'order') return // 定序阶段不播观演（3 人连续掷太吵）
  const cur = currentPlayer(st)
  if (!cur || !cur.alive) return
  // 自己掷的不播（DiceThrow 原生交互已处理）
  if (cur.id === myPlayerId.value && !cur.isAI) return
  // 同一回合同一个人不重复触发
  const turnKey = `${cur.id}@${st.turnIndex}@${st.round}`
  if (lastSpectateTurnKey === turnKey) return
  lastSpectateTurnKey = turnKey
  spectateDice.value = {
    playerId: cur.id,
    playerName: cur.name,
    dice: [...dice],
    diceCount: dice.length,
  }
})

// 观演骰子动画结束后清除
function onSpectateSettle() {
  if (spectateDice.value) {
    spectateDice.value = null
    return
  }
  onDiceSettle()
}

// 卡牌目标选择模式
const selecting = ref(null) // { type:'card', id, mode:'tile'|'player'|'swap', swapStep, myTile }
const infoTile = ref(null) // 当前查看详情的格子 id
const myModal = ref(null) // 底部入口弹窗：'cards' | 'lands' | 'stocks'
const showEncyclopedia = ref(false) // 百科全书弹窗
const showLoan = ref(false) // 银行贷款面板
const loanAmount = ref(0) // 借款/还款输入金额

// ===== 交易系统 =====
const tradeTarget = ref(null) // 交易目标玩家 id
const showTradeModal = computed(() => !!tradeTarget.value)

// ===== 调试台 =====
const debugTeleport = ref(null) // { playerId } 传送模式：非空时点棋盘格子 = 传送该玩家

function onTeleportMode(v) {
  debugTeleport.value = v // null 或 { playerId }
}

// AI 快跑：静默推进 N 回合（跳过动画，人类也自动决策，遇分岔自动走随机分支）
function fastForward(rounds) {
  const st = state.value
  if (!st || st.status !== 'playing') return
  let s = st
  const targetRound = st.round + Math.max(1, Math.floor(rounds || 1))
  let guard = 0
  while (s.status === 'playing' && s.round < targetRound && guard++ < 8000) {
    let action
    if (s.phase === 'fork' && s.pending?.kind === 'fork') {
      // 快跑中人类玩家的分岔也自动选：优先随机 options，无 options 用 chosen（不再发 chosen=null 空转）
      const opts = s.pending.canPick && s.pending.options?.length ? s.pending.options : [s.pending.chosen]
      action = { type: 'CHOOSE_FORK', tileId: opts[Math.floor(Math.random() * opts.length)] }
    } else if (s.phase === 'auction' && s.pending?.kind === 'auction') {
      action = aiDecide(s, s.players[s.pending.turn]?.id) || { type: 'AUCTION_BID', raise: false }
    } else {
      const cur = currentPlayer(s)
      if (!cur) break
      action = aiDecide(s, cur.id) || { type: 'END_TURN' }
    }
    s = gameReducer(s, action)
  }
  state.value = s
  lastWalkPaths.value = snapshotWalkPaths(s)
  lastMove.value = null
  animating.value = false
  diceThrowing.value = false
  clearTimeout(animTimer)
  scheduleAI()
}

function startGame(opts) {
  try {
    lastOpts.value = { ...opts }
    lastMove.value = null
    animating.value = false
    diceThrowing.value = false
    diceRolled.value = false
    lastWalkPaths.value = {}
    stopStepping()
    clearTimeout(animTimer)
    const players = []
    for (let i = 0; i < opts.players; i++) {
      players.push({
        id: 'p' + (i + 1),
        name: i === 0 ? (opts.playerName || '我') : AI_NAMES[i - 1],
        isAI: i !== 0,
      })
    }
    state.value = createInitialState({ players, maxTurns: opts.maxTurns, startMoney: opts.startMoney })
    netMode.value = false
    view.value = 'game'
    scheduleAI()
  } catch (e) {
    console.error('[startGame] ERROR:', e)
  }
}

// 结算层"再来一局"：单机直接重开；联机不走 startGame（本地建房会静默失败），改为退房回首页重新建房
function onPlayAgain() {
  if (netMode.value) {
    getSocket()?.emit('leaveRoom')
    clearGameInfo()
    currentRoomId.value = null
    netMode.value = false
    state.value = null
    view.value = 'home'
    return
  }
  startGame(lastOpts.value)
}

// 确保 socket 已连接（不重复 connect）
function ensureSocket() {
  return connect()
}

// 联进入游戏（gameStart 只带 roomId；对局状态等第一条 gameState 广播）
function onEnterNetGame(data) {
  netMode.value = true
  view.value = 'game'
  rejoinRetryDone = false
  // 保存玩家信息用于断线重连
  if (data?.playerName) playerName.value = data.playerName
  if (data?.color) playerColor.value = data.color
  if (data && 'password' in data) roomPassword.value = data.password || '' // Lobby enter 事件带密码时存下（密码房重连用）
  currentRoomId.value = data?.roomId || currentRoomId.value
  const s = getSocket()
  if (!s) { console.error('[onEnterNetGame] no socket!'); return }
  // 清理旧监听避免重复（on 过的所有事件都要 off，否则重复进对局会累积监听）
  s.off('gameState')
  s.off('pauseUpdate')
  s.off('timerUpdate')
  s.off('logUpdate')
  s.off('kicked')
  s.off('roomUpdate')
  s.off('aiTakeoverUpdate')
  s.off('ping_check')
  s.off('connect', onNetReconnect)
  s.on('gameState', ({ state: gs, myPlayerId: pid, isHost: host }) => {
    if (pid) myPlayerId.value = pid
    if (host !== undefined) isHost.value = host // 联机中房主菜单（暂停/踢人/设密码）才显示
    console.log('[gameState] received, diceThrowing was', diceThrowing.value)
    applyNetState(gs)
    // 保存游戏信息用于断线重连
    saveGameInfo()
  })
  // 暂停状态同步
  s.on('pauseUpdate', ({ paused: p }) => {
    paused.value = p
  })
  // AI 托管状态同步
  s.on('aiTakeoverUpdate', ({ aiTakeover: ai }) => {
    aiTakeover.value = ai
  })
  // 回合倒计时同步
  s.on('timerUpdate', ({ time }) => {
    turnTimeLeft.value = time
  })
  // 游戏日志同步
  s.on('logUpdate', (logs) => {
    gameLog.value = logs
  })
  // 被房主踢出：顶部提示并退回选模式页（不用 alert，并补齐本地状态清理）
  s.on('kicked', () => {
    showNetNotice('你已被房主移出房间')
    clearGameInfo()
    selecting.value = null
    myModal.value = null
    infoTile.value = null
    tradeTarget.value = null
    showLoan.value = false
    netMode.value = false
    currentRoomId.value = null
    state.value = null
    isHost.value = false
    view.value = 'mode'
  })
  // 延迟检测响应
  s.on('ping_check', () => {
    s.emit('pong_check')
  })
  // 房间更新（玩家列表 + isHost 字段，供踢人/显示用）
  s.on('roomUpdate', (r) => {
    if (r?.players) {
      lobbyPlayers.value = r.players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
      }))
      // 更新自己的房主状态
      const me = r.players.find(p => p.id === myPlayerId.value)
      if (me) isHost.value = !!me.isHost
    }
  })
  // 中途断线重连后自动找回座位（防幽灵冻结）
  s.on('connect', onNetReconnect)
}

// 联机：应用服务器广播的 state，并用 walkPath 差量驱动走格动画（与单机同一套动画逻辑）
let awaitingAck = false // 联机连点锁：action 在途时不允许再发（防双击买两张卡/借两笔款）
let ackTimeoutTimer = null
function applyNetState(gs) {
  console.log('[applyNetState] received', gs ? 'state ok' : 'STATE IS NULL/UNDEFINED!', { players: gs?.players?.length })
  // 收到广播 = 上一条 action 已处理，解除连点锁
  awaitingAck = false
  clearTimeout(ackTimeoutTimer)
  clearTimeout(_diceTimeout)
  // 无论成功与否，先清除"掷骰中"锁——这是修复掷骰卡住的核心
  diceThrowing.value = false
  animating.value = false
  animatingPids.value = []
  clearTimeout(animTimer)
  // null/undefined state 不做任何处理（服务端异常或掉线中）
  if (!gs) {
    console.warn('[applyNetState] got null state, skipping')
    return
  }
  try {
    const prevMap = lastWalkPaths.value
    const prevState = state.value
    state.value = gs
    queueMoneyFx(prevState, gs)
    const { paths, nextMap } = buildMovePaths(gs, prevMap)
    lastWalkPaths.value = nextMap
    if (paths.length) {
      lastMove.value = { paths, n: (lastMove.value?.n ?? 0) + 1 }
      animating.value = true
      animatingPids.value = paths.map((p) => p.pid)
      const steps = Math.max(...paths.map((p) => p.path.length - 1))
      for (let i = 0; i < steps; i++) setTimeout(() => sfx.step(), i * 400)
      animTimer = setTimeout(() => { animating.value = false; animatingPids.value = [] }, steps * 400 + 500)
    }
    // 落地产生购买/轻轨等 pending 时，立即停止动画锁让按钮可用（与单机 dispatch 一致）
    if (gs.pending?.kind === 'buy' || gs.pending?.kind === 'metro') {
      clearTimeout(animTimer)
      animating.value = false
      animatingPids.value = []
    }
    scheduleAI()
  } catch (e) {
    console.error('[applyNetState] ERROR:', e)
    // 出错时也确保清除动画锁
    clearTimeout(animTimer)
    animating.value = false
    animatingPids.value = []
  }
}

// 已动画过的 walkPath 快照（按玩家 id）；用于差量计算"本段该走的格子"
const lastWalkPaths = ref({})

function snapshotWalkPaths(state) {
  const m = {}
  for (const p of state.players) m[p.id] = p.walkPath ? [...p.walkPath] : [p.pos]
  return m
}

// 由玩家 walkPath 推导本段动画路径：与上一帧做前缀比对，只取新增的部分
function buildMovePaths(newState, prevMap) {
  const paths = []
  const nextMap = {}
  if (!newState || !newState.players) {
    console.error('[buildMovePaths] invalid state', newState)
    return { paths, nextMap }
  }
  for (const pl of newState.players) {
    const wp = pl.walkPath ? [...pl.walkPath] : [pl.pos]
    nextMap[pl.id] = wp
    const prev = prevMap[pl.id]
    let startIdx = 0
    if (prev && wp.length >= prev.length && prev.length > 0) {
      let ok = true
      for (let i = 0; i < prev.length; i++) {
        if (wp[i] !== prev[i]) { ok = false; break }
      }
      if (ok) startIdx = prev.length
    }
    let seg = wp.slice(startIdx)
    // 补上起点，让棋子从上一格滑入第一个目标格（避免闪现）
    const from = startIdx > 0 ? wp[startIdx - 1] : pl.pos
    // 服务端每次掷骰都会重置 walkPath=[当前位置]，与上回合遗留快照前缀必然失配；
    // 旧逻辑此时整段 continue，联机下每回合首次移动的动画被整段丢弃（棋子瞬移）
    if (from === seg[0]) seg = seg.slice(1)
    if (seg.length === 0) continue // 无新增段，无需动画
    paths.push({ pid: pl.id, path: [from, ...seg] })
  }
  return { paths, nextMap }
}

// 打开交易面板
function openTrade(playerId) {
  tradeTarget.value = playerId
}

function onTradeOffer(payload) {
  tradeTarget.value = null
  dispatch({ type: 'TRADE_OFFER', ...payload })
}

function onTradeAccept() {
  dispatch({ type: 'TRADE_ACCEPT' })
}

function onTradeReject() {
  dispatch({ type: 'TRADE_REJECT' })
}

function dispatch(action) {
  if (!state.value || state.value.status !== 'playing') return
  // 联机模式：发给服务器，等广播回来再更新
  if (netMode.value) {
    const s = getSocket()
    if (!s) { console.error('[dispatch] no socket!'); return }
    if (awaitingAck) return // 在途锁：上一条 action 还没回来，忽略连点
    awaitingAck = true
    clearTimeout(ackTimeoutTimer)
    ackTimeoutTimer = setTimeout(() => { awaitingAck = false }, 5000) // 5 秒兜底复位（防 ack 丢失永久锁死）
    console.log('[dispatch] emitting action', action.type)
    s.emit('action', action, (res) => {
      console.log('[dispatch] action response', action.type, res)
      awaitingAck = false
      clearTimeout(ackTimeoutTimer)
      if (res?.error) {
        console.warn('[dispatch] server rejected', action.type, res.error)
        showNetNotice(res.error)
        // 服务器拒绝操作 → 清除动画/掷骰锁 + 复位"已投掷"，避免 UI 卡死/本回合投不了骰
        diceRolled.value = false
        diceThrowing.value = false
        animating.value = false
        animatingPids.value = []
        clearTimeout(animTimer)
      }
    })
    return
  }
  // 单机模式：本地算
  const prevMap = lastWalkPaths.value
  const prevState = state.value
  state.value = gameReducer(state.value, action)
  queueMoneyFx(prevState, state.value)
  // 落地产生购买/轻轨等 pending 时，立即停止动画让按钮可用
  if (state.value.pending?.kind === 'buy' || state.value.pending?.kind === 'metro') {
    clearTimeout(animTimer)
    animating.value = false
    animatingPids.value = []
    stopStepping()
  }
  // 回合结束：清空 walkPath 快照，下回合重新计算
  if (action.type === 'END_TURN') {
    lastWalkPaths.value = {}
  }
  const { paths, nextMap } = buildMovePaths(state.value, prevMap)
  lastWalkPaths.value = nextMap
  lastMove.value = {
    paths,
    n: (lastMove.value?.n ?? 0) + 1,
  }
  if (paths.length) {
    // 有走格动画：锁按钮 + 隐藏真实棋子，动画结束后解锁
    animating.value = true
    animatingPids.value = paths.map((p) => p.pid)
    const steps = Math.max(...paths.map((p) => p.path.length - 1))
    const animMs = steps * 400 + 500
    // 走格音效：按每步 400ms 依次轻嗒
    for (let i = 0; i < steps; i++) setTimeout(() => sfx.step(), i * 400)
    clearTimeout(animTimer)
    animTimer = setTimeout(() => { animating.value = false; animatingPids.value = [] }, animMs)
  } else {
    animating.value = false
    animatingPids.value = []
  }
  scheduleAI()
}

// ===== 新增：游戏菜单功能 =====
function getSocketSafe() {
  return getSocket()
}

function onSurrender() {
  const s = getSocketSafe()
  if (!s || !currentRoomId.value) return
  s.emit('surrender', { roomId: currentRoomId.value }, (res) => {
    if (res?.error) showNetNotice(res.error, 'error')
  })
}

function onTogglePause() {
  const s = getSocketSafe()
  if (!s || !currentRoomId.value) return
  s.emit('togglePause', { roomId: currentRoomId.value }, (res) => {
    if (res?.error) showNetNotice(res.error, 'error')
  })
}

function onKickPlayer(targetId) {
  const s = getSocketSafe()
  if (!s || !currentRoomId.value) return
  s.emit('kick', { roomId: currentRoomId.value, targetId }, (res) => {
    if (res?.error) showNetNotice(res.error, 'error')
  })
}

function onToggleAITakeover() {
  const s = getSocketSafe()
  if (!s || !currentRoomId.value) return
  s.emit('toggleAITakeover', { roomId: currentRoomId.value }, (res) => {
    if (res?.error) showNetNotice(res.error, 'error')
  })
}

function onSetPassword(password) {
  const s = getSocketSafe()
  if (!s || !currentRoomId.value) return
  s.emit('setPassword', { roomId: currentRoomId.value, password }, (res) => {
    if (res?.error) showNetNotice(res.error, 'error')
    else if (res?.ok) showNetNotice(password ? '密码设置成功' : '密码已取消')
  })
}

// ===== 走格动画：前端逐格推进（不隐藏真实棋子，让它逐格跳） =====
let stepTimer = null

// 松手瞬间：掷骰子，只算点数不实际走
function onDiceThrow() {
  console.log('[onDiceThrow] start', { status: state.value?.status, diceRolled: diceRolled.value, phase: state.value?.phase })
  if (!state.value || state.value.status !== 'playing') return
  if (diceRolled.value) return
  const cur = currentPlayer(state.value)
  if (!cur || cur.isAI || state.value.phase !== 'roll') return
  diceRolled.value = true
  diceThrowing.value = true
  animating.value = true
  sfx.dice()
  vibrate(60)
  console.log('[onDiceThrow] dispatching ROLL_DICE')
  // 超时保护：5 秒内如果服务器没回广播，自动清除掷骰锁（防卡死）
  clearTimeout(_diceTimeout)
  _diceTimeout = setTimeout(() => {
    if (diceThrowing.value) {
      console.warn('[onDiceThrow] timeout: server did not respond in 5s, resetting diceThrowing')
      diceRolled.value = false
      diceThrowing.value = false
      animating.value = false
      animatingPids.value = []
    }
  }, 5000)
  dispatch({ type: 'ROLL_DICE' })
}

let _diceTimeout = null

// 骰子定格后：单机开始逐格推进；联机由服务器一次算完整路径，动画由 gameState 广播驱动
function onDiceSettle() {
  diceThrowing.value = false
  if (netMode.value) return
  if (state.value?.stepsRemaining > 0) {
    startStepping()
  } else {
    animating.value = false
    animatingPids.value = []
  }
}

// 逐格推进：每 450ms dispatch STEP
function startStepping() {
  stopStepping()
  stepTimer = setInterval(() => {
    if (!state.value || state.value.status !== 'playing') { stopStepping(); return }
    if (state.value.phase === 'fork') { stopStepping(); return }
    if (!state.value.stepsRemaining || state.value.stepsRemaining <= 0) {
      stopStepping()
      animating.value = false
      scheduleAI()
      return
    }
    dispatch({ type: 'STEP' })
    // 进入 fork → 暂停等选路
    if (state.value.phase === 'fork') { stopStepping() }
  }, 450)
}

function stopStepping() {
  clearInterval(stepTimer)
  stepTimer = null
}

// 选路后继续逐格推进
function chooseFork(tileId) {
  dispatch({ type: 'CHOOSE_FORK', tileId })
  // CHOOSE_FORK 后 phase 回到 step，需重启推进（原 interval 已在遇 fork 时停掉）
  if (state.value?.phase === 'step' && state.value?.stepsRemaining > 0) {
    startStepping()
  }
}

// 分岔路口：点 ✕ = 随机选一条（不能偏心总选第一条），不关闭卡片（必须做出选择）
function onForkClose() {
  if (!state.value?.pending || state.value.pending.kind !== 'fork') return
  const pending = state.value.pending
  const opts = pending.canPick ? pending.options : [pending.chosen]
  const tileId = opts[Math.floor(Math.random() * opts.length)]
  chooseFork(tileId)
}

// 新回合开始时重置"已投掷"标记
watch(
  () => state.value?.dice,
  (dice, prev) => {
    if (prev && !dice) diceRolled.value = false
  }
)

function scheduleAI() {
  const st = state.value
  if (!st || st.status !== 'playing') return
  // 交易提案给 AI → 1.2s 后 AI 评估响应（目标玩家不是回合玩家，需在回合检查前处理）
  const tradeTo = st.pending?.kind === 'trade' ? st.players.find((p) => p.id === st.pending.to) : null
  if (tradeTo?.isAI && !netMode.value) {
    clearTimeout(aiTimer)
    aiTimer = setTimeout(() => {
      const a = aiDecide(state.value, tradeTo.id)
      if (a) dispatch(a)
    }, 1000)
    return
  }
  // 拍卖揭晓阶段：自动触发揭晓
  if (st.phase === 'auction' && st.pending?.kind === 'auction' && st.pending.roundStep === 1) {
    // 联机：只有"游戏回合玩家"的客户端触发，避免 N 个客户端重复揭晓
    const turnPlayer = currentPlayer(st)
    if (netMode.value && turnPlayer?.id !== myPlayerId.value) return
    clearTimeout(aiTimer)
    aiTimer = setTimeout(() => dispatch({ type: 'AUCTION_REVEAL' }), 1000)
    return
  }
  // 决定先手顺序阶段：当前轮到的 AI 自动掷骰
  if (st.phase === 'order' && !st.orderState?.done) {
    const orderP = st.players[st.orderState.index]
    if (orderP?.isAI) {
      clearTimeout(aiTimer)
      aiTimer = setTimeout(() => dispatch({ type: 'ROLL_ORDER' }), 800)
      return
    }
    // 轮到人类掷骰 → 等玩家手动点按钮，不调度 AI
    return
  }
  const cur = st.phase === 'auction' && st.pending?.kind === 'auction' ? st.players[st.pending.turn] : currentPlayer(st)
  if (!cur || !cur.isAI) return
  // 奇遇/神仙/破产弹窗显示时，暂停 AI 循环（等人类关闭弹窗）
  if (st.pending?.kind === 'chance' || st.pending?.kind === 'god' || st.pending?.kind === 'bankrupt') {
    clearTimeout(aiTimer)
    aiTimer = setTimeout(() => scheduleAI(), 800)
    return
  }
  // AI 在 step 阶段：自动逐格推进
  if (st.phase === 'step' && st.stepsRemaining > 0) {
    clearTimeout(aiTimer)
    aiTimer = setTimeout(() => {
      dispatch({ type: 'STEP' })
    }, 300)
    return
  }
  // 其他阶段：正常 AI 决策
  const delay = 1000
  clearTimeout(aiTimer)
  aiTimer = setTimeout(() => {
    const action = aiDecide(state.value, cur.id)
    if (action) dispatch(action)
  }, delay)
}

const cur = computed(() => (state.value ? currentPlayer(state.value) : null))

// "我自己"：底部面板/手牌/交易等"我的数据"绑定用它（联机=我对应的玩家，单机=唯一人类玩家），兜底当前回合玩家
const mePlayer = computed(() => {
  const st = state.value
  if (!st) return null
  if (netMode.value && myPlayerId.value) return st.players.find((p) => p.id === myPlayerId.value) ?? cur.value
  return st.players.find((p) => !p.isAI) ?? cur.value
})

const expandedPlayer = ref(null)

function playerStatus(p) {
  if (!p) return ''
  if (p.bankrupt) return '破产'
  if (p.id === cur.value?.id) return '行动中'
  if (p.jailLeft > 0) return '监狱' + p.jailLeft
  if (p.skipTurns > 0) return '定住'
  if (p.hospital) return '住院'
  return ''
}

const isMyTurn = computed(() => {
  if (!cur.value) return false
  if (netMode.value) return cur.value.id === myPlayerId.value
  return !cur.value.isAI
})

// ===== 轮到你横幅 + 提示音 + 震动（必须放在 isMyTurn 定义之后，防 TDZ） =====
const turnBanner = ref(false)
let turnBannerTimer = null
watch(isMyTurn, (v, old) => {
  if (v && !old && state.value?.status === 'playing') {
    turnBanner.value = true
    sfx.turn()
    vibrate(80)
    clearTimeout(turnBannerTimer)
    turnBannerTimer = setTimeout(() => { turnBanner.value = false }, 2000)
  }
})
const myLoanLimit = computed(() => cur.value ? loanLimit(cur.value, totalAssets(cur.value, state.value?.stockRuntime)) : 0)

// 随机路线卡片：仅在轮到我、且骰子/走格动画结束（确保玩家看清）时显示；必须点右上角 ✕ 关闭
const showForkCard = computed(() => {
  const st = state.value
  if (!st) return false
  if (st.phase !== 'fork' || st.pending?.kind !== 'fork') return false
  if (!isMyTurn.value) return false
  if (animating.value || diceThrowing.value) return false
  return true
})

// 选路弹窗折叠（看地图模式）：新分岔自动展开
const forkCollapsed = ref(false)
watch(showForkCard, (v) => { if (v) forkCollapsed.value = false })

// 当前是否可投掷骰子：轮到我 + 掷骰阶段 + 本回合未投过 + 非选择目标模式
const canThrowDice = computed(() => {
  const st = state.value
  if (!st || st.status !== 'playing') return false
  if (!isMyTurn.value) return false
  if (st.phase !== 'roll') return false
  if (diceRolled.value) return false
  if (selecting.value) return false
  return true
})

// ===== 选择模式 =====
const selectableTiles = computed(() => {
  const st = state.value
  if (!st || !selecting.value) return []
  const me = currentPlayer(st)
  if (selecting.value.type === 'metro') {
    // 乘轻轨：其他所有轻轨站可选（type === 'station'）；TILES[0] 是 null 必须判空
    return TILES.filter((t) => t && t.type === 'station' && t.id !== me.pos).map((t) => t.id)
  }
  if (selecting.value.type === 'checkin') {
    // 打卡大礼包：任意格可选
    return TILES.filter((t) => t && !t.removed).map((t) => t.id)
  }
  if (selecting.value.type === 'card') {
    const card = me.hand.find((c) => c.id === selecting.value.id)
    if (!card) return []
    switch (card.type) {
      case 'buy':
        // 购地卡：无主且未移除的地产（TILES[0]=null 判空 + 排除 42 号等 removed 死格）
        return TILES.filter((t) => t && !t.removed && isPropertyTile(t) && !st.players.some((p) => p.alive && p.properties.includes(t.id))).map((t) => t.id)
      case 'demolish':
        return TILES.filter((t) => t && st.players.some((p) => p.alive && p.id !== me.id && p.properties.includes(t.id) && (p.levels[t.id] ?? 0) >= 1)).map((t) => t.id)
      case 'monster':
        return TILES.filter((t) => t && st.players.some((p) => p.alive && p.id !== me.id && p.properties.includes(t.id))).map((t) => t.id)
      case 'barrier':
        return TILES.filter((t) => t && isPropertyTile(t) && !st.barriers?.[t.id]).map((t) => t.id)
      case 'swap':
        if (selecting.value.swapStep === 1) return me.properties.filter((i) => isPropertyTile(TILES[i]))
        return TILES.filter((t) => t && st.players.some((p) => p.alive && p.id !== me.id && p.properties.includes(t.id))).map((t) => t.id)
      default:
        return []
    }
  }
  return []
})

const selectablePlayers = computed(() => {
  const st = state.value
  if (!st || !selecting.value) return []
  const me = currentPlayer(st)
  if (selecting.value.type === 'card') {
    const card = me.hand.find((c) => c.id === selecting.value.id)
    if (!card) return []
    if (card.type === 'hold' || card.type === 'steal') {
      return st.players.filter((p) => p.alive && p.id !== me.id).map((p) => p.id)
    }
  }
  return []
})

function onTileClick(tileId) {
  // 调试传送模式优先：点棋盘格子 = 把目标玩家传送到该格（触发落地）
  if (debugTeleport.value) {
    dispatch({ type: 'DEBUG_TELEPORT', playerId: debugTeleport.value.playerId, tileId })
    debugTeleport.value = null
    return
  }
  if (!selecting.value) return
  const sel = selecting.value
  if (sel.type === 'metro') {
    dispatch({ type: 'TRAVEL_METRO', targetTileId: tileId })
  } else if (sel.type === 'checkin') {
    dispatch({ type: 'CHECKIN_TELEPORT', tileId })
  } else if (sel.type === 'card') {
    if (sel.mode === 'swap' && sel.swapStep === 1) {
      selecting.value = { ...sel, swapStep: 2, myTile: tileId }
      return
    }
    const target =
      sel.mode === 'swap'
        ? { myTile: sel.myTile, theirTile: tileId }
        : { tileId }
    dispatch({ type: 'USE_CARD', cardId: sel.id, target })
  }
  selecting.value = null
}

function onPlayerClick(playerId) {
  if (!selecting.value) return
  const sel = selecting.value
  if (sel.type === 'card') {
    dispatch({ type: 'USE_CARD', cardId: sel.id, target: { playerId } })
  }
  selecting.value = null
}

// 手机端玩家信息条点击：选目标玩家模式优先（停留卡等选人），否则开自己手牌/展开他人详情
function onStripPlayerClick(p) {
  if (selecting.value && selectablePlayers.value.includes(p.id)) {
    onPlayerClick(p.id)
    return
  }
  if (p.id === mePlayer.value?.id) {
    myModal.value = 'lands' // 点自己 → 查看地产面板（含总价值）
  } else {
    expandedPlayer.value = expandedPlayer.value === p.id ? null : p.id
  }
}

// 手牌点击
function useCard(card) {
  if (!isMyTurn.value) return
  // 第一回合不能用卡：提前提示，不让玩家白选目标
  if (mePlayer.value?.firstTurn) {
    showNetNotice('第一回合不能用卡！')
    return
  }
  // 本回合已用过卡片：不进入选目标模式，直接提示
  if (mePlayer.value?.cardUsed) {
    showNetNotice('本回合已经用过卡片了（每回合限1张）')
    return
  }
  myModal.value = null // 先关掉底部弹窗，露出棋盘（选目标/看使用效果）
  const kind = cardTargetKind(card.type)
  if (kind === 'none') {
    dispatch({ type: 'USE_CARD', cardId: card.id })
    return
  }
  if (kind === 'tile') {
    selecting.value = { type: 'card', id: card.id, mode: 'tile' }
    return
  }
  if (kind === 'swap') {
    selecting.value = { type: 'card', id: card.id, mode: 'swap', swapStep: 1 }
    return
  }
  if (kind === 'player') {
    selecting.value = { type: 'card', id: card.id, mode: 'player' }
    return
  }
  if (kind === 'stock') {
    // 黑市卡/红市卡：选一只股票生效
    selecting.value = { type: 'card', id: card.id, mode: 'stock' }
  }
}

function startMetro() {
  if (!isMyTurn.value) return
  selecting.value = { type: 'metro', id: null }
}

// 从轻轨格详情卡点"乘轻轨"：关详情 → 进入选站模式
function onLandInfoMetro() {
  infoTile.value = null
  startMetro()
}

// 银行贷款
function takeLoan() {
  if (loanAmount.value <= 0 || loanAmount.value > myLoanLimit.value) return
  dispatch({ type: 'TAKE_LOAN', amount: loanAmount.value })
  loanAmount.value = 0
}
function repayLoan() {
  if (loanAmount.value <= 0) return
  dispatch({ type: 'REPAY_LOAN', amount: loanAmount.value })
  loanAmount.value = 0
}

function openTileInfo(id) {
  // 选目标过程中（用卡/乘轻轨/传送）点非高亮格不弹详情，防全屏弹窗打断选地流程
  if (selecting.value) return
  infoTile.value = id
  myModal.value = null // 从地产弹窗跳转时先关掉它
}

function upgradeFromInfo(id) {
  dispatch({ type: 'UPGRADE_PROPERTY', tileId: id })
  infoTile.value = null
}

function cancelSelect() {
  selecting.value = null
}

const selectHint = computed(() => {
  const sel = selecting.value
  if (!sel) return ''
  if (sel.type === 'metro') return '选一个轻轨站（花 ¥150 乘过去）'
  if (sel.type === 'checkin') return '选择大礼包传送目的地（免费）'
  if (sel.type === 'card') {
    if (sel.mode === 'swap' && sel.swapStep === 1) return '点一块自己的地（用于交换）'
    if (sel.mode === 'swap') return '点一块对方的地（换过去）'
    if (sel.mode === 'player') return '选一个目标玩家'
    if (sel.mode === 'stock') return '选一只股票生效'
    return '选一个目标格子'
  }
  return '选一个放置/传送的格子'
})

// 股票卡（黑市/红市）目标选择
const stockCard = computed(() => {
  if (selecting.value?.type !== 'card' || selecting.value.mode !== 'stock') return null
  return currentPlayer(state.value)?.hand.find((c) => c.id === selecting.value.id) ?? null
})
function pickStock(code) {
  if (!stockCard.value) return
  dispatch({ type: 'USE_CARD', cardId: stockCard.value.id, target: { code } })
  selecting.value = null
}

// 朝天门打卡大礼包弹窗（我的回合、动画结束后显示）
const showCheckin = computed(() => {
  const st = state.value
  if (!st || st.pending?.kind !== 'checkin') return false
  if (!isMyTurn.value) return false
  if (animating.value || diceThrowing.value || selecting.value) return false
  return true
})
function startCheckinTeleport() {
  selecting.value = { type: 'checkin' }
}

// 拍卖弹窗：轮到【我】出价时才显示（此前所有客户端都会弹，非出价人的出价会被服务器拒绝）
const showAuction = computed(() => {
  const st = state.value
  if (!st || st.phase !== 'auction' || st.pending?.kind !== 'auction') return false
  const ap = st.pending
  if (ap.roundStep !== 0) return false // 出价阶段才显示
  const bidder = st.players[ap.turn]
  if (!bidder || bidder.isAI) return false
  return netMode.value ? bidder.id === myPlayerId.value : true
})

// 拍卖揭晓弹窗：所有玩家出完后显示结果
const showAuctionReveal = computed(() => {
  const st = state.value
  if (!st || st.phase !== 'auction' || st.pending?.kind !== 'auction') return false
  return st.pending.roundStep === 1
})

// 拍卖出价者：弹窗现金/上限应显示出价人资金（pending.turn），而非当前回合玩家
const auctionBidder = computed(() => state.value?.players?.[state.value.pending?.turn] ?? null)

// 人类拍卖出价输入
const auctionBid = ref(0)

// 决定先手顺序阶段
const isOrderPhase = computed(() => state.value?.phase === 'order')
const orderState = computed(() => state.value?.orderState)
const orderCurrentPlayer = computed(() => {
  const os = orderState.value
  if (!os || os.done) return null
  return state.value?.players[os.index]
})
const isMyOrderTurn = computed(() => {
  const cp = orderCurrentPlayer.value
  if (!cp || cp.isAI) return false
  // 联机：只有轮到的玩家自己的客户端显示掷骰按钮（否则所有客户端都会显示）
  if (netMode.value) return cp.id === myPlayerId.value
  return true
})

// 开局顺序确定后的全员确认弹窗：done 从 false→true 时弹出，玩家点"开始游戏"关闭
const showOrderResult = ref(false)
watch(() => state.value?.orderState?.done, (v, old) => {
  if (v && !old && state.value?.phase === 'roll') showOrderResult.value = true
})

// 卡片商店弹窗：路过双碑/巴南、轮到我的回合、动画结束后显示
const showShop = computed(() => {
  const st = state.value
  if (!st || st.pending?.kind !== 'shop') return false
  if (!isMyTurn.value) return false
  if (animating.value || diceThrowing.value || selecting.value) return false
  return true
})

// 彩票开奖弹窗
const showLotteryDraw = computed(() => {
  const st = state.value
  if (!st || st.pending?.kind !== 'lottery_draw') return false
  return true
})
const lotteryDrawWinner = computed(() => state.value?.pending?.winnerName)
const lotteryDrawWinning = computed(() => state.value?.pending?.winning)
const lotteryDrawPrize = computed(() => state.value?.pending?.prize)

// 免租卡询问弹窗
const showShieldPopup = computed(() => {
  const st = state.value
  if (!st || st.pending?.kind !== 'shield') return false
  if (!isMyTurn.value) return false
  // 与其他落地弹窗一致：动画/掷骰中不弹（否则弹窗与骰子动画抢焦点）
  if (animating.value || diceThrowing.value) return false
  return true
})
// 彩票弹窗
const showLottery = computed(() => {
  const st = state.value
  if (!st || st.pending?.kind !== 'lottery') return false
  if (!isMyTurn.value) return false
  if (animating.value || diceThrowing.value || selecting.value) return false
  return true
})
// 神仙附身弹窗：所有玩家可见（显示被附身玩家名字）
const showGodPopup = computed(() => {
  const st = state.value
  if (!st || st.pending?.kind !== 'god') return false
  if (animating.value || diceThrowing.value || selecting.value) return false
  return true
})
// 被附身玩家名字
const godPlayerName = computed(() => {
  const st = state.value
  if (!st || st.pending?.kind !== 'god') return ''
  const gp = st.pending
  return st.players.find(p => p.id === gp.playerId)?.name || ''
})
// 奇遇事件弹窗：所有玩家可见（单人=任何时候都弹，联机=全客户端弹出）
const showChancePopup = computed(() => {
  const st = state.value
  if (!st || st.pending?.kind !== 'chance') return false
  if (animating.value || diceThrowing.value || selecting.value) return false
  return true
})
// 破产弹窗：所有玩家可见
const showBankruptPopup = computed(() => {
  const st = state.value
  if (!st || st.pending?.kind !== 'bankrupt') return false
  return true
})
// 奖金提示弹窗：所有玩家可见
const showBonusInfo = computed(() => {
  const st = state.value
  if (!st || st.pending?.kind !== 'bonus_info') return false
  if (animating.value || diceThrowing.value || selecting.value) return false
  return true
})
const myNumbers = computed(() => {
  const st = state.value
  if (!st || !cur.value) return []
  return st.lottery?.pickedNumbers?.[cur.value.id] || []
})
function isNumberTaken(n) {
  const st = state.value
  if (!st) return false
  for (const nums of Object.values(st.lottery?.pickedNumbers || {})) {
    if (nums.includes(n)) return true
  }
  return false
}
function isMyNumber(n) {
  return myNumbers.value.includes(n)
}

// 彩票多选
const selectedNumbers = ref([])
const lotteryPrice = 500
function isSelected(n) {
  return selectedNumbers.value.includes(n)
}
function toggleNumber(n) {
  if (isNumberTaken(n)) return
  const idx = selectedNumbers.value.indexOf(n)
  if (idx >= 0) {
    selectedNumbers.value.splice(idx, 1)
  } else {
    selectedNumbers.value.push(n)
  }
}
function clearSelection() {
  selectedNumbers.value = []
}
function buySelectedTickets() {
  if (selectedNumbers.value.length === 0) return
  dispatch({ type: 'BUY_TICKETS', numbers: [...selectedNumbers.value] })
  selectedNumbers.value = []
}
// 打开彩票弹窗时清空选择
watch(showLottery, (val) => {
  if (val) selectedNumbers.value = []
})

// 股票事件处理
function onStockBuy(payload) {
  dispatch({ type: 'STOCK_BUY', code: payload.code, shares: payload.shares })
}
function onStockSell(payload) {
  dispatch({ type: 'STOCK_SELL', code: payload.code, shares: payload.shares })
}
</script>

<template>
  <div class="app halftone">
    <!-- Android 返回键"再按一次退出"提示 -->
    <div v-if="backHint" class="back-hint">{{ backHint }}</div>
    <!-- 统一顶部通知栈（最上层可见：规则提示/服务器拒绝等，2.5s 自动消失） -->
    <div class="notice-stack">
      <TransitionGroup name="notice">
        <div v-for="n in notices" :key="n.id" class="notice-item" :class="{ 'notice-item--error': n.type === 'error' }">{{ n.msg }}</div>
      </TransitionGroup>
    </div>
    <!-- 轮到你横幅 -->
    <div v-if="turnBanner" class="turn-banner">🎯 轮到你了</div>
    <header class="app__head">
      <h1 class="comic-title comic-title--xl">
        <span class="comic-stripe">大富翁——重庆之旅</span>
      </h1>
    </header>

    <!-- 首页 -->
    <Home v-if="view === 'home'" @start="view = 'mode'" @rejoin="onRejoinGame" @open-encyclopedia="showEncyclopedia = true" />

    <!-- 选模式 -->
    <ModeSelect
      v-else-if="view === 'mode'"
      @single="view = 'setup'"
      @create="lobbyMode = 'create'; ensureSocket(); view = 'lobby'"
      @join="lobbyMode = 'join'; ensureSocket(); view = 'lobby'"
    />

    <!-- 单机设置 -->
    <SetupPanel
      v-else-if="view === 'setup'"
      @start="startGame"
      @back="view = 'mode'"
    />

    <!-- 联机大厅 -->
    <Lobby
      v-else-if="view === 'lobby'"
      :mode="lobbyMode"
      @enter="onEnterNetGame"
      @back="view = 'mode'"
    />

    <!-- 联机进入对局：等第一条 gameState 广播（服务器不可达时可退出回首页） -->
    <div v-else-if="view === 'game' && !state" class="net-loading card-comic">
      <p>📡 正在同步对局…</p>
      <button class="btn-comic btn-comic--sm btn-comic--ghost" @click="view = 'home'; netMode = false">返回首页</button>
    </div>

    <!-- 游戏界面 -->
    <template v-else-if="view === 'game'">
      <div class="app__game">
        <main class="app__board">
          <div v-if="selecting" class="select-bar bubble">
            <span class="select-bar__text"><ComicIcon name="target" :size="16" /> {{ selectHint }}</span>
            <button class="btn-comic btn-comic--sm btn-comic--ghost" @click="cancelSelect">取消</button>
          </div>
          <!-- 股票卡（黑市/红市）：选目标股票 -->
          <div v-if="stockCard" class="card-comic stock-picker">
            <p class="stock-picker__title">{{ stockCard.name }} · 选一只股票</p>
            <div class="stock-picker__list">
              <button
                v-for="(def, code) in STOCKS"
                :key="code"
                class="stock-picker__item"
                @click="pickStock(code)"
              >{{ def.icon }} {{ def.name }}</button>
            </div>
          </div>
          <!-- 手机端：玩家信息条（点击展开；选目标玩家模式下可点选） -->
          <div v-if="state" class="player-strip">
            <div
              v-for="p in state.players"
              :key="p.id"
              class="player-strip__item"
              :class="{ 'player-strip__item--turn': p.id === cur?.id, 'player-strip__item--dead': p.bankrupt, 'player-strip__item--open': expandedPlayer === p.id, 'player-strip__item--pick': !!selecting && selectablePlayers.includes(p.id) }"
              @click="onStripPlayerClick(p)"
            >
              <div class="player-strip__summary">
                <i class="player-strip__dot" :style="{ background: p.color }"></i>
                <span class="player-strip__name">{{ p.name }}</span>
                <span v-if="playerStatus(p)" class="player-strip__status">{{ playerStatus(p) }}</span>
                <span class="player-strip__stats">
                  <span class="player-strip__stat" title="地产">🏠{{ p.properties.length }}</span>
                  <span class="player-strip__stat" title="手牌">🎴{{ (myPlayerId ? p.id === myPlayerId : !p.isAI) ? p.hand.length : '?' }}</span>
                  <span v-if="p.god" class="player-strip__stat player-strip__stat--god" title="神仙附身">{{ GODS[p.god]?.icon || '👻' }}{{ GODS[p.god]?.name || '' }}</span>
                  <span class="player-strip__stat" title="骰子数">🎲{{ VEHICLES[p.vehicle]?.dice ?? 1 }}</span>
                  <span v-if="p.points" class="player-strip__stat player-strip__stat--pts" title="卡片积分">{{ p.points }}分</span>
                </span>
                <span class="player-strip__money" :class="{ 'player-strip__money--debt': p.money < 0, 'player-strip__money--warn': p.id === myPlayerId && p.money < 800 }">{{ p.money < 0 ? '欠¥' + (-p.money) : '¥' + p.money }}</span>
                <span v-if="p.id !== mePlayer?.id" class="player-strip__arrow">{{ expandedPlayer === p.id ? '▲' : '▼' }}</span>
              </div>
              <div v-if="expandedPlayer === p.id && p.id !== mePlayer?.id" class="player-strip__detail">
                <span class="player-strip__count">🏠 地产 {{ p.properties.length }}</span>
                <span v-if="p.points" class="player-strip__points">积分 {{ p.points }}</span>
              </div>
            </div>
          </div>
          <div ref="boardWrapEl" class="board-wrap">
            <div ref="boardEl" class="board-anchor">
              <Board
                :state="state"
                :current="cur"
                :selectable="selectableTiles"
                :last-move="lastMove"
                :hide-pawns="false"
                :extra-hide-pids="animating || diceThrowing ? animatingPids : []"
                :teleport-mode="!!debugTeleport"
                @tile-click="onTileClick"
                @tile-info="openTileInfo"
              />
              <!-- 金钱变动飘字层（叠在棋盘上，按格子百分比定位） -->
              <span
                v-for="f in moneyFxList"
                :key="f.key"
                class="money-fx"
                :style="{ left: f.x + '%', top: f.y + '%', color: f.color, borderColor: f.color }"
              >{{ f.delta > 0 ? '+' + f.delta : f.delta }}</span>
            </div>
          </div>
          <ActionPanel
            ref="actionPanelEl"
            :state="state"
            :current="cur"
            :is-my-turn="isMyTurn"
            :animating="animating"
            :room-id="currentRoomId"
            :is-host="isHost"
            :paused="paused"
            :ai-takeover="aiTakeover"
            :turn-time-left="turnTimeLeft"
            :players="lobbyPlayers"
            :game-log="gameLog"
            @dispatch="dispatch"
            @metro="startMetro"
            @surrender="onSurrender"
            @pause="onTogglePause"
            @kick="onKickPlayer"
            @set-password="onSetPassword"
            @toggle-a-i-takeover="onToggleAITakeover"
          />
        </main>

        <SidePanel :state="state" :current="cur" :me="mePlayer" :selectable-players="selectablePlayers" @player-click="onPlayerClick" @trade="openTrade" />
      </div>

      <div class="app__bags">
        <BagsBar :me="mePlayer" :state="state" @open="myModal = $event" @open-encyclopedia="showEncyclopedia = true" @open-loan="showLoan = true" />
      <GameMenu
        :room-id="currentRoomId"
        :is-host="isHost"
        :is-my-turn="isMyTurn"
        :paused="paused"
        :ai-takeover="aiTakeover"
        :turn-time-left="turnTimeLeft"
        :players="lobbyPlayers"
        :game-log="gameLog"
        @surrender="onSurrender"
        @pause="onTogglePause"
        @kick="onKickPlayer"
        @set-password="onSetPassword"
        @toggle-a-i-takeover="onToggleAITakeover"
      />
    </div>

      <!-- 决定先手顺序弹窗 -->
      <div v-if="isOrderPhase" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card order-popup">
          <div class="fork-card__dice">🎲</div>
          <h3 class="comic-title comic-title--md">决定行动顺序</h3>
          <p class="fork-card__sub">每人掷 3 颗骰子，点数大的先手</p>
          <div class="order-list">
            <div
              v-for="(p, i) in state.players"
              :key="p.id"
              class="order-item"
              :class="{ 'order-item--current': orderState?.index === i && !orderState?.done, 'order-item--done': orderState?.rolls?.[p.id] }"
            >
              <i class="order-item__dot" :style="{ background: p.color }"></i>
              <span class="order-item__name">{{ p.name }}<em v-if="p.isAI">AI</em></span>
              <span v-if="orderState?.rolls?.[p.id]" class="order-item__dice">
                {{ orderState.rolls[p.id].join(' + ') }} = <b>{{ orderState.rolls[p.id].reduce((a,b) => a+b, 0) }}</b>
              </span>
              <span v-else class="order-item__wait">等待中...</span>
            </div>
          </div>
          <button v-if="isMyOrderTurn" class="btn-comic" @click="dispatch({ type: 'ROLL_ORDER' })">
            🎲 掷骰子
          </button>
          <p v-else-if="!orderState?.done" class="fork-card__hint">等待 {{ orderCurrentPlayer?.name }} 掷骰...</p>
        </div>
      </div>

      <!-- 顺序确定确认弹窗：全员可见，各自点"开始游戏"关闭 -->
      <div v-if="showOrderResult" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card order-result">
          <div class="fork-card__dice">🏁</div>
          <h3 class="comic-title comic-title--md">行动顺序已定</h3>
          <ol class="order-result__list">
            <li v-for="(p, i) in state.players" :key="p.id" class="order-result__item" :class="{ 'order-result__item--me': p.id === myPlayerId }">
              <b class="order-result__rank">{{ i + 1 }}</b>
              <i class="player-strip__dot" :style="{ background: p.color }"></i>
              <span class="order-result__name">{{ p.name }}</span>
              <span v-if="orderState?.rolls?.[p.id]" class="order-result__roll">{{ orderState.rolls[p.id].join('+') }} = {{ orderState.rolls[p.id].reduce((a, b) => a + b, 0) }}点</span>
            </li>
          </ol>
          <button class="btn-comic" @click="showOrderResult = false">开始游戏</button>
        </div>
      </div>

      <!-- 底部入口弹窗（卡牌/地产/其它） -->
      <MyPanelModal
        v-if="myModal"
        :mode="myModal"
        :me="mePlayer"
        :state="state"
        :is-my-turn="isMyTurn"
        @close="myModal = null"
        @use-card="useCard"
        @upgrade="(id) => dispatch({ type: 'UPGRADE_PROPERTY', tileId: id })"
        @info="openTileInfo"
        @stock-buy="onStockBuy"
        @stock-sell="onStockSell"
      />

      <!-- 百科全书弹窗 -->
      <Encyclopedia v-if="showEncyclopedia" :state="state" @close="showEncyclopedia = false" />

      <!-- 银行贷款面板 -->
      <div v-if="showLoan" class="modal-overlay" @click.self="showLoan = false">
        <div class="modal-card loan-panel">
          <button class="modal-card__close" @click="showLoan = false">✕</button>
          <h3 class="comic-title comic-title--md">🏦 银行贷款</h3>

          <!-- 无贷款状态：申请借款 -->
          <div v-if="!cur?.loanRepay" class="loan-panel__section">
            <p class="loan-panel__info">可贷额度：<b :class="{'text-danger': myLoanLimit <= 0}">¥{{ myLoanLimit }}</b></p>
            <p class="loan-panel__hint">贷款期限 10 回合，还款 = 借款 × 120%（20% 利息）</p>
            <p class="loan-panel__hint">到期未还 → 强制变卖资产 → 破产</p>
            <div class="loan-panel__input-row">
              <input v-model.number="loanAmount" type="number" min="1000" :max="myLoanLimit" step="1000" class="loan-panel__input" placeholder="输入借款金额" />
              <button class="btn-comic btn-comic--primary" :disabled="loanAmount <= 0 || loanAmount > myLoanLimit || myLoanLimit <= 0" @click="takeLoan">借款</button>
            </div>
            <p v-if="loanAmount > 0 && myLoanLimit > 0" class="loan-panel__preview">实得 ¥{{ loanAmount }} · 到期需还 ¥{{ Math.round(loanAmount * 1.2) }}</p>
          </div>

          <!-- 有贷款状态：还款 -->
          <div v-else class="loan-panel__section">
            <p class="loan-panel__info">待还总额：<b class="text-danger">¥{{ cur?.loanRepay }}</b></p>
            <p class="loan-panel__info">剩余本金：<b>¥{{ cur?.loan }}</b></p>
            <p class="loan-panel__info">到期回合：<b>{{ cur?.loanDue > 0 ? '第 ' + cur?.loanDue + ' 回合' : '无' }}</b></p>
            <p v-if="cur?.loanDue > 0" class="loan-panel__hint" :class="{'text-danger': cur?.loanDue - state.round <= 3}">
              还剩 {{ cur?.loanDue - state.round }} 回合
            </p>
            <div class="loan-panel__input-row">
              <input v-model.number="loanAmount" type="number" min="1" :max="cur?.loanRepay" step="500" class="loan-panel__input" placeholder="输入还款金额" />
              <button class="btn-comic btn-comic--primary" :disabled="loanAmount <= 0 || loanAmount > cur?.loanRepay" @click="repayLoan">还款</button>
            </div>
            <button class="btn-comic btn-comic--sm loan-panel__repay-all" :disabled="!cur?.loanRepay" @click="loanAmount = cur?.loanRepay; repayLoan()">一次性还清</button>
          </div>
        </div>
      </div>

      <ResultOverlay v-if="state.status === 'finished'" :state="state" @again="startGame(lastOpts)" />

      <!-- 可拿取骰子（轮到我时拖到棋盘扔出去）：
           Teleport 到 body 最外层，避免页面 DOM 里带 transform/filter 的祖先让 fixed 失效，导致骰子随页面滚动 -->
      <Teleport to="body">
        <DiceThrow
          v-if="canThrowDice || diceThrowing || spectateDice"
          :can-throw="canThrowDice"
          :final-dice="spectateDice ? spectateDice.dice : (state.dice || undefined)"
          :dice-count="spectateDice ? spectateDice.diceCount : (cur ? VEHICLES[cur.vehicle]?.dice : 1)"
          :board-el="boardEl"
          :anchor-el="actionPanelEl && actionPanelEl.$el"
          :spectate="spectateDice"
          @throw="onDiceThrow"
          @settle="onSpectateSettle"
        />
      </Teleport>

      <!-- 地块详情弹窗 -->
      <LandInfoModal
        v-if="infoTile"
        :state="state"
        :tile-id="infoTile"
        @close="infoTile = null"
        @upgrade="upgradeFromInfo"
        @metro="onLandInfoMetro"
      />

      <!-- 分岔路口：选路卡可自选方向 / 无选路卡则随机分配 -->
      <div
        v-if="showForkCard && !forkCollapsed"
        class="overlay-layer fork-card-overlay fork-card-overlay--transparent"
      >
        <div class="card-comic card-comic--pad-lg fork-card">
          <button class="fork-card__close" @click="onForkClose" aria-label="关闭路线卡片">✕</button>
          <div class="fork-card__dice">🎲</div>
          <h3 class="comic-title comic-title--md">{{ state.pending.canPick ? '选路卡' : '随机路线' }}</h3>
          <p class="fork-card__sub">
            在「{{ TILES[state.pending.tileId].name }}」分岔口{{ state.pending.canPick ? '，选择一条路线' : '，已随机分配路线：' }}
          </p>
          <!-- 自选模式：显示所有可选方向 -->
          <div v-if="state.pending.canPick" class="fork-card__opts">
            <button
              v-for="optId in state.pending.options"
              :key="optId"
              class="btn-comic btn-comic--sm fork-card__opt"
              @click="chooseFork(optId)"
            >
              {{ TILES[optId].name }}
            </button>
          </div>
          <!-- 随机模式：显示结果 -->
          <div v-else class="fork-card__route">{{ TILES[state.pending.chosen].name }}</div>
          <p class="fork-card__hint">选择后会继续走完剩余 {{ state.pending.stepsLeft + 1 }} 步（含本步）· 点右上角 ✕ 随机选路</p>
          <button v-if="state.pending.canPick" class="btn-comic btn-comic--sm btn-comic--ghost fork-card__map-btn" @click="forkCollapsed = true">
            🗺️ 看地图
          </button>
        </div>
      </div>
      <!-- 选路折叠角标：看地图期间持续提醒待选路 -->
      <button
        v-if="showForkCard && forkCollapsed"
        class="fork-fab"
        @click="forkCollapsed = false"
      >⑂ 待选路</button>

      <!-- 卡片商店（路过双碑/巴南） -->
      <div v-if="showShop" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card shop-card">
          <button class="fork-card__close" @click="dispatch({ type: 'SHOP_CLOSE' })" aria-label="关闭商店">✕</button>
          <div class="fork-card__dice">🛒</div>
          <h3 class="comic-title comic-title--md">卡片商店</h3>
          <p class="fork-card__sub">路过「{{ TILES[state.pending.tileId].name }}」卡片商店 · 我的积分 <b class="shop-pts">{{ cur.points }}</b></p>
          <div class="shop-list">
            <button
              v-for="c in CARDS"
              :key="c.type"
              class="shop-row"
              :disabled="cur.points < c.price || cur.hand.length >= 10"
              @click="dispatch({ type: 'SHOP_BUY', cardId: c.type })"
            >
              <span class="shop-row__name">{{ c.name }}</span>
              <span class="shop-row__desc">{{ c.desc }}</span>
              <b class="shop-row__price">{{ c.price }}</b>
            </button>
          </div>
          <p class="fork-card__hint">手牌上限 10 张 · 积分不足或手牌满时按钮置灰</p>
          <button class="btn-comic btn-comic--ghost" @click="dispatch({ type: 'SHOP_CLOSE' })">离开商店</button>
        </div>
      </div>

      <!-- 朝天门打卡大礼包 -->
      <div v-if="showCheckin" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card">
          <button class="fork-card__close" @click="dispatch({ type: 'CHECKIN_SKIP' })" aria-label="关闭大礼包">✕</button>
          <div class="fork-card__dice">🎁</div>
          <h3 class="comic-title comic-title--md">打卡大礼包</h3>
          <p class="fork-card__sub">朝天门打卡满 3 次！获得：</p>
          <div class="fork-card__route" style="font-size: 16px">💰 ¥5000 · 🃏 3 张随机卡 · 🚀 免费传送</div>
          <button class="btn-comic" @click="startCheckinTeleport">选择去往哪里</button>
        </div>
      </div>

      <!-- 地块拍卖 -->
      <div v-if="showAuction" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card">
          <div class="fork-card__dice">🔨</div>
          <h3 class="comic-title comic-title--md">地块拍卖 · 第 {{ state.pending.round + 1 }} 轮</h3>
          <p class="fork-card__sub">
            正在拍卖「{{ TILES[state.pending.tileId].name }}」（原价 ¥{{ TILES[state.pending.tileId].price }}）
          </p>
          <div class="fork-card__route">零元起拍（盲拍，他人看不到你的出价）</div>
          <p class="fork-card__hint">轮到你出价 · 现金 ¥{{ cur.money }} · 出完所有人揭晓（他人出价对你不可见）</p>
          <div class="auction-input-row">
            <input v-model.number="auctionBid" class="input-comic" type="number" min="0" :max="cur.money" step="100" placeholder="输入出价" />
            <span class="auction-input-unit">元</span>
          </div>
          <div class="fork-card__btns">
            <button class="btn-comic" @click="dispatch({ type: 'AUCTION_BID', amount: auctionBid }); auctionBid = 0">出价</button>
            <button class="btn-comic btn-comic--ghost" @click="dispatch({ type: 'AUCTION_BID', amount: 0 })">放弃</button>
          </div>
        </div>
      </div>

      <!-- 拍卖揭晓 -->
      <div v-if="showAuctionReveal" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card">
          <div class="fork-card__dice">📋</div>
          <h3 class="comic-title comic-title--md">拍卖揭晓 · 第 {{ state.pending.round + 1 }} 轮</h3>
          <p class="fork-card__sub">
            「{{ TILES[state.pending.tileId].name }}」本轮出价：
          </p>
          <div class="auction-reveal-list">
            <div v-for="(amt, i) in Object.values(state.pending.bids)" :key="i" class="auction-reveal-row">
              <span class="auction-reveal-name">第 {{ i + 1 }} 位</span>
              <span class="auction-reveal-amt">{{ amt > 0 ? '¥' + amt : '放弃' }}</span>
            </div>
          </div>
          <p class="fork-card__hint">{{ state.pending.round + 1 >= state.pending.maxRounds ? '最终轮，最高价者得' : '若最高价平局则再加赛一轮' }}</p>
          <button class="btn-comic" @click="dispatch({ type: 'AUCTION_REVEAL' })">看结果</button>
        </div>
      </div>

      <!-- 彩票站弹窗 -->
      <div v-if="showLottery" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card shop-card">
          <button class="fork-card__close" @click="dispatch({ type: 'LOTTERY_CLOSE' })" aria-label="关闭彩票站">✕</button>
          <div class="fork-card__dice">🎫</div>
          <h3 class="comic-title comic-title--md">彩票站</h3>
          <p class="fork-card__sub">路过「{{ state.pending?.tileId ? TILES[state.pending.tileId].name : '彩票站' }}」· 奖池 <b class="shop-pts">¥{{ state.lottery?.pool ?? 10000 }}</b></p>
          <div class="lottery-info">
            <span v-if="state.lottery?.phase === 'buying'">📋 选一个 1-100 的数字（全局唯一）</span>
            <span v-else>🎰 开奖中... 当前中奖号: {{ state.lottery?.currentWinning ?? '?' }}</span>
          </div>
          <div v-if="state.lottery?.phase === 'buying'" class="lottery-buy">
            <div class="lottery-numbers">
              <button
                v-for="n in 100"
                :key="n"
                class="lot-num"
                :class="{ 'lot-num--taken': isNumberTaken(n), 'lot-num--mine': isMyNumber(n), 'lot-num--sel': isSelected(n) }"
                :disabled="isNumberTaken(n)"
                @click="toggleNumber(n)"
              >{{ n }}</button>
            </div>
            <div class="lottery-cart">
              <span class="lottery-cart__info">已选 <b>{{ selectedNumbers.length }}</b> 张 · ¥{{ selectedNumbers.length * lotteryPrice }}</span>
              <button class="btn-comic btn-comic--sm" :disabled="selectedNumbers.length === 0" @click="buySelectedTickets()">购买选中的票</button>
              <button class="btn-comic btn-comic--sm btn-comic--ghost" :disabled="selectedNumbers.length === 0" @click="clearSelection()">清空</button>
            </div>
            <div class="lottery-my">
              <span v-if="myNumbers.length">我的号码: {{ myNumbers.join(', ') }}</span>
              <span v-else>本回合还没买彩票</span>
            </div>
          </div>
          <button class="btn-comic btn-comic--ghost" @click="dispatch({ type: 'LOTTERY_CLOSE' })">离开彩票站</button>
        </div>
      </div>

      <!-- 神仙附身弹窗（全员可见） -->
      <div v-if="showGodPopup" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card god-popup">
          <div class="fork-card__dice god-popup__icon">{{ GODS[state.pending.godId]?.icon || '✨' }}</div>
          <h3 class="comic-title comic-title--md">神仙附身</h3>
          <p class="fork-card__sub god-popup__name">{{ godPlayerName }} 被「{{ GODS[state.pending.godId]?.name }}」附身！</p>
          <div class="god-popup__desc">{{ GODS[state.pending.godId]?.desc }}</div>
          <p class="fork-card__hint">持续 {{ GODS[state.pending.godId]?.duration || 0 }} 回合</p>
          <button class="btn-comic" @click="dispatch({ type: 'GOD_CLOSE' })">知道了</button>
        </div>
      </div>

      <!-- 奇遇事件弹窗 -->
      <div v-if="showChancePopup" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card chance-popup">
          <div class="fork-card__dice chance-popup__icon">{{ state.pending.event?.icon || '❓' }}</div>
          <h3 class="comic-title comic-title--md">奇遇</h3>
          <p class="fork-card__sub chance-popup__title">{{ state.pending.event?.text }}</p>
          <div class="chance-popup__desc">{{ state.pending.event?.desc }}</div>
          <button class="btn-comic" @click="dispatch({ type: 'CHANCE_CLOSE' })">知道了</button>
        </div>
      </div>

      <!-- 免租卡询问弹窗 -->
      <div v-if="showShieldPopup" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card shield-popup">
          <div class="fork-card__dice">🛡️</div>
          <h3 class="comic-title comic-title--md">使用免租卡？</h3>
          <p class="fork-card__sub">你手中有免租卡，是否使用来豁免本次{{ state.pending?.feeName || '租金' }}？</p>
          <div class="fork-card__btns">
            <button class="btn-comic btn-comic--ghost" @click="dispatch({ type: 'SHIELD_SKIP' })">正常支付</button>
            <button class="btn-comic" @click="dispatch({ type: 'SHIELD_USE' })">使用免租卡</button>
          </div>
        </div>
      </div>

      <!-- 彩票开奖弹窗 -->
      <div v-if="showLotteryDraw" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card lottery-draw-popup">
          <!-- 礼花庆祝动画（中奖时） -->
          <div v-if="lotteryDrawWinner" class="confetti-container">
            <div v-for="i in 30" :key="i" class="confetti" :style="{ '--x': Math.random() * 100 + '%', '--d': Math.random() * 360 + 'deg', '--delay': Math.random() * 0.5 + 's', '--color': ['#ef4444','#f59e0b','#22c55e','#3b82f6','#a855f7','#ec4899'][i % 6] }"></div>
          </div>
          <div class="fork-card__dice lottery-draw__icon">{{ lotteryDrawWinner ? '🎉' : '🎰' }}</div>
          <h3 class="comic-title comic-title--md">{{ lotteryDrawWinner ? '头奖揭晓！' : '彩票开奖' }}</h3>
          <p class="fork-card__sub lottery-draw__number">中奖号码：<b>{{ lotteryDrawWinning }}</b></p>
          <div v-if="lotteryDrawWinner" class="lottery-draw__win">
            <p class="lottery-draw__winner">🎊 {{ lotteryDrawWinner }} 中奖了！🎊</p>
            <p class="lottery-draw__prize">获得奖金 <b>¥{{ lotteryDrawPrize }}</b></p>
          </div>
          <p v-else class="lottery-draw__lose">😢 无人中奖，继续购买等待下一轮开奖...</p>
          <button class="btn-comic" @click="dispatch({ type: 'LOTTERY_DRAW_CLOSE' })">
            {{ lotteryDrawWinner ? '太棒了！' : '知道了' }}
          </button>
        </div>
      </div>

      <!-- 破产弹窗 -->
      <div v-if="showBankruptPopup" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card bankrupt-popup">
          <div class="fork-card__dice bankrupt-popup__icon">💸</div>
          <h3 class="comic-title comic-title--md">破产出局</h3>
          <p class="fork-card__sub bankrupt-popup__name">{{ state.pending.playerName }}</p>
          <div class="bankrupt-popup__desc">资金链断裂，变卖所有资产后仍无法偿还债务，被迫破产出局！</div>
          <button class="btn-comic" @click="dispatch({ type: 'BANKRUPT_CLOSE' })">知道了</button>
        </div>
      </div>

      <!-- 奖金提示弹窗 -->
      <div v-if="showBonusInfo" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card bonus-popup">
          <div class="fork-card__dice bonus-popup__icon">🎉</div>
          <h3 class="comic-title comic-title--md">奖金揭晓</h3>
          <p class="fork-card__sub bonus-popup__player">{{ state.pending.playerName }} 获得了 ¥{{ state.pending.amount }} 奖金！</p>
          <div class="bonus-popup__next">下一个奖金在「{{ TILES[state.pending.nextTileId]?.name ?? '?' }}」</div>
          <button class="btn-comic" @click="dispatch({ type: 'BONUS_INFO_CLOSE' })">知道了</button>
        </div>
      </div>

      <!-- 交易面板 -->
      <TradeModal
        v-if="showTradeModal"
        :state="state"
        :me="mePlayer"
        :target-player-id="tradeTarget"
        @close="tradeTarget = null"
        @offer="onTradeOffer"
      />

      <!-- 交易提案弹窗（联机：对方收到时显示；单机由 AI 自动响应） -->
      <div v-if="netMode && state.pending?.kind === 'trade' && state.pending.to === myPlayerId" class="overlay-layer fork-card-overlay">
        <div class="card-comic card-comic--pad-lg fork-card">
          <div class="fork-card__dice">🤝</div>
          <h3 class="comic-title comic-title--md">交易提案</h3>
          <p class="fork-card__sub">{{ state.players.find(p => p.id === state.pending.from)?.name }} 向你发起了交易：</p>
          <div class="trade-preview">
            <div class="trade-preview__col">
              <span class="trade-preview__label">对方给出</span>
              <span v-if="state.pending.offer.money > 0" class="trade-preview__item">💰 ¥{{ state.pending.offer.money }}</span>
              <span v-for="id in state.pending.offer.lands" :key="'o'+id" class="trade-preview__item">🏠 {{ TILES[id]?.name }}</span>
              <span v-if="!state.pending.offer.lands?.length && !state.pending.offer.money" class="trade-preview__item trade-preview__item--empty">无</span>
            </div>
            <div class="trade-preview__col">
              <span class="trade-preview__label">对方想要</span>
              <span v-if="state.pending.request.money > 0" class="trade-preview__item">💰 ¥{{ state.pending.request.money }}</span>
              <span v-for="id in state.pending.request.lands" :key="'r'+id" class="trade-preview__item">🏠 {{ TILES[id]?.name }}</span>
              <span v-if="!state.pending.request.lands?.length && !state.pending.request.money" class="trade-preview__item trade-preview__item--empty">无</span>
            </div>
          </div>
          <div class="fork-card__btns">
            <button class="btn-comic btn-comic--ghost" @click="onTradeReject">拒绝</button>
            <button class="btn-comic" @click="onTradeAccept">同意</button>
          </div>
        </div>
      </div>

      <!-- 调试台：App 端隐藏，仅开发用 -->
      <DebugPanel
        v-if="false"
        :state="state"
        :current-id="cur?.id"
        :teleport-on="!!debugTeleport"
        @debug="dispatch"
        @teleport-mode="onTeleportMode"
        @reset="startGame(lastOpts)"
        @fast-forward="fastForward"
      />

    </template>

    <footer class="app__foot">大富翁——重庆之旅 · Comic Style · M0+ 版</footer>
  </div>
</template>

<style scoped>
/* Android 返回键"再按一次退出"提示（悬浮在底部中央） */
.back-hint {
  position: fixed;
  bottom: calc(20px + var(--safe-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 20px;
  background: var(--ink);
  color: var(--paper);
  font-size: 14px;
  font-weight: 900;
  border-radius: 999px;
  z-index: 9999;
  pointer-events: none;
}

/* 轮到你横幅 */
.turn-banner {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 32px;
  background: var(--pop-yellow);
  color: var(--ink);
  border: 3px solid var(--ink);
  border-radius: 12px;
  box-shadow: 4px 4px 0 0 var(--ink);
  font-size: 18px;
  font-weight: 900;
  z-index: 9998;
  pointer-events: none;
  animation: turn-banner-in 0.3s ease-out;
}
@keyframes turn-banner-in {
  0% { transform: translateX(-50%) translateY(-30px); opacity: 0; }
  100% { transform: translateX(-50%) translateY(0); opacity: 1; }
}

/* ===== 顶部通知栈：fixed 最上层（z-index 压过所有弹窗层），保证"第一回合不能用卡"这类提示永远看得见 ===== */
.notice-stack {
  position: fixed;
  top: calc(14px + var(--safe-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 10000; /* 弹窗层 1000 / 骰子 40 / 轮到你横幅 9998，通知栈压最上 */
  pointer-events: none;
  max-width: min(92vw, 480px);
}
.notice-item {
  padding: 9px 22px;
  background: var(--pop-yellow);
  color: var(--ink);
  border: 3px solid var(--ink);
  border-radius: 999px;
  box-shadow: 3px 3px 0 0 var(--ink);
  font-size: 14px;
  font-weight: 900;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  animation: notice-in 0.25s ease-out;
}
.notice-item--error {
  background: var(--pop-red);
  color: #fff;
}
@keyframes notice-in {
  from { opacity: 0; transform: translateY(-14px) scale(0.92); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.notice-enter-active, .notice-leave-active { transition: all 0.22s ease; }
.notice-enter-from { opacity: 0; transform: translateY(-14px) scale(0.92); }
.notice-leave-to { opacity: 0; transform: translateY(-8px) scale(0.95); }

/* 金钱变动飘字：大字上飘淡出 2.2s，颜色=玩家色 */
.money-fx {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: clamp(16px, 3.4cqw, 30px);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  text-shadow: 2px 2px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff;
  z-index: 40;
  pointer-events: none;
  animation: money-fx-float 2.2s ease-out forwards;
}
@keyframes money-fx-float {
  0% { opacity: 0; transform: translate(-50%, -30%) scale(0.6); }
  12% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
  25% { transform: translate(-50%, -60%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -150%) scale(0.95); }
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: var(--space-3);
  gap: var(--space-3);
}

.app__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.app__game {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: var(--space-3);
  align-items: start;
}

/* 棋盘锚区：声明为尺寸容器，让金钱飘字的 cqw 字号参照棋盘实际宽度 */
.board-anchor {
  position: relative;
  container-type: inline-size;
}

.app__board {
  display: flex;
  flex-direction: column;  gap: var(--space-2);
}

/* 桌面端隐藏玩家信息条 */
.player-strip { display: none; }

.board-wrap {
  display: block;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.select-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  background: #fff;
}

.select-bar__text {
  font-size: 14px;
  font-weight: 900;
}

.app__bags {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.app__foot {
  margin-top: auto;
  padding-top: var(--space-2);
  border-top: 3px solid var(--ink);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.overlay-layer {
  position: fixed;
  inset: 0;
  background: rgba(26, 26, 26, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  padding: 16px;
}

.dice-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
}

.dice-panel__btns {
  display: flex;
  gap: 12px;
}

.dice-panel__range {
  font-size: 12px;
  font-weight: 900;
  opacity: 0.65;
}

.fork-card-overlay {
  z-index: 80;
}

/* 选路"看地图"模式：遮罩近乎全透，玩家可观察棋盘 */
.fork-card-overlay--transparent { background: rgba(26, 26, 26, 0.12); }
/* 折叠态悬浮角标 */
.fork-fab {
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 85;
  padding: 8px 16px;
  border: 3px solid var(--ink);
  border-radius: 10px;
  background: var(--pop-yellow);
  color: var(--ink);
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 3px 3px 0 0 var(--ink);
  animation: fork-fab-pulse 1.4s ease-in-out infinite;
}
@keyframes fork-fab-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
.fork-card__map-btn { margin-top: 8px; }

/* 顺序确认弹窗 */
.order-result { max-width: 340px; width: 100%; }
.order-result__list {
  list-style: none;
  margin: 8px 0 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.order-result__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  font-weight: 900;
}
.order-result__item--me { background: #fff3c4; box-shadow: 2px 2px 0 0 var(--ink); }
.order-result__rank {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  background: var(--pop-yellow);
  border: 2px solid var(--ink);
  border-radius: 50%;
  font-size: 12px;
}
.order-result__name { flex: 1; text-align: left; }
.order-result__roll { font-size: 12px; opacity: 0.65; font-weight: 700; }

.fork-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
  text-align: center;
  max-width: 380px;
  border-width: 4px;
  box-shadow: 7px 7px 0 0 var(--ink);
}

.fork-card__close {
  position: absolute;
  top: -14px;
  right: -14px;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
  background: var(--pop-red);
  color: #fff;
  border: 3px solid var(--ink);
  border-radius: 50%;
  box-shadow: 3px 3px 0 0 var(--ink);
  transition: transform 0.1s ease;
}
.fork-card__close:hover { transform: scale(1.12) rotate(8deg); }
.fork-card__close:active { transform: scale(0.94); }

.fork-card__dice {
  font-size: 40px;
  line-height: 1;
  animation: fork-dice-spin 0.9s ease-in-out infinite;
}
@keyframes fork-dice-spin {
  0%, 100% { transform: rotate(-12deg) scale(1); }
  50% { transform: rotate(12deg) scale(1.12); }
}

.fork-card__sub {
  font-size: 14px;
  font-weight: 900;
  line-height: 1.5;
  margin: 0;
}

.fork-card__route {
  font-size: 30px;
  font-weight: 900;
  letter-spacing: 0.04em;
  padding: 8px 26px;
  background: var(--pop-yellow);
  border: 3px solid var(--ink);
  border-radius: 10px;
  box-shadow: 4px 4px 0 0 var(--ink);
  transform: rotate(-2deg);
}

.fork-card__hint {
  font-size: 12px;
  font-weight: 900;
  opacity: 0.7;
  margin: 0;
}

/* 神仙附身弹窗 */
.god-popup__icon {
  font-size: 48px;
  animation: god-popup-bounce 0.6s ease-out;
}
.god-popup__name {
  font-size: 20px;
  color: #a855f7;
  margin: 4px 0;
}
.god-popup__desc {
  font-size: 14px;
  font-weight: 700;
  color: #333;
  background: #f3e8ff;
  border-radius: 8px;
  padding: 8px 12px;
  margin: 8px 0;
}
@keyframes god-popup-bounce {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

/* 奇遇事件弹窗 */
.chance-popup__icon {
  font-size: 48px;
  animation: chance-popup-shake 0.5s ease-out;
}
.chance-popup__title {
  font-size: 20px;
  color: #d97706;
  margin: 4px 0;
}
.chance-popup__desc {
  font-size: 14px;
  font-weight: 700;
  color: #333;
  background: #fef3c7;
  border-radius: 8px;
  padding: 8px 12px;
  margin: 8px 0;
}
@keyframes chance-popup-shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-8deg); }
  75% { transform: rotate(8deg); }
}

/* 破产弹窗 */
.bankrupt-popup__icon {
  font-size: 48px;
  animation: bankrupt-popup-shake 0.6s ease-out;
}
.bankrupt-popup__name {
  font-size: 20px;
  color: #ef4444;
  margin: 4px 0;
}
.bankrupt-popup__desc {
  font-size: 14px;
  font-weight: 700;
  color: #333;
  background: #fee2e2;
  border-radius: 8px;
  padding: 8px 12px;
  margin: 8px 0;
}
@keyframes bankrupt-popup-shake {
  0%, 100% { transform: scale(1); }
  25% { transform: scale(1.1); }
  50% { transform: scale(0.95); }
  75% { transform: scale(1.05); }
}

/* 奖金提示弹窗 */
.bonus-popup__icon {
  font-size: 48px;
  animation: bonus-popup-bounce 0.6s ease-out;
}
.bonus-popup__player {
  font-size: 20px;
  color: #d97706;
  margin: 4px 0;
}
.bonus-popup__next {
  font-size: 14px;
  font-weight: 700;
  color: #333;
  background: #fef3c7;
  border-radius: 8px;
  padding: 8px 12px;
  margin: 8px 0;
}
@keyframes bonus-popup-bounce {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

.fork-card__btns {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.fork-card__opts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.fork-card__opt {
  width: 100%;
  text-align: center;
}

/* ===== 卡片商店 ===== */
.shop-card {
  max-width: 440px;
  width: 100%;
}
.shop-pts {
  color: var(--pop-blue);
  font-size: 16px;
}
.shop-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 40vh;
  overflow-y: auto;
  width: 100%;
}
.shop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 2.5px solid var(--ink);
  border-radius: 8px;
  background: #eef2ff;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: transform 0.1s ease;
}
.shop-row:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 0 var(--ink);
}
.shop-row:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.shop-row__name {
  font-size: 13px;
  font-weight: 900;
  min-width: 62px;
}
.shop-row__desc {
  font-size: 11px;
  font-weight: 900;
  opacity: 0.6;
  flex: 1;
}
.shop-row__price {
  font-size: 14px;
  font-weight: 900;
  color: var(--pop-blue);
}

/* ===== 拍卖 ===== */
.auction-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.auction-input-row .input-comic {
  flex: 1;
  text-align: right;
  font-size: 18px;
  font-weight: 900;
}

.auction-input-unit {
  font-size: 14px;
  font-weight: 900;
  opacity: 0.6;
}

.auction-reveal-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 8px;
  background: #fffef0;
  border: 2.5px solid var(--ink);
  border-radius: 8px;
}

.auction-reveal-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  border-bottom: 1.5px dashed rgba(26, 26, 26, 0.2);
}

.auction-reveal-row:last-child {
  border-bottom: none;
}

.auction-reveal-name {
  font-size: 14px;
  font-weight: 900;
}

.auction-reveal-amt {
  font-size: 16px;
  font-weight: 900;
  color: var(--pop-blue);
  font-variant-numeric: tabular-nums;
}

/* ===== 彩票开奖弹窗 ===== */
.lottery-draw-popup { position: relative; overflow: visible; }
.lottery-draw__icon { font-size: 48px; animation: lottery-bounce 0.6s ease; }
@keyframes lottery-bounce {
  0% { transform: scale(0); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
.lottery-draw__number { font-size: 18px; }
.lottery-draw__number b { font-size: 32px; color: var(--pop-red); display: block; margin: 4px 0; }
.lottery-draw__win { background: #fff3c4; border: 2.5px solid var(--ink); border-radius: 8px; padding: 12px; margin: 8px 0; }
.lottery-draw__winner { font-size: 18px; font-weight: 900; color: var(--pop-red); }
.lottery-draw__prize { font-size: 16px; margin-top: 4px; }
.lottery-draw__prize b { font-size: 24px; color: var(--pop-red); }
.lottery-draw__lose { font-size: 14px; opacity: 0.7; padding: 8px 0; }

/* 礼花动画 */
.confetti-container {
  position: absolute;
  inset: -60px -20px;
  pointer-events: none;
  overflow: visible;
}
.confetti {
  position: absolute;
  top: -10px;
  left: var(--x);
  width: 10px;
  height: 10px;
  background: var(--color);
  border-radius: 2px;
  animation: confetti-fall 2.5s ease-out var(--delay) forwards;
  transform: rotate(var(--d));
}
@keyframes confetti-fall {
  0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
  100% { transform: translateY(400px) rotate(720deg) scale(0.3); opacity: 0; }
}

/* ===== 决定先手顺序 ===== */
.order-list { width: 100%; margin: 12px 0; display: flex; flex-direction: column; gap: 6px; }
.order-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 2px solid var(--ink); border-radius: 8px; background: #fff; transition: all 0.2s; }
.order-item--current { background: #fff3c4; box-shadow: 2px 2px 0 0 var(--ink); transform: scale(1.02); }
.order-item--done { opacity: 0.7; }
.order-item__dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--ink); flex-shrink: 0; }
.order-item__name { font-size: 14px; font-weight: 900; }
.order-item__name em { font-style: normal; font-size: 10px; color: #fff; background: var(--pop-red); border: 1px solid var(--ink); border-radius: 3px; padding: 0 3px; margin-left: 3px; }
.order-item__dice { margin-left: auto; font-size: 13px; font-weight: 900; color: var(--pop-blue); }
.order-item__dice b { font-size: 16px; color: var(--pop-red); }
.order-item__wait { margin-left: auto; font-size: 12px; font-weight: 900; opacity: 0.5; }

/* ===== 彩票 ===== */
.lottery-info { font-size: 13px; font-weight: 900; margin: 8px 0; }
.lottery-buy { width: 100%; }
.lottery-numbers {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 3px;
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 8px;
}
.lot-num {
  aspect-ratio: 1;
  border: 1.5px solid var(--ink);
  border-radius: 4px;
  background: #fff;
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
  transition: transform 0.1s;
  font-family: inherit;
}
.lot-num:hover:not(:disabled) { transform: scale(1.15); background: #fff3c4; }
.lot-num:disabled { opacity: 0.3; cursor: not-allowed; background: #ddd; }
.lot-num--taken { background: #fecaca !important; }
.lot-num--mine { background: #86efac !important; border-width: 2.5px; }
.lot-num--sel { background: #fde68a !important; border-width: 2.5px; box-shadow: inset 0 0 0 2px #f59e0b; }
.lottery-my { font-size: 12px; font-weight: 900; padding: 6px 0; }
.lottery-cart { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.lottery-cart__info { font-size: 13px; font-weight: 900; }
.lottery-cart__info b { color: var(--pop-red); }

/* ===== 交易预览 ===== */
.trade-preview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;
}
.trade-preview__col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: #fffef0;
  border: 2px solid var(--ink);
  border-radius: 6px;
}
.trade-preview__label {
  font-size: 12px;
  font-weight: 900;
  opacity: 0.6;
}
.trade-preview__item {
  font-size: 13px;
  font-weight: 900;
}
.trade-preview__item--empty {
  opacity: 0.3;
  font-style: italic;
}

.net-loading {
  margin: 40px auto;
  padding: 24px 40px;
  font-weight: 900;
  font-size: 15px;
}

/* ===== 股票卡选股 ===== */
.stock-picker {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.stock-picker__title {
  margin: 0;
  font-size: 13px;
  font-weight: 900;
}
.stock-picker__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.stock-picker__item {
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: #eef2ff;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 900;
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.1s ease;
}
.stock-picker__item:hover {
  transform: translate(-1px, -1px);
  box-shadow: 2px 2px 0 0 var(--ink);
  background: #fff3c4;
}

/* ===== 手机端适配（不影响桌面） ===== */
@media (max-width: 768px) {
  /* #app 变成 flex 列布局 */
  #app {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .app__head, .app__foot { display: none; }

  /* BagsBar + GameMenu：放最上面 */
  .app__bags {
    order: -1;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 4px;
    padding: calc(4px + var(--safe-top)) 8px 4px;
    background: var(--paper);
    border-bottom: 2px solid var(--ink);
    z-index: 10;
  }

  /* 游戏区占满中间 */
  .app__game {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0;
    min-height: 0;
    padding: 0;
    align-items: stretch;
  }

  .app__board {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow: hidden;
    position: relative; /* 让选择提示条/选股条可以悬浮在棋盘上方，不挤压布局 */
  }

  /* 选择模式提示条 / 股票选择卡：悬浮显示，出现/消失不挤压棋盘（防布局跳动） */
  .select-bar,
  .stock-picker {
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    width: max-content;
    max-width: calc(100% - 16px);
    box-shadow: 3px 3px 0 0 var(--ink);
  }

  /* SidePanel 手机端隐藏 */
  .app__game > aside {
    display: none;
  }

  /* 手机端：紧凑玩家信息条 */
  .player-strip {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
    padding: 3px 6px;
    background: var(--paper);
    border-bottom: 2px solid var(--ink);
  }
  .player-strip__item {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    font-size: 10px;
    font-weight: 900;
    padding: 2px 6px;
    border: 1.5px solid var(--ink);
    border-radius: 5px;
    background: #fff;
    white-space: nowrap;
    cursor: pointer;
  }
  .player-strip__item--turn {
    background: #fff3c4;
    box-shadow: 1.5px 1.5px 0 0 var(--ink);
  }
  .player-strip__item--dead { opacity: 0.4; }
  .player-strip__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1.5px solid var(--ink);
    flex-shrink: 0;
  }
  .player-strip__name {
    max-width: 36px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .player-strip__status {
    font-size: 9px;
    padding: 1px 4px;
    background: #fef3c7;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .player-strip__money {
    font-variant-numeric: tabular-nums;
  }
  .player-strip__money--debt { color: var(--pop-red); }
  .player-strip__money--warn { color: var(--pop-red); animation: money-warn 1s ease-in-out infinite; }
  @keyframes money-warn { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  .player-strip__summary {
    display: flex;
    align-items: center;
    gap: 3px;
    width: 100%;
  }
  .player-strip__stats {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-left: auto;
    flex-shrink: 0;
  }
  .player-strip__stat {
    font-size: 9px;
    font-weight: 900;
    opacity: 0.85;
    white-space: nowrap;
  }
  .player-strip__stat--god { color: #8b5cf6; }
  .player-strip__stat--pts { color: #2563eb; }
  .player-strip__status {
    font-size: 9px;
    padding: 1px 4px;
    background: #fef3c7;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .player-strip__count {
    font-size: 9px;
    opacity: 0.8;
    flex-shrink: 0;
  }
  .player-strip__points {
    font-size: 9px;
    color: #2563eb;
    flex-shrink: 0;
  }
  .player-strip__arrow {
    margin-left: auto;
    font-size: 9px;
    opacity: 0.6;
    flex-shrink: 0;
  }
  .player-strip__detail {
    display: flex;
    gap: 10px;
    padding: 2px 0 0 16px;
    border-top: 1.5px dashed var(--ink);
    margin-top: 2px;
  }
  .player-strip__item--open {
    background: #fff3c4;
  }

  /* 棋盘占满中间区域 */
  .board-wrap {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    container-type: size; /* 棋盘用 cqh/cqw 感知容器实际宽高 → 短边驱动，任意屏比例都完整显示 */
  }
  .board-anchor {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }
  :deep(.board) {
    /* CSS 版（新 WebView）；旧 WebView 由 JS ResizeObserver 兜底（见 fitBoard） */
    width: min(100cqw, calc(100cqh * 100 / 85));
    max-width: 600px;
    height: auto;
    aspect-ratio: 100 / 85;
    transition: width 0.25s ease, height 0.25s ease; /* 万一尺寸变化也平滑，不突变 */
  }
  /* 手机端：去掉价格/积分，边框变窄（地名字号交给 nameFont 按字数分档，勿强制统一防长名裁切） */
  :deep(.tile__price),
  :deep(.tile__points) {
    display: none !important;
  }
  :deep(.tile__name) {
    line-height: 1.1;
  }
  :deep(.tile) {
    border-width: 2px !important;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.55), 1.5px 1.5px 0 0 var(--attr, var(--ink)) !important;
  }
  :deep(.tile__fork) {
    width: 1.2em;
    height: 1.2em;
    font-size: 0.8cqw;
  }

  /* ActionPanel：底部栏 */
  .actions {
    flex-shrink: 0;
    width: 100%;
    border-radius: 0;
    padding: 8px 8px calc(8px + var(--safe-bottom)) !important;
    border-top: 3px solid var(--ink);
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    position: relative !important;
  }
  .actions__menu-btn {
    position: absolute;
    top: 4px;
    right: 4px;
  }
  .phase-bar { padding-bottom: 4px; margin-bottom: 2px; }
  .actions__status { font-size: 13px; }
  .actions__meta { font-size: 11px; gap: 8px; }
  .actions__btns { gap: 4px; }
  .actions__btns .btn-comic {
    min-height: 30px !important;
    padding: 4px 10px !important;
    font-size: 12px !important;
    border-width: 2px !important;
    box-shadow: 2px 2px 0 0 var(--ink) !important;
  }
  .actions__roll-hint { font-size: 12px; padding: 4px 8px; }
  .actions__wait { font-size: 12px; }
  .legend { display: none; }

  /* 弹窗：居中 + 安全区 */
  .fork-card-overlay { padding: 16px; align-items: center; }
  .modal-card, .fork-card, .info {
    max-width: calc(100vw - 16px) !important;
    width: calc(100vw - 16px) !important;
    max-height: 75vh;
    overflow-y: auto;
    padding: 16px !important;
    border-radius: 12px !important;
    margin-bottom: var(--safe-bottom);
  }
  .fork-card { border-radius: 12px; }
  .fork-card__close { top: 8px; right: 8px; }
  .modal-overlay { padding-bottom: var(--safe-bottom); }
  .btn-comic { min-height: 44px; padding: 10px 16px; font-size: 14px; }
  .btn-comic--sm { min-height: 36px; padding: 6px 12px; }
  .lottery-numbers { max-height: 260px; }
  .lot-num { font-size: 11px; }
  :deep(.enc) { max-height: 80vh; max-width: calc(100vw - 16px); }
  :deep(.dbg__panel) { width: calc(100vw - 16px); max-height: 60vh; }
  :deep(.my-panel) { max-width: calc(100vw - 16px); }


  /* 弹窗加大触摸区域 */
  .modal-card,
  .fork-card,
  .info {
    max-width: calc(100vw - 24px) !important;
    padding: 16px !important;
  }
  .btn-comic {
    min-height: 44px; /* Apple 推荐最小触摸目标 */
    padding: 10px 16px;
    font-size: 14px;
  }
  .btn-comic--sm {
    min-height: 36px;
    padding: 6px 12px;
  }

  /* 彩票号码网格加大 */
  .lottery-numbers {
    max-height: 260px;
  }
  .lot-num {
    font-size: 11px;
  }

  /* 百科全书弹窗 */
  .enc {
    max-height: 80vh;
    max-width: calc(100vw - 24px);
  }

  /* 调试台面板缩小 */
  :deep(.dbg__panel) {
    width: calc(100vw - 28px);
    max-height: 60vh;
  }

  /* 底部入口弹窗 */
  :deep(.my-panel) {
    max-width: calc(100vw - 24px);
  }
}

@media (max-width: 480px) {
  .bags__timers {
    gap: 4px;
  }
  .bags__chip {
    font-size: 10px;
    padding: 2px 6px;
  }
  .bags__round-badge {
    font-size: 11px;
    padding: 2px 8px;
  }
  .bags__turn-player {
    font-size: 12px;
  }
}
</style>
