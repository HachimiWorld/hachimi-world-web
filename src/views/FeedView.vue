<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { mdiAccountPlus, mdiAlertCircleOutline } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import FollowUserCard from '@/components/FollowUserCard.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import { ApiError } from '@/api/request'
import {
  followErrorMessage,
  getFollowing,
  unfollowUser,
  type FollowingItem,
} from '@/api/follow'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const router = useRouter()

const items = ref<FollowingItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const actionUid = ref<number | null>(null)
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)
const errorText = ref('')
const loginDialogOpen = ref(false)

const PAGE_SIZE = 20

function apiMessage(e: unknown, fallback: string) {
  if (e instanceof ApiError) return followErrorMessage(e.code) || e.msg || fallback
  return fallback
}

async function loadInitial() {
  if (!userStore.isLoggedIn) {
    loginDialogOpen.value = true
    return
  }
  loading.value = true
  errorText.value = ''
  nextCursor.value = null
  hasMore.value = false
  try {
    const resp = await getFollowing({ limit: PAGE_SIZE })
    items.value = resp.items
    nextCursor.value = resp.next_cursor ?? null
    hasMore.value = Boolean(resp.next_cursor)
  } catch (e) {
    errorText.value = apiMessage(e, '加载失败，请重试')
    items.value = []
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value || !nextCursor.value) return
  loadingMore.value = true
  try {
    const resp = await getFollowing({ after: nextCursor.value, limit: PAGE_SIZE })
    items.value = [...items.value, ...resp.items]
    nextCursor.value = resp.next_cursor ?? null
    hasMore.value = Boolean(resp.next_cursor)
  } catch (e) {
    ElMessage.error(apiMessage(e, '加载更多失败'))
  } finally {
    loadingMore.value = false
  }
}

async function handleUnfollow(item: FollowingItem) {
  try {
    await ElMessageBox.confirm(
      '该用户将从你的关注列表中移除',
      `确定不再关注 ${item.user.username}？`,
      {
        confirmButtonText: '不再关注',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  actionUid.value = item.user.uid
  try {
    await unfollowUser(item.user.uid)
    items.value = items.value.filter((i) => i.user.uid !== item.user.uid)
    ElMessage.success('已取消关注')
  } catch (e) {
    ElMessage.error(apiMessage(e, '取消关注失败'))
  } finally {
    actionUid.value = null
  }
}

function onLoginDialogChange(open: boolean) {
  loginDialogOpen.value = open
  if (!open && userStore.isLoggedIn) void loadInitial()
}

onMounted(() => {
  void loadInitial()
})
</script>

<template>
  <div class="follow-page">
    <div class="follow-shell">
      <div class="follow-hero">
        <div class="hero-left">
          <MdiIcon class="hero-icon" :path="mdiAccountPlus" size="36px" />
          <div>
            <h1 class="hero-title">我的关注</h1>
            <p class="hero-sub">你关注的人会出现在这里</p>
          </div>
        </div>
        <button type="button" class="hero-action" @click="router.push('/followers')">
          我的粉丝
        </button>
      </div>

      <div v-if="loading" class="state-card">
        <div class="loading-dot" />
      </div>

      <div v-else-if="errorText" class="state-card">
        <MdiIcon :path="mdiAlertCircleOutline" size="22px" />
        <p>{{ errorText }}</p>
        <button type="button" class="retry-btn" @click="loadInitial">重试</button>
      </div>

      <div v-else-if="!userStore.isLoggedIn" class="state-card">
        <MdiIcon :path="mdiAccountPlus" size="28px" class="state-icon" />
        <p>登录后查看你的关注</p>
        <button type="button" class="primary-btn" @click="loginDialogOpen = true">去登录</button>
      </div>

      <div v-else-if="!items.length" class="state-card empty">
        <div class="empty-badge">♫</div>
        <p class="empty-title">你还没有关注任何人</p>
        <button type="button" class="primary-btn" @click="router.push('/recommend')">去发现创作者</button>
      </div>

      <template v-else>
        <div class="user-list">
          <FollowUserCard
            v-for="item in items"
            :key="item.user.uid"
            :user="item.user"
            following
            :is-mutual="item.is_mutual"
            :action-loading="actionUid === item.user.uid"
            @unfollow="handleUnfollow(item)"
          />
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
.follow-page {
  min-height: calc(100vh - var(--hw-header-height));
  background: var(--hw-bg-primary);
  padding: 0 16px 80px;
}

.follow-shell {
  max-width: 860px;
  margin: 0 auto;
}

.follow-hero {
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

.hero-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 12px;
  border: none;
  background: var(--theme-color);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.hero-action:hover {
  background: color-mix(in srgb, var(--theme-color) 85%, #000);
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.state-icon {
  color: var(--hw-text-tertiary);
}

.empty-badge {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background: var(--theme-color-light);
  color: color-mix(in srgb, var(--theme-color) 70%, transparent);
  margin-bottom: 8px;
}

.empty-title {
  font-size: 16px;
  color: var(--hw-text-primary);
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

.load-more-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.tail-row {
  display: flex;
  justify-content: center;
  padding: 16px 0 8px;
}

.loading-dot {
  width: 28px;
  height: 28px;
  border: 2px solid var(--hw-border);
  border-top-color: var(--theme-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
