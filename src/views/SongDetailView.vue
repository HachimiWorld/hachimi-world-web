<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  CaretRight,
  Pointer,
  Plus,
  Share,
  Headset,
  Calendar,
  PriceTag,
  Document,
  Warning,
  User,
} from '@element-plus/icons-vue'
import { ApiError } from '@/api/request'
import { getSongDetailById, likeSong, unlikeSong, type Song } from '@/api/song'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import LoginDialog from '@/components/LoginDialog.vue'
import PlaylistManageDialog from '@/components/PlaylistManageDialog.vue'

const route = useRoute()
const router = useRouter()
const playerStore = usePlayerStore()
const userStore = useUserStore()

const loading = ref(true)
const pageError = ref('')
const song = ref<Song | null>(null)
const liked = ref(false)
const likeLoading = ref(false)
const playlistDialogOpen = ref(false)
const loginDialogOpen = ref(false)

const songId = computed(() => Number(route.params.id))

function formatCount(n?: number | null) {
  if (!n) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatDuration(secs?: number | null) {
  if (!secs) return '0:00'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(date?: string | null) {
  if (!date) return '暂未公开'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '暂未公开'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const subtitle = computed(() => song.value?.subtitle?.trim() || '暂无副标题')

const originalWorkText = computed(() => {
  if (!song.value?.origin_infos?.length) return '暂无原作信息'
  return song.value.origin_infos
    .map((item) => [item.artist, item.title].filter(Boolean).join(' - '))
    .filter(Boolean)
    .join(' / ')
})

const lyricLines = computed(() => {
  const text = song.value?.lyrics?.trim()
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
})

const isCurrentSongPlaying = computed(() => {
  if (!song.value || !playerStore.currentSong) return false
  return playerStore.currentSong.songId === song.value.id && playerStore.isPlaying
})

const infoRows = computed(() => {
  if (!song.value) return []
  return [
    { label: '编号', value: song.value.display_id || '-' },
    { label: '作者', value: song.value.uploader_name || '-' },
    { label: '原作', value: originalWorkText.value },
    { label: '发行日期', value: formatDate(song.value.release_time) },
    { label: '时长', value: formatDuration(song.value.duration_seconds) },
    { label: '播放量', value: formatCount(song.value.play_count) },
    { label: '点赞量', value: formatCount(song.value.like_count) },
  ]
})

async function loadSong() {
  if (!Number.isFinite(songId.value) || songId.value <= 0) {
    pageError.value = '歌曲 ID 无效'
    loading.value = false
    song.value = null
    return
  }

  loading.value = true
  pageError.value = ''
  liked.value = false

  try {
    song.value = await getSongDetailById(songId.value)
  } catch (e) {
    pageError.value = e instanceof ApiError ? e.msg : '加载歌曲详情失败'
    song.value = null
  } finally {
    loading.value = false
  }
}

function requireLogin(action: () => void | Promise<void>) {
  if (!userStore.isLoggedIn) {
    loginDialogOpen.value = true
    return
  }
  void action()
}

async function handlePlay() {
  if (!song.value) return
  try {
    const localTarget = playerStore.availableTargets.find((item) => item.type === 'local')
    if (!localTarget) return
    await playerStore.addSongToTargetAndPlay(song.value.id, localTarget)
    ElMessage.success('已加入本地歌单并开始播放')
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '加入本地歌单失败')
  }
}

async function handleLike() {
  requireLogin(async () => {
    if (!song.value || likeLoading.value) return

    likeLoading.value = true
    try {
      if (liked.value) {
        await unlikeSong(song.value.id)
        liked.value = false
        song.value.like_count = Math.max(0, song.value.like_count - 1)
        ElMessage.success('已取消点赞')
      } else {
        await likeSong(song.value.id)
        liked.value = true
        song.value.like_count += 1
        ElMessage.success('点赞成功')
      }
    } catch (e) {
      ElMessage.error(e instanceof ApiError ? e.msg : '操作失败，请稍后重试')
    } finally {
      likeLoading.value = false
    }
  })
}

function handleOpenPlaylist() {
  requireLogin(() => {
    playlistDialogOpen.value = true
  })
}

async function handleShare() {
  if (!song.value) return
  const url = `${window.location.origin}/song/${song.value.id}`
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('歌曲链接已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制链接')
  }
}

function jumpToUploader() {
  if (!song.value) return
  router.push(`/user/${song.value.uploader_uid}`)
}

watch(songId, () => {
  loadSong()
})

onMounted(() => {
  loadSong()
})
</script>

<template>
  <div class="song-detail-view">
    <div class="song-detail-shell">
      <section v-if="loading" class="detail-loading-card">
        <el-skeleton animated>
          <template #template>
            <div class="loading-hero">
              <el-skeleton-item variant="image" class="loading-disc" />
              <div class="loading-copy">
                <el-skeleton-item variant="h1" style="width: 48%" />
                <el-skeleton-item variant="text" style="width: 68%; margin-top: 10px" />
                <el-skeleton-item variant="text" style="width: 100%; margin-top: 22px" />
                <el-skeleton-item variant="text" style="width: 92%; margin-top: 12px" />
                <el-skeleton-item variant="text" style="width: 88%; margin-top: 12px" />
              </div>
            </div>
          </template>
        </el-skeleton>
      </section>

      <section v-else-if="pageError" class="state-card error-state">
        <el-icon><Warning /></el-icon>
        <span>{{ pageError }}</span>
      </section>

      <template v-else-if="song">
        <section class="hero-panel">
          <div class="left-column">
            <div class="cover-stage">
              <div class="vinyl-shell">
                <div class="vinyl-disc" :class="{ spinning: isCurrentSongPlaying }">
                  <div class="vinyl-ring ring-1"></div>
                  <div class="vinyl-ring ring-2"></div>
                  <div class="vinyl-ring ring-3"></div>
                  <div class="vinyl-core">
                    <img v-if="song.cover_url" :src="song.cover_url" :alt="song.title" class="cover-image">
                    <div v-else class="cover-fallback">♪</div>
                  </div>
                  <span class="disc-hole"></span>
                </div>
              </div>
            </div>

            <aside class="lyrics-panel">
              <div class="lyrics-title">歌词</div>
              <div v-if="lyricLines.length" class="lyrics-scroll">
                <p v-for="(line, index) in lyricLines" :key="`${index}-${line}`" class="lyric-line">
                  {{ line }}
                </p>
              </div>
              <div v-else class="lyrics-empty">
                这首歌暂时还没有公开歌词。
              </div>
            </aside>
          </div>

          <div class="hero-main">
            <div class="hero-copy">
              <div class="title-line">
                <h1 class="song-title">{{ song.title }}</h1>
                <span class="song-id-chip">{{ song.display_id }}</span>
              </div>
              <p class="song-subtitle">{{ subtitle }}</p>

              <div class="meta-inline">
                <button class="author-link" @click="jumpToUploader">
                  <el-icon><User /></el-icon>
                  {{ song.uploader_name }}
                </button>
                <span class="meta-pill">
                  <el-icon><Calendar /></el-icon>
                  {{ formatDate(song.release_time) }}
                </span>
                <span class="meta-pill">
                  <el-icon><Headset /></el-icon>
                  {{ formatCount(song.play_count) }}
                </span>
                <span class="meta-pill like-pill" :class="{ active: liked }">
                  ▲ {{ formatCount(song.like_count) }}
                </span>
              </div>

              <div class="action-row">
                <button class="action-btn primary" @click="handlePlay">
                  <el-icon class="detail-play-icon"><CaretRight /></el-icon>
                  播放
                </button>
                <button class="action-btn" :class="{ liked: liked }" :disabled="likeLoading" @click="handleLike">
                  <el-icon><Pointer /></el-icon>
                  {{ liked ? '取消点赞' : '点赞' }}
                </button>
                <button class="action-btn" @click="handleOpenPlaylist">
                  <el-icon><Plus /></el-icon>
                  加入歌单
                </button>
                <button class="action-btn" @click="handleShare">
                  <el-icon><Share /></el-icon>
                  分享
                </button>
              </div>

              <div class="info-board">
                <div class="info-grid">
                  <div v-for="item in infoRows" :key="item.label" class="info-item">
                    <span class="info-label">{{ item.label }}</span>
                    <span class="info-value">{{ item.value }}</span>
                  </div>
                </div>
              </div>

              <div class="desc-panel">
                <div class="section-caption">
                  <el-icon><Document /></el-icon>
                  <span>歌曲描述</span>
                </div>
                <p class="song-description">
                  {{ song.description?.trim() || '这首歌暂时还没有填写描述。' }}
                </p>
              </div>

              <div v-if="song.tags.length" class="tags-panel">
                <div class="section-caption">
                  <el-icon><PriceTag /></el-icon>
                  <span>标签</span>
                </div>
                <div class="tag-list">
                  <button
                    v-for="tag in song.tags"
                    :key="tag.id"
                    class="tag-chip tag-chip--clickable"
                    @click="router.push({ path: '/search', query: { q: tag.name } })"
                  >{{ tag.name }}</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>

    <PlaylistManageDialog
      v-if="song"
      v-model="playlistDialogOpen"
      :song-id="song.id"
    />
    <LoginDialog v-model="loginDialogOpen" />
  </div>
</template>

<style scoped>
.song-detail-view {
  min-height: calc(100vh - var(--hw-header-height));
  background: var(--hw-bg-primary);
}

.song-detail-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.hero-panel,
.detail-loading-card,
.state-card {
  background: transparent;
  border: none;
  border-radius: 0;
}

.hero-panel {
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  gap: 28px;
  padding: 0;
}

.left-column {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.cover-stage {
  display: flex;
  align-items: center;
  justify-content: center;
}

.vinyl-shell {
  position: sticky;
  top: calc(var(--hw-header-height) + 26px);
}

.vinyl-disc {
  position: relative;
  width: min(320px, 72vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, #151515 0 13%, #090909 13% 20%, #0f0f0f 20% 46%, #050505 46% 56%, #0b0b0b 56% 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    inset 0 0 24px rgba(255, 255, 255, 0.04);
  animation: vinyl-spin 6s linear infinite;
  animation-play-state: paused;
}

.vinyl-disc.spinning {
  animation-play-state: running;
}

.vinyl-ring {
  position: absolute;
  inset: 8%;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.ring-2 { inset: 18%; }
.ring-3 { inset: 28%; }

.vinyl-core {
  position: absolute;
  inset: 24%;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.04);
}

.cover-image,
.cover-fallback {
  width: 100%;
  height: 100%;
}

.cover-image {
  display: block;
  object-fit: cover;
}

.cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--theme-color) 24%, #1e1e1e);
  color: #fff;
  font-size: 56px;
}

.disc-hole {
  position: absolute;
  inset: 47%;
  border-radius: 50%;
  background: #101010;
  box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.08);
}

@keyframes vinyl-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.hero-main {
  min-width: 0;
}

.hero-copy {
  min-width: 0;
}

.title-line {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.song-title {
  font-size: clamp(28px, 3vw, 40px);
  line-height: 1.12;
  font-weight: 800;
  color: var(--hw-text-primary);
  letter-spacing: -0.03em;
}

.song-id-chip {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-color) 18%, var(--hw-bg-primary));
  color: var(--theme-color);
  font-size: 12px;
  font-weight: 700;
}

.song-subtitle {
  margin-top: 8px;
  color: var(--hw-text-secondary);
  font-size: 15px;
}

.meta-inline {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.meta-pill,
.author-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-primary);
  color: var(--hw-text-secondary);
  font-size: 13px;
}

.author-link {
  cursor: pointer;
}

.like-pill.active {
  color: var(--theme-color);
  border-color: color-mix(in srgb, var(--theme-color) 36%, var(--hw-border));
}

.action-row {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-primary);
  color: var(--hw-text-primary);
  cursor: pointer;
  font-weight: 700;
}

.action-btn.primary {
  background: var(--theme-color);
  border-color: var(--theme-color);
  color: #fff;
}

.detail-play-icon {
  font-size: 18px;
  transform: translateX(1px);
}

.action-btn.liked {
  color: var(--theme-color);
  border-color: color-mix(in srgb, var(--theme-color) 45%, var(--hw-border));
}

.info-board,
.desc-panel,
.tags-panel,
.lyrics-panel {
  margin-top: 20px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-primary);
  border-radius: 22px;
}

.info-board,
.desc-panel,
.tags-panel {
  padding: 18px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 18px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.info-value {
  font-size: 14px;
  color: var(--hw-text-primary);
  line-height: 1.55;
  word-break: break-word;
}

.section-caption,
.lyrics-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--hw-text-primary);
}

.song-description {
  margin-top: 12px;
  color: var(--hw-text-secondary);
  line-height: 1.8;
  white-space: pre-wrap;
}

.tag-list {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-color) 14%, var(--hw-bg-secondary));
  color: var(--theme-color);
  font-size: 13px;
  font-weight: 700;
  border: none;
}

.tag-chip--clickable {
  cursor: pointer;
  transition: background 0.15s ease, filter 0.15s ease;
}

.tag-chip--clickable:hover {
  filter: brightness(0.82);
}

.lyrics-panel {
  margin-top: 0;
  padding: 18px 18px 10px;
  display: flex;
  flex-direction: column;
  min-height: 360px;
}

.lyrics-scroll {
  margin-top: 14px;
  overflow: auto;
  flex: 1;
  padding-right: 4px;
}

.lyric-line,
.lyrics-empty {
  color: var(--hw-text-secondary);
  line-height: 1.9;
  font-size: 14px;
}

.lyric-line + .lyric-line {
  margin-top: 6px;
}

.lyrics-empty {
  margin-top: 18px;
}

.detail-loading-card {
  padding: 28px;
}

.loading-hero {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 24px;
  align-items: start;
}

.loading-disc {
  width: 300px;
  height: 300px;
  border-radius: 50%;
}

.loading-copy {
  min-width: 0;
}

.state-card {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--hw-text-secondary);
}

@media (max-width: 1080px) {
  .hero-panel,
  .loading-hero {
    grid-template-columns: 1fr;
  }

  .left-column {
    order: 1;
  }

  .hero-main {
    order: 2;
  }

  .cover-stage {
    justify-content: center;
  }

  .vinyl-shell {
    position: static;
  }

  .lyrics-panel {
    min-height: 320px;
  }
}

@media (max-width: 768px) {
  .hero-panel,
  .detail-loading-card {
    padding: 0;
    border-radius: 0;
  }

  .song-title {
    font-size: 28px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .vinyl-disc {
    width: min(280px, 78vw);
  }

  .lyrics-panel {
    min-height: 280px;
  }
}
</style>

