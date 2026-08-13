<script setup>
import { computed } from 'vue'
import { TILES, RIVERS, GROUPS, isPropertyTile, isBridge, VEHICLES } from '../game/index.js'

const props = defineProps({
  state: Object,
  current: Object,
  selectable: { type: Array, default: () => [] },
})
const emit = defineEmits(['tileClick', 'upgrade'])

// 相邻格连线（蜿蜒路径可视化）
const pathLine = computed(() => {
  return TILES.map((t) => `${t.x},${t.y}`).join(' ')
})

function tileStyle(t) {
  return { left: t.x + '%', top: t.y + '%' }
}

function tileBg(t) {
  switch (t.type) {
    case 'start': return '#ef4444'
    case 'street': return GROUPS.A.color
    case 'plaza': return GROUPS.B.color
    case 'bridge': return '#facc15'
    case 'tax': return '#1a1a1a'
    case 'card': return '#ffffff'
    case 'item': return '#ffffff'
    case 'vehicle': return '#a855f7'
    case 'event': return '#ffffff'
    case 'jail': return '#475569'
    case 'hospital': return '#f87171'
    case 'workshop': return '#f97316'
    default: return '#ffffff'
  }
}

function tileFg(t) {
  if (t.type === 'event' || t.type === 'card' || t.type === 'item' || t.type === 'bridge') return '#1a1a1a'
  return '#ffffff'
}

function tileMark(t) {
  switch (t.type) {
    case 'start': return 'GO'
    case 'street': return '街'
    case 'plaza': return '圈'
    case 'bridge': return '🌉'
    case 'tax': return '税'
    case 'card': return '🎴'
    case 'item': return '🎁'
    case 'vehicle': return '🚗'
    case 'event': return '?'
    case 'jail': return '⛓️'
    case 'hospital': return '🏥'
    case 'workshop': return '🔧'
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
  if (!isPropertyTile(TILES[id]) || !p.properties.includes(id)) return false
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

const curVehicle = computed(() => {
  const c = props.current
  return c ? VEHICLES[c.vehicle] : null
})
</script>

<template>
  <div class="board">
    <svg class="board__rivers" viewBox="0 0 100 92" preserveAspectRatio="none" aria-hidden="true">
      <path v-for="r in RIVERS" :key="r.name" :d="r.d" fill="none" stroke="#3b82f6" stroke-width="3.2" stroke-linecap="round" opacity="0.55" />
      <polyline :points="pathLine" fill="none" stroke="#1a1a1a" stroke-width="0.5" stroke-dasharray="1.5 1.5" opacity="0.25" />
    </svg>

    <div
      v-for="t in TILES"
      :key="t.id"
      class="tile"
      :class="{
        'tile--sel': selectable.includes(t.id),
        'tile--up': upgradable(t.id),
        'tile--bridge': isBridge(t),
      }"
      :style="{ ...tileStyle(t), background: tileBg(t), color: tileFg(t) }"
      :title="t.name + (ownerOf(t.id) ? ' · 拥有者 ' + ownerOf(t.id).name : '')"
      @click="onTile(t)"
    >
      <span class="tile__mark">{{ tileMark(t) }}</span>
      <span class="tile__name">{{ t.name }}</span>
      <span v-if="isPropertyTile(t)" class="tile__price">¥{{ t.price }}</span>
      <span v-else-if="isBridge(t)" class="tile__price">{{ isClosed(t.id) ? '封桥中' : '过路费 ¥' + t.toll }}</span>

      <span v-if="isBridge(t) && ownerOf(t.id)" class="tile__bridge-owner" :style="{ background: ownerOf(t.id).color }"></span>
      <span v-if="isClosed(t.id)" class="tile__closed">🚧</span>

      <span v-if="isPropertyTile(t) && ownerOf(t.id)" class="tile__lv">
        <i v-for="n in 3" :key="n" :class="{ on: n <= levelOf(t.id) }"></i>
      </span>

      <span class="tile__items">
        <i v-for="b in itemsOn(t.id)" :key="b.id" class="tile__item-icon" :title="b.type">{{ b.type === 'barrier' ? '🚧' : b.type === 'mine' ? '💣' : '🧨' }}</i>
      </span>

      <span class="tile__pawns">
        <i v-for="p in playersOn(t.id)" :key="p.id" class="pawn" :style="{ background: p.color }">
          <em v-if="p.vehicle !== 'walk'" class="pawn__veh">{{ VEHICLES[p.vehicle].icon }}</em>
        </i>
      </span>
    </div>

    <div class="board__center">
      <div class="board__logo">重庆<br />大富翁</div>
      <div class="board__info">
        <span>第 {{ state.round }} 回合</span>
        <span class="board__who">轮到 <b>{{ current ? current.name : '—' }}</b></span>
        <span v-if="current" class="board__veh">{{ curVehicle.icon }} {{ curVehicle.name }} · {{ curVehicle.dice }} 骰</span>
        <span class="board__dice">🎲 {{ diceText }}</span>
      </div>
      <p class="board__hint">🌉 过江走桥 · 桥能买 · 点自己的地盖楼</p>
    </div>
  </div>
</template>

<style scoped>
.board {
  position: relative;
  width: 100%;
  max-width: 660px;
  margin: 0 auto;
  aspect-ratio: 100 / 92;
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
  width: 8.8%;
  height: 9.6%;
  min-width: 44px;
  min-height: 46px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  border: 2px solid var(--ink);
  border-radius: 6px;
  padding: 2px;
  user-select: none;
  cursor: default;
  text-align: center;
  box-shadow: 2px 2px 0 0 rgba(26, 26, 26, 0.85);
}

.tile--sel {
  cursor: pointer;
  outline: 3px solid var(--pop-yellow);
  outline-offset: 2px;
  animation: pulse 0.9s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { outline-width: 3px; }
  50% { outline-width: 6px; }
}

.tile--up {
  cursor: pointer;
  outline: 3px solid var(--pop-red);
  outline-offset: 2px;
}

.tile--bridge {
  box-shadow: 0 0 0 2px var(--pop-yellow), 2px 2px 0 0 var(--ink);
}

.tile__mark {
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
}

.tile__name {
  font-size: 9.5px;
  font-weight: 900;
  line-height: 1.05;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile__price {
  font-size: 8.5px;
  font-weight: 900;
  opacity: 0.95;
}

.tile__bridge-owner {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid var(--ink);
}

.tile__closed {
  position: absolute;
  top: -6px;
  right: -6px;
  font-size: 14px;
}

.tile__lv {
  position: absolute;
  bottom: 2px;
  right: 2px;
  display: flex;
  gap: 1.5px;
}

.tile__lv i {
  width: 3.5px;
  height: 3.5px;
  background: rgba(255, 255, 255, 0.35);
  border-radius: 1px;
}

.tile__lv i.on {
  background: var(--pop-yellow);
}

.tile__items {
  position: absolute;
  bottom: 2px;
  left: 2px;
  display: flex;
  gap: 2px;
}

.tile__item-icon {
  font-style: normal;
  font-size: 11px;
  line-height: 1;
}

.tile__pawns {
  position: absolute;
  top: 2px;
  left: 2px;
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  max-width: 90%;
}

.pawn {
  position: relative;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--ink);
  box-shadow: 1px 1px 0 0 rgba(26, 26, 26, 0.7);
}

.pawn__veh {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  font-style: normal;
  font-size: 10px;
  line-height: 1;
}

.board__center {
  position: absolute;
  left: 24%;
  top: 24%;
  width: 52%;
  height: 52%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  border: 4px solid var(--ink);
  border-radius: 12px;
  background: #fffef0;
  box-shadow: 5px 5px 0 0 var(--ink);
}

.board__logo {
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 1.1;
  background: var(--pop-yellow);
  border: 3px solid var(--ink);
  border-radius: 8px;
  padding: 4px 14px;
  transform: rotate(-2deg);
}

.board__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  font-weight: 900;
}

.board__who b {
  color: var(--pop-red);
}

.board__veh {
  font-size: 12px;
}

.board__dice {
  font-size: 16px;
  letter-spacing: 0.1em;
}

.board__hint {
  font-size: 10px;
  color: var(--ink);
  opacity: 0.75;
}

@media (max-width: 480px) {
  .tile {
    min-width: 0;
    min-height: 0;
  }
  .tile__name {
    font-size: 8px;
  }
  .tile__mark {
    font-size: 10px;
  }
  .tile__price {
    font-size: 7px;
  }
  .pawn {
    width: 9px;
    height: 9px;
  }
  .board__logo {
    font-size: 14px;
  }
  .board__center {
    gap: 4px;
  }
}
</style>
