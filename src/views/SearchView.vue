<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, ArrowDown } from '@element-plus/icons-vue'
import { ApiError } from '@/api/request'
import {
  searchMusic,
  searchUsers,
  searchPlaylists,
  type MusicSearchItem,
  type UserSearchItem,
  type PlaylistSearchItem,
  type MusicSortBy,
} from '@/api/search'
import SearchSongCard from '@/components/SearchSongCard.vue'
import SearchUserCard from '@/components/SearchUserCard.vue'
import SearchPlaylistCard from '@/components/SearchPlaylistCard.vue'

const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 12

type SearchTab = 'music' | 'user' | 'playlist'

const currentTab = ref<SearchTab>('music')
const musicSort = ref<MusicSortBy>('relevance')
const currentPage = ref(1)
const loading = ref(false)
const errorText = ref('')
const processingTimeMs = ref<number | null>(null)
const total = ref(0)
const sortMenuOpen = ref(false)

const musicHits = ref<MusicSearchItem[]>([])
const userHits = ref<UserSearchItem[]>([])
const playlistHits = ref<PlaylistSearchItem[]>([])

const keyword = computed(() => String(route.query.q ?? '').trim())

const tabOptions: { id: SearchTab; label: string }[] = [
  { id: 'music', label: '音乐' },
  { id: 'user', label: '神人' },
  { id: 'playlist', label: '歌单' },
]

const sortOptions: { id: MusicSortBy; label: string }[] = [
  { id: 'relevance', label: '最相关' },
  { id: 'release_time_desc', label: '最新' },
  { id: 'release_time_asc', label: '最早' },
]

const activeSortLabel = computed(
  () => sortOptions.find((item) => item.id === musicSort.value)?.label ?? '最相关',
)

async function loadResults() {
  if (!keyword.value) {
    loading.value = false
    errorText.value = ''
    total.value = 0
    processingTimeMs.value = null
    musicHits.value = []
    userHits.value = []
    playlistHits.value = []
    return
  }

  loading.value = true
  errorText.value = ''

  try {
    if (currentTab.value === 'music') {
      const resp = await searchMusic({
        q: keyword.value,
        limit: PAGE_SIZE,
        offset: (currentPage.value - 1) * PAGE_SIZE,
        sortBy: musicSort.value,
      })
      musicHits.value = resp.hits
      processingTimeMs.value = resp.processing_time_ms
      total.value = resp.total_hits ?? resp.hits.length
    } else if (currentTab.value === 'user') {
      const resp = await searchUsers({
        q: keyword.value,
        page: currentPage.value - 1,
        size: PAGE_SIZE,
      })
      userHits.value = resp.hits
      processingTimeMs.value = resp.processing_time_ms
      total.value = resp.total_hits ?? resp.hits.length
    } else {
      const resp = await searchPlaylists({
        q: keyword.value,
        limit: PAGE_SIZE,
        offset: (currentPage.value - 1) * PAGE_SIZE,
      })
      playlistHits.value = resp.hits
      processingTimeMs.value = resp.processing_time_ms
      total.value = resp.total_hits ?? resp.hits.length
    }
  } catch (e) {
    errorText.value = e instanceof ApiError ? e.msg : '搜索失败，请稍后重试'
    processingTimeMs.value = null
    total.value = 0
    musicHits.value = []
    userHits.value = []
    playlistHits.value = []
  } finally {
    loading.value = false
  }
}

function switchTab(tab: SearchTab) {
  if (currentTab.value === tab) return
  currentTab.value = tab
  currentPage.value = 1
  sortMenuOpen.value = false
}

function changeSort(sort: MusicSortBy) {
  if (musicSort.value === sort) {
    sortMenuOpen.value = false
    return
  }
  musicSort.value = sort
  currentPage.value = 1
  sortMenuOpen.value = false
}

function toggleSortMenu() {
  sortMenuOpen.value = !sortMenuOpen.value
}

function handlePageChange(page: number) {
  currentPage.value = page
}

watch(keyword, () => {
  currentPage.value = 1
  loadResults()
})

watch([currentTab, currentPage, musicSort], () => {
  loadResults()
})

onMounted(() => {
  if (!keyword.value) {
    router.replace('/')
    return
  }
  loadResults()
})
</script>

<template>
  <div class="search-view">
    <div class="search-shell">
      <section class="search-head">
        <div class="title-row">
          <h1 class="search-title">搜索结果</h1>
          <span v-if="processingTimeMs !== null" class="search-time">耗时 {{ processingTimeMs }} ms</span>
        </div>

        <div class="tab-row">
          <div class="tab-group">
            <button
              v-for="tab in tabOptions"
              :key="tab.id"
              class="tab-btn"
              :class="{ active: currentTab === tab.id }"
              @click="switchTab(tab.id)"
            >
              {{ tab.label }}
            </button>
          </div>

          <div v-if="currentTab === 'music'" class="sort-select">
            <button
              class="sort-trigger"
              :class="{ open: sortMenuOpen }"
              @click="toggleSortMenu"
            >
              <span>{{ activeSortLabel }}</span>
              <el-icon class="sort-arrow" :class="{ open: sortMenuOpen }"><ArrowDown /></el-icon>
            </button>

            <div v-if="sortMenuOpen" class="sort-menu">
              <button
                v-for="sort in sortOptions"
                :key="sort.id"
                class="sort-option"
                :class="{ active: musicSort === sort.id }"
                @click="changeSort(sort.id)"
              >
                {{ sort.label }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="search-body">
        <div v-if="loading" class="result-grid">
          <template v-if="currentTab === 'music'">
            <div v-for="i in PAGE_SIZE" :key="`music-skeleton-${i}`" class="result-skeleton song-skeleton">
              <div class="song-skeleton-cover"></div>
              <div class="song-skeleton-main">
                <div class="song-skeleton-title"></div>
                <div class="song-skeleton-subtitle"></div>
                <div class="song-skeleton-desc">
                  <div class="song-skeleton-line long"></div>
                  <div class="song-skeleton-line short"></div>
                </div>
                <div class="song-skeleton-meta">
                  <div class="song-skeleton-chip creator"></div>
                  <div class="song-skeleton-chip duration"></div>
                  <div class="song-skeleton-chip count"></div>
                  <div class="song-skeleton-chip like"></div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="currentTab === 'user'">
            <div v-for="i in PAGE_SIZE" :key="`user-skeleton-${i}`" class="result-skeleton user-skeleton">
              <div class="user-skeleton-avatar"></div>
              <div class="user-skeleton-main">
                <div class="user-skeleton-topline">
                  <div class="user-skeleton-name"></div>
                  <div class="user-skeleton-gender"></div>
                </div>
                <div class="user-skeleton-uid"></div>
                <div class="user-skeleton-bio">
                  <div class="user-skeleton-line long"></div>
                  <div class="user-skeleton-line short"></div>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div v-for="i in PAGE_SIZE" :key="`playlist-skeleton-${i}`" class="result-skeleton playlist-skeleton">
              <div class="playlist-skeleton-cover"></div>
              <div class="playlist-skeleton-main">
                <div class="playlist-skeleton-topline">
                  <div class="playlist-skeleton-title"></div>
                  <div class="playlist-skeleton-count"></div>
                </div>
                <div class="playlist-skeleton-creator"></div>
                <div class="playlist-skeleton-desc">
                  <div class="playlist-skeleton-line long"></div>
                  <div class="playlist-skeleton-line short"></div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div v-else-if="errorText" class="state-card error-state">
          {{ errorText }}
        </div>

        <div
          v-else-if="(currentTab === 'music' && musicHits.length) || (currentTab === 'user' && userHits.length) || (currentTab === 'playlist' && playlistHits.length)"
          class="result-grid"
        >
          <SearchSongCard
            v-if="currentTab === 'music'"
            v-for="item in musicHits"
            :key="`song-${item.id}`"
            :item="item"
          />
          <SearchUserCard
            v-else-if="currentTab === 'user'"
            v-for="item in userHits"
            :key="`user-${item.uid}`"
            :item="item"
          />
          <SearchPlaylistCard
            v-else
            v-for="item in playlistHits"
            :key="`playlist-${item.id}`"
            :item="item"
          />
        </div>

        <div v-else class="state-card empty-state">
          <el-icon><Search /></el-icon>
          <span>没有找到相关结果</span>
        </div>

        <div v-if="!loading && total > PAGE_SIZE" class="pagination-wrap">
          <el-pagination
            background
            layout="prev, pager, next"
            :current-page="currentPage"
            :page-size="PAGE_SIZE"
            :total="total"
            @current-change="handlePageChange"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.search-view {
  min-height: calc(100vh - var(--hw-header-height));
  background: var(--hw-bg-primary);
}

.search-shell {
  max-width: 1220px;
  margin: 0 auto;
}

.search-head {
  margin-bottom: 22px;
}

.title-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.search-title {
  font-size: 30px;
  line-height: 1.1;
  font-weight: 800;
  color: var(--hw-text-primary);
  letter-spacing: -0.6px;
}

.search-time {
  font-size: 14px;
  color: var(--hw-text-tertiary);
  white-space: nowrap;
}

.search-keyword {
  margin-top: 8px;
  font-size: 14px;
  color: var(--hw-text-secondary);
}

.tab-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-top: 18px;
}

.tab-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tab-btn,
.sort-trigger,
.sort-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
  color: var(--hw-text-secondary);
  border-radius: 14px;
  padding: 0 16px;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.18s ease;
}

.tab-btn:hover,
.sort-trigger:hover,
.sort-option:hover {
  color: var(--hw-text-primary);
  border-color: var(--theme-color);
}

.tab-btn.active,
.sort-option.active {
  background: var(--theme-color);
  border-color: var(--theme-color);
  color: #fff;
}

.sort-select {
  position: relative;
  flex-shrink: 0;
}

.sort-trigger {
  gap: 8px;
  min-width: 108px;
}

.sort-trigger.open {
  border-color: var(--theme-color);
  color: var(--theme-color);
}

.sort-arrow {
  transition: transform 0.18s ease;
}

.sort-arrow.open {
  transform: rotate(180deg);
}

.sort-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 132px;
  padding: 10px;
  border-radius: 16px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-primary);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.12);
}

.sort-option {
  width: 100%;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.result-skeleton,
.song-skeleton,
.user-skeleton,
.playlist-skeleton {
  border-radius: 16px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
}

.song-skeleton,
.playlist-skeleton {
  display: flex;
  gap: 14px;
  min-width: 0;
  padding: 12px;
}

.user-skeleton {
  display: flex;
  gap: 14px;
  min-width: 0;
  align-items: center;
  padding: 14px;
}

.song-skeleton-cover,
.song-skeleton-title,
.song-skeleton-subtitle,
.song-skeleton-line,
.song-skeleton-chip,
.user-skeleton-avatar,
.user-skeleton-name,
.user-skeleton-gender,
.user-skeleton-uid,
.user-skeleton-line,
.playlist-skeleton-cover,
.playlist-skeleton-title,
.playlist-skeleton-count,
.playlist-skeleton-creator,
.playlist-skeleton-line {
  background: linear-gradient(
    90deg,
    var(--hw-bg-primary) 25%,
    var(--hw-bg-hover) 50%,
    var(--hw-bg-primary) 75%
  );
  background-size: 400% 100%;
  animation: el-skeleton-loading 1.4s ease infinite;
}

.song-skeleton-cover,
.playlist-skeleton-cover {
  width: 88px;
  height: 88px;
  border-radius: 12px;
  flex-shrink: 0;
}

.song-skeleton-main,
.playlist-skeleton-main,
.user-skeleton-main {
  min-width: 0;
  flex: 1;
}

.song-skeleton-main,
.playlist-skeleton-main {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.song-skeleton-title,
.playlist-skeleton-title,
.user-skeleton-name {
  height: 18px;
  border-radius: 999px;
}

.song-skeleton-title {
  width: 62%;
}

.song-skeleton-subtitle {
  width: 76%;
  height: 13px;
  border-radius: 999px;
  margin-top: 8px;
}

.song-skeleton-desc,
.user-skeleton-bio,
.playlist-skeleton-desc {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.song-skeleton-line,
.user-skeleton-line,
.playlist-skeleton-line {
  height: 12px;
  border-radius: 999px;
}

.song-skeleton-line.long,
.user-skeleton-line.long,
.playlist-skeleton-line.long {
  width: 92%;
}

.song-skeleton-line.short,
.user-skeleton-line.short,
.playlist-skeleton-line.short {
  width: 66%;
}

.song-skeleton-meta {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.song-skeleton-chip {
  height: 12px;
  border-radius: 999px;
}

.song-skeleton-chip.creator { width: 72px; }
.song-skeleton-chip.duration { width: 52px; }
.song-skeleton-chip.count { width: 58px; }
.song-skeleton-chip.like { width: 50px; }

.user-skeleton-avatar {
  width: 72px;
  height: 72px;
  border-radius: 999px;
  flex-shrink: 0;
}

.user-skeleton-topline,
.playlist-skeleton-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.user-skeleton-name {
  width: 34%;
}

.user-skeleton-gender {
  width: 56px;
  height: 12px;
  border-radius: 999px;
  flex-shrink: 0;
}

.user-skeleton-uid,
.playlist-skeleton-creator {
  height: 12px;
  border-radius: 999px;
  margin-top: 8px;
}

.user-skeleton-uid {
  width: 74px;
}

.playlist-skeleton-title {
  width: 56%;
}

.playlist-skeleton-count {
  width: 40px;
  height: 12px;
  border-radius: 999px;
  flex-shrink: 0;
}

.playlist-skeleton-creator {
  width: 84px;
}

.state-card {
  min-height: 180px;
  border: 1px solid var(--hw-border);
  border-radius: 18px;
  background: var(--hw-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--hw-text-tertiary);
}

.error-state {
  color: #ff7875;
}

.pagination-wrap {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

:deep(.el-pagination.is-background .btn-next),
:deep(.el-pagination.is-background .btn-prev),
:deep(.el-pagination.is-background .el-pager li) {
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
  color: var(--hw-text-secondary);
}

:deep(.el-pagination.is-background .el-pager li.is-active) {
  background: var(--theme-color);
  border-color: var(--theme-color);
  color: #fff;
}

@media (max-width: 1024px) {
  .result-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .title-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }

  .search-title {
    font-size: 26px;
  }

  .tab-row {
    flex-direction: column;
    align-items: stretch;
  }

  .tab-group {
    width: 100%;
  }

  .sort-select {
    align-self: flex-start;
  }

  .result-grid {
    grid-template-columns: 1fr;
  }
}
</style>

