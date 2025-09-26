# 🔧 DIFY 工作流修复指令

## 🎯 立即执行的修复步骤

### 1. 进入DIFY工作流编辑界面

1. 登录DIFY平台：https://dify.ai
2. 进入"营销文案（通用版）"应用
3. 点击"编辑工作流"

### 2. 定位问题节点

**查找以下节点**:
- ✅ "LLM 18" 节点 (信息收集助手)
- ✅ 条件分支节点 (决定是否继续收集信息)
- ✅ 变量赋值节点 (更新 conversation.info_completeness)

### 3. 修复 "LLM 18" 节点

**当前错误的提示词**:
```
当前收集进度: {{conversation.info_completeness}}/4
```

**修复为**:
```
当前收集进度: {{conversation.info_completeness}}/4

🔍 重要：确保输出格式为 "COMPLETENESS: X/4" 而不是 "COMPLETENESS: X"
```

### 4. 修复条件分支逻辑

**查找条件分支节点，确保逻辑为**:
```yaml
IF {{conversation.info_completeness}} < 4:
  → 继续信息收集 (连接到下一个信息收集节点)
ELSE:
  → 开始文案生成 (连接到文案生成节点)
```

**❌ 错误的条件可能是**:
```yaml
IF {{conversation.info_completeness}} >= 1:  # 这会在第一个信息后就跳转
  → 开始文案生成
```

### 5. 修复变量更新逻辑

**查找变量赋值节点，确保是递增而不是重置**:

```yaml
# ✅ 正确的逻辑
conversation.info_completeness = {{conversation.info_completeness}} + 1

# ❌ 错误的逻辑 (会导致重置)
conversation.info_completeness = 1
```

### 6. 检查节点连接

确保信息收集的流程连接正确：

```
开始 → LLM18(收集助手) → 条件判断 → [收集完成?]
                                    ↙        ↘
                               [否]继续收集    [是]生成文案
                                    ↓
                                更新completeness
                                    ↓
                                返回LLM18
```

## 🧪 快速验证

修复完成后：

1. **保存工作流**
2. **发布新版本**
3. **在DIFY界面测试对话**:
   ```
   用户: 你好
   AI: COMPLETENESS: 0 您好！请介绍...
   
   用户: 我的产品是AI编程助手  
   AI: COMPLETENESS: 1/4 已了解...请说明特色
   
   用户: 主要特色是代码生成
   AI: COMPLETENESS: 2/4 已了解特色...请说明用户群体
   ```

## 🚨 关键检查点

1. **COMPLETENESS格式**: 必须是 "X/4" 格式
2. **条件分支**: 必须检查 `< 4` 而不是 `>= 1`
3. **变量递增**: 使用 `+1` 而不是赋值为固定数字
4. **节点连接**: 确保信息收集形成正确的循环

## 📞 如需协助

如果在DIFY界面中找不到具体节点：

1. 查看工作流的"节点列表"
2. 搜索包含"COMPLETENESS"的节点
3. 检查所有LLM节点的系统提示词
4. 查看所有条件分支节点的判断条件

修复完成后，运行 `node blocking-mode-test.js` 验证结果。