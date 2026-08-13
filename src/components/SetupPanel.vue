<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['start'])

const players = ref(3)
const turnMode = ref(40)
const customTurns = ref(30)
const moneyMode = ref(5000)
const customMoney = ref(8000)

const maxTurns = computed(() => {
  if (turnMode.value === 'off') return null
  if (turnMode.value === 'custom') return Math.max(1, Math.floor(customTurns.value))
  return turnMode.value
})

const startMoney = computed(() => {
  if (moneyMode.value === 'custom') return Math.max(100, Math.floor(customMoney.value))
  return moneyMode.value
})

function go() {
  emit('start', {
    players: players.value,
    maxTurns: maxTurns.value,
    startMoney: startMoney.value,
  })
}
</script>

<template>
  <section class="setup card-comic card-comic--pad-lg">
    <h2 class="comic-title comic-title--lg"><span class="comic-stripe">开局设置</span></h2>

    <div class="setup__row">
      <span class="setup__label">玩家人数</span>
      <div class="seg-comic">
        <button v-for="n in [2, 3, 4]" :key="n" class="seg-comic__btn" :class="{ 'seg-comic__btn--on': players === n }" @click="players = n">
          {{ n }} 人
        </button>
      </div>
      <p class="setup__hint">第 1 个是你，其余是电脑对手</p>
    </div>

    <div class="setup__row">
      <span class="setup__label">回合上限</span>
      <div class="seg-comic">
        <button class="seg-comic__btn" :class="{ 'seg-comic__btn--on': turnMode === 40 }" @click="turnMode = 40">40</button>
        <button class="seg-comic__btn" :class="{ 'seg-comic__btn--on': turnMode === 'off' }" @click="turnMode = 'off'">不限</button>
        <button class="seg-comic__btn" :class="{ 'seg-comic__btn--on': turnMode === 'custom' }" @click="turnMode = 'custom'">自定义</button>
      </div>
      <input v-if="turnMode === 'custom'" v-model.number="customTurns" class="input-comic setup__input" type="number" min="1" max="200" />
      <p class="setup__hint">到点按总资产排名；「不限」= 打到只剩一人</p>
    </div>

    <div class="setup__row">
      <span class="setup__label">初始资产</span>
      <div class="seg-comic">
        <button v-for="m in [3000, 5000, 10000]" :key="m" class="seg-comic__btn" :class="{ 'seg-comic__btn--on': moneyMode === m }" @click="moneyMode = m">
          {{ m }}
        </button>
        <button class="seg-comic__btn" :class="{ 'seg-comic__btn--on': moneyMode === 'custom' }" @click="moneyMode = 'custom'">自定义</button>
      </div>
      <input v-if="moneyMode === 'custom'" v-model.number="customMoney" class="input-comic setup__input" type="number" min="100" step="100" />
      <p class="setup__hint">每人起始资金，默认 5000</p>
    </div>

    <button class="btn-comic setup__go" @click="go">开始游戏</button>
  </section>
</template>

<style scoped>
.setup {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.setup__row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.setup__label {
  width: 76px;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.setup__hint {
  width: 100%;
  font-size: 12px;
  font-weight: 900;
  opacity: 0.6;
}

.setup__input {
  width: 110px;
}

.setup__go {
  align-self: flex-start;
  margin-top: 4px;
}
</style>
