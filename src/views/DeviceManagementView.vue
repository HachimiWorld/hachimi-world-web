<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { mdiArrowLeft, mdiClose, mdiDevices, mdiLaptop } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import { ApiError } from '@/api/request'
import {
  emailChangeErrorMessage,
  getRefreshTokenJti,
  listDevices,
  logoutDevice,
  type DeviceItem,
} from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime, formatRelativeTime } from '@/utils/relativeTime'

const router = useRouter()
const authStore = useAuthStore()

const devices = ref<DeviceItem[]>([])
const loading = ref(false)
const errorText = ref('')
const logoutBusyId = ref<number | null>(null)
const loginDialogOpen = ref(false)

const currentJti = computed(() => getRefreshTokenJti(authStore.refreshTokenVal))
const currentDevice = computed(() =>
  devices.value.find((d) => d.token_id === currentJti.value) ?? null,
)
const otherDevices = computed(() => {
  const cur = currentDevice.value
  return cur ? devices.value.filter((d) => d.id !== cur.id) : devices.value
})

function apiMessage(e: unknown, fallback: string) {
  if (e instanceof ApiError) return emailChangeErrorMessage(e.code) || e.msg || fallback
  return fallback
}

async function load() {
  if (!authStore.isLoggedIn) {
    loginDialogOpen.value = true
    return
  }
  loading.value = true
  errorText.value = ''
  try {
    const token = await authStore.ensureValidToken()
    if (!token) throw new Error('not_logged_in')
    const resp = await listDevices(token)
    devices.value = resp.devices
  } catch (e) {
    errorText.value = apiMessage(e, '加载设备列表失败')
    devices.value = []
  } finally {
    loading.value = false
  }
}

async function kick(device: DeviceItem) {
  const name = device.device_info || '未知设备'
  try {
    await ElMessageBox.confirm(`确定要从 ${name} 退出登录吗？`, '退出登录', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  logoutBusyId.value = device.id
  try {
    const token = await authStore.ensureValidToken()
    if (!token) throw new Error('not_logged_in')
    await logoutDevice(device.id, token)
    const isCurrent = device.token_id === currentJti.value
    devices.value = devices.value.filter((d) => d.id !== device.id)
    if (isCurrent) {
      authStore.clearSession()
      ElMessage.success('已退出当前设备')
      router.replace('/settings')
      return
    }
    ElMessage.success('已踢下线')
  } catch (e) {
    ElMessage.error(apiMessage(e, '操作失败'))
  } finally {
    logoutBusyId.value = null
  }
}

function onLoginDialogChange(open: boolean) {
  loginDialogOpen.value = open
  if (!open && authStore.isLoggedIn) void load()
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="device-page">
    <div class="device-shell">
      <div class="page-hero">
        <button type="button" class="back-btn" aria-label="返回" @click="router.push('/settings')">
          <MdiIcon :path="mdiArrowLeft" size="20px" />
        </button>
        <div>
          <h1 class="hero-title">设备管理</h1>
          <p class="hero-sub">管理已登录的设备，可踢下线其他会话</p>
        </div>
      </div>

      <div v-if="loading" class="state-card">
        <div class="loading-dot" />
      </div>

      <div v-else-if="errorText" class="state-card">
        <MdiIcon :path="mdiDevices" size="22px" />
        <p>{{ errorText }}</p>
        <button type="button" class="retry-btn" @click="load">重试</button>
      </div>

      <div v-else-if="!authStore.isLoggedIn" class="state-card">
        <p>登录后管理设备</p>
        <button type="button" class="primary-btn" @click="loginDialogOpen = true">去登录</button>
      </div>

      <template v-else>
        <section v-if="currentDevice" class="section">
          <h2 class="section-label">当前设备</h2>
          <article class="device-card">
            <div class="device-icon">
              <MdiIcon :path="mdiLaptop" size="22px" />
            </div>
            <div class="device-info">
              <div class="name-row">
                <span class="name">{{ currentDevice.device_info || '未知设备' }}</span>
                <span v-if="currentDevice.ip_address" class="ip">{{ currentDevice.ip_address }}</span>
              </div>
              <p class="meta">首次登录：{{ formatRelativeTime(currentDevice.create_time) || formatDateTime(currentDevice.create_time) }}</p>
              <p v-if="currentDevice.last_used_time" class="meta">
                最后活跃：{{ formatRelativeTime(currentDevice.last_used_time) }}
              </p>
            </div>
            <button
              type="button"
              class="kick-btn"
              :disabled="logoutBusyId === currentDevice.id"
              aria-label="退出登录"
              @click="kick(currentDevice)"
            >
              <MdiIcon :path="mdiClose" size="18px" />
            </button>
          </article>
        </section>

        <section class="section">
          <h2 class="section-label">其他设备</h2>
          <div v-if="!otherDevices.length" class="empty-others">没有其他登录设备</div>
          <div v-else class="device-list">
            <article v-for="device in otherDevices" :key="device.id" class="device-card">
              <div class="device-icon">
                <MdiIcon :path="mdiDevices" size="22px" />
              </div>
              <div class="device-info">
                <div class="name-row">
                  <span class="name">{{ device.device_info || '未知设备' }}</span>
                  <span v-if="device.ip_address" class="ip">{{ device.ip_address }}</span>
                </div>
                <p class="meta">首次登录：{{ formatRelativeTime(device.create_time) || formatDateTime(device.create_time) }}</p>
                <p v-if="device.last_used_time" class="meta">
                  最后活跃：{{ formatRelativeTime(device.last_used_time) }}
                </p>
              </div>
              <button
                type="button"
                class="kick-btn"
                :disabled="logoutBusyId === device.id"
                aria-label="踢下线"
                @click="kick(device)"
              >
                <MdiIcon :path="mdiClose" size="18px" />
              </button>
            </article>
          </div>
        </section>
      </template>
    </div>

    <LoginDialog :model-value="loginDialogOpen" @update:model-value="onLoginDialogChange" />
  </div>
</template>

<style scoped>
.device-page {
  min-height: calc(100vh - var(--hw-header-height));
  background: var(--hw-bg-primary);
  padding: 0 0 80px;
}

.device-shell {
  max-width: 680px;
  margin: 0 auto;
}

.page-hero {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 0 0 20px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--hw-text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.back-btn:hover {
  background: var(--hw-bg-hover);
}

.hero-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--hw-text-primary);
}

.hero-sub {
  margin-top: 4px;
  font-size: 13px;
  color: var(--hw-text-tertiary);
}

.section {
  margin-bottom: 20px;
}

.section-label {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 650;
  color: var(--hw-text-secondary);
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.device-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
}

.device-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-color-light);
  color: var(--theme-color);
  flex-shrink: 0;
}

.device-info {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}

.name {
  font-size: 15px;
  font-weight: 650;
  color: var(--hw-text-primary);
}

.ip {
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.kick-btn {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--hw-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.kick-btn:hover:not(:disabled) {
  background: color-mix(in srgb, #e35 12%, transparent);
  color: #e35;
}

.kick-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.empty-others {
  padding: 20px 16px;
  border-radius: 14px;
  background: var(--hw-bg-secondary);
  border: 1px dashed var(--hw-border);
  color: var(--hw-text-tertiary);
  font-size: 13px;
  text-align: center;
}

.state-card {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--hw-text-secondary);
  text-align: center;
}

.loading-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--theme-color-light);
  border-top-color: var(--theme-color);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.primary-btn,
.retry-btn {
  border: none;
  border-radius: 12px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
}

.primary-btn {
  background: var(--theme-color);
  color: #fff;
}

.retry-btn {
  background: transparent;
  color: var(--theme-color);
}
</style>
