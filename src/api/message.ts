import { http } from './request'
import { useAuthStore } from '@/stores/auth'
import type { CommentItem } from './comment'

export const CHANNEL_LIKE = 'like'
export const CHANNEL_FOLLOW = 'follow'
export const CHANNEL_REPLY = 'reply'

export interface MessageSummary {
  total_unread: number
  system_unread: number
  like_unread: number
  follow_unread: number
  reply_unread: number
  like_read_time: string
  follow_read_time: string
  reply_read_time?: string | null
}

export interface Liker {
  uid: number
  username: string
  avatar_url: string | null
}

export interface ReceivedLikeItem {
  song_id: number
  song_display_id: string
  song_title: string
  cover_url: string
  like_count: number
  latest_like_time: string
  latest_likers: Liker[]
}

export interface UgcPreview {
  type: string
  title?: string
  cover_url?: string | null
  display_id?: string
  name?: string
  username?: string
  avatar_url?: string | null
  id?: number
  content?: string
  on?: UgcPreview | null
}

export interface ReplyTarget {
  target_type: string
  target_id: number
  preview: UgcPreview
}

export interface ReceivedReplyItem {
  comment: CommentItem
  target: ReplyTarget
  replied_content: string | null
}

async function requireToken(): Promise<string> {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) throw new Error('not_logged_in')
  const token = await authStore.ensureValidToken()
  if (!token) throw new Error('not_logged_in')
  return token
}

export async function getMessageSummary(): Promise<MessageSummary> {
  const token = await requireToken()
  return http.get<MessageSummary>('/message/summary', token)
}

export async function markMessageRead(channel: string): Promise<{ read_time: string }> {
  const token = await requireToken()
  return http.post<{ read_time: string }>('/message/mark_read', { channel }, token)
}

export async function getReceivedLikes(params?: {
  beforeTime?: string
  beforeSongId?: number
  limit?: number
}): Promise<{ items: ReceivedLikeItem[]; has_more: boolean }> {
  const token = await requireToken()
  const query = new URLSearchParams()
  if (params?.beforeTime) query.set('before_time', params.beforeTime)
  if (params?.beforeSongId != null) query.set('before_song_id', String(params.beforeSongId))
  query.set('limit', String(params?.limit ?? 20))
  return http.get(`/message/received_likes?${query.toString()}`, token)
}

export async function getReceivedReplies(params?: {
  beforeTime?: string
  beforeCommentId?: number
  limit?: number
}): Promise<{ items: ReceivedReplyItem[]; has_more: boolean }> {
  const token = await requireToken()
  const query = new URLSearchParams()
  if (params?.beforeTime) query.set('before_time', params.beforeTime)
  if (params?.beforeCommentId != null) query.set('before_comment_id', String(params.beforeCommentId))
  query.set('limit', String(params?.limit ?? 20))
  return http.get(`/message/received_replies?${query.toString()}`, token)
}

export function previewHeadline(preview?: UgcPreview | null): string {
  if (!preview) return ''
  if (preview.type === 'song') return preview.title || ''
  if (preview.type === 'playlist') return preview.name || ''
  if (preview.type === 'user') return preview.username || ''
  if (preview.type === 'post') return preview.title || ''
  if (preview.type === 'comment') return preview.content || ''
  return preview.title || preview.name || preview.username || preview.content || ''
}

export function previewImage(preview?: UgcPreview | null): string | null {
  if (!preview) return null
  if (preview.type === 'song') return preview.cover_url || null
  if (preview.type === 'playlist') return preview.cover_url || null
  if (preview.type === 'user') return preview.avatar_url || null
  if (preview.type === 'post') return preview.cover_url || null
  if (preview.type === 'comment') return previewImage(preview.on)
  return null
}
