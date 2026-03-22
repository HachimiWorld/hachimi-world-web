<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
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

const PAGE_SIZE = 12

// ── 最近发布 ──
const recentSongs = ref<Song[]>([])
const recentLoading = ref(true)

async function loadRecent() {
  recentLoading.value = true
  recentSongs.value = []
  try {
    const resp = await getRecentSongs({
      limit: PAGE_SIZE,
      after: false,
    })
    recentSongs.value = resp.songs
  } catch (e) {
    console.error('加载最新歌曲失败', e instanceof ApiError ? e.msg : e)
  } finally {
    recentLoading.value = false
  }
}

// ── 本周热门 ──
const hotSongs = ref<Song[]>([])
const hotLoading = ref(true)

async function loadHot() {
  hotLoading.value = true
  hotSongs.value = []
  try {
    const resp = await getHotWeeklySongs()
    hotSongs.value = resp.songs.slice(0, PAGE_SIZE)
  } catch (e) {
    console.error('加载热门歌曲失败', e instanceof ApiError ? e.msg : e)
  } finally {
    hotLoading.value = false
  }
}

// ── 每日推荐 ──
const recommendSongs = ref<Song[]>([])
const recommendLoading = ref(true)

async function loadRecommend() {
  recommendLoading.value = true
  recommendSongs.value = []
  try {
    const resp = await getRecommendSongs()
    recommendSongs.value = resp.songs.slice(0, PAGE_SIZE)
  } catch (e) {
    console.error('加载推荐歌曲失败', e instanceof ApiError ? e.msg : e)
  } finally {
    recommendLoading.value = false
  }
}

// ── 标签推荐 ──
const tagsLoading = ref(true)

interface TagSection {
  tag: TagRecommendItem
  songs: SearchSongItem[]
  loading: boolean
  loadingMore: boolean
  offset: number
  hasMore: boolean
}

const tagSections = ref<TagSection[]>([])
// 当前已加载的标签数量（用于滚动到底部时递增）
const loadedTagCount = ref(0)
const allTags = ref<TagRecommendItem[]>([])
const INITIAL_TAG_COUNT = 3  // 初始展示标签数
const TAG_BATCH = 2           // 每次滚动到底部追加标签数

async function loadTags() {
  tagsLoading.value = true
  try {
    const resp = await getRecommendTags()
    allTags.value = resp.result
    // 初始加载前 INITIAL_TAG_COUNT 个
    await appendTags(INITIAL_TAG_COUNT)
  } catch (e) {
    console.error('加载推荐标签失败', e instanceof ApiError ? e.msg : e)
  } finally {
    tagsLoading.value = false
  }
}

async function appendTags(count: number) {
  const start = loadedTagCount.value
  const end = Math.min(start + count, allTags.value.length)
  for (let i = start; i < end; i++) {
    const tag = allTags.value[i]
    const section: TagSection = {
      tag,
      songs: [],
      loading: true,
      loadingMore: false,
      offset: 0,
      hasMore: true,
    }
    tagSections.value.push(section)
    loadTagSongs(tagSections.value.length - 1)
  }
  loadedTagCount.value = end
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
    section.hasMore = resp.hits.length === PAGE_SIZE
  } catch (e) {
    console.error(`加载标签「${section.tag.name}」歌曲失败`, e instanceof ApiError ? e.msg : e)
  } finally {
    section.loading = false
    section.loadingMore = false
  }
}

// ── 滚动到底部加载更多标签 ──
let scrollTimer: ReturnType<typeof setTimeout> | null = null

function onScroll() {
  if (scrollTimer) return
  scrollTimer = setTimeout(() => {
    scrollTimer = null
    const scrolled = window.scrollY + window.innerHeight
    const total = document.documentElement.scrollHeight
    // 距离底部 300px 时触发
    if (total - scrolled < 300) {
      if (loadedTagCount.value < allTags.value.length) {
        appendTags(TAG_BATCH)
      }
    }
  }, 150)
}

onMounted(() => {
  loadRecent()
  loadHot()
  loadRecommend()
  loadTags()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  if (scrollTimer) clearTimeout(scrollTimer)
})
</script>

<template>
  <div class="home-view">
    <!-- 最近发布 -->
    <SongSection
      title="最近发布"
      :songs="recentSongs"
      :loading="recentLoading"
      more-route="/recent"
    />

    <!-- 每日推荐 -->
    <SongSection
      title="每日推荐"
      :songs="recommendSongs"
      :loading="recommendLoading"
      more-route="/recommend"
    />

    <!-- 本周热门 -->
    <SongSection
      title="本周热门"
      :songs="hotSongs"
      :loading="hotLoading"
      more-route="/hot"
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

    <!-- 标签初始骨架占位 -->
    <template v-else>
      <SongSection
        v-for="i in INITIAL_TAG_COUNT"
        :key="'tag-skel-' + i"
        title=""
        :songs="[]"
        :loading="true"
      />
    </template>

    <!-- 底部：还有更多标签可加载时的提示 -->
    <div
      v-if="!tagsLoading && loadedTagCount < allTags.length"
      class="bottom-hint"
    >
      <span>继续向下滚动以加载更多</span>
    </div>
  </div>
</template>

<style scoped>
.home-view {
  padding-top: 8px;
}

.bottom-hint {
  text-align: center;
  color: var(--hw-text-tertiary);
  font-size: 12px;
  padding: 16px 0 32px;
  opacity: 0.6;
}
</style>
