<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { mdiAlertCircleOutline, mdiNewspaperVariantOutline, mdiPencilPlus } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import MomentCard from '@/components/MomentCard.vue'
import MomentComposer from '@/components/MomentComposer.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import { ApiError } from '@/api/request'
import { asMoment, getSquareFeed } from '@/api/feed'
import {
  likeMoment,
  momentErrorMessage,
  unlikeMoment,
  type MomentItem,
} from '@/api/moment'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()

const items = ref<MomentItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)
const errorText = ref('')
const loginDialogOpen = ref(false)
const composerOpen = ref(false)
const actionId = ref<number | null>(null)

function apiMessage(e: unknown, fallback: string) {
  if (e instanceof ApiError) return momentErrorMessage(e.code) || e.msg || fallback
  return fallback
}

async function loadInitial() {
  loading.value = true
  errorText.value = ''
  nextCursor.value = null
  hasMore.value = false
  try {
    const resp = await getSquareFeed({ limit: 20 })
    items.value = resp.items.map(asMoment).filter((x): x is MomentItem => !!x)
    nextCursor.value = resp.next_cursor
    hasMore.value = Boolean(resp.next_cursor)
  } catch (e) {
    errorText.value = apiMessage(e, '暂时无法加载广场，请稍后重试')
    items.value = []
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value || !nextCursor.value) return
  loadingMore.value = true
  try {
    const resp = await getSquareFeed({ cursor: nextCursor.value, limit: 20 })
    const next = resp.items.map(asMoment).filter((x): x is MomentItem => !!x)
    items.value = [...items.value, ...next]
    nextCursor.value = resp.next_cursor
    hasMore.value = Boolean(resp.next_cursor)
  } catch (e) {
    ElMessage.error(apiMessage(e, '加载更多失败'))
  } finally {
    loadingMore.value = false
  }
}

function openMoment(item: MomentItem) {
  router.push(`/square/${item.id}`)
}

function requireLogin() {
  loginDialogOpen.value = true
}

function openComposer() {
  if (!authStore.isLoggedIn) {
    requireLogin()
    return
  }
  composerOpen.value = true
}

async function toggleLike(item: MomentItem) {
  if (!authStore.isLoggedIn) {
    requireLogin()
    return
  }
  if (actionId.value === item.id) return
  actionId.value = item.id
  const liked = item.liked
  item.liked = !liked
  item.like_count += liked ? -1 : 1
  try {
    if (liked) await unlikeMoment(item.id)
    else await likeMoment(item.id)
  } catch (e) {
    item.liked = liked
    item.like_count += liked ? 1 : -1
    ElMessage.error(apiMessage(e, '操作失败'))
  } finally {
    actionId.value = null
  }
}

function onCreated(moment: MomentItem | null) {
  if (moment) {
    items.value = [moment, ...items.value.filter((x) => x.id !== moment.id)]
  }
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
  <div class="square-page">
    <div class="square-shell">
      <div class="square-hero">
        <div class="hero-left">
          <MdiIcon class="hero-icon" :path="mdiNewspaperVariantOutline" size="36px" />
          <div>
            <h1 class="hero-title">广场</h1>
            <p class="hero-sub">看看大家在分享什么</p>
          </div>
        </div>
        <button type="button" class="hero-action" @click="openComposer">
          <MdiIcon :path="mdiPencilPlus" size="18px" />
          发动态
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

      <div v-else-if="!items.length" class="state-card empty">
        <div class="empty-icon">
          <MdiIcon :path="mdiNewspaperVariantOutline" size="28px" />
        </div>
        <p class="empty-title">广场还空着</p>
        <p class="empty-subtitle">来发第一条动态吧</p>
        <button type="button" class="primary-btn" @click="openComposer">发动态</button>
      </div>

      <template v-else>
        <div class="moment-list">
          <MomentCard
            v-for="item in items"
            :key="item.id"
            :moment="item"
            compact
            @open="openMoment(item)"
            @like="toggleLike(item)"
            @unlike="toggleLike(item)"
            @require-login="requireLogin"
          />
        </div>
        <div v-if="hasMore" class="tail-row">
          <button type="button" class="load-more-btn" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? '加载中…' : '加载更多' }}
          </button>
        </div>
      </template>
    </div>

    <MomentComposer v-model="composerOpen" @created="onCreated" />
    <LoginDialog :model-value="loginDialogOpen" @update:model-value="onLoginDialogChange" />
  </div>
</template>

<style scoped>
.square-page {
  min-height: calc(100vh - var(--hw-header-height));
  background: var(--hw-bg-primary);
  padding: 0 0 80px;
}

.square-shell {
  max-width: 720px;
  margin: 0 auto;
}

.square-hero {
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
  padding: 8px 16px;
  border-radius: 12px;
  border: none;
  background: var(--theme-color);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.hero-action:hover {
  background: color-mix(in srgb, var(--theme-color) 85%, #000);
}

.moment-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
