// ai.js — AI 决策（一档智能·会用卡/乘轻轨）
// 决策优先级：买地 → 乘轻轨 → 即时卡 → 攻击卡 → 升级 → 结束
import { TILES, isPropertyTile, isMetro, METRO_FEE } from './board.js'
import { STOCKS } from './stock.js'
import { currentPlayer } from './turn.js'
import { canUpgrade, upgradeCost } from './property.js'
import { GODS } from './god.js'

const SAFETY_RATIO = 0.2

// 负面神仙（AI 会用送神卡解除）
function isBadGod(godId) {
  return godId === 'godOfMisfortune' || godId === 'godOfPoverty' || godId === 'devil'
}

// ===== 工具：选目标 =====
function ownProps(cur) {
  return cur.properties.filter((i) => isPropertyTile(TILES[i]))
}

// 对手拥有的最高级地产（用于拆楼/怪兽）
function bestEnemyProp(state, cur) {
  let best = null
  let bestScore = -1
  for (const p of state.players) {
    if (!p.alive || p.id === cur.id) continue
    for (const idx of p.properties) {
      const t = TILES[idx]
      if (!isPropertyTile(t)) continue
      const lv = p.levels[idx] ?? 0
      if (lv >= 1 && lv > bestScore) {
        bestScore = lv
        best = { tileId: idx, lv, owner: p }
      }
    }
  }
  return best
}

// 有手牌的对手（用于抢夺）
function enemyWithCard(state, cur) {
  const others = state.players.filter((p) => p.alive && p.id !== cur.id && p.hand.length > 0)
  if (others.length === 0) return null
  return others[Math.floor(Math.random() * others.length)].id
}

// 随机存活对手（用于停留卡）
function randomEnemy(state, cur) {
  const others = state.players.filter((p) => p.alive && p.id !== cur.id)
  if (others.length === 0) return null
  return others[Math.floor(Math.random() * others.length)].id
}

export function aiDecide(state, playerId) {
  // 交易提案：目标是本 AI 时立即评估（不受当前回合限制——目标玩家本来就不是回合玩家）
  if (state.pending?.kind === 'trade' && state.pending.to === playerId) {
    const tp = state.pending
    const fromP = state.players.find((p) => p.id === tp.from)
    if (!fromP) return { type: 'TRADE_REJECT' }
    // 计算给出的净值
    let offerVal = tp.offer.money || 0
    for (const id of tp.offer.lands || []) offerVal += TILES[id]?.price ?? 0
    // 计算得到的净值
    let requestVal = tp.request.money || 0
    for (const id of tp.request.lands || []) requestVal += TILES[id]?.price ?? 0
    // AI 接受条件：得到的 >= 给出的，且差距不太离谱
    if (requestVal >= offerVal && requestVal > 0) {
      return { type: 'TRADE_ACCEPT' }
    }
    return { type: 'TRADE_REJECT' }
  }

  // 拍卖阶段：行动者是当前出价轮到的玩家（非回合玩家）
  const cur = state.phase === 'auction' && state.pending?.kind === 'auction' ? state.players[state.pending.turn] : currentPlayer(state)
  if (!cur || cur.id !== playerId) return null

  if (state.phase === 'auction') {
    const ap = state.pending
    if (ap.roundStep === 1) return { type: 'AUCTION_REVEAL' } // 揭晓阶段自动触发
    if (ap.roundStep !== 0) return null
    const tile = TILES[ap.tileId]
    // AI 盲拍策略：随机出到原价 50%~80%，保留 20% 安全垫
    const maxBid = Math.floor(tile.price * (0.5 + Math.random() * 0.3))
    const safeReserve = cur.money * 0.2
    const bid = Math.min(maxBid, Math.floor(cur.money - safeReserve))
    if (bid > 0) return { type: 'AUCTION_BID', amount: bid }
    return { type: 'AUCTION_BID', amount: 0 } // 放弃
  }

  // 决定先手顺序阶段：掷骰
  if (state.phase === 'order') {
    return { type: 'ROLL_ORDER' }
  }

  if (state.phase === 'roll') {
    return { type: 'ROLL_DICE' }
  }

  // step 阶段：逐格推进
  if (state.phase === 'step' && state.stepsRemaining > 0) {
    return { type: 'STEP' }
  }

  if (state.phase === 'landed') {
    // 0. 卡片商店：AI 不买卡，路过直接关闭（pending 会清理，回合继续）
    if (state.pending?.kind === 'shop') {
      return { type: 'SHOP_CLOSE' }
    }
    // 1. 买地/买桥（留安全垫）
    if (state.pending?.kind === 'buy') {
      const tile = TILES[state.pending.tileId]
      if (cur.money >= tile.price && cur.money - tile.price >= cur.money * SAFETY_RATIO) {
        return { type: 'BUY_PROPERTY' }
      }
      return { type: 'SKIP_BUY' }
    }

    // 2. 打卡大礼包：免费传送到自己最高价值地产（无地产则随机）
    if (state.pending?.kind === 'checkin') {
      const own = cur.properties.filter((i) => isPropertyTile(TILES[i]))
      if (own.length > 0) {
        const best = own.sort((a, b) => (TILES[b].price ?? 0) - (TILES[a].price ?? 0))[0]
        return { type: 'CHECKIN_TELEPORT', tileId: best }
      }
      const others = TILES.filter((t) => t && !t.removed && isPropertyTile(t))
      const rand = others[Math.floor(Math.random() * others.length)]
      return { type: 'CHECKIN_TELEPORT', tileId: rand.id }
    }

    // 3. 乘轻轨（在轻轨站且有钱 → 评估目的地后选最优站）
    if (state.pending?.kind === 'metro') {
      if (cur.money >= METRO_FEE) {
        const stations = TILES.filter((t) => t && isMetro(t) && t.id !== cur.pos)
        if (stations.length > 0) {
          // 评分选站：自己地块 > 空地 > 对手低级地 > 对手高级地
          const scored = stations.map((st) => {
            let score = 0
            const owner = state.players.find((p) => p.alive && p.properties.includes(st.id))
            if (owner?.id === cur.id) {
              score = 100 + (cur.levels[st.id] ?? 0) * 50 // 回自己的站（已盖楼的优先）
            } else if (!owner) {
              score = st.price * 0.3 // 空地（可买来扩建商圈）
            } else {
              const lv = owner.levels[st.id] ?? 0
              score = -st.rent * (1 + lv) // 对手的地（扣租金期望）
            }
            return { st, score }
          })
          scored.sort((a, b) => b.score - a.score)
          // 从前 50% 优质站中选一个（保留一定随机性，避免完全确定性的"精算"感）
          const topN = Math.max(1, Math.ceil(scored.length / 2))
          const pick = scored[Math.floor(Math.random() * topN)]
          return { type: 'TRAVEL_METRO', targetTileId: pick.st.id }
        }
      }
      return { type: 'END_TURN' }
    }

    // 3.5 股票交易（有钱且未用卡时）
    if (!cur.firstTurn && cur.money >= 500 && !cur.cardUsed) {
      // 找连跌2回合以上的股票抄底
      const codes = Object.keys(STOCKS)
      const dipStocks = codes.filter(c => state.stockRuntime[c].trend <= -2 && state.stockRuntime[c].current > STOCKS[c].min)
      if (dipStocks.length > 0 && Math.random() < 0.3) {
        const code = dipStocks[Math.floor(Math.random() * dipStocks.length)]
        const price = state.stockRuntime[code].current
        const maxShares = Math.floor((cur.money * 0.2) / (price * 1.01))
        const heldCodes = Object.keys(cur.stockHoldings || {}).filter(c => cur.stockHoldings[c] > 0)
        const alreadyHeld = heldCodes.includes(code)
        if (maxShares > 0 && (alreadyHeld || heldCodes.length < 5)) {
          return { type: 'STOCK_BUY', code, shares: Math.min(maxShares, 20) }
        }
      }
      // 找连涨2回合以上的股票卖出
      const riseStocks = codes.filter(c => (cur.stockHoldings?.[c] || 0) > 0 && state.stockRuntime[c].trend >= 2)
      if (riseStocks.length > 0 && Math.random() < 0.2) {
        const code = riseStocks[Math.floor(Math.random() * riseStocks.length)]
        return { type: 'STOCK_SELL', code, shares: cur.stockHoldings[code] }
      }
    }

    // 4. 即时卡（无需目标）——第一回合/已用卡不用
    const instant = !cur.firstTurn && !cur.cardUsed && cur.hand.find((c) =>
      c.type === 'steal' ? enemyWithCard(state, cur) != null
        : c.type === 'freeUpgrade' ? cur.properties.some((i) => isPropertyTile(TILES[i]) && (cur.levels[i] ?? 0) < 3)
          : c.type === 'sendGod' ? cur.god != null && isBadGod(cur.god)
            : c.type === 'blackStock' || c.type === 'redStock' ? cur.money >= 1000
              : false
    )
    if (instant) {
      // 股票卡需要选目标股票
      if (instant.type === 'blackStock' || instant.type === 'redStock') {
        const codes = Object.keys(STOCKS)
        const code = codes[Math.floor(Math.random() * codes.length)]
        return { type: 'USE_CARD', cardId: instant.id, target: { code } }
      }
      return { type: 'USE_CARD', cardId: instant.id }
    }

    // 4. 攻击卡（需要目标）——第一回合/已用卡不用
    const attack = !cur.firstTurn && !cur.cardUsed && cur.hand.find((c) =>
      c.type === 'demolish' ? bestEnemyProp(state, cur)?.lv >= 1
        : c.type === 'monster' ? bestEnemyProp(state, cur) != null
          : c.type === 'hold' ? randomEnemy(state, cur) != null
            : false
    )
    if (attack) {
      if (attack.type === 'demolish' || attack.type === 'monster') {
        const t = bestEnemyProp(state, cur)
        if (t) return { type: 'USE_CARD', cardId: attack.id, target: { tileId: t.tileId } }
      }
      if (attack.type === 'hold') {
        const t = randomEnemy(state, cur)
        if (t != null) return { type: 'USE_CARD', cardId: attack.id, target: { playerId: t } }
      }
    }

    // 5. 升级（先盖低级楼）
    const ownPropsList = [...ownProps(cur)].sort((a, b) => (cur.levels[a] ?? 0) - (cur.levels[b] ?? 0))
    for (const idx of ownPropsList) {
      const tile = TILES[idx]
      if (canUpgrade(state, cur, tile)) {
        const cost = upgradeCost(tile)
        if (cur.money - cost >= cur.money * SAFETY_RATIO) {
          return { type: 'UPGRADE_PROPERTY', tileId: idx }
        }
      }
    }

    return { type: 'END_TURN' }
  }

  return null
}
