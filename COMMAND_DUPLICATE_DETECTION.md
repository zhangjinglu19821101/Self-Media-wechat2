# 系统指令重复判断逻辑梳理

## 📊 涉及的 3 张核心表

### 1. agentTasks（总任务表）
存储 Agent 间下达的总任务（任务拆解前）。

**关键字段：**
```typescript
{
  taskId: string;              // 任务唯一ID，格式：task-{timestamp}-{random}
  taskName: string;            // 任务名称
  coreCommand: string;         // 核心指令内容（向量库同步字段）⭐
  executor: string;            // 执行主体（向量库同步字段）⭐
  acceptanceCriteria: string;  // 验收标准
  taskType: string;            // 任务类型（master=总任务）
  splitStatus: string;         // 拆解状态（pending_split/split_pending_review/split_confirmed）
  taskDurationStart: Date;     // 任务开始时间
  taskDurationEnd: Date;       // 任务结束时间（向量库同步字段）⭐
  totalDeliverables: string;   // 总交付物（向量库同步字段）⭐
  taskPriority: string;        // 任务优先级
  taskStatus: string;          // 任务状态
  fromAgentId: string;         // 发起方 Agent ID
  toAgentId: string;           // 接收方 Agent ID
  commandType: string;         // 指令类型
  metadata: JSONB;             // 附加元数据
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date;
}
```

**业务流程：**
1. Agent A 创建任务 → `POST /api/agents/tasks`
2. Agent B 拆分任务 → `POST /api/agents/tasks/[taskId]/split`
3. Agent A 确认/拒绝拆解 → `POST /api/agents/tasks/[taskId]/confirm-split`

---

### 2. commandResults（指令执行结果表）
存储拆分后的子任务指令。

**关键字段：**
```typescript
{
  id: uuid;                    // 主键
  commandId: string;           // 指令唯一ID，格式：cmd-task-{date}-{taskId_seq}-{seq} ⭐
  relatedTaskId: string;       // 关联的总任务ID（外键 → agentTasks.taskId）
  commandContent: string;      // 指令内容
  executor: string;            // 执行主体
  commandPriority: string;     // 指令优先级
  executionDeadlineStart: Date; // 执行开始时间
  executionDeadlineEnd: Date;   // 执行结束时间
  deliverables: string;        // 指令交付物
  executionStatus: string;     // 执行状态（new/in_progress/completed/feedback_completed/failed）
  splitter: string;            // 拆分人
  entryUser: string;           // 录入人
  fromAgentId: string;         // 提交执行结果的 Agent ID
  toAgentId: string;           // 接收执行结果的 Agent ID
  originalCommand: string;     // 原始指令内容

  // 🔥 新增：确认相关
  taskType: string;            // 任务类型（daily=每日任务）
  executionDate: string;       // 执行日期（YYYY-MM-DD）
  isConfirmed: boolean;        // 是否已确认
  confirmedBy: string;         // 确认人
  confirmedAt: Date;           // 确认时间
  rejectionReason: string;     // 拒绝理由

  // 🔥 新增：任务依赖
  dependencies: JSONB;         // 任务依赖关系 {after: [], before: []}
  sortOrder: integer;          // 排序

  // 🔥 新增：子任务管理
  completedSubTasks: integer;  // 当前进展到第几个子任务
  completedSubTasksDescription: string; // 当前子任务描述
  subTaskCount: integer;       // 拆分的子任务总数
  questionStatus: string;      // 问题状态（none/pending/resolved）
  lastCheckedAt: Date;         // 最后自检时间
  lastInspectedAt: Date;       // 最后巡检时间

  // 🔥 新增：对话相关
  dialogueSessionId: string;   // 对话会话 ID
  dialogueRounds: integer;     // 对话轮数
  dialogueStatus: string;      // 对话状态（none/in_progress/completed/timeout）
  lastDialogueAt: Date;        // 最后对话时间

  // 🔥 新增：报告管理
  latestReportId: uuid;        // 最新报告 ID（外键 → agentReports.id）
  reportCount: integer;        // 报告数量
  requiresIntervention: boolean; // 是否需要 Agent A 介入

  createdAt: Date;
  updatedAt: Date;
  completedAt: Date;
}
```

**业务流程：**
1. Agent B 拆分任务时创建 → `POST /api/commands/split`
2. `commandId` 生成规则：`cmd-task-${dateStr}-${taskId_seq}-${seq}`（例如：`cmd-task-20260222-001-01`）
3. 执行 Agent 接收任务，更新状态
4. Agent B 巡检超长任务，触发对话判断
5. 生成报告并上报给 Agent A

---

### 3. agentSubTasks（子任务表）
存储 Agent 自己拆分的执行步骤（更细粒度）。

**关键字段：**
```typescript
{
  id: uuid;                    // 主键
  commandResultId: uuid;       // 关联的 commandResults.id（外键）⭐
  agentId: string;             // 所属 Agent ID
  taskTitle: string;           // 子任务标题
  taskDescription: string;     // 子任务描述
  status: string;              // 执行状态（pending/in_progress/completed/blocked）
  orderIndex: integer;         // 执行顺序

  // 🔥 新增：对话相关
  dialogueSessionId: string;   // 对话会话 ID
  dialogueRounds: integer;     // 对话轮数
  dialogueStatus: string;      // 对话状态（none/in_progress/completed/timeout）
  lastDialogueAt: Date;        // 最后对话时间

  startedAt: Date;
  completedAt: Date;
  metadata: JSONB;
  createdAt: Date;
  updatedAt: Date;
}
```

**业务流程：**
1. 执行 Agent（如 insurance-c）接收任务后，自行拆分为更细粒度的子任务
2. 按顺序执行子任务
3. Agent B 巡检子任务执行情况

---

## 🔍 当前重复判断逻辑

### 1. 向量同步服务（`src/lib/services/task-vector-sync.ts`）

**向量同步字段（5 个）：**
```typescript
interface TaskVectorData {
  taskId: string;
  taskName: string;
  coreCommand: string;      // 核心指令（权重最高）⭐
  executor: string;         // 执行主体⭐
  taskDurationEnd: string;  // 任务结束时间⭐
  totalDeliverables: string; // 总交付物⭐
}
```

**向量文本生成规则：**
```
任务ID：{taskId}
任务名称：{taskName}
核心指令：{coreCommand}      // 权重最高，放在前面
执行主体：{executor}
任务结束时间：{taskDurationEnd}
总交付物：{totalDeliverables}
```

---

### 2. 重复判断规则（`TaskVectorSync.isDuplicateTask()`）

**判断条件（3 个）：**
1. **相似度 ≥ 0.8**（使用向量相似度计算）
2. **执行时间差 ≤ 1 周**
3. **总交付物相似**（简单包含判断）

**判断逻辑：**
```typescript
static async isDuplicateTask(
  coreCommand: string,
  taskDurationEnd: Date,
  totalDeliverables: string
): Promise<{ isDuplicate: boolean; similarTask?: any }> {
  // 1. 查询相似任务（相似度 ≥ 0.8）
  const similarTasks = await this.findSimilarTasks(coreCommand, 0.8, 10);

  // 2. 遍历相似任务，判断时间差和交付物
  for (const similarTask of similarTasks) {
    // 判断执行时间差 ≤ 1 周
    const timeDiff = Math.abs(taskDurationEnd.getTime() - similarTaskEndTime.getTime());
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    if (timeDiff > oneWeekMs) {
      continue; // 时间差超过 1 周，不是重复任务
    }

    // 判断总交付物是否相似（简单包含判断）
    if (totalDeliverables.includes(similarTask.totalDeliverables) ||
        similarTask.totalDeliverables.includes(totalDeliverables)) {
      return { isDuplicate: true, similarTask };
    }
  }

  return { isDuplicate: false };
}
```

---

### 3. ⚠️ 当前状态：逻辑已定义，但**未启用**

**问题：**
1. ✅ 重复判断方法 `isDuplicateTask()` 已定义
2. ❌ 向量库功能未实现（TODO 注释）
3. ❌ `findSimilarTasks()` 暂时返回空数组
4. ❌ `syncTaskToVector()` 未实际存储到向量库
5. ❌ **没有地方调用** `isDuplicateTask()` 进行重复检查

**代码位置：**
```typescript
// src/lib/services/task-vector-sync.ts

// ❌ 未实现：存储到向量库
static async syncTaskToVector(taskId: string) {
  // TODO: 实现 FileVectorDB 存储
  // await fileVectorDB.insert({...});
}

// ❌ 未实现：搜索相似任务
static async findSimilarTasks(coreCommand: string, threshold: number = 0.8, limit: number = 5) {
  // TODO: 实现 FileVectorDB 搜索
  // TODO: 暂时返回空数组
  return [];
}

// ✅ 已定义：判断重复任务
static async isDuplicateTask(...) {
  // 逻辑完整，但依赖 findSimilarTasks()
  return { isDuplicate: false }; // ⚠️ 实际总是返回 false
}
```

---

## 🔧 建议的优化方案

### 方案 1：启用向量库重复检查（推荐）

**实施步骤：**
1. **实现向量库存储**（`syncTaskToVector()`）
   - 使用现有的 `FileVectorDB` 或实现新的向量库
   - 在任务创建/更新时同步向量

2. **实现相似任务搜索**（`findSimilarTasks()`）
   - 使用向量相似度计算（余弦相似度）
   - 支持设置阈值（默认 0.8）

3. **集成重复检查到任务创建流程**
   - 在 `POST /api/agents/tasks` 中调用 `isDuplicateTask()`
   - 如果检测到重复，提示用户或自动合并

**优点：**
- 支持语义相似度判断
- 灵活的阈值配置
- 可扩展性强

**缺点：**
- 需要实现向量库
- 需要额外的向量计算资源

---

### 方案 2：简化重复判断（快速实施）

**判断规则（简化版）：**
1. **完全匹配**：`coreCommand` 完全相同
2. **时间窗口**：执行时间差 ≤ 7 天
3. **执行主体相同**：`executor` 相同

**实施步骤：**
1. 在创建任务前查询 `agentTasks` 表
2. 筛选条件：
   ```typescript
   AND(
     eq(agentTasks.executor, newTask.executor),
     eq(agentTasks.coreCommand, newTask.coreCommand),  // 完全匹配
     gt(agentTasks.taskDurationEnd, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))  // 7 天内
   )
   ```
3. 如果存在匹配，提示用户

**优点：**
- 实现简单，无需向量库
- 性能好（普通 SQL 查询）

**缺点：**
- 只支持完全匹配，无法识别语义相似的任务
- 灵活性较低

---

### 方案 3：混合方案（平衡方案）

**判断规则（混合版）：**
1. **第一层**：简化判断（完全匹配 + 时间窗口 + 执行主体）
2. **第二层**：向量相似度判断（语义相似 + 时间窗口 + 交付物相似）

**实施步骤：**
1. 先执行简化判断（快速筛选）
2. 如果第一层未命中，再执行向量相似度判断
3. 提供详细的重复提示信息

**优点：**
- 快速响应常见重复场景
- 支持语义相似度判断
- 资源消耗可控

**缺点：**
- 实现复杂度较高

---

## 📋 推荐实施计划

### Phase 1：快速实施（方案 2）
**时间：1 天**
1. 在 `POST /api/agents/tasks` 中添加简化重复判断
2. 提示用户：检测到相似任务，是否继续创建？
3. 记录重复检测日志

### Phase 2：语义支持（方案 1）
**时间：3-5 天**
1. 实现向量库存储（`FileVectorDB`）
2. 实现相似任务搜索
3. 集成到任务创建流程
4. 优化相似度阈值

### Phase 3：混合优化（方案 3）
**时间：2-3 天**
1. 实现混合判断逻辑
2. 优化性能（缓存、索引）
3. 提供重复任务管理界面

---

## 🔗 相关代码文件

| 文件路径 | 功能描述 | 状态 |
|---------|---------|------|
| `src/lib/db/schema.ts` | 数据库表定义 | ✅ 完成 |
| `src/lib/services/task-vector-sync.ts` | 向量同步服务 | ⚠️ 逻辑已定义，未启用 |
| `src/lib/services/agent-task.ts` | Agent 任务服务 | ✅ 完成 |
| `src/lib/services/task-manager.ts` | 任务管理服务 | ✅ 完成 |
| `src/app/api/agents/tasks/route.ts` | 任务创建 API | ❌ 无重复检查 |
| `src/app/api/commands/split/route.ts` | 任务拆分 API | ❌ 无重复检查 |

---

## 📌 结论

**当前状态：**
- 重复判断逻辑已定义，但**未启用**
- 向量库功能未实现（TODO 状态）
- 没有任何地方调用重复检查方法

**建议行动：**
1. 优先实施**方案 2（简化判断）**，快速解决常见重复场景
2. 后续实施**方案 1（向量判断）**，支持语义相似度
3. 最终实现**方案 3（混合方案）**，提供完整的重复检测能力
