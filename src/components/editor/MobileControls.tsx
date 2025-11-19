import { useState } from 'react'
import { EditMode } from '../../pages/Editor'
import { UploadResult } from './UploadArea'
import { uploadImage, getImageUrl } from '../../api/upload'

interface MobileControlsProps {
  mode: EditMode
  sourceImage: string | null
  referenceImage: string | null
  onSourceImageChange: (result: UploadResult | null) => void
  onReferenceImageChange: (result: UploadResult | null) => void
  onGenerate: () => void
  isProcessing: boolean
}

export default function MobileControls({
  mode,
  sourceImage,
  referenceImage: _referenceImage,
  onSourceImageChange,
  onReferenceImageChange,
  onGenerate,
  isProcessing,
}: MobileControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleSourceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const result = await uploadImage(file, 'source')
      const imageUrl = getImageUrl(result.url)
      onSourceImageChange({
        imageUrl,
        fileId: result.file_id
      })
    } catch (error) {
      console.error('上传失败:', error)
      // 失败时使用本地预览（但没有 file_id）
      alert('上传失败，请重试')
    } finally {
      setIsUploading(false)
    }
  }

  const handleReferenceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const result = await uploadImage(file, 'reference')
      const imageUrl = getImageUrl(result.url)
      onReferenceImageChange({
        imageUrl,
        fileId: result.file_id
      })
    } catch (error) {
      console.error('上传失败:', error)
      alert('上传失败，请重试')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="bg-dark-card">
      {/* Quick Actions */}
      <div className="p-4 border-b border-dark-border">
        <div className="flex gap-2">
          <label className="flex-1">
            <div className="btn-secondary w-full text-center py-3">
              <svg className="w-5 h-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              上传原图
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleSourceFileChange}
              disabled={isUploading}
              className="hidden"
            />
          </label>

          {mode === 'HEAD_SWAP' || mode === 'BACKGROUND_CHANGE' || mode === 'POSE_CHANGE' ? (
            <label className="flex-1">
              <div className="btn-ghost w-full text-center py-3">
                <svg className="w-5 h-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                参考图
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleReferenceFileChange}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          ) : null}
        </div>
      </div>

      {/* Settings Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between text-text-secondary hover:text-text-primary transition-base"
      >
        <span className="text-sm font-medium">高级设置</span>
        <svg
          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Settings */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-dark-border pt-4">
          {mode === 'HEAD_SWAP' && (
            <>
              <div>
                <label className="block text-xs font-medium mb-2">质量</label>
                <select className="input text-sm">
                  <option>标准</option>
                  <option>高清</option>
                  <option>超高清</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2">融合强度</label>
                <input type="range" min="0" max="100" defaultValue="80" className="w-full" />
              </div>
            </>
          )}

          {mode === 'BACKGROUND_CHANGE' && (
            <>
              <div>
                <label className="block text-xs font-medium mb-2">背景类型</label>
                <select className="input text-sm">
                  <option>自定义背景</option>
                  <option>纯色背景</option>
                  <option>移除背景</option>
                </select>
              </div>
            </>
          )}

          {mode === 'POSE_CHANGE' && (
            <>
              <div>
                <label className="flex items-center text-sm">
                  <input type="checkbox" defaultChecked className="mr-2" />
                  保持面部特征
                </label>
              </div>
            </>
          )}
        </div>
      )}

      {/* Generate Button - Fixed at bottom */}
      <div className="p-4 border-t border-dark-border">
        <button
          onClick={onGenerate}
          disabled={!sourceImage || isProcessing}
          className={`
            w-full py-4 rounded-sm font-semibold transition-all duration-200
            ${!sourceImage || isProcessing
              ? 'bg-dark-border text-text-tertiary'
              : 'bg-primary text-dark hover:glow-primary'
            }
          `}
        >
          {isProcessing ? '处理中...' : '开始生成'}
        </button>
      </div>
    </div>
  )
}

