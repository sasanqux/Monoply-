<script setup>
defineProps({
  me: Object,
})
const emit = defineEmits(['useItem'])
</script>

<template>
  <section class="items card-comic">
    <h2 class="comic-title comic-title--md">
      道具 <span class="tag-comic tag-comic--green">{{ me?.items?.length ?? 0 }}</span>
    </h2>
    <div v-if="me?.items?.length" class="items__list">
      <button
        v-for="it in me.items"
        :key="it.id"
        class="items__btn"
        :title="it.desc"
        @click="emit('useItem', it)"
      >
        <span class="items__icon">{{ it.icon }}</span>
        <span class="items__name">{{ it.name }}</span>
      </button>
    </div>
    <p v-else class="items__empty">暂无道具，踩中杂货铺/旧货市场获得</p>
  </section>
</template>

<style scoped>
.items {
  flex: 1;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.items__list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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

.items__btn:hover {
  transform: translate(-2px, -2px);
  box-shadow: 5px 5px 0 0 var(--ink);
}

.items__btn:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 0 var(--ink);
}

.items__icon {
  font-size: 16px;
}

.items__name {
  font-size: 12px;
  font-weight: 900;
}

.items__empty {
  font-size: 12px;
  font-weight: 900;
  opacity: 0.55;
}
</style>
