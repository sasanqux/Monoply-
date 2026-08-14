<script setup>
// DiceThrow.vue — 可拿取的骰子实体：拖拽扔到棋盘 → 飞行 → 落地滚动 → 定格点数
// 纯表现层。松手瞬间 emit('throw') 由 App 定点数并 dispatch；定格后 emit('settle') 触发走格
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  canThrow: Boolean,   // 当前是否可投掷（轮到我且 phase=roll）
  finalDice: Array,    // 真实点数 [a, b]（App 在 throw 后传入）
  boardEl: Object,     // 棋盘 DOM 元素引用（算落点）
})
const emit = defineEmits(['throw', 'settle'])

// ===== 骰子点数 → 圆点位置（标准 3x3 布局，24x24 viewBox） =====
const DOTS = {
  1: [[12, 12]],
  2: [[7, 7], [17, 17]],
  3: [[7, 7], [12, 12], [17, 17]],
  4: [[7, 7], [17, 7], [7, 17], [17, 17]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7, 7], [17, 7], [7, 12], [17, 12], [7, 17], [17, 17]],
}
function dotsOf(n) {
  return DOTS[n] || DOTS[1]
}

const PAIR_W = 150   // 骰子对总宽
const DIE = 64       // 单颗骰子边长

// ===== 状态机 =====
// idle(原位待拿) / drag(跟手) / flying(飞行) / rolling(落地滚动) / settle(定格) / gone(消失回位)
const state = ref('idle')
const pos = reactive({ x: 0, y: 0 })  // 骰子对左上角（fixed）
const rot = ref(0)
const scale = ref(1)
const show = ref([1, 1])
const thrown = ref(false) // 已投出（防止重复 throw）

let dragStart = null
let lastMove = null
let velocity = { x: 0, y: 0 }
let animTimer = null
let raf = null

function boardRect() {
  return props.boardEl?.getBoundingClientRect?.() || null
}

function homePos() {
  const b = boardRect()
  if (b) return { x: b.left + b.width / 2 - PAIR_W / 2, y: b.bottom + 20 }
  return { x: window.innerWidth / 2 - PAIR_W / 2, y: window.innerHeight - 150 }
}

function resetIdle() {
  state.value = 'idle'
  const h = homePos()
  pos.x = h.x; pos.y = h.y
  rot.value = 0; scale.value = 1
  thrown.value = false
  show.value = props.finalDice?.length ? [...props.finalDice] : [1, 1]
}

onMounted(resetIdle)
onBeforeUnmount(() => {
  clearTimeout(animTimer); cancelAnimationFrame(raf)
})

// ===== 拖拽 =====
function onPointerDown(e) {
  if (state.value !== 'idle' || !props.canThrow) return
  if (e.button !== undefined && e.button !== 0) return
  e.preventDefault()
  state.value = 'drag'
  scale.value = 1.12
  dragStart = { x: e.clientX, y: e.clientY }
  lastMove = { x: e.clientX, y: e.clientY, t: performance.now() }
  velocity = { x: 0, y: 0 }
  pos.x = e.clientX - PAIR_W / 2
  pos.y = e.clientY - DIE / 2
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e) {
  if (state.value !== 'drag') return
  const now = performance.now()
  const dt = now - lastMove.t
  if (dt > 0) {
    velocity.x = ((e.clientX - lastMove.x) / dt) * 16
    velocity.y = ((e.clientY - lastMove.y) / dt) * 16
  }
  lastMove = { x: e.clientX, y: e.clientY, t: now }
  pos.x = e.clientX - PAIR_W / 2
  pos.y = e.clientY - DIE / 2
  rot.value = Math.atan2(e.clientY - dragStart.y, e.clientX - dragStart.x) * 0.3
}

function onPointerUp(e) {
  if (state.value !== 'drag') return
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  const now = performance.now()
  const dt = now - lastMove.t
  if (dt > 0) {
    velocity.x = ((e.clientX - lastMove.x) / dt) * 16
    velocity.y = ((e.clientY - lastMove.y) / dt) * 16
  }
  const b = boardRect()
  const onBoard = b && e.clientX >= b.left - 40 && e.clientX <= b.right + 40 && e.clientY >= b.top - 40 && e.clientY <= b.bottom + 40
  if (onBoard) {
    launch(e.clientX, e.clientY)
  } else {
    // 没扔到棋盘：弹回原位，不消耗
    state.value = 'flying'
    cancelAnimationFrame(raf)
    const h = homePos()
    animTimer = setTimeout(() => {
      pos.x = h.x; pos.y = h.y; rot.value = 0; scale.value = 1
      state.value = 'idle'
    }, 90)
  }
}

// ===== 投掷：向棋盘中心飞，落点随速度偏移 =====
function launch(fromX, fromY) {
  state.value = 'flying'
  thrown.value = true
  emit('throw') // App：生成本回合真实点数并 dispatch（延迟走格）

  const b = boardRect()
  if (!b) return
  const speed = Math.hypot(velocity.x, velocity.y)
  const dirX = velocity.x / (speed || 1)
  const dirY = velocity.y / (speed || 1)
  const spread = Math.min(130, speed * 0.6)
  let tx = b.left + b.width / 2 + dirX * spread
  let ty = b.top + b.height / 2 + dirY * spread * 0.6
  tx = Math.max(b.left + 20, Math.min(b.right - PAIR_W - 20, tx))
  ty = Math.max(b.top + 20, Math.min(b.bottom - DIE - 20, ty))

  const sx = fromX - PAIR_W / 2
  const sy = fromY - DIE / 2
  const dx = tx - sx
  const dy = ty - sy
  const t0 = performance.now()
  const dur = 480
  cancelAnimationFrame(raf)
  const flyFrame = (now) => {
    const p = Math.min(1, (now - t0) / dur)
    const ease = p * (2 - p)
    pos.x = sx + dx * ease
    pos.y = sy + dy * ease - Math.sin(p * Math.PI) * 130 // 抛物线拱起
    rot.value = p * 720
    if (p < 1) raf = requestAnimationFrame(flyFrame)
    else { pos.x = tx; pos.y = ty; startRolling() }
  }
  raf = requestAnimationFrame(flyFrame)
}

// ===== 落地滚动：点数随机跳 + 旋转减速 =====
function startRolling() {
  state.value = 'rolling'
  scale.value = 1
  const rollMs = 1100
  const t0 = performance.now()
  let last = 0
  cancelAnimationFrame(raf)
  const rollFrame = (now) => {
    const p = Math.min(1, (now - t0) / rollMs)
    rot.value = 540 * (1 - p)
    if (now - last > 55 + p * 220) {
      last = now
      show.value = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]
    }
    if (p < 1) raf = requestAnimationFrame(rollFrame)
    else settle()
  }
  raf = requestAnimationFrame(rollFrame)
}

// ===== 定格 =====
function settle() {
  state.value = 'settle'
  rot.value = 0
  if (props.finalDice?.length) show.value = [...props.finalDice]
  animTimer = setTimeout(() => {
    emit('settle') // App：触发走格动画
    state.value = 'gone'
    setTimeout(resetIdle, 250)
  }, 1100)
}

const pairStyle = computed(() => ({
  left: pos.x + 'px',
  top: pos.y + 'px',
  transform: `rotate(${rot.value}deg) scale(${scale.value})`,
}))
</script>

<template>
  <div v-if="state !== 'gone'" class="dice-throw">
    <p v-if="state === 'idle'" class="dice-throw__hint">🎯 拖到棋盘上扔出去</p>
    <div
      class="dice-throw__pair"
      :class="{ 'dice-throw__pair--drag': state === 'drag' }"
      :style="pairStyle"
      @pointerdown="onPointerDown"
    >
      <span class="dice-throw__die">
        <svg class="dice-throw__face" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="1.5" y="1.5" width="21" height="21" rx="4.5" fill="#fff" stroke="#1a1a1a" stroke-width="2.4" />
          <circle v-for="(p, j) in dotsOf(show[0])" :key="j" :cx="p[0]" :cy="p[1]" r="2.6" fill="#1a1a1a" />
        </svg>
      </span>
      <span class="dice-throw__die">
        <svg class="dice-throw__face" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="1.5" y="1.5" width="21" height="21" rx="4.5" fill="#fff" stroke="#1a1a1a" stroke-width="2.4" />
          <circle v-for="(p, j) in dotsOf(show[1])" :key="j" :cx="p[0]" :cy="p[1]" r="2.6" fill="#1a1a1a" />
        </svg>
      </span>
    </div>
  </div>
</template>

<style scoped>
.dice-throw {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 40;
}

.dice-throw__hint {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 130px;
  font-size: 13px;
  font-weight: 900;
  background: var(--pop-yellow);
  border: 3px solid var(--ink);
  border-radius: 8px;
  box-shadow: 3px 3px 0 0 var(--ink);
  padding: 6px 14px;
  animation: hint-pulse 1.2s ease-in-out infinite;
  white-space: nowrap;
}

@keyframes hint-pulse {
  0%, 100% { transform: translateX(-50%) scale(1); }
  50% { transform: translateX(-50%) scale(1.06); }
}

.dice-throw__pair {
  position: fixed;
  display: flex;
  gap: 18px;
  width: 150px;
  pointer-events: auto;
  cursor: grab;
  filter: drop-shadow(5px 5px 0 rgba(26, 26, 26, 0.55));
  touch-action: none;
  user-select: none;
}

.dice-throw__pair--drag {
  cursor: grabbing;
}

.dice-throw__die {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
}

.dice-throw__face {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
