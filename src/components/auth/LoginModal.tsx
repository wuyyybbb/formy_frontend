import { useState, useEffect } from 'react'
import { sendVerificationCode, loginWithCode, setPassword, loginWithPassword, saveAuthInfo } from '../../api/auth'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess?: () => void
}

// 📧 邮箱记忆功能 - localStorage key
const REMEMBERED_EMAIL_KEY = 'formy_remembered_email'

type LoginMode = 'code' | 'password' // 验证码登录 or 密码登录
type Step = 'email' | 'code' | 'set-password' | 'password'

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  // 从 localStorage 读取上次使用的邮箱
  const [email, setEmail] = useState(() => {
    const remembered = localStorage.getItem(REMEMBERED_EMAIL_KEY)
    return remembered || ''
  })
  const [code, setCode] = useState('')
  const [password, setPasswordValue] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loginMode, setLoginMode] = useState<LoginMode>('code') // 默认验证码登录
  const [step, setStep] = useState<Step>('email')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false) // 是否显示密码
  const [showConfirmPassword, setShowConfirmPassword] = useState(false) // 是否显示确认密码

  // 倒计时逻辑
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 重置状态
  const resetState = () => {
    setEmail('')
    setCode('')
    setPasswordValue('')
    setConfirmPassword('')
    setStep('email')
    setLoginMode('code')
    setError('')
    setCountdown(0)
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  // 关闭弹窗
  const handleClose = () => {
    resetState()
    onClose()
  }

  // 发送验证码
  const handleSendCode = async () => {
    if (!email) {
      setError('请输入邮箱地址')
      return
    }

    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('请输入有效的邮箱地址')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await sendVerificationCode(email)
      console.log('✅ 验证码发送成功:', result)
      
      // 💾 保存邮箱地址到本地，下次自动填充
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email)
      
      setStep('code')
      setCountdown(60) // 60 秒倒计时
    } catch (err: any) {
      console.error('❌ 发送验证码失败:', err)
      
      // 更友好的错误提示
      let errorMessage = '发送失败，请稍后重试'
      if (err.response) {
        errorMessage = err.response.data?.detail || errorMessage
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // 验证码登录
  const handleLoginWithCode = async () => {
    if (!code || code.length !== 6) {
      setError('请输入6位验证码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await loginWithCode(email, code)
      console.log('验证码登录成功:', result)
      
      // 保存认证信息
      saveAuthInfo(result.access_token, result.user)
      
      // 检查用户是否设置了密码，如果没有则提示设置
      // 注意：这里假设后端返回用户信息中包含 has_password 字段
      // 如果没有，可以直接跳过此步骤
      if (!(result.user as any).has_password) {
        // 显示设置密码界面
        setStep('set-password')
      } else {
        // 关闭弹窗
        handleClose()
        // 回调
        onLoginSuccess?.()
      }
    } catch (err) {
      console.error('登录失败:', err)
      setError(err instanceof Error ? err.message : '登录失败，请检查验证码')
    } finally {
      setLoading(false)
    }
  }

  // 设置密码
  const handleSetPassword = async () => {
    // 清空之前的错误
    setError('')

    // 验证密码长度
    if (!password) {
      setError('请输入密码')
      return
    }

    if (password.length < 6) {
      setError('密码至少需要 6 位字符')
      return
    }

    if (password.length > 50) {
      setError('密码不能超过 50 位字符')
      return
    }

    // 验证确认密码
    if (!confirmPassword) {
      setError('请再次输入密码以确认')
      return
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致，请检查后重新输入')
      return
    }

    setLoading(true)

    try {
      await setPassword(email, code, password)
      console.log('✅ 密码设置成功')
      
      // 关闭弹窗
      handleClose()
      // 回调
      onLoginSuccess?.()
    } catch (err: any) {
      console.error('❌ 设置密码失败:', err)
      
      // 更详细的错误提示
      let errorMessage = '设置密码失败，请稍后重试'
      
      if (err.response) {
        const detail = err.response.data?.detail
        if (detail) {
          if (detail.includes('验证码')) {
            errorMessage = '验证码已过期或无效，请重新获取验证码'
          } else if (detail.includes('密码')) {
            errorMessage = detail
          } else {
            errorMessage = detail
          }
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // 跳过设置密码
  const handleSkipSetPassword = () => {
    handleClose()
    onLoginSuccess?.()
  }

  // 密码登录
  const handleLoginWithPassword = async () => {
    if (!password || password.length < 6) {
      setError('请输入密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await loginWithPassword(email, password)
      console.log('密码登录成功:', result)
      
      // 保存认证信息
      saveAuthInfo(result.access_token, result.user)
      
      // 关闭弹窗
      handleClose()
      
      // 回调
      onLoginSuccess?.()
    } catch (err: any) {
      console.error('密码登录失败:', err)
      setError(err.response?.data?.detail || '邮箱或密码错误')
    } finally {
      setLoading(false)
    }
  }

  // 切换登录模式
  const handleSwitchMode = (mode: LoginMode) => {
    setLoginMode(mode)
    setError('')
    setPasswordValue('')
    setConfirmPassword('')
    setCode('')
    
    if (mode === 'code') {
      setStep('email')
    } else {
      setStep('password')
    }
  }

  // 返回上一步
  const handleBack = () => {
    if (step === 'code' || step === 'password') {
      setStep('email')
      setCode('')
      setPasswordValue('')
      setError('')
    } else if (step === 'set-password') {
      // 从设置密码返回，直接关闭并调用成功回调
      handleSkipSetPassword()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-dark/80 backdrop-blur-sm"
        onClick={handleClose}
      ></div>

      {/* 弹窗内容 */}
      <div className="relative w-full max-w-md">
        <div className="card bg-dark-card border-primary/20 p-8">
          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary transition-base"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
              <span className="text-dark font-bold text-2xl">F</span>
            </div>
          </div>

          {/* 标题 */}
          <h2 className="title-h2 text-center mb-2">
            {step === 'email' && '登录 Formy'}
            {step === 'code' && '输入验证码'}
            {step === 'set-password' && '设置密码'}
            {step === 'password' && '密码登录'}
          </h2>
          <p className="text-text-secondary text-center mb-8">
            {step === 'email' && `使用邮箱${loginMode === 'code' ? '验证码' : '密码'}登录`}
            {step === 'code' && `验证码已发送到 ${email}`}
            {step === 'set-password' && '为您的账号设置密码，下次可快速登录'}
            {step === 'password' && '输入您的密码'}
          </p>

          {/* 错误提示 */}
          {error && (
            <div className="mb-6 p-3 bg-accent/10 border border-accent/30 rounded-sm text-accent text-sm">
              {error}
            </div>
          )}

          {/* 输入邮箱 */}
          {step === 'email' && (
            <div className="space-y-6">
              {/* 登录模式切换 */}
              <div className="flex gap-2 p-1 bg-dark-border/30 rounded-sm">
                <button
                  onClick={() => handleSwitchMode('code')}
                  className={`flex-1 py-2 px-4 rounded-sm text-sm font-medium transition-base ${
                    loginMode === 'code'
                      ? 'bg-primary text-dark'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  验证码登录
                </button>
                <button
                  onClick={() => handleSwitchMode('password')}
                  className={`flex-1 py-2 px-4 rounded-sm text-sm font-medium transition-base ${
                    loginMode === 'password'
                      ? 'bg-primary text-dark'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  密码登录
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">邮箱地址</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (loginMode === 'code' ? handleSendCode() : setStep('password'))}
                  placeholder="your@email.com"
                  className="input w-full"
                  disabled={loading}
                />
              </div>

              <button
                onClick={() => loginMode === 'code' ? handleSendCode() : setStep('password')}
                disabled={loading || !email}
                className="btn-primary w-full py-3"
              >
                {loading ? '处理中...' : loginMode === 'code' ? '发送验证码' : '下一步'}
              </button>
            </div>
          )}

          {/* 输入验证码 */}
          {step === 'code' && (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">验证码</label>
                  <span className="text-xs text-text-tertiary">
                    {code.length}/6
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setCode(value)
                    // 自动提交：输入满 6 位后自动登录
                    if (value.length === 6) {
                      setTimeout(() => {
                        const btn = document.getElementById('login-btn')
                        btn?.click()
                      }, 300)
                    }
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleLoginWithCode()}
                  onPaste={(e) => {
                    // 支持粘贴验证码
                    e.preventDefault()
                    const paste = e.clipboardData.getData('text')
                    const value = paste.replace(/\D/g, '').slice(0, 6)
                    setCode(value)
                    if (value.length === 6) {
                      setTimeout(() => {
                        const btn = document.getElementById('login-btn')
                        btn?.click()
                      }, 300)
                    }
                  }}
                  placeholder="请输入6位验证码"
                  className="input w-full text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                  disabled={loading}
                  autoFocus
                  autoComplete="one-time-code"
                />
                <p className="text-xs text-text-tertiary mt-2 text-center">
                  💡 提示：输入完成后会自动登录
                </p>
              </div>

              <button
                id="login-btn"
                onClick={handleLoginWithCode}
                disabled={loading || code.length !== 6}
                className="btn-primary w-full py-3"
              >
                {loading ? '登录中...' : '登录'}
              </button>

              <div className="flex justify-between items-center text-sm">
                <button
                  onClick={handleBack}
                  className="text-text-secondary hover:text-primary transition-base"
                  disabled={loading}
                >
                  ← 返回
                </button>

                <button
                  onClick={handleSendCode}
                  disabled={countdown > 0 || loading}
                  className={`
                    ${countdown > 0 
                      ? 'text-text-tertiary cursor-not-allowed' 
                      : 'text-primary hover:text-primary/80'
                    }
                    transition-base
                  `}
                >
                  {countdown > 0 ? `${countdown}秒后重新发送` : '重新发送'}
                </button>
              </div>
            </div>
          )}

          {/* 设置密码 */}
          {step === 'set-password' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">设置密码</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPasswordValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSetPassword()}
                    placeholder="至少6位字符"
                    className="input w-full pr-10"
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-base"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      // 眼睛打开图标（显示密码）
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      // 眼睛关闭图标（隐藏密码）
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-text-tertiary mt-1">
                  {password && password.length < 6 && `还需要 ${6 - password.length} 个字符`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">确认密码</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSetPassword()}
                    placeholder="再次输入密码"
                    className="input w-full pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-base"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      // 眼睛打开图标
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      // 眼睛关闭图标
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-text-tertiary mt-1">
                  {confirmPassword && password && confirmPassword !== password && '两次密码不一致'}
                  {confirmPassword && password && confirmPassword === password && '✓ 密码一致'}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleSetPassword}
                  disabled={loading || !password || password.length < 6}
                  className="btn-primary w-full py-3"
                >
                  {loading ? '设置中...' : '设置密码'}
                </button>

                <button
                  onClick={handleSkipSetPassword}
                  disabled={loading}
                  className="btn-secondary w-full py-3"
                >
                  暂时跳过
                </button>
              </div>

              <p className="text-xs text-text-tertiary text-center">
                💡 设置密码后，下次可使用邮箱+密码快速登录
              </p>
            </div>
          )}

          {/* 密码登录 */}
          {step === 'password' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">密码</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPasswordValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLoginWithPassword()}
                    placeholder="请输入密码"
                    className="input w-full pr-10"
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-base"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      // 眼睛打开图标
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      // 眼睛关闭图标
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={handleLoginWithPassword}
                disabled={loading || !password}
                className="btn-primary w-full py-3"
              >
                {loading ? '登录中...' : '登录'}
              </button>

              <div className="flex justify-between items-center text-sm">
                <button
                  onClick={handleBack}
                  className="text-text-secondary hover:text-primary transition-base"
                  disabled={loading}
                >
                  ← 返回
                </button>

                <button
                  onClick={() => {
                    setLoginMode('code')
                    setStep('email')
                    setPasswordValue('')
                  }}
                  className="text-primary hover:text-primary/80 transition-base"
                  disabled={loading}
                >
                  使用验证码登录
                </button>
              </div>
            </div>
          )}

          {/* 提示信息 */}
          <div className="mt-8 pt-6 border-t border-dark-border">
            <p className="text-text-tertiary text-xs text-center">
              登录即表示您同意我们的<br />
              <a href="#" className="text-primary hover:underline">服务条款</a>
              {' '}和{' '}
              <a href="#" className="text-primary hover:underline">隐私政策</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
