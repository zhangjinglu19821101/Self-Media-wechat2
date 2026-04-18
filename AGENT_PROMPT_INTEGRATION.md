# Agent 提示词集成使用指南

## 概述

本指南说明如何使用 Agent 提示词系统，确保每个 Agent 在调用 LLM 时都能加载自己的身份提示词。

## 核心功能

### 1. Agent 提示词加载器

位置：`src/lib/agents/prompt-loader.ts`

**功能**：
- 加载各个 Agent 的身份提示词文件（如 `insurance-d.md`、`B.md`）
- 缓存提示词以提高性能
- 检查 Agent 是否有提示词文件

**主要函数**：

```typescript
// 加载 Agent 提示词
loadAgentPrompt(agentId: string): string

// 检查 Agent 是否有提示词文件
hasAgentPrompt(agentId: string): boolean

// 清除缓存
clearPromptCache(agentId?: string)

// 获取支持的 Agent ID 列表
getSupportedAgentIds(): string[]
```

### 2. Agent LLM 调用函数

位置：`src/lib/agent-llm.ts`

**已集成提示词的函数**：

#### `agentSelfCheck(agentId, task)`
Agent 自检：检查是否能执行任务

**提示词加载**：
- 自动加载 Agent 的身份提示词
- 提示 Agent 检查是否符合自己的能力边界

**示例**：
```typescript
const result = await agentSelfCheck('insurance-d', {
  taskName: '撰写保险文章',
  commandContent: '...'
});

// 返回
{
  hasQuestions: false,
  questions: '',
  resolution: '没问题，可以开始'
}
```

#### `splitTaskForAgent(agentId, task)`
Agent 拆分任务

**提示词加载**：
- 自动加载 Agent 的身份提示词
- 提示 Agent 拆分符合自己业务边界的子任务

**示例**：
```typescript
const subtasks = await splitTaskForAgent('insurance-d', {
  taskName: '撰写保险文章',
  commandContent: '...'
});

// 返回
[
  {
    title: '收集保险素材',
    description: '...',
    acceptanceCriteria: '...'
  },
  // ...
]
```

#### `agentProvideSolution(agentId, problem, roundNumber)`
Agent 提供解决方案

**提示词加载**：
- 自动加载 Agent 的身份提示词
- 提示 Agent 基于自己的身份和能力提供解决方案

**示例**：
```typescript
const solution = await agentProvideSolution('B', '我遇到合规问题', 1);

// 返回
{
  suggestion: '...',
  isHelpful: true
}
```

#### `agentAnswerQuestion(agentId, question)`
Agent 回答问题

**提示词加载**：
- 自动加载 Agent 的身份提示词
- 提示 Agent 基于自己的身份和能力回答问题

**示例**：
```typescript
const answer = await agentAnswerQuestion('insurance-d', '如何撰写合规文章？');
```

## 提示词文件

### 位置
`src/lib/agents/prompts/`

### 文件命名规则
- Agent A: `A.md`
- Agent B: `B.md`
- Agent C: `C.md`
- Agent D: `D.md`
- 业务 Agent: `<agent-id>.md`（如 `insurance-d.md`、`insurance-c.md`）

### 提示词文件结构

```markdown
# Agent <id>：<角色名称>

## 身份
你是...，核心职责是...

## 核心职责
1. ...
2. ...
3. ...

## 能力边界
✅ 你可以做的：
- ...
- ...

❌ 你不应该做的：
- ...
- ...

## 业务规则
1. ...
2. ...
3. ...

## 沟通风格
- ...
- ...

## 示例场景
### 场景 1
```
...（对话示例）
```

## 输出格式
...

## 注意事项
- ...
```

## 集成流程

### 1. 创建 Agent 提示词文件

在 `src/lib/agents/prompts/` 目录下创建 `<agent-id>.md` 文件。

### 2. 更新 Agent ID 映射

在 `src/lib/agents/prompt-loader.ts` 中添加映射：

```typescript
const agentPromptFiles: Record<string, string> = {
  'A': 'A.md',
  'B': 'B.md',
  'your-new-agent': 'your-new-agent.md', // 添加这行
};
```

### 3. 使用 Agent LLM 函数

在任何地方调用 `agentSelfCheck`、`splitTaskForAgent` 等函数，它们会自动加载提示词。

```typescript
// 示例：在 API 中使用
const result = await agentSelfCheck('your-new-agent', task);
```

## 定时任务集成

### 已自动集成提示词的定时任务

#### 1. `/api/cron/check-pending-tasks`
- 使用 `agentSelfCheck` 函数
- 自动加载 executor 的身份提示词

#### 2. `/api/agents/B/intervene`
- 使用 `agentProvideSolution` 函数
- 自动加载 Agent B 的身份提示词

## 已创建的提示词文件

### 1. Agent B (`B.md`)
- **角色**：协调与沟通专家
- **核心职责**：协调各 Agent 之间的沟通，解决执行过程中的问题
- **能力边界**：
  - ✅ 提供合规规则、协调沟通、上报问题
  - ❌ 代替执行、凭空猜测、拖延上报
- **业务规则**：
  - 超过 10 轮沟通必须上报 Agent A
  - 检测到解决关键字（"OK"、"没问题"）则认为问题已解决
- **掌握的合规规则**：
  - 微信公众号敏感词管控
  - 内容规范
  - 保险行业规范

## 使用示例

### 示例 1：Agent 自检

```typescript
import { agentSelfCheck } from '@/lib/agent-llm';

const task = {
  taskName: '撰写保险文章',
  commandContent: '撰写一篇关于重疾险的文章，要求 1500-1600 字'
};

const result = await agentSelfCheck('insurance-d', task);

if (result.hasQuestions) {
  console.log('有疑问:', result.questions);
} else {
  console.log('没问题:', result.resolution);
}
```

### 示例 2：Agent 拆分任务

```typescript
import { splitTaskForAgent } from '@/lib/agent-llm';

const subtasks = await splitTaskForAgent('insurance-d', task);

subtasks.forEach((subtask, index) => {
  console.log(`步骤 ${index + 1}: ${subtask.title}`);
  console.log(`描述: ${subtask.description}`);
  console.log(`验收标准: ${subtask.acceptanceCriteria}`);
});
```

### 示例 3：Agent 提供解决方案

```typescript
import { agentProvideSolution } from '@/lib/agent-llm';

const solution = await agentProvideSolution('B', '文章中可以使用"最好"吗？', 1);

console.log('建议:', solution.suggestion);
console.log('是否有帮助:', solution.isHelpful);
```

## 缓存管理

### 自动缓存
提示词加载后会自动缓存，避免重复读取文件。

### 手动清除缓存

```typescript
import { clearPromptCache } from '@/lib/agents/prompt-loader';

// 清除特定 Agent 的缓存
clearPromptCache('insurance-d');

// 清除所有缓存
clearPromptCache();
```

## 注意事项

1. **提示词文件必须存在**：如果 Agent 的提示词文件不存在，会抛出错误
2. **使用 `hasAgentPrompt` 检查**：在调用 `loadAgentPrompt` 前，先用 `hasAgentPrompt` 检查
3. **缓存一致性**：修改提示词文件后，记得清除缓存
4. **Agent ID 映射**：新增 Agent 时，记得在 `prompt-loader.ts` 中添加映射
5. **提示词质量**：提示词的质量直接影响 Agent 的表现，请认真编写

## 后续工作

### TODO
- [ ] 集成真实的 LLM 调用（目前使用模拟数据）
- [ ] 配置定时任务调度（使用 node-cron 或外部调度器）
- [ ] 前端展示交互记录和实时对话窗口
- [ ] WebSocket 实时推送交互记录到页面

## 总结

通过集成 Agent 提示词系统，每个 Agent 都能：

1. ✅ 知道自己的身份和职责
2. ✅ 了解自己的能力边界
3. ✅ 遵循业务规则
4. ✅ 提供专业的解决方案

这样，Agent 的行为会更加一致和可靠，避免幻觉和不恰当的回复。
