<script setup>
import ComicIcon from './ComicIcon.vue'

const props = defineProps({
  me: Object,
})
const emit = defineEmits(['open', 'openEncyclopedia'])

const entries = [
  { mode: 'cards', label: '卡牌', icon: 'card', count: () => props.me?.hand?.length ?? 0 },
  { mode: 'lands', label: '地产', icon: 'home', count: () => props.me?.properties?.length ?? 0 },
  { mode: 'stocks', label: '股票', icon: 'stock', count: () => Object.keys(props.me?.stockHoldings || {}).filter(c => props.me.stockHoldings[c] > 0).length },
]

function openEncy() {
  emit('openEncyclopedia')
}
</script>

<template>
  <div class="bags">
    <button
      v-for="e in entries"
      :key="e.mode"
      class="btn-comic btn-comic--sm bags__btn"
      @click="emit('open', e.mode)"
    >
      <ComicIcon :name="e.icon" :size="18" /> {{ e.label }} <b class="bags__cnt">{{ e.count() }}</b>
    </button>
    <button class="btn-comic btn-comic--sm bags__btn" @click="openEncy">
      <ComicIcon name="book" :size="18" /> 百科
    </button>
  </div>
</template>

<style scoped>
.bags {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.bags__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.bags__cnt {
  background: var(--pop-yellow);
  color: var(--ink);
  border: 2px solid var(--ink);
  border-radius: 6px;
  padding: 0 6px;
  font-size: 11px;
  line-height: 1.5;
}
</style>
