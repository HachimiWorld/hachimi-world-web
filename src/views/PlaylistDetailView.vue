<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CaretRight, Edit, Delete, Star, StarFilled, User, Headset, Warning, Upload } from '@element-plus/icons-vue'
import { ApiError } from '@/api/request'
import {
  getPlaylistDetail, updatePlaylist, deletePlaylist, removeSongFromPlaylist,
  checkFavoritePlaylist, addFavoritePlaylist, removeFavoritePlaylist, setPlaylistCover,
  type PlaylistDetailResp, type PlaylistSongItem,
} from '@/api/playlist'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import LoginDialog from '@/components/LoginDialog.vue'

const route = useRoute()
const router = useRouter()
const playerStore = usePlayerStore()
const userStore = useUserStore()

const loading = ref(true)
const pageError = ref('')
const detail = ref<PlaylistDetailResp | null>(null)
const isFavorited = ref(false)
const favoriteLoading = ref(false)
const loginDialogOpen = ref(false)
const editDialogOpen = ref(false)
const editName = ref('')
const editDesc = ref('')
const editIsPublic = ref(false)
const editLoading = ref(false)
const coverUploading = ref(false)
const coverInputRef = ref<HTMLInputElement | null>(null)
const removingSongId = ref<number | null>(null)

const playlistId = computed(() => Number(route.params.id))

const isOwner = computed(() => {
  if (!userStore.isLoggedIn || !userStore.userInfo || !detail.value) return false
  return detail.value.creator_profile.uid === userStore.userInfo.uid
})

const coverUrl = computed(() => detail.value?.playlist_info.cover_url || null)

function formatDate(date: string) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

async function loadDetail() {
  if (!Number.isFinite(playlistId.value) || playlistId.value <= 0) {
    pageError.value = '歌单 ID 无效'
    loading.value = false
    return
  }
  loading.value = true
  pageError.value = ''
  try {
    detail.value = await getPlaylistDetail(playlistId.value)
    if (userStore.isLoggedIn && !isOwner.value) {
      try {
        const r = await checkFavoritePlaylist(playlistId.value)
        isFavorited.value = r.is_favorite
      } catch {
        isFavorited.value = false
      }
    }
  } catch (e) {
    pageError.value = e instanceof ApiError ? e.msg : '加载歌单失败'
    detail.value = null
  } finally {
    loading.value = false
  }
}

onMounted(loadDetail)
watch(playlistId, loadDetail)

async function playSong(song: PlaylistSongItem) {
  await playerStore.addSongToLocalAndPlay(song.song_id)
}

async function playAll() {
  if (!detail.value?.songs.length) return
  await playerStore.replaceLocalQueueAndPlay(detail.value.songs)
}

async function toggleFavorite() {
  if (!userStore.isLoggedIn) { loginDialogOpen.value = true; return }
  favoriteLoading.value = true
  try {
    if (isFavorited.value) {
      await removeFavoritePlaylist(playlistId.value)
      isFavorited.value = false
      ElMessage.success('已取消收藏')
    } else {
      await addFavoritePlaylist(playlistId.value)
      isFavorited.value = true
      ElMessage.success('已收藏歌单')
    }
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '操作失败')
  } finally {
    favoriteLoading.value = false
  }
}

function openEditDialog() {
  if (!detail.value) return
  editName.value = detail.value.playlist_info.name
  editDesc.value = detail.value.playlist_info.description || ''
  editIsPublic.value = detail.value.playlist_info.is_public
  editDialogOpen.value = true
}

async function submitEdit() {
  if (!editName.value.trim()) { ElMessage.error('歌单名称不能为空'); return }
  editLoading.value = true
  try {
    await updatePlaylist({
      id: playlistId.value,
      name: editName.value.trim(),
      description: editDesc.value.trim() || null,
      is_public: editIsPublic.value,
    })
    ElMessage.success('已更新歌单信息')
    editDialogOpen.value = false
    await loadDetail()
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '更新失败')
  } finally {
    editLoading.value = false
  }
}

function triggerCoverUpload() { coverInputRef.value?.click() }

async function onCoverSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 8 * 1024 * 1024) { ElMessage.error('图片大小不能超过 8MB'); return }
  coverUploading.value = true
  try {
    await setPlaylistCover(playlistId.value, file)
    ElMessage.success('封面已更新')
    await loadDetail()
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '上传封面失败')
  } finally {
    coverUploading.value = false
    if (coverInputRef.value) coverInputRef.value.value = ''
  }
}

async function handleDeletePlaylist() {
  try {
    await ElMessageBox.confirm('确定要删除这个歌单吗？此操作不可恢复。', '删除歌单', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  try {
    await deletePlaylist(playlistId.value)
    ElMessage.success('歌单已删除')
    router.push('/')
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '删除失败')
  }
}

async function handleRemoveSong(song: PlaylistSongItem) {
  removingSongId.value = song.song_id
  try {
    await removeSongFromPlaylist(playlistId.value, song.song_id)
    if (detail.value) {
      detail.value.songs = detail.value.songs.filter(s => s.song_id !== song.song_id)
      detail.value.playlist_info.songs_count = detail.value.songs.length
    }
    ElMessage.success('已从歌单移除')
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '移除失败')
  } finally {
    removingSongId.value = null
  }
}

function goToSong(song: PlaylistSongItem) { router.push(`/song/${song.song_id}`) }
function goToUser(uid: number) { router.push(`/user/${uid}`) }
</script>

<template>
  <div class="playlist-detail-view">

    <!-- 加载骨架 -->
    <section v-if="loading" class="pd-loading">
      <div class="pd-loading-hero">
        <div class="pd-cover-wrap">
          <div class="pd-cover-box pd-cover-box-skeleton">
            <div class="pd-cover-skeleton"></div>
          </div>
          <div class="pd-cover-upload-skeleton"></div>
        </div>

        <div class="pd-hero-info pd-hero-info-skeleton">
          <div class="pd-badge-skeleton"></div>
          <div class="pd-title-skeleton"></div>
          <div class="pd-creator-skeleton-row">
            <div class="pd-creator-avatar-skeleton"></div>
            <div class="pd-creator-name-skeleton"></div>
          </div>
          <div class="pd-meta-skeleton-row">
            <div class="pd-meta-skeleton"></div>
            <div class="pd-meta-skeleton dot"></div>
            <div class="pd-meta-skeleton wide"></div>
          </div>
          <div class="pd-desc-skeleton">
            <div class="pd-line-skeleton long"></div>
            <div class="pd-line-skeleton short"></div>
          </div>
          <div class="pd-actions-skeleton">
            <div class="pd-btn-skeleton primary"></div>
            <div class="pd-btn-skeleton"></div>
            <div class="pd-btn-skeleton"></div>
          </div>
        </div>
      </div>

      <section class="pd-songs-section pd-songs-section-skeleton">
        <div class="pd-songs-list">
          <div v-for="i in 6" :key="i" class="pd-song-row pd-song-row-skeleton">
            <div class="pd-song-index-skeleton"></div>
            <div class="pd-song-cover pd-song-cover-skeleton"></div>
            <div class="pd-song-info">
              <div class="pd-song-title-skeleton"></div>
              <div class="pd-song-meta-skeleton"></div>
            </div>
            <div class="pd-song-duration-skeleton"></div>
            <div class="pd-song-remove-skeleton"></div>
          </div>
        </div>
      </section>
    </section>

    <!-- 错误 -->
    <section v-else-if="pageError" class="pd-state-card">
      <el-icon class="pd-state-icon"><Warning /></el-icon>
      <span>{{ pageError }}</span>
    </section>

    <!-- 内容 -->
    <template v-else-if="detail">
      <!-- Hero -->
      <section class="pd-hero">
        <div class="pd-cover-wrap">
          <div class="pd-cover-box">
            <img v-if="coverUrl" :src="coverUrl" :alt="detail.playlist_info.name" class="pd-cover-img" />
            <div v-else class="pd-cover-fallback"><el-icon><Headset /></el-icon></div>
          </div>
          <button v-if="isOwner" class="pd-cover-upload-btn" :class="{ uploading: coverUploading }" @click="triggerCoverUpload">
            <el-icon><Upload /></el-icon>
            <span>{{ coverUploading ? '上传中…' : '更换封面' }}</span>
          </button>
          <input ref="coverInputRef" type="file" accept="image/*" style="display:none" @change="onCoverSelected" />
        </div>

        <div class="pd-hero-info">
          <div class="pd-playlist-badges">
            <span class="pd-badge" :class="detail.playlist_info.is_public ? 'public' : 'private'">
              {{ detail.playlist_info.is_public ? '公开歌单' : '私密歌单' }}
            </span>
          </div>
          <h1 class="pd-playlist-name">{{ detail.playlist_info.name }}</h1>
          <button class="pd-creator-link" @click="goToUser(detail.creator_profile.uid)">
            <div class="pd-creator-avatar">
              <img v-if="detail.creator_profile.avatar_url" :src="detail.creator_profile.avatar_url" />
              <el-icon v-else><User /></el-icon>
            </div>
            <span>{{ detail.creator_profile.username }}</span>
          </button>
          <div class="pd-playlist-meta">
            <span>{{ detail.playlist_info.songs_count }} 首歌曲</span>
            <span class="pd-meta-dot">·</span>
            <span>创建于 {{ formatDate(detail.playlist_info.create_time) }}</span>
          </div>
          <p v-if="detail.playlist_info.description" class="pd-playlist-desc">{{ detail.playlist_info.description }}</p>

          <div class="pd-actions">
            <template v-if="isOwner">
              <button class="pd-btn primary" :disabled="!detail.songs.length" @click="playAll">
                <el-icon><CaretRight /></el-icon>播放全部
              </button>
              <button class="pd-btn" @click="openEditDialog">
                <el-icon><Edit /></el-icon>编辑信息
              </button>
              <button class="pd-btn danger" @click="handleDeletePlaylist">
                <el-icon><Delete /></el-icon>删除歌单
              </button>
            </template>
            <template v-else>
              <button class="pd-btn primary" :disabled="!detail.songs.length" @click="playAll">
                <el-icon><CaretRight /></el-icon>播放全部
              </button>
              <button class="pd-btn" :class="{ favorited: isFavorited }" :disabled="favoriteLoading" @click="toggleFavorite">
                <el-icon><component :is="isFavorited ? StarFilled : Star" /></el-icon>
                {{ isFavorited ? '已收藏' : '收藏歌单' }}
              </button>
            </template>
          </div>
        </div>
      </section>

      <!-- 曲目列表 -->
      <section class="pd-songs-section">
        <div v-if="detail.songs.length" class="pd-songs-list">
          <div v-for="(song, index) in detail.songs" :key="song.song_id" class="pd-song-row">
            <span class="pd-song-index">{{ index + 1 }}</span>
            <div class="pd-song-cover" @click="goToSong(song)">
              <img :src="song.cover_url" :alt="song.title" />
              <button class="pd-song-play-overlay" @click.stop="playSong(song)">
                <el-icon><CaretRight /></el-icon>
              </button>
            </div>
            <div class="pd-song-info" @click="goToSong(song)">
              <span class="pd-song-title">{{ song.title }}</span>
              <span class="pd-song-meta">{{ song.uploader_name }}</span>
            </div>
            <span class="pd-song-duration">{{ formatDuration(song.duration_seconds) }}</span>
            <button v-if="isOwner" class="pd-song-remove-btn" :disabled="removingSongId === song.song_id" @click="handleRemoveSong(song)">
              <el-icon><Delete /></el-icon>
            </button>
          </div>
        </div>
        <div v-else class="pd-empty">
          <el-icon><Tickets /></el-icon>
          <span>这个歌单还没有歌曲</span>
        </div>
      </section>
    </template>

    <LoginDialog v-model="loginDialogOpen" />

    <el-dialog
      v-model="editDialogOpen"
      title="编辑歌单信息"
      width="480px"
      class="pd-edit-dialog"
      modal-class="pd-edit-dialog-overlay"
      align-center
    >
      <div class="pd-edit-form">
        <div class="pd-edit-field">
          <label>歌单名称 <span class="pd-required">*</span></label>
          <el-input v-model="editName" maxlength="32" show-word-limit placeholder="给歌单起个名字" />
        </div>
        <div class="pd-edit-field">
          <label>描述</label>
          <el-input v-model="editDesc" type="textarea" :rows="3" maxlength="300" show-word-limit placeholder="介绍一下这个歌单（可选）" />
        </div>
        <div class="pd-edit-field pd-edit-toggle">
          <label>公开歌单</label>
          <el-switch v-model="editIsPublic" />
        </div>
      </div>
      <template #footer>
        <button class="pd-btn" @click="editDialogOpen = false">取消</button>
        <button class="pd-btn primary" :disabled="editLoading" @click="submitEdit">{{ editLoading ? '保存中…' : '保存' }}</button>
      </template>
    </el-dialog>

  </div>
</template>

<style scoped>
.playlist-detail-view {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 120px;
}

/* ─── 骨架 ─── */
.pd-loading {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.pd-loading-hero {
  display: flex;
  align-items: flex-start;
  gap: 36px;
}

.pd-cover-box-skeleton {
  padding: 0;
}

.pd-cover-skeleton,
.pd-cover-upload-skeleton,
.pd-badge-skeleton,
.pd-title-skeleton,
.pd-creator-avatar-skeleton,
.pd-creator-name-skeleton,
.pd-meta-skeleton,
.pd-line-skeleton,
.pd-btn-skeleton,
.pd-song-index-skeleton,
.pd-song-cover-skeleton,
.pd-song-title-skeleton,
.pd-song-meta-skeleton,
.pd-song-duration-skeleton,
.pd-song-remove-skeleton {
  background: linear-gradient(
    90deg,
    var(--hw-bg-secondary) 25%,
    var(--hw-bg-hover) 50%,
    var(--hw-bg-secondary) 75%
  );
  background-size: 400% 100%;
  animation: el-skeleton-loading 1.4s ease infinite;
}

.pd-cover-skeleton {
  width: 100%;
  height: 100%;
  border-radius: 16px;
}

.pd-cover-upload-skeleton {
  width: 100%;
  height: 32px;
  border-radius: 999px;
}

.pd-hero-info-skeleton {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.pd-badge-skeleton {
  width: 74px;
  height: 22px;
  border-radius: 999px;
  margin-bottom: 10px;
}

.pd-title-skeleton {
  width: min(420px, 78%);
  height: 34px;
  border-radius: 12px;
  margin-bottom: 14px;
}

.pd-creator-skeleton-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.pd-creator-avatar-skeleton {
  width: 24px;
  height: 24px;
  border-radius: 999px;
}

.pd-creator-name-skeleton {
  width: 88px;
  height: 14px;
  border-radius: 999px;
}

.pd-meta-skeleton-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.pd-meta-skeleton {
  width: 66px;
  height: 14px;
  border-radius: 999px;
}

.pd-meta-skeleton.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.pd-meta-skeleton.wide {
  width: 110px;
}

.pd-desc-skeleton {
  width: min(560px, 100%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.pd-line-skeleton {
  height: 13px;
  border-radius: 999px;
}

.pd-line-skeleton.long {
  width: 100%;
}

.pd-line-skeleton.short {
  width: 68%;
}

.pd-actions-skeleton {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pd-btn-skeleton {
  height: 38px;
  width: 102px;
  border-radius: 12px;
}

.pd-btn-skeleton.primary {
  width: 116px;
}

.pd-songs-section-skeleton {
  padding-top: 24px;
}

.pd-song-row-skeleton {
  cursor: default;
}

.pd-song-index-skeleton {
  width: 18px;
  height: 12px;
  justify-self: end;
  border-radius: 999px;
}

.pd-song-cover-skeleton {
  border-radius: 8px;
}

.pd-song-title-skeleton {
  width: 44%;
  height: 14px;
  border-radius: 999px;
}

.pd-song-meta-skeleton {
  width: 28%;
  height: 12px;
  border-radius: 999px;
  margin-top: 6px;
}

.pd-song-duration-skeleton {
  width: 36px;
  height: 12px;
  justify-self: end;
  border-radius: 999px;
}

.pd-song-remove-skeleton {
  width: 30px;
  height: 30px;
  border-radius: 8px;
}

/* ─── 错误/空状态 ─── */
.pd-state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 24px;
  color: var(--hw-text-secondary);
  font-size: 15px;
}

.pd-state-icon { font-size: 36px; color: var(--hw-text-tertiary); }

/* ─── Hero ─── */
.pd-hero {
  display: flex;
  align-items: flex-start;
  gap: 36px;
  margin-bottom: 40px;
}

.pd-cover-wrap {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.pd-cover-box {
  width: 200px;
  height: 200px;
  border-radius: 16px;
  overflow: hidden;
  background: var(--hw-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--hw-border);
  color: var(--hw-text-tertiary);
  font-size: 40px;
}

.pd-cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }

.pd-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.pd-cover-upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--hw-border);
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 12px;
  cursor: pointer;
  width: 100%;
  justify-content: center;
  transition: all 0.15s;
}

.pd-cover-upload-btn:hover {
  border-color: var(--theme-color);
  color: var(--theme-color);
  background: var(--theme-color-light);
}

.pd-cover-upload-btn.uploading { opacity: 0.6; cursor: not-allowed; }

/* ─── 信息区 ─── */
.pd-hero-info { flex: 1; min-width: 0; padding-top: 4px; }

.pd-playlist-badges { margin-bottom: 10px; }

.pd-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.pd-badge.public { background: var(--theme-color-light); color: var(--theme-color); }
.pd-badge.private { background: var(--hw-bg-secondary); color: var(--hw-text-tertiary); }

.pd-playlist-name {
  font-size: 28px;
  font-weight: 800;
  color: var(--hw-text-primary);
  line-height: 1.2;
  margin: 0 0 12px;
  word-break: break-word;
}

.pd-creator-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--hw-text-secondary);
  font-size: 13px;
  padding: 0;
  margin-bottom: 10px;
  transition: color 0.15s;
}

.pd-creator-link:hover { color: var(--theme-color); }

.pd-creator-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--hw-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.pd-creator-avatar img { width: 100%; height: 100%; object-fit: cover; }

.pd-playlist-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--hw-text-tertiary);
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.pd-meta-dot { opacity: 0.5; }

.pd-playlist-desc {
  font-size: 13px;
  color: var(--hw-text-secondary);
  line-height: 1.6;
  margin: 0 0 20px;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ─── 操作按钮 ─── */
.pd-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pd-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 12px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
  color: var(--hw-text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.pd-btn:hover {
  border-color: var(--theme-color);
  color: var(--theme-color);
  background: var(--theme-color-light);
}

.pd-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.pd-btn.primary {
  background: var(--theme-color);
  border-color: var(--theme-color);
  color: #fff;
}

.pd-btn.primary:hover {
  background: color-mix(in srgb, var(--theme-color) 85%, #000);
  border-color: color-mix(in srgb, var(--theme-color) 85%, #000);
  color: #fff;
}

.pd-btn.danger {
  border-color: color-mix(in srgb, #ef4444 40%, var(--hw-border));
  color: #ef4444;
}

.pd-btn.danger:hover {
  background: color-mix(in srgb, #ef4444 10%, transparent);
  border-color: #ef4444;
}

.pd-btn.favorited {
  background: var(--theme-color-light);
  border-color: var(--theme-color);
  color: var(--theme-color);
}

/* ─── 曲目列表 ─── */
.pd-songs-section {
  border-top: 1px solid var(--hw-border);
  padding-top: 24px;
}

.pd-songs-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pd-song-row {
  display: grid;
  grid-template-columns: 32px 48px 1fr 64px auto;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 12px;
  transition: background 0.15s;
  cursor: default;
}

.pd-song-row:hover {
  background: var(--hw-bg-hover);
}

.pd-song-row:hover .pd-song-remove-btn {
  opacity: 1;
}

.pd-song-index {
  font-size: 12px;
  color: var(--hw-text-tertiary);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.pd-song-cover {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
}

.pd-song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pd-song-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.45);
  border: none;
  color: #fff;
  font-size: 18px;
  opacity: 0;
  transition: opacity 0.15s;
  cursor: pointer;
}

.pd-song-cover:hover .pd-song-play-overlay { opacity: 1; }

.pd-song-info {
  min-width: 0;
  cursor: pointer;
}

.pd-song-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--hw-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pd-song-meta {
  display: block;
  font-size: 12px;
  color: var(--hw-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.pd-song-duration {
  font-size: 12px;
  color: var(--hw-text-tertiary);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.pd-song-remove-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--hw-text-tertiary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
}

.pd-song-remove-btn:hover {
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #ef4444;
}

.pd-song-remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ─── 空状态 ─── */
.pd-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 0;
  color: var(--hw-text-tertiary);
  font-size: 14px;
}

/* ─── 编辑表单 ─── */
.pd-edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pd-edit-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pd-edit-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--hw-text-secondary);
}

.pd-required { color: #ef4444; }

.pd-edit-toggle {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.pd-edit-toggle label {
  margin: 0;
}

:deep(.pd-edit-dialog .el-dialog__body) {
  padding-top: 18px;
  padding-bottom: 12px;
}

:deep(.pd-edit-dialog .el-dialog__footer) {
  padding-top: 8px;
}

:deep(.pd-edit-dialog .el-dialog__footer .pd-btn + .pd-btn) {
  margin-left: 10px;
}

/* ─── 响应式 ─── */
@media (max-width: 640px) {
  .pd-hero {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .pd-cover-wrap { width: 160px; }
  .pd-cover-box { width: 160px; height: 160px; }

  .pd-creator-link { justify-content: center; }
  .pd-playlist-meta { justify-content: center; }
  .pd-actions { justify-content: center; }

  .pd-song-row {
    grid-template-columns: 24px 40px 1fr 52px auto;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .pv-create-dialog-overlay,
  .pd-edit-dialog-overlay,
  .login-dialog-overlay,
  .playlist-manage-dialog-overlay {
    padding: 12px;
  }
}
</style>
