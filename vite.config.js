import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: './', // 相对路径，构建产物可直接双击 index.html 打开
  build: {
    target: ['es2015', 'chrome60', 'edge15', 'safari11'],
  },
  server: {
    host: true,
    port: 5173,
  },
})
