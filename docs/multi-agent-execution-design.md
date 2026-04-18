# 多 Agent 执行架构设计

## 1. 概述

本文档设计了基于 Next.js 的多 Agent 协作任务执行系统，包含任务拆解、分发、执行、监控等全流程。

## 2. 核心架构

### 2.1 执行器模式 (Executor Pattern)

采用抽象基类 + 工厂模式实现各 Agent 的执行逻辑解耦。

```
BaseExecutor (抽象基类)
    ├── InsuranceDExecutor
    ├── InsuranceCExecutor
    ├── AgentBExecutor
    └── ...
```

### 2.2 组件职责

| 组件 | 职责 |
|------|------|
| `BaseExecutor` | 定义执行器接口，包含通用逻辑 |
| `ExecutorFactory` | 根据 Agent ID 创建对应的执行器实例 |
| `TaskDispatcher` | 负责任务分发，将 pending 状态的子任务标记为 dispatched |
| `TaskExecutor` | 负责任务执行，调用对应的执行器 |
| `TimeoutMonitor` | 监控超时任务，处理异常情况 |

## 3. 执行器设计

### 3.1 BaseExecutor 抽象基类

```typescript
abstract class BaseExecutor {
  abstract agentId: AgentId;
  
  /**
   * 执行子任务
   */
  abstract execute(subTask: AgentSubTask): Promise<ExecutionResult>;
  
  /**
   * 验证任务是否可以执行
   */
  abstract validate(subTask: AgentSubTask): Promise<ValidationResult>;
  
  /**
   * 处理执行失败
   */
  abstract handleFailure(subTask: AgentSubTask, error: Error): Promise<void>;
}
```

### 3.2 Executor Factory

```typescript
class ExecutorFactory {
  static createExecutor(agentId: AgentId): BaseExecutor {
    switch (agentId) {
      case 'insurance-d':
        return new InsuranceDExecutor();
      case 'insurance-c':
        return new InsuranceCExecutor();
      case 'B':
        return new AgentBExecutor();
      default:
        throw new Error(`Unsupported agent: ${agentId}`);
    }
  }
}
```

## 4. 定时任务设计

### 4.1 三个定时任务协同工作

| 定时任务 | 职责 | 执行频率 |
|---------|------|---------|
| `dispatch-agent-subtasks` | 分发任务：将 pending 状态且 isDispatched=false 的子任务标记为 dispatched | 每分钟 |
| `execute-agent-subtasks` | 执行任务：处理 dispatched 和 in_progress 状态的子任务 | 每分钟 |
| `monitor-subtasks-timeout` | 监控超时：处理长时间处于 in_progress 状态的任务 | 每 5 分钟 |

### 4.2 任务流转

```
创建 (pending, isDispatched=false)
    ↓
[dispatch-agent-subtasks]
    ↓
已分发 (pending, isDispatched=true)
    ↓
[execute-agent-subtasks]
    ↓
执行中 (in_progress, isDispatched=true)
    ↓
[execute-agent-subtasks] 完成执行
    ↓
已完成 (completed) / 阻塞 (blocked) / 升级 (escalated)
```

## 5. 状态流转详细设计

见 [agent-sub-tasks-status-flow.md](./agent-sub-tasks-status-flow.md)

## 6. 数据库表设计

### 6.1 agent_sub_tasks 表

```sql
CREATE TABLE agent_sub_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(50) NOT NULL,
    task_title TEXT NOT NULL,
    task_description TEXT,
    order_index INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    is_dispatched BOOLEAN NOT NULL DEFAULT false,
    result TEXT,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    command_result_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## 7. 错误处理与降级策略

### 7.1 错误类型

| 错误类型 | 处理策略 |
|---------|---------|
| 验证失败 | 标记为 blocked，记录错误信息 |
| 执行超时 | 标记为 timeout，可重试或升级 |
| 执行失败 | 标记为 blocked，记录错误堆栈 |
| Agent 不可用 | 标记为 escalated，通知人工干预 |

### 7.2 重试机制

- 对于可重试错误，最多重试 3 次
- 重试间隔采用指数退避：1分钟、2分钟、4分钟
- 超过重试次数后标记为 escalated
