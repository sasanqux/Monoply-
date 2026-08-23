// 检查棋盘所有邻接是否对称
import { TILES } from '../shared/game/index.js'

const issues = []
for (const t of TILES) {
  if (!t || !t.neighbors) continue
  for (const n of t.neighbors) {
    const other = TILES[n]
    if (!other) { issues.push(`${t.id}(${t.name}) → ${n}: 目标不存在`); continue }
    if (!other.neighbors.includes(t.id)) {
      issues.push(`❌ ${t.id}(${t.name}) → ${n}(${other.name}): 单向！对方 neighbors=[${other.neighbors}] 不含 ${t.id}`)
    }
  }
}
if (issues.length === 0) { console.log('✓ 所有邻接对称'); }
else { issues.forEach(i => console.log(i)); console.log(`共 ${issues.length} 处不对称`) }
