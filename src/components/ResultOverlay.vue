<script setup>
import { computed } from 'vue'
import ComicIcon from './ComicIcon.vue'
import { totalAssets, TILES, stockPortfolioValue } from '../game/index.js'

const props = defineProps({
  state: Object,
})
const emit = defineEmits(['again'])

const ranking = computed(() =>
  [...props.state.players]
    .sort((a, b) => totalAssets(b) - totalAssets(a))
    .map((p, i) => ({
      ...p,
      rank: i + 1,
      assets: totalAssets(p),
      // 资产明细：现金 / 地产（按地价合计）/ 股票持仓市值
      cash: p.money,
      land: p.properties.reduce((s, id) => s + (TILES[id]?.price || 0), 0),
      stock: stockPortfolioValue(p, props.state.stockRuntime),
    }))
)

const winner = computed(() => props.state.players.find((p) => p.id === props.state.winnerId))
</script>

<template>
  <div class="overlay-layer">
    <div class="card-comic card-comic--pad-lg result">
      <h2 class="comic-title comic-title--xl"><span class="comic-stripe">游戏结束</span></h2>
      <p class="result__winner">
        <ComicIcon name="trophy" :size="26" /> <b>{{ winner?.name }}</b> 获胜！
      </p>
      <p class="result__reason">
        {{ state.settings.maxTurns ? `第 ${state.round} 回合触发回合上限，按总资产结算` : '其他玩家全部破产，成为最后赢家' }}
      </p>

      <ol class="rank">
        <li v-for="r in ranking" :key="r.id" class="rank__row" :class="{ 'rank__row--win': r.id === winner?.id }">
          <div class="rank__line">
            <span class="rank__no">{{ r.rank }}</span>
            <i class="rank__dot" :style="{ background: r.color }"></i>
            <span class="rank__name">{{ r.name }}<em v-if="r.isAI">AI</em></span>
            <span class="rank__assets">总资产 ¥{{ r.assets }}</span>
          </div>
          <div class="rank__detail">
            <span>现金 ¥{{ r.cash }}</span>
            <span>地产 ¥{{ r.land }}</span>
            <span>股票 ¥{{ r.stock }}</span>
          </div>
        </li>
      </ol>

      <div class="result__btns">
        <button class="btn-comic" @click="emit('again')">再来一局</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay-layer {
  position: fixed;
  inset: 0;
  background: rgba(26, 26, 26, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 90; /* 高于手牌/详情/事件弹窗（70/80），结算不被盖住 */
  padding: 16px;
}

.result {
  width: 100%;
  max-width: 420px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result__winner {
  font-size: 19px;
  font-weight: 900;
}

.result__winner b {
  color: var(--pop-red);
}

.result__reason {
  font-size: 12px;
  font-weight: 900;
  opacity: 0.65;
}

.rank {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 6px 0;
}

.rank__row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: #fff;
}

.rank__line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rank__detail {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  opacity: 0.65;
  font-variant-numeric: tabular-nums;
  padding-left: 30px;
}

.rank__row--win {
  background: #fff3c4;
  box-shadow: 3px 3px 0 0 var(--ink);
}

.rank__no {
  width: 20px;
  font-size: 13px;
  font-weight: 900;
  opacity: 0.55;
}

.rank__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--ink);
}

.rank__name {
  flex: 1;
  font-size: 14px;
  font-weight: 900;
}

.rank__name em {
  font-style: normal;
  font-size: 9px;
  color: #fff;
  background: var(--pop-red);
  border: 1px solid var(--ink);
  border-radius: 4px;
  padding: 0 4px;
  margin-left: 4px;
}

.rank__assets {
  font-size: 13px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.result__btns {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
@media (max-width: 768px) {
  .result {
    max-width: calc(100vw - 16px) !important;
    padding: 16px !important;
  }
}
</style>
