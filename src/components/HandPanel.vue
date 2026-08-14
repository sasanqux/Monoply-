<script setup>
import { ref } from 'vue'

defineProps({
  me: Object,
  selecting: Object,
  isMyTurn: Boolean,
})
const emit = defineEmits(['useCard'])

const open = ref(false)
</script>

<template>
  <section class="hand card-comic">
    <button class="hand__head" @click="open = !open">
      <span class="comic-title comic-title--md">手牌 🎴{{ me?.hand?.length ?? 0 }}</span>
      <span class="hand__arrow">{{ open ? '▲' : '▼' }}</span>
    </button>

    <div v-if="open" class="hand__cards">
      <button
        v-for="c in me.hand"
        :key="c.id"
        class="hand__card"
        :class="{ 'hand__card--picked': selecting?.type === 'card' && selecting.id === c.id }"
        :title="c.desc"
        :disabled="!isMyTurn"
        @click="emit('useCard', c)"
      >
        <span class="hand__card-icon">{{ c.icon }}</span>
        <span class="hand__card-name">{{ c.name }}</span>
      </button>
      <p v-if="!me.hand.length" class="hand__empty">暂无卡片，踩中山城奇遇抽卡</p>
      <p v-if="me.hand.length && !isMyTurn" class="hand__empty">轮到你再使用</p>
    </div>
  </section>
</template>

<style scoped>
.hand {
  flex: 1;
  min-width: 240px;
  padding: 10px 14px;
}

.hand__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  cursor: pointer;
  background: none;
  border: none;
  font-family: inherit;
  color: var(--ink);
}

.hand__arrow {
  font-size: 10px;
  opacity: 0.6;
}

.hand__cards {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
  border-top: 2px dashed var(--ink);
  padding-top: 10px;
}

.hand__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 72px;
  padding: 7px 4px;
  border: 3px solid var(--ink);
  border-radius: 8px;
  background: #fff;
  box-shadow: 3px 3px 0 0 var(--ink);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.hand__card:hover:not(:disabled) {
  transform: translate(-2px, -2px);
  box-shadow: 5px 5px 0 0 var(--ink);
}

.hand__card:active:not(:disabled) {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 0 var(--ink);
}

.hand__card--picked {
  outline: 3px solid var(--pop-yellow);
}

.hand__card-icon {
  font-size: 18px;
  line-height: 1;
}

.hand__card-name {
  font-size: 11px;
  font-weight: 900;
}

.hand__empty {
  width: 100%;
  font-size: 12px;
  font-weight: 900;
  opacity: 0.55;
}
</style>
