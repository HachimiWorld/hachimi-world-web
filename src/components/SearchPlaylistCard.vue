<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { PlaylistSearchItem } from '@/api/search'

const props = defineProps<{
  item: PlaylistSearchItem
}>()

const router = useRouter()

const coverUrl = computed(() => props.item.cover_url || '')

function openPlaylist() {
  router.push(`/playlist/${props.item.id}`)
}

function openCreator(e: MouseEvent) {
  e.stopPropagation()
  router.push(`/user/${props.item.user_id}`)
}
</script>

<template>
  <article class="search-playlist-card" @click="openPlaylist">
    <div class="playlist-cover-wrap">
      <img v-if="coverUrl" :src="coverUrl" :alt="item.name" class="playlist-cover" loading="lazy">
      <div v-else class="playlist-cover placeholder">♫</div>
    </div>

    <div class="playlist-main">
      <div class="playlist-topline">
        <h3 class="playlist-title">{{ item.name }}</h3>
        <span class="playlist-count">{{ item.songs_count }} 首</span>
      </div>
      <p class="playlist-creator">
        by
        <button class="creator-link" @click="openCreator">{{ item.user_name }}</button>
      </p>
      <p class="playlist-desc">{{ item.description || '这个歌单还没有填写简介。' }}</p>
    </div>
  </article>
</template>

<style scoped>
.search-playlist-card {
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

.search-playlist-card:hover {
  background: var(--hw-bg-hover);
  border-color: color-mix(in srgb, var(--theme-color) 30%, var(--hw-border));
}

.playlist-cover-wrap {
  width: 88px;
  flex-shrink: 0;
}

.playlist-cover {
  width: 88px;
  height: 88px;
  object-fit: cover;
  border-radius: 12px;
  display: block;
}

.playlist-cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hw-bg-primary);
  color: var(--hw-text-tertiary);
  font-size: 28px;
}

.playlist-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.playlist-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.playlist-title {
  min-width: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--hw-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.playlist-creator {
  margin-top: 5px;
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.creator-link {
  border: none;
  background: transparent;
  color: var(--theme-color);
  cursor: pointer;
  padding: 0;
}

.playlist-desc {
  margin-top: 8px;
  font-size: 13px;
  color: var(--hw-text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

