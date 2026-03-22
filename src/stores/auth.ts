import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { refreshToken as apiRefreshToken } from '@/api/auth'
import { useUserStore } from './user'

// localStorage key 常量
const KEY_ACCESS_TOKEN = 'hachimi_access_token'
const KEY_REFRESH_TOKEN = 'hachimi_refresh_token'
const KEY_TOKEN_EXPIRES = 'hachimi_token_expires'
const KEY_DEVICE_NAME = 'hachimi_device_name'
const KEY_UID = 'hachimi_uid'
const KEY_USERNAME = 'hachimi_username'
const KEY_AVATAR_URL = 'hachimi_avatar_url'

/** 生成设备名：浏览器 + 系统信息 */
function generateDeviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'macOS'
  if (/Win/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Web Browser'
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem(KEY_ACCESS_TOKEN))
  const refreshTokenVal = ref<string | null>(localStorage.getItem(KEY_REFRESH_TOKEN))
  const tokenExpires = ref<string | null>(localStorage.getItem(KEY_TOKEN_EXPIRES))

  // deviceName 与令牌绑定，一旦生成就持久化，不随登出改变
  const deviceName = ref<string>(
    localStorage.getItem(KEY_DEVICE_NAME) ?? generateDeviceName(),
  )
  // 确保 deviceName 被持久化
  if (!localStorage.getItem(KEY_DEVICE_NAME)) {
    localStorage.setItem(KEY_DEVICE_NAME, deviceName.value)
  }

  const isLoggedIn = computed(() => !!accessToken.value && !!refreshTokenVal.value)

  /** 登录后保存所有令牌和用户信息 */
  function saveSession(
    params: {
      uid: number
      username: string
      avatar_url: string | null
      access_token: string
      refresh_token: string
      expires_in: string
    },
  ) {
    accessToken.value = params.access_token
    refreshTokenVal.value = params.refresh_token
    tokenExpires.value = params.expires_in

    localStorage.setItem(KEY_ACCESS_TOKEN, params.access_token)
    localStorage.setItem(KEY_REFRESH_TOKEN, params.refresh_token)
    localStorage.setItem(KEY_TOKEN_EXPIRES, params.expires_in)
    localStorage.setItem(KEY_UID, String(params.uid))
    localStorage.setItem(KEY_USERNAME, params.username)
    if (params.avatar_url) {
      localStorage.setItem(KEY_AVATAR_URL, params.avatar_url)
    } else {
      localStorage.removeItem(KEY_AVATAR_URL)
    }

    // 同步 userStore
    const userStore = useUserStore()
    userStore.login({
      uid: params.uid,
      username: params.username,
      avatar_url: params.avatar_url,
    })
  }

  /** 登出，清除令牌（deviceName 保留，与设备绑定） */
  function clearSession() {
    accessToken.value = null
    refreshTokenVal.value = null
    tokenExpires.value = null

    localStorage.removeItem(KEY_ACCESS_TOKEN)
    localStorage.removeItem(KEY_REFRESH_TOKEN)
    localStorage.removeItem(KEY_TOKEN_EXPIRES)
    localStorage.removeItem(KEY_UID)
    localStorage.removeItem(KEY_USERNAME)
    localStorage.removeItem(KEY_AVATAR_URL)

    const userStore = useUserStore()
    userStore.logout()
  }

  /** 检查 access token 是否过期并尝试刷新 */
  async function ensureValidToken(): Promise<string | null> {
    if (!accessToken.value || !refreshTokenVal.value) return null

    // 提前 30s 刷新
    const expires = tokenExpires.value ? new Date(tokenExpires.value).getTime() : 0
    if (Date.now() < expires - 30_000) {
      return accessToken.value
    }

    try {
      const newTokens = await apiRefreshToken(refreshTokenVal.value, deviceName.value)
      accessToken.value = newTokens.access_token
      refreshTokenVal.value = newTokens.refresh_token
      tokenExpires.value = newTokens.expires_in
      localStorage.setItem(KEY_ACCESS_TOKEN, newTokens.access_token)
      localStorage.setItem(KEY_REFRESH_TOKEN, newTokens.refresh_token)
      localStorage.setItem(KEY_TOKEN_EXPIRES, newTokens.expires_in)
      return newTokens.access_token
    } catch {
      clearSession()
      return null
    }
  }

  /** 应用启动时从 localStorage 恢复用户信息到 userStore */
  function restoreSession() {
    const uid = localStorage.getItem(KEY_UID)
    const username = localStorage.getItem(KEY_USERNAME)
    if (uid && username && accessToken.value) {
      const userStore = useUserStore()
      userStore.login({
        uid: Number(uid),
        username,
        avatar_url: localStorage.getItem(KEY_AVATAR_URL),
      })
    }
  }

  return {
    accessToken,
    refreshTokenVal,
    deviceName,
    isLoggedIn,
    saveSession,
    clearSession,
    ensureValidToken,
    restoreSession,
  }
})

