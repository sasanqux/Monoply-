<script setup>
import { ref, computed } from 'vue'
import ComicIcon from './ComicIcon.vue'

const props = defineProps({
  me: Object,
  state: Object,
})
const emit = defineEmits(['open', 'openEncyclopedia', 'openLoan'])

const showTimers = ref(false)

function openEncy() {
  emit('openEncyclopedia')
}

// 当前回合玩家
const currentPlayer = computed(() => {
  if (!props.state) return null
  return props.state.players[props.state.turnIndex]
})

// 距离彩票开奖的回合数
const lotteryCountdown = computed(() => {
  const lot = props.state?.lottery
  if (!lot) return null
  if (lot.phase === 'drawing') return 1
  const nextDraw = 5 - ((props.state.round - lot.round) % 5)
  return nextDraw === 5 ? 0 : nextDraw
})

// 当前玩家的神仙剩余回合
const godCountdown = computed(() => {
  if (!props.me?.god) return null
  return props.me.godTurnsLeft || 0
})

// 贷款到期倒计时
const loanCountdown = computed(() => {
  if (!props.me?.loanDue) return null
  return Math.max(0, props.me.loanDue - (props.state?.round || 0))
})

// 载具剩余回合
const vehicleCountdown = computed(() => {
  if (!props.me?.vehicleTurnsLeft) return null
  return props.me.vehicleTurnsLeft
})

// 监狱/停留/住院倒计时
const jailCountdown = computed(() => {
  if (!props.me?.jailLeft) return null
  return props.me.jailLeft
})
const skipCountdown = computed(() => {
  if (!props.me?.skipTurns) return null
  return props.me.skipTurns
})
const hospitalCountdown = computed(() => {
  if (!props.me?.hospital) return null
  return props.me.skipTurns || 0
})

// 距离下次拍卖的回合数（每 10 回合一次）
const auctionCountdown = computed(() => {
  if (!props.state) return null
  const r = props.state.round % 10
  return r === 0 ? 10 : 10 - r
})

// 距离下次福利送卡的回合数（每 5 回合一次）
const cardGiftCountdown = computed(() => {
  if (!props.state) return null
  const r = props.state.round % 5
  return r === 0 ? 5 : 5 - r
})

// 是否有任何倒计时显示
const hasTimers = computed(() => {
  return (lotteryCountdown.value !== null) ||
    (godCountdown.value !== null && godCountdown.value > 0) ||
    (loanCountdown.value !== null && loanCountdown.value > 0) ||
    (vehicleCountdown.value !== null && vehicleCountdown.value > 0) ||
    (jailCountdown.value !== null && jailCountdown.value > 0) ||
    (skipCountdown.value !== null && skipCountdown.value > 0) ||
    (hospitalCountdown.value !== null && hospitalCountdown.value > 0) ||
    (auctionCountdown.value !== null) ||
    (cardGiftCountdown.value !== null)
})

const stockCount = computed(() => {
  if (!props.me?.stockHoldings) return 0
  return Object.keys(props.me.stockHoldings).filter(c => props.me.stockHoldings[c] > 0).length
})
</script>

<template>
  <div class="bags">
    <!-- 功能按钮 -->
    <div class="bags__btns">
      <!-- 卡牌 -->
      <button class="btn-comic btn-comic--sm bags__btn" @click="emit('open', 'cards')">
        <ComicIcon name="card" :size="18" /> <span class="bags__btn-label">卡牌</span> <b class="bags__cnt">{{ props.me?.hand?.length ?? 0 }}</b>
      </button>
      <!-- 银行（卡牌右边） -->
      <button class="btn-comic btn-comic--sm bags__btn" @click="emit('openLoan')">
        <ComicIcon name="bank" :size="18" /> <span class="bags__btn-label">银行</span><span v-if="props.me?.loanRepay > 0" class="bags__cnt">¥{{ props.me.loanRepay }}</span>
      </button>
      <!-- 地产 -->
      <button class="btn-comic btn-comic--sm bags__btn" @click="emit('open', 'lands')">
        <ComicIcon name="home" :size="18" /> <span class="bags__btn-label">地产</span> <b class="bags__cnt">{{ props.me?.properties?.length ?? 0 }}</b>
      </button>
      <!-- 股票 -->
      <button class="btn-comic btn-comic--sm bags__btn" @click="emit('open', 'stocks')">
        <ComicIcon name="stock" :size="18" /> <span class="bags__btn-label">股票</span> <b class="bags__cnt">{{ stockCount }}</b>
      </button>
      <!-- 百科 -->
      <button class="btn-comic btn-comic--sm bags__btn" @click="openEncy">
        <ComicIcon name="book" :size="18" /> <span class="bags__btn-label">百科</span>
      </button>
    </div>

    <!-- 右侧：回合状态卡片 -->
    <div class="bags__status">
      <div class="bags__status-card">
        <div class="bags__status-head">
          <span class="bags__round-badge">第 {{ state?.round ?? 1 }} 回合</span>
          <span class="bags__turn-player" :style="{ '--pc': currentPlayer?.color }">
            <i class="bags__turn-dot"></i>{{ currentPlayer?.name }}
          </span>
          <!-- 手机端：倒计时展开按钮 -->
          <button v-if="hasTimers" class="bags__timer-toggle" @click="showTimers = !showTimers">
            ⏱{{ showTimers ? '▲' : '▼' }}
          </button>
        </div>
        <!-- 倒计时：桌面端始终显示，手机端点击展开 -->
        <div v-if="hasTimers" class="bags__timers" :class="{ 'bags__timers--open': showTimers }">
          <span v-if="lotteryCountdown !== null" class="bags__chip" title="距离彩票开奖">
            彩票 <b>{{ lotteryCountdown }}</b>
          </span>
          <span v-if="godCountdown !== null && godCountdown > 0" class="bags__chip bags__chip--god" title="神仙剩余">
            神仙 <b>{{ godCountdown }}</b>
          </span>
          <span v-if="loanCountdown !== null && loanCountdown > 0" class="bags__chip bags__chip--loan" title="贷款到期">
            贷款 <b>{{ loanCountdown }}</b>
          </span>
          <span v-if="vehicleCountdown !== null && vehicleCountdown > 0" class="bags__chip bags__chip--vehicle" title="载具剩余">
            载具 <b>{{ vehicleCountdown }}</b>
          </span>
          <span v-if="jailCountdown !== null && jailCountdown > 0" class="bags__chip bags__chip--jail" title="监狱剩余">
            监狱 <b>{{ jailCountdown }}</b>
          </span>
          <span v-if="skipCountdown !== null && skipCountdown > 0" class="bags__chip bags__chip--skip" title="停留剩余">
            停留 <b>{{ skipCountdown }}</b>
          </span>
          <span v-if="hospitalCountdown !== null && hospitalCountdown > 0" class="bags__chip bags__chip--hospital" title="住院剩余">
            住院 <b>{{ hospitalCountdown }}</b>
          </span>
          <span class="bags__chip bags__chip--auction" title="距离拍卖">
            拍卖 <b>{{ auctionCountdown }}</b>
          </span>
          <span class="bags__chip bags__chip--gift" title="距离送卡">
            送卡 <b>{{ cardGiftCountdown }}</b>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bags {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.bags__btns {
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

.bags__status {
  flex-shrink: 0;
}

.bags__status-card {
  background: #fffef0;
  border: 3px solid var(--ink);
  border-radius: 10px;
  padding: 8px 14px;
  box-shadow: 3px 3px 0 0 rgba(26, 26, 26, 0.35);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bags__status-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bags__round-badge {
  background: var(--ink);
  color: #fff;
  font-size: 13px;
  font-weight: 900;
  padding: 3px 12px;
  border-radius: 6px;
  letter-spacing: 0.05em;
}

.bags__turn-player {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 900;
}

.bags__turn-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2.5px solid var(--ink);
  background: var(--pc, #999);
  flex-shrink: 0;
}

/* 倒计时展开按钮：桌面端隐藏 */
.bags__timer-toggle {
  display: none;
  align-items: center;
  gap: 2px;
  border: 2px solid var(--ink);
  border-radius: 5px;
  background: #fff;
  font-size: 11px;
  font-weight: 900;
  padding: 2px 6px;
  cursor: pointer;
  font-family: inherit;
}

/* 倒计时 chips */
.bags__timers {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.bags__chip {
  font-size: 11px;
  font-weight: 900;
  background: #fff;
  border: 2px solid var(--ink);
  border-radius: 6px;
  padding: 2px 8px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  box-shadow: 1.5px 1.5px 0 0 rgba(26, 26, 26, 0.3);
}

.bags__chip b {
  font-size: 13px;
  color: var(--pop-red);
}

.bags__chip--god { background: #f3e8ff; }
.bags__chip--loan { background: #fef3c7; }
.bags__chip--vehicle { background: #dbeafe; }
.bags__chip--jail { background: #e5e7eb; }
.bags__chip--skip { background: #fce7f3; }
.bags__chip--hospital { background: #fecaca; }
.bags__chip--auction { background: #ddd6fe; }
.bags__chip--gift { background: #bbf7d0; }

/* ===== 手机端 ===== */
@media (max-width: 768px) {
  .bags {
    flex-wrap: nowrap;
    justify-content: flex-start;
    gap: 4px;
  }
  .bags__btns {
    flex-wrap: wrap;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }
  .bags__btn {
    flex-shrink: 0;
    font-size: 10px;
    padding: 3px 6px;
  }
  .bags__btn-label { display: none; }
  .bags__status { flex-shrink: 0; }
  .bags__status-card {
    padding: 4px 8px;
    gap: 2px;
  }
  .bags__round-badge { font-size: 10px; padding: 2px 6px; }
  .bags__turn-player { font-size: 11px; }
  /* 倒计时展开按钮：手机端显示 */
  .bags__timer-toggle { display: inline-flex; }
  /* 倒计时：手机端默认隐藏，展开时显示 */
  .bags__timers { display: none; }
  .bags__timers--open { display: flex; }
  .bags__chip { font-size: 9px; padding: 1px 4px; }
}
</style>
