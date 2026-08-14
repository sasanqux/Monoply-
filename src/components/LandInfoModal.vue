<script setup>
import { computed } from 'vue'
import ComicIcon from './ComicIcon.vue'
import {
  TILES, GROUPS, SHOPS, isPropertyTile, isBridge, isMetro,
  getRent, isGroupComplete, groupTiles, upgradeCost,
  tollOf, METRO_FEE,
} from '../game/index.js'

const props = defineProps({
  state: Object,
  tileId: Number,
})
const emit = defineEmits(['close', 'upgrade'])

const tile = computed(() => TILES[props.tileId])

const typeTag = computed(() => {
  const t = tile.value
  switch (t.type) {
    case 'start': return { text: '起点', cls: 'tag-comic--red' }
    case 'land': return t.group ? { text: GROUPS[t.group].name, cls: 'tag-comic--ink' } : { text: '普通地产', cls: 'tag-comic--yellow' }
    case 'bridge': return { text: '桥梁', cls: 'tag-comic--blue' }
    case 'metro': return { text: '轻轨站', cls: 'tag-comic--yellow' }
    case 'event': return { text: t.id === 42 ? '火锅事件' : '事件', cls: 'tag-comic--green' }
    default: return { text: t.type, cls: 'tag-comic--ink' }
  }
})

const owner = computed(() => props.state.players.find((p) => p.alive && p.properties.includes(props.tileId)))

const level = computed(() => {
  const o = owner.value
  return o ? o.levels[props.tileId] ?? 0 : 0
})

const currentRent = computed(() => {
  if (!isPropertyTile(tile.value)) return null
  return getRent(props.state, tile.value, level.value)
})

const baseRent = computed(() => tile.value.rent ?? null)

const groupInfo = computed(() => {
  const t = tile.value
  if (!t.group) return null
  const tiles = groupTiles(t.group)
  const owned = owner.value
    ? tiles.filter((g) => owner.value.properties.includes(g.id)).length
    : tiles.filter((g) => props.state.players.some((p) => p.alive && p.properties.includes(g.id))).length
  return {
    name: GROUPS[t.group].name,
    owned,
    total: tiles.length,
    complete: isGroupComplete(props.state, t.group),
  }
})

const bridgeInfo = computed(() => {
  const t = tile.value
  if (!isBridge(t)) return null
  const o = owner.value
  const bridgeCount = o ? o.properties.filter((i) => isBridge(TILES[i])).length : 0
  const rate = 1 + Math.max(0, bridgeCount - 1) * 0.4
  return {
    toll: t.toll,
    rate,
    closed: (props.state.closedBridges[t.id] ?? 0) > 0,
    bridgeCount,
  }
})

const metroInfo = computed(() => {
  const t = tile.value
  if (!isMetro(t)) return null
  return {
    fee: METRO_FEE,
    upgradable: !!t.upgradable,
  }
})

const eventDesc = computed(() => {
  const t = tile.value
  if (t.type !== 'event') return null
  return t.id === 42 ? '吃火锅：可能破财、可能赚代言费' : '随机事件：抽卡、捡道具、丢载具、发笔小财'
})

const canUpgrade = computed(() => {
  const t = tile.value
  if (!isPropertyTile(t) || !owner.value) return false
  if (owner.value.id !== props.state.players[props.state.turnIndex].id) return false
  if (props.state.players[props.state.turnIndex].isAI) return false
  if (t.type === 'metro' && !t.upgradable) return false
  return level.value < 3
})
</script>

<template>
  <div class="overlay-layer" @click.self="emit('close')">
    <div class="card-comic card-comic--pad-lg info">
      <div class="info__head">
        <h3 class="comic-title comic-title--md">{{ tile.name }}</h3>
        <span class="tag-comic" :class="typeTag.cls">{{ typeTag.text }}</span>
        <span v-if="tile.sub" class="info__sub">{{ tile.sub }}</span>
        <button class="info__close" @click="emit('close')" aria-label="关闭">✕</button>
      </div>

      <!-- 归属与等级 -->
      <div class="info__row">
        <span class="info__label">归属</span>
        <span v-if="owner" class="info__owner">
          <i class="info__dot" :style="{ background: owner.color }"></i>{{ owner.name }}
        </span>
        <span v-else-if="isPropertyTile(tile) || isBridge(tile) || isMetro(tile)" class="info__muted">无主 · 可购买</span>
        <span v-else class="info__muted">—</span>
      </div>

      <!-- 地产：价值/租金/等级/开店 -->
      <template v-if="isPropertyTile(tile)">
        <div class="info__row">
          <span class="info__label">地块价值</span>
          <span class="info__val">¥{{ tile.price }}</span>
        </div>
        <div class="info__row">
          <span class="info__label">基础租金</span>
          <span class="info__val">¥{{ baseRent }}</span>
        </div>
        <div v-if="owner" class="info__row">
          <span class="info__label">当前租金</span>
          <span class="info__val info__val--hot">¥{{ currentRent }}</span>
          <span v-if="level > 0" class="info__hint">（<ComicIcon :name="SHOPS[level].icon" :size="13" /> 等级 {{ level }}）</span>
          <span v-else class="info__hint">（空地）</span>
        </div>
        <div v-if="owner" class="info__row">
          <span class="info__label">店铺</span>
          <span class="info__val">
            <ComicIcon v-if="SHOPS[level].icon" :name="SHOPS[level].icon" :size="15" /> {{ SHOPS[level].name }}
            <span v-if="level < 3" class="info__hint">→ <ComicIcon :name="SHOPS[level + 1].icon" :size="13" /> 升级费 ¥{{ upgradeCost(tile) }}</span>
          </span>
        </div>
      </template>

      <!-- 商圈 -->
      <div v-if="groupInfo" class="info__row">
        <span class="info__label">商圈</span>
        <span class="info__val">
          {{ groupInfo.name }}
          <span class="info__hint">（本组 {{ groupInfo.owned }}/{{ groupInfo.total }} 块）</span>
          <span v-if="groupInfo.complete" class="tag-comic tag-comic--red">集齐 · 租金×2</span>
          <span v-else class="info__hint">集齐全组租金翻倍</span>
        </span>
      </div>

      <!-- 桥 -->
      <template v-if="bridgeInfo">
        <div class="info__row">
          <span class="info__label">过路费</span>
          <span class="info__val">¥{{ bridgeInfo.toll }}</span>
          <span v-if="bridgeInfo.bridgeCount > 1" class="info__hint">（拥有 {{ bridgeInfo.bridgeCount }} 座桥，费率 ×{{ bridgeInfo.rate.toFixed(1) }}）</span>
        </div>
        <div class="info__row">
          <span class="info__label">状态</span>
          <span class="info__val">{{ bridgeInfo.closed ? '封桥中' : '通行中' }}<ComicIcon v-if="bridgeInfo.closed" name="closed" :size="14" /></span>
        </div>
        <p class="info__tip"><ComicIcon name="wave" :size="13" /> 过江唯一通道：未在桥格跨江会被江水拦住，点数作废</p>
      </template>

      <!-- 轻轨 -->
      <template v-if="metroInfo">
        <div class="info__row">
          <span class="info__label">乘轻轨</span>
          <span class="info__val">¥{{ metroInfo.fee }} 前往任意其他轻轨站</span>
        </div>
        <div class="info__row">
          <span class="info__label">使用费</span>
          <span class="info__val">¥{{ tile.rent }}（他人使用支付）</span>
        </div>
        <p v-if="metroInfo.upgradable" class="info__tip"><ComicIcon name="metro" :size="13" /> 李子坝 = 轻轨站 + 地标地产，可开店升级</p>
      </template>

      <!-- 事件 / 起点 -->
      <p v-if="eventDesc" class="info__tip"><ComicIcon name="dice" :size="13" /> {{ eventDesc }}</p>
      <p v-if="tile.type === 'start'" class="info__tip"><ComicIcon name="flag" :size="13" /> 每绕城一圈经过解放碑，领取工资 ¥300</p>

      <div class="info__btns">
        <button v-if="canUpgrade" class="btn-comic btn-comic--sm" @click="emit('upgrade', tile.id)">
          <ComicIcon name="hammer" :size="15" /> 升级（¥{{ upgradeCost(tile) }}）
        </button>
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

.info {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info__head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 8px;
  border-bottom: 3px solid var(--ink);
}

.info__sub {
  font-size: 11px;
  font-weight: 900;
  opacity: 0.6;
}

.info__close {
  margin-left: auto;
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

.info__close:hover {
  background: var(--pop-red);
  color: #fff;
}

.info__row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.info__label {
  width: 64px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 900;
  opacity: 0.65;
}

.info__val {
  font-size: 14px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.info__val--hot {
  color: var(--pop-red);
}

.info__muted {
  font-size: 13px;
  font-weight: 900;
  opacity: 0.5;
}

.info__owner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 900;
}

.info__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--ink);
}

.info__hint {
  font-size: 11px;
  font-weight: 900;
  opacity: 0.6;
}

.info__tip {
  font-size: 11.5px;
  font-weight: 900;
  opacity: 0.7;
  background: #fff3c4;
  border: 2px solid var(--ink);
  border-radius: 8px;
  padding: 6px 10px;
  margin-top: 4px;
}

.info__btns {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 3px solid var(--ink);
}
</style>
