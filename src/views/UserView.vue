<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  mdiAlertCircleOutline,
  mdiGenderFemale,
  mdiGenderMale,
  mdiOpenInNew,
  mdiPencil,
  mdiPlay,
  mdiPlaylistMusic,
} from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import bilibiliColorUrl from '@/assets/bilibili-color.svg'
import SongCard from '@/components/SongCard.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import { ApiError, http } from '@/api/request'
import {
  getUserProfile,
  getSongsByUser,
  updateUserProfile,
  setUserAvatar,
  listMyConnections,
  unlinkConnection,
  generateConnectionChallenge,
  verifyConnectionChallenge,
  type ConnectionItem,
  type Song,
  type UserProfile,
} from '@/api/song'
import { type PlaylistItem } from '@/api/playlist'
import { followErrorMessage, followUser, unfollowUser } from '@/api/follow'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { usePlayerStore } from '@/stores/player'
import { ElMessage, ElMessageBox } from 'element-plus'

async function fetchPublicPlaylistsByUser(userId: number): Promise<PlaylistItem[]> {
  const authStore = useAuthStore()
  let token: string | undefined
  if (authStore.isLoggedIn) {
    token = (await authStore.ensureValidToken()) ?? undefined
  }
  const resp = await http.get<{ playlists: PlaylistItem[] }>(`/playlist/list_public_by_user?user_id=${userId}`, token)
  return resp.playlists
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const userStore = useUserStore()
const playerStore = usePlayerStore()

const PAGE_SIZE = 12
type TabKey = 'songs' | 'playlists' | 'activity'

const uid = computed(() => Number(route.params.uid))
const isOwnProfile = computed(() => userStore.isLoggedIn && userStore.userInfo?.uid === uid.value)

const activeTab = ref<TabKey>('songs')
const profileLoading = ref(true)
const songsLoading = ref(true)
const profile = ref<UserProfile | null>(null)
const songs = ref<Song[]>([])
const totalSongs = ref(0)
const currentPage = ref(0)
const pageError = ref('')
const playlists = ref<PlaylistItem[]>([])
const playlistsLoading = ref(false)
const followLoading = ref(false)
const loginDialogOpen = ref(false)

const avatarInputRef = ref<HTMLInputElement | null>(null)
const avatarUploading = ref(false)
const editDialogOpen = ref(false)
const editUsername = ref('')
const editBio = ref('')
const editGender = ref<string>('')
const editLoading = ref(false)
const bilibiliActionLoading = ref(false)
const myConnections = ref<ConnectionItem[]>([])

const isFollowing = computed(() => profile.value?.is_following === true)
const followButtonLabel = computed(() => {
  if (!isFollowing.value) return '关注'
  if (profile.value?.is_followed_by) return '互相关注'
  return '已关注'
})

const genderIcon = computed(() => {
  if (profile.value?.gender === 0) return mdiGenderMale
  if (profile.value?.gender === 1) return mdiGenderFemale
  return null
})

const bilibiliAccount = computed(() => {
  // 本人优先用 connection/list（含非公开绑定）
  if (isOwnProfile.value) {
    const mine = myConnections.value.find((a) => a.type === 'bilibili')
    if (mine) return { id: mine.id, name: mine.name || null }
  }

  const currentProfile = profile.value
  if (!currentProfile) return null
  const connected = currentProfile.connected_accounts?.find((a) => a.type === 'bilibili')
  if (connected) {
    return { id: connected.id, name: connected.name || null }
  }
  if (currentProfile.bilibili_uid || currentProfile.bilibili_name) {
    return {
      id: currentProfile.bilibili_uid ? String(currentProfile.bilibili_uid) : null,
      name: currentProfile.bilibili_name || null,
    }
  }
  return null
})

function formatCount(n?: number | null) {
  if (!n) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function triggerAvatarUpload() {
  if (!isOwnProfile.value) return
  avatarInputRef.value?.click()
}

async function onAvatarSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 8 * 1024 * 1024) {
    ElMessage.error('图片不能超过 8MB')
    return
  }
  avatarUploading.value = true
  try {
    await setUserAvatar(file)
    ElMessage.success('头像已更新')
    await loadProfile()
    if (userStore.userInfo && profile.value?.avatar_url !== undefined) {
      const newAvatarUrl = profile.value.avatar_url
      userStore.userInfo = { ...userStore.userInfo, avatar_url: newAvatarUrl }
      if (newAvatarUrl) localStorage.setItem('hachimi_avatar_url', newAvatarUrl)
      else localStorage.removeItem('hachimi_avatar_url')
    }
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '上传失败')
  } finally {
    avatarUploading.value = false
    if (avatarInputRef.value) avatarInputRef.value.value = ''
  }
}

function openEditDialog() {
  if (!profile.value) return
  editUsername.value = profile.value.username
  editBio.value = profile.value.bio ?? ''
  editGender.value = profile.value.gender === null || profile.value.gender === undefined
    ? ''
    : String(profile.value.gender)
  editDialogOpen.value = true
}

async function submitEdit() {
  if (!profile.value) return
  editLoading.value = true
  try {
    await updateUserProfile({
      username: editUsername.value.trim(),
      bio: editBio.value.trim() || null,
      gender: editGender.value === '' ? null : Number(editGender.value),
    })
    ElMessage.success('资料已更新')
    editDialogOpen.value = false
    await loadProfile()
    if (userStore.userInfo) {
      userStore.userInfo.username = profile.value?.username ?? userStore.userInfo.username
    }
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '更新失败')
  } finally {
    editLoading.value = false
  }
}

function openBilibiliProfile() {
  if (!bilibiliAccount.value?.id) return
  window.open(`https://space.bilibili.com/${bilibiliAccount.value.id}`, '_blank', 'noopener,noreferrer')
}

async function handleBindBilibili() {
  try {
    const { value } = await ElMessageBox.prompt('请输入要绑定的哔哩哔哩 UID', '绑定哔哩哔哩账号', {
      confirmButtonText: '下一步',
      cancelButtonText: '取消',
      inputPlaceholder: 'UID',
      inputPattern: /^\d+$/,
      inputErrorMessage: '请输入纯数字 UID',
    })
    const providerAccountId = value.trim()
    if (!providerAccountId) return
    bilibiliActionLoading.value = true
    const challenge = await generateConnectionChallenge('bilibili', providerAccountId)
    await ElMessageBox.alert(
      `请前往哔哩哔哩个人主页，将签名修改为以「${challenge.challenge}」结尾，然后点击确定继续校验。`,
      `验证账号：${challenge.provider_account_name}`,
      { confirmButtonText: '我已完成，开始校验' },
    )
    await verifyConnectionChallenge(challenge.challenge_id)
    ElMessage.success('哔哩哔哩账号绑定成功')
    await loadProfile()
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e instanceof ApiError ? e.msg : '绑定失败')
  } finally {
    bilibiliActionLoading.value = false
  }
}

async function handleUnbindBilibili() {
  try {
    await ElMessageBox.confirm('确定要解除当前绑定的哔哩哔哩账号吗？', '解绑哔哩哔哩账号', {
      confirmButtonText: '解绑',
      cancelButtonText: '取消',
      type: 'warning',
    })
    bilibiliActionLoading.value = true
    await unlinkConnection('bilibili')
    ElMessage.success('已解除哔哩哔哩绑定')
    await loadProfile()
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e instanceof ApiError ? e.msg : '解绑失败')
  } finally {
    bilibiliActionLoading.value = false
  }
}

async function loadMyConnections() {
  if (!isOwnProfile.value) {
    myConnections.value = []
    return
  }
  try {
    const resp = await listMyConnections()
    myConnections.value = resp.items
  } catch {
    myConnections.value = []
  }
}

async function loadProfile() {
  profileLoading.value = true
  try {
    profile.value = await getUserProfile(uid.value)
    await loadMyConnections()
  } catch (e) {
    pageError.value = e instanceof ApiError ? e.msg : '加载用户信息失败'
    profile.value = null
    myConnections.value = []
  } finally {
    profileLoading.value = false
  }
}

function openFollowers() {
  if (!isOwnProfile.value) return
  router.push('/followers')
}

function openFollowing() {
  if (!isOwnProfile.value) return
  router.push('/feed')
}

async function handleFollow() {
  if (!profile.value || isOwnProfile.value || followLoading.value) return
  if (!userStore.isLoggedIn) {
    loginDialogOpen.value = true
    return
  }
  followLoading.value = true
  try {
    const resp = await followUser(profile.value.uid)
    profile.value = {
      ...profile.value,
      is_following: true,
      follower_count: resp.follower_count,
    }
    ElMessage.success('已关注')
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? (followErrorMessage(e.code) || e.msg) : '关注失败')
  } finally {
    followLoading.value = false
  }
}

async function handleUnfollow() {
  if (!profile.value || isOwnProfile.value || followLoading.value) return
  try {
    await ElMessageBox.confirm(
      '该用户将从你的关注列表中移除',
      `确定不再关注 ${profile.value.username}？`,
      { confirmButtonText: '不再关注', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  followLoading.value = true
  try {
    const resp = await unfollowUser(profile.value.uid)
    profile.value = {
      ...profile.value,
      is_following: false,
      follower_count: resp.follower_count,
    }
    ElMessage.success('已取消关注')
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? (followErrorMessage(e.code) || e.msg) : '取消关注失败')
  } finally {
    followLoading.value = false
  }
}

async function loadSongs(page = 0) {
  songsLoading.value = true
  try {
    const resp = await getSongsByUser({ uid: uid.value, page, pageSize: PAGE_SIZE })
    songs.value = resp.songs
    totalSongs.value = resp.total
    currentPage.value = page
  } catch (e) {
    pageError.value = e instanceof ApiError ? e.msg : '加载用户作品失败'
    songs.value = []
  } finally {
    songsLoading.value = false
  }
}

async function loadPlaylists() {
  playlistsLoading.value = true
  try {
    playlists.value = await fetchPublicPlaylistsByUser(uid.value)
  } catch {
    playlists.value = []
  } finally {
    playlistsLoading.value = false
  }
}

async function loadPage() {
  if (!Number.isFinite(uid.value) || uid.value <= 0) {
    pageError.value = '用户 ID 无效'
    profile.value = null
    songs.value = []
    profileLoading.value = false
    songsLoading.value = false
    return
  }
  pageError.value = ''
  activeTab.value = 'songs'
  songs.value = []
  totalSongs.value = 0
  currentPage.value = 0
  playlists.value = []
  await Promise.all([loadProfile(), loadSongs(0), loadPlaylists()])
}

async function playAll() {
  if (!songs.value.length) return
  await playerStore.replaceLocalQueueAndPlay(
    songs.value.map((song) => ({
      song_id: song.id,
      song_display_id: song.display_id,
      title: song.title,
      subtitle: song.subtitle,
      cover_url: song.cover_url,
      uploader_name: song.uploader_name,
      uploader_uid: song.uploader_uid,
      duration_seconds: song.duration_seconds,
      order_index: 0,
      add_time: '',
    })),
  )
}

watch(uid, () => {
  void loadPage()
})

onMounted(() => {
  void loadPage()
})
</script>

<template>
  <div class="user-view">
    <div class="user-shell">
      <!-- Header：对齐 App HeaderProfileContent -->
      <section v-if="profileLoading" class="profile-header skeleton">
        <div class="avatar-skel" />
        <div class="info-skel">
          <div class="line w-40" />
          <div class="line w-70" />
          <div class="line w-30" />
        </div>
      </section>

      <section v-else-if="profile" class="profile-header">
        <div
          class="avatar-wrap"
          :class="{ owner: isOwnProfile }"
          @click="triggerAvatarUpload"
        >
          <img
            v-if="profile.avatar_url"
            :src="profile.avatar_url"
            :alt="profile.username"
            class="avatar"
          >
          <div v-else class="avatar fallback">{{ profile.username?.[0] ?? '神' }}</div>
          <div v-if="isOwnProfile" class="avatar-overlay">
            {{ avatarUploading ? '上传中…' : '更换头像' }}
          </div>
          <input
            ref="avatarInputRef"
            type="file"
            accept="image/*"
            hidden
            @change="onAvatarSelected"
          >
        </div>

        <div class="profile-info">
          <div class="name-row">
            <h1 class="username">{{ profile.username }}</h1>
            <button
              v-if="isOwnProfile"
              type="button"
              class="edit-btn"
              @click="openEditDialog"
            >
              <MdiIcon :path="mdiPencil" size="16px" />
              编辑资料
            </button>
          </div>

          <p v-if="profile.bio?.trim()" class="bio">{{ profile.bio }}</p>

          <div class="meta-row">
            <MdiIcon v-if="genderIcon" class="gender-icon" :path="genderIcon" size="16px" />
            <span>UID: {{ profile.uid }}</span>
          </div>

          <div class="stats-row">
            <div class="stats">
              <button
                type="button"
                class="stat-item"
                :class="{ clickable: isOwnProfile }"
                :disabled="!isOwnProfile"
                @click="openFollowers"
              >
                <strong>{{ formatCount(profile.follower_count) }}</strong>
                <span>粉丝</span>
              </button>
              <button
                type="button"
                class="stat-item"
                :class="{ clickable: isOwnProfile }"
                :disabled="!isOwnProfile"
                @click="openFollowing"
              >
                <strong>{{ formatCount(profile.following_count) }}</strong>
                <span>关注</span>
              </button>
            </div>

            <button
              v-if="!isOwnProfile"
              type="button"
              class="follow-btn"
              :class="{ following: isFollowing }"
              :disabled="followLoading"
              @click="isFollowing ? handleUnfollow() : handleFollow()"
            >
              {{ followLoading ? '处理中…' : followButtonLabel }}
            </button>
          </div>

          <div v-if="bilibiliAccount || isOwnProfile" class="connections">
            <button
              v-if="bilibiliAccount"
              type="button"
              class="connection-chip"
              @click="openBilibiliProfile"
            >
              <img :src="bilibiliColorUrl" alt="哔哩哔哩" class="chip-icon">
              <span>{{ bilibiliAccount.name || `UID ${bilibiliAccount.id}` }}</span>
              <MdiIcon :path="mdiOpenInNew" size="14px" />
            </button>

            <button
              v-else-if="isOwnProfile"
              type="button"
              class="connection-chip"
              :disabled="bilibiliActionLoading"
              @click="handleBindBilibili"
            >
              <img :src="bilibiliColorUrl" alt="哔哩哔哩" class="chip-icon">
              <span>{{ bilibiliActionLoading ? '处理中…' : '绑定哔哩哔哩' }}</span>
            </button>

            <button
              v-if="isOwnProfile && bilibiliAccount"
              type="button"
              class="connection-chip"
              :disabled="bilibiliActionLoading"
              @click="handleUnbindBilibili"
            >
              <img :src="bilibiliColorUrl" alt="哔哩哔哩" class="chip-icon">
              <span>{{ bilibiliActionLoading ? '处理中…' : '解绑哔哩哔哩' }}</span>
            </button>
          </div>
        </div>
      </section>

      <div v-else-if="pageError" class="state-block">
        <MdiIcon :path="mdiAlertCircleOutline" size="22px" />
        <p>{{ pageError }}</p>
      </div>

      <!-- Tabs：作品 / 歌单 / 动态 -->
      <template v-if="profile">
        <div class="tab-bar">
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'songs' }"
            @click="activeTab = 'songs'"
          >作品</button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'playlists' }"
            @click="activeTab = 'playlists'"
          >歌单</button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'activity' }"
            @click="activeTab = 'activity'"
          >动态</button>
        </div>

        <!-- 作品 -->
        <div v-if="activeTab === 'songs'" class="tab-panel">
          <button
            v-if="songs.length"
            type="button"
            class="play-all-btn"
            @click="playAll"
          >
            <MdiIcon :path="mdiPlay" size="18px" />
            播放全部
          </button>

          <div v-if="songsLoading" class="song-grid">
            <div v-for="i in 8" :key="i" class="song-skel" />
          </div>
          <div v-else-if="songs.length" class="song-grid">
            <SongCard v-for="song in songs" :key="song.id" :song="song" />
          </div>
          <div v-else class="state-block compact">
            <p>什么也没有</p>
          </div>

          <div v-if="songs.length && totalSongs > PAGE_SIZE" class="pager">
            <el-pagination
              background
              layout="prev, pager, next"
              :current-page="currentPage + 1"
              :page-size="PAGE_SIZE"
              :total="totalSongs"
              @current-change="(p: number) => loadSongs(p - 1)"
            />
          </div>
        </div>

        <!-- 歌单 -->
        <div v-else-if="activeTab === 'playlists'" class="tab-panel">
          <div v-if="playlistsLoading" class="state-block compact">
            <div class="loading-dot" />
          </div>
          <div v-else-if="playlists.length" class="playlist-list">
            <button
              v-for="pl in playlists"
              :key="pl.id"
              type="button"
              class="playlist-card"
              @click="router.push(`/playlist/${pl.id}`)"
            >
              <div class="pl-cover">
                <img v-if="pl.cover_url" :src="pl.cover_url" :alt="pl.name">
                <MdiIcon v-else :path="mdiPlaylistMusic" size="22px" />
              </div>
              <div class="pl-info">
                <span class="pl-name">{{ pl.name }}</span>
                <span class="pl-count">{{ pl.songs_count }} 首</span>
              </div>
            </button>
          </div>
          <div v-else class="state-block compact">
            <p>什么也没有</p>
          </div>
        </div>

        <!-- 动态 -->
        <div v-else class="tab-panel">
          <div class="state-block compact">
            <p>即将推出</p>
          </div>
        </div>
      </template>
    </div>

    <el-dialog
      v-model="editDialogOpen"
      title="编辑资料"
      width="420px"
      destroy-on-close
    >
      <div class="edit-form">
        <label>昵称</label>
        <el-input v-model="editUsername" maxlength="10" show-word-limit />
        <label>简介</label>
        <el-input v-model="editBio" type="textarea" :rows="3" maxlength="300" show-word-limit />
        <label>性别</label>
        <el-select v-model="editGender" placeholder="选择性别" style="width: 100%">
          <el-option label="神没有性别" value="" />
          <el-option label="非女人" value="0" />
          <el-option label="非男人" value="1" />
        </el-select>
      </div>
      <template #footer>
        <el-button @click="editDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <LoginDialog v-model="loginDialogOpen" />
  </div>
</template>

<style scoped>
.user-view {
  min-height: calc(100vh - var(--hw-header-height));
  background: var(--hw-bg-primary);
  padding: 0 16px 80px;
}

.user-shell {
  max-width: 1080px;
  margin: 0 auto;
}

/* ── Header ── */
.profile-header {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  padding: 8px 0 24px;
}

.avatar-wrap {
  position: relative;
  width: 180px;
  height: 180px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  background: var(--hw-bg-hover);
}

.avatar-wrap.owner {
  cursor: pointer;
}

.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar.fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 700;
  color: var(--hw-text-secondary);
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.15s;
}

.avatar-wrap.owner:hover .avatar-overlay {
  opacity: 1;
}

.profile-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.username {
  font-size: 22px;
  font-weight: 700;
  color: var(--hw-text-primary);
  line-height: 1.3;
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--hw-border);
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 10px;
  cursor: pointer;
}

.edit-btn:hover {
  border-color: var(--theme-color);
  color: var(--theme-color);
}

.bio {
  font-size: 14px;
  line-height: 1.5;
  color: color-mix(in srgb, var(--hw-text-primary) 70%, transparent);
  white-space: pre-wrap;
  word-break: break-word;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--hw-text-secondary);
}

.gender-icon {
  color: var(--hw-text-secondary);
}

.stats-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
  flex-wrap: wrap;
}

.stats {
  display: flex;
  gap: 32px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border: none;
  background: transparent;
  padding: 0;
  color: var(--hw-text-primary);
  cursor: default;
}

.stat-item.clickable {
  cursor: pointer;
}

.stat-item.clickable:hover strong {
  color: var(--theme-color);
}

.stat-item strong {
  font-size: 16px;
  font-weight: 600;
}

.stat-item span {
  font-size: 12px;
  color: var(--hw-text-secondary);
}

.follow-btn {
  min-width: 88px;
  min-height: 36px;
  padding: 8px 16px;
  border-radius: 12px;
  border: none;
  background: var(--theme-color);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.follow-btn.following {
  background: transparent;
  border: 1px solid var(--hw-border);
  color: var(--hw-text-secondary);
  font-weight: 500;
}

.follow-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.connections {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.connection-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
  color: var(--hw-text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.connection-chip:hover:not(:disabled) {
  border-color: #fb7299;
  color: #fb7299;
}

.connection-chip:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chip-icon {
  width: 16px;
  height: 16px;
}

/* skeleton */
.profile-header.skeleton {
  align-items: center;
}

.avatar-skel {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: var(--hw-bg-secondary);
}

.info-skel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-skel .line {
  height: 16px;
  border-radius: 8px;
  background: var(--hw-bg-secondary);
}

.w-40 { width: 40%; }
.w-70 { width: 70%; }
.w-30 { width: 30%; }

/* ── Tabs ── */
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 8px 0 16px;
  border-bottom: 1px solid var(--hw-border);
  margin-bottom: 16px;
}

.tab {
  border: none;
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 15px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 10px;
  cursor: pointer;
}

.tab:hover {
  color: var(--hw-text-primary);
}

.tab.active {
  color: var(--theme-color);
  background: var(--theme-color-light);
}

.tab-panel {
  min-height: 240px;
}

.play-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 8px 16px;
  border: none;
  border-radius: 12px;
  background: var(--theme-color);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.play-all-btn:hover {
  background: color-mix(in srgb, var(--theme-color) 85%, #000);
}

.song-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.song-skel {
  aspect-ratio: 1;
  border-radius: 12px;
  background: var(--hw-bg-secondary);
}

.playlist-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.playlist-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: var(--hw-bg-secondary);
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.playlist-card:hover {
  background: color-mix(in srgb, var(--hw-bg-secondary) 88%, var(--theme-color));
}

.pl-cover {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--hw-bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hw-text-tertiary);
  flex-shrink: 0;
}

.pl-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pl-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pl-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--hw-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pl-count {
  font-size: 12px;
  color: var(--hw-text-secondary);
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 280px;
  color: var(--hw-text-tertiary);
  text-align: center;
}

.state-block.compact {
  min-height: 200px;
}

.pager {
  display: flex;
  justify-content: center;
  padding: 24px 0 8px;
}

.loading-dot {
  width: 28px;
  height: 28px;
  border: 2px solid var(--hw-border);
  border-top-color: var(--theme-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-form label {
  margin-top: 8px;
  font-size: 13px;
  color: var(--hw-text-secondary);
}

@media (max-width: 720px) {
  .profile-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
  }

  .avatar-wrap,
  .avatar-skel {
    width: 120px;
    height: 120px;
  }

  .profile-info {
    align-items: center;
  }

  .name-row,
  .meta-row,
  .stats-row,
  .connections {
    justify-content: center;
  }

  .bio {
    text-align: center;
  }

  .stats-row {
    width: 100%;
    justify-content: center;
  }
}
</style>
