import { http } from './request'
import { useAuthStore } from '@/stores/auth'

// ── 类型定义 ──

export interface SongTag {
  id: number
  name: string
  description: string | null
}

export interface SongProductionCrew {
  id: number
  song_id: number
  role: string
  uid: number | null
  person_name: string | null
}

export interface SongOriginInfo {
  song_display_id: string | null
  title: string | null
  artist: string | null
  url: string | null
  origin_type: number
}

export interface SongExternalLink {
  platform: string
  url: string
}

export interface Song {
  id: number
  display_id: string
  title: string
  subtitle: string
  description: string
  tags: SongTag[]
  duration_seconds: number
  lyrics: string
  audio_url: string
  cover_url: string
  production_crew: SongProductionCrew[]
  creation_type: number
  origin_infos: SongOriginInfo[]
  uploader_uid: number
  uploader_name: string
  play_count: number
  like_count: number
  external_links: SongExternalLink[]
  create_time: string
  release_time: string
  gain: number | null
  explicit: boolean | null
}

export interface TagRecommendItem {
  id: number
  name: string
  description: string | null
  score: number
}

// ── 工具函数：获取当前 access token ──
async function getToken(): Promise<string | undefined> {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) return undefined
  const token = await authStore.ensureValidToken()
  return token ?? undefined
}

// ── 最新歌曲（游标分页） ──
export interface RecentSongsResp {
  songs: Song[]
}

export async function getRecentSongs(params?: {
  cursor?: string
  limit?: number
  after?: boolean
}): Promise<RecentSongsResp> {
  const query = new URLSearchParams()
  if (params?.cursor) query.set('cursor', params.cursor)
  if (params?.limit !== undefined) query.set('limit', String(params.limit))
  if (params?.after !== undefined) query.set('after', String(params.after))
  const qs = query.toString()
  return http.get<RecentSongsResp>(`/song/recent_v2${qs ? '?' + qs : ''}`)
}

// ── 本周热门 ──
export interface HotSongsResp {
  songs: Song[]
}

export function getHotWeeklySongs(): Promise<HotSongsResp> {
  return http.get<HotSongsResp>('/song/hot/weekly')
}

// ── 推荐歌曲（登录/匿名自动切换） ──
export interface RecommendSongsResp {
  songs: Song[]
}

export async function getRecommendSongs(): Promise<RecommendSongsResp> {
  const token = await getToken()
  if (token) {
    return http.get<RecommendSongsResp>('/song/recommend', token)
  } else {
    return http.get<RecommendSongsResp>('/song/recommend_anonymous')
  }
}

// ── 推荐标签（登录/匿名自动切换） ──
export interface TagRecommendResp {
  result: TagRecommendItem[]
}

export async function getRecommendTags(): Promise<TagRecommendResp> {
  const token = await getToken()
  if (token) {
    return http.get<TagRecommendResp>('/song/tag/recommend', token)
  } else {
    return http.get<TagRecommendResp>('/song/tag/recommend_anonymous')
  }
}

// ── 按标签搜索歌曲（MeiliSearch filter 语法）──
// 后端 search 接口支持 filter=tags = "标签名"
export interface SearchSongsResp {
  hits: SearchSongItem[]
  query: string
  processing_time_ms: number
  total_hits: number | null
  limit: number
  offset: number
}

export interface SearchSongItem {
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

export function getSongsByTag(params: {
  tagName: string
  limit?: number
  offset?: number
}): Promise<SearchSongsResp> {
  const query = new URLSearchParams()
  // 搜索全部（空 q，用 filter 筛选）
  query.set('q', '')
  query.set('filter', `tags = "${params.tagName}"`)
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset !== undefined) query.set('offset', String(params.offset))
  return http.get<SearchSongsResp>(`/song/search?${query.toString()}`)
}

