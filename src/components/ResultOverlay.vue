<script setup>
import { computed } from 'vue'
import ComicIcon from './ComicIcon.vue'
import { totalAssets } from '../game/index.js'

const props = defineProps({
  state: Object,
})
const emit = defineEmits(['again'])

const ranking = computed(() =>
  [...props.state.players]
    .sort((a, b) => totalAssets(b) - totalAssets(a))
    .map((p, i) => ({ ...p, rank: i + 1, assets: totalAssets(p) }))
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
          <span class="rank__no">{{ r.rank }}</span>
          <i class="rank__dot" :style="{ background: r.color }"></i>
          <span class="rank__name">{{ r.name }}<em v-if="r.isAI">AI</em></span>
          <span class="rank__assets">总资产 ¥{{ r.assets }}</span>
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
  z-index: 50;
  padding: 16px;
}

.result {
  width: 100%;
  max-width: 420px;
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
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: #fff;
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
</style>
