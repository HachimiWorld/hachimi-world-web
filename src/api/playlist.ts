import { http } from './request'
import { useAuthStore } from '@/stores/auth'

export interface PlaylistItem {
  id: number
  name: string
  cover_url: string | null
  description: string | null
  create_time: string
  update_time: string
  is_public: boolean
  songs_count: number
}

export interface PlaylistSongItem {
  song_id: number
  song_display_id: string
  title: string
  subtitle: string
  cover_url: string
  uploader_name: string
  uploader_uid: number
  duration_seconds: number
  order_index: number
  add_time: string
}

export interface PlaylistDetailResp {
  playlist_info: PlaylistItem
  songs: PlaylistSongItem[]
  creator_profile: {
    uid: number
    username: string
    avatar_url: string | null
  }
}

export interface PlaylistListResp {
  playlists: PlaylistItem[]
}

export interface PlaylistContainingResp {
  playlist_ids: number[]
}

export interface CreatePlaylistResp {
  id: number
}

export interface CheckFavoriteResp {
  playlist_id: number
  is_favorite: boolean
  add_time: string | null
}

async function getToken(): Promise<string | undefined> {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) return undefined
  const token = await authStore.ensureValidToken()
  return token ?? undefined
}

export interface PlaylistMetadata {
  id: number
  name: string
  cover_url: string | null
  description: string | null
  songs_count: number
  user_id: number
  user_name: string
  is_public: boolean
  create_time: string
  update_time: string
}

export interface FavoritePlaylistItem {
  metadata: PlaylistMetadata
  order_index: number
  add_time: string
}

export interface PageFavoritesResp {
  data: FavoritePlaylistItem[]
  page_index: number
  page_size: number
  total: number
}

export async function getMyPlaylists(): Promise<PlaylistListResp> {
  const token = await getToken()
  return http.get<PlaylistListResp>('/playlist/list', token)
}

export async function getPlaylistDetail(playlistId: number): Promise<PlaylistDetailResp> {
  const token = await getToken()
  return http.get<PlaylistDetailResp>(`/playlist/detail?id=${playlistId}`, token)
}

export async function getPlaylistDetailPrivate(playlistId: number): Promise<PlaylistDetailResp> {
  const token = await getToken()
  return http.get<PlaylistDetailResp>(`/playlist/detail_private?id=${playlistId}`, token)
}

export async function getPlaylistsContainingSong(songId: number): Promise<PlaylistContainingResp> {
  const token = await getToken()
  return http.get<PlaylistContainingResp>(`/playlist/list_containing?song_id=${songId}`, token)
}

export async function createPlaylist(params: {
  name: string
  description?: string | null
  is_public?: boolean
}): Promise<CreatePlaylistResp> {
  const token = await getToken()
  return http.post<CreatePlaylistResp>(
    '/playlist/create',
    { name: params.name, description: params.description ?? null, is_public: params.is_public ?? false },
    token,
  )
}

export async function updatePlaylist(params: {
  id: number
  name: string
  description?: string | null
  is_public: boolean
}): Promise<void> {
  const token = await getToken()
  return http.post<void>(
    '/playlist/update',
    { id: params.id, name: params.name, description: params.description ?? null, is_public: params.is_public },
    token,
  )
}

export async function deletePlaylist(id: number): Promise<void> {
  const token = await getToken()
  return http.post<void>('/playlist/delete', { id }, token)
}

export async function addSongToPlaylist(playlistId: number, songId: number): Promise<void> {
  const token = await getToken()
  return http.post<void>('/playlist/add_song', { playlist_id: playlistId, song_id: songId }, token)
}

export async function removeSongFromPlaylist(playlistId: number, songId: number): Promise<void> {
  const token = await getToken()
  return http.post<void>('/playlist/remove_song', { playlist_id: playlistId, song_id: songId }, token)
}

export async function checkFavoritePlaylist(playlistId: number): Promise<CheckFavoriteResp> {
  const token = await getToken()
  return http.get<CheckFavoriteResp>(`/playlist/favorite/check?playlist_id=${playlistId}`, token)
}

export async function addFavoritePlaylist(playlistId: number): Promise<void> {
  const token = await getToken()
  return http.post<void>('/playlist/favorite/add', { playlist_id: playlistId }, token)
}

export async function removeFavoritePlaylist(playlistId: number): Promise<void> {
  const token = await getToken()
  return http.post<void>('/playlist/favorite/remove', { playlist_id: playlistId }, token)
}

export async function setPlaylistCover(playlistId: number, file: File): Promise<void> {
  const authStore = useAuthStore()
  const token = await authStore.ensureValidToken()
  const form = new FormData()
  form.append('json', JSON.stringify({ playlist_id: playlistId }))
  form.append('file', file)
  const res = await fetch(`${(await import('./config')).API_BASE_URL}/playlist/set_cover`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const json = await res.json()
  if (!json.ok) throw new (await import('./request')).ApiError(json.data.code, json.data.msg)
}

export async function pageFavoritePlaylists(pageIndex: number, pageSize: number): Promise<PageFavoritesResp> {
  const token = await getToken()
  return http.get<PageFavoritesResp>(`/playlist/favorite/page?page_index=${pageIndex}&page_size=${pageSize}`, token)
}
