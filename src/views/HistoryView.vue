<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { mdiClockOutline } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import { ApiError } from '@/api/request'
import {
  getPlayHistoryCursor,
  deletePlayHistoryItem,
  type PlayHistoryItem,
} from '@/api/history'
import { useUserStore } from '@/stores/user'
import HistoryCard from '@/components/HistoryCard.vue'
import LoginDialog from '@/components/LoginDialog.vue'

const userStore = useUserStore()

const items = ref<PlayHistoryItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)
const errorText = ref('')
const loginDialogOpen = ref(false)

const PAGE_SIZE = 30

async function loadInitial() {
  if (!userStore.isLoggedIn) {
    loginDialogOpen.value = true
    return
  }
  loading.value = true
  errorText.value = ''
  try {
    const resp = await getPlayHistoryCursor({ size: PAGE_SIZE })
    items.value = resp.list
    // 如果返回数量等于页大小，认为可能还有更多
    hasMore.value = resp.list.length === PAGE_SIZE
    nextCursor.value = resp.list.length > 0
      ? (resp.list[resp.list.length - 1]?.play_time ?? null)
      : null
  } catch (e) {
    errorText.value = e instanceof ApiError ? e.msg : '加载播放历史失败'
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!nextCursor.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const resp = await getPlayHistoryCursor({ cursor: nextCursor.value, size: PAGE_SIZE })
    items.value.push(...resp.list)
    hasMore.value = resp.list.length === PAGE_SIZE
    nextCursor.value = resp.list.length > 0
      ? (resp.list[resp.list.length - 1]?.play_time ?? null)
      : null
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '加载更多失败')
  } finally {
    loadingMore.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await deletePlayHistoryItem(id)
    items.value = items.value.filter((item) => item.id !== id)
    ElMessage.success('已删除该播放记录')
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '删除失败')
  }
}

function onLoginClose() {
  if (userStore.isLoggedIn) {
    loadInitial()
  }
}

onMounted(() => {
  loadInitial()
})
</script>

<template>
  <div class="history-view">
    <div class="history-shell">
      <div class="history-hero">
        <div class="hero-left">
          <MdiIcon class="hero-icon" :path="mdiClockOutline" size="36px" />
          <div>
            <h1 class="hero-title">播放历史</h1>
            <p class="hero-sub">记录每一次曼波</p>
          </div>
        </div>
      </div>

      <!-- 未登录 -->
      <div v-if="!userStore.isLoggedIn" class="state-card">
        <MdiIcon class="state-icon" :path="mdiClockOutline" size="48px" />
        <p>登录后才能查看播放历史</p>
        <button class="login-prompt-btn" @click="loginDialogOpen = true">去登录</button>
      </div>

      <!-- 加载骨架 -->
      <div v-else-if="loading" class="list-wrap">
        <div v-for="i in 8" :key="i" class="skeleton-card">
          <div class="sk-cover"></div>
          <div class="sk-body">
            <div class="sk-line sk-title"></div>
            <div class="sk-line sk-sub"></div>
          </div>
        </div>
      </div>

      <!-- 加载出错 -->
      <div v-else-if="errorText" class="state-card">
        <p class="state-error">{{ errorText }}</p>
        <button class="retry-btn" @click="loadInitial">重试</button>
      </div>

      <!-- 空历史 -->
      <div v-else-if="items.length === 0" class="state-card">
        <MdiIcon class="state-icon" :path="mdiClockOutline" size="48px" />
        <p>还没有播放记录，去听点音乐吧</p>
      </div>

      <!-- 历史列表 -->
      <div v-else class="list-wrap">
        <HistoryCard
          v-for="item in items"
          :key="item.id"
          :item="item"
          @delete="handleDelete"
        />
        <div class="load-more-row">
          <button
            v-if="hasMore"
            class="load-more-btn"
            :disabled="loadingMore"
            @click="loadMore"
          >
            {{ loadingMore ? '加载中…' : '加载更多' }}
          </button>
          <p v-else class="end-hint">已加载全部记录</p>
        </div>
      </div>
    </div>
  </div>

  <LoginDialog v-model="loginDialogOpen" @update:model-value="onLoginClose" />
</template>

<style scoped>
.history-view {
  min-height: calc(100vh - var(--hw-header-height));
  background: var(--hw-bg-primary);
  padding: 0 16px 80px;
}

.history-shell {
  max-width: 860px;
  margin: 0 auto;
}

.history-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 24px;
  flex-wrap: wrap;
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.hero-icon {
  font-size: 36px;
  color: var(--theme-color);
  flex-shrink: 0;
}

.hero-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--hw-text-primary);
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.hero-sub {
  margin-top: 4px;
  font-size: 13px;
  color: var(--hw-text-tertiary);
}

.list-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 80px 16px;
  color: var(--hw-text-tertiary);
  font-size: 15px;
  text-align: center;
}

.state-icon {
  font-size: 48px;
  color: var(--hw-text-tertiary);
  opacity: 0.4;
}

.state-error {
  color: #ef4444;
}

.login-prompt-btn,
.retry-btn {
  height: 38px;
  padding: 0 22px;
  border-radius: 10px;
  border: 1px solid var(--hw-border);
  background: transparent;
  color: var(--hw-text-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.login-prompt-btn {
  background: var(--theme-color);
  border-color: var(--theme-color);
  color: #fff;
}

.login-prompt-btn:hover {
  filter: brightness(0.9);
}

.retry-btn:hover {
  background: var(--hw-bg-hover);
}

/* 骨架屏 */
.skeleton-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  border-radius: 16px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
  animation: sk-pulse 1.5s ease-in-out infinite;
}

.sk-cover {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: var(--hw-bg-hover);
  flex-shrink: 0;
}

.sk-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sk-line {
  height: 12px;
  border-radius: 6px;
  background: var(--hw-bg-hover);
}

.sk-title { width: 55%; }
.sk-sub { width: 30%; }

@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.load-more-row {
  display: flex;
  justify-content: center;
  padding: 20px 0 8px;
}

.load-more-btn {
  height: 38px;
  padding: 0 28px;
  border-radius: 10px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
  color: var(--hw-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.load-more-btn:hover { background: var(--hw-bg-hover); }
.load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.end-hint {
  font-size: 13px;
  color: var(--hw-text-tertiary);
}
</style>
