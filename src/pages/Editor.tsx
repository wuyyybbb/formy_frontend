import { Link, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ModeTabs from '../components/editor/ModeTabs'
import ControlPanel from '../components/editor/ControlPanel'
import PreviewPanel from '../components/editor/PreviewPanel'
import MobilePreview from '../components/editor/MobilePreview'
import MobileControls from '../components/editor/MobileControls'
import HistorySidebar from '../components/editor/HistorySidebar'
import UserMenu from '../components/header/UserMenu'
import LoginModal from '../components/auth/LoginModal'
import { UploadResult } from '../components/editor/UploadArea'
import { createTask, EditMode as ApiEditMode, TaskStatus, TaskInfo, TaskError } from '../api/tasks'
import { useTaskPolling } from '../hooks/useTaskPolling'
import { getImageUrl } from '../api/upload'
import { formatErrorDisplay, isRetryableError } from '../utils/errorMessages'
import { isLoggedIn } from '../api/auth'

export type EditMode = 'HEAD_SWAP' | 'BACKGROUND_CHANGE' | 'POSE_CHANGE'

export default function Editor() {
  const [searchParams] = useSearchParams()
  const modeFromUrl = searchParams.get('mode') as EditMode | null
  const [currentMode, setCurrentMode] = useState<EditMode>(modeFromUrl || 'HEAD_SWAP')
  
  // 当 URL 参数变化时更新模式
  useEffect(() => {
    if (modeFromUrl && (modeFromUrl === 'HEAD_SWAP' || modeFromUrl === 'BACKGROUND_CHANGE' || modeFromUrl === 'POSE_CHANGE')) {
      setCurrentMode(modeFromUrl)
    }
  }, [modeFromUrl])
  
  // 🔄 当模式切换时，清空所有状态
  useEffect(() => {
    console.log('🔄 模式切换，清空所有状态:', currentMode)
    
    // 如果正在处理中，先取消当前任务
    if (isProcessing && currentTaskId) {
      console.log('⚠️  检测到任务正在处理中，切换模式将停止轮询')
      // 轮询会自动停止（因为 currentTaskId 会被清空）
    }
    
    // 1. 清空上传的图片
    setSourceImage(null)
    setSourceFileId(null)
    setReferenceImage(null)
    setReferenceFileId(null)
    
    // 2. 清空生成结果
    setResultImage(null)
    setComparisonImage(null)
    
    // 3. 重置任务状态
    setCurrentTaskId(null)
    setIsProcessing(false)
    setTaskStatus(null)
    setProgress(0)
    setCurrentStep(null)
    setTaskError(null)
    setProcessingTime(undefined)
    
    console.log('✅ 状态已清空，准备开始新模式')
  }, [currentMode])
  
  // 图片 URL（用于显示）
  const [sourceImage, setSourceImage] = useState<string | null>(null)
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [comparisonImage, setComparisonImage] = useState<string | null>(null)
  
  // 图片 file_id（用于创建任务）
  const [sourceFileId, setSourceFileId] = useState<string | null>(null)
  const [referenceFileId, setReferenceFileId] = useState<string | null>(null)
  
  // 任务状态
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [_taskStatus, setTaskStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const [taskError, setTaskError] = useState<TaskError | null>(null)
  const [processingTime, setProcessingTime] = useState<number | undefined>(undefined)
  const [historyKey, setHistoryKey] = useState(0) // 用于触发历史记录刷新
  const [showLoginModal, setShowLoginModal] = useState(false) // 控制登录弹窗
  
  // 处理原图上传
  const handleSourceUpload = (result: UploadResult | null) => {
    if (result) {
      setSourceImage(result.imageUrl)
      setSourceFileId(result.fileId)
    } else {
      setSourceImage(null)
      setSourceFileId(null)
    }
  }
  
  // 处理参考图上传
  const handleReferenceUpload = (result: UploadResult | null) => {
    if (result) {
      setReferenceImage(result.imageUrl)
      setReferenceFileId(result.fileId)
    } else {
      setReferenceImage(null)
      setReferenceFileId(null)
    }
  }
  
  // 轮询任务状态
  useTaskPolling({
    taskId: currentTaskId,
    enabled: isProcessing && currentTaskId !== null,
    interval: 2500, // 2.5 秒轮询一次
    onUpdate: (taskInfo: TaskInfo) => {
      // 更新任务状态
      setTaskStatus(taskInfo.status)
      setProgress(taskInfo.progress)
      setCurrentStep(taskInfo.current_step || null)
      
      console.log('任务状态更新:', {
        task_id: taskInfo.task_id,
        status: taskInfo.status,
        progress: taskInfo.progress,
        current_step: taskInfo.current_step
      })
    },
    onComplete: (taskInfo: TaskInfo) => {
      // 任务完成
      console.log('✅ Task completed:', taskInfo)
      setIsProcessing(false)
      setTaskStatus(TaskStatus.DONE)
      setProcessingTime(taskInfo.processing_time)
      
      // 同时设置处理结果和对比图片
      if (taskInfo.result?.output_image) {
        const resultUrl = getImageUrl(taskInfo.result.output_image, true) // 强制刷新缓存
        setResultImage(resultUrl)
      } else {
        setResultImage(null)
      }
      
      if (taskInfo.result?.comparison_image) {
        const comparisonUrl = getImageUrl(taskInfo.result.comparison_image, true) // 强制刷新缓存
        setComparisonImage(comparisonUrl)
      } else {
        setComparisonImage(null)
      }
      
      // 刷新历史记录
      setHistoryKey(prev => prev + 1)
    },
    onError: (taskInfo: TaskInfo) => {
      // 任务失败
      console.error('❌ 任务失败:', taskInfo)
      setIsProcessing(false)
      setTaskStatus(TaskStatus.FAILED)
      
      // 保存完整的错误对象
      const error = taskInfo.error
      setTaskError(error || null)
      
      // 使用统一的错误消息格式化
      const formattedError = formatErrorDisplay(
        error?.code,
        error?.message,
        error?.details
      )
      
      // 记录详细信息到控制台
      if (error) {
        console.error('错误码:', error.code)
        console.error('错误消息:', error.message)
        if (error.details) {
          console.error('错误详情:', error.details)
        }
      }
      
      // 构建用户友好的提示信息
      let alertMessage = `❌ ${formattedError.title}\n\n${formattedError.message}`
      
      // 添加建议
      if (formattedError.suggestion) {
        alertMessage += `\n\n💡 建议：${formattedError.suggestion}`
      }
      
      // 添加重试提示
      if (error?.code && isRetryableError(error.code)) {
        alertMessage += '\n\n⚠️ 这是一个临时错误，建议稍后重试'
      }
      
      // 弹窗显示错误
      alert(alertMessage)
    }
  })
  
  // 处理生成按钮点击
  const handleGenerate = async () => {
    // 0. 检查用户是否已登录
    if (!isLoggedIn()) {
      setShowLoginModal(true)
      return
    }
    
    // 1. 验证必要的图片已上传
    if (!sourceFileId) {
      alert('请先上传原始图片')
      return
    }
    
    // 2. 根据模式验证是否需要参考图
    if ((currentMode === 'HEAD_SWAP' || currentMode === 'POSE_CHANGE' || currentMode === 'BACKGROUND_CHANGE') && !referenceFileId) {
      const imageTypeName = currentMode === 'BACKGROUND_CHANGE' ? '背景图片' : '参考图片'
      alert(`此模式需要上传${imageTypeName}`)
      return
    }
    
    // 3. 重置状态
    setResultImage(null)
    setTaskError(null)
    setProgress(0)
    setCurrentStep(null)
    
    // 4. 组装请求体
    const config: Record<string, any> = {}
    
    // 根据不同模式添加配置
    if (currentMode === 'HEAD_SWAP' && referenceFileId) {
      config.target_face_image = referenceFileId
    } else if (currentMode === 'BACKGROUND_CHANGE' && referenceFileId) {
      config.background_image = referenceFileId
    } else if (currentMode === 'POSE_CHANGE' && referenceFileId) {
      config.pose_image = referenceFileId
    }
    
    try {
      setIsProcessing(true)
      setTaskStatus(TaskStatus.PENDING)
      
      // 5. 发送创建任务请求
      const taskInfo = await createTask({
        mode: currentMode as ApiEditMode,
        source_image: sourceFileId,
        config
      })
      
      // 6. 记住 task_id，轮询会自动开始
      setCurrentTaskId(taskInfo.task_id)
      setTaskStatus(taskInfo.status)
      
      console.log('任务创建成功，开始轮询:', taskInfo)
      
    } catch (error) {
      console.error('创建任务失败:', error)
      
      // 提取错误信息
      let errorMsg = '未知错误'
      if (error instanceof Error) {
        errorMsg = error.message
      } else if (typeof error === 'string') {
        errorMsg = error
      } else if (error && typeof error === 'object') {
        // 尝试从对象中提取错误信息
        const err = error as any
        errorMsg = err.message || err.error || JSON.stringify(error)
      }
      
      alert('创建任务失败:\n' + errorMsg)
      setIsProcessing(false)
      setTaskStatus(TaskStatus.FAILED)
      setCurrentTaskId(null)
    }
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col">
      {/* Header */}
      <header className="border-b border-dark-border backdrop-blur-sm flex-shrink-0 z-10">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            {/* 左侧：Logo */}
            <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-base flex-shrink-0">
              <div className="w-8 h-8 bg-primary rounded-sm"></div>
              <span className="text-xl font-bold">Formy</span>
            </Link>
            
            {/* 中间：Mode Tabs */}
            <div className="hidden md:flex flex-1 justify-center">
              <ModeTabs currentMode={currentMode} onModeChange={setCurrentMode} />
            </div>

            {/* 右侧：User Menu */}
            <div className="flex-shrink-0">
              <UserMenu />
            </div>
          </div>

          {/* Mobile Mode Tabs */}
          <div className="md:hidden mt-4">
            <ModeTabs currentMode={currentMode} onModeChange={setCurrentMode} />
          </div>
        </div>
      </header>

      {/* Main Content - Desktop Layout */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Left Control Panel */}
        <div className="w-96 flex-shrink-0 border-r border-dark-border overflow-y-auto">
          <ControlPanel
            mode={currentMode}
            sourceImage={sourceImage}
            referenceImage={referenceImage}
            onSourceImageChange={handleSourceUpload}
            onReferenceImageChange={handleReferenceUpload}
            onGenerate={handleGenerate}
            isProcessing={isProcessing}
          />
        </div>

        {/* Right Preview Panel */}
        <div className="flex-1 overflow-hidden">
          <PreviewPanel
            resultImage={resultImage}
            comparisonImage={comparisonImage}
            sourceImage={sourceImage}
            referenceImage={referenceImage}
            mode={currentMode}
            isProcessing={isProcessing}
            progress={progress}
            currentStep={currentStep}
            taskStatus={_taskStatus}
            error={taskError}
            processingTime={processingTime}
          />
        </div>

        {/* History Sidebar */}
        <HistorySidebar
          key={historyKey}
          currentMode={currentMode}
          onSelectTask={(task) => {
            // 点击历史任务时，恢复完整的任务状态（输入图片 + 输出结果）
            console.log('📋 恢复历史任务:', task.task_id)
            
            // 1. 恢复输入图片（左侧上传框）
            if (task.source_image) {
              // 根据 file_id 构建图片 URL
              const sourceUrl = getImageUrl(`/source/${task.source_image}`)
              setSourceImage(sourceUrl)
              setSourceFileId(task.source_image)
              console.log('✅ 恢复原始图片:', task.source_image)
            }
            
            // 2. 恢复参考图片（如果有）
            if (task.reference_image) {
              // 根据模式判断是哪种参考图
              const referenceUrl = getImageUrl(`/reference/${task.reference_image}`)
              setReferenceImage(referenceUrl)
              setReferenceFileId(task.reference_image)
              console.log('✅ 恢复参考图片:', task.reference_image)
            }
            
            // 3. 恢复输出结果（右侧预览）
            if (task.result?.output_image) {
              const resultUrl = getImageUrl(task.result.output_image, true)
              setResultImage(resultUrl)
            }
            if (task.result?.comparison_image) {
              const comparisonUrl = getImageUrl(task.result.comparison_image, true)
              setComparisonImage(comparisonUrl)
            }
            
            // 4. 恢复任务状态
            setCurrentTaskId(task.task_id)
            setTaskStatus(task.status)
            setProgress(task.progress)
            setCurrentStep(task.current_step || null)
            if (task.error) {
              setTaskError(task.error)
            } else {
              setTaskError(null)
            }
            setProcessingTime(task.processing_time)
            
            console.log('✅ 历史任务状态已恢复')
          }}
          onRetryTask={(task) => {
            // 重试失败的任务
            console.log('🔄 重试任务:', task.task_id)
            
            // 恢复任务的原始输入
            if (task.source_image) {
              // 如果有 source_image，尝试恢复图片显示
              // 注意：这里需要从 task 数据中获取图片信息
              console.log('恢复原图:', task.source_image)
            }
            
            // 根据任务配置恢复参考图
            if (task.config) {
              const config = task.config as Record<string, unknown>
              if (config.pose_image || config.reference_image || config.target_face_image) {
                const refImage = config.pose_image || config.reference_image || config.target_face_image
                console.log('恢复参考图:', refImage)
              }
            }
            
            // 提示用户
            if (confirm('确认重试此任务？\n\n系统会使用相同的图片和配置重新生成，不会额外扣除积分。')) {
              // 使用相同的配置创建新任务
              handleGenerate()
              
              // 刷新历史记录（在任务完成后）
              setTimeout(() => {
                setHistoryKey(prev => prev + 1)
              }, 1000)
            }
          }}
        />
      </div>

      {/* Main Content - Mobile Layout */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        {/* Top Preview */}
        <div className="flex-1 overflow-hidden">
          <MobilePreview
            resultImage={resultImage}
            comparisonImage={comparisonImage}
            isProcessing={isProcessing}
            progress={progress}
            currentStep={currentStep}
          />
        </div>

        {/* Bottom Controls */}
        <div className="flex-shrink-0 border-t border-dark-border">
          <MobileControls
            mode={currentMode}
            sourceImage={sourceImage}
            referenceImage={referenceImage}
            onSourceImageChange={handleSourceUpload}
            onReferenceImageChange={handleReferenceUpload}
            onGenerate={handleGenerate}
            isProcessing={isProcessing}
          />
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={() => {
            setShowLoginModal(false)
            // 登录成功后自动触发生成
            setTimeout(() => {
              handleGenerate()
            }, 100)
          }}
        />
      )}
    </div>
  )
}

