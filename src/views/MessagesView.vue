<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  mdiBellOutline,
  mdiChevronRight,
  mdiCommentOutline,
  mdiHeartOutline,
  mdiAccountPlus,
} from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/message'
import { formatBadgeCount } from '@/utils/relativeTime'

const authStore = useAuthStore()
const messageStore = useMessageStore()
const router = useRouter()

const loginDialogOpen = ref(false)

const channels = computed(() => [
  {
    key: 'system',
    label: '系统通知',
    icon: mdiBellOutline,
    path: '/messages/system',
    unread: messageStore.systemUnread,
  },
  {
    key: 'replies',
    label: '回复我的',
    icon: mdiCommentOutline,
    path: '/messages/replies',
    unread: messageStore.replyUnread,
  },
  {
    key: 'likes',
    label: '收到的赞',
    icon: mdiHeartOutline,
    path: '/messages/likes',
    unread: messageStore.likeUnread,
  },
  {
    key: 'followers',
    label: '新粉丝',
    icon: mdiAccountPlus,
    path: '/messages/followers',
    unread: messageStore.followUnread,
  },
])

function selectChannel(path: string) {
  if (!authStore.isLoggedIn) {
    loginDialogOpen.value = true
    return
  }
  router.push(path)
}

function onLoginDialogChange(open: boolean) {
  loginDialogOpen.value = open
  if (!open && authStore.isLoggedIn) void messageStore.refreshSummary()
}

onMounted(() => {
  if (!authStore.isLoggedIn) {
    loginDialogOpen.value = true
    return
  }
  void messageStore.refreshSummary()
})
</script>

<template>
  <div class="msg-page">
    <div class="msg-shell">
      <div class="msg-hero">
        <div class="hero-left">
          <MdiIcon class="hero-icon" :path="mdiBellOutline" size="36px" />
          <div>
            <h1 class="hero-title">消息</h1>
            <p class="hero-sub">系统通知与互动消息</p>
          </div>
        </div>
      </div>

      <div v-if="!authStore.isLoggedIn" class="state-card">
        <MdiIcon :path="mdiBellOutline" size="28px" class="state-icon" />
        <p>登录后查看消息</p>
        <button type="button" class="primary-btn" @click="loginDialogOpen = true">去登录</button>
      </div>

      <div v-else class="channel-card">
        <button
          v-for="ch in channels"
          :key="ch.key"
          type="button"
          class="channel-row"
          @click="selectChannel(ch.path)"
        >
          <MdiIcon class="channel-icon" :path="ch.icon" size="22px" />
          <span class="channel-label">{{ ch.label }}</span>
          <span v-if="ch.unread > 0" class="unread-badge">{{ formatBadgeCount(ch.unread) }}</span>
          <MdiIcon class="chevron" :path="mdiChevronRight" size="20px" />
        </button>
      </div>
    </div>

    <LoginDialog :model-value="loginDialogOpen" @update:model-value="onLoginDialogChange" />
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
  padding: 0 0 24px;
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.hero-icon {
  color: var(--theme-color);
  flex-shrink: 0;
}

.hero-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--hw-text-primary);
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.hero-sub {
  margin-top: 4px;
  font-size: 13px;
  color: var(--hw-text-tertiary);
}

.channel-card {
  border-radius: 16px;
  background: var(--hw-bg-secondary);
  overflow: hidden;
  border: 1px solid var(--hw-border);
}

.channel-row {
  width: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border: none;
  background: transparent;
  color: var(--hw-text-primary);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.channel-row + .channel-row {
  border-top: 1px solid var(--hw-border);
}

.channel-row:hover {
  background: var(--hw-bg-hover);
}

.channel-icon {
  color: var(--hw-text-secondary);
  flex-shrink: 0;
}

.channel-label {
  flex: 1;
  margin-left: 14px;
  font-size: 15px;
  font-weight: 600;
}

.unread-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--theme-color);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}

.chevron {
  margin-left: 4px;
  color: var(--hw-text-tertiary);
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

.state-icon {
  color: var(--hw-text-tertiary);
}

.primary-btn {
  border: none;
  border-radius: 12px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  background: var(--theme-color);
  color: #fff;
}
</style>
