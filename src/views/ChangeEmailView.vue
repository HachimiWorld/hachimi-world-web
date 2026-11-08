<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  mdiArrowLeft,
  mdiChevronRight,
  mdiEmailOutline,
  mdiLockOutline,
} from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import { ApiError } from '@/api/request'
import {
  cancelEmailChange,
  changeEmail,
  emailChangeErrorMessage,
  getEmailInfo,
  requestEmailChange,
  sendNewEmailCode,
  sendOldEmailCode,
  type EmailInfoResp,
  type PendingEmailChange,
} from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/relativeTime'

type Method = 'old_email' | 'password' | null

const router = useRouter()
const authStore = useAuthStore()

const info = ref<EmailInfoResp | null>(null)
const loading = ref(false)
const operating = ref(false)
const errorText = ref('')
const method = ref<Method>(null)
const loginDialogOpen = ref(false)

const newEmail = ref('')
const oldCode = ref('')
const newCode = ref('')
const password = ref('')

const oldCodeCooldown = ref(0)
const newCodeCooldown = ref(0)
let cooldownTimer: number | null = null

const canRequestByPassword = computed(() => {
  if (!info.value?.next_request_time) return true
  return Date.now() >= new Date(info.value.next_request_time).getTime()
})

function apiMessage(e: unknown, fallback: string) {
  if (e instanceof ApiError) return emailChangeErrorMessage(e.code) || e.msg || fallback
  return fallback
}

function tickCooldown() {
  if (oldCodeCooldown.value > 0) oldCodeCooldown.value -= 1
  if (newCodeCooldown.value > 0) newCodeCooldown.value -= 1
  if (oldCodeCooldown.value <= 0 && newCodeCooldown.value <= 0 && cooldownTimer) {
    window.clearInterval(cooldownTimer)
    cooldownTimer = null
  }
}

function startCooldown(which: 'old' | 'new') {
  if (which === 'old') oldCodeCooldown.value = 60
  else newCodeCooldown.value = 60
  if (!cooldownTimer) cooldownTimer = window.setInterval(tickCooldown, 1000)
}

async function requireToken() {
  const token = await authStore.ensureValidToken()
  if (!token) throw new Error('not_logged_in')
  return token
}

async function load() {
  if (!authStore.isLoggedIn) {
    loginDialogOpen.value = true
    return
  }
  loading.value = true
  errorText.value = ''
  try {
    const token = await requireToken()
    info.value = await getEmailInfo(token)
    method.value = null
  } catch (e) {
    errorText.value = apiMessage(e, '加载失败')
    info.value = null
  } finally {
    loading.value = false
  }
}

async function sendOld() {
  try {
    const token = await requireToken()
    await sendOldEmailCode(token)
    startCooldown('old')
    ElMessage.success('验证码已发送到原邮箱')
  } catch (e) {
    ElMessage.error(apiMessage(e, '发送失败'))
  }
}

async function sendNew() {
  const email = newEmail.value.trim()
  if (!email) {
    ElMessage.warning('请先填写新邮箱')
    return
  }
  try {
    const token = await requireToken()
    await sendNewEmailCode(email, token)
    startCooldown('new')
    ElMessage.success('验证码已发送到新邮箱')
  } catch (e) {
    ElMessage.error(apiMessage(e, '发送失败'))
  }
}

async function submitWithOldEmail() {
  if (operating.value) return
  operating.value = true
  try {
    const token = await requireToken()
    await changeEmail({
      newEmail: newEmail.value.trim(),
      oldCode: oldCode.value.trim(),
      newCode: newCode.value.trim(),
    }, token)
    await ElMessageBox.alert(
      `此后请使用 ${newEmail.value.trim()} 登录。`,
      '邮箱已更换',
      { confirmButtonText: '好的' },
    )
    router.replace('/settings')
  } catch (e) {
    ElMessage.error(apiMessage(e, '更换失败'))
  } finally {
    operating.value = false
  }
}

async function submitWithPassword() {
  if (operating.value) return
  operating.value = true
  try {
    const token = await requireToken()
    const pending = await requestEmailChange({
      newEmail: newEmail.value.trim(),
      newCode: newCode.value.trim(),
      password: password.value,
    }, token)
    if (info.value) {
      info.value = { ...info.value, pending }
    }
    method.value = null
    newEmail.value = ''
    newCode.value = ''
    password.value = ''
    ElMessage.success('申请已提交，生效前可取消')
  } catch (e) {
    ElMessage.error(apiMessage(e, '提交失败'))
  } finally {
    operating.value = false
  }
}

async function cancelPending(pending: PendingEmailChange) {
  try {
    await ElMessageBox.confirm(
      '取消后，绑定邮箱保持不变，原邮箱不再收到提醒邮件。',
      '确定取消此次邮箱更换？',
      {
        confirmButtonText: '取消更换',
        cancelButtonText: '保留申请',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  operating.value = true
  try {
    const token = await requireToken()
    await cancelEmailChange(token)
    if (info.value) info.value = { ...info.value, pending: null }
    ElMessage.success('邮箱更换已取消')
  } catch (e) {
    ElMessage.error(apiMessage(e, '操作失败'))
  } finally {
    operating.value = false
  }
}

function chooseMethod(m: Method) {
  method.value = m
  oldCode.value = ''
  newCode.value = ''
  password.value = ''
  newEmail.value = ''
}

function goBack() {
  if (method.value) {
    method.value = null
    return
  }
  router.push('/settings')
}

function onLoginDialogChange(open: boolean) {
  loginDialogOpen.value = open
  if (!open && authStore.isLoggedIn) void load()
}

onMounted(() => {
  void load()
})

onUnmounted(() => {
  if (cooldownTimer) window.clearInterval(cooldownTimer)
})
</script>

<template>
  <div class="email-page">
    <div class="email-shell">
      <div class="page-hero">
        <button type="button" class="back-btn" aria-label="返回" @click="goBack">
          <MdiIcon :path="mdiArrowLeft" size="20px" />
        </button>
        <div>
          <h1 class="hero-title">更换邮箱</h1>
          <p class="hero-sub">更新用于登录与通知的邮箱地址</p>
        </div>
      </div>

      <div v-if="loading" class="state-card">
        <div class="loading-dot" />
      </div>

      <div v-else-if="errorText" class="state-card">
        <p>{{ errorText }}</p>
        <button type="button" class="retry-btn" @click="load">重试</button>
      </div>

      <div v-else-if="!authStore.isLoggedIn" class="state-card">
        <p>登录后更换邮箱</p>
        <button type="button" class="primary-btn" @click="loginDialogOpen = true">去登录</button>
      </div>

      <template v-else-if="info">
        <p class="current-email">当前邮箱：{{ info.email }}</p>

        <!-- 待生效 -->
        <div v-if="info.pending" class="card">
          <h2 class="card-title">邮箱更换待生效</h2>
          <p class="card-body">
            {{ formatDateTime(info.pending.effective_time) }} 起，绑定邮箱将更换为
            {{ info.pending.new_email }}。生效前可随时取消。
          </p>
          <button
            type="button"
            class="text-danger"
            :disabled="operating"
            @click="cancelPending(info.pending)"
          >
            取消更换
          </button>
        </div>

        <!-- 选择方式 -->
        <template v-else-if="!method">
          <p class="hint">请选择验证身份的方式。</p>
          <button type="button" class="method-card" @click="chooseMethod('old_email')">
            <div class="method-icon">
              <MdiIcon :path="mdiEmailOutline" size="22px" />
            </div>
            <div class="method-text">
              <span class="method-title">通过原邮箱验证</span>
              <span class="method-desc">向原邮箱和新邮箱分别发送验证码，验证通过后立即更换。</span>
            </div>
            <MdiIcon class="chevron" :path="mdiChevronRight" size="20px" />
          </button>
          <button
            type="button"
            class="method-card"
            :class="{ disabled: !canRequestByPassword }"
            :disabled="!canRequestByPassword"
            @click="chooseMethod('password')"
          >
            <div class="method-icon">
              <MdiIcon :path="mdiLockOutline" size="22px" />
            </div>
            <div class="method-text">
              <span class="method-title">通过密码验证</span>
              <span class="method-desc">原邮箱无法使用时选择此方式。提交申请 7 天后更换生效。</span>
              <span v-if="!canRequestByPassword && info.next_request_time" class="method-warn">
                下次可通过密码更换的时间：{{ formatDateTime(info.next_request_time) }}
              </span>
            </div>
            <MdiIcon class="chevron" :path="mdiChevronRight" size="20px" />
          </button>
        </template>

        <!-- 原邮箱验证表单 -->
        <div v-else-if="method === 'old_email'" class="form-card">
          <p class="hint">
            原邮箱和新邮箱将分别收到一个验证码。两个验证码都验证通过后，邮箱立即更换。
          </p>

          <label class="field-label">新邮箱</label>
          <el-input v-model="newEmail" placeholder="new@example.com" />

          <label class="field-label">原邮箱验证码</label>
          <div class="code-row">
            <el-input v-model="oldCode" placeholder="6 位验证码" maxlength="8" />
            <el-button :disabled="oldCodeCooldown > 0" @click="sendOld">
              {{ oldCodeCooldown > 0 ? `${oldCodeCooldown}s` : '发送' }}
            </el-button>
          </div>

          <label class="field-label">新邮箱验证码</label>
          <div class="code-row">
            <el-input v-model="newCode" placeholder="6 位验证码" maxlength="8" />
            <el-button :disabled="newCodeCooldown > 0 || !newEmail.trim()" @click="sendNew">
              {{ newCodeCooldown > 0 ? `${newCodeCooldown}s` : '发送' }}
            </el-button>
          </div>

          <el-button
            type="primary"
            class="submit-btn"
            :loading="operating"
            :disabled="!newEmail.trim() || !oldCode.trim() || !newCode.trim()"
            @click="submitWithOldEmail"
          >
            更换邮箱
          </el-button>
        </div>

        <!-- 密码验证表单 -->
        <div v-else class="form-card">
          <p class="hint">
            使用密码代替原邮箱验证码。提交申请 7 天后更换生效，在此期间原邮箱将收到 3 封提醒邮件，你可以随时取消。每 30 天只能通过密码更换一次邮箱。
          </p>

          <label class="field-label">新邮箱</label>
          <el-input v-model="newEmail" placeholder="new@example.com" />

          <label class="field-label">新邮箱验证码</label>
          <div class="code-row">
            <el-input v-model="newCode" placeholder="6 位验证码" maxlength="8" />
            <el-button :disabled="newCodeCooldown > 0 || !newEmail.trim()" @click="sendNew">
              {{ newCodeCooldown > 0 ? `${newCodeCooldown}s` : '发送' }}
            </el-button>
          </div>

          <label class="field-label">密码</label>
          <el-input v-model="password" type="password" show-password placeholder="当前账号密码" />

          <el-button
            type="primary"
            class="submit-btn"
            :loading="operating"
            :disabled="!newEmail.trim() || !newCode.trim() || !password"
            @click="submitWithPassword"
          >
            提交申请
          </el-button>
        </div>
      </template>
    </div>

    <LoginDialog :model-value="loginDialogOpen" @update:model-value="onLoginDialogChange" />
  </div>
</template>

<style scoped>
.email-page {
  min-height: calc(100vh - var(--hw-header-height));
  background: var(--hw-bg-primary);
  padding: 0 0 80px;
}

.email-shell {
  max-width: 560px;
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

.current-email {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 650;
  color: var(--hw-text-primary);
}

.hint {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--hw-text-secondary);
}

.card,
.form-card {
  padding: 16px;
  border-radius: 14px;
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
}

.card-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
}

.card-body {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--hw-text-secondary);
}

.text-danger {
  border: none;
  background: transparent;
  color: #e35;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
}

.method-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 10px;
  border-radius: 14px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.method-card:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--theme-color) 40%, var(--hw-border));
}

.method-card.disabled,
.method-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.method-icon {
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

.method-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.method-title {
  font-size: 15px;
  font-weight: 650;
}

.method-desc,
.method-warn {
  font-size: 12px;
  color: var(--hw-text-tertiary);
  line-height: 1.45;
}

.method-warn {
  color: #c97800;
}

.chevron {
  color: var(--hw-text-tertiary);
  flex-shrink: 0;
}

.field-label {
  display: block;
  margin: 14px 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--hw-text-secondary);
}

.code-row {
  display: flex;
  gap: 8px;
}

.code-row .el-input {
  flex: 1;
}

.submit-btn {
  width: 100%;
  margin-top: 20px;
  --el-button-bg-color: var(--theme-color);
  --el-button-border-color: var(--theme-color);
  --el-button-hover-bg-color: color-mix(in srgb, var(--theme-color) 82%, black);
  --el-button-hover-border-color: color-mix(in srgb, var(--theme-color) 82%, black);
  --el-button-active-bg-color: color-mix(in srgb, var(--theme-color) 82%, black);
  --el-button-active-border-color: color-mix(in srgb, var(--theme-color) 82%, black);
  background: var(--theme-color);
  border-color: var(--theme-color);
  color: #fff;
}

.submit-btn:hover,
.submit-btn:focus-visible {
  background: color-mix(in srgb, var(--theme-color) 82%, black);
  border-color: color-mix(in srgb, var(--theme-color) 82%, black);
  color: #fff;
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
