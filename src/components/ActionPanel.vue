<script setup>
import { computed } from 'vue'
import { TILES, VEHICLES, isMetro } from '../game/index.js'

const props = defineProps({
  state: Object,
  current: Object,
  isMyTurn: Boolean,
})
const emit = defineEmits(['dispatch', 'metro'])

const pendingTile = computed(() => {
  if (props.state.pending?.kind === 'buy') {
    return TILES[props.state.pending.tileId]
  }
  return null
})

const canBuy = computed(() => pendingTile.value && props.current.money >= pendingTile.value.price)

const metroPending = computed(() => props.state.pending?.kind === 'metro')

const statusText = computed(() => {
  if (props.state.status !== 'playing') return ''
  const cur = props.current
  if (!cur) return ''
  if (cur.bankrupt) return `${cur.name} 已破产`
  if (cur.jailLeft > 0) return `⛓️ ${cur.name} 在拘留所（剩 ${cur.jailLeft} 轮）`
  if (cur.skipTurns > 0) return `✋ ${cur.name} 被定住`
  if (cur.hospital) return `🏥 ${cur.name} 在医院休养`
  if (!props.isMyTurn) return `🤖 ${cur.name} 思考中…`
  if (props.state.phase === 'roll') return `🎲 轮到你掷骰（${VEHICLES[cur.vehicle].name} ${VEHICLES[cur.vehicle].dice} 颗）`
  if (metroPending.value) return `🚈 轻轨站：可以乘轻轨去其他站`
  if (pendingTile.value) return `「${pendingTile.value.name}」${pendingTile.value.type === 'bridge' ? '（桥）' : ''}待购买`
  return `轮到你行动`
})
</script>

<template>
  <section class="actions card-comic">
    <div class="actions__status-col">
      <p class="actions__status" :class="{ 'actions__status--mine': isMyTurn }">{{ statusText }}</p>
      <p class="actions__meta">
        <span>第 {{ state.round }} 回合</span>
        <span class="actions__dice">🎲 {{ state.dice ? state.dice.join(' + ') : '—' }}</span>
      </p>
    </div>

    <div v-if="isMyTurn" class="actions__btns">
      <button
        v-if="state.phase === 'roll'"
        class="btn-comic"
        @click="emit('dispatch', { type: 'ROLL_DICE' })"
      >
        掷骰子
      </button>

      <template v-else-if="state.phase === 'landed'">
        <template v-if="pendingTile">
          <button class="btn-comic" :disabled="!canBuy" @click="emit('dispatch', { type: 'BUY_PROPERTY' })">
            购买 ¥{{ pendingTile.price }}
          </button>
          <button class="btn-comic btn-comic--ghost" @click="emit('dispatch', { type: 'SKIP_BUY' })">放弃</button>
        </template>
        <button v-if="metroPending" class="btn-comic btn-comic--blue" @click="emit('metro')">
          🚈 乘轻轨 ¥150
        </button>
        <button class="btn-comic btn-comic--yellow" @click="emit('dispatch', { type: 'END_TURN' })">结束回合</button>
      </template>
    </div>

    <p v-else class="actions__wait">等待电脑对手行动…</p>

    <div class="legend">
      <span class="legend__item"><i style="background:#ffffff"></i>普通</span>
      <span class="legend__item"><i style="background:#3b82f6"></i>桥</span>
      <span class="legend__item"><i style="background:#22c55e"></i>轻轨</span>
      <span class="legend__item"><i style="background:#8b5cf6"></i>商圈</span>
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
}

.actions__status {
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.actions__status--mine {
  color: var(--pop-red);
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
</style>
