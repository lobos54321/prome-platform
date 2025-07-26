# Dify Token 消耗监控和积分计算系统

## 概述

本系统实现了基于 Dify 工作流的精确 token 消耗监控和积分扣费功能，支持实时监控、自动扣费、余额保护等核心功能。

## 核心功能

### 1. Dify Message 监控系统
- 监听 Dify 工作流的 `message_end` 事件
- 提取 Token 数据：`input_tokens`、`output_tokens`、`model_name`、`total_tokens`
- 实时数据采集和处理

### 2. Token 消耗计算引擎
- 基于模型名称匹配管理员设置的定价规则
- 支持输入/输出 token 差异化计价
- 精确的整数运算，避免浮点数精度问题

### 3. 积分扣费系统
- 实时扣费：token 消耗计算完成后立即扣除积分
- 原子性操作：确保扣费的一致性
- 详细记录：记录每次扣费的完整信息

### 4. 余额保护机制
- AI 调用前检查用户积分余额
- 预估消耗：根据历史数据和模型价格预估
- 余额不足处理：阻止调用并提示充值

## 系统架构

### 核心组件

1. **DifyConsumptionTracker** (`src/lib/dify-consumption-tracker.ts`)
   - 处理 message_end 事件
   - 计算 token 消耗和积分扣费
   - 执行余额检查和扣费操作

2. **DifyAPI** (`src/api/dify-api.ts`)
   - 提供统一的 API 接口
   - 处理 webhook 请求
   - 余额检查和费用预估

3. **BalanceProtection** (`src/components/BalanceProtection.tsx`)
   - 用户界面组件
   - 显示余额状态和费用预估
   - 保护用户免于余额不足

4. **TokenConsumptionMonitor** (`src/pages/Admin/TokenConsumptionMonitor.tsx`)
   - 管理员监控界面
   - 实时查看消耗记录
   - 系统运行状态监控

### API 接口

1. **POST /api/dify/webhook**
   - 接收 Dify 的 token 消耗数据
   - 处理 message_end 事件
   - 执行实时积分扣费

2. **GET /api/user/points/estimate**
   - 预估积分消耗
   - 基于模型和 token 数量

3. **POST /api/user/points/check-balance**
   - 检查用户余额是否足够
   - 返回详细的余额信息

4. **GET /api/user/points/history**
   - 查看积分消耗历史
   - 支持分页和筛选

## 使用指南

### 1. 管理员配置

#### 模型价格配置
```typescript
// 访问管理后台 -> 模型管理
// 设置不同模型的输入/输出 token 价格
const modelConfig = {
  modelName: 'GPT-4',
  inputTokenPrice: 30,   // 每1000输入tokens = 30积分
  outputTokenPrice: 60,  // 每1000输出tokens = 60积分
  isActive: true
};
```

#### Webhook 配置
```typescript
// 在 Dify 中配置 webhook URL
const webhookConfig = {
  url: 'https://your-domain.com/api/dify/webhook',
  apiKey: 'prome_wh_key_123456',
  events: ['message_end']
};
```

### 2. 前端集成

#### 使用余额保护组件
```jsx
import BalanceProtection from '@/components/BalanceProtection';

function AIServicePage() {
  return (
    <div>
      <BalanceProtection
        modelName="GPT-4"
        estimatedInputTokens={1000}
        estimatedOutputTokens={500}
        onProceed={() => {
          // 执行 AI 调用
        }}
        onCancel={() => {
          // 取消操作
        }}
      />
    </div>
  );
}
```

#### 检查余额
```typescript
import { checkBalanceBeforeAI } from '@/api/dify-api';

const result = await checkBalanceBeforeAI('GPT-4', 1000, 500);
if (result.canProceed) {
  // 余额充足，可以调用 AI
} else {
  // 余额不足，提示充值
}
```

### 3. Webhook 数据格式

#### Dify message_end 事件格式
```json
{
  "event": "message_end",
  "data": {
    "conversation_id": "conv_123",
    "message_id": "msg_456", 
    "user_id": "user_789",
    "model_name": "gpt-4",
    "input_tokens": 1500,
    "output_tokens": 800,
    "total_tokens": 2300,
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "request_id": "req_abc123"
}
```

#### 响应格式
```json
{
  "success": true,
  "message": "Token consumption processed successfully",
  "data": {
    "consumptionId": "cons_xyz789",
    "pointsDeducted": 235,
    "tokensUsed": 2300
  }
}
```

## 管理员功能

### 1. 实时监控
- 访问管理后台 -> 消耗监控
- 查看实时 token 消耗记录
- 监控系统运行状态

### 2. 价格管理
- 访问管理后台 -> 模型管理
- 设置和调整模型价格
- 查看价格变更历史

### 3. 积分计算器
- 访问管理后台 -> 积分计算器
- 测试不同场景下的积分消耗
- 验证价格配置

## 安全特性

### 1. Webhook 验证
- API Key 验证
- 请求签名校验
- 重复请求去重

### 2. 原子性操作
- 余额检查和扣费的原子性
- 失败回滚机制
- 数据一致性保证

### 3. 审计日志
- 完整的操作记录
- 详细的错误日志
- 管理员操作跟踪

## 部署配置

### 1. 环境变量
```bash
# Supabase 配置
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key

# Dify 配置  
VITE_DIFY_API_KEY=your_dify_api_key
VITE_DIFY_API_URL=https://api.dify.ai/v1
```

### 2. 数据库迁移
```sql
-- 运行 supabase/migrations/ 下的迁移文件
-- 确保 token_usage 表包含所需字段
```

### 3. 服务器配置
```javascript
// 使用提供的 Express.js 路由
import difyRoutes from './server/dify-routes';
app.use(difyRoutes);
```

## 故障排除

### 1. 常见问题

**问题：Webhook 接收失败**
- 检查 API Key 配置
- 验证 URL 可访问性
- 查看服务器日志

**问题：积分扣费不准确**
- 检查模型价格配置
- 验证 token 数据格式
- 确认计算逻辑

**问题：余额检查失败**
- 检查用户数据完整性
- 验证数据库连接
- 查看错误日志

### 2. 调试模式
```typescript
// 启用详细日志
console.log('Processing webhook:', payload);
console.log('Calculated consumption:', consumption);
console.log('Balance after deduction:', newBalance);
```

## 性能优化

### 1. 缓存策略
- 模型价格配置缓存
- 用户余额缓存
- API 响应缓存

### 2. 异步处理
- Webhook 异步处理
- 批量数据库操作
- 后台任务队列

### 3. 监控指标
- 处理延迟监控
- 错误率统计
- 资源使用情况

## 未来扩展

### 1. 多模型支持
- 扩展更多 AI 模型
- 统一价格管理
- 跨平台集成

### 2. 高级分析
- 使用模式分析
- 成本优化建议
- 预测性维护

### 3. 企业功能
- 团队管理
- 预算控制
- 报表导出