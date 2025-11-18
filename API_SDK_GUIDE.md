# Formy 前端 API SDK 使用指南

## 📦 概述

本项目使用 **Axios** 封装了所有后端 API 调用，提供了统一、类型安全的 API SDK。

## 🚀 快速开始

### 安装依赖

```bash
cd frontend
npm install
```

这会自动安装 `axios` 及其他依赖。

### 基本使用

```typescript
import { uploadImage, createTask, getTask, EditMode } from '@/api'

// 1. 上传图片
const uploadResult = await uploadImage(file, 'source')
console.log('图片已上传:', uploadResult.file_id)

// 2. 创建任务
const task = await createTask({
  mode: EditMode.HEAD_SWAP,
  source_image: uploadResult.file_id,
  config: { target_face_image: referenceFileId }
})
console.log('任务已创建:', task.task_id)

// 3. 查询任务状态
const taskInfo = await getTask(task.task_id)
console.log('任务状态:', taskInfo.status)
```

## 📚 API 参考

### 🖼️ 图片上传 API

#### `uploadImage(file, purpose)`

上传图片到服务器。

**参数**：
- `file: File` - 要上传的文件对象
- `purpose: 'source' | 'reference'` - 图片用途
  - `'source'` - 原始图片
  - `'reference'` - 参考图片（换头/换姿势等）

**返回值**：
```typescript
{
  file_id: string       // 文件 ID，用于创建任务
  filename: string      // 原始文件名
  size: number         // 文件大小（字节）
  url: string          // 访问 URL（相对路径）
  uploaded_at: string  // 上传时间
}
```

**示例**：
```typescript
import { uploadImage } from '@/api'

const handleFileUpload = async (file: File) => {
  try {
    const result = await uploadImage(file, 'source')
    console.log('文件 ID:', result.file_id)
    console.log('访问 URL:', result.url)
  } catch (error) {
    console.error('上传失败:', error.message)
  }
}
```

**错误处理**：
- 文件格式不支持 → `"不支持的文件格式，请上传 JPG、PNG 或 WEBP 格式的图片"`
- 文件过大 → `"图片大小不能超过 10MB"`
- 网络错误 → `"网络连接失败，请检查网络"`

---

#### `getImageUrl(url)`

将相对 URL 转换为完整 URL（用于显示图片）。

**参数**：
- `url: string` - 相对 URL 或完整 URL

**返回值**：
- `string` - 完整的图片 URL

**示例**：
```typescript
import { getImageUrl } from '@/api'

const imageUrl = getImageUrl('/uploads/source/img_123.jpg')
// 返回: "http://localhost:8000/uploads/source/img_123.jpg"

<img src={imageUrl} alt="预览" />
```

---

### 🎯 任务管理 API

#### `createTask(request)`

创建新的图像处理任务。

**参数**：
```typescript
{
  mode: EditMode              // 编辑模式
  source_image: string        // 原始图片的 file_id
  config: Record<string, any> // 模式相关配置
}
```

**EditMode 枚举**：
- `EditMode.HEAD_SWAP` - 换头
- `EditMode.BACKGROUND_CHANGE` - 换背景
- `EditMode.POSE_CHANGE` - 换姿势

**Config 配置**：

| 模式 | 配置项 | 说明 |
|------|--------|------|
| HEAD_SWAP | `target_face_image` | 目标头像的 file_id |
| BACKGROUND_CHANGE | `background_image` | 背景图片的 file_id（可选） |
| POSE_CHANGE | `pose_image` | 目标姿势图片的 file_id |

**返回值**：
```typescript
{
  task_id: string           // 任务 ID
  status: TaskStatus        // 任务状态
  mode: EditMode           // 编辑模式
  progress: number         // 进度（0-100）
  current_step?: string    // 当前步骤描述
  source_image: string     // 原始图片 file_id
  config: object           // 配置参数
  result?: TaskResult      // 结果（完成后）
  error?: TaskError        // 错误（失败后）
  created_at: string       // 创建时间
  ...
}
```

**示例 - 换头任务**：
```typescript
import { createTask, EditMode } from '@/api'

const task = await createTask({
  mode: EditMode.HEAD_SWAP,
  source_image: 'img_20231117_abc123',
  config: {
    target_face_image: 'img_20231117_def456'
  }
})

console.log('任务 ID:', task.task_id)
console.log('状态:', task.status) // "pending"
```

**示例 - 换背景任务**：
```typescript
const task = await createTask({
  mode: EditMode.BACKGROUND_CHANGE,
  source_image: sourceFileId,
  config: {
    background_image: backgroundFileId, // 可选
    background_type: 'custom'           // 可选
  }
})
```

---

#### `getTask(taskId)`

查询任务详情和状态。

**参数**：
- `taskId: string` - 任务 ID

**返回值**：
```typescript
TaskInfo // 完整的任务信息
```

**TaskStatus 状态**：
- `TaskStatus.PENDING` - 待处理（已入队）
- `TaskStatus.PROCESSING` - 处理中
- `TaskStatus.DONE` - 已完成
- `TaskStatus.FAILED` - 失败
- `TaskStatus.CANCELLED` - 已取消

**示例**：
```typescript
import { getTask, TaskStatus } from '@/api'

const taskInfo = await getTask('task_20231117_xyz')

if (taskInfo.status === TaskStatus.DONE) {
  console.log('任务完成！')
  console.log('结果图片:', taskInfo.result?.output_image)
} else if (taskInfo.status === TaskStatus.PROCESSING) {
  console.log('处理中...', taskInfo.progress + '%')
  console.log('当前步骤:', taskInfo.current_step)
} else if (taskInfo.status === TaskStatus.FAILED) {
  console.error('任务失败:', taskInfo.error?.message)
}
```

---

#### `listTasks(params)`

获取任务列表（支持筛选和分页）。

**参数**：
```typescript
{
  status?: string     // 状态筛选
  mode?: string       // 模式筛选
  page?: number       // 页码（从 1 开始）
  page_size?: number  // 每页数量
}
```

**返回值**：
```typescript
{
  tasks: TaskInfo[]  // 任务列表
  pagination: {
    page: number
    page_size: number
    total: number
  }
}
```

**示例**：
```typescript
import { listTasks, TaskStatus, EditMode } from '@/api'

// 获取所有任务
const allTasks = await listTasks()

// 获取处理中的任务
const processingTasks = await listTasks({
  status: TaskStatus.PROCESSING
})

// 获取换头任务（分页）
const headSwapTasks = await listTasks({
  mode: EditMode.HEAD_SWAP,
  page: 1,
  page_size: 20
})

console.log('总数:', headSwapTasks.pagination.total)
console.log('任务:', headSwapTasks.tasks)
```

---

#### `cancelTask(taskId)`

取消任务（仅对未完成的任务有效）。

**参数**：
- `taskId: string` - 任务 ID

**返回值**：
- `void`

**示例**：
```typescript
import { cancelTask } from '@/api'

try {
  await cancelTask('task_20231117_xyz')
  console.log('任务已取消')
} catch (error) {
  console.error('取消失败:', error.message)
}
```

---

## 🔧 高级用法

### 使用命名空间（可选）

如果你喜欢按模块组织 API：

```typescript
import { ImageAPI, TaskAPI } from '@/api'

// 图片相关
const result = await ImageAPI.uploadImage(file, 'source')
const url = ImageAPI.getImageUrl(result.url)

// 任务相关
const task = await TaskAPI.createTask(request)
const taskInfo = await TaskAPI.getTask(task.task_id)
```

### 直接使用 Axios 客户端

如果需要自定义请求：

```typescript
import { apiClient } from '@/api'

// 自定义 GET 请求
const response = await apiClient.get('/custom-endpoint')

// 自定义 POST 请求
const result = await apiClient.post('/custom-endpoint', {
  data: 'value'
})
```

### 添加认证 Token

修改 `frontend/src/api/client.ts`：

```typescript
instance.interceptors.request.use(
  (config) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  }
)
```

### 配置 API 基础 URL

创建 `.env` 文件：

```bash
# 开发环境
VITE_API_BASE_URL=http://localhost:8000/api/v1

# 生产环境
VITE_API_BASE_URL=https://api.formy.com/api/v1
```

---

## 📊 完整示例

### 完整的图片处理流程

```typescript
import { 
  uploadImage, 
  createTask, 
  getTask,
  EditMode,
  TaskStatus,
  getImageUrl
} from '@/api'

async function processImage(sourceFile: File, referenceFile: File) {
  try {
    // 1. 上传原始图片
    console.log('上传原始图片...')
    const sourceResult = await uploadImage(sourceFile, 'source')
    
    // 2. 上传参考图片
    console.log('上传参考图片...')
    const referenceResult = await uploadImage(referenceFile, 'reference')
    
    // 3. 创建任务
    console.log('创建任务...')
    const task = await createTask({
      mode: EditMode.HEAD_SWAP,
      source_image: sourceResult.file_id,
      config: {
        target_face_image: referenceResult.file_id
      }
    })
    
    console.log('任务已创建:', task.task_id)
    
    // 4. 轮询任务状态
    const pollInterval = 2500 // 2.5 秒
    const maxAttempts = 60     // 最多 2.5 分钟
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      
      const taskInfo = await getTask(task.task_id)
      
      console.log(`进度: ${taskInfo.progress}% - ${taskInfo.current_step}`)
      
      if (taskInfo.status === TaskStatus.DONE) {
        console.log('任务完成！')
        const resultUrl = getImageUrl(taskInfo.result!.output_image!)
        console.log('结果图片:', resultUrl)
        return resultUrl
      }
      
      if (taskInfo.status === TaskStatus.FAILED) {
        throw new Error(taskInfo.error?.message || '任务失败')
      }
    }
    
    throw new Error('任务超时')
    
  } catch (error) {
    console.error('处理失败:', error)
    throw error
  }
}
```

### 在 React 组件中使用

```typescript
import { useState } from 'react'
import { uploadImage, createTask, getTask, EditMode, TaskStatus } from '@/api'

function Editor() {
  const [sourceFileId, setSourceFileId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  
  const handleUpload = async (file: File) => {
    try {
      const result = await uploadImage(file, 'source')
      setSourceFileId(result.file_id)
    } catch (error) {
      alert('上传失败: ' + error.message)
    }
  }
  
  const handleGenerate = async () => {
    if (!sourceFileId) {
      alert('请先上传图片')
      return
    }
    
    try {
      setIsProcessing(true)
      
      // 创建任务
      const task = await createTask({
        mode: EditMode.HEAD_SWAP,
        source_image: sourceFileId,
        config: {}
      })
      
      // 轮询状态
      const interval = setInterval(async () => {
        const taskInfo = await getTask(task.task_id)
        setProgress(taskInfo.progress)
        
        if (taskInfo.status === TaskStatus.DONE) {
          clearInterval(interval)
          setIsProcessing(false)
          alert('处理完成！')
        } else if (taskInfo.status === TaskStatus.FAILED) {
          clearInterval(interval)
          setIsProcessing(false)
          alert('处理失败: ' + taskInfo.error?.message)
        }
      }, 2500)
      
    } catch (error) {
      setIsProcessing(false)
      alert('创建任务失败: ' + error.message)
    }
  }
  
  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files![0])} />
      <button onClick={handleGenerate} disabled={isProcessing}>
        {isProcessing ? `处理中 (${progress}%)` : '开始生成'}
      </button>
    </div>
  )
}
```

---

## 🛠️ 错误处理

所有 API 函数都会抛出错误，请使用 `try-catch` 处理：

```typescript
import { uploadImage } from '@/api'

try {
  const result = await uploadImage(file, 'source')
  // 处理成功
} catch (error) {
  // 错误信息已经格式化
  console.error(error.message)
  
  // 显示给用户
  alert(`上传失败: ${error.message}`)
}
```

**常见错误消息**：
- `"不支持的文件格式，请上传 JPG、PNG 或 WEBP 格式的图片"`
- `"图片大小不能超过 10MB"`
- `"网络连接失败，请检查网络"`
- `"请求失败 (404)"` - 资源不存在
- `"请求失败 (500)"` - 服务器错误

---

## 📝 类型定义

所有类型都已导出，可以直接使用：

```typescript
import type {
  UploadImageResponse,
  CreateTaskRequest,
  TaskInfo,
  TaskResult,
  TaskError,
  TaskListResponse
} from '@/api'

// 使用类型
const handleTaskComplete = (taskInfo: TaskInfo) => {
  if (taskInfo.result) {
    const result: TaskResult = taskInfo.result
    console.log('输出图片:', result.output_image)
  }
}
```

---

## 🎯 最佳实践

1. **始终处理错误**
   ```typescript
   try {
     await uploadImage(file, 'source')
   } catch (error) {
     // 处理错误
   }
   ```

2. **使用类型注解**
   ```typescript
   import type { TaskInfo } from '@/api'
   
   const task: TaskInfo = await getTask(taskId)
   ```

3. **合理设置轮询间隔**
   - 建议 2-3 秒轮询一次
   - 设置最大轮询次数避免无限循环

4. **记得清理定时器**
   ```typescript
   const interval = setInterval(() => {...}, 2500)
   
   // 记得清理
   clearInterval(interval)
   ```

5. **使用环境变量**
   - 开发和生产环境使用不同的 API_BASE_URL
   - 通过 `.env` 文件配置

---

## 📦 项目结构

```
frontend/src/api/
├── index.ts      # 统一导出（推荐使用）
├── client.ts     # Axios 客户端配置
├── upload.ts     # 图片上传 API
└── tasks.ts      # 任务管理 API
```

---

## 🔗 相关文档

- [后端 API 文档](../docs/API_SPEC.md)
- [任务系统文档](../backend/TASK_SYSTEM_README.md)
- [轮询测试指南](../POLLING_TEST_GUIDE.md)

---

**Happy Coding! 🚀**

