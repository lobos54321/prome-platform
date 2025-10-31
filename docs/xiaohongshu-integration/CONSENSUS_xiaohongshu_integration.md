# 小红书自动化系统集成 - 共识文档

> **基于**：ALIGNMENT_xiaohongshu_integration.md  
> **状态**：✅ 技术方案已确认，准备进入架构设计阶段  
> **日期**：2025-10-31

---

## ✅ 需求确认

### 核心需求
将 `xiaohongshumcp/frontend/auto-manager.html` 转换为 React 组件并集成到 `prome-platform`。

### 关键特性
1. ✅ **自动用户映射**：Supabase UUID ↔ xhs_user_id 自动转换
2. ✅ **完整功能复刻**：登录、配置、运营、监控四大模块
3. ✅ **数据持久化**：所有操作保存到 Supabase（7个表）
4. ✅ **无缝体验**：用户无需手动输入任何ID
5. ✅ **错误容错**：完善的错误处理和重试机制

---

## 🎯 技术方案确认

### 前端技术栈
- **框架**：React 18 + TypeScript 5
- **样式**：Tailwind CSS 3 + shadcn/ui
- **路由**：React Router v6
- **状态管理**：React Hooks (useState, useEffect, useCallback)
- **HTTP客户端**：fetch API (原生)
- **数据库**：Supabase Client

### 后端依赖
- **API服务**：https://xiaohongshu-automation-ai.zeabur.app
- **认证方式**：无（后端自管理）
- **数据格式**：JSON
- **超时设置**：30秒

---

## 🔧 集成架构

### 数据流

```
┌─────────────────────────────────────────────────────────┐
│                     prome-platform                      │
│  ┌──────────────┐                                       │
│  │ Supabase Auth│ ──→ UUID (9dee4891...)                │
│  └──────────────┘                                       │
│         ↓                                               │
│  ┌──────────────────────────────────────────────┐      │
│  │ XiaohongshuSupabaseService                   │      │
│  │  • getOrCreateUserMapping()                  │      │
│  │  • saveUserProfile()                         │      │
│  │  • saveAutomationStatus()                    │      │
│  │  • saveContentStrategy()                     │      │
│  │  • saveWeeklyPlan()                          │      │
│  │  • addActivityLog()                          │      │
│  └──────────────────────────────────────────────┘      │
│         ↓ xhs_user_id                                   │
│  ┌──────────────────────────────────────────────┐      │
│  │ XiaohongshuBackendAPI                        │      │
│  │  • checkLoginStatus()                        │      │
│  │  • autoLogin()                               │      │
│  │  • submitManualCookies()                     │      │
│  │  • autoImportCookies()                       │      │
│  │  • startAutoOperation()                      │      │
│  │  • getAutomationStatus()                     │      │
│  │  • getContentStrategy()                      │      │
│  │  • getWeeklyPlan()                           │      │
│  └──────────────────────────────────────────────┘      │
│         ↓                                               │
└─────────┼───────────────────────────────────────────────┘
          ↓
┌─────────┼───────────────────────────────────────────────┐
│  xiaohongshumcp Backend API                            │
│  https://xiaohongshu-automation-ai.zeabur.app          │
│                                                         │
│  • /agent/xiaohongshu/login/status                     │
│  • /agent/xiaohongshu/auto-login                       │
│  • /agent/auto/start                                   │
│  • /agent/auto/status/{userId}                         │
│  • /agent/auto/strategy/{userId}                       │
│  • /agent/auto/plan/{userId}                           │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 文件结构

### 新增文件
```
src/
├── lib/
│   ├── xiaohongshu-backend-api.ts    # 后端API封装
│   └── xiaohongshu-supabase.ts       # Supabase服务封装
├── pages/
│   └── XiaohongshuAutomation.tsx     # 主页面（重写）
├── types/
│   └── xiaohongshu.ts                # TypeScript类型定义
└── components/
    └── xiaohongshu/                   # 小红书专用组件
        ├── LoginSection.tsx
        ├── AutoLoginModal.tsx
        ├── ManualCookieForm.tsx
        ├── ConfigSection.tsx
        ├── DashboardSection.tsx
        ├── StatusCard.tsx
        ├── StrategyCard.tsx
        └── WeeklyPlanCard.tsx
```

### 修改文件
```
src/
├── App.tsx                           # 添加路由（如需要）
└── lib/
    └── xiaohongshu-api.ts            # 可能需要更新
```

---

## 🗂️ TypeScript 类型定义

```typescript
// src/types/xiaohongshu.ts

// ============================================
// 用户映射
// ============================================
export interface UserMapping {
  supabase_uuid: string;
  xhs_user_id: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// 用户配置
// ============================================
export interface UserProfile {
  id: string;
  supabase_uuid: string;
  xhs_user_id: string;
  product_name: string;
  target_audience: string | null;
  marketing_goal: 'brand' | 'sales' | 'traffic' | 'community';
  post_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  brand_style: 'professional' | 'warm' | 'humorous' | 'minimalist';
  review_mode: 'auto' | 'manual';
  created_at: string;
  updated_at: string;
}

// ============================================
// 登录状态
// ============================================
export interface LoginStatus {
  success: boolean;
  isLoggedIn: boolean;
  message?: string;
  needsQRCode?: boolean;
}

// ============================================
// 二维码数据
// ============================================
export interface QRCodeData {
  success: boolean;
  qrCode?: string;
  qrId?: string;
  message?: string;
}

// ============================================
// 自动化状态
// ============================================
export interface AutomationStatus {
  supabase_uuid: string;
  xhs_user_id: string;
  is_running: boolean;
  is_logged_in: boolean;
  has_config: boolean;
  last_activity: string | null;
  uptime_seconds: number;
  next_scheduled_task: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 内容策略
// ============================================
export interface ContentStrategy {
  id: string;
  supabase_uuid: string;
  xhs_user_id: string;
  key_themes: string[];
  trending_topics: string[];
  hashtags: string[];
  optimal_times: string[];
  created_at: string;
  updated_at: string;
}

// ============================================
// 周计划
// ============================================
export interface WeeklyPlan {
  id: string;
  supabase_uuid: string;
  xhs_user_id: string;
  week_start_date: string;
  week_end_date: string;
  plan_data: {
    monday?: DayPlan;
    tuesday?: DayPlan;
    wednesday?: DayPlan;
    thursday?: DayPlan;
    friday?: DayPlan;
    saturday?: DayPlan;
    sunday?: DayPlan;
  };
  created_at: string;
  updated_at: string;
}

export interface DayPlan {
  theme: string;
  title: string;
  content: string;
  scheduled_time: string;
  status: 'planned' | 'generating' | 'pending' | 'published' | 'failed';
}

// ============================================
// 每日任务
// ============================================
export interface DailyTask {
  id: string;
  supabase_uuid: string;
  xhs_user_id: string;
  theme: string;
  title: string | null;
  content: string | null;
  scheduled_time: string | null;
  status: 'planned' | 'generating' | 'pending' | 'published' | 'failed';
  image_urls: string[];
  cover_image_url: string | null;
  post_url: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// 活动日志
// ============================================
export interface ActivityLog {
  id: string;
  supabase_uuid: string;
  xhs_user_id: string;
  activity_type: 'login' | 'config' | 'start' | 'stop' | 'publish' | 'error';
  message: string;
  metadata: Record<string, any>;
  created_at: string;
}

// ============================================
// API 请求/响应
// ============================================
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 产品配置表单数据
export interface ProductConfig {
  productName: string;
  targetAudience: string;
  marketingGoal: 'brand' | 'sales' | 'traffic' | 'community';
  postFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  brandStyle: 'professional' | 'warm' | 'humorous' | 'minimalist';
  reviewMode: 'auto' | 'manual';
}
```

---

## 🔌 API 接口定义

### XiaohongshuBackendAPI

```typescript
export class XiaohongshuBackendAPI {
  private readonly baseURL = 'https://xiaohongshu-automation-ai.zeabur.app';
  private readonly timeout = 30000; // 30秒

  /**
   * 检查登录状态
   * @param userId - xhs_user_id
   */
  async checkLoginStatus(userId: string): Promise<LoginStatus> {
    // GET /agent/xiaohongshu/login/status?userId={userId}
  }

  /**
   * 自动登录（获取二维码）
   * @param userId - xhs_user_id
   */
  async autoLogin(userId: string): Promise<QRCodeData> {
    // POST /agent/xiaohongshu/auto-login
    // Body: { userId }
  }

  /**
   * 手动提交Cookie
   * @param userId - xhs_user_id
   * @param cookies - Cookie字符串
   */
  async submitManualCookies(userId: string, cookies: string): Promise<APIResponse> {
    // POST /agent/xiaohongshu/manual-cookies
    // Body: { userId, cookies }
  }

  /**
   * 自动导入Cookie（从inbox）
   * @param userId - xhs_user_id
   */
  async autoImportCookies(userId: string): Promise<APIResponse> {
    // POST /agent/auto-import/manual
    // Body: { userId }
  }

  /**
   * 启动自动运营
   * @param userId - xhs_user_id
   * @param config - 产品配置
   */
  async startAutoOperation(userId: string, config: ProductConfig): Promise<APIResponse> {
    // POST /agent/auto/start
    // Body: { userId, ...config }
  }

  /**
   * 获取自动化状态
   * @param userId - xhs_user_id
   */
  async getAutomationStatus(userId: string): Promise<APIResponse<AutomationStatus>> {
    // GET /agent/auto/status/{userId}
  }

  /**
   * 获取内容策略
   * @param userId - xhs_user_id
   */
  async getContentStrategy(userId: string): Promise<APIResponse<ContentStrategy>> {
    // GET /agent/auto/strategy/{userId}
  }

  /**
   * 获取周计划
   * @param userId - xhs_user_id
   */
  async getWeeklyPlan(userId: string): Promise<APIResponse<WeeklyPlan>> {
    // GET /agent/auto/plan/{userId}
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    // GET /health
  }
}
```

### XiaohongshuSupabaseService

```typescript
export class XiaohongshuSupabaseService {
  /**
   * 获取或创建用户映射
   * @param supabaseUuid - Supabase用户UUID
   * @returns xhs_user_id
   */
  async getOrCreateUserMapping(supabaseUuid: string): Promise<string> {
    // 1. 查询 xhs_user_mapping 表
    // 2. 如果存在，返回 xhs_user_id
    // 3. 如果不存在，生成新ID并插入
    // 4. 返回 xhs_user_id
  }

  /**
   * 保存用户配置
   */
  async saveUserProfile(profile: Partial<UserProfile>): Promise<void> {
    // UPSERT xhs_user_profiles
  }

  /**
   * 获取用户配置
   */
  async getUserProfile(supabaseUuid: string): Promise<UserProfile | null> {
    // SELECT FROM xhs_user_profiles WHERE supabase_uuid = ?
  }

  /**
   * 保存自动化状态
   */
  async saveAutomationStatus(status: Partial<AutomationStatus>): Promise<void> {
    // UPSERT xhs_automation_status
  }

  /**
   * 获取自动化状态
   */
  async getAutomationStatus(supabaseUuid: string): Promise<AutomationStatus | null> {
    // SELECT FROM xhs_automation_status WHERE supabase_uuid = ?
  }

  /**
   * 保存内容策略
   */
  async saveContentStrategy(strategy: Partial<ContentStrategy>): Promise<void> {
    // UPSERT xhs_content_strategies
  }

  /**
   * 保存周计划
   */
  async saveWeeklyPlan(plan: Partial<WeeklyPlan>): Promise<void> {
    // UPSERT xhs_weekly_plans
  }

  /**
   * 添加活动日志
   */
  async addActivityLog(log: Omit<ActivityLog, 'id' | 'created_at'>): Promise<void> {
    // INSERT INTO xhs_activity_logs
  }

  /**
   * 获取活动日志
   */
  async getActivityLogs(
    supabaseUuid: string, 
    limit: number = 50
  ): Promise<ActivityLog[]> {
    // SELECT FROM xhs_activity_logs 
    // WHERE supabase_uuid = ? 
    // ORDER BY created_at DESC 
    // LIMIT ?
  }
}
```

---

## 🎨 UI/UX 设计

### 页面布局

```
┌─────────────────────────────────────────────────────────┐
│  🤖 小红书全自动运营系统                                  │
│  一次设置，终身自动 - 让Claude为你打理一切                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 📱 Step 1: 登录状态检查                                   │
│                                                          │
│  [检查中...] / [已登录] / [未登录]                        │
│  [🚀 一键自动登录] [🔧 手动导入Cookie]                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 📝 Step 2: 产品信息配置                                   │
│                                                          │
│  产品/服务：[___________________]                         │
│  目标客户：[___________________]                         │
│  营销目标：[品牌宣传 ▼]                                  │
│  发布频率：[每日一篇 ▼]                                  │
│  品牌风格：[专业严谨 ▼]                                  │
│  审核模式：[自动发布 ▼]                                  │
│                                                          │
│  [保存配置] [启动自动运营]                                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 📊 Step 3: 运营仪表盘                                     │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ 运行状态  │ │ 今日任务  │ │ 累计发布  │                │
│  │ ● 运行中 │ │   1/1    │ │    23    │                │
│  └──────────┘ └──────────┘ └──────────┘                │
│                                                          │
│  🎯 AI 内容策略                                           │
│  • 主题1 • 主题2 • 主题3                                  │
│                                                          │
│  📅 本周计划                                              │
│  周一：主题A - 已发布 ✅                                   │
│  周二：主题B - 进行中 ⏳                                  │
│  周三：主题C - 计划中 📝                                  │
│                                                          │
│  📝 待发布队列                                            │
│  1. 标题1 - 15:00 发布                                   │
│  2. 标题2 - 明天 10:00                                   │
└─────────────────────────────────────────────────────────┘
```

### 颜色方案
- **主色调**：紫色渐变 (#667eea → #764ba2)
- **成功状态**：绿色 (#10b981)
- **警告状态**：橙色 (#f59e0b)
- **错误状态**：红色 (#ef4444)
- **运行中动画**：流动渐变效果

---

## 🔄 交互流程

### 1. 页面初始化
```
用户访问 /xiaohongshu
  ↓
获取 Supabase UUID
  ↓
getOrCreateUserMapping() → xhs_user_id
  ↓
checkLoginStatus(xhs_user_id)
  ↓
┌─────────────┬─────────────┐
│ 已登录       │ 未登录       │
├─────────────┼─────────────┤
│ 显示配置表单 │ 显示登录选项 │
│ 或仪表盘     │             │
└─────────────┴─────────────┘
```

### 2. 登录流程
```
点击"一键自动登录"
  ↓
autoLogin(xhs_user_id)
  ↓
显示二维码弹窗
  ↓
轮询检查登录状态（每3秒）
  ↓
checkLoginStatus(xhs_user_id)
  ↓
登录成功
  ↓
保存登录状态到数据库
  ↓
显示配置表单
```

### 3. 配置并启动
```
填写产品信息
  ↓
保存配置 saveUserProfile()
  ↓
点击"启动自动运营"
  ↓
startAutoOperation(xhs_user_id, config)
  ↓
显示仪表盘
  ↓
开始轮询更新（每5秒）
  ├─ getAutomationStatus()
  ├─ getContentStrategy()
  └─ getWeeklyPlan()
```

---

## 🛡️ 错误处理

### API 调用错误
```typescript
try {
  const response = await api.checkLoginStatus(userId);
  // 成功处理
} catch (error) {
  if (error instanceof NetworkError) {
    // 网络错误：显示重试按钮
    showError('网络连接失败，请检查网络后重试');
  } else if (error instanceof TimeoutError) {
    // 超时错误：自动重试
    retryWithBackoff(() => api.checkLoginStatus(userId));
  } else {
    // 其他错误：显示错误信息
    showError(error.message);
  }
}
```

### 重试策略
```typescript
// 指数退避重试
async function retryWithBackoff(
  fn: () => Promise<any>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }
}
```

---

## ✅ 验收标准确认

### 功能完整性
- [x] 自动生成用户ID映射
- [ ] 登录状态检查正常
- [ ] 二维码登录功能
- [ ] 手动Cookie导入功能
- [ ] 产品配置保存
- [ ] 自动运营启动
- [ ] 仪表盘实时更新
- [ ] 数据持久化到Supabase

### 性能要求
- [ ] 首次加载 < 2秒
- [ ] API响应 < 1秒
- [ ] 轮询不卡顿
- [ ] 移动端流畅

### 用户体验
- [ ] 无需手动输入ID
- [ ] 错误提示清晰
- [ ] 加载状态明确
- [ ] 移动端适配
- [ ] 风格一致

---

## 📋 下一步行动

### 立即开始
1. **创建 DESIGN 文档** - 详细架构设计
2. **创建 TypeScript 类型定义** - types/xiaohongshu.ts
3. **创建 API 封装层** - lib/xiaohongshu-backend-api.ts
4. **创建 Supabase 服务** - lib/xiaohongshu-supabase.ts
5. **创建主页面组件** - pages/XiaohongshuAutomation.tsx

---

**文档创建时间**：2025-10-31  
**创建人**：AI Assistant  
**状态**：✅ 已确认共识，准备进入架构设计
