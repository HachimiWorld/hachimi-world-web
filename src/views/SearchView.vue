<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import {
  mdiChevronDown,
  mdiFilterCogOutline,
  mdiMagnify,
} from '@mdi/js'
import { ApiError } from '@/api/request'
import {
  searchMusic,
  searchUsers,
  searchPlaylists,
  type MusicSearchItem,
  type UserSearchItem,
  type PlaylistSearchItem,
  type MusicSortBy,
  type PlaylistSortBy,
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
const playlistSort = ref<PlaylistSortBy>('relevance')
const loading = ref(false)
const loadingMore = ref(false)
const errorText = ref('')
const processingTimeMs = ref<number | null>(null)
const sortMenuOpen = ref(false)
const filterPanelOpen = ref(false)

const musicLoadedPages = ref(0)
const userLoadedPages = ref(0)
const playlistLoadedPages = ref(0)
const musicHasMore = ref(false)
const userHasMore = ref(false)
const playlistHasMore = ref(false)

// 音乐筛选条件
const filterExplicit = ref<'all' | 'only' | 'exclude'>('all')
const filterCreationType = ref<'' | '0' | '1' | '2'>('')

// 组合为 MeiliSearch filter 字符串，无条件时为 undefined（不传参数）
const musicFilter = computed(() => {
  const parts: string[] = []
  if (filterExplicit.value === 'only') parts.push('explicit = true')
  if (filterExplicit.value === 'exclude') parts.push('explicit = false')
  if (filterCreationType.value !== '') parts.push(`creation_type = ${filterCreationType.value}`)
  return parts.length ? parts.join(' AND ') : undefined
})

const isFilterActive = computed(
  () => filterExplicit.value !== 'all' || filterCreationType.value !== '',
)

const musicHits = ref<MusicSearchItem[]>([])
const userHits = ref<UserSearchItem[]>([])
const playlistHits = ref<PlaylistSearchItem[]>([])

const keyword = computed(() => String(route.query.q ?? '').trim())

const tabOptions: { id: SearchTab; label: string }[] = [
  { id: 'music', label: '音乐' },
  { id: 'user', label: '神人' },
  { id: 'playlist', label: '歌单' },
]

const musicSortOptions: { id: MusicSortBy; label: string }[] = [
  { id: 'relevance', label: '最相关' },
  { id: 'release_time_desc', label: '最新发布' },
  { id: 'release_time_asc', label: '最早发布' },
  { id: 'play_count_desc', label: '播放最多' },
  { id: 'play_count_asc', label: '播放最少' },
]

const playlistSortOptions: { id: PlaylistSortBy; label: string }[] = [
  { id: 'relevance', label: '最相关' },
  { id: 'create_time_desc', label: '最新创建' },
  { id: 'create_time_asc', label: '最早创建' },
  { id: 'update_time_desc', label: '最近更新' },
  { id: 'update_time_asc', label: '最早更新' },
]

const currentSortOptions = computed(() => {
  if (currentTab.value === 'music') return musicSortOptions
  if (currentTab.value === 'playlist') return playlistSortOptions
  return []
})

const activeSortLabel = computed(() => {
  if (currentTab.value === 'music')
    return musicSortOptions.find((o) => o.id === musicSort.value)?.label ?? '最相关'
  if (currentTab.value === 'playlist')
    return playlistSortOptions.find((o) => o.id === playlistSort.value)?.label ?? '最相关'
  return ''
})

async function loadResults(reset = true) {
  if (!keyword.value) {
    loading.value = false
    loadingMore.value = false
    errorText.value = ''
    processingTimeMs.value = null
    musicHits.value = []
    userHits.value = []
    playlistHits.value = []
    musicLoadedPages.value = 0
    userLoadedPages.value = 0
    playlistLoadedPages.value = 0
    musicHasMore.value = false
    userHasMore.value = false
    playlistHasMore.value = false
    return
  }

  if (reset) {
  loading.value = true
    loadingMore.value = false
  errorText.value = ''
  } else {
    loadingMore.value = true
  }

  try {
    if (currentTab.value === 'music') {
      const offset = reset ? 0 : musicHits.value.length
      const resp = await searchMusic({
        q: keyword.value,
        limit: PAGE_SIZE,
        offset,
        sortBy: musicSort.value,
        filter: musicFilter.value,
      })
      musicHits.value = reset ? resp.hits : [...musicHits.value, ...resp.hits]
      musicLoadedPages.value = Math.ceil(musicHits.value.length / PAGE_SIZE)
      musicHasMore.value = resp.hits.length === PAGE_SIZE
      processingTimeMs.value = resp.processing_time_ms
    } else if (currentTab.value === 'user') {
      const page = reset ? 0 : userLoadedPages.value
      const resp = await searchUsers({
        q: keyword.value,
        page,
        size: PAGE_SIZE,
      })
      userHits.value = reset ? resp.hits : [...userHits.value, ...resp.hits]
      userLoadedPages.value = reset ? 1 : userLoadedPages.value + 1
      userHasMore.value = resp.hits.length === PAGE_SIZE
      processingTimeMs.value = resp.processing_time_ms
    } else {
      const offset = reset ? 0 : playlistHits.value.length
      const resp = await searchPlaylists({
        q: keyword.value,
        limit: PAGE_SIZE,
        offset,
        sortBy: playlistSort.value,
      })
      playlistHits.value = reset ? resp.hits : [...playlistHits.value, ...resp.hits]
      playlistLoadedPages.value = Math.ceil(playlistHits.value.length / PAGE_SIZE)
      playlistHasMore.value = resp.hits.length === PAGE_SIZE
      processingTimeMs.value = resp.processing_time_ms
    }
  } catch (e) {
    errorText.value = e instanceof ApiError ? e.msg : '搜索失败，请稍后重试'
    processingTimeMs.value = null
    if (reset) {
    musicHits.value = []
    userHits.value = []
    playlistHits.value = []
      musicLoadedPages.value = 0
      userLoadedPages.value = 0
      playlistLoadedPages.value = 0
      musicHasMore.value = false
      userHasMore.value = false
      playlistHasMore.value = false
    }
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const currentHasMore = computed(() => {
  if (currentTab.value === 'music') return musicHasMore.value
  if (currentTab.value === 'user') return userHasMore.value
  return playlistHasMore.value
})

function loadMore() {
  if (!currentHasMore.value || loading.value || loadingMore.value) return
  loadResults(false)
}

function switchTab(tab: SearchTab) {
  if (currentTab.value === tab) return
  currentTab.value = tab
  sortMenuOpen.value = false
  filterPanelOpen.value = false
}

function changeSort(sort: string) {
  if (currentTab.value === 'music') {
    if (musicSort.value === sort) { sortMenuOpen.value = false; return }
    musicSort.value = sort as MusicSortBy
  } else if (currentTab.value === 'playlist') {
    if (playlistSort.value === sort) { sortMenuOpen.value = false; return }
    playlistSort.value = sort as PlaylistSortBy
  }
  sortMenuOpen.value = false
}

function toggleSortMenu() {
  sortMenuOpen.value = !sortMenuOpen.value
  if (sortMenuOpen.value) filterPanelOpen.value = false
}

function toggleFilterPanel() {
  filterPanelOpen.value = !filterPanelOpen.value
  if (filterPanelOpen.value) sortMenuOpen.value = false
}

function applyFilter() {
  filterPanelOpen.value = false
  loadResults()
}

function resetFilter() {
  filterExplicit.value = 'all'
  filterCreationType.value = ''
  filterPanelOpen.value = false
  loadResults()
}

watch(keyword, () => {
  loadResults()
})

watch([currentTab, musicSort, playlistSort], () => {
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

          <div class="toolbar-right">
            <!-- 排序下拉（音乐 & 歌单 tab 显示） -->
            <div v-if="currentTab === 'music' || currentTab === 'playlist'" class="sort-select">
            <button
              class="sort-trigger"
              :class="{ open: sortMenuOpen }"
              @click="toggleSortMenu"
            >
              <span>{{ activeSortLabel }}</span>
                <MdiIcon class="sort-arrow" :class="{ open: sortMenuOpen }" :path="mdiChevronDown" size="18px" />
            </button>

            <div v-if="sortMenuOpen" class="sort-menu">
              <button
                  v-for="sort in currentSortOptions"
                :key="sort.id"
                class="sort-option"
                  :class="{ active: currentTab === 'music' ? musicSort === sort.id : playlistSort === sort.id }"
                @click="changeSort(sort.id)"
              >
                {{ sort.label }}
              </button>
              </div>
            </div>

            <!-- 筛选按钮（仅音乐 tab） -->
            <div v-if="currentTab === 'music'" class="filter-wrap">
              <button
                class="sort-trigger filter-trigger"
                :class="{ open: filterPanelOpen, active: isFilterActive }"
                @click="toggleFilterPanel"
              >
                <MdiIcon :path="mdiFilterCogOutline" size="18px" />
                <span>筛选{{ isFilterActive ? ' ·' : '' }}</span>
              </button>

              <div v-if="filterPanelOpen" class="filter-panel">
                <div class="filter-section">
                  <p class="filter-label">内容分级</p>
                  <div class="filter-chips">
                    <button
                      class="filter-chip"
                      :class="{ active: filterExplicit === 'all' }"
                      @click="filterExplicit = 'all'"
                    >全部</button>
                    <button
                      class="filter-chip"
                      :class="{ active: filterExplicit === 'exclude' }"
                      @click="filterExplicit = 'exclude'"
                    >排除胖宝宝不宜</button>
                    <button
                      class="filter-chip"
                      :class="{ active: filterExplicit === 'only' }"
                      @click="filterExplicit = 'only'"
                    >仅胖宝宝不宜</button>
                  </div>
                </div>

                <div class="filter-section">
                  <p class="filter-label">创作类型</p>
                  <div class="filter-chips">
                    <button
                      class="filter-chip"
                      :class="{ active: filterCreationType === '' }"
                      @click="filterCreationType = ''"
                    >全部</button>
                    <button
                      class="filter-chip"
                      :class="{ active: filterCreationType === '0' }"
                      @click="filterCreationType = '0'"
                    >原创</button>
                    <button
                      class="filter-chip"
                      :class="{ active: filterCreationType === '1' }"
                      @click="filterCreationType = '1'"
                    >二次创作</button>
                    <button
                      class="filter-chip"
                      :class="{ active: filterCreationType === '2' }"
                      @click="filterCreationType = '2'"
                    >三次创作</button>
                  </div>
                </div>

                <div class="filter-actions">
                  <button class="filter-reset" @click="resetFilter">重置</button>
                  <button class="filter-apply" @click="applyFilter">应用</button>
                </div>
              </div>
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
          <MdiIcon :path="mdiMagnify" size="18px" />
          <span>没有找到相关结果</span>
        </div>

        <div v-if="!loading && currentHasMore" class="load-more-wrap">
          <button class="load-more-btn" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? '加载中…' : '加载更多' }}
          </button>
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
  margin: 0 auto 27px;
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

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.sort-select,
.filter-wrap {
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
  max-width: min(320px, calc(100vw - 24px));
  padding: 10px;
  border-radius: 16px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-primary);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.12);
}

.sort-trigger.filter-trigger.active {
  border-color: var(--theme-color);
  color: var(--theme-color);
  background: color-mix(in srgb, var(--theme-color) 10%, var(--hw-bg-secondary));
}

.filter-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 5;
  min-width: 260px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-primary);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--hw-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
  color: var(--hw-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.filter-chip:hover {
  border-color: var(--theme-color);
  color: var(--theme-color);
}

.filter-chip.active {
  background: var(--theme-color);
  border-color: var(--theme-color);
  color: #fff;
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--hw-border);
}

.filter-reset {
  padding: 6px 14px;
  border-radius: 10px;
  border: 1px solid var(--hw-border);
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-reset:hover {
  border-color: var(--hw-text-secondary);
  color: var(--hw-text-primary);
}

.filter-apply {
  padding: 6px 16px;
  border-radius: 10px;
  border: none;
  background: var(--theme-color);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.filter-apply:hover {
  background: color-mix(in srgb, var(--theme-color) 85%, #000);
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

.load-more-wrap {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

.load-more-btn {
  min-width: 144px;
  padding: 11px 18px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--theme-color) 30%, var(--hw-border));
  background: color-mix(in srgb, var(--theme-color) 8%, var(--hw-bg-secondary));
  color: var(--hw-text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.load-more-btn:hover:not(:disabled) {
  border-color: var(--theme-color);
  background: color-mix(in srgb, var(--theme-color) 14%, var(--hw-bg-secondary));
}

.load-more-btn:disabled {
  opacity: 0.65;
  cursor: wait;
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

  .toolbar-right {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .sort-select,
  .filter-wrap {
    align-self: flex-start;
  }

  .sort-menu,
  .filter-panel {
    left: 0;
    right: auto;
    max-width: min(320px, calc(100vw - 24px));
  }

  .filter-panel {
    min-width: min(260px, calc(100vw - 24px));
  }

  .result-grid {
    grid-template-columns: 1fr;
  }
}
</style>

