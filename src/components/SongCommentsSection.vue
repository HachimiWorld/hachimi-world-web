<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  mdiClose,
  mdiCommentOutline,
  mdiDeleteOutline,
  mdiDotsVertical,
  mdiFlagOutline,
  mdiSend,
  mdiThumbUp,
  mdiThumbUpOutline,
} from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import CommentThreadBlock from '@/components/CommentThreadBlock.vue'
import { ApiError } from '@/api/request'
import {
  CONTENT_MAX_CHARS,
  FIRST_REPLIES,
  ORDER_NEWEST,
  ORDER_OLDEST,
  PAGE_SIZE,
  TARGET_SONG,
  commentErrorMessage,
  createComment,
  deleteComment,
  likeComment,
  listCommentReplies,
  listComments,
  listHotComments,
  unlikeComment,
  type CommentItem,
  type CommentThread,
} from '@/api/comment'
import { useUserStore } from '@/stores/user'

const props = defineProps<{
  targetId: number
  ownerUid: number
  targetType?: string
  /** 隐藏顶部「评论 N」标题（进入回复楼时仍保留返回） */
  hideHeader?: boolean
}>()

const emit = defineEmits<{
  'require-login': []
}>()

const router = useRouter()
const userStore = useUserStore()

type LoadStatus = 'init' | 'loaded' | 'failed'

const targetType = computed(() => props.targetType || TARGET_SONG)

const order = ref(ORDER_NEWEST)
const hotThreads = ref<CommentThread[]>([])
const threads = ref<CommentThread[]>([])
const total = ref(0)
const status = ref<LoadStatus>('init')
const hasMore = ref(false)
const loadingMore = ref(false)
const loadMoreFailed = ref(false)

const openThread = ref<CommentThread | null>(null)
const replies = ref<CommentItem[]>([])
const repliesTotal = ref(0)
const repliesStatus = ref<LoadStatus>('init')
const repliesHasMore = ref(false)
const repliesLoadingMore = ref(false)
const repliesPageIndex = ref(0)

const input = ref('')
const replyTo = ref<CommentItem | null>(null)
const sending = ref(false)
const composerFocused = ref(false)
const inputEl = ref<HTMLTextAreaElement | null>(null)

const titleText = computed(() => {
  if (openThread.value) return `回复 ${repliesTotal.value}`
  return total.value > 0 ? `评论 ${total.value}` : '评论'
})

const remainingChars = computed(() => CONTENT_MAX_CHARS - input.value.length)
const canSend = computed(() => input.value.trim().length > 0 && !sending.value)
const isEmpty = computed(() => status.value === 'loaded' && threads.value.length === 0)

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diffMs = Date.now() - date.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function requireLogin(): boolean {
  if (userStore.isLoggedIn) return true
  emit('require-login')
  return false
}

function isMine(item: CommentItem): boolean {
  return !!item.author && item.author.uid === userStore.userInfo?.uid
}

function canDelete(item: CommentItem): boolean {
  const uid = userStore.userInfo?.uid
  if (!uid || item.removed) return false
  return item.author?.uid === uid || props.ownerUid === uid
}

function showMore(item: CommentItem): boolean {
  return canDelete(item) || !isMine(item)
}

function apiMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    return commentErrorMessage(e.code) || e.msg || fallback
  }
  return fallback
}

function updateComment(id: number, change: (item: CommentItem) => CommentItem) {
  const patchThread = (thread: CommentThread): CommentThread => {
    if (thread.comment.id === id) {
      return { ...thread, comment: change(thread.comment) }
    }
    if (thread.replies.some((r) => r.id === id)) {
      return {
        ...thread,
        replies: thread.replies.map((r) => (r.id === id ? change(r) : r)),
      }
    }
    return thread
  }
  hotThreads.value = hotThreads.value.map(patchThread)
  threads.value = threads.value.map(patchThread)
  if (openThread.value?.comment.id === id) {
    openThread.value = { ...openThread.value, comment: change(openThread.value.comment) }
  }
  replies.value = replies.value.map((r) => (r.id === id ? change(r) : r))
}

function updateThread(rootId: number, change: (thread: CommentThread) => CommentThread) {
  hotThreads.value = hotThreads.value.map((t) => (t.comment.id === rootId ? change(t) : t))
  threads.value = threads.value.map((t) => (t.comment.id === rootId ? change(t) : t))
  if (openThread.value?.comment.id === rootId) {
    openThread.value = change(openThread.value)
  }
}

async function load(keepList = false) {
  status.value = keepList ? status.value : 'init'
  hasMore.value = false
  loadMoreFailed.value = false
  loadingMore.value = false
  if (!keepList) {
    hotThreads.value = []
    threads.value = []
    total.value = 0
  }
  try {
    const [hot, data] = await Promise.all([
      listHotComments({ targetType: targetType.value, targetId: props.targetId }),
      listComments({
        targetType: targetType.value,
        targetId: props.targetId,
        order: order.value,
        limit: PAGE_SIZE,
      }),
    ])
    hotThreads.value = hot.threads
    threads.value = data.threads
    total.value = data.total
    hasMore.value = data.has_more
    status.value = 'loaded'
  } catch {
    status.value = 'failed'
  }
}

async function loadMore() {
  if (status.value !== 'loaded' || !hasMore.value || loadingMore.value) return
  const last = threads.value[threads.value.length - 1]?.comment
  if (!last) return
  loadingMore.value = true
  loadMoreFailed.value = false
  try {
    const data = await listComments({
      targetType: targetType.value,
      targetId: props.targetId,
      order: order.value,
      afterTime: last.create_time,
      afterCommentId: last.id,
      limit: PAGE_SIZE,
    })
    threads.value = [...threads.value, ...data.threads]
    total.value = data.total
    hasMore.value = data.has_more
  } catch {
    loadMoreFailed.value = true
  } finally {
    loadingMore.value = false
  }
}

function changeOrder(next: string) {
  if (order.value === next) return
  order.value = next
  void load(status.value === 'loaded')
}

async function openReplies(thread: CommentThread) {
  openThread.value = thread
  replies.value = []
  repliesTotal.value = 0
  repliesHasMore.value = false
  repliesLoadingMore.value = false
  repliesPageIndex.value = 0
  repliesStatus.value = 'init'
  try {
    const data = await listCommentReplies({ rootId: thread.comment.id, pageIndex: 0 })
    replies.value = data.replies
    repliesTotal.value = data.total
    repliesHasMore.value = data.replies.length >= PAGE_SIZE
    repliesStatus.value = 'loaded'
  } catch {
    repliesStatus.value = 'failed'
  }
}

function closeThread() {
  const rootId = openThread.value?.comment.id
  openThread.value = null
  if (rootId != null && (replyTo.value?.id === rootId || replyTo.value?.root_id === rootId)) {
    replyTo.value = null
  }
}

async function loadMoreReplies() {
  const rootId = openThread.value?.comment.id
  if (!rootId || repliesStatus.value !== 'loaded' || !repliesHasMore.value || repliesLoadingMore.value) return
  repliesLoadingMore.value = true
  try {
    const nextPage = repliesPageIndex.value + 1
    const data = await listCommentReplies({ rootId, pageIndex: nextPage })
    const known = new Set(replies.value.map((r) => r.id))
    replies.value = [...replies.value, ...data.replies.filter((r) => !known.has(r.id))]
    repliesTotal.value = data.total
    repliesPageIndex.value = nextPage
    repliesHasMore.value = data.replies.length >= PAGE_SIZE
  } catch {
    ElMessage.error('更多回复加载失败')
  } finally {
    repliesLoadingMore.value = false
  }
}

async function startReply(item: CommentItem) {
  if (!requireLogin()) return
  replyTo.value = item
  await nextTick()
  inputEl.value?.focus()
}

function cancelReply() {
  replyTo.value = null
}

function asRemoved(item: CommentItem): CommentItem {
  return { ...item, removed: true, author: null, content: '' }
}

function added(item: CommentItem) {
  total.value += 1
  const rootId = item.root_id
  if (rootId == null) {
    const thread: CommentThread = { comment: item, replies: [], reply_count: 0 }
    if (order.value === ORDER_NEWEST) threads.value = [thread, ...threads.value]
    else if (!hasMore.value) threads.value = [...threads.value, thread]
    return
  }
  updateThread(rootId, (t) => ({
    ...t,
    replies: t.replies.length < FIRST_REPLIES ? [...t.replies, item] : t.replies,
    reply_count: t.reply_count + 1,
  }))
  if (openThread.value?.comment.id === rootId) {
    if (!repliesHasMore.value) replies.value = [...replies.value, item]
    repliesTotal.value += 1
  }
}

function removed(item: CommentItem) {
  total.value = Math.max(0, total.value - 1)
  if (replyTo.value?.id === item.id) replyTo.value = null
  const rootId = item.root_id
  if (rootId == null) {
    hotThreads.value = hotThreads.value.filter((t) => t.comment.id !== item.id)
    const index = threads.value.findIndex((t) => t.comment.id === item.id)
    if (index >= 0) {
      const thread = threads.value[index]!
      if (thread.reply_count > 0) {
        const next = [...threads.value]
        next[index] = { ...thread, comment: asRemoved(item) }
        threads.value = next
      } else {
        threads.value = threads.value.filter((t) => t.comment.id !== item.id)
      }
    }
    if (openThread.value?.comment.id === item.id) {
      openThread.value = { ...openThread.value, comment: asRemoved(item) }
    }
    return
  }
  updateThread(rootId, (t) => ({
    ...t,
    replies: t.replies.filter((r) => r.id !== item.id),
    reply_count: Math.max(0, t.reply_count - 1),
  }))
  const before = replies.value.length
  replies.value = replies.value.filter((r) => r.id !== item.id)
  if (replies.value.length < before) repliesTotal.value = Math.max(0, repliesTotal.value - 1)
}

async function send() {
  const content = input.value.trim()
  if (!content || sending.value || !requireLogin()) return
  sending.value = true
  try {
    const resp = await createComment({
      targetType: targetType.value,
      targetId: props.targetId,
      content,
      replyToId: replyTo.value?.id ?? null,
    })
    input.value = ''
    replyTo.value = null
    if (inputEl.value) inputEl.value.style.height = 'auto'
    if (resp.comment) {
      added(resp.comment)
      if (status.value === 'failed' || isEmpty.value) status.value = 'loaded'
    } else {
      ElMessage.success('已发送，审核通过后才会显示')
    }
  } catch (e) {
    ElMessage.error(apiMessage(e, '发送失败，请稍后再试'))
  } finally {
    sending.value = false
  }
}

async function toggleLike(item: CommentItem) {
  if (item.removed || !requireLogin()) return
  const liked = !item.liked
  const prevLiked = item.liked
  const prevCount = item.like_count
  updateComment(item.id, (c) => ({
    ...c,
    liked,
    like_count: Math.max(0, c.like_count + (liked ? 1 : -1)),
  }))
  try {
    if (liked) await likeComment(item.id)
    else await unlikeComment(item.id)
  } catch (e) {
    updateComment(item.id, (c) => ({ ...c, liked: prevLiked, like_count: prevCount }))
    ElMessage.error(apiMessage(e, '点赞失败，请稍后再试'))
  }
}

async function handleDelete(item: CommentItem) {
  try {
    await ElMessageBox.confirm('删除后无法恢复', '删除这条评论？', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await deleteComment(item.id)
    removed(item)
  } catch (e) {
    ElMessage.error(apiMessage(e, '删除失败，请稍后再试'))
  }
}

function handleReport() {
  ElMessage.info('举报功能即将上线')
}

function jumpUser(uid: number) {
  router.push(`/user/${uid}`)
}

function onComposerKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    void send()
  }
}

function onComposerInput(e: Event) {
  const t = e.target as HTMLTextAreaElement
  input.value = t.value.slice(0, CONTENT_MAX_CHARS)
  t.style.height = 'auto'
  t.style.height = `${Math.min(t.scrollHeight, 110)}px`
}

watch(
  () => [props.targetId, props.targetType] as const,
  () => {
    input.value = ''
    replyTo.value = null
    openThread.value = null
    void load()
  },
)

onMounted(() => {
  void load()
})

defineExpose({ reload: () => load() })
</script>

<template>
  <section class="song-comments">
    <header v-if="!hideHeader || openThread" class="comments-header">
      <button
        v-if="openThread"
        type="button"
        class="back-btn"
        aria-label="返回评论列表"
        @click="closeThread"
      >
        ‹
      </button>
      <h2 class="comments-title">{{ titleText }}</h2>
    </header>

    <div class="comments-body">
      <div v-if="openThread" class="replies-view">
        <div class="root-comment">
          <div v-if="openThread.comment.removed" class="comment-removed">该评论已删除</div>
          <div v-else-if="openThread.comment.author" class="comment-row">
            <button type="button" class="avatar avatar-lg" @click="jumpUser(openThread.comment.author.uid)">
              <img
                v-if="openThread.comment.author.avatar_url"
                :src="openThread.comment.author.avatar_url"
                :alt="openThread.comment.author.username"
              >
              <span v-else class="avatar-fallback">{{ openThread.comment.author.username.slice(0, 1) }}</span>
            </button>
            <div class="comment-main">
              <div class="comment-meta">
                <button type="button" class="username" @click="jumpUser(openThread.comment.author.uid)">
                  {{ openThread.comment.author.username }}
                </button>
                <span class="time">{{ formatRelativeTime(openThread.comment.create_time) }}</span>
              </div>
              <p class="comment-content">{{ openThread.comment.content }}</p>
              <div class="comment-actions">
                <button type="button" class="reply-text-btn" @click="startReply(openThread.comment)">回复</button>
                <div class="actions-right">
                  <button
                    type="button"
                    class="like-btn"
                    :class="{ liked: openThread.comment.liked }"
                    :aria-label="openThread.comment.liked ? '取消点赞' : '点赞'"
                    @click="toggleLike(openThread.comment)"
                  >
                    <MdiIcon
                      :path="openThread.comment.liked ? mdiThumbUp : mdiThumbUpOutline"
                      size="16px"
                    />
                    <span v-if="openThread.comment.like_count > 0">{{ openThread.comment.like_count }}</span>
                  </button>
                  <el-dropdown
                    v-if="showMore(openThread.comment)"
                    trigger="click"
                    @command="(cmd: string) => cmd === 'delete' ? handleDelete(openThread!.comment) : handleReport()"
                  >
                    <button type="button" class="more-btn" aria-label="更多">
                      <MdiIcon :path="mdiDotsVertical" size="16px" />
                    </button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item v-if="canDelete(openThread.comment)" command="delete">
                          <MdiIcon :path="mdiDeleteOutline" size="16px" />
                          <span>删除</span>
                        </el-dropdown-item>
                        <el-dropdown-item v-if="!isMine(openThread.comment)" command="report">
                          <MdiIcon :path="mdiFlagOutline" size="16px" />
                          <span>举报</span>
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="replies-divider" />

        <div v-if="repliesStatus === 'init'" class="state-block">
          <div class="loading-dot" />
        </div>
        <div v-else-if="repliesStatus === 'failed'" class="state-block">
          <p>评论加载失败，请检查网络后重试</p>
          <button type="button" class="retry-btn" @click="openReplies(openThread)">重试</button>
        </div>
        <template v-else>
          <div
            v-for="reply in replies"
            :key="reply.id"
            class="comment-block"
          >
            <div v-if="reply.removed" class="comment-removed">该评论已删除</div>
            <div v-else-if="reply.author" class="comment-row">
              <button type="button" class="avatar avatar-md" @click="jumpUser(reply.author.uid)">
                <img
                  v-if="reply.author.avatar_url"
                  :src="reply.author.avatar_url"
                  :alt="reply.author.username"
                >
                <span v-else class="avatar-fallback">{{ reply.author.username.slice(0, 1) }}</span>
              </button>
              <div class="comment-main">
                <div class="comment-meta">
                  <button type="button" class="username" @click="jumpUser(reply.author.uid)">
                    {{ reply.author.username }}
                  </button>
                  <span class="time">{{ formatRelativeTime(reply.create_time) }}</span>
                </div>
                <p class="comment-content">
                  <template v-if="reply.reply_to_user">
                    <span class="reply-inline">回复 {{ reply.reply_to_user.username }}：</span>
                  </template>{{ reply.content }}
                </p>
                <div class="comment-actions">
                  <button type="button" class="reply-text-btn" @click="startReply(reply)">回复</button>
                  <div class="actions-right">
                    <button
                      type="button"
                      class="like-btn"
                      :class="{ liked: reply.liked }"
                      :aria-label="reply.liked ? '取消点赞' : '点赞'"
                      @click="toggleLike(reply)"
                    >
                      <MdiIcon :path="reply.liked ? mdiThumbUp : mdiThumbUpOutline" size="16px" />
                      <span v-if="reply.like_count > 0">{{ reply.like_count }}</span>
                    </button>
                    <el-dropdown
                      v-if="showMore(reply)"
                      trigger="click"
                      @command="(cmd: string) => cmd === 'delete' ? handleDelete(reply) : handleReport()"
                    >
                      <button type="button" class="more-btn" aria-label="更多">
                        <MdiIcon :path="mdiDotsVertical" size="16px" />
                      </button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item v-if="canDelete(reply)" command="delete">
                            <MdiIcon :path="mdiDeleteOutline" size="16px" />
                            <span>删除</span>
                          </el-dropdown-item>
                          <el-dropdown-item v-if="!isMine(reply)" command="report">
                            <MdiIcon :path="mdiFlagOutline" size="16px" />
                            <span>举报</span>
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="repliesHasMore" class="tail-row">
            <button
              type="button"
              class="load-more-btn"
              :disabled="repliesLoadingMore"
              @click="loadMoreReplies"
            >
              {{ repliesLoadingMore ? '加载中…' : '加载更多' }}
            </button>
          </div>
        </template>
      </div>

      <div v-else class="list-view">
        <div v-if="status === 'init'" class="state-block">
          <div class="loading-dot" />
        </div>
        <div v-else-if="status === 'failed'" class="state-block">
          <MdiIcon :path="mdiCommentOutline" size="40px" class="state-icon" />
          <p>评论加载失败，请检查网络后重试</p>
          <button type="button" class="retry-btn" @click="load()">重试</button>
        </div>
        <div v-else-if="isEmpty" class="state-block">
          <MdiIcon :path="mdiCommentOutline" size="40px" class="state-icon" />
          <p class="state-title">还没有评论</p>
          <p class="state-subtitle">来说点什么吧</p>
        </div>
        <template v-else>
          <template v-if="hotThreads.length">
            <div class="section-header">热门评论</div>
            <div
              v-for="thread in hotThreads"
              :key="`hot-${thread.comment.id}`"
              class="thread-item"
            >
              <CommentThreadBlock
                :thread="thread"
                :can-delete="canDelete"
                :is-mine="isMine"
                :show-more="showMore"
                :format-time="formatRelativeTime"
                @like="toggleLike"
                @reply="startReply"
                @delete="handleDelete"
                @report="handleReport"
                @user="jumpUser"
                @open-replies="openReplies"
              />
            </div>
          </template>

          <div class="section-header">
            <span>全部评论</span>
            <div class="order-tabs">
              <button
                type="button"
                class="order-tab"
                :class="{ active: order === ORDER_NEWEST }"
                @click="changeOrder(ORDER_NEWEST)"
              >最新</button>
              <button
                type="button"
                class="order-tab"
                :class="{ active: order === ORDER_OLDEST }"
                @click="changeOrder(ORDER_OLDEST)"
              >最早</button>
            </div>
          </div>

          <div
            v-for="thread in threads"
            :key="thread.comment.id"
            class="thread-item"
          >
            <CommentThreadBlock
              :thread="thread"
              :can-delete="canDelete"
              :is-mine="isMine"
              :show-more="showMore"
              :format-time="formatRelativeTime"
              @like="toggleLike"
              @reply="startReply"
              @delete="handleDelete"
              @report="handleReport"
              @user="jumpUser"
              @open-replies="openReplies"
            />
          </div>

          <div class="tail-row">
            <button
              v-if="loadMoreFailed"
              type="button"
              class="retry-btn"
              @click="loadMore"
            >更多评论加载失败，点此重试</button>
            <button
              v-else-if="hasMore"
              type="button"
              class="load-more-btn"
              :disabled="loadingMore"
              @click="loadMore"
            >{{ loadingMore ? '加载中…' : '加载更多' }}</button>
          </div>
        </template>
      </div>
    </div>

    <div class="composer" :class="{ focused: composerFocused, 'can-send': canSend }">
      <div v-if="replyTo" class="replying-bar">
        <span class="replying-text">回复 {{ replyTo.author?.username || '' }}</span>
        <button type="button" class="cancel-reply" aria-label="取消回复" @click="cancelReply">
          <MdiIcon :path="mdiClose" size="14px" />
        </button>
      </div>
      <div class="composer-row">
        <textarea
          ref="inputEl"
          v-model="input"
          class="composer-input"
          rows="1"
          maxlength="500"
          :disabled="sending"
          placeholder="哈一些基米"
          @focus="composerFocused = true"
          @blur="composerFocused = false"
          @keydown="onComposerKeydown"
          @input="onComposerInput"
        />
        <div class="composer-side">
          <span v-if="remainingChars <= 50" class="chars-left">{{ remainingChars }}</span>
          <button
            type="button"
            class="send-btn"
            :disabled="!canSend"
            aria-label="发送"
            @click="send"
          >
            <span v-if="sending" class="send-spinner" />
            <MdiIcon v-else :path="mdiSend" size="18px" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.song-comments {
  margin-top: 28px;
  padding: 0 0 8px;
  border-top: 1px solid var(--hw-border);
  width: 100%;
}

.comments-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 16px;
  margin-bottom: 8px;
}

.back-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--hw-text-primary);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.back-btn:hover {
  background: var(--hw-bg-hover);
}

.comments-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--hw-text-primary);
}

.comments-body {
  min-height: 160px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  margin-top: 16px;
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 500;
  color: var(--hw-text-primary);
}

.order-tabs {
  display: flex;
  gap: 2px;
}

.order-tab {
  border: none;
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.order-tab.active {
  color: var(--hw-text-primary);
  font-weight: 500;
}

.order-tab:hover {
  background: var(--hw-bg-hover);
}

.thread-item {
  padding: 10px 0;
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 220px;
  color: var(--hw-text-secondary);
  text-align: center;
}

.state-icon {
  color: var(--hw-text-tertiary);
  margin-bottom: 4px;
}

.state-title {
  font-size: 15px;
  color: var(--hw-text-primary);
}

.state-subtitle {
  font-size: 13px;
  color: var(--hw-text-tertiary);
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

.retry-btn,
.load-more-btn {
  border: none;
  background: transparent;
  color: var(--theme-color);
  font-size: 13px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
}

.retry-btn:hover,
.load-more-btn:hover {
  background: var(--theme-color-light);
}

.tail-row {
  display: flex;
  justify-content: center;
  padding: 8px 0 16px;
}

.replies-divider {
  height: 1px;
  background: var(--hw-border);
  margin: 6px 0 10px;
}

.root-comment,
.comment-block {
  padding: 8px 0;
}

.comment-removed {
  font-size: 14px;
  color: var(--hw-text-secondary);
  padding: 4px 0;
}

.comment-row {
  display: flex;
  width: 100%;
}

.avatar {
  flex-shrink: 0;
  border: none;
  padding: 0;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  background: var(--hw-bg-hover);
  color: var(--hw-text-secondary);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 12px;
  font-weight: 500;
}

.avatar-lg { width: 36px; height: 36px; }
.avatar-md { width: 28px; height: 28px; }

.comment-main {
  flex: 1;
  min-width: 0;
  padding-left: 10px;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.username {
  border: none;
  background: transparent;
  padding: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--hw-text-secondary);
  cursor: pointer;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.username:hover {
  color: var(--hw-text-primary);
}

.time {
  font-size: 12px;
  color: var(--hw-text-tertiary);
  flex-shrink: 0;
}

.comment-content {
  margin-top: 3px;
  font-size: 15px;
  line-height: 22px;
  color: var(--hw-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.reply-inline {
  color: var(--hw-text-secondary);
}

.comment-actions {
  display: flex;
  align-items: center;
  margin-top: 2px;
}

.reply-text-btn {
  border: none;
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 12px;
  padding: 4px;
  margin-left: -4px;
  border-radius: 4px;
  cursor: pointer;
}

.reply-text-btn:hover {
  background: var(--hw-bg-hover);
}

.actions-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
}

.like-btn,
.more-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 999px;
  cursor: pointer;
}

.like-btn:hover,
.more-btn:hover {
  background: var(--hw-bg-hover);
}

.like-btn.liked {
  color: var(--theme-color);
}

.composer {
  margin-top: 12px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--hw-text-primary) 5%, transparent);
  border: 1px solid var(--hw-border);
  transition: border-color 0.2s;
}

.composer.focused {
  border-color: color-mix(in srgb, var(--hw-text-primary) 30%, transparent);
}

.replying-bar {
  display: flex;
  align-items: center;
  padding: 6px 8px 0 14px;
}

.replying-text {
  flex: 1;
  font-size: 12px;
  color: var(--hw-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cancel-reply {
  border: none;
  background: transparent;
  color: var(--hw-text-secondary);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.cancel-reply:hover {
  background: var(--hw-bg-hover);
}

.composer-row {
  display: flex;
  align-items: flex-end;
  padding: 6px;
  gap: 4px;
}

.composer-input {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--hw-text-primary);
  font-size: 15px;
  line-height: 22px;
  padding: 7px 8px;
  min-height: 36px;
  max-height: 110px;
  font-family: inherit;
}

.composer-input::placeholder {
  color: var(--hw-text-secondary);
}

.composer-side {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chars-left {
  font-size: 11px;
  color: var(--hw-text-secondary);
  margin-bottom: 4px;
}

.send-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--hw-text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.composer.can-send .send-btn {
  background: var(--theme-color);
  color: #fff;
}

.send-btn:disabled {
  cursor: default;
}

.send-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
