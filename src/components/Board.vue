<script setup>
import { computed } from 'vue'
import { TILES, RIVERS, GROUPS, isPropertyTile, isBridge, isMetro, SHOPS } from '../game/index.js'

const props = defineProps({
  state: Object,
  current: Object,
  selectable: { type: Array, default: () => [] },
})
const emit = defineEmits(['tileClick', 'upgrade'])

const tiles = computed(() => TILES.filter(Boolean))

const pathLine = computed(() => {
  return tiles.value.map((t) => `${t.x},${t.y}`).join(' ')
})

function tileBg(t) {
  switch (t.type) {
    case 'start': return '#ef4444'
    case 'metro': return '#facc15'
    case 'bridge': return '#1d4ed8'
    case 'land': return t.group ? GROUPS[t.group].color : '#ffffff'
    case 'event': return '#ffffff'
    default: return '#ffffff'
  }
}

function tileFg(t) {
  if (t.type === 'land' && !t.group) return '#1a1a1a'
  if (t.type === 'event') return '#1a1a1a'
  return '#ffffff'
}

function tileMark(t) {
  switch (t.type) {
    case 'start': return 'GO'
    case 'metro': return '🚈'
    case 'bridge': return '🌉'
    case 'event': return t.id === 42 ? '🍲' : '?'
    case 'land': return ''
    default: return ''
  }
}

function ownerOf(id) {
  return props.state.players.find((p) => p.alive && p.properties.includes(id))
}

function levelOf(id) {
  const o = ownerOf(id)
  return o ? o.levels[id] ?? 0 : 0
}

function shopOf(id) {
  return SHOPS[levelOf(id)]
}

function playersOn(id) {
  return props.state.players.filter((p) => p.alive && p.pos === id)
}

function itemsOn(id) {
  return props.state.boardItems.filter((b) => b.tileId === id)
}

function isClosed(id) {
  return (props.state.closedBridges[id] ?? 0) > 0
}

function upgradable(id) {
  const p = props.current
  if (!p || p.isAI) return false
  const tile = TILES[id]
  if (!isPropertyTile(tile) || !p.properties.includes(id)) return false
  if (tile.type === 'metro' && !tile.upgradable) return false
  const level = p.levels[id] ?? 0
  return level < 3
}

function onTile(t) {
  if (props.selectable.includes(t.id)) {
    emit('tileClick', t.id)
  } else if (upgradable(t.id)) {
    emit('upgrade', t.id)
  }
}

const diceText = computed(() => {
  if (!props.state.dice) return '—'
  return props.state.dice.join(' + ')
})
</script>

<template>
  <div class="board">
    <svg class="board__rivers" viewBox="0 0 100 88" preserveAspectRatio="none" aria-hidden="true">
      <path v-for="r in RIVERS" :key="r.name" :d="r.d" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" opacity="0.5" />
      <polyline :points="pathLine" fill="none" stroke="#1a1a1a" stroke-width="0.6" stroke-dasharray="1.5 1.5" opacity="0.3" />
    </svg>

    <div
      v-for="t in tiles"
      :key="t.id"
      class="tile"
      :class="{
        'tile--sel': selectable.includes(t.id),
        'tile--up': upgradable(t.id),
      }"
      :style="{ left: t.x + '%', top: t.y + '%', background: tileBg(t), color: tileFg(t) }"
      :title="t.name + (t.sub ? ' · ' + t.sub : '') + (ownerOf(t.id) ? ' · 拥有者 ' + ownerOf(t.id).name : '')"
      @click="onTile(t)"
    >
      <span v-if="tileMark(t)" class="tile__mark">{{ tileMark(t) }}</span>
      <span class="tile__name">{{ t.name }}</span>
      <span v-if="isPropertyTile(t)" class="tile__price">¥{{ t.price }}</span>
      <span v-else-if="isBridge(t)" class="tile__price">{{ isClosed(t.id) ? '封' : '¥' + t.toll }}</span>
      <span v-else-if="isMetro(t)" class="tile__price">¥{{ t.price }}</span>

      <span v-if="isClosed(t.id)" class="tile__closed">🚧</span>

      <span v-if="isPropertyTile(t) && ownerOf(t.id)" class="tile__shop" :title="shopOf(t.id).name">
        {{ shopOf(t.id).icon }}
      </span>
      <span v-if="isPropertyTile(t) && ownerOf(t.id)" class="tile__owner" :style="{ background: ownerOf(t.id).color }"></span>

      <span class="tile__items">
        <i v-for="b in itemsOn(t.id)" :key="b.id" :title="b.type">{{ b.type === 'barrier' ? '🚧' : b.type === 'mine' ? '💣' : '🧨' }}</i>
      </span>

      <span class="tile__pawns">
        <i v-for="p in playersOn(t.id)" :key="p.id" class="pawn" :style="{ background: p.color }">
          <em v-if="p.vehicle !== 'walk'" class="pawn__veh">{{ p.vehicle === 'bike' ? '🚲' : p.vehicle === 'moto' ? '🛵' : p.vehicle === 'car' ? '🚗' : '✈️' }}</em>
        </i>
      </span>
    </div>

    <div class="board__center">
      <div class="board__logo">重庆<br />大富翁</div>
      <div class="board__info">
        <span>第 {{ state.round }} 回合</span>
        <span class="board__who">轮到 <b>{{ current ? current.name : '—' }}</b></span>
        <span class="board__dice">🎲 {{ diceText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board {
  position: relative;
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
  aspect-ratio: 100 / 88;
  border: 4px solid var(--ink);
  border-radius: 10px;
  background: #fffef0;
  overflow: hidden;
  box-shadow: 6px 6px 0 0 var(--ink);
}

.board__rivers {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.tile {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 5.4%;
  height: 6.6%;
  min-width: 30px;
  min-height: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5px;
  border: 2px solid var(--ink);
  border-radius: 5px;
  padding: 1px;
  user-select: none;
  cursor: default;
  text-align: center;
  box-shadow: 1.5px 1.5px 0 0 rgba(26, 26, 26, 0.8);
}

.tile--sel {
  cursor: pointer;
  outline: 3px solid var(--pop-yellow);
  outline-offset: 1px;
  animation: pulse 0.9s ease-in-out infinite;
  z-index: 5;
}

@keyframes pulse {
  0%, 100% { outline-width: 3px; }
  50% { outline-width: 6px; }
}

.tile--up {
  cursor: pointer;
  outline: 3px solid var(--pop-red);
  outline-offset: 1px;
  z-index: 5;
}

.tile__mark {
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
}

.tile__name {
  font-size: 8px;
  font-weight: 900;
  line-height: 1;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile__price {
  font-size: 7px;
  font-weight: 900;
  opacity: 0.95;
  line-height: 1;
}

.tile__closed {
  position: absolute;
  top: -5px;
  right: -5px;
  font-size: 11px;
}

.tile__shop {
  position: absolute;
  top: 1px;
  left: 1px;
  font-size: 10px;
  line-height: 1;
}

.tile__owner {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  border: 1px solid var(--ink);
}

.tile__items {
  position: absolute;
  bottom: 1px;
  left: 1px;
  display: flex;
  gap: 1px;
  font-size: 9px;
}

.tile__pawns {
  position: absolute;
  top: 1px;
  right: 1px;
  display: flex;
  gap: 1.5px;
  flex-wrap: wrap;
  max-width: 85%;
}

.pawn {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--ink);
  box-shadow: 0.5px 0.5px 0 0 rgba(26, 26, 26, 0.7);
}

.pawn__veh {
  position: absolute;
  top: -7px;
  left: 50%;
  transform: translateX(-50%);
  font-style: normal;
  font-size: 8px;
  line-height: 1;
}

.board__center {
  position: absolute;
  left: 33%;
  top: 31%;
  width: 34%;
  height: 38%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  text-align: center;
  border: 4px solid var(--ink);
  border-radius: 12px;
  background: #fffef0;
  box-shadow: 4px 4px 0 0 var(--ink);
}

.board__logo {
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.03em;
  line-height: 1.1;
  background: var(--pop-yellow);
  border: 3px solid var(--ink);
  border-radius: 7px;
  padding: 3px 10px;
  transform: rotate(-2deg);
}

.board__info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-size: 10px;
  font-weight: 900;
}

.board__who b {
  color: var(--pop-red);
}

.board__dice {
  font-size: 13px;
  letter-spacing: 0.08em;
}

@media (max-width: 520px) {
  .board {
    min-width: 480px;
  }
  .board-wrap {
    overflow-x: auto;
  }
}
</style>
