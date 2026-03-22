<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import { useThemeStore } from './stores/theme'

// 初始化主题（store 构造时会自动应用）
const themeStore = useThemeStore()
void themeStore
</script>

<template>
  <div class="app-layout">
    <AppHeader />
    <main class="app-main">
      <RouterView v-slot="{ Component, route }">
        <KeepAlive>
          <component :is="Component" :key="route.path" />
        </KeepAlive>
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--hw-bg-primary);
}

.app-main {
  flex: 1;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px 20px;
  box-sizing: border-box;
}

@media (max-width: 768px) {
  .app-main {
    padding: 16px 12px;
  }
}
</style>
