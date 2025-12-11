import { useState } from 'react'
import { TaskError } from '../../api/tasks'
import { classifyError, getErrorIcon, getErrorColorScheme } from '../../utils/errorClassifier'
import ImageCompareSlider from '../ImageCompareSlider'

interface PreviewPanelProps {
  resultImage: string | null
  comparisonImage?: string | null
  sourceImage?: string | null  // 原图
  referenceImage?: string | null  // 参考图（换头时的"被换脸原图"）
  mode?: string | null  // 编辑模式
  isProcessing: boolean
  progress?: number
  currentStep?: string | null
  taskStatus?: string | null
  error?: TaskError | null
  processingTime?: number
}

export default function PreviewPanel({ 
  resultImage, 
  comparisonImage = null,
  sourceImage = null,
  referenceImage = null,
  mode = null,
  isProcessing,
  progress = 0,
  currentStep = null,
  taskStatus = null,
  error = null,
  processingTime = undefined
}: PreviewPanelProps) {
  
  // 根据模式选择底层图片
  const getBeforeImage = () => {
    if (mode === 'HEAD_SWAP') {
      // 换头：底层显示"被换脸原图"（referenceImage）
      return referenceImage || sourceImage
    }
    // 换背景、换姿势：底层显示"原始图片"（sourceImage）
    return sourceImage
  }
  
  // 🔍 调试日志
  console.log('PreviewPanel 对比图调试:', {
    mode,
    resultImage: resultImage ? '有' : '无',
    sourceImage: sourceImage ? '有' : '无',
    referenceImage: referenceImage ? '有' : '无',
    comparisonImage: comparisonImage ? '有' : '无',
    getBeforeImage: getBeforeImage() ? '有' : '无',
    shouldShowSlider: !!(resultImage && getBeforeImage())
  })
  
  const [showDetails, setShowDetails] = useState(false)
  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="title-h3">预览</h3>
        </div>

        {/* Results Display - 不显示原图，只显示处理结果和对比图 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Processing Result (output:image:1) */}
          <div>
            <div className="text-sm font-medium mb-3 text-primary">处理结果</div>
            <div className="aspect-[3/4] bg-dark-card rounded-md border border-dark-border overflow-hidden flex items-center justify-center">
              {isProcessing ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center px-4">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-text-secondary mb-2 font-medium">🎨 AI 创作中...</p>
                    <p className="text-xs text-text-tertiary mb-3">当前使用人数较多，预计需要 2-3 分钟</p>
                    
                    {/* 进度条 */}
                    {progress > 0 && (
                      <div className="w-full max-w-xs mx-auto mb-2">
                        <div className="bg-dark-border rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-primary h-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-text-tertiary mt-1">{progress}%</p>
                      </div>
                    )}
                    
                    {/* 当前步骤 - 更友好的提示 */}
                    {currentStep && (
                      <p className="text-text-tertiary text-sm mt-2">
                        {currentStep.includes('调用') || currentStep.includes('引擎') || currentStep.includes('AI') 
                          ? '⏳ 前方拥堵，请耐心等待～预计需要 2-3 分钟' 
                          : currentStep}
                      </p>
                    )}
                    
                    {/* 如果没有 currentStep，显示友好提示 */}
                    {!currentStep && progress > 30 && (
                      <p className="text-text-tertiary text-sm mt-2">
                        ⏳ AI 正在努力创作，请稍候片刻...
                      </p>
                    )}
                  </div>
                </div>
              ) : resultImage ? (
                /* 使用 object-contain 保证图片完整显示，不会裁剪 */
                <img 
                  src={resultImage} 
                  alt="处理结果" 
                  className="max-w-full max-h-full object-contain"
                  style={{ width: 'auto', height: 'auto' }}
                />
              ) : (
                <div className="text-center text-text-tertiary">
                  <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-sm">等待生成结果</p>
                </div>
              )}
            </div>
          </div>

          {/* Comparison Slider (output:image_comparer:2) - 使用拖动对比 */}
          <div>
            <div className="text-sm font-medium mb-3 text-primary">对比展示</div>
            <div className="aspect-[3/4] bg-dark-card rounded-md border border-dark-border overflow-hidden flex items-center justify-center">
              {isProcessing ? (
                <div className="text-center text-text-tertiary">
                  <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-sm">等待生成结果</p>
                </div>
              ) : (resultImage && getBeforeImage()) ? (
                /* 使用拖动对比组件 - 根据模式选择底层图片 */
                <div className="w-full h-full">
                  <ImageCompareSlider
                    beforeImage={getBeforeImage()!}
                    afterImage={resultImage}
                    beforeLabel={mode === 'HEAD_SWAP' ? '被换脸原图' : '原图'}
                    afterLabel="处理后"
                  />
                </div>
              ) : (
                <div className="text-center text-text-tertiary">
                  <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-sm">等待生成对比图</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Cards */}
        {/* Processing State */}
        {isProcessing && (
          <div className="mt-6 card border-primary/20 bg-primary/5">
            <div className="flex items-start">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse mt-2 mr-3 flex-shrink-0"></div>
              <div className="flex-1 min-w-0">
                <p className="font-medium mb-1 flex items-center gap-2">
                  <span>AI 处理中</span>
                  {progress > 0 && <span className="text-sm text-primary">({progress}%)</span>}
                </p>
                <p className="text-sm text-text-secondary">
                  {currentStep || '当前使用人数较多，请耐心等待，预计 2-3 分钟完成'}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Success State */}
        {!isProcessing && taskStatus === 'done' && resultImage && (
          <div className="mt-6 card border-green-500/20 bg-green-500/5">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-green-500 mb-1">
                  Generation Complete!
                </p>
                <p className="text-sm text-text-secondary">
                  Your image has been processed successfully
                  {processingTime && ` in ${processingTime.toFixed(1)}s`}.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {resultImage && (
                    <a 
                      href={resultImage} 
                      download 
                      className="btn-secondary text-sm py-1.5 px-4"
                    >
                      <svg className="w-4 h-4 mr-1.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Result
                    </a>
                  )}
                  {comparisonImage && (
                    <a 
                      href={comparisonImage} 
                      download 
                      className="btn-ghost text-sm py-1.5 px-4"
                    >
                      Download Comparison
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Error State - Enhanced with classification */}
        {!isProcessing && taskStatus === 'failed' && error && (() => {
          const classified = classifyError(error.code, error.message, error.details)
          const colors = getErrorColorScheme(classified.category)
          const icon = getErrorIcon(classified.category)
          
          return (
            <div className={`mt-6 card border ${colors.border} ${colors.bg}`}>
              <div className="flex items-start">
                <div className={`flex-shrink-0 w-10 h-10 ${colors.iconBg} rounded-full flex items-center justify-center mr-3`}>
                  <span className="text-2xl">{icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${colors.text} mb-1`}>
                    {classified.category === 'validation' && '参数验证失败'}
                    {classified.category === 'service_unavailable' && 'AI 服务不可用'}
                    {classified.category === 'processing' && '处理失败'}
                    {classified.category === 'unknown' && '处理失败'}
                  </p>
                  <p className="text-sm text-text-secondary mb-2">
                    {classified.userMessage}
                  </p>
                  {classified.suggestion && (
                    <p className="text-xs text-text-tertiary mb-3">
                      💡 {classified.suggestion}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => window.location.reload()}
                      className="btn-secondary text-sm py-1.5 px-4"
                    >
                      <svg className="w-4 h-4 mr-1.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      重试
                    </button>
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="btn-ghost text-sm py-1.5 px-4"
                    >
                      <svg className="w-4 h-4 mr-1.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {showDetails ? '隐藏详情' : '查看详情'}
                    </button>
                  </div>
                  
                  {/* Technical details (for debugging) */}
                  {showDetails && (
                    <div className="mt-4 p-3 bg-dark-card rounded-sm border border-dark-border">
                      <p className="text-xs font-mono text-text-tertiary mb-2">
                        <span className="text-text-secondary font-semibold">错误码:</span> {error.code || 'N/A'}
                      </p>
                      <p className="text-xs font-mono text-text-tertiary mb-2">
                        <span className="text-text-secondary font-semibold">错误消息:</span>
                      </p>
                      <p className="text-xs font-mono text-text-tertiary break-all mb-2 pl-2 border-l-2 border-dark-border">
                        {classified.technicalMessage}
                      </p>
                      {error.details && (
                        <>
                          <p className="text-xs font-mono text-text-tertiary mb-2">
                            <span className="text-text-secondary font-semibold">详细信息:</span>
                          </p>
                          <p className="text-xs font-mono text-text-tertiary break-all pl-2 border-l-2 border-dark-border">
                            {error.details}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

