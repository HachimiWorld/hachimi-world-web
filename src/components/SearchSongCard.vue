<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { mdiHeadphones, mdiHeartOutline, mdiClockOutline } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import type { SearchSongItem } from '@/api/song'

const props = defineProps<{
  item: SearchSongItem
}>()

const router = useRouter()

const coverUrl = computed(() => props.item.cover_art_url || '')
const subtitleText = computed(() => {
  return props.item.original_titles?.length
    ? `${props.item.artist} · 原曲 ${props.item.original_titles[0]}`
    : props.item.artist
})

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatCount(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function openSong() {
  router.push(`/song/${props.item.id}`)
}

function openUser(e: MouseEvent) {
  e.stopPropagation()
  router.push(`/user/${props.item.uploader_uid}`)
}
</script>

<template>
  <article class="search-song-card" @click="openSong">
    <div class="song-cover-wrap">
      <img v-if="coverUrl" :src="coverUrl" :alt="item.title" class="song-cover" loading="lazy">
      <div v-else class="song-cover placeholder">♪</div>
    </div>

    <div class="song-main">
      <div class="song-topline">
        <h3 class="song-title">{{ item.title }}</h3>
      </div>
      <p class="song-subtitle">{{ subtitleText }}</p>
      <p v-if="item.description" class="song-desc">{{ item.description }}</p>
      <div class="song-meta">
        <button class="meta-link" @click="openUser">{{ item.uploader_name }}</button>
        <span class="meta-item">
          <MdiIcon :path="mdiClockOutline" size="13px" />
          {{ formatDuration(item.duration_seconds) }}
        </span>
        <span class="meta-item">
          <MdiIcon :path="mdiHeadphones" size="13px" />
          {{ formatCount(item.play_count) }}
        </span>
        <span class="meta-item like-item">
          <MdiIcon :path="mdiHeartOutline" size="13px" />
          {{ formatCount(item.like_count) }}
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.search-song-card {
  display: flex;
  gap: 14px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--hw-border);
  border-radius: 16px;
  background: var(--hw-bg-secondary);
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.search-song-card:hover {
  background: var(--hw-bg-hover);
  border-color: color-mix(in srgb, var(--theme-color) 30%, var(--hw-border));
}

.song-cover-wrap {
  width: 88px;
  flex-shrink: 0;
}

.song-cover {
  width: 88px;
  height: 88px;
  object-fit: cover;
  border-radius: 12px;
  display: block;
}

.song-cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hw-bg-primary);
  color: var(--hw-text-tertiary);
  font-size: 28px;
}

.song-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.song-topline {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
}

.song-title {
  min-width: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--hw-text-primary);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: var(--hw-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-desc {
  margin-top: 8px;
  font-size: 12px;
  color: var(--hw-text-tertiary);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.song-meta {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 12px;
  color: var(--hw-text-tertiary);
  align-items: center;
}

.meta-link {
  border: none;
  background: transparent;
  color: var(--theme-color);
  cursor: pointer;
  padding: 0;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.meta-item :deep(.el-icon) {
  font-size: 13px;
}

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

