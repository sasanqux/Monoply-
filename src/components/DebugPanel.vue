<script setup>
// DebugPanel.vue — 调试台（右下角悬浮）：传送 / 走N步 / 金钱 / 卡片 / 地产 / 回合 / 流程
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { TILES, CARDS, isPropertyTile } from '../game/index.js'

const props = defineProps({
  state: Object,
  currentId: String,
  teleportOn: Boolean,
})
const emit = defineEmits(['debug', 'teleport-mode', 'reset', 'fast-forward'])

const open = ref(localStorage.getItem('dbg_panel') === '1')

// 快捷键 Ctrl+Shift+D 切换调试台
function onKeydown(e) {
  if (e.ctrlKey && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
    e.preventDefault()
    toggle()
  }
}
function toggle() {
  open.value = !open.value
  localStorage.setItem('dbg_panel', open.value ? '1' : '0')
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// 目标玩家：默认当前玩家，切换后记住
const targetPid = ref(props.currentId || '')
watch(
  () => props.currentId,
  (v) => {
    if (v && (!targetPid.value || !props.state?.players.some((p) => p.id === targetPid.value && p.alive))) {
      targetPid.value = v
    }
  }
)

const players = computed(() => props.state?.players.filter((p) => p.alive) || [])
const landTiles = computed(() => TILES.filter((t) => t && isPropertyTile(t) && !t.removed))

const steps = ref(2)
const money = ref(1000)
const rounds = ref(5)
const propTile = ref(2)
const loanAmount = ref(1000)

function dbg(action) {
  emit('debug', { ...action, playerId: targetPid.value })
}
function toggleTeleport() {
  emit('teleport-mode', props.teleportOn ? null : { playerId: targetPid.value })
}
</script>

<template>
  <div class="dbg">
    <button class="dbg__fab" :title="open ? '收起调试台 (Ctrl+Shift+D)' : '打开调试台 (Ctrl+Shift+D)'" @click="toggle()">
      🛠<i v-if="teleportOn" class="dbg__dot" />
    </button>

    <transition name="dbg-pop">
      <div v-if="open" class="dbg__panel">
        <div class="dbg__head">
          <span class="dbg__title">🛠 调试台</span>
          <button class="dbg__close" @click="open = false">✕</button>
        </div>

        <div class="dbg__body">
          <!-- 目标玩家 -->
          <section class="dbg__sec">
            <h4 class="dbg__h">目标玩家</h4>
            <div class="dbg__chips">
              <button
                v-for="p in players"
                :key="p.id"
                class="dbg__chip"
                :class="{ 'dbg__chip--on': targetPid === p.id }"
                :style="{ '--pc': p.color }"
                @click="targetPid = p.id"
              >{{ p.name }}</button>
            </div>
          </section>

          <!-- 传送 / 走 N 步 -->
          <section class="dbg__sec">
            <h4 class="dbg__h">传送 & 走格</h4>
            <button class="btn-comic btn-comic--sm" :class="{ 'btn-comic--blue': teleportOn }" @click="toggleTeleport">
              {{ teleportOn ? '🔴 传送模式开（点棋盘格子）' : '点格子传送' }}
            </button>
            <div class="dbg__row">
              <input v-model.number="steps" class="input-comic input-comic--sm" type="number" min="1" max="50" />
              <button class="btn-comic btn-comic--sm" @click="dbg({ type: 'DEBUG_MOVE', steps })">直接走 N 步</button>
            </div>
          </section>

          <!-- 金钱 -->
          <section class="dbg__sec">
            <h4 class="dbg__h">金钱</h4>
            <div class="dbg__row">
              <input v-model.number="money" class="input-comic input-comic--sm" type="number" />
              <button class="btn-comic btn-comic--sm" @click="dbg({ type: 'DEBUG_MONEY', amount: Math.abs(money) || 1000 })">加钱</button>
              <button class="btn-comic btn-comic--sm btn-comic--ghost" @click="dbg({ type: 'DEBUG_MONEY', amount: -(Math.abs(money) || 1000) })">扣钱</button>
            </div>
          </section>

          <!-- 卡片 -->
          <section class="dbg__sec">
            <h4 class="dbg__h">送卡片</h4>
            <div class="dbg__grid">
              <button v-for="c in CARDS" :key="'c' + c.type" class="dbg__mini dbg__mini--card" @click="dbg({ type: 'DEBUG_GIVE', kind: 'card', id: c.type })">
                {{ c.name }}
              </button>
            </div>
          </section>

          <!-- 地产 -->
          <section class="dbg__sec">
            <h4 class="dbg__h">地产（划给目标玩家）</h4>
            <div class="dbg__row">
              <select v-model.number="propTile" class="input-comic input-comic--sm">
                <option v-for="t in landTiles" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
              <button class="btn-comic btn-comic--sm" @click="dbg({ type: 'DEBUG_PROPERTY', tileId: propTile, level: 0 })">强买</button>
              <button class="btn-comic btn-comic--sm btn-comic--yellow" @click="dbg({ type: 'DEBUG_PROPERTY', tileId: propTile, level: 3 })">升满</button>
            </div>
          </section>

          <!-- 银行贷款 -->
          <section class="dbg__sec">
            <h4 class="dbg__h">银行贷款</h4>
            <div class="dbg__row">
              <input v-model.number="loanAmount" class="input-comic input-comic--sm" type="number" min="100" step="100" />
              <button class="btn-comic btn-comic--sm" @click="dbg({ type: 'DEBUG_TAKE_LOAN', amount: loanAmount || 1000 })">借钱</button>
              <button class="btn-comic btn-comic--sm btn-comic--ghost" @click="dbg({ type: 'DEBUG_REPAY_LOAN', amount: loanAmount || 1000 })">还钱</button>
            </div>
          </section>

          <!-- 回合 -->
          <section class="dbg__sec">
            <h4 class="dbg__h">回合 & 状态</h4>
            <div class="dbg__row">
              <button class="btn-comic btn-comic--sm" @click="dbg({ type: 'END_TURN' })">结束回合</button>
              <button class="btn-comic btn-comic--sm btn-comic--ghost" @click="dbg({ type: 'DEBUG_JAIL', turns: 2 })">进监狱</button>
              <button class="btn-comic btn-comic--sm btn-comic--ghost" @click="dbg({ type: 'DEBUG_JAIL', turns: 0 })">出狱</button>
            </div>
            <div class="dbg__row dbg__row--mt">
              <button
                v-for="p in players"
                :key="'sw' + p.id"
                class="btn-comic btn-comic--sm btn-comic--ghost"
                :class="{ 'btn-comic--blue': currentId === p.id }"
                @click="emit('debug', { type: 'DEBUG_SWITCH_TURN', playerId: p.id })"
              >轮到{{ p.name }}</button>
            </div>
          </section>

          <!-- 流程 -->
          <section class="dbg__sec">
            <h4 class="dbg__h">流程</h4>
            <div class="dbg__row">
              <button class="btn-comic btn-comic--sm btn-comic--red" @click="emit('reset')">重置对局</button>
              <input v-model.number="rounds" class="input-comic input-comic--sm" type="number" min="1" max="50" />
              <button class="btn-comic btn-comic--sm" @click="emit('fast-forward', rounds)">AI 快跑 {{ rounds }} 回合</button>
            </div>
          </section>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.dbg {
  position: fixed;
  right: 14px;
  bottom: 14px;
  z-index: 90;
  font-family: var(--font-comic, inherit);
}

.dbg__fab {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  background: var(--ink, #1a1a1a);
  color: #fff;
  border: 3px solid #fff;
  box-shadow: 3px 3px 0 0 rgba(26, 26, 26, 0.6);
  position: relative;
  transition: transform 0.12s ease;
}
.dbg__fab:hover { transform: scale(1.08) rotate(8deg); }
.dbg__fab:active { transform: scale(0.94); }
.dbg__dot {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--pop-red, #ef4444);
  border: 2px solid #fff;
}

.dbg__panel {
  position: absolute;
  right: 0;
  bottom: 66px;
  width: 320px;
  max-height: min(70vh, 640px);
  overflow-y: auto;
  background: #fff;
  border: 3px solid var(--ink, #1a1a1a);
  border-radius: 12px;
  box-shadow: 6px 6px 0 0 rgba(26, 26, 26, 0.55);
  padding: 12px;
}

.dbg__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.dbg__title {
  font-weight: 900;
  font-size: 15px;
  letter-spacing: 0.05em;
}
.dbg__close {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--pop-red, #ef4444);
  color: #fff;
  font-weight: 900;
  border: 2px solid var(--ink, #1a1a1a);
  cursor: pointer;
  line-height: 1;
}

.dbg__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dbg__sec {
  border-top: 2px dashed rgba(26, 26, 26, 0.18);
  padding-top: 10px;
}
.dbg__h {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #555;
}

.dbg__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dbg__chip {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 900;
  border-radius: 999px;
  border: 2px solid var(--ink, #1a1a1a);
  background: #fff;
  cursor: pointer;
}
.dbg__chip--on {
  background: var(--pc, #1a1a1a);
  color: #fff;
}

.dbg__row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
}
.dbg__row--mt { margin-top: 6px; }

.dbg__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}
.dbg__mini {
  padding: 5px 2px;
  font-size: 11px;
  font-weight: 900;
  border-radius: 6px;
  border: 2px solid var(--ink, #1a1a1a);
  background: #eef2ff;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dbg__mini--card { background: #fef9c3; }

.dbg-pop-enter-active,
.dbg-pop-leave-active {
  transition: transform 0.16s ease, opacity 0.16s ease;
}
.dbg-pop-enter-from,
.dbg-pop-leave-to {
  transform: translateY(12px) scale(0.96);
  opacity: 0;
}

@media (max-width: 860px) {
  .dbg__panel {
    width: 280px;
  }
}
</style>
