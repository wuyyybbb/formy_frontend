import { useEffect, useRef, useState } from 'react'
import { getTask, TaskInfo, TaskStatus } from '../api/tasks'

interface UseTaskPollingOptions {
  taskId: string | null
  interval?: number // 轮询间隔（毫秒）
  enabled?: boolean // 是否启用轮询
  onUpdate?: (taskInfo: TaskInfo) => void // 任务状态更新回调（每次轮询都触发）
  onComplete?: (taskInfo: TaskInfo) => void // 任务完成回调（status = DONE）
  onError?: (taskInfo: TaskInfo) => void // 任务失败回调（status = FAILED）
}

interface UseTaskPollingResult {
  taskInfo: TaskInfo | null
  isPolling: boolean
  error: string | null
  stopPolling: () => void
}

/**
 * 任务状态轮询 Hook
 * 
 * 用法：
 * ```tsx
 * const { taskInfo, isPolling } = useTaskPolling({
 *   taskId: currentTaskId,
 *   interval: 2000,
 *   onUpdate: (task) => console.log('状态更新:', task),
 *   onComplete: (task) => console.log('任务完成:', task),
 *   onError: (task) => console.log('任务失败:', task)
 * })
 * ```
 */
export function useTaskPolling({
  taskId,
  interval = 2000,
  enabled = true,
  onUpdate,
  onComplete,
  onError
}: UseTaskPollingOptions): UseTaskPollingResult {
  const [taskInfo, setTaskInfo] = useState<TaskInfo | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)

  // 停止轮询
  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPolling(false)
  }

  // 查询任务状态
  const pollTaskStatus = async () => {
    if (!taskId) return

    try {
      const task = await getTask(taskId)
      
      // 组件已卸载则不更新状态
      if (!isMountedRef.current) return
      
      setTaskInfo(task)
      setError(null)

      // 每次轮询都触发更新回调
      onUpdate?.(task)

      // 根据任务状态决定是否停止轮询
      if (task.status === TaskStatus.DONE) {
        stopPolling()
        onComplete?.(task)
        console.log('✅ 任务完成:', task)
      } else if (task.status === TaskStatus.FAILED) {
        stopPolling()
        onError?.(task)
        console.error('❌ 任务失败:', task)
      } else if (task.status === TaskStatus.CANCELLED) {
        stopPolling()
        console.log('⚠️ 任务已取消:', task)
      }
      // PENDING 或 PROCESSING 状态继续轮询
      
    } catch (err) {
      console.error('轮询任务状态失败:', err)
      if (!isMountedRef.current) return
      setError(err instanceof Error ? err.message : '查询任务状态失败')
    }
  }

  useEffect(() => {
    isMountedRef.current = true

    // 如果没有 taskId 或未启用，停止轮询
    if (!taskId || !enabled) {
      stopPolling()
      return
    }

    // 立即执行一次查询
    pollTaskStatus()

    // 启动轮询
    setIsPolling(true)
    intervalRef.current = setInterval(pollTaskStatus, interval)

    // 清理函数
    return () => {
      isMountedRef.current = false
      stopPolling()
    }
  }, [taskId, enabled, interval])

  return {
    taskInfo,
    isPolling,
    error,
    stopPolling
  }
}
