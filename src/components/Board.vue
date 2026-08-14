<script setup>
import { ref, computed } from 'vue'
import ComicIcon from './ComicIcon.vue'
import BoardFx from './BoardFx.vue'
import { TILES, METRO_STATIONS, PATH_POLYLINE, GROUPS, tilePosition, isPropertyTile, isMetro, SHOPS } from '../game/index.js'

const props = defineProps({
  state: Object,
  current: Object,
  selectable: { type: Array, default: () => [] },
  lastMove: Object, // 由 App 传入：{ prevPos, nextPos }
  hidePawns: Boolean, // 投掷骰子动画期间隐藏所有真实棋子（等走格动画接管）
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
  for (const t of TILES) if (t) m[t.id] = tilePosition(t.id)
  return m
})

const tiles = computed(() => TILES.filter(Boolean))

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

function isRiverBank(t) {
  return false
}

function isFork(t) {
  return !!(t.forks && t.forks.length)
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

function tileBg(t) {
  // 纯颜色区分：起点=红 / 奖励格=金 / 景点=绿 / 轻轨=青 / 商圈=组色(紫系) / 普通地产=组色 / 事件=黄 / 默认白
  switch (t.type) {
    case 'start': return '#ef4444'
    case 'corner': return '#f59e0b'
    case 'scenic': return '#22c55e'
    case 'station': return '#0891b2'
    case 'mall': return GROUPS[t.group]?.color ?? '#8b5cf6'
    case 'land': return GROUPS[t.group]?.color ?? '#ffffff'
    case 'chance': return '#facc15'
    default: return '#ffffff'
  }
}

function tileFg(t) {
  if (t.type === 'land' && !t.group) return '#1a1a1a'
  if (t.type === 'chance') return '#1a1a1a'
  if (t.type === 'corner') return '#1a1a1a'
  return '#ffffff'
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

function itemsOn(id) {
  return props.state.boardItems.filter((b) => b.tileId === id)
}

function isClosed(id) {
  return (props.state.closedBridges[id] ?? 0) > 0
}

function upgradable(id) {
  const p = props.current
  if (!p || p.isAI) return false
  const tile = TILES[id]
  if (!isPropertyTile(tile) || !p.properties.includes(id)) return false
  if (tile.type === 'metro' && !tile.upgradable) return false
  const level = p.levels[id] ?? 0
  return level < 3
}

function onTile(t) {
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
        'tile--bank': isRiverBank(t),
        'tile--fork': isFork(t),
      }"
      :style="{ left: posOf(t.id).x + '%', top: posOf(t.id).y + '%', width: tileSize(t).w, height: tileSize(t).h, background: tileBg(t), color: tileFg(t) }"
      :title="t.name + (t.sub ? ' · ' + t.sub : '') + (ownerOf(t.id) ? ' · 拥有者 ' + ownerOf(t.id).name : '')"
      @click="onTile(t)"
    >
      <span class="tile__num">{{ t.id }}</span>
      <span v-if="isFork(t)" class="tile__fork" title="分岔路口：可自选路线">分</span>
      <span v-if="isRiverBank(t)" class="tile__bank-mark"><ComicIcon name="wave" :size="13" /></span>
      <span class="tile__name" :style="{ fontSize: nameFont(t.name) }">{{ t.name }}</span>
      <span v-if="isPropertyTile(t) && t.price" class="tile__price">¥{{ t.price }}</span>

      <span v-if="isClosed(t.id)" class="tile__closed"><ComicIcon name="closed" :size="16" /></span>

      <span v-if="isPropertyTile(t) && ownerOf(t.id)" class="tile__shop" :title="shopOf(t.id).name">
        <ComicIcon v-if="shopOf(t.id).icon" :name="shopOf(t.id).icon" :size="13" />
      </span>
      <span v-if="isPropertyTile(t) && ownerOf(t.id)" class="tile__owner" :style="{ background: ownerOf(t.id).color }"></span>

      <span class="tile__items">
        <i v-for="b in itemsOn(t.id)" :key="b.id" :title="b.type">
          <ComicIcon :name="b.type === 'barrier' ? 'barrier' : b.type === 'mine' ? 'mine' : 'bomb'" :size="11" />
        </i>
      </span>

      <span class="tile__pawns">
        <i
          v-for="p in playersOn(t.id)"
          :key="p.id"
          class="pawn"
          :class="{ 'pawn--moving': movingPids.has(p.id) || hidePawns }"
          :style="{ background: p.color }"
        >
          <em v-if="p.vehicle !== 'walk'" class="pawn__veh"><ComicIcon :name="p.vehicle === 'bike' ? 'bike' : p.vehicle === 'moto' ? 'moto' : p.vehicle === 'car' ? 'car' : 'plane'" :size="11" /></em>
        </i>
      </span>
    </div>

    <!-- 漫画特效层 -->
    <BoardFx :state="state" :last-move="lastMove" :pos-map="posMap" :suppress-dice="hidePawns" @boom="onBoom" @walking="onWalking" />
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
  border: 3.5px solid var(--ink);
  border-radius: 7px;
  padding: 2px 3px;
  user-select: none;
  cursor: default;
  text-align: center;
  box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.55), 3px 3px 0 0 rgba(26, 26, 26, 0.9);
  z-index: 2;
}

/* 江岸格（跨江出发格）：水波标记 + 蓝色描边 */
.tile--bank {
  box-shadow: 0 0 0 2px #2563eb, 2px 2px 0 0 rgba(26, 26, 26, 0.85);
}

.tile__bank-mark {
  position: absolute;
  top: -7px;
  left: -5px;
  font-size: 1.1cqw;
  line-height: 1;
}

/* 分岔路口标记：金色"分"角标 + 外发光，提示玩家可自选路线 */
.tile--fork {
  box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.55), 0 0 0 3.5px #f59e0b, 3px 3px 0 0 rgba(26, 26, 26, 0.9);
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

/* 悬浮互动：放大 + 阴影加深 */
.tile:hover {
  transform: translate(-50%, -50%) scale(1.15);
  box-shadow: 4px 4px 0 0 var(--ink);
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
}

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
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.85cqw;
  font-weight: 900;
  line-height: 1;
  background: rgba(26, 26, 26, 0.62);
  color: #fff;
  padding: 1px 4px;
  border-radius: 5px;
  white-space: nowrap;
  pointer-events: none;
}

.tile__items {
  position: absolute;
  bottom: 0px;
  left: 2px;
  display: flex;
  gap: 1px;
  font-size: 0.9cqw;
}

.tile__pawns {
  position: absolute;
  top: 0px;
  right: 2px;
  display: flex;
  gap: 1.5px;
  flex-wrap: wrap;
  max-width: 70%;
}

.pawn {
  position: relative;
  width: 0.75cqw;
  height: 0.75cqw;
  border-radius: 50%;
  border: 1.5px solid var(--ink);
  box-shadow: 0.5px 0.5px 0 0 rgba(26, 26, 26, 0.7);
}

/* 走格动画期间隐藏真实棋子（动画棋子代替它移动） */
.pawn--moving {
  opacity: 0;
}

.pawn__veh {
  position: absolute;
  top: -7px;
  left: 50%;
  transform: translateX(-50%);
  font-style: normal;
  font-size: 0.85cqw;
  line-height: 1;
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
