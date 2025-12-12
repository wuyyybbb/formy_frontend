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
  const STORAGE_KEY_PREFIX = 'formy-upload-state'

  // ??????�� key???????????????????
  const getStorageKey = (mode: EditMode) => `${STORAGE_KEY_PREFIX}:${mode}`

  // ?????��????????
  const loadUploadState = (): Record<EditMode, {
    sourceImage: string | null
    sourceFileId: string | null
    referenceImage: string | null
    referenceFileId: string | null
  }> => {
    const modes: EditMode[] = ['HEAD_SWAP', 'BACKGROUND_CHANGE', 'POSE_CHANGE']
    const defaultState = {
      HEAD_SWAP: { sourceImage: null, sourceFileId: null, referenceImage: null, referenceFileId: null },
      BACKGROUND_CHANGE: { sourceImage: null, sourceFileId: null, referenceImage: null, referenceFileId: null },
      POSE_CHANGE: { sourceImage: null, sourceFileId: null, referenceImage: null, referenceFileId: null }
    } as Record<EditMode, {
      sourceImage: string | null
      sourceFileId: string | null
      referenceImage: string | null
      referenceFileId: string | null
    }>

    try {
      const restored: typeof defaultState = { ...defaultState }
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
      console.error('???????????:', err)
      return defaultState
    }
  }

  // ??????????????��????��
  const saveUploadState = (mode: EditMode, state: {
    sourceImage: string | null
    sourceFileId: string | null
    referenceImage: string | null
    referenceFileId: string | null
  }) => {
    try {
      localStorage.setItem(getStorageKey(mode), JSON.stringify(state))
    } catch (err) {
      console.error('????????????:', err)
    }
  }
  
  // ?? URL ?????��???????
  useEffect(() => {
    if (modeFromUrl && (modeFromUrl === 'HEAD_SWAP' || modeFromUrl === 'BACKGROUND_CHANGE' || modeFromUrl === 'POSE_CHANGE')) {
      setCurrentMode(modeFromUrl)
    }
  }, [modeFromUrl])
  
  // ??? ??????????????????
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
  
  // ?????????????????????
  const sourceImage = modeImages[currentMode].sourceImage
  const sourceFileId = modeImages[currentMode].sourceFileId
  const referenceImage = modeImages[currentMode].referenceImage
  const referenceFileId = modeImages[currentMode].referenceFileId
  
  // ??????????????????????��????????
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [comparisonImage, setComparisonImage] = useState<string | null>(null)
  
  // ??????
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [taskMode, setTaskMode] = useState<EditMode | null>(null) // ???????????????
  const [isProcessing, setIsProcessing] = useState(false)
  const [_taskStatus, setTaskStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const [taskError, setTaskError] = useState<TaskError | null>(null)
  const [processingTime, setProcessingTime] = useState<number | undefined>(undefined)
  const [historyKey, setHistoryKey] = useState(0) // ????????????????
  const [showLoginModal, setShowLoginModal] = useState(false) // ??????????
  
  // ??��?????????????????????????????
  useEffect(() => {
    const restored = loadUploadState()
    setModeImages(restored)
    console.log('? ??????��????????')
  }, [])
  
  // ?? ?????��???????
  useEffect(() => {
    console.log('?? ???��???:', currentMode)
    
    // ???? A???????????????????????????????????????????
    // 1. ??????????????????? modeImages[currentMode] ???��??????????????
    // 2. ??????????????????????
    // 3. ?????????????????��????????????????????????????????
    
    if (taskMode && taskMode !== currentMode) {
    
      setResultImage(null)
    
      setComparisonImage(null)
    
      setTaskError(null)
    
      setProcessingTime(undefined)
    
    }
    
    // ??????????????��???????????????????????????????
    if (isProcessing && taskMode && taskMode !== currentMode) {
      // ???????????????��????????????
      setProgress(0)
      setCurrentStep(null)
      console.log(`?? ???? ${taskMode} ???????��?????��??? ${currentMode}????????????`)
    }
    
    console.log('? ???��?????:', currentMode, '??????????')
  }, [currentMode, isProcessing, taskMode])
  
  // ?????????
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
      // ????????????????
      saveUploadState(currentMode, next[currentMode])
      return next
    })
  }
  
  // ?????��?????
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
      // ????????????????
      saveUploadState(currentMode, next[currentMode])
      return next
    })
  }
  
  // ?????????
  useTaskPolling({
    taskId: currentTaskId,
    enabled: isProcessing && currentTaskId !== null,
    interval: 2500, // 2.5 ????????
    onUpdate: (taskInfo: TaskInfo) => {
      // ??��???????????????????????????
      if (taskMode === currentMode) {
        setTaskStatus(taskInfo.status)
        setProgress(taskInfo.progress)
        setCurrentStep(taskInfo.current_step || null)
        
        console.log('??????????:', {
          task_id: taskInfo.task_id,
          status: taskInfo.status,
          progress: taskInfo.progress,
          current_step: taskInfo.current_step
        })
      } else {
        console.log(`? ???? ${taskMode} ???????��?????? ${currentMode}???????????`)
      }
    },
    onComplete: (taskInfo: TaskInfo) => {
      // ???????
      console.log('? Task completed:', taskInfo)
      console.log('?? Result:', taskInfo.result)
      setIsProcessing(false)
      setTaskStatus(TaskStatus.DONE)
      setProcessingTime(taskInfo.processing_time)
      
      // ??��????????????????????????
      if (taskMode === currentMode) {
        if (taskInfo.result?.output_image) {
          const resultUrl = getImageUrl(taskInfo.result.output_image, true)
          setResultImage(resultUrl)
        }
        
        if (taskInfo.result?.comparison_image) {
          const comparisonUrl = getImageUrl(taskInfo.result.comparison_image, true)
          setComparisonImage(comparisonUrl)
        }
        console.log('? ??????????????:', currentMode)
      } else {
        console.log(`?? ???? ${taskMode} ??????????? ${currentMode} ????????????`)
      }
      
      // ?????????
      setHistoryKey(prev => prev + 1)
    },
    onError: (taskInfo: TaskInfo) => {
      // ???????
      console.error('? ???????:', taskInfo)
      setIsProcessing(false)
      setTaskStatus(TaskStatus.FAILED)
      
      // ????????????????
      const error = taskInfo.error
      setTaskError(error || null)
      
      // ??????????????????
      const formattedError = formatErrorDisplay(
        error?.code,
        error?.message,
        error?.details
      )
      
      // ????????????????
      if (error) {
        console.error('??????:', error.code)
        console.error('???????:', error.message)
        if (error.details) {
          console.error('????????:', error.details)
        }
      }
      
      // ?????????????????
      let alertMessage = `? ${formattedError.title}\n\n${formattedError.message}`
      
      // ???????
      if (formattedError.suggestion) {
        alertMessage += `\n\n?? ???�${formattedError.suggestion}`
      }
      
      // ???????????
      if (error?.code && isRetryableError(error.code)) {
        alertMessage += '\n\n?? ????????????????????????'
      }
      
      // ???????????
      alert(alertMessage)
    }
  })
  
  // ?????????????
  const handleGenerate = async () => {
    // 0. ?????????????
    if (!isLoggedIn()) {
      setShowLoginModal(true)
      return
    }
    
    // 1. ????????????????????
    if (isProcessing && currentTaskId) {
      // ?????????????��???????
      const modeNames: Record<string, string> = {
        'HEAD_SWAP': '???',
        'BACKGROUND_CHANGE': '??????',
        'POSE_CHANGE': '??????'
      }
      const currentModeName = modeNames[currentMode] || currentMode
      
      alert(
        `? ???????????????????...\n\n` +
        `??????��?${currentModeName}\n\n` +
        `???????????????????????\n\n` +
        `?? ???????????????????????��?????????`
      )
      return
    }
    
    // 2. ???????????????
    if (!sourceFileId) {
      alert('???????????')
      return
    }
    
    // 3. ????????????????��??
    if ((currentMode === 'HEAD_SWAP' || currentMode === 'POSE_CHANGE' || currentMode === 'BACKGROUND_CHANGE') && !referenceFileId) {
      const imageTypeName = currentMode === 'BACKGROUND_CHANGE' ? '??????' : '?��???'
      alert(`??????????${imageTypeName}`)
      return
    }
    
    // 4. ??????
    setResultImage(null)
    setTaskError(null)
    setProgress(0)
    setCurrentStep(null)
    
    // 5. ?????????
    const config: Record<string, any> = {}
    
    // ????????????????
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
      
      // 6. ???????????????
      const taskInfo = await createTask({
        mode: currentMode as ApiEditMode,
        source_image: sourceFileId,
        config
      })
      
      // 7. ??? task_id ?????????????????????
      setCurrentTaskId(taskInfo.task_id)
      setTaskMode(currentMode)
      setTaskStatus(taskInfo.status)
      
      console.log('????????????????:', taskInfo, '??:', currentMode)
      
    } catch (error) {
      console.error('???????????:', error)
      
      // ??????????
      let errorMsg = '��?????'
      if (error instanceof Error) {
        errorMsg = error.message
      } else if (typeof error === 'string') {
        errorMsg = error
      } else if (error && typeof error === 'object') {
        // ????????????????????
        const err = error as any
        errorMsg = err.message || err.error || JSON.stringify(error)
      }
      
      alert('???????????:\n' + errorMsg)
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
            {/* ???Logo */}
            <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-base flex-shrink-0">
              <div className="w-8 h-8 bg-primary rounded-sm"></div>
              <span className="text-xl font-bold">Formy</span>
            </Link>
            
            {/* ?��?Mode Tabs */}
            <div className="hidden md:flex flex-1 justify-center">
              <ModeTabs currentMode={currentMode} onModeChange={setCurrentMode} />
            </div>

            {/* ???User Menu */}
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
            // ?????????????????? API ???????????????
            console.log('?? ??????????:', task.task_id)
            
            try {
              // ???? GET /api/v1/tasks/{task_id} ???????????????
              const { getTask } = await import('../api/tasks')
              const taskDetail = await getTask(task.task_id)
              console.log('? ???????????:', taskDetail)
              
              // 1. ???????
              if (taskDetail.source_image) {
                // source_image �� file_id����Ҫת��Ϊ���õ� URL
                const sourceUrl = getImageUrl(`/uploads/source/${taskDetail.source_image}`)
                setModeImages(prev => {
                  const next = {
                    ...prev,
                    [currentMode]: {
                      ...prev[currentMode],
                      sourceImage: sourceUrl,
                      sourceFileId: taskDetail.source_image
                    }
                  }
                  // �־û��ָ����ϴ�״̬
                  saveUploadState(currentMode, next[currentMode])
                  return next
                })
                console.log('? �ָ�ԭʼͼƬ��ģʽ', currentMode, ':', sourceUrl)
              }
              
              // 2. ????��???????????????????��????
              let referenceFileId: string | null = null
              
              // ????? reference_image ??��??
              if (taskDetail.reference_image) {
                referenceFileId = taskDetail.reference_image
              }
              // ?????��??? config ?��????????
              else if (taskDetail.config) {
                if (currentMode === 'BACKGROUND_CHANGE') {
                  // ?????????? background_image ?? bg_image ???
                  referenceFileId = taskDetail.config.background_image || taskDetail.config.bg_image
                } else if (currentMode === 'HEAD_SWAP') {
                  // ??????? target_face_image ?? cloth_image ???
                  referenceFileId = taskDetail.config.target_face_image || taskDetail.config.cloth_image || taskDetail.config.reference_image
                } else if (currentMode === 'POSE_CHANGE') {
                  // ????????? pose_image ?? pose_reference ???
                  referenceFileId = taskDetail.config.pose_image || taskDetail.config.pose_reference || taskDetail.config.reference_image
                }
              }
              
              if (referenceFileId) {
                // �ο�ͼƬҲ�� file_id����Ҫת��Ϊ���õ� URL
                const referenceUrl = getImageUrl(`/uploads/reference/${referenceFileId}`)
                setModeImages(prev => {
                  const next = {
                    ...prev,
                    [currentMode]: {
                      ...prev[currentMode],
                      referenceImage: referenceUrl,
                      referenceFileId: referenceFileId
                    }
                  }
                  // �־û��ָ����ϴ�״̬
                  saveUploadState(currentMode, next[currentMode])
                  return next
                })
                console.log('? �ָ��ο�ͼƬ��ģʽ', currentMode, ':', referenceUrl)
              } else {
                console.log('??  �������޲ο�ͼƬ')
              }
              
              // 3. ???????????????????
              if (taskDetail.result?.output_image) {
                const resultUrl = getImageUrl(taskDetail.result.output_image, true)
                setResultImage(resultUrl)
                console.log('? ????????:', resultUrl)
              } else {
                setResultImage(null)
              }
              
              if (taskDetail.result?.comparison_image) {
                const comparisonUrl = getImageUrl(taskDetail.result.comparison_image, true)
                setComparisonImage(comparisonUrl)
                console.log('? ????????:', comparisonUrl)
              } else {
                setComparisonImage(null)
              }
              
              // 4. ?????????
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
              
              console.log('? ?????????????????')
            } catch (error) {
              console.error('? ??????????????:', error)
              // ???????????????��??��????
              if (task.result?.output_image) {
                const resultUrl = getImageUrl(task.result.output_image, true)
                setResultImage(resultUrl)
              }
            }
          }}
          onRetryTask={(task) => {
            // ????????????
            console.log('?? ????????:', task.task_id)
            
            // ??????????????
            if (task.source_image) {
              // ????? source_image?????????????
              // ???????????? task ?????��???????
              console.log('?????:', task.source_image)
            }
            
            // ???????????????��??
            if (task.config) {
              const config = task.config as Record<string, unknown>
              if (config.pose_image || config.reference_image || config.target_face_image) {
                const refImage = config.pose_image || config.reference_image || config.target_face_image
                console.log('????��??:', refImage)
              }
            }
            
            // ??????
            if (confirm('????????????\n\n???????????????????????????????????????????')) {
              // ?????????????????????
              handleGenerate()
              
              // ?????????????????????
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
            // ???????????????????
            setTimeout(() => {
              handleGenerate()
            }, 100)
          }}
        />
      )}
    </div>
  )
}


