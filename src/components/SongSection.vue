<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import SongCard from './SongCard.vue'
import type { Song, SearchSongItem } from '@/api/song'

const props = defineProps<{
  title: string
  songs: (Song | SearchSongItem)[]
  loading: boolean
  hasMore?: boolean
  loadingMore?: boolean
  moreRoute?: string
}>()

const emit = defineEmits<{
  (e: 'load-more'): void
}>()

// 骨架屏占位数量
const SKELETON_COUNT = 12

// 动态检测是否可以左/右滚动，用于控制渐隐遮罩
const gridEl = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function updateFade() {
  const el = gridEl.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 2
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
}

onMounted(() => {
  // 等 DOM 渲染后检测
  setTimeout(updateFade, 100)
})

onUnmounted(() => {
  gridEl.value?.removeEventListener('scroll', updateFade)
})

function onGridMounted(el: HTMLElement | null) {
  gridEl.value = el
  if (el) {
    el.addEventListener('scroll', updateFade, { passive: true })
    setTimeout(updateFade, 100)
  }
}
</script>

<template>
  <section class="song-section">
    <div class="section-header">
      <h2 class="section-title">{{ title }}</h2>
      <RouterLink v-if="moreRoute" :to="moreRoute" class="section-more">
        查看更多
        <el-icon><ArrowRight /></el-icon>
      </RouterLink>
    </div>

    <!-- 滚动容器包裹器 -->
    <div
      class="scroll-wrapper"
      :class="{
        'fade-left': canScrollLeft,
        'fade-right': canScrollRight,
      }"
    >
      <!-- 骨架屏 -->
      <div
        v-if="loading"
        class="song-grid"
        :ref="(el) => onGridMounted(el as HTMLElement | null)"
      >
        <div
          v-for="i in SKELETON_COUNT"
          :key="i"
          class="skeleton-card"
        >
          <el-skeleton animated>
            <template #template>
              <el-skeleton-item variant="image" class="skel-cover" />
              <div class="skel-info">
                <el-skeleton-item variant="p" style="width: 80%" />
                <el-skeleton-item variant="p" style="width: 55%; margin-top: 6px" />
              </div>
            </template>
          </el-skeleton>
        </div>
      </div>

      <!-- 实际内容 -->
      <div
        v-else
        class="song-grid"
        :ref="(el) => onGridMounted(el as HTMLElement | null)"
      >
        <SongCard
          v-for="song in songs"
          :key="song.id"
          :song="song"
        />
      </div>

      <!-- 右侧加载中指示 -->
      <div v-if="!loading && loadingMore" class="inline-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
      </div>
    </div>
  </section>
</template>

<style scoped>
.song-section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--hw-text-primary);
  letter-spacing: -0.3px;
  position: relative;
  padding-left: 12px;
}

.section-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 18px;
  background: var(--theme-color);
  border-radius: 2px;
}

.section-more {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  color: var(--hw-text-secondary);
  text-decoration: none;
  transition: color 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.section-more:hover {
  color: var(--theme-color);
}

/* ── 滚动容器 ── */
.scroll-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  /* 渐隐遮罩，默认无遮罩 */
  --mask-left: black;
  --mask-right: black;
  mask-image: linear-gradient(
    to right,
    var(--mask-left) 0%,
    black 5%,
    black 95%,
    var(--mask-right) 100%
  );
  -webkit-mask-image: linear-gradient(
    to right,
    var(--mask-left) 0%,
    black 5%,
    black 95%,
    var(--mask-right) 100%
  );
}

/* 左侧可滚动时显示左渐隐 */
.scroll-wrapper.fade-left {
  --mask-left: transparent;
}

/* 右侧可滚动时显示右渐隐 */
.scroll-wrapper.fade-right {
  --mask-right: transparent;
}

/* ── 网格：强制两行，PC 填满容器，超出横向滚动 ── */
.song-grid {
  display: grid;
  grid-template-rows: repeat(2, 1fr);
  grid-auto-flow: column;
  /* PC 端：列宽自动填满容器（6列），超出内容才出现滚动条 */
  grid-auto-columns: calc((100% - 5 * 12px) / 6);
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 6px;
  scrollbar-width: thin;
  scrollbar-color: var(--hw-border) transparent;
  flex: 1;
  min-width: 0;
  width: 100%;
}

.song-grid::-webkit-scrollbar {
  height: 4px;
}

.song-grid::-webkit-scrollbar-track {
  background: transparent;
}

.song-grid::-webkit-scrollbar-thumb {
  background: var(--hw-border);
  border-radius: 2px;
}

/* ── 骨架屏卡片 ── */
.skeleton-card {
  background: var(--hw-bg-secondary);
  border-radius: 10px;
  overflow: hidden;
}

.skel-cover {
  width: 100%;
  display: block;
}

:deep(.el-skeleton__image) {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 0;
}

.skel-info {
  padding: 8px 10px 10px;
}

/* 右侧内联加载指示 */
.inline-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hw-text-tertiary);
  font-size: 20px;
  flex-shrink: 0;
  padding: 0 8px;
}

/* ── 响应式：随屏幕变小减少列数 ── */
@media (max-width: 1200px) {
  .song-grid {
    grid-auto-columns: calc((100% - 4 * 12px) / 5);
  }
}

@media (max-width: 900px) {
  .song-grid {
    grid-auto-columns: calc((100% - 3 * 12px) / 4);
  }
}

@media (max-width: 640px) {
  .song-grid {
    grid-auto-columns: calc((100% - 2 * 8px) / 3);
    gap: 8px;
  }
}

/* ── 手机端：固定显示约 2 列 ── */
@media (max-width: 420px) {
  .song-grid {
    grid-auto-columns: calc((100% - 8px) / 2);
    gap: 8px;
  }
}
</style>
