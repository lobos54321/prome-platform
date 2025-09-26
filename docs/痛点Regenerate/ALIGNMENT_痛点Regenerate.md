# ALIGNMENT_痛点Regenerate.md

## 原始需求
用户在三个痛点生成后，点击regenerate按钮应该：
- 保留原有痛点在对话中
- 生成完全不同的痛点选项
- 创建真正的分支对话，让用户可以比较不同痛点方案

## 边界确认
**范围内**:
- 痛点阶段的regenerate功能
- 创建新的对话分支
- 保持原有痛点可见

**范围外**:
- 修改Dify工作流本身
- 重置conversation variables的API开发
- 其他阶段的regenerate（目前正常工作）

## 现有项目理解
- 使用Dify ChatFlow工作流，包含conversation variables状态跟踪
- 前端: React + TypeScript，主要逻辑在 `DifyChatInterface.tsx`
- 后端: Express.js代理，处理conversation ID管理
- 已有基础regenerate功能，但被Dify conversation variables状态影响

## 疑问澄清
1. **Dify API限制**: 没有重置conversation variables的API
2. **当前实现问题**: regenerate重新发送消息时，Dify根据现有状态跳到LLM3
3. **分支创建需求**: 需要真正的对话分支，而不是替换原有内容

## 技术约束
- 必须保持现有conversation ID处理逻辑
- 不能破坏工作流路由
- 需要与现有UI组件集成
- 要保持与shadcn/ui设计一致性