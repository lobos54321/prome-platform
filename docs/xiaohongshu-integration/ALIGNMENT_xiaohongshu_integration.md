# 小红书自动化系统集成 - 对齐文档

## 📋 任务概述

### 原始需求
将 `lobos54321/xiaohongshumcp` 仓库中的 `frontend/auto-manager.html` 转换为 React 组件，无缝集成到 `prome-platform` 项目中。

### 任务目标
1. **保留 prome-platform 的用户系统**：使用 Supabase UUID 管理用户
2. **集成 auto-manager.html 的完整功能**：复用已验证的 UI 和业务逻辑
3. **自动化用户体验**：用户登录后自动生成 `xhs_user_id`，无需手动输入
4. **数据持久化**：所有操作数据保存到 Supabase 数据库（7个表）
5. **API 桥接**：通过 `xhs_user_id` 连接前端和 xiaohongshumcp 后端

---

## 🎯 项目上下文分析

### prome-platform 项目特性

#### 技术栈
- **前端框架**：React 18 + TypeScript + Vite
- **UI 组件库**：Tailwind CSS + shadcn/ui
- **路由**：React Router v6
- **数据库**：Supabase (PostgreSQL + RLS)
- **认证系统**：Supabase Auth
- **部署**：Vercel/Zeabur

#### 现有架构
```
prome-platform/
├── src/
│   ├── pages/
│   │   ├── XiaohongshuMarketing.tsx       # 现有页面（需重写）
│   │   └── XiaohongshuMarketing_new.tsx   # 新版本页面
│   ├── lib/
│   │   ├── auth.ts                         # 认证服务
│   │   ├── supabase.ts                     # Supabase 客户端
│   │   └── xiaohongshu-api.ts              # 小红书 API（已存在）
│   └── components/ui/                      # shadcn/ui 组件
└── supabase/
    └── migrations/
        └── 20251031_xiaohongshu_schema.sql # 数据库迁移（已创建）
```

#### 用户系统
- **用户 ID 格式**：Supabase UUID (例如：`9dee4891-89a6-44eb-965d-a56d53f1caea`)
- **认证方式**：Email + Password / OAuth
- **会话管理**：authService.getCurrentUserSync()

---

### xiaohongshumcp 项目特性

#### 技术栈
- **后端**：Node.js + MCP (Model Context Protocol)
- **浏览器自动化**：Playwright (Chromium)
- **AI 服务**：Claude API
- **部署**：Zeabur

#### 后端 API 结构
**基础 URL**：`https://xiaohongshu-automation-ai.zeabur.app`

**核心端点**：
```
1. 登录管理
   GET  /agent/xiaohongshu/login/status?userId={xhs_user_id}
   POST /agent/xiaohongshu/auto-login
   POST /agent/xiaohongshu/manual-cookies
   GET  /agent/xiaohongshu/logout-status?userId={xhs_user_id}
   POST /agent/auto-import/manual

2. 自动运营
   POST /agent/auto/start
   GET  /agent/auto/status/{xhs_user_id}
   GET  /agent/auto/strategy/{xhs_user_id}
   GET  /agent/auto/plan/{xhs_user_id}

3. 内容发布
   POST /agent/xiaohongshu/publish

4. 系统健康
   GET  /health
```

#### auto-manager.html 工作流程
```
Step 1: 登录检查
├─ 检查登录状态 (GET /login/status)
├─ 自动同步Cookie (POST /auto-import/manual)
├─ 或显示二维码登录 (POST /auto-login)
└─ 或手动提交Cookie (POST /manual-cookies)

Step 2: 配置产品信息
├─ 产品/服务名称
├─ 目标客户群体
├─ 营销目标
├─ 发布频率
├─ 品牌风格
└─ 审核模式

Step 3: 启动自动运营
└─ POST /agent/auto/start

Step 4: 监控仪表盘
├─ 实时状态 (GET /auto/status)
├─ AI 内容策略 (GET /auto/strategy)
├─ 本周计划 (GET /auto/plan)
└─ 轮询更新（每5秒）
```

#### 用户 ID 格式
- **原始格式**：简单字符串（例如：`test-user-123`）
- **生成方式**：用户手动输入或 localStorage 自动生成

---

## 🔗 集成方案设计

### UUID 映射机制

#### 生成规则
```typescript
// 从 Supabase UUID 生成 xhs_user_id
function generateXiaohongshuUserId(supabaseUuid: string): string {
  // 移除连字符，取前16位
  const cleanId = supabaseUuid.replace(/-/g, '').substring(0, 16);
  // 添加前缀和后缀
  return `user_${cleanId}_prome`;
}

// 示例：
// 输入：9dee4891-89a6-44eb-965d-a56d53f1caea
// 输出：user_9dee489189a644_prome
```

#### 数据库映射表
```sql
-- xhs_user_mapping 表结构
CREATE TABLE xhs_user_mapping (
  supabase_uuid UUID PRIMARY KEY,           -- Supabase 用户 UUID
  xhs_user_id TEXT NOT NULL UNIQUE,         -- 小红书系统用户 ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 映射流程
```
用户登录 prome-platform
  ↓
获取 Supabase UUID
  ↓
查询 xhs_user_mapping 表
  ↓ (如果不存在)
生成 xhs_user_id
  ↓
保存映射关系到数据库
  ↓
使用 xhs_user_id 调用后端 API
  ↓
所有数据自动关联回 UUID
```

---

### 数据持久化策略

#### 7个核心表

1. **xhs_user_mapping** - 用户ID映射
2. **xhs_user_profiles** - 用户配置（产品信息）
3. **xhs_content_strategies** - 内容策略（AI生成）
4. **xhs_daily_tasks** - 每日任务（发布计划）
5. **xhs_weekly_plans** - 周计划
6. **xhs_activity_logs** - 活动日志
7. **xhs_automation_status** - 自动化状态

#### 数据同步时机
- **登录成功后**：保存/更新登录状态
- **配置产品信息**：保存到 xhs_user_profiles
- **启动自动运营**：保存到 xhs_automation_status
- **获取策略/计划**：保存到对应表并缓存
- **轮询更新**：每5秒同步一次状态

---

## ✅ 需求边界确认

### 包含范围（In Scope）
✅ 转换 auto-manager.html 为 React 组件  
✅ 集成 UUID 映射逻辑  
✅ 实现所有原有功能（登录、配置、运营、监控）  
✅ 数据持久化到 Supabase  
✅ 保持 UI/UX 一致性  
✅ 添加错误处理和加载状态  
✅ 移动端适配  

### 不包含范围（Out of Scope）
❌ 修改 xiaohongshumcp 后端代码  
❌ 实现新的业务功能  
❌ 修改数据库 Schema（已完成）  
❌ 实现 WebSocket 实时通信（使用轮询）  
❌ 添加分析统计功能（后期扩展）  

---

## 🤔 疑问澄清

### 已确认的决策

#### Q1: 后端 API 地址
**答**：使用 `https://xiaohongshu-automation-ai.zeabur.app`

#### Q2: 如何处理现有页面
**答**：完全重写 `XiaohongshuMarketing.tsx`，保留旧文件作为备份

#### Q3: WebSocket 支持
**答**：auto-manager.html 使用 WebSocket，但我们改用轮询（每5秒），因为：
- 更简单可靠
- 避免跨域问题
- 易于调试和维护

#### Q4: 样式处理
**答**：转换为 Tailwind CSS，保持与 prome-platform 一致

#### Q5: API KEY 管理
**答**：后端 API 不需要前端传递 API KEY，由后端统一管理

#### Q6: 错误处理策略
**答**：
- API 调用失败：显示友好错误提示 + 重试按钮
- 网络超时：默认 30秒超时 + 自动重试3次
- 未登录状态：自动显示登录引导

---

## 🎨 技术实现方案

### 组件架构
```
XiaohongshuAutomationPage.tsx (主页面)
├── LoginSection (登录检查组件)
│   ├── AutoLoginModal (自动登录二维码)
│   ├── ManualCookieForm (手动导入Cookie)
│   └── LoginStatus (登录状态显示)
├── ConfigSection (产品配置组件)
│   └── ProductConfigForm (配置表单)
└── DashboardSection (运营仪表盘组件)
    ├── StatusCard (状态卡片)
    ├── StrategyCard (策略展示)
    ├── WeeklyPlanCard (周计划)
    └── ContentPreview (内容预览)
```

### API 封装
```typescript
// src/lib/xiaohongshu-supabase.ts
export class XiaohongshuSupabaseService {
  // 获取或创建用户映射
  async getOrCreateUserMapping(supabaseUuid: string): Promise<string>
  
  // 保存用户配置
  async saveUserProfile(config: UserProfile): Promise<void>
  
  // 保存自动化状态
  async saveAutomationStatus(status: AutomationStatus): Promise<void>
  
  // 保存内容策略
  async saveContentStrategy(strategy: ContentStrategy): Promise<void>
  
  // 保存周计划
  async saveWeeklyPlan(plan: WeeklyPlan): Promise<void>
  
  // 添加活动日志
  async addActivityLog(log: ActivityLog): Promise<void>
}

// src/lib/xiaohongshu-backend-api.ts
export class XiaohongshuBackendAPI {
  private baseURL = 'https://xiaohongshu-automation-ai.zeabur.app'
  
  // 登录相关
  async checkLoginStatus(userId: string): Promise<LoginStatus>
  async autoLogin(userId: string): Promise<QRCode>
  async submitManualCookies(userId: string, cookies: string): Promise<void>
  async autoImportCookies(userId: string): Promise<void>
  
  // 运营相关
  async startAutoOperation(userId: string, config: ProductConfig): Promise<void>
  async getAutomationStatus(userId: string): Promise<AutomationStatus>
  async getContentStrategy(userId: string): Promise<ContentStrategy>
  async getWeeklyPlan(userId: string): Promise<WeeklyPlan>
}
```

---

## 📝 验收标准

### 功能验收
- [ ] 用户登录后自动生成并保存 `xhs_user_id`
- [ ] 登录状态检查正常（包含自动同步Cookie）
- [ ] 二维码登录功能正常
- [ ] 手动导入Cookie功能正常
- [ ] 产品配置表单数据正确保存
- [ ] 自动运营启动成功
- [ ] 仪表盘实时更新（轮询）
- [ ] 所有数据正确保存到 Supabase

### 性能验收
- [ ] 页面首次加载时间 < 2秒
- [ ] API 调用平均响应时间 < 1秒
- [ ] 轮询不影响页面性能
- [ ] 移动端流畅运行

### 用户体验验收
- [ ] 无需手动输入用户ID
- [ ] 错误提示友好清晰
- [ ] 加载状态明确
- [ ] 移动端适配良好
- [ ] 与 prome-platform 风格一致

---

## 🚨 风险评估

### 高风险
🔴 **后端 API 不稳定或不可用**
- **缓解措施**：添加健康检查 + 错误重试 + 友好提示

🔴 **用户ID映射冲突**
- **缓解措施**：使用数据库唯一约束 + 事务处理

### 中风险
🟡 **数据库 RLS 策略阻止访问**
- **缓解措施**：已创建完整 RLS 策略，但需测试验证

🟡 **跨域请求问题**
- **缓解措施**：确认后端已配置 CORS

### 低风险
🟢 **样式转换不完全匹配**
- **缓解措施**：逐步调整，优先保证功能

---

## 📅 实施计划

### Phase 1: 基础架构（1小时）
- [x] 创建对齐文档
- [ ] 创建 API 封装层
- [ ] 创建 Supabase 服务层
- [ ] 设置 TypeScript 类型定义

### Phase 2: 核心功能（2小时）
- [ ] 实现登录检查逻辑
- [ ] 实现自动登录（二维码）
- [ ] 实现手动导入Cookie
- [ ] 实现产品配置表单

### Phase 3: 仪表盘（1.5小时）
- [ ] 实现状态卡片
- [ ] 实现策略展示
- [ ] 实现周计划展示
- [ ] 实现轮询逻辑

### Phase 4: 测试和优化（1小时）
- [ ] 集成测试
- [ ] 错误处理完善
- [ ] 性能优化
- [ ] 文档更新

**总计**：约 5.5 小时

---

## 📚 参考文档
- [Supabase RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [React Router v6 Guide](https://reactrouter.com/en/main)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [xiaohongshumcp API 文档](https://github.com/lobos54321/xiaohongshumcp/blob/main/frontend/README.md)

---

**文档创建时间**：2025-10-31  
**创建人**：AI Assistant  
**状态**：✅ 已完成对齐
