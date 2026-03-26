<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { mdiDeleteOutline, mdiHeadphones, mdiHeartOutline, mdiClockOutline } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import type { Song } from '@/api/song'

const props = defineProps<{ song: Song }>()
const router = useRouter()

const coverUrl = computed(() => props.song.cover_url || '')

const subtitleText = computed(() => {
  const first = props.song.origin_infos?.[0]
  if (first) {
    const parts = [props.song.uploader_name]
    if (first.title) parts.push(`原曲 ${first.title}`)
    return parts.join(' · ')
  }
  return props.song.uploader_name
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

function openSong(e: MouseEvent) {
  // 避免点删除按钮时跳转
  router.push(`/song/${props.song.id}`)
}

function onDelete(e: MouseEvent) {
  e.stopPropagation()
  ElMessage.info('功能暂未实现')
}
</script>

<template>
  <article class="manage-song-card" @click="openSong">
    <div class="song-cover-wrap">
      <img v-if="coverUrl" :src="coverUrl" :alt="song.title" class="song-cover" loading="lazy" />
      <div v-else class="song-cover placeholder">♪</div>
    </div>

    <div class="song-main">
      <div class="song-topline">
        <h3 class="song-title">{{ song.title }}</h3>
        <button class="delete-btn" title="删除" @click.stop="onDelete">
          <MdiIcon :path="mdiDeleteOutline" size="16px" />
        </button>
      </div>
      <p class="song-subtitle">{{ subtitleText }}</p>
      <p v-if="song.description" class="song-desc">{{ song.description }}</p>
      <div class="song-meta">
        <span class="meta-item">
          <MdiIcon :path="mdiClockOutline" size="12px" />
          {{ formatDuration(song.duration_seconds) }}
        </span>
        <span class="meta-item">
          <MdiIcon :path="mdiHeadphones" size="12px" />
          {{ formatCount(song.play_count) }}
        </span>
        <span class="meta-item like-item">
          <MdiIcon :path="mdiHeartOutline" size="12px" />
          {{ formatCount(song.like_count) }}
        </span>
        <span v-if="song.display_id" class="meta-item jmid">{{ song.display_id }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.manage-song-card {
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

.manage-song-card:hover {
  background: var(--hw-bg-hover);
  border-color: color-mix(in srgb, var(--theme-color) 30%, var(--hw-border));
}

.song-cover-wrap {
  width: 80px;
  flex-shrink: 0;
}

.song-cover {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 10px;
  display: block;
}

.song-cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hw-bg-primary);
  color: var(--hw-text-tertiary);
  font-size: 26px;
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.song-title {
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--hw-text-primary);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.delete-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: 1px solid var(--hw-border);
  border-radius: 6px;
  background: transparent;
  color: var(--hw-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.15s;
}

.delete-btn:hover {
  border-color: #e85c5c;
  color: #e85c5c;
  background: color-mix(in srgb, #e85c5c 8%, transparent);
}

.song-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--hw-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-desc {
  margin-top: 6px;
  font-size: 11px;
  color: var(--hw-text-tertiary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.song-meta {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 11px;
  color: var(--hw-text-tertiary);
  align-items: center;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.meta-item :deep(.el-icon) {
  font-size: 12px;
}

.triangle-icon {
  display: inline-block;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 7px solid currentColor;
  flex-shrink: 0;
}

.jmid {
  font-family: monospace;
  color: var(--theme-color);
  font-size: 10px;
  background: color-mix(in srgb, var(--theme-color) 10%, transparent);
  padding: 1px 6px;
  border-radius: 4px;
}
</style>

