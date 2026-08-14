<script setup>
// BoardFx.vue — 棋盘漫画特效层（掷骰 / 棋子飞行 / 拟声词 / 震屏）
// 纯表现层：不碰游戏规则，坐标与棋盘 tilePosition 对齐（0-100 百分比）
import { ref, watch } from 'vue'
import ComicIcon from './ComicIcon.vue'

const props = defineProps({
  state: Object,
  lastMove: Object, // { prevPos: [], nextPos: [] } — 由 App 在每次 dispatch 前记录
  posMap: Object, // { [tileId]: { x, y } }
})
const emit = defineEmits(['boom'])

// ===== 掷骰动画 =====
const diceFx = ref(null)
let diceSeq = 0
watch(
  () => props.state?.dice,
  (dice) => {
    if (!dice) return
    diceFx.value = { dice: [...dice], id: ++diceSeq }
    setTimeout(() => {
      if (diceFx.value?.id === diceSeq) diceFx.value = null
    }, 1500)
  }
)

// ===== 棋子飞行 =====
const flyers = ref([])
let flySeq = 0
watch(
  () => props.lastMove,
  (mv) => {
    if (!mv || !props.state) return
    for (let i = 0; i < mv.prevPos.length; i++) {
      const from = mv.prevPos[i]
      const to = mv.nextPos[i]
      if (from === to) continue
      const pl = props.state.players[i]
      if (!pl || !pl.alive) continue
      const f = props.posMap?.[from] ?? { x: 50, y: 50 }
      const t = props.posMap?.[to] ?? { x: 50, y: 50 }
      const key = ++flySeq
      flyers.value.push({ key, from: f, to: t, color: pl.color, veh: pl.vehicle })
      setTimeout(() => {
        flyers.value = flyers.value.filter((fl) => fl.key !== key)
      }, 900)
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
    }, 1100)
  }
)
</script>

<template>
  <div class="fx" aria-hidden="true">
    <!-- 掷骰大骰子 -->
    <div v-if="diceFx" :key="diceFx.id" class="fx__dice-wrap">
      <span v-for="(d, i) in diceFx.dice" :key="i" class="fx__dice" :style="{ animationDelay: (i * 0.12) + 's' }">
        <ComicIcon name="dice" :size="46" />
        <b class="fx__dice-num">{{ d }}</b>
      </span>
    </div>

    <!-- 飞行棋子 -->
    <span
      v-for="fl in flyers"
      :key="fl.key"
      class="fx__flyer"
      :style="{
        '--fx-from-x': fl.from.x + '%',
        '--fx-from-y': fl.from.y + '%',
        '--fx-to-x': fl.to.x + '%',
        '--fx-to-y': fl.to.y + '%',
        background: fl.color,
      }"
    >
      <ComicIcon v-if="fl.veh !== 'walk'" :name="fl.veh" :size="14" class="fx__flyer-veh" />
    </span>

    <!-- 拟声词 -->
    <span
      v-for="w in words"
      :key="w.id"
      class="fx__word"
      :style="{ left: w.x + '%', top: w.y + '%', transform: 'rotate(' + w.rot + 'deg)', '--wcolor': w.color }"
    >
      {{ w.text }}
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
  top: 38%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 14px;
  z-index: 25;
}

.fx__dice {
  position: relative;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: dice-drop 0.55s cubic-bezier(0.3, 1.6, 0.5, 1) both, dice-land 0.5s 0.55s ease both, dice-fade 0.3s 1.15s ease both;
}

.fx__dice-num {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 20px;
  font-weight: 900;
  color: var(--ink);
  z-index: 2;
  text-shadow: 0 0 2px #fff, 0 0 3px #fff;
}

@keyframes dice-drop {
  0% { transform: translateY(-160px) rotate(-300deg); opacity: 0; }
  70% { transform: translateY(14px) rotate(18deg); opacity: 1; }
  100% { transform: translateY(0) rotate(0deg); opacity: 1; }
}

@keyframes dice-land {
  0%, 100% { transform: translateY(0) scale(1); }
  30% { transform: translateY(-16px) scale(1.06, 0.94); }
  60% { transform: translateY(0) scale(1); }
  80% { transform: translateY(-7px) scale(1.03, 0.97); }
}

@keyframes dice-fade {
  to { opacity: 0; transform: translateY(10px) scale(0.85); }
}

/* ===== 飞行棋子 ===== */
.fx__flyer {
  position: absolute;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 2.5px solid var(--ink);
  box-shadow: 2px 2px 0 0 rgba(26, 26, 26, 0.75);
  z-index: 24;
  animation: fly 0.8s cubic-bezier(0.25, 0.8, 0.35, 1) both;
}

.fx__flyer-veh {
  position: absolute;
  top: -9px;
  left: 50%;
  transform: translateX(-50%);
}

@keyframes fly {
  0% { left: var(--fx-from-x); top: var(--fx-from-y); transform: translate(-50%, -50%) scale(0.6); opacity: 0.9; }
  40% { transform: translate(-50%, -50%) scale(1.25); }
  55% { left: var(--fx-to-x); top: var(--fx-to-y); transform: translate(-50%, -58%); }
  62% { left: var(--fx-to-x); top: var(--fx-to-y); transform: translate(-50%, -50%) scale(1); }
  100% { left: var(--fx-to-x); top: var(--fx-to-y); transform: translate(-50%, -50%) scale(1); opacity: 0; }
}

/* ===== 拟声词 ===== */
.fx__word {
  position: absolute;
  transform-origin: center;
  font-size: clamp(26px, 5.5cqw, 52px);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-style: italic;
  color: var(--wcolor);
  -webkit-text-stroke: 2.5px var(--ink);
  paint-order: stroke fill;
  text-shadow: 4px 4px 0 rgba(26, 26, 26, 0.85);
  animation: word-pop 1.05s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  z-index: 26;
  white-space: nowrap;
}

@keyframes word-pop {
  0% { transform: scale(0.2) rotate(0deg); opacity: 0; }
  18% { transform: scale(1.35); opacity: 1; }
  32% { transform: scale(0.95); }
  45% { transform: scale(1.12); }
  58% { transform: scale(1); opacity: 1; }
  85% { transform: scale(1.02) translateY(-6px); opacity: 1; }
  100% { transform: scale(0.9) translateY(-22px); opacity: 0; }
}
</style>
