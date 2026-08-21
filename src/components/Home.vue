<script setup>
import { ref, onMounted } from 'vue'
import ComicIcon from './ComicIcon.vue'
import { setServerUrl } from '../net/socket.js'
const emit = defineEmits(['start', 'rejoin'])

const showSettings = ref(false)
const serverUrl = ref(localStorage.getItem('monopoly_server') || 'http://110.42.227.121:8080')
const savedGame = ref(null) // 保存的游戏信息

onMounted(() => {
  // 检查是否有进行中的游戏
  try {
    const raw = localStorage.getItem('monopoly_game')
    if (raw) {
      const info = JSON.parse(raw)
      // 2 小时内的游戏才显示返回按钮
      if (Date.now() - info.savedAt < 2 * 60 * 60 * 1000) {
        savedGame.value = info
      }
    }
  } catch { /* 忽略 */ }
})

function saveServer() {
  let url = serverUrl.value.trim()
  if (url && !/^https?:\/\//.test(url)) url = 'http://' + url
  setServerUrl(url)
  showSettings.value = false
}
</script>

<template>
  <div class="home">
    <div class="home__logo">
      <span class="home__icon">🎲</span>
      <h1 class="comic-title comic-title--xl home__title">大富翁——重庆之旅</h1>
      <p class="home__tag">两江 · 桥 · 卡牌</p>
    </div>

    <!-- 返回游戏按钮（有进行中的游戏时显示） -->
    <button
      v-if="savedGame"
      class="btn-comic btn-comic--xl home__btn home__btn--rejoin"
      @click="emit('rejoin', savedGame)"
    >
      🎮 返回游戏
      <span class="home__btn-sub">房间 {{ savedGame.roomId }} · {{ savedGame.playerName }}</span>
    </button>

    <!-- 开始游戏 -->
    <button class="btn-comic btn-comic--xl home__btn" @click="emit('start')">
      开始游戏
    </button>

    <p class="home__version">v3.1 · Comic Style</p>

    <!-- 服务器设置入口 -->
    <button class="home__settings" @click="showSettings = true" title="设置服务器">
      ⚙️
    </button>

    <!-- 服务器设置弹窗 -->
    <div v-if="showSettings" class="overlay-layer" @click.self="showSettings = false">
      <div class="card-comic card-comic--pad-lg server-modal">
        <h3 class="comic-title comic-title--md">⚙️ 服务器设置</h3>
        <p class="server-modal__hint">输入联机服务器地址，默认即可连接公测服</p>
        <input v-model="serverUrl" class="input-comic" placeholder="http://110.42.227.121:8080" />
        <div class="server-modal__btns">
          <button class="btn-comic btn-comic--ghost" @click="showSettings = false">取消</button>
          <button class="btn-comic btn-comic--green" @click="saveServer">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 24px;
}
.home__logo { text-align: center; }
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
.home__title { margin: 0; }
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
.home__btn--rejoin {
  background: var(--pop-green);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.home__btn-sub {
  font-size: 12px;
  opacity: 0.8;
  font-weight: 700;
}
.home__version {
  font-size: 11px;
  font-weight: 900;
  opacity: 0.3;
  letter-spacing: 0.1em;
}
.home__settings {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid var(--ink, #1a1a2e);
  background: #fff;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 2px 2px 0 0 var(--ink, #1a1a2e);
  transition: transform 0.1s;
}
.home__settings:hover { transform: scale(1.1); }
.home__settings:active { transform: translate(2px, 2px); box-shadow: none; }
.server-modal { max-width: 360px; width: 90%; }
.server-modal__hint { font-size: 13px; opacity: 0.6; margin: 8px 0 12px; }
.server-modal__btns { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
</style>
