<script setup>
import { ref } from 'vue'
import ComicIcon from './ComicIcon.vue'
const emit = defineEmits(['start'])
</script>

<template>
  <div class="home">
    <div class="home__logo">
      <span class="home__icon">🎲</span>
      <h1 class="comic-title comic-title--xl home__title">大富翁——重庆之旅</h1>
      <p class="home__tag">两江 · 桥 · 卡牌</p>
    </div>
    <button class="btn-comic btn-comic--xl home__btn" @click="emit('start')">
      开始游戏
    </button>
    <p class="home__version">v3.1 · Comic Style</p>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 32px;
}
.home__logo {
  text-align: center;
}
.home__icon {
  font-size: 80px;
  display: block;
  margin-bottom: 16px;
  animation: logo-bounce 2s ease-in-out infinite;
}
@keyframes logo-bounce {
  0%, 100% { transform: translateY(0) rotate(-5deg); }
  50% { transform: translateY(-12px) rotate(5deg); }
}
.home__title {
  margin: 0;
}
.home__tag {
  font-size: 16px;
  font-weight: 900;
  opacity: 0.6;
  margin-top: 8px;
  letter-spacing: 0.1em;
}
.home__btn {
  padding: 16px 48px;
  font-size: 20px;
}
.home__version {
  font-size: 11px;
  font-weight: 900;
  opacity: 0.3;
  letter-spacing: 0.1em;
}
</style>
