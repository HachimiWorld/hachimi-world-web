<script setup lang="ts">
import type { Song, SearchSongItem } from '@/api/song'

// 兼容 Song 和 SearchSongItem 两种类型
const props = defineProps<{
  song: Song | SearchSongItem
}>()

// 统一取字段（两种类型字段名不同）
function getCoverUrl(): string {
  const s = props.song as any
  return s.cover_url || s.cover_art_url || ''
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}
</script>

<template>
  <div class="song-card">
    <div class="card-cover">
      <img
        v-if="getCoverUrl()"
        :src="getCoverUrl()"
        :alt="song.title"
        class="cover-img"
        loading="lazy"
      />
      <div v-else class="cover-placeholder">
        <el-icon><Headset /></el-icon>
      </div>
      <div class="cover-overlay">
        <div class="play-btn">
          <el-icon><VideoPlay /></el-icon>
        </div>
      </div>
      <div class="duration-badge">{{ formatDuration(song.duration_seconds) }}</div>
      <div v-if="song.explicit" class="explicit-badge">E</div>
    </div>
    <div class="card-info">
      <p class="card-title" :title="song.title">{{ song.title }}</p>
      <p class="card-uploader">{{ song.uploader_name }}</p>
      <div class="card-meta">
        <span class="meta-item">
          <el-icon><VideoPlay /></el-icon>
          {{ formatCount(song.play_count) }}
        </span>
        <span class="meta-item">
          <el-icon><Star /></el-icon>
          {{ formatCount(song.like_count) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.song-card {
  display: flex;
  flex-direction: column;
  background: var(--hw-bg-secondary);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.18s;
  min-width: 0;
}

.song-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

:root.dark .song-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

/* 封面 */
.card-cover {
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  background: var(--hw-bg-hover);
  overflow: hidden;
}

.cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.song-card:hover .cover-img {
  transform: scale(1.04);
}

.cover-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hw-text-tertiary);
  font-size: 2rem;
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.18s;
}

.song-card:hover .cover-overlay {
  opacity: 1;
}

.play-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--theme-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.25);
  transform: scale(0.85);
  transition: transform 0.15s;
}

.song-card:hover .play-btn {
  transform: scale(1);
}

.duration-badge {
  position: absolute;
  bottom: 6px;
  right: 7px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.3px;
}

.explicit-badge {
  position: absolute;
  top: 6px;
  left: 7px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.5px;
}

/* 信息区 */
.card-info {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--hw-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.card-uploader {
  font-size: 12px;
  color: var(--hw-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta {
  display: flex;
  gap: 10px;
  margin-top: 3px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--hw-text-tertiary);
}

.meta-item .el-icon {
  font-size: 12px;
}
</style>

