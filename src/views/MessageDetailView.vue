<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mdiArrowLeft, mdiBellOutline } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import {
  getNotificationDetail,
  markNotificationRead,
  notificationActionLabel,
  notificationIntentPath,
  type NotificationItem,
} from '@/api/notification'
import { useMessageStore } from '@/stores/message'
import { formatDateTime } from '@/utils/relativeTime'

const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()

const item = ref<NotificationItem | null>(null)
const loading = ref(false)
const unavailable = ref(false)
const errorText = ref('')
const markFailed = ref(false)

const notificationId = computed(() => String(route.params.id || ''))

const actionLabel = computed(() =>
  item.value ? notificationActionLabel(item.value.content_intent?.action) : null,
)
const actionPath = computed(() =>
  item.value ? notificationIntentPath(item.value.content_intent) : null,
)

async function load() {
  if (!notificationId.value) return
  loading.value = true
  unavailable.value = false
  errorText.value = ''
  markFailed.value = false
  try {
    item.value = await getNotificationDetail(notificationId.value)
    await markReadIfUnread()
  } catch (e: unknown) {
    item.value = null
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : ''
    if (code === 'notification_unavailable' || code === 'invalid_notification_id') {
      unavailable.value = true
    } else {
      errorText.value = '暂时无法加载通知，请检查网络后重试'
    }
  } finally {
    loading.value = false
  }
}

async function markReadIfUnread() {
  if (!item.value || item.value.read_time) return
  try {
    const resp = await markNotificationRead(item.value.notification_id)
    item.value = { ...item.value, read_time: resp.read_time }
    messageStore.setSystemUnread(resp.unread_count)
    markFailed.value = false
  } catch {
    markFailed.value = true
  }
}

function goAction() {
  if (actionPath.value) router.push(actionPath.value)
}

watch(notificationId, () => {
  void load()
})

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="msg-page">
    <div class="msg-shell">
      <div class="msg-hero">
        <button type="button" class="back-btn" aria-label="返回" @click="router.push('/messages/system')">
          <MdiIcon :path="mdiArrowLeft" size="20px" />
        </button>
        <h1 class="hero-title">通知详情</h1>
      </div>

      <div v-if="loading" class="state-card">
        <div class="loading-dot" />
      </div>

      <div v-else-if="unavailable" class="state-card">
        <div class="empty-icon">
          <MdiIcon :path="mdiBellOutline" size="28px" />
        </div>
        <p class="empty-title">通知不存在或已过期</p>
        <button type="button" class="subtle-btn" @click="router.push('/messages/system')">返回系统通知</button>
      </div>

      <div v-else-if="errorText" class="state-card">
        <p>{{ errorText }}</p>
        <button type="button" class="primary-btn" @click="load">重试</button>
      </div>

      <article v-else-if="item" class="detail">
        <h2 class="detail-title">{{ item.title }}</h2>
        <p class="detail-time">{{ formatDateTime(item.create_time) }}</p>
        <p v-if="markFailed" class="mark-failed">
          暂未标为已读
          <button type="button" class="link-btn" @click="markReadIfUnread">重试</button>
        </p>
        <p class="detail-body">{{ item.body }}</p>
        <button
          v-if="actionLabel && actionPath"
          type="button"
          class="primary-btn action"
          @click="goAction"
        >
          {{ actionLabel }}
        </button>
      </article>
    </div>
  </div>
</template>

<style scoped>
.msg-page {
  min-height: calc(100vh - var(--hw-header-height));
  background: var(--hw-bg-primary);
  padding: 0 0 80px;
}

.msg-shell {
  max-width: 720px;
  margin: 0 auto;
}

.msg-hero {
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
}

.back-btn:hover {
  background: var(--hw-bg-hover);
}

.hero-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--hw-text-primary);
}

.detail {
  max-width: 640px;
}

.detail-title {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--hw-text-primary);
}

.detail-time {
  margin-top: 8px;
  font-size: 13px;
  color: var(--hw-text-tertiary);
}

.mark-failed {
  margin-top: 4px;
  font-size: 13px;
  color: var(--hw-text-tertiary);
}

.link-btn {
  border: none;
  background: transparent;
  color: var(--theme-color);
  cursor: pointer;
  font-size: 13px;
  margin-left: 6px;
}

.detail-body {
  margin-top: 20px;
  font-size: 15px;
  line-height: 1.7;
  color: var(--hw-text-primary);
  white-space: pre-wrap;
}

.primary-btn {
  border: none;
  border-radius: 12px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: var(--theme-color);
  color: #fff;
}

.primary-btn.action {
  margin-top: 28px;
}

.subtle-btn {
  border: none;
  border-radius: 12px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  background: var(--hw-bg-hover);
  color: var(--hw-text-primary);
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

.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--hw-text-primary) 5%, transparent);
  color: var(--hw-text-tertiary);
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--hw-text-primary);
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
</style>
