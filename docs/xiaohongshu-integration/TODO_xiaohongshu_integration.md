# 小红书自动化系统集成 - 待办事项

> **状态**：🚧 需要配置和测试  
> **优先级**：P0 (必须完成)  
> **预计时间**：30-60分钟

---

## 🚨 立即需要做的事情

### 1. 添加路由配置 ⚠️ **必须**

**文件**：`src/App.tsx`

**操作**：添加小红书自动化页面路由

```tsx
import XiaohongshuAutomation from '@/pages/XiaohongshuAutomation';

// 在路由配置中添加
<Route path="/xiaohongshu" element={<XiaohongshuAutomation />} />
```

**如何做**：
1. 打开 `src/App.tsx`
2. 在imports部分添加组件导入
3. 在路由配置中添加路由规则
4. 保存文件

---

### 2. 验证数据库 ⚠️ **必须**

**确认事项**：
- [ ] Supabase项目已创建
- [ ] 已执行 `supabase/migrations/20251031_xiaohongshu_schema.sql`
- [ ] 7个表已创建：
  - `xhs_user_mapping`
  - `xhs_user_profiles`
  - `xhs_content_strategies`
  - `xhs_daily_tasks`
  - `xhs_weekly_plans`
  - `xhs_activity_logs`
  - `xhs_automation_status`
- [ ] RLS策略已启用

**如何检查**：
```sql
-- 在Supabase SQL Editor中运行
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns 
        WHERE table_name = t.table_name AND table_schema = 'public') as columns
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name LIKE 'xhs_%'
ORDER BY table_name;
```

**预期结果**：应该看到7个表和它们的列数

---

### 3. 验证后端API ⚠️ **必须**

**后端地址**：`https://xiaohongshu-automation-ai.zeabur.app`

**测试方法**：

```bash
# 1. 健康检查
curl https://xiaohongshu-automation-ai.zeabur.app/health

# 2. 测试登录状态检查 (替换YOUR_USER_ID)
curl "https://xiaohongshu-automation-ai.zeabur.app/agent/xiaohongshu/login/status?userId=test-user-123"
```

**预期响应**：
- 健康检查应返回 200 OK
- 登录状态检查应返回JSON响应

**如果后端不可用**：
- 需要启动 xiaohongshumcp 后端服务
- 或更新前端代码中的 `baseURL`

---

### 4. 启动开发服务器 ⚠️ **必须**

```bash
cd /Users/boliu/prome-platform
npm run dev
```

**访问页面**：
```
http://localhost:5173/xiaohongshu
```

---

### 5. 测试完整流程 ⚠️ **必须**

#### Step 1: 用户登录
- [ ] 使用测试账号登录prome-platform
- [ ] 记录Supabase UUID

#### Step 2: 访问小红书页面
- [ ] 访问 `/xiaohongshu`
- [ ] 查看是否自动生成 xhs_user_id
- [ ] 检查浏览器控制台是否有错误

#### Step 3: 测试登录流程
- [ ] 点击"一键自动登录"
- [ ] 查看是否显示二维码
- [ ] 使用小红书App扫码（如有条件）
- [ ] 或尝试"手动导入Cookie"

#### Step 4: 配置产品信息
- [ ] 填写产品信息表单
- [ ] 点击"保存配置"
- [ ] 验证Supabase中是否保存成功

#### Step 5: 启动自动运营
- [ ] 点击"启动自动运营"
- [ ] 查看是否跳转到仪表盘
- [ ] 验证状态是否正确显示

#### Step 6: 验证数据持久化
```sql
-- 在Supabase SQL Editor中检查
SELECT * FROM xhs_user_mapping LIMIT 5;
SELECT * FROM xhs_user_profiles LIMIT 5;
SELECT * FROM xhs_automation_status LIMIT 5;
SELECT * FROM xhs_activity_logs ORDER BY created_at DESC LIMIT 10;
```

---

## 📋 可选配置

### 1. 添加导航菜单入口 (推荐)

在主导航中添加小红书入口，方便用户访问。

### 2. 配置环境变量

如果后端API地址不同，在 `.env` 中添加：
```env
VITE_XIAOHONGSHU_API_URL=your-backend-url
```

然后更新 `src/lib/xiaohongshu-backend-api.ts`:
```typescript
private readonly baseURL = import.meta.env.VITE_XIAOHONGSHU_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app';
```

### 3. 添加权限控制

如果需要限制访问，可以添加权限检查：
```typescript
// 在 XiaohongshuAutomation.tsx 中
if (!user.hasPremiumAccess) {
  navigate('/pricing');
  return;
}
```

---

## 🐛 常见问题排查

### 问题1: 页面无法访问
**症状**：访问 `/xiaohongshu` 显示404

**解决**：
1. 检查路由是否正确添加
2. 检查React Router版本兼容性
3. 查看浏览器控制台错误信息

### 问题2: TypeScript编译错误
**症状**：运行时出现类型错误

**解决**：
```bash
# 清理并重新编译
npm run build

# 查看详细错误
npx tsc --noEmit
```

### 问题3: 数据库连接失败
**症状**：操作失败，控制台显示数据库错误

**解决**：
1. 检查Supabase URL和API Key配置
2. 检查RLS策略是否正确
3. 查看Supabase日志

### 问题4: 后端API调用失败
**症状**：API请求超时或返回错误

**解决**：
1. 验证后端服务是否运行
2. 检查CORS配置
3. 查看网络请求详情 (F12 → Network)

### 问题5: 用户映射创建失败
**症状**：无法生成 xhs_user_id

**解决**：
1. 检查用户是否已登录
2. 查看 `xhs_user_mapping` 表权限
3. 检查RLS策略

---

## 📞 获取帮助

### 查看日志

**浏览器控制台**：
```javascript
// 查看所有日志
localStorage.getItem('debug')

// 启用调试模式
localStorage.setItem('debug', 'xiaohongshu:*')
```

**Supabase日志**：
1. 访问 Supabase Dashboard
2. 进入项目设置
3. 查看日志和API请求记录

### 文档参考

- **架构设计**：`docs/xiaohongshu-integration/DESIGN_xiaohongshu_integration.md`
- **API文档**：`docs/xiaohongshu-integration/CONSENSUS_xiaohongshu_integration.md`
- **任务列表**：`docs/xiaohongshu-integration/TASK_xiaohongshu_integration.md`

---

## ✅ 完成清单

复制以下清单跟踪进度：

```markdown
## 配置清单

### 必须完成 (P0)
- [ ] 添加路由配置到 App.tsx
- [ ] 验证数据库表已创建
- [ ] 验证RLS策略已启用
- [ ] 测试后端API连通性
- [ ] 启动开发服务器
- [ ] 测试登录流程
- [ ] 测试配置保存
- [ ] 测试自动运营启动
- [ ] 验证数据持久化

### 推荐完成 (P1)
- [ ] 添加导航菜单入口
- [ ] 配置环境变量
- [ ] 添加权限控制
- [ ] 编写使用文档

### 可选完成 (P2)
- [ ] 添加单元测试
- [ ] 添加E2E测试
- [ ] 性能优化
- [ ] 添加监控告警
```

---

**创建时间**：2025-10-31 04:15 UTC  
**优先级**：P0  
**预计完成时间**：30-60分钟
