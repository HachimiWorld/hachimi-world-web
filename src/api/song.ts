import { http } from './request'
import { useAuthStore } from '@/stores/auth'

// ── 类型定义 ──

export interface UserProfile {
  uid: number
  username: string
  avatar_url: string | null
  bio?: string | null
  gender?: number | null
  is_banned?: boolean
}

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

export function getUserProfile(uid: number): Promise<UserProfile> {
  return http.get<UserProfile>(`/user/profile?uid=${uid}`)
}

export interface UserSongsPageResp {
  songs: Song[]
  total: number
  page: number
  size: number
}

export function getSongsByUser(params: {
  uid: number
  page?: number
  pageSize?: number
}): Promise<UserSongsPageResp> {
  const query = new URLSearchParams()
  query.set('user_id', String(params.uid))
  if (params.page !== undefined) query.set('page', String(params.page))
  if (params.pageSize !== undefined) query.set('size', String(params.pageSize))
  return http.get<UserSongsPageResp>(`/song/page_by_user?${query.toString()}`)
}

export function getSongDetailById(id: number): Promise<Song> {
  return http.get<Song>(`/song/detail_by_id?id=${id}`)
}

export async function likeSong(songId: number): Promise<void> {
  const token = await getToken()
  return http.post<void>('/song/like', { song_id: songId }, token)
}

export async function unlikeSong(songId: number): Promise<void> {
  const token = await getToken()
  return http.post<void>('/song/unlike', { song_id: songId }, token)
}

export async function updateUserProfile(params: {
  username: string
  bio?: string | null
  gender?: number | null
}): Promise<void> {
  const token = await getToken()
  return http.post<void>('/user/update_profile', params, token)
}

export async function setUserAvatar(file: File): Promise<void> {
  const authStore = useAuthStore()
  const token = await authStore.ensureValidToken()
  const form = new FormData()
  form.append('file', file)
  const { API_BASE_URL } = await import('./config')
  const res = await fetch(`${API_BASE_URL}/user/set_avatar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const json = await res.json()
  if (!json.ok) throw new (await import('./request')).ApiError(json.data.code, json.data.msg)
}

// ── 发布模块 ──

export interface UploadAudioResp {
  temp_id: string
  duration_secs: number
  title: string | null
  bitrate: string | null
  artist: string | null
}

export async function uploadAudioFile(file: File): Promise<UploadAudioResp> {
  const authStore = useAuthStore()
  const token = await authStore.ensureValidToken()
  const form = new FormData()
  form.append('file', file)
  const { API_BASE_URL } = await import('./config')
  const res = await fetch(`${API_BASE_URL}/song/upload_audio_file`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const json = await res.json()
  if (!json.ok) throw new (await import('./request')).ApiError(json.data.code, json.data.msg)
  return json.data as UploadAudioResp
}

export async function uploadCoverImage(file: File): Promise<{ temp_id: string }> {
  const authStore = useAuthStore()
  const token = await authStore.ensureValidToken()
  const form = new FormData()
  form.append('file', file)
  const { API_BASE_URL } = await import('./config')
  const res = await fetch(`${API_BASE_URL}/song/upload_cover_image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const json = await res.json()
  if (!json.ok) throw new (await import('./request')).ApiError(json.data.code, json.data.msg)
  return json.data as { temp_id: string }
}

export interface PublishSongReq {
  song_temp_id: string
  cover_temp_id: string
  title: string
  subtitle: string
  description: string
  lyrics: string
  tag_ids: number[]
  creation_info: {
    creation_type: number
    origin_info: null | { title: string | null; artist: string | null; url: string | null; origin_type: number; song_display_id: string | null }
    derivative_info: null
  }
  production_crew: { role: string; uid: number | null; name: string | null }[]
  external_links: { platform: string; url: string }[]
  explicit: boolean
  jmid: string | null
  comment: string | null
}

export async function publishSong(req: PublishSongReq): Promise<{ review_id: number; song_display_id: string }> {
  const token = await getToken()
  return http.post('/song/publish', req, token)
}

export interface ReviewBrief {
  review_id: number
  display_id: string
  title: string
  subtitle: string
  artist: string
  cover_url: string
  submit_time: string
  review_time: string | null
  review_comment: string | null
  status: number  // 0=pending 1=approved 2=rejected
  type: number    // 0=create 1=modify
}

export interface ReviewPageResp {
  data: ReviewBrief[]
  page_index: number
  page_size: number
  total: number
}

export async function getMyReviews(pageIndex = 0, pageSize = 20): Promise<ReviewPageResp> {
  const token = await getToken()
  return http.get<ReviewPageResp>(`/song/review/page_contributor?page_index=${pageIndex}&page_size=${pageSize}`, token)
}

export async function searchTags(query: string): Promise<{ result: { id: number; name: string; description: string | null }[] }> {
  const token = await getToken()
  return http.get(`/song/tag/search?query=${encodeURIComponent(query)}`, token)
}

export async function getNextJmid(): Promise<{ jmid: string }> {
  const token = await getToken()
  return http.get('/song/jmid/get_next', token)
}

export async function getMyJmidPrefix(): Promise<{ jmid_prefix: string | null }> {
  const token = await getToken()
  return http.get('/song/jmid/mine', token)
}

export async function createTag(name: string, description?: string): Promise<{ id: number }> {
  const token = await getToken()
  return http.post<{ id: number }>('/song/tag/create', { name, description: description ?? null }, token)
}

export async function checkJmidPrefix(jmidPrefix: string): Promise<{ result: boolean }> {
  const token = await getToken()
  return http.get<{ result: boolean }>(`/song/jmid/check_prefix?jmid_prefix=${encodeURIComponent(jmidPrefix)}`, token)
}

export async function checkJmid(jmidFull: string): Promise<{ result: boolean }> {
  const token = await getToken()
  return http.get<{ result: boolean }>(`/song/jmid/check?jmid=${encodeURIComponent(jmidFull)}`, token)
}

