<script setup>
import { ref, onMounted } from 'vue'
import { setServerUrl, disconnect } from '../net/socket.js'
const emit = defineEmits(['start', 'rejoin', 'openEncyclopedia'])

const showSettings = ref(false)
const serverUrl = ref(localStorage.getItem('monopoly_server') || 'http://110.42.227.121:8080')
const savedGame = ref(null) // 联机游戏信息

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
  disconnect() // 断开旧连接：下次 connect() 才会用新地址（socket 是单例，不断开会一直连旧服务器）
  showSettings.value = false
}
</script>

<template>
  <div class="home">
    <!-- 星空 -->
    <div class="home__stars">
      <i style="left:12%;top:14%"></i><i style="left:26%;top:32%"></i><i style="left:41%;top:9%"></i>
      <i style="left:58%;top:22%"></i><i style="left:71%;top:8%"></i><i style="left:84%;top:27%"></i>
      <i style="left:33%;top:44%"></i><i style="left:66%;top:39%"></i><i style="left:90%;top:47%"></i>
    </div>

    <!-- 月亮 -->
    <div class="home__moon"></div>

    <!-- 城市天际线 -->
    <svg class="home__skyline" viewBox="0 0 800 250" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <!-- 远景楼群 -->
      <g fill="#232a52">
        <rect x="-10" y="120" width="90" height="130"/>
        <rect x="95" y="96" width="56" height="154"/>
        <rect x="170" y="132" width="72" height="118"/>
        <rect x="300" y="104" width="60" height="146"/>
        <rect x="430" y="126" width="78" height="124"/>
        <rect x="560" y="98" width="52" height="152"/>
        <rect x="640" y="128" width="86" height="122"/>
        <rect x="746" y="108" width="64" height="142"/>
        <polygon points="330,104 360,74 390,104"/>
        <polygon points="580,98 604,70 628,98"/>
      </g>
      <!-- 千厮门式斜拉桥 -->
      <g stroke="#141a38" stroke-width="7" fill="none">
        <line x1="470" y1="250" x2="500" y2="88"/>
        <line x1="500" y1="88" x2="436" y2="140"/>
        <line x1="500" y1="88" x2="566" y2="140"/>
        <line x1="500" y1="88" x2="420" y2="176"/>
        <line x1="500" y1="88" x2="586" y2="176"/>
      </g>
      <rect x="380" y="176" width="250" height="9" fill="#141a38"/>

      <!-- 洪崖洞吊脚楼群（近景·暖窗点亮） -->
      <g>
        <g fill="#151b3a">
          <rect x="28" y="150" width="120" height="100"/>
          <rect x="12" y="182" width="152" height="68"/>
          <polygon points="20,150 88,116 156,150"/>
          <polygon points="4,182 88,146 172,182"/>
          <rect x="150" y="168" width="58" height="82"/>
        </g>
        <!-- 屋檐翘角 -->
        <path d="M20,150 q-10,-6 -16,-2" stroke="#151b3a" stroke-width="6" fill="none"/>
        <path d="M156,150 q10,-6 16,-2" stroke="#151b3a" stroke-width="6" fill="none"/>
        <!-- 暖黄窗灯 -->
        <g fill="#ffb84d">
          <rect x="42" y="162" width="14" height="12" rx="2"/><rect x="70" y="162" width="14" height="12" rx="2"/>
          <rect x="98" y="162" width="14" height="12" rx="2"/><rect x="42" y="188" width="14" height="12" rx="2"/>
          <rect x="70" y="188" width="14" height="12" rx="2"/><rect x="98" y="188" width="14" height="12" rx="2"/>
          <rect x="126" y="188" width="14" height="12" rx="2"/><rect x="42" y="214" width="14" height="12" rx="2"/>
          <rect x="70" y="214" width="14" height="12" rx="2"/><rect x="98" y="214" width="14" height="12" rx="2"/>
          <rect x="160" y="180" width="12" height="10" rx="2"/><rect x="184" y="180" width="12" height="10" rx="2"/>
          <rect x="160" y="204" width="12" height="10" rx="2"/><rect x="184" y="204" width="12" height="10" rx="2"/>
        </g>
        <!-- 灯笼串 -->
        <g fill="#ff6b57">
          <circle cx="30" cy="158" r="5"/><circle cx="30" cy="176" r="5"/><circle cx="30" cy="194" r="5"/>
        </g>
      </g>

      <!-- 轻轨穿楼（李子坝） -->
      <g>
        <rect x="520" y="118" width="86" height="132" fill="#1a2145"/>
        <g fill="#f7d774">
          <rect x="530" y="132" width="14" height="11" rx="2"/><rect x="556" y="132" width="14" height="11" rx="2"/>
          <rect x="582" y="132" width="14" height="11" rx="2"/>
          <rect x="530" y="206" width="14" height="11" rx="2"/><rect x="556" y="206" width="14" height="11" rx="2"/>
          <rect x="582" y="206" width="14" height="11" rx="2"/>
        </g>
        <!-- 高架轨道 -->
        <rect x="400" y="166" width="340" height="7" fill="#10142e"/>
        <rect x="440" y="173" width="8" height="77" fill="#10142e"/>
        <rect x="700" y="173" width="8" height="77" fill="#10142e"/>
        <!-- 列车动画 -->
        <g class="home__train">
          <rect x="470" y="150" width="64" height="17" rx="5" fill="#e8ecf7"/>
          <rect x="475" y="154" width="12" height="8" rx="1.5" fill="#3b82f6"/>
          <rect x="492" y="154" width="12" height="8" rx="1.5" fill="#3b82f6"/>
          <rect x="509" y="154" width="12" height="8" rx="1.5" fill="#3b82f6"/>
        </g>
      </g>

      <!-- 江面倒影 -->
      <rect x="0" y="228" width="800" height="22" fill="#0c1230"/>
      <g stroke="#ffb84d" stroke-width="2.4" opacity=".5" stroke-linecap="round">
        <line x1="60" y1="236" x2="110" y2="236"/><line x1="150" y1="242" x2="190" y2="242"/>
        <line x1="540" y1="238" x2="600" y2="238"/><line x1="660" y1="244" x2="700" y2="244"/>
      </g>
      <g stroke="#7fa8ff" stroke-width="2" opacity=".35" stroke-linecap="round">
        <line x1="300" y1="240" x2="360" y2="240"/><line x1="420" y1="245" x2="470" y2="245"/>
      </g>
    </svg>

    <!-- 半调网点 -->
    <div class="home__halftone"></div>

    <!-- 漂浮装饰 -->
    <svg class="float-deco float-deco--die1" width="58" height="58" viewBox="0 0 46 46" aria-hidden="true">
      <rect x="2" y="2" width="42" height="42" rx="8" fill="#fff" stroke="#1a1a1a" stroke-width="3"/>
      <circle cx="14" cy="14" r="4.6" fill="#1a1a1a"/><circle cx="32" cy="32" r="4.6" fill="#1a1a1a"/>
      <circle cx="23" cy="23" r="4.6" fill="#1a1a1a"/>
    </svg>
    <svg class="float-deco float-deco--die2" width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
      <rect x="2" y="2" width="42" height="42" rx="8" fill="#fff" stroke="#1a1a1a" stroke-width="3"/>
      <circle cx="14" cy="14" r="4.6" fill="#1a1a1a"/><circle cx="32" cy="14" r="4.6" fill="#1a1a1a"/>
      <circle cx="14" cy="32" r="4.6" fill="#1a1a1a"/><circle cx="32" cy="32" r="4.6" fill="#1a1a1a"/>
    </svg>
    <svg class="float-deco float-deco--card" width="52" height="72" viewBox="0 0 52 72" aria-hidden="true">
      <rect x="2.5" y="2.5" width="47" height="67" rx="6" fill="#fffef0" stroke="#1a1a1a" stroke-width="3.4"/>
      <text x="26" y="47" text-anchor="middle" font-size="30" font-weight="900" fill="#ef4444">?</text>
    </svg>

    <!-- 主内容 -->
    <div class="home__content">
      <div class="home__logo">
        <h1 class="home__title"><span class="comic-stripe">大富翁——重庆之旅</span></h1>
        <span class="home__tag">🎲 掷骰闯山城 · 收地两江畔 🏙️</span>
      </div>

      <div class="home__btns">
        <button v-if="savedGame" class="btn-comic btn-comic--green home__btn--rejoin" @click="emit('rejoin', savedGame)">
          ↩️ 返回游戏
          <span class="btn-comic__sub">房间 {{ savedGame.roomId }} · {{ savedGame.playerName }}</span>
        </button>
        <button class="btn-comic home__btn--start" @click="emit('start')">🎮 开始游戏</button>
        <button class="btn-comic btn-comic--ghost" @click="emit('openEncyclopedia')">📖 玩法图鉴</button>
      </div>

      <div class="home__foot">
        <span class="home__settings-link" @click="showSettings = true">⚙️ 服务器设置</span>
        <span class="home__version">v3.1 · Comic Style</span>
      </div>
    </div>

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
/* ================= 两江夜景首页 ================= */
.home {
  position: fixed;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #101a3c 0%, #1c2a58 38%, #43306b 62%, #8a4a54 84%, #d97b4a 100%);
  z-index: 0;
}

/* 星空 */
.home__stars {
  position: absolute; top: 0; left: 0; right: 0; height: 55%;
  pointer-events: none; z-index: 0;
}
.home__stars i {
  position: absolute; width: 3px; height: 3px; border-radius: 50%;
  background: #fffef0; opacity: .85;
  animation: home-twinkle 2.6s ease-in-out infinite;
}
.home__stars i:nth-child(2n) { animation-delay: .9s; width: 2px; height: 2px; }
.home__stars i:nth-child(3n) { animation-delay: 1.6s; }
@keyframes home-twinkle { 0%,100% {opacity:.25} 50% {opacity:.95} }

/* 月亮 */
.home__moon {
  position: absolute; top: max(48px, calc(48px + var(--safe-top, 0px))); right: 9%;
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--paper);
  border: 4px solid rgba(26,26,26,.85);
  box-shadow: 0 0 34px 10px rgba(255,254,240,.35);
  z-index: 0;
}

/* 半调网点 */
.home__halftone {
  position: absolute; inset: 0;
  background-image: radial-gradient(circle, rgba(255,255,254,0.10) 1.2px, transparent 1.2px);
  background-size: 7px 7px;
  pointer-events: none;
  z-index: 1;
}

/* 城市天际线 */
.home__skyline {
  position: absolute; left: 0; right: 0; bottom: 0;
  width: 100%;
  z-index: 1;
  pointer-events: none;
}

/* 轻轨列车动画 */
.home__train {
  animation: home-train-run 9s ease-in-out infinite alternate;
}
@keyframes home-train-run {
  0%   { transform: translateX(-150px); }
  45%  { transform: translateX(60px); }
  55%  { transform: translateX(60px); }
  100% { transform: translateX(230px); }
}

/* 漂浮装饰 */
.float-deco {
  position: absolute; z-index: 2; pointer-events: none;
  filter: drop-shadow(4px 5px 0 rgba(0,0,0,.35));
  animation: home-float 6s ease-in-out infinite;
}
.float-deco--die1 { left: 8%;  top: 24%; transform: rotate(-14deg); }
.float-deco--die2 { right: 10%; top: 40%; animation-delay: 1.5s; transform: rotate(11deg); }
.float-deco--card { right: 17%; top: 17%; animation-delay: 3s; transform: rotate(8deg); }
@keyframes home-float { 0%,100% { translate: 0 0; } 50% { translate: 0 -16px; } }
@media (max-width: 700px) {
  .float-deco--card { display: none; }
  .float-deco--die1 { left: 4%; } .float-deco--die2 { right: 4%; }
}

/* 主内容 */
.home__content {
  position: relative; z-index: 3;
  display: flex; flex-direction: column; align-items: center;
  gap: 22px;
  padding: 24px 20px calc(120px + var(--safe-bottom, 0px));
  max-width: 100%;
}

/* 标题区域 */
.home__logo { text-align: center; animation: home-logo-bounce 2.4s ease-in-out infinite; }
@keyframes home-logo-bounce {
  0%,100% { transform: translateY(0) rotate(-3deg); }
  50%     { transform: translateY(-10px) rotate(3deg); }
}
.home__title {
  font-weight: 900;
  letter-spacing: .06em;
  font-size: clamp(24px, 5.6vw, 42px);
  line-height: 1.25;
}
.home__tag {
  margin-top: 12px;
  display: inline-block;
  padding: 5px 18px;
  border: 3px solid rgba(26,26,26,.9);
  border-radius: 999px;
  background: rgba(255,254,240,.92);
  box-shadow: 3px 3px 0 0 rgba(26,26,26,.85);
  font-size: clamp(12px, 2.4vw, 16px);
  letter-spacing: .12em;
}

/* 按钮组 */
.home__btns {
  display: flex; flex-direction: column; gap: 14px; align-items: stretch;
  width: min(300px, 80vw); margin-top: 6px;
}
.home__btn--rejoin {
  display: flex; flex-direction: column; gap: 3px; align-items: center;
}
.btn-comic__sub {
  font-size: 11px; font-weight: 700; opacity: .85;
}
.home__btn--start {
  padding: 15px 30px;
  font-size: 19px;
}

/* 底部信息 */
.home__foot {
  display: flex; gap: 18px; align-items: center;
  font-size: 13px; color: rgba(255,254,240,.75);
  z-index: 3; flex-wrap: wrap; justify-content: center;
}
.home__settings-link {
  cursor: pointer; text-decoration: underline dotted; color: inherit;
}
.home__settings-link:hover { opacity: .8; }
.home__version { font-size: 12px; }

/* 服务器设置弹窗 */
.overlay-layer {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.server-modal { max-width: 360px; width: 90%; }
.server-modal__hint { font-size: 13px; opacity: 0.6; margin: 8px 0 12px; }
.server-modal__btns { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
</style>