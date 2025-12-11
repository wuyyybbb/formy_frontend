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
  
  // 🗂️ 为每个模式单独保存图片状态
  const [modeImages, setModeImages] = useState<Record<EditMode, {
    sourceImage: string | null
    sourceFileId: string | null
    referenceImage: string | null
    referenceFileId: string | null
  }>>({
    HEAD_SWAP: { sourceImage: null, sourceFileId: null, referenceImage: null, referenceFileId: null },
    BACKGROUND_CHANGE: { sourceImage: null, sourceFileId: null, referenceImage: null, referenceFileId: null },
    POSE_CHANGE: { sourceImage: null, sourceFileId: null, referenceImage: null, referenceFileId: null }
  })
  
  // 当前模式的图片状态（方便访问）
  const sourceImage = modeImages[currentMode].sourceImage
  const sourceFileId = modeImages[currentMode].sourceFileId
  const referenceImage = modeImages[currentMode].referenceImage
  const referenceFileId = modeImages[currentMode].referenceFileId
  
  // 结果图片（所有模式共享，但切换时会清空）
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [comparisonImage, setComparisonImage] = useState<string | null>(null)
  
  // 任务状态
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [taskMode, setTaskMode] = useState<EditMode | null>(null) // 记录任务所属的模式
  const [isProcessing, setIsProcessing] = useState(false)
  const [_taskStatus, setTaskStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const [taskError, setTaskError] = useState<TaskError | null>(null)
  const [processingTime, setProcessingTime] = useState<number | undefined>(undefined)
  const [historyKey, setHistoryKey] = useState(0) // 用于触发历史记录刷新
  const [showLoginModal, setShowLoginModal] = useState(false) // 控制登录弹窗
  
  // 🔄 当模式切换时的处理
  useEffect(() => {
    console.log('🔄 模式切换到:', currentMode)
    
    // 策略 A：为每个模式保留各自的输入图片，但清空结果和任务状态显示
    // 1. 输入图片会自动恢复（因为 modeImages[currentMode] 会切换到对应模式的图片）
    // 2. 清空结果图片，因为结果属于旧模式
    // 3. 如果当前有任务在运行，且任务模式不是当前模式，则隐藏任务进度
    
    setResultImage(null)
    setComparisonImage(null)
    setTaskError(null)
    setProcessingTime(undefined)
    
    // 如果有任务在运行，但任务模式不匹配当前模式，则隐藏进度显示
    if (isProcessing && taskMode && taskMode !== currentMode) {
      // 任务在后台继续运行，但不显示进度
      setProgress(0)
      setCurrentStep(null)
      console.log(`⚠️ 任务 ${taskMode} 在后台运行，当前切换到 ${currentMode}，隐藏进度显示`)
    }
    
    console.log('✅ 已切换到模式:', currentMode, '输入图片已恢复')
  }, [currentMode, isProcessing, taskMode])
  
  // 处理原图上传
  const handleSourceUpload = (result: UploadResult | null) => {
    setModeImages(prev => ({
      ...prev,
      [currentMode]: {
        ...prev[currentMode],
        sourceImage: result?.imageUrl || null,
        sourceFileId: result?.fileId || null
      }
    }))
  }
  
  // 处理参考图上传
  const handleReferenceUpload = (result: UploadResult | null) => {
    setModeImages(prev => ({
      ...prev,
      [currentMode]: {
        ...prev[currentMode],
        referenceImage: result?.imageUrl || null,
        referenceFileId: result?.fileId || null
      }
    }))
  }
  
  // 轮询任务状态
  useTaskPolling({
    taskId: currentTaskId,
    enabled: isProcessing && currentTaskId !== null,
    interval: 2500, // 2.5 秒轮询一次
    onUpdate: (taskInfo: TaskInfo) => {
      // 只有当任务模式匹配当前模式时，才更新进度显示
      if (taskMode === currentMode) {
        setTaskStatus(taskInfo.status)
        setProgress(taskInfo.progress)
        setCurrentStep(taskInfo.current_step || null)
        
        console.log('任务状态更新:', {
          task_id: taskInfo.task_id,
          status: taskInfo.status,
          progress: taskInfo.progress,
          current_step: taskInfo.current_step
        })
      } else {
        console.log(`⏳ 任务 ${taskMode} 在后台运行，当前模式 ${currentMode}，不显示进度`)
      }
    },
    onComplete: (taskInfo: TaskInfo) => {
      // 任务完成
      console.log('✅ Task completed:', taskInfo)
      setIsProcessing(false)
      setTaskStatus(TaskStatus.DONE)
      setProcessingTime(taskInfo.processing_time)
      
      // 只有当任务模式匹配当前模式时，才显示结果
      if (taskMode === currentMode) {
        if (taskInfo.result?.output_image) {
          const resultUrl = getImageUrl(taskInfo.result.output_image, true)
          setResultImage(resultUrl)
        } else {
          setResultImage(null)
        }
        
        if (taskInfo.result?.comparison_image) {
          const comparisonUrl = getImageUrl(taskInfo.result.comparison_image, true)
          setComparisonImage(comparisonUrl)
        } else {
          setComparisonImage(null)
        }
        console.log('✅ 结果已显示在当前模式:', currentMode)
      } else {
        console.log(`⚠️ 任务 ${taskMode} 完成，但当前在 ${currentMode} 模式，不显示结果`)
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
    
    // 1. 检查是否有任务正在运行
    if (isProcessing && currentTaskId) {
      // 获取当前正在运行的任务模式
      const modeNames: Record<string, string> = {
        'HEAD_SWAP': '换头',
        'BACKGROUND_CHANGE': '换背景',
        'POSE_CHANGE': '换姿势'
      }
      const currentModeName = modeNames[currentMode] || currentMode
      
      alert(
        `⏳ 当前有任务正在运行中...\n\n` +
        `正在执行：${currentModeName}\n\n` +
        `请等待任务完成后再创建新任务。\n\n` +
        `💡 提示：您可以在右侧历史记录中查看任务进度。`
      )
      return
    }
    
    // 2. 验证必要的图片已上传
    if (!sourceFileId) {
      alert('请先上传原始图片')
      return
    }
    
    // 3. 根据模式验证是否需要参考图
    if ((currentMode === 'HEAD_SWAP' || currentMode === 'POSE_CHANGE' || currentMode === 'BACKGROUND_CHANGE') && !referenceFileId) {
      const imageTypeName = currentMode === 'BACKGROUND_CHANGE' ? '背景图片' : '参考图片'
      alert(`此模式需要上传${imageTypeName}`)
      return
    }
    
    // 4. 重置状态
    setResultImage(null)
    setTaskError(null)
    setProgress(0)
    setCurrentStep(null)
    
    // 5. 组装请求体
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
      
      // 6. 发送创建任务请求
      const taskInfo = await createTask({
        mode: currentMode as ApiEditMode,
        source_image: sourceFileId,
        config
      })
      
      // 7. 记住 task_id 和任务模式，轮询会自动开始
      setCurrentTaskId(taskInfo.task_id)
      setTaskMode(currentMode)
      setTaskStatus(taskInfo.status)
      
      console.log('任务创建成功，开始轮询:', taskInfo, '模式:', currentMode)
      
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
            sourceImageUrl={sourceImage}
            referenceImageUrl={referenceImage}
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
          onSelectTask={async (task) => {
            // 点击历史任务时，先调用 API 获取完整任务详情
            console.log('📋 点击历史任务:', task.task_id)
            
            try {
              // 调用 GET /api/v1/tasks/{task_id} 获取完整任务详情
              const { getTask } = await import('../api/tasks')
              const taskDetail = await getTask(task.task_id)
              console.log('✅ 获取任务详情:', taskDetail)
              
              // 1. 恢复原始图片
              if (taskDetail.source_image) {
                // source_image 是 file_id，需要转换为完整 URL
                const sourceUrl = getImageUrl(`/uploads/source/${taskDetail.source_image}`)
                setSourceImage(sourceUrl)
                setSourceFileId(taskDetail.source_image)
                console.log('✅ 恢复原始图片:', sourceUrl)
              } else {
                setSourceImage(null)
                setSourceFileId(null)
              }
              
              // 2. 恢复参考图片（根据不同模式从不同字段获取）
              let referenceFileId: string | null = null
              
              // 优先从 reference_image 字段获取
              if (taskDetail.reference_image) {
                referenceFileId = taskDetail.reference_image
              }
              // 如果没有，从 config 中根据模式获取
              else if (taskDetail.config) {
                if (currentMode === 'BACKGROUND_CHANGE') {
                  // 换背景：从 background_image 或 bg_image 获取
                  referenceFileId = taskDetail.config.background_image || taskDetail.config.bg_image
                } else if (currentMode === 'HEAD_SWAP') {
                  // 换头：从 target_face_image 或 cloth_image 获取
                  referenceFileId = taskDetail.config.target_face_image || taskDetail.config.cloth_image || taskDetail.config.reference_image
                } else if (currentMode === 'POSE_CHANGE') {
                  // 换姿势：从 pose_image 或 pose_reference 获取
                  referenceFileId = taskDetail.config.pose_image || taskDetail.config.pose_reference || taskDetail.config.reference_image
                }
              }
              
              if (referenceFileId) {
                // 参考图片也是 file_id，需要转换为完整 URL
                const referenceUrl = getImageUrl(`/uploads/reference/${referenceFileId}`)
                setReferenceImage(referenceUrl)
                setReferenceFileId(referenceFileId)
                console.log('✅ 恢复参考图片:', referenceUrl)
              } else {
                setReferenceImage(null)
                setReferenceFileId(null)
                console.log('ℹ️  该任务没有参考图片')
              }
              
              // 3. 恢复输出结果（右侧预览）
              if (taskDetail.result?.output_image) {
                const resultUrl = getImageUrl(taskDetail.result.output_image, true)
                setResultImage(resultUrl)
                console.log('✅ 恢复结果图片:', resultUrl)
              } else {
                setResultImage(null)
              }
              
              if (taskDetail.result?.comparison_image) {
                const comparisonUrl = getImageUrl(taskDetail.result.comparison_image, true)
                setComparisonImage(comparisonUrl)
                console.log('✅ 恢复对比图片:', comparisonUrl)
              } else {
                setComparisonImage(null)
              }
              
              // 4. 恢复任务状态
              setCurrentTaskId(taskDetail.task_id)
              setTaskStatus(taskDetail.status)
              setProgress(taskDetail.progress)
              setCurrentStep(taskDetail.current_step || null)
              if (taskDetail.error) {
                setTaskError(taskDetail.error)
              } else {
                setTaskError(null)
              }
              if ((taskDetail as any).processing_time) {
                setProcessingTime((taskDetail as any).processing_time)
              }
              
              console.log('✅ 历史任务状态已完全恢复')
            } catch (error) {
              console.error('❌ 获取任务详情失败:', error)
              // 即使失败也尽量显示列表中的信息
              if (task.result?.output_image) {
                const resultUrl = getImageUrl(task.result.output_image, true)
                setResultImage(resultUrl)
              }
            }
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

