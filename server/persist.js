// persist.js — 房间快照持久化：对局中房间变更后 1 秒防抖写盘，
// 服务器进程重启时恢复进行中的对局（座位标记掉线，玩家凭 playerId 重连续玩）。
// 只持久化可序列化字段；定时器 / socketId 等运行时状态一律不落盘。
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = process.env.SNAPSHOT_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const saveTimers = new Map() // roomId -> pending timer（1 秒内的连续变更合并为一次磁盘 IO）

function snapshotPath(roomId) {
  // 房间码字符集是受限的（大写字母+数字），直接作文件名安全
  return path.join(DATA_DIR, `${roomId}.json`)
}

export function scheduleSave(room) {
  if (!room || room.status !== 'playing' || !room.gameState) return
  if (saveTimers.has(room.roomId)) return // 已有待写入任务，跳过
  const t = setTimeout(() => {
    saveTimers.delete(room.roomId)
    saveRoom(room).catch((e) => console.error('[persist] 写入失败:', room.roomId, e.message))
  }, 1000)
  saveTimers.set(room.roomId, t)
}

export async function saveRoom(room) {
  if (!room || room.status !== 'playing' || !room.gameState) return
  const data = {
    roomId: room.roomId,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    settings: room.settings,
    playerSeq: room.playerSeq,
    password: room.password,
    aiTakeover: room.aiTakeover,
    createdAt: room.createdAt,
    chat: room.chat,
    gameLog: room.gameLog,
    // socketId 不落盘；重连前所有座位统一视为掉线
    players: (room.players || []).map((p) => ({
      id: p.id, name: p.name, ready: true, color: p.color,
    })),
    gameState: room.gameState,
  }
  await fsp.mkdir(DATA_DIR, { recursive: true })
  const target = snapshotPath(room.roomId)
  const tmp = `${target}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(data))
  await fsp.rename(tmp, target) // 原子替换：断电也不会留半个 JSON
}

// 撤销待写入任务（房间被删时调用，防止防抖定时器随后又把快照写回磁盘）
export function cancelSave(roomId) {
  const t = saveTimers.get(roomId)
  if (t) {
    clearTimeout(t)
    saveTimers.delete(roomId)
  }
}

export async function deleteSnapshot(roomId) {
  try {
    await fsp.unlink(snapshotPath(roomId))
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('[persist] 删除快照失败:', roomId, e.message)
  }
}

// 启动时读取全部快照，返回可恢复的原始数据（损坏文件直接删除）
export async function loadSnapshots() {
  let files
  try {
    files = await fsp.readdir(DATA_DIR)
  } catch {
    return [] // 目录不存在 = 从未有对局
  }
  const list = []
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    try {
      const raw = await fsp.readFile(path.join(DATA_DIR, f), 'utf8')
      const data = JSON.parse(raw)
      if (data?.roomId && data?.status === 'playing' && Array.isArray(data.gameState?.players)) {
        list.push(data)
      } else {
        await fsp.unlink(path.join(DATA_DIR, f)).catch(() => {})
      }
    } catch {
      console.warn('[persist] 快照损坏已删除:', f)
      await fsp.unlink(path.join(DATA_DIR, f)).catch(() => {})
    }
  }
  return list
}
