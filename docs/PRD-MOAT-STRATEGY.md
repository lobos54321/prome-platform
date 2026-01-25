# PRD: Prome 小红书营销 Agent 护城河战略

> **版本**: v1.0
> **日期**: 2026-01-16
> **状态**: 规划中
> **负责人**: Product Team

---

## 一、背景与问题定义

### 1.1 核心挑战

随着 Claude Code、GPT-4 Computer Use 等通用 AI Agent 的崛起，具备以下能力的桌面端 Agent 正在威胁垂直 SaaS 产品：

- **跨域控制**：能直接操作浏览器、读取本地文件
- **自动登录**：支持扫码登录、保持会话状态
- **视觉理解**：通过截图识别界面，无需 API 适配
- **记忆能力**：可将用户资料存储在本地作为上下文

### 1.2 威胁评估矩阵

| 能力维度 | 通用 Agent | Prome 现状 | 威胁等级 |
|---------|-----------|-----------|---------|
| 单次内容生成 | ✅ 碾压 | ⚠️ 依赖 Claude API | 🔴 高 |
| 策略分析建议 | ✅ 同等 | ✅ 有 | 🟡 中 |
| 浏览器自动化 | ✅ 更灵活 | ✅ DrissionPage | 🟡 中 |
| 长期数据积累 | ❌ 无状态 | ✅ Supabase | 🟢 低 |
| 定时任务执行 | ❌ 被动调用 | ✅ Cronjob | 🟢 低 |
| 团队协作 | ❌ 单机 | ✅ 多用户 | 🟢 低 |
| 主动监控告警 | ❌ 无法实现 | ⚠️ 待建设 | 🟢 低 |

### 1.3 战略定位

**从"工具"升级为"操作系统"**：

```
通用 Agent = 聪明的实习生（需要教每一步，容易遗忘）
Prome = 经验丰富的主管（标准流程代码化，24/7 运行）
```

---

## 二、护城河能力规划

### 2.1 核心护城河架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户感知层                            │
│  账号资产仪表盘 | 成长轨迹 | 迁移成本展示                  │
├─────────────────────────────────────────────────────────┤
│                    业务流程层                            │
│  内容日历 | 审核工作流 | 多账号矩阵 | 团队协作             │
├─────────────────────────────────────────────────────────┤
│                    数据资产层                            │
│  账号画像 | 历史表现 | 素材库 | 竞品数据 | 私有知识库       │
├─────────────────────────────────────────────────────────┤
│                    执行引擎层                            │
│  xhs-worker | Chrome Extension | 定时调度 | 监控告警      │
├─────────────────────────────────────────────────────────┤
│                    智能层（可替换）                       │
│  Claude API | OpenAI | 自有模型                          │
└─────────────────────────────────────────────────────────┘
```

**核心原则**：智能层可替换，但数据层和执行层必须自主掌控。

---

## 三、功能模块详细设计

### 3.1 账号智能引擎 (Account Intelligence Engine)

**目标**：积累通用 AI 无法复制的长期账号数据

#### 3.1.1 数据模型

```sql
CREATE TABLE xhs_account_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  xhs_account_id TEXT NOT NULL,
  supabase_uuid TEXT NOT NULL,

  -- 账号健康指标
  follower_history JSONB DEFAULT '[]',
  engagement_rates JSONB DEFAULT '{}',
  content_performance JSONB DEFAULT '{}',
  best_posting_times JSONB DEFAULT '[]',

  -- 平台风控画像
  risk_score FLOAT DEFAULT 0,
  shadowban_history JSONB DEFAULT '[]',
  content_warnings JSONB DEFAULT '[]',

  -- 算法偏好学习
  recommended_hashtags JSONB DEFAULT '[]',
  audience_demographics JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(xhs_account_id, supabase_uuid)
);

CREATE INDEX idx_account_intel_user ON xhs_account_intelligence(supabase_uuid);
```

#### 3.1.2 核心功能

| 功能 | 描述 | 实现路径 |
|-----|------|---------|
| 发布表现分析 | 计算各时段、内容类型的互动率 | `ai_agent.py` 扩展 |
| 限流检测 | 对比近期曝光量 vs 历史基线 | 新增 `shadowban_detector.py` |
| 最佳时间学习 | 基于历史数据推荐发布时间 | ML 模型 / 规则引擎 |
| 风险评估 | 综合评分账号健康度 | `account_health_monitor.ts` |

#### 3.1.3 护城河价值

> 用户切换到通用 Agent 需要从零积累 3-6 个月的账号数据。
> 系统展示"您已积累 127 天数据，89 次策略优化"。

---

### 3.2 账号健康监控系统

**目标**：24/7 主动监控，这是通用 Agent 无法实现的能力

#### 3.2.1 监控指标

```typescript
interface HealthReport {
  loginStatus: 'valid' | 'expiring' | 'expired';
  shadowbanRisk: number; // 0-1
  followerTrend: 'growing' | 'stable' | 'declining';
  contentWarnings: ContentWarning[];
  recommendations: string[];
  lastCheckedAt: Date;
}
```

#### 3.2.2 实现架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Cronjob    │────▶│  Worker     │────▶│  Supabase   │
│  (6小时)    │     │  健康检查    │     │  存储结果    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  推送通知    │
                    │  邮件/短信   │
                    └─────────────┘
```

#### 3.2.3 前端展示

```tsx
// 新增组件：AccountHealthCard
<Card>
  <CardHeader>
    <CardTitle>账号健康度</CardTitle>
    <Badge variant={risk > 0.7 ? 'destructive' : 'success'}>
      {risk > 0.7 ? '⚠️ 风险' : '✅ 健康'}
    </Badge>
  </CardHeader>
  <CardContent>
    <div>登录状态: {loginStatus}</div>
    <div>粉丝趋势: {followerTrend}</div>
    <div>风险评分: {(risk * 100).toFixed(0)}%</div>
  </CardContent>
</Card>
```

---

### 3.3 跨渠道素材资产库

**目标**：建立用户自己的内容资产，形成沉没成本

#### 3.3.1 数据模型

```sql
CREATE TABLE content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- 素材元信息
  asset_type TEXT NOT NULL, -- 'image', 'video', 'copy', 'template'
  source TEXT NOT NULL,     -- 'user_upload', 'ai_generated', 'remixed'
  original_source TEXT,     -- 溯源：'remixed_from:{asset_id}'

  -- 内容本体
  storage_url TEXT,
  thumbnail_url TEXT,
  raw_content TEXT,

  -- 使用统计
  usage_count INT DEFAULT 0,
  performance_score FLOAT DEFAULT 0,

  -- 标签系统
  tags JSONB DEFAULT '[]',
  ai_detected_objects JSONB DEFAULT '[]',

  -- 合规信息
  license_type TEXT DEFAULT 'owned',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE asset_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES content_assets(id),
  post_id TEXT,
  platform TEXT DEFAULT 'xiaohongshu',
  engagement_metrics JSONB DEFAULT '{}',
  used_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3.3.2 核心功能

- **智能推荐**：根据历史表现推荐最佳素材
- **跨平台复用**：同一素材可发布到多个平台
- **表现追踪**：记录每个素材的使用效果
- **版本管理**：支持素材迭代和 A/B 测试

---

### 3.4 用户模板库

**目标**：用户自建的高转化模板，比 AI 生成更有价值

#### 3.4.1 数据模型

```sql
CREATE TABLE user_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  template_type TEXT NOT NULL, -- 'title', 'description', 'cover_layout', 'hashtag_set'
  name TEXT NOT NULL,
  content JSONB NOT NULL,

  -- 效果追踪
  usage_count INT DEFAULT 0,
  avg_engagement FLOAT DEFAULT 0,
  performance_score FLOAT DEFAULT 0,

  is_public BOOLEAN DEFAULT FALSE, -- 未来可支持模板市场

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3.4.2 模板类型

| 类型 | 内容结构 | 使用场景 |
|-----|---------|---------|
| title | `{ pattern: string, variables: string[] }` | 标题生成 |
| description | `{ template: string, sections: string[] }` | 正文结构 |
| hashtag_set | `{ tags: string[], category: string }` | 标签组合 |
| cover_layout | `{ layout: string, elements: object[] }` | 封面设计 |

---

### 3.5 竞品雷达系统

**目标**：洞察市场动态，这是本地 Agent 难以实现的持续监控

#### 3.5.1 数据模型

```sql
CREATE TABLE competitor_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  competitor_xhs_id TEXT NOT NULL,
  competitor_name TEXT,

  -- 监控配置
  is_active BOOLEAN DEFAULT TRUE,
  check_frequency TEXT DEFAULT 'daily', -- 'hourly', 'daily', 'weekly'

  -- 累积数据
  content_history JSONB DEFAULT '[]',
  engagement_trends JSONB DEFAULT '{}',
  posting_schedule JSONB DEFAULT '{}',

  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3.5.2 洞察报告输出

```typescript
interface CompetitorInsight {
  trendingTopics: string[];      // 竞品都在发什么
  successfulFormats: string[];   // 高互动内容格式
  postingPatterns: object;       // 发布时间规律
  hashtagStrategies: string[];   // 标签策略
  contentGaps: string[];         // 差异化方向建议
}
```

#### 3.5.3 合规注意事项

- 仅采集公开可见数据
- 不存储竞品原始内容，只存储分析结果
- 提供用户授权和数据删除机制

---

### 3.6 平台规则引擎

**目标**：封装小红书平台特有规则，这是通用 AI 不了解的领域知识

#### 3.6.1 规则库结构

```typescript
// src/lib/xhs-rules-engine.ts
export const XHS_PLATFORM_RULES = {
  content: {
    titleMaxLength: 20,
    descMaxLength: 1000,
    hashtagLimit: 10,
    bannedKeywords: [...],      // 持续积累的敏感词库
    emojiBoostPatterns: [...],  // 提升曝光的 emoji 组合
  },
  timing: {
    goldenHours: ['7:00-9:00', '12:00-14:00', '18:00-22:00'],
    avoidHours: ['2:00-6:00'],
    weekendBoost: 1.3,
  },
  antiDetection: {
    minPostInterval: 4 * 60 * 60 * 1000,
    humanTypingSpeed: [50, 150],
    scrollPatterns: {...},
  }
};
```

#### 3.6.2 规则应用

- **内容预检**：发布前自动检查敏感词、长度限制
- **时间优化**：结合账号画像 + 平台规则确定发布时间
- **反检测**：模拟真人行为模式，降低封号风险

---

### 3.7 账号资产仪表盘

**目标**：让用户直观感知"数据资产"，提高迁移成本

#### 3.7.1 核心展示模块

```tsx
// src/pages/AccountAssets.tsx
export default function AccountAssets() {
  return (
    <div className="space-y-6">
      {/* 资产概览 */}
      <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold">您的账号资产</h2>
          <div className="grid grid-cols-4 gap-4 mt-4">
            <Stat label="累积数据天数" value="127天" />
            <Stat label="AI学习样本" value="3,421条" />
            <Stat label="优化迭代次数" value="89次" />
            <Stat label="素材资产" value="456个" />
          </div>
        </CardContent>
      </Card>

      {/* 迁移成本警示 */}
      <Alert variant="warning">
        <AlertTitle>迁移成本估算</AlertTitle>
        <AlertDescription>
          如果更换工具，您将损失：
          <ul className="list-disc ml-4 mt-2">
            <li>127天的算法学习数据</li>
            <li>89次策略优化记录</li>
            <li>预估需要4-6个月重新积累相同效果</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* 个性化策略 */}
      <Card>
        <CardHeader>
          <CardTitle>🎯 为您定制的策略</CardTitle>
        </CardHeader>
        <CardContent>
          <div>最佳发布时间: 周三 19:23（基于127天数据分析）</div>
          <div>最高互动内容类型: 教程类（比平均高47%）</div>
          <div>推荐标签组合: 专属优化</div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### 3.8 多账号矩阵支持

**目标**：支持一个用户管理多个小红书账号

#### 3.8.1 数据模型调整

```sql
-- 修改现有 xhs_user_mapping 支持一对多
ALTER TABLE xhs_user_mapping
ADD COLUMN account_alias TEXT,
ADD COLUMN is_primary BOOLEAN DEFAULT FALSE;

-- 创建账号组
CREATE TABLE xhs_account_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_uuid TEXT NOT NULL,
  group_name TEXT NOT NULL,
  account_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3.8.2 功能矩阵

| 功能 | 单账号 | 多账号矩阵 |
|-----|-------|-----------|
| 数据查看 | ✅ | ✅ 聚合视图 |
| 内容发布 | ✅ | ✅ 批量/轮发 |
| 策略设置 | ✅ | ✅ 模板复用 |
| 健康监控 | ✅ | ✅ 统一告警 |

---

## 四、架构决策

### 4.1 AI 能力抽象层

**原则**：Claude Code 可以是"大脑"，但"手脚"和"记忆"必须在我们手里

```python
# src/core/ai_provider.py
from abc import ABC, abstractmethod

class AIProvider(ABC):
    @abstractmethod
    async def generate_content(self, prompt: str, context: dict) -> str:
        pass

    @abstractmethod
    async def analyze_strategy(self, data: dict) -> dict:
        pass

class ClaudeProvider(AIProvider):
    async def generate_content(self, prompt: str, context: dict) -> str:
        # 调用 Claude API
        pass

class OpenAIProvider(AIProvider):
    async def generate_content(self, prompt: str, context: dict) -> str:
        # 调用 OpenAI API
        pass

# 使用
ai = ClaudeProvider()  # 可随时切换
```

### 4.2 桌面端规划

**当前决策**：暂不开发，但预留架构可能性

**触发条件**：
- 多账号矩阵需求明确
- 视频批量剪辑需求出现
- 浏览器插件限制成为瓶颈

**预留设计**：
- `xhs-worker` 设计为可独立运行的服务
- 配置项支持本地/云端切换
- API 设计兼容 Electron/Tauri 调用

---

## 五、实施路线图

### 5.1 优先级矩阵

| 优先级 | 模块 | 工作量 | 护城河价值 | 目标版本 |
|-------|------|-------|-----------|---------|
| P0 | 账号健康监控 | 2周 | ⭐⭐⭐⭐⭐ | v1.1 |
| P0 | 账号资产仪表盘 | 1周 | ⭐⭐⭐⭐⭐ | v1.1 |
| P0 | AI Provider 抽象层 | 1周 | ⭐⭐⭐⭐ | v1.1 |
| P1 | 多账号支持 | 2周 | ⭐⭐⭐⭐ | v1.2 |
| P1 | 数据采集增强(Extension) | 1周 | ⭐⭐⭐⭐ | v1.2 |
| P1 | 用户模板库 | 1周 | ⭐⭐⭐⭐ | v1.2 |
| P2 | 跨渠道素材库 | 3周 | ⭐⭐⭐⭐ | v1.3 |
| P2 | 平台规则引擎 | 2周 | ⭐⭐⭐⭐ | v1.3 |
| P2 | 竞品雷达(公开数据版) | 2周 | ⭐⭐⭐ | v1.3 |
| P3 | 桌面端 | 4周 | ⭐⭐⭐ | v2.0 |

### 5.2 里程碑

```
v1.1 (4周后)
├── 账号健康监控上线
├── 账号资产仪表盘上线
└── AI Provider 抽象层完成

v1.2 (8周后)
├── 多账号矩阵支持
├── Extension 数据采集增强
└── 用户模板库

v1.3 (12周后)
├── 跨渠道素材资产库
├── 平台规则引擎
└── 竞品雷达(基础版)

v2.0 (24周后)
├── 桌面端(视需求)
├── 团队协作增强
└── 私有知识库
```

---

## 六、成功指标

### 6.1 护城河有效性指标

| 指标 | 定义 | 目标值 |
|-----|------|-------|
| 数据积累深度 | 平均用户数据天数 | > 90天 |
| 功能粘性 | 用户使用监控/资产功能比例 | > 60% |
| 迁移率 | 月度流失到竞品的用户比例 | < 5% |
| NPS 评分 | 用户推荐意愿 | > 40 |

### 6.2 业务健康指标

| 指标 | 定义 | 目标值 |
|-----|------|-------|
| 多账号用户比例 | 管理 2+ 账号的用户占比 | > 30% |
| 付费转化率 | 免费用户转付费比例 | > 10% |
| 月活跃度 | 月内登录 ≥ 4 次的用户比例 | > 70% |

---

## 七、风险与应对

### 7.1 技术风险

| 风险 | 影响 | 应对策略 |
|-----|------|---------|
| 小红书接口变更 | 自动化失效 | 规则引擎解耦 + 快速适配机制 |
| AI 供应商限流/涨价 | 成本上升 | AI Provider 抽象层，多供应商备份 |
| 浏览器插件政策收紧 | Extension 下架 | 预留桌面端方案 |

### 7.2 竞争风险

| 风险 | 影响 | 应对策略 |
|-----|------|---------|
| 通用 Agent 能力增强 | 功能被替代 | 下沉到数据层和执行层 |
| 竞品抄袭功能 | 差异化减少 | 加速数据飞轮，形成规模效应 |
| 小红书官方推出工具 | 市场萎缩 | 强化多平台能力，不绑定单一平台 |

---

## 八、附录

### 8.1 相关文档

- [小红书集成架构](./xiaohongshu-integration/)
- [多用户架构设计](./MULTI_USER_ARCHITECTURE.md)
- [Token 消费系统](./TOKEN_CONSUMPTION_SYSTEM.md)

### 8.2 术语表

| 术语 | 定义 |
|-----|------|
| 护城河 | 阻止竞争对手复制的持久竞争优势 |
| 通用 Agent | 如 Claude Code，能执行任意任务的 AI 助手 |
| 垂直 SaaS | 专注特定行业/场景的软件服务 |
| 数据飞轮 | 数据越多 → 服务越好 → 用户越多 → 数据越多 |

### 8.3 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|-----|------|---------|------|
| v1.0 | 2026-01-16 | 初始版本 | Claude |

---

*本文档由 Claude 基于产品讨论整理生成*
