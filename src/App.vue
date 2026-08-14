<script setup>
import { ref, computed } from 'vue'
import SetupPanel from './components/SetupPanel.vue'
import Board from './components/Board.vue'
import ActionPanel from './components/ActionPanel.vue'
import SidePanel from './components/SidePanel.vue'
import BagsBar from './components/BagsBar.vue'
import MyPanelModal from './components/MyPanelModal.vue'
import ResultOverlay from './components/ResultOverlay.vue'
import LandInfoModal from './components/LandInfoModal.vue'
import ComicIcon from './components/ComicIcon.vue'
import { createInitialState, gameReducer, aiDecide, currentPlayer, TILES, isPropertyTile, isBridge, cardTargetKind } from './game/index.js'

const AI_NAMES = ['阿蓝', '阿绿', '阿橙', '阿紫', '阿粉', '阿灰', '阿黑']

const state = ref(null)
const lastOpts = ref(null)
let aiTimer = null

// 卡牌/道具目标选择模式
const selecting = ref(null) // { type:'card'|'item', id, mode:'tile'|'player'|'swap', swapStep, myTile }
const dicePicker = ref(false)
const remoteValue = ref(7)
const infoTile = ref(null) // 当前查看详情的格子 id
const myModal = ref(null) // 底部入口弹窗：'cards' | 'items' | 'lands' | 'other'

function startGame(opts) {
  lastOpts.value = { ...opts }
  const players = []
  for (let i = 0; i < opts.players; i++) {
    players.push({ id: 'p' + (i + 1), name: i === 0 ? '我' : AI_NAMES[i - 1], isAI: i !== 0 })
  }
  state.value = createInitialState({ players, maxTurns: opts.maxTurns, startMoney: opts.startMoney })
  scheduleAI()
}

function dispatch(action) {
  if (!state.value || state.value.status !== 'playing') return
  state.value = gameReducer(state.value, action)
  scheduleAI()
}

function scheduleAI() {
  const st = state.value
  if (!st || st.status !== 'playing') return
  const cur = currentPlayer(st)
  if (!cur.isAI) return
  const delay = st.phase === 'roll' ? 900 : 400
  clearTimeout(aiTimer)
  aiTimer = setTimeout(() => {
    const action = aiDecide(state.value, cur.id)
    if (action) dispatch(action)
  }, delay)
}

const cur = computed(() => (state.value ? currentPlayer(state.value) : null))
const isMyTurn = computed(() => cur.value && !cur.value.isAI)

// ===== 选择模式 =====
const selectableTiles = computed(() => {
  const st = state.value
  if (!st || !selecting.value) return []
  const me = currentPlayer(st)
  if (selecting.value.type === 'metro') {
    // 乘轻轨：其他所有轻轨站可选
    return TILES.filter((t) => t.type === 'metro' && t.id !== me.pos).map((t) => t.id)
  }
  if (selecting.value.type === 'card') {
    const card = me.hand.find((c) => c.id === selecting.value.id)
    if (!card) return []
    switch (card.type) {
      case 'buy':
        return TILES.filter((t) => isPropertyTile(t) && !st.players.some((p) => p.alive && p.properties.includes(t.id))).map((t) => t.id)
      case 'demolish':
        return TILES.filter((t) => st.players.some((p) => p.alive && p.id !== me.id && p.properties.includes(t.id) && (p.levels[t.id] ?? 0) >= 1)).map((t) => t.id)
      case 'monster':
        return TILES.filter((t) => st.players.some((p) => p.alive && p.id !== me.id && p.properties.includes(t.id))).map((t) => t.id)
      case 'nuke':
        return TILES.filter((t) => st.players.some((p) => p.alive && p.properties.includes(t.id))).map((t) => t.id)
      case 'closeBridge':
        return TILES.filter((t) => isBridge(t) && !(st.closedBridges[t.id] > 0)).map((t) => t.id)
      case 'swap':
        if (selecting.value.swapStep === 1) return me.properties.filter((i) => isPropertyTile(TILES[i]))
        return TILES.filter((t) => st.players.some((p) => p.alive && p.id !== me.id && p.properties.includes(t.id))).map((t) => t.id)
      default:
        return []
    }
  }
  if (selecting.value.type === 'item') {
    const item = me.items.find((it) => it.id === selecting.value.id)
    if (!item) return []
    if (item.type === 'barrier' || item.type === 'mine' || item.type === 'bomb' || item.type === 'portal') {
      return TILES.map((t) => t.id)
    }
  }
  return []
})

const selectablePlayers = computed(() => {
  const st = state.value
  if (!st || !selecting.value) return []
  const me = currentPlayer(st)
  if (selecting.value.type === 'card') {
    const card = me.hand.find((c) => c.id === selecting.value.id)
    if (!card) return []
    if (card.type === 'frame' || card.type === 'hold') {
      return st.players.filter((p) => p.alive && p.id !== me.id).map((p) => p.id)
    }
    if (card.type === 'transfer') {
      return st.players.filter((p) => p.alive && p.id !== me.id).map((p) => p.id)
    }
  }
  return []
})

function onTileClick(tileId) {
  if (!selecting.value) return
  const sel = selecting.value
  if (sel.type === 'metro') {
    dispatch({ type: 'TRAVEL_METRO', targetTileId: tileId })
  } else if (sel.type === 'card') {
    if (sel.mode === 'swap' && sel.swapStep === 1) {
      selecting.value = { ...sel, swapStep: 2, myTile: tileId }
      return
    }
    const target =
      sel.mode === 'swap'
        ? { myTile: sel.myTile, theirTile: tileId }
        : { tileId }
    dispatch({ type: 'USE_CARD', cardId: sel.id, target })
  } else if (sel.type === 'item') {
    dispatch({ type: 'USE_ITEM', itemId: sel.id, tileId })
  }
  selecting.value = null
}

function onPlayerClick(playerId) {
  if (!selecting.value) return
  const sel = selecting.value
  if (sel.type === 'card') {
    dispatch({ type: 'USE_CARD', cardId: sel.id, target: { playerId } })
  }
  selecting.value = null
}

// 手牌/道具点击
function useCard(card) {
  if (!isMyTurn.value) return
  const kind = cardTargetKind(card.type)
  if (kind === 'none') {
    dispatch({ type: 'USE_CARD', cardId: card.id })
    return
  }
  if (kind === 'tile') {
    selecting.value = { type: 'card', id: card.id, mode: 'tile' }
    return
  }
  if (kind === 'swap') {
    selecting.value = { type: 'card', id: card.id, mode: 'swap', swapStep: 1 }
    return
  }
  if (kind === 'player') {
    selecting.value = { type: 'card', id: card.id, mode: 'player' }
  }
}

function useItem(item) {
  if (!isMyTurn.value) return
  if (item.type === 'remoteDice') {
    remoteValue.value = 7
    dicePicker.value = true
    return
  }
  selecting.value = { type: 'item', id: item.id }
}

function confirmRemoteDice() {
  const me = currentPlayer(state.value)
  const it = me.items.find((i) => i.type === 'remoteDice')
  if (it) dispatch({ type: 'USE_ITEM', itemId: it.id, value: remoteValue.value })
  dicePicker.value = false
}

function startMetro() {
  if (!isMyTurn.value) return
  selecting.value = { type: 'metro', id: null }
}

function openTileInfo(id) {
  infoTile.value = id
  myModal.value = null // 从地产弹窗跳转时先关掉它
}

function upgradeFromInfo(id) {
  dispatch({ type: 'UPGRADE_PROPERTY', tileId: id })
  infoTile.value = null
}

function cancelSelect() {
  selecting.value = null
  dicePicker.value = false
}

const selectHint = computed(() => {
  const sel = selecting.value
  if (!sel) return ''
  if (sel.type === 'metro') return '选一个轻轨站（花 ¥150 乘过去）'
  if (sel.type === 'card') {
    if (sel.mode === 'swap' && sel.swapStep === 1) return '点一块自己的地（用于交换）'
    if (sel.mode === 'swap') return '点一块对方的地（换过去）'
    if (sel.mode === 'player') return '选一个目标玩家'
    return '选一个目标格子'
  }
  return '选一个放置/传送的格子'
})
</script>

<template>
  <div class="app halftone">
    <header class="app__head">
      <h1 class="comic-title comic-title--xl">
        <span class="comic-stripe">重庆大富翁</span>
      </h1>
      <span class="tag-comic tag-comic--red">两江 · 桥 · 卡牌</span>
    </header>

    <SetupPanel v-if="!state" @start="startGame" />

    <template v-else>
      <div class="app__game">
        <main class="app__board">
          <div v-if="selecting" class="select-bar bubble">
            <span class="select-bar__text"><ComicIcon name="target" :size="16" /> {{ selectHint }}</span>
            <button class="btn-comic btn-comic--sm btn-comic--ghost" @click="cancelSelect">取消</button>
          </div>
          <div class="board-wrap">
            <Board
              :state="state"
              :current="cur"
              :selectable="selectableTiles"
              @tile-click="onTileClick"
              @tile-info="openTileInfo"
            />
          </div>
          <ActionPanel :state="state" :current="cur" :is-my-turn="isMyTurn" @dispatch="dispatch" @metro="startMetro" />
        </main>

        <SidePanel :state="state" :current="cur" :selectable-players="selectablePlayers" @player-click="onPlayerClick" />
      </div>

      <div class="app__bags">
        <BagsBar :me="cur" @open="myModal = $event" />
      </div>

      <!-- 底部入口弹窗（卡牌/道具/地产/其它） -->
      <MyPanelModal
        v-if="myModal"
        :mode="myModal"
        :me="cur"
        :state="state"
        :is-my-turn="isMyTurn"
        @close="myModal = null"
        @use-card="useCard"
        @use-item="useItem"
        @upgrade="(id) => dispatch({ type: 'UPGRADE_PROPERTY', tileId: id })"
        @info="openTileInfo"
      />

      <!-- 遥控骰子点数选择 -->
      <div v-if="dicePicker" class="overlay-layer" @click.self="dicePicker = false">
        <div class="card-comic card-comic--pad-lg dice-panel">
          <h3 class="comic-title comic-title--md dice-panel__title"><ComicIcon name="dice" :size="22" /> 遥控骰子 · 选点数</h3>
          <input v-model.number="remoteValue" class="input-comic" type="number" min="2" max="12" />
          <div class="dice-panel__btns">
            <button class="btn-comic" @click="confirmRemoteDice">确定</button>
            <button class="btn-comic btn-comic--ghost" @click="dicePicker = false">取消</button>
          </div>
        </div>
      </div>

      <ResultOverlay v-if="state.status === 'finished'" :state="state" @again="startGame(lastOpts)" />

      <!-- 地块详情弹窗 -->
      <LandInfoModal
        v-if="infoTile"
        :state="state"
        :tile-id="infoTile"
        @close="infoTile = null"
        @upgrade="upgradeFromInfo"
      />
    </template>

    <footer class="app__foot">重庆大富翁 · Comic Style · M0+ 版</footer>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: var(--space-3);
  gap: var(--space-3);
}

.app__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.app__game {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: var(--space-3);
  align-items: start;
}

.app__board {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.board-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.select-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  background: #fff;
}

.select-bar__text {
  font-size: 14px;
  font-weight: 900;
}

.app__bags {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.app__foot {
  margin-top: auto;
  padding-top: var(--space-2);
  border-top: 3px solid var(--ink);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.overlay-layer {
  position: fixed;
  inset: 0;
  background: rgba(26, 26, 26, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  padding: 16px;
}

.dice-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
}

.dice-panel__btns {
  display: flex;
  gap: 12px;
}

@media (max-width: 860px) {
  .app__game {
    grid-template-columns: 1fr;
  }
}
</style>
