import { EditMode } from '../../pages/Editor'

interface ModeTabsProps {
  currentMode: EditMode
  onModeChange: (mode: EditMode) => void
}

const modes = [
  { id: 'HEAD_SWAP' as EditMode, label: '换头', icon: '👤' },
  { id: 'BACKGROUND_CHANGE' as EditMode, label: '换背景', icon: '🖼️' },
  { id: 'POSE_CHANGE' as EditMode, label: '换姿势', icon: '🤸' },
]

export default function ModeTabs({ currentMode, onModeChange }: ModeTabsProps) {
  return (
    <div className="flex gap-2">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onModeChange(mode.id)}
          className={`
            px-4 py-2 rounded-sm font-medium transition-all duration-200
            ${currentMode === mode.id
              ? 'bg-primary text-dark'
              : 'bg-dark-card text-text-secondary hover:bg-dark-border hover:text-text-primary'
            }
          `}
        >
          <span className="mr-2">{mode.icon}</span>
          {mode.label}
        </button>
      ))}
    </div>
  )
}

