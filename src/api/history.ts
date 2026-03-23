import { http } from './request'
import { useAuthStore } from '@/stores/auth'

export interface PublicSongDetail {
  id: number
  display_id: string
  title: string
  subtitle: string
  cover_url: string
  uploader_uid: number
  uploader_name: string
  duration_seconds: number
  audio_url: string | null
  play_count: number
  like_count: number
  explicit: boolean | null
}

export interface PlayHistoryItem {
  id: number
  song_info: PublicSongDetail
  play_time: string
}

export interface PlayHistoryCursorResp {
  list: PlayHistoryItem[]
}

async function getToken(): Promise<string | undefined> {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) return undefined
  const token = await authStore.ensureValidToken()
  return token ?? undefined
}

export async function touchPlayHistory(songId: number): Promise<void> {
  const authStore = useAuthStore()
  if (authStore.isLoggedIn) {
    const token = await getToken()
    return http.post<void>('/play_history/touch', { song_id: songId }, token)
  } else {
    return http.post<void>('/play_history/touch_anonymous', { song_id: songId })
  }
}

export async function getPlayHistoryCursor(params?: {
  cursor?: string
  size?: number
}): Promise<PlayHistoryCursorResp> {
  const token = await getToken()
  const query = new URLSearchParams()
  if (params?.cursor) query.set('cursor', params.cursor)
  query.set('size', String(params?.size ?? 30))
  return http.get<PlayHistoryCursorResp>(`/play_history/cursor?${query.toString()}`, token)
}

export async function deletePlayHistoryItem(historyId: number): Promise<void> {
  const token = await getToken()
  return http.post<void>('/play_history/delete', { history_id: historyId }, token)
}
