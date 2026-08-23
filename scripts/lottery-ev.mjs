// 彩票期望值计算
// 规则：数字1-100，¥500/张，全局唯一，基础池¥10000，抽奖随机1-100
// n = 全场总票数，k = 你持有票数
// 单次抽奖：有人中→拿全池，无人中→池保留，下轮继续抽
// 这里算"单次抽奖的期望值"

console.log('=== 单次抽奖期望值（含无人中情况）===\n')
console.log('  持有k张 | 总票n | 你中奖概率 | 期望收益(¥)')
for (const n of [10, 20, 30, 50, 80, 100]) {
  const pool = 10000 + 500 * n
  const noWinP = 1 - n / 100
  for (const k of [1, 2, 3, 5, 10, 20]) {
    if (k > n) continue
    const winP = k / 100
    const ev = winP * pool - 500 * k
    process.stdout.write('  k=' + String(k).padStart(2) + '  n=' + String(n).padStart(3) +
      '  P(中)=' + (winP * 100).toFixed(1) + '%' +
      '  P(无人)=' + (noWinP * 100).toFixed(1) + '%' +
      '  EV=' + (ev >= 0 ? '+' : '') + ev.toFixed(0) + '¥\n')
  }
  console.log('')
}

console.log('=== 条件期望：假设有人中（更实际——因为drawing阶段每回合连抽直到有人中）===\n')
console.log('  此时无人中概率被摊平，只看你持有票数占总票数的比例\n')
for (const n of [10, 20, 50, 100]) {
  const pool = 10000 + 500 * n
  for (const k of [1, 2, 5, 10, 20]) {
    if (k > n) continue
    const winP = k / n  // 条件概率
    const ev = winP * pool - 500 * k
    process.stdout.write('  k=' + String(k).padStart(2) + '  n=' + String(n).padStart(3) +
      '  份额=' + (winP * 100).toFixed(1) + '%' +
      '  EV=' + (ev >= 0 ? '+' : '') + ev.toFixed(0) + '¥\n')
  }
}
console.log('\n=== 结论 ===')
console.log('• 买1张时，要全场买到80+张票才能回本（EV>0）')
console.log('• 买10张时，全场需要100张全出完才能正期望')
console.log('• 因为池子增长 = 500×n，而你的成本 = 500×k，你的份额 = k/100')
console.log('• 盈亏平衡：k/100 × (10000+500n) = 500k  →  n = 100 - 20000/500 = 60')
console.log('• 所以全场票数>60张时，单次抽奖对玩家是正期望，否则是负期望')
console.log('• 但drawing阶段每回合连抽直到有人中，实际期望由条件概率决定')