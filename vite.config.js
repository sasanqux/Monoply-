import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [vue(), tailwindcss(), viteSingleFile()],
  base: './',
  build: {
    target: ['es2015', 'chrome60', 'edge15', 'safari11'],
    assetsInlineLimit: 100000000, // 所有资源内联
  },
  server: {
    host: true,
    port: 5173,
  },
})
