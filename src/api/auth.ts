/**
 * 认证相关 API
 */
import apiClient from './client'

// ==================== 接口定义 ====================

/**
 * 发送验证码请求
 */
export interface SendCodeRequest {
  email: string
}

/**
 * 发送验证码响应
 */
export interface SendCodeResponse {
  success: boolean
  message: string
  expires_in: number // 秒
}

/**
 * 登录请求
 */
export interface LoginRequest {
  email: string
  code: string // 6位数字
}

/**
 * 用户信息
 */
export interface UserInfo {
  user_id: string
  email: string
  username?: string
  avatar?: string
  created_at: string
  last_login?: string
}

/**
 * 登录响应
 */
export interface LoginResponse {
  access_token: string
  token_type: string
  user: UserInfo
}

/**
 * 当前用户响应
 */
export interface CurrentUserResponse {
  user: UserInfo
}

// ==================== API 函数 ====================

/**
 * 发送验证码到邮箱
 * @param email - 邮箱地址
 * @returns 发送结果
 */
export async function sendVerificationCode(email: string): Promise<SendCodeResponse> {
  return await apiClient.post<SendCodeResponse>('/auth/send-code', { email })
}

/**
 * 使用验证码登录
 * @param email - 邮箱地址
 * @param code - 6位验证码
 * @returns 登录结果（包含 token 和用户信息）
 */
export async function loginWithCode(email: string, code: string): Promise<LoginResponse> {
  return await apiClient.post<LoginResponse>('/auth/login', { email, code })
}

/**
 * 获取当前用户信息
 * @returns 用户信息
 */
export async function getCurrentUser(): Promise<CurrentUserResponse> {
  return await apiClient.get<CurrentUserResponse>('/auth/me')
}

// ==================== 本地存储工具 ====================

const TOKEN_KEY = 'formy_auth_token'
const USER_KEY = 'formy_user_info'

/**
 * 保存认证信息到本地
 */
export function saveAuthInfo(token: string, user: UserInfo): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  
  // 设置 axios 默认 header
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

/**
 * 获取保存的 token
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * 获取保存的用户信息
 */
export function getUserInfo(): UserInfo | null {
  const userStr = localStorage.getItem(USER_KEY)
  if (!userStr) return null
  
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

/**
 * 清除认证信息（登出）
 */
export function clearAuthInfo(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  delete apiClient.defaults.headers.common['Authorization']
}

/**
 * 检查是否已登录
 */
export function isLoggedIn(): boolean {
  return !!getToken()
}

/**
 * 初始化认证状态（从本地存储恢复）
 */
export function initAuth(): void {
  const token = getToken()
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }
}

// 页面加载时初始化
initAuth()

