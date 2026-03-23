<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const router = useRouter()
const route = useRoute()

const navItems = [
  { label: '首页', path: '/', icon: 'House' },
  { label: '点赞', path: '/upvote', icon: 'Star' },
  { label: '历史', path: '/history', icon: 'Clock' },
  { label: '歌单', path: '/playlist', icon: 'List' },
  { label: '关注', path: '/feed', icon: 'Bell' },
  { label: '创作', path: '/create', icon: 'EditPen' },
  { label: '设置', path: '/settings', icon: 'Setting' },
]

function navigate(path: string) {
  router.push(path)
  emit('update:modelValue', false)
}

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <el-drawer
    :model-value="props.modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    direction="ltr"
    :with-header="false"
    size="240px"
    class="mobile-sidebar-drawer"
  >
    <div class="sidebar-content">
      <div class="sidebar-logo">基米天堂</div>
      <nav class="sidebar-nav">
        <button
          v-for="item in navItems"
          :key="item.path"
          class="sidebar-nav-item"
          :class="{ active: isActive(item.path) }"
          @click="navigate(item.path)"
        >
          <el-icon class="nav-icon"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </div>
  </el-drawer>
</template>

<style scoped>
.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
  background: var(--hw-bg-primary);
}

.sidebar-logo {
  padding: 20px 20px 16px;
  font-size: 19px;
  font-weight: 700;
  color: var(--theme-color);
  letter-spacing: -0.3px;
  border-bottom: 1px solid var(--hw-border);
  font-family: 'Trebuchet MS', 'Segoe UI Rounded', 'Arial Rounded MT Bold', 'Microsoft YaHei', sans-serif;
  user-select: none;
  line-height: 1;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  flex: 1;
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border: none;
  background: transparent;
  color: var(--hw-text-primary);
  font-size: 15px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  text-align: left;
  border-radius: 0;
}

.sidebar-nav-item:hover {
  background: var(--hw-bg-hover);
  color: var(--theme-color);
}

.sidebar-nav-item.active {
  color: var(--theme-color);
  background: var(--theme-color-light);
  font-weight: 600;
}

.nav-icon {
  font-size: 18px;
  flex-shrink: 0;
}
</style>

