import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

import App from './App.vue'
import router from './router'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(ElementPlus)

// 全局注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')

// 恢复登录态（从 localStorage 读取 token 和用户信息）
// 必须在 mount 后调用，因为 pinia 需要先激活
const authStore = useAuthStore()
authStore.restoreSession()
