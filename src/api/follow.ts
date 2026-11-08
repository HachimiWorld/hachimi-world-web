import { http } from './request'
import { useAuthStore } from '@/stores/auth'
import type { UserProfile } from './song'

export interface FollowingItem {
  user: UserProfile
  is_mutual: boolean
  followed_at: string
}

export interface FollowerItem {
  user: UserProfile
  is_mutual: boolean
  followed_at: string
}

export interface FollowListResp<T> {
  items: T[]
  next_cursor?: string | null
}

export interface FollowResp {
  follower_count: number
}

async function requireToken(): Promise<string> {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) throw new Error('not_logged_in')
  const token = await authStore.ensureValidToken()
  if (!token) throw new Error('not_logged_in')
  return token
}

export async function followUser(targetUid: number): Promise<FollowResp> {
  const token = await requireToken()
  return http.post<FollowResp>('/user/follow', { target_uid: targetUid }, token)
}

export async function unfollowUser(targetUid: number): Promise<FollowResp> {
  const token = await requireToken()
  return http.post<FollowResp>('/user/unfollow', { target_uid: targetUid }, token)
}

export async function getFollowing(params?: {
  after?: string
  limit?: number
}): Promise<FollowListResp<FollowingItem>> {
  const token = await requireToken()
  const query = new URLSearchParams()
  if (params?.after) query.set('after', params.after)
  query.set('limit', String(params?.limit ?? 20))
  return http.get<FollowListResp<FollowingItem>>(`/user/following?${query.toString()}`, token)
}

export async function getFollowers(params?: {
  after?: string
  limit?: number
}): Promise<FollowListResp<FollowerItem>> {
  const token = await requireToken()
  const query = new URLSearchParams()
  if (params?.after) query.set('after', params.after)
  query.set('limit', String(params?.limit ?? 20))
  return http.get<FollowListResp<FollowerItem>>(`/user/followers?${query.toString()}`, token)
}

export function followErrorMessage(code: string): string | null {
  switch (code) {
    case 'cannot_follow_self':
      return '不能关注自己'
    case 'cannot_unfollow_self':
      return '不能取消关注自己'
    case 'not_found':
      return '用户不存在'
    case 'user_banned':
      return '该用户已被限制，无法关注'
    default:
      return null
  }
}
