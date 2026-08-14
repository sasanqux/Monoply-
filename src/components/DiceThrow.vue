<script setup>
// DiceThrow.vue — 3D 立方体骰子：拖拽扔到棋盘 → 立体翻滚 → 落地弹跳 → 定格在真实点数面
// 点数 → 目标角度映射，动画多滚几圈后 easeOut 停在目标角度，点数完全可控
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  canThrow: Boolean,   // 当前是否可投掷
  finalDice: Array,    // 真实点数 [a, b]
  boardEl: Object,     // 棋盘 DOM（算落点）
})
const emit = defineEmits(['throw', 'settle'])

// ===== 骰子 3D 面布局（标准骰子：对面和=7） =====
// CSS 3D 左手系（y 向下、z 朝屏幕外）。transform 从右到左应用。
// 面的局部变换：rotate(θ) translateZ(35px)，先 translateZ 后 rotate
//   1 前面: rotateY(0) translateZ     → 法线 +Z（朝屏幕外）
//   2 顶面: rotateX(90) translateZ    → 法线 -Y（y 向下，-Y=上）
//   3 右面: rotateY(90) translateZ    → 法线 +X
//   4 左面: rotateY(-90) translateZ   → 法线 -X
//   5 底面: rotateX(-90) translateZ   → 法线 +Y（y 向下，+Y=下）
//   6 后面: rotateY(180) translateZ   → 法线 -Z
const FACE_TRANSFORM = {
  1: 'rotateY(0deg) translateZ(35px)',
  2: 'rotateX(90deg) translateZ(35px)',
  3: 'rotateY(90deg) translateZ(35px)',
  4: 'rotateY(-90deg) translateZ(35px)',
  5: 'rotateX(-90deg) translateZ(35px)',
  6: 'rotateY(180deg) translateZ(35px)',
}
// 点数 → 骰子整体最终旋转角（transform: rotateX(rx) rotateY(ry)，先 ry 后 rx）
// 顶面(-Y)转到前(+Z)：rotateX(-90)；底面(+Y)转到前：rotateX(90)
// 右面(+X)转到前：rotateY(-90)；左面(-X)转到前：rotateY(90)；后面(-Z)转到前：rotateY(180)
const FACE_ROT = {
  1: { x: 0, y: 0 },      // 前
  2: { x: -90, y: 0 },    // 顶
  3: { x: 0, y: -90 },    // 右
  4: { x: 0, y: 90 },     // 左
  5: { x: 90, y: 0 },     // 底
  6: { x: 0, y: 180 },    // 后
}

// 点数 → 圆点位置（标准 3x3 布局，70x70 面）
const DOTS = {
  1: [[35, 35]],
  2: [[17.5, 17.5], [52.5, 52.5]],
  3: [[17.5, 17.5], [35, 35], [52.5, 52.5]],
  4: [[17.5, 17.5], [52.5, 17.5], [17.5, 52.5], [52.5, 52.5]],
  5: [[17.5, 17.5], [52.5, 17.5], [35, 35], [17.5, 52.5], [52.5, 52.5]],
  6: [[17.5, 17.5], [52.5, 17.5], [17.5, 35], [52.5, 35], [17.5, 52.5], [52.5, 52.5]],
}
function dotsOf(n) {
  return DOTS[n] || DOTS[1]
}

// ===== 状态 =====
const state = ref('idle') // idle/drag/flying/rolling/settle/gone
const pos = reactive({ x: 0, y: 0 })
const scale = ref(1)
const cubeA = reactive({ x: 0, y: 0 }) // 骰子A整体旋转
const cubeB = reactive({ x: 0, y: 0 })
const faceA = ref(1)
const faceB = ref(1)

const PAIR_W = 150
const DIE = 70
let dragStart = null
let lastMove = null
let velocity = { x: 0, y: 0 }
let animTimer = null
let raf = null
let thrown = false

function boardRect() {
  return props.boardEl?.getBoundingClientRect?.() || null
}
function homePos() {
  const b = boardRect()
  if (b) return { x: b.left + b.width / 2 - PAIR_W / 2, y: b.bottom + 16 }
  return { x: window.innerWidth / 2 - PAIR_W / 2, y: window.innerHeight - 140 }
}

function resetIdle() {
  state.value = 'idle'
  const h = homePos()
  pos.x = h.x; pos.y = h.y
  scale.value = 1
  cubeA.x = 0; cubeA.y = 0; cubeB.x = 0; cubeB.y = 0
  faceA.value = props.finalDice?.[0] || 1
  faceB.value = props.finalDice?.[1] || 1
  thrown = false
}

onMounted(resetIdle)
onBeforeUnmount(() => { clearTimeout(animTimer); cancelAnimationFrame(raf) })

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
      cubeA.x = 0; cubeA.y = 0; cubeB.x = 0; cubeB.y = 0
      state.value = 'idle'
    }, 90)
  }
}

// ===== 投掷：飞行（抛物线+临时旋转）→ 落地滚动（读 finalDice 算目标角度）→ 定格 =====
function launch(fromX, fromY) {
  state.value = 'flying'
  thrown = true
  emit('throw') // App：生成本回合真实点数（finalDice 随后异步更新）

  const b = boardRect()
  if (!b) return
  const speed = Math.hypot(velocity.x, velocity.y)
  const dirX = velocity.x / (speed || 1)
  const dirY = velocity.y / (speed || 1)
  const spread = Math.min(120, speed * 0.6)
  let tx = b.left + b.width / 2 + dirX * spread
  let ty = b.top + b.height / 2 + dirY * spread * 0.6
  tx = Math.max(b.left + 20, Math.min(b.right - PAIR_W - 20, tx))
  ty = Math.max(b.top + 20, Math.min(b.bottom - DIE - 20, ty))

  const sx = fromX - PAIR_W / 2
  const sy = fromY - DIE / 2
  const dx = tx - sx
  const dy = ty - sy
  const t0 = performance.now()
  const flyDur = 520

  // 飞行阶段：只转临时角度（不含点数信息，等待 finalDice 异步到位）
  cancelAnimationFrame(raf)
  const flyFrame = (now) => {
    const p = Math.min(1, (now - t0) / flyDur)
    const ease = p * (2 - p)
    pos.x = sx + dx * ease
    pos.y = sy + dy * ease - Math.sin(p * Math.PI) * 100 // 抛物线
    const tmpRot = p * 360
    cubeA.x = tmpRot; cubeA.y = tmpRot
    cubeB.x = -tmpRot; cubeB.y = -tmpRot
    if (p < 1) raf = requestAnimationFrame(flyFrame)
    else {
      pos.x = tx; pos.y = ty
      startRolling()
    }
  }
  raf = requestAnimationFrame(flyFrame)
}

// ===== 落地滚动：此刻 finalDice 已到位，算目标角度，从当前角度滚过去 =====
function startRolling() {
  state.value = 'rolling'
  scale.value = 1
  // 真实点数（此时 props.finalDice 一定已由 App 更新）
  const fA = props.finalDice?.[0] || 1
  const fB = props.finalDice?.[1] || 1
  const targetA = FACE_ROT[fA]
  const targetB = FACE_ROT[fB]
  const turns = 720 // 2 整圈（360 整数倍，保证停在目标面）
  const dirXr = Math.random() > 0.5 ? 1 : -1
  const dirYr = Math.random() > 0.5 ? 1 : -1
  const endA = { x: targetA.x + turns * dirXr, y: targetA.y + turns * dirYr }
  const endB = { x: targetB.x + turns * -dirXr, y: targetB.y + turns * -dirYr }
  // 从当前临时角度平滑过渡到目标角度
  const fromA = { x: cubeA.x, y: cubeA.y }
  const fromB = { x: cubeB.x, y: cubeB.y }
  const t0 = performance.now()
  const dur = 900
  cancelAnimationFrame(raf)
  const rollFrame = (now) => {
    const p = Math.min(1, (now - t0) / dur)
    const ease = 1 - Math.pow(1 - p, 3) // cubicOut 减速
    cubeA.x = fromA.x + (endA.x - fromA.x) * ease
    cubeA.y = fromA.y + (endA.y - fromA.y) * ease
    cubeB.x = fromB.x + (endB.x - fromB.x) * ease
    cubeB.y = fromB.y + (endB.y - fromB.y) * ease
    if (p < 1) raf = requestAnimationFrame(rollFrame)
    else {
      cubeA.x = endA.x; cubeA.y = endA.y
      cubeB.x = endB.x; cubeB.y = endB.y
      bounce()
    }
  }
  raf = requestAnimationFrame(rollFrame)
}

// ===== 落地弹跳：小幅上下弹 + 微震 =====
function bounce() {
  state.value = 'rolling'
  const b = boardRect()
  const landY = pos.y
  const t0 = performance.now()
  const dur = 420
  cancelAnimationFrame(raf)
  const bounceFrame = (now) => {
    const p = Math.min(1, (now - t0) / dur)
    // 二次弹跳衰减
    const bounceH = Math.sin(p * Math.PI * 2) * (1 - p) * 26
    pos.y = landY - bounceH
    scale.value = 1 + (1 - p) * 0.08
    if (p < 1) raf = requestAnimationFrame(bounceFrame)
    else { pos.y = landY; scale.value = 1; settle() }
  }
  raf = requestAnimationFrame(bounceFrame)
}

// ===== 定格：显示真实点数面，停留后通知 App 触发走格 =====
function settle() {
  state.value = 'settle'
  if (props.finalDice?.length) {
    faceA.value = props.finalDice[0]
    faceB.value = props.finalDice[1]
    // 骰子面已由角度保证朝向屏幕，无需额外操作
  }
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
const styleA = computed(() => ({ transform: `rotateX(${cubeA.x}deg) rotateY(${cubeA.y}deg)` }))
const styleB = computed(() => ({ transform: `rotateX(${cubeB.x}deg) rotateY(${cubeB.y}deg)` }))
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
      <!-- 骰子 A -->
      <div class="die3d" :style="styleA">
        <div v-for="f in 6" :key="f" class="die3d__face" :style="{ transform: FACE_TRANSFORM[f] }">
          <svg viewBox="0 0 70 70" class="die3d__svg" aria-hidden="true">
            <rect x="2" y="2" width="66" height="66" rx="10" fill="#fff" stroke="#1a1a1a" stroke-width="3" />
            <circle v-for="(p, j) in dotsOf(f)" :key="j" :cx="p[0]" :cy="p[1]" r="7.5" fill="#1a1a1a" />
          </svg>
        </div>
      </div>
      <!-- 骰子 B -->
      <div class="die3d" :style="styleB">
        <div v-for="f in 6" :key="f" class="die3d__face" :style="{ transform: FACE_TRANSFORM[f] }">
          <svg viewBox="0 0 70 70" class="die3d__svg" aria-hidden="true">
            <rect x="2" y="2" width="66" height="66" rx="10" fill="#fff" stroke="#1a1a1a" stroke-width="3" />
            <circle v-for="(p, j) in dotsOf(f)" :key="j" :cx="p[0]" :cy="p[1]" r="7.5" fill="#1a1a1a" />
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

.dice-throw__hint {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 132px;
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
  gap: 12px;
  width: 152px;
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
  user-select: none;
  filter: drop-shadow(5px 5px 0 rgba(26, 26, 26, 0.55));
  perspective: 300px;
  perspective-origin: 50% 50%;
}

.dice-throw__pair--drag {
  cursor: grabbing;
}

.die3d {
  position: relative;
  width: 70px;
  height: 70px;
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
