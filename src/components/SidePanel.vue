<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import ComicIcon from './ComicIcon.vue'
import { TILES, VEHICLES, GROUPS, SHOPS, isPropertyTile, isBridge, isMetro, totalAssets, groupTiles, groupRequired, typeGroupInfo } from '../game/index.js'
import { getSocket } from '../net/socket.js'

const props = defineProps({
  state: Object,
  current: Object, // 当前回合玩家（状态标记用）
  me: Object, // 我自己（交易入口判断用：不对自己发起交易）
  selectablePlayers: { type: Array, default: () => [] },
})
const emit = defineEmits(['playerClick', 'trade'])

const expanded = ref(null) // 展开的玩家 id
const logCollapsed = ref(true) // 事件记录折叠状态（默认折叠）

// 金钱滚动动画：追踪每个玩家的显示金额
const displayMoney = ref({}) // { playerId: 当前显示值 }
const moneyAnimating = ref({}) // { playerId: true/false }

// 初始化 + 同步金额
watch(
  () => props.state.players.map(p => `${p.id}:${p.money}`).join(','),
  () => {
    const players = props.state.players
    for (const p of players) {
      const prev = displayMoney.value[p.id]
      if (prev !== undefined && prev !== p.money) {
        // 触发滚动
        animateMoney(p.id, prev, p.money)
      } else {
        displayMoney.value[p.id] = p.money
      }
    }
  }
)

function animateMoney(pid, from, to) {
  moneyAnimating.value[pid] = true
  const duration = 400
  const start = performance.now()
  function step(now) {
    const t = Math.min(1, (now - start) / duration)
    // easeOutCubic
    const ease = 1 - Math.pow(1 - t, 3)
    displayMoney.value[pid] = Math.round(from + (to - from) * ease)
    if (t < 1) {
      requestAnimationFrame(step)
    } else {
      displayMoney.value[pid] = to
      moneyAnimating.value[pid] = false
    }
  }
  requestAnimationFrame(step)
}

// 资产曲线数据：为每个玩家生成 SVG 路径点
function assetCurvePath(playerId) {
  const history = props.state.assetHistory?.[playerId]
  if (!history || history.length < 2) return null
  const max = Math.max(...history, 1)
  const min = Math.min(...history, 0)
  const range = max - min || 1
  const w = 100, h = 30
  const points = history.map((v, i) => {
    const x = (i / (history.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return `M${points.join(' L')}`
}

function assetCurveColor(playerId) {
  const history = props.state.assetHistory?.[playerId]
  if (!history || history.length < 2) return '#999'
  const first = history[0]
  const last = history[history.length - 1]
  return last >= first ? '#22c55e' : '#ef4444'
}

function assetCurveChange(playerId) {
  const history = props.state.assetHistory?.[playerId]
  if (!history || history.length < 2) return 0
  return history[history.length - 1] - history[history.length - 2]
}
const logEl = ref(null)
const chatEl = ref(null)
const chatDraft = ref('')
const chatMessages = ref([
  { kind: 'system', text: '欢迎来到大富翁——重庆之旅！聊天功能为联机预留，敬请期待。' },
])
const logUserScroll = ref(false) // 用户手动上滚时不自动追底

// 事件记录：仅在用户没手动上滚时自动追底
watch(
  () => props.state.log.length,
  () => {
    if (!logUserScroll.value) {
      nextTick(() => {
        if (logEl.value) logEl.value.scrollTop = 0 // reverse 排列，最新在最上面 = 滚到顶
      })
    }
  }
)

function onLogScroll() {
  if (!logEl.value) return
  // 判断用户是否滚到了顶部附近（< 30px）
  logUserScroll.value = logEl.value.scrollTop > 30
}

// 聊天消息自动滚到底
watch(
  () => chatMessages.value.length,
  () => {
    nextTick(() => {
      if (chatEl.value) chatEl.value.scrollTop = chatEl.value.scrollHeight
    })
  }
)

// 联机聊天：监听 socket chat 事件
onMounted(() => {
  const s = getSocket()
  if (s) {
    s.on('chat', (msg) => {
      chatMessages.value.push({ kind: msg.from === 'system' ? 'system' : 'user', who: msg.from, text: msg.text })
    })
  }
})

onBeforeUnmount(() => {
  const s = getSocket()
  if (s) s.off('chat')
})

function sendChat() {
  const text = chatDraft.value.trim()
  if (!text) return
  const s = getSocket()
  if (s) {
    s.emit('chat', { text })  // 联机：发给服务器广播
  } else {
    chatMessages.value.push({ kind: 'system', text: '单机模式下无法聊天' })
  }
  chatDraft.value = ''
}

const players = computed(() => props.state.players)

function statusOf(p) {
  if (p.bankrupt) return '破产'
  if (p.id === props.current?.id) return '行动中'
  if (p.jailLeft > 0) return `监狱 ${p.jailLeft}`
  if (p.skipTurns > 0) return '定住'
  if (p.hospital) return '住院'
  return ''
}

function toggle(p) {
  if (props.selectablePlayers.includes(p.id)) {
    emit('playerClick', p.id)
    return
  }
  expanded.value = expanded.value === p.id ? null : p.id
}

function landList(p) {
  return p.properties.map((i) => {
    const t = TILES[i]
    const lv = p.levels[i] ?? 0
    const tag = isBridge(t) ? '桥' : isMetro(t) ? '轻轨' : ''
    return { name: t.name, tag, shop: SHOPS[lv], lv }
  })
}

function groupsOf(p) {
  const own = {}
  for (const i of p.properties) {
    const g = TILES[i].group
    if (g && isPropertyTile(TILES[i])) {
      own[g] = (own[g] ?? 0) + 1
    }
  }
  const groups = Object.entries(own).map(([g, n]) => ({
    name: GROUPS[g].name,
    n,
    total: groupTiles(g).length,
    need: groupRequired(g),
    done: n >= groupRequired(g),
  }))
  // 类型组合：景区之王 / 轻轨大亨
  for (const type of ['scenic', 'station']) {
    if (p.properties.some((i) => TILES[i]?.type === type)) {
      groups.push(typeGroupInfo(p, type))
    }
  }
  return groups
}

function onPlayer(p) {
  if (props.selectablePlayers.includes(p.id)) emit('playerClick', p.id)
}
</script>

<template>
  <aside class="side">
    <section class="side__block card-comic">
      <h2 class="comic-title comic-title--md">玩家</h2>
      <ul class="players">
        <li
          v-for="p in players"
          :key="p.id"
          class="player"
          :class="{
            'player--dead': p.bankrupt,
            'player--turn': p.id === current?.id,
            'player--sel': selectablePlayers.includes(p.id),
            'player--open': expanded === p.id,
          }"
          @click="toggle(p)"
        >
          <div class="player__row">
            <i class="player__dot" :style="{ background: p.color }">
              <em v-if="p.vehicle !== 'walk'" class="player__veh"><ComicIcon :name="VEHICLES[p.vehicle].icon" :size="13" /></em>
            </i>
            <span class="player__name">{{ p.name }}<em v-if="p.isAI">AI</em></span>
            <span class="player__status">{{ statusOf(p) }}</span>
            <span class="player__money" :class="{ 'player__money--debt': p.bankrupt && p.money < 0, 'player__money--anim': moneyAnimating[p.id] }">
              {{ p.bankrupt && p.money < 0 ? '欠¥' + -displayMoney[p.id] : '¥' + (displayMoney[p.id] ?? p.money) }}
            </span>
            <i class="cnt" title="卡片积分" style="font-style: normal; font-weight: 900; color: #2563eb">{{ p.points ?? 0 }}</i>
            <span class="player__counts">
              <i v-if="p.id === current?.id" class="cnt" title="卡片"><ComicIcon name="card" :size="12" />{{ p.hand.length }}</i>
              <i v-else class="cnt" title="卡片" style="opacity:0.4">🎴 ???</i>
              <i class="cnt" title="地产"><ComicIcon name="home" :size="12" />{{ p.properties.length }}</i>
            </span>
            <span class="player__arrow">{{ expanded === p.id ? '▲' : '▼' }}</span>
          </div>

          <!-- 展开详情 -->
          <div v-if="expanded === p.id" class="player__detail">
            <div class="pd__row">
              <span class="pd__label">总资产</span>
              <span class="pd__val">¥{{ totalAssets(p) }}</span>
              <span v-if="assetCurveChange(p.id) !== 0" class="pd__delta" :class="assetCurveChange(p.id) > 0 ? 'pd__delta--up' : 'pd__delta--down'">
                {{ assetCurveChange(p.id) > 0 ? '↑' : '↓' }}¥{{ Math.abs(assetCurveChange(p.id)) }}
              </span>
            </div>
            <!-- 资产曲线 -->
            <div v-if="assetCurvePath(p.id)" class="pd__row pd__row--chart">
              <svg class="pd__chart" viewBox="0 0 100 30" preserveAspectRatio="none">
                <path :d="assetCurvePath(p.id)" fill="none" :stroke="assetCurveColor(p.id)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div class="pd__row">
              <span class="pd__label">载具</span>
              <span class="pd__val"><ComicIcon :name="VEHICLES[p.vehicle].icon" :size="15" /> {{ VEHICLES[p.vehicle].name }}（{{ VEHICLES[p.vehicle].dice }} 骰）</span>
            </div>
            <div v-if="landList(p).length" class="pd__row">
              <span class="pd__label">地产</span>
              <span class="pd__val pd__lands">
                <span v-for="(l, i) in landList(p)" :key="i" class="pd__land">
                  {{ l.name }}<b v-if="l.tag" class="pd__tag">{{ l.tag }}</b>
                  <em v-if="l.lv > 0" class="pd__shop">Lv{{ l.lv }}</em>
                </span>
              </span>
            </div>
            <div v-if="groupsOf(p).length" class="pd__row">
              <span class="pd__label">组合</span>
              <span class="pd__val pd__groups">
                <span v-for="(g, i) in groupsOf(p)" :key="i" class="pd__group">
                  {{ g.name }}
                  <span class="pd__progress">
                    <span class="pd__progress-bar" :style="{ width: Math.min(100, g.n / g.total * 100) + '%' }"></span>
                  </span>
                  <em class="pd__need">{{ g.n }}/{{ g.total }}</em>
                  <b v-if="g.done" class="tag-comic tag-comic--red">×1.5</b>
                </span>
              </span>
            </div>
            <div v-if="p.id === current?.id" class="pd__row">
              <span class="pd__label">手牌</span>
              <span class="pd__val pd__bag">
                <ComicIcon name="card" :size="13" />{{ p.hand.map((c) => c.name).join('、') || '无' }}
              </span>
            </div>
            <!-- 发起交易按钮（不对自己显示） -->
            <div v-if="p.id !== me?.id" class="pd__row pd__row--trade">
              <button class="btn-comic btn-comic--sm btn-comic--blue trade-btn" @click="emit('trade', p.id)">
                🤝 发起交易
              </button>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <section class="side__block card-comic side__block--grow">
      <h2 class="comic-title comic-title--md collapsible-header" @click="logCollapsed = !logCollapsed">
        事件记录 <span class="collapsible-arrow">{{ logCollapsed ? '▸' : '▾' }}</span>
      </h2>
      <ul v-show="!logCollapsed" ref="logEl" class="log" @scroll="onLogScroll">
        <li v-for="(line, i) in [...state.log].reverse()" :key="i" class="log__line">{{ line }}</li>
      </ul>
      <p v-show="logCollapsed" class="log__latest">{{ state.log[state.log.length - 1] || '暂无事件' }}</p>
      <!-- 聊天框（联机预留） -->
      <div class="chat">
        <div class="chat__head"><ComicIcon name="chat" :size="14" /> 聊天</div>
        <ul ref="chatEl" class="chat__msgs">
          <li v-for="(msg, i) in chatMessages" :key="i" class="chat__msg" :class="'chat__msg--' + msg.kind">
            <span v-if="msg.kind === 'system'" class="chat__sys">{{ msg.text }}</span>
            <span v-else class="chat__who">{{ msg.who }}：</span>
            <span v-if="msg.kind !== 'system'" class="chat__text">{{ msg.text }}</span>
          </li>
        </ul>
        <div class="chat__input">
          <input
            v-model="chatDraft"
            class="chat__field"
            placeholder="联机功能即将上线..."
            disabled
            @keydown.enter="sendChat"
          />
          <button class="chat__send" disabled>发送</button>
        </div>
      </div>
    </section>

  </aside>
</template>

<style scoped>
.side {
  display: flex;
  flex-direction: column;
  gap: 21px;
  min-width: 0;
}

.side__block {
  padding: 16px 19px;
}

.side__block--grow {
  max-height: 507px;
  display: flex;
  flex-direction: column;
}

.players {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 11px;
}

.player {
  border: 2.5px solid var(--ink);
  border-radius: 11px;
  background: #fff;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.player:hover {
  transform: translate(-1.5px, -1.5px);
  box-shadow: 4px 4px 0 0 var(--ink);
}

.player--sel {
  outline: 3px solid var(--pop-yellow);
  outline-offset: 1px;
  animation: pulse 0.9s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { outline-width: 3px; }
  50% { outline-width: 5px; }
}

.player--turn {
  background: #fff3c4;
  box-shadow: 2px 2px 0 0 var(--ink);
}

.player--dead {
  opacity: 0.45;
}

.player__row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 13px;
}

.player__dot {
  position: relative;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  border: 2.5px solid var(--ink);
  flex-shrink: 0;
}

.player__veh {
  position: absolute;
  top: -11px;
  left: 50%;
  transform: translateX(-50%);
  font-style: normal;
  font-size: 15px;
}

.player__name {
  font-size: 17px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player__name em {
  font-style: normal;
  font-size: 12px;
  color: #fff;
  background: var(--pop-red);
  border: 1px solid var(--ink);
  border-radius: 4px;
  padding: 0 3px;
  margin-left: 3px;
}

.player__status {
  font-size: 12px;
  font-weight: 900;
  opacity: 0.6;
  flex-shrink: 0;
}

.player__money {
  font-size: 17px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  margin-left: auto;
  flex-shrink: 0;
}

.player__money--debt {
  color: var(--pop-red);
}
.player__money--anim {
  transition: none;
  color: var(--pop-blue);
}

.player__counts {
  display: inline-flex;
  gap: 7px;
  font-size: 15px;
  font-weight: 900;
  flex-shrink: 0;
}

.cnt {
  font-style: normal;
  border: 2px solid var(--ink);
  border-radius: 7px;
  padding: 0 5px;
  background: #fffef0;
}

.player__arrow {
  font-size: 12px;
  opacity: 0.6;
}

.player__detail {
  border-top: 2.5px dashed var(--ink);
  padding: 11px 13px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  background: #fffef0;
  border-radius: 0 0 8px 8px;
}

.pd__row {
  display: flex;
  gap: 11px;
  align-items: baseline;
}

.pd__label {
  width: 75px;
  flex-shrink: 0;
  font-size: 15px;
  font-weight: 900;
  opacity: 0.6;
}

.pd__val {
  font-size: 16px;
  font-weight: 900;
}

.pd__lands {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.pd__land {
  white-space: nowrap;
}

.pd__tag {
  font-size: 12px;
  color: var(--pop-blue);
  margin-left: 3px;
}

.pd__shop {
  font-style: normal;
  font-size: 13px;
  color: var(--pop-red);
  margin-left: 3px;
}

.pd__groups {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.pd__group {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.pd__progress {
  display: inline-block;
  width: 40px;
  height: 7px;
  border: 1.5px solid var(--ink);
  border-radius: 3px;
  background: #fff;
  overflow: hidden;
}

.pd__progress-bar {
  display: block;
  height: 100%;
  background: var(--pop-blue);
  transition: width 0.3s ease;
}

.pd__bag {
  line-height: 1.5;
}

.pd__delta {
  font-size: 12px;
  font-weight: 900;
  margin-left: 6px;
}
.pd__delta--up { color: #22c55e; }
.pd__delta--down { color: #ef4444; }

.pd__row--chart {
  margin-top: -4px;
}
.pd__chart {
  width: 100%;
  height: 30px;
  border: 1.5px solid var(--ink);
  border-radius: 4px;
  background: #fff;
}

.pd__row--trade {
  justify-content: center;
  padding-top: 4px;
  border-top: 2px dashed rgba(26,26,26,0.2);
  margin-top: 4px;
}

.log {
  list-style: none;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 5px;
  margin-top: 11px;
  max-height: 220px;
  flex: 1 1 auto;
  min-height: 80px;
}

.log__line {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
  border-bottom: 2.5px dashed var(--ink);
  padding-bottom: 5px;
  opacity: 0.85;
}

/* ===== 聊天框（联机预留） ===== */
.chat {
  border-top: 2.5px dashed var(--ink);
  margin-top: 11px;
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 0 0 auto;
}

.chat__head {
  font-size: 13px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  opacity: 0.7;
}

.chat__msgs {
  list-style: none;
  max-height: 100px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: #fffef0;
  border: 2px solid var(--ink);
  border-radius: 7px;
}

.chat__msg {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.chat__msg--system {
  color: var(--pop-blue);
  font-style: italic;
}

.chat__who {
  font-weight: 900;
  color: var(--pop-red);
}

.chat__input {
  display: flex;
  gap: 5px;
}

.chat__field {
  flex: 1;
  border: 2px solid var(--ink);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 700;
  background: #f5f5f5;
  font-family: inherit;
}

.chat__field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat__send {
  border: 2px solid var(--ink);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 900;
  background: var(--pop-yellow);
  cursor: pointer;
  font-family: inherit;
}

.chat__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 折叠面板 */
.collapsible-header {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.collapsible-arrow {
  font-size: 14px;
  opacity: 0.6;
}
.log__latest {
  font-size: 12px;
  opacity: 0.7;
  padding: 4px 0;
  margin: 0;
}

/* 横屏：右侧面板布局 */
@media (orientation: landscape) and (max-height: 500px) {
  .side {
    gap: 8px;
    height: 100%;
  }
  .side__block {
    padding: 8px 10px;
  }
  .side__block--grow {
    flex: 1;
    max-height: none;
    min-height: 0;
  }
  .log {
    max-height: none;
    flex: 1;
  }
}

</style>
