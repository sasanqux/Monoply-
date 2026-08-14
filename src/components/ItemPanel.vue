<script setup>
import { ref } from 'vue'

defineProps({
  me: Object,
  isMyTurn: Boolean,
})
const emit = defineEmits(['useItem'])

const open = ref(false)
</script>

<template>
  <section class="items card-comic">
    <button class="items__head" @click="open = !open">
      <span class="comic-title comic-title--md">道具 📦{{ me?.items?.length ?? 0 }}</span>
      <span class="items__arrow">{{ open ? '▲' : '▼' }}</span>
    </button>

    <div v-if="open" class="items__list">
      <button
        v-for="it in me.items"
        :key="it.id"
        class="items__btn"
        :title="it.desc"
        :disabled="!isMyTurn"
        @click="emit('useItem', it)"
      >
        <span class="items__icon">{{ it.icon }}</span>
        <span class="items__name">{{ it.name }}</span>
      </button>
      <p v-if="!me.items.length" class="items__empty">暂无道具，踩中山城奇遇捡</p>
      <p v-if="me.items.length && !isMyTurn" class="items__empty">轮到你再使用</p>
    </div>
  </section>
</template>

<style scoped>
.items {
  flex: 1;
  min-width: 240px;
  padding: 10px 14px;
}

.items__head {
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

.items__arrow {
  font-size: 10px;
  opacity: 0.6;
}

.items__list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
  border-top: 2px dashed var(--ink);
  padding-top: 10px;
}

.items__btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 3px solid var(--ink);
  border-radius: 8px;
  background: #fff;
  box-shadow: 3px 3px 0 0 var(--ink);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.items__btn:hover:not(:disabled) {
  transform: translate(-2px, -2px);
  box-shadow: 5px 5px 0 0 var(--ink);
}

.items__btn:active:not(:disabled) {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 0 var(--ink);
}

.items__icon {
  font-size: 15px;
}

.items__name {
  font-size: 12px;
  font-weight: 900;
}

.items__empty {
  width: 100%;
  font-size: 12px;
  font-weight: 900;
  opacity: 0.55;
}
</style>
