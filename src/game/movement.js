// movement.js — 逐格移动（过江拦截/桥收费/道具触发）+ 载具掷骰
import { TILES, nextTileIndex, isBridge, VEHICLES, PASS_START_SALARY, TILE_COUNT } from './board.js'
import { addMoney, payMoney } from './bank.js'
import { tryShield } from './card.js'
import { checkBankrupt } from './gameOver.js'

// 掷骰：骰子数由载具决定（走路 1 / 自行车 2 / 摩托 3 / 汽车 4 / 飞机 5）
export function rollDice() {
  return [1 + Math.floor(Math.random() * 6)]
}

// 按载具生成骰子数组；遥控骰子时用指定点数（按骰子数均分）
export function rollForPlayer(player) {
  const count = VEHICLES[player.vehicle]?.dice ?? 1
  if (player.remoteDice != null) {
    let v = player.remoteDice
    player.remoteDice = null
    // 防呆：范围必须是 [count, count*6]，否则均分会产生非法骰面
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

// 1-48 闭环走一步
function step(pos, dir) {
  return ((pos - 1 + dir + TILE_COUNT) % TILE_COUNT) + 1
}

// 逐格移动；返回 { pos, blocked }
export function movePlayer(state, player, dice) {
  const steps = dice.reduce((a, b) => a + b, 0)
  const dir = player.direction === -1 ? -1 : 1
  let blocked = false

  for (let i = 0; i < steps; i++) {
    // 1. 过江拦截（仅正向；反向移动不跨江，不受桥与封桥约束）
    if (dir === 1 && TILES[player.pos].riverEdge && !player.ferry) {
      const ni = nextTileIndex(player.pos)
      const nTile = TILES[ni]
      const closed = (state.closedBridges[ni] ?? 0) > 0
      if (!(isBridge(nTile) || nTile.type === 'metro' && nTile.id === 44) || closed) {
        blocked = true
        state.log.push(`🌊 ${player.name} 在「${TILES[player.pos].name}」被江水拦住，下回合才能过江`)
        break
      }
    }

    // 2. 走一步
    player.pos = step(player.pos, dir)

    // 3. 过起点发工资（仅顺时针）
    if (dir === 1 && player.pos === 1) {
      addMoney(state, player.id, PASS_START_SALARY, '绕城一周回到解放碑，领取工资')
    }

    // 4. 到达桥格：收过路费（轮渡免收；免罪卡可豁免一次）
    const tile = TILES[player.pos]
    if (isBridge(tile) && !player.ferry) {
      const owner = state.players.find((p) => p.alive && p.properties.includes(tile.id))
      if (owner && owner.id !== player.id) {
        if (tryShield(state, player)) {
          state.log.push(`🛡️ ${player.name} 的免罪卡生效，豁免「${tile.name}」过路费！`)
        } else {
          const toll = tollOf(state, tile, owner)
          payMoney(state, player.id, owner.id, toll, `过「${tile.name}」交过路费（桥主 ${owner.name}）`)
          checkBankrupt(state, player)
        }
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
