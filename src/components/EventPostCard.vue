<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { PostItem } from '@/api/post'
import { formatRelativeTime } from '@/utils/relativeTime'

const props = defineProps<{
  post: PostItem
  /** 大屏首条横排大卡 */
  featured?: boolean
}>()

const router = useRouter()
const timeLabel = computed(() => formatRelativeTime(props.post.create_time))

function open() {
  router.push(`/square/event/${props.post.id}`)
}

function openUser(e: Event) {
  e.stopPropagation()
  router.push(`/user/${props.post.author.uid}`)
}
</script>

<template>
  <article class="event-card" :class="{ featured }" @click="open">
    <div class="cover">
      <img v-if="post.cover_url" :src="post.cover_url" :alt="post.title">
    </div>
    <div class="body">
      <button type="button" class="author" @click="openUser">
        <div class="avatar">
          <img v-if="post.author.avatar_url" :src="post.author.avatar_url" :alt="post.author.username">
          <span v-else>{{ post.author.username?.[0] || '?' }}</span>
        </div>
        <span class="username">{{ post.author.username }}</span>
      </button>
      <h3 class="title">{{ post.title }}</h3>
      <p class="time">{{ timeLabel }}</p>
    </div>
  </article>
</template>

<style scoped>
.event-card {
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}

.event-card:hover {
  border-color: color-mix(in srgb, var(--theme-color) 35%, var(--hw-border));
}

.event-card.featured {
  flex-direction: row;
  align-items: stretch;
  gap: 0;
}

.cover {
  aspect-ratio: 16 / 9;
  background: color-mix(in srgb, var(--hw-text-primary) 8%, transparent);
  overflow: hidden;
}

.featured .cover {
  width: min(58%, 560px);
  flex-shrink: 0;
  aspect-ratio: 16 / 9;
  align-self: stretch;
  min-height: 200px;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  min-width: 0;
  flex: 1;
}

.featured .body {
  justify-content: center;
  gap: 12px;
  padding: 20px 24px;
}

.author {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: inherit;
  width: fit-content;
  max-width: 100%;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--hw-text-primary) 8%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.username {
  font-size: 13px;
  font-weight: 600;
  color: var(--hw-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--hw-text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.8em;
}

.featured .title {
  font-size: 22px;
  font-weight: 800;
  -webkit-line-clamp: 3;
  min-height: 0;
}

.time {
  margin: 0;
  font-size: 13px;
  color: var(--hw-text-tertiary);
}

@media (max-width: 720px) {
  .event-card.featured {
    flex-direction: column;
  }

  .featured .cover {
    width: 100%;
    min-height: 0;
  }

  .featured .title {
    font-size: 18px;
  }
}
</style>
