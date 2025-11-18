import { EditMode } from '../../pages/Editor'
import UploadArea, { UploadResult } from './UploadArea'

interface ControlPanelProps {
  mode: EditMode
  sourceImage: string | null
  referenceImage: string | null
  onSourceImageChange: (result: UploadResult | null) => void
  onReferenceImageChange: (result: UploadResult | null) => void
  onGenerate: () => void
  isProcessing: boolean
}

export default function ControlPanel({
  mode,
  sourceImage,
  referenceImage,
  onSourceImageChange,
  onReferenceImageChange,
  onGenerate,
  isProcessing,
}: ControlPanelProps) {
  const getModeConfig = () => {
    switch (mode) {
      case 'HEAD_SWAP':
        return {
          title: 'AI 换头',
          description: '上传原图和参考头像，AI 将自然替换人物头部',
          needsReference: true,
          referenceLabel: '参考头像',
        }
      case 'BACKGROUND_CHANGE':
        return {
          title: 'AI 换背景',
          description: '上传原图，选择或上传新背景，AI 将完成背景替换',
          needsReference: true,
          referenceLabel: '背景图片',
        }
      case 'POSE_CHANGE':
        return {
          title: 'AI 换姿势',
          description: '上传原图和目标姿势，AI 将迁移人物姿态',
          needsReference: true,
          referenceLabel: '目标姿势',
        }
    }
  }

  const config = getModeConfig()

  return (
    <div className="p-6 space-y-6">
      {/* Mode Info */}
      <div>
        <h2 className="title-h3 mb-2">{config.title}</h2>
        <p className="text-text-secondary text-sm">{config.description}</p>
      </div>

      {/* Upload Areas */}
      <div className="space-y-4">
        <UploadArea
          label="原始图片"
          image={sourceImage}
          onChange={onSourceImageChange}
          purpose="source"
        />

        {config.needsReference && (
          <UploadArea
            label={config.referenceLabel}
            image={referenceImage}
            onChange={onReferenceImageChange}
            purpose="reference"
          />
        )}
      </div>

      {/* Settings */}
      {mode === 'HEAD_SWAP' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">质量</label>
            <select className="input">
              <option>标准</option>
              <option>高清</option>
              <option>超高清</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">融合强度</label>
            <input type="range" min="0" max="100" defaultValue="80" className="w-full" />
          </div>
        </div>
      )}

      {mode === 'BACKGROUND_CHANGE' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">背景类型</label>
            <select className="input">
              <option>自定义背景</option>
              <option>纯色背景</option>
              <option>移除背景</option>
              <option>预设场景</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">边缘羽化</label>
            <input type="range" min="0" max="10" defaultValue="2" className="w-full" />
          </div>
        </div>
      )}

      {mode === 'POSE_CHANGE' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">保持面部</label>
            <label className="flex items-center">
              <input type="checkbox" defaultChecked className="mr-2" />
              <span className="text-sm">保持原始面部特征</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">平滑度</label>
            <input type="range" min="0" max="100" defaultValue="70" className="w-full" />
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={!sourceImage || isProcessing}
        className={`
          w-full py-4 rounded-sm font-semibold text-lg transition-all duration-200
          ${!sourceImage || isProcessing
            ? 'bg-dark-border text-text-tertiary cursor-not-allowed'
            : 'bg-primary text-dark hover:bg-primary/90 hover:glow-primary'
          }
        `}
      >
        {isProcessing ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            处理中...
          </span>
        ) : (
          '开始生成'
        )}
      </button>

      {/* Tips */}
      <div className="card bg-dark border-accent/20 p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-accent mr-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-text-secondary">
            <p className="font-medium text-text-primary mb-1">温馨提示</p>
            <p>建议上传清晰的人物图片，分辨率不低于 512x512</p>
          </div>
        </div>
      </div>
    </div>
  )
}

