# 子任务状态流转与失败处理机制

## 概述

本文档详细说明多 Agent 协作系统中子任务的状态流转规则、失败处理机制，以及关键子任务的自动判断和级联失败逻辑。

---

## 一、子任务状态定义

### 状态列表

| 状态 | 值 | 说明 |
|------|-----|------|
| 待执行 | `pending` | 子任务已创建，等待开始执行 |
| 进行中 | `in_progress` | 子任务正在执行 |
| 已完成 | `completed` | 子任务已成功完成 |
| 已失败 | `failed` | 子任务执行失败 |

### 状态流转图

```
┌──────────┐
│ pending  │ ──开始──> in_progress
└──────────┘
    ▲               │
    │               │ 完成 / 失败
    │               ▼
    └───<── completed / failed
```

---

## 二、子任务状态更新 API

### 1. 更新子任务状态

**接口**：`PUT /api/subtasks/:id/status`

**请求体**：
```json
{
  "status": "in_progress | completed | failed",
  "statusProof": "状态更新佐证（可选）",
  "executionResult": "执行结果描述（可选）"
}
```

**响应示例**：
```json
{
  "success": true,
  "message": "子任务状态已更新",
  "data": {
    "id": "xxx",
    "status": "completed",
    "updatedAt": "2025-01-17T10:30:00.000Z"
  }
}
```

**核心逻辑**：
1. 验证子任务存在性
2. 验证状态合法性（pending → in_progress → completed/failed）
3. 更新子任务状态和相关字段（statusProof、executionResult）
4. **触发失败级联检查**（如果状态为 failed）
5. 更新父任务的子任务进展统计

---

## 三、关键子任务自动判断

### 1. 定义

**关键子任务**：如果该子任务失败，会导致：
- 后续依赖任务无法执行，或
- 整个任务目标无法实现

### 2. 判断标准（四维判断）

#### 维度 1：前置依赖性
- **定义**：该子任务是后续其他子任务的前提条件
- **示例**：
  - "搭建基础架构" → 后续开发都依赖它 → 关键
  - "准备数据集" → 数据分析依赖它 → 关键

#### 维度 2：核心功能
- **定义**：该子任务是实现目标的核心功能
- **示例**：
  - "开发用户登录" → 电商系统核心功能 → 关键
  - "开发商品详情" → 电商系统核心功能 → 关键
  - "开发评论功能" → 可选功能 → 非关键

#### 维度 3：无替代方案
- **定义**：该子任务失败后，没有可用的替代方案
- **示例**：
  - "连接数据库" → 没有替代方案 → 关键
  - "发送邮件通知" → 可以改用短信通知 → 非关键

#### 维度 4：不可延后性
- **定义**：该子任务必须现在完成，不能延后到后续迭代
- **示例**：
  - "系统安全认证" → 必须现在完成 → 关键
  - "个性化推荐" → 可以延后迭代 → 非关键

### 3. 判断流程

```
第一步：检查前置依赖
  → 如果有后续子任务依赖此任务 → isCritical = true

第二步：检查核心性
  → 如果是实现目标的核心功能 → isCritical = true

第三步：检查替代性
  → 如果失败后无替代方案 → isCritical = true

第四步：检查延后性
  → 如果必须现在完成，不能延后 → isCritical = true

否则 → isCritical = false
```

**优先级**：前置依赖 > 核心功能 > 无替代方案 > 不可延后性

### 4. LLM 自动判断

在任务拆分时，LLM 会自动判断每个子任务的关键性，并返回以下字段：

```typescript
{
  orderIndex: 1,
  title: "子任务标题",
  description: "子任务描述",
  acceptanceCriteria: "验收标准",
  isCritical: true,  // 🔥 关键子任务标记
  criticalReason: "这是基础架构搭建，所有后续开发都依赖于它"  // 🔥 关键原因
}
```

### 5. 数据存储

在 `agentSubTasks` 表的 `metadata` 字段中存储：

```json
{
  "acceptanceCriteria": "素材收集完成，整理成文档",
  "isCritical": true,  // 关键子任务标记
  "criticalReason": "素材是文章撰写的前提，没有素材无法撰写文章",  // 关键原因
  "markedBy": "llm",  // 标记方式（llm | manual）
  "markedAt": "2025-01-17T10:30:00.000Z"  // 标记时间
}
```

---

## 四、失败状态级联机制

### 1. 级联规则

#### P0 级规则：失败状态级联

**规则 1：子任务失败 → 指令失败**
- 触发条件：子任务状态更新为 `failed` 且 `isCritical = true`
- 级联动作：将关联的 `commandResult.executionStatus` 更新为 `failed`
- 级联范围：仅影响关联的指令

**规则 2：指令失败 → 任务失败**
- 触发条件：`commandResult.executionStatus` 更新为 `failed`
- 级联动作：将关联的 `agentTasks.status` 更新为 `failed`
- 级联范围：影响整个任务

**规则 3：任务失败 → 所有子任务失败**
- 触发条件：`agentTasks.status` 更新为 `failed`
- 级联动作：将该任务的所有子任务状态更新为 `failed`
- 级联范围：影响任务下的所有子任务

### 2. 级联实现

#### 实现位置

**文件**：`src/lib/services/task-state-machine.ts`

#### 核心方法

```typescript
/**
 * 级联更新子任务失败状态
 *
 * 当一个子任务失败时：
 * 1. 检查是否为关键子任务（isCritical = true）
 * 2. 如果是关键子任务，级联更新关联的指令状态为 failed
 * 3. 指令失败后，继续级联更新任务状态为 failed
 * 4. 任务失败后，级联更新所有子任务状态为 failed
 */
async cascadeTaskFailure(
  taskId: string,
  reason: string,
  failedBy: string
): Promise<void>;

/**
 * 级联更新指令失败状态
 *
 * 当一个指令失败时：
 * 1. 更新指令状态为 failed
 * 2. 级联更新关联的任务状态为 failed
 * 3. 任务失败后，级联更新所有子任务状态为 failed
 */
async cascadeCommandFailure(
  commandResultId: string,
  reason: string,
  failedBy: string
): Promise<void>;
```

#### 触发时机

**场景 1**：子任务状态更新为 failed

```typescript
// src/app/api/subtasks/[id]/status/route.ts

if (status === 'failed') {
  const subTask = await getSubTaskById(id);

  // 🔥 检查是否为关键子任务
  if (subTask.metadata?.isCritical) {
    // 🔥 级联更新指令失败状态
    await taskStateMachine.cascadeCommandFailure(
      subTask.commandResultId,
      `关键子任务失败：${subTask.taskTitle}`,
      'subtask_failure'
    );
  }
}
```

**场景 2**：指令状态更新为 failed

```typescript
// src/lib/services/task-state-machine.ts

async updateCommandStatus(
  commandResultId: string,
  status: 'new' | 'in_progress' | 'completed' | 'failed',
  reason: string
): Promise<void> {
  // ... 更新指令状态

  // 🔥 如果指令失败，级联更新任务状态
  if (status === 'failed') {
    await this.cascadeCommandFailure(commandResultId, reason, 'command_failure');
  }
}
```

---

## 五、实际业务场景

### 场景 1：软件开发项目

**任务**：开发一个电商系统

**子任务拆分**：

```json
[
  {
    "orderIndex": 1,
    "title": "搭建项目基础架构",
    "description": "创建项目框架、配置开发环境、搭建 CI/CD 流程",
    "isCritical": true,
    "criticalReason": "基础架构是所有后续开发的前提，没有架构无法开发任何功能"
  },
  {
    "orderIndex": 2,
    "title": "开发用户登录注册模块",
    "description": "实现用户注册、登录、密码找回功能",
    "isCritical": true,
    "criticalReason": "用户认证是电商系统的核心功能，没有认证用户无法使用系统"
  },
  {
    "orderIndex": 3,
    "title": "开发商品评论模块",
    "description": "实现商品评论、评分、回复功能",
    "isCritical": false,
    "criticalReason": "评论功能是可选功能，失败不影响核心电商流程"
  }
]
```

**失败场景**：

1. **非关键子任务失败**：
   - 商品评论模块失败
   - 影响：仅评论功能不可用，不影响核心电商功能
   - 级联：不触发失败级联

2. **关键子任务失败**：
   - 用户登录注册模块失败
   - 影响：整个电商系统无法使用
   - 级联：
     - 关联指令状态 → `failed`
     - 关联任务状态 → `failed`
     - 所有子任务状态 → `failed`

---

### 场景 2：保险内容创作

**任务**：创作 5 篇保险科普文章

**子任务拆分**：

```json
[
  {
    "orderIndex": 1,
    "title": "收集保险素材",
    "description": "收集相关的保险产品素材、案例素材、合规素材",
    "isCritical": true,
    "criticalReason": "素材是文章撰写的前提，没有素材无法撰写文章"
  },
  {
    "orderIndex": 2,
    "title": "撰写保险文章初稿",
    "description": "根据素材撰写保险文章初稿",
    "isCritical": true,
    "criticalReason": "文章撰写是核心任务，无法完成则整个任务失败"
  },
  {
    "orderIndex": 3,
    "title": "合规校验与修正",
    "description": "使用 Agent B 提供的合规规则进行校验，修正违规点",
    "isCritical": true,
    "criticalReason": "保险内容必须通过合规审核，否则无法发布"
  },
  {
    "orderIndex": 4,
    "title": "排版优化",
    "description": "优化文章排版，添加图片、图表",
    "isCritical": false,
    "criticalReason": "排版可以延后，可以先发布后续优化"
  }
]
```

**失败场景**：

1. **非关键子任务失败**：
   - 排版优化失败
   - 影响：文章排版不够美观，但内容完整
   - 级联：不触发失败级联

2. **关键子任务失败**：
   - 合规校验失败
   - 影响：文章无法发布，任务失败
   - 级联：
     - 关联指令状态 → `failed`
     - 关联任务状态 → `failed`
     - 所有子任务状态 → `failed`

---

## 六、测试验证

### 1. 单元测试

```typescript
describe('cascadeSubTaskFailure', () => {
  it('should cascade failure when critical subtask fails', async () => {
    // 1. 创建任务和子任务
    const task = await createTask();
    const command = await createCommandResult(task.id);
    const criticalSubTask = await createSubTask(command.id, {
      metadata: { isCritical: true }
    });

    // 2. 更新子任务状态为 failed
    await updateSubTaskStatus(criticalSubTask.id, 'failed');

    // 3. 验证级联效果
    const updatedCommand = await getCommandResult(command.id);
    expect(updatedCommand.executionStatus).toBe('failed');

    const updatedTask = await getTask(task.id);
    expect(updatedTask.status).toBe('failed');

    const allSubTasks = await getSubTasksByCommand(command.id);
    allSubTasks.forEach(st => {
      expect(st.status).toBe('failed');
    });
  });

  it('should not cascade failure when non-critical subtask fails', async () => {
    // 1. 创建任务和非关键子任务
    const task = await createTask();
    const command = await createCommandResult(task.id);
    const nonCriticalSubTask = await createSubTask(command.id, {
      metadata: { isCritical: false }
    });

    // 2. 更新子任务状态为 failed
    await updateSubTaskStatus(nonCriticalSubTask.id, 'failed');

    // 3. 验证不会级联
    const updatedCommand = await getCommandResult(command.id);
    expect(updatedCommand.executionStatus).not.toBe('failed');

    const updatedTask = await getTask(task.id);
    expect(updatedTask.status).not.toBe('failed');
  });
});
```

### 2. 集成测试

```bash
# 测试 API：更新子任务状态为 failed（关键子任务）
curl -X PUT http://localhost:5000/api/subtasks/xxx/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "failed",
    "statusProof": "执行超时"
  }'

# 验证级联效果
# 1. 关联指令状态应为 failed
# 2. 关联任务状态应为 failed
# 3. 所有子任务状态应为 failed
```

### 3. 手动验证

```sql
-- 查看关键子任务标记
SELECT
  id,
  task_title,
  status,
  metadata->>'isCritical' as is_critical,
  metadata->>'criticalReason' as critical_reason
FROM agent_sub_tasks
ORDER BY order_index;

-- 查看失败级联效果
SELECT
  t.id as task_id,
  t.status as task_status,
  cr.id as command_id,
  cr.execution_status as command_status,
  ast.id as subtask_id,
  ast.status as subtask_status,
  ast.metadata->>'isCritical' as is_critical
FROM agent_tasks t
LEFT JOIN command_results cr ON cr.related_task_id = t.id
LEFT JOIN agent_sub_tasks ast ON ast.command_result_id = cr.id
WHERE t.status = 'failed' OR cr.execution_status = 'failed';
```

---

## 七、实现检查清单

### ✅ 已完成

- [x] 子任务状态定义（pending、in_progress、completed、failed）
- [x] 更新子任务状态 API（PUT /api/subtasks/:id/status）
- [x] LLM 关键子任务自动判断（isCritical、criticalReason）
- [x] 关键子任务判断标准文档化（四维判断）
- [x] 失败状态级联规则文档化（P0 级规则）
- [x] 任务状态机中的失败级联实现（cascadeTaskFailure、cascadeCommandFailure）
- [x] 子任务失败时自动触发级联检查

### ⏳ 待完成

- [ ] 拆解拒绝时清理关联数据（P1）
- [ ] 关键子任务失败时的用户通知机制
- [ ] 失败原因分类和智能分析
- [ ] 失败重试策略配置
- [ ] 失败恢复建议生成

---

## 八、常见问题

### Q1：如何修改关键子任务标记？

**答**：可以通过以下方式修改：

1. **手动修改数据库**：
   ```sql
   UPDATE agent_sub_tasks
   SET metadata = jsonb_set(
     metadata,
     '{isCritical}',
     'true'
   )
   WHERE id = 'xxx';
   ```

2. **通过 API 修改**（待实现）：
   ```bash
   PUT /api/subtasks/:id/criticality
   {
     "isCritical": true,
     "criticalReason": "修改后的原因"
   }
   ```

### Q2：非关键子任务失败后如何处理？

**答**：
1. 不会触发失败级联
2. 父任务和指令状态保持不变
3. 可以：
   - 手动重试子任务
   - 跳过该子任务（如果有替代方案）
   - 将子任务标记为非关键后继续执行

### Q3：如何防止误判关键子任务？

**答**：
1. 提供清晰的判断标准和示例
2. LLM 返回详细的判断原因（criticalReason）
3. 支持人工审核和修正
4. 提供测试工具验证判断结果：
   ```bash
   curl http://localhost:5000/api/test/critical-subtask-judgment?agentId=insurance-d
   ```

### Q4：失败级联是否可以配置？

**答**：目前失败级联是强制性的，未来可以考虑：
1. 配置级联策略（立即级联、延迟级联、人工确认）
2. 配置级联范围（仅指令、仅任务、全级联）
3. 配置例外情况（某些失败不触发级联）

---

## 九、相关文档

- [任务状态流转文档](./task-status-flow.md)
- [LLM 关键子任务判断提示词优化说明](./llm-critical-subtask-prompt-optimization.md)
- [P1 场景说明](./p1-scenarios-explanation.md)
- [P1 实现方案](./p1-implementation-plan.md)

---

## 十、API 接口汇总

### 子任务管理

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/agents/[id]/subtasks` | POST | 拆分任务为子任务 |
| `/api/subtasks/[id]/status` | PUT | 更新子任务状态 |
| `/api/subtasks/[id]` | GET | 获取子任务详情 |
| `/api/subtasks?commandResultId=xxx` | GET | 获取子任务列表 |

### 测试接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/test/critical-subtask-judgment` | GET | 测试关键子任务判断功能 |
| `/api/test/failure-cascade` | GET | 测试失败级联功能 |

---

## 十一、总结

### 核心机制

1. **状态流转**：子任务状态按照预定义规则流转
2. **关键判断**：LLM 自动判断子任务关键性
3. **失败级联**：关键子任务失败时自动级联更新关联状态
4. **数据存储**：关键标记存储在 metadata 字段中

### 优势

1. ✅ **自动化**：LLM 自动判断，减少人工干预
2. ✅ **可追溯**：记录判断原因，便于审计
3. ✅ **级联保护**：失败自动级联，防止部分成功
4. ✅ **灵活性**：支持人工修正和配置

### 下一步

1. 实现拆解拒绝时的数据清理（P1）
2. 优化失败通知机制
3. 增强失败分析和恢复建议
4. 提供更多配置选项
