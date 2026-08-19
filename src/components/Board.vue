<script setup>
import { ref, computed } from 'vue'
import ComicIcon from './ComicIcon.vue'
import BoardFx from './BoardFx.vue'
import { TILES, METRO_STATIONS, PATH_POLYLINE, tilePosition, isPropertyTile, isMetro, SHOPS, playerInitial, GODS } from '../game/index.js'

const props = defineProps({
  state: Object,
  current: Object,
  selectable: { type: Array, default: () => [] },
  teleportMode: Boolean, // 调试传送模式：所有格子点击 = 传送目标
  lastMove: Object, // 由 App 传入：{ prevPos, nextPos }
  hidePawns: Boolean, // 保留但不再使用（改用 extraHidePids 单独隐藏）
  extraHidePids: { type: Array, default: () => [] }, // 额外要隐藏的玩家 id（动画期间只隐藏这些玩家）
})
const emit = defineEmits(['tileClick', 'upgrade', 'tileInfo'])

const shaking = ref(false)
const movingPids = ref(new Set()) // 正在走格动画的玩家（隐藏真实棋子，避免双影）
function onBoom() {
  shaking.value = true
  setTimeout(() => (shaking.value = false), 450)
}
function onWalking(pids) {
  movingPids.value = new Set(pids)
}

// 全部格子的坐标表（供特效层复用，与格子渲染同一来源）
const posMap = computed(() => {
  const m = {}
  for (const t of TILES) if (t && !t.removed) m[t.id] = tilePosition(t.id)
  return m
})

const tiles = computed(() => TILES.filter((t) => t && !t.removed))

// 折线路径线（直接从 PATH_POLYLINE 拐点连接）
const pathLine = computed(() => PATH_POLYLINE)

// 轻轨线：按站坐标动态连线（红土地9 → 李子坝28 → 山城电梯44）
const metroLine = computed(() => {
  return METRO_STATIONS.map((id) => {
    const p = tilePosition(id)
    return `${p.x},${p.y}`
  }).join(' ')
})

// 行进方向箭头：每 3 格放一个，指向顺时针下一格
const arrows = computed(() => {
  const arr = []
  const ids = tiles.value.map((t) => t.id)
  for (let i = 0; i < ids.length; i += 3) {
    const a = tilePosition(ids[i])
    const b = tilePosition(ids[(i + 1) % ids.length])
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const angle = (Math.atan2(b.y - a.y, (b.x - a.x)) * 180) / Math.PI
    arr.push({ x: mx, y: my, angle })
  }
  return arr
})

function posOf(id) {
  return tilePosition(id)
}

function isFork(t) {
  // 3 个及以上邻居 = 分岔点（2 邻居 = 直行，无分岔标签）
  return !!(t.neighbors && t.neighbors.length >= 3)
}

// 格子像素尺寸：网格 10 列 × 9 行，单格占 9.4%×10.6%（留极细缝防边框重叠）；
// 大块（大渡口/北碚 w=2、朝天门 h=3）按 w/h 倍率撑开，做到无缝拼接
function tileSize(t) {
  const BASE_W = 9.4
  const BASE_H = 10.6
  return {
    w: (BASE_W * (t.w || 1)).toFixed(2) + '%',
    h: (BASE_H * (t.h || 1)).toFixed(2) + '%',
  }
}

// 按名字长度自适应字号：直接用 cqw（=棋盘宽的 1%），与格子尺寸同一参考系，
// 不使用 px 封顶/保底，保证缩放时字与格子永远同比例（不再脱钩）
function nameFont(name) {
  const len = name.length
  if (len <= 3) return '1.55cqw'
  if (len === 4) return '1.35cqw'
  if (len === 5) return '1.18cqw'
  return '1.0cqw' // 6 字及以上
}

// 格子背景：默认白色；被某玩家购买后涂上该玩家颜色；朝天门（起点）用 CSS 棕色斜条纹
function tileBg(t) {
  if (t.type === 'start') return undefined
  const o = ownerOf(t.id)
  return o ? o.color : '#ffffff'
}

// 文字颜色：按背景亮度自适应（深底白字 / 浅底黑字）
function isDarkColor(hex) {
  const c = (hex || '#ffffff').replace('#', '')
  const r = parseInt(c.slice(0, 2), 16) || 255
  const g = parseInt(c.slice(2, 4), 16) || 255
  const b = parseInt(c.slice(4, 6), 16) || 255
  return (r * 299 + g * 587 + b * 114) / 1000 < 140
}
function tileFg(t) {
  const o = ownerOf(t.id)
  if (t.type === 'start') return '#ffffff'
  if (o) return isDarkColor(o.color) ? '#ffffff' : '#1a1a1a'
  return '#1a1a1a'
}

// 格子"属性颜色"：用于外框线与漫画硬边阴影（商圈紫/景点绿/轻轨青/普通地产黑/起点红/奖励金/事件黄）
function tileAttrColor(t) {
  switch (t.type) {
    case 'start': return '#ef4444'
    case 'corner': return '#f59e0b'
    case 'chance': return '#facc15'
    case 'scenic': return '#22c55e'
    case 'station': return '#0891b2'
    case 'mall': return '#8b5cf6'
    default: return '#1a1a1a' // 普通地产 = 黑色
  }
}

function ownerOf(id) {
  return props.state.players.find((p) => p.alive && p.properties.includes(id))
}

function levelOf(id) {
  const o = ownerOf(id)
  return o ? o.levels[id] ?? 0 : 0
}

function shopOf(id) {
  return SHOPS[levelOf(id)]
}

function playersOn(id) {
  return props.state.players.filter((p) => p.alive && p.pos === id)
}

function godIcon(godId) {
  return GODS[godId]?.icon || '✨'
}

// 无主地且轮到我+可买 → 高亮
function isUnownedHighlight(t) {
  if (!isPropertyTile(t) || ownerOf(t.id)) return false
  const me = props.current
  if (!me || me.isAI) return false
  if (props.state.phase !== 'roll') return false
  return true
}

function isMortgagedTile(t) {
  if (!isPropertyTile(t)) return false
  const o = ownerOf(t.id)
  if (!o) return false
  return !!(o.mortgaged && o.mortgaged[t.id])
}

// 同格棋子的居中网格布局：列数随人数自适应，棋子尺寸随人数缩小，保证协调不溢出
function pawnStyle(id) {
  const n = playersOn(id).length
  let cols = 2
  if (n <= 1) cols = 1
  else if (n <= 4) cols = 2
  else if (n === 8) cols = 4 // 8 个同格 → 4×2 整齐排布
  else cols = 3
  const ps = n >= 8 ? '1.7cqw' : n >= 5 ? '2.0cqw' : '2.4cqw'
  return { '--cols': cols, '--ps': ps }
}

function isClosed(id) {
  return (props.state.closedBridges[id] ?? 0) > 0
}

function upgradable(id) {
  const p = props.current
  if (!p || p.isAI) return false
  const tile = TILES[id]
  if (!isPropertyTile(tile) || !p.properties.includes(id)) return false
  if (tile.type === 'station' && !tile.upgradable) return false
  const level = p.levels[id] ?? 0
  return level < 3
}

function onTile(t) {
  // 调试传送模式：所有格子点击都当作传送目标（不弹详情）
  if (props.teleportMode) {
    emit('tileClick', t.id)
    return
  }
  if (props.selectable.includes(t.id)) {
    emit('tileClick', t.id)
  } else if (upgradable(t.id)) {
    emit('tileInfo', t.id) // 点自己的可升级地 → 弹详情（详情里有升级按钮）
  } else {
    emit('tileInfo', t.id)
  }
}
</script>

<template>
  <div class="board" :class="{ 'board--shake': shaking }">
    <svg class="board__bg" viewBox="0 0 100 88" preserveAspectRatio="none" aria-hidden="true">
      <!-- 轻轨线（立体交通） -->
      <polyline :points="metroLine" fill="none" stroke="#a855f7" stroke-width="1.3" stroke-dasharray="2.6 2.2" opacity="0.9" />
      <!-- 折线闭环路径线 -->
      <polyline :points="pathLine" fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linejoin="round" opacity="0.85" />
      <!-- 行进方向箭头 -->
      <polygon
        v-for="(ar, i) in arrows"
        :key="'ar' + i"
        :points="'0,0 -5,-3.5 -5,3.5'"
        :transform="`translate(${ar.x} ${ar.y}) rotate(${ar.angle})`"
        fill="#1a1a1a"
        opacity="0.7"
      />
    </svg>

    <div
      v-for="t in tiles"
      :key="t.id"
      class="tile"
      :class="{
        'tile--sel': selectable.includes(t.id),
        'tile--up': upgradable(t.id),
        'tile--fork': isFork(t),
        'tile--start': t.type === 'start',
        'tile--unowned': isUnownedHighlight(t),
        'tile--mortgaged': isMortgagedTile(t),
      }"
      :style="{ left: posOf(t.id).x + '%', top: posOf(t.id).y + '%', width: tileSize(t).w, height: tileSize(t).h, background: tileBg(t), color: tileFg(t), '--attr': tileAttrColor(t) }"
      :title="t.name + (t.sub ? ' · ' + t.sub : '') + (ownerOf(t.id) ? ' · 拥有者 ' + ownerOf(t.id).name : '')"
      @click="onTile(t)"
    >
      <span class="tile__num">{{ t.id }}</span>
      <span v-if="isFork(t)" class="tile__fork" title="分岔路口：可自选路线">分</span>
      <span class="tile__name" :style="{ fontSize: nameFont(t.name) }">{{ t.name }}</span>
      <span v-if="isPropertyTile(t) && t.price" class="tile__price">¥{{ t.price }}<span v-if="t.points" class="tile__points">{{ t.points }}</span></span>
      <span v-if="t.shop" class="tile__cardshop" title="卡片商店：路过可购买卡片">卡</span>
      <span v-if="t.lottery" class="tile__lottery-mark" title="彩票站">🎫</span>
      <span v-if="t.god" class="tile__god-mark" title="神仙格">👻</span>

      <span v-if="isClosed(t.id)" class="tile__closed"><ComicIcon name="closed" :size="16" /></span>

      <!-- 路障标记（路障存在 state.barriers，不污染全局 TILES） -->
      <span v-if="state.barriers?.[t.id]" class="tile__barrier" title="路障">🚧</span>

      <span v-if="isPropertyTile(t) && ownerOf(t.id) && levelOf(t.id) > 0" class="tile__shop" :title="'等级' + levelOf(t.id)">
        {{ levelOf(t.id) }}
      </span>
      <span v-if="isPropertyTile(t) && ownerOf(t.id)" class="tile__owner" :style="{ background: ownerOf(t.id).color }"></span>

      <span class="tile__pawns" :style="pawnStyle(t.id)">
        <span
          v-for="p in playersOn(t.id)"
          :key="p.id"
          class="pawn"
          :class="{ 'pawn--moving': movingPids.has(p.id) || props.extraHidePids.includes(p.id) }"
          :style="{ '--pc': p.color }"
          :title="p.name"
        >
          <!-- 神仙附身角标 -->
          <em v-if="p.god" class="pawn__god-mark">{{ godIcon(p.god) }}</em>
          <i class="pawn__face">{{ playerInitial(p) }}</i>
          <em class="pawn__tag">{{ p.name }}</em>
        </span>
      </span>
    </div>

    <!-- 漫画特效层 -->
    <BoardFx :state="state" :last-move="lastMove" :pos-map="posMap" @boom="onBoom" @walking="onWalking" />
  </div>
</template>

<style scoped>
.board {
  position: relative;
  /* 固定像素宽度：Chrome Ctrl+/- 缩放时，固定 px 会和文字一起正常缩放；
     而 100%/vw/vh 这类"占满视口"的尺寸缩放时不会变小，会和文字脱钩。
     代价：宽屏两侧有留白——觉得小就 Ctrl+ 放大（放大缩小都同步）。 */
  width: 1000px;
  margin: 0 auto;
  aspect-ratio: 100 / 85;
  container-type: inline-size;
  border: 4px solid var(--ink);
  border-radius: 10px;
  background: #fffef0;
  overflow: hidden;
  box-shadow: 6px 6px 0 0 var(--ink);
}

.board__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.tile {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  border: 5px solid var(--attr, var(--ink));
  border-radius: 7px;
  padding: 2px 3px;
  user-select: none;
  cursor: default;
  text-align: center;
  box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.55), 3px 3px 0 0 var(--attr, var(--ink));
  z-index: 2;
}

/* 朝天门（起点）：棕色斜条纹 */
.tile--start {
  background: repeating-linear-gradient(45deg, #7a5230 0px, #7a5230 10px, #b98d5f 10px, #b98d5f 20px);
}

/* 抵押地：灰色斜纹遮罩 */
.tile--mortgaged {
  background: repeating-linear-gradient(45deg, #d1d5db 0px, #d1d5db 6px, #9ca3af 6px, #9ca3af 12px) !important;
}
.tile--mortgaged::after {
  content: '🏦';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.8cqw;
  opacity: 0.5;
}

/* 无主地高亮（轮到我且掷骰阶段） */
.tile--unowned {
  animation: tile-pulse 1.5s ease-in-out infinite;
}
@keyframes tile-pulse {
  0%, 100% { box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.55), 3px 3px 0 0 var(--attr, var(--ink)); }
  50% { box-shadow: inset 0 0 0 2px var(--pop-yellow), 3px 3px 0 0 var(--attr, var(--ink)), 0 0 8px rgba(250, 204, 21, 0.6); }
}

/* 江岸格（跨江出发格）：水波标记 + 蓝色描边（硬阴影同属性色） */
.tile--bank {
  box-shadow: 0 0 0 2px #2563eb, 2px 2px 0 0 var(--attr, var(--ink));
}

.tile__bank-mark {
  position: absolute;
  top: -7px;
  left: -5px;
  font-size: 1.1cqw;
  line-height: 1;
}

/* 分岔路口：外框/阴影与属性色统一（分岔提示由右上角"分"角标承担） */
.tile--fork {
  box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.55), 3px 3px 0 0 var(--attr, var(--ink));
}

.tile__fork {
  position: absolute;
  top: -7px;
  right: -6px;
  font-size: 1.0cqw;
  font-weight: 900;
  line-height: 1;
  width: 1.5em;
  height: 1.5em;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f59e0b;
  color: #1a1a1a;
  border: 1.5px solid var(--ink);
  box-shadow: 1px 1px 0 0 rgba(26, 26, 26, 0.8);
}

.tile__num {
  position: absolute;
  top: 1px;
  left: 3px;
  font-size: 0.95cqw;
  font-weight: 900;
  opacity: 0.8;
  line-height: 1;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
}

.tile--sel {
  cursor: pointer;
  outline: 4px solid var(--pop-yellow);
  outline-offset: 2px;
  animation: pulse 0.9s ease-in-out infinite;
  z-index: 6;
}

@keyframes pulse {
  0%, 100% { outline-width: 4px; }
  50% { outline-width: 7px; }
}

.tile--up {
  cursor: pointer;
  outline: 4px solid var(--pop-red);
  outline-offset: 2px;
  z-index: 6;
}

/* 悬浮互动：放大 + 阴影加深（同属性色） */
.tile:hover {
  transform: translate(-50%, -50%) scale(1.15);
  box-shadow: 4px 4px 0 0 var(--attr, var(--ink));
  z-index: 8;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

/* 震屏（炸弹/核弹/怪兽） */
.board--shake {
  animation: board-shake 0.45s ease both;
}

@keyframes board-shake {
  0%, 100% { transform: translate(0, 0); }
  15% { transform: translate(-6px, 3px) rotate(-0.4deg); }
  30% { transform: translate(5px, -4px) rotate(0.4deg); }
  45% { transform: translate(-4px, 2px); }
  60% { transform: translate(3px, -2px); }
  75% { transform: translate(-2px, 1px); }
}

.tile__name {
  font-weight: 900;
  line-height: 1.05;
  flex: 1;
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-align: center;
}

.tile__closed {
  position: absolute;
  top: -5px;
  right: -5px;
  font-size: 1.3cqw;
}

.tile__shop {
  position: absolute;
  top: 0px;
  left: 2px;
  font-size: 0.9cqw;
  line-height: 1;
  font-weight: 900;
  color: #fff;
  background: var(--pop-red);
  border: 1.5px solid var(--ink);
  border-radius: 3px;
  padding: 0 2px;
}

.tile__barrier {
  position: absolute;
  bottom: -2px;
  right: -2px;
  font-size: 1.2cqw;
  line-height: 1;
  animation: barrier-shake 0.4s ease-in-out infinite;
}
@keyframes barrier-shake {
  0%, 100% { transform: rotate(-5deg); }
  50% { transform: rotate(5deg); }
}

.tile__cardshop {
  position: absolute;
  top: 1px;
  right: 1px;
  font-size: 0.82cqw;
  font-weight: 900;
  line-height: 1;
  color: #fff;
  background: var(--pop-red, #ef4444);
  border: 1.5px solid #fff;
  border-radius: 4px;
  padding: 1px 3px;
  box-shadow: 1px 1px 0 0 var(--ink, #1a1a1a);
}

.tile__lottery-mark,
.tile__god-mark {
  position: absolute;
  top: -2px;
  right: -2px;
  font-size: 1.0cqw;
  line-height: 1;
  width: 1.4em;
  height: 1.4em;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--ink, #1a1a1a);
  border-radius: 50%;
  box-shadow: 1px 1px 0 0 rgba(0,0,0,0.3);
  z-index: 2;
}
.tile__lottery-mark { background: #f97316; }
.tile__god-mark { background: #a855f7; }

.tile__owner {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 0.7cqw;
  height: 0.7cqw;
  border-radius: 50%;
  border: 1.5px solid #fff;
  box-shadow: 0 0 0 1px var(--ink);
}

.tile__price {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.15cqw;
  font-weight: 900;
  line-height: 1;
  background: rgba(26, 26, 26, 0.75);
  color: #fff;
  padding: 2px 6px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.02em;
}

.tile__points {
  font-size: 1.0cqw;
  font-weight: 900;
  color: #fde047;
  background: rgba(0, 0, 0, 0.5);
  padding: 1px 4px;
  border-radius: 4px;
  line-height: 1.2;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.5);
}

.tile__pawns {
  position: absolute;
  left: 50%;
  top: 53%;
  transform: translate(-50%, -50%);
  display: grid;
  grid-template-columns: repeat(var(--cols, 2), auto);
  justify-content: center;
  align-content: center;
  gap: 0.4cqw 0.5cqw;
  width: 86%;
  height: 60%;
  pointer-events: none;
}

.pawn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  pointer-events: none;
}
.pawn__face {
  width: var(--ps, 2.4cqw);
  height: var(--ps, 2.4cqw);
  border-radius: 50%;
  background: var(--pc);
  box-shadow: 2px 2px 0 0 rgba(26, 26, 26, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--ps, 2.4cqw) * 0.72);
  line-height: 1;
  font-style: normal;
}
.pawn__god-mark {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: calc(var(--ps, 2.4cqw) * 0.55);
  line-height: 1;
  font-style: normal;
  z-index: 2;
  filter: drop-shadow(1px 1px 0 rgba(0,0,0,0.4));
  animation: god-float 1.2s ease-in-out infinite;
}
@keyframes god-float {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(-3px); }
}
.pawn__tag {
  font-style: normal;
  font-size: calc(var(--ps, 2.4cqw) * 0.34);
  font-weight: 900;
  line-height: 1.3;
  color: #fff;
  background: var(--pc);
  padding: 0 3px;
  border-radius: 3px;
  white-space: nowrap;
  max-width: 9cqw;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pawn__veh {
  display: none;
}

/* 走格动画期间隐藏真实棋子（动画棋子代替它移动） */
.pawn--moving {
  opacity: 0;
}

/* 区域淡色块 */
.region {
  opacity: 0.5;
  stroke: none;
}

/* 江名标签 */
.river-label {
  font-size: 6px;
  font-weight: 900;
  fill: #1e40af;
  letter-spacing: 0.2em;
  opacity: 0.85;
}

/* 环中心信息面板已删除（折线地图中心不固定，会压到格子；回合/骰子在 ActionPanel 显示） */
</style>
