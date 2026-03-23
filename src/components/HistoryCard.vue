<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { CaretRight, Delete, InfoFilled } from '@element-plus/icons-vue'
import type { PlayHistoryItem } from '@/api/history'
import { usePlayerStore } from '@/stores/player'

const props = defineProps<{ item: PlayHistoryItem }>()
const emit = defineEmits<{ (e: 'delete', id: number): void }>()

const router = useRouter()
const playerStore = usePlayerStore()

function formatTime(dateStr: string) {
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

const timeLabel = computed(() => formatTime(props.item.play_time))

async function handlePlay() {
  const localTarget = playerStore.availableTargets.find((t) => t.type === 'local')
  if (!localTarget) return
  await playerStore.addSongToTargetAndPlay(props.item.song_info.id, localTarget)
}

function goDetail() {
  router.push(`/song/${props.item.song_info.id}`)
}
</script>

<template>
  <div class="history-card">
    <div class="hc-cover-wrap">
      <img
        :src="item.song_info.cover_url"
        :alt="item.song_info.title"
        class="hc-cover"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      >
      <div class="hc-cover-fallback">♪</div>
    </div>

    <div class="hc-info">
      <strong class="hc-title">{{ item.song_info.title }}</strong>
      <span class="hc-artist">{{ item.song_info.uploader_name }}</span>
    </div>

    <span class="hc-time">{{ timeLabel }}</span>

    <div class="hc-actions">
      <button class="hc-btn hc-play" title="播放" @click="handlePlay">
        <el-icon><CaretRight /></el-icon>
      </button>
      <button class="hc-btn hc-detail" title="查看详情" @click="goDetail">
        <el-icon><InfoFilled /></el-icon>
      </button>
      <button class="hc-btn hc-delete" title="删除记录" @click="emit('delete', item.id)">
        <el-icon><Delete /></el-icon>
      </button>
    </div>
  </div>
</template>

<style scoped>
.history-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  border-radius: 16px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.history-card:hover {
  background: color-mix(in srgb, var(--theme-color) 6%, var(--hw-bg-secondary));
  border-color: color-mix(in srgb, var(--theme-color) 22%, var(--hw-border));
}

.hc-cover-wrap {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background: color-mix(in srgb, var(--theme-color) 18%, var(--hw-bg-primary));
}

.hc-cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  z-index: 1;
}

.hc-cover-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--theme-color);
  z-index: 0;
}

.hc-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.hc-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--hw-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hc-artist {
  font-size: 12px;
  color: var(--hw-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hc-time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--hw-text-tertiary);
  white-space: nowrap;
}

.hc-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.hc-btn {
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

.hc-play:hover {
  background: var(--theme-color);
  color: #fff;
}

.hc-detail:hover {
  background: var(--hw-bg-hover);
  color: var(--hw-text-primary);
}

.hc-delete:hover {
  background: color-mix(in srgb, #ef4444 15%, transparent);
  color: #ef4444;
}

@media (max-width: 480px) {
  .hc-time { display: none; }
}
</style>
