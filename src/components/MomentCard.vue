<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { mdiCommentOutline, mdiMusicNote, mdiPlaylistMusic, mdiThumbUp, mdiThumbUpOutline } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import type { MomentAttachment, MomentItem } from '@/api/moment'
import { formatRelativeTime } from '@/utils/relativeTime'

const props = defineProps<{
  moment: MomentItem
  /** 列表页可截断正文；详情页完整展示 */
  compact?: boolean
}>()

const emit = defineEmits<{
  like: []
  unlike: []
  open: []
  'require-login': []
}>()

const router = useRouter()
const previewIndex = ref<number | null>(null)

const timeLabel = computed(() => formatRelativeTime(props.moment.create_time))

function openUser(e: Event) {
  e.stopPropagation()
  router.push(`/user/${props.moment.author.uid}`)
}

function onLike(e: Event) {
  e.stopPropagation()
  if (props.moment.liked) emit('unlike')
  else emit('like')
}

function onComment(e: Event) {
  e.stopPropagation()
  emit('open')
}

function songOf(att: MomentAttachment) {
  if (att.type !== 'song' || !att.data) return null
  const d = att.data as Record<string, unknown>
  if (typeof d.id !== 'number' && typeof d.id !== 'string') return null
  return {
    id: Number(d.id),
    title: String(d.title || '歌曲'),
    cover_url: typeof d.cover_url === 'string' ? d.cover_url : null,
    uploader_name: typeof d.uploader_name === 'string' ? d.uploader_name : '',
  }
}

function playlistOf(att: MomentAttachment) {
  if (att.type !== 'playlist' || !att.data) return null
  const d = att.data as Record<string, unknown>
  if (typeof d.id !== 'number' && typeof d.id !== 'string') return null
  return {
    id: Number(d.id),
    name: String(d.name || '歌单'),
    cover_url: typeof d.cover_url === 'string' ? d.cover_url : null,
    songs_count: typeof d.songs_count === 'number' ? d.songs_count : null,
  }
}

function openSong(id: number, e: Event) {
  e.stopPropagation()
  router.push(`/song/${id}`)
}

function openPlaylist(id: number, e: Event) {
  e.stopPropagation()
  router.push(`/playlist/${id}`)
}

function openPreview(i: number, e: Event) {
  e.stopPropagation()
  previewIndex.value = i
}

function closePreview() {
  previewIndex.value = null
}
</script>

<template>
  <article class="moment-card" :class="{ compact }" @click="emit('open')">
    <button type="button" class="author" @click="openUser">
      <div class="avatar">
        <img v-if="moment.author.avatar_url" :src="moment.author.avatar_url" :alt="moment.author.username">
        <span v-else>{{ moment.author.username?.[0] || '?' }}</span>
      </div>
      <div class="author-meta">
        <span class="name">{{ moment.author.username }}</span>
        <span class="time">{{ timeLabel }}</span>
      </div>
      <span v-if="moment.is_hidden" class="hidden-tag">仅自己可见</span>
    </button>

    <p v-if="moment.content" class="content" :class="{ clamp: compact }">{{ moment.content }}</p>

    <div
      v-if="moment.images.length"
      class="images"
      :class="`count-${Math.min(moment.images.length, 9)}`"
    >
      <button
        v-for="(img, i) in moment.images"
        :key="img.url"
        type="button"
        class="img-btn"
        @click="openPreview(i, $event)"
      >
        <img :src="img.thumb_url || img.url" alt="">
      </button>
    </div>

    <div v-for="(att, i) in moment.attachments" :key="i" class="attachment">
      <template v-if="songOf(att)">
        <button type="button" class="att-card" @click="openSong(songOf(att)!.id, $event)">
          <img v-if="songOf(att)!.cover_url" :src="songOf(att)!.cover_url!" alt="" class="att-cover">
          <div v-else class="att-cover fallback"><MdiIcon :path="mdiMusicNote" size="20px" /></div>
          <div class="att-meta">
            <span class="att-title">{{ songOf(att)!.title }}</span>
            <span class="att-sub">{{ songOf(att)!.uploader_name || '歌曲' }}</span>
          </div>
        </button>
      </template>
      <template v-else-if="playlistOf(att)">
        <button type="button" class="att-card" @click="openPlaylist(playlistOf(att)!.id, $event)">
          <img v-if="playlistOf(att)!.cover_url" :src="playlistOf(att)!.cover_url!" alt="" class="att-cover">
          <div v-else class="att-cover fallback"><MdiIcon :path="mdiPlaylistMusic" size="20px" /></div>
          <div class="att-meta">
            <span class="att-title">{{ playlistOf(att)!.name }}</span>
            <span class="att-sub">
              {{ playlistOf(att)!.songs_count != null ? `${playlistOf(att)!.songs_count} 首` : '歌单' }}
            </span>
          </div>
        </button>
      </template>
      <template v-else-if="!att.data">
        <div class="att-unavailable">附件不可用</div>
      </template>
      <template v-else>
        <div class="att-unavailable">请更新客户端查看此附件</div>
      </template>
    </div>

    <div class="actions">
      <button type="button" class="action-btn" :class="{ active: moment.liked }" @click="onLike">
        <MdiIcon :path="moment.liked ? mdiThumbUp : mdiThumbUpOutline" size="18px" />
        <span>{{ moment.like_count || '' }}</span>
      </button>
      <button type="button" class="action-btn" @click="onComment">
        <MdiIcon :path="mdiCommentOutline" size="18px" />
        <span>{{ moment.comment_count || '' }}</span>
      </button>
    </div>

    <Teleport to="body">
      <div v-if="previewIndex != null" class="lightbox" @click="closePreview">
        <img :src="moment.images[previewIndex].url" alt="" @click.stop>
      </div>
    </Teleport>
  </article>
</template>

<style scoped>
.moment-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border-radius: 16px;
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.moment-card:hover {
  border-color: color-mix(in srgb, var(--theme-color) 35%, var(--hw-border));
}

.author {
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  text-align: left;
  color: inherit;
  width: 100%;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--hw-text-primary) 8%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--hw-text-tertiary);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.author-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.name {
  font-size: 14px;
  font-weight: 650;
  color: var(--hw-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.time {
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.hidden-tag {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--hw-text-tertiary);
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--hw-bg-hover);
}

.content {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
  color: var(--hw-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.content.clamp {
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.images {
  display: grid;
  gap: 6px;
  border-radius: 12px;
  overflow: hidden;
}

.images.count-1 {
  grid-template-columns: 1fr;
}

.images.count-2,
.images.count-4 {
  grid-template-columns: 1fr 1fr;
}

.images.count-3,
.images.count-5,
.images.count-6,
.images.count-7,
.images.count-8,
.images.count-9 {
  grid-template-columns: 1fr 1fr 1fr;
}

.img-btn {
  border: none;
  padding: 0;
  background: color-mix(in srgb, var(--hw-text-primary) 6%, transparent);
  aspect-ratio: 1;
  overflow: hidden;
  cursor: zoom-in;
}

.images.count-1 .img-btn {
  aspect-ratio: 16 / 10;
  max-height: 360px;
}

.img-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.att-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-primary);
  cursor: pointer;
  text-align: left;
  color: inherit;
}

.att-cover {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.att-cover.fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-color-light);
  color: var(--theme-color);
}

.att-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.att-title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.att-sub {
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.att-unavailable {
  font-size: 13px;
  color: var(--hw-text-tertiary);
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--hw-bg-hover);
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 64px;
  border: none;
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 10px;
  cursor: pointer;
}

.action-btn:hover {
  background: var(--hw-bg-hover);
  color: var(--theme-color);
}

.action-btn.active {
  color: var(--theme-color);
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 4000;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  cursor: zoom-out;
}

.lightbox img {
  max-width: min(960px, 100%);
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
}
</style>
