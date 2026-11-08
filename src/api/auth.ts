import { http } from './request'

// -------- 类型定义 --------

export interface TokenPair {
  access_token: string
  refresh_token: string
  expires_in: string
}

export interface RegisterResp {
  uid: number
  generated_username: string
  token: TokenPair
}

export interface LoginResp {
  uid: number
  username: string
  token: TokenPair
}

export interface CaptchaGenerateResp {
  captcha_key: string
  url: string
}

// -------- 验证码 --------

/** 生成 Cloudflare 人机验证 key，返回 captcha_key 和 用于打开的 url */
export function generateCaptcha(): Promise<CaptchaGenerateResp> {
  return http.get<CaptchaGenerateResp>('/auth/captcha/generate')
}

/** 前端提交 Cloudflare turnstile token（仅在使用内嵌 widget 时调用，captcha.html 已自动处理） */
export function submitCaptcha(captchaKey: string, token: string): Promise<null> {
  return http.post<null>('/auth/captcha/submit', { captcha_key: captchaKey, token })
}

// -------- 邮箱验证码 --------

/** 发送邮箱验证码（60s 内仅能发送一次） */
export function sendEmailCode(email: string): Promise<null> {
  return http.post<null>('/auth/send_email_code', { email })
}

// -------- 注册 --------

export interface RegisterParams {
  email: string
  password: string
  code: string
  device_info: string
  captcha_key: string
}

export function register(params: RegisterParams): Promise<RegisterResp> {
  return http.post<RegisterResp>('/auth/register/email', params)
}

// -------- 登录 --------

export interface LoginParams {
  email: string
  password: string
  device_info: string
  code: string | null
  captcha_key: string
}

export function login(params: LoginParams): Promise<LoginResp> {
  return http.post<LoginResp>('/auth/login/email', params)
}

// -------- 刷新令牌 --------

export function refreshToken(refreshToken: string, deviceInfo: string): Promise<TokenPair> {
  return http.post<TokenPair>('/auth/refresh_token', {
    refresh_token: refreshToken,
    device_info: deviceInfo,
  })
}

// -------- 重置密码 --------

export interface ResetPasswordParams {
  email: string
  code: string
  new_password: string
  logout_all_devices: boolean
  captcha_key: string
}

export function resetPassword(params: ResetPasswordParams): Promise<null> {
  return http.post<null>('/auth/reset_password', params)
}

// -------- 设备管理 --------

export interface DeviceItem {
  id: number
  device_info: string | null
  ip_address: string | null
  last_used_time: string | null
  create_time: string
  token_id: string
}

export async function listDevices(token: string): Promise<{ devices: DeviceItem[] }> {
  return http.get('/auth/device/list', token)
}

export async function logoutDevice(deviceId: number, token: string): Promise<null> {
  return http.post('/auth/device/logout', { device_id: deviceId }, token)
}

// -------- 更换邮箱 --------

export interface PendingEmailChange {
  new_email: string
  effective_time: string
  create_time: string
}

export interface EmailInfoResp {
  email: string
  pending: PendingEmailChange | null
  next_request_time: string | null
}

export async function getEmailInfo(token: string): Promise<EmailInfoResp> {
  return http.get('/auth/email/info', token)
}

export async function sendOldEmailCode(token: string): Promise<null> {
  return http.post('/auth/email/send_old_code', {}, token)
}

export async function sendNewEmailCode(newEmail: string, token: string): Promise<null> {
  return http.post('/auth/email/send_new_code', { new_email: newEmail }, token)
}

export async function changeEmail(params: {
  newEmail: string
  oldCode: string
  newCode: string
}, token: string): Promise<null> {
  return http.post('/auth/email/change', {
    new_email: params.newEmail,
    old_code: params.oldCode,
    new_code: params.newCode,
  }, token)
}

export async function requestEmailChange(params: {
  newEmail: string
  newCode: string
  password: string
}, token: string): Promise<PendingEmailChange> {
  return http.post('/auth/email/request_change', {
    new_email: params.newEmail,
    new_code: params.newCode,
    password: params.password,
  }, token)
}

export async function cancelEmailChange(token: string): Promise<null> {
  return http.post('/auth/email/cancel_change', {}, token)
}

/** 无需登录：邮件链接撤销/回滚邮箱变更 */
export async function revertEmailChange(token: string, newPassword: string): Promise<null> {
  return http.post('/auth/email/revert_change', {
    token,
    new_password: newPassword,
  })
}

export function emailChangeErrorMessage(code: string): string | null {
  switch (code) {
    case 'invalid_email':
      return '邮箱格式不正确'
    case 'same_email':
      return '新邮箱与当前邮箱相同'
    case 'email_existed':
      return '该邮箱已被其他账号使用'
    case 'too_many_requests':
      return '验证码发送过于频繁，请稍后重试'
    case 'invalid_old_code':
      return '原邮箱验证码错误'
    case 'invalid_new_code':
      return '新邮箱验证码错误'
    case 'password_not_match':
      return '密码错误'
    case 'too_many_attempts':
      return '密码错误次数过多，请 1 小时后重试'
    case 'too_frequent':
      return '每 30 天只能通过密码更换一次邮箱'
    case 'pending_exists':
      return '已有一个邮箱更换申请待生效'
    case 'invalid_password':
      return '密码至少 8 位'
    case 'invalid_token':
      return '链接无效、已使用或已过期'
    case 'old_email_taken':
      return '原邮箱已被其他账号使用'
    case 'invalid_device':
      return '设备无效'
    default:
      return null
  }
}

/** 解析 JWT payload（不验签），用于读取 refresh token 的 jti */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export function getRefreshTokenJti(refreshToken: string | null | undefined): string | null {
  if (!refreshToken) return null
  const payload = decodeJwtPayload(refreshToken)
  const jti = payload?.jti
  return typeof jti === 'string' ? jti : null
}

