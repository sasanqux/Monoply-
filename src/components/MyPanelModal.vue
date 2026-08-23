<script setup>
import { computed, ref } from 'vue'
import ComicIcon from './ComicIcon.vue'
import { TILES, GROUPS, SHOPS, STOCKS, stockPortfolioValue, isBridge, isMetro, isPropertyTile, upgradeCost, groupTiles, canMortgage, canUnmortgage } from '../game/index.js'

const props = defineProps({
  mode: String, // 'cards' | 'lands' | 'other'
  me: Object,
  state: Object,
  isMyTurn: Boolean,
})
const emit = defineEmits(['close', 'useCard', 'upgrade', 'info', 'stockBuy', 'stockSell', 'dispatch'])

// 悬停浮层：记录当前悬停的卡片 + 鼠标位置（fixed 跟随，不被滚动容器裁剪）
const hovered = ref(null) // { item, x, y }
function onHover(item, e) {
  hovered.value = { item, x: e.clientX, y: e.clientY }
}
function onMove(e) {
  if (hovered.value) hovered.value.x = e.clientX
  if (hovered.value) hovered.value.y = e.clientY
}
function offHover() {
  hovered.value = null
}

const titles = { cards: '我的手牌', lands: '我的地产', stocks: '股票市场', other: '其它' }
const titleIcons = { cards: 'card', lands: 'home', stocks: 'stock', other: 'more' }
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
    const mortgaged = props.me.mortgaged?.[id] || false
    return {
      id,
      name: t.name,
      tag: isBridge(t) ? '桥' : isMetro(t) ? '轻轨' : '',
      lv,
      shop: SHOPS[lv],
      value: t.price + Math.round(t.price * 0.5 * lv),
      canUp: props.isMyTurn && isPropertyTile(t) && !(isMetro(t) && !t.upgradable) && lv < 3 && props.me.money >= upgradeCost(t),
      group,
      mortgaged,
      canMortgage: !mortgaged && canMortgage(props.me, id),
      canUnmortgage: mortgaged && canUnmortgage(props.me, id),
      mortgageAmount: Math.round(t.price * 0.5),
      redeemCost: Math.round(t.price * 0.5 * 1.1),
    }
  })
})

// 地产总价值 = 所有地块地价 + 升级投入（抵押地按50%估值）
const totalValue = computed(() => {
  if (!props.me) return 0
  let total = 0
  for (const id of props.me.properties) {
    const t = TILES[id]
    if (!t) continue
    const lv = props.me.levels[id] ?? 0
    const mortgaged = props.me.mortgaged?.[id]
    total += mortgaged ? Math.round(t.price * 0.5) : t.price + Math.round(t.price * 0.5 * lv)
  }
  return total
})

function mortgage(id) {
  emit('dispatch', { type: 'MORTGAGE', tileId: id })
}
function unmortgage(id) {
  emit('dispatch', { type: 'UNMORTGAGE', tileId: id })
}

// 股票面板数据
const selectedStock = ref(null)
const stockShares = ref(10)
const stockList = computed(() => {
  return Object.values(STOCKS).map(s => {
    const rt = props.state.stockRuntime[s.code]
    const holdings = props.me?.stockHoldings?.[s.code] || 0
    const change = rt && rt.prev ? ((rt.current - rt.prev) / rt.prev * 100) : 0
    return { ...s, current: rt?.current ?? s.price, prev: rt?.prev ?? s.price, change, holdings, events: rt?.activeEvents || [] }
  })
})
const stockPortfolio = computed(() => stockPortfolioValue(props.me, props.state.stockRuntime))
const heldStockCount = computed(() => Object.keys(props.me?.stockHoldings || {}).filter(c => props.me.stockHoldings[c] > 0).length)
const canBuyStock = computed(() => {
  if (!selectedStock.value) return false
  const price = props.state.stockRuntime[selectedStock.value].current
  const cost = price * stockShares.value + Math.max(1, Math.floor(price * stockShares.value * 0.01))
  const alreadyHeld = (props.me?.stockHoldings?.[selectedStock.value] || 0) > 0
  const underLimit = alreadyHeld || heldStockCount.value < 5
  return props.me?.money >= cost && underLimit && stockShares.value > 0
})

// K线缩略图点坐标
function sparkPoints(code) {
  const rt = props.state.stockRuntime[code]
  if (!rt || rt.history.length < 2) return '0,12 60,12'
  const h = rt.history
  const min = Math.min(...h)
  const max = Math.max(...h)
  const range = max - min || 1
  return h.map((p, i) => {
    const x = (i / (h.length - 1)) * 60
    const y = 24 - ((p - min) / range) * 22
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}
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
            @mouseenter="onHover(c, $event)"
            @mousemove="onMove"
            @mouseleave="offHover"
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

      <!-- 地产 -->
      <div v-else-if="mode === 'lands'" class="modal__body">
        <div v-if="lands.length" class="lands">
          <div class="lands__total">
            <span>🏠 {{ lands.length }} 块地产 · 总价值</span>
            <b>¥{{ totalValue }}</b>
          </div>
          <div v-for="l in lands" :key="l.id" class="land-row" :class="{ 'land-row--mortgaged': l.mortgaged }">
            <button class="land-row__main" @click="emit('info', l.id)">
              <span class="land-row__name">{{ l.name }}</span>
              <b v-if="l.tag" class="tag-comic tag-comic--blue">{{ l.tag }}</b>
              <span class="land-row__shop">{{ l.shop.name }}</span>
              <span v-if="l.group" class="land-row__group">{{ l.group.name }} {{ l.group.n }}/{{ l.group.total }}</span>
              <span class="land-row__value">¥{{ l.value }}</span>
            </button>
            <button v-if="l.mortgaged" class="land-row__btn land-row__btn--redeem" :disabled="!l.canUnmortgage" @click="unmortgage(l.id)">
              <span>赎回</span><small>¥{{ l.redeemCost }}</small>
            </button>
            <button v-else class="land-row__btn land-row__btn--mort" :disabled="!l.canMortgage" @click="mortgage(l.id)">
              <span>抵押</span><small>¥{{ l.mortgageAmount }}</small>
            </button>
          </div>
        </div>
        <p v-else class="empty">还没有地产，踩到无主地记得买</p>
      </div>

      <!-- 股票 -->
      <div v-else-if="mode === 'stocks'" class="modal__body stocks">
        <div class="stocks__header">
          <div class="stocks__market">
            <span class="stocks__title">📊 重庆股市</span>
            <span class="stocks__round">第 {{ state.round }} 回合</span>
          </div>
          <div class="stocks__summary">
            <span>💰 现金 <b>¥{{ me.money }}</b></span>
            <span>📈 市值 <b>¥{{ stockPortfolio }}</b></span>
            <span>🏢 持仓 <b>{{ heldStockCount }}/5</b></span>
          </div>
        </div>
        <div class="stocks__list">
          <button
            v-for="s in stockList"
            :key="s.code"
            class="stock-row"
            :class="{
              'stock-row--sel': selectedStock === s.code,
              'stock-row--hold': s.holdings > 0,
              'stock-row--up': s.change > 0,
              'stock-row--down': s.change < 0,
            }"
            @click="selectedStock = s.code"
          >
            <!-- K线缩略图 -->
            <span class="stock-row__spark">
              <svg viewBox="0 0 60 24" preserveAspectRatio="none">
                <polyline :points="sparkPoints(s.code)" fill="none" :stroke="s.change >= 0 ? '#ef4444' : '#22c55e'" stroke-width="1.8" />
              </svg>
            </span>
            <span class="stock-row__icon">{{ s.icon }}</span>
            <span class="stock-row__info">
              <span class="stock-row__name">{{ s.name }}</span>
              <span class="stock-row__code">{{ s.name }} ({{ s.code.toUpperCase() }})</span>
              <span v-if="s.events && s.events.length" class="stock-row__events">
                <span v-for="(ev, ei) in s.events" :key="ei" class="stock-row__event" :class="{ 'stock-row__event--up': ev.delta > 0, 'stock-row__event--down': ev.delta < 0 }">
                  {{ ev.icon }} {{ ev.text }} {{ ev.delta > 0 ? '+' : '' }}{{ (ev.delta * 100).toFixed(0) }}%({{ ev.turnsLeft }})
                </span>
              </span>
            </span>
            <span class="stock-row__price-box">
              <span class="stock-row__price" :class="{ 'up': s.change > 0, 'down': s.change < 0 }">
                ¥{{ s.current.toFixed(2) }}
              </span>
              <span class="stock-row__change" :class="{ 'up': s.change > 0, 'down': s.change < 0 }">
                {{ s.change > 0 ? '▲' : s.change < 0 ? '▼' : '—' }}
                {{ Math.abs(s.change).toFixed(1) }}%
              </span>
            </span>
            <span v-if="s.holdings > 0" class="stock-row__hold">{{ s.holdings }}股</span>
          </button>
        </div>

        <!-- 交易区 -->
        <div v-if="selectedStock" class="stocks__trade">
          <div class="stocks__trade-head">
            <span class="stocks__trade-icon">{{ STOCKS[selectedStock].icon }}</span>
            <span class="stocks__trade-name">{{ STOCKS[selectedStock].name }}</span>
            <span class="stocks__trade-price" :class="{ 'up': state.stockRuntime[selectedStock].current >= state.stockRuntime[selectedStock].prev, 'down': state.stockRuntime[selectedStock].current < state.stockRuntime[selectedStock].prev }">
              ¥{{ state.stockRuntime[selectedStock].current.toFixed(2) }}
            </span>
          </div>
          <div class="stocks__range">
            <span>最低 ¥{{ STOCKS[selectedStock].min }}</span>
            <span>初始 ¥{{ STOCKS[selectedStock].price }}</span>
            <span>最高 ¥{{ STOCKS[selectedStock].max }}</span>
          </div>
          <div v-if="(me.stockHoldings?.[selectedStock]||0) > 0" class="stocks__myhold">
            持有 {{ me.stockHoldings[selectedStock] }} 股 · 市值 ¥{{ Math.floor((me.stockHoldings[selectedStock] || 0) * state.stockRuntime[selectedStock].current) }}
          </div>
          <div class="stocks__input">
            <label>买入股数</label>
            <div class="stock-input-row">
              <button class="stock-qty-btn" @click="stockShares = Math.max(1, stockShares - 10)">-10</button>
              <button class="stock-qty-btn" @click="stockShares = Math.max(1, stockShares - 1)">-1</button>
              <input type="number" v-model.number="stockShares" min="1" max="9999" class="stock-input" />
              <button class="stock-qty-btn" @click="stockShares += 1">+1</button>
              <button class="stock-qty-btn" @click="stockShares += 10">+10</button>
            </div>
            <span class="stocks__cost">
              需 ¥{{ selectedStock ? Math.ceil(state.stockRuntime[selectedStock].current * stockShares * 1.01) : 0 }}
              <em>(含1%手续费)</em>
            </span>
          </div>
          <div class="stocks__btns">
            <button class="btn-comic btn-comic--red" :disabled="!canBuyStock || !isMyTurn" @click="emit('stockBuy', { code: selectedStock, shares: stockShares })">
              📈 买入
            </button>
            <button
              class="btn-comic btn-comic--green"
              :disabled="!(me.stockHoldings?.[selectedStock] > 0) || !isMyTurn"
              @click="emit('stockSell', { code: selectedStock, shares: me.stockHoldings?.[selectedStock] || 0 })"
            >
              📉 全部卖出
            </button>
          </div>
        </div>
      </div>

      <!-- 其它（预留） -->
      <div v-else class="modal__body">
        <p class="empty"><ComicIcon name="more" :size="16" /> 更多玩法建设中，敬请期待</p>
      </div>

      <div class="modal__foot">
        <button class="btn-comic btn-comic--sm btn-comic--ghost" @click="emit('close')">关闭</button>
      </div>
    </div>

    <!-- 悬停浮层：跟随鼠标显示卡片效果与用法 -->
    <div
      v-if="hovered"
      class="tip tip--card"
      :style="{ left: hovered.x + 16 + 'px', top: hovered.y + 14 + 'px' }"
    >
      <div class="tip__name"><ComicIcon :name="hovered.item.icon" :size="16" /> {{ hovered.item.name }}</div>
      <div class="tip__desc">{{ hovered.item.desc }}</div>
      <div class="tip__howto">💡 {{ hovered.item.howto || '无额外说明' }}</div>
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
  max-width: 660px;
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
  min-height: 180px;
  max-height: 68vh;
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
  width: 130px;
  padding: 12px 10px;
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

.lands__total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #fef3c7;
  border: 2px solid var(--ink);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 900;
}

.lands__total b {
  font-size: 18px;
  color: var(--pop-red);
}

.land-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: #fff;
  text-align: left;
  font-family: inherit;
  transition: transform 0.12s ease;
  overflow: hidden;
}

.land-row:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 0 var(--ink);
}

.land-row--mortgaged {
  opacity: 0.6;
  background: #f5f5f5;
}

.land-row--mortgaged .land-row__main {
  text-decoration: line-through;
}

.land-row__main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: inherit;
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

.land-row__btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 6px 10px;
  border: none;
  border-left: 2px solid var(--ink);
  font-family: inherit;
  font-weight: 900;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.1s;
}

.land-row__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.land-row__btn--mort {
  background: #dbeafe;
  color: #1d4ed8;
}
.land-row__btn--mort:hover:not(:disabled) {
  background: #bfdbfe;
}

.land-row__btn--redeem {
  background: #dcfce7;
  color: #15803d;
}
.land-row__btn--redeem:hover:not(:disabled) {
  background: #bbf7d0;
}

.land-row__btn span {
  font-size: 12px;
}
.land-row__btn small {
  font-size: 10px;
  opacity: 0.7;
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

.land-row__value {
  margin-left: auto;
  margin-right: 8px;
  font-size: 12px;
  font-weight: 900;
  color: var(--pop-blue);
  white-space: nowrap;
}

.land-row__go {
  margin-left: auto;
  font-size: 11px;
  font-weight: 900;
  opacity: 0.6;
}

/* ===== 股票面板（漫画+股市风） ===== */
.stocks__header { margin-bottom: 10px; }
.stocks__market { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.stocks__title { font-size: 18px; font-weight: 900; }
.stocks__round { font-size: 12px; font-weight: 900; opacity: 0.55; border: 2px solid var(--ink); border-radius: 6px; padding: 1px 6px; }
.stocks__summary { display: flex; gap: 12px; font-size: 11px; font-weight: 900; padding: 6px 0; border-top: 2px solid var(--ink); border-bottom: 2px solid var(--ink); }
.stocks__summary b { color: var(--pop-blue); }
.stocks__list { display: flex; flex-direction: column; gap: 4px; max-height: 340px; overflow-y: auto; margin-top: 8px; }
.stock-row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  border: 2.5px solid var(--ink); border-radius: 8px;
  background: #fff; cursor: pointer; text-align: left; font-family: inherit;
  transition: transform 0.1s, box-shadow 0.1s;
}
.stock-row:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 0 var(--ink); }
.stock-row--sel { background: #fff3c4; border-width: 3px; }
.stock-row--up { border-left: 5px solid #ef4444; }
.stock-row--down { border-left: 5px solid #22c55e; }
.stock-row--hold { background: #e0f2fe; }
.stock-row__spark { width: 50px; height: 22px; flex-shrink: 0; background: #fafafa; border: 1px solid #ddd; border-radius: 3px; overflow: hidden; }
.stock-row__spark svg { width: 100%; height: 100%; }
.stock-row__icon { font-size: 20px; flex-shrink: 0; }
.stock-row__info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.stock-row__name { font-weight: 900; font-size: 14px; line-height: 1.1; }
.stock-row__code { font-size: 10px; font-weight: 900; opacity: 0.45; }
.stock-row__price-box { display: flex; flex-direction: column; align-items: flex-end; min-width: 75px; }
.stock-row__price { font-weight: 900; font-size: 15px; font-variant-numeric: tabular-nums; line-height: 1.1; }
.stock-row__change { font-weight: 900; font-size: 11px; line-height: 1.1; }
.stock-row__price.up, .stock-row__change.up { color: #ef4444; }
.stock-row__price.down, .stock-row__change.down { color: #22c55e; }
.stock-row__hold { font-size: 10px; font-weight: 900; color: #fff; background: var(--pop-blue); border: 1.5px solid var(--ink); border-radius: 5px; padding: 1px 5px; white-space: nowrap; }
.stock-row__events { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px; }
.stock-row__event { font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 3px; border: 1px solid var(--ink); white-space: nowrap; }
.stock-row__event--up { background: #fef2f2; color: #dc2626; }
.stock-row__event--down { background: #f0fdf4; color: #16a34a; }

.stocks__trade {
  margin-top: 12px; padding: 12px;
  border: 3px solid var(--ink); border-radius: 10px;
  background: repeating-linear-gradient(45deg, #fffbeb 0px, #fffbeb 8px, #fef3c7 8px, #fef3c7 16px);
}
.stocks__trade-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.stocks__trade-icon { font-size: 22px; }
.stocks__trade-name { font-size: 18px; font-weight: 900; }
.stocks__trade-price { margin-left: auto; font-size: 20px; font-weight: 900; font-variant-numeric: tabular-nums; }
.stocks__trade-price.up { color: #ef4444; }
.stocks__trade-price.down { color: #22c55e; }
.stocks__range { display: flex; justify-content: space-between; font-size: 10px; font-weight: 900; opacity: 0.55; margin-bottom: 6px; }
.stocks__myhold { font-size: 12px; font-weight: 900; margin-bottom: 8px; color: var(--pop-blue); }
.stocks__input { margin-bottom: 10px; }
.stocks__input label { font-size: 12px; font-weight: 900; display: block; margin-bottom: 4px; }
.stock-input-row { display: flex; align-items: center; gap: 4px; }
.stock-qty-btn {
  width: 32px; height: 32px;
  border: 2px solid var(--ink); border-radius: 6px;
  background: #fff; font-weight: 900; font-size: 12px;
  cursor: pointer; font-family: inherit; flex-shrink: 0;
}
.stock-qty-btn:hover { background: var(--pop-yellow); }
.stock-input {
  width: 64px; height: 30px;
  border: 2px solid var(--ink); border-radius: 6px;
  font-weight: 900; font-size: 16px; text-align: center;
}
.stocks__cost { font-size: 11px; font-weight: 900; opacity: 0.7; margin-top: 4px; display: block; }
.stocks__cost em { font-style: normal; }
.stocks__btns { display: flex; gap: 10px; }

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

/* ===== 悬停浮层 ===== */
.tip {
  position: fixed;
  z-index: 95;
  max-width: 240px;
  padding: 10px 12px;
  border: 3px solid var(--ink);
  border-radius: 8px;
  box-shadow: 4px 4px 0 0 rgba(26, 26, 26, 0.5);
  pointer-events: none;
  text-align: left;
}
.tip--card { background: #fef9c3; }
.tip__name {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  font-weight: 900;
  margin-bottom: 4px;
}
.tip__desc {
  font-size: 12px;
  font-weight: 900;
  opacity: 0.75;
  margin-bottom: 4px;
}
.tip__howto {
  font-size: 11.5px;
  font-weight: 900;
  line-height: 1.5;
  padding-top: 6px;
  border-top: 2px dashed rgba(26, 26, 26, 0.25);
}
@media (max-width: 768px) {
  .my-panel { max-width: calc(100vw - 16px) !important; }
  .card-item { width: 100% !important; }
  .stocks__list { max-height: 200px; }
  .stock-row__spark { width: 40px; }
  .stock-row__price-box { min-width: 60px; }
  .stock-input-row { flex-wrap: wrap; }
}
</style>
