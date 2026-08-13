<script setup>
import { computed } from 'vue'
import { TILES, RIVERS, METRO_LINE, PATH_POLYLINE, GROUPS, tilePosition, isPropertyTile, isBridge, isMetro, SHOPS } from '../game/index.js'

const props = defineProps({
  state: Object,
  current: Object,
  selectable: { type: Array, default: () => [] },
})
const emit = defineEmits(['tileClick', 'upgrade'])

const tiles = computed(() => TILES.filter(Boolean))

// 折线路径线（直接从 PATH_POLYLINE 拐点连接）
const pathLine = computed(() => PATH_POLYLINE)

function posOf(id) {
  return tilePosition(id)
}

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
    <svg class="board__bg" viewBox="0 0 100 88" preserveAspectRatio="none" aria-hidden="true">
      <!-- 两江 -->
      <path v-for="r in RIVERS" :key="r.name" :d="r.d" fill="none" stroke="#3b82f6" stroke-width="3.4" stroke-linecap="round" opacity="0.55" />
      <!-- 轻轨线（立体交通） -->
      <path :d="METRO_LINE" fill="none" stroke="#a855f7" stroke-width="1.1" stroke-dasharray="2.6 2.2" opacity="0.85" />
      <!-- 蜿蜒闭环路径线 -->
      <polyline :points="pathLine" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" opacity="0.6" />
    </svg>

    <div
      v-for="t in tiles"
      :key="t.id"
      class="tile"
      :class="{
        'tile--sel': selectable.includes(t.id),
        'tile--up': upgradable(t.id),
      }"
      :style="{ left: posOf(t.id).x + '%', top: posOf(t.id).y + '%', background: tileBg(t), color: tileFg(t) }"
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
  width: 3.9%;
  height: 4.4%;
  min-width: 46px;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  border: 2px solid var(--ink);
  border-radius: 6px;
  padding: 1px 2px;
  user-select: none;
  cursor: default;
  text-align: center;
  box-shadow: 2px 2px 0 0 rgba(26, 26, 26, 0.85);
  z-index: 2;
}

.tile--sel {
  cursor: pointer;
  outline: 4px solid var(--pop-yellow);
  outline-offset: 2px;
  animation: pulse 0.9s ease-in-out infinite;
  z-index: 6;
}

@keyframes pulse {
  0%, 100% { outline-width: 4px; }
  50% { outline-width: 7px; }
}

.tile--up {
  cursor: pointer;
  outline: 4px solid var(--pop-red);
  outline-offset: 2px;
  z-index: 6;
}

.tile__mark {
  font-size: clamp(10px, 1.5cqw, 19px);
  font-weight: 900;
  line-height: 1;
}

.tile__name {
  font-size: clamp(9px, 1.25cqw, 16px);
  font-weight: 900;
  line-height: 1.05;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile__price {
  font-size: clamp(7.5px, 0.95cqw, 13px);
  font-weight: 900;
  opacity: 0.95;
  line-height: 1;
}

.tile__closed {
  position: absolute;
  top: -5px;
  right: -5px;
  font-size: clamp(10px, 1.3cqw, 16px);
}

.tile__shop {
  position: absolute;
  top: 1px;
  left: 1px;
  font-size: clamp(9px, 1.2cqw, 15px);
  line-height: 1;
}

.tile__owner {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: clamp(4px, 0.5cqw, 7px);
  height: clamp(4px, 0.5cqw, 7px);
  border-radius: 50%;
  border: 1px solid var(--ink);
}

.tile__items {
  position: absolute;
  bottom: 1px;
  left: 1px;
  display: flex;
  gap: 1px;
  font-size: clamp(9px, 1.1cqw, 14px);
}

.tile__pawns {
  position: absolute;
  top: 1px;
  right: 1px;
  display: flex;
  gap: 1.5px;
  flex-wrap: wrap;
  max-width: 80%;
}

.pawn {
  position: relative;
  width: clamp(7px, 0.9cqw, 12px);
  height: clamp(7px, 0.9cqw, 12px);
  border-radius: 50%;
  border: 1.5px solid var(--ink);
  box-shadow: 0.5px 0.5px 0 0 rgba(26, 26, 26, 0.7);
}

.pawn__veh {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  font-style: normal;
  font-size: clamp(8px, 1cqw, 13px);
  line-height: 1;
}

/* 环中心信息面板已删除（折线地图中心不固定，会压到格子；回合/骰子在 ActionPanel 显示） */

@media (max-width: 700px) {
  .board {
    min-width: 640px;
  }
}
</style>
