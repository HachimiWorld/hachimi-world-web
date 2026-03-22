// 开发环境走 Vite proxy（/api-proxy），避免 CORS 问题
// 生产环境直接请求真实 API 地址
export const API_BASE_URL =
  import.meta.env.DEV
    ? '/api-proxy'
    : (import.meta.env.VITE_API_BASE_URL as string)
