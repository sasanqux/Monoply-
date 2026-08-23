import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// 检测 Capacitor 环境，给 body 加 class（仅 App 生效全屏样式）
import { Capacitor } from '@capacitor/core'
import { StatusBar } from '@capacitor/status-bar'
if (Capacitor.isNativePlatform()) {
  document.body.classList.add('capacitor')
  // 只让 WebView 覆盖到状态栏后面；隐藏系统栏由 MainActivity 原生层统一处理
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
}

createApp(App).mount('#app')
