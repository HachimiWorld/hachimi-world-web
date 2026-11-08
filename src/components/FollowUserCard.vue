<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { mdiAccount } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import type { UserProfile } from '@/api/song'

const props = defineProps<{
  user: UserProfile
  /** 是否已关注对方 */
  following?: boolean
  /** 是否互关（影响按钮文案） */
  isMutual?: boolean
  actionLoading?: boolean
}>()

const emit = defineEmits<{
  follow: []
  unfollow: []
}>()

const router = useRouter()

const bioText = computed(() => {
  if (props.user.is_banned) return ''
  return props.user.bio?.trim() || ''
})

const isFollowing = computed(() => props.following ?? props.isMutual ?? false)

const actionLabel = computed(() => {
  if (!isFollowing.value) return '关注'
  if (props.isMutual) return '互相关注'
  return '已关注'
})

function openUser() {
  router.push(`/user/${props.user.uid}`)
}

function onAction() {
  if (isFollowing.value) emit('unfollow')
  else emit('follow')
}
</script>

<template>
  <article class="follow-card" @click="openUser">
    <div class="avatar">
      <img v-if="user.avatar_url" :src="user.avatar_url" :alt="user.username">
      <span v-else class="avatar-fallback">
        <MdiIcon :path="mdiAccount" size="22px" />
      </span>
    </div>

    <div class="info">
      <h3 class="username">{{ user.is_banned ? '已注销用户' : user.username }}</h3>
      <p v-if="bioText" class="bio">{{ bioText }}</p>
    </div>

    <button
      type="button"
      class="action-btn"
      :class="{ primary: !isFollowing }"
      :disabled="actionLoading"
      @click.stop="onAction"
    >
      {{ actionLabel }}
    </button>
  </article>
</template>

<style scoped>
.follow-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 14px;
  background: var(--hw-bg-secondary);
  cursor: pointer;
  transition: background 0.15s;
}

.follow-card:hover {
  background: color-mix(in srgb, var(--hw-bg-secondary) 88%, var(--theme-color));
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--hw-bg-hover);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hw-text-tertiary);
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.username {
  font-size: 16px;
  font-weight: 600;
  color: var(--hw-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bio {
  font-size: 13px;
  color: var(--hw-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-btn {
  flex-shrink: 0;
  border: 1px solid var(--hw-border);
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.action-btn.primary {
  border-color: transparent;
  background: var(--theme-color);
  color: #fff;
}

.action-btn:hover:not(:disabled):not(.primary) {
  border-color: var(--theme-color);
  color: var(--theme-color);
  background: var(--theme-color-light);
}

.action-btn.primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--theme-color) 88%, #000);
}

.action-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

@media (max-width: 640px) {
  .avatar {
    width: 48px;
    height: 48px;
  }

  .follow-card {
    border-radius: 12px;
  }
}
</style>
