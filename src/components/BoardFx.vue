<script setup>
// BoardFx.vue — 棋盘漫画特效层（掷骰 / 棋子逐格走动 / 拟声词 / 震屏）
// 纯表现层：不碰游戏规则，坐标与棋盘 tilePosition 对齐（0-100 百分比）
import { ref, watch } from 'vue'
import ComicIcon from './ComicIcon.vue'

const props = defineProps({
  state: Object,
  lastMove: Object, // { paths: [{ pid, path: [格id...] }], n } — 由 App 计算移动路径
  posMap: Object, // { [tileId]: { x, y } }
})
const emit = defineEmits(['boom', 'walking'])

// 当前正在走动的玩家集合（通知 Board 隐藏真实棋子，避免"两个棋子"）
const walkingPids = ref(new Set())

// ===== 掷骰动画 =====
const diceFx = ref(null)
let diceSeq = 0
watch(
  () => props.state?.dice,
  (dice) => {
    if (!dice) return
    const sum = dice.reduce((a, b) => a + b, 0)
    diceFx.value = { dice: [...dice], sum, id: ++diceSeq }
    // 骰子动画总时长约 4.4s：下落 0.8s → 弹跳 0.9s → 静止展示 2.3s → 淡出 0.4s
    // 关键是弹跳结束后有 2.3s 静止定格，让玩家看清点数与合计
    setTimeout(() => {
      if (diceFx.value?.id === diceSeq) diceFx.value = null
    }, 4400)
  }
)

// ===== 棋子逐格走动 =====
const walkers = ref([])
let walkSeq = 0
function syncWalking() {
  const pids = new Set()
  for (const w of walkers.value) pids.add(w.pid)
  walkingPids.value = pids
  emit('walking', [...pids])
}
watch(
  () => props.lastMove,
  (mv) => {
    if (!mv || !props.state) return
    const plByPid = {}
    for (const p of props.state.players) plByPid[p.id] = p
    for (const w of mv.paths || []) {
      const pl = plByPid[w.pid]
      if (!pl || !pl.alive) continue
      const key = ++walkSeq
      const wobj = {
        key,
        pid: pl.id,
        color: pl.color,
        veh: pl.vehicle,
        path: w.path,
        seg: 0,
      }
      walkers.value.push(wobj)
      syncWalking()
      // 逐格走动：每格 0.4s（通过响应式数组取代理对象修改 seg，触发重渲染）
      // 走完后再停留 0.5s 展示落点，然后移除动画棋子
      const stepMs = 400
      const timer = setInterval(() => {
        const w = walkers.value.find((x) => x.key === key)
        if (!w) { clearInterval(timer); return }
        w.seg += 1
        if (w.seg >= w.path.length) {
          clearInterval(timer)
          setTimeout(() => {
            walkers.value = walkers.value.filter((x) => x.key !== key)
            syncWalking()
          }, 500)
        }
      }, stepMs)
    }
  },
  { deep: true }
)

// ===== 拟声词 =====
const words = ref([])
let wordSeq = 0
const WORD_RULES = [
  { re: /核弹|炸平/, word: 'KABOOM!', color: '#ef4444' },
  { re: /定时炸弹.*爆炸|炸弹.*爆炸/, word: 'KABOOM!', color: '#ef4444' },
  { re: /地雷/, word: 'BOOM!', color: '#ef4444' },
  { re: /路障/, word: 'BONK!', color: '#f97316' },
  { re: /怪兽/, word: 'ROAR!', color: '#22c55e' },
  { re: /江水拦住/, word: 'SPLASH!', color: '#3b82f6' },
  { re: /乘轻轨/, word: 'ZOOM!', color: '#a855f7' },
  { re: /传送门/, word: 'WHOOSH!', color: '#a855f7' },
  { re: /商圈已建成/, word: 'BINGO!', color: '#facc15' },
  { re: /升级到/, word: 'LEVEL UP!', color: '#22c55e' },
  { re: /封桥卡/, word: 'CLANG!', color: '#64748b' },
  { re: /破产/, word: 'WAH!', color: '#64748b' },
  { re: /免罪|豁免/, word: 'SHIELD!', color: '#3b82f6' },
  { re: /陷害|监狱|拘留/, word: 'LOCKED!', color: '#64748b' },
  { re: /停留|定住/, word: 'FREEZE!', color: '#3b82f6' },
  { re: /购入/, word: 'KER-CHING!', color: '#facc15' },
  { re: /轮渡/, word: 'SAIL!', color: '#3b82f6' },
  { re: /换地/, word: 'SWAP!', color: '#8b5cf6' },
]
let prevLogLen = 4 // 开局固定 4 条日志

watch(
  () => props.state?.log?.length,
  (len) => {
    if (!props.state || len == null) return
    if (len < prevLogLen) { prevLogLen = len; return } // 新开局
    if (len === prevLogLen) return
    const fresh = props.state.log.slice(prevLogLen)
    prevLogLen = len
    // 从新日志里从后往前找命中词（最新的优先）
    let hit = null
    for (let i = fresh.length - 1; i >= 0; i--) {
      const line = fresh[i]
      const m = WORD_RULES.find((r) => r.re.test(line))
      if (m) { hit = m; break }
    }
    if (!hit) return
    const rot = (Math.random() * 16 - 8).toFixed(1)
    const x = 50 + (Math.random() * 24 - 12)
    const y = 38 + (Math.random() * 16 - 8)
    const id = ++wordSeq
    words.value.push({ id, text: hit.word, color: hit.color, x, y, rot })
    if (/KABOOM|BOOM|ROAR/.test(hit.word)) emit('boom')
    setTimeout(() => {
      words.value = words.value.filter((w) => w.id !== id)
    }, 1500)
  }
)
</script>

<template>
  <div class="fx" aria-hidden="true">
    <!-- 掷骰大骰子 -->
    <div v-if="diceFx" :key="diceFx.id" class="fx__dice-wrap">
      <span v-for="(d, i) in diceFx.dice" :key="i" class="fx__dice" :style="{ animationDelay: (i * 0.15) + 's' }">
        <ComicIcon name="dice" :size="76" />
        <b class="fx__dice-num">{{ d }}</b>
      </span>
      <span class="fx__dice-sum">= {{ diceFx.sum }}</span>
    </div>

    <!-- 逐格走动的棋子 -->
    <span
      v-for="w in walkers"
      :key="w.key"
      class="fx__walker"
      :style="{
        left: (props.posMap?.[w.path[w.seg]]?.x ?? 50) + '%',
        top: (props.posMap?.[w.path[w.seg]]?.y ?? 50) + '%',
        background: w.color,
      }"
    >
      <ComicIcon v-if="w.veh !== 'walk'" :name="w.veh" :size="15" class="fx__walker-veh" />
    </span>

    <!-- 拟声词 -->
    <span
      v-for="wd in words"
      :key="wd.id"
      class="fx__word"
      :style="{ left: wd.x + '%', top: wd.y + '%', transform: 'rotate(' + wd.rot + 'deg)', '--wcolor': wd.color }"
    >
      {{ wd.text }}
    </span>
  </div>
</template>

<style scoped>
.fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 20;
}

/* ===== 掷骰 ===== */
.fx__dice-wrap {
  position: absolute;
  left: 50%;
  top: 34%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(255, 254, 240, 0.92);
  border: 4px solid var(--ink);
  border-radius: 14px;
  box-shadow: 5px 5px 0 0 var(--ink);
  padding: 14px 20px;
  z-index: 25;
}

.fx__dice {
  position: relative;
  width: 84px;
  height: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 下落 0.8s → 弹跳 0.9s → 静止到 4.0s → 淡出 0.4s；静止展示 2.3s 让玩家读清点数 */
  animation: dice-drop 0.8s cubic-bezier(0.3, 1.6, 0.5, 1) both, dice-land 0.9s 0.8s ease both, dice-fade 0.4s 4s ease both;
}

.fx__dice-num {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 34px;
  font-weight: 900;
  color: var(--ink);
  z-index: 2;
  text-shadow: 0 0 3px #fff, 0 0 4px #fff;
}

/* 点数合计（"= 7"大字，弹跳结束后才显现） */
.fx__dice-sum {
  align-self: center;
  margin: 0 4px;
  font-size: 44px;
  font-weight: 900;
  font-style: italic;
  color: var(--pop-red);
  -webkit-text-stroke: 2.5px var(--ink);
  paint-order: stroke fill;
  text-shadow: 4px 4px 0 rgba(26, 26, 26, 0.8);
  animation: dice-sum-in 0.3s 1.7s ease both;
  white-space: nowrap;
}

@keyframes dice-sum-in {
  0% { transform: scale(0.3) rotate(-8deg); opacity: 0; }
  70% { transform: scale(1.3) rotate(4deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

@keyframes dice-drop {
  0% { transform: translateY(-200px) rotate(-320deg); opacity: 0; }
  70% { transform: translateY(18px) rotate(20deg); opacity: 1; }
  100% { transform: translateY(0) rotate(0deg); opacity: 1; }
}

@keyframes dice-land {
  0%, 100% { transform: translateY(0) scale(1); }
  30% { transform: translateY(-22px) scale(1.08, 0.92); }
  60% { transform: translateY(0) scale(1); }
  80% { transform: translateY(-10px) scale(1.04, 0.96); }
}

@keyframes dice-fade {
  to { opacity: 0; transform: translateY(14px) scale(0.8); }
}

/* ===== 逐格走动的棋子 ===== */
.fx__walker {
  position: absolute;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  border: 2.5px solid var(--ink);
  box-shadow: 2px 2px 0 0 rgba(26, 26, 26, 0.75);
  transform: translate(-50%, -50%);
  z-index: 24;
  /* 每格 0.32s 平滑滑动 + 落地小弹跳 */
  transition: left 0.32s ease, top 0.32s ease;
  animation: walker-hop 0.5s ease infinite alternate;
}

.fx__walker-veh {
  position: absolute;
  top: -11px;
  left: 50%;
  transform: translateX(-50%);
}

@keyframes walker-hop {
  from { margin-top: 0; }
  to { margin-top: -5px; }
}

/* ===== 拟声词 ===== */
.fx__word {
  position: absolute;
  transform-origin: center;
  font-size: clamp(28px, 6cqw, 56px);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-style: italic;
  color: var(--wcolor);
  -webkit-text-stroke: 2.5px var(--ink);
  paint-order: stroke fill;
  text-shadow: 4px 4px 0 rgba(26, 26, 26, 0.85);
  animation: word-pop 1.45s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  z-index: 26;
  white-space: nowrap;
}

@keyframes word-pop {
  0% { transform: scale(0.2) rotate(0deg); opacity: 0; }
  16% { transform: scale(1.4); opacity: 1; }
  30% { transform: scale(0.95); }
  42% { transform: scale(1.15); }
  55% { transform: scale(1); opacity: 1; }
  82% { transform: scale(1.03) translateY(-8px); opacity: 1; }
  100% { transform: scale(0.88) translateY(-30px); opacity: 0; }
}
</style>
