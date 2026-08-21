// movement.js — 无向图邻接移动（分岔路口暂停/选路）
// 走棋依赖 board.js 的 neighbors：每格记录所有相邻格，可选出口 = 邻居 - 来路方向
import { TILES, isMetro, VEHICLES } from './board.js'
import { LOTTERY_TILES } from './lottery.js'

// 按载具生成骰子数组
export function rollForPlayer(player) {
  const count = VEHICLES[player.vehicle]?.dice ?? 1
  const dice = []
  for (let i = 0; i < count; i++) dice.push(1 + Math.floor(Math.random() * 6))
  return dice
}

// 分岔可选方向：所有邻居去掉来路方向（不能立即回头）
// came == null：传送/初始状态，全部分岔
// came 不在 neighbors 中（单向汇入）：所有邻居都是可选出口
function forkOptions(cur, came) {
  if (came == null) return cur.neighbors.slice()
  return cur.neighbors.filter((n) => n !== came)
}

// 移动 steps 步。
// cameFrom: 起始来源格 id（避免原路返回）；resume 分岔时传入分岔格 id。
// 选路机制：分岔路口在"非回头"方向里随机抽一条——人类暂停弹卡片，AI 直接走。
// 返回 { paused }；pause 时 state.pending={kind:'fork', chosen, ...}，玩家停在分岔格未移动。
export function movePlayer(state, player, steps, cameFrom) {
  let came = cameFrom ?? player.pos
  player.walkPath = player.walkPath || [player.pos]

  for (let i = 0; i < steps; i++) {
    const cur = TILES[player.pos]
    let nextId

    const opts = forkOptions(cur, came)
    if (opts.length > 1) {
      if (player.isAI) {
        // AI 走其他岔路：直行 neighbors[0]（主环方向）
        nextId = opts[0]
      } else {
        // 人类分岔：暂停让玩家自选方向（不能回头）
        state.pending = {
          kind: 'fork',
          tileId: cur.id,
          options: opts,
          chosen: null,
          stepsLeft: steps - i - 1,
          cameFrom: came,
          canPick: true,
        }
        return { paused: true }
      }
    } else {
      nextId = opts[0]
    }

    player.pos = nextId
    came = cur.id
    player.walkPath.push(nextId)

    // 路过彩票站检测（延迟到停下时弹窗）
    if (!state._lotteryTile && LOTTERY_TILES.includes(nextId)) {
      state._lotteryTile = nextId
    }

    // 路障：踩到路障格扣50积分并截停（本回合剩余步数作废）
    const barrier = state.barriers?.[nextId]
    if (barrier && barrier.owner !== player.id) {
      const owner = state.players.find((p) => p.id === barrier.owner)
      const penalty = 50
      player.points = (player.points ?? 0) - penalty
      state.log.push(`🚧 ${player.name} 踩到「${TILES[nextId].name}」的路障！扣 ${penalty} 积分（共 ${player.points ?? 0}）`)
      if (owner) {
        owner.points = (owner.points ?? 0) + penalty
        state.log.push(`💰 ${owner.name} 收到路障罚款 ${penalty} 积分`)
      }
      player.barrierStopped = true
      break
    }

    if (!player.alive) break
  }

  return { paused: false }
}

// 走 1 格（给前端 STEP action 用）。返回 { nextId, paused, options }
export function stepOneTile(cur, player, came) {
  const opts = forkOptions(cur, came)
  if (opts.length > 1) {
    if (player.isAI) {
      // AI 随机选一条
      const nextId = opts[Math.floor(Math.random() * opts.length)]
      return { nextId, paused: false }
    }
    // 人类分岔：暂停等选路
    return { nextId: null, paused: true, options: opts }
  }
  return { nextId: opts[0], paused: false }
}
