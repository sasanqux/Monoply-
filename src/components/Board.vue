<script setup>
import { computed } from 'vue'
import { TILES, GROUPS, isPropertyTile } from '../game/index.js'

const props = defineProps({
  state: Object,
  current: Object,
})
const emit = defineEmits(['upgrade'])

// 24 格顺时针铺在 7×7 外圈（row, col）
const SLOT = {
  0: [0, 0], 1: [0, 1], 2: [0, 2], 3: [0, 3], 4: [0, 4], 5: [0, 5], 6: [0, 6],
  7: [1, 6], 8: [2, 6], 9: [3, 6], 10: [4, 6], 11: [5, 6], 12: [6, 6],
  13: [6, 5], 14: [6, 4], 15: [6, 3], 16: [6, 2], 17: [6, 1], 18: [6, 0],
  19: [5, 0], 20: [4, 0], 21: [3, 0], 22: [2, 0], 23: [1, 0],
}

const cells = TILES.map((tile, id) => ({ tile, id, rc: SLOT[id] }))

function tileBg(tile) {
  if (tile.type === 'start') return 'var(--red)'
  if (isPropertyTile(tile)) return GROUPS[tile.group].color
  if (tile.type === 'tax') return 'var(--black)'
  if (tile.type === 'jail' || tile.type === 'hospital') return 'var(--gray-700)'
  return 'var(--white)' // event
}

function tileColor(tile) {
  if (tile.type === 'event') return 'var(--black)'
  return 'var(--white)'
}

function tileBorder(tile) {
  return tile.type === 'event' ? '2px solid var(--black)' : 'none'
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

// 我的地且可升级 → 可点击盖楼
function upgradable(id) {
  const p = props.current
  if (!p || p.isAI) return false
  if (!p.properties.includes(id)) return false
  const level = p.levels[id] ?? 0
  if (level >= 3) return false
  return true
}

const diceText = computed(() => {
  if (!props.state.dice) return '—'
  return `${props.state.dice[0]} ${props.state.dice[1]}`
})
</script>

<template>
  <div class="board">
    <div
      v-for="cell in cells"
      :key="cell.id"
      class="tile"
      :class="{ 'tile--click': upgradable(cell.id) }"
      :style="{
        gridColumn: cell.rc[1] + 1,
        gridRow: cell.rc[0] + 1,
        background: tileBg(cell.tile),
        color: tileColor(cell.tile),
        border: tileBorder(cell.tile),
      }"
      :title="cell.tile.name + (ownerOf(cell.id) ? ' · 拥有者 ' + ownerOf(cell.id).name : '')"
      @click="upgradable(cell.id) && emit('upgrade', cell.id)"
    >
      <span v-if="cell.tile.type === 'event'" class="tile__q">?</span>
      <span v-else-if="cell.tile.type === 'jail'" class="tile__q">🚔</span>
      <span v-else-if="cell.tile.type === 'hospital'" class="tile__q">🏥</span>
      <span v-else-if="cell.tile.type === 'start'" class="tile__q">GO</span>
      <span v-else-if="cell.tile.type === 'tax'" class="tile__q">税</span>
      <span v-else-if="isPropertyTile(cell.tile)" class="tile__q">{{ cell.tile.type === 'street' ? '街' : cell.tile.type === 'plaza' ? '圈' : '楼' }}</span>

      <span class="tile__name">{{ cell.tile.name }}</span>
      <span v-if="isPropertyTile(cell.tile)" class="tile__price">¥{{ cell.tile.price }}</span>

      <span v-if="isPropertyTile(cell.tile) && ownerOf(cell.id)" class="tile__lv">
        <i v-for="n in 3" :key="n" :class="{ on: n <= levelOf(cell.id) }"></i>
      </span>

      <span class="tile__pawns">
        <i v-for="p in playersOn(cell.id)" :key="p.id" class="pawn" :style="{ background: p.color }"></i>
      </span>
    </div>

    <div class="board__center">
      <div class="board__logo">都市大富翁</div>
      <div class="board__info">
        <span class="board__turn">第 {{ state.round }} 回合</span>
        <span class="board__who">轮到你：<b>{{ current ? current.name : '—' }}</b></span>
        <span class="board__dice">🎲 {{ diceText }}</span>
      </div>
      <div class="board__hint">点击自己的地 → 盖楼升级</div>
    </div>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(7, 1fr);
  gap: 3px;
  width: 100%;
  max-width: 620px;
  margin: 0 auto;
  background: var(--grid);
  padding: 3px;
  border: 2px solid var(--black);
  aspect-ratio: 1;
}

.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-width: 0;
  overflow: hidden;
  padding: 2px;
  user-select: none;
}

.tile--click {
  cursor: pointer;
  outline: 2px solid var(--red);
  outline-offset: -2px;
}

.tile__q {
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
}

.tile__name {
  font-size: 11px;
  line-height: 1.1;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.tile__price {
  font-size: 10px;
  opacity: 0.9;
}

.tile__lv {
  display: flex;
  gap: 2px;
  position: absolute;
  top: 2px;
  right: 3px;
}

.tile__lv i {
  width: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.35);
}

.tile__lv i.on {
  background: var(--white);
}

.tile__pawns {
  position: absolute;
  bottom: 2px;
  left: 2px;
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.pawn {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid var(--white);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
}

.board__center {
  grid-column: 2 / 7;
  grid-row: 2 / 7;
  background: var(--white);
  border: 2px solid var(--black);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  padding: var(--space-2);
}

.board__logo {
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 0.1em;
  border-bottom: 4px solid var(--red);
  padding-bottom: 4px;
}

.board__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--gray-700);
}

.board__who b {
  color: var(--red);
  font-weight: 500;
}

.board__dice {
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.2em;
}

.board__hint {
  font-size: 11px;
  color: var(--gray-500);
}

@media (max-width: 480px) {
  .tile__name {
    font-size: 9px;
  }
  .tile__price {
    font-size: 8px;
  }
  .tile__q {
    font-size: 10px;
  }
  .board__logo {
    font-size: 16px;
  }
}
</style>
