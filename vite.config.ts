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
    // 生产环境 API 地址
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://api.hachimi.world'),
  },
  server: {
    proxy: {
      // 开发环境代理：/api-proxy/* -> https://api.hachimi.world/*
      '/api-proxy': {
        target: 'https://api.hachimi.world',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, ''),
        secure: true,
      },
    },
  },
})
