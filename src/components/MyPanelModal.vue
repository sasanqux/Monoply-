<script setup>
import { computed } from 'vue'
import ComicIcon from './ComicIcon.vue'
import { TILES, GROUPS, SHOPS, isBridge, isMetro, isPropertyTile, upgradeCost, groupTiles } from '../game/index.js'

const props = defineProps({
  mode: String, // 'cards' | 'items' | 'lands' | 'other'
  me: Object,
  state: Object,
  isMyTurn: Boolean,
})
const emit = defineEmits(['close', 'useCard', 'useItem', 'upgrade', 'info'])

const titles = { cards: '我的手牌', items: '我的道具', lands: '我的地产', other: '其它' }
const titleIcons = { cards: 'card', items: 'box', lands: 'home', other: 'more' }
const title = computed(() => titles[props.mode] ?? '')
const titleIcon = computed(() => titleIcons[props.mode] ?? 'more')

// 地产列表（含商圈/店铺信息）
const lands = computed(() => {
  if (!props.me) return []
  return props.me.properties.map((id) => {
    const t = TILES[id]
    const lv = props.me.levels[id] ?? 0
    const group = t.group
      ? { name: GROUPS[t.group].name, n: groupTiles(t.group).filter((g) => props.me.properties.includes(g.id)).length, total: groupTiles(t.group).length }
      : null
    return {
      id,
      name: t.name,
      tag: isBridge(t) ? '桥' : isMetro(t) ? '轻轨' : '',
      lv,
      shop: SHOPS[lv],
      canUp: props.isMyTurn && isPropertyTile(t) && !(t.type === 'metro' && !t.upgradable) && lv < 3 && props.me.money >= upgradeCost(t),
      group,
    }
  })
})
</script>

<template>
  <div class="overlay-layer" @click.self="emit('close')">
    <div class="card-comic card-comic--pad-lg modal">
      <div class="modal__head">
        <h3 class="comic-title comic-title--md"><ComicIcon :name="titleIcon" :size="20" /> {{ title }}</h3>
        <button class="modal__close" @click="emit('close')" aria-label="关闭">✕</button>
      </div>

      <!-- 卡牌 -->
      <div v-if="mode === 'cards'" class="modal__body">
        <div v-if="me.hand.length" class="grid">
          <button
            v-for="c in me.hand"
            :key="c.id"
            class="cell"
            :disabled="!isMyTurn"
            :title="c.desc"
            @click="emit('useCard', c)"
          >
            <span class="cell__icon"><ComicIcon :name="c.icon" :size="26" /></span>
            <span class="cell__name">{{ c.name }}</span>
            <span class="cell__desc">{{ c.desc }}</span>
          </button>
        </div>
        <p v-else class="empty">暂无卡片，踩中山城奇遇抽卡</p>
        <p v-if="me.hand.length && !isMyTurn" class="hint">轮到你再使用</p>
      </div>

      <!-- 道具 -->
      <div v-else-if="mode === 'items'" class="modal__body">
        <div v-if="me.items.length" class="grid">
          <button
            v-for="it in me.items"
            :key="it.id"
            class="cell"
            :disabled="!isMyTurn"
            :title="it.desc"
            @click="emit('useItem', it)"
          >
            <span class="cell__icon"><ComicIcon :name="it.icon" :size="26" /></span>
            <span class="cell__name">{{ it.name }}</span>
            <span class="cell__desc">{{ it.desc }}</span>
          </button>
        </div>
        <p v-else class="empty">暂无道具，踩中山城奇遇捡</p>
        <p v-if="me.items.length && !isMyTurn" class="hint">轮到你再使用</p>
      </div>

      <!-- 地产 -->
      <div v-else-if="mode === 'lands'" class="modal__body">
        <div v-if="lands.length" class="lands">
          <button v-for="l in lands" :key="l.id" class="land-row" @click="emit('info', l.id)">
            <span class="land-row__name">{{ l.name }}</span>
            <b v-if="l.tag" class="tag-comic tag-comic--blue">{{ l.tag }}</b>
            <span class="land-row__shop"><ComicIcon v-if="l.shop.icon" :name="l.shop.icon" :size="15" /> {{ l.shop.name }}<em v-if="l.lv">·{{ l.lv }}级</em></span>
            <span v-if="l.group" class="land-row__group">{{ l.group.name }} {{ l.group.n }}/{{ l.group.total }}</span>
            <span class="land-row__go">详情›</span>
          </button>
        </div>
        <p v-else class="empty">还没有地产，踩到无主地记得买</p>
      </div>

      <!-- 其它（预留） -->
      <div v-else class="modal__body">
        <p class="empty"><ComicIcon name="more" :size="16" /> 更多玩法建设中，敬请期待</p>
        <p class="hint">这里会放以后新增的玩法入口（神仙/彩票/股票…）</p>
      </div>

      <div class="modal__foot">
        <button class="btn-comic btn-comic--sm btn-comic--ghost" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay-layer {
  position: fixed;
  inset: 0;
  background: rgba(26, 26, 26, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 70;
  padding: 16px;
}

.modal {
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 3px solid var(--ink);
}

.modal__close {
  width: 30px;
  height: 30px;
  border: 3px solid var(--ink);
  border-radius: 8px;
  background: #fff;
  font-weight: 900;
  font-size: 14px;
  cursor: pointer;
  line-height: 1;
}

.modal__close:hover {
  background: var(--pop-red);
  color: #fff;
}

.modal__body {
  min-height: 120px;
  max-height: 46vh;
  overflow-y: auto;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 118px;
  padding: 10px 8px;
  border: 3px solid var(--ink);
  border-radius: 8px;
  background: #fff;
  box-shadow: 3px 3px 0 0 var(--ink);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.cell:hover:not(:disabled) {
  transform: translate(-2px, -2px);
  box-shadow: 5px 5px 0 0 var(--ink);
}

.cell__icon {
  font-size: 22px;
  line-height: 1;
}

.cell__name {
  font-size: 13px;
  font-weight: 900;
}

.cell__desc {
  font-size: 10.5px;
  font-weight: 900;
  opacity: 0.6;
  text-align: center;
}

.lands {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.land-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: transform 0.12s ease;
}

.land-row:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 0 var(--ink);
}

.land-row__name {
  font-size: 13px;
  font-weight: 900;
}

.land-row__shop {
  font-size: 12px;
  font-weight: 900;
  color: var(--pop-red);
}

.land-row__shop em {
  font-style: normal;
  font-size: 10px;
}

.land-row__group {
  font-size: 10.5px;
  font-weight: 900;
  opacity: 0.6;
}

.land-row__go {
  margin-left: auto;
  font-size: 11px;
  font-weight: 900;
  opacity: 0.6;
}

.empty {
  font-size: 13px;
  font-weight: 900;
  opacity: 0.55;
}

.hint {
  font-size: 11.5px;
  font-weight: 900;
  opacity: 0.5;
  margin-top: 8px;
}

.modal__foot {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 3px solid var(--ink);
}
</style>
