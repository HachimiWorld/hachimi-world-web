<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import MobileSidebar from './MobileSidebar.vue'
import LoginDialog from './LoginDialog.vue'
import { Search, UserFilled } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const sidebarOpen = ref(false)
const loginDialogOpen = ref(false)
const searchQuery = ref('')

const navItems = [
  { label: '首页', path: '/' },
  { label: '点赞', path: '/upvote' },
  { label: '历史', path: '/history' },
  { label: '歌单', path: '/playlist' },
  { label: '关注', path: '/feed' },
  { label: '创作', path: '/create' },
  { label: '设置', path: '/settings' },
]

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function handleSearch() {
  if (searchQuery.value.trim()) {
    console.log('search:', searchQuery.value)
  }
}

function handleAvatarClick() {
  if (userStore.isLoggedIn && userStore.userInfo) {
    router.push(`/user/${userStore.userInfo.uid}`)
  } else {
    loginDialogOpen.value = true
  }
}
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <!-- PC端 Logo -->
      <div class="header-logo pc-only">
        <span class="logo-text">Hachimi World</span>
      </div>

      <!-- 手机端汉堡菜单按钮 -->
      <button class="hamburger mobile-only" @click="sidebarOpen = true" aria-label="打开菜单">
        <span class="hamburger-line" />
        <span class="hamburger-line" />
        <span class="hamburger-line" />
      </button>

      <!-- PC端导航 -->
      <nav class="header-nav pc-only">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ active: isActive(item.path) }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <!-- 搜索框 -->
      <div class="header-search">
        <el-input
          v-model="searchQuery"
          placeholder="搜索歌曲、用户..."
          class="search-input"
          @keyup.enter="handleSearch"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <!-- 头像区域 -->
      <div class="header-avatar" @click="handleAvatarClick" role="button" tabindex="0" @keyup.enter="handleAvatarClick">
        <template v-if="userStore.isLoggedIn && userStore.userInfo">
          <el-avatar
            :size="34"
            :src="userStore.userInfo.avatar_url ?? undefined"
            class="avatar-img"
          >
            {{ userStore.userInfo.username?.[0] }}
          </el-avatar>
        </template>
        <template v-else>
          <div class="avatar-placeholder">
            <el-icon><UserFilled /></el-icon>
          </div>
        </template>
      </div>
    </div>
  </header>

  <!-- 手机侧边栏 -->
  <MobileSidebar v-model="sidebarOpen" />

  <!-- 登录弹窗 -->
  <LoginDialog v-model="loginDialogOpen" />
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
  height: var(--hw-header-height);
  background: var(--hw-bg-header);
  border-bottom: 1px solid var(--hw-border);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.header-inner {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 20px;
  gap: 8px;
  max-width: 1440px;
  margin: 0 auto;
}

/* Logo */
.header-logo {
  flex-shrink: 0;
  margin-right: 8px;
}

.logo-text {
  font-size: 17px;
  font-weight: 700;
  color: var(--theme-color);
  letter-spacing: -0.4px;
  font-family: 'Georgia', serif;
  white-space: nowrap;
  cursor: default;
  user-select: none;
}

/* PC 导航 */
.header-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--hw-text-secondary);
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
  white-space: nowrap;
}

.nav-link:hover {
  color: var(--hw-text-primary);
  background: var(--hw-bg-hover);
}

.nav-link.active {
  color: var(--theme-color);
  background: var(--theme-color-light);
  font-weight: 600;
}

/* 搜索框 */
.header-search {
  flex: 1;
  min-width: 0;
  max-width: 320px;
  margin-left: auto;
}

:deep(.search-input .el-input__wrapper) {
  background: var(--hw-bg-input);
  border-radius: 20px;
  box-shadow: none;
  border: 1px solid var(--hw-border);
  transition: border-color 0.2s, box-shadow 0.2s;
}

:deep(.search-input .el-input__wrapper:hover),
:deep(.search-input .el-input__wrapper.is-focus) {
  border-color: var(--theme-color);
  box-shadow: 0 0 0 2px var(--theme-color-light);
}

:deep(.search-input .el-input__inner) {
  color: var(--hw-text-primary);
  font-size: 14px;
}

:deep(.search-input .el-input__inner::placeholder) {
  color: var(--hw-text-tertiary);
}

/* 头像 */
.header-avatar {
  flex-shrink: 0;
  margin-left: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-img {
  transition: opacity 0.15s, transform 0.15s;
}

.avatar-img:hover {
  opacity: 0.85;
  transform: scale(1.05);
}

.avatar-placeholder {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--hw-bg-hover);
  border: 1.5px dashed var(--hw-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hw-text-tertiary);
  font-size: 17px;
  transition: border-color 0.15s, color 0.15s;
}

.avatar-placeholder:hover {
  border-color: var(--theme-color);
  color: var(--theme-color);
}

/* 汉堡菜单 */
.hamburger {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  padding: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  flex-shrink: 0;
  transition: background 0.15s;
}

.hamburger:hover {
  background: var(--hw-bg-hover);
}

.hamburger-line {
  display: block;
  width: 100%;
  height: 2px;
  background: var(--hw-text-primary);
  border-radius: 2px;
  transition: background 0.15s;
}

/* 响应式 */
.pc-only {
  display: flex;
}

.mobile-only {
  display: none;
}

@media (max-width: 768px) {
  .pc-only {
    display: none !important;
  }

  .mobile-only {
    display: flex !important;
  }

  .header-search {
    margin-left: 8px;
    max-width: none;
  }

  .header-inner {
    padding: 0 12px;
    gap: 6px;
  }
}
</style>
