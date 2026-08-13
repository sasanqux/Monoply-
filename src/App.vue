<script setup>
import { ref, reactive, computed } from 'vue'
import SetupPanel from './components/SetupPanel.vue'
import Board from './components/Board.vue'
import ActionPanel from './components/ActionPanel.vue'
import SidePanel from './components/SidePanel.vue'
import ResultOverlay from './components/ResultOverlay.vue'
import { createInitialState, gameReducer, aiDecide, currentPlayer } from './game/index.js'

const AI_NAMES = ['阿蓝', '阿绿', '阿橙', '阿紫', '阿粉', '阿灰', '阿黑']

const state = ref(null)
const lastOpts = ref(null)
let aiTimer = null

function startGame(opts) {
  lastOpts.value = { ...opts }
  const players = []
  for (let i = 0; i < opts.players; i++) {
    players.push({
      id: 'p' + (i + 1),
      name: i === 0 ? '我' : AI_NAMES[i - 1],
      isAI: i !== 0,
    })
  }
  state.value = createInitialState({
    players,
    maxTurns: opts.maxTurns,
    startMoney: opts.startMoney,
  })
  scheduleAI()
}

function dispatch(action) {
  if (!state.value || state.value.status !== 'playing') return
  state.value = gameReducer(state.value, action)
  scheduleAI()
}

// 若轮到 AI，自动决策（掷骰慢一点有节奏感，其他快一点）
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
</script>

<template>
  <div class="app">
    <header class="app__head">
      <h1 class="app__title">都市大富翁</h1>
      <span class="app__sub">MONOPOLY · 单机试玩版</span>
    </header>

    <SetupPanel v-if="!state" @start="startGame" />

    <template v-else>
      <div class="app__game">
        <main class="app__board">
          <Board :state="state" :current="cur" @upgrade="(id) => dispatch({ type: 'UPGRADE_PROPERTY', tileId: id })" />
          <ActionPanel :state="state" :current="cur" :is-my-turn="isMyTurn" @dispatch="dispatch" />
        </main>
        <SidePanel :state="state" :current="cur" />
      </div>

      <ResultOverlay v-if="state.status === 'finished'" :state="state" @again="startGame(lastOpts)" />
    </template>

    <footer class="app__foot">瑞士国际主义 · 桌游风 · M0 试玩版</footer>
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
  align-items: baseline;
  gap: var(--space-2);
  border-bottom: 4px solid var(--black);
  padding-bottom: var(--space-2);
}

.app__title {
  font-size: 26px;
  font-weight: 500;
  letter-spacing: 0.06em;
}

.app__sub {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--red);
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
  gap: var(--space-3);
}

.app__foot {
  margin-top: auto;
  padding-top: var(--space-3);
  border-top: 1px solid var(--grid);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--gray-500);
}

@media (max-width: 860px) {
  .app__game {
    grid-template-columns: 1fr;
  }
}
</style>
