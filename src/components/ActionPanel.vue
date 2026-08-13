<script setup>
import { computed } from 'vue'
import { TILES } from '../game/index.js'

const props = defineProps({
  state: Object,
  current: Object,
  isMyTurn: Boolean,
})
const emit = defineEmits(['dispatch'])

const pendingTile = computed(() => {
  if (props.state.pending?.kind === 'buy') {
    return TILES[props.state.pending.tileId]
  }
  return null
})

const canBuy = computed(() => pendingTile.value && props.current.money >= pendingTile.value.price)

const statusText = computed(() => {
  if (props.state.status !== 'playing') return ''
  const cur = props.current
  if (!cur) return ''
  if (cur.bankrupt) return `${cur.name} 已破产`
  if (cur.jailLeft > 0) return `🚔 ${cur.name} 在监狱（剩 ${cur.jailLeft} 轮）`
  if (cur.hospital) return `🏥 ${cur.name} 在医院休养`
  if (!props.isMyTurn) return `🤖 ${cur.name} 思考中…`
  if (props.state.phase === 'roll') return `🎲 轮到你掷骰`
  if (pendingTile.value) return `「${pendingTile.value.name}」待购买`
  return `轮到你行动`
})
</script>

<template>
  <section class="actions">
    <p class="actions__status" :class="{ 'actions__status--mine': isMyTurn }">{{ statusText }}</p>

    <div v-if="isMyTurn" class="actions__btns">
      <button v-if="state.phase === 'roll'" class="btn btn--red" @click="emit('dispatch', { type: 'ROLL_DICE' })">
        掷骰子
      </button>

      <template v-else-if="state.phase === 'landed'">
        <template v-if="pendingTile">
          <button class="btn" :disabled="!canBuy" @click="emit('dispatch', { type: 'BUY_PROPERTY' })">
            购买 ¥{{ pendingTile.price }}
          </button>
          <button class="btn btn--ghost" @click="emit('dispatch', { type: 'SKIP_BUY' })">放弃</button>
        </template>
        <button class="btn" @click="emit('dispatch', { type: 'END_TURN' })">结束回合</button>
      </template>
    </div>

    <p v-else class="actions__wait">等待电脑对手行动…</p>
  </section>
</template>

<style scoped>
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  border: 2px solid var(--black);
  padding: var(--space-2);
  flex-wrap: wrap;
}

.actions__status {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.03em;
}

.actions__status--mine {
  color: var(--red);
}

.actions__btns {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.actions__wait {
  font-size: 12px;
  color: var(--gray-500);
  font-style: italic;
}
</style>
