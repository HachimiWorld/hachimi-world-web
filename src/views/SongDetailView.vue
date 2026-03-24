<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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

// ── LRC 歌词处理 ──
interface LrcLine {
  time: number   // 秒
  text: string
}

function isLrc(text: string): boolean {
  return /\[\d{2}:\d{2}[.:]\d{2,3}\]/.test(text)
}

function parseLrc(text: string): LrcLine[] {
  const lines: LrcLine[] = []
  const regex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\](.*)/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const mm = parseInt(match[1])
    const ss = parseInt(match[2])
    const ms = parseInt(match[3].length === 2 ? match[3] + '0' : match[3])
    const time = mm * 60 + ss + ms / 1000
    const lineText = match[4].trim()
    lines.push({ time, text: lineText })
  }
  return lines.sort((a, b) => a.time - b.time)
}

const lrcLines = computed<LrcLine[]>(() => {
  const raw = song.value?.lyrics
  if (!raw || !raw.trim()) {
    // 情况1：空歌词
    return [{ time: 0, text: '填词时间' }]
  }
  const text = raw.trim()
  if (isLrc(text)) {
    // 情况3：已是 lrc 格式
    return parseLrc(text)
  }
  // 情况2：纯文本，每行加 [00:00.000]
  return text.split(/\r?\n/).map((line) => ({ time: 0, text: line.trim() })).filter(l => l.text)
})

// 是否正在播放这首歌
const isCurrentSongPlaying = computed(() => {
  if (!song.value || !playerStore.currentSong) return false
  return playerStore.currentSong.songId === song.value.id && playerStore.isPlaying
})

// 是否是当前歌曲（不管是否在播放）
const isCurrentSong = computed(() => {
  if (!song.value || !playerStore.currentSong) return false
  return playerStore.currentSong.songId === song.value.id
})

// 当前高亮行索引
const activeLrcIndex = computed(() => {
  if (!isCurrentSong.value || lrcLines.value.length === 0) return -1
  const t = playerStore.currentTime
  let idx = 0
  for (let i = 0; i < lrcLines.value.length; i++) {
    if (lrcLines.value[i].time <= t) idx = i
    else break
  }
  return idx
})

// 自动滚动歌词
const lyricsEl = ref<HTMLElement | null>(null)
const lyricsCollapsed = ref(false)

watch(activeLrcIndex, (idx) => {
  if (idx < 0 || !lyricsEl.value) return
  const lines = lyricsEl.value.querySelectorAll<HTMLElement>('.lyric-line')
  const el = lines[idx]
  if (!el) return
  const container = lyricsEl.value
  // getBoundingClientRect 计算相对偏移，不受 offsetParent 影响
  const containerRect = container.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  // el 相对 container 顶部的位置 + 当前 scrollTop = el 在 scrollable 内的绝对偏移
  const elTopInContainer = elRect.top - containerRect.top + container.scrollTop
  container.scrollTop = elTopInContainer - container.clientHeight / 2 + el.offsetHeight / 2
})

const infoRows = computed(() => {
  if (!song.value) return []
  return [
    { label: '编号', value: song.value.display_id || '-' },
    { label: '作者', value: song.value.uploader_name || '-' },
    { label: '原作', value: originalWorkText.value },
    { label: '发行日期', value: formatDate(song.value.release_time) },
    { label: '时长', value: formatDuration(song.value.duration_seconds) },
    { label: '播放量', value: String(song.value.play_count ?? 0) },
    { label: '点赞量', value: String(song.value.like_count ?? 0) },
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
        <div class="loading-hero">
          <div class="left-column loading-left-column">
            <div class="cover-stage">
              <div class="vinyl-shell">
                <div class="vinyl-disc">
                  <div class="vinyl-ring ring-1"></div>
                  <div class="vinyl-ring ring-2"></div>
                  <div class="vinyl-ring ring-3"></div>
                  <div class="vinyl-core loading-core"></div>
                  <span class="disc-hole"></span>
                </div>
              </div>
            </div>

            <aside class="lyrics-panel loading-lyrics-panel">
              <div class="lyrics-skeleton-scroll">
                <div v-for="i in 9" :key="`lyric-skeleton-${i}`" class="lyric-skeleton-line" :class="i % 3 === 0 ? 'short' : i % 2 === 0 ? 'mid' : 'long'"></div>
              </div>
            </aside>
          </div>

          <div class="loading-copy">
            <div class="loading-title-line">
              <div class="loading-title-skeleton"></div>
              <div class="loading-id-skeleton"></div>
            </div>
            <div class="loading-subtitle-skeleton"></div>

            <div class="loading-meta-inline">
              <div class="loading-pill-skeleton author"></div>
              <div class="loading-pill-skeleton"></div>
              <div class="loading-pill-skeleton"></div>
              <div class="loading-pill-skeleton like"></div>
            </div>

            <div class="loading-action-row">
              <div class="loading-action-skeleton primary"></div>
              <div class="loading-action-skeleton"></div>
              <div class="loading-action-skeleton"></div>
              <div class="loading-action-skeleton"></div>
            </div>

            <div class="info-board loading-info-board">
              <div class="info-grid">
                <div v-for="i in 7" :key="`info-skeleton-${i}`" class="info-item">
                  <div class="loading-info-label"></div>
                  <div class="loading-info-value" :class="i % 2 === 0 ? 'wide' : 'narrow'"></div>
                </div>
              </div>
            </div>

            <div class="desc-panel loading-desc-panel">
              <div class="section-caption loading-caption-row">
                <div class="loading-caption-icon"></div>
                <div class="loading-caption-text"></div>
              </div>
              <div class="loading-text-block">
                <div class="loading-text-line long"></div>
                <div class="loading-text-line mid"></div>
                <div class="loading-text-line short"></div>
              </div>
            </div>

            <div class="tags-panel loading-tags-panel">
              <div class="section-caption loading-caption-row">
                <div class="loading-caption-icon"></div>
                <div class="loading-caption-text short"></div>
              </div>
              <div class="tag-list">
                <div class="loading-tag-chip wide"></div>
                <div class="loading-tag-chip"></div>
                <div class="loading-tag-chip narrow"></div>
                <div class="loading-tag-chip"></div>
              </div>
            </div>
          </div>
        </div>
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

            <aside class="lyrics-panel" :class="{ collapsed: lyricsCollapsed }">
              <button class="lyrics-collapse-btn" @click="lyricsCollapsed = !lyricsCollapsed">
                {{ lyricsCollapsed ? '展开歌词' : '收起歌词' }}
              </button>
              <div v-show="!lyricsCollapsed" ref="lyricsEl" class="lyrics-scroll">
                <p
                  v-for="(line, index) in lrcLines"
                  :key="index"
                  class="lyric-line"
                  :class="{
                    'lyric-active': isCurrentSong && index === activeLrcIndex,
                    'lyric-past': isCurrentSong && index < activeLrcIndex,
                    'lyric-inactive': !isCurrentSong,
                  }"
                >
                  {{ line.text || '\u266a' }}
                </p>
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
  align-items: start;
}

.left-column {
  display: flex;
  flex-direction: column;
  gap: 22px;
  /* sticky 让左列跟着右侧高度走，lyrics-panel 撑满剩余 */
  position: sticky;
  top: calc(var(--hw-header-height) + 16px);
}

.cover-stage {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 加载骨架唱片 */
.loading-hero {
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}

.loading-left-column {
  position: static;
}

.loading-copy {
  min-width: 0;
}

.loading-title-line,
.loading-meta-inline,
.loading-action-row,
.loading-caption-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.loading-title-line {
  align-items: center;
}

.loading-title-skeleton,
.loading-id-skeleton,
.loading-subtitle-skeleton,
.loading-pill-skeleton,
.loading-action-skeleton,
.loading-info-label,
.loading-info-value,
.loading-caption-icon,
.loading-caption-text,
.loading-text-line,
.loading-tag-chip,
.lyric-skeleton-line {
  background: linear-gradient(
    90deg,
    var(--hw-bg-secondary) 25%,
    var(--hw-bg-hover) 50%,
    var(--hw-bg-secondary) 75%
  );
  background-size: 400% 100%;
  animation: el-skeleton-loading 1.4s ease infinite;
}

.loading-title-skeleton {
  width: min(360px, 58%);
  height: 38px;
  border-radius: 14px;
}

.loading-id-skeleton {
  width: 72px;
  height: 30px;
  border-radius: 999px;
}

.loading-subtitle-skeleton {
  width: 52%;
  height: 16px;
  border-radius: 999px;
  margin-top: 10px;
}

.loading-meta-inline {
  margin-top: 18px;
}

.loading-pill-skeleton {
  height: 36px;
  width: 112px;
  border-radius: 999px;
}

.loading-pill-skeleton.author {
  width: 126px;
}

.loading-pill-skeleton.like {
  width: 84px;
}

.loading-action-row {
  margin-top: 18px;
}

.loading-action-skeleton {
  height: 42px;
  width: 110px;
  border-radius: 999px;
}

.loading-action-skeleton.primary {
  width: 126px;
}

.loading-info-board,
.loading-desc-panel,
.loading-tags-panel {
  margin-top: 20px;
}

.loading-info-label {
  width: 42px;
  height: 12px;
  border-radius: 999px;
}

.loading-info-value {
  width: 86%;
  height: 15px;
  border-radius: 999px;
}

.loading-info-value.wide {
  width: 92%;
}

.loading-info-value.narrow {
  width: 64%;
}

.loading-caption-icon {
  width: 18px;
  height: 18px;
  border-radius: 6px;
}

.loading-caption-text {
  width: 76px;
  height: 16px;
  border-radius: 999px;
}

.loading-caption-text.short {
  width: 42px;
}

.loading-text-block {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loading-text-line {
  height: 14px;
  border-radius: 999px;
}

.loading-text-line.long {
  width: 100%;
}

.loading-text-line.mid {
  width: 88%;
}

.loading-text-line.short {
  width: 62%;
}

.loading-tag-chip {
  width: 82px;
  height: 32px;
  border-radius: 999px;
}

.loading-tag-chip.wide {
  width: 96px;
}

.loading-tag-chip.narrow {
  width: 66px;
}

.loading-lyrics-panel {
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
}

.lyrics-skeleton-scroll {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding-right: 4px;
}

.lyric-skeleton-line {
  height: 12px;
  border-radius: 999px;
}

.lyric-skeleton-line.long {
  width: 72%;
}

.lyric-skeleton-line.mid {
  width: 58%;
}

.lyric-skeleton-line.short {
  width: 42%;
}

/* 骨架唱片用主题色填充封面区域 */
.vinyl-core.loading-core {
  background: var(--theme-color);
  display: block;
}

.vinyl-shell {
  /* 不需要再单独 sticky，由 left-column 负责 */
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
  padding: 0;
  display: flex;
  flex-direction: column;
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  overflow: hidden;
  /* PC 端高度 = 唱片直径 */
  height: min(320px, 72vw);
}

.lyrics-collapse-btn {
  /* 仅手机端显示，PC 端隐藏 */
  display: none;
  width: 100%;
  padding: 8px 0;
  background: none;
  border: none;
  border-bottom: 1px solid var(--hw-border);
  color: var(--hw-text-tertiary);
  font-size: 13px;
  cursor: pointer;
  text-align: center;
  margin-bottom: 8px;
}

.lyrics-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 4px 0 0;
  scrollbar-width: thin;
  scrollbar-color: var(--hw-border) transparent;
  text-align: center;
}

.lyric-line {
  line-height: 1.9;
  font-size: 14px;
  padding: 4px 0;
  transition: color 0.3s ease, font-size 0.3s ease, font-weight 0.3s ease;
  color: var(--hw-text-tertiary);
  cursor: default;
}

.lyric-line + .lyric-line {
  margin-top: 2px;
}

/* 未同步播放时全部普通颜色 */
.lyric-line.lyric-inactive {
  color: var(--hw-text-secondary);
}

/* 已过去的行 */
.lyric-line.lyric-past {
  color: var(--hw-text-tertiary);
}

/* 当前高亮行 */
.lyric-line.lyric-active {
  color: var(--theme-color);
  font-size: 15px;
  font-weight: 700;
}

.detail-loading-card {
  padding: 0;
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

  .left-column,
  .loading-left-column {
    order: 1;
    position: static;
  }

  .hero-main,
  .loading-copy {
    order: 2;
  }

  .cover-stage {
    justify-content: center;
  }

  .vinyl-shell {
    position: static;
  }

  /* 手机端：歌词容器高度与唱片一致，文字居中 */
  .lyrics-panel,
  .loading-lyrics-panel {
    height: min(280px, 78vw);
  }

  /* 折叠时只保留按钮高度 */
  .lyrics-panel.collapsed {
    height: auto !important;
    min-height: 0 !important;
  }

  /* v-show 控制，不再需要 display:none */

  .lyrics-collapse-btn {
    display: block;
  }

  .lyrics-scroll {
    text-align: center;
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

  .lyrics-panel,
  .loading-lyrics-panel {
    min-height: 280px;
  }
}
</style>

