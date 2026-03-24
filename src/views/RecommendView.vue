<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import SongCard from '@/components/SongCard.vue'
import { getRecommendSongs } from '@/api/song'
import type { Song } from '@/api/song'
import { ApiError } from '@/api/request'

const router = useRouter()

// 推荐接口一次性返回全量，无需分页
const songs = ref<Song[]>([])
const loading = ref(false)

async function loadSongs() {
  loading.value = true
  try {
    const resp = await getRecommendSongs()
    songs.value = resp.songs
  } catch (e) {
    console.error('加载推荐歌曲失败', e instanceof ApiError ? e.msg : e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSongs()
})
</script>

<template>
  <div class="recommend-view">
    <!-- 头部 -->
    <div class="page-header">
      <button class="back-btn" @click="router.back()">
        <el-icon><ArrowLeft /></el-icon>
        <span>返回</span>
      </button>
      <div class="page-title-wrap">
        <h1 class="page-title">每日推荐</h1>
        <span class="page-subtitle">并非根据你的口味进行推荐</span>
      </div>
    </div>

    <!-- 骨架屏 -->
    <div v-if="loading" class="songs-grid">
      <div v-for="i in 24" :key="i" class="skeleton-card">
        <div class="skel-cover-wrap">
          <div class="skel-cover"></div>
        </div>
        <div class="skel-info">
          <div class="skel-line skel-line-title"></div>
          <div class="skel-line skel-line-sub"></div>
          <div class="skel-line skel-line-meta"></div>
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

    <!-- 空状态 -->
    <div v-if="!loading && songs.length === 0" class="empty-state">
      <p>暂无推荐歌曲</p>
    </div>
  </div>
</template>

<style scoped>
.recommend-view {
  padding-top: 8px;
  padding-bottom: 80px;
}

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
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
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

.skel-cover,
.skel-line {
  background: linear-gradient(
    90deg,
    var(--hw-bg-secondary) 25%,
    var(--hw-bg-hover) 50%,
    var(--hw-bg-secondary) 75%
  );
  background-size: 400% 100%;
  animation: el-skeleton-loading 1.4s ease infinite;
}

.skel-cover {
  width: 100%;
  aspect-ratio: 1;
  display: block;
  border-radius: 7px;
}

.skel-info {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.skel-line {
  height: 12px;
  border-radius: 999px;
}

.skel-line-title {
  width: 85%;
  height: 13px;
}

.skel-line-sub {
  width: 55%;
}

.skel-line-meta {
  width: 70%;
  margin-top: 1px;
}

.empty-state {
  text-align: center;
  color: var(--hw-text-secondary);
  font-size: 15px;
  padding: 80px 0;
}
</style>

