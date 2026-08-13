<script setup>
import { computed } from 'vue'
import { TILES } from '../game/index.js'

const props = defineProps({
  state: Object,
  current: Object,
})

const players = computed(() => props.state.players)

function statusOf(p) {
  if (p.bankrupt) return '破产'
  if (p.id === props.current?.id) return '行动中'
  if (p.jailLeft > 0) return `监狱 ${p.jailLeft}`
  if (p.hospital) return '住院'
  return '等待'
}

function landNames(p) {
  return p.properties.map((i) => TILES[i].name).join('、') || '—'
}
</script>

<template>
  <aside class="side">
    <section class="side__block">
      <h2 class="sec-title">玩家</h2>
      <ul class="players">
        <li
          v-for="p in players"
          :key="p.id"
          class="player"
          :class="{ 'player--dead': p.bankrupt, 'player--turn': p.id === current?.id }"
        >
          <i class="player__dot" :style="{ background: p.color }"></i>
          <span class="player__name">{{ p.name }}<em v-if="p.isAI">AI</em></span>
          <span class="player__money" :class="{ 'player__money--debt': p.bankrupt }">{{ p.bankrupt && p.money < 0 ? '欠 ¥' + (-p.money) : '¥' + p.money }}</span>
          <span class="player__status">{{ statusOf(p) }}</span>
          <span class="player__land">{{ landNames(p) }}</span>
        </li>
      </ul>
    </section>

    <section class="side__block side__block--grow">
      <h2 class="sec-title">事件记录</h2>
      <ul class="log">
        <li v-for="(line, i) in [...state.log].reverse()" :key="i" class="log__line">{{ line }}</li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
.side {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.side__block {
  border: 1px solid var(--grid);
  padding: var(--space-2);
}

.side__block--grow {
  max-height: 420px;
  display: flex;
  flex-direction: column;
}

.players {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.player {
  display: grid;
  grid-template-columns: 14px 1fr auto auto;
  grid-template-areas:
    'dot name status money'
    'dot land land land';
  align-items: center;
  gap: 4px 8px;
  padding: 8px;
  border: 1px solid var(--grid);
}

.player--turn {
  border-color: var(--red);
  border-width: 2px;
}

.player--dead {
  opacity: 0.45;
}

.player__dot {
  grid-area: dot;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid var(--gray-300);
}

.player__name {
  grid-area: name;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player__name em {
  font-style: normal;
  font-size: 10px;
  color: var(--red);
  border: 1px solid var(--red);
  padding: 0 3px;
  margin-left: 4px;
  vertical-align: 1px;
}

.player__money {
  grid-area: money;
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.player__money--debt {
  color: var(--red);
}

.player__status {
  grid-area: status;
  font-size: 11px;
  color: var(--gray-500);
}

.player__land {
  grid-area: land;
  font-size: 11px;
  color: var(--gray-500);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log {
  list-style: none;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}

.log__line {
  font-size: 12px;
  line-height: 1.5;
  color: var(--gray-700);
  border-bottom: 1px dashed var(--grid);
  padding-bottom: 4px;
}
</style>
