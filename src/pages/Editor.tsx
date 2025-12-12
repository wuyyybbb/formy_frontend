import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ModeTabs from '../components/editor/ModeTabs'
import ControlPanel from '../components/editor/ControlPanel'
import PreviewPanel from '../components/editor/PreviewPanel'
import MobilePreview from '../components/editor/MobilePreview'
import MobileControls from '../components/editor/MobileControls'
import HistorySidebar from '../components/editor/HistorySidebar'
import UserMenu from '../components/header/UserMenu'
import LoginModal from '../components/auth/LoginModal'
import { UploadResult } from '../components/editor/UploadArea'
import { createTask, EditMode as ApiEditMode, TaskError, TaskInfo, TaskStatus } from '../api/tasks'
import { useTaskPolling } from '../hooks/useTaskPolling'
import { getImageUrl } from '../api/upload'
import { formatErrorDisplay, isRetryableError } from '../utils/errorMessages'
import { isLoggedIn } from '../api/auth'

export type EditMode = 'HEAD_SWAP' | 'BACKGROUND_CHANGE' | 'POSE_CHANGE'

const STORAGE_KEY_PREFIX = 'formy-upload-state'
const TASK_STATE_KEY = 'formy-task-state'

export default function Editor() {
  const [searchParams] = useSearchParams()
  const modeFromUrl = searchParams.get('mode') as EditMode | null
  const [currentMode, setCurrentMode] = useState<EditMode>(modeFromUrl || 'HEAD_SWAP')

  // 上传状态（按模式）
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

  // 结果/状态缓存（按模式）
  const [modeResults, setModeResults] = useState<Record<EditMode, {
    resultImage: string | null
    comparisonImage: string | null
    taskStatus: string | null
    progress: number
    currentStep: string | null
    taskError: TaskError | null
    processingTime?: number
  }>>({
    HEAD_SWAP: { resultImage: null, comparisonImage: null, taskStatus: null, progress: 0, currentStep: null, taskError: null },
    BACKGROUND_CHANGE: { resultImage: null, comparisonImage: null, taskStatus: null, progress: 0, currentStep: null, taskError: null },
    POSE_CHANGE: { resultImage: null, comparisonImage: null, taskStatus: null, progress: 0, currentStep: null, taskError: null }
  })

  // 当前展示用状态
  const sourceImage = modeImages[currentMode].sourceImage
  const sourceFileId = modeImages[currentMode].sourceFileId
  const referenceImage = modeImages[currentMode].referenceImage
  const referenceFileId = modeImages[currentMode].referenceFileId

  const [resultImage, setResultImage] = useState<string | null>(modeResults[currentMode].resultImage)
  const [comparisonImage, setComparisonImage] = useState<string | null>(modeResults[currentMode].comparisonImage)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [taskMode, setTaskMode] = useState<EditMode | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [_taskStatus, setTaskStatus] = useState<string | null>(modeResults[currentMode].taskStatus)
  const [progress, setProgress] = useState(modeResults[currentMode].progress)
  const [currentStep, setCurrentStep] = useState<string | null>(modeResults[currentMode].currentStep)
  const [taskError, setTaskError] = useState<TaskError | null>(modeResults[currentMode].taskError)
  const [processingTime, setProcessingTime] = useState<number | undefined>(modeResults[currentMode].processingTime)
  const [historyKey, setHistoryKey] = useState(0)
  const [showLoginModal, setShowLoginModal] = useState(false)

  const getStorageKey = (mode: EditMode) => `${STORAGE_KEY_PREFIX}:${mode}`

  // 读取/保存上传状态
  const loadUploadState = () => {
    const def = {
      HEAD_SWAP: { sourceImage: null, sourceFileId: null, referenceImage: null, referenceFileId: null },
      BACKGROUND_CHANGE: { sourceImage: null, sourceFileId: null, referenceImage: null, referenceFileId: null },
      POSE_CHANGE: { sourceImage: null, sourceFileId: null, referenceImage: null, referenceFileId: null }
    }
    try {
      const modes: EditMode[] = ['HEAD_SWAP', 'BACKGROUND_CHANGE', 'POSE_CHANGE']
      const restored = { ...def } as typeof def
      modes.forEach(mode => {
        const raw = localStorage.getItem(getStorageKey(mode))
        if (raw) {
          const parsed = JSON.parse(raw)
          restored[mode] = {
            sourceImage: parsed.sourceImage ?? null,
            sourceFileId: parsed.sourceFileId ?? null,
            referenceImage: parsed.referenceImage ?? null,
            referenceFileId: parsed.referenceFileId ?? null
          }
        }
      })
      return restored
    } catch (err) {
      console.error('读取上传状态失败:', err)
      return def
    }
  }
  const saveUploadState = (mode: EditMode, state: {
    sourceImage: string | null
    sourceFileId: string | null
    referenceImage: string | null
    referenceFileId: string | null
  }) => {
    try {
      localStorage.setItem(getStorageKey(mode), JSON.stringify(state))
    } catch (err) {
      console.error('保存上传状态失败:', err)
    }
  }

  // 读取/保存任务状态
  const loadTaskState = (): { taskId: string, mode: EditMode, status?: string } | null => {
    try {
      const raw = localStorage.getItem(TASK_STATE_KEY)
      if (!raw) return null
      return JSON.parse(raw)
    } catch (err) {
      console.error('读取任务状态失败:', err)
      return null
    }
  }
  const saveTaskState = (state: { taskId: string, mode: EditMode, status?: string } | null) => {
    try {
      if (state) localStorage.setItem(TASK_STATE_KEY, JSON.stringify(state))
      else localStorage.removeItem(TASK_STATE_KEY)
    } catch (err) {
      console.error('保存任务状态失败:', err)
    }
  }

  // URL 切换模式
  useEffect(() => {
    if (modeFromUrl && (modeFromUrl === 'HEAD_SWAP' || modeFromUrl === 'BACKGROUND_CHANGE' || modeFromUrl === 'POSE_CHANGE')) {
      setCurrentMode(modeFromUrl)
    }
  }, [modeFromUrl])

  // 初始化：恢复上传状态、未完成任务
  useEffect(() => {
    const restored = loadUploadState()
    setModeImages(restored)
    console.log('✅ 已从本地存储恢复上传状态')

    const savedTask = loadTaskState()
    if (savedTask && savedTask.taskId && savedTask.mode) {
      const statusLower = (savedTask.status || '').toLowerCase()
      if (['done', 'failed', 'cancelled'].includes(statusLower)) {
        saveTaskState(null)
      } else {
        if (currentMode !== savedTask.mode) setCurrentMode(savedTask.mode)
        setCurrentTaskId(savedTask.taskId)
        setTaskMode(savedTask.mode)
        setIsProcessing(true)
        setTaskStatus(savedTask.status || TaskStatus.PENDING)
        console.log('✅ 恢复未完成任务轮询:', savedTask.taskId, '模式:', savedTask.mode)
      }
    }
  }, [])

  // 模式切换：恢复该模式的结果/状态缓存
  useEffect(() => {
    const cache = modeResults[currentMode]
    setResultImage(cache.resultImage)
    setComparisonImage(cache.comparisonImage)
    setTaskStatus(cache.taskStatus)
    setProgress(cache.progress)
    setCurrentStep(cache.currentStep)
    setTaskError(cache.taskError)
    setProcessingTime(cache.processingTime)
  }, [currentMode, modeResults])

  const displayProcessing = isProcessing && taskMode === currentMode

  // 上传处理
  const handleSourceUpload = (result: UploadResult | null) => {
    setModeImages(prev => {
      const next = {
        ...prev,
        [currentMode]: {
          ...prev[currentMode],
          sourceImage: result?.imageUrl || null,
          sourceFileId: result?.fileId || null
        }
      }
      saveUploadState(currentMode, next[currentMode])
      return next
    })
  }
  const handleReferenceUpload = (result: UploadResult | null) => {
    setModeImages(prev => {
      const next = {
        ...prev,
        [currentMode]: {
          ...prev[currentMode],
          referenceImage: result?.imageUrl || null,
          referenceFileId: result?.fileId || null
        }
      }
      saveUploadState(currentMode, next[currentMode])
      return next
    })
  }

  // 轮询任务
  useTaskPolling({
    taskId: currentTaskId,
    enabled: isProcessing && currentTaskId !== null,
    interval: 2500,
    onUpdate: (taskInfo: TaskInfo) => {
      if (taskMode) {
        setModeResults(prev => ({
          ...prev,
          [taskMode]: {
            ...prev[taskMode],
            taskStatus: taskInfo.status,
            progress: taskInfo.progress,
            currentStep: taskInfo.current_step || null
          }
        }))
      }
      if (taskMode === currentMode) {
        setTaskStatus(taskInfo.status)
        setProgress(taskInfo.progress)
        setCurrentStep(taskInfo.current_step || null)
      }
      if (currentTaskId && taskMode) {
        saveTaskState({ taskId: currentTaskId, mode: taskMode, status: taskInfo.status })
      }
    },
    onComplete: (taskInfo: TaskInfo) => {
      setIsProcessing(false)
      setTaskStatus(TaskStatus.DONE)
      setProcessingTime(taskInfo.processing_time)

      if (taskMode) {
        const resUrl = taskInfo.result?.output_image ? getImageUrl(taskInfo.result.output_image, true) : null
        const compUrl = taskInfo.result?.comparison_image ? getImageUrl(taskInfo.result.comparison_image, true) : null
        setModeResults(prev => ({
          ...prev,
          [taskMode]: {
            ...prev[taskMode],
            resultImage: resUrl,
            comparisonImage: compUrl,
            taskStatus: TaskStatus.DONE,
            progress: 100,
            currentStep: taskInfo.current_step || null,
            taskError: null,
            processingTime: taskInfo.processing_time
          }
        }))
        if (taskMode === currentMode) {
          setResultImage(resUrl)
          setComparisonImage(compUrl)
        }
      }
      setHistoryKey(prev => prev + 1)
      saveTaskState(null)
    },
    onError: (taskInfo: TaskInfo) => {
      setIsProcessing(false)
      setTaskStatus(TaskStatus.FAILED)
      saveTaskState(null)
      if (taskMode) {
        setModeResults(prev => ({
          ...prev,
          [taskMode]: {
            ...prev[taskMode],
            taskStatus: TaskStatus.FAILED,
            taskError: taskInfo.error || null
          }
        }))
      }
      const error = taskInfo.error
      setTaskError(error || null)
      const formattedError = formatErrorDisplay(error?.code, error?.message, error?.details)
      let alertMessage = `❌ ${formattedError.title}\n\n${formattedError.message}`
      if (formattedError.suggestion) alertMessage += `\n\n💡 建议：${formattedError.suggestion}`
      if (error?.code && isRetryableError(error.code)) alertMessage += '\n\n⚠️ 这是一个临时错误，建议稍后重试'
      alert(alertMessage)
    }
  })

  // 创建任务
  const handleGenerate = async () => {
    if (!isLoggedIn()) {
      setShowLoginModal(true)
      return
    }
    if (isProcessing && currentTaskId) {
      const modeNames: Record<string, string> = { HEAD_SWAP: '换头', BACKGROUND_CHANGE: '换背景', POSE_CHANGE: '换姿势' }
      alert(`⚠️ 当前有任务在进行：${modeNames[taskMode || currentMode] || taskMode}\n请等待任务完成或切换到该模式查看进度`)
      return
    }
    if (!sourceFileId) {
      alert('请先上传原始图片')
      return
    }
    if ((currentMode === 'HEAD_SWAP' || currentMode === 'POSE_CHANGE' || currentMode === 'BACKGROUND_CHANGE') && !referenceFileId) {
      const imageTypeName = currentMode === 'BACKGROUND_CHANGE' ? '背景图片' : '参考图片'
      alert(`此模式需要上传${imageTypeName}`)
      return
    }

    setResultImage(null)
    setTaskError(null)
    setProgress(0)
    setCurrentStep(null)

    const config: Record<string, any> = {}
    if (currentMode === 'HEAD_SWAP' && referenceFileId) config.target_face_image = referenceFileId
    else if (currentMode === 'BACKGROUND_CHANGE' && referenceFileId) config.background_image = referenceFileId
    else if (currentMode === 'POSE_CHANGE' && referenceFileId) config.pose_image = referenceFileId

    try {
      setIsProcessing(true)
      setTaskStatus(TaskStatus.PENDING)
      setModeResults(prev => ({
        ...prev,
        [currentMode]: {
          ...prev[currentMode],
          resultImage: null,
          comparisonImage: null,
          taskStatus: TaskStatus.PENDING,
          progress: 0,
          currentStep: null,
          taskError: null,
          processingTime: undefined
        }
      }))

      const taskInfo = await createTask({
        mode: currentMode as ApiEditMode,
        source_image: sourceFileId,
        config
      })

      setCurrentTaskId(taskInfo.task_id)
      setTaskMode(currentMode)
      setTaskStatus(taskInfo.status)
      saveTaskState({ taskId: taskInfo.task_id, mode: currentMode, status: taskInfo.status })
    } catch (error) {
      let errorMsg = '未知错误'
      if (error instanceof Error) errorMsg = error.message
      else if (typeof error === 'string') errorMsg = error
      else if (error && typeof error === 'object') {
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
      <header className="border-b border-dark-border backdrop-blur-sm flex-shrink-0 z-10">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-base flex-shrink-0">
              <div className="w-8 h-8 bg-primary rounded-sm"></div>
              <span className="text-xl font-bold">Formy</span>
            </Link>
            <div className="hidden md:flex flex-1 justify-center">
              <ModeTabs currentMode={currentMode} onModeChange={setCurrentMode} />
            </div>
            <div className="flex-shrink-0">
              <UserMenu />
            </div>
          </div>
          <div className="md:hidden mt-4">
            <ModeTabs currentMode={currentMode} onModeChange={setCurrentMode} />
          </div>
        </div>
      </header>

      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="w-96 flex-shrink-0 border-r border-dark-border overflow-y-auto">
          <ControlPanel
            mode={currentMode}
            sourceImage={sourceImage}
            referenceImage={referenceImage}
            onSourceImageChange={handleSourceUpload}
            onReferenceImageChange={handleReferenceUpload}
            onGenerate={handleGenerate}
            isProcessing={displayProcessing}
            sourceImageUrl={sourceImage}
            referenceImageUrl={referenceImage}
          />
        </div>

        <div className="flex-1 overflow-hidden">
          <PreviewPanel
            resultImage={resultImage}
            comparisonImage={comparisonImage}
            sourceImage={sourceImage}
            referenceImage={referenceImage}
            mode={currentMode}
            isProcessing={displayProcessing}
            progress={progress}
            currentStep={currentStep}
            taskStatus={_taskStatus}
            error={taskError}
            processingTime={processingTime}
          />
        </div>

        <HistorySidebar
          key={historyKey}
          currentMode={currentMode}
          onSelectTask={async (task) => {
            try {
              const { getTask } = await import('../api/tasks')
              const taskDetail = await getTask(task.task_id)

              if (taskDetail.source_image) {
                const sourceUrl = getImageUrl(`/api/v1/uploads/${taskDetail.source_image}`)
                setModeImages(prev => {
                  const next = {
                    ...prev,
                    [currentMode]: {
                      ...prev[currentMode],
                      sourceImage: sourceUrl,
                      sourceFileId: taskDetail.source_image
                    }
                  }
                  saveUploadState(currentMode, next[currentMode])
                  return next
                })
              }

              let referenceFileId: string | null = null
              if (taskDetail.reference_image) {
                referenceFileId = taskDetail.reference_image
              } else if (taskDetail.config) {
                if (currentMode === 'BACKGROUND_CHANGE') {
                  referenceFileId = taskDetail.config.background_image || taskDetail.config.bg_image
                } else if (currentMode === 'HEAD_SWAP') {
                  referenceFileId = taskDetail.config.target_face_image || taskDetail.config.cloth_image || taskDetail.config.reference_image
                } else if (currentMode === 'POSE_CHANGE') {
                  referenceFileId = taskDetail.config.pose_image || taskDetail.config.pose_reference || taskDetail.config.reference_image
                }
              }
              if (referenceFileId) {
                const referenceUrl = getImageUrl(`/api/v1/uploads/${referenceFileId}`)
                setModeImages(prev => {
                  const next = {
                    ...prev,
                    [currentMode]: {
                      ...prev[currentMode],
                      referenceImage: referenceUrl,
                      referenceFileId
                    }
                  }
                  saveUploadState(currentMode, next[currentMode])
                  return next
                })
              }

              const resUrl = taskDetail.result?.output_image ? getImageUrl(taskDetail.result.output_image, true) : null
              const compUrl = taskDetail.result?.comparison_image ? getImageUrl(taskDetail.result.comparison_image, true) : null
              setResultImage(resUrl)
              setComparisonImage(compUrl)
              setCurrentTaskId(taskDetail.task_id)
              setTaskStatus(taskDetail.status)
              setProgress(taskDetail.progress)
              setCurrentStep(taskDetail.current_step || null)
              setTaskError(taskDetail.error || null)
              setProcessingTime((taskDetail as any).processing_time)

              setModeResults(prev => ({
                ...prev,
                [currentMode]: {
                  ...prev[currentMode],
                  resultImage: resUrl,
                  comparisonImage: compUrl,
                  taskStatus: taskDetail.status,
                  progress: taskDetail.progress ?? prev[currentMode].progress,
                  currentStep: taskDetail.current_step || null,
                  taskError: taskDetail.error || null,
                  processingTime: (taskDetail as any).processing_time
                }
              }))
            } catch (error) {
              console.error('❌ 获取最新任务详情失败:', error)
              if (task.result?.output_image) {
                const resultUrl = getImageUrl(task.result.output_image, true)
                setResultImage(resultUrl)
              }
            }
          }}
        />
      </div>

      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <MobilePreview
            resultImage={resultImage}
            comparisonImage={comparisonImage}
            isProcessing={displayProcessing}
            progress={progress}
            currentStep={currentStep}
          />
        </div>
        <div className="flex-shrink-0 border-t border-dark-border">
          <MobileControls
            mode={currentMode}
            sourceImage={sourceImage}
            referenceImage={referenceImage}
            onSourceImageChange={handleSourceUpload}
            onReferenceImageChange={handleReferenceUpload}
            onGenerate={handleGenerate}
            isProcessing={displayProcessing}
          />
        </div>
      </div>

      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={() => {
            setShowLoginModal(false)
            setTimeout(() => handleGenerate(), 100)
          }}
        />
      )}
    </div>
  )
}
