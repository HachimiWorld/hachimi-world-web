<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { ApiError } from '@/api/request'
import * as authApi from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { getUserProfile } from '@/api/song'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const authStore = useAuthStore()

// ── Tab ──
type Tab = 'login' | 'register' | 'reset'
const activeTab = ref<Tab>('login')
function switchTab(tab: Tab) {
  activeTab.value = tab
  errorMsg.value = ''
  captchaKey.value = ''
  captchaVerified.value = false
}

// ── 通用 ──
const loading = ref(false)
const errorMsg = ref('')

// ── 错误码映射 ──
const errorCodeMap: Record<string, string> = {
  invalid_captcha: '人机验证失败，请重新验证',
  invalid_password: '密码至少 8 位',
  invalid_email: '邮箱格式不正确',
  email_existed: '该邮箱已被注册',
  invalid_verify_code: '验证码错误或已过期',
  password_not_match: '邮箱或密码错误',
  too_many_requests: '操作过于频繁，请稍后再试',
  invalid_user: '用户不存在',
  '2fa_required': '需要双因素认证',
}

// ── 人机验证（iframe 内嵌模式）──
// 流程：
//   1. 调用 /auth/captcha/generate 拿到 captcha_key 和 url
//   2. 在表单内用 <iframe> 加载 captcha 页面
//   3. captcha.html 验证成功后通过 postMessage 通知父窗口
//   4. 父窗口监听到 captcha_success，标记已完成
const captchaKey = ref('')
const captchaVerified = ref(false)
const captchaLoading = ref(false)
const captchaIframeUrl = ref('')
const captchaVisible = ref(false)

async function openCaptcha() {
  captchaLoading.value = true
  captchaKey.value = ''
  captchaVerified.value = false
  captchaIframeUrl.value = ''
  captchaVisible.value = false
  errorMsg.value = ''
  try {
    const resp = await authApi.generateCaptcha()
    captchaKey.value = resp.captcha_key
    captchaIframeUrl.value = resp.url
    captchaVisible.value = true
  } catch (e) {
    errorMsg.value = e instanceof ApiError ? e.msg : '获取验证失败'
  } finally {
    captchaLoading.value = false
  }
}

// 监听 captcha.html 通过 postMessage 发来的结果
function onCaptchaMessage(event: MessageEvent) {
  if (!event.data || typeof event.data !== 'object') return
  const { type } = event.data
  if (type === 'captcha_success') {
    captchaVerified.value = true
    captchaVisible.value = false
    captchaIframeUrl.value = ''
  } else if (type === 'captcha_error') {
    captchaVerified.value = false
    captchaVisible.value = false
    captchaIframeUrl.value = ''
    captchaKey.value = ''
    errorMsg.value = '人机验证失败，请重试'
  }
}

// Dialog 打开/关闭时挂载/卸载消息监听
watch(() => props.modelValue, (val) => {
  if (val) {
    window.addEventListener('message', onCaptchaMessage)
  } else {
    window.removeEventListener('message', onCaptchaMessage)
    captchaIframeUrl.value = ''
    captchaVisible.value = false
  }
})
onUnmounted(() => {
  window.removeEventListener('message', onCaptchaMessage)
})

// ── 邮箱验证码（注册/重置密码共用） ──
const codeCooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

function startCooldown() {
  codeCooldown.value = 60
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    codeCooldown.value--
    if (codeCooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
    }
  }, 1000)
}

async function sendCode(email: string) {
  if (!email.trim()) {
    errorMsg.value = '请先填写邮箱'
    return
  }
  if (codeCooldown.value > 0) return
  try {
    await authApi.sendEmailCode(email.trim())
    startCooldown()
    ElMessage.success('验证码已发送，请查收邮件（有效期 5 分钟）')
  } catch (e) {
    errorMsg.value = e instanceof ApiError
      ? (errorCodeMap[e.code] ?? e.msg)
      : '发送失败'
  }
}

// ────────────────────────
// 登录
// ────────────────────────
const loginForm = ref({ email: '', password: '' })

async function handleLogin() {
  errorMsg.value = ''
  if (!loginForm.value.email || !loginForm.value.password) {
    errorMsg.value = '请填写邮箱和密码'
    return
  }
  if (!captchaKey.value) {
    errorMsg.value = '请先完成人机验证'
    return
  }
  loading.value = true
  try {
    const resp = await authApi.login({
      email: loginForm.value.email.trim(),
      password: loginForm.value.password,
      device_info: authStore.deviceName,
      code: null,
      captcha_key: captchaKey.value,
    })
    authStore.saveSession({
      uid: resp.uid,
      username: resp.username,
      avatar_url: null,
      access_token: resp.token.access_token,
      refresh_token: resp.token.refresh_token,
      expires_in: resp.token.expires_in,
    })
    ElMessage.success(`欢迎回来，${resp.username}！`)
    emit('update:modelValue', false)
    // 异步获取头像 URL 并持久化（不阻塞登录流程）
    getUserProfile(resp.uid).then(profile => {
      if (profile.avatar_url) {
        authStore.saveSession({
          uid: resp.uid,
          username: resp.username,
          avatar_url: profile.avatar_url,
          access_token: authStore.accessToken!,
          refresh_token: authStore.refreshTokenVal!,
          expires_in: authStore.tokenExpires!,
        })
      }
    }).catch(() => { /* 获取头像失败不影响登录 */ })
  } catch (e) {
    errorMsg.value = e instanceof ApiError
      ? (errorCodeMap[e.code] ?? e.msg)
      : '登录失败，请稍后重试'
    captchaKey.value = ''
    captchaVerified.value = false
  } finally {
    loading.value = false
  }
}

// ────────────────────────
// 注册
// ────────────────────────
const registerForm = ref({ email: '', password: '', confirmPassword: '', code: '' })

async function handleRegister() {
  errorMsg.value = ''
  const { email, password, confirmPassword, code } = registerForm.value
  if (!email || !password || !code) {
    errorMsg.value = '请填写所有必填项'
    return
  }
  if (password.length < 8) {
    errorMsg.value = '密码至少 8 位'
    return
  }
  if (password !== confirmPassword) {
    errorMsg.value = '两次密码不一致'
    return
  }
  if (!captchaKey.value) {
    errorMsg.value = '请先完成人机验证'
    return
  }
  loading.value = true
  try {
    const resp = await authApi.register({
      email: email.trim(),
      password,
      code,
      device_info: authStore.deviceName,
      captcha_key: captchaKey.value,
    })
    authStore.saveSession({
      uid: resp.uid,
      username: resp.generated_username,
      avatar_url: null,
      access_token: resp.token.access_token,
      refresh_token: resp.token.refresh_token,
      expires_in: resp.token.expires_in,
    })
    ElMessage.success(`注册成功，欢迎 ${resp.generated_username}！`)
    emit('update:modelValue', false)
  } catch (e) {
    errorMsg.value = e instanceof ApiError
      ? (errorCodeMap[e.code] ?? e.msg)
      : '注册失败，请稍后重试'
    captchaKey.value = ''
    captchaVerified.value = false
  } finally {
    loading.value = false
  }
}

// ────────────────────────
// 重置密码
// ────────────────────────
const resetForm = ref({ email: '', code: '', newPassword: '', confirmPassword: '' })

async function handleReset() {
  errorMsg.value = ''
  const { email, code, newPassword, confirmPassword } = resetForm.value
  if (!email || !code || !newPassword) {
    errorMsg.value = '请填写所有必填项'
    return
  }
  if (newPassword.length < 8) {
    errorMsg.value = '密码至少 8 位'
    return
  }
  if (newPassword !== confirmPassword) {
    errorMsg.value = '两次密码不一致'
    return
  }
  if (!captchaKey.value) {
    errorMsg.value = '请先完成人机验证'
    return
  }
  loading.value = true
  try {
    await authApi.resetPassword({
      email: email.trim(),
      code,
      new_password: newPassword,
      logout_all_devices: true,
      captcha_key: captchaKey.value,
    })
    ElMessage.success('密码已重置，请用新密码登录')
    switchTab('login')
  } catch (e) {
    errorMsg.value = e instanceof ApiError
      ? (errorCodeMap[e.code] ?? e.msg)
      : '重置失败，请稍后重试'
    captchaKey.value = ''
    captchaVerified.value = false
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :title="activeTab === 'login' ? '登录' : activeTab === 'register' ? '注册' : '重置密码'"
    width="420px"
    class="login-dialog"
    :close-on-click-modal="true"
    destroy-on-close
  >
    <!-- Tab 切换 -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'login' }"
        @click="switchTab('login')"
      >登录</button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'register' }"
        @click="switchTab('register')"
      >注册</button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'reset' }"
        @click="switchTab('reset')"
      >重置密码</button>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMsg" class="error-bar">
      <el-icon><Warning /></el-icon>
      <span>{{ errorMsg }}</span>
    </div>

    <!-- ── 登录表单 ── -->
    <div v-if="activeTab === 'login'" class="form-body">
      <el-form label-position="top" @submit.prevent="handleLogin">
        <el-form-item label="邮箱">
          <el-input
            v-model="loginForm.email"
            placeholder="your@email.com"
            type="email"
            autocomplete="email"
            clearable
          />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <!-- 人机验证 -->
        <el-form-item label="人机验证">
          <div class="captcha-wrap">
            <div class="captcha-row">
              <div class="captcha-status" :class="{ verified: captchaVerified }">
                <el-icon v-if="captchaVerified"><CircleCheck /></el-icon>
                <el-icon v-else><Shield /></el-icon>
                <span>{{ captchaVerified ? '验证已通过' : '请完成人机验证' }}</span>
              </div>
              <el-button
                size="small"
                :loading="captchaLoading"
                @click="openCaptcha"
              >
                {{ captchaVerified ? '重新验证' : '获取验证' }}
              </el-button>
            </div>
            <div v-if="captchaVisible" class="captcha-iframe-wrap">
              <iframe
                :src="captchaIframeUrl"
                class="captcha-iframe"
                frameborder="0"
                scrolling="no"
              />
            </div>
          </div>
        </el-form-item>

        <el-button
          type="primary"
          class="submit-btn"
          :loading="loading"
          @click="handleLogin"
          native-type="submit"
        >
          登录
        </el-button>
      </el-form>
    </div>

    <!-- ── 注册表单 ── -->
    <div v-if="activeTab === 'register'" class="form-body">
      <el-form label-position="top" @submit.prevent="handleRegister">
        <el-form-item label="邮箱">
          <el-input
            v-model="registerForm.email"
            placeholder="your@email.com"
            type="email"
            autocomplete="email"
            clearable
          />
        </el-form-item>
        <el-form-item label="邮箱验证码">
          <div class="code-row">
            <el-input
              v-model="registerForm.code"
              placeholder="6 位验证码"
              maxlength="6"
              class="code-input"
            />
            <el-button
              size="default"
              :disabled="codeCooldown > 0"
              @click="sendCode(registerForm.email)"
            >
              {{ codeCooldown > 0 ? `${codeCooldown}s 后重发` : '发送验证码' }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="registerForm.password"
            type="password"
            placeholder="至少 8 位"
            autocomplete="new-password"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input
            v-model="registerForm.confirmPassword"
            type="password"
            placeholder="再次输入密码"
            autocomplete="new-password"
            show-password
            @keyup.enter="handleRegister"
          />
        </el-form-item>

        <!-- 人机验证 -->
        <el-form-item label="人机验证">
          <div class="captcha-wrap">
            <div class="captcha-row">
              <div class="captcha-status" :class="{ verified: captchaVerified }">
                <el-icon v-if="captchaVerified"><CircleCheck /></el-icon>
                <el-icon v-else><Shield /></el-icon>
                <span>{{ captchaVerified ? '验证已通过' : '请完成人机验证' }}</span>
              </div>
              <el-button
                size="small"
                :loading="captchaLoading"
                @click="openCaptcha"
              >
                {{ captchaVerified ? '重新验证' : '获取验证' }}
              </el-button>
            </div>
            <div v-if="captchaVisible" class="captcha-iframe-wrap">
              <iframe
                :src="captchaIframeUrl"
                class="captcha-iframe"
                frameborder="0"
                scrolling="no"
              />
            </div>
          </div>
        </el-form-item>

        <el-button
          type="primary"
          class="submit-btn"
          :loading="loading"
          @click="handleRegister"
        >
          注册
        </el-button>
      </el-form>
    </div>

    <!-- ── 重置密码表单 ── -->
    <div v-if="activeTab === 'reset'" class="form-body">
      <el-form label-position="top" @submit.prevent="handleReset">
        <el-form-item label="邮箱">
          <el-input
            v-model="resetForm.email"
            placeholder="your@email.com"
            type="email"
            autocomplete="email"
            clearable
          />
        </el-form-item>
        <el-form-item label="邮箱验证码">
          <div class="code-row">
            <el-input
              v-model="resetForm.code"
              placeholder="6 位验证码"
              maxlength="6"
              class="code-input"
            />
            <el-button
              size="default"
              :disabled="codeCooldown > 0"
              @click="sendCode(resetForm.email)"
            >
              {{ codeCooldown > 0 ? `${codeCooldown}s 后重发` : '发送验证码' }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="新密码">
          <el-input
            v-model="resetForm.newPassword"
            type="password"
            placeholder="至少 8 位"
            autocomplete="new-password"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input
            v-model="resetForm.confirmPassword"
            type="password"
            placeholder="再次输入新密码"
            autocomplete="new-password"
            show-password
            @keyup.enter="handleReset"
          />
        </el-form-item>

        <!-- 人机验证 -->
        <el-form-item label="人机验证">
          <div class="captcha-wrap">
            <div class="captcha-row">
              <div class="captcha-status" :class="{ verified: captchaVerified }">
                <el-icon v-if="captchaVerified"><CircleCheck /></el-icon>
                <el-icon v-else><Shield /></el-icon>
                <span>{{ captchaVerified ? '验证已通过' : '请完成人机验证' }}</span>
              </div>
              <el-button
                size="small"
                :loading="captchaLoading"
                @click="openCaptcha"
              >
                {{ captchaVerified ? '重新验证' : '获取验证' }}
              </el-button>
            </div>
            <div v-if="captchaVisible" class="captcha-iframe-wrap">
              <iframe
                :src="captchaIframeUrl"
                class="captcha-iframe"
                frameborder="0"
                scrolling="no"
              />
            </div>
          </div>
        </el-form-item>

        <el-button
          type="primary"
          class="submit-btn"
          :loading="loading"
          @click="handleReset"
        >
          重置密码
        </el-button>
      </el-form>
    </div>
  </el-dialog>
</template>

<style scoped>
/* Tab 栏 */
.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  background: var(--hw-bg-secondary);
  border-radius: 8px;
  padding: 4px;
}

.tab-btn {
  flex: 1;
  padding: 7px 0;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--hw-text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.tab-btn:hover {
  color: var(--hw-text-primary);
}

.tab-btn.active {
  background: var(--hw-bg-primary);
  color: var(--theme-color);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

:root.dark .tab-bar {
  background: var(--hw-bg-primary);
}

:root.dark .tab-btn.active {
  background: var(--hw-bg-secondary);
}

/* 错误条 */
.error-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin-bottom: 16px;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 6px;
  color: #cf1322;
  font-size: 13px;
}

:root.dark .error-bar {
  background: rgba(207, 19, 34, 0.12);
  border-color: rgba(207, 19, 34, 0.3);
  color: #ff7875;
}

/* 表单 */
.form-body {
  padding: 0 2px;
}

:deep(.el-form-item__label) {
  color: var(--hw-text-primary);
  font-weight: 500;
  padding-bottom: 4px;
}

:deep(.el-input__wrapper) {
  background: var(--hw-bg-input);
  box-shadow: 0 0 0 1px var(--hw-border) inset;
  border-radius: 6px;
  transition: box-shadow 0.2s;
}

:deep(.el-input__wrapper:hover),
:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--theme-color) inset !important;
}

:deep(.el-input__inner) {
  color: var(--hw-text-primary);
}

/* 验证码行 */
.code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.code-input {
  flex: 1;
}

/* 人机验证区域 */
.captcha-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.captcha-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}

.captcha-iframe-wrap {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
}

.captcha-iframe {
  width: 100%;
  height: 120px;
  border: none;
  display: block;
}

.captcha-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--hw-text-tertiary);
  transition: color 0.2s;
}

.captcha-status.verified {
  color: #52c41a;
}

:root.dark .captcha-status.verified {
  color: #73d13d;
}

/* 提交按钮 */
.submit-btn {
  width: 100%;
  margin-top: 8px;
  background: var(--theme-color);
  border-color: var(--theme-color);
  font-weight: 600;
  font-size: 15px;
  height: 40px;
  border-radius: 8px;
  transition: opacity 0.15s, transform 0.1s;
}

.submit-btn:hover {
  opacity: 0.88;
}

.submit-btn:active {
  transform: scale(0.98);
}

/* Dialog 深色适配 */
:deep(.el-dialog) {
  background: var(--hw-bg-primary);
  border: 1px solid var(--hw-border);
  border-radius: 12px;
}

:deep(.el-dialog__title) {
  color: var(--hw-text-primary);
  font-weight: 700;
  font-size: 18px;
}

:deep(.el-dialog__headerbtn .el-dialog__close),
:deep(.el-dialog__headerbtn .el-dialog__close svg) {
  color: var(--hw-text-tertiary) !important;
  fill: currentColor !important;
  transition: color 0.15s ease;
}

:deep(.el-dialog__headerbtn:hover .el-dialog__close),
:deep(.el-dialog__headerbtn:hover .el-dialog__close svg),
:deep(.el-dialog__headerbtn:focus-visible .el-dialog__close),
:deep(.el-dialog__headerbtn:focus-visible .el-dialog__close svg) {
  color: var(--theme-color) !important;
  fill: currentColor !important;
}

:deep(.el-dialog__body) {
  padding: 0 24px 24px;
}

:deep(.el-dialog__header) {
  padding: 20px 24px 16px;
  margin-right: 0;
}
</style> 