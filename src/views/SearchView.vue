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
          <div v-for="i in PAGE_SIZE" :key="i" class="result-skeleton">
            <el-skeleton animated>
              <template #template>
                <div class="skeleton-inner">
                  <el-skeleton-item variant="image" class="skeleton-cover" />
                  <div class="skeleton-copy">
                    <el-skeleton-item variant="h3" style="width: 55%" />
                    <el-skeleton-item variant="text" style="width: 72%; margin-top: 8px" />
                    <el-skeleton-item variant="text" style="width: 88%; margin-top: 12px" />
                  </div>
                </div>
              </template>
            </el-skeleton>
          </div>
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

.result-skeleton {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
}

.skeleton-inner {
  display: flex;
  gap: 14px;
  padding: 12px;
}

.skeleton-cover {
  width: 88px;
  flex-shrink: 0;
}

.skeleton-copy {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}

:deep(.skeleton-cover .el-skeleton__image) {
  width: 88px;
  height: 88px;
  border-radius: 12px;
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

