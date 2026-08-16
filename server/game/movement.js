// movement.js — 图结构逐格移动（分岔路口暂停/选路）
// 走棋不再依赖 1..N 线性闭环，而是 board.js 的图：每格有 next（直行后继）；forks 非空=分岔格
import { TILES, isMetro, VEHICLES, START_ID } from './board.js'

export function rollDice() {
  return [1 + Math.floor(Math.random() * 6)]
}

// 按载具生成骰子数组
export function rollForPlayer(player) {
  const count = VEHICLES[player.vehicle]?.dice ?? 1
  const dice = []
  for (let i = 0; i < count; i++) dice.push(1 + Math.floor(Math.random() * 6))
  return dice
}

// 反向移动（转向卡 / 逆向支路）：沿"主环 next 链"回退到前驱格（只认 next，不认 forks——forks 是支线不是主环前驱）
// 预计算 next→id 的反向索引，避免每次遍历且保证结果稳定
const _predCache = new Map()
function predecessorOf(id) {
  if (_predCache.size === 0) {
    for (const t of TILES) {
      if (!t || t.removed) continue
      // 只记录第一次遇到的前驱（主环顺序靠前 = 更符合"回退"语义）
      if (!_predCache.has(t.next)) _predCache.set(t.next, t.id)
    }
  }
  return _predCache.get(id) ?? id
}

// 分岔可选方向：排除"来路"(不能立即回头)，除非使用转向卡等道具反向走（direction=-1 时走 predecessorOf，不经过此分支）
function forkOptions(cur, came) {
  if (cur.id === START_ID) {
    // 朝天门：分岔选项只取 forks（洪崖洞/解放碑），直行 next 已指向洪崖洞(左)，不额外加入 fork 选项
    return [...new Set(cur.forks)].filter((o) => o !== came)
  }
  return [...new Set([cur.next, ...cur.forks])].filter((o) => o !== came)
}

// 分岔选路是否需要"逆向绕行"（沿前驱链走另一方向，真正分出两条不同路线）：
// - 朝天门：选洪崖洞=正向（江北城方向），选解放碑=逆向（较场口方向）——朝天门 next=洪崖洞，两条支路一正一反
// - 其他分岔：选到"next 指回分岔格"的支路（前驱式岔路）才逆向，避免绕回分岔格死循环/乱跳
export function forkNeedsReverse(tile, chosen) {
  if (tile.id === START_ID) return chosen !== tile.next
  return TILES[chosen].next === tile.id
}

// 移动 steps 步。
// cameFrom: 起始来源格 id（避免原路返回）；resume 分岔时传入分岔格 id。
// 选路机制：分岔路口在"非回头"方向里随机抽一条——人类暂停弹卡片，AI 直接走。
// player.reverse：分岔选到"会绕回分岔格"的支路时开启，沿前驱链走另一方向（避免 1→49→1 死循环/乱跳）。
// 返回 { paused }；pause 时 state.pending={kind:'fork', chosen, ...}，玩家停在分岔格未移动。
export function movePlayer(state, player, steps, cameFrom) {
  const isReverse = player.direction === -1
  const dir = isReverse ? -1 : 1
  let came = cameFrom ?? player.pos
  player.walkPath = player.walkPath || [player.pos]

  for (let i = 0; i < steps; i++) {
    const cur = TILES[player.pos]
    let nextId

    if (player.reverse) {
      // 逆向支路：沿前驱链绕另一方向远路；绕回分岔起点则切回正向 next
      const cand = predecessorOf(player.pos)
      // 若前驱无 next 前驱（口袋支路出口，如大坪52→南桥寺51只有 fork 入口、无 next 前驱），
      // 逆向会原地踏步 → 放弃逆向、沿正向 next 走（化龙桥选大坪：52→44→45）
      if (cand === came || cand === player.pos || predecessorOf(cand) === cand) {
        player.reverse = false
        nextId = cur.next
      } else {
        nextId = cand
      }
    } else if (dir === -1) {
      // 反向（转向卡等道具）：沿前驱链回退
      const cand = predecessorOf(player.pos)
      if (cand === player.pos) {
        // 无前驱（如起点异常），放弃反向改走正向
        nextId = cur.next
      } else {
        nextId = cand
      }
    } else if (cur.forks && cur.forks.length) {
      const opts = forkOptions(cur, came)
      if (opts.length > 1) {
        if (cur.id === START_ID) {
          // 朝天门：随机选一条岔路（不回头）
          nextId = opts[Math.floor(Math.random() * opts.length)]
          if (forkNeedsReverse(cur, nextId)) player.reverse = true
        } else if (player.isAI) {
          // AI 走其他岔路：直行 tile.next
          nextId = cur.next
          if (forkNeedsReverse(cur, nextId)) player.reverse = true
        } else {
          // 人类走其他岔路：暂停让玩家自选方向（不能回头）
          state.pending = {
            kind: 'fork',
            tileId: cur.id,
            options: opts,
            chosen: null, // 玩家自选，不预置
            stepsLeft: steps - i - 1,
            cameFrom: came,
            canPick: true,
          }
          return { paused: true }
        }
      } else {
        nextId = opts[0]
      }
    } else {
      nextId = cur.next
    }

    player.pos = nextId
    came = cur.id
    player.walkPath.push(nextId)

    // 路障：踩到路障格扣50积分并截停（本回合剩余步数作废）
    const landed = TILES[nextId]
    if (landed?.barrier && landed.barrier !== player.id) {
      const owner = state.players.find((p) => p.id === landed.barrier)
      const penalty = 50
      player.points = (player.points ?? 0) - penalty
      state.log.push(`🚧 ${player.name} 踩到「${landed.name}」的路障！扣 ${penalty} 积分（共 ${player.points ?? 0}）`)
      if (owner) {
        owner.points = (owner.points ?? 0) + penalty
        state.log.push(`💰 ${owner.name} 收到路障罚款 ${penalty} 积分`)
      }
      player.barrierStopped = true
      break // 截停：不再继续走剩余步数
    }

    if (!player.alive) break
  }

  // 转向卡效果：走完本次移动后立即重置方向（一次性效果，不延续到下回合）
  if (isReverse) player.direction = 1
  player.reverse = false
  return { paused: false }
}

// 走 1 格（给前端 STEP action 用）。返回 { nextId, paused, needsReverse }
export function stepOneTile(cur, player, came) {
  if (player.reverse) {
    const cand = predecessorOf(player.pos)
    if (cand === came || cand === player.pos || predecessorOf(cand) === cand) {
      player.reverse = false
      return { nextId: cur.next, needsReverse: false }
    }
    return { nextId: cand, needsReverse: true }
  }
  if (player.direction === -1) {
    const cand = predecessorOf(player.pos)
    if (cand === player.pos) return { nextId: cur.next, needsReverse: false }
    return { nextId: cand, needsReverse: false }
  }
  if (cur.forks && cur.forks.length) {
    const opts = forkOptions(cur, came)
    if (opts.length > 1) {
      if (cur.id === START_ID) {
        const nextId = opts[Math.floor(Math.random() * opts.length)]
        return { nextId, paused: false, needsReverse: forkNeedsReverse(cur, nextId) }
      } else if (player.isAI) {
        const nextId = cur.next
        return { nextId, paused: false, needsReverse: forkNeedsReverse(cur, nextId) }
      } else {
        // 人类分岔：暂停等选路
        return { nextId: null, paused: true, options: opts }
      }
    }
    if (opts.length === 1) {
      return { nextId: opts[0], needsReverse: forkNeedsReverse(cur, opts[0]) }
    }
  }
  return { nextId: cur.next, needsReverse: false }
}
