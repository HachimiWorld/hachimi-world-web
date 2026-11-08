<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import { mdiArrowLeft, mdiNewspaper } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import SongCommentsSection from '@/components/SongCommentsSection.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import { ApiError } from '@/api/request'
import { TARGET_POST } from '@/api/comment'
import { getPostDetail, type PostItem } from '@/api/post'
import { formatRelativeTime } from '@/utils/relativeTime'

marked.setOptions({ gfm: true, breaks: true })

const route = useRoute()
const router = useRouter()

const item = ref<PostItem | null>(null)
const loading = ref(false)
const errorText = ref('')
const loginDialogOpen = ref(false)

const postId = computed(() => Number(route.params.id))
const htmlContent = computed(() => {
  if (!item.value || item.value.content_type !== 'markdown') return ''
  return marked.parse(item.value.content || '') as string
})

async function load() {
  if (!Number.isFinite(postId.value)) {
    errorText.value = '内容为空'
    return
  }
  loading.value = true
  errorText.value = ''
  try {
    item.value = await getPostDetail(postId.value)
  } catch (e) {
    item.value = null
    errorText.value = e instanceof ApiError ? e.msg : '暂时无法加载公告'
  } finally {
    loading.value = false
  }
}

function openUser(uid: number) {
  router.push(`/user/${uid}`)
}

function onLinkClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  const a = target?.closest('a') as HTMLAnchorElement | null
  if (!a?.href) return
  if (!a.href.startsWith('https://')) {
    e.preventDefault()
  }
}

watch(postId, () => {
  void load()
})

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="event-page">
    <div class="event-shell">
      <div class="event-hero">
        <button type="button" class="back-btn" aria-label="返回" @click="router.push({ path: '/square', query: { tab: 'events' } })">
          <MdiIcon :path="mdiArrowLeft" size="20px" />
        </button>
        <h1 class="hero-title">{{ item?.title || '公告' }}</h1>
      </div>

      <div v-if="loading" class="state-card">
        <div class="loading-dot" />
      </div>

      <div v-else-if="errorText" class="state-card">
        <MdiIcon :path="mdiNewspaper" size="22px" />
        <p>{{ errorText }}</p>
        <button type="button" class="retry-btn" @click="load">重试</button>
      </div>

      <template v-else-if="item">
        <article class="article">
          <div class="meta-row">
            <button type="button" class="author" @click="openUser(item.author.uid)">
              <div class="avatar">
                <img v-if="item.author.avatar_url" :src="item.author.avatar_url" :alt="item.author.username">
                <span v-else>{{ item.author.username?.[0] || '?' }}</span>
              </div>
              <span class="username">{{ item.author.username }}</span>
            </button>
            <span class="time">{{ formatRelativeTime(item.create_time) }}</span>
          </div>

          <div v-if="item.cover_url" class="cover">
            <img :src="item.cover_url" :alt="item.title">
          </div>

          <div
            v-if="item.content_type === 'markdown'"
            class="markdown"
            @click="onLinkClick"
            v-html="htmlContent"
          />
          <p v-else class="unsupported">当前客户端不支持展示该文章内容，请升级版本</p>
        </article>

        <div class="comments-wrap">
          <SongCommentsSection
            :target-id="item.id"
            :owner-uid="item.author.uid"
            :target-type="TARGET_POST"
            hide-header
            @require-login="loginDialogOpen = true"
          />
        </div>
      </template>
    </div>

    <LoginDialog v-model="loginDialogOpen" />
  </div>
</template>

<style scoped>
.event-page {
  min-height: calc(100vh - var(--hw-header-height));
  background: var(--hw-bg-primary);
  padding: 0 0 80px;
}

.event-shell {
  max-width: 720px;
  margin: 0 auto;
}

.event-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 0 20px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--hw-text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.back-btn:hover {
  background: var(--hw-bg-hover);
}

.hero-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--hw-text-primary);
  line-height: 1.3;
  min-width: 0;
}

.article {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.author {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: inherit;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: color-mix(in srgb, var(--hw-text-primary) 8%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--hw-text-tertiary);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.username {
  font-size: 14px;
  font-weight: 650;
}

.time {
  font-size: 13px;
  color: var(--hw-text-tertiary);
}

.cover {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  overflow: hidden;
  background: color-mix(in srgb, var(--hw-text-primary) 8%, transparent);
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.markdown {
  font-size: 15px;
  line-height: 1.75;
  color: var(--hw-text-primary);
  word-break: break-word;
}

.markdown :deep(h1),
.markdown :deep(h2),
.markdown :deep(h3),
.markdown :deep(h4) {
  margin: 1.2em 0 0.5em;
  font-weight: 750;
  line-height: 1.35;
}

.markdown :deep(p) {
  margin: 0.7em 0;
}

.markdown :deep(ul),
.markdown :deep(ol) {
  margin: 0.7em 0;
  padding-left: 1.4em;
}

.markdown :deep(a) {
  color: var(--theme-color);
}

.markdown :deep(img) {
  max-width: 100%;
  border-radius: 12px;
  margin: 0.6em 0;
}

.markdown :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  padding: 0.1em 0.35em;
  border-radius: 6px;
  background: var(--hw-bg-hover);
}

.unsupported {
  color: var(--hw-text-secondary);
  text-align: center;
  padding: 40px 0;
}

.comments-wrap {
  margin-top: 24px;
}

.state-card {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--hw-text-secondary);
  text-align: center;
}

.loading-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--theme-color-light);
  border-top-color: var(--theme-color);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-btn {
  border: none;
  border-radius: 12px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  background: transparent;
  color: var(--theme-color);
}
</style>
