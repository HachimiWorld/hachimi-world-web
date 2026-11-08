import { http } from './request'
import { useAuthStore } from '@/stores/auth'
import type { MomentItem } from './moment'

export interface FeedItem {
  time: string
  kind: string
  data: MomentItem | Record<string, unknown>
}

export interface SquareFeedResp {
  items: FeedItem[]
  next_cursor: string | null
}

async function optionalToken(): Promise<string | undefined> {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) return undefined
  return (await authStore.ensureValidToken()) ?? undefined
}

/** 广场：全站动态，最新优先 */
export async function getSquareFeed(params?: {
  cursor?: string
  limit?: number
}): Promise<SquareFeedResp> {
  const token = await optionalToken()
  const query = new URLSearchParams()
  if (params?.cursor) query.set('cursor', params.cursor)
  query.set('limit', String(params?.limit ?? 20))
  return http.get(`/feed/square?${query.toString()}`, token)
}

export function asMoment(item: FeedItem): MomentItem | null {
  if (item.kind !== 'moment') return null
  return item.data as MomentItem
}
