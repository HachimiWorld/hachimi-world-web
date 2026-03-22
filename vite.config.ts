import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  define: {
    // 生产环境 API 地址（开发环境通过 proxy 走 /api-proxy，见下方 server.proxy）
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://api.hachimi.world/api'),
  },
  server: {
    proxy: {
      // 开发环境代理：/api-proxy/* -> https://api.hachimi.world/api/*
      // 绕过浏览器 CORS 限制
      '/api-proxy': {
        target: 'https://api.hachimi.world',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, '/api'),
        secure: true,
      },
    },
  },
})
