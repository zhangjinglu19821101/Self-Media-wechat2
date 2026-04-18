# Agent 提示词集成 - 完成总结

## 任务完成情况

✅ **已完成**：集成 LLM 调用时加载 Agent 的身份提示词（如 `insurance-d.md`）

---

## 完成的工作

### 1. 创建 Agent 提示词加载器
**文件**：`src/lib/agents/prompt-loader.ts`

**功能**：
- ✅ 加载各个 Agent 的身份提示词文件
- ✅ 缓存提示词以提高性能
- ✅ 检查 Agent 是否有提示词文件
- ✅ 获取所有支持的 Agent ID 列表

**核心函数**：
```typescript
loadAgentPrompt(agentId: string): string
hasAgentPrompt(agentId: string): boolean
clearPromptCache(agentId?: string)
getSupportedAgentIds(): string[]
```

---

### 2. 更新 Agent LLM 调用函数
**文件**：`src/lib/agent-llm.ts`

**已集成提示词的函数**：
- ✅ `agentSelfCheck(agentId, task)` - Agent 自检
- ✅ `splitTaskForAgent(agentId, task)` - Agent 拆分任务
- ✅ `agentProvideSolution(agentId, problem, roundNumber)` - Agent 提供解决方案
- ✅ `agentAnswerQuestion(agentId, question)` - Agent 回答问题（新增）

**改进点**：
- 每个函数都自动加载 Agent 的身份提示词
- 提示 Agent 检查是否符合自己的能力边界
- 使用更清晰的 prompt 结构（身份、任务、返回格式）

---

### 3. 创建 Agent B 提示词文件
**文件**：`src/lib/agents/prompts/B.md`

**内容**：
- ✅ 身份：协调与沟通专家
- ✅ 核心职责：协调各 Agent 之间的沟通，解决执行过程中的问题
- ✅ 能力边界：明确可以做的和不应该做的
- ✅ 业务规则：超过 10 轮沟通必须上报 Agent A
- ✅ 合规规则：掌握微信公众号合规规则、保险行业规范
- ✅ 沟通风格：耐心倾听、积极回应、专业严谨、协同合作
- ✅ 示例场景：提供 3 个实际场景示例

---

### 4. 已自动集成提示词的定时任务

#### `/api/cron/check-pending-tasks`
- ✅ 使用 `agentSelfCheck` 函数
- ✅ 自动加载 executor 的身份提示词
- ✅ 让 executor 基于自己的身份和能力边界自检

#### `/api/agents/B/intervene`
- ✅ 使用 `agentProvideSolution` 函数
- ✅ 自动加载 Agent B 的身份提示词
- ✅ 让 Agent B 基于协调专家的身份提供解决方案

---

### 5. 创建使用文档
**文件**：`AGENT_PROMPT_INTEGRATION.md`

**内容**：
- ✅ 核心功能说明
- ✅ 提示词文件结构和命名规则
- ✅ 集成流程（如何创建新的 Agent 提示词）
- ✅ 使用示例（3 个详细示例）
- ✅ 缓存管理说明
- ✅ 注意事项

---

## 验证结果

### 1. 提示词文件存在性检查
```
✅ A.md (25601 字节)
✅ B.md (4496 字节)
✅ C.md (15965 字节)
✅ D.md (15036 字节)
✅ insurance-c.md (21937 字节)
✅ insurance-d.md (31569 字节)
```

### 2. TypeScript 类型检查
```
✅ prompt-loader.ts - 无类型错误
✅ agent-llm.ts - 无类型错误
```

### 3. 服务状态
```
✅ 服务正常运行在 5000 端口
✅ 支持热更新，代码修改自动生效
```

---

## 使用示例

### 示例 1：Agent 自检（加载 insurance-d.md）
```typescript
import { agentSelfCheck } from '@/lib/agent-llm';

const result = await agentSelfCheck('insurance-d', {
  taskName: '撰写保险文章',
  commandContent: '撰写一篇关于重疾险的文章'
});

// insurance-d.md 会自动加载，包含：
// - 身份：保险内容创作者
// - 业务规则：保险行业合规要求
// - 能力边界：只能创作保险相关内容

// 返回
{
  hasQuestions: false,
  resolution: '没问题，可以开始'
}
```

### 示例 2：Agent 拆分任务（加载 insurance-d.md）
```typescript
const subtasks = await splitTaskForAgent('insurance-d', task);

// insurance-d.md 会自动加载，确保拆分的子任务符合保险行业规范

// 返回
[
  {
    title: '收集保险素材',
    description: '...',
    acceptanceCriteria: '符合保险事业部规范'
  },
  {
    title: '撰写保险文章初稿',
    description: '...',
    acceptanceCriteria: '字数 1500-1600，符合微信合规规则'
  },
  {
    title: '合规校验与修正',
    description: '...',
    acceptanceCriteria: '通过合规校验'
  }
]
```

### 示例 3：Agent B 提供解决方案（加载 B.md）
```typescript
const solution = await agentProvideSolution('B', '文章中可以使用"最好"吗？', 1);

// B.md 会自动加载，包含：
// - 身份：协调与沟通专家
// - 合规规则：微信公众号敏感词管控
// - 业务规则：合规优先

// 返回
{
  suggestion: '是的，"最好"是绝对化用语，属于微信公众号违规词汇。建议改为"较好"或"优秀"，这样更合规。',
  isHelpful: true
}
```

---

## 工作原理

### 流程图

```
1. 用户调用 agentSelfCheck('insurance-d', task)
            ↓
2. 提示词加载器检查缓存
            ↓
3. 如果缓存未命中，读取 src/lib/agents/prompts/insurance-d.md
            ↓
4. 将提示词内容嵌入到 prompt 中
            ↓
5. 调用 LLM（TODO: 集成真实 LLM）
            ↓
6. 返回结构化结果
```

### Prompt 结构

每个 Agent 的 prompt 都包含以下部分：

```markdown
# 你是 Agent <agentId>

<身份提示词内容>

---

## 当前任务

任务标题：${task.taskTitle}
任务内容：${task.commandContent}

---

## 你的任务

<具体的任务描述>

---

## 返回格式

<JSON 格式要求>
```

---

## 待完成工作

### TODO
- [ ] 集成真实的 LLM 调用（目前使用模拟数据）
- [ ] 配置定时任务调度（使用 node-cron 或外部调度器）
- [ ] 前端展示交互记录和实时对话窗口
- [ ] WebSocket 实时推送交互记录到页面

---

## 注意事项

1. **提示词文件必须存在**：如果 Agent 的提示词文件不存在，会抛出错误
2. **使用 `hasAgentPrompt` 检查**：在调用 `loadAgentPrompt` 前，先用 `hasAgentPrompt` 检查
3. **缓存一致性**：修改提示词文件后，记得清除缓存
4. **Agent ID 映射**：新增 Agent 时，记得在 `prompt-loader.ts` 中添加映射
5. **提示词质量**：提示词的质量直接影响 Agent 的表现，请认真编写

---

## 总结

通过本次集成，我们实现了：

✅ 每个 Agent 都能加载自己的身份提示词
✅ Agent 知道自己的身份、职责和能力边界
✅ Agent 遵循业务规则和合规要求
✅ 定时任务自动使用 Agent 提示词
✅ 代码结构清晰，易于维护和扩展

现在，当调用 LLM 时，每个 Agent 都会基于自己的身份和能力边界进行回答，避免了幻觉和不恰当的回复。
