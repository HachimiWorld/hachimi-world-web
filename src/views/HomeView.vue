<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SongSection from '@/components/SongSection.vue'
import type { Song, SearchSongItem, TagRecommendItem } from '@/api/song'
import {
  getRecentSongs,
  getHotWeeklySongs,
  getRecommendSongs,
  getRecommendTags,
  getSongsByTag,
} from '@/api/song'
import { ApiError } from '@/api/request'

const PAGE_SIZE = 16

// ── 最近发布 ──
const recentSongs = ref<Song[]>([])
const recentLoading = ref(true)
const recentLoadingMore = ref(false)
const recentCursor = ref<string | undefined>(undefined)
const recentHasMore = ref(true)

async function loadRecent(more = false) {
  if (more) {
    recentLoadingMore.value = true
  } else {
    recentLoading.value = true
    recentSongs.value = []
    recentCursor.value = undefined
    recentHasMore.value = true
  }
  try {
    const resp = await getRecentSongs({
      cursor: recentCursor.value,
      limit: PAGE_SIZE,
      after: false,
    })
    const songs = resp.songs
    recentSongs.value = more ? [...recentSongs.value, ...songs] : songs
    recentHasMore.value = songs.length === PAGE_SIZE
    if (songs.length > 0) {
      recentCursor.value = songs[songs.length - 1].create_time
    }
  } catch (e) {
    console.error('加载最新歌曲失败', e instanceof ApiError ? e.msg : e)
  } finally {
    recentLoading.value = false
    recentLoadingMore.value = false
  }
}

// ── 本周热门 ──
const hotSongs = ref<Song[]>([])
const hotLoading = ref(true)
const hotLoadingMore = ref(false)
const hotOffset = ref(0)
const hotHasMore = ref(true)

async function loadHot(more = false) {
  if (more) {
    hotLoadingMore.value = true
  } else {
    hotLoading.value = true
    hotSongs.value = []
    hotOffset.value = 0
  }
  try {
    const resp = await getHotWeeklySongs()
    // 后端一次返回最多 50 首，本地分页展示
    const all = resp.songs
    const start = more ? hotOffset.value : 0
    const slice = all.slice(start, start + PAGE_SIZE)
    hotSongs.value = more ? [...hotSongs.value, ...slice] : slice
    hotOffset.value = (more ? hotOffset.value : 0) + slice.length
    hotHasMore.value = hotOffset.value < all.length
    // 缓存全量，避免重复请求
    if (!more) _hotAllSongs.value = all
  } catch (e) {
    console.error('加载热门歌曲失败', e instanceof ApiError ? e.msg : e)
  } finally {
    hotLoading.value = false
    hotLoadingMore.value = false
  }
}

const _hotAllSongs = ref<Song[]>([])

async function loadMoreHot() {
  if (_hotAllSongs.value.length === 0) return
  hotLoadingMore.value = true
  const start = hotOffset.value
  const slice = _hotAllSongs.value.slice(start, start + PAGE_SIZE)
  hotSongs.value = [...hotSongs.value, ...slice]
  hotOffset.value += slice.length
  hotHasMore.value = hotOffset.value < _hotAllSongs.value.length
  hotLoadingMore.value = false
}

// ── 每日推荐 ──
const recommendSongs = ref<Song[]>([])
const recommendLoading = ref(true)
const recommendLoadingMore = ref(false)
const recommendOffset = ref(0)
const recommendHasMore = ref(true)
const _recommendAll = ref<Song[]>([])

async function loadRecommend(more = false) {
  if (more) {
    hotLoadingMore.value = true
  } else {
    recommendLoading.value = true
    recommendSongs.value = []
    recommendOffset.value = 0
  }
  try {
    const resp = await getRecommendSongs()
    const all = resp.songs
    _recommendAll.value = all
    const slice = all.slice(0, PAGE_SIZE)
    recommendSongs.value = slice
    recommendOffset.value = slice.length
    recommendHasMore.value = slice.length < all.length
  } catch (e) {
    console.error('加载推荐歌曲失败', e instanceof ApiError ? e.msg : e)
  } finally {
    recommendLoading.value = false
  }
}

async function loadMoreRecommend() {
  recommendLoadingMore.value = true
  const start = recommendOffset.value
  const slice = _recommendAll.value.slice(start, start + PAGE_SIZE)
  recommendSongs.value = [...recommendSongs.value, ...slice]
  recommendOffset.value += slice.length
  recommendHasMore.value = recommendOffset.value < _recommendAll.value.length
  recommendLoadingMore.value = false
}

// ── 标签推荐 ──
const tags = ref<TagRecommendItem[]>([])
const tagsLoading = ref(true)

interface TagSection {
  tag: TagRecommendItem
  songs: SearchSongItem[]
  loading: boolean
  loadingMore: boolean
  offset: number
  hasMore: boolean
  total: number | null
}

const tagSections = ref<TagSection[]>([])

async function loadTags() {
  tagsLoading.value = true
  try {
    const resp = await getRecommendTags()
    // 最多展示 5 个标签区块
    tags.value = resp.result.slice(0, 5)
    tagSections.value = tags.value.map((tag) => ({
      tag,
      songs: [],
      loading: true,
      loadingMore: false,
      offset: 0,
      hasMore: true,
      total: null,
    }))
    // 并行加载各标签的歌曲
    tags.value.forEach((_, idx) => loadTagSongs(idx))
  } catch (e) {
    console.error('加载推荐标签失败', e instanceof ApiError ? e.msg : e)
  } finally {
    tagsLoading.value = false
  }
}

async function loadTagSongs(idx: number, more = false) {
  const section = tagSections.value[idx]
  if (!section) return
  if (more) {
    section.loadingMore = true
  } else {
    section.loading = true
    section.songs = []
    section.offset = 0
  }
  try {
    const resp = await getSongsByTag({
      tagName: section.tag.name,
      limit: PAGE_SIZE,
      offset: more ? section.offset : 0,
    })
    section.songs = more ? [...section.songs, ...resp.hits] : resp.hits
    section.offset = (more ? section.offset : 0) + resp.hits.length
    section.total = resp.total_hits
    section.hasMore = resp.hits.length === PAGE_SIZE
  } catch (e) {
    console.error(`加载标签「${section.tag.name}」歌曲失败`, e instanceof ApiError ? e.msg : e)
  } finally {
    section.loading = false
    section.loadingMore = false
  }
}

onMounted(() => {
  loadRecent()
  loadHot()
  loadRecommend()
  loadTags()
})
</script>

<template>
  <div class="home-view">
    <!-- 最近发布 -->
    <SongSection
      title="最近发布"
      :songs="recentSongs"
      :loading="recentLoading"
      :has-more="recentHasMore"
      :loading-more="recentLoadingMore"
      more-route="/recent"
      @load-more="loadRecent(true)"
    />

    <!-- 每日推荐 -->
    <SongSection
      title="每日推荐"
      :songs="recommendSongs"
      :loading="recommendLoading"
      :has-more="recommendHasMore"
      :loading-more="recommendLoadingMore"
      more-route="/recommend"
      @load-more="loadMoreRecommend"
    />

    <!-- 本周热门 -->
    <SongSection
      title="本周热门"
      :songs="hotSongs"
      :loading="hotLoading"
      :has-more="hotHasMore"
      :loading-more="hotLoadingMore"
      more-route="/hot"
      @load-more="loadMoreHot"
    />

    <!-- 标签推荐区块 -->
    <template v-if="!tagsLoading">
      <SongSection
        v-for="(section, idx) in tagSections"
        :key="section.tag.id"
        :title="'# ' + section.tag.name"
        :songs="section.songs"
        :loading="section.loading"
        :has-more="section.hasMore"
        :loading-more="section.loadingMore"
        @load-more="loadTagSongs(idx, true)"
      />
    </template>

    <!-- 标签骨架占位 -->
    <template v-else>
      <SongSection
        v-for="i in 3"
        :key="'tag-skel-' + i"
        :title="''"
        :songs="[]"
        :loading="true"
      />
    </template>
  </div>
</template>

<style scoped>
.home-view {
  padding-top: 8px;
}
</style>
