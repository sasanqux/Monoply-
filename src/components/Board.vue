<script setup>
import { computed } from 'vue'
import { TILES, RIVERS, METRO_LINE, GROUPS, isPropertyTile, isBridge, isMetro, SHOPS } from '../game/index.js'

const props = defineProps({
  state: Object,
  current: Object,
  selectable: { type: Array, default: () => [] },
})
const emit = defineEmits(['tileClick', 'upgrade'])

const tiles = computed(() => TILES.filter(Boolean))

// 蛇形路径连接线（含左侧回程 48→1 闭环）
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
  if (t.type === 'event' || t.type === 'metro') return '#1a1a1a'
  return '#ffffff'
}

function tileMark(t) {
  switch (t.type) {
    case 'start': return 'GO'
    case 'metro': return '🚈'
    case 'bridge': return '🌉'
    case 'event': return t.id === 42 ? '🍲' : '?'
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
</script>

<template>
  <div class="board">
    <svg class="board__bg" viewBox="0 0 100 90" preserveAspectRatio="none" aria-hidden="true">
      <!-- 两江 -->
      <path v-for="r in RIVERS" :key="r.name" :d="r.d" fill="none" stroke="#3b82f6" stroke-width="4" stroke-linecap="round" opacity="0.6" />
      <!-- 轻轨线（立体交通） -->
      <path :d="METRO_LINE" fill="none" stroke="#a855f7" stroke-width="1.2" stroke-dasharray="3 2.5" opacity="0.8" />
      <!-- 蛇形路径线 -->
      <polyline :points="pathLine" fill="none" stroke="#1a1a1a" stroke-width="1.6" stroke-linejoin="round" opacity="0.55" />
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
  </div>
</template>

<style scoped>
.board {
  position: relative;
  width: 100%;
  aspect-ratio: 100 / 85;
  container-type: inline-size;
  border: 4px solid var(--ink);
  border-radius: 10px;
  background: #fffef0;
  overflow: hidden;
  box-shadow: 6px 6px 0 0 var(--ink);
}

.board__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.tile {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 9.4%;
  height: 10.6%;
  min-width: 58px;
  min-height: 62px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: 2.5px solid var(--ink);
  border-radius: 7px;
  padding: 2px;
  user-select: none;
  cursor: default;
  text-align: center;
  box-shadow: 2.5px 2.5px 0 0 rgba(26, 26, 26, 0.85);
}

.tile--sel {
  cursor: pointer;
  outline: 4px solid var(--pop-yellow);
  outline-offset: 2px;
  animation: pulse 0.9s ease-in-out infinite;
  z-index: 5;
}

@keyframes pulse {
  0%, 100% { outline-width: 4px; }
  50% { outline-width: 7px; }
}

.tile--up {
  cursor: pointer;
  outline: 4px solid var(--pop-red);
  outline-offset: 2px;
  z-index: 5;
}

.tile__mark {
  font-size: clamp(11px, 1.7cqw, 22px);
  font-weight: 900;
  line-height: 1;
}

.tile__name {
  font-size: clamp(10px, 1.5cqw, 20px);
  font-weight: 900;
  line-height: 1.05;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile__price {
  font-size: clamp(8px, 1.15cqw, 15px);
  font-weight: 900;
  opacity: 0.95;
  line-height: 1;
}

.tile__closed {
  position: absolute;
  top: -6px;
  right: -6px;
  font-size: 14px;
}

.tile__shop {
  position: absolute;
  top: 2px;
  left: 2px;
  font-size: 12px;
  line-height: 1;
}

.tile__owner {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1.5px solid var(--ink);
}

.tile__items {
  position: absolute;
  bottom: 2px;
  left: 2px;
  display: flex;
  gap: 2px;
  font-size: 11px;
}

.tile__pawns {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  max-width: 80%;
}

.pawn {
  position: relative;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 2px solid var(--ink);
  box-shadow: 1px 1px 0 0 rgba(26, 26, 26, 0.7);
}

.pawn__veh {
  position: absolute;
  top: -9px;
  left: 50%;
  transform: translateX(-50%);
  font-style: normal;
  font-size: 10px;
  line-height: 1;
}

@media (max-width: 560px) {
  .board {
    min-width: 520px;
  }
}
</style>
