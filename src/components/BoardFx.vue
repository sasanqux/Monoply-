<script setup>
// BoardFx.vue — 棋盘漫画特效层（掷骰 / 棋子逐格走动 / 拟声词 / 震屏）
// 纯表现层：不碰游戏规则，坐标与棋盘 tilePosition 对齐（0-100 百分比）
import { ref, watch } from 'vue'
import ComicIcon from './ComicIcon.vue'
import { playerInitial } from '../game/reducer.js'

const props = defineProps({
  state: Object,
  lastMove: Object, // { paths: [{ pid, path: [格id...] }], n } — 由 App 计算移动路径
  posMap: Object, // { [tileId]: { x, y } }
})
const emit = defineEmits(['boom', 'walking'])

// 当前正在走动的玩家集合（通知 Board 隐藏真实棋子，避免"两个棋子"）
const walkingPids = ref(new Set())

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
        name: pl.name,
        veh: pl.vehicle,
        initial: playerInitial(pl),
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
          // 钳在最后一格：停留展示期间 seg 不越界，否则 w.path[seg] 为 undefined，
          // 模板坐标会落到 ?? 50% 的兜底值 → 棋子闪现到棋盘正中心
          w.seg = w.path.length - 1
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
  { re: /怪兽/, word: 'ROAR!', color: '#22c55e' },
  { re: /乘轻轨/, word: 'ZOOM!', color: '#a855f7' },
  { re: /商圈已建成/, word: 'BINGO!', color: '#facc15' },
  { re: /升级到/, word: 'LEVEL UP!', color: '#22c55e' },
  { re: /破产/, word: 'WAH!', color: '#64748b' },
  { re: /免罪|豁免/, word: 'SHIELD!', color: '#3b82f6' },
  { re: /陷害|监狱|拘留/, word: 'LOCKED!', color: '#64748b' },
  { re: /停留|定住/, word: 'FREEZE!', color: '#3b82f6' },
  { re: /购入/, word: 'KER-CHING!', color: '#facc15' },
  { re: /换地/, word: 'SWAP!', color: '#8b5cf6' },
]
let prevLogLen = 4 // 开局固定 4 条日志

// ===== 拟声词 =====
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

// ===== 落地浮动数字（租金/收入/支出） =====
const floats = ref([])
let floatSeq = 0
const FLOAT_RULES = [
  { re: /支付.*租金|支付.*使用费/, sign: '-', color: '#ef4444' },
  { re: /收租|租金.*获得|获得国补|大礼包|打卡/, sign: '+', color: '#22c55e' },
  { re: /缴纳.*税|扣款|穷神|请吃火锅|高温假/, sign: '-', color: '#ef4444' },
  { re: /卖出.*股/, sign: '+', color: '#22c55e' },
  { re: /彩票.*中奖/, sign: '+', color: '#facc15' },
]
watch(
  () => props.state?.log?.length,
  (len) => {
    if (!props.state || len == null || len <= prevLogLen) return
    // 注意：这里 prevLogLen 已被上面的 watcher 更新，所以用 len-1 判断新条目
    const line = props.state.log[len - 1]
    const rule = FLOAT_RULES.find((r) => r.re.test(line))
    if (!rule) return
    // 从日志中提取金额
    const m = line.match(/[¥¥](\d+)/)
    if (!m) return
    const amount = m[1]
    // 找到当前行动的玩家位置
    const p = props.state.players.find((pl) => pl.alive && pl.id === props.state.players[props.state.turnIndex]?.id)
    if (!p) return
    const pos = props.posMap?.[p.pos]
    if (!pos) return
    const id = ++floatSeq
    const offsetX = (Math.random() * 8 - 4)
    floats.value.push({
      id,
      text: `${rule.sign}¥${amount}`,
      color: rule.color,
      x: pos.x + offsetX,
      y: pos.y - 4,
    })
    setTimeout(() => {
      floats.value = floats.value.filter((f) => f.id !== id)
    }, 1600)
  }
)
</script>

<template>
  <div class="fx" aria-hidden="true">
    <!-- 逐格走动的棋子 -->
    <span
      v-for="w in walkers"
      :key="w.key"
      class="fx__walker"
      :style="{
        left: (props.posMap?.[w.path[w.seg]]?.x ?? 50) + '%',
        top: (props.posMap?.[w.path[w.seg]]?.y ?? 50) + '%',
        '--pc': w.color,
      }"
    >
      <i class="fx__walker-face">{{ w.initial }}</i>
      <em class="fx__walker-tag">{{ w.name }}</em>
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

    <!-- 落地浮动数字 -->
    <span
      v-for="fl in floats"
      :key="'fl' + fl.id"
      class="fx__float"
      :style="{ left: fl.x + '%', top: fl.y + '%', '--fcolor': fl.color }"
    >
      {{ fl.text }}
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

/* ===== 逐格走动的棋子 ===== */
.fx__walker {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transform: translate(-50%, -50%);
  z-index: 24;
  /* 每格 0.32s 平滑滑动 + 落地小弹跳 */
  transition: left 0.32s ease, top 0.32s ease;
  animation: walker-hop 0.5s ease infinite alternate;
}
.fx__walker-face {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--pc);
  box-shadow: 2px 2px 0 0 rgba(26, 26, 26, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  font-style: normal;
}
.fx__walker-tag {
  font-style: normal;
  font-size: 10px;
  font-weight: 900;
  line-height: 1.3;
  color: #fff;
  background: var(--pc);
  padding: 0 4px;
  border-radius: 3px;
  white-space: nowrap;
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

/* ===== 落地浮动数字 ===== */
.fx__float {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: clamp(16px, 3.5cqw, 28px);
  font-weight: 900;
  font-style: italic;
  color: var(--fcolor);
  -webkit-text-stroke: 1.5px var(--ink);
  paint-order: stroke fill;
  text-shadow: 2px 2px 0 rgba(26, 26, 26, 0.7);
  animation: float-up 1.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  z-index: 28;
  white-space: nowrap;
  pointer-events: none;
}
@keyframes float-up {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
  40% { transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, calc(-50% - 40px)) scale(0.9); }
}
</style>
