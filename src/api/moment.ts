import { http, ApiError } from './request'
import { API_BASE_URL } from './config'
import { useAuthStore } from '@/stores/auth'
import type { Song } from './song'
import type { PlaylistMetadata } from './playlist'

export const CONTENT_MAX_CHARS = 500
export const MAX_IMAGES = 9

export interface MomentUser {
  uid: number
  username: string
  avatar_url: string | null
}

export interface MomentImage {
  url: string
  thumb_url: string
  width: number
  height: number
}

export interface MomentAttachment {
  type: string
  data: Song | PlaylistMetadata | Record<string, unknown> | null
}

export interface MomentItem {
  id: number
  author: MomentUser
  content: string
  images: MomentImage[]
  attachments: MomentAttachment[]
  like_count: number
  liked: boolean
  comment_count: number
  is_hidden: boolean
  create_time: string
}

export interface MomentListResp {
  items: MomentItem[]
  next_cursor: string | null
}

export interface UploadMomentImageResp {
  image_id: string
  url: string
  thumb_url: string
  width: number
  height: number
}

export interface CreateMomentReq {
  content?: string
  image_ids?: string[]
  attachments?: Array<{ type: string; data: Record<string, unknown> }>
}

async function requireToken(): Promise<string> {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) throw new Error('not_logged_in')
  const token = await authStore.ensureValidToken()
  if (!token) throw new Error('not_logged_in')
  return token
}

async function optionalToken(): Promise<string | undefined> {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) return undefined
  return (await authStore.ensureValidToken()) ?? undefined
}

export async function getMomentDetail(momentId: number): Promise<MomentItem> {
  const token = await optionalToken()
  return http.get<MomentItem>(`/moment/detail?moment_id=${momentId}`, token)
}

export async function listMomentsByUser(params: {
  userId: number
  cursor?: string
  limit?: number
}): Promise<MomentListResp> {
  const token = await optionalToken()
  const query = new URLSearchParams()
  query.set('user_id', String(params.userId))
  if (params.cursor) query.set('cursor', params.cursor)
  query.set('limit', String(params.limit ?? 20))
  return http.get(`/moment/list_by_user?${query.toString()}`, token)
}

export async function createMoment(req: CreateMomentReq): Promise<{ moment: MomentItem | null }> {
  const token = await requireToken()
  return http.post('/moment/create', {
    content: req.content ?? '',
    image_ids: req.image_ids ?? [],
    attachments: req.attachments ?? [],
  }, token)
}

export async function deleteMoment(momentId: number): Promise<void> {
  const token = await requireToken()
  return http.post('/moment/delete', { moment_id: momentId }, token)
}

export async function likeMoment(momentId: number): Promise<void> {
  const token = await requireToken()
  return http.post('/moment/like', { moment_id: momentId }, token)
}

export async function unlikeMoment(momentId: number): Promise<void> {
  const token = await requireToken()
  return http.post('/moment/unlike', { moment_id: momentId }, token)
}

/** multipart：文件作为唯一字段 */
export async function uploadMomentImage(file: File): Promise<UploadMomentImageResp> {
  const token = await requireToken()
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE_URL}/moment/upload_image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const json = await res.json()
  if (!json.ok) throw new ApiError(json.data.code, json.data.msg)
  return json.data as UploadMomentImageResp
}

export function momentErrorMessage(code: string): string | null {
  switch (code) {
    case 'moment_empty':
      return '动态需要文字、图片或附件'
    case 'content_too_long':
      return '文字过长'
    case 'too_many_images':
      return '图片最多 9 张'
    case 'too_many_attachments':
      return '附件过多'
    case 'image_not_found':
      return '图片已过期，请重新上传'
    case 'unknown_attachment':
      return '不支持的附件类型'
    case 'invalid_attachment':
      return '附件无效或不可见'
    case 'moment_rejected':
      return '内容未通过审核'
    case 'image_rejected':
      return '图片未通过审核'
    case 'image_too_large':
      return '图片需小于 8MB'
    case 'invalid_image':
      return '不支持的图片格式'
    case 'rate_limited':
      return '发布过于频繁，请稍后再试'
    case 'user_banned':
      return '账号已被限制，无法发布'
    case 'moment_not_found':
      return '动态不存在'
    default:
      return null
  }
}
