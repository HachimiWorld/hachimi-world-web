<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { ElMessageBox, ElMessage } from 'element-plus'
import { Moon, Sunny } from '@element-plus/icons-vue'
import LoginDialog from '@/components/LoginDialog.vue'
import { http } from '@/api/request'

const themeStore = useThemeStore()
const authStore = useAuthStore()
const userStore = useUserStore()

// 登录弹窗
const showLogin = ref(false)

const presetColors = [
  '#ff9800', '#f44336', '#e91e63', '#9c27b0',
  '#3f51b5', '#2196f3', '#00bcd4', '#4caf50',
  '#8bc34a', '#ffeb3b', '#ff5722', '#795548',
]

// ── 深色模式 ──
const isDark = computed({
  get: () => themeStore.isDark,
  set: (v) => { themeStore.isDark = v },
})

// ── 主题色 ──
const DEFAULT_COLOR = '#ff9800'
const useCustomColor = ref(themeStore.themeColor !== DEFAULT_COLOR)
const customColor = ref(themeStore.themeColor !== DEFAULT_COLOR ? themeStore.themeColor : DEFAULT_COLOR)

function onColorModeChange(val: boolean) {
  if (!val) {
    themeStore.themeColor = DEFAULT_COLOR
  } else {
    themeStore.themeColor = customColor.value
  }
}

function onColorPick(val: string) {
  customColor.value = val
  themeStore.themeColor = val
}

function resetColor() {
  useCustomColor.value = false
  customColor.value = DEFAULT_COLOR
  themeStore.themeColor = DEFAULT_COLOR
  ElMessage.success('已恢复默认主题色')
}

// ── 退出登录 ──
async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出登录', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
      customClass: 'logout-confirm-box',
    })
    authStore.clearSession()
    ElMessage.success('已退出登录')
  } catch {
    // 用户取消
  }
}

// 设备名
const deviceName = computed(() => authStore.deviceName)

// ── 服务器版本 ──
interface ServerVersion {
  version: number
  min_version: number
}
const serverVersion = ref<ServerVersion | null>(null)

// 将版本号 260121 格式化为 "26.01.21"
function formatVersion(v: number): string {
  const s = String(v)
  // 格式：YYMMDD，6位
  if (s.length === 6) {
    return `${s.slice(0, 2)}.${s.slice(2, 4)}.${s.slice(4, 6)}`
  }
  return s
}

onMounted(async () => {
  try {
    serverVersion.value = await http.get<ServerVersion>('/version/server')
  } catch {
    // 获取失败不影响页面
  }
})
</script>

<template>
  <div class="settings-view">
    <div class="settings-container">

      <!-- 页面标题 -->
      <div class="settings-hero">
        <h1 class="settings-heading">设置</h1>
        <p class="settings-sub">个性化的基米天堂体验</p>
      </div>

      <!-- 外观 -->
      <div class="settings-group">
        <div class="group-label">
          <el-icon class="group-icon"><Brush /></el-icon>
          外观
        </div>

        <!-- 深色模式 -->
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-name">深色模式</span>
            <span class="setting-desc">切换为深色界面，保护夜间视力</span>
          </div>
          <el-switch
            v-model="isDark"
            :active-icon="Moon"
            :inactive-icon="Sunny"
            size="large"
            class="dark-switch"
            style="--el-switch-on-color: var(--theme-color); --el-switch-off-color: var(--hw-border); --el-switch-on-text-color: var(--theme-color); --el-switch-off-text-color: var(--theme-color)"
          />
        </div>

        <div class="row-divider" />

        <!-- 主题色 -->
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-name">主题色</span>
            <span class="setting-desc">自定义界面的强调色彩</span>
          </div>
          <div class="color-controls">
            <el-switch
              v-model="useCustomColor"
              active-text="自定义"
              inactive-text="默认"
              size="default"
              class="color-switch"
              style="--el-switch-on-color: var(--theme-color); --el-switch-off-color: var(--hw-border)"
              @change="onColorModeChange"
            />
          </div>
        </div>

        <!-- 调色板（展开区域） -->
        <transition name="slide-fade">
          <div v-if="useCustomColor" class="color-picker-panel">
            <div class="color-picker-inner">
              <div class="picker-preview">
                <div
                  class="color-swatch"
                  :style="{ background: customColor }"
                />
                <span class="color-hex">{{ customColor.toUpperCase() }}</span>
              </div>
              <el-color-picker
                v-model="customColor"
                show-alpha
                size="large"
                @change="onColorPick"
              />
              <el-button
                size="small"
                class="reset-btn"
                @click="resetColor"
              >
                <el-icon><RefreshLeft /></el-icon>
                恢复默认
              </el-button>
            </div>
            <!-- 预设色板 -->
            <div class="preset-colors">
              <span class="preset-label">快速选择</span>
              <div class="preset-swatches">
                <button
                  v-for="c in presetColors"
                  :key="c"
                  class="preset-dot"
                  :class="{ active: customColor === c }"
                  :style="{ background: c }"
                  :title="c"
                  @click="onColorPick(c)"
                />
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- 账号 -->
      <div class="settings-group">
        <div class="group-label">
          <el-icon class="group-icon"><User /></el-icon>
          账号
        </div>

        <!-- 已登录状态 -->
        <template v-if="authStore.isLoggedIn">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-name">当前用户</span>
              <span class="setting-desc">{{ userStore.userInfo?.username ?? '—' }}</span>
            </div>
            <div class="user-badge">
              <el-icon><UserFilled /></el-icon>
            </div>
          </div>

          <div class="row-divider" />

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-name">登录设备</span>
              <span class="setting-desc">{{ deviceName }}</span>
            </div>
            <div class="device-tag">
              <el-icon><Monitor /></el-icon>
            </div>
          </div>

          <div class="row-divider" />

          <div class="setting-row logout-row">
            <div class="setting-info">
              <span class="setting-name">退出登录</span>
              <span class="setting-desc">退出后需重新登录才能使用完整功能</span>
            </div>
            <el-button
              type="danger"
              plain
              size="default"
              class="logout-btn"
              @click="handleLogout"
            >
              <el-icon><SwitchButton /></el-icon>
              退出
            </el-button>
          </div>
        </template>

        <!-- 未登录状态 -->
        <template v-else>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-name">未登录</span>
              <span class="setting-desc">登录后可同步收藏、历史记录等数据</span>
            </div>
            <el-button
              type="primary"
              size="default"
              class="login-btn"
              @click="showLogin = true"
            >
              去登录
            </el-button>
          </div>
        </template>
      </div>

      <!-- 关于 -->
      <div class="settings-group">
        <div class="group-label">
          <el-icon class="group-icon"><InfoFilled /></el-icon>
          关于
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-name">基米天堂</span>
            <span class="setting-desc">一个由社区为爱发电驱动的开源音乐平台</span>
          </div>
          <span class="version-tag">
            <template v-if="serverVersion">
              v{{ formatVersion(serverVersion.version) }}
            </template>
            <template v-else>—</template>
          </span>
        </div>

        <div class="row-divider" />

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-name">反馈与建议</span>
            <span class="setting-desc">在 GitHub Discussions 提交问题或建议</span>
          </div>
          <a
            href="https://github.com/HachimiWorld/hachimi-world-client/discussions"
            target="_blank"
            rel="noopener noreferrer"
            class="github-link"
          >GitHub</a>
        </div>
      </div>

    </div>
  </div>

  <!-- 登录弹窗 -->
  <LoginDialog v-model="showLogin" />
</template>


<style scoped>
.settings-view {
  min-height: calc(100vh - var(--hw-header-height));
  padding: 0 16px;
  background: var(--hw-bg-primary);
}

.settings-container {
  max-width: 680px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 页面标题区 */
.settings-hero {
  padding: 8px 0 4px;
}

.settings-heading {
  font-size: 28px;
  font-weight: 800;
  color: var(--hw-text-primary);
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.settings-sub {
  margin-top: 6px;
  font-size: 14px;
  color: var(--hw-text-tertiary);
}

/* 设置分组 */
.settings-group {
  background: var(--hw-bg-secondary);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--hw-border);
}

.group-label {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 14px 20px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--hw-text-tertiary);
  border-bottom: 1px solid var(--hw-border);
}

.group-icon {
  font-size: 14px;
  color: var(--theme-color);
}

/* 单行设置项 */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
}

.row-divider {
  height: 1px;
  background: var(--hw-border);
  margin: 0 20px;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.setting-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--hw-text-primary);
  line-height: 1.3;
}

.setting-desc {
  font-size: 12px;
  color: var(--hw-text-tertiary);
  line-height: 1.4;
}

/* 主题色控件区 */
.color-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* 调色板展开面板 */
.color-picker-panel {
  padding: 0 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.color-picker-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--hw-bg-primary);
  border: 1px solid var(--hw-border);
  border-radius: 10px;
  padding: 14px 18px;
}

.picker-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--hw-border);
  flex-shrink: 0;
  transition: background 0.2s;
}

.color-hex {
  font-size: 13px;
  font-weight: 600;
  color: var(--hw-text-secondary);
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: 0.5px;
}

.reset-btn {
  flex-shrink: 0;
  border-color: var(--hw-border) !important;
  color: var(--hw-text-secondary) !important;
  background: transparent !important;
}

.reset-btn:hover {
  border-color: var(--theme-color) !important;
  color: var(--theme-color) !important;
}

/* 预设色板 */
.preset-colors {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preset-label {
  font-size: 12px;
  color: var(--hw-text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}

.preset-swatches {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.preset-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
  padding: 0;
  outline: none;
}

.preset-dot:hover {
  transform: scale(1.2);
}

.preset-dot.active {
  border-color: var(--hw-text-primary);
  transform: scale(1.15);
}

/* 账号相关 */
.user-badge,
.device-tag {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--theme-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-color);
  font-size: 16px;
  flex-shrink: 0;
}

.logout-btn {
  flex-shrink: 0;
}

/* 登录按钮跟随主题色 */
.login-btn {
  --el-button-bg-color: var(--theme-color) !important;
  --el-button-border-color: var(--theme-color) !important;
  --el-button-hover-bg-color: var(--theme-color) !important;
  --el-button-hover-border-color: var(--theme-color) !important;
  flex-shrink: 0;
}

/* switch 图标颜色：覆盖 label 里的 icon */
.dark-switch :deep(.el-switch__label .el-icon) {
  color: var(--theme-color) !important;
}

.dark-switch :deep(.el-switch__label .el-icon svg) {
  color: var(--theme-color) !important;
  fill: currentColor !important;
}

/* Element Plus 会给非激活 label 加 display:none，激活 label 加 is-active
   不管激活与否，只要是 dark-switch 的 label icon 都走主题色 */
.dark-switch :deep(.el-switch__label--left),
.dark-switch :deep(.el-switch__label--right) {
  color: var(--theme-color) !important;
}

/* switch 标签文字颜色 */
.color-switch :deep(.el-switch__label) {
  color: var(--hw-text-tertiary);
}

.color-switch :deep(.el-switch__label.is-active) {
  color: var(--theme-color);
}

.version-tag {
  font-size: 12px;
  font-weight: 600;
  color: var(--hw-text-tertiary);
  background: var(--hw-bg-hover);
  padding: 3px 10px;
  border-radius: 20px;
  letter-spacing: 0.3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.github-link {
  font-size: 13px;
  font-weight: 700;
  color: var(--theme-color);
  text-decoration: none;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.github-link:hover {
  opacity: 0.75;
}

/* color-picker 触发器边框透明 */
:deep(.el-color-picker__trigger) {
  border-color: transparent !important;
  padding: 0;
}
:deep(.el-color-picker__color) {
  border-color: transparent !important;
}

/* 动画 */
.slide-fade-enter-active {
  transition: all 0.22s ease;
}
.slide-fade-leave-active {
  transition: all 0.18s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* 手机端 */
@media (max-width: 520px) {
  .settings-view {
    padding: 0 12px;
  }

  .settings-heading {
    font-size: 24px;
  }

  .setting-row {
    padding: 14px 16px;
  }

  .row-divider {
    margin: 0 16px;
  }

  .group-label {
    padding: 12px 16px 10px;
  }

  .color-picker-inner {
    flex-wrap: wrap;
    gap: 12px;
  }

  .color-picker-panel {
    padding: 0 16px 16px;
  }
}
</style>
