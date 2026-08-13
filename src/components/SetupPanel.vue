<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['start'])

const players = ref(3)
const turnMode = ref(40) // 40 | 'off' | 'custom'
const customTurns = ref(30)
const moneyMode = ref(5000) // 3000 | 5000 | 10000 | 'custom'
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
  <section class="setup">
    <h2 class="sec-title">开局设置</h2>

    <div class="setup__row">
      <span class="setup__label">玩家人数</span>
      <div class="seg">
        <button
          v-for="n in [2, 3, 4]"
          :key="n"
          class="seg__btn"
          :class="{ 'seg__btn--on': players === n }"
          @click="players = n"
        >
          {{ n }} 人
        </button>
      </div>
      <p class="setup__hint">第 1 个是你，其余是电脑对手</p>
    </div>

    <div class="setup__row">
      <span class="setup__label">回合上限</span>
      <div class="seg">
        <button class="seg__btn" :class="{ 'seg__btn--on': turnMode === 40 }" @click="turnMode = 40">40</button>
        <button class="seg__btn" :class="{ 'seg__btn--on': turnMode === 'off' }" @click="turnMode = 'off'">不限</button>
        <button class="seg__btn" :class="{ 'seg__btn--on': turnMode === 'custom' }" @click="turnMode = 'custom'">自定义</button>
      </div>
      <input
        v-if="turnMode === 'custom'"
        v-model.number="customTurns"
        class="input setup__input"
        type="number"
        min="1"
        max="200"
      />
      <p class="setup__hint">到点按总资产排名；「不限」= 打到只剩一人</p>
    </div>

    <div class="setup__row">
      <span class="setup__label">初始资产</span>
      <div class="seg">
        <button
          v-for="m in [3000, 5000, 10000]"
          :key="m"
          class="seg__btn"
          :class="{ 'seg__btn--on': moneyMode === m }"
          @click="moneyMode = m"
        >
          {{ m }}
        </button>
        <button class="seg__btn" :class="{ 'seg__btn--on': moneyMode === 'custom' }" @click="moneyMode = 'custom'">自定义</button>
      </div>
      <input
        v-if="moneyMode === 'custom'"
        v-model.number="customMoney"
        class="input setup__input"
        type="number"
        min="100"
        step="100"
      />
      <p class="setup__hint">每人起始资金，默认 5000</p>
    </div>

    <button class="btn btn--red setup__go" @click="go">开始游戏</button>
  </section>
</template>

<style scoped>
.setup {
  max-width: 560px;
  margin: 0 auto;
  padding: var(--space-4);
  border: 1px solid var(--grid);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.setup__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.setup__label {
  width: 72px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.setup__hint {
  width: 100%;
  font-size: 12px;
  color: var(--gray-500);
}

.setup__input {
  width: 110px;
}

.setup__go {
  align-self: flex-start;
  margin-top: var(--space-2);
}

.seg {
  display: flex;
  border: 2px solid var(--black);
}

.seg__btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.03em;
  border-right: 1px solid var(--black);
}

.seg__btn:last-child {
  border-right: none;
}

.seg__btn:hover {
  background: var(--gray-100);
}

.seg__btn--on {
  background: var(--black);
  color: var(--white);
}

.seg__btn--on:hover {
  background: var(--black);
}
</style>
