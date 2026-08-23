<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getSocket } from '../net/socket.js'

const props = defineProps({
  roomId: String,
  isHost: Boolean,
  isMyTurn: Boolean,
  paused: Boolean,
  aiTakeover: Boolean,
  turnTimeLeft: Number,
  players: Array,
  gameLog: { type: Array, default: () => [] },
})
const emit = defineEmits(['surrender', 'pause', 'kick', 'setPassword', 'toggleAITakeover'])

const open = ref(false)
const showLog = ref(false)
const showKick = ref(false)
const showPassword = ref(false)
const passwordInput = ref('')
const ping = ref(0)

let pingTimer = null

// 计算延迟
onMounted(() => {
  const socket = getSocket()
  if (!socket) return

  pingTimer = setInterval(() => {
    const start = Date.now()
    ping.value = 0 // 每轮先重置，否则首次成功后超时判断永久失效
    socket.emit('ping_check', () => {
      ping.value = Date.now() - start
    })
    // 5 秒无响应标记为超时（句柄保存，卸载时清理）
    pongTimeout = setTimeout(() => {
      if (ping.value === 0) ping.value = 999
    }, 5000)
  }, 3000)
})

let pongTimeout = null

onUnmounted(() => {
  if (pingTimer) clearInterval(pingTimer)
  if (pongTimeout) clearTimeout(pongTimeout)
})

const timerColor = computed(() => {
  if (props.turnTimeLeft <= 10) return 'text-danger'
  if (props.turnTimeLeft <= 20) return 'text-warning'
  return ''
})

const pingColor = computed(() => {
  if (ping.value < 50) return 'text-success'
  if (ping.value < 100) return 'text-warning'
  return 'text-danger'
})

function confirmSurrender() {
  if (confirm('确定要认输吗？你的资产将归系统所有。')) {
    emit('surrender')
  }
}

function togglePause() {
  emit('pause')
}

function kickPlayer(playerId) {
  if (confirm('确定要踢出这名玩家吗？')) {
    emit('kick', playerId)
    showKick.value = false
  }
}

function applyPassword() {
  emit('setPassword', passwordInput.value || null)
  showPassword.value = false
  passwordInput.value = ''
}
</script>

<template>
  <div class="game-menu">
    <button class="btn-comic btn-comic--sm btn-comic--ghost game-menu__btn" @click="open = !open">
      菜单 ▼
    </button>
    
    <div v-if="open" class="menu-panel card-comic">
      <!-- 倒计时 -->
      <div class="menu-item">
        <span>⏱️ 回合倒计时:</span>
        <span :class="timerColor">{{ turnTimeLeft }}秒</span>
      </div>
      
      <hr class="menu-divider" />
      
      <!-- 游戏日志 -->
      <button class="menu-btn" @click="showLog = true">📜 游戏日志</button>
      
      <!-- 认输 -->
      <button class="menu-btn text-danger" @click="confirmSurrender">🏳️ 认输投降</button>
      
      <!-- 暂停（仅房主） -->
      <button v-if="isHost" class="menu-btn" @click="togglePause">
        {{ paused ? '▶️ 继续游戏' : '⏸️ 暂停游戏' }}
      </button>

      <!-- AI 托管（仅房主） -->
      <button v-if="isHost" class="menu-btn" @click="emit('toggleAITakeover')">
        {{ aiTakeover ? '🤖 AI 托管：开' : '🤖 AI 托管：关' }}
      </button>
      
      <!-- 踢人（仅房主） -->
      <button v-if="isHost" class="menu-btn" @click="showKick = !showKick">
        👢 踢出玩家
      </button>
      
      <!-- 踢人列表 -->
      <div v-if="showKick" class="menu-sub">
        <button
          v-for="p in players.filter(p => !p.isHost)"
          :key="p.id"
          class="menu-btn menu-btn--sm"
          @click="kickPlayer(p.id)"
        >
          踢出 {{ p.name }}
        </button>
        <p v-if="players.filter(p => !p.isHost).length === 0" class="menu-hint">没有其他玩家</p>
      </div>
      
      <!-- 设置密码（仅房主） -->
      <button v-if="isHost" class="menu-btn" @click="showPassword = !showPassword">
        🔗 设置房间密码
      </button>
      
      <!-- 密码输入 -->
      <div v-if="showPassword" class="menu-sub">
        <input
          v-model="passwordInput"
          class="input-comic input-comic--sm"
          placeholder="留空则取消密码"
          maxlength="20"
        />
        <button class="btn-comic btn-comic--sm" @click="applyPassword">确定</button>
      </div>
      
      <!-- 网络延迟 -->
      <div class="menu-item">
        <span>📶 网络延迟:</span>
        <span :class="pingColor">{{ ping }}ms</span>
      </div>
    </div>
    
    <!-- 游戏日志弹窗 -->
    <div v-if="showLog" class="modal-overlay" @click.self="showLog = false">
      <div class="modal-card modal-card--log">
        <button class="modal-card__close" @click="showLog = false">×</button>
        <h3 class="comic-title comic-title--md">📜 游戏日志</h3>
        <div class="log-list">
          <p v-if="!gameLog || gameLog.length === 0" class="menu-hint">暂无日志</p>
          <div v-for="(log, i) in gameLog" :key="i" class="log-item">
            <span class="log-time">{{ new Date(log.time).toLocaleTimeString() }}</span>
            <span>{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-menu {
  position: relative;
  display: inline-block;
}
.game-menu__btn {
  font-size: 10px;
  padding: 3px 6px;
}

.menu-panel {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  min-width: 200px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  font-size: 13px;
  font-weight: 700;
}

.menu-btn {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border: none;
  background: transparent;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
}

.menu-btn:hover {
  background: #ffe9a8;
}

.menu-btn--sm {
  font-size: 12px;
  padding: 6px 10px;
}

.menu-divider {
  margin: 4px 0;
  border: none;
  border-top: 2px dashed var(--ink);
}

.menu-sub {
  padding-left: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-hint {
  font-size: 12px;
  color: #666;
  padding: 4px 8px;
}

.text-danger { color: var(--pop-red); }
.text-warning { color: #f97316; }
.text-success { color: var(--pop-green); }

.modal-card--log {
  max-width: 400px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.log-list {
  overflow-y: auto;
  flex: 1;
  margin-top: 12px;
}

.log-item {
  padding: 6px 0;
  border-bottom: 1px solid #eee;
  font-size: 13px;
  font-weight: 500;
}

.log-time {
  color: #999;
  font-size: 11px;
  margin-right: 8px;
}

.input-comic--sm {
  border-width: 3px;
  padding: 6px 10px;
  font-size: 13px;
  margin-bottom: 6px;
  min-width: 0;
  flex: 1;
}
</style>
