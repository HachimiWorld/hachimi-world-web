<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { mdiAccountPlus, mdiCog, mdiHeartOutline, mdiHistory, mdiHome, mdiPencil, mdiPlaylistMusic } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import lightLogoUrl from '@/assets/logo-light.svg'
import darkLogoUrl from '@/assets/logo-dark.svg'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()
const currentLogoUrl = computed(() => (themeStore.isDark ? darkLogoUrl : lightLogoUrl))

const navItems = [
  { label: '首页', path: '/', icon: mdiHome },
  { label: '点赞', path: '/upvote', icon: mdiHeartOutline },
  { label: '历史', path: '/history', icon: mdiHistory },
  { label: '歌单', path: '/playlist', icon: mdiPlaylistMusic },
  { label: '关注', path: '/feed', icon: mdiAccountPlus },
  { label: '创作', path: '/create', icon: mdiPencil },
  { label: '设置', path: '/settings', icon: mdiCog },
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
      <div class="sidebar-logo">
        <img :src="currentLogoUrl" alt="基米天堂" class="sidebar-logo-image">
      </div>
      <nav class="sidebar-nav">
        <button
          v-for="item in navItems"
          :key="item.path"
          class="sidebar-nav-item"
          :class="{ active: isActive(item.path) }"
          @click="navigate(item.path)"
        >
          <MdiIcon class="nav-icon" :path="item.icon" size="18px" />
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
  background: var(--hw-bg-secondary);
}

.sidebar-logo {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--hw-border);
  display: flex;
  align-items: center;
}

.sidebar-logo-image {
  display: block;
  width: auto;
  height: 40px;
  max-width: 210px;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
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
  padding: 8px 20px;
  margin-bottom: 6px;
  border: none;
  background: transparent;
  color: var(--hw-text-primary);
  font-size: 15px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  text-align: left;
  border-radius: 6px;
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

