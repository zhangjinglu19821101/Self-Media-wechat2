# Agent 记忆功能修复文档

## 🔍 问题分析

**原始问题**：Agent 没有记忆，每次调用都是"全新"的

**根本原因**：
1. `AgentMemoryService` 已实现，可以读写记忆到数据库
2. 但在调用 LLM 时（如 `splitTaskForAgent`），只加载了 system prompt
3. **没有从数据库中检索 Agent 的记忆**
4. 导致 Agent 无法基于过去的经验进行决策

## ✅ 修复方案

### 1. 创建记忆辅助工具
**文件**：`src/lib/agent-memory-helper.ts`

**核心功能**：
- `getMemoryContext()` - 检索 Agent 的相关记忆并格式化为 prompt
- `saveAgentExperience()` - 自动保存 Agent 的经验到记忆库
- `calculateRelevanceScore()` - 计算记忆与当前任务的相关性
- `extractKeywords()` - 从任务中提取关键词
- `formatMemoriesToPrompt()` - 格式化记忆为 prompt 字符串

### 2. 修改 LLM 调用函数
**文件**：`src/lib/agent-llm.ts`

**修改内容**：
- 导入记忆辅助工具：`import { getMemoryContext, saveAgentExperience } from './agent-memory-helper'`
- 创建通用的 `callLLM()` 函数，自动加载记忆
- 在 `splitTaskForAgent()` 中添加记忆加载

**新增的 callLLM 函数**：
```typescript
export async function callLLM(
  agentId: string,
  context: string,        // 上下文（用于检索相关记忆）
  systemPrompt: string,   // 系统 prompt
  userPrompt: string,     // 用户 prompt
  options?: {             // 可选配置
    temperature?: number;
    maxMemories?: number;
    minImportance?: number;
    memoryTypes?: string[];
  }
): Promise<string>
```

### 3. 更新合规校验调用
**文件**：`src/lib/services/command-result-service.ts`

**修改内容**：
- 使用新的 `callLLM()` 函数
- 传入 Agent ID、上下文、system prompt 和 user prompt
- 配置记忆加载参数（maxMemories: 3, memoryTypes: ['knowledge', 'experience']）

### 4. 创建测试接口
**文件**：`src/app/api/test/add-memory/route.ts`

**功能**：
- POST - 手动添加 Agent 记忆（测试用）
- GET - 查询 Agent 的记忆列表

## 📋 记忆类型

| 类型 | 说明 | 示例 |
|------|------|------|
| decision | 决策经验 | "对于高风险任务，建议先进行小范围测试" |
| strategy | 策略经验 | "文章创作按8步骤执行：拆解→获取→标题→框架→撰写→合规→去AI→核对" |
| experience | 执行经验 | "使用大白话写作，避免专业术语" |
| rule | 规则知识 | "标题必须18-26字，包含三类词" |
| knowledge | 领域知识 | "分红险不能承诺收益" |

## 🔧 使用方法

### 方法1：自动加载记忆（推荐）

在调用 LLM 时，使用新的 `callLLM()` 函数：

```typescript
const response = await callLLM(
  'B',                            // Agent ID
  taskTitle + taskContent,        // 上下文（用于检索相关记忆）
  systemPrompt,                   // 系统 prompt
  userPrompt,                     // 用户 prompt
  {
    temperature: 0.3,
    maxMemories: 5,              // 加载 5 条相关记忆
    minImportance: 6,            // 只加载重要性 >= 6 的记忆
    memoryTypes: ['strategy', 'experience', 'knowledge'],
  }
);
```

### 方法2：手动添加记忆（测试）

```bash
# 添加测试记忆
curl -X POST http://localhost:5000/api/test/add-memory \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "B",
    "memoryType": "experience",
    "title": "文章创作8步骤经验",
    "content": "文章创作按8步骤执行：指令拆解→核心文本材料获取→标题创作→框架搭建→正文撰写→合规自查→去AI校验→最终核对",
    "tags": ["文章创作", "流程"],
    "importance": 9
  }'

# 查询记忆
curl http://localhost:5000/api/test/add-memory?agentId=B
```

## 📊 记忆检索策略

### 1. 基础筛选
- 按 Agent ID 筛选
- 按记忆类型筛选（strategy, experience, knowledge）
- 按重要性筛选（>= minImportance）

### 2. 相关性排序
- 提取任务关键词
- 计算记忆与关键词的匹配分数
- 标签匹配加分（+3 分）
- 关键词匹配加分（+2 分）
- 重要性基础分数（importance * 0.5）

### 3. 取 Top N
- 按相关性分数排序
- 取前 N 条（默认 5 条）
- 格式化为 prompt

## 💾 记忆格式

### 记忆库 Prompt 格式

```
# 💾 你的记忆库

## 策略经验

### 文章创作8步骤经验
**重要性**: 9/10
**内容**: 文章创作按8步骤执行：指令拆解→核心文本材料获取→标题创作→框架搭建→正文撰写→合规自查→去AI校验→最终核对
**标签**: 文章创作, 流程

### 标题创作规范
**重要性**: 8/10
**内容**: 标题必须18-26字，包含三类词：核心行业词、用户需求词、友好安心词
**标签**: 标题, 规范

---

**提示**: 请基于以上记忆经验，结合当前任务进行决策和执行。
```

## 🚀 自动保存经验

在任务完成后，自动提取并保存经验到记忆库：

```typescript
await saveAgentExperience(
  agentId,
  task,
  result,
  {
    success: true,
    lessons: ['经验1', '经验2'],
    tags: ['自动保存', '任务完成'],
  }
);
```

## ⚠️ 注意事项

1. **记忆不影响 LLM 调用**：如果记忆加载失败，会返回空字符串，不影响 LLM 正常调用
2. **重要性阈值**：默认只加载重要性 >= 6 的记忆，避免加载低质量记忆
3. **记忆数量限制**：默认最多加载 5 条记忆，避免 prompt 过长
4. **相关性排序**：基于关键词匹配计算相关性，确保加载的是相关记忆

## 📝 后续优化

1. [ ] 使用 LLM 进行智能经验提取（替代简单的正则表达式）
2. [ ] 实现记忆遗忘机制（自动删除过期或低质量记忆）
3. [ ] 实现记忆检索优化（使用向量搜索）
4. [ ] 在所有 LLM 调用处添加记忆加载
5. [ ] 添加记忆管理界面（前端）

## ✅ 验证步骤

1. 添加测试记忆：`POST /api/test/add-memory`
2. 查询记忆：`GET /api/test/add-memory?agentId=B`
3. 调用 LLM（如任务拆解），检查日志中是否显示"已加载 Agent B 的记忆上下文"
4. 检查 LLM 的响应是否基于记忆进行决策
