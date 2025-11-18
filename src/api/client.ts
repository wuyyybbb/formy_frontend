/**
 * HTTP 客户端封装 - 基于 Axios
 */
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'

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
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // 请求拦截器
  instance.interceptors.request.use(
    (config) => {
      // 可以在这里添加 token 等认证信息
      // const token = localStorage.getItem('auth_token')
      // if (token) {
      //   config.headers.Authorization = `Bearer ${token}`
      // }
      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // 响应拦截器
  instance.interceptors.response.use(
    (response) => {
      // 直接返回 data，简化调用
      return response.data
    },
    (error: AxiosError) => {
      // 统一错误处理
      let errorMessage = '请求失败，请稍后重试'

      if (error.response) {
        // 服务器返回了错误状态码
        const { status, data } = error.response
        
        if (data && typeof data === 'object' && 'detail' in data) {
          errorMessage = (data as any).detail
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

