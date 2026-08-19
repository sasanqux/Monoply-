<script setup>
import { computed, ref } from 'vue'
import ComicIcon from './ComicIcon.vue'
import {
  TILES, GROUPS, SHOPS, isPropertyTile, isMetro,
  getRent, isGroupComplete, groupTiles, groupRequired, upgradeCost,
  METRO_FEE,
} from '../game/index.js'

const props = defineProps({
  state: Object,
  tileId: Number,
})
const emit = defineEmits(['close', 'upgrade', 'metro'])

const tile = computed(() => TILES[props.tileId])

const typeTag = computed(() => {
  const t = tile.value
  switch (t.type) {
    case 'start': return { text: '起点', cls: 'tag-comic--red' }
    case 'land': return t.group ? { text: GROUPS[t.group].name, cls: 'tag-comic--ink' } : { text: '普通地产', cls: 'tag-comic--yellow' }
    case 'scenic': return { text: '景点', cls: 'tag-comic--green' }
    case 'station': return { text: '轻轨站', cls: 'tag-comic--yellow' }
    case 'mall': return { text: '商圈', cls: 'tag-comic--purple' }
    case 'chance': return { text: '事件', cls: 'tag-comic--green' }
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
    need: groupRequired(t.group),
    complete: isGroupComplete(props.state, t.group),
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
  if (t.type !== 'chance') return null
  return '随机事件：抽卡、丢载具、发笔小财'
})

const canUpgrade = computed(() => {
  const t = tile.value
  if (!isPropertyTile(t) || !owner.value) return false
  if (owner.value.id !== props.state.players[props.state.turnIndex].id) return false
  if (props.state.players[props.state.turnIndex].isAI) return false
  if (isMetro(t) && !t.upgradable) return false
  return level.value < 3
})

// 乘轻轨：当前玩家是否正站在这格（是 → 可乘）
const meOnStation = computed(() => {
  if (!isMetro(tile.value)) return false
  const cur = props.state.players[props.state.turnIndex]
  return !!cur && cur.pos === props.tileId
})
const hint = ref('')
let hintTimer = null
function onMetroClick() {
  if (meOnStation.value) {
    emit('metro')
    return
  }
  hint.value = '目前不在轻轨地块，无法乘坐'
  clearTimeout(hintTimer)
  hintTimer = setTimeout(() => { hint.value = '' }, 2200)
}
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
        <span v-else-if="isPropertyTile(tile) || isMetro(tile)" class="info__muted">无主 · 可购买</span>
        <span v-else class="info__muted">—</span>
      </div>

      <!-- 地产：价值/积分/租金/等级/开店 -->
      <template v-if="isPropertyTile(tile)">
        <div class="info__row">
          <span class="info__label">地块价值</span>
          <span class="info__val">¥{{ tile.price }}</span>
        </div>
        <div v-if="tile.points" class="info__row">
          <span class="info__label">卡片积分</span>
          <span class="info__val info__val--pts">{{ tile.points }} 分</span>
        </div>
        <div class="info__row">
          <span class="info__label">基础租金</span>
          <span class="info__val">¥{{ baseRent }}</span>
        </div>
        <div v-if="owner" class="info__row">
          <span class="info__label">当前租金</span>
          <span class="info__val info__val--hot">¥{{ currentRent }}</span>
          <span v-if="level > 0" class="info__hint">（等级 {{ level }}）</span>
          <span v-else class="info__hint">（空地）</span>
        </div>
        <div v-if="owner" class="info__row">
          <span class="info__label">店铺</span>
          <span class="info__val">
            {{ SHOPS[level].name }}
            <span v-if="level < 3" class="info__hint">→ 升级费 ¥{{ upgradeCost(tile) }}</span>
          </span>
        </div>
      </template>

      <!-- 商圈组合 -->
      <div v-if="groupInfo" class="info__row">
        <span class="info__label">组合</span>
        <span class="info__val">
          {{ groupInfo.name }}
          <span class="info__hint">（本组已收 {{ groupInfo.owned }}/{{ groupInfo.total }} 块，达成需 {{ groupInfo.need }} 块）</span>
          <span v-if="groupInfo.complete" class="tag-comic tag-comic--red">达成 · 租金×1.5</span>
          <span v-else class="info__hint">达成后本组租金 ×1.5</span>
        </span>
      </div>

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
        <div class="info__row info__row--metro">
          <button class="btn-comic btn-comic--sm btn-comic--blue" @click="onMetroClick">
            <ComicIcon name="metro" :size="14" /> 乘轻轨
          </button>
          <span v-if="hint" class="info__hint info__hint--warn">{{ hint }}</span>
        </div>
        <p v-if="metroInfo.upgradable" class="info__tip"><ComicIcon name="metro" :size="13" /> 李子坝 = 轻轨站 + 地标地产，可开店升级</p>
      </template>

      <!-- 事件 / 起点 -->
      <p v-if="eventDesc" class="info__tip"><ComicIcon name="dice" :size="13" /> {{ eventDesc }}</p>
      <p v-if="tile.type === 'start'" class="info__tip"><ComicIcon name="flag" :size="13" /> 到达朝天门打卡，累计满 3 次领取大礼包（¥5000 + 3 张随机卡 + 免费传送）</p>

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
  max-height: calc(100vh - 60px);
  overflow-y: auto;
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
.info__val--pts {
  color: #d97706;
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

.info__hint--warn {
  opacity: 1;
  color: var(--pop-red);
  font-weight: 900;
  background: #fff0f0;
  border: 2px solid var(--pop-red);
  border-radius: 6px;
  padding: 3px 8px;
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
