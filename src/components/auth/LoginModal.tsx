import { useState, useEffect } from 'react'
import { sendVerificationCode, loginWithCode, saveAuthInfo } from '../../api/auth'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess?: () => void
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')

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
    setStep('email')
    setError('')
    setCountdown(0)
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
      console.log('验证码发送成功:', result)
      
      setStep('code')
      setCountdown(60) // 60 秒倒计时
    } catch (err) {
      console.error('发送验证码失败:', err)
      setError(err instanceof Error ? err.message : '发送失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 登录
  const handleLogin = async () => {
    if (!code || code.length !== 6) {
      setError('请输入6位验证码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await loginWithCode(email, code)
      console.log('登录成功:', result)
      
      // 保存认证信息
      saveAuthInfo(result.access_token, result.user)
      
      // 关闭弹窗
      handleClose()
      
      // 回调
      onLoginSuccess?.()
    } catch (err) {
      console.error('登录失败:', err)
      setError(err instanceof Error ? err.message : '登录失败，请检查验证码')
    } finally {
      setLoading(false)
    }
  }

  // 返回上一步
  const handleBack = () => {
    setStep('email')
    setCode('')
    setError('')
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
            {step === 'email' ? '登录 Formy' : '输入验证码'}
          </h2>
          <p className="text-text-secondary text-center mb-8">
            {step === 'email' 
              ? '使用邮箱验证码登录'
              : `验证码已发送到 ${email}`
            }
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
              <div>
                <label className="block text-sm font-medium mb-2">邮箱地址</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendCode()}
                  placeholder="your@email.com"
                  className="input w-full"
                  disabled={loading}
                />
              </div>

              <button
                onClick={handleSendCode}
                disabled={loading || !email}
                className="btn-primary w-full py-3"
              >
                {loading ? '发送中...' : '发送验证码'}
              </button>
            </div>
          )}

          {/* 输入验证码 */}
          {step === 'code' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">验证码</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setCode(value)
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="请输入6位验证码"
                  className="input w-full text-center text-2xl tracking-widest"
                  maxLength={6}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <button
                onClick={handleLogin}
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

