# insurance-d 任务拆解流程文档（修正版）

## 核心理念

insurance-d 的任务拆分遵循**两层级**拆解原则：
1. **第一层拆解**：Agent B 识别任务，区分 insurance-d 的任务和 Agent B 的任务
2. **第二层拆解**：insurance-d 按照生成文章的**8个标准步骤**拆分任务

---

## 完整流程

### 阶段 1：Agent B 识别任务 → 生成 daily_tasks

**职责**：Agent B 识别任务，判断任务归属，并分配给对应的 Agent

**关键点**：
- Agent B **不拆分 insurance-d 的任务**
- Agent B **只识别**任务是 insurance-d 的还是自己的
- **如果是 insurance-d 的任务**：标记 `toAgentId = 'insurance-d'`，`executor = 'insurance-d'`
- **如果是 Agent B 的任务**：由 Agent B 自己拆分

**API**：`POST /api/split-insurance-d-task`（任务识别）或 `POST /api/agents/agent-b/identify-tasks`

**处理流程**：
1. Agent B 接收来自 Agent A 的任务列表
2. 使用 LLM 识别每个任务属于哪个 Agent
3. **识别标准**：
   - 任务包含"拆分"、"分解"等关键词 → 可能是 insurance-d 的任务
   - 任务包含"管理"、"跟踪"、"监控"等关键词 → 可能是 insurance-d 的任务
   - 其他任务 → 可能是 Agent B 的任务
4. 生成 `daily_tasks` 记录

**生成的记录**：
- 表：`daily_tasks`（也叫 command_result）
- 字段：
  - `task_title`: 任务标题（如：第1天：完成《三口之家保险配置逻辑》科普文章创作）
  - `task_description`: 任务描述（如：围绕「三口之家保险配置逻辑」主题创作科普文章...）
  - `executor`: 执行者（insurance-d 或 Agent B）
  - `to_agent_id`: 接收任务的 Agent（insurance-d 或 Agent B）
  - `execution_status`: 'new'（初始状态）
  - `sub_task_count`: 0（初始未拆分）
  - `related_task_id`: 关联的总任务 ID

**关键代码**：
```typescript
// Agent B 识别任务
const identifiedTasks = await identifyInsuranceDTasks(weeklyTasks);

// 分类任务
const insuranceDTasks = identifiedTasks.filter(r => r.belongsToInsuranceD);
const agentBTasks = identifiedTasks.filter(r => !r.belongsToInsuranceD);

// 下发 insurance-d 的任务
if (insuranceDTasks.length > 0) {
  await assignTasksToInsuranceD(insuranceDTasks);
  // 更新 daily_tasks 的 toAgentId 和 executor 为 'insurance-d'
}

// Agent B 自己拆分自己的任务
if (agentBTasks.length > 0) {
  for (const task of agentBTasks) {
    const subTasks = await splitTaskForAgent('agent-b', task);
    // Agent B 自己的拆分逻辑
  }
}
```

---

### 阶段 2：insurance-d 接收任务 → 按8个标准步骤拆分 → 生成 agent_sub_tasks

**职责**：insurance-d 按照**生成文章的8个标准步骤**拆分任务

**关键点**：
- insurance-d **只拆分自己的任务**（`toAgentId = 'insurance-d'`）
- 按照 **8个标准步骤**拆分任务
- 每个步骤对应一个子任务

**API**：`POST /api/agents/insurance-d/split-task`

**处理流程**：
1. 查询 `daily_tasks` 表，获取 insurance-d 的任务详情
2. 检查是否已经拆分过（`sub_task_count > 0`）
3. 调用 `splitTaskForAgent('insurance-d', task)` 拆分任务
4. **使用 insurance-d 的身份提示词**（包含8个标准步骤）
5. 生成子任务列表（8个标准步骤）
6. 插入子任务到 `agent_sub_tasks` 表
7. 更新 `daily_tasks` 表的 `sub_task_count`
8. **立即启动第一个子任务**（`order_index = 1`）

**生成的记录**：
- 表：`agent_sub_tasks`
- 数量：**8个子任务**（对应8个标准步骤）
- 字段：
  - `command_result_id`: 关联的 daily_tasks 记录 ID（外键）
  - `agent_id`: 'insurance-d'
  - `task_title`: 子任务标题（对应8个标准步骤）
  - `task_description`: 子任务描述（对应8个标准步骤的具体要求）
  - `status`: 'pending'（初始状态）
  - `order_index`: 执行顺序（1, 2, 3, ..., 8）
  - `metadata`: 验收标准、是否关键、执行者等

**8个标准步骤**：
1. **指令拆解（控方向）** - order_index = 1
   - 明确核心关键词（如分红险）
   - 拆解中老年受众核心痛点
   - 确定文章核心价值

2. **核心文本材料获取（补内容）** - order_index = 2
   - 从固定目录获取核心文本材料
   - 整合保险知识点、案例、事项描述等

3. **标题创作（控亮点）** - order_index = 3
   - 严格按"标题规则"执行
   - 确定包含三类词的标题（18-26字）

4. **框架搭建（控结构）** - order_index = 4
   - 对照"固定结构"
   - 梳理每部分核心内容

5. **正文撰写（控内容）** - order_index = 5
   - 按"内容规则"撰写
   - 全文1000字左右，大白话

6. **合规自查（控底线）** - order_index = 6
   - 对照"合规底线"
   - 重点检查分红险相关表述

7. **去AI校验（控自然）** - order_index = 7
   - 对照"去AI核心要求"
   - 调整说教感表述

8. **最终核对（控预期）** - order_index = 8
   - 整体核对
   - 确保每一项都符合提示词要求

**关键代码**：
```typescript
export async function insuranceDSplitTask(commandResultId: string) {
  // 1. 查询任务详情
  const task = await db
    .select()
    .from(dailyTasks)
    .where(eq(dailyTasks.id, commandResultId))
    .limit(1);

  const commandResult = task[0];

  // 2. 检查是否已经拆分过
  if (commandResult.subTaskCount > 0) {
    return { success: true, message: '指令已拆分' };
  }

  // 3. 调用任务拆解函数（会加载 insurance-d 的身份提示词）
  const subTasks = await splitTaskForAgent('insurance-d', commandResult);
  // splitTaskForAgent 会加载 src/lib/agents/prompts/insurance-d.md
  // 包含"生成文章标准步骤"（8个步骤）

  // 4. 插入子任务到数据库（8个标准步骤）
  for (const subTask of subTasks) {
    await db.insert(agentSubTasks).values({
      commandResultId: commandResultId,
      agentId: subTask.executor,
      taskTitle: subTask.title,
      taskDescription: subTask.description,
      status: 'pending',
      orderIndex: subTask.orderIndex, // 1, 2, 3, ..., 8
      metadata: {
        acceptanceCriteria: subTask.acceptanceCriteria,
        isCritical: subTask.isCritical,
        executor: subTask.executor,
      },
    });
  }

  // 5. 更新指令的子任务数量
  await db
    .update(dailyTasks)
    .set({
      subTaskCount: subTasks.length, // 应该是 8
      completedSubTasks: 0,
    })
    .where(eq(dailyTasks.id, commandResultId));

  // 6. 立即启动第一个子任务（指令拆解）
  const firstSubTask = subTasks.find(st => st.orderIndex === 1);
  if (firstSubTask) {
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        startedAt: new Date(),
      })
      .where(
        and(
          eq(agentSubTasks.commandResultId, commandResultId),
          eq(agentSubTasks.orderIndex, 1)
        )
      );
  }

  return { success: true, subTaskCount: subTasks.length };
}
```

**insurance-d 的身份提示词**（`src/lib/agents/prompts/insurance-d.md`）：
```markdown
### # 生成文章标准步骤（可控过程，贴合预期）

1. 指令拆解（第一步，控方向）：接收创作指令后，先明确核心关键词（如分红险），拆解中老年受众核心痛点，确定文章核心价值（如"帮中老年理性了解分红险、避坑"），不偏离保险科普、中老年友好的核心定位，确保方向符合预期。

2. 核心文本材料获取（第二步，补内容）：在此步骤，引导你自主从固定目录获取我提供的核心文本材料（如提前整理的保险知识点、案例、事项描述等）；若固定目录中有对应材料，直接获取并整合；若未获取到材料，且收到我"无"的指令，无需等待，自行结合关键词（如分红险）、中老年受众需求，生成贴合主题的案例/实操相关内容，确保内容不遗漏、不偏离保险科普核心，贴合中老年理解习惯。

3. 标题创作（第三步，控亮点）：严格按"标题规则"执行，确定包含三类词的标题（18-26字），无误导、不标题党，若关键词为分红险，按专属要求搭配词汇，完成后自查标题合规性和适配性。

4. 框架搭建（第四步，控结构）：对照"固定结构"，先梳理每部分核心内容——开头明确用户价值、正文确定3条实操方向、结尾规划温和提醒，确保结构完整，不遗漏任何模块（含关注/留言引导）。

5. 正文撰写（第五步，控内容）：按"内容规则"撰写，全程大白话、短句短段，控制全文1000字左右；嵌入关键词，分红险相关按专属要求讲基础实操；同时融入"去AI核心要求"（加语气词、场景碎片等），避免AI感和专业术语，优先使用第二步从固定目录获取的核心文本材料，自然融入实操环节，增强内容代入感。

6. 合规自查（第六步，控底线）：对照"合规底线"，重点检查分红险相关表述（不夸大分红、不承诺收益），杜绝焦虑、违规内容，确保所有表述贴合合规要求，不误导中老年读者；同时核对从固定目录获取的核心文本材料（若有）使用合规性，不夸大、不误导解读材料内容。

7. 去AI校验（第七步，控自然）：对照"去AI核心要求"，自查语气词、场景碎片、AI书面词禁用情况，调整说教感表述，确保内容自然有温度，贴合熟人聊天语气，整合的输入材料不生硬。

8. 最终核对（第八步，控预期）：整体核对——字数误差、结构完整性、关键词融入、合规性、去AI效果；同时核对从固定目录获取的核心文本材料（若有）是否准确使用、无遗漏、不生硬，若为自行生成内容，核对其贴合度和合规性，确保每一项都符合提示词要求，无偏差后，完成文章生成。
```

---

### 阶段 3：insurance-d 按照 agent_sub_tasks 逐步执行

**职责**：insurance-d 按照 `agent_sub_tasks` 的8个标准步骤逐步执行

**处理流程**：
1. 获取当前需要执行的子任务（`status = 'in_progress'`）
2. 调用 LLM 执行子任务
3. 生成执行结果
4. 更新子任务状态为 'completed'
5. 启动下一个子任务
6. 重复直到所有8个子任务完成

**执行的步骤**：
1. **执行步骤1：指令拆解**（order_index = 1）
   - 明确核心关键词
   - 拆解中老年受众核心痛点
   - 确定文章核心价值

2. **执行步骤2：核心文本材料获取**（order_index = 2）
   - 从固定目录获取核心文本材料
   - 整合保险知识点、案例、事项描述等

3. **执行步骤3：标题创作**（order_index = 3）
   - 严格按"标题规则"执行
   - 确定包含三类词的标题

4. **执行步骤4：框架搭建**（order_index = 4）
   - 对照"固定结构"
   - 梳理每部分核心内容

5. **执行步骤5：正文撰写**（order_index = 5）
   - 按"内容规则"撰写
   - 全文1000字左右，大白话

6. **执行步骤6：合规自查**（order_index = 6）
   - 对照"合规底线"
   - 重点检查合规性

7. **执行步骤7：去AI校验**（order_index = 7）
   - 对照"去AI核心要求"
   - 调整说教感表述

8. **执行步骤8：最终核对**（order_index = 8）
   - 整体核对
   - 完成文章生成

**更新的记录**：
- 表：`agent_sub_tasks`
- 字段：
  - `status`: 'in_progress' → 'completed'
  - `execution_result`: 执行结果（JSON 字符串）
  - `completed_at`: 完成时间

- 表：`daily_tasks`
- 字段：
  - `completed_sub_tasks`: 已完成的子任务数量（0 → 8）
  - `execution_status`: 'in_progress' → 'completed'
  - `execution_result`: 最终文章内容

---

## 数据流向图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent A                                    │
│  （总裁，负责下达任务）                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ 发送任务列表
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Agent B                                    │
│  （技术负责人，负责识别任务并分配）                                 │
│                                                                  │
│  POST /api/agents/agent-b/identify-tasks                        │
│  ↓                                                              │
│  identifyInsuranceDTasks(weeklyTasks)                            │
│  ↓                                                              │
│  识别任务归属                                                     │
│  ├─ insurance-d 的任务 → 标记 toAgentId = 'insurance-d'        │
│  └─ Agent B 的任务 → 由 Agent B 自己拆分                         │
│  ↓                                                              │
│  生成 daily_tasks 记录                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    daily_tasks 表                                │
│  （每日任务表，也叫 command_result）                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ - task_title: "第1天：完成《三口之家保险配置逻辑》科普..." │   │
│  │ - task_description: "围绕「三口之家保险配置逻辑」主题..."  │   │
│  │ - executor: "insurance-d"                               │   │
│  │ - to_agent_id: "insurance-d"                           │   │
│  │ - execution_status: "new"                              │   │
│  │ - sub_task_count: 0                                    │   │
│  │ - related_task_id: "task-A-to-B-xxx"                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │ insurance-d 接收任务
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    insurance-d                                   │
│  （任务拆分与管理 agent，按照8个标准步骤拆分任务）                   │
│                                                                  │
│  POST /api/agents/insurance-d/split-task                        │
│  ↓                                                              │
│  insuranceDSplitTask(commandResultId)                            │
│  ↓                                                              │
│  splitTaskForAgent('insurance-d', commandResult)                  │
│  ↓                                                              │
│  加载 insurance-d 的身份提示词（包含8个标准步骤）                    │
│  ↓                                                              │
│  生成 8 个子任务（对应8个标准步骤）                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                  agent_sub_tasks 表                               │
│  （Agent 子任务表，包含8个标准步骤）                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. 指令拆解（控方向）                                     │   │
│  │    - order_index: 1                                      │   │
│  │    - task_title: "指令拆解（控方向）"                    │   │
│  │    - status: "in_progress"                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 2. 核心文本材料获取（补内容）                             │   │
│  │    - order_index: 2                                      │   │
│  │    - task_title: "核心文本材料获取（补内容）"            │   │
│  │    - status: "pending"                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 3. 标题创作（控亮点）                                    │   │
│  │    - order_index: 3                                      │   │
│  │    - task_title: "标题创作（控亮点）"                    │   │
│  │    - status: "pending"                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 4. 框架搭建（控结构）                                    │   │
│  │    - order_index: 4                                      │   │
│  │    - task_title: "框架搭建（控结构）"                    │   │
│  │    - status: "pending"                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 5. 正文撰写（控内容）                                    │   │
│  │    - order_index: 5                                      │   │
│  │    - task_title: "正文撰写（控内容）"                    │   │
│  │    - status: "pending"                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 6. 合规自查（控底线）                                    │   │
│  │    - order_index: 6                                      │   │
│  │    - task_title: "合规自查（控底线）"                    │   │
│  │    - status: "pending"                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 7. 去AI校验（控自然）                                    │   │
│  │    - order_index: 7                                      │   │
│  │    - task_title: "去AI校验（控自然）"                    │   │
│  │    - status: "pending"                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 8. 最终核对（控预期）                                    │   │
│  │    - order_index: 8                                      │   │
│  │    - task_title: "最终核对（控预期）"                    │   │
│  │    - status: "pending"                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    insurance-d                                   │
│  （按照 agent_sub_tasks 逐步执行）                                 │
│                                                                  │
│  执行步骤1：指令拆解                                              │
│  ↓                                                              │
│  更新 agent_sub_tasks[order_index=1].status = 'completed'        │
│  ↓                                                              │
│  执行步骤2：核心文本材料获取                                        │
│  ↓                                                              │
│  更新 agent_sub_tasks[order_index=2].status = 'completed'        │
│  ↓                                                              │
│  执行步骤3：标题创作                                              │
│  ↓                                                              │
│  更新 agent_sub_tasks[order_index=3].status = 'completed'        │
│  ↓                                                              │
│  执行步骤4：框架搭建                                              │
│  ↓                                                              │
│  更新 agent_sub_tasks[order_index=4].status = 'completed'        │
│  ↓                                                              │
│  执行步骤5：正文撰写                                              │
│  ↓                                                              │
│  更新 agent_sub_tasks[order_index=5].status = 'completed'        │
│  ↓                                                              │
│  执行步骤6：合规自查                                              │
│  ↓                                                              │
│  更新 agent_sub_tasks[order_index=6].status = 'completed'        │
│  ↓                                                              │
│  执行步骤7：去AI校验                                              │
│  ↓                                                              │
│  更新 agent_sub_tasks[order_index=7].status = 'completed'        │
│  ↓                                                              │
│  执行步骤8：最终核对                                              │
│  ↓                                                              │
│  更新 agent_sub_tasks[order_index=8].status = 'completed'        │
└────────────────────────┬────────────────────────────────────────┘
                         │ 所有8个子任务完成
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    daily_tasks 表                                │
│  （更新任务状态）                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ - execution_status: "completed"                         │   │
│  │ - completed_sub_tasks: 8                                │   │
│  │ - execution_result: "生成的文章内容..."                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 关键区别

### 之前的错误理解

- ❌ Agent B 拆分总任务，生成 daily_tasks
- ❌ insurance-d 接收任务，拆分生成 agent_sub_tasks

### 正确的理解

- ✅ Agent B **识别任务**，区分 insurance-d 的任务和 Agent B 的任务
- ✅ insurance-d 按照**8个标准步骤**拆分自己的任务，生成 agent_sub_tasks

---

## 关键函数

### 1. identifyInsuranceDTasks

**作用**：Agent B 识别任务，判断任务归属

**参数**：
- `weeklyTasks`: Agent A 的一周工作任务列表

**返回**：识别结果数组，每个结果包含：
- `taskId`: 任务 ID
- `taskName`: 任务名称
- `belongsToInsuranceD`: 是否属于 insurance-d
- `reason`: 为什么属于 insurance-d
- `confidence`: 置信度 0-1

**位置**：`src/lib/services/task-assignment-service.ts`

---

### 2. assignTasksToInsuranceD

**作用**：Agent B 下发任务给 insurance-d

**参数**：
- `tasks`: 需要下发的任务列表

**返回**：
```typescript
{
  success: boolean,
  assignedCount: number,
  errors: string[]
}
```

**位置**：`src/lib/services/task-assignment-service.ts`

---

### 3. insuranceDSplitTask

**作用**：insurance-d 按照8个标准步骤拆分任务

**参数**：
- `commandResultId`: daily_tasks 记录的 ID

**返回**：
```typescript
{
  success: true,
  subTaskCount: 8,
  firstSubTaskStarted: true,
  subTasks: [
    { orderIndex: 1, title: "指令拆解（控方向）", executor: "insurance-d", isCritical: true },
    { orderIndex: 2, title: "核心文本材料获取（补内容）", executor: "insurance-d", isCritical: true },
    { orderIndex: 3, title: "标题创作（控亮点）", executor: "insurance-d", isCritical: true },
    { orderIndex: 4, title: "框架搭建（控结构）", executor: "insurance-d", isCritical: true },
    { orderIndex: 5, title: "正文撰写（控内容）", executor: "insurance-d", isCritical: true },
    { orderIndex: 6, title: "合规自查（控底线）", executor: "insurance-d", isCritical: true },
    { orderIndex: 7, title: "去AI校验（控自然）", executor: "insurance-d", isCritical: true },
    { orderIndex: 8, title: "最终核对（控预期）", executor: "insurance-d", isCritical: true },
  ],
}
```

**位置**：`src/lib/services/task-assignment-service.ts`

**关键点**：调用 `splitTaskForAgent('insurance-d', commandResult)` 时，会加载 insurance-d 的身份提示词（包含8个标准步骤）

---

### 4. splitTaskForAgent

**作用**：通用任务拆分函数，使用 LLM 智能拆分任务

**参数**：
- `agentId`: Agent ID
- `commandResult`: 任务信息

**返回**：子任务列表

**位置**：`src/lib/agent-llm.ts`

**关键点**：
- 会加载 Agent 的身份提示词（`loadAgentPrompt(agentId)`）
- 对于 insurance-d，会加载 `src/lib/agents/prompts/insurance-d.md`
- 结合身份提示词和通用拆分 prompt 构建完整的 prompt

---

## insurance-d 的8个标准步骤

1. **指令拆解（控方向）** - order_index = 1
2. **核心文本材料获取（补内容）** - order_index = 2
3. **标题创作（控亮点）** - order_index = 3
4. **框架搭建（控结构）** - order_index = 4
5. **正文撰写（控内容）** - order_index = 5
6. **合规自查（控底线）** - order_index = 6
7. **去AI校验（控自然）** - order_index = 7
8. **最终核对（控预期）** - order_index = 8

---

## 常见问题

### Q1: Agent B 会拆分 insurance-d 的任务吗？

A: 不会。Agent B 只负责**识别**任务，判断任务是 insurance-d 的还是自己的。如果是 insurance-d 的任务，Agent B 会标记 `toAgentId = 'insurance-d'`，由 insurance-d 自己拆分。

### Q2: insurance-d 如何拆分任务？

A: insurance-d 按照**8个标准步骤**拆分任务，每个步骤对应一个子任务。这8个步骤定义在 insurance-d 的身份提示词中（`src/lib/agents/prompts/insurance-d.md`）。

### Q3: insurance-d 拆分任务时，生成多少个子任务？

A: 通常生成 **8个子任务**，对应8个标准步骤。

### Q4: insurance-d 的8个标准步骤是什么？

A: 
1. 指令拆解（控方向）
2. 核心文本材料获取（补内容）
3. 标题创作（控亮点）
4. 框架搭建（控结构）
5. 正文撰写（控内容）
6. 合规自查（控底线）
7. 去AI校验（控自然）
8. 最终核对（控预期）

### Q5: insurance-d 的身份提示词在哪里？

A: `src/lib/agents/prompts/insurance-d.md`

---

## 相关文档

- [insurance-d 任务拆解流程文档（旧版）](./insurance-d-task-split-flow.md)
- [任务 ID 不匹配修复文档](./task-id-mismatch-fix.md)
- [累积拒绝原因功能实现文档](./cumulative-rejection-history.md)
