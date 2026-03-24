<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DArrowLeft,
  DArrowRight,
  CaretRight,
  Tickets,
  Sort,
  RefreshRight,
  Headset,
  Histogram,
  Microphone,
  Files,
  FolderAdd,
  Plus,
  Lock,
  Link,
  Delete,
  InfoFilled,
} from '@element-plus/icons-vue'
import { createPlaylist } from '@/api/playlist'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import type { PlayerPlayMode } from '@/stores/player'
import { ApiError } from '@/api/request'
import { useRouter } from 'vue-router'

const playerStore = usePlayerStore()
const userStore = useUserStore()
const router = useRouter()
const modePanelOpen = ref(false)
const volumePanelOpen = ref(false)
const playlistPanelOpen = ref(false)
const createCloudOpen = ref(false)
const creatingPlaylist = ref(false)
const createName = ref('')
const createDescription = ref('')
const createIsPublic = ref(false)

// 本地歌单拖拽排序
const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, index: number) {
  dragFromIndex.value = index
  dragOverIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function onDrop(e: DragEvent, toIndex: number) {
  e.preventDefault()
  if (dragFromIndex.value !== null && dragFromIndex.value !== toIndex) {
    playerStore.reorderLocalQueue(dragFromIndex.value, toIndex)
  }
  dragFromIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  dragFromIndex.value = null
  dragOverIndex.value = null
}

const modeOptions: { id: PlayerPlayMode; label: string; icon: unknown }[] = [
  { id: 'sequence', label: '顺序播放', icon: Headset },
  { id: 'loop', label: '循环播放', icon: RefreshRight },
  { id: 'shuffle', label: '随机播放', icon: Sort },
]

function formatDuration(secs?: number | null) {
  if (!secs) return '0:00'
  const value = Math.floor(secs)
  const m = Math.floor(value / 60)
  const s = value % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const progressValue = computed({
  get: () => playerStore.duration ? Math.min(playerStore.currentTime, playerStore.duration) : 0,
  set: (value: number) => playerStore.seek(value),
})

const volumeValue = computed({
  get: () => Math.round(playerStore.volume * 100),
  set: (value: number) => playerStore.setVolume(value / 100),
})

const modeIcon = computed(() => {
  if (playerStore.playMode === 'loop') return RefreshRight
  if (playerStore.playMode === 'shuffle') return Sort
  return Headset
})

watch(
  () => userStore.isLoggedIn,
  async (value, oldValue) => {
    if (!oldValue && value) {
      await playerStore.refreshCloudPlaylists().catch(() => undefined)
      return
    }

    if (oldValue && !value) {
      playerStore.switchToLocal()
      return
    }

    await playerStore.initialize()
  },
  { immediate: true },
)

onMounted(async () => {
  await playerStore.initialize()
})

function closeOtherPanels(type: 'mode' | 'volume' | 'playlist' | 'queue') {
  if (type !== 'mode') modePanelOpen.value = false
  if (type !== 'volume') volumePanelOpen.value = false
  if (type !== 'playlist') {
    playlistPanelOpen.value = false
    createCloudOpen.value = false
  }
  if (type !== 'queue') playerStore.closePanels()
}

function toggleModePanel() {
  closeOtherPanels('mode')
  modePanelOpen.value = !modePanelOpen.value
}

function toggleVolumePanel() {
  closeOtherPanels('volume')
  volumePanelOpen.value = !volumePanelOpen.value
}

async function togglePlaylistPanel() {
  closeOtherPanels('playlist')
  playlistPanelOpen.value = !playlistPanelOpen.value
  if (playlistPanelOpen.value && userStore.isLoggedIn) {
    await playerStore.refreshCloudPlaylists().catch(() => undefined)
  }
}

function toggleQueuePanel() {
  closeOtherPanels('queue')
  playerStore.toggleQueuePanel()
}

function setMode(mode: PlayerPlayMode) {
  playerStore.setPlayMode(mode)
  modePanelOpen.value = false
}

async function switchPlaylist(key: string) {
  try {
    await playerStore.switchToPlaylist(key)
    playlistPanelOpen.value = false
    createCloudOpen.value = false
  } catch {
    ElMessage.error('切换歌单失败')
  }
}

function toggleCreateCloud() {
  if (!userStore.isLoggedIn) {
    ElMessage.info('登录后才可以创建云端歌单')
    return
  }
  createCloudOpen.value = !createCloudOpen.value
}

async function handleCreateCloudPlaylist() {
  const name = createName.value.trim()
  if (!name) {
    ElMessage.warning('请输入歌单名称')
    return
  }

  creatingPlaylist.value = true
  try {
    const resp = await createPlaylist({
      name,
      description: createDescription.value.trim() || null,
      is_public: createIsPublic.value,
    })
    await playerStore.refreshCloudPlaylists()
    createName.value = ''
    createDescription.value = ''
    createIsPublic.value = false
    createCloudOpen.value = false
    ElMessage.success('云端歌单已创建')
    await switchPlaylist(`cloud:${resp.id}`)
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '创建云端歌单失败')
  } finally {
    creatingPlaylist.value = false
  }
}
</script>

<template>
  <div class="global-player-wrap" :class="{ empty: !playerStore.hasQueue }">
    <div class="global-player-bar">
      <div class="player-song-block">
        <div v-if="playerStore.currentSong" class="cover-box">
          <img :src="playerStore.currentSong.coverUrl" :alt="playerStore.currentSong.title" class="cover-image">
        </div>
        <div v-else class="cover-box placeholder">♪</div>

        <div class="song-copy">
          <div class="song-title-row">
            <strong class="song-title">
              {{ playerStore.currentSong?.title || '当前还没有可播放的歌曲' }}
            </strong>
            <span class="playlist-name-chip">{{ playerStore.playlistName }}</span>
          </div>
          <p class="song-subtitle">
            {{ playerStore.currentSong?.uploaderName || '当前可以查看和切换任意已创建的歌单' }}
          </p>

          <div class="timeline-row">
            <div class="progress-group">
              <span class="time-text">{{ formatDuration(playerStore.currentTime) }}</span>
              <el-slider
                v-model="progressValue"
                class="progress-slider"
                :max="playerStore.duration || playerStore.currentSong?.durationSeconds || 0"
                :show-tooltip="false"
                :disabled="!playerStore.currentSong"
              />
              <span class="time-text">{{ formatDuration(playerStore.duration || playerStore.currentSong?.durationSeconds) }}</span>
            </div>

            <div class="volume-readout">
              <el-icon><Microphone /></el-icon>
              <span>{{ volumeValue }}%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="player-control-block">
        <div class="top-tools-row">
          <button
            class="icon-tool-btn"
            :disabled="!playerStore.currentSong"
            :title="playerStore.currentSong ? '查看歌曲详情' : ''"
            @click="playerStore.currentSong && router.push('/song/' + playerStore.currentSong.songId)"
          >
            <el-icon><InfoFilled /></el-icon>
          </button>
          <button class="icon-tool-btn" @click="toggleVolumePanel">
            <el-icon><Microphone /></el-icon>
          </button>
          <button class="icon-tool-btn" @click="togglePlaylistPanel">
            <el-icon><Files /></el-icon>
          </button>
          <button class="icon-tool-btn" @click="toggleModePanel">
            <el-icon><component :is="modeIcon" /></el-icon>
          </button>
          <button class="icon-tool-btn" @click="toggleQueuePanel">
            <el-icon><Tickets /></el-icon>
          </button>
        </div>

        <div class="button-group">
          <button class="player-btn ghost-btn" :disabled="!playerStore.hasQueue" @click="playerStore.previous">
            <el-icon><DArrowLeft /></el-icon>
          </button>
          <button class="player-btn play-btn" :disabled="!playerStore.hasQueue" @click="playerStore.togglePlay">
            <span v-if="playerStore.isPlaying" class="pause-bars" aria-hidden="true">
              <span></span>
              <span></span>
            </span>
            <el-icon v-else class="play-icon"><CaretRight /></el-icon>
          </button>
          <button class="player-btn ghost-btn" :disabled="!playerStore.hasQueue" @click="playerStore.next">
            <el-icon><DArrowRight /></el-icon>
          </button>
        </div>
      </div>
    </div>

    <transition name="queue-fade">
      <div v-if="volumePanelOpen" class="floating-panel volume-panel">
        <div class="mode-head">
          <strong class="queue-title">音量调节</strong>
          <span class="queue-subtitle">调整当前播放器音量</span>
        </div>
        <div class="volume-edit-row">
          <el-icon class="volume-panel-icon"><Microphone /></el-icon>
          <el-slider v-model="volumeValue" class="volume-slider" :max="100" :show-tooltip="false" />
          <span class="volume-value">{{ volumeValue }}%</span>
        </div>
      </div>
    </transition>

    <transition name="queue-fade">
      <div v-if="playlistPanelOpen" class="floating-panel playlist-panel">
        <div class="mode-head">
          <strong class="queue-title">切换歌单</strong>
          <span class="queue-subtitle">上方固定是本地歌单，下面会列出你已有的云端歌单</span>
        </div>

        <div class="playlist-section-title">本地歌单</div>
        <div class="mode-list compact-list">
          <button
            class="mode-item"
            :class="{ active: playerStore.targetKey === playerStore.LOCAL_TARGET_KEY }"
            @click="switchPlaylist(playerStore.LOCAL_TARGET_KEY)"
          >
            <el-icon><Files /></el-icon>
            <span>本地歌单</span>
            <el-icon v-if="playerStore.targetKey === playerStore.LOCAL_TARGET_KEY" class="active-mark"><Histogram /></el-icon>
          </button>
        </div>

        <div class="playlist-section-title">云端歌单</div>
        <div v-if="userStore.isLoggedIn && playerStore.cloudPlaylists.length" class="mode-list compact-list">
          <button
            v-for="playlist in playerStore.cloudPlaylists"
            :key="playlist.id"
            class="mode-item"
            :class="{ active: playerStore.targetKey === `cloud:${playlist.id}` }"
            @click="switchPlaylist(`cloud:${playlist.id}`)"
          >
            <el-icon><Tickets /></el-icon>
            <span>{{ playlist.name }}</span>
            <el-icon v-if="playerStore.targetKey === `cloud:${playlist.id}`" class="active-mark"><Histogram /></el-icon>
          </button>
        </div>
        <div v-else class="queue-empty cloud-empty">
          {{ userStore.isLoggedIn ? '当前还没有云端歌单。' : '登录后可查看并切换你的云端歌单。' }}
        </div>

        <button class="create-cloud-trigger" @click="toggleCreateCloud">
          <el-icon><FolderAdd /></el-icon>
          {{ createCloudOpen ? '收起新建云端歌单' : '新建云端歌单' }}
        </button>

        <div v-if="createCloudOpen" class="create-cloud-box">
          <el-input v-model="createName" placeholder="输入歌单名称" maxlength="32" show-word-limit />
          <el-input
            v-model="createDescription"
            type="textarea"
            :rows="3"
            maxlength="300"
            show-word-limit
            placeholder="写一点描述（可选）"
          />
          <label class="public-toggle">
            <input v-model="createIsPublic" type="checkbox">
            <span class="toggle-icon">
              <el-icon v-if="createIsPublic"><Link /></el-icon>
              <el-icon v-else><Lock /></el-icon>
            </span>
            <span>{{ createIsPublic ? '公开歌单' : '私密歌单' }}</span>
          </label>
          <button class="submit-create-btn" :disabled="creatingPlaylist" @click="handleCreateCloudPlaylist">
            <el-icon><Plus /></el-icon>
            {{ creatingPlaylist ? '创建中…' : '确认创建' }}
          </button>
        </div>
      </div>
    </transition>

    <transition name="queue-fade">
      <div v-if="playerStore.queuePanelOpen" class="floating-panel queue-panel">
        <div class="queue-head">
          <div>
            <strong class="queue-title">当前歌单</strong>
            <p class="queue-subtitle">
              {{ playerStore.playlistName }} · 共 {{ playerStore.queue.length }} 首
            </p>
          </div>
          <div class="queue-head-actions">
            <button
              v-if="!playerStore.isLocalTarget && playerStore.currentPlaylistId"
              class="queue-manage-btn"
              title="管理歌单"
              @click="router.push('/playlist/' + playerStore.currentPlaylistId); playerStore.closePanels()"
            >
              管理
            </button>
            <button class="queue-close-btn" @click="playerStore.toggleQueuePanel">收起</button>
          </div>
        </div>

        <div
          v-if="playerStore.queue.length"
          class="queue-list"
        >
          <div
            v-for="(item, index) in playerStore.queue"
            :key="`${item.songId}-${index}`"
            class="queue-item"
            :class="{
              active: index === playerStore.currentIndex,
              'drag-over': playerStore.isLocalTarget && dragOverIndex === index && dragFromIndex !== index,
              'dragging': playerStore.isLocalTarget && dragFromIndex === index,
            }"
            :draggable="playerStore.isLocalTarget ? 'true' : 'false'"
            @click="playerStore.playAt(index)"
            @dragstart="playerStore.isLocalTarget && onDragStart($event, index)"
            @dragover="playerStore.isLocalTarget && onDragOver($event, index)"
            @drop="playerStore.isLocalTarget && onDrop($event, index)"
            @dragend="onDragEnd"
          >
            <span v-if="playerStore.isLocalTarget" class="drag-handle">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
                <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
                <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
              </svg>
            </span>
            <img :src="item.coverUrl" :alt="item.title" class="queue-cover" draggable="false">
            <div class="queue-copy">
              <strong class="queue-song-title">{{ item.title }}</strong>
              <span class="queue-song-meta">{{ item.uploaderName }}</span>
            </div>
            <span class="queue-duration">{{ formatDuration(item.durationSeconds) }}</span>
            <button
              v-if="playerStore.isLocalTarget"
              class="queue-delete-btn"
              title="从本地歌单移除"
              @click.stop="playerStore.removeLocalSong(index)"
            >
              <el-icon><Delete /></el-icon>
            </button>
          </div>
        </div>
        <div v-else class="queue-empty">这个歌单暂时没有歌曲。</div>
      </div>
    </transition>

    <transition name="queue-fade">
      <div v-if="modePanelOpen" class="floating-panel mode-panel">
        <div class="mode-head">
          <strong class="queue-title">播放设置</strong>
          <span class="queue-subtitle">选择下一首的播放逻辑</span>
        </div>
        <div class="mode-list">
          <button
            v-for="option in modeOptions"
            :key="option.id"
            class="mode-item"
            :class="{ active: playerStore.playMode === option.id }"
            @click="setMode(option.id)"
          >
            <el-icon><component :is="option.icon" /></el-icon>
            <span>{{ option.label }}</span>
            <el-icon v-if="playerStore.playMode === option.id" class="active-mark"><Histogram /></el-icon>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.global-player-wrap {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  width: min(1320px, calc(100vw - 28px));
  z-index: 1200;
}

.global-player-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  padding: 14px 18px;
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--theme-color) 18%, var(--hw-border));
  background: color-mix(in srgb, var(--hw-bg-header) 92%, #111 8%);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.14);
}

.player-song-block {
  min-width: 0;
  display: flex;
  align-items: stretch;
  gap: 14px;
}

.cover-box {
  position: relative;
  align-self: stretch;
  height: auto;
  aspect-ratio: 1 / 1;
  width: auto;
  min-width: 0;
  flex: 0 0 auto;
  border-radius: 16px;
  overflow: hidden;
  background: var(--hw-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hw-text-tertiary);
  font-size: 28px;
}

.cover-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.song-copy {
  min-width: 0;
  flex: 1;
}

.song-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.song-title {
  min-width: 0;
  font-size: 15px;
  font-weight: 800;
  color: var(--hw-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-name-chip {
  flex-shrink: 0;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--theme-color-light);
  color: var(--theme-color);
  font-size: 11px;
  font-weight: 700;
}

.song-subtitle {
  margin-top: 3px;
  color: var(--hw-text-secondary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeline-row {
  margin-top: 10px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.progress-group {
  min-width: 0;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  gap: 10px;
  align-items: center;
}

.volume-readout,
.time-text,
.queue-subtitle,
.queue-duration,
.queue-song-meta,
.queue-empty,
.volume-value,
.playlist-section-title {
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.volume-readout {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  min-width: 0;
  white-space: nowrap;
}

.player-control-block {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  min-height: 68px;
  flex-shrink: 0;
}

.top-tools-row,
.button-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: auto;
  flex-wrap: nowrap;
  flex-shrink: 0;
}

.top-tools-row {
  align-self: flex-end;
}

.button-group {
  align-self: flex-end;
}

.player-btn,
.icon-tool-btn,
.queue-close-btn,
.mode-item,
.queue-item,
.create-cloud-trigger,
.submit-create-btn {
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.player-btn,
.icon-tool-btn,
.queue-close-btn {
  border: 1px solid transparent;
  color: var(--hw-text-primary);
  cursor: pointer;
}

.player-btn {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ghost-btn,
.icon-tool-btn {
  background: transparent;
}

.play-btn {
  background: var(--theme-color);
  color: #fff;
}

.play-icon {
  font-size: 18px;
  transform: translateX(1px);
}

.pause-bars {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 14px;
  height: 14px;
}

.pause-bars span {
  width: 3px;
  height: 14px;
  border-radius: 999px;
  background: currentColor;
}

.player-btn:hover,
.icon-tool-btn:hover,
.queue-close-btn:hover {
  background: var(--hw-bg-hover);
}

.play-btn:hover {
  background: color-mix(in srgb, var(--theme-color) 86%, #000 14%);
}

.icon-tool-btn {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.floating-panel {
  position: absolute;
  right: 0;
  bottom: calc(100% + 12px);
  padding: 16px;
  border-radius: 22px;
  background: color-mix(in srgb, var(--hw-bg-header) 94%, #101010 6%);
  border: 1px solid var(--hw-border);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(18px);
}

.queue-panel {
  width: min(460px, calc(100vw - 28px));
}

.mode-panel,
.volume-panel,
.playlist-panel {
  width: min(300px, calc(100vw - 28px));
}

.playlist-panel {
  width: min(380px, calc(100vw - 28px));
}

.queue-head,
.mode-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
}

.queue-head {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.queue-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.queue-manage-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--hw-border);
  background: transparent;
  color: var(--theme-color);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.queue-manage-btn:hover {
  background: var(--theme-color-light);
}

.queue-title,
.queue-song-title {
  color: var(--hw-text-primary);
}

.queue-list,
.mode-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compact-list {
  margin-bottom: 12px;
}

.playlist-section-title {
  margin: 10px 0 8px;
  font-weight: 700;
}

.queue-list {
  max-height: 360px;
  overflow: auto;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--hw-border);
  border-radius: 16px;
  background: var(--hw-bg-primary);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease;
  user-select: none;
  -webkit-user-select: none;
  box-sizing: border-box;
}

.queue-item:hover .queue-delete-btn {
  opacity: 1;
}

.queue-item[draggable='true'] {
  cursor: grab;
}

.queue-item[draggable='true']:active {
  cursor: grabbing;
}

.queue-item.dragging {
  opacity: 0.4;
}

.queue-item.drag-over {
  border-color: var(--theme-color);
  background: var(--theme-color-light);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-color) 20%, transparent);
}

.drag-handle {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  color: var(--hw-text-tertiary);
  opacity: 0;
  transition: opacity 0.15s;
  cursor: grab;
}

.queue-item:hover .drag-handle {
  opacity: 1;
}

.queue-delete-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--hw-text-tertiary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
  margin-left: auto;
}

.queue-delete-btn:hover {
  background: color-mix(in srgb, #ef4444 15%, transparent);
  color: #ef4444;
}

.mode-item,
.create-cloud-trigger,
.submit-create-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--hw-border);
  border-radius: 14px;
  background: var(--hw-bg-primary);
  color: var(--hw-text-primary);
  cursor: pointer;
}

.submit-create-btn {
  justify-content: center;
  background: var(--theme-color);
  color: #fff;
  border-color: transparent;
}

.mode-item.active,
.queue-item.active {
  border-color: color-mix(in srgb, var(--theme-color) 48%, var(--hw-border));
  background: var(--theme-color-light);
}

.mode-item:hover,
.queue-item:hover,
.create-cloud-trigger:hover {
  background: color-mix(in srgb, var(--hw-bg-hover) 75%, #000 25%);
}

.submit-create-btn:hover {
  background: color-mix(in srgb, var(--theme-color) 86%, #000 14%);
}

.active-mark {
  margin-left: auto;
  color: var(--theme-color);
}

.queue-cover {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  object-fit: cover;
  flex-shrink: 0;
}

.queue-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.queue-song-title,
.queue-song-meta {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-close-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 10px;
  background: transparent;
}

.volume-edit-row {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) 40px;
  gap: 10px;
  align-items: center;
}

.volume-panel-icon {
  color: var(--hw-text-tertiary);
}

.cloud-empty {
  margin-bottom: 12px;
}

.create-cloud-box {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid var(--hw-border);
  background: color-mix(in srgb, var(--hw-bg-primary) 88%, #000 12%);
}

.public-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--hw-text-secondary);
  font-size: 13px;
}

.public-toggle input {
  display: none;
}

.toggle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
}

.player-btn:disabled,
.icon-tool-btn:disabled,
.submit-create-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.queue-fade-enter-active,
.queue-fade-leave-active {
  transition: all 0.2s ease;
}

.queue-fade-enter-from,
.queue-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

:deep(.el-slider__runway) {
  margin: 0;
}

:deep(.el-slider__bar) {
  background: var(--theme-color);
}

:deep(.el-slider__button) {
  border-color: var(--theme-color);
}

@media (max-width: 980px) {
  .global-player-bar {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .player-control-block {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    min-height: unset;
    gap: 8px;
  }

  .top-tools-row {
    align-self: center;
  }

  .button-group {
    align-self: center;
  }
}

@media (max-width: 768px) {
  .global-player-wrap {
    bottom: 10px;
    width: calc(100vw - 16px);
  }

  .global-player-bar {
    padding: 12px;
    border-radius: 20px;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .player-song-block {
    align-items: flex-start;
  }

  .player-control-block {
    justify-content: space-between;
    flex-direction: row;
    align-items: center;
    min-height: unset;
    gap: 10px;
  }

  .timeline-row {
    grid-template-columns: minmax(0, 1fr) 76px;
    gap: 8px;
  }

  .progress-group {
    grid-template-columns: 32px minmax(0, 1fr) 32px;
    gap: 6px;
  }

  .floating-panel {
    right: 0;
    left: 0;
    width: auto;
  }
}
</style>
