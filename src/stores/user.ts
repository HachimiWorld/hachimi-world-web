import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface UserInfo {
  uid: number
  username: string
  avatar_url: string | null
}

export const useUserStore = defineStore('user', () => {
  const isLoggedIn = ref<boolean>(false)
  const userInfo = ref<UserInfo | null>(null)

  function login(info: UserInfo) {
    isLoggedIn.value = true
    userInfo.value = info
  }

  function logout() {
    isLoggedIn.value = false
    userInfo.value = null
  }

  return { isLoggedIn, userInfo, login, logout }
})

