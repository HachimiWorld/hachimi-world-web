<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import SongCard from '@/components/SongCard.vue'
import { getSongsByTag } from '@/api/song'
import type { SearchSongItem } from '@/api/song'
import { ApiError } from '@/api/request'

const route = useRoute()

const tagName = ref(decodeURIComponent(route.params.name as string))
const songs = ref<SearchSongItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(true)
const offset = ref(0)
const PAGE_SIZE = 24

async function loadSongs(reset = false) {
  if (reset) {
    songs.value = []
    offset.value = 0
    hasMore.value = true
  }
  if (!hasMore.value) return
  if (reset) loading.value = true
  else loadingMore.value = true

  try {
    const resp = await getSongsByTag({
      tagName: tagName.value,
      limit: PAGE_SIZE,
      offset: offset.value,
    })
    songs.value = reset ? resp.hits : [...songs.value, ...resp.hits]
    offset.value += resp.hits.length
    hasMore.value = resp.hits.length === PAGE_SIZE
  } catch (e) {
    console.error('加载标签歌曲失败', e instanceof ApiError ? e.msg : e)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// 滚动到底部自动加载
let scrollTimer: ReturnType<typeof setTimeout> | null = null
function onScroll() {
  if (scrollTimer) return
  scrollTimer = setTimeout(() => {
    scrollTimer = null
    const scrolled = window.scrollY + window.innerHeight
    const total = document.documentElement.scrollHeight
    if (total - scrolled < 400 && hasMore.value && !loadingMore.value) {
      loadSongs()
    }
  }, 150)
}

watch(
  () => route.params.name,
  (val) => {
    tagName.value = decodeURIComponent(val as string)
    loadSongs(true)
  }
)

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
  <div class="tag-view">
    <!-- 头部 -->
    <div class="tag-header">
      <RouterLink to="/" class="back-btn">
        <el-icon><ArrowLeft /></el-icon>
        <span>返回</span>
      </RouterLink>
      <div class="tag-title-wrap">
        <span class="tag-badge">#</span>
        <h1 class="tag-title">{{ tagName }}</h1>
      </div>
    </div>

    <!-- 骨架屏 -->
    <div v-if="loading" class="songs-grid">
      <div v-for="i in PAGE_SIZE" :key="i" class="skeleton-card">
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

    <!-- 歌曲网格 -->
    <div v-else class="songs-grid">
      <SongCard
        v-for="song in songs"
        :key="song.id"
        :song="song"
      />
    </div>

    <!-- 加载更多指示 -->
    <div v-if="loadingMore" class="loading-more">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中…</span>
    </div>

    <!-- 没有更多 -->
    <div v-if="!loading && !loadingMore && !hasMore && songs.length > 0" class="no-more">
      已加载全部 {{ songs.length }} 首歌曲
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && songs.length === 0" class="empty-state">
      <p>该标签下暂无歌曲</p>
    </div>
  </div>
</template>

<style scoped>
.tag-view {
  padding-top: 8px;
  padding-bottom: 60px;
}

.tag-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 28px;
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

.tag-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.tag-badge {
  font-size: 28px;
  font-weight: 800;
  color: var(--theme-color);
  line-height: 1;
}

.tag-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--hw-text-primary);
  letter-spacing: -0.5px;
  line-height: 1;
}

/* 歌曲网格：PC 6列，响应式缩减 */
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

/* 骨架屏卡片 */
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

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0;
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
  padding: 60px 0;
}
</style>

