<script setup>
import { computed } from 'vue'
import ComicIcon from './ComicIcon.vue'
import { TILES, VEHICLES, isMetro, METRO_FEE } from '../game/index.js'

const props = defineProps({
  state: Object,
  current: Object,
  isMyTurn: Boolean,
  animating: Boolean, // 掷骰/走格动画播放中，禁用操作按钮
  roomId: String,
  isHost: Boolean,
  paused: Boolean,
  aiTakeover: Boolean,
  turnTimeLeft: { type: Number, default: 30 },
  players: { type: Array, default: () => [] },
  gameLog: { type: Array, default: () => [] },
})
const emit = defineEmits(['dispatch', 'metro', 'surrender', 'pause', 'kick', 'setPassword', 'toggleAITakeover'])

const pendingTile = computed(() => {
  if (props.state.pending?.kind === 'buy') {
    return TILES[props.state.pending.tileId]
  }
  return null
})

const canBuy = computed(() => pendingTile.value && props.current.money >= pendingTile.value.price)

const metroPending = computed(() => props.state.pending?.kind === 'metro')
const metroFee = computed(() => METRO_FEE)

// 回合阶段条：roll → landed → end
const phaseSteps = computed(() => {
  const phase = props.state.phase
  const steps = [
    { key: 'roll', label: '掷骰', done: phase !== 'roll', active: phase === 'roll' },
    { key: 'land', label: '结算', done: phase === 'end' || phase === 'roll' && props.state.dice, active: phase === 'landed' || phase === 'fork' || phase === 'auction' },
    { key: 'end', label: '结束', done: false, active: false },
  ]
  // 只有人类玩家回合才显示步骤条
  if (!props.isMyTurn) return []
  return steps
})

const statusText = computed(() => {
  if (props.state.status !== 'playing') return ''
  const cur = props.current
  if (!cur) return ''
  if (props.animating) return `🎲 ${cur.name} 掷骰中…`
  if (cur.bankrupt) return `${cur.name} 已破产`
  if (cur.jailLeft > 0) return `${cur.name} 在拘留所（剩 ${cur.jailLeft} 轮）`
  if (cur.skipTurns > 0) return `${cur.name} 被定住`
  if (cur.hospital) return `${cur.name} 在医院休养`
  if (!props.isMyTurn) return `${cur.name} 思考中…`
  if (props.state.phase === 'roll') return `轮到你掷骰（${VEHICLES[cur.vehicle].name} ${VEHICLES[cur.vehicle].dice} 颗）`
  if (props.state.phase === 'fork') return `⑂ 分岔路口：选一条路线继续走`
  if (metroPending.value) return `轻轨站：可以乘轻轨去其他站`
  if (pendingTile.value) return `「${pendingTile.value.name}」待购买`
  return `轮到你行动`
})
</script>

<template>
  <section class="actions card-comic">
    <!-- 回合阶段条 -->
    <div v-if="phaseSteps.length" class="phase-bar">
      <div v-for="(s, i) in phaseSteps" :key="s.key" class="phase-bar__step" :class="{ 'phase-bar__step--done': s.done, 'phase-bar__step--active': s.active }">
        <span class="phase-bar__dot">{{ s.done ? '✓' : (i + 1) }}</span>
        <span class="phase-bar__label">{{ s.label }}</span>
      </div>
    </div>

    <div class="actions__status-col">
      <p class="actions__status" :class="{ 'actions__status--mine': isMyTurn }">{{ statusText }}</p>
      <p v-if="paused" class="actions__paused">⏸ 游戏已暂停（房主暂停中，操作暂不可用）</p>
      <p class="actions__meta">
        <span>第 {{ state.round }} 回合</span>
        <span class="actions__dice"><ComicIcon name="dice" :size="14" /> {{ state.dice ? state.dice.join(' + ') : '—' }}</span>
      </p>
    </div>

    <div v-if="isMyTurn && !paused" class="actions__btns">
      <!-- 掷骰阶段：骰子在棋盘下方（提示词在骰子下方），这里只显示状态文字 -->
      <template v-if="state.phase === 'roll'">
        <span v-if="animating" class="actions__roll-hint">🎲 骰子飞行中…</span>
      </template>

      <template v-else-if="state.phase === 'landed'">
        <template v-if="pendingTile">
          <button class="btn-comic" :disabled="!canBuy || animating || paused" @click="emit('dispatch', { type: 'BUY_PROPERTY' })">
            购买 ¥{{ pendingTile.price }}
          </button>
          <button class="btn-comic btn-comic--ghost" :disabled="animating || paused" @click="emit('dispatch', { type: 'SKIP_BUY' })">放弃</button>
        </template>
        <button v-if="metroPending" class="btn-comic btn-comic--blue" :disabled="animating || paused" @click="emit('metro')">
          <ComicIcon name="metro" :size="17" /> 乘轻轨 ¥{{ metroFee }}
        </button>
        <button class="btn-comic btn-comic--yellow" :disabled="animating || paused" @click="emit('dispatch', { type: 'END_TURN' })">结束回合</button>
      </template>
    </div>

    <p v-else class="actions__wait">等待电脑对手行动…</p>

      <div class="legend">
        <span class="legend__item"><i style="background:#ffffff"></i>普通地产</span>
        <span class="legend__item"><i style="background:#22c55e"></i>景点</span>
        <span class="legend__item"><i style="background:#0891b2"></i>轻轨站</span>
        <span class="legend__item"><i style="background:#8b5cf6"></i>商圈</span>
        <span class="legend__item"><i style="background:#a855f7"></i>神仙</span>
        <span class="legend__item"><i style="background:#f97316"></i>彩票</span>
        <span class="legend__item"><i style="background:#ef4444"></i>起点</span>
        <span class="legend__item"><i style="background:#facc15"></i>事件</span>
      </div>
  </section>
</template>

<style scoped>
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  position: relative;
}

.actions__menu-btn {
  position: absolute;
  top: 8px;
  right: 8px;
}

/* ===== 回合阶段条 ===== */
.phase-bar {
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
  padding-bottom: 8px;
  border-bottom: 2px dashed var(--ink);
  margin-bottom: 4px;
}

.phase-bar__step {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  position: relative;
  opacity: 0.4;
}

.phase-bar__step--active {
  opacity: 1;
}
.phase-bar__step--done {
  opacity: 0.7;
}

.phase-bar__step:not(:last-child)::after {
  content: '';
  flex: 1;
  height: 2px;
  background: var(--ink);
  margin: 0 6px;
}

.phase-bar__step--done:not(:last-child)::after {
  background: #22c55e;
}

.phase-bar__dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--ink);
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 900;
  flex-shrink: 0;
}

.phase-bar__step--active .phase-bar__dot {
  background: var(--pop-yellow);
  animation: phase-pulse 1s ease-in-out infinite;
}

.phase-bar__step--done .phase-bar__dot {
  background: #22c55e;
  color: #fff;
}

.phase-bar__label {
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.phase-bar__step--active .phase-bar__label {
  color: var(--pop-red);
}

@keyframes phase-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.actions__status {
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.actions__status--mine {
  color: var(--pop-red);
}

.actions__paused {
  font-size: 12px;
  font-weight: 900;
  color: #b45309;
  background: #fef3c7;
  border: 2px solid var(--ink);
  border-radius: 6px;
  padding: 2px 8px;
  align-self: flex-start;
}

.actions__status-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.actions__meta {
  display: flex;
  gap: 14px;
  font-size: 12px;
  font-weight: 900;
  opacity: 0.7;
}

.actions__dice {
  letter-spacing: 0.08em;
}

.actions__btns {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.actions__wait {
  font-size: 13px;
  font-weight: 900;
  opacity: 0.65;
  font-style: italic;
}

.actions__roll-hint {
  font-size: 13px;
  font-weight: 900;
  color: var(--pop-red);
  background: #fff3c4;
  border: 2px solid var(--ink);
  border-radius: 8px;
  padding: 6px 12px;
  animation: roll-hint 1.1s ease-in-out infinite;
}

@keyframes roll-hint {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.legend {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
  padding-top: 8px;
  border-top: 2px dashed var(--ink);
}

.legend__item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 900;
}

.legend__item i {
  width: 14px;
  height: 10px;
  border: 2px solid var(--ink);
  border-radius: 3px;
}
/* ===== 手机端：底部固定栏内部样式 ===== */
@media (max-width: 768px) {
  .actions__menu-btn {
    position: absolute;
    top: 4px;
    right: 4px;
  }
  /* 固定高度（按按钮态预留）：掷骰提示 ↔ 购买按钮切换时高度不变，棋盘不被挤压跳动 */
  .actions {
    min-height: 92px;
    align-content: center;
  }
  .phase-bar {
    padding-bottom: 4px;
    margin-bottom: 2px;
  }
  .actions__status { font-size: 13px; }
  .actions__meta { font-size: 11px; gap: 8px; }
  .actions__btns { gap: 6px; }
  .legend { display: none; }
}
</style>
