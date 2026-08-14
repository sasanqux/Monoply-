<script setup>
// DiceThrow.vue — 3D 立方体骰子：拖拽扔到棋盘 → 立体翻滚 → 落地弹跳 → 定格在真实点数面
// 支持 N 颗骰子（走路 1 / 自行车 2 / 摩托 3 / 汽车 4 / 飞机 5）
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  canThrow: Boolean,   // 当前是否可投掷
  finalDice: Array,    // 真实点数 [a, b, ...]
  boardEl: Object,     // 棋盘 DOM（算落点）
  anchorEl: Object,    // 操作面板 DOM（初始位置锚点：面板右侧靠中间）
})
const emit = defineEmits(['throw', 'settle'])

// ===== 骰子 3D 面布局（标准骰子：对面和=7） =====
const FACE_TRANSFORM = {
  1: 'rotateY(0deg) translateZ(23px)',
  2: 'rotateX(90deg) translateZ(23px)',
  3: 'rotateY(90deg) translateZ(23px)',
  4: 'rotateY(-90deg) translateZ(23px)',
  5: 'rotateX(-90deg) translateZ(23px)',
  6: 'rotateY(180deg) translateZ(23px)',
}
// 点数 → 骰子整体最终旋转角（先 ry 后 rx）
const FACE_ROT = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 },
}

// 点数 → 圆点位置（标准 3x3 布局，46x46 面）
const DOTS = {
  1: [[23, 23]],
  2: [[11.5, 11.5], [34.5, 34.5]],
  3: [[11.5, 11.5], [23, 23], [34.5, 34.5]],
  4: [[11.5, 11.5], [34.5, 11.5], [11.5, 34.5], [34.5, 34.5]],
  5: [[11.5, 11.5], [34.5, 11.5], [23, 23], [11.5, 34.5], [34.5, 34.5]],
  6: [[11.5, 11.5], [34.5, 11.5], [11.5, 23], [34.5, 23], [11.5, 34.5], [34.5, 34.5]],
}
function dotsOf(n) {
  return DOTS[n] || DOTS[1]
}

// ===== 状态 =====
const state = ref('idle') // idle/drag/flying/rolling/settle/gone
const pos = reactive({ x: 0, y: 0 })
const scale = ref(1)
// cubes[i] = 第 i 颗骰子的整体旋转
const cubes = reactive([])
function syncCubes(count) {
  while (cubes.length < count) cubes.push(reactive({ x: 0, y: 0 }))
  while (cubes.length > count) cubes.pop()
  for (const c of cubes) { c.x = 0; c.y = 0 }
}

const DIE = 46
const GAP = 8
function pairWidth(count) {
  return count * DIE + (count - 1) * GAP
}
const dieCount = computed(() => Math.max(1, props.finalDice?.length || 1))

let dragStart = null
let lastMove = null
let velocity = { x: 0, y: 0 }
let animTimer = null
let raf = null
let thrown = false

function boardRect() {
  return props.boardEl?.getBoundingClientRect?.() || null
}
// 初始位置：操作面板（信息窗口）右侧靠中间，跟游戏界面一体
function homePos() {
  const w = pairWidth(dieCount.value)
  const a = props.anchorEl?.getBoundingClientRect?.()
  if (a) {
    // 面板右侧，竖直中间
    return {
      x: a.right - w - 10,
      y: a.top + a.height / 2 - DIE / 2,
    }
  }
  const b = boardRect()
  if (b) return { x: b.left + b.width / 2 - w / 2, y: b.bottom + 12 }
  return { x: window.innerWidth / 2 - w / 2, y: window.innerHeight - 110 }
}

function resetIdle() {
  state.value = 'idle'
  const h = homePos()
  pos.x = h.x; pos.y = h.y
  scale.value = 1
  syncCubes(dieCount.value)
  thrown = false
}

onMounted(resetIdle)
onBeforeUnmount(() => { clearTimeout(animTimer); cancelAnimationFrame(raf) })
watch(dieCount, resetIdle)
// 锚点元素就绪后重新定位（首次挂载时 actionPanelEl 可能尚未赋值）
watch(
  () => props.anchorEl,
  () => { if (state.value === 'idle') resetIdle() },
  { flush: 'post' }
)

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
  pos.x = e.clientX - pairWidth(dieCount.value) / 2
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
  pos.x = e.clientX - pairWidth(dieCount.value) / 2
  pos.y = e.clientY - DIE / 2
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
  if (onBoard) launch(e.clientX, e.clientY)
  else {
    state.value = 'flying'
    cancelAnimationFrame(raf)
    const h = homePos()
    animTimer = setTimeout(() => {
      pos.x = h.x; pos.y = h.y; scale.value = 1
      syncCubes(dieCount.value)
      state.value = 'idle'
    }, 90)
  }
}

// ===== 投掷：飞行（临时旋转）→ 落地滚动（读 finalDice 算目标）→ 定格 =====
function launch(fromX, fromY) {
  state.value = 'flying'
  thrown = true
  emit('throw')

  const b = boardRect()
  if (!b) return
  const speed = Math.hypot(velocity.x, velocity.y)
  const dirX = velocity.x / (speed || 1)
  const dirY = velocity.y / (speed || 1)
  const spread = Math.min(110, speed * 0.6)
  const w = pairWidth(dieCount.value)
  let tx = b.left + b.width / 2 + dirX * spread
  let ty = b.top + b.height / 2 + dirY * spread * 0.6
  tx = Math.max(b.left + 16, Math.min(b.right - w - 16, tx))
  ty = Math.max(b.top + 16, Math.min(b.bottom - DIE - 16, ty))

  const sx = fromX - w / 2
  const sy = fromY - DIE / 2
  const dx = tx - sx
  const dy = ty - sy
  const t0 = performance.now()
  const flyDur = 520

  cancelAnimationFrame(raf)
  const flyFrame = (now) => {
    const p = Math.min(1, (now - t0) / flyDur)
    const ease = p * (2 - p)
    pos.x = sx + dx * ease
    pos.y = sy + dy * ease - Math.sin(p * Math.PI) * 90
    const tmpRot = p * 360
    cubes.forEach((c, i) => {
      const d = i % 2 === 0 ? 1 : -1
      c.x = tmpRot * d
      c.y = tmpRot * d
    })
    if (p < 1) raf = requestAnimationFrame(flyFrame)
    else { pos.x = tx; pos.y = ty; startRolling() }
  }
  raf = requestAnimationFrame(flyFrame)
}

function startRolling() {
  state.value = 'rolling'
  scale.value = 1
  const faces = props.finalDice?.length ? props.finalDice : [1]
  const from = cubes.map((c) => ({ x: c.x, y: c.y }))
  const ends = faces.map((f, i) => {
    const t = FACE_ROT[f] || FACE_ROT[1]
    const turns = 720
    const dirXr = Math.random() > 0.5 ? 1 : -1
    const dirYr = Math.random() > 0.5 ? 1 : -1
    return { x: t.x + turns * dirXr, y: t.y + turns * dirYr }
  })
  const t0 = performance.now()
  const dur = 900
  cancelAnimationFrame(raf)
  const rollFrame = (now) => {
    const p = Math.min(1, (now - t0) / dur)
    const ease = 1 - Math.pow(1 - p, 3)
    cubes.forEach((c, i) => {
      const e = ends[i]
      const f = from[i]
      c.x = f.x + (e.x - f.x) * ease
      c.y = f.y + (e.y - f.y) * ease
    })
    if (p < 1) raf = requestAnimationFrame(rollFrame)
    else {
      cubes.forEach((c, i) => { c.x = ends[i].x; c.y = ends[i].y })
      bounce()
    }
  }
  raf = requestAnimationFrame(rollFrame)
}

function bounce() {
  state.value = 'rolling'
  const b = boardRect()
  const landY = pos.y
  const t0 = performance.now()
  const dur = 420
  cancelAnimationFrame(raf)
  const bounceFrame = (now) => {
    const p = Math.min(1, (now - t0) / dur)
    const bounceH = Math.sin(p * Math.PI * 2) * (1 - p) * 22
    pos.y = landY - bounceH
    scale.value = 1 + (1 - p) * 0.08
    if (p < 1) raf = requestAnimationFrame(bounceFrame)
    else { pos.y = landY; scale.value = 1; settle() }
  }
  raf = requestAnimationFrame(bounceFrame)
}

function settle() {
  state.value = 'settle'
  animTimer = setTimeout(() => {
    emit('settle')
    state.value = 'gone'
    setTimeout(resetIdle, 250)
  }, 1100)
}

const pairStyle = computed(() => ({
  left: pos.x + 'px',
  top: pos.y + 'px',
  transform: `scale(${scale.value})`,
}))
const dieStyles = computed(() =>
  cubes.map((c) => ({ transform: `rotateX(${c.x}deg) rotateY(${c.y}deg)` }))
)
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
      <p v-if="state === 'idle'" class="dice-throw__hint">🎯 拖到棋盘上扔出去</p>
      <div
        v-for="(f, i) in (props.finalDice?.length ? props.finalDice : [1])"
        :key="i"
        class="die3d"
        :style="dieStyles[i]"
      >
        <div v-for="face in 6" :key="face" class="die3d__face" :style="{ transform: FACE_TRANSFORM[face] }">
          <svg viewBox="0 0 46 46" class="die3d__svg" aria-hidden="true">
            <rect x="1.8" y="1.8" width="42.4" height="42.4" rx="7" fill="#fff" stroke="#1a1a1a" stroke-width="2.4" />
            <circle v-for="(p, j) in dotsOf(face)" :key="j" :cx="p[0]" :cy="p[1]" r="4.8" fill="#1a1a1a" />
          </svg>
        </div>
      </div>
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

/* 提示词：显示在骰子对下方（不遮挡骰子） */
.dice-throw__hint {
  position: absolute;
  left: 50%;
  bottom: -34px;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: 900;
  background: var(--pop-yellow);
  border: 2.5px solid var(--ink);
  border-radius: 8px;
  box-shadow: 3px 3px 0 0 var(--ink);
  padding: 3px 10px;
  animation: hint-pulse 1.2s ease-in-out infinite;
  white-space: nowrap;
  z-index: 2;
}

@keyframes hint-pulse {
  0%, 100% { transform: translateX(-50%) scale(1); }
  50% { transform: translateX(-50%) scale(1.06); }
}

.dice-throw__pair {
  position: fixed;
  display: flex;
  gap: 10px;
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
  user-select: none;
  filter: drop-shadow(4px 4px 0 rgba(26, 26, 26, 0.55));
  perspective: 240px;
  perspective-origin: 50% 50%;
}

.dice-throw__pair--drag {
  cursor: grabbing;
}

.die3d {
  position: relative;
  width: 46px;
  height: 46px;
  transform-style: preserve-3d;
  flex-shrink: 0;
}

.die3d__face {
  position: absolute;
  inset: 0;
  backface-visibility: visible;
}

.die3d__svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
