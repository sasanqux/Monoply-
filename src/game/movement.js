// movement.js — 逐格移动（过江拦截/桥收费/道具触发）+ 载具掷骰
import { TILES, nextTileIndex, isBridge, VEHICLES, PASS_START_SALARY } from './board.js'
import { addMoney, payMoney } from './bank.js'
import { checkBankrupt } from './gameOver.js'

// 掷骰：骰子数由载具决定（走路 2 / 自行车 3 / 摩托 4 / 汽车 5 / 飞机 6）
export function rollDice() {
  return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]
}

// 按载具生成骰子数组；遥控骰子时用指定点数
export function rollForPlayer(player) {
  if (player.remoteDice != null) {
    const v = player.remoteDice
    player.remoteDice = null
    // 拆成两颗骰子展示（上限 6/6）
    const a = Math.min(6, Math.max(1, Math.ceil(v / 2)))
    const b = Math.min(6, Math.max(1, v - a))
    return [a, b]
  }
  const count = VEHICLES[player.vehicle]?.dice ?? 2
  const dice = []
  for (let i = 0; i < count; i++) dice.push(1 + Math.floor(Math.random() * 6))
  return dice
}

// 逐格移动；返回 { pos, blocked }（blocked=true 表示被江/路障拦截，剩余点数作废）
export function movePlayer(state, player, dice) {
  const steps = dice.reduce((a, b) => a + b, 0)
  const dir = player.direction === -1 ? -1 : 1
  let blocked = false

  for (let i = 0; i < steps; i++) {
    // 1. 过江拦截：出发格标记 riverEdge 且无桥/桥被封闭 → 拦在江边
    if (TILES[player.pos].riverEdge && !player.ferry) {
      const ni = nextTileIndex(player.pos)
      const nTile = TILES[ni]
      const closed = (state.closedBridges[ni] ?? 0) > 0
      if (!isBridge(nTile) || closed) {
        blocked = true
        state.log.push(`🌊 ${player.name} 在「${TILES[player.pos].name}」被江水拦住，下回合才能过江`)
        break
      }
    }

    // 2. 走一步
    player.pos = (player.pos + dir + TILES.length) % TILES.length

    // 3. 过起点发工资（仅顺时针）
    if (dir === 1 && player.pos === 0) {
      addMoney(state, player.id, PASS_START_SALARY, '经过起点领取工资')
    }

    // 4. 到达桥格：收过路费（轮渡免收）
    const tile = TILES[player.pos]
    if (isBridge(tile) && !player.ferry) {
      const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
      if (owner && owner.id !== player.id) {
        const toll = tollOf(state, tile, owner)
        payMoney(state, player.id, owner.id, toll, `过「${tile.name}」交过路费（桥主 ${owner.name}）`)
        checkBankrupt(state, player)
        if (!player.alive) break
      }
    }

    // 5. 道具触发（路障挡停 / 地雷炸伤）
    const hit = triggerItems(state, player)
    if (hit === 'stop') {
      blocked = true
      break
    }
    if (!player.alive) break
  }

  player.ferry = false
  player.direction = 1
  return { pos: player.pos, blocked }
}

// 桥主过路费：基础 toll，多座桥费率上涨（每多一座 +40%）
export function tollOf(state, tile, owner) {
  const bridgeCount = owner.properties.filter((i) => isBridge(TILES[i])).length
  const ratio = 1 + (bridgeCount - 1) * 0.4
  return Math.round(tile.toll * ratio)
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
