<script setup lang="ts">
import { computed } from 'vue'
import SongCard from './SongCard.vue'
import type { Song, SearchSongItem } from '@/api/song'

const props = defineProps<{
  title: string
  songs: (Song | SearchSongItem)[]
  loading: boolean
  hasMore?: boolean
  loadingMore?: boolean
  moreRoute?: string   // 点击「更多」跳转的路由，可选
}>()

const emit = defineEmits<{
  (e: 'load-more'): void
}>()

// 骨架屏占位数量
const SKELETON_COUNT = 8

const displaySongs = computed(() => props.songs.slice(0, 16))
</script>

<template>
  <section class="song-section">
    <div class="section-header">
      <h2 class="section-title">{{ title }}</h2>
      <RouterLink v-if="moreRoute" :to="moreRoute" class="section-more">
        查看全部
        <el-icon><ArrowRight /></el-icon>
      </RouterLink>
    </div>

    <!-- 骨架屏 -->
    <div v-if="loading" class="song-grid">
      <div
        v-for="i in SKELETON_COUNT"
        :key="i"
        class="skeleton-card"
      >
        <el-skeleton animated>
          <template #template>
            <el-skeleton-item variant="image" class="skel-cover" />
            <div class="skel-info">
              <el-skeleton-item variant="p" style="width: 80%" />
              <el-skeleton-item variant="p" style="width: 55%; margin-top: 6px" />
            </div>
          </template>
        </el-skeleton>
      </div>
    </div>

    <!-- 实际内容 -->
    <div v-else class="song-grid">
      <SongCard
        v-for="song in displaySongs"
        :key="song.id"
        :song="song"
      />
    </div>

    <!-- 加载更多 -->
    <div v-if="!loading && hasMore" class="load-more-row">
      <el-button
        class="load-more-btn"
        :loading="loadingMore"
        @click="emit('load-more')"
      >
        加载更多
      </el-button>
    </div>
  </section>
</template>

<style scoped>
.song-section {
  margin-bottom: 40px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--hw-text-primary);
  letter-spacing: -0.3px;
  position: relative;
  padding-left: 12px;
}

.section-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 18px;
  background: var(--theme-color);
  border-radius: 2px;
}

.section-more {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  color: var(--hw-text-secondary);
  text-decoration: none;
  transition: color 0.15s;
}

.section-more:hover {
  color: var(--theme-color);
}

.song-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 12px;
}

/* 骨架屏卡片 */
.skeleton-card {
  background: var(--hw-bg-secondary);
  border-radius: 10px;
  overflow: hidden;
}

.skel-cover {
  width: 100%;
  padding-bottom: 100%;
  border-radius: 0;
  display: block;
  height: 0;
  /* override el-skeleton-item */
}

:deep(.el-skeleton__image) {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 0;
}

.skel-info {
  padding: 8px 10px 10px;
}

/* 加载更多 */
.load-more-row {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.load-more-btn {
  padding: 8px 32px;
  border-radius: 20px;
  border-color: var(--hw-border);
  color: var(--hw-text-secondary);
  background: transparent;
  font-size: 13px;
  transition: border-color 0.15s, color 0.15s;
}

.load-more-btn:hover {
  border-color: var(--theme-color);
  color: var(--theme-color);
}

/* 响应式断点 */
@media (max-width: 1400px) {
  .song-grid {
    grid-template-columns: repeat(7, 1fr);
  }
}

@media (max-width: 1200px) {
  .song-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}

@media (max-width: 960px) {
  .song-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

@media (max-width: 768px) {
  .song-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
}

@media (max-width: 520px) {
  .song-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 7px;
  }
}

@media (max-width: 360px) {
  .song-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

