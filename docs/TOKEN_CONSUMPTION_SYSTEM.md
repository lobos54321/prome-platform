# Token消耗管理系统实现文档

## 系统概述

本系统实现了完整的Dify iframe集成和Token消耗管理功能，包括实时监控、积分扣费、模型定价配置等核心功能。

## 功能特性

### 1. 环境变量控制
- 通过 `VITE_ENABLE_DIFY_INTEGRATION=true` 启用Dify集成功能
- 当未启用时，相关组件显示友好的提示信息

### 2. 实时iframe通信监听
- **DifyIframeMonitor类** (`src/lib/dify-iframe-monitor.ts`)
- 监听Dify iframe的 `message_end` 事件
- 支持跨域安全验证
- 防重复处理和速率限制保护
- 实时计算Token成本并扣除用户积分

### 3. 管理员模型配置界面
- **ModelManagement组件** (`src/pages/Admin/ModelManagement.tsx`)
- 数据库持久化的模型定价配置
- 支持输入/输出Token差异化定价
- 汇率设置功能 (1美元 = X积分)
- 价格历史记录追踪

### 4. 用户Token仪表板
- **TokenDashboard组件** (`src/pages/TokenDashboard.tsx`)
- 实时显示用户积分余额
- 今日/本月消费统计
- Token使用历史记录
- 实时监控状态指示器

### 5. 数据库支持
- **增强的DatabaseService** (`src/lib/supabase.ts`)
- 模型配置管理方法
- 汇率管理和历史记录
- 增强的Token使用记录
- 安全的余额扣除机制

## 技术架构

### 核心组件

1. **DifyIframeMonitor**
   - 监听iframe postMessage事件
   - Token消费计算引擎
   - 实时余额扣除
   - 事件防重和限流

2. **ModelManagement**
   - 管理员专用界面
   - 模型定价配置
   - 汇率管理
   - 数据库持久化

3. **TokenDashboard**
   - 用户积分展示
   - 使用统计分析
   - 实时监控状态
   - 历史记录查看

4. **DatabaseService增强**
   - `getModelConfigs()` - 获取模型配置
   - `addModelConfig()` - 添加模型配置
   - `updateModelConfig()` - 更新模型配置
   - `getCurrentExchangeRate()` - 获取当前汇率
   - `updateExchangeRate()` - 更新汇率
   - `deductUserBalance()` - 扣除用户余额
   - `addTokenUsageWithModel()` - 记录详细使用

### 数据流程

```
1. 用户在Dify iframe中进行AI对话
2. Dify触发message_end事件 (包含token使用数据)
3. DifyIframeMonitor捕获事件
4. 根据模型配置计算积分成本
5. 验证用户余额并扣除积分
6. 记录使用历史到数据库
7. 更新前端界面显示
```

### 安全机制

- **防重复处理**: 基于conversationId+messageId+totalTokens的唯一标识
- **速率限制**: 最小1秒间隔防止恶意快速请求
- **余额保护**: 余额不足时拒绝扣费
- **最大扣费限制**: 单次最大扣费额度保护
- **跨域验证**: 仅允许可信域名的iframe事件

## 数据库架构

### 新增表结构

```sql
-- 模型配置表
model_configs:
  - id (UUID, 主键)
  - model_name (TEXT, 唯一)
  - input_token_price (DECIMAL, USD/1000 tokens)
  - output_token_price (DECIMAL, USD/1000 tokens)
  - is_active (BOOLEAN)
  - created_by (UUID, 管理员ID)
  - created_at, updated_at (TIMESTAMP)

-- 汇率表
exchange_rates:
  - id (UUID, 主键)
  - rate (INTEGER, 积分/USD)
  - is_active (BOOLEAN)
  - created_by (UUID, 管理员ID)
  - created_at, updated_at (TIMESTAMP)

-- 汇率历史表
exchange_rate_history:
  - id (UUID, 主键)
  - old_rate, new_rate (INTEGER)
  - admin_id (UUID)
  - reason (TEXT)
  - timestamp (TIMESTAMP)
```

### 增强的token_usage表

新增字段:
- `model` - AI模型名称
- `input_tokens` - 输入token数量
- `output_tokens` - 输出token数量
- `input_cost` - 输入成本
- `output_cost` - 输出成本
- `conversation_id` - 对话ID
- `message_id` - 消息ID

## 使用指南

### 1. 环境配置

```bash
# 启用Dify集成
VITE_ENABLE_DIFY_INTEGRATION=true

# 配置Supabase (必需)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

### 2. 数据库初始化

运行 `supabase/schema.sql` 创建必要的表结构和默认数据。

### 3. 管理员配置

1. 访问 `/admin` 页面
2. 在"模型管理"标签中配置AI模型定价
3. 设置合适的汇率 (如: 1 USD = 10000 积分)

### 4. 用户使用

1. 用户访问 `/token-dashboard` 查看余额和使用情况
2. 在包含Dify iframe的页面中正常使用AI服务
3. 系统自动监控并扣除积分

### 5. 测试功能

访问 `/dify-test` 页面进行功能测试:
- 启动iframe事件监听
- 模拟Token消费事件
- 观察余额变化和事件记录

## 文件结构

```
src/
├── lib/
│   ├── supabase.ts              # 增强的数据库服务
│   └── dify-iframe-monitor.ts   # iframe监听器
├── pages/
│   ├── TokenDashboard.tsx       # 用户Token仪表板
│   ├── DifyTestPage.tsx         # 测试页面
│   └── Admin/
│       └── ModelManagement.tsx # 管理员模型配置
└── types/
    └── index.ts                 # 类型定义
```

## 部署注意事项

1. **数据库迁移**: 确保运行schema.sql创建新表
2. **环境变量**: 正确配置Supabase和Dify集成开关
3. **域名配置**: 在DifyIframeMonitor中添加生产域名
4. **默认数据**: 系统会自动创建默认汇率和模型配置

## 监控和维护

- 定期检查exchange_rate_history表监控汇率变更
- 监控token_usage表的数据增长
- 关注用户余额变化和充值需求
- 检查模型定价是否需要调整

## 扩展功能

未来可以考虑的扩展:
- 批量导入模型配置
- 用户消费预警机制
- 更详细的使用分析报告
- API接口支持外部系统集成