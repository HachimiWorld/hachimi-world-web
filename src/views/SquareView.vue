<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { mdiAlertCircleOutline, mdiNewspaper, mdiPencilPlus } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import MomentCard from '@/components/MomentCard.vue'
import MomentComposer from '@/components/MomentComposer.vue'
import EventPostCard from '@/components/EventPostCard.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import { ApiError } from '@/api/request'
import { asMoment, getSquareFeed } from '@/api/feed'
import {
  likeMoment,
  momentErrorMessage,
  unlikeMoment,
  type MomentItem,
} from '@/api/moment'
import { getPostPage, type PostItem } from '@/api/post'
import { useAuthStore } from '@/stores/auth'

type SquareTab = 'moments' | 'events'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const activeTab = computed<SquareTab>(() =>
  route.query.tab === 'events' ? 'events' : 'moments',
)

const loginDialogOpen = ref(false)
const composerOpen = ref(false)

// ── 动态 ──
const moments = ref<MomentItem[]>([])
const momentsLoading = ref(false)
const momentsLoadingMore = ref(false)
const momentsCursor = ref<string | null>(null)
const momentsHasMore = ref(false)
const momentsError = ref('')
const actionId = ref<number | null>(null)

// ── 公告 ──
const posts = ref<PostItem[]>([])
const postsLoading = ref(false)
const postsLoadingMore = ref(false)
const postsPage = ref(0)
const postsHasMore = ref(false)
const postsError = ref('')
const PAGE_SIZE = 20

function apiMessage(e: unknown, fallback: string) {
  if (e instanceof ApiError) return momentErrorMessage(e.code) || e.msg || fallback
  return fallback
}

function setTab(tab: SquareTab) {
  router.replace({ path: '/square', query: tab === 'moments' ? {} : { tab } })
}

async function loadMomentsInitial() {
  momentsLoading.value = true
  momentsError.value = ''
  momentsCursor.value = null
  momentsHasMore.value = false
  try {
    const resp = await getSquareFeed({ limit: PAGE_SIZE })
    moments.value = resp.items.map(asMoment).filter((x): x is MomentItem => !!x)
    momentsCursor.value = resp.next_cursor
    momentsHasMore.value = Boolean(resp.next_cursor)
  } catch (e) {
    momentsError.value = apiMessage(e, '暂时无法加载动态，请稍后重试')
    moments.value = []
  } finally {
    momentsLoading.value = false
  }
}

async function loadMomentsMore() {
  if (!momentsHasMore.value || momentsLoadingMore.value || !momentsCursor.value) return
  momentsLoadingMore.value = true
  try {
    const resp = await getSquareFeed({ cursor: momentsCursor.value, limit: PAGE_SIZE })
    const next = resp.items.map(asMoment).filter((x): x is MomentItem => !!x)
    moments.value = [...moments.value, ...next]
    momentsCursor.value = resp.next_cursor
    momentsHasMore.value = Boolean(resp.next_cursor)
  } catch (e) {
    ElMessage.error(apiMessage(e, '加载更多失败'))
  } finally {
    momentsLoadingMore.value = false
  }
}

async function loadPostsInitial() {
  postsLoading.value = true
  postsError.value = ''
  postsPage.value = 0
  postsHasMore.value = false
  try {
    const resp = await getPostPage({ pageIndex: 0, pageSize: PAGE_SIZE })
    posts.value = resp.posts
    postsHasMore.value = resp.posts.length >= PAGE_SIZE
  } catch (e) {
    postsError.value = e instanceof ApiError ? e.msg : '暂时无法加载公告，请稍后重试'
    posts.value = []
  } finally {
    postsLoading.value = false
  }
}

async function loadPostsMore() {
  if (!postsHasMore.value || postsLoadingMore.value) return
  postsLoadingMore.value = true
  try {
    const nextPage = postsPage.value + 1
    const resp = await getPostPage({ pageIndex: nextPage, pageSize: PAGE_SIZE })
    posts.value = [...posts.value, ...resp.posts]
    postsPage.value = nextPage
    postsHasMore.value = resp.posts.length >= PAGE_SIZE
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '加载更多失败')
  } finally {
    postsLoadingMore.value = false
  }
}

function openMoment(item: MomentItem) {
  router.push(`/square/moment/${item.id}`)
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
    moments.value = [moment, ...moments.value.filter((x) => x.id !== moment.id)]
  }
}

function onLoginDialogChange(open: boolean) {
  loginDialogOpen.value = open
  if (!open && authStore.isLoggedIn && activeTab.value === 'moments') {
    void loadMomentsInitial()
  }
}

function ensureTabData(tab: SquareTab) {
  if (tab === 'moments' && !moments.value.length && !momentsLoading.value && !momentsError.value) {
    void loadMomentsInitial()
  }
  if (tab === 'events' && !posts.value.length && !postsLoading.value && !postsError.value) {
    void loadPostsInitial()
  }
}

watch(activeTab, (tab) => {
  ensureTabData(tab)
}, { immediate: false })

onMounted(() => {
  ensureTabData(activeTab.value)
})
</script>

<template>
  <div class="square-page">
    <div class="square-shell">
      <div class="square-hero">
        <div class="hero-left">
          <MdiIcon class="hero-icon" :path="mdiNewspaper" size="36px" />
          <div>
            <h1 class="hero-title">广场</h1>
            <p class="hero-sub">动态与活动公告</p>
          </div>
        </div>
        <button
          v-if="activeTab === 'moments'"
          type="button"
          class="hero-action"
          @click="openComposer"
        >
          <MdiIcon :path="mdiPencilPlus" size="18px" />
          发动态
        </button>
      </div>

      <div class="tab-bar" role="tablist">
        <button
          type="button"
          class="tab"
          role="tab"
          :aria-selected="activeTab === 'moments'"
          :class="{ active: activeTab === 'moments' }"
          @click="setTab('moments')"
        >
          动态
        </button>
        <button
          type="button"
          class="tab"
          role="tab"
          :aria-selected="activeTab === 'events'"
          :class="{ active: activeTab === 'events' }"
          @click="setTab('events')"
        >
          公告
        </button>
      </div>

      <!-- 动态 -->
      <template v-if="activeTab === 'moments'">
        <div v-if="momentsLoading" class="state-card">
          <div class="loading-dot" />
        </div>

        <div v-else-if="momentsError" class="state-card">
          <MdiIcon :path="mdiAlertCircleOutline" size="22px" />
          <p>{{ momentsError }}</p>
          <button type="button" class="retry-btn" @click="loadMomentsInitial">重试</button>
        </div>

        <div v-else-if="!moments.length" class="state-card empty">
          <div class="empty-icon">
            <MdiIcon :path="mdiNewspaper" size="28px" />
          </div>
          <p class="empty-title">广场还空着</p>
          <p class="empty-subtitle">来发第一条动态吧</p>
          <button type="button" class="primary-btn" @click="openComposer">发动态</button>
        </div>

        <template v-else>
          <div class="moment-list">
            <MomentCard
              v-for="item in moments"
              :key="item.id"
              :moment="item"
              compact
              @open="openMoment(item)"
              @like="toggleLike(item)"
              @unlike="toggleLike(item)"
              @require-login="requireLogin"
            />
          </div>
          <div v-if="momentsHasMore" class="tail-row">
            <button type="button" class="load-more-btn" :disabled="momentsLoadingMore" @click="loadMomentsMore">
              {{ momentsLoadingMore ? '加载中…' : '加载更多' }}
            </button>
          </div>
        </template>
      </template>

      <!-- 公告 -->
      <template v-else>
        <div v-if="postsLoading" class="state-card">
          <div class="loading-dot" />
        </div>

        <div v-else-if="postsError" class="state-card">
          <MdiIcon :path="mdiAlertCircleOutline" size="22px" />
          <p>{{ postsError }}</p>
          <button type="button" class="retry-btn" @click="loadPostsInitial">重试</button>
        </div>

        <div v-else-if="!posts.length" class="state-card empty">
          <div class="empty-icon">
            <MdiIcon :path="mdiNewspaper" size="28px" />
          </div>
          <p class="empty-title">暂无活动</p>
        </div>

        <template v-else>
          <div class="event-grid">
            <EventPostCard
              v-if="posts[0]"
              class="featured-card"
              :post="posts[0]"
              featured
            />
            <EventPostCard
              v-for="post in posts.slice(1)"
              :key="post.id"
              :post="post"
            />
          </div>
          <div v-if="postsHasMore" class="tail-row">
            <button type="button" class="load-more-btn" :disabled="postsLoadingMore" @click="loadPostsMore">
              {{ postsLoadingMore ? '加载中…' : '加载更多' }}
            </button>
          </div>
        </template>
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
  max-width: 860px;
  margin: 0 auto;
}

.square-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 16px;
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

.tab-bar {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--hw-border);
}

.tab {
  position: relative;
  border: none;
  background: transparent;
  padding: 10px 16px 14px;
  font-size: 15px;
  color: var(--hw-text-secondary);
  cursor: pointer;
}

.tab.active {
  color: var(--theme-color);
  font-weight: 650;
}

.tab.active::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 6px;
  width: 12px;
  height: 3px;
  margin-left: -6px;
  border-radius: 2px;
  background: var(--theme-color);
}

.moment-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
}

.event-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.featured-card {
  grid-column: 1 / -1;
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

@media (max-width: 640px) {
  .event-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1040px) {
  .event-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
