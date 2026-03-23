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

async function getToken(): Promise<string | undefined> {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) return undefined
  const token = await authStore.ensureValidToken()
  return token ?? undefined
}

export async function getMyPlaylists(): Promise<PlaylistListResp> {
  const token = await getToken()
  return http.get<PlaylistListResp>('/playlist/list', token)
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
    {
      name: params.name,
      description: params.description ?? null,
      is_public: params.is_public ?? false,
    },
    token,
  )
}

export async function addSongToPlaylist(playlistId: number, songId: number): Promise<void> {
  const token = await getToken()
  return http.post<void>(
    '/playlist/add_song',
    {
      playlist_id: playlistId,
      song_id: songId,
    },
    token,
  )
}
