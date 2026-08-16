<script setup>
import { ref, computed } from 'vue'
import ComicIcon from './ComicIcon.vue'
import { TILES, GROUPS, groupTiles, isPropertyTile } from '../game/index.js'

const props = defineProps({
  state: Object,
  me: Object,
  targetPlayerId: String,
})
const emit = defineEmits(['close', 'offer'])

const target = computed(() => props.state.players.find((p) => p.id === props.targetPlayerId))

// 我给出的
const myOfferLands = ref([])
const myOfferMoney = ref(0)
const myOfferCards = ref([])

// 我要得到的
const myRequestLands = ref([])
const myRequestMoney = ref(0)

function toggleLand(arr, id) {
  const i = arr.indexOf(id)
  if (i === -1) arr.push(id)
  else arr.splice(i, 1)
}

function tileName(id) { return TILES[id]?.name ?? '?' }

const myLands = computed(() => props.me?.properties.map((id) => ({
  id, name: TILES[id]?.name, price: TILES[id]?.price, group: TILES[id]?.group,
  groupName: TILES[id]?.group ? GROUPS[TILES[id].group]?.name : '',
})).sort((a, b) => a.group && !b.group ? -1 : !a.group && b.group ? 1 : 0) ?? [])

const targetLands = computed(() => {
  if (!target.value) return []
  return target.value.properties.map((id) => ({
    id, name: TILES[id]?.name, price: TILES[id]?.price, group: TILES[id]?.group,
    groupName: TILES[id]?.group ? GROUPS[TILES[id].group]?.name : '',
  }))
})

const offerValue = computed(() => {
  let v = myOfferMoney.value
  for (const id of myOfferLands.value) v += TILES[id]?.price ?? 0
  return v
})

const requestValue = computed(() => {
  let v = myRequestMoney.value
  for (const id of myRequestLands.value) v += TILES[id]?.price ?? 0
  return v
})

function sendOffer() {
  emit('offer', {
    targetPlayerId: props.targetPlayerId,
    offer: { lands: [...myOfferLands.value], money: myOfferMoney.value, cards: [] },
    request: { lands: [...myRequestLands.value], money: myRequestMoney.value, cards: [] },
  })
}
</script>

<template>
  <div class="overlay-layer" @click.self="emit('close')">
    <div class="card-comic trade-card">
      <button class="fork-card__close" @click="emit('close')" aria-label="关闭">✕</button>
      <div class="fork-card__dice">🤝</div>
      <h3 class="comic-title comic-title--md">与 {{ target?.name }} 交易</h3>

      <div class="trade-grid">
        <!-- 我给出 -->
        <div class="trade-col">
          <div class="trade-col__head">
            <span class="trade-col__title">📤 我给出</span>
            <span class="trade-col__val" :class="{ 'trade-col__val--warn': offerValue < requestValue }">估值 ¥{{ offerValue }}</span>
          </div>
          <div class="trade-section">
            <label class="trade-label">地产</label>
            <div v-if="myLands.length" class="trade-lands">
              <button
                v-for="l in myLands"
                :key="'m-' + l.id"
                class="trade-land"
                :class="{ 'trade-land--on': myOfferLands.includes(l.id) }"
                @click="toggleLand(myOfferLands, l.id)"
              >
                <span class="trade-land__name">{{ l.name }}</span>
                <span class="trade-land__price">¥{{ l.price }}</span>
              </button>
            </div>
            <p v-else class="trade-empty">没有地产</p>
          </div>
          <div class="trade-section">
            <label class="trade-label">现金</label>
            <div class="trade-money-row">
              <input v-model.number="myOfferMoney" class="input-comic input-comic--sm" type="number" min="0" :max="me.money" step="100" />
              <span class="trade-money-max">/ ¥{{ me.money }}</span>
            </div>
          </div>
        </div>

        <!-- 我要得到 -->
        <div class="trade-col">
          <div class="trade-col__head">
            <span class="trade-col__title">📥 我要得到</span>
            <span class="trade-col__val">估值 ¥{{ requestValue }}</span>
          </div>
          <div class="trade-section">
            <label class="trade-label">地产</label>
            <div v-if="targetLands.length" class="trade-lands">
              <button
                v-for="l in targetLands"
                :key="'t-' + l.id"
                class="trade-land"
                :class="{ 'trade-land--on': myRequestLands.includes(l.id) }"
                @click="toggleLand(myRequestLands, l.id)"
              >
                <span class="trade-land__name">{{ l.name }}</span>
                <span class="trade-land__price">¥{{ l.price }}</span>
              </button>
            </div>
            <p v-else class="trade-empty">对方没有地产</p>
          </div>
          <div class="trade-section">
            <label class="trade-label">现金</label>
            <div class="trade-money-row">
              <input v-model.number="myRequestMoney" class="input-comic input-comic--sm" type="number" min="0" :max="target?.money ?? 0" step="100" />
              <span class="trade-money-max">/ ¥{{ target?.money ?? 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 差额提示 -->
      <div v-if="offerValue !== requestValue" class="trade-diff" :class="offerValue > requestValue ? 'trade-diff--give' : 'trade-diff--get'">
        {{ offerValue > requestValue ? `你在交易中多付出 ¥${offerValue - requestValue}` : `你在交易中净得 ¥${requestValue - offerValue}` }}
      </div>
      <div v-else-if="offerValue > 0" class="trade-diff trade-diff--even">
        ⚖️ 等价交换
      </div>

      <div class="trade-actions">
        <button class="btn-comic btn-comic--ghost" @click="emit('close')">取消</button>
        <button class="btn-comic" :disabled="offerValue === 0 && requestValue === 0" @click="sendOffer">发送提案</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trade-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 680px;
  width: 100%;
  border-width: 4px;
  box-shadow: 7px 7px 0 0 var(--ink);
  max-height: 85vh;
  overflow-y: auto;
}

.trade-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 600px) {
  .trade-grid { grid-template-columns: 1fr; }
}

.trade-col {
  border: 2.5px solid var(--ink);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fff;
}

.trade-col__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.trade-col__title {
  font-size: 14px;
  font-weight: 900;
}

.trade-col__val {
  font-size: 12px;
  font-weight: 900;
  color: var(--pop-blue);
}

.trade-col__val--warn {
  color: var(--pop-red);
}

.trade-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trade-label {
  font-size: 11px;
  font-weight: 900;
  opacity: 0.6;
}

.trade-lands {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 150px;
  overflow-y: auto;
}

.trade-land {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 8px;
  border: 2px solid var(--ink);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.1s;
}

.trade-land:hover { background: #fffef0; }

.trade-land--on {
  background: #dbeafe;
  border-color: #3b82f6;
  box-shadow: 2px 2px 0 0 #3b82f6;
}

.trade-land__name {
  font-size: 12px;
  font-weight: 900;
}

.trade-land__price {
  font-size: 10px;
  font-weight: 900;
  opacity: 0.5;
}

.trade-empty {
  font-size: 11px;
  font-weight: 700;
  opacity: 0.4;
  font-style: italic;
}

.trade-money-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.trade-money-max {
  font-size: 10px;
  font-weight: 900;
  opacity: 0.4;
}

.trade-diff {
  text-align: center;
  font-size: 12px;
  font-weight: 900;
  padding: 5px 10px;
  border-radius: 6px;
  border: 2px solid var(--ink);
}

.trade-diff--give {
  background: #fef2f2;
  color: #dc2626;
}

.trade-diff--get {
  background: #f0fdf4;
  color: #16a34a;
}

.trade-diff--even {
  background: #fffef0;
}

.trade-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}
</style>
