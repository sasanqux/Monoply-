// turn.js — 落地结算 + 回合推进（52 格 · 图结构 · 轻轨 · 商圈）
import { TILES, isPropertyTile, isMetro, GROUPS } from './board.js'
import { payMoney, addMoney } from './bank.js'
import { getRent, isGroupComplete, totalAssets, isMortgaged } from './property.js'
import { randomCard, checkShieldCard } from './card.js'
import { alivePlayers, checkBankrupt, getWinnerByElimination, settleByTurns } from './gameOver.js'
import { handleGodTile, applyGodOnLand, godRentMultiplier, godFeeMultiplier, applyPovertyPenalty, tickGod, GODS } from './god.js'
import { tickLottery, resetLotteryIfWon, tryTriggerLotteryDeferred } from './lottery.js'
import { tickStockPrices } from './stock.js'
import { drawStockEvents, applyStockEvent, tickStockEvents } from './stockEvents.js'

const HAND_LIMIT = 10
const CORNER_BONUS = 800

// 机会事件池（全局事件：影响所有玩家/跳转/暂停等）
// icon: 卡片图标, desc: 卡片描述（弹窗展示用）
const EVENT_POOL = [
  { text: '国补', kind: 'allGain', amount: 2000, icon: '💰', desc: '国家发放补贴！每位存活玩家获得 ¥2000' },
  { text: '收房产税', kind: 'propertyTax', amount: 200, icon: '🏛️', desc: '政府征收房产税！每位玩家每块地产缴纳 ¥200' },
  { text: '歌乐山贵宾', kind: 'gotoHospital', turns: 2, icon: '🏥', desc: '被诊断为疯子！送歌乐山休养 2 轮' },
  { text: '回到最初的起点', kind: 'gotoStart', icon: '🏠', desc: '回到最初的起点——朝天门！触发打卡' },
  { text: '八中主宰', kind: 'seizeTile', tileId: 28, rentBonus: 200, icon: '🏫', desc: '八中主宰！直接获得八中地块(28)，租金加成 +200' },
  { text: '缴纳所得税', kind: 'incomeTax', rate: 0.1, icon: '💸', desc: '缴纳所得税！支付当前现金的 10%' },
  { text: '重庆马拉松', kind: 'marathon', icon: '🏃', desc: '重庆马拉松！所有玩家下一回合行动格数翻倍' },
  { text: '放高温假', kind: 'heatWave', cost: 500, icon: '🌡️', desc: '放高温假！其他玩家暂停一轮，自己支付 ¥500' },
  { text: '铜梁龙比赛日', kind: 'gotoTile', tileId: 22, icon: '🐉', desc: '铜梁龙比赛日！传送到铜梁(22)观看龙舞比赛' },
  { text: '请吃火锅', kind: 'hotpot', cost: 1000, icon: '🍲', desc: '请吃火锅！支付 ¥1000，其他玩家 50% 概率拉肚子暂停一轮' },
]

export function drawEvent() {
  return EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)]
}

// 落地结算
export function handleLanding(state, player) {
  const tile = TILES[player.pos]

  // 卡片积分：落地任何有积分的格（除朝天门/事件格）都可获得，任意次数
  if (tile.points) {
    player.points = (player.points ?? 0) + tile.points
    state.log.push(`${player.name} 到达「${tile.name}」，获得 ${tile.points} 卡片积分（共 ${player.points}）`)
  }

  // 神仙格职能（在地产购买之前触发）
  state._godAfterBuy = null
  if (tile.god && !state.pending) {
    const godId = handleGodTile(state, player)
    if (player.god === 'godOfPoverty') applyPovertyPenalty(state, player)
    // 即时型神仙(崔斯特)不附身，不弹附身弹窗
    if (GODS[godId]?.kind !== 'instant') {
      state._godAfterBuy = { godId, playerId: player.id }
    }
  }

  if (isPropertyTile(tile)) {
    // 神仙落地效果（土地公/天使/恶魔）
    applyGodOnLand(state, player, tile, 'onArrive')

    const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
    if (!owner) {
      state.pending = { kind: 'buy', tileId: tile.id }
    } else if (owner.id === player.id) {
      state.log.push(`${player.name} 回到自己的「${tile.name}」`)
    } else if (isMortgaged(owner, tile.id)) {
      // 抵押地不收租
      state.log.push(`${player.name} 踩到 ${owner.name} 抵押中的「${tile.name}」，无需付租`)
    } else {
      // 轻轨站：可乘轻轨去其他站（购买决策优先，买完不再弹乘轻轨）
      if (isMetro(tile) && !state.pending) {
        state.pending = { kind: 'metro', tileId: tile.id }
      }
      // 维护可升级地块（踩到自己的地产 → 加入可升级列表）
      if (!player.upgradableTiles) player.upgradableTiles = []
      if (!player.upgradableTiles.includes(tile.id)) player.upgradableTiles.push(tile.id)
      // 免租卡：手中有卡时触发（AI自动用，人类弹询问）
      const shieldResult = checkShieldCard(state, player)
      if (shieldResult === 'ask') {
        // 人类玩家：暂停，弹出询问（保存支付信息供后续使用）
        state.pending = {
          kind: 'shield',
          tileId: tile.id,
          ownerId: owner.id,
          feeName: isMetro(tile) ? '轻轨使用费' : '租金',
        }
        return  // 等玩家选择后再继续
      } else if (shieldResult === 'used') {
        // AI 已自动使用，跳过支付
      } else {
        // 无卡，正常支付
        const level = owner.levels[tile.id] ?? 0
        let fee = getRent(state, tile, level)
        // 财神/衰神：租金倍率
        const rentMul = godRentMultiplier(owner)
        let godTag = ''
        if (rentMul === 2) godTag = '（财神加持 ×2）'
        else if (rentMul === 0.5) godTag = '（衰神打折 ×0.5）'
        if (rentMul !== 1) fee = Math.round(fee * rentMul)
        // 穷神：过路费 ×2
        const feeMul = godFeeMultiplier(player)
        if (feeMul !== 1) fee = Math.round(fee * feeMul)
        const feeName = isMetro(tile) ? '轻轨使用费' : '租金'
        payMoney(state, player.id, owner.id, fee, `使用 ${owner.name} 的「${tile.name}」支付${feeName}${godTag}`)
        checkBankrupt(state, player)
      }
      // 商圈达成提示：记录"已达成"状态，但每轮开始时重置（防止地块换手后仍显示旧状态）
      if (tile.group && isGroupComplete(state, tile.group)) {
        const key = `${tile.group}@${state.round}`
        if (!state.announcedGroups[key]) {
          state.announcedGroups[key] = true
          state.log.push(`🏙️ 「${GROUPS[tile.group]?.name ?? tile.group}」组合达成，${owner.name} 收租 ×1.5！`)
        }
      }
    }
    // 注意：不 return，继续执行下方的弹窗检测逻辑
  } else {

  switch (tile.type) {
    case 'start': {
      // 朝天门打卡：到达记录一次，累计 3 次领大礼包（¥5000 + 3 张随机卡 + 免费传送）
      player.checkins = (player.checkins ?? 0) + 1
      if (player.checkins >= 3) {
        player.checkins = 0
        addMoney(state, player.id, 5000, '朝天门打卡满 3 次，获得大礼包 ¥5000！')
        for (let i = 0; i < 3; i++) {
          if (player.hand.length >= HAND_LIMIT) {
            addMoney(state, player.id, 400, '手牌满了，卡片换成了安慰费')
          } else {
            const card = randomCard()
            player.hand.push({ ...card, id: `c${player.id}-${++state._cardSeq}` })
          }
        }
        state.pending = { kind: 'checkin' }
        state.log.push(`🎁 ${player.name} 朝天门打卡满 3 次！获得大礼包：¥5000 + 3 张随机卡 + 免费传送`)
      } else {
        state.log.push(`📍 ${player.name} 朝天门打卡第 ${player.checkins} 次（满 3 次领大礼包）`)
      }
      break
    }
    case 'corner':
      addMoney(state, player.id, CORNER_BONUS, `在「${tile.name}」逛了一圈，领到奖励 ¥${CORNER_BONUS}`)
      break
    case 'chance': {
      const ev = drawEvent()
      state.log.push(`❓ 机会：${ev.text}`)
      switch (ev.kind) {
        case 'allGain': {
          // 国补：每位玩家获得 amount
          for (const p of state.players) {
            if (p.alive) {
              p.money += ev.amount
              state.log.push(`💰 ${p.name} 获得国补 ¥${ev.amount}（现 ¥${p.money}）`)
            }
          }
          break
        }
        case 'propertyTax': {
          // 收房产税：每位玩家每拥有一块地产，-amount
          for (const p of state.players) {
            if (!p.alive) continue
            const tax = p.properties.length * ev.amount
            if (tax > 0) {
              p.money -= tax
              state.log.push(`🏛️ ${p.name} 缴纳房产税 ¥${tax}（${p.properties.length} 块地，现 ¥${p.money}）`)
              checkBankrupt(state, p)
            }
          }
          break
        }
        case 'gotoHospital': {
          // 歌乐山贵宾：直接跳转到歌乐山(20)，暂停行动 turns 轮
          // hospital 仅作展示标记；跳过逻辑统一走 skipTurns（ROLL_DICE 里消零时清 hospital），
          // 避免"hospital 分支 + skipTurns 分支"各跳一次 = 实际多停一轮
          player.pos = 20
          player.hospital = true
          player.skipTurns = ev.turns
          state.log.push(`🏥 ${player.name} 被诊断为疯子，送歌乐山休养 ${ev.turns} 轮！`)
          break
        }
        case 'gotoStart': {
          // 回到最初的起点：直接回到朝天门(1)并触发打卡落地（内联展开，不递归 handleLanding）
          player.pos = 1
          player.walkPath = [...(player.walkPath || []), 1]
          state.log.push(`🏠 ${player.name} 回到最初的起点——朝天门`)
          // 内联 start 落地逻辑（打卡）
          player.checkins = (player.checkins ?? 0) + 1
          if (player.checkins >= 3) {
            player.checkins = 0
            addMoney(state, player.id, 5000, '朝天门打卡满 3 次，获得大礼包 ¥5000！')
            for (let i = 0; i < 3; i++) {
              if (player.hand.length >= HAND_LIMIT) {
                addMoney(state, player.id, 400, '手牌满了，卡片换成了安慰费')
              } else {
                const card = randomCard()
                player.hand.push({ ...card, id: `c${player.id}-${++state._cardSeq}` })
              }
            }
            state.pending = { kind: 'checkin' }
            state.log.push(`🎁 ${player.name} 朝天门打卡满 3 次！获得大礼包：¥5000 + 3 张随机卡 + 免费传送`)
          } else {
            state.log.push(`📍 ${player.name} 朝天门打卡第 ${player.checkins} 次（满 3 次领大礼包）`)
          }
          break
        }
        case 'seizeTile': {
          // 八中主宰：直接获得八中地块(28)，如果已有主人就夺取，租金加 rentBonus（可叠加至1000）
          const tile = TILES[ev.tileId]
          const owner = state.players.find((p) => p.alive && p.properties.includes(ev.tileId))
          if (owner && owner.id !== player.id) {
            // 从原主人处夺取
            owner.properties = owner.properties.filter((i) => i !== ev.tileId)
            delete owner.levels[ev.tileId]
            state.log.push(`🏫 ${player.name} 从 ${owner.name} 手中夺取了「${tile.name}」！`)
          } else if (owner && owner.id === player.id) {
            state.log.push(`🏫 ${player.name} 已是「${tile.name}」主人，租金加成提升！`)
          }
          if (!player.properties.includes(ev.tileId)) {
            player.properties.push(ev.tileId)
            player.levels[ev.tileId] = 0
          }
          // 租金加成（叠加至上限 1000）
          const currentBonus = player._rentBonus || 0
          player._rentBonus = Math.min(1000, currentBonus + ev.rentBonus)
          break
        }
        case 'incomeTax': {
          // 缴纳所得税：支付现金的 rate（10%）
          const tax = Math.floor(player.money * ev.rate)
          if (tax > 0) {
            player.money -= tax
            state.log.push(`💸 ${player.name} 缴纳所得税 10% = ¥${tax}（现 ¥${player.money}）`)
            checkBankrupt(state, player)
          }
          break
        }
        case 'marathon': {
          // 重庆马拉松：所有玩家接下来一回合行动格数翻倍
          for (const p of state.players) {
            if (p.alive) p._marathon = true
          }
          state.log.push(`🏃 重庆马拉松！所有玩家下一回合行动格数翻倍！`)
          break
        }
        case 'heatWave': {
          // 放高温假：其他玩家暂停一回合，该玩家 -cost
          player.money -= ev.cost
          for (const p of state.players) {
            if (p.alive && p.id !== player.id) {
              p.skipTurns += 1
            }
          }
          state.log.push(`🌡️ ${player.name} 放高温假，其他玩家暂停一轮（-${ev.cost}）`)
          checkBankrupt(state, player)
          break
        }
        case 'gotoTile': {
          // 铜梁龙比赛日：跳转到目标格并触发落地结算（内联展开，不递归 handleLanding）
          player.pos = ev.tileId
          player.walkPath = [...(player.walkPath || []), ev.tileId]
          const tile = TILES[ev.tileId]
          state.log.push(`🐉 ${player.name} 被传送到「${tile.name}」观看龙舞比赛！`)
          // 内联通用地产/景点落地逻辑
          if (tile.points) {
            player.points = (player.points ?? 0) + tile.points
            state.log.push(`${player.name} 到达「${tile.name}」，获得 ${tile.points} 卡片积分（共 ${player.points}）`)
          }
          if (isPropertyTile(tile)) {
            const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
            if (!owner) {
              state.pending = { kind: 'buy', tileId: tile.id }
            } else if (owner.id !== player.id) {
              const shieldResult2 = checkShieldCard(state, player)
              if (shieldResult2 === 'ask') {
                state.pending = { kind: 'shield', tileId: tile.id, ownerId: owner.id, feeName: isMetro(tile) ? '轻轨使用费' : '租金' }
                break
              } else if (shieldResult2 === 'used') {
                break
              }
              const level = owner.levels[tile.id] ?? 0
              const fee = Math.round(getRent(state, tile, level)) // 取整，避免 ×1.5 产生小数钱
              const feeName = isMetro(tile) ? '轻轨使用费' : '租金'
              payMoney(state, player.id, owner.id, fee, `使用 ${owner.name} 的「${tile.name}」支付${feeName}`)
              checkBankrupt(state, player)
            }
            if (isMetro(tile) && !state.pending) {
              state.pending = { kind: 'metro', tileId: tile.id }
            }
          }
          break
        }
        case 'hotpot': {
          // 请吃火锅：该玩家 -cost，其他玩家有 50% 概率拉肚子暂停一回合
          player.money -= ev.cost
          state.log.push(`🍲 ${player.name} 请吃火锅，花费 ¥${ev.cost}`)
          for (const p of state.players) {
            if (p.alive && p.id !== player.id && Math.random() < 0.5) {
              p.skipTurns += 1
              state.log.push(`🤢 ${p.name} 拉肚子，暂停一轮`)
            }
          }
          checkBankrupt(state, player)
          break
        }
        default:
          break
      }
      // 记录奇遇事件，供弹窗展示（在所有效果应用完成后）
      state._chancePopup = ev
      break
    }
    default:
      break
  }
  } // end else (non-property tiles)

  // 维护可升级地块：踩到自己的地产 → 加入可升级列表（买了不能立刻升，要第二次落到）
  if (!player.upgradableTiles) player.upgradableTiles = []
  if (player.properties.includes(tile.id) && isPropertyTile(tile)) {
    if (!player.upgradableTiles.includes(tile.id)) player.upgradableTiles.push(tile.id)
  }

  // 神仙附身弹窗：无其他 pending 时直接显示，有 buy pending 时等购买流程结束后显示
  if (state._godAfterBuy && !state.pending) {
    const { godId, playerId } = state._godAfterBuy
    state.pending = { kind: 'god', godId, playerId }
    state._godAfterBuy = null
  }

  // 奇遇事件弹窗：无其他 pending 时直接显示，有 buy/checkin pending 时等流程结束后显示
  if (state._chancePopup && !state.pending) {
    state.pending = { kind: 'chance', event: state._chancePopup }
    state._chancePopup = null
  }

  // 破产弹窗：有玩家破产时弹出提示（优先级最低，在其他弹窗之后）
  if (state._bankruptPopup && !state.pending) {
    state.pending = { kind: 'bankrupt', ...state._bankruptPopup }
    state._bankruptPopup = null
  }

  // 彩票站弹窗：路过彩票站时弹出购买提示（优先级最低）
  if (!state.pending) {
    tryTriggerLotteryDeferred(state)
  }
}

// 推进到下一存活玩家
export function nextTurn(state) {
  const alive = alivePlayers(state)
  if (alive.length === 0) return state

  // 路障倒计时：每回合减1，到期清除（存 state，跨对局/跨房间隔离）
  state.barriers = state.barriers || {}
  for (const id of Object.keys(state.barriers)) {
    state.barriers[id].turnsLeft -= 1
    if (state.barriers[id].turnsLeft <= 0) {
      delete state.barriers[id]
      state.log.push(`🚧 「${TILES[Number(id)].name}」的路障消失了`)
    }
  }

  for (const id of Object.keys(state.closedBridges)) {
    state.closedBridges[id] -= 1
    if (state.closedBridges[id] <= 0) {
      delete state.closedBridges[id]
      state.log.push(`🌉 ${TILES[Number(id)].name} 恢复通行`)
    }
  }

  // 神仙倒计时：当前回合玩家的神仙减1
  tickGod(state, state.players[state.turnIndex])

  const prev = state.turnIndex
  let next = (prev + 1) % state.players.length
  while (!state.players[next].alive) next = (next + 1) % state.players.length

  if (next <= prev) {
    state.round += 1
    // 新的拍卖周期（第 X1 回合）允许再次拍卖（否则整局只在第 10 回合拍一次）
    if (state.round % 10 === 1) state.auctionThisRound = false
    // 资产曲线：每圈结束记录所有存活玩家的总资产
    if (!state.assetHistory) state.assetHistory = {}
    for (const p of state.players) {
      if (!p.alive) continue
      if (!state.assetHistory[p.id]) state.assetHistory[p.id] = []
      state.assetHistory[p.id].push(totalAssets(p))
    }
    // 新回合清理上轮的商圈达成标记（防内存膨胀，同时允许"组合被破→重建"后再次提示）
    const currentRound = state.round
    for (const k of Object.keys(state.announcedGroups)) {
      if (!k.endsWith(`@${currentRound}`)) delete state.announcedGroups[k]
    }
    // 每5回合：抽取股票事件（先加事件，再算波动，事件立即生效）
    if (state.round % 5 === 0) {
      const events = drawStockEvents()
      for (const ev of events) {
        applyStockEvent(state, ev)
        const rt = state.stockRuntime[ev.code]
        state.log.push(`📰 股市新闻：${ev.icon} ${ev.text}！${rt.name} 将${ev.delta > 0 ? '涨' : '跌'} ${Math.abs(ev.delta * 100).toFixed(0)}%（${ev.turns} 回合）`)
      }
    }
    // 每圈结束：股价波动（受事件修正）
    tickStockPrices(state)
    // 事件倒计时（减1，到期移除）
    tickStockEvents(state)
  }
  state.turnIndex = next
  state.dice = null
  state.pending = null
  state.shopShownTurn = false
  state.lotteryBoughtTurn = false // 重置本回合购彩标志

  // 彩票：中奖后重置新一轮
  resetLotteryIfWon(state)

  // 载具倒计时：刚结束回合的玩家（prev）减1
  const prevP = state.players[prev]
  if (prevP.vehicleTurnsLeft > 0) {
    prevP.vehicleTurnsLeft -= 1
    if (prevP.vehicleTurnsLeft <= 0) {
      prevP.vehicle = 'walk'
      state.log.push(`${prevP.name} 的载具到期，恢复走路`)
    }
  }

  const np = state.players[next]
  np.cardUsed = false // 新回合重置用卡标志
  np.firstTurn = false // 第一回合标志清除（从第二回合开始能用卡）

  state.phase = 'roll'

  // 新回合：清除所有玩家的"本回合可升级地块"列表
  for (const p of state.players) {
    if (p.upgradableTiles) p.upgradableTiles = []
  }

  // 彩票开奖判定
  tickLottery(state)

  // 每 5 回合：全体存活玩家送 1 张随机卡
  if (state.round > 1 && state.round % 5 === 0) {
    for (const pl of state.players) {
      if (!pl.alive) continue
      const tpl = randomCard()
      if (pl.hand.length < 10) {
        pl.hand.push({ ...tpl, id: `round5-${pl.id}-${++state._cardSeq}` })
        state.log.push(`🎴 第 ${state.round} 回合福利：${pl.name} 获得卡片「${tpl.name}」`)
      } else {
        addMoney(state, pl.id, 400, `第 ${state.round} 回合福利：${pl.name} 手牌满了换成 ¥400`)
      }
    }
  }

  // 每 10 回合：随机一个无主地块拍卖（零元起拍，两轮盲拍）
  if (!state.auctionThisRound && state.round % 10 === 0) {
    const unowned = TILES.filter((t) => t && isPropertyTile(t) && !t.removed && !state.players.some((p) => p.alive && p.properties.includes(t.id)))
    if (unowned.length > 0) {
      const tile = unowned[Math.floor(Math.random() * unowned.length)]
      state.auctionThisRound = true
      state.pending = {
        kind: 'auction',
        tileId: tile.id,
        // 盲拍：每位玩家独立出价，存储在 bids 中 { playerId: amount }
        bids: {},
        turn: state.turnIndex,
        round: 0,        // 当前轮次（从 0 开始）
        maxRounds: 2,    // 两轮盲拍
        roundStep: 0,    // 轮内步骤：0=出价中 1=揭晓中
        // aliveCount 不预存快照——每轮动态计算，防止拍卖期间状态变化导致计数错乱
      }
      state.phase = 'auction'
      const ac = state.players.filter(p => p.alive).length
      state.log.push(`🔨 拍卖开始！「${tile.name}」零元起拍，${ac} 位玩家盲拍出价（原价 ¥${tile.price}）`)
    }
  }

  const winner = getWinnerByElimination(state)
  if (winner) {
    state.status = 'finished'
    state.winnerId = winner
    state.log.push(`🏆 ${state.players.find((p) => p.id === winner).name} 成为最后赢家！`)
    return state
  }
  if (state.settings.maxTurns && state.round > state.settings.maxTurns) {
    const w = settleByTurns(state)
    state.status = 'finished'
    state.winnerId = w
    const wName = state.players.find((p) => p.id === w)?.name ?? '?'
    state.log.push(`⏱ 已达 ${state.settings.maxTurns} 回合上限，按总资产结算，${wName} 获胜！`)
  }
  return state
}

export function currentPlayer(state) {
  return state.players[state.turnIndex]
}
