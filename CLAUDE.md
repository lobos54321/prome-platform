# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 6A工作流执行规则 (Structure Framework)

### 阶段1: Align (对齐阶段)
**目标**: 模糊需求 → 精确规范

1. **项目上下文分析** - 分析现有项目结构、技术栈、架构模式、依赖关系
2. **需求理解确认** - 创建 `docs/任务名/ALIGNMENT_[任务名].md`
3. **智能决策策略** - 自动识别歧义和不确定性，生成结构化问题清单
4. **中断并询问关键决策点** - 主动中断询问，迭代执行智能决策策略
5. **最终共识** - 生成 `docs/任务名/CONSENSUS_[任务名].md`

### 阶段2: Architect (架构阶段)
**目标**: 共识文档 → 系统架构 → 模块设计 → 接口规范

生成 `docs/任务名/DESIGN_[任务名].md` 包含:
- 整体架构图(mermaid绘制)
- 分层设计和核心组件
- 模块依赖关系图
- 接口契约定义

### 阶段3: Atomize (原子化阶段)
**目标**: 架构设计 → 拆分任务 → 明确接口 → 依赖关系

生成 `docs/任务名/TASK_[任务名].md`，每个原子任务包含:
- 输入契约(前置依赖、输入数据、环境依赖)
- 输出契约(输出数据、交付物、验收标准)
- 实现约束(技术栈、接口规范、质量要求)

### 阶段4: Approve (审批阶段)
**目标**: 原子任务 → 人工审查 → 迭代修改 → 按文档执行

执行检查清单：完整性、一致性、可行性、可控性、可测性

### 阶段5: Automate (自动化执行)
**目标**: 按节点执行 → 编写测试 → 实现代码 → 文档同步

创建 `docs/任务名/ACCEPTANCE_[任务名].md` 记录完成情况

### 阶段6: Assess (评估阶段)
**目标**: 执行结果 → 质量评估 → 文档更新 → 交付确认

生成最终交付物：`FINAL_[任务名].md` 和 `TODO_[任务名].md`

## Development Guidelines (Process Framework)

### Philosophy

#### Core Beliefs
- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study and plan before implementing
- **Pragmatic over dogmatic** - Adapt to project reality
- **Clear intent over clever code** - Be boring and obvious

#### Simplicity Means
- Single responsibility per function/class
- Avoid premature abstractions
- No clever tricks - choose the boring solution
- If you need to explain it, it's too complex

### Process

#### 1. Planning & Staging
Break complex work into 3-5 stages. Document in `IMPLEMENTATION_PLAN.md`:

```markdown
## Stage N: [Name]
**Goal**: [Specific deliverable]
**Success Criteria**: [Testable outcomes]
**Tests**: [Specific test cases]
**Status**: [Not Started|In Progress|Complete]
```

#### 2. Implementation Flow
1. **Understand** - Study existing patterns in codebase
2. **Test** - Write test first (red)
3. **Implement** - Minimal code to pass (green)
4. **Refactor** - Clean up with tests passing
5. **Commit** - With clear message linking to plan

#### 3. When Stuck (After 3 Attempts)
**CRITICAL**: Maximum 3 attempts per issue, then STOP.

1. **Document what failed** - What you tried, specific error messages, why you think it failed
2. **Research alternatives** - Find 2-3 similar implementations, note different approaches
3. **Question fundamentals** - Is this the right abstraction level? Can this be split? Is there a simpler approach?
4. **Try different angle** - Different library feature? Different architectural pattern?

## Project-Specific Context

### Development Commands

```bash
# Start development servers
pnpm run dev          # Frontend dev server (port 5173)
node server.js        # Backend API server (port 8080)

# Build and deployment
pnpm run build        # Build for production
pnpm run lint         # Lint codebase
pnpm install          # Install dependencies
```

### Architecture Overview

**Dify-integrated AI marketing content generation platform** with:

#### Core Architecture
- **Frontend**: Vite + React + TypeScript + Tailwind CSS with shadcn/ui
- **Backend**: Express.js API proxy for Dify integration
- **Database**: Supabase for user management and conversation history
- **AI Integration**: Dify ChatFlow workflows for marketing content generation

#### Critical Dify Integration Patterns

**Conversation ID Management**:
- Frontend sends `conversation_id: null` for new conversations
- Backend detects null and creates fresh conversation in Dify
- State persisted in localStorage as `dify_conversation_id`

**User ID Handling**:
- Generate unique user IDs: `fresh-user-${Date.now()}-${randomString}`
- Store in localStorage as `dify_user_id`
- Critical for Dify workflow variable isolation

**Workflow Routing Constraints**:
- Dify uses conversation variables to track workflow state
- Once conversation variables are set, they cannot be reset via API
- Regenerating responses may jump to wrong workflow nodes

#### Marketing Workflow Stages
1. Information collection (4 pieces of product info)
2. Pain point generation (LLM0 → 3 pain point options)
3. Pain point refinement (LLM3 → content modifications)

**Critical Workflow Buttons**:
- "Start Generating Pain Points" appears when response contains `COMPLETENESS: 4`
- Pain point buttons (1,2,3) appear when response contains `"problem":` and `"justification":`
- Use `handleWorkflowButtonClick()` to send Chinese phrases triggering workflow stages

### Environment Configuration

Essential variables (see `.env.example`):
```env
# Dify Integration (required)
VITE_DIFY_API_URL=https://api.dify.ai/v1
VITE_DIFY_APP_ID=your_app_id
VITE_DIFY_API_KEY=your_api_key

# Supabase (required)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

### Known Technical Constraints

**Dify API Limitations**:
- No message regeneration API - must create new conversations for clean regeneration
- Conversation variables cannot be reset or modified
- Regenerating workflow messages may route to wrong nodes

**Critical Files**:
- `src/components/chat/DifyChatInterface.tsx` - Main chat interface with workflow logic
- `server.js` - API proxy with conversation ID handling

**NEVER modify conversation_id handling without understanding impact on workflow routing.**

## Decision Framework

When multiple approaches exist, choose based on:
1. **Testability** - Can I easily test this?
2. **Readability** - Will someone understand this in 6 months?
3. **Consistency** - Does this match existing Dify integration patterns?
4. **Simplicity** - Is this the simplest solution that works?
5. **Workflow Compatibility** - Will this break Dify conversation routing?