# Agent B 功能实现详细设计

## 概述

Agent B（业务流程控制专家）负责任务执行后的评审工作，包括：
1. 判断任务是否完成
2. 判断任务指派是否正确
3. 决定是否需要用户介入

---

## 一、指令执行后

**职责**：判断任务是否完成、是否需要提交给用户审核

### 1.1 判断当前任务是否完成

| 执行 Agent | 判断逻辑 |
|-----------|---------|
| **不是 Agent T** | 直接基于执行 Agent 反馈结果判断：COMPLETE / NEED_USER / REEXECUTE_EXECUTOR |
| **是 Agent T** | 参考 Agent T 反馈 + **检查 MCP 执行结果**<br/>只有 MCP 执行结果确实完成 → COMPLETE<br/>如果 Agent T 反馈 `pre_need_support` → 直接反馈用户（Agent T 技能不存在） |

#### 1.1.1 Agent T 执行结果判断

当执行 Agent 是 Agent T 时：

1. **Agent T 反馈 `pre_need_support`（返回 CANNOT_HANDLE）**
   → Agent T 技能不存在，无法处理
   → 返回 NEED_USER（直接反馈用户）

2. **Agent T 反馈 `pre_completed` + MCP 执行结果确实完成**
   → MCP 执行成功
   → 返回 COMPLETE（任务完成）

3. **Agent T 反馈 `pre_completed` + MCP 执行结果失败**
   → MCP 执行失败
   → 判断是否重试或需要用户介入

---

### 1.2 判断当前任务指派是否正确（收到 `pre_need_support`）

当收到 `pre_need_support` 时，需要判断任务指派是否正确。

#### 判断流程

```
收到 pre_need_support
    │
    ├── 执行 Agent 是 Agent T？
    │       │
    │       ├── 是 → 直接返回 NEED_USER（Agent T 技能不存在）
    │       │
    │       └── 否 → 继续判断
    │
    ├── 执行 Agent 不是 Agent T
    │       │
    │       ├── 身份与任务匹配检查
    │       │       │
    │       │       ├── 以 capability_list 的描述为依据判断是否为技术任务
    │       │       │
    │       │       └── 技术任务关键词：合规、审核、校验、上传、下载、搜索、查询、获取
    │       │
    │       └── 根据匹配结果决定处理方式
```

#### 处理规则

| 匹配情况 | 执行者 | 状态 | 说明 |
|---------|-------|------|------|
| **Agent T 反馈 `pre_need_support`** | - | `waiting_user` | Agent T 技能不存在，直接转给用户 |
| **身份与任务匹配没问题** | - | `waiting_user` | 无需重分配，直接交用户确认 |
| **身份与任务匹配有问题 + 技术任务** | `agent T` | `pending` | 以 capability_list 为依据，重分配给 Agent T 执行 |
| **身份与任务匹配有问题 + 非技术任务** | 对应业务 Agent | `pending` | 按 Agent 身份定义，重分配给对应的业务执行 Agent |

#### 技术任务判断依据

以 `capability_list` 的描述为依据：
- 如果任务需要调用 `capability_list` 中的能力，则为技术任务
- 如果任务不需要技术能力，则为非技术任务

#### 身份匹配规则

| 任务类型 | 正确执行者 | 错误执行者 |
|---------|----------|----------|
| 技术任务 | Agent T | insurance-d 等业务 Agent |
| 非技术任务 | insurance-d 等业务 Agent | Agent T |

---

## 二、指令执行前

**职责**：负责依据 Agent 的身份严格拆分任务，任务尽可能原子化

### 2.1 拆分原则

- 技术任务与业务任务**不能混在一个指令中**
- 是否为技术任务：以 `capability_list` 的描述为依据
- 非技术任务：按执行 Agent 的身份定义进行原子化拆分

### 2.2 后续扩展

后续任务拆分工作交给 Agent B 执行。

---

## 三、Agent B 决策类型

| 决策类型 | 含义 | 使用场景 |
|---------|------|---------|
| `COMPLETE` | 任务完成 | 执行 Agent 说完成了，或 MCP 执行成功 |
| `NEED_USER` | 需要用户交互 | 需要用户确认、选择或输入，或 Agent T 无法处理 |
| `REEXECUTE_EXECUTOR` | 重新执行 | 让执行 Agent 补充信息后重试，或重新分配执行者 |
| `EXECUTE_MCP` | 需要技术处理 | 需要 MCP 解决或技术问题 |
| `FAILED` | 任务失败 | 无法继续且没有其他解决方案 |

---

## 四、核心判断字段

### 4.1 执行 Agent 返回字段

| 字段 | 含义 | 决策 |
|------|------|------|
| `canComplete = true` | 任务可以完成 | COMPLETE |
| `canComplete = false + reason="不是我的职责"` | 不是执行 Agent 的职责范围 | EXECUTE_MCP（交给 Agent T） |
| `canComplete = false + reason="缺少"` | 缺少必要信息 | REEXECUTE_EXECUTOR |
| `isTaskDown = true` | 执行 Agent 确认任务已完成 | COMPLETE |

### 4.2 MCP 执行结果判断

| MCP 执行结果 | 决策 |
|-------------|------|
| 任何一次尝试的"结果: success" | COMPLETE（技术处理已成功完成） |
| 所有尝试的"结果: failed" | 判断是否重试、切换方案或需要用户介入 |

---

## 五、代码实现

### 5.1 核心文件

| 文件 | 说明 |
|------|------|
| `src/lib/agents/prompts/agent-b-business-controller.ts` | Agent B 提示词 |
| `src/lib/services/subtask-execution-engine.ts` | 执行引擎，包含 `handlePreNeedSupportReview` 等方法 |

### 5.2 关键方法

| 方法 | 说明 |
|------|------|
| `handlePreNeedSupportReview` | 处理 `pre_need_support` 状态的评审 |
| `isTechnicalTask` | 判断是否为技术任务 |
| `checkExecutorMatchesTask` | 检查执行者是否与任务类型匹配 |
| `executeAgentBDecisionAndMcp` | Agent B 决策 + MCP 调用 |

### 5.3 handlePreNeedSupportReview 核心逻辑

```typescript
private async handlePreNeedSupportReview(task) {
  const currentExecutor = task.fromParentsExecutor;
  const isAgentT = currentExecutor?.toLowerCase().includes('agent t');

  // 1. 如果是 Agent T，返回 NEED_USER（Agent T 技能不存在）
  if (isAgentT) {
    await this.setWaitingUser(task, 'Agent T 技能不存在，需要用户介入');
    return;
  }

  // 2. 非 Agent T：判断任务指派是否正确
  const capabilities = await this.queryCapabilityList();
  const isTechnicalTask = this.isTechnicalTask(task.taskTitle, capabilities);
  const executorMatchesTask = this.checkExecutorMatchesTask(currentExecutor, isTechnicalTask);

  // 3. 根据匹配结果决定处理方式
  if (executorMatchesTask) {
    // 转给用户审核
    await this.setWaitingUser(task, '身份与任务匹配没问题');
  } else if (isTechnicalTask) {
    // 技术任务：执行者改为 agent T
    await this.reassignExecutor(task, 'agent T');
  } else {
    // 非技术任务：按 Agent 身份设置对应执行 Agent
    await this.reassignExecutor(task, currentExecutor || 'insurance-d');
  }
}
```

---

## 六、状态流转图

```
┌─────────────────────────────────────────────────────────────────────┐
│ 执行 Agent 执行完毕                                                  │
│ 状态变为：pre_need_support 或 pre_completed                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 进入 handlePreNeedSupportReview（pre_need_support 入口）            │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
               是 Agent T                 不是 Agent T
                    │                           │
                    ▼                           ▼
          ┌─────────────────┐       ┌─────────────────────────┐
          │ 返回 NEED_USER  │       │ 判断任务指派是否正确     │
          │ (技能不存在)    │       └─────────────────────────┘
          └─────────────────┘                 │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                        匹配没问题      技术任务          非技术任务
                              │               │               │
                              ▼               ▼               ▼
                    ┌─────────────────┐ ┌───────────────┐ ┌───────────────┐
                    │ 转给用户审核    │ │ 改为 Agent T  │ │ 改为业务 Agent │
                    │ waiting_user    │ │ pending       │ │ pending       │
                    └─────────────────┘ └───────────────┘ └───────────────┘
```

---

## 七、版本历史

| 版本 | 日期 | 修改内容 |
|------|------|---------|
| v1.0 | 2026-03-31 | 初始版本，包含基本评审逻辑 |
| v2.0 | 2026-03-31 | 新增任务指派判断逻辑 |
| v2.1 | 2026-03-31 | 修正：Agent T 反馈 `pre_need_support` 直接返回 NEED_USER |

