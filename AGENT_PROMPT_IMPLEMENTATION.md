# Agent 身份提示词实现机制详解

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent 身份系统架构                          │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   提示词文件   │  ────> │  提示词加载器  │  ────> │  Agent LLM   │
│  (.md 文件)   │  读取   │ (prompt-loader)│  使用   │  函数调用    │
└──────────────┘         └──────────────┘         └──────────────┘
       │                        │                        │
       │                        ▼                        ▼
       │               ┌──────────────┐         ┌──────────────┐
       │               │   缓存系统    │         │   LLM API    │
       │               │ (Map 缓存)    │  ────> │  (或模拟)    │
       │               └──────────────┘         └──────────────┘
       │                        │
       │                        ▼
       │               ┌──────────────┐
       └───────────────│  文件系统    │
       (磁盘持久化)    │ (src/lib/... │
                       └──────────────┘
```

---

## 二、实现细节

### 2.1 存储层 - 提示词文件

**位置**：`src/lib/agents/prompts/`

**文件结构**：
```
src/lib/agents/prompts/
├── A.md              # Agent A 提示词
├── B.md              # Agent B 提示词
├── C.md              # Agent C 提示词
├── D.md              # Agent D 提示词
├── insurance-c.md    # Agent insurance-c 提示词
└── insurance-d.md    # Agent insurance-d 提示词
```

**特点**：
- ✅ 永久存储在磁盘上
- ✅ 人类可读的 Markdown 格式
- ✅ 易于编辑和维护
- ✅ 版本控制友好（Git）

**文件内容结构**（以 insurance-d.md 为例）：
```markdown
# Agent insurance-d - 保险事业部内容主编

## 第一部分：全局最高优先级规则
1. 唤醒判定
2. 唤醒后第一动作
3. 核心检视内容
...

## 第二部分：核心定位与业务边界
1. 核心定位
2. 业务边界
3. 协同对象
...

## 第三部分：专属业务规则
3.1 核心业务任务
3.2 合规要求
...
```

---

### 2.2 加载层 - 提示词加载器

**文件**：`src/lib/agents/prompt-loader.ts`

**核心组件**：

#### 1. Agent ID 映射表
```typescript
const agentPromptFiles: Record<string, string> = {
  'A': 'A.md',
  'B': 'B.md',
  'C': 'C.md',
  'D': 'D.md',
  'insurance-c': 'insurance-c.md',
  'insurance-d': 'insurance-d.md',
};
```
**作用**：将 Agent ID 映射到对应的文件名

---

#### 2. 缓存系统
```typescript
const promptCache = new Map<string, string>();
```
**作用**：内存缓存已加载的提示词，避免重复读取文件

**缓存特点**：
- **生命周期**：随 Node.js 进程生命周期
- **访问速度**：O(1) 时间复杂度
- **清空时机**：
  - 服务重启
  - 手动调用 `clearPromptCache()`
  - 进程退出

---

#### 3. 核心函数

##### (1) `loadAgentPrompt(agentId)`
**功能**：加载 Agent 提示词

**流程**：
```typescript
export function loadAgentPrompt(agentId: string): string {
  // 步骤 1：检查缓存
  if (promptCache.has(agentId)) {
    console.log(`✅ 从缓存加载 Agent ${agentId} 提示词`);
    return promptCache.get(agentId)!;
  }
  
  // 步骤 2：构建文件路径
  const filePath = join(process.cwd(), 'src/lib/agents/prompts', fileName);
  
  // 步骤 3：检查文件是否存在
  if (!existsSync(filePath)) {
    throw new Error(`Agent ${agentId} 的提示词文件不存在`);
  }
  
  // 步骤 4：读取文件内容
  const prompt = readFileSync(filePath, 'utf-8');
  
  // 步骤 5：缓存内容
  promptCache.set(agentId, prompt);
  
  return prompt;
}
```

**时间复杂度**：
- 首次加载：O(n)，n 为文件大小
- 缓存命中：O(1)

---

##### (2) `hasAgentPrompt(agentId)`
**功能**：检查 Agent 是否有提示词文件

**流程**：
```typescript
export function hasAgentPrompt(agentId: string): boolean {
  const fileName = agentPromptFiles[agentId];
  if (!fileName) {
    return false;
  }
  
  const filePath = join(process.cwd(), 'src/lib/agents/prompts', fileName);
  return existsSync(filePath);
}
```

---

##### (3) `clearPromptCache(agentId?)`
**功能**：清除缓存

**流程**：
```typescript
export function clearPromptCache(agentId?: string) {
  if (agentId) {
    // 清除特定 Agent 的缓存
    promptCache.delete(agentId);
  } else {
    // 清除所有缓存
    promptCache.clear();
  }
}
```

---

### 2.3 使用层 - Agent LLM 函数

**文件**：`src/lib/agent-llm.ts`

**4 个核心函数都使用相同的提示词加载模式**：

```typescript
export async function agentSelfCheck(agentId: string, task: any) {
  // 1. 加载 Agent 身份提示词
  let agentPrompt = '';
  if (hasAgentPrompt(agentId)) {
    agentPrompt = loadAgentPrompt(agentId);
    console.log(`✅ 已加载 Agent ${agentId} 的身份提示词`);
  }
  
  // 2. 构建 LLM Prompt
  const prompt = `
# 你是 Agent ${agentId}

${agentPrompt}

---

## 当前任务
任务标题：${task.taskTitle}
任务内容：${task.commandContent}

---

## 你的任务
请基于你的身份和能力边界，检查你是否能执行这个任务。

## 返回格式
请严格按照以下 JSON 格式返回：
\`\`\`json
{
  "hasQuestions": true/false,
  "questions": "如果有疑问，详细描述",
  "resolution": "如果没有疑问，回复：没问题，可以开始"
}
\`\`\`
`;
  
  // 3. 调用 LLM（当前为模拟数据）
  const response = await callLLM(prompt);
  
  return JSON.parse(response);
}
```

---

## 三、完整调用流程

### 3.1 时序图

```
用户调用 agentSelfCheck('insurance-d', task)
            │
            ▼
┌─────────────────────────────────────┐
│  agentSelfCheck 函数                │
│  src/lib/agent-llm.ts               │
└─────────────────────────────────────┘
            │
            │ 1. 检查是否有提示词
            ▼
┌─────────────────────────────────────┐
│  hasAgentPrompt('insurance-d')      │
│  src/lib/agents/prompt-loader.ts    │
└─────────────────────────────────────┘
            │
            │ 2. 返回 true
            ▼
┌─────────────────────────────────────┐
│  loadAgentPrompt('insurance-d')     │
│  src/lib/agents/prompt-loader.ts    │
└─────────────────────────────────────┘
            │
            │ 3. 检查缓存
            ▼
       ┌────────┐
       │ 缓存？  │
       └────────┘
          │      │
          │ 否   │ 是
          ▼      │
    ┌─────────┐  │
    │ 读取文件 │  │
    │insurance-│  │
    │   d.md  │  │
    └─────────┘  │
          │      │
          ▼      │
    ┌─────────┐  │
    │ 缓存内容 │  │
    └─────────┘  │
          │      │
          └──┬───┘
             │
             ▼
    ┌────────────────┐
    │ 返回提示词内容 │
    └────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  构建 LLM Prompt                    │
│  (提示词 + 任务 + 返回格式)          │
└─────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  调用 LLM API                       │
│  (或使用模拟数据)                    │
└─────────────────────────────────────┘
             │
             ▼
        返回结果
```

---

### 3.2 代码示例

**场景**：Agent insurance-d 自检是否能执行任务

```typescript
// 1. 用户调用
const result = await agentSelfCheck('insurance-d', {
  taskName: '撰写重疾险文章',
  commandContent: '撰写一篇 1500-1600 字的重疾险文章'
});

// 2. agentSelfCheck 内部执行
console.log(`🔍 Agent insurance-d 开始自检任务...`);

// 3. 检查是否有提示词
if (hasAgentPrompt('insurance-d')) {
  // 4. 加载提示词
  const agentPrompt = loadAgentPrompt('insurance-d');
  // 输出：✅ 已加载 Agent insurance-d 的身份提示词，长度: 31569 字符
}

// 5. 构建 LLM Prompt
const prompt = `
# 你是 Agent insurance-d

<insurance-d.md 的完整内容>

---

## 当前任务
任务标题：撰写重疾险文章
任务内容：撰写一篇 1500-1600 字的重疾险文章

---

## 你的任务
请基于你的身份和能力边界，检查你是否能执行这个任务。

## 返回格式
请严格按照以下 JSON 格式返回：
\`\`\`json
{
  "hasQuestions": true/false,
  "questions": "如果有疑问，详细描述",
  "resolution": "如果没有疑问，回复：没问题，可以开始"
}
\`\`\`
`;

// 6. 调用 LLM
const response = await callLLM(prompt);

// 7. 返回结果
return JSON.parse(response);
```

---

## 四、身份能带多久？

### 4.1 生命周期分析

| 层级 | 存储介质 | 生命周期 | 持久性 |
|------|---------|---------|--------|
| **提示词文件** | 磁盘（文件系统） | 永久（除非手动删除） | ✅ 持久化 |
| **内存缓存** | RAM（Map 对象） | 进程生命周期 | ❌ 进程重启后清空 |
| **LLM Prompt** | 内存（字符串） | 函数调用期间 | ❌ 调用结束后销毁 |

---

### 4.2 详细说明

#### (1) 提示词文件 - **永久保存**

**位置**：`src/lib/agents/prompts/*.md`

**持久性**：
- ✅ 存储在磁盘上，永久保存
- ✅ 受 Git 版本控制
- ✅ 可以随时编辑修改
- ✅ 部署时随代码一起打包

**更新机制**：
- 手动编辑 `.md` 文件
- 需要调用 `clearPromptCache()` 清除缓存才能生效

---

#### (2) 内存缓存 - **进程生命周期**

**实现**：
```typescript
const promptCache = new Map<string, string>();
```

**生命周期**：
- 创建：进程启动时初始化
- 使用：每次 `loadAgentPrompt()` 调用
- 销毁：进程退出时自动清空

**缓存失效时机**：
1. ✅ 服务重启（如 `coze dev` 重启）
2. ✅ 手动调用 `clearPromptCache()`
3. ✅ 进程崩溃或退出

**缓存有效期**：无过期时间，除非手动清除

---

#### (3) LLM Prompt - **调用期间**

**实现**：
```typescript
const prompt = `
# 你是 Agent ${agentId}

${agentPrompt}  // 提示词内容嵌入到字符串中

---

## 当前任务
...
`;
```

**生命周期**：
- 创建：函数调用时构建字符串
- 使用：传递给 LLM API
- 销毁：函数调用结束后被垃圾回收

**特点**：
- ❌ 不持久化
- ❌ 每次调用都会重新构建
- ✅ 确保每次调用都使用最新的提示词

---

### 4.3 实际场景分析

#### 场景 1：正常运行

```
时间轴：
─────────────────────────────────────────────────────────────>
0s    1s    5s    10s   30s   1min  5min  1hour
│     │     │     │     │     │     │      │
启动   调用  缓存  继续   继续   继续   继续    持续
服务   第1次 命中   调用   调用   调用   调用    运行

提示词文件：  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━> 永久
内存缓存：    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━> 进程生命周期
LLM Prompt：  ├┤  ├┤  ├┤  ├┤  ├┤  ├┤  ├┤  ├┤  每次调用重建
```

**结论**：
- 提示词文件永久保存，身份一直存在
- 内存缓存在整个服务运行期间保持
- 每次调用 LLM 都会重新嵌入提示词

---

#### 场景 2：服务重启

```
时间轴：
─────────────────────────────────────────────────────────────>
0s    5s    10s   15s   20s   25s   30s   35s
│     │     │     │     │     │     │     │
启动   调用  重启   重新   调用   缓存  继续   继续
服务   第1次  服务   加载   第1次  命中   调用   调用

提示词文件：  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━> 永久
内存缓存：    ━━━━━┐      ━━━━━━━━━━━━━━━━━━━━━━━> 新进程
                  ↑
              重启清空
LLM Prompt：  ├┤    │     ├┤  ├┤  ├┤  ├┤  ├┤  每次调用重建
                重启
```

**结论**：
- 服务重启后，内存缓存清空
- 下次调用时重新从文件加载
- 提示词文件不变，身份保持一致

---

#### 场景 3：修改提示词

```bash
# 1. 编辑提示词文件
vim src/lib/agents/prompts/insurance-d.md

# 2. 提交到 Git
git add src/lib/agents/prompts/insurance-d.md
git commit -m "update: 更新 insurance-d 提示词"

# 3. 清除缓存（重要！）
# 在代码中调用
clearPromptCache('insurance-d');

# 4. 重启服务（推荐）
# 确保缓存完全清空
```

**时序**：
```
修改文件  →  清除缓存  →  下次调用重新加载  →  生效
```

**注意**：
- ⚠️ 如果不清除缓存，修改不会立即生效
- ⚠️ 服务重启会自动清空缓存
- ✅ 推荐做法：修改后重启服务

---

### 4.4 身份持久性总结

| 问题 | 答案 | 说明 |
|------|------|------|
| **身份能带多久？** | **永久** | 提示词文件永久存储在磁盘上 |
| **服务重启后身份还在吗？** | **是的** | 服务重启会重新从文件加载提示词 |
| **修改提示词后多久生效？** | **清除缓存后立即生效** | 也可以通过服务重启生效 |
| **缓存会过期吗？** | **不会** | 缓存无过期时间，除非手动清除 |
| **每次调用都重新加载吗？** | **不会** | 使用缓存机制，只在首次加载 |

---

## 五、性能分析

### 5.1 时间复杂度

| 操作 | 首次加载 | 缓存命中 |
|------|---------|---------|
| **读取文件** | O(n) | - |
| **缓存存储** | O(1) | - |
| **缓存查询** | - | O(1) |
| **总复杂度** | O(n) | O(1) |

**n** = 文件大小（字节数）

---

### 5.2 性能测试（理论值）

假设提示词文件大小为 32 KB（insurance-d.md）：

| 场景 | 耗时 | 说明 |
|------|------|------|
| 首次加载（读取文件） | ~1-5 ms | 取决于磁盘 I/O |
| 缓存命中 | < 0.01 ms | Map 查询，极快 |
| 构建 Prompt | ~0.1-0.5 ms | 字符串拼接 |

**结论**：
- ✅ 缓存机制性能极佳
- ✅ 即使不缓存，文件读取也很快
- ✅ 对于高频调用场景，缓存优势明显

---

### 5.3 内存占用

假设所有 Agent 提示词加载到缓存：

| Agent | 文件大小 | 内存占用 |
|-------|---------|---------|
| A | 26 KB | 26 KB |
| B | 4.4 KB | 4.4 KB |
| C | 16 KB | 16 KB |
| D | 15 KB | 15 KB |
| insurance-c | 22 KB | 22 KB |
| insurance-d | 31 KB | 31 KB |
| **总计** | **114.4 KB** | **114.4 KB** |

**结论**：
- ✅ 内存占用极小
- ✅ 可以放心地缓存所有提示词

---

## 六、扩展性分析

### 6.1 新增 Agent 流程

```typescript
// 1. 创建提示词文件
// src/lib/agents/prompts/insurance-e.md

# Agent insurance-e - 新业务提示词
...

// 2. 更新映射表
// src/lib/agents/prompt-loader.ts

const agentPromptFiles: Record<string, string> = {
  'A': 'A.md',
  'B': 'B.md',
  'C': 'C.md',
  'D': 'D.md',
  'insurance-c': 'insurance-c.md',
  'insurance-d': 'insurance-d.md',
  'insurance-e': 'insurance-e.md', // 新增
};

// 3. 直接使用
const result = await agentSelfCheck('insurance-e', task);
// 自动加载 insurance-e.md
```

**扩展成本**：
- ✅ 只需 2 步（创建文件 + 更新映射）
- ✅ 无需修改核心代码
- ✅ 支持无限新增 Agent

---

### 6.2 多环境支持

```typescript
// 可以根据环境加载不同的提示词
const env = process.env.NODE_ENV; // development / production

const agentPromptFiles: Record<string, string> = {
  'A': env === 'production' ? 'A-prod.md' : 'A-dev.md',
  'B': env === 'production' ? 'B-prod.md' : 'B-dev.md',
  // ...
};
```

**应用场景**：
- 开发环境：使用详细提示词（便于调试）
- 生产环境：使用精简提示词（节省 token）

---

## 七、最佳实践

### 7.1 提示词编写规范

```markdown
# Agent <id> - <角色名称>

## 第一部分：全局最高优先级规则
- 唤醒判定
- 唤醒后第一动作
- ...

## 第二部分：核心定位与业务边界
- 核心定位
- 业务边界
- ...

## 第三部分：专属业务规则
- 核心业务任务
- 合规要求
- ...

## 第四部分：输出格式
- 明确的返回格式要求
```

---

### 7.2 缓存管理策略

```typescript
// 策略 1：定期清除缓存（不推荐）
setInterval(() => {
  clearPromptCache();
}, 3600000); // 每小时清除一次

// 策略 2：修改提示词后清除（推荐）
function updateAgentPrompt(agentId: string, newPrompt: string) {
  // 1. 写入文件
  fs.writeFileSync(getPromptFilePath(agentId), newPrompt);
  
  // 2. 清除缓存
  clearPromptCache(agentId);
  
  console.log(`✅ Agent ${agentId} 提示词已更新`);
}

// 策略 3：服务重启时自动清除（默认）
// 服务重启会自动清空缓存
```

---

### 7.3 错误处理

```typescript
try {
  const prompt = loadAgentPrompt('insurance-d');
} catch (error) {
  if (error.message.includes('提示词文件不存在')) {
    console.error('❌ Agent 提示词文件未找到');
    // 使用默认提示词或降级处理
  } else {
    console.error('❌ 加载提示词失败:', error);
  }
}
```

---

## 八、常见问题

### Q1: 提示词修改后不生效？
**A**: 需要清除缓存或重启服务
```typescript
clearPromptCache('insurance-d');
// 或重启服务
```

### Q2: 缓存会占用太多内存吗？
**A**: 不会，所有提示词加起来只有 ~114 KB

### Q3: 可以动态加载提示词吗？
**A**: 可以，从数据库或远程 API 加载
```typescript
export async function loadAgentPromptFromDB(agentId: string) {
  const prompt = await db.query(
    'SELECT prompt_content FROM agent_prompts WHERE agent_id = ?',
    [agentId]
  );
  return prompt[0].prompt_content;
}
```

### Q4: 如何支持多语言提示词？
**A**: 可以通过环境变量或参数指定语言
```typescript
const lang = process.env.LANG || 'zh-CN';
const fileName = `A-${lang}.md`;
```

---

## 九、总结

### 核心机制

1. **文件存储**：提示词永久存储在磁盘上的 `.md` 文件
2. **内存缓存**：使用 Map 对象缓存已加载的提示词
3. **动态嵌入**：每次调用 LLM 时将提示词嵌入到 prompt 中

### 身份持久性

| 层级 | 持久性 | 生命周期 |
|------|--------|---------|
| 提示词文件 | ✅ 永久 | 磁盘存储 |
| 内存缓存 | ❌ 进程生命周期 | 服务重启后清空 |
| LLM Prompt | ❌ 调用期间 | 函数调用结束后销毁 |

### 优势

- ✅ **持久化**：身份永久保存
- ✅ **高性能**：缓存机制加速加载
- ✅ **易维护**：Markdown 格式易于编辑
- ✅ **高扩展**：支持无限新增 Agent
- ✅ **低开销**：内存占用仅 ~114 KB

---

## 十、未来优化方向

1. **数据库存储**：支持从数据库加载提示词，支持动态更新
2. **版本控制**：支持提示词版本管理，回滚功能
3. **A/B 测试**：支持同一 Agent 使用多个提示词变体
4. **自动更新**：支持从远程 API 自动更新提示词
5. **Token 优化**：自动精简提示词，减少 token 消耗
