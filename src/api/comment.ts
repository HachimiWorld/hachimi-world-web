import { http } from './request'
import { useAuthStore } from '@/stores/auth'

export const TARGET_SONG = 'song'
export const TARGET_POST = 'post'
export const TARGET_MOMENT = 'moment'

export const ORDER_NEWEST = 'newest'
export const ORDER_OLDEST = 'oldest'

export const CONTENT_MAX_CHARS = 500
export const FIRST_REPLIES = 3
export const PAGE_SIZE = 20

export interface CommentUser {
  uid: number
  username: string
  avatar_url: string | null
}

export interface CommentItem {
  id: number
  target_type: string
  target_id: number
  root_id: number | null
  reply_to_id: number | null
  reply_to_user: CommentUser | null
  author: CommentUser | null
  content: string
  removed: boolean
  like_count: number
  liked: boolean
  create_time: string
}

export interface CommentThread {
  comment: CommentItem
  replies: CommentItem[]
  reply_count: number
}

export interface CommentListResp {
  total: number
  threads: CommentThread[]
  has_more: boolean
}

export interface CommentHotResp {
  threads: CommentThread[]
}

export interface CommentRepliesResp {
  total: number
  replies: CommentItem[]
}

export interface CommentCreateResp {
  comment: CommentItem | null
}

async function getToken(required = false): Promise<string | undefined> {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) {
    if (required) throw new Error('not_logged_in')
    return undefined
  }
  const token = await authStore.ensureValidToken()
  return token ?? undefined
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, String(value))
  }
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export async function listComments(params: {
  targetType: string
  targetId: number
  order?: string
  afterTime?: string
  afterCommentId?: number
  limit?: number
}): Promise<CommentListResp> {
  const token = await getToken()
  const qs = buildQuery({
    target_type: params.targetType,
    target_id: params.targetId,
    order: params.order,
    after_time: params.afterTime,
    after_comment_id: params.afterCommentId,
    limit: params.limit ?? PAGE_SIZE,
  })
  return http.get<CommentListResp>(`/comment/list${qs}`, token)
}

export async function listHotComments(params: {
  targetType: string
  targetId: number
}): Promise<CommentHotResp> {
  const token = await getToken()
  const qs = buildQuery({
    target_type: params.targetType,
    target_id: params.targetId,
  })
  return http.get<CommentHotResp>(`/comment/hot${qs}`, token)
}

export async function listCommentReplies(params: {
  rootId: number
  pageIndex?: number
  pageSize?: number
}): Promise<CommentRepliesResp> {
  const token = await getToken()
  const qs = buildQuery({
    root_id: params.rootId,
    page_index: params.pageIndex ?? 0,
    page_size: params.pageSize ?? PAGE_SIZE,
  })
  return http.get<CommentRepliesResp>(`/comment/replies${qs}`, token)
}

export async function createComment(params: {
  targetType: string
  targetId: number
  content: string
  replyToId?: number | null
}): Promise<CommentCreateResp> {
  const token = await getToken(true)
  return http.post<CommentCreateResp>(
    '/comment/create',
    {
      target_type: params.targetType,
      target_id: params.targetId,
      content: params.content,
      reply_to_id: params.replyToId ?? null,
    },
    token,
  )
}

export async function deleteComment(commentId: number): Promise<void> {
  const token = await getToken(true)
  return http.post<void>('/comment/delete', { comment_id: commentId }, token)
}

export async function likeComment(commentId: number): Promise<void> {
  const token = await getToken(true)
  return http.post<void>('/comment/like', { comment_id: commentId }, token)
}

export async function unlikeComment(commentId: number): Promise<void> {
  const token = await getToken(true)
  return http.post<void>('/comment/unlike', { comment_id: commentId }, token)
}

export function commentErrorMessage(code: string): string | null {
  switch (code) {
    case 'comment_rejected':
      return '评论包含不适宜的内容，请修改后再试'
    case 'comment_empty':
      return '评论不能为空'
    case 'comment_too_long':
      return '评论最多 500 字'
    case 'rate_limited':
      return '评论太频繁了，请稍后再试'
    case 'user_banned':
      return '你的账号已被限制，暂时不能评论'
    case 'comment_not_found':
      return '这条评论不存在或已删除'
    case 'target_not_found':
      return '作品不存在或已删除'
    case 'permission_denied':
      return '你不能删除这条评论'
    default:
      return null
  }
}
