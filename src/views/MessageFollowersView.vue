<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { mdiArrowLeft, mdiAccountPlus } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import { CHANNEL_FOLLOW } from '@/api/message'
import { getFollowers, type FollowerItem } from '@/api/follow'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/message'
import { formatRelativeTime } from '@/utils/relativeTime'

const authStore = useAuthStore()
const messageStore = useMessageStore()
const router = useRouter()

const items = ref<FollowerItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)
const nextCursor = ref<string | null>(null)
const errorText = ref('')
const loginDialogOpen = ref(false)
const newSince = ref<string | null>(null)

function isNew(item: FollowerItem) {
  if (!newSince.value) return false
  return new Date(item.followed_at).getTime() > new Date(newSince.value).getTime()
}

async function loadInitial() {
  if (!authStore.isLoggedIn) {
    loginDialogOpen.value = true
    return
  }
  loading.value = true
  errorText.value = ''
  nextCursor.value = null
  try {
    newSince.value = await messageStore.openChannel(CHANNEL_FOLLOW)
    const resp = await getFollowers({ limit: 20 })
    items.value = resp.items
    nextCursor.value = resp.next_cursor ?? null
    hasMore.value = Boolean(resp.next_cursor)
  } catch {
    errorText.value = '暂时无法加载，请检查网络后重试'
    items.value = []
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value || !nextCursor.value) return
  loadingMore.value = true
  try {
    const resp = await getFollowers({ after: nextCursor.value, limit: 20 })
    items.value = [...items.value, ...resp.items]
    nextCursor.value = resp.next_cursor ?? null
    hasMore.value = Boolean(resp.next_cursor)
  } catch {
    errorText.value = '更多内容加载失败'
  } finally {
    loadingMore.value = false
  }
}

function openUser(item: FollowerItem) {
  router.push(`/user/${item.user.uid}`)
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
        <h1 class="hero-title">新粉丝</h1>
      </div>

      <div v-if="loading" class="state-card">
        <div class="loading-dot" />
      </div>

      <div v-else-if="errorText && !items.length" class="state-card">
        <MdiIcon :path="mdiAccountPlus" size="22px" />
        <p>{{ errorText }}</p>
        <button type="button" class="retry-btn" @click="loadInitial">重试</button>
      </div>

      <div v-else-if="!authStore.isLoggedIn" class="state-card">
        <p>登录后查看新粉丝</p>
        <button type="button" class="primary-btn" @click="loginDialogOpen = true">去登录</button>
      </div>

      <div v-else-if="!items.length" class="state-card empty">
        <div class="empty-icon">
          <MdiIcon :path="mdiAccountPlus" size="28px" />
        </div>
        <p class="empty-title">还没有人关注你</p>
        <p class="empty-subtitle">关注你的人会出现在这里</p>
      </div>

      <template v-else>
        <div class="list-card">
          <button
            v-for="item in items"
            :key="item.user.uid"
            type="button"
            class="follower-row"
            :class="{ unread: isNew(item) }"
            @click="openUser(item)"
          >
            <div class="avatar">
              <img v-if="item.user.avatar_url" :src="item.user.avatar_url" :alt="item.user.username">
              <span v-else class="avatar-fallback">{{ item.user.username?.[0] || '?' }}</span>
            </div>
            <div class="meta">
              <div class="name-row">
                <span class="username">{{ item.user.is_banned ? '已注销用户' : item.user.username }}</span>
                <span v-if="item.is_mutual" class="mutual">互相关注</span>
              </div>
            </div>
            <span class="time">{{ formatRelativeTime(item.followed_at) }}</span>
          </button>
        </div>
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

.hero-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--hw-text-primary);
}

.list-card {
  border-radius: 16px;
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
  overflow: hidden;
}

.follower-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: inherit;
  position: relative;
}

.follower-row + .follower-row {
  border-top: 1px solid var(--hw-border);
}

.follower-row:hover {
  background: var(--hw-bg-hover);
}

.follower-row.unread::before {
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

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--hw-text-primary) 8%, transparent);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--hw-text-tertiary);
}

.meta {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.username {
  font-size: 14px;
  font-weight: 600;
  color: var(--hw-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mutual {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.time {
  flex-shrink: 0;
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

.tail-row {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}
</style>
