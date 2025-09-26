# ProMe Platform - AI营销文案生成平台

基于Dify工作流的智能营销文案生成平台，支持流式响应、工作流可视化、对话连续性管理等功能。

## 🚀 核心功能

- ✅ **Dify集成**: 支持复杂的chatflow工作流
- ✅ **流式响应**: 实时打字效果和节点显示
- ✅ **对话连续性**: 页面刷新保持对话状态
- ✅ **工作流可视化**: 实时显示节点执行进度
- ✅ **历史对话管理**: 云端同步和本地缓存
- ✅ **用户认证**: Supabase认证和权限管理
- ✅ **支付集成**: Stripe订阅和信用点系统

## 🛠 技术栈

- **前端**: Vite + React + TypeScript + Tailwind CSS
- **UI组件**: shadcn/ui
- **后端**: Node.js + Express
- **数据库**: Supabase
- **AI集成**: Dify API
- **支付**: Stripe
- **部署**: 支持Docker和云平台部署

## 📦 快速开始

### 1. 环境配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入必要的配置：
# - Supabase URL和密钥
# - Dify API密钥和App ID
# - Stripe密钥（可选）
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动开发服务器

```bash
# 启动后端服务 (端口: 8080)
node server.js

# 启动前端服务 (端口: 5173)
pnpm run dev
```

### 4. 访问应用

- 前端: http://localhost:5173
- 后端API: http://localhost:8080
- Dify调试工具: http://localhost:5173/dify-debug

## 🔧 环境变量配置

### 必需配置

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Dify
VITE_ENABLE_DIFY_INTEGRATION=true
VITE_DIFY_API_URL=https://api.dify.ai/v1
VITE_DIFY_APP_ID=your_dify_app_id
VITE_DIFY_API_KEY=your_dify_api_key
```

### 可选配置

```env
# Dify超时设置 (毫秒)
VITE_DIFY_TIMEOUT_MS=120000
VITE_DIFY_WORKFLOW_TIMEOUT_MS=300000
VITE_DIFY_STREAMING_TIMEOUT_MS=240000

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key
```

## 📁 项目结构

```
prome-platform/
├── src/
│   ├── components/
│   │   ├── ui/                 # shadcn/ui组件
│   │   ├── chat/              # 聊天界面组件
│   │   └── layout/            # 布局组件
│   ├── pages/                 # 页面组件
│   ├── lib/                   # 工具库和API客户端
│   ├── hooks/                 # React Hooks
│   └── types/                 # TypeScript类型定义
├── server.js                 # Express后端服务器
├── .env.example              # 环境变量模板
└── README.md                 # 本文档
```

## 🎯 主要功能说明

### Dify集成

- 支持复杂的chatflow工作流
- 自动处理conversation_id连续性
- 智能错误处理和重试机制
- 流式响应和实时节点显示

### 聊天界面

- 实时流式响应
- 工作流节点可视化
- 消息历史持久化
- 错误处理和重试功能

### 用户管理

- Supabase认证集成
- 用户权限和角色管理
- 信用点系统
- 使用统计和监控

## 🔨 开发指南

### 添加新页面

```typescript
// src/pages/NewPage.tsx
export default function NewPage() {
  return <div>New Page</div>;
}

// 在 src/App.tsx 中添加路由
<Route path="/new-page" element={<NewPage />} />
```

### 调用Dify API

```typescript
import { difyChatService } from '@/lib/dify-client';

const response = await difyChatService.sendMessage({
  query: '用户消息',
  user: userId,
  conversationId: conversationId
});
```

### 调试工具

访问 `/dify-debug` 页面可以：
- 测试Dify API连接
- 调试流式响应
- 验证对话连续性
- 检查工作流执行

## 🚀 生产部署

### 构建项目

```bash
# 构建前端
pnpm run build

# 测试生产构建
pnpm run preview
```

### Docker部署

```bash
# 构建镜像
docker build -t prome-platform .

# 运行容器
docker run -p 3000:3000 -p 8080:8080 --env-file .env prome-platform
```

### 云平台部署

支持部署到：
- Vercel (前端)
- Railway (后端)
- Supabase (数据库)

## 🧪 测试

```bash
# 运行单元测试
pnpm run test

# 端到端测试
pnpm run test:e2e

# Dify集成测试
# 访问 /dify-debug 页面进行手动测试
```

## 📝 常见问题

### Q: Dify API连接失败
A: 检查环境变量配置，确认API_KEY和APP_ID正确

### Q: 流式响应不工作
A: 确认后端服务器运行正常，检查network面板的SSE连接

### Q: 对话连续性断开
A: 检查conversation_id是否正确传递，查看浏览器控制台错误

### Q: 页面刷新丢失对话
A: 检查localStorage存储，确认消息恢复逻辑正常工作

## 🤝 贡献

欢迎提交Issue和Pull Request来改进项目。

## 📄 许可证

MIT License

---

## 🔄 最近更新

- ✅ 修复用户ID一致性，确保对话连续性
- ✅ 实现完整的流式响应功能
- ✅ 添加工作流节点实时显示
- ✅ 优化错误处理和重试机制
- ✅ 完善localStorage消息恢复

## 📞 技术支持

如有问题，请访问项目的GitHub Issues页面。