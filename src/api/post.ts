import { http } from './request'
import type { UserProfile } from './song'

export interface PostItem {
  id: number
  author: UserProfile
  title: string
  content: string
  content_type: string
  cover_url: string | null
  create_time: string
  update_time: string
}

export interface PostPageResp {
  posts: PostItem[]
}

export async function getPostPage(params?: {
  pageIndex?: number
  pageSize?: number
}): Promise<PostPageResp> {
  const query = new URLSearchParams()
  query.set('page_index', String(params?.pageIndex ?? 0))
  query.set('page_size', String(params?.pageSize ?? 20))
  return http.get(`/post/page?${query.toString()}`)
}

export async function getPostDetail(postId: number): Promise<PostItem> {
  return http.get(`/post/detail?post_id=${postId}`)
}
