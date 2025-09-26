# CONSENSUS_痛点Regenerate.md

## 明确的需求描述和验收标准

### 核心需求
实现痛点消息的智能regenerate功能，创建真正的对话分支来生成不同痛点选项。

### 验收标准
1. **分支创建**: 点击痛点regenerate后，原痛点保留，下方显示新的痛点选项
2. **内容差异**: 新生成的痛点与原痛点内容完全不同
3. **UI一致性**: 新痛点也有对应的选择按钮(1,2,3)
4. **状态独立**: 新分支不影响原有对话的workflow状态
5. **不破坏路由**: 现有conversation ID处理逻辑保持完整

## 技术实现方案

### 选定方案: 新Conversation + UI分支显示
基于Dify API限制分析，采用以下技术方案：

1. **保留原消息**: 不删除现有痛点消息
2. **创建新conversation**: 使用新的conversation_id和user_id确保状态隔离
3. **智能prompt路由**: 使用特殊构造的prompt直接触发痛点生成，绕过信息收集阶段
4. **UI分支标记**: 添加清晰的分支标识符区分不同的痛点组

### 技术约束和集成方案
- **保持现有API结构**: 不修改server.js的核心conversation ID逻辑
- **使用现有UI组件**: 复用shadcn/ui按钮和图标组件
- **遵循现有模式**: 使用现有的`sendMessageWithRetry`和状态管理模式

## 任务边界限制
- **只处理痛点regenerate**: 其他阶段的regenerate保持现有逻辑
- **不修改Dify工作流**: 通过prompt工程而非工作流修改解决
- **保持向下兼容**: 现有功能不受影响

## 确认所有不确定性已解决
1. ✅ **Dify API限制已确认**: 无法重置conversation variables，必须创建新conversation
2. ✅ **UI展现方式已确定**: 在同一对话流中显示分支，使用标记区分
3. ✅ **技术实现路径已明确**: 新conversation + 智能prompt路由
4. ✅ **验收标准已具体化**: 可测试的功能指标