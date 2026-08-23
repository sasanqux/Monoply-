<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { getSocket } from '../net/socket.js'
import { PLAYER_COLORS } from '../game/index.js'

const props = defineProps({
  mode: String, // 'create' | 'join'
})
const emit = defineEmits(['enter', 'back'])

const connected = ref(false)
const playerName = ref('')
const playerColor = ref(PLAYER_COLORS[0])
const roomId = ref('')
const roomPassword = ref('') // 房间密码
const room = ref(null)
const error = ref('')

// 使用 App 级 socket（不自己 connect/disconnect）
const sock = computed(() => getSocket())

// 房主判定：用 players[].isHost（服务端已下发），不依赖 socketId（已停止广播 hostId）
const isHost = computed(() => !!me.value?.isHost)
const allReady = computed(() => room.value?.players?.length >= 2 && room.value.players.every(p => p.ready))
const isJoinMode = computed(() => props.mode === 'join')
// 我的座位 id（createRoom/joinRoom 回调返回），用于在大厅列表里认出自己
const myPlayerId = ref('')
const me = computed(() => room.value?.players?.find(p => p.id === myPlayerId.value) ?? null)

function toggleReady() {
  sock.value.emit('ready', {}, (res) => {
    if (res?.error) error.value = res.error
  })
}

// 已被占用的颜色
const usedColors = computed(() => room.value?.players?.map(p => p.color) || [])

// 具名监听器：卸载时逐个精确移除，绝不用无参 off()（会误删 App.vue 注册的全局 connect/kicked/roomUpdate 监听）
function onConnect() { connected.value = true }
function onDisconnect() { connected.value = false }
function onRoomUpdate(r) {
  room.value = r
  // 颜色被抢了自动换
  if (playerColor.value && usedColors.value.includes(playerColor.value)) {
    const avail = PLAYER_COLORS.filter(c => !usedColors.value.includes(c))
    if (avail.length > 0) playerColor.value = avail[0]
  }
}
// 大厅阶段被踢：清空房间信息回登录态
function onKicked() {
  error.value = '你已被房主移出房间'
  room.value = null
  myPlayerId.value = ''
}
function onGameStart({ roomId }) {
  // 只带 roomId 的轻量信号；对局状态等第一条 gameState 广播（防手牌泄漏）。
  // 昵称/颜色/密码随行携带：断线重连存档需要（密码由 App.vue 侧存档处理）
  emit('enter', { roomId, playerName: playerName.value, color: playerColor.value, password: roomPassword.value || undefined })
}

onMounted(() => {
  const s = sock.value
  if (!s) return
  connected.value = s.connected
  s.on('connect', onConnect)
  s.on('disconnect', onDisconnect)
  s.on('roomUpdate', onRoomUpdate)
  s.on('kicked', onKicked)
  s.on('gameStart', onGameStart)
})

onBeforeUnmount(() => {
  const s = sock.value
  if (s) {
    s.off('connect', onConnect)
    s.off('disconnect', onDisconnect)
    s.off('roomUpdate', onRoomUpdate)
    s.off('kicked', onKicked)
    s.off('gameStart', onGameStart)
  }
})

function createRoom() {
  if (!playerName.value.trim()) { error.value = '请输入昵称'; return }
  error.value = ''
  sock.value.emit('createRoom', {
    playerName: playerName.value.trim(),
    color: playerColor.value,
  }, (res) => {
    if (res?.error) { error.value = res.error; return }
    myPlayerId.value = res.playerId
  })
}

function joinRoom() {
  if (!playerName.value.trim()) { error.value = '请输入昵称'; return }
  if (!roomId.value.trim()) { error.value = '请输入房间码'; return }
  error.value = ''
  sock.value.emit('joinRoom', {
    roomId: roomId.value.trim().toUpperCase(),
    playerName: playerName.value.trim(),
    color: playerColor.value,
    password: roomPassword.value || undefined,
  }, (res) => {
    if (res?.error) { error.value = res.error; return }
    myPlayerId.value = res.playerId
  })
}

function startGame() {
  sock.value.emit('startGame', (res) => {
    if (res?.error) error.value = res.error
    else emit('enter', { playerName: playerName.value, color: playerColor.value, roomId: room.value?.roomId })
  })
}

function leaveRoom() {
  sock.value?.emit('leaveRoom')
  emit('back')
}

// 返回：若还挂在房间里（防幽灵座位占坑），先通知服务端离开再回退
function goBack() {
  if (room.value) sock.value?.emit('leaveRoom')
  emit('back')
}
</script>

<template>
  <div class="lobby">
    <!-- 未连接 -->
    <div v-if="!connected" class="card-comic lobby__card">
      <p class="lobby__connecting">连接服务器...</p>
    </div>

    <!-- 首页：输昵称+操作 -->
    <div v-else-if="!room" class="card-comic card-comic--pad-lg lobby__card">
      <h2 class="comic-title comic-title--md">
        {{ isJoinMode ? '加入房间' : '创建房间' }}
      </h2>

      <div class="lobby__field">
        <span class="lobby__label">昵称</span>
        <input v-model="playerName" class="input-comic" placeholder="输入名字" maxlength="8" />
      </div>

      <div class="lobby__field">
        <span class="lobby__label">颜色</span>
        <div class="lobby__colors">
          <button
            v-for="c in PLAYER_COLORS"
            :key="c"
            class="lobby__color-btn"
            :class="{
              'lobby__color-btn--on': playerColor === c,
              'lobby__color-btn--used': usedColors.includes(c) && playerColor !== c
            }"
            :style="{ background: c }"
            :disabled="usedColors.includes(c) && playerColor !== c"
            @click="playerColor = c"
          ></button>
        </div>
      </div>

      <div v-if="isJoinMode" class="lobby__field">
        <span class="lobby__label">房间码</span>
        <input v-model="roomId" class="input-comic input-comic--code" placeholder="如 ABC123" maxlength="6" />
      </div>

      <div v-if="isJoinMode" class="lobby__field">
        <span class="lobby__label">房间密码</span>
        <input v-model="roomPassword" class="input-comic" placeholder="无密码则留空" type="password" maxlength="20" />
      </div>

      <div class="lobby__btns">
        <button v-if="isJoinMode" class="btn-comic btn-comic--green" :disabled="!playerName.trim() || !roomId.trim()" @click="joinRoom">
          加入
        </button>
        <button v-else class="btn-comic btn-comic--blue" :disabled="!playerName.trim()" @click="createRoom">
          创建
        </button>
        <button class="btn-comic btn-comic--ghost" @click="goBack">返回</button>
      </div>

      <p v-if="error" class="lobby__error">{{ error }}</p>
    </div>

    <!-- 房间大厅 -->
    <div v-else class="card-comic card-comic--pad-lg lobby__card">
      <div class="lobby__room-code">
        <span class="lobby__code-label">房间码</span>
        <span class="lobby__code-value">{{ room.roomId }}</span>
      </div>

      <div class="lobby__players">
        <div v-for="p in room.players" :key="p.id" class="lobby__player">
          <i class="lobby__dot" :style="{ background: p.color || 'var(--pop-blue)' }"></i>
          <span>{{ p.name }}{{ p.id === myPlayerId ? '（我）' : '' }}</span>
          <span v-if="p.isHost" class="tag-comic tag-comic--red lobby__host-tag">房主</span>
          <span v-if="p.disconnected" class="tag-comic tag-comic--red">重连中…</span>
          <span v-else-if="p.ready" class="tag-comic tag-comic--green">已准备</span>
          <span v-else class="tag-comic">未准备</span>
        </div>
        <p v-if="room.players.length < 8" class="lobby__empty">等待玩家加入... ({{ room.players.length }}/8)</p>
      </div>

      <div class="lobby__btns">
        <button v-if="isHost" class="btn-comic btn-comic--lg" :disabled="!allReady" @click="startGame">
          {{ allReady ? '开始游戏' : '等待玩家准备...' }}
        </button>
        <template v-else>
          <button v-if="me && !me.ready" class="btn-comic btn-comic--green" @click="toggleReady">我准备好了</button>
          <button v-else class="btn-comic btn-comic--ghost" @click="toggleReady">取消准备</button>
        </template>
        <button class="btn-comic btn-comic--ghost" @click="leaveRoom">离开</button>
      </div>

      <p v-if="error" class="lobby__error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 20px;
}
.lobby__card {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.lobby__connecting {
  text-align: center;
  font-size: 14px;
  font-weight: 900;
  opacity: 0.6;
  padding: 20px;
}
.lobby__field {
  display: flex;
  align-items: center;
  gap: 10px;
}
.lobby__field .input-comic {
  flex: 1;
  min-width: 0;
}
.lobby__label {
  font-size: 14px;
  font-weight: 900;
  width: 50px;
  flex-shrink: 0;
}
.input-comic--code {
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 900;
}
.lobby__btns {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.lobby__error {
  color: var(--pop-red);
  font-size: 13px;
  font-weight: 900;
  margin: 0;
}
.lobby__room-code {
  text-align: center;
  padding: 16px;
  background: #fff3c4;
  border: 3px solid var(--ink);
  border-radius: 8px;
}
.lobby__code-label {
  font-size: 12px;
  font-weight: 900;
  opacity: 0.6;
  display: block;
  margin-bottom: 4px;
}
.lobby__code-value {
  font-size: 36px;
  font-weight: 900;
  letter-spacing: 0.15em;
}
.lobby__players {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lobby__player {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: #fff;
  font-weight: 900;
  font-size: 15px;
}
.lobby__dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--pop-blue);
  border: 2px solid var(--ink);
  flex-shrink: 0;
}
.lobby__host-tag { font-size: 10px; }
.lobby__colors { display: flex; gap: 6px; flex-wrap: wrap; }
.lobby__color-btn {
  width: 28px; height: 28px;
  border-radius: 6px;
  border: 3px solid var(--ink);
  cursor: pointer;
  transition: transform 0.1s;
}
.lobby__color-btn:hover:not(:disabled) { transform: scale(1.15); }
.lobby__color-btn--on { box-shadow: 0 0 0 3px var(--pop-yellow); transform: scale(1.1); }
.lobby__color-btn--used { opacity: 0.25; cursor: not-allowed; border-color: #999; }
.lobby__empty {
  font-size: 12px;
  font-weight: 900;
  opacity: 0.4;
  text-align: center;
  margin: 0;
}
.lobby__waiting {
  font-size: 14px;
  font-weight: 900;
  opacity: 0.6;
  font-style: italic;
}
@media (max-width: 768px) {
  .lobby__card { max-width: calc(100vw - 32px); }
  .lobby__field { gap: 6px; }
  .lobby__label { width: 40px; font-size: 12px; }
  .lobby__code-value { font-size: 28px; }
  .lobby__color-btn { width: 24px; height: 24px; }
}
</style>
