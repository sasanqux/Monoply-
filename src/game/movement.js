// movement.js — 掷骰与移动、过起点发工资
import { TILES, PASS_START_SALARY } from './board.js'
import { addMoney } from './bank.js'

export function rollDice() {
  return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]
}

// 移动玩家并处理"过起点发工资"（回到 0 格）
export function movePlayer(state, player, dice) {
  const sum = dice[0] + dice[1]
  const next = player.pos + sum
  if (next >= TILES.length) {
    player.pos = next % TILES.length
    addMoney(state, player.id, PASS_START_SALARY, '经过起点领取工资')
  } else {
    player.pos = next
  }
  return player.pos
}
