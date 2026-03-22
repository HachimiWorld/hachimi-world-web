import { API_BASE_URL } from './config'

export interface ApiResponse<T> {
  ok: boolean
  data: T | { code: string; msg: string }
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public msg: string,
  ) {
    super(msg)
    this.name = 'ApiError'
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const json: ApiResponse<T> = await res.json()

  if (!json.ok) {
    const err = json.data as { code: string; msg: string }
    throw new ApiError(err.code, err.msg)
  }

  return json.data as T
}

export const http = {
  get: <T>(path: string, token?: string) => request<T>('GET', path, undefined, token),
  post: <T>(path: string, body?: unknown, token?: string) => request<T>('POST', path, body, token),
}

