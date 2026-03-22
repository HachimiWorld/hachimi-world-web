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

