<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import SongCard from '@/components/SongCard.vue'
import { getRecentSongs } from '@/api/song'
import type { Song } from '@/api/song'
import { ApiError } from '@/api/request'

const LIMIT = 50

const allSongs = ref<Song[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(true)
// 游标：最后一条的 create_time，下次传 cursor=此值&after=false 获取更早的
const cursor = ref<string | undefined>(undefined)

async function loadSongs(reset = false) {
  if (reset) {
    allSongs.value = []
    cursor.value = undefined
    hasMore.value = true
  }
  if (!hasMore.value) return
  if (reset) loading.value = true
  else loadingMore.value = true

  try {
    const resp = await getRecentSongs({
      cursor: cursor.value,
      limit: LIMIT,
      after: false,
    })
    const newSongs = resp.songs
    allSongs.value = reset ? newSongs : [...allSongs.value, ...newSongs]
    if (newSongs.length > 0) {
      cursor.value = newSongs[newSongs.length - 1].create_time
    }
    hasMore.value = newSongs.length === LIMIT
  } catch (e) {
    console.error('加载最新歌曲失败', e instanceof ApiError ? e.msg : e)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// ── 按天分组 ──
interface DayGroup {
  dateLabel: string
  dateKey: string
  songs: Song[]
}

const dayGroups = computed<DayGroup[]>(() => {
  const map = new Map<string, DayGroup>()
  for (const song of allSongs.value) {
    const d = new Date(song.create_time)
    const key = toDateKey(d)
    if (!map.has(key)) {
      map.set(key, { dateKey: key, dateLabel: formatDate(d), songs: [] })
    }
    map.get(key)!.songs.push(song)
  }
  return Array.from(map.values())
})

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(d: Date): string {
  const now = new Date()
  const today = toDateKey(now)
  const yesterday = toDateKey(new Date(now.getTime() - 86400000))
  const key = toDateKey(d)
  if (key === today) return '今天'
  if (key === yesterday) return '昨天'
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// ── 滚动加载 ──
let scrollTimer: ReturnType<typeof setTimeout> | null = null
function onScroll() {
  if (scrollTimer) return
  scrollTimer = setTimeout(() => {
    scrollTimer = null
    const scrolled = window.scrollY + window.innerHeight
    const total = document.documentElement.scrollHeight
    if (total - scrolled < 500 && hasMore.value && !loadingMore.value && !loading.value) {
      loadSongs()
    }
  }, 150)
}

onMounted(() => {
  loadSongs(true)
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  if (scrollTimer) clearTimeout(scrollTimer)
})
</script>

<template>
  <div class="recent-view">
    <!-- 头部 -->
    <div class="page-header">
      <RouterLink to="/" class="back-btn">
        <el-icon><ArrowLeft /></el-icon>
        <span>返回</span>
      </RouterLink>
      <div class="page-title-wrap">
        <h1 class="page-title">最近发布</h1>
      </div>
    </div>

    <!-- 初始加载骨架 -->
    <template v-if="loading">
      <div class="day-group">
        <div class="day-label">
          <el-skeleton animated>
            <template #template>
              <el-skeleton-item variant="text" style="width: 80px; height: 18px" />
            </template>
          </el-skeleton>
        </div>
        <div class="songs-grid">
          <div v-for="i in 12" :key="i" class="skeleton-card">
            <div class="skel-cover-wrap">
              <el-skeleton animated>
                <template #template>
                  <el-skeleton-item variant="image" class="skel-cover" />
                </template>
              </el-skeleton>
            </div>
            <div class="skel-info">
              <el-skeleton animated>
                <template #template>
                  <el-skeleton-item variant="p" style="width: 85%" />
                  <el-skeleton-item variant="p" style="width: 55%; margin-top: 5px" />
                  <el-skeleton-item variant="text" style="width: 70%; margin-top: 7px" />
                </template>
              </el-skeleton>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 按天分组内容 -->
    <template v-else>
      <div
        v-for="group in dayGroups"
        :key="group.dateKey"
        class="day-group"
      >
        <div class="day-label">
          <span class="day-text">{{ group.dateLabel }}</span>
          <span class="day-count">{{ group.songs.length }} 首</span>
        </div>
        <div class="songs-grid">
          <SongCard
            v-for="song in group.songs"
            :key="song.id"
            :song="song"
          />
        </div>
      </div>
    </template>

    <!-- 加载更多 -->
    <div v-if="loadingMore" class="loading-more">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载更多…</span>
    </div>

    <!-- 全部加载完毕 -->
    <div v-if="!loading && !loadingMore && !hasMore && allSongs.length > 0" class="no-more">
      已加载全部 {{ allSongs.length }} 首歌曲
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && allSongs.length === 0" class="empty-state">
      <p>暂无音乐</p>
    </div>
  </div>
</template>

<style scoped>
.recent-view {
  padding-top: 8px;
  padding-bottom: 80px;
}

/* 头部 */
.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: var(--hw-text-secondary);
  text-decoration: none;
  transition: color 0.15s;
  flex-shrink: 0;
}

.back-btn:hover {
  color: var(--theme-color);
}

.page-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--hw-text-primary);
  letter-spacing: -0.5px;
  line-height: 1;
}

.page-subtitle {
  font-size: 13px;
  color: var(--hw-text-tertiary);
}

/* 每天分组 */
.day-group {
  margin-bottom: 36px;
}

.day-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding-left: 2px;
}

.day-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--hw-text-primary);
  position: relative;
  padding-left: 12px;
}

.day-text::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 16px;
  background: var(--theme-color);
  border-radius: 2px;
}

.day-count {
  font-size: 12px;
  color: var(--hw-text-tertiary);
  background: var(--hw-bg-secondary);
  padding: 2px 8px;
  border-radius: 10px;
}

/* 歌曲网格 */
.songs-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
}

@media (max-width: 1200px) {
  .songs-grid { grid-template-columns: repeat(5, 1fr); }
}

@media (max-width: 900px) {
  .songs-grid { grid-template-columns: repeat(4, 1fr); }
}

@media (max-width: 640px) {
  .songs-grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
}

@media (max-width: 420px) {
  .songs-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
}

/* 骨架屏 */
.skeleton-card {
  background: var(--hw-bg-secondary);
  border-radius: 10px;
  overflow: hidden;
  padding: 6px;
  display: flex;
  flex-direction: column;
}

.skel-cover-wrap {
  width: 100%;
  border-radius: 7px;
  overflow: hidden;
}

:deep(.skel-cover-wrap .el-skeleton__image) {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 7px;
}

.skel-info {
  padding: 8px 10px 10px;
}

/* 加载更多 */
.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 0;
  color: var(--hw-text-secondary);
  font-size: 14px;
}

.no-more {
  text-align: center;
  color: var(--hw-text-tertiary);
  font-size: 13px;
  padding: 24px 0 8px;
}

.empty-state {
  text-align: center;
  color: var(--hw-text-secondary);
  font-size: 15px;
  padding: 80px 0;
}
</style>
