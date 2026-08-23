<script setup>
import { ref } from 'vue'
const emit = defineEmits(['single', 'create', 'join'])
</script>

<template>
  <div class="mode">
    <h2 class="comic-title comic-title--lg mode__title">选择模式</h2>
    <div class="mode__btns">
      <button class="btn-comic btn-comic--lg mode__btn" @click="emit('single')">
        <span class="mode__btn-icon">🎮</span>
        <span class="mode__btn-label">单机模式</span>
        <span class="mode__btn-desc">与 AI 对战</span>
      </button>
      <button class="btn-comic btn-comic--lg mode__btn mode__btn--blue" @click="emit('create')">
        <span class="mode__btn-icon">🏗️</span>
        <span class="mode__btn-label">创建房间</span>
        <span class="mode__btn-desc">邀请好友加入</span>
      </button>
      <button class="btn-comic btn-comic--lg mode__btn mode__btn--green" @click="emit('join')">
        <span class="mode__btn-icon">🔗</span>
        <span class="mode__btn-label">加入房间</span>
        <span class="mode__btn-desc">输入房间码加入</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.mode {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  gap: 32px;
  padding: 20px;
}
.mode__title { margin: 0; }
.mode__btns {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 360px;
}
.mode__btn {
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px;
}
.mode__btn-icon { font-size: 32px; }
.mode__btn-label { font-size: 18px; font-weight: 900; }
.mode__btn-desc { font-size: 12px; font-weight: 700; opacity: 0.6; }
</style>
