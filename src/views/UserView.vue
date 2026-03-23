<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Headset, Warning, Male, Female, Avatar, Tickets } from '@element-plus/icons-vue'
import SongCard from '@/components/SongCard.vue'
import { ApiError } from '@/api/request'
import {
  getUserProfile,
  getSongsByUser,
  type Song,
  type UserProfile,
} from '@/api/song'
import { type PlaylistItem } from '@/api/playlist'
import { http } from '@/api/request'
import { useAuthStore } from '@/stores/auth'

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

const PAGE_SIZE = 12

const uid = computed(() => Number(route.params.uid))

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
  if (profile.value?.gender === 0) return Male
  if (profile.value?.gender === 1) return Female
  return Avatar
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
            <div class="avatar-wrap">
              <el-avatar
                :size="104"
                :src="profile.avatar_url ?? undefined"
                class="profile-avatar"
              >
                {{ profile.username?.[0] ?? '神' }}
              </el-avatar>
            </div>

            <div class="profile-copy">
              <div class="profile-heading-row">
                <div>
                  <h1 class="profile-name">{{ profile.username }}</h1>
                  <p class="profile-subline">
                    UID {{ profile.uid }}
                    <span class="subline-dot">·</span>
                    <el-icon class="gender-icon"><component :is="genderIcon" /></el-icon>
                    {{ genderText }}
                  </p>
                </div>
              </div>

              <p class="profile-bio">{{ getDescription() }}</p>
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
          <el-icon><Warning /></el-icon>
          <span>{{ pageError }}</span>
        </div>

        <div v-else-if="songsLoading" class="song-grid">
          <div v-for="i in PAGE_SIZE" :key="i" class="song-skeleton-card">
            <el-skeleton animated>
              <template #template>
                <el-skeleton-item variant="image" class="song-skel-cover" />
                <div class="song-skel-info">
                  <el-skeleton-item variant="p" style="width: 76%" />
                  <el-skeleton-item variant="p" style="width: 52%; margin-top: 6px" />
                </div>
              </template>
            </el-skeleton>
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
            <el-icon><Headset /></el-icon>
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
            <el-skeleton animated>
              <template #template>
                <div class="pl-skel-inner">
                  <el-skeleton-item variant="image" class="pl-skel-cover" />
                  <div class="pl-skel-info">
                    <el-skeleton-item variant="p" style="width:65%" />
                    <el-skeleton-item variant="p" style="width:40%;margin-top:8px" />
                    <el-skeleton-item variant="text" style="width:90%;margin-top:10px" />
                  </div>
                </div>
              </template>
            </el-skeleton>
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
  box-shadow: 0 14px 30px color-mix(in srgb, var(--theme-color) 18%, transparent);
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
  overflow: hidden;
}

.song-skel-cover {
  width: 100%;
  display: block;
}

.song-skel-info {
  padding: 10px 10px 12px;
}

:deep(.song-skel-cover .el-skeleton__image) {
  width: 100%;
  aspect-ratio: 1;
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
}

.pl-skel-cover {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 10px;
}

.pl-skel-info {
  flex: 1;
  padding-top: 4px;
}

:deep(.pl-skel-cover.el-skeleton__image) {
  width: 80px;
  height: 80px;
  border-radius: 10px;
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
