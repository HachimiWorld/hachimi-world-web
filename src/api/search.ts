import { http } from './request'

export interface SearchResultMeta {
  query: string
  processing_time_ms: number
  total_hits: number | null
  limit: number
  offset: number
}

export interface MusicSearchItem {
  id: number
  display_id: string
  title: string
  subtitle: string
  description: string
  artist: string
  duration_seconds: number
  play_count: number
  like_count: number
  cover_art_url: string
  audio_url: string
  uploader_uid: number
  uploader_name: string
  explicit: boolean | null
  original_artists: string[]
  original_titles: string[]
}

export interface MusicSearchResp extends SearchResultMeta {
  hits: MusicSearchItem[]
}

export interface UserSearchItem {
  uid: number
  username: string
  avatar_url: string | null
  bio: string | null
  gender: number | null
  is_banned: boolean
}

export interface UserSearchResp extends SearchResultMeta {
  hits: UserSearchItem[]
}

export interface PlaylistSearchItem {
  id: number
  user_id: number
  user_name: string
  user_avatar_url: string | null
  name: string
  description: string | null
  cover_url: string | null
  songs_count: number
  create_time: string
  update_time: string
}

export interface PlaylistSearchResp extends SearchResultMeta {
  hits: PlaylistSearchItem[]
}

export type MusicSortBy = 'relevance' | 'release_time_desc' | 'release_time_asc' | 'play_count_desc' | 'play_count_asc'
export type PlaylistSortBy = 'relevance' | 'create_time_desc' | 'create_time_asc' | 'update_time_desc' | 'update_time_asc'

export function searchMusic(params: {
  q: string
  limit?: number
  offset?: number
  sortBy?: MusicSortBy
  filter?: string
}): Promise<MusicSearchResp> {
  const query = new URLSearchParams()
  query.set('q', params.q)
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset !== undefined) query.set('offset', String(params.offset))
  if (params.sortBy && params.sortBy !== 'relevance') query.set('sort_by', params.sortBy)
  if (params.filter) query.set('filter', params.filter)
  return http.get<MusicSearchResp>(`/song/search?${query.toString()}`)
}

export function searchUsers(params: {
  q: string
  page?: number
  size?: number
}): Promise<UserSearchResp> {
  const query = new URLSearchParams()
  query.set('q', params.q)
  query.set('page', String(params.page ?? 0))
  query.set('size', String(params.size ?? 12))
  return http.get<UserSearchResp>(`/user/search?${query.toString()}`)
}

export function searchPlaylists(params: {
  q: string
  limit?: number
  offset?: number
  sortBy?: PlaylistSortBy
  userId?: number
}): Promise<PlaylistSearchResp> {
  const query = new URLSearchParams()
  query.set('q', params.q)
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset !== undefined) query.set('offset', String(params.offset))
  if (params.sortBy && params.sortBy !== 'relevance') query.set('sort_by', params.sortBy)
  if (params.userId !== undefined) query.set('user_id', String(params.userId))
  return http.get<PlaylistSearchResp>(`/playlist/search?${query.toString()}`)
}

