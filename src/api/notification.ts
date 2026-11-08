import { http } from './request'
import { useAuthStore } from '@/stores/auth'

export interface ContentIntent {
  action: string
  data: Record<string, unknown>
}

export interface NotificationItem {
  notification_id: string
  type: string
  title: string
  body: string
  content_intent: ContentIntent | null
  read_time: string | null
  create_time: string
}

async function requireToken(): Promise<string> {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) throw new Error('not_logged_in')
  const token = await authStore.ensureValidToken()
  if (!token) throw new Error('not_logged_in')
  return token
}

export async function listNotifications(params?: {
  beforeId?: string
  limit?: number
}): Promise<{ items: NotificationItem[]; has_more: boolean }> {
  const token = await requireToken()
  const query = new URLSearchParams()
  if (params?.beforeId) query.set('before_id', params.beforeId)
  query.set('limit', String(params?.limit ?? 20))
  return http.get(`/notification/list?${query.toString()}`, token)
}

export async function getNotificationDetail(notificationId: string): Promise<NotificationItem> {
  const token = await requireToken()
  return http.get(`/notification/detail?notification_id=${encodeURIComponent(notificationId)}`, token)
}

export async function getNotificationUnreadCount(): Promise<{ unread_count: number }> {
  const token = await requireToken()
  return http.get('/notification/unread_count', token)
}

export async function markNotificationRead(notificationId: string): Promise<{
  notification_id: string
  read_time: string
  unread_count: number
}> {
  const token = await requireToken()
  return http.post('/notification/mark_read', { notification_id: notificationId }, token)
}

export async function markAllNotificationsRead(): Promise<{
  marked_count: number
  unread_count: number
}> {
  const token = await requireToken()
  return http.post('/notification/mark_all_read', {}, token)
}

export function notificationActionLabel(action?: string | null): string | null {
  switch (action) {
    case 'profile.edit':
    case 'user.edit_profile':
    case 'edit_profile':
      return '去修改资料'
    case 'creation.review.view':
    case 'song.review.view':
    case 'publish.review.view':
      return '查看稿件'
    case 'creation.artwork.view':
    case 'song.view':
      return '查看作品'
    case 'playlist.view':
      return '查看歌单'
    case 'song.comment.view':
    case 'post.comment.view':
    case 'moment.comment.view':
      return '查看评论'
    default:
      return null
  }
}

/** 将 content_intent 解析为站内路径；无法处理时返回 null */
export function notificationIntentPath(intent: ContentIntent | null | undefined): string | null {
  if (!intent) return null
  const data = intent.data || {}
  const num = (key: string) => {
    const v = data[key]
    if (typeof v === 'number') return v
    if (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))) return Number(v)
    return null
  }
  const str = (key: string) => {
    const v = data[key]
    return typeof v === 'string' && v ? v : null
  }

  switch (intent.action) {
    case 'profile.edit':
    case 'user.edit_profile':
    case 'edit_profile':
      return '/settings'
    case 'creation.artwork.view':
    case 'song.view': {
      const id = num('song_id')
      return id != null ? `/song/${id}` : null
    }
    case 'playlist.view': {
      const id = num('playlist_id')
      return id != null ? `/playlist/${id}` : null
    }
    case 'song.comment.view': {
      const displayId = str('song_display_id')
      const songId = num('song_id')
      if (songId != null) return `/song/${songId}`
      if (displayId) return `/song/${encodeURIComponent(displayId)}`
      return null
    }
    default:
      return null
  }
}
