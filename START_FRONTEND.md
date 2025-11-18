# 前端启动指南

## 快速启动

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 访问应用

- **首页**: http://localhost:5173/
- **编辑器**: http://localhost:5173/editor

## 测试上传功能

1. 访问编辑器页面: http://localhost:5173/editor
2. 选择模式（换头/换背景/换姿势）
3. 点击上传区域
4. 选择一张图片
5. 等待上传完成
6. 查看预览

## 开发工具

### 浏览器开发者工具

按 F12 打开，查看：
- **Console**: 查看日志和错误
- **Network**: 查看 API 请求
- **Application**: 查看本地存储

### React DevTools

安装 React Developer Tools 浏览器扩展。

## 构建生产版本

```bash
# 构建
npm run build

# 预览构建结果
npm run preview
```

## 常见问题

### API 连接失败

1. 确认后端服务已启动
2. 检查 `.env` 文件中的 `VITE_API_BASE_URL`
3. 查看浏览器控制台的错误信息

### 图片上传失败

1. 检查文件格式（JPG/PNG/WEBP）
2. 检查文件大小（<10MB）
3. 查看网络请求的错误信息

### 页面样式异常

```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

## 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览构建结果 |
| `npm run lint` | 运行 ESLint |

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `VITE_API_BASE_URL` | - | 后端 API 基础 URL |

## 项目结构

```
frontend/
├── src/
│   ├── pages/           # 页面组件
│   ├── components/      # 通用组件
│   ├── api/             # API 调用
│   ├── App.tsx          # 根组件
│   └── main.tsx         # 入口文件
├── public/              # 静态资源
└── index.html           # HTML 模板
```

