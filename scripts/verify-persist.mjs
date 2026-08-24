// verify-persist.mjs — 服务器快照持久化往返验证
// 用法：node scripts/verify-persist.mjs          → 父进程：建房/开局/操作/写盘，然后 spawn 子进程模拟重启
//       node scripts/verify-persist.mjs --child  → 子进程：loadSnapshots + restoreAllRooms，打印恢复结果
// 两进程各自 import 模块（Map 互不可见），等价于真实的"杀进程再启动"。
import { createRoom, joinRoom, startGame, handleAction, restoreAllRooms, toggleReady } from '../server/rooms.js'
import { saveRoom, loadSnapshots } from '../server/persist.js'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SELF = fileURLToPath(import.meta.url)

if (process.argv.includes('--child')) {
  const list = await loadSnapshots()
  const n = restoreAllRooms(list)
  const { getRoom } = await import('../server/rooms.js')
  for (const data of list) {
    const room = getRoom(data.roomId)
    console.log('RESTORED', JSON.stringify({
      count: n,
      roomId: room?.roomId,
      status: room?.status,
      round: room?.gameState?.round,
      turnIndex: room?.gameState?.turnIndex,
      allDisconnected: room?.players.every((p) => p.disconnected && p.socketId === null),
      gamePlayersAI: room?.gameState.players.every((p) => p.isAI === true),
      hasTimer: !!room?.turnTimer, // 必须为 false：定时器不跨进程
      logLen: room?.gameLog?.length ?? 0,
    }))
  }
  process.exit(0)
}

// ===== 父进程 =====
let pass = 0, fail = 0
const check = (name, cond) => { cond ? pass++ : fail++; console.log(`  ${cond ? '✓' : '✗'} ${name}`) }

console.log('▶ 建房 → 开局 → 走一步 → 强制写盘')
const room = createRoom('甲', { maxPlayers: 2 })
joinRoom(room.roomId, '甲', 'sock-1', null, null)
const j2 = joinRoom(room.roomId, '乙', 'sock-2', null, null)
check('两名玩家入座', room.players.length === 2)
toggleReady('sock-2') // 非房主需要手动准备
const sg = startGame('sock-1')
check('开局进入 playing', sg.ok && room.status === 'playing')
handleAction('sock-1', { type: 'ROLL_ORDER' })
await saveRoom(room) // 直接写盘（不等 1s 防抖）
const expectRound = room.gameState.round

console.log('▶ 子进程模拟服务器重启后恢复')
const res = spawnSync(process.execPath, [SELF, '--child'], {
  encoding: 'utf8',
  env: process.env,
})
const line = res.stdout.split('\n').find((l) => l.startsWith('RESTORED '))
check('快照被读取且房间重建', !!line)
if (line) {
  const got = JSON.parse(line.slice('RESTORED '.length))
  check('同一 roomId 恢复', got.roomId === room.roomId)
  check('状态仍为 playing', got.status === 'playing')
  check('回合数一致（对局进度无损）', got.round === expectRound)
  check('全部座位标记掉线、无残留 socket', got.allDisconnected === true)
  check('游戏侧玩家已转 AI（超时/托管可代打）', got.gamePlayersAI === true)
  check('定时器未跨进程存活', got.hasTimer === false)
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
