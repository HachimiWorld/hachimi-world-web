import { computed, ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import { ApiError } from '@/api/request'
import { getSongDetailById, type Song } from '@/api/song'
import {
  addSongToPlaylist,
  getMyPlaylists,
  getPlaylistDetailPrivate,
  type PlaylistItem,
  type PlaylistSongItem,
} from '@/api/playlist'
import { useAuthStore } from './auth'
import { touchPlayHistory } from '@/api/history'

export type PlayerPlayMode = 'sequence' | 'loop' | 'shuffle'
export type PlayerTargetType = 'local' | 'cloud'

export interface PlayerQueueItem {
  songId: number
  displayId: string
  title: string
  subtitle: string
  coverUrl: string
  uploaderName: string
  uploaderUid: number
  durationSeconds: number
  audioUrl: string | null
}

export interface PlayerTargetOption {
  key: string
  type: PlayerTargetType
  playlistId: number | null
  playlistName: string
}

interface PersistedPlayerState {
  queue: PlayerQueueItem[]
  currentIndex: number
  currentTime: number
  duration: number
  volume: number
  isPlaying: boolean
  playMode: PlayerPlayMode
}

interface PlayerSyncPayload {
  targetKey: string
  snapshot: PersistedPlayerState
}

const LOCAL_TARGET_KEY = 'local:default'
const CURRENT_KEY_STORAGE = 'hachimi_player_current_target_v2'
const TARGET_STATE_PREFIX = 'hachimi_player_target_state_v2:'
const CHANNEL_NAME = 'hachimi-player-sync-v2'

function makeCloudTargetKey(id: number) {
  return `cloud:${id}`
}

function createEmptyState(): PersistedPlayerState {
  return {
    queue: [],
    currentIndex: 0,
    currentTime: 0,
    duration: 0,
    volume: 0.72,
    isPlaying: false,
    playMode: 'sequence',
  }
}

function songToQueueItem(song: Song): PlayerQueueItem {
  return {
    songId: song.id,
    displayId: song.display_id,
    title: song.title,
    subtitle: song.subtitle,
    coverUrl: song.cover_url,
    uploaderName: song.uploader_name,
    uploaderUid: song.uploader_uid,
    durationSeconds: song.duration_seconds,
    audioUrl: song.audio_url || null,
  }
}

function playlistSongToQueueItem(item: PlaylistSongItem): PlayerQueueItem {
  return {
    songId: item.song_id,
    displayId: item.song_display_id,
    title: item.title,
    subtitle: item.subtitle,
    coverUrl: item.cover_url,
    uploaderName: item.uploader_name,
    uploaderUid: item.uploader_uid,
    durationSeconds: item.duration_seconds,
    audioUrl: null,
  }
}

export const usePlayerStore = defineStore('player', () => {
  const cloudPlaylists = ref<PlaylistItem[]>([])
  const targetKey = ref(LOCAL_TARGET_KEY)
  const playlistName = ref('本地歌单')
  const queue = ref<PlayerQueueItem[]>([])
  const currentIndex = ref(0)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(0.72)
  const isPlaying = ref(false)
  const playMode = ref<PlayerPlayMode>('sequence')
  const queuePanelOpen = ref(false)
  const initialized = ref(false)
  const loading = ref(false)

  const currentSong = computed(() => queue.value[currentIndex.value] ?? null)
  const hasQueue = computed(() => queue.value.length > 0)
  const isLocalTarget = computed(() => targetKey.value === LOCAL_TARGET_KEY)
  const currentPlaylistId = computed(() => {
    if (isLocalTarget.value) return null
    const [, id] = targetKey.value.split(':')
    return Number(id)
  })

  const availableTargets = computed<PlayerTargetOption[]>(() => {
    const base: PlayerTargetOption[] = [
      {
        key: LOCAL_TARGET_KEY,
        type: 'local',
        playlistId: null,
        playlistName: '本地歌单',
      },
    ]

    for (const playlist of cloudPlaylists.value) {
      base.push({
        key: makeCloudTargetKey(playlist.id),
        type: 'cloud',
        playlistId: playlist.id,
        playlistName: playlist.name,
      })
    }

    return base
  })

  let audio: HTMLAudioElement | null = null
  let channel: BroadcastChannel | null = null
  let applyingRemote = false
  let syncBound = false
  let lastTimeSync = 0
  let lastReportedSongId: number | null = null

  function getTargetStorageKey(key = targetKey.value) {
    return `${TARGET_STATE_PREFIX}${key}`
  }

  function setCurrentTargetName() {
    if (targetKey.value === LOCAL_TARGET_KEY) {
      playlistName.value = '本地歌单'
      return
    }
    const current = availableTargets.value.find((item) => item.key === targetKey.value)
    playlistName.value = current?.playlistName || '云端歌单'
  }

  function createAudio() {
    if (audio || typeof window === 'undefined') return

    audio = new Audio()
    audio.preload = 'metadata'
    audio.volume = volume.value

    audio.addEventListener('loadedmetadata', () => {
      duration.value = Number.isFinite(audio?.duration) ? (audio?.duration ?? 0) : 0
      persistState(false)
    })

    audio.addEventListener('timeupdate', () => {
      if (!audio) return
      currentTime.value = audio.currentTime || 0
      duration.value = audio.duration || currentSong.value?.durationSeconds || 0
      const now = Date.now()
      if (now - lastTimeSync > 800) {
        lastTimeSync = now
        persistState(true)
      }
    })

    audio.addEventListener('play', () => {
      isPlaying.value = true
      persistState(true)
    })

    audio.addEventListener('pause', () => {
      isPlaying.value = false
      persistState(true)
    })

    audio.addEventListener('ended', () => {
      void handleEnded()
    })
  }

  function cloneQueueItems(items: PlayerQueueItem[]) {
    return items.map((item) => ({
      songId: item.songId,
      displayId: item.displayId,
      title: item.title,
      subtitle: item.subtitle,
      coverUrl: item.coverUrl,
      uploaderName: item.uploaderName,
      uploaderUid: item.uploaderUid,
      durationSeconds: item.durationSeconds,
      audioUrl: item.audioUrl,
    }))
  }

  function snapshot(): PersistedPlayerState {
    return {
      queue: cloneQueueItems(toRaw(queue.value)),
      currentIndex: currentIndex.value,
      currentTime: currentTime.value,
      duration: duration.value,
      volume: volume.value,
      isPlaying: isPlaying.value,
      playMode: playMode.value,
    }
  }

  function applySnapshot(data: PersistedPlayerState) {
    applyingRemote = true
    queue.value = data.queue
    currentIndex.value = Math.max(0, Math.min(data.currentIndex, Math.max(data.queue.length - 1, 0)))
    currentTime.value = data.currentTime
    duration.value = data.duration
    volume.value = data.volume
    isPlaying.value = data.isPlaying
    playMode.value = data.playMode
    queuePanelOpen.value = false
    if (audio) {
      audio.volume = data.volume
    }
    void syncAudioToState(data.currentTime, data.isPlaying)
    applyingRemote = false
  }

  function persistState(shouldBroadcast = true) {
    if (typeof window === 'undefined' || applyingRemote) return
    const data = snapshot()
    localStorage.setItem(getTargetStorageKey(), JSON.stringify(data))
    localStorage.setItem(CURRENT_KEY_STORAGE, targetKey.value)
    if (shouldBroadcast) {
      channel?.postMessage({
        targetKey: targetKey.value,
        snapshot: data,
      } satisfies PlayerSyncPayload)
    }
  }

  function restoreTargetState(key: string) {
    const raw = localStorage.getItem(getTargetStorageKey(key))
    if (!raw) {
      applySnapshot(createEmptyState())
      return false
    }
    try {
      applySnapshot(JSON.parse(raw) as PersistedPlayerState)
      return true
    } catch {
      localStorage.removeItem(getTargetStorageKey(key))
      applySnapshot(createEmptyState())
      return false
    }
  }

  function setupSync() {
    if (typeof window === 'undefined' || syncBound) return
    syncBound = true

    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (event) => {
        const payload = event.data as PlayerSyncPayload
        if (!payload || payload.targetKey !== targetKey.value) return
        applySnapshot(payload.snapshot)
      }
    }

    window.addEventListener('storage', (event) => {
      if (event.key !== getTargetStorageKey(targetKey.value) || !event.newValue) return
      try {
        applySnapshot(JSON.parse(event.newValue) as PersistedPlayerState)
      } catch {
        // noop
      }
    })
  }

  async function ensureSongAudio(index = currentIndex.value) {
    const item = queue.value[index]
    if (!item) return null
    if (!item.audioUrl) {
      const detail = await getSongDetailById(item.songId)
      item.audioUrl = detail.audio_url || null
      item.coverUrl = detail.cover_url || item.coverUrl
      persistState(false)
    }
    return item
  }

  async function syncAudioToState(targetTime = currentTime.value, shouldPlay = isPlaying.value) {
    createAudio()
    const item = await ensureSongAudio()
    if (!item || !audio) return

    if (audio.src !== item.audioUrl) {
      audio.src = item.audioUrl || ''
      audio.load()
    }

    audio.volume = volume.value

    if (Math.abs(audio.currentTime - targetTime) > 1.2) {
      try {
        audio.currentTime = Math.max(0, targetTime)
      } catch {
        // noop
      }
    }

    if (shouldPlay) {
      try {
        await audio.play()
      } catch {
        isPlaying.value = false
        persistState(false)
      }
    } else {
      audio.pause()
    }
  }

  async function refreshCloudPlaylists() {
    const authStore = useAuthStore()
    if (!authStore.isLoggedIn) {
      cloudPlaylists.value = []
      return []
    }
    const resp = await getMyPlaylists()
    cloudPlaylists.value = resp.playlists
    setCurrentTargetName()
    return resp.playlists
  }

  function switchToLocal() {
    targetKey.value = LOCAL_TARGET_KEY
    restoreTargetState(LOCAL_TARGET_KEY)
    setCurrentTargetName()
    persistState(true)
  }

  async function switchToPlaylist(key: string) {
    if (key === LOCAL_TARGET_KEY) {
      switchToLocal()
      return
    }

    const authStore = useAuthStore()
    if (!authStore.isLoggedIn) {
      switchToLocal()
      return
    }

    const playlistId = Number(key.split(':')[1])
    await loadCloudPlaylist(playlistId, true)
  }

  async function loadCloudPlaylist(playlistId: number, preservePlaybackState = false) {
    loading.value = true
    try {
      const detail = await getPlaylistDetailPrivate(playlistId)
      const previousSongId = currentSong.value?.songId
      const previousIndex = currentIndex.value
      const previousTime = currentTime.value
      const previousDuration = duration.value
      const previousPlaying = isPlaying.value

      targetKey.value = makeCloudTargetKey(detail.playlist_info.id)
      playlistName.value = detail.playlist_info.name
      queue.value = detail.songs.map(playlistSongToQueueItem)

      if (preservePlaybackState) {
        const sameSongIndex = previousSongId
          ? queue.value.findIndex((item) => item.songId === previousSongId)
          : -1
        currentIndex.value = sameSongIndex >= 0 ? sameSongIndex : Math.min(previousIndex, Math.max(queue.value.length - 1, 0))
        currentTime.value = sameSongIndex >= 0 ? previousTime : 0
        duration.value = sameSongIndex >= 0 ? previousDuration : (currentSong.value?.durationSeconds ?? 0)
        isPlaying.value = previousPlaying && sameSongIndex >= 0
        persistState(true)
        await syncAudioToState(currentTime.value, isPlaying.value)
        return
      }

      currentIndex.value = 0
      currentTime.value = 0
      duration.value = currentSong.value?.durationSeconds ?? 0
      isPlaying.value = false
      persistState(true)
      await syncAudioToState(0, false)
    } finally {
      loading.value = false
    }
  }

  async function refreshCurrentCloudPlaylist() {
    if (isLocalTarget.value || !currentPlaylistId.value) return
    await loadCloudPlaylist(currentPlaylistId.value, true)
  }

  async function initialize() {
    if (!initialized.value) {
      createAudio()
      setupSync()
      initialized.value = true
    }

    await refreshCloudPlaylists().catch(() => {
      cloudPlaylists.value = []
    })

    switchToLocal()
  }

  function setPlayMode(mode: PlayerPlayMode) {
    playMode.value = mode
    persistState(true)
  }

  async function togglePlay() {
    if (!currentSong.value) return
    isPlaying.value = !isPlaying.value
    await syncAudioToState()
    persistState(true)
  }

  async function playAt(index: number) {
    if (index < 0 || index >= queue.value.length) return
    currentIndex.value = index
    currentTime.value = 0
    duration.value = currentSong.value?.durationSeconds ?? 0
    isPlaying.value = true
    await syncAudioToState(0, true)
    persistState(true)
    // 播放记录：单曲循环时不重复记录同一首
    const songId = queue.value[index]?.songId
    if (songId !== undefined) {
      const isLoopSame = playMode.value === 'loop' && lastReportedSongId === songId
      if (!isLoopSame) {
        lastReportedSongId = songId
        touchPlayHistory(songId).catch(() => undefined)
      }
    }
  }

  async function previous() {
    if (!queue.value.length) return
    if (currentTime.value > 5) {
      seek(0)
      return
    }

    if (playMode.value === 'shuffle' && queue.value.length > 1) {
      let nextIndex = currentIndex.value
      while (nextIndex === currentIndex.value) {
        nextIndex = Math.floor(Math.random() * queue.value.length)
      }
      await playAt(nextIndex)
      return
    }

    const nextIndex = currentIndex.value > 0
      ? currentIndex.value - 1
      : playMode.value === 'loop'
        ? queue.value.length - 1
        : 0
    await playAt(nextIndex)
  }

  async function next() {
    if (!queue.value.length) return

    if (playMode.value === 'loop') {
      await playAt(currentIndex.value)
      return
    }

    if (playMode.value === 'shuffle' && queue.value.length > 1) {
      let nextIndex = currentIndex.value
      while (nextIndex === currentIndex.value) {
        nextIndex = Math.floor(Math.random() * queue.value.length)
      }
      await playAt(nextIndex)
      return
    }

    if (currentIndex.value < queue.value.length - 1) {
      await playAt(currentIndex.value + 1)
      return
    }

    isPlaying.value = false
    seek(0)
    persistState(true)
  }

  async function handleEnded() {
    await next()
  }

  function seek(value: number) {
    currentTime.value = value
    if (audio) {
      audio.currentTime = value
    }
    persistState(true)
  }

  function setVolume(value: number) {
    volume.value = Math.min(1, Math.max(0, value))
    if (audio) {
      audio.volume = volume.value
    }
    persistState(true)
  }

  function toggleQueuePanel() {
    queuePanelOpen.value = !queuePanelOpen.value
  }

  function closePanels() {
    queuePanelOpen.value = false
  }

  async function addSongToLocalAndPlay(songId: number) {
    const detail = await getSongDetailById(songId)
    const item = songToQueueItem(detail)
    targetKey.value = LOCAL_TARGET_KEY
    setCurrentTargetName()
    const existedIndex = queue.value.findIndex((x) => x.songId === songId)
    if (existedIndex >= 0) {
      await playAt(existedIndex)
      return
    }
    queue.value = [...queue.value, item]
    await playAt(queue.value.length - 1)
  }

  async function addSongToCloudPlaylistAndPlay(songId: number, playlistId: number) {
    try {
      await addSongToPlaylist(playlistId, songId)
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== 'song_existed') {
        throw e
      }
    }

    await loadCloudPlaylist(playlistId)
    const targetIndex = queue.value.findIndex((item) => item.songId === songId)
    if (targetIndex >= 0) {
      await playAt(targetIndex)
    }
  }

  async function addSongToCloudPlaylist(songId: number, playlistId: number) {
    try {
      await addSongToPlaylist(playlistId, songId)
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== 'song_existed') {
        throw e
      }
    }

    const isCurrentTarget = currentPlaylistId.value === playlistId && !isLocalTarget.value
    if (isCurrentTarget) {
      await loadCloudPlaylist(playlistId, true)
      const targetIndex = queue.value.findIndex((item) => item.songId === songId)
      if (targetIndex >= 0) {
        await playAt(targetIndex)
      }
    }
  }

  async function addSongToTargetAndPlay(songId: number, target: PlayerTargetOption) {
    if (target.type === 'local') {
      await addSongToLocalAndPlay(songId)
      return
    }

    if (!target.playlistId) {
      throw new Error('云端歌单无效')
    }

    await addSongToCloudPlaylistAndPlay(songId, target.playlistId)
  }

  /** 把本地歌单替换为指定曲目列表并播放第一首（不管当前在播什么歌单） */
  async function replaceLocalQueueAndPlay(songs: PlaylistSongItem[]) {
    // 切换到本地歌单
    targetKey.value = LOCAL_TARGET_KEY
    playlistName.value = '本地歌单'
    // 清空并填入新曲目
    queue.value = songs.map(playlistSongToQueueItem)
    currentIndex.value = 0
    currentTime.value = 0
    duration.value = queue.value[0]?.durationSeconds ?? 0
    isPlaying.value = queue.value.length > 0
    persistState(true)
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    if (queue.value.length > 0) {
      await playAt(0)
    }
  }

  function reorderLocalQueue(fromIndex: number, toIndex: number) {
    if (!isLocalTarget.value) return
    if (fromIndex === toIndex) return
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= queue.value.length || toIndex >= queue.value.length) return
    const newQueue = [...queue.value]
    const [moved] = newQueue.splice(fromIndex, 1)
    newQueue.splice(toIndex, 0, moved)
    const wasCurrentIndex = currentIndex.value
    queue.value = newQueue
    // 更新 currentIndex 跟随被移动的歌曲
    if (wasCurrentIndex === fromIndex) {
      currentIndex.value = toIndex
    } else if (fromIndex < wasCurrentIndex && toIndex >= wasCurrentIndex) {
      currentIndex.value = wasCurrentIndex - 1
    } else if (fromIndex > wasCurrentIndex && toIndex <= wasCurrentIndex) {
      currentIndex.value = wasCurrentIndex + 1
    }
    persistState(true)
  }

  async function removeLocalSong(index: number) {
    if (!isLocalTarget.value) return
    if (index < 0 || index >= queue.value.length) return
    const wasPlaying = isPlaying.value
    const wasCurrentIndex = currentIndex.value
    const newQueue = [...queue.value]
    newQueue.splice(index, 1)
    queue.value = newQueue

    if (newQueue.length === 0) {
      // 队列空了，停止播放
      currentIndex.value = 0
      isPlaying.value = false
      if (audio) { audio.pause(); audio.src = '' }
      persistState(true)
      return
    }

    if (index < wasCurrentIndex) {
      // 删除的在当前播放前面，currentIndex 往前移一位，继续播放当前歌
      currentIndex.value = wasCurrentIndex - 1
      persistState(true)
    } else if (index === wasCurrentIndex) {
      // 删除的就是当前正在播放的歌
      // 让 index 保持（原来的下一首现在移到了这个位置）
      // 如果已经超出范围则回到最后一首
      const nextIndex = index < newQueue.length ? index : newQueue.length - 1
      currentIndex.value = nextIndex
      if (wasPlaying) {
        await playAt(nextIndex)
      } else {
        // 不在播放，只切换当前歌曲指针
        currentIndex.value = nextIndex
        persistState(true)
      }
    } else {
      // 删除的在当前播放后面，不影响 currentIndex
      persistState(true)
    }
  }

  function clearPlayer(removePersisted = true) {
    const key = targetKey.value
    applySnapshot(createEmptyState())
    setCurrentTargetName()
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    if (removePersisted && typeof window !== 'undefined') {
      localStorage.removeItem(getTargetStorageKey(key))
      channel?.postMessage({
        targetKey: key,
        snapshot: createEmptyState(),
      } satisfies PlayerSyncPayload)
    }
  }

  return {
    LOCAL_TARGET_KEY,
    cloudPlaylists,
    targetKey,
    playlistName,
    queue,
    currentIndex,
    currentSong,
    currentTime,
    duration,
    volume,
    isPlaying,
    playMode,
    queuePanelOpen,
    hasQueue,
    isLocalTarget,
    currentPlaylistId,
    availableTargets,
    loading,
    initialize,
    refreshCloudPlaylists,
    switchToLocal,
    switchToPlaylist,
    loadCloudPlaylist,
    refreshCurrentCloudPlaylist,
    setPlayMode,
    togglePlay,
    playAt,
    previous,
    next,
    seek,
    setVolume,
    toggleQueuePanel,
    closePanels,
    addSongToTargetAndPlay,
    addSongToCloudPlaylist,
    replaceLocalQueueAndPlay,
    removeLocalSong,
    reorderLocalQueue,
    clearPlayer,
  }
})
