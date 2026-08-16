import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const puppeteer = require('C:/Users/zhm/.workbuddy/binaries/node/workspace/node_modules/puppeteer')

const URL = 'http://localhost:5173/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 用真实 PointerEvent 触发掷骰（骰子组件监听 pointerdown/move/up，不走 mouse 事件）
async function throwDice(page) {
  return page.evaluate(() => {
    const pair = document.querySelector('.dice-throw__pair')
    const board = document.querySelector('.board-anchor') || document.querySelector('.board')
    if (!pair || !board) return 'no-element'
    const pr = pair.getBoundingClientRect()
    const br = board.getBoundingClientRect()
    const mk = (type, x, y, buttons) =>
      new PointerEvent(type, { clientX: x, clientY: y, button: 0, buttons, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true })
    pair.dispatchEvent(mk('pointerdown', pr.x + pr.width / 2, pr.y + pr.height / 2, 1))
    window.dispatchEvent(mk('pointermove', (pr.x + br.x) / 2, (pr.y + br.y) / 2, 1))
    window.dispatchEvent(mk('pointermove', br.x + br.width / 2, br.y + br.height / 2, 1))
    window.dispatchEvent(mk('pointerup', br.x + br.width / 2, br.y + br.height / 2, 0))
    return 'fired'
  })
}

;(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  const shopLogs = []
  page.on('console', (m) => { const t = m.text(); if (t.includes('[SHOP]')) shopLogs.push(t) })
  page.on('pageerror', (e) => shopLogs.push('PAGEERROR: ' + e.message))

  console.log('▶ 打开', URL)
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
  await page.waitForSelector('.setup__go', { timeout: 15000 })
  await page.click('.setup__go')
  console.log('▶ 已开始游戏')
  await page.waitForSelector('.board-anchor', { timeout: 15000 })

  let found = false
  const MAX = 60
  for (let r = 1; r <= MAX && !found; r++) {
    try {
      await page.waitForFunction(() => !!document.querySelector('.dice-throw__pair'), { timeout: 15000 })
    } catch {
      const diag = await page.evaluate(() => {
        const g = window.__game; if (!g) return 'no __game'
        const st = g.state.value
        const cur = st.players[st.turnIndex]
        return JSON.stringify({ phase: st.phase, pending: st.pending && st.pending.kind, turnIndex: st.turnIndex, pos: cur && cur.pos, animating: g.animating.value, diceThrowing: g.diceThrowing.value, selecting: g.selecting.value && g.selecting.value.type })
      })
      console.log(`[${r}] 骰子未出现。状态诊断:`, diag)
      break
    }

    await throwDice(page)
    await sleep(3500) // 等骰子翻滚 + 走棋动画

    // 关闭途中弹出的分岔/打卡卡片
    for (let k = 0; k < 3; k++) {
      const close = await page.$('.fork-card__close')
      if (!close) break
      await close.click(); await sleep(800)
    }
    // 若落在可买地产，先"放弃"购买（否则结束回合不会推进回合）
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('放弃'))
      if (b) b.click()
    })
    await sleep(600)

    // 点"结束回合" → 触发路过商店检测
    const ended = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('结束回合'))
      if (b) { b.click(); return true }
      return false
    })
    await sleep(1200)

    if (await page.$('.shop-card')) {
      found = true
      console.log(`\n✅ [第 ${r} 回合] 商店弹层出现！`)
      break
    }
    await sleep(5000) // 等 AI 回合并回到人类
  }

  console.log('\n--- [SHOP] 调试日志（共 ' + shopLogs.length + ' 条）---')
  if (shopLogs.length) shopLogs.slice(-30).forEach((l) => console.log(l))
  else console.log('无 [SHOP] 日志 → reducer 从未生成 shop pending（纯逻辑/流程问题）')

  await browser.close()
  process.exit(found ? 0 : 1)
})()
