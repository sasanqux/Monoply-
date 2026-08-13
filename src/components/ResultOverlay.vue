<script setup>
import { computed } from 'vue'
import { totalAssets } from '../game/index.js'

const props = defineProps({
  state: Object,
})
const emit = defineEmits(['again'])

const ranking = computed(() =>
  [...props.state.players]
    .sort((a, b) => totalAssets(b) - totalAssets(a))
    .map((p, i) => ({ ...p, rank: i + 1, assets: totalAssets(p) }))
)

const winner = computed(() => props.state.players.find((p) => p.id === props.state.winnerId))
</script>

<template>
  <div class="overlay">
    <div class="card">
      <h2 class="card__title">游戏结束</h2>
      <p class="card__winner">
        🏆 <b>{{ winner?.name }}</b> 获胜！
      </p>
      <p class="card__reason">{{ state.settings.maxTurns ? `第 ${state.round} 回合触发回合上限，按总资产结算` : '其他玩家全部破产，成为最后赢家' }}</p>

      <ol class="rank">
        <li v-for="r in ranking" :key="r.id" class="rank__row" :class="{ 'rank__row--win': r.id === winner?.id }">
          <span class="rank__no">{{ r.rank }}</span>
          <i class="rank__dot" :style="{ background: r.color }"></i>
          <span class="rank__name">{{ r.name }}<em v-if="r.isAI">AI</em></span>
          <span class="rank__assets">总资产 ¥{{ r.assets }}</span>
        </li>
      </ol>

      <div class="card__btns">
        <button class="btn btn--red" @click="emit('again')">再来一局</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 17, 17, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: var(--space-3);
}

.card {
  background: var(--white);
  border: 4px solid var(--black);
  padding: var(--space-4);
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.card__title {
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-bottom: 4px solid var(--red);
  padding-bottom: 8px;
}

.card__winner {
  font-size: 18px;
}

.card__winner b {
  color: var(--red);
  font-weight: 500;
}

.card__reason {
  font-size: 12px;
  color: var(--gray-500);
}

.rank {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: var(--space-1) 0;
}

.rank__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid var(--grid);
}

.rank__row--win {
  border-color: var(--red);
  border-width: 2px;
}

.rank__no {
  width: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-500);
}

.rank__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid var(--gray-300);
}

.rank__name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
}

.rank__name em {
  font-style: normal;
  font-size: 10px;
  color: var(--red);
  border: 1px solid var(--red);
  padding: 0 3px;
  margin-left: 4px;
}

.rank__assets {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.card__btns {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-1);
}
</style>
