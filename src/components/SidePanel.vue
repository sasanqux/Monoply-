<script setup>
import { computed } from 'vue'
import { TILES, VEHICLES } from '../game/index.js'

const props = defineProps({
  state: Object,
  current: Object,
  selectablePlayers: { type: Array, default: () => [] },
})
const emit = defineEmits(['playerClick'])

const players = computed(() => props.state.players)

function statusOf(p) {
  if (p.bankrupt) return '破产'
  if (p.id === props.current?.id) return '行动中'
  if (p.jailLeft > 0) return `监狱 ${p.jailLeft}`
  if (p.skipTurns > 0) return '定住'
  if (p.hospital) return '住院'
  return '等待'
}

function landNames(p) {
  return p.properties.map((i) => TILES[i].name).join('、') || '—'
}

function onPlayer(p) {
  if (props.selectablePlayers.includes(p.id)) emit('playerClick', p.id)
}
</script>

<template>
  <aside class="side">
    <section class="side__block card-comic">
      <h2 class="comic-title comic-title--md">玩家</h2>
      <ul class="players">
        <li
          v-for="p in players"
          :key="p.id"
          class="player"
          :class="{
            'player--dead': p.bankrupt,
            'player--turn': p.id === current?.id,
            'player--sel': selectablePlayers.includes(p.id),
          }"
          @click="onPlayer(p)"
        >
          <i class="player__dot" :style="{ background: p.color }">
            <em v-if="p.vehicle !== 'walk'" class="player__veh">{{ VEHICLES[p.vehicle].icon }}</em>
          </i>
          <span class="player__name">{{ p.name }}<em v-if="p.isAI">AI</em></span>
          <span class="player__money" :class="{ 'player__money--debt': p.bankrupt && p.money < 0 }">
            {{ p.bankrupt && p.money < 0 ? '欠 ¥' + -p.money : '¥' + p.money }}
          </span>
          <span class="player__status">{{ statusOf(p) }}</span>
          <span class="player__bag">
            🎴{{ p.hand.length }} · 📦{{ p.items.length }} · {{ VEHICLES[p.vehicle].icon }}
          </span>
          <span class="player__land">{{ landNames(p) }}</span>
        </li>
      </ul>
    </section>

    <section class="side__block card-comic side__block--grow">
      <h2 class="comic-title comic-title--md">事件记录</h2>
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
  gap: 16px;
  min-width: 0;
}

.side__block {
  padding: 14px 16px;
}

.side__block--grow {
  max-height: 380px;
  display: flex;
  flex-direction: column;
}

.players {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.player {
  display: grid;
  grid-template-columns: 16px 1fr auto auto;
  grid-template-areas:
    'dot name status money'
    'dot bag bag bag'
    'dot land land land';
  align-items: center;
  gap: 3px 8px;
  padding: 8px;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: #fff;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.player--sel {
  cursor: pointer;
  outline: 3px solid var(--pop-yellow);
  outline-offset: 2px;
  animation: pulse 0.9s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { outline-width: 3px; }
  50% { outline-width: 6px; }
}

.player--turn {
  background: #fff3c4;
  box-shadow: 3px 3px 0 0 var(--ink);
}

.player--dead {
  opacity: 0.45;
}

.player__dot {
  grid-area: dot;
  position: relative;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--ink);
}

.player__veh {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  font-style: normal;
  font-size: 11px;
}

.player__name {
  grid-area: name;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player__name em {
  font-style: normal;
  font-size: 9px;
  color: #fff;
  background: var(--pop-red);
  border: 1px solid var(--ink);
  border-radius: 4px;
  padding: 0 4px;
  margin-left: 4px;
}

.player__money {
  grid-area: money;
  font-size: 13px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.player__money--debt {
  color: var(--pop-red);
}

.player__status {
  grid-area: status;
  font-size: 10px;
  font-weight: 900;
  opacity: 0.65;
}

.player__bag {
  grid-area: bag;
  font-size: 11px;
  font-weight: 900;
}

.player__land {
  grid-area: land;
  font-size: 10px;
  opacity: 0.7;
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
  margin-top: 10px;
}

.log__line {
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.5;
  border-bottom: 2px dashed var(--ink);
  padding-bottom: 4px;
  opacity: 0.85;
}
</style>
