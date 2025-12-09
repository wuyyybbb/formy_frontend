/**
 * HTTP 客户端封装 - 基于 Axios
 */
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { getToken } from './auth'

// API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

/**
 * API 错误响应
 */
export interface ApiError {
  code: string
  message: string
  details?: string
}

/**
 * 创建 Axios 实例
 */
const createAxiosInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // 30 秒超时
    withCredentials: true, // 允许跨域携带 cookie（用于 refresh token cookie 流程）
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // 请求拦截器 - 自动添加 token
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // 从 auth.ts 统一获取 token（使用统一的 key）
      const token = getToken()
      if (token) {
        // 确保 Authorization 头格式正确：Bearer <token>
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // 响应拦截器
  instance.interceptors.response.use(
    (response) => {
      // 返回完整的 response，由调用方决定是否需要 .data
      return response
    },
    async (error: AxiosError) => {
      // 统一错误处理
      let errorMessage = '请求失败，请稍后重试'

      // 在遇到 401 时尝试使用 refresh token 刷新一次 access token 并重试请求
      const originalRequest: any = error.config
      if (error.response && error.response.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true
        try {
          // 使用独立 axios 实例、不走拦截器（避免循环），并携带 cookie
          const refreshClient = axios.create({ baseURL: API_BASE_URL, timeout: 10000, withCredentials: true })
          const resp = await refreshClient.post('/auth/refresh', {})
            const data = resp.data as any
            if (data && data.access_token) {
              // 更新本地存储（token 与 refresh）并更新 axios 实例 header
              try {
                // refresh token is stored in HttpOnly cookie by backend; do not store it in JS
                localStorage.setItem('formy_auth_token', data.access_token)
                // 更新 axios 默认 header
                instance.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
                originalRequest.headers['Authorization'] = `Bearer ${data.access_token}`
              } catch (e) {
                // ignore
              }

              return instance.request(originalRequest)
            }
        } catch (refreshErr) {
          // 刷新失败，清理本地登录状态
          try {
            localStorage.removeItem('formy_auth_token')
            localStorage.removeItem('formy_user_info')
          } catch (e) {}
          delete instance.defaults.headers.common['Authorization']
          return Promise.reject(new Error('会话已过期，请重新登录'))
        }
        }
      }

      if (error.response) {
        // 服务器返回了错误状态码
        const { status, data } = error.response
        
        if (data && typeof data === 'object' && 'detail' in data) {
          const detail = (data as any).detail
          
          // 如果 detail 是对象（如算力不足详情），提取 message 字段
          if (typeof detail === 'object' && detail !== null) {
            if ('message' in detail) {
              errorMessage = detail.message
            } else if ('error' in detail) {
              errorMessage = detail.error
            } else {
              // 尝试将对象转为 JSON 字符串
              errorMessage = JSON.stringify(detail)
            }
          } else if (typeof detail === 'string') {
            errorMessage = detail
          } else {
            errorMessage = `请求失败 (${status})`
          }
        } else if (data && typeof data === 'object' && 'message' in data) {
          errorMessage = (data as any).message
        } else {
          errorMessage = `请求失败 (${status})`
        }
      } else if (error.request) {
        // 请求已发送但没有收到响应
        errorMessage = '网络连接失败，请检查网络'
      } else {
        // 其他错误
        errorMessage = error.message || '请求失败'
      }

      return Promise.reject(new Error(errorMessage))
    }
  )

  return instance
}

// 导出默认客户端实例
export const apiClient = createAxiosInstance()

// 导出默认实例（兼容旧代码）
export default apiClient

