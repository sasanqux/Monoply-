// movement.js — 图结构逐格移动（分岔路口暂停/选路）+ 道具触发
// 走棋不再依赖 1..N 线性闭环，而是 board.js 的图：每格有 next（直行后继）；forks 非空=分岔格
import { TILES, isMetro, VEHICLES, PASS_START_SALARY, START_ID } from './board.js'
import { addMoney } from './bank.js'
import { checkBankrupt } from './gameOver.js'

export function rollDice() {
  return [1 + Math.floor(Math.random() * 6)]
}

// 按载具生成骰子数组；遥控骰子时用指定点数（按骰子数均分）
export function rollForPlayer(player) {
  const count = VEHICLES[player.vehicle]?.dice ?? 1
  if (player.remoteDice != null) {
    let v = player.remoteDice
    player.remoteDice = null
    v = Math.max(count, Math.min(count * 6, v))
    const dice = []
    let rem = v
    for (let i = 0; i < count; i++) {
      const left = count - i
      const d = Math.min(6, Math.max(1, Math.round(rem / left)))
      dice.push(d)
      rem -= d
    }
    return dice
  }
  const dice = []
  for (let i = 0; i < count; i++) dice.push(1 + Math.floor(Math.random() * 6))
  return dice
}

// 反向移动（转向卡）：沿图回退到前驱格
function predecessorOf(id) {
  for (const t of TILES) {
    if (!t) continue
    if (t.next === id || (t.forks && t.forks.includes(id))) return t.id
  }
  return id
}

// 移动 steps 步。
// chooser(tile, options) => 选中的后继 id；返回 null 表示暂停（人类未选）。
// cameFrom: 起始来源格 id（避免原路返回）；resume 分岔时传入分岔格 id。
// 返回 { paused }；pause 时 state.pending={kind:'fork',...}，玩家停在分岔格未移动。
export function movePlayer(state, player, steps, chooser, cameFrom) {
  const dir = player.direction === -1 ? -1 : 1
  let came = cameFrom ?? player.pos
  player.walkPath = player.walkPath || [player.pos]

  for (let i = 0; i < steps; i++) {
    const cur = TILES[player.pos]
    let nextId

    if (dir === -1) {
      // 反向：沿图回退
      nextId = predecessorOf(player.pos)
    } else if (cur.id === START_ID && player.startDepart) {
      // 朝天门起步：直行走弹子石（外圈固定方向），不弹分岔窗；
      // 分岔(洪崖洞/解放碑)只在"绕回朝天门"时给出，且只含 forks 两个内圈方向
      player.startDepart = false
      nextId = cur.next
    } else if (cur.forks && cur.forks.length) {
      // 分岔格：排除来路后的可选方向
      // 朝天门：分岔选项只取 forks（洪崖洞/解放碑），不含直行 next（弹子石外圈固定方向）
      const opts =
        cur.id === START_ID
          ? [...new Set(cur.forks)].filter((o) => o !== came)
          : [...new Set([cur.next, ...cur.forks])].filter((o) => o !== came)
      if (opts.length > 1) {
        const choice = chooser ? chooser(cur, opts) : null
        if (choice == null) {
          // 人类未选 → 暂停，记录剩余步数与来源
          state.pending = {
            kind: 'fork',
            tileId: cur.id,
            options: opts,
            stepsLeft: steps - i - 1,
            cameFrom: came,
          }
          return { paused: true }
        }
        nextId = choice
      } else {
        nextId = opts[0]
      }
    } else {
      nextId = cur.next
    }

    player.pos = nextId
    came = cur.id
    player.walkPath.push(nextId)

    // 过起点发工资（仅顺时针）
    if (dir === 1 && player.pos === START_ID) {
      addMoney(state, player.id, PASS_START_SALARY, '绕城一周回到朝天门，领取工资')
    }

    // 道具触发（路障/地雷）
    const hit = triggerItems(state, player)
    if (hit === 'stop') break
    if (!player.alive) break
  }

  player.direction = 1
  return { paused: false }
}

// 触发棋盘上的道具（路障/地雷）；返回 'stop' 表示移动终止
function triggerItems(state, player) {
  const idx = state.boardItems.findIndex((b) => b.tileId === player.pos)
  if (idx === -1) return null
  const item = state.boardItems[idx]
  const ownerName = state.players.find((p) => p.id === item.ownerId)?.name ?? '?'

  if (item.type === 'barrier') {
    state.boardItems.splice(idx, 1)
    state.log.push(`🚧 ${player.name} 撞上 ${ownerName} 放的路障，被迫停下！`)
    return 'stop'
  }
  if (item.type === 'mine') {
    state.boardItems.splice(idx, 1)
    addMoney(state, player.id, -300, `踩中 ${ownerName} 的地雷，被炸伤`)
    checkBankrupt(state, player)
    return 'stop'
  }
  return null
}
