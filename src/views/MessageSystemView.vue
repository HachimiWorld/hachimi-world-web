<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { mdiArrowLeft, mdiBellOutline } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import {
  listNotifications,
  markAllNotificationsRead,
  type NotificationItem,
} from '@/api/notification'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/message'
import { formatRelativeTime } from '@/utils/relativeTime'

const authStore = useAuthStore()
const messageStore = useMessageStore()
const router = useRouter()

const items = ref<NotificationItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const markingAll = ref(false)
const hasMore = ref(false)
const errorText = ref('')
const loginDialogOpen = ref(false)

async function loadInitial() {
  if (!authStore.isLoggedIn) {
    loginDialogOpen.value = true
    return
  }
  loading.value = true
  errorText.value = ''
  try {
    const resp = await listNotifications({ limit: 20 })
    items.value = resp.items
    hasMore.value = resp.has_more
  } catch {
    errorText.value = '暂时无法加载通知，请检查网络后重试'
    items.value = []
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value || !items.value.length) return
  loadingMore.value = true
  try {
    const last = items.value[items.value.length - 1]
    const resp = await listNotifications({ beforeId: last.notification_id, limit: 20 })
    items.value = [...items.value, ...resp.items]
    hasMore.value = resp.has_more
  } catch {
    errorText.value = '更多通知加载失败'
  } finally {
    loadingMore.value = false
  }
}

async function markAllRead() {
  if (markingAll.value || messageStore.systemUnread <= 0) return
  markingAll.value = true
  try {
    const resp = await markAllNotificationsRead()
    messageStore.setSystemUnread(resp.unread_count)
    items.value = items.value.map((it) =>
      it.read_time ? it : { ...it, read_time: new Date().toISOString() },
    )
  } catch {
    /* ignore */
  } finally {
    markingAll.value = false
  }
}

function openItem(item: NotificationItem) {
  router.push(`/messages/system/${item.notification_id}`)
}

function onLoginDialogChange(open: boolean) {
  loginDialogOpen.value = open
  if (!open && authStore.isLoggedIn) void loadInitial()
}

onMounted(() => {
  void loadInitial()
})
</script>

<template>
  <div class="msg-page">
    <div class="msg-shell">
      <div class="msg-hero">
        <button type="button" class="back-btn" aria-label="返回" @click="router.push('/messages')">
          <MdiIcon :path="mdiArrowLeft" size="20px" />
        </button>
        <div class="hero-text">
          <h1 class="hero-title">系统通知</h1>
        </div>
        <button
          v-if="messageStore.systemUnread > 0"
          type="button"
          class="hero-action"
          :disabled="markingAll"
          @click="markAllRead"
        >
          全部已读
        </button>
      </div>

      <div v-if="loading" class="state-card">
        <div class="loading-dot" />
      </div>

      <div v-else-if="errorText && !items.length" class="state-card">
        <MdiIcon :path="mdiBellOutline" size="22px" />
        <p>{{ errorText }}</p>
        <button type="button" class="retry-btn" @click="loadInitial">重试</button>
      </div>

      <div v-else-if="!authStore.isLoggedIn" class="state-card">
        <p>登录后查看系统通知</p>
        <button type="button" class="primary-btn" @click="loginDialogOpen = true">去登录</button>
      </div>

      <div v-else-if="!items.length" class="state-card empty">
        <div class="empty-icon">
          <MdiIcon :path="mdiBellOutline" size="28px" />
        </div>
        <p class="empty-title">暂无系统通知</p>
        <p class="empty-subtitle">与你相关的系统消息会显示在这里<br>仅显示最近 180 天的系统通知</p>
      </div>

      <template v-else>
        <div class="list-card">
          <button
            v-for="item in items"
            :key="item.notification_id"
            type="button"
            class="notif-row"
            :class="{ unread: !item.read_time }"
            @click="openItem(item)"
          >
            <div class="row-top">
              <span class="title">{{ item.title }}</span>
              <span class="time">{{ formatRelativeTime(item.create_time) }}</span>
            </div>
            <p class="body">{{ item.body }}</p>
          </button>
        </div>
        <p class="retention">仅显示最近 180 天的系统通知</p>
        <div v-if="hasMore" class="tail-row">
          <button type="button" class="load-more-btn" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? '加载中…' : '加载更多' }}
          </button>
        </div>
      </template>
    </div>

    <LoginDialog :model-value="loginDialogOpen" @update:model-value="onLoginDialogChange" />
  </div>
</template>

<style scoped>
.msg-page {
  min-height: calc(100vh - var(--hw-header-height));
  background: var(--hw-bg-primary);
  padding: 0 0 80px;
}

.msg-shell {
  max-width: 720px;
  margin: 0 auto;
}

.msg-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 0 20px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--hw-text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.back-btn:hover {
  background: var(--hw-bg-hover);
}

.hero-text {
  flex: 1;
  min-width: 0;
}

.hero-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--hw-text-primary);
  letter-spacing: -0.02em;
}

.hero-action {
  border: none;
  background: transparent;
  color: var(--theme-color);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
}

.hero-action:hover {
  background: var(--theme-color-light);
}

.hero-action:disabled {
  opacity: 0.6;
  cursor: default;
}

.list-card {
  border-radius: 16px;
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
  overflow: hidden;
}

.notif-row {
  width: 100%;
  display: block;
  text-align: left;
  border: none;
  background: transparent;
  padding: 14px 20px;
  cursor: pointer;
  position: relative;
  color: inherit;
}

.notif-row + .notif-row {
  border-top: 1px solid var(--hw-border);
}

.notif-row:hover {
  background: var(--hw-bg-hover);
}

.notif-row.unread::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 50%;
  width: 6px;
  height: 6px;
  margin-top: -3px;
  border-radius: 50%;
  background: var(--theme-color);
}

.row-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--hw-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-row.unread .title {
  font-weight: 600;
}

.time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.body {
  margin-top: 4px;
  font-size: 13px;
  color: var(--hw-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.retention {
  margin-top: 20px;
  text-align: center;
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.state-card {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--hw-text-secondary);
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--hw-text-primary) 5%, transparent);
  color: var(--hw-text-tertiary);
  margin-bottom: 6px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--hw-text-primary);
}

.empty-subtitle {
  font-size: 13px;
  color: var(--hw-text-tertiary);
  line-height: 1.5;
}

.loading-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--theme-color-light);
  border-top-color: var(--theme-color);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.primary-btn,
.retry-btn,
.load-more-btn {
  border: none;
  border-radius: 12px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
}

.primary-btn {
  background: var(--theme-color);
  color: #fff;
}

.retry-btn,
.load-more-btn {
  background: transparent;
  color: var(--theme-color);
}

.retry-btn:hover,
.load-more-btn:hover {
  background: var(--theme-color-light);
}

.tail-row {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}
</style>
