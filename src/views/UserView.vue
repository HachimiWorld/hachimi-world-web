<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  mdiAccount,
  mdiAlertCircleOutline,
  mdiCheck,
  mdiClose,
  mdiHeadphones,
  mdiPencil,
  mdiPlaylistMusic,
  mdiGenderFemale,
  mdiGenderMale,
} from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import SongCard from '@/components/SongCard.vue'
import { ApiError } from '@/api/request'
import {
  getUserProfile,
  getSongsByUser,
  updateUserProfile,
  setUserAvatar,
  type Song,
  type UserProfile,
} from '@/api/song'
import { type PlaylistItem } from '@/api/playlist'
import { http } from '@/api/request'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'

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

const PAGE_SIZE = 12

const uid = computed(() => Number(route.params.uid))
const isOwnProfile = computed(() => userStore.isLoggedIn && userStore.userInfo?.uid === uid.value)

// ── 头像上传 ──
const avatarInputRef = ref<HTMLInputElement | null>(null)
const avatarUploading = ref(false)

function triggerAvatarUpload() {
  if (!isOwnProfile.value) return
  avatarInputRef.value?.click()
}

async function onAvatarSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 8 * 1024 * 1024) { ElMessage.error('图片不能超过 8MB'); return }
  avatarUploading.value = true
  try {
    await setUserAvatar(file)
    ElMessage.success('头像已更新')
    await loadProfile()
    // loadProfile 完成后同步 userStore 头像，AppHeader 自动响应
    if (userStore.userInfo && profile.value?.avatar_url !== undefined) {
      const newAvatarUrl = profile.value.avatar_url
      userStore.userInfo = { ...userStore.userInfo, avatar_url: newAvatarUrl }
      // 同步持久化到 localStorage，刷新后 restoreSession 仍能读到正确头像
      if (newAvatarUrl) {
        localStorage.setItem('hachimi_avatar_url', newAvatarUrl)
      } else {
        localStorage.removeItem('hachimi_avatar_url')
      }
    }
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '上传失败')
  } finally {
    avatarUploading.value = false
    if (avatarInputRef.value) avatarInputRef.value.value = ''
  }
}

// ── 行内编辑 ──
const editingField = ref<'username' | 'bio' | 'gender' | null>(null)
const editValue = ref('')
const editLoading = ref(false)

function startEdit(field: 'username' | 'bio' | 'gender') {
  if (!isOwnProfile.value) return
  editingField.value = field
  if (field === 'username') editValue.value = profile.value?.username ?? ''
  else if (field === 'bio') editValue.value = profile.value?.bio ?? ''
  else if (field === 'gender') editValue.value = String(profile.value?.gender ?? '')
}

function cancelEdit() {
  editingField.value = null
  editValue.value = ''
}

async function submitEdit() {
  if (!profile.value) return
  editLoading.value = true
  try {
    const username = editingField.value === 'username' ? editValue.value.trim() : profile.value.username
    const bio = editingField.value === 'bio' ? (editValue.value.trim() || null) : (profile.value.bio ?? null)
    const gender = editingField.value === 'gender'
      ? (editValue.value === '' ? null : Number(editValue.value))
      : (profile.value.gender ?? null)
    await updateUserProfile({ username, bio, gender })
    ElMessage.success('资料已更新')
    editingField.value = null
    await loadProfile()
    if (userStore.userInfo) userStore.userInfo.username = profile.value?.username ?? userStore.userInfo.username
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '更新失败')
  } finally {
    editLoading.value = false
  }
}

const profileLoading = ref(true)
const songsLoading = ref(true)
const profile = ref<UserProfile | null>(null)
const songs = ref<Song[]>([])
const totalSongs = ref(0)
const currentPage = ref(0)
const pageError = ref('')
const playlists = ref<PlaylistItem[]>([])
const playlistsLoading = ref(false)

function formatCount(n?: number | null) {
  if (!n) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function getDescription() {
  return profile.value?.bio || '这个人很神秘，还没有留下个人简介。'
}

const genderIcon = computed(() => {
  if (profile.value?.gender === 0) return mdiGenderMale
  if (profile.value?.gender === 1) return mdiGenderFemale
  return mdiAccount
})

const genderText = computed(() => {
  if (profile.value?.gender === 0) return '男人'
  if (profile.value?.gender === 1) return '女人'
  return '神没有性别'
})

async function loadProfile() {
  profileLoading.value = true
  try {
    profile.value = await getUserProfile(uid.value)
  } catch (e) {
    console.error('加载用户信息失败', e instanceof ApiError ? e.msg : e)
    pageError.value = e instanceof ApiError ? e.msg : '加载用户信息失败'
    profile.value = null
  } finally {
    profileLoading.value = false
  }
}

async function loadSongs(page = 0) {
  songsLoading.value = true

  try {
    const resp = await getSongsByUser({
      uid: uid.value,
      page,
      pageSize: PAGE_SIZE,
    })
    songs.value = resp.songs
    totalSongs.value = resp.total
    currentPage.value = page
  } catch (e) {
    console.error('加载用户作品失败', e instanceof ApiError ? e.msg : e)
    pageError.value = e instanceof ApiError ? e.msg : '加载用户作品失败'
    songs.value = []
  } finally {
    songsLoading.value = false
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
  songs.value = []
  totalSongs.value = 0
  currentPage.value = 0
  playlists.value = []

  await Promise.all([
    loadProfile(),
    loadSongs(0),
    (async () => {
      playlistsLoading.value = true
      try { playlists.value = await fetchPublicPlaylistsByUser(uid.value) }
      catch { playlists.value = [] }
      finally { playlistsLoading.value = false }
    })(),
  ])
}

async function handlePageChange(page: number) {
  await loadSongs(page - 1)
}

watch(uid, () => {
  loadPage()
})

onMounted(() => {
  loadPage()
})
</script>

<template>
  <div class="user-view">
    <div class="user-shell">
      <section class="profile-hero">
        <div v-if="profileLoading" class="profile-card skeleton-card">
          <el-skeleton animated>
            <template #template>
              <div class="hero-skeleton">
                <el-skeleton-item variant="circle" class="avatar-skeleton" />
                <div class="hero-skeleton-info">
                  <el-skeleton-item variant="h3" style="width: 180px" />
                  <el-skeleton-item variant="text" style="width: 120px; margin-top: 10px" />
                  <el-skeleton-item variant="text" style="width: 90%; margin-top: 16px" />
                </div>
              </div>
            </template>
          </el-skeleton>
        </div>

        <div v-else-if="profile" class="profile-card">
          <div class="profile-main">
            <!-- 头像区域 -->
            <div class="avatar-wrap" :class="{ 'is-owner': isOwnProfile }" @click="triggerAvatarUpload">
              <el-avatar
                :size="104"
                :src="profile.avatar_url ?? undefined"
                class="profile-avatar"
                :class="{ uploading: avatarUploading }"
              >
                {{ profile.username?.[0] ?? '神' }}
              </el-avatar>
              <div v-if="isOwnProfile" class="avatar-overlay">
                <span v-if="avatarUploading" class="avatar-overlay-text">上传中…</span>
                <span v-else class="avatar-overlay-text">更换头像</span>
              </div>
              <input
                ref="avatarInputRef"
                type="file"
                accept="image/*"
                style="display:none"
                @change="onAvatarSelected"
              />
            </div>

            <div class="profile-copy">
              <!-- 昵称行内编辑 -->
              <div class="profile-heading-row">
                <div class="profile-name-block">
                  <template v-if="editingField === 'username'">
                    <div class="inline-edit-row">
                      <el-input
                        v-model="editValue"
                        size="large"
                        maxlength="10"
                        show-word-limit
                        class="inline-edit-input name-input"
                        @keyup.enter="submitEdit"
                        @keyup.esc="cancelEdit"
                      />
                      <button class="inline-edit-btn confirm" :disabled="editLoading" @click="submitEdit"><MdiIcon :path="mdiCheck" size="16px" /></button>
                      <button class="inline-edit-btn cancel" @click="cancelEdit"><MdiIcon :path="mdiClose" size="16px" /></button>
                    </div>
                  </template>
                  <h1
                    v-else
                    class="profile-name"
                    :class="{ editable: isOwnProfile }"
                    :title="isOwnProfile ? '点击修改昵称' : ''"
                    @click="startEdit('username')"
                  >{{ profile.username }}</h1>

                  <!-- 性别行 -->
                  <template v-if="editingField === 'gender'">
                    <div class="inline-edit-row" style="margin-top:6px">
                      <el-select v-model="editValue" size="small" style="width:120px" placeholder="选择性别">
                        <el-option label="神没有性别" value="" />
                        <el-option label="非女人" value="0" />
                        <el-option label="非男人" value="1" />
                      </el-select>
                      <button class="inline-edit-btn confirm" :disabled="editLoading" @click="submitEdit"><MdiIcon :path="mdiCheck" size="16px" /></button>
                      <button class="inline-edit-btn cancel" @click="cancelEdit"><MdiIcon :path="mdiClose" size="16px" /></button>
                    </div>
                  </template>
                  <p
                    v-else
                    class="profile-subline"
                    :class="{ editable: isOwnProfile }"
                    :title="isOwnProfile ? '点击修改性别' : ''"
                    @click="isOwnProfile ? startEdit('gender') : undefined"
                  >
                    UID {{ profile.uid }}
                    <span class="subline-dot">·</span>
                    <MdiIcon class="gender-icon" :path="genderIcon" size="16px" />
                    {{ genderText }}
                  </p>
                </div>
              </div>

              <!-- 签名行内编辑 -->
              <template v-if="editingField === 'bio'">
                <div class="inline-edit-col" style="margin-top:12px">
                  <el-input
                    v-model="editValue"
                    type="textarea"
                    :rows="2"
                    maxlength="300"
                    show-word-limit
                    placeholder="写点什么介绍自己…"
                    @keyup.esc="cancelEdit"
                  />
                  <div class="inline-edit-row" style="margin-top:6px">
                    <button class="inline-edit-btn confirm" :disabled="editLoading" @click="submitEdit"><MdiIcon :path="mdiCheck" size="16px" />保存</button>
                    <button class="inline-edit-btn cancel" @click="cancelEdit"><MdiIcon :path="mdiClose" size="16px" />取消</button>
                  </div>
                </div>
              </template>
              <p
                v-else
                class="profile-bio"
                :class="{ editable: isOwnProfile }"
                :title="isOwnProfile ? '点击修改签名' : ''"
                @click="isOwnProfile ? startEdit('bio') : undefined"
              >{{ getDescription() }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="works-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">全部神作</h2>
            <p class="panel-subtitle">
              共 {{ formatCount(totalSongs) }} 首
            </p>
          </div>
        </div>

        <div v-if="pageError && !profileLoading && !songsLoading" class="state-card error-state">
          <MdiIcon :path="mdiAlertCircleOutline" size="20px" />
          <span>{{ pageError }}</span>
        </div>

        <div v-else-if="songsLoading" class="song-grid">
          <div v-for="i in PAGE_SIZE" :key="i" class="song-skeleton-card">
            <div class="user-song-skel-cover"></div>
            <div class="user-song-skel-info">
              <div class="user-song-skel-line user-song-skel-title"></div>
              <div class="user-song-skel-line user-song-skel-sub"></div>
              <div class="user-song-skel-line user-song-skel-meta"></div>
            </div>
          </div>
        </div>

        <template v-else>
          <div v-if="songs.length" class="song-grid">
            <SongCard
              v-for="song in songs"
              :key="song.id"
              :song="song"
            />
          </div>

          <div v-else class="state-card empty-state">
            <MdiIcon :path="mdiHeadphones" size="20px" />
            <span>这个人还没有公开发布作品</span>
          </div>

          <div v-if="songs.length && totalSongs > PAGE_SIZE" class="panel-footer">
            <el-pagination
              background
              layout="prev, pager, next"
              :current-page="currentPage + 1"
              :page-size="PAGE_SIZE"
              :total="totalSongs"
              @current-change="handlePageChange"
            />
          </div>
        </template>
      </section>

      <!-- 公开歌单 -->
      <section v-if="playlistsLoading || playlists.length" class="works-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">公开歌单</h2>
            <p class="panel-subtitle">共 {{ playlists.length }} 个</p>
          </div>
        </div>
        <div v-if="playlistsLoading" class="playlist-grid">
          <div v-for="i in 3" :key="i" class="playlist-skeleton-card">
            <div class="pl-skel-inner">
              <div class="pl-skel-cover"></div>
              <div class="pl-skel-info">
                <div class="pl-skel-topline">
                  <div class="pl-skel-line pl-skel-name"></div>
                  <div class="pl-skel-line pl-skel-count"></div>
                </div>
                <div class="pl-skel-line pl-skel-desc"></div>
                <div class="pl-skel-line pl-skel-desc short"></div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="playlist-grid">
          <div
            v-for="pl in playlists"
            :key="pl.id"
            class="playlist-card"
            @click="router.push('/playlist/' + pl.id)"
          >
            <div class="pl-cover-wrap">
              <img v-if="pl.cover_url" :src="pl.cover_url" :alt="pl.name" class="pl-cover-img" />
              <div v-else class="pl-cover-placeholder">♫</div>
            </div>
            <div class="pl-main">
              <div class="pl-topline">
                <span class="pl-name">{{ pl.name }}</span>
                <span class="pl-count">{{ pl.songs_count }} 首</span>
              </div>
              <p class="pl-desc">{{ pl.description || '这个歌单还没有填写简介。' }}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.user-view {
  min-height: calc(100vh - var(--hw-header-height));
  padding: 22px 16px 40px;
  background: var(--hw-bg-primary);
}

.user-shell {
  max-width: 1180px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.profile-card,
.works-panel,
.state-card,
.song-skeleton-card {
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
  border-radius: 18px;
}

.profile-card {
  overflow: hidden;
  position: relative;
  padding: 26px;
  background: var(--hw-bg-secondary);
}

.profile-main {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 22px;
  align-items: center;
}

.avatar-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-avatar {
  border: 3px solid color-mix(in srgb, var(--theme-color) 28%, transparent);
  transition: filter 0.18s ease;
}

.avatar-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 104px;
  height: 104px;
}

.avatar-wrap.is-owner {
  cursor: pointer;
}

.avatar-wrap.is-owner:hover .profile-avatar {
  filter: brightness(0.55);
}

.avatar-wrap.is-owner:hover .avatar-overlay {
  opacity: 1;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.18s ease;
  pointer-events: none;
}

.avatar-overlay-text {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  text-align: center;
  line-height: 1.3;
  padding: 0 8px;
}

/* 行内编辑 */
.profile-name.editable,
.profile-subline.editable,
.profile-bio.editable {
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}

.profile-name.editable:hover,
.profile-subline.editable:hover,
.profile-bio.editable:hover {
  background: color-mix(in srgb, var(--theme-color) 8%, transparent);
}

.profile-name-block {
  min-width: 0;
}

.inline-edit-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.inline-edit-col {
  display: flex;
  flex-direction: column;
}

.inline-edit-input.name-input {
  font-size: 24px;
  font-weight: 800;
}

.inline-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
  color: var(--hw-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.inline-edit-btn.confirm {
  border-color: var(--theme-color);
  background: var(--theme-color);
  color: #fff;
}

.inline-edit-btn.confirm:hover {
  background: color-mix(in srgb, var(--theme-color) 85%, #000);
}

.inline-edit-btn.cancel:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.inline-edit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.profile-copy {
  min-width: 0;
}

.profile-heading-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.profile-name {
  font-size: 32px;
  line-height: 1.1;
  font-weight: 800;
  color: var(--hw-text-primary);
  letter-spacing: -0.6px;
}

.profile-subline {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--hw-text-tertiary);
}

.subline-dot {
  opacity: 0.7;
}

.gender-icon {
  font-size: 14px;
  color: var(--theme-color);
}

.profile-bio {
  margin-top: 16px;
  max-width: 760px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--hw-text-secondary);
}




.works-panel {
  padding: 22px;
}

.panel-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.panel-title {
  font-size: 22px;
  line-height: 1.15;
  font-weight: 800;
  color: var(--hw-text-primary);
  letter-spacing: -0.4px;
}

.panel-subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: var(--hw-text-tertiary);
}

.song-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.song-skeleton-card {
  background: var(--hw-bg-secondary);
  border: none;
  border-radius: 10px;
  overflow: hidden;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.user-song-skel-cover {
  width: 100%;
  aspect-ratio: 1;
  display: block;
  border-radius: 7px;
  background: linear-gradient(
    90deg,
    var(--hw-bg-primary) 25%,
    var(--hw-bg-hover) 50%,
    var(--hw-bg-primary) 75%
  );
  background-size: 400% 100%;
  animation: el-skeleton-loading 1.4s ease infinite;
}

.user-song-skel-info {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.user-song-skel-line {
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--hw-bg-primary) 25%,
    var(--hw-bg-hover) 50%,
    var(--hw-bg-primary) 75%
  );
  background-size: 400% 100%;
  animation: el-skeleton-loading 1.4s ease infinite;
}

.user-song-skel-title {
  width: 85%;
  height: 13px;
}

.user-song-skel-sub {
  width: 55%;
}

.user-song-skel-meta {
  width: 70%;
  margin-top: 1px;
}

.hero-skeleton {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 22px;
  align-items: center;
}

.avatar-skeleton {
  width: 104px;
  height: 104px;
}

.panel-footer {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

:deep(.el-select) {
  --el-color-primary: var(--theme-color);
  --el-color-primary-light-3: color-mix(in srgb, var(--theme-color) 70%, white);
  --el-color-primary-light-5: color-mix(in srgb, var(--theme-color) 50%, white);
  --el-color-primary-light-7: color-mix(in srgb, var(--theme-color) 30%, white);
  --el-color-primary-light-8: color-mix(in srgb, var(--theme-color) 20%, white);
  --el-color-primary-light-9: color-mix(in srgb, var(--theme-color) 10%, white);
  /* 覆盖 EP 内部 fill 变量，防止深色模式下 wrapper 被强制渲染为白色 */
  --el-fill-color-blank: var(--hw-bg-input);
  --el-input-bg-color: var(--hw-bg-input);
  --el-text-color-regular: var(--hw-text-primary);
  --el-text-color-placeholder: var(--hw-text-tertiary);
  --el-border-color: var(--hw-border);
}

:deep(.el-select .el-input__wrapper) {
  background-color: var(--hw-bg-input) !important;
  box-shadow: 0 0 0 1px var(--hw-border) inset !important;
}

:deep(.el-select .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--theme-color) inset !important;
}

:deep(.el-select .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--theme-color) inset !important;
}

:deep(.el-select .el-input__inner) {
  color: var(--hw-text-primary) !important;
  background-color: transparent !important;
}

:deep(.el-select-dropdown) {
  --el-color-primary: var(--theme-color);
  background-color: var(--hw-bg-secondary);
  border-color: var(--hw-border);
}

:deep(.el-select-dropdown__item) {
  color: var(--hw-text-primary);
}

:deep(.el-select-dropdown__item.is-hovering) {
  background-color: var(--hw-bg-hover);
}

:deep(.el-select-dropdown__item.is-selected) {
  color: var(--theme-color);
  font-weight: 600;
}
:deep(.el-pagination.is-background .btn-next),
:deep(.el-pagination.is-background .btn-prev),
:deep(.el-pagination.is-background .el-pager li) {
  background: var(--hw-bg-primary);
  border: 1px solid var(--hw-border);
  color: var(--hw-text-secondary);
}

:deep(.el-pagination.is-background .el-pager li.is-active) {
  background: var(--theme-color);
  border-color: var(--theme-color);
  color: #fff;
}

.state-card {
  min-height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--hw-text-tertiary);
}

.error-state {
  color: #ff7875;
}

.empty-state :deep(.el-icon),
.error-state :deep(.el-icon) {
  font-size: 18px;
}

@media (max-width: 1100px) {
  .song-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .playlist-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .profile-card {
    padding: 20px;
  }

  .profile-main,
  .hero-skeleton {
    grid-template-columns: 1fr;
  }

  .avatar-wrap {
    justify-content: flex-start;
  }

  .profile-heading-row,
  .panel-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .song-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .playlist-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.playlist-card,
.playlist-skeleton-card {
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

.playlist-card:hover {
  background: var(--hw-bg-hover);
  border-color: color-mix(in srgb, var(--theme-color) 30%, var(--hw-border));
}

.pl-cover-wrap {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
}

.pl-cover-img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 10px;
  display: block;
}

.pl-cover-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 10px;
  background: var(--hw-bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hw-text-tertiary);
  font-size: 26px;
}

.pl-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.pl-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.pl-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--hw-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.pl-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.pl-desc {
  margin-top: 7px;
  font-size: 12px;
  color: var(--hw-text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pl-skel-inner {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  width: 100%;
}

.pl-skel-cover {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 10px;
  background: linear-gradient(
    90deg,
    var(--hw-bg-primary) 25%,
    var(--hw-bg-hover) 50%,
    var(--hw-bg-primary) 75%
  );
  background-size: 400% 100%;
  animation: el-skeleton-loading 1.4s ease infinite;
}

.pl-skel-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.pl-skel-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.pl-skel-line {
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--hw-bg-primary) 25%,
    var(--hw-bg-hover) 50%,
    var(--hw-bg-primary) 75%
  );
  background-size: 400% 100%;
  animation: el-skeleton-loading 1.4s ease infinite;
}

.pl-skel-name {
  width: 58%;
  height: 14px;
}

.pl-skel-count {
  width: 42px;
  flex-shrink: 0;
}

.pl-skel-desc {
  width: 88%;
  margin-top: 8px;
}

.pl-skel-desc.short {
  width: 68%;
  margin-top: 6px;
}

@media (max-width: 1100px) {
  .playlist-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .playlist-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .playlist-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .user-view {
    padding: 16px 12px 28px;
  }

  .profile-card,
  .works-panel {
    padding: 16px;
    border-radius: 16px;
  }

  .profile-name {
    font-size: 26px;
  }

  .profile-bio {
    margin-top: 12px;
    font-size: 13px;
    line-height: 1.7;
  }

  .song-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
}
</style>
