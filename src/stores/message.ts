import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  CHANNEL_FOLLOW,
  CHANNEL_LIKE,
  CHANNEL_REPLY,
  getMessageSummary,
  markMessageRead,
  type MessageSummary,
} from '@/api/message'
import { useAuthStore } from '@/stores/auth'

export const useMessageStore = defineStore('message', () => {
  const summary = ref<MessageSummary | null>(null)
  const loading = ref(false)

  const totalUnread = computed(() => summary.value?.total_unread ?? 0)
  const systemUnread = computed(() => summary.value?.system_unread ?? 0)
  const likeUnread = computed(() => summary.value?.like_unread ?? 0)
  const followUnread = computed(() => summary.value?.follow_unread ?? 0)
  const replyUnread = computed(() => summary.value?.reply_unread ?? 0)

  const badgeText = computed(() => {
    const n = totalUnread.value
    if (n <= 0) return ''
    return n > 99 ? '99+' : String(n)
  })

  function readTimeOf(channel: string): string | null {
    if (!summary.value) return null
    if (channel === CHANNEL_LIKE) return summary.value.like_read_time
    if (channel === CHANNEL_FOLLOW) return summary.value.follow_read_time
    if (channel === CHANNEL_REPLY) return summary.value.reply_read_time ?? null
    return null
  }

  async function refreshSummary() {
    const authStore = useAuthStore()
    if (!authStore.isLoggedIn) {
      summary.value = null
      return
    }
    loading.value = true
    try {
      summary.value = await getMessageSummary()
    } catch {
      // keep previous summary
    } finally {
      loading.value = false
    }
  }

  /**
   * 打开赞/粉/回复频道：整频道标为已读，并返回打开前的 read_time，
   * 用于标记「新」条目（时间晚于上次已读）。
   */
  async function openChannel(channel: string): Promise<string | null> {
    if (!readTimeOf(channel)) {
      try {
        await refreshSummary()
      } catch {
        /* ignore */
      }
    }
    const previous = readTimeOf(channel)
    try {
      const { read_time } = await markMessageRead(channel)
      if (!summary.value) return previous
      const next = { ...summary.value }
      if (channel === CHANNEL_LIKE) {
        next.like_read_time = read_time
        next.like_unread = 0
      } else if (channel === CHANNEL_FOLLOW) {
        next.follow_read_time = read_time
        next.follow_unread = 0
      } else if (channel === CHANNEL_REPLY) {
        next.reply_read_time = read_time
        next.reply_unread = 0
      }
      next.total_unread =
        (next.system_unread || 0)
        + (next.like_unread || 0)
        + (next.follow_unread || 0)
        + (next.reply_unread || 0)
      summary.value = next
    } catch {
      /* ignore mark failures; list still loads */
    }
    return previous
  }

  function setSystemUnread(count: number) {
    if (!summary.value) {
      summary.value = {
        total_unread: count,
        system_unread: count,
        like_unread: 0,
        follow_unread: 0,
        reply_unread: 0,
        like_read_time: '',
        follow_read_time: '',
        reply_read_time: '',
      }
      return
    }
    const next = { ...summary.value, system_unread: count }
    next.total_unread =
      (next.system_unread || 0)
      + (next.like_unread || 0)
      + (next.follow_unread || 0)
      + (next.reply_unread || 0)
    summary.value = next
  }

  function clear() {
    summary.value = null
  }

  return {
    summary,
    loading,
    totalUnread,
    systemUnread,
    likeUnread,
    followUnread,
    replyUnread,
    badgeText,
    refreshSummary,
    openChannel,
    setSystemUnread,
    clear,
  }
})
