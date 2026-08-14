<script setup>
import { ref, computed } from 'vue'
import { TILES, VEHICLES, GROUPS, SHOPS, isPropertyTile, isBridge, isMetro, totalAssets, groupTiles } from '../game/index.js'

const props = defineProps({
  state: Object,
  current: Object,
  selectablePlayers: { type: Array, default: () => [] },
})
const emit = defineEmits(['playerClick'])

const expanded = ref(null) // 展开的玩家 id

const players = computed(() => props.state.players)

function statusOf(p) {
  if (p.bankrupt) return '破产'
  if (p.id === props.current?.id) return '行动中'
  if (p.jailLeft > 0) return `监狱 ${p.jailLeft}`
  if (p.skipTurns > 0) return '定住'
  if (p.hospital) return '住院'
  return ''
}

function toggle(p) {
  if (props.selectablePlayers.includes(p.id)) {
    emit('playerClick', p.id)
    return
  }
  expanded.value = expanded.value === p.id ? null : p.id
}

function landList(p) {
  return p.properties.map((i) => {
    const t = TILES[i]
    const lv = p.levels[i] ?? 0
    const tag = isBridge(t) ? '桥' : isMetro(t) ? '轻轨' : ''
    return { name: t.name, tag, shop: SHOPS[lv], lv }
  })
}

function groupsOf(p) {
  const own = {}
  for (const i of p.properties) {
    const g = TILES[i].group
    if (g && isPropertyTile(TILES[i])) {
      own[g] = (own[g] ?? 0) + 1
    }
  }
  return Object.entries(own).map(([g, n]) => ({
    name: GROUPS[g].name,
    n,
    total: groupTiles(g).length,
    done: n === groupTiles(g).length,
  }))
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
            'player--open': expanded === p.id,
          }"
          @click="toggle(p)"
        >
          <div class="player__row">
            <i class="player__dot" :style="{ background: p.color }">
              <em v-if="p.vehicle !== 'walk'" class="player__veh">{{ VEHICLES[p.vehicle].icon }}</em>
            </i>
            <span class="player__name">{{ p.name }}<em v-if="p.isAI">AI</em></span>
            <span class="player__status">{{ statusOf(p) }}</span>
            <span class="player__money" :class="{ 'player__money--debt': p.bankrupt && p.money < 0 }">
              {{ p.bankrupt && p.money < 0 ? '欠¥' + -p.money : '¥' + p.money }}
            </span>
            <span class="player__counts">
              <i class="cnt" title="卡片">🎴{{ p.hand.length }}</i>
              <i class="cnt" title="道具">📦{{ p.items.length }}</i>
              <i class="cnt" title="地产">🏠{{ p.properties.length }}</i>
            </span>
            <span class="player__arrow">{{ expanded === p.id ? '▲' : '▼' }}</span>
          </div>

          <!-- 展开详情 -->
          <div v-if="expanded === p.id" class="player__detail">
            <div class="pd__row">
              <span class="pd__label">总资产</span>
              <span class="pd__val">¥{{ totalAssets(p) }}</span>
            </div>
            <div class="pd__row">
              <span class="pd__label">载具</span>
              <span class="pd__val">{{ VEHICLES[p.vehicle].icon }} {{ VEHICLES[p.vehicle].name }}（{{ VEHICLES[p.vehicle].dice }} 骰）</span>
            </div>
            <div v-if="landList(p).length" class="pd__row">
              <span class="pd__label">地产</span>
              <span class="pd__val pd__lands">
                <span v-for="(l, i) in landList(p)" :key="i" class="pd__land">
                  {{ l.name }}<b v-if="l.tag" class="pd__tag">{{ l.tag }}</b>
                  <em v-if="l.lv > 0" class="pd__shop">{{ l.shop.icon }}{{ l.lv }}</em>
                </span>
              </span>
            </div>
            <div v-if="groupsOf(p).length" class="pd__row">
              <span class="pd__label">商圈</span>
              <span class="pd__val pd__groups">
                <span v-for="(g, i) in groupsOf(p)" :key="i" class="pd__group">
                  {{ g.name }} {{ g.n }}/{{ g.total }}
                  <b v-if="g.done" class="tag-comic tag-comic--red">×2</b>
                </span>
              </span>
            </div>
            <div class="pd__row">
              <span class="pd__label">手牌/道具</span>
              <span class="pd__val pd__bag">
                🎴{{ p.hand.map((c) => c.name).join('、') || '无' }}
                ｜ 📦{{ p.items.map((i) => i.name).join('、') || '无' }}
              </span>
            </div>
          </div>
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
  padding: 12px 14px;
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
  gap: 6px;
  margin-top: 8px;
}

.player {
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.player:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 0 var(--ink);
}

.player--sel {
  outline: 3px solid var(--pop-yellow);
  outline-offset: 1px;
  animation: pulse 0.9s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { outline-width: 3px; }
  50% { outline-width: 5px; }
}

.player--turn {
  background: #fff3c4;
  box-shadow: 2px 2px 0 0 var(--ink);
}

.player--dead {
  opacity: 0.45;
}

.player__row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
}

.player__dot {
  position: relative;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--ink);
  flex-shrink: 0;
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
  padding: 0 3px;
  margin-left: 3px;
}

.player__status {
  font-size: 9px;
  font-weight: 900;
  opacity: 0.6;
  flex-shrink: 0;
}

.player__money {
  font-size: 13px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  margin-left: auto;
  flex-shrink: 0;
}

.player__money--debt {
  color: var(--pop-red);
}

.player__counts {
  display: inline-flex;
  gap: 5px;
  font-size: 11px;
  font-weight: 900;
  flex-shrink: 0;
}

.cnt {
  font-style: normal;
  border: 1.5px solid var(--ink);
  border-radius: 5px;
  padding: 0 4px;
  background: #fffef0;
}

.player__arrow {
  font-size: 9px;
  opacity: 0.6;
}

.player__detail {
  border-top: 2px dashed var(--ink);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: #fffef0;
  border-radius: 0 0 6px 6px;
}

.pd__row {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.pd__label {
  width: 56px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 900;
  opacity: 0.6;
}

.pd__val {
  font-size: 12px;
  font-weight: 900;
}

.pd__lands {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.pd__land {
  white-space: nowrap;
}

.pd__tag {
  font-size: 9px;
  color: var(--pop-blue);
  margin-left: 2px;
}

.pd__shop {
  font-style: normal;
  font-size: 10px;
  color: var(--pop-red);
  margin-left: 2px;
}

.pd__groups {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.pd__group {
  white-space: nowrap;
}

.pd__bag {
  line-height: 1.5;
}

.log {
  list-style: none;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
  margin-top: 8px;
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
