import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY_DARK = 'hachimi_dark_mode'
const STORAGE_KEY_COLOR = 'hachimi_theme_color'
const DEFAULT_COLOR = '#ff9800'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref<boolean>(localStorage.getItem(STORAGE_KEY_DARK) === 'true')
  const themeColor = ref<string>(localStorage.getItem(STORAGE_KEY_COLOR) ?? DEFAULT_COLOR)

  function applyTheme() {
    const root = document.documentElement
    if (isDark.value) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    root.style.setProperty('--theme-color', themeColor.value)
    root.style.setProperty('--theme-color-light', themeColor.value + '26')
  }

  watch(isDark, (val) => {
    localStorage.setItem(STORAGE_KEY_DARK, String(val))
    applyTheme()
  })

  watch(themeColor, (val) => {
    localStorage.setItem(STORAGE_KEY_COLOR, val)
    applyTheme()
  })

  // 初始化时立即应用
  applyTheme()

  return { isDark, themeColor, applyTheme }
})

