<script setup>
defineProps({
  me: Object,
  selecting: Object,
})
const emit = defineEmits(['useCard'])
</script>

<template>
  <section class="hand card-comic">
    <h2 class="comic-title comic-title--md">
      手牌 <span class="tag-comic tag-comic--blue">{{ me?.hand?.length ?? 0 }}</span>
    </h2>
    <div v-if="me?.hand?.length" class="hand__cards">
      <button
        v-for="c in me.hand"
        :key="c.id"
        class="hand__card"
        :class="{ 'hand__card--picked': selecting?.type === 'card' && selecting.id === c.id }"
        :title="c.desc"
        @click="emit('useCard', c)"
      >
        <span class="hand__card-icon">{{ c.icon }}</span>
        <span class="hand__card-name">{{ c.name }}</span>
      </button>
    </div>
    <p v-else class="hand__empty">暂无卡片，踩中报刊亭/漫展抽卡</p>
  </section>
</template>

<style scoped>
.hand {
  flex: 1;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hand__cards {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.hand__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 76px;
  padding: 8px 4px;
  border: 3px solid var(--ink);
  border-radius: 8px;
  background: #fff;
  box-shadow: 3px 3px 0 0 var(--ink);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.hand__card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 5px 5px 0 0 var(--ink);
}

.hand__card:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 0 var(--ink);
}

.hand__card--picked {
  outline: 3px solid var(--pop-yellow);
}

.hand__card-icon {
  font-size: 20px;
  line-height: 1;
}

.hand__card-name {
  font-size: 11px;
  font-weight: 900;
}

.hand__empty {
  font-size: 12px;
  font-weight: 900;
  opacity: 0.55;
}
</style>
