// useSound.js — 代码合成音效（Web Audio，无需素材文件）+ 手机震动
// 首次用户交互后才能出声（浏览器自动播放策略），游戏内点击即满足
let ctx = null

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// 单音：freq 频率 / dur 时长 / type 波形 / vol 音量 / when 延迟秒 / slide 滑向频率
function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slide = 0) {
  const c = ac()
  if (!c) return
  const t = c.currentTime + when
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.05)
}

export const sfx = {
  enabled: true, // 后续可接设置开关
  /** 掷骰：短促噪声串（哗啦感） */
  dice() {
    for (let i = 0; i < 5; i++) tone(180 + Math.random() * 420, 0.06, 'square', 0.1, i * 0.07)
  },
  /** 走格：轻嗒 */
  step() {
    tone(620, 0.05, 'triangle', 0.14)
  },
  /** 收钱：上行双音（叮-叮） */
  coin() {
    tone(880, 0.1, 'sine', 0.22)
    tone(1320, 0.16, 'sine', 0.18, 0.09)
  },
  /** 付钱：下滑音（嗖） */
  pay() {
    tone(420, 0.16, 'sawtooth', 0.13, 0, 180)
  },
  /** 轮到你：三连上行提示音 */
  turn() {
    tone(523, 0.11, 'sine', 0.2)
    tone(659, 0.11, 'sine', 0.2, 0.11)
    tone(784, 0.18, 'sine', 0.2, 0.22)
  },
}

/** 手机震动（App/安卓 WebView 支持；网页端忽略） */
export function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern)
  } catch { /* 忽略 */ }
}
