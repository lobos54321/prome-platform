# Skyvern X 平台集成实施计划

## 项目概述

基于现有 Skyvern 集成框架，完成 X (Twitter) 平台的发布功能集成。

**当前状态**: 框架已搭建 (~60%)，需要连通和扩展
**目标**: 实现通过 Skyvern 自动发布内容到 X 平台

---

## 现有代码基础

### ✅ 已完成组件

| 组件 | 文件 | 功能 |
|------|------|------|
| SkyvernExecutor | `playwright-service/.../executors/SkyvernExecutor.ts` | Skyvern API 调用、任务轮询、状态管理 |
| PublishService | `playwright-service/.../services/PublishService.ts` | 多平台发布任务管理框架 |
| publishApi | `prome-platform/src/lib/publishApi.ts` | 前端发布 API 客户端 |
| PlatformSwitcher | `prome-platform/src/components/ui/PlatformSwitcher.tsx` | X 平台 UI 配置已存在 |

---

## 阶段 1: 类型定义扩展

### 1.1 后端 PublishService 添加 X 平台

**文件**: `promeplatform&xiaohongshu/xiaohongshumcp/playwright-service/claude-agent-service/src/services/PublishService.ts`

**修改点**:
1. Line 10 - Platform 类型添加 `'x'`
2. Line 68-74 - PLATFORM_CONFIG 添加 X 配置
3. Line 271-278 - getSkyvernWorkflowId 添加 X 工作流

### 1.2 前端 publishApi 添加 X 平台

**文件**: `prome-platform/src/lib/publishApi.ts`

**修改点**:
1. Line 9 - Platform 类型添加 `'x'`
2. Line 128-134 - getPlatformConfig 添加 X 配置

---

## 阶段 2: 后端 API 路由实现

### 2.1 server.js 添加 /api/publish 路由

**文件**: `prome-platform/server.js`

**新增路由**:
- `POST /api/publish/create` - 创建发布任务
- `GET /api/publish/tasks` - 获取任务列表
- `POST /api/publish/skyvern/:taskId` - 通过 Skyvern 发布
- `GET /api/publish/skyvern/:taskId/status` - 检查任务状态

### 2.2 PublishService 添加辅助方法

**文件**: `playwright-service/.../services/PublishService.ts`

**新增**:
- `getTaskById(taskId)` - 根据 ID 获取单个任务

---

## 阶段 3: SkyvernExecutor X 平台扩展

### 3.1 添加 X 平台任务配置

**文件**: `playwright-service/.../executors/SkyvernExecutor.ts`

**新增方法**:
```typescript
private buildXPublishTaskConfig(input: any, account: XhsAccount): any {
    return {
        url: 'https://x.com/compose/post',
        navigation_goal: `在 X 发布推文。内容: ${input.content}`,
        data_extraction_goal: '提取推文 ID 和 URL',
        browser_session_id: account.skyvern_profile_id,
        navigation_payload: {
            content: input.content,
            images: input.image_urls || [],
        },
        max_steps_override: 30,
    };
}
```

### 3.2 修改 buildPublishTaskConfig 支持平台路由

添加平台参数，根据不同平台调用不同配置方法。

---

## 阶段 4: Skyvern 工作流创建

### 4.1 创建 X 平台发布工作流

**在 Skyvern 中创建工作流**，主要步骤:
1. 导航到 `https://x.com/compose/post`
2. 输入推文内容
3. 上传媒体（可选）
4. 点击发布按钮
5. 提取推文 URL

### 4.2 创建 Browser Profile

- 创建持久化 Browser Session
- 手动登录 X 账号一次
- 保存 Session ID 到环境变量

---

## 阶段 5: 环境配置

### 5.1 添加环境变量

```env
# Skyvern X Platform
SKYVERN_WORKFLOW_X=<workflow_id>
SKYVERN_X_BROWSER_PROFILE=<session_id>
```

---

## 阶段 6: 数据库准备

### 6.1 创建 publish_tasks 表（如不存在）

```sql
CREATE TABLE IF NOT EXISTS publish_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content_type VARCHAR(20) NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    images JSONB DEFAULT '[]',
    video_url TEXT,
    tags JSONB DEFAULT '[]',
    platform VARCHAR(20) NOT NULL,
    method VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    platform_post_id TEXT,
    published_url TEXT,
    skyvern_task_id TEXT,
    skyvern_run_id TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 实施顺序与依赖

```
阶段 6 (数据库) ─┐
                ├──→ 阶段 1 (类型) ──→ 阶段 2 (路由) ──→ 阶段 3 (Executor)
阶段 4 (工作流) ─┘                                              │
                                                                ↓
阶段 5 (环境变量) ←─────────────────────────────────────────────┘
```

| 阶段 | 内容 | 依赖 | 预计工作量 |
|------|------|------|-----------|
| 6 | 数据库表 | 无 | 15分钟 |
| 1 | 类型定义扩展 | 无 | 20分钟 |
| 2 | API 路由实现 | 阶段1 | 45分钟 |
| 3 | Executor 扩展 | 阶段1 | 30分钟 |
| 4 | Skyvern 工作流 | Skyvern 部署 | 1-2小时 |
| 5 | 环境配置 | 阶段4 | 15分钟 |

**总预计工作量**: 3-4 小时

---

## 验收标准

### 功能验收
- [ ] 前端可选择 X 平台作为发布目标
- [ ] `/api/publish/create` 成功创建 X 平台任务
- [ ] `/api/publish/skyvern/:taskId` 触发 Skyvern 执行
- [ ] Skyvern 成功发布到 X 平台
- [ ] 发布状态正确回传前端

### 技术验收
- [ ] TypeScript 编译无错误
- [ ] 环境变量已配置
- [ ] 数据库表结构正确
- [ ] Browser Profile 登录状态有效

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| X 平台反爬虫 | 使用真实 Browser Profile，限制频率 |
| 登录状态过期 | 定期检查 Session，实现自动告警 |
| 元素选择器变化 | 使用 Skyvern 的 AI 能力自动适应 |

---

*创建时间: 2026-01-18*
