// reducer.js — gameReducer 纯函数总入口（单机本地跑，联机时搬到服务器）
/**
 * @typedef {Object} PendingBuy
 * @property {'buy'} kind
 * @property {number} tileId
 */
/**
 * @typedef {Object} PendingAuction
 * @property {'auction'} kind
 * @property {number} tileId
 * @property {Object.<number, number>} bids
 * @property {number} turn
 * @property {number} round
 * @property {number} maxRounds
 * @property {number} roundStep
 */
/**
 * @typedef {Object} PendingFork
 * @property {'fork'} kind
 * @property {number} tileId
 * @property {number[]} options
 * @property {number|null} chosen
 * @property {number} stepsLeft
 * @property {number} cameFrom
 * @property {boolean} canPick
 */
/**
 * @typedef {Object} PendingShop
 * @property {'shop'} kind
 * @property {number} tileId
 */
/**
 * @typedef {Object} PendingMetro
 * @property {'metro'} kind
 * @property {number} tileId
 */
/**
 * @typedef {Object} PendingCheckin
 * @property {'checkin'} kind
 */
/**
 * @typedef {PendingBuy|PendingAuction|PendingFork|PendingShop|PendingMetro|PendingCheckin|null} Pending
 */
import { TILES, START_MONEY_DEFAULT, isPropertyTile, isMetro, METRO_FEE, GROUPS } from './board.js'
import { rollForPlayer, movePlayer, stepOneTile } from './movement.js'
import { addMoney, takeLoan, repayLoan, processLoanDue, loanLimit, payMoney } from './bank.js'
import { upgradeCost, mortgageTile, unmortgageTile, totalAssets, getRent, isGroupComplete } from './property.js'
import { applyCard, cardTargetKind, CARDS, randomCard } from './card.js'
import { handleLanding, nextTurn, currentPlayer } from './turn.js'
import { checkBankrupt } from './gameOver.js'
import { GODS, godRentMultiplier, godFeeMultiplier } from './god.js'
import { initLotteryState, buyTicket, buyTickets, tryTriggerLottery, tryTriggerLotteryDeferred, LOTTERY_TILES } from './lottery.js'
import { initStockRuntime, buyStock, sellStock, tickStockPrices, applyBlackStock, applyRedStock } from './stock.js'

// 玩家配色（方案 B 纯色板）：避开地图属性色（地产黑/景点绿/轻轨青/商圈紫/起点棕/事件黄）
export const PLAYER_COLORS = [
  '#2563eb', // 蓝
  '#f97316', // 橙
  '#ec4899', // 粉
  '#d946ef', // 洋红
  '#0ea5e9', // 天蓝
  '#f43f5e', // 玫红
  '#6366f1', // 靛蓝
  '#f59e0b', // 琥珀
]

// 棋子图案：名字首字（简约风）
export function playerInitial(p) {
  const n = p?.name || ''
  return n ? n.charAt(0) : '?'
}

// 每个玩家的专属动物棋子（emoji）；序号对应玩家 id 数字，颜色由 player.color 双编码
export const PLAYER_ANIMALS = ['🐼', '🐯', '🐰', '🐸', '🦊', '🐵', '🐶', '🐱']
export function playerAnimal(p) {
  const i = parseInt(String(p?.id ?? '').replace(/\D/g, ''), 10) - 1
  return PLAYER_ANIMALS[i >= 0 ? i % PLAYER_ANIMALS.length : 0]
}

const MAX_LOG = 200

export function createInitialState({ players, maxTurns = 40, startMoney = START_MONEY_DEFAULT }) {
  const playerList = players.map((pl, i) => ({
    id: pl.id,
    name: pl.name,
    isAI: !!pl.isAI,
    color: pl.color || PLAYER_COLORS[i % PLAYER_COLORS.length],
    money: startMoney,
    pos: 1, // 起点 = 朝天门 (id 1)
    properties: [],
    levels: {},
    hand: [],
    vehicle: 'walk',
    skipTurns: 0,
    ferry: false,
    checkins: 0, // 朝天门打卡次数（满 3 次领大礼包）
    points: 0, // 卡片积分（踩格获得，可在商店买卡）
    jailLeft: 0,
    hospital: false,
    alive: true,
    bankrupt: false,
    cardUsed: false, // 本回合是否已用卡（每回合限1张）
    firstTurn: true, // 第一回合不能用卡
    vehicleTurnsLeft: 0, // 载具剩余回合（0=走路/无载具）
    god: null, // 附身神仙（预留）
    _marathon: false, // 马拉松双倍步数
    _rentBonus: 0, // 八中租金加成
    cameFrom: null, // 上回合停留此格时的来路（跨回合保持方向）
    walkPath: [1],
    stockHoldings: {}, // 股票持仓 {code: shares}
    upgradableTiles: [], // 本回合可升级的地块 id 数组（踩到自己的地后加入）
    mortgaged: {}, // 抵押中的地产 { tileId: true }
    loan: 0, // 贷款本金（未还）
    loanDue: 0, // 到期回合（0=无贷款）
    loanRepay: 0, // 待还总额（含利息）
  }))

  const cardSeq = 0

  const s = {
    status: 'playing',
    settings: { maxTurns, startMoney },
    round: 1,
    turnIndex: 0,
    phase: 'order', // 开局先决定行动顺序
    dice: null,
    pending: null,
    winnerId: null,
    closedBridges: {},
    barriers: {}, // 路障 { tileId: { owner, turnsLeft } } —— 放 state 里随对局隔离（不写 TILES 全局）
    auctionThisRound: false, // 本轮（10 回合周期）是否已拍卖
    shopShownTurn: false, // 本回合是否已弹过卡片商店
    lotteryBoughtTurn: false, // 本回合是否已买过彩票
    lottery: initLotteryState(), // 彩票系统
    stockRuntime: initStockRuntime(), // 股票运行时
    announcedGroups: {}, // 已提示过"建成"的商圈（防日志刷屏）
    _cardSeq: cardSeq, // 卡片 ID 自增序列（替代 Date.now()，保证 reducer 纯函数性）
    assetHistory: {}, // { playerId: [每回合总资产] } 用于资产曲线图
    players: playerList,
    orderState: { // 决定先手顺序
      rolls: {}, // { playerId: [d1, d2, d3] }
      index: 0, // 当前掷骰玩家下标
      done: false, // 是否完成
    },
    log: [
      `🎮 大富翁——重庆之旅！${players.map((p) => p.name).join('、')}，每人起始资金 ¥${startMoney}`,
      `🎲 开局掷骰决定顺序（3 颗骰子，点数大的先手）`,
    ],
  }

  // 初始发 2 张随机卡
  for (const pl of s.players) {
    for (let i = 0; i < 2; i++) {
      const tpl = randomCard()
      pl.hand.push({ ...tpl, id: `init-${pl.id}-${++s._cardSeq}` })
    }
  }

  // 随机奖金初始位置：出现在随机无主地产格，金额随机（整千或整五百）
  const bonusCandidates = TILES.filter((t) => t && isPropertyTile(t) && !t.removed)
  const bonusAmounts = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000]
  s.bonusTile = {
    id: bonusCandidates.length > 0 ? bonusCandidates[Math.floor(Math.random() * bonusCandidates.length)].id : 0,
    amount: bonusAmounts[Math.floor(Math.random() * bonusAmounts.length)],
  }

  return s
}

// 决定先手顺序：按骰子总点数降序排列玩家，同点数则相关玩家加赛
function resolveOrder(s) {
  const os = s.orderState
  const rolls = os.rolls

  // 计算每个玩家的点数总和
  const totals = s.players.map(p => ({
    id: p.id,
    name: p.name,
    total: (rolls[p.id] || []).reduce((a, b) => a + b, 0),
  }))

  // 按点数降序排列
  totals.sort((a, b) => b.total - a.total)

  // 检查是否有同分（需要加赛）
  const tieGroups = {}
  for (const t of totals) {
    tieGroups[t.total] = (tieGroups[t.total] || 0) + 1
  }
  const ties = Object.entries(tieGroups).filter(([, n]) => n > 1)

  if (ties.length > 0) {
    // 有同分：只有同分的玩家加赛
    const tiedTotals = ties.map(([t]) => Number(t))
    const tiedPlayers = totals.filter(t => tiedTotals.includes(t.total))
    // 重置这些玩家的掷骰状态
    for (const t of tiedPlayers) {
      delete rolls[t.id]
    }
    // 找出这些玩家在原始 players 中的下标最小值，设为新的 index
    const tiedIds = new Set(tiedPlayers.map(t => t.id))
    os.index = s.players.findIndex(p => tiedIds.has(p.id))
    const names = tiedPlayers.map(t => t.name).join('、')
    s.log.push(`⚖️ ${names} 同分（${ties[0][0]} 点），加赛掷骰！`)
    return
  }

  // 无同分：确定最终顺序
  const orderedIds = totals.map(t => t.id)
  const newPlayers = []
  for (const id of orderedIds) {
    newPlayers.push(s.players.find(p => p.id === id))
  }
  s.players = newPlayers
  s.turnIndex = 0
  os.done = true
  s.phase = 'roll'
  const orderNames = totals.map(t => `${t.name}(${t.total})`).join(' → ')
  s.log.push(`🏁 行动顺序：${orderNames}`)
  s.log.push(`第 1 回合，轮到 ${s.players[0].name}`)
}

// 路过卡片商店检测：移动路径经过 shop 标记格、无其他 pending、本回合未弹过 → 弹商店
// 统一函数，供落地后和 END_TURN 两处调用，避免逻辑重复
function tryTriggerShop(s, p) {
  if (s.shopShownTurn || s.pending) return false
  const shopId = p.walkPath?.find((id) => TILES[id]?.shop)
  if (!shopId) return false
  s.pending = { kind: 'shop', tileId: shopId }
  s.shopShownTurn = true
  s.log.push(`🛒 ${p.name} 路过卡片商店（${TILES[shopId].name}），可购买卡片！`)
  return true
}

// 神仙附身弹窗：购买流程结束后，若之前踩了神仙格 → 弹出附身提示
function tryTriggerGodPopup(s) {
  if (s.pending || !s._godAfterBuy) return false
  const { godId, playerId } = s._godAfterBuy
  s.pending = { kind: 'god', godId, playerId }
  s._godAfterBuy = null
  return true
}

// 奇遇事件弹窗：购买流程结束后，若之前触发了奇遇 → 弹出事件提示
function tryTriggerChancePopup(s) {
  if (s.pending || !s._chancePopup) return false
  s.pending = { kind: 'chance', event: s._chancePopup }
  s._chancePopup = null
  return true
}

export function gameReducer(state, action) {
  const s = JSON.parse(JSON.stringify(state))
  if (s.status !== 'playing') return s
  s.announcedGroups ??= {}
  s.closedBridges ??= {}
  s.barriers ??= {}
  const p = currentPlayer(s)
  if (!p) return s // 无当前玩家（极端情况）防护

  // 落地后自动检测卡片商店/彩票站（仅 landed 阶段且无 pending）
  if (s.phase === 'landed' && !s.pending) {
    if (!tryTriggerShop(s, p)) tryTriggerLottery(s, p)
  }

  let result = s

  switch (action.type) {
    // ===================== 决定先手顺序 =====================
    case 'ROLL_ORDER': {
      if (s.phase !== 'order') break
      const os = s.orderState
      if (os.done) break
      const curPlayer = s.players[os.index]
      if (!curPlayer) break
      // 掷 3 颗骰子
      const dice = []
      for (let i = 0; i < 3; i++) dice.push(1 + Math.floor(Math.random() * 6))
      os.rolls[curPlayer.id] = dice
      s.log.push(`🎲 ${curPlayer.name} 掷出 ${dice.join('+')} = ${dice.reduce((a, b) => a + b, 0)} 点`)
      // 下一个玩家
      os.index++
      if (os.index >= s.players.length) {
        // 所有玩家都掷完了 → 排序
        resolveOrder(s)
      }
      break
    }

    case 'ROLL_DICE': {
      // 若尚未决定顺序，先自动解决（兼容测试/AI 全自动）
      if (s.phase === 'order') {
        while (!s.orderState.done) {
          const os = s.orderState
          const curPlayer = s.players[os.index]
          if (!curPlayer) { os.done = true; break }
          const dice = []
          for (let i = 0; i < 3; i++) dice.push(1 + Math.floor(Math.random() * 6))
          os.rolls[curPlayer.id] = dice
          os.index++
          if (os.index >= s.players.length) resolveOrder(s)
        }
      }
      if (s.phase !== 'roll') break
      // 贷款到期检测（回合开始时）
      if (p.loanDue > 0 && s.round >= p.loanDue) {
        processLoanDue(s, p)
        checkBankrupt(s, p)
        if (!p.alive) break
      }
      if (p.jailLeft > 0) {
        p.jailLeft -= 1
        s.log.push(`🚔 ${p.name} 在拘留所服刑（还剩 ${p.jailLeft} 轮）`)
        result = nextTurn(s)
        break
      }
      if (p.skipTurns > 0) {
        p.skipTurns -= 1
        if (p.skipTurns <= 0) p.hospital = false // 歌乐山休养结束（hospital 只是展示标记）
        s.log.push(`✋ ${p.name} 被停留卡定住，跳过本回合`)
        result = nextTurn(s)
        break
      }
      const dice = rollForPlayer(p)
      let sum = dice.reduce((a, b) => a + b, 0)
      // 重庆马拉松：行动格数翻倍
      if (p._marathon) {
        sum *= 2
        p._marathon = false
        s.log.push(`🏃 ${p.name} 受马拉松鼓舞，行动格数翻倍（${dice.join('+')} → ${sum} 步）！`)
      }
      // 新走格方案：只记步数，不实际走。前端逐格 dispatch STEP 来推进动画。
      const from = p.pos
      s.dice = dice
      s.stepsRemaining = sum
      // 重置当前玩家的行走路径（动画用）
      p.walkPath = [p.pos]
      s.phase = 'step' // 等待前端逐步推进
      s.log.push(`🎲 ${p.name} 掷出 ${dice.join(' + ')} = ${sum}，从「${TILES[from].name}」出发`)
      break
    }

    // 前端逐格推进：每走 1 格 dispatch 一次 STEP
    case 'STEP': {
      if (!s.stepsRemaining || s.stepsRemaining <= 0) break
      const cur = TILES[p.pos]
      // 来路 = walkPath 里上一格（本回合内）或上回合遗留的 cameFrom
      const cameFrom = p.walkPath.length >= 2 ? p.walkPath[p.walkPath.length - 2] : (p.cameFrom ?? p.pos)
      const stepRes = stepOneTile(cur, p, cameFrom)
      if (stepRes.paused) {
        // 分岔暂停
        s.pending = {
          kind: 'fork',
          tileId: cur.id,
          options: stepRes.options,
          chosen: null,
          stepsLeft: s.stepsRemaining,
          cameFrom,
          canPick: true,
        }
        s.phase = 'fork'
        // 路过彩票站 → 等分岔选路后弹窗（在 CHOOSE_FORK 中处理）
        break
      }
      // 走 1 步：记录来路供下格使用
      p.cameFrom = cur.id
      p.pos = stepRes.nextId
      p.walkPath = p.walkPath || [cameFrom]
      p.walkPath.push(stepRes.nextId)
      s.stepsRemaining -= 1
      // 路过彩票站检测（延迟到停下时弹窗）
      if (!s._lotteryTile && LOTTERY_TILES.includes(stepRes.nextId)) {
        s._lotteryTile = stepRes.nextId
      }
      // 路障检查
      const barrier = s.barriers[stepRes.nextId]
      if (barrier && barrier.owner !== p.id) {
        const owner = s.players.find((pl) => pl.id === barrier.owner)
        p.points = (p.points ?? 0) - 50
        s.log.push(`🚧 ${p.name} 踩到「${TILES[stepRes.nextId].name}」的路障！扣 50 积分`)
        if (owner) { owner.points = (owner.points ?? 0) + 50 }
        s.stepsRemaining = 0
      }
      // 走完所有步数
      if (s.stepsRemaining <= 0) {
        s.stepsRemaining = 0
        s.phase = 'landed'
        handleLanding(s, p)
      }
      break
    }

    case 'CHOOSE_FORK': {
      if (s.phase !== 'fork' || !s.pending || s.pending.kind !== 'fork') break
      const opt = s.pending.options
      const chosen = action.tileId
      const finalChoice = s.pending.canPick ? chosen : s.pending.chosen
      if (!opt.includes(finalChoice)) break
      const stepsLeft = s.pending.stepsLeft
      const forkTile = s.pending.tileId
      s.pending = null
      // 只走选路这 1 步，剩余步数交给 STEP 推进
      p.cameFrom = forkTile // 来路 = 分岔格
      p.walkPath = p.walkPath || [p.pos]
      p.walkPath.push(finalChoice)
      p.pos = finalChoice
      s.stepsRemaining = stepsLeft - 1 // 选路消耗 1 步
      s.phase = 'step' // 前端继续推进剩余步数
      if (s.stepsRemaining <= 0) {
        s.stepsRemaining = 0
        s.phase = 'landed'
        handleLanding(s, p)
        break
      }
      // 路障检查
      const barrier = s.barriers[finalChoice]
      if (barrier && barrier.owner !== p.id) {
        const owner = s.players.find((pl) => pl.id === barrier.owner)
        p.points = (p.points ?? 0) - 50
        s.log.push(`🚧 ${p.name} 踩到路障！扣 50 积分`)
        if (owner) { owner.points = (owner.points ?? 0) + 50 }
        s.stepsRemaining = 0
        s.phase = 'landed'
        handleLanding(s, p)
      }
      break
    }

    case 'BUY_PROPERTY': {
      if (s.pending?.kind !== 'buy') break
      const tile = TILES[s.pending.tileId]
      // 已被（含用购地卡）买走 → 不再出售，清 pending
      if (s.players.some((pl) => pl.properties.includes(tile.id))) {
        s.pending = null
        break
      }
      if (p.money < tile.price) {
        s.log.push(`${p.name} 现金不足，无法购买「${tile.name}」`)
        break
      }
      p.money -= tile.price
      p.properties.push(tile.id)
      if (isPropertyTile(tile)) p.levels[tile.id] = 0
      s.pending = null
      s.log.push(`${isMetro(tile) ? '🚈' : '🏠'} ${p.name} 购入「${tile.name}」（¥${tile.price}，现 ¥${p.money}）`)
      // 刚买的地不能立刻升级，必须第二次落到才能升
      if (p.upgradableTiles) {
        const idx = p.upgradableTiles.indexOf(tile.id)
        if (idx !== -1) p.upgradableTiles.splice(idx, 1)
      }
      // 买地后立即检测商店/彩票站/神仙附身弹窗/奇遇弹窗（不再等 END_TURN）
      if (!tryTriggerShop(s, p) && !tryTriggerLottery(s, p) && !tryTriggerGodPopup(s)) tryTriggerChancePopup(s)
      break
    }

    case 'SKIP_BUY': {
      if (s.pending?.kind === 'buy') {
        const tile = TILES[s.pending.tileId]
        s.log.push(`${p.name} 放弃购买「${tile.name}」`)
        s.pending = null
        // 跳过后立即检测商店/彩票站/神仙附身弹窗/奇遇弹窗
        if (!tryTriggerShop(s, p) && !tryTriggerLottery(s, p) && !tryTriggerGodPopup(s)) tryTriggerChancePopup(s)
      }
      break
    }

    case 'UPGRADE_PROPERTY': {
      const tile = TILES[action.tileId]
      if (!tile || !isPropertyTile(tile) || !p.properties.includes(tile.id)) break
      const level = p.levels[tile.id] ?? 0
      if (level >= 3) break
      const cost = upgradeCost(tile)
      if (p.money < cost) break
      p.money -= cost
      p.levels[tile.id] = level + 1
      s.log.push(`🏗 ${p.name} 将「${tile.name}」升级到 ${level + 1} 级（¥${cost}，现 ¥${p.money}）`)
      break
    }

    case 'MORTGAGE': {
      const res = mortgageTile(s, p, action.tileId)
      if (!res.ok) s.log.push(`❌ 抵押失败：${res.msg}`)
      break
    }

    case 'UNMORTGAGE': {
      const res = unmortgageTile(s, p, action.tileId)
      if (!res.ok) s.log.push(`❌ 赎回失败：${res.msg}`)
      break
    }

    case 'USE_CARD': {
      // 走格/分岔/拍卖中途不能用卡（防止改变移动方向/清掉 pending 造成 phase 错乱）
      if (s.phase === 'step' || s.phase === 'fork' || s.phase === 'auction') break
      if (p.firstTurn) {
        s.log.push(`${p.name} 第一回合不能用卡！`)
        break
      }
      if (p.cardUsed) {
        s.log.push(`${p.name} 本回合已经用过卡片了（每回合限1张）`)
        break
      }
      const idx = p.hand.findIndex((c) => c.id === action.cardId)
      if (idx === -1) break
      const card = p.hand[idx]
      const kind = cardTargetKind(card.type)
      if (kind !== 'none' && !action.target) break
      if (applyCard(s, p, card, action.target)) {
        p.hand.splice(idx, 1)
        p.cardUsed = true
      }
      break
    }

    case 'END_TURN': {
      if (s.phase !== 'landed') break
      if (s.pending?.kind === 'buy') {
        const tile = TILES[s.pending.tileId]
        s.log.push(`${p.name} 放弃购买「${tile.name}」`)
        s.pending = null
      }
      if (s.pending?.kind === 'metro') s.pending = null
      if (s.pending?.kind === 'shop') break // 卡片商店未关闭，不推进回合（等玩家关店）
      // 商店检测已在 reducer 顶部统一处理（152行），此处无需重复
      result = nextTurn(s)
      break
    }

    // ===== 玩家交易 =====
    case 'TRADE_OFFER': {
      // action: { targetPlayerId, offer: { lands: [], money: 0 }, request: { lands: [], money: 0 } }
      if (s.phase !== 'landed') break
      const target = s.players.find((pl) => pl.alive && pl.id === action.targetPlayerId)
      if (!target || target.id === p.id) break
      // 金额归一（拒绝负数：负数金额在接受阶段会被跳过，等于无效条款）
      const offerMoney = Math.max(0, Math.floor(action.offer?.money || 0))
      const requestMoney = Math.max(0, Math.floor(action.request?.money || 0))
      // 校验提供的资产是否真的属于发起方
      let invalid = false
      for (const id of action.offer?.lands || []) {
        if (!p.properties.includes(id)) { s.log.push('交易失败：你不拥有提供的一块地'); invalid = true; break }
      }
      if (invalid) break
      for (const id of action.request?.lands || []) {
        if (!target.properties.includes(id)) { s.log.push('交易失败：对方不拥有你要的一块地'); invalid = true; break }
      }
      if (invalid) break
      if (offerMoney > 0 && p.money < offerMoney) { s.log.push('交易失败：现金不足'); break }
      if (requestMoney > 0 && target.money < requestMoney) { s.log.push('交易失败：对方现金不足'); break }
      s.pending = {
        kind: 'trade',
        from: p.id,
        to: target.id,
        offer: { lands: [...(action.offer?.lands || [])], money: offerMoney },
        request: { lands: [...(action.request?.lands || [])], money: requestMoney },
      }
      s.log.push(`🤝 ${p.name} 向 ${target.name} 发起了交易提案`)
      break
    }

    case 'TRADE_ACCEPT': {
      if (s.pending?.kind !== 'trade') break
      const tp = s.pending
      const fromP = s.players.find((pl) => pl.id === tp.from)
      const toP = s.players.find((pl) => pl.id === tp.to)
      if (!fromP || !toP || !fromP.alive || !toP.alive) {
        s.pending = null
        s.log.push('❌ 交易对象已出局，交易取消')
        break
      }
      // 复查：从发起到接受之间资产可能已变（破产被迫卖地/现金变动）
      const offerMoney = Math.max(0, Math.floor(tp.offer.money || 0))
      const requestMoney = Math.max(0, Math.floor(tp.request.money || 0))
      const offerLands = (tp.offer.lands || []).filter((id) => fromP.properties.includes(id))
      const requestLands = (tp.request.lands || []).filter((id) => toP.properties.includes(id))
      const stillValid =
        offerLands.length === (tp.offer.lands || []).length &&
        requestLands.length === (tp.request.lands || []).length &&
        fromP.money >= offerMoney &&
        toP.money >= requestMoney
      if (!stillValid) {
        s.pending = null
        s.log.push('❌ 交易条件已变化（等待期间资产变动），交易取消')
        break
      }
      // 执行交换：地产
      for (const id of offerLands) {
        fromP.properties = fromP.properties.filter((i) => i !== id)
        toP.properties.push(id)
        const lv = fromP.levels[id] ?? 0
        delete fromP.levels[id]
        toP.levels[id] = lv
        delete fromP.mortgaged?.[id]
      }
      for (const id of requestLands) {
        toP.properties = toP.properties.filter((i) => i !== id)
        fromP.properties.push(id)
        const lv = toP.levels[id] ?? 0
        delete toP.levels[id]
        fromP.levels[id] = lv
        delete toP.mortgaged?.[id]
      }
      // 执行交换：现金
      if (offerMoney > 0) {
        fromP.money -= offerMoney
        toP.money += offerMoney
      }
      if (requestMoney > 0) {
        toP.money -= requestMoney
        fromP.money += requestMoney
      }
      s.log.push(`✅ 交易达成！${fromP.name} ↔ ${toP.name}`)
      s.pending = null
      break
    }

    case 'TRADE_REJECT': {
      if (s.pending?.kind !== 'trade') break
      const tp = s.pending
      s.log.push(`❌ ${s.players.find((pl) => pl.id === tp.to)?.name ?? '对方'} 拒绝了交易提案`)
      s.pending = null
      break
    }

    case 'TRAVEL_METRO': {
      // 走格/分岔/拍卖中途不能乘（防止清掉 fork pending 造成 phase 错乱）
      if (s.phase === 'step' || s.phase === 'fork' || s.phase === 'auction') break
      // 只要当前玩家站在轻轨站即可乘（详情卡入口不依赖 pending；p 为当前玩家）
      if (!isMetro(TILES[p.pos])) break
      const target = TILES[action.targetTileId]
      if (!target || !isMetro(target) || target.id === p.pos) break
      if (p.money < METRO_FEE) {
        s.log.push(`${p.name} 钱不够乘轻轨（¥${METRO_FEE}）`)
        break
      }
      p.money -= METRO_FEE
      const fromName = TILES[p.pos].name
      p.pos = target.id
      s.pending = null
      s.log.push(`🚈 ${p.name} 花 ¥${METRO_FEE} 乘轻轨，从「${fromName}」来到「${target.name}」`)
      // 乘轻轨后检测出发站是否为商店格/奇遇弹窗
      if (!tryTriggerShop(s, p)) tryTriggerChancePopup(s)
      break
    }

    // 打卡大礼包：免费传送到任意格（触发落地）
    case 'CHECKIN_TELEPORT': {
      if (s.pending?.kind !== 'checkin') break
      const target = TILES[action.tileId]
      if (!target || target.removed) break
      const fromName = TILES[p.pos]?.name ?? '?'
      p.pos = target.id
      p.walkPath = [target.id]
      s.pending = null
      s.log.push(`🚀 ${p.name} 使用大礼包传送，从「${fromName}」来到「${target.name}」`)
      s.phase = 'landed'
      handleLanding(s, p)
      break
    }

    // 打卡大礼包：跳过免费传送（保留已发放奖励，留在原地）
    case 'CHECKIN_SKIP': {
      if (s.pending?.kind === 'checkin') {
        s.pending = null
        s.log.push(`🎁 ${p.name} 收下大礼包，暂不传送`)
        // 跳过后检测奇遇弹窗（如"回到最初的起点"触发了打卡）
        tryTriggerChancePopup(s)
      }
      break
    }

    // 神仙附身弹窗：关闭
    case 'GOD_CLOSE': {
      if (s.pending?.kind === 'god') s.pending = null
      break
    }

    // 奇遇事件弹窗：关闭
    case 'CHANCE_CLOSE': {
      if (s.pending?.kind === 'chance') s.pending = null
      break
    }

    // 奖金提示弹窗：关闭
    case 'BONUS_INFO_CLOSE': {
      if (s.pending?.kind === 'bonus_info') s.pending = null
      break
    }

    // 破产弹窗：关闭
    case 'BANKRUPT_CLOSE': {
      if (s.pending?.kind === 'bankrupt') s.pending = null
      break
    }

    // ===================== 卡片商店（路过双碑/巴南触发） =====================
    case 'SHOP_BUY': {
      if (s.pending?.kind !== 'shop') break
      const cardTpl = CARDS.find((c) => c.type === action.cardId)
      if (!cardTpl) break
      if (p.points < cardTpl.price) {
        s.log.push(`${p.name} 卡片积分不足（${p.points}/${cardTpl.price}）`)
        break
      }
      if (p.hand.length >= 10) {
        s.log.push(`${p.name} 手牌已满，无法购买`)
        break
      }
      p.points -= cardTpl.price
      p.hand.push({ ...cardTpl, id: `shop-${cardTpl.type}-${p.id}-${++s._cardSeq}` })
      s.log.push(`🛒 ${p.name} 用 ${cardTpl.price} 积分购得「${cardTpl.name}」（剩 ${p.points}）`)
      break
    }
    case 'SHOP_CLOSE': {
      if (s.pending?.kind === 'shop') s.pending = null
      break
    }

    // ===================== 银行贷款 =====================
    case 'TAKE_LOAN': {
      // 走格/分岔/拍卖中途不能贷款（防止改变移动方向或干扰拍卖）
      if (s.phase === 'step' || s.phase === 'fork' || s.phase === 'auction') break
      const amount = Math.max(0, Math.floor(action.amount || 0))
      if (amount <= 0) break
      const limit = loanLimit(p, totalAssets(p))
      if (limit <= 0) { s.log.push(`${p.name} 无可贷额度`); break }
      const actual = Math.min(amount, limit)
      takeLoan(s, p, actual)
      break
    }
    case 'REPAY_LOAN': {
      if (!p.loanRepay) break
      if (s.phase === 'step' || s.phase === 'fork' || s.phase === 'auction') break
      const amount = Math.max(0, Math.floor(action.amount || 0))
      if (amount <= 0) break
      repayLoan(s, p, Math.min(amount, p.loanRepay))
      break
    }

    // ===================== 彩票系统 =====================
    case 'BUY_TICKET': {
      // 保留单张购买（兼容）
      if (s.pending?.kind !== 'lottery') break
      if (s.lotteryBoughtTurn) {
        s.log.push(`${p.name} 本回合已经买过彩票了`)
        break
      }
      const num = action.number
      const res = buyTicket(s, p.id, num)
      if (res.ok) {
        s.lotteryBoughtTurn = true
      }
      break
    }
    case 'BUY_TICKETS': {
      // 批量购买
      if (s.pending?.kind !== 'lottery') break
      if (s.lotteryBoughtTurn) {
        s.log.push(`${p.name} 本回合已经买过彩票了`)
        break
      }
      const numbers = action.numbers
      if (!Array.isArray(numbers) || numbers.length === 0) break
      const res = buyTickets(s, p.id, numbers)
      if (res.ok) {
        s.lotteryBoughtTurn = true
      } else if (res.msg) {
        s.log.push(res.msg)
      }
      break
    }
    case 'LOTTERY_CLOSE': {
      if (s.pending?.kind === 'lottery') s.pending = null
      break
    }
    case 'LOTTERY_DRAW_CLOSE': {
      if (s.pending?.kind === 'lottery_draw') s.pending = null
      break
    }

    // ===================== 免租卡（被动触发） =====================
    case 'SHIELD_USE': {
      if (s.pending?.kind !== 'shield') break
      const sp = s.pending
      // 移除手牌中的免租卡
      const idx = p.hand.findIndex((c) => c.type === 'shield')
      if (idx !== -1) p.hand.splice(idx, 1)
      s.log.push(`🛡️ ${p.name} 使用免租卡，豁免本次${sp.feeName}！`)
      s.pending = null
      // 免租后继续弹窗检测
      tryTriggerChancePopup(s)
      tryTriggerLotteryDeferred(s)
      break
    }
    case 'SHIELD_SKIP': {
      if (s.pending?.kind !== 'shield') break
      const sp = s.pending
      s.pending = null
      // 正常支付租金
      const tile = TILES[sp.tileId]
      const owner = s.players.find((pl) => pl.id === sp.ownerId)
      if (tile && owner) {
        const level = owner.levels[tile.id] ?? 0
        let fee = getRent(s, tile, level)
        const rentMul = godRentMultiplier(owner)
        if (rentMul !== 1) fee = Math.round(fee * rentMul)
        const feeMul = godFeeMultiplier(p)
        if (feeMul !== 1) fee = Math.round(fee * feeMul)
        payMoney(s, p.id, owner.id, fee, `使用 ${owner.name} 的「${tile.name}」支付${sp.feeName}`)
        checkBankrupt(s, p)
        // 商圈达成提示
        if (tile.group && isGroupComplete(s, tile.group)) {
          const key = `${tile.group}@${s.round}`
          if (!s.announcedGroups[key]) {
            s.announcedGroups[key] = true
            s.log.push(`🏙️ 「${GROUPS[tile.group]?.name ?? tile.group}」组合达成，${owner.name} 收租 ×1.5！`)
          }
        }
      }
      tryTriggerChancePopup(s)
      tryTriggerLotteryDeferred(s)
      break
    }

    // ===================== 股票系统 =====================
    case 'STOCK_BUY': {
      if (s.phase !== 'landed' && s.phase !== 'roll') break
      const res = buyStock(s, p, action.code, action.shares)
      if (!res.ok) s.log.push(res.msg)
      break
    }
    case 'STOCK_SELL': {
      if (s.phase !== 'landed' && s.phase !== 'roll') break
      const res = sellStock(s, p, action.code, action.shares)
      if (!res.ok) s.log.push(res.msg)
      break
    }

    // ===================== 拍卖（零元起拍，两轮盲拍） =====================
    // 盲拍流程：每轮所有存活玩家独立出价 → 揭晓（展示所有价格，不知谁出的）→
    //          最高价唯一则成交，平局则下一轮，直到 maxRounds 轮后强制成交
    case 'AUCTION_BID': {
      // 玩家提交盲出价（action.amount = 出价金额）
      if (s.pending?.kind !== 'auction') break
      const ap = s.pending
      if (ap.roundStep !== 0) break // 只在出价阶段接受
      const bidder = s.players[ap.turn]
      if (!bidder || !bidder.alive) break
      // 出价归一：非数字/负数一律按 0 处理（防 NaN 混进 bids）
      const amount = Math.max(0, Math.floor(Number(action.amount) || 0))
      if (amount > 0 && bidder.money < amount) {
        ap.bids[bidder.id] = 0
      } else {
        ap.bids[bidder.id] = amount
      }
      // 盲拍：出价阶段不记任何日志，防止从顺序推断出价者（揭晓阶段才汇总）
      // 推进到下一个存活玩家
      let ni = ap.turn
      for (let k = 0; k < s.players.length; k++) {
        ni = (ni + 1) % s.players.length
        if (s.players[ni].alive) break
      }
      ap.turn = ni
      // 检查是否所有存活玩家都已出价（动态计算 aliveCount）
      const aliveCount = s.players.filter((p) => p.alive).length
      const bidCount = Object.keys(ap.bids).length
      if (bidCount >= aliveCount) {
        // 所有玩家出完价 → 进入揭晓阶段
        ap.roundStep = 1
        // 揭晓日志：只展示价格列表，不关联玩家名（盲拍核心要求）
        const bidList = Object.values(ap.bids)
          .filter((v) => v > 0)
          .sort((a, b) => b - a)
        s.log.push(`🔨 第 ${ap.round + 1} 轮出价揭晓：${bidList.length > 0 ? bidList.map((a) => '¥' + a).join(' / ') : '全部放弃'}`)
      }
      break
    }

    case 'AUCTION_REVEAL': {
      // 揭晓本轮出价结果，判断是否成交或继续下一轮
      if (s.pending?.kind !== 'auction') break
      const ap = s.pending
      if (ap.roundStep !== 1) break
      const tile = TILES[ap.tileId]
      // 找出最高价
      const bidEntries = Object.entries(ap.bids).filter(([, v]) => v > 0)
      if (bidEntries.length === 0) {
        // 全部放弃 → 流拍
        s.pending = null
        s.log.push(`🔨 「${tile.name}」无人出价，流拍！`)
        s.phase = 'roll'
        break
      }
      bidEntries.sort((a, b) => b[1] - a[1])
      const topBid = bidEntries[0][1]
      const topBidders = bidEntries.filter(([, v]) => v === topBid)
      if (topBidders.length === 1 || ap.round + 1 >= ap.maxRounds) {
        // 最高价唯一 或 已达最大轮次 → 成交
        const [winnerId, winBid] = topBidders[0]
        s.pending = null
        const win = s.players.find((x) => x.id === winnerId)
        if (winBid === 0 || !win) {
          s.log.push(`🔨 「${tile.name}」流拍！`)
        } else {
          win.money -= winBid
          win.properties.push(tile.id)
          if (isPropertyTile(tile)) win.levels[tile.id] = 0
          s.log.push(`🔨 拍卖成交！${win.name} 以 ¥${winBid} 拍下「${tile.name}」`)
        }
        s.phase = 'roll'
      } else {
        // 平局 → 下一轮盲拍
        ap.round++
        ap.roundStep = 0
        ap.bids = {}
        ap.turn = s.turnIndex // 从当前回合玩家开始
        // 确保 turn 指向存活玩家
        let tries = 0
        while (!s.players[ap.turn].alive && tries++ < s.players.length) {
          ap.turn = (ap.turn + 1) % s.players.length
        }
        s.log.push(`🔨 第 ${ap.round + 1} 轮平局！${topBidders.length} 人同价 ¥${topBid}，再加赛一轮`)
      }
      break
    }

    // ===================== 调试（DebugPanel 专用，不影响正常对局） =====================
    // 传送到任意格子并触发落地事件（买地/租金/轻轨/事件等，和正常走到一样）
    case 'DEBUG_TELEPORT': {
      const target = TILES[action.tileId]
      if (!target || target.removed) break
      const pl = action.playerId ? s.players.find((x) => x.id === action.playerId) : p
      if (!pl) break
      const fromName = TILES[pl.pos]?.name ?? '?'
      pl.pos = target.id
      pl.walkPath = [target.id]
      pl.cameFrom = null // 传送来，无明确来路
      s.pending = null
      s.log.push(`🛠 [调试] ${pl.name} 传送到「${target.name}」（原在 ${fromName}）`)
      s.phase = 'landed'
      handleLanding(s, pl)
      break
    }

    // 不掷骰直接走 N 步（遇分岔：人类弹卡、AI 自动选）
    case 'DEBUG_MOVE': {
      const pl = action.playerId ? s.players.find((x) => x.id === action.playerId) : p
      if (!pl) break
      const steps = Math.max(1, Math.min(50, Math.floor(action.steps ?? 1)))
      pl.walkPath = [pl.pos]
      const moved = movePlayer(s, pl, steps, pl.cameFrom)
      s.log.push(`🛠 [调试] ${pl.name} 直接走 ${steps} 步`)
      if (moved.paused) {
        s.phase = 'fork'
      } else {
        s.phase = 'landed'
        handleLanding(s, pl)
      }
      break
    }

    // 加钱 / 扣钱
    case 'DEBUG_MONEY': {
      const pl = action.playerId ? s.players.find((x) => x.id === action.playerId) : p
      if (!pl) break
      const amt = Math.floor(action.amount ?? 0)
      if (amt === 0) break
      addMoney(s, pl.id, amt, amt > 0 ? `🛠 [调试] ${pl.name} 加钱 ¥${amt}` : `🛠 [调试] ${pl.name} 扣钱 ¥${-amt}`)
      checkBankrupt(s, pl)
      break
    }

    // 送卡片（DEBUG_GIVE，kind='card'，id = type）
    case 'DEBUG_GIVE': {
      const pl = action.playerId ? s.players.find((x) => x.id === action.playerId) : p
      if (!pl) break
      if (action.kind === 'card') {
        const tpl = CARDS.find((c) => c.type === action.id)
        if (tpl && pl.hand.length < 10) {
          pl.hand.push({ ...tpl, id: `dbg-${tpl.type}-${pl.id}-${++s._cardSeq}` })
          s.log.push(`🛠 [调试] ${pl.name} 获得卡片「${tpl.name}」`)
        }
      }
      break
    }

    // 强买地产 / 设等级（从原 owner 拿走，直接划给目标玩家）
    case 'DEBUG_PROPERTY': {
      const tile = TILES[action.tileId]
      if (!tile || !isPropertyTile(tile)) break
      const pl = action.playerId ? s.players.find((x) => x.id === action.playerId) : p
      if (!pl) break
      for (const op of s.players) {
        if (op.id !== pl.id && op.properties.includes(tile.id)) {
          op.properties = op.properties.filter((i) => i !== tile.id)
          delete op.levels[tile.id]
        }
      }
      if (!pl.properties.includes(tile.id)) pl.properties.push(tile.id)
      pl.levels[tile.id] = Math.max(0, Math.min(3, Math.floor(action.level ?? 0)))
      s.log.push(`🛠 [调试] 把「${tile.name}」划给 ${pl.name}（${pl.levels[tile.id]} 级）`)
      break
    }

    // 进监狱 / 出狱（turns: 0=出狱，>0=关 N 轮）
    case 'DEBUG_JAIL': {
      const pl = action.playerId ? s.players.find((x) => x.id === action.playerId) : p
      if (!pl) break
      pl.jailLeft = Math.max(0, Math.floor(action.turns ?? 2))
      s.log.push(`🛠 [调试] ${pl.name} ${pl.jailLeft > 0 ? `进监狱 ${pl.jailLeft} 轮` : '出狱'}`)
      break
    }

    // 切换到指定玩家回合
    case 'DEBUG_SWITCH_TURN': {
      const idx = s.players.findIndex((x) => x.id === action.playerId)
      if (idx === -1 || idx === s.turnIndex) break
      s.turnIndex = idx
      s.dice = null
      s.pending = null
      s.phase = 'roll'
      s.log.push(`🛠 [调试] 切换到 ${s.players[idx].name} 的回合`)
      break
    }

    // 强制附身指定神仙（调试用，godId = GODS 的 key）
    case 'DEBUG_FORCE_GOD': {
      const pl = action.playerId ? s.players.find((x) => x.id === action.playerId) : p
      if (!pl) break
      // 清空现有神仙，强制附身指定神仙
      pl.god = action.godId
      pl.godTurnsLeft = GODS[action.godId]?.duration ?? 0
      const god = GODS[action.godId]
      if (god) {
        s.log.push(`🛠 [调试] ${pl.name} 被强制附身「${god.icon}${god.name}」`)
        if (god.kind === 'instant') {
          // 崔斯特：即时给卡（手牌满给50积分/张）后清附身
          let count = 0
          pl.hand = pl.hand || []
          for (let i = 0; i < 4; i++) {
            if (pl.hand.length >= 10) {
              pl.points = (pl.points ?? 0) + 50
            } else {
              const tpl = CARDS[Math.floor(Math.random() * CARDS.length)]
              pl.hand.push({ ...tpl, id: `dbg-god-${pl.id}-${++s._cardSeq}` })
              count++
            }
          }
          s.log.push(`🛠 [调试] 崔斯特给 ${pl.name} ${count} 张卡${count < 4 ? ` + ${(4 - count) * 50} 积分` : ''}`)
          pl.god = null
          pl.godTurnsLeft = 0
        } else if (action.godId === 'godOfPoverty') {
          // 穷神：立即扣20%
          const penalty = Math.floor((pl.money || 0) * 0.2)
          if (penalty > 0) {
            pl.money -= penalty
            s.log.push(`🛠 [调试] 穷神搜刮 ${pl.name}：-¥${penalty}`)
          }
        }
      }
      break
    }

    // 调试：强制借款
    case 'DEBUG_TAKE_LOAN': {
      const pl = action.playerId ? s.players.find((x) => x.id === action.playerId) : p
      if (!pl) break
      const amt = Math.max(1, Math.floor(action.amount || 1000))
      takeLoan(s, pl, amt)
      break
    }

    // 调试：强制还款
    case 'DEBUG_REPAY_LOAN': {
      const pl = action.playerId ? s.players.find((x) => x.id === action.playerId) : p
      if (!pl) break
      const amt = Math.max(1, Math.floor(action.amount || 1000))
      repayLoan(s, pl, amt)
      break
    }

    default:
      break
  }

  if (result.log.length > MAX_LOG) {
    result.log.splice(0, result.log.length - MAX_LOG)
  }
  // 奖金领取后弹出提示弹窗（在落地结算之后，覆盖购买/商店等弹窗）
  if (result._claimedBonus && result.status === 'playing') {
    result.pending = { kind: 'bonus_info', ...result._claimedBonus }
    result._claimedBonus = null
  }
  return result
}

export { CARDS }
