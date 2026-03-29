<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { mdiHeartOutline, mdiPlay, mdiInformationOutline } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import { ApiError } from '@/api/request'
import { getMyLikes, unlikeSong, type MyLikeItem } from '@/api/song'
import { useUserStore } from '@/stores/user'
import { usePlayerStore } from '@/stores/player'

const userStore = useUserStore()
const router = useRouter()
const playerStore = usePlayerStore()

const items = ref<MyLikeItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)
const pageIndex = ref(0)
const total = ref(0)
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
  pageIndex.value = 0
  try {
    const resp = await getMyLikes(0, PAGE_SIZE)
    items.value = resp.data
    total.value = resp.total
    hasMore.value = resp.data.length === PAGE_SIZE && items.value.length < resp.total
    pageIndex.value = 1
  } catch (e) {
    errorText.value = e instanceof ApiError ? e.msg : '加载点赞列表失败'
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const resp = await getMyLikes(pageIndex.value, PAGE_SIZE)
    items.value.push(...resp.data)
    total.value = resp.total
    hasMore.value = items.value.length < resp.total
    pageIndex.value += 1
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '加载更多失败')
  } finally {
    loadingMore.value = false
  }
}

async function handlePlay(item: MyLikeItem, e: MouseEvent) {
  e.stopPropagation()
  const localTarget = playerStore.availableTargets.find((t) => t.type === 'local')
  if (!localTarget) return
  await playerStore.addSongToTargetAndPlay(item.song_data.id, localTarget)
}

async function handleUnlike(item: MyLikeItem, e: MouseEvent) {
  e.stopPropagation()
  try {
    await unlikeSong(item.song_data.id)
    items.value = items.value.filter(i => i.song_data.id !== item.song_data.id)
    total.value = Math.max(0, total.value - 1)
    ElMessage.success('已取消点赞')
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '操作失败')
  }
}

function formatLikedTime(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHr < 24) return `${diffHr} 小时前`
  if (diffDay < 7) return `${diffDay} 天前`
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  <div class="upvote-view">
    <div class="upvote-shell">

      <!-- 头部 -->
      <div class="upvote-hero">
        <div class="hero-left">
          <MdiIcon class="hero-icon" :path="mdiHeartOutline" size="36px" />
          <div>
            <h1 class="hero-title">我的点赞</h1>
            <p class="hero-sub">{{ userStore.isLoggedIn && !loading ? `共 ${total} 首` : '记录每一个喜欢' }}</p>
          </div>
        </div>
      </div>

      <!-- 未登录 -->
      <div v-if="!userStore.isLoggedIn" class="state-card">
        <MdiIcon class="state-icon" :path="mdiHeartOutline" size="48px" />
        <p>登录后才能查看点赞记录</p>
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

      <!-- 空状态 -->
      <div v-else-if="items.length === 0" class="state-card">
        <MdiIcon class="state-icon" :path="mdiHeartOutline" size="48px" />
        <p>还没有点赞记录，去听点音乐吧</p>
        <button class="login-prompt-btn" @click="router.push('/')">去发现音乐</button>
      </div>

      <!-- 点赞列表 -->
      <div v-else class="list-wrap">
        <div
          v-for="item in items"
          :key="item.song_data.id"
          class="uv-card"
        >
          <div class="uv-cover-wrap">
            <img
              :src="item.song_data.cover_url"
              :alt="item.song_data.title"
              class="uv-cover"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            />
            <div class="uv-cover-fallback">♪</div>
          </div>

          <div class="uv-info">
            <strong class="uv-title">{{ item.song_data.title }}</strong>
            <span class="uv-artist">{{ item.song_data.uploader_name }}</span>
          </div>

          <span class="uv-time">{{ formatLikedTime(item.liked_time) }}</span>

          <div class="uv-actions">
            <button class="uv-btn uv-play" title="播放" @click="handlePlay(item, $event)">
              <MdiIcon :path="mdiPlay" size="17px" />
            </button>
            <button class="uv-btn uv-detail" title="查看详情" @click="router.push('/song/' + item.song_data.id)">
              <MdiIcon :path="mdiInformationOutline" size="17px" />
            </button>
            <button class="uv-btn uv-unlike" title="取消点赞" @click="handleUnlike(item, $event)">
              <MdiIcon :path="mdiHeartOutline" size="17px" />
            </button>
          </div>
        </div>

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
.upvote-view {
  min-height: calc(100vh - var(--hw-header-height));
  background: var(--hw-bg-primary);
  padding: 0 16px 80px;
}

.upvote-shell {
  max-width: 860px;
  margin: 0 auto;
}

/* 头部 */
.upvote-hero {
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

/* 列表 */
.list-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 状态卡片 */
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

/* 骨架屏 - 与历史记录完全一致 */
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

/* 点赞卡片 - 与历史记录卡片样式完全一致 */
.uv-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  border-radius: 16px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.uv-card:hover {
  background: color-mix(in srgb, var(--theme-color) 6%, var(--hw-bg-secondary));
  border-color: color-mix(in srgb, var(--theme-color) 22%, var(--hw-border));
}

.uv-cover-wrap {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background: color-mix(in srgb, var(--theme-color) 18%, var(--hw-bg-primary));
}

.uv-cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  z-index: 1;
}

.uv-cover-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--theme-color);
  z-index: 0;
}

.uv-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.uv-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--hw-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.uv-artist {
  font-size: 12px;
  color: var(--hw-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.uv-time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--hw-text-tertiary);
  white-space: nowrap;
}

.uv-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.uv-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--hw-text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  transition: background 0.15s ease, color 0.15s ease;
}

.uv-play:hover {
  background: var(--theme-color);
  color: #fff;
}

.uv-detail:hover {
  background: var(--hw-bg-hover);
  color: var(--hw-text-primary);
}

.uv-unlike:hover {
  background: color-mix(in srgb, #ef4444 15%, transparent);
  color: #ef4444;
}

@media (max-width: 480px) {
  .uv-time { display: none; }
}

/* 加载更多 */
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
