<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { Song, SearchSongItem } from '@/api/song'

const props = defineProps<{
  song: Song | SearchSongItem
}>()

const router = useRouter()

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

function handleClick() {
  router.push(`/song/${props.song.id}`)
}
</script>

<template>
  <div class="song-card" @click="handleClick">
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
      <div class="duration-badge">{{ formatDuration(song.duration_seconds) }}</div>
      <div v-if="song.explicit" class="explicit-badge">E</div>
    </div>
    <div class="card-info">
      <p class="card-title" :title="song.title">{{ song.title }}</p>
      <p class="card-uploader">{{ song.uploader_name }}</p>
      <div class="card-meta">
        <span class="meta-item">
          <el-icon><Headset /></el-icon>
          {{ formatCount(song.play_count) }}
        </span>
        <span class="meta-item like-item">
          <!-- 正三角形，用 CSS border trick -->
          <span class="triangle-icon"></span>
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
  transition: background 0.18s;
  min-width: 0;
  flex-shrink: 0;
  padding: 6px;
  gap: 0;
}

.song-card:hover {
  background: var(--hw-bg-hover);
}

/* 封面 - 强制 1:1 正方形，内缩有圆角 */
.card-cover {
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  background: var(--hw-bg-tertiary, var(--hw-bg-hover));
  overflow: hidden;
  flex-shrink: 0;
  border-radius: 7px;
}

.cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  border-radius: 7px;
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
  pointer-events: none;
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
  pointer-events: none;
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
  align-items: center;
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

/* 正三角点赞图标 */
.triangle-icon {
  display: inline-block;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 9px solid currentColor;
  flex-shrink: 0;
}
</style>
