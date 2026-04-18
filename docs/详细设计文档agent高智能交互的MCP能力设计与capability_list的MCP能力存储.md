# 高度智能化 Agent B 与执行 Agent 交互全流程详细设计
（基于现有 `capability_list` 表结构·无表结构改动·可直接复制至 Word）
# 执行案例 ：src>app>api>test>run-all-tests>route.tsroute.ts


## 一、文档概述
### 1.1 设计目标
1.  **表职责纯粹化**：`agent_sub_tasks_step_history` 仅做**智能体原始交互登记**，不存放任何 MCP 专属字段，所有 MCP 信息收敛到 `interact_content`
2.  **参数极简化**：Agent B 仅传递**业务核心字段**，技术参数由 `capability_list` 统一兜底，执行器自动合并
3.  **逻辑统一化**：全程使用现有 `capability_list` 字段（下划线命名），无新增/修改表结构
4.  **知识闭环化**：基于交互原始数据实现「原料→加工→复用」的知识库自迭代
5.  **异常标准化**：MCP 异常日志、分析、修复流程统一（低优先级后续实现）

### 1.2 适用场景
- 核心业务：保险自媒体（文章发布、合规校验、向量库检索）
- 扩展业务：AI自媒体事业部（短视频生成、多平台分发）
- 通用能力：所有 Agent 与 MCP 交互场景

### 1.3 核心设计原则
1.  **执行端只传业务**：执行 Agent / Agent B 不关心 MCP 技术细节
2.  **配置端只存规范**：`capability_list` 是所有 MCP 参数规范唯一来源
3.  **执行器只做合并**：不修改业务参数，仅补充默认技术参数
4.  **记录表只存原始**：不存储加工后经验，仅作为知识库原料
5.  **全流程可追溯**：交互、参数、结果、经验复用 100% 留痕(agent_sub_tasks_step_history,capability_list,agent_sub_tasks_step_history,形成知识库)



## 二、核心角色与职责边界
| 角色 | 核心职责 | 禁止行为 |
|------|----------|----------|
| 执行 Agent（insurance-d） | 发起标准化业务请求，接收最终结果 | 不组装 MCP 参数、不调用 MCP、不上报 |
| Agent B | 读取请求→匹配能力→拼装核心参数→输出 MCP 指令→解析结果 | 不关注技术参数、不修改配置、不跳过校验 |
| 控制器/执行器 | 交互落库→提取核心参数→合并默认技术参数→调用 MCP→回传结果 | 不修改 Agent B 传入的业务参数、不理解业务含义 |
| capability_list（现有表） | 存储 MCP 唯一规范：核心字段、参数模板、示例、默认值、校验规则 | 不存储运行时业务数据、不存储动态参数 |
| agent_sub_tasks_step_history | 存储全交互原始数据，作为知识库唯一原料 | 不存放 MCP 专属字段、不存储加工后经验 |
| Agent A | 处理 Agent B 无法自动修复的异常待办 | 不参与自动执行流程 |

---

## 三、核心表结构设计
### 3.1 表1：agent_sub_tasks_step_history（交互原始记录表）
**唯一职责：智能体全交互原始登记，知识库原料库**

```sql
CREATE TABLE agent_sub_tasks_step_history (
  id SERIAL PRIMARY KEY,
  command_result_id UUID NOT NULL, -- 关联 agent_sub_tasks 表的 command_result_id
  step_no INT NOT NULL, -- 步骤编号（对应 agent_sub_tasks.order_index）
  interact_type TEXT NOT NULL, -- request/response
  interact_content JSONB NOT NULL, -- 结构化交互内容
  interact_user TEXT NOT NULL, -- 交互发起方（insurance-d/agent B/human）
  interact_time TIMESTAMP NOT NULL DEFAULT NOW(), -- 交互发生时间
  interact_num INT NOT NULL DEFAULT 1, -- 同 command_result_id + step_no 下的交流次数
  
  -- 唯一约束
  CONSTRAINT idx_task_step_num UNIQUE (command_result_id, step_no, interact_num, interact_type, interact_user)
);

-- 索引
CREATE INDEX idx_command_result ON agent_sub_tasks_step_history(command_result_id);
CREATE INDEX idx_interact_type ON agent_sub_tasks_step_history(interact_type);
```

**字段说明：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial | 主键 |
| command_result_id | uuid | 关联 agent_sub_tasks.command_result_id |
| step_no | integer | 步骤编号 |
| interact_type | text | 交互类型（request/response）|
| interact_content | jsonb | 交互内容（含决策、MCP尝试、用户交互等）|
| interact_user | text | 交互发起方（insurance-d/agent B/human）|
| interact_time | timestamp | 交互时间 |
| interact_num | integer | 交互次数（同一步骤下递增）|

### 3.2 表2：capability_list（现有表·保留原结构）
**唯一职责：MCP 能力与参数规范的唯一数据源**
现有字段清单（完全保留）：
- id、capability_type、function_desc、status
- requires_on_site_execution、metadata、created_at、updated_at
- interface_schema、tool_name、action_name
- param_examples、param_template、scene_tags、agent_response_spec

**关键字段统一用途**：
| 字段 | 用途（基于现有结构） |
|------|----------------------|
| capability_type | MCP 唯一标识（如 wechat_upload_article） |
| interface_schema | 核心字段列表 + 校验规则 |
| param_template | 核心字段空模板 |
| param_examples | 核心字段示例 |
| metadata | 存储：default_params（默认技术参数）、apply_agent_types、timeout、business_rules |
| status | available/disabled |
| scene_tags | 场景匹配标签 |

---

## 四、标准化交互内容（interact_content）

### 4.1 统一规范
1.  **所有 MCP 信息放入 JSON**，表无感知
2.  **字段命名统一**：使用下划线命名（与代码一致）
3.  **结构分层**：interact_type、consultant、responder、question、response
4.  **MCP信息放入 JSONB**，表无感知
5.  **字段命名统一**：使用下划线命名（与代码一致）
6.  **结构分层**：interact_type、consultant、responder、question、response

### 4.2 request 类型（执行 Agent → Agent B）
```json
{
  "interact_type": "request",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": {
    "is_need_mcp": true,
    "problem": "需要上传公众号文章",
    "capability_type": "wechat_upload",
    "execution_result": null,
    "is_task_down": false
  }
}
```

### 4.3 response 类型（Agent B → 执行 Agent）
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { /* 执行 Agent 反馈 */ },
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reason_code": "TASK_DONE",
      "reasoning": "任务已完成",
      "final_conclusion": "执行摘要"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-xxx",
        "attempt_number": 1,
        "timestamp": "2026-03-04T12:00:00Z",
        "decision": {
          "solution_num": 21,
          "tool_name": "web_search",
          "action_name": "searchEngine",
          "reasoning": "选择理由",
          "strategy": "initial"
        },
        "params": { /* 调用参数 */ },
        "result": {
          "status": "success",
          "data": { /* 成功数据 */ },
          "execution_time": 1000
        }
      }
    ],
    "user_interactions": [
      {
        "interaction_id": "ui-xxx",
        "interaction_number": 1,
        "timestamp": "2026-03-04T12:00:00Z",
        "key_fields_confirmed": [
          {
            "field_id": "title",
            "field_name": "标题",
            "field_value": "确认后的标题",
            "original_value": "原始标题",
            "is_modified": true
          }
        ],
        "selected_solution": {
          "solution_id": "v1",
          "solution_label": "方案1",
          "solution_description": "方案描述",
          "selected_at": "2026-03-04T12:00:00Z"
        },
        "user_comment": {
          "content": "用户意见",
          "input_at": "2026-03-04T12:00:00Z"
        },
        "user_info": {
          "user_id": "user-xxx",
          "user_name": "用户名",
          "department": "部门"
        },
        "submission": {
          "submitted_at": "2026-03-04T12:00:00Z",
          "status": "completed",
          "processing_time": 5000
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 1,
      "successful_mcp_attempts": 1,
      "failed_mcp_attempts": 0,
      "total_user_interactions": 1,
      "start_time": "2026-03-04T12:00:00Z",
      "end_time": "2026-03-04T12:05:00Z",
      "total_duration": 300000
    },
    "available_solutions": [],
    "pending_key_fields": [],
    "prompt_message": {},
    "failed_details": {}
  },
  "execution_result": {
    "status": "success"
  },
  "ext_info": {
    "step": "xxx",
    "iteration": 1
  }
}
```

### 4.4 关键字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| **interact_type** | string | request / response |
| **consultant** | string | 咨询方（insurance-d）|
| **responder** | string | 响应方（agent B / human）|
| **question** | object | 执行 Agent 反馈（is_need_mcp/problem/capability_type/execution_result/is_task_down）|
| **response.decision** | object | 决策信息（type/reason_code/reasoning/final_conclusion）|
| **response.mcp_attempts** | array | MCP 尝试记录（支持多次）|
| **response.user_interactions** | array | 用户交互记录（支持多次）|
| **response.execution_summary** | object | 执行摘要统计 |
| **execution_result.status** | string | success / waiting_user / failed |

---

## 五、Agent B 参数拼装与五步校验（基于现有表）
### 5.1 参数来源优先级（严格按现有表）
1.  **param_examples**（优先）
2.  **param_template**（次之）
3.  **interface_schema**（兜底）

### 5.2 拼装规则
- Agent B **只生成 core_params**（业务核心字段）
- 技术参数（refresh_token、timeout 等）**不由 Agent B 传递**
- 严格匹配 `interface_schema` 中的核心字段

### 5.3 五步强制校验
1.  **能力校验**：capability 存在且 status=available
2.  **结构校验**：core_params 与 interface_schema 完全一致
3.  **必填校验**：所有必填字段非空
4.  **类型校验**：字段类型匹配（string/int/boolean）
5.  **业务校验**：按 metadata.business_rules 校验（长度、范围、枚举）

---

## 六、执行器 MCP 调用逻辑（核心优化）
### 6.1 唯一逻辑：合并参数 + 直接调用
```
1. 从 interact_content 读取 mcp_capability_type + core_params
2. 查询 capability_list 获取 metadata.default_params（默认技术参数）
3. 合并：full_params = { ...default_params, ...core_params }
4. 直接调用 MCP，不修改、不新增、不省略任何字段
5. 原始结果完整回传给 Agent B
```

### 6.2 关键约束
- 执行器**只补充技术参数**，不修改业务参数
- 执行器**不解析参数规范**，只做合并
- 执行结果**不加工、不过滤**，原样回传

### 6.3 交互历史记录写入逻辑

#### 6.3.1 写入时机
| 阶段 | 写入时机 | interact_type | interact_user | 说明 |
|------|----------|---------------|---------------|------|
| 阶段1 | 执行Agent返回is_need_mcp=true后 | request | insurance-d | 记录执行Agent的问题和意图 |
| 阶段2 | Agent B做出决策后 | response | agent B | 记录Agent B的决策和MCP尝试 |
| 阶段3 | MCP执行成功后 | response | agent B | 记录MCP执行结果（如果有多次尝试，记录每次） |
| 阶段4 | 需要用户确认时 | response | agent B | 记录待确认的关键字段 |
| 阶段5 | 用户提交确认后 | request | human | 记录用户的确认和修改 |
| 阶段6 | 达到最大迭代次数 | response | agent B | 记录终止原因和总结 |
| 阶段7 | 任务完成或失败 | response | agent B | 记录最终结果 |

#### 6.3.2 写入方法
```typescript
class SubtaskExecutionEngine {
  /**
   * 创建交互步骤记录
   * @param commandResultId - 关联的command_result_id
   * @param stepNo - 步骤编号
   * @param interactType - 交互类型（request/response）
   * @param interactNum - 交互次数（同一步骤下递增）
   * @param interactUser - 交互发起方
   * @param content - 交互内容（InteractContent）
   */
  private async createInteractionStep(
    commandResultId: string,
    stepNo: number,
    interactType: string,
    interactNum: number,
    interactUser: string,
    content: any
  ) {
    await db.insert(agentSubTasksStepHistory).values({
      commandResultId,
      stepNo,
      interactType,
      interactNum,
      interactContent: content,
      interactUser,
      interactTime: getCurrentBeijingTime(),
    });
  }
}
```

#### 6.3.3 写入内容规范
```typescript
// request 类型（执行Agent → Agent B）
{
  "interact_type": "request",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": {
    "is_need_mcp": true,
    "problem": "需要上传公众号文章",
    "capability_type": "wechat_upload",
    "execution_result": null,
    "is_task_down": false
  },
  "ext_info": {
    "step": "phase_1_executor_analysis",
    "iteration": 1
  }
}

// response 类型（Agent B → 执行Agent）
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { /* 执行Agent原始请求 */ },
  "response": {
    "decision": {
      "type": "EXECUTE_MCP | COMPLETE | NEED_USER | FAILED",
      "reason_code": "MCP_CONTINUE | TASK_DONE | MAX_RETRY_EXCEEDED | ...",
      "reasoning": "决策理由",
      "final_conclusion": "执行摘要"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-{timestamp}-{count}",
        "attempt_number": 1,
        "timestamp": "2026-03-04T12:00:00Z",
        "decision": {
          "solution_num": 11,
          "tool_name": "wechat",
          "action_name": "add_draft",
          "reasoning": "选择理由",
          "strategy": "initial | retry | switch_type | degrade"
        },
        "params": { /* 调用参数 */ },
        "result": {
          "status": "success | failed | partial",
          "data": { /* 成功数据 */ },
          "error": {
            "code": "MCP_ERROR",
            "message": "错误信息",
            "type": "network | timeout | permission | not_found | unknown"
          },
          "execution_time": 1000
        },
        "failure_analysis": {
          "is_retryable": true,
          "failure_type": "temporary | resource_unavailable",
          "suggested_next_action": "retry_same | switch_method"
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 1,
      "successful_mcp_attempts": 1,
      "failed_mcp_attempts": 0,
      "start_time": "2026-03-04T12:00:00Z",
      "end_time": "2026-03-04T12:05:00Z",
      "total_duration": 300000
    }
  },
  "execution_result": {
    "status": "success | waiting | failed"
  }
}
```

---

## 七、错误处理与重试机制设计

### 7.1 核心参数
```typescript
// 执行引擎核心配置
const MAX_ITERATIONS = 5;                    // 最多5次决策循环（Agent B决策次数）
const MAX_MCP_ATTEMPTS_PER_ITERATION = 3;    // 单次循环最多3次MCP尝试
```

### 7.2 重试策略
```
┌─────────────────────────────────────────────────────────────┐
│                     执行引擎主循环                            │
│              while (currentIteration < MAX_ITERATIONS)        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐                                         │
│  │ 调用Agent B决策  │◄───────────────────────────────────┐   │
│  └────────┬────────┘                                    │   │
│           │ decision.type                                │   │
│           ▼                                              │   │
│  ┌─────────────────┐   ┌─────────────┐   ┌──────────┐   │   │
│  │   EXECUTE_MCP   │   │   COMPLETE  │   │  FAILED  │   │   │
│  └────────┬────────┘   └─────────────┘   └──────────┘   │   │
│           │                                               │   │
│           ▼                                               │   │
│  ┌─────────────────┐                                      │   │
│  │ executeMcpWithRetry │ 最多3次尝试                        │   │
│  │  while (attempt < MAX_MCP_ATTEMPTS_PER_ITERATION)     │   │
│  └────────┬────────┘                                      │   │
│           │                                               │   │
│     ┌─────┴─────┐                                         │   │
│     │           │                                         │   │
│     ▼           ▼                                         │   │
│   成功        失败                                         │   │
│     │           │                                         │   │
│     │    ┌──────┴──────┐                                  │   │
│     │    │ 还有尝试次数? │─否──► 继续下一轮决策 ────────────┘   │
│     │    └──────┬──────┘                                    │
│     │           │是                                         │
│     │           ▼                                            │
│     │    ┌──────────────┐                                    │
│     │    │ 请求Agent B  │                                    │
│     │    │ 重新决策     │───────────────────────────────────┘
│     │    └──────────────┘
│     │
│     ▼
│  继续下一轮决策
│
└─────────────────────────────────────────────────────────────┘
```

### 7.3 错误分类与处理
```typescript
// 错误类型枚举
type ErrorType = 'network' | 'timeout' | 'permission' | 'not_found' | 'unknown';

// 失败类型
type FailureType = 'temporary' | 'resource_unavailable';

// MCP尝试记录
interface McpAttempt {
  attempt_id: string;
  attempt_number: number;
  timestamp: Date;
  decision: {
    solution_num: number;
    tool_name: string;
    action_name: string;
    reasoning: string;
    strategy: 'initial' | 'retry' | 'switch_type' | 'degrade';
  };
  params: Record<string, any>;
  result: {
    status: 'success' | 'failed' | 'partial';
    data?: any;
    error?: {
      code: string;
      message: string;
      type: ErrorType;
    };
    execution_time: number;
  };
  failure_analysis?: {
    is_retryable: boolean;
    failure_type: FailureType;
    suggested_next_action: 'retry_same' | 'switch_method';
  };
}
```

### 7.4 错误分类方法
```typescript
class SubtaskExecutionEngine {
  /**
   * 分类错误类型
   */
  private classifyErrorType(error: string): ErrorType {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('timeout') || errorLower.includes('etimedout')) {
      return 'timeout';
    }
    if (errorLower.includes('network') || errorLower.includes('econnrefused')) {
      return 'network';
    }
    if (errorLower.includes('permission') || errorLower.includes('unauthorized')) {
      return 'permission';
    }
    if (errorLower.includes('not found') || errorLower.includes('enoent')) {
      return 'not_found';
    }
    return 'unknown';
  }

  /**
   * 判断是否可重试
   */
  private isRetryableError(error: string): boolean {
    const errorType = this.classifyErrorType(error);
    // 网络、超时错误可重试，权限错误不可重试
    return ['network', 'timeout'].includes(errorType);
  }

  /**
   * 获取失败类型
   */
  private getFailureType(error: string): FailureType {
    const errorType = this.classifyErrorType(error);
    if (errorType === 'timeout') {
      return 'temporary';
    }
    return 'resource_unavailable';
  }
}
```

### 7.5 带重试的MCP执行
```typescript
class SubtaskExecutionEngine {
  /**
   * 执行MCP（支持多次尝试）
   * @returns boolean - 是否执行成功
   */
  private async executeMcpWithRetry(
    task: typeof agentSubTasks.$inferSelect,
    initialDecision: AgentBDecision,
    capabilities: any[],
    mcpExecutionHistory: McpAttempt[],
    maxAttempts: number
  ): Promise<boolean> {
    let attemptCount = 0;
    let lastDecision = initialDecision;

    while (attemptCount < maxAttempts) {
      attemptCount++;
      console.log(`[SubtaskEngine] MCP尝试 ${attemptCount}/${maxAttempts}`);

      if (!lastDecision.data?.mcpParams) {
        console.error('[SubtaskEngine] 缺少MCP参数');
        return false;
      }

      const startTime = Date.now();
      const attemptId = `mcp-${Date.now()}-${attemptCount}`;

      try {
        // 执行MCP
        const mcpResult = await this.executeCapabilityWithParams(
          task,
          lastDecision.data.mcpParams
        );
        const executionTime = Date.now() - startTime;

        // 构建MCP尝试记录
        const mcpAttempt: McpAttempt = {
          attemptId,
          attemptNumber: attemptCount,
          timestamp: getCurrentBeijingTime(),
          decision: {
            solutionNum: lastDecision.data.mcpParams.solutionNum,
            toolName: lastDecision.data.mcpParams.toolName,
            actionName: lastDecision.data.mcpParams.actionName,
            reasoning: lastDecision.reasoning,
            strategy: attemptCount === 1 ? 'initial' : 
                     (mcpExecutionHistory.length > 0 && 
                      mcpExecutionHistory[mcpExecutionHistory.length - 1].decision.toolName === lastDecision.data.mcpParams.toolName ? 'retry' : 'switch_type'),
          },
          params: lastDecision.data.mcpParams.params,
          result: {
            status: mcpResult.success ? 'success' : 'failed',
            data: mcpResult.success ? mcpResult.mcpResult : undefined,
            error: !mcpResult.success ? {
              code: 'MCP_ERROR',
              message: mcpResult.error || '执行失败',
              type: this.classifyErrorType(mcpResult.error || ''),
            } : undefined,
            executionTime,
          },
        };

        // 如果失败，添加失败分析
        if (!mcpResult.success) {
          mcpAttempt.failureAnalysis = {
            isRetryable: this.isRetryableError(mcpResult.error || ''),
            failureType: this.getFailureType(mcpResult.error || ''),
            suggestedNextAction: attemptCount < maxAttempts ? 'switch_method' : 'retry_same',
          };
        }

        // 添加到历史
        mcpExecutionHistory.push(mcpAttempt);

        // 如果成功，返回true
        if (mcpResult.success) {
          console.log('[SubtaskEngine] MCP执行成功');
          return true;
        }

        // 如果失败且还有尝试次数，让Agent B重新决策
        if (attemptCount < maxAttempts) {
          console.log('[SubtaskEngine] MCP执行失败，请求Agent B重新决策');
          
          // 构建临时上下文用于重新决策
          const retryContext: ExecutionContext = {
            executorFeedback: {
              originalTask: task.taskTitle,
              problem: `MCP执行失败: ${mcpResult.error}`,
              attemptedSolutions: mcpExecutionHistory.map(m => m.decision.reasoning),
            },
            mcpExecutionHistory,
            taskMeta: {
              taskId: task.id,
              taskType: task.taskType || 'default',
              priority: 'medium',
              createdAt: task.createdAt || getCurrentBeijingTime(),
              iterationCount: attemptCount,
              maxIterations: maxAttempts,
            },
            availableCapabilities: capabilities,
          };

          // 调用Agent B重新决策
          const retryDecision = await this.callAgentBWithDecision(
            task,
            retryContext,
            capabilities
          );

          if (retryDecision.type !== 'EXECUTE_MCP' || !retryDecision.data?.mcpParams) {
            console.log('[SubtaskEngine] Agent B决定不再继续MCP执行');
            return false;
          }

          lastDecision = retryDecision;
        }
      } catch (error) {
        // 异常处理...
        console.error('[SubtaskEngine] MCP执行异常:', error);
        const executionTime = Date.now() - startTime;
        
        mcpExecutionHistory.push({
          attemptId,
          attemptNumber: attemptCount,
          timestamp: getCurrentBeijingTime(),
          decision: {
            solutionNum: lastDecision.data.mcpParams.solutionNum,
            toolName: lastDecision.data.mcpParams.toolName,
            actionName: lastDecision.data.mcpParams.actionName,
            reasoning: lastDecision.reasoning,
            strategy: 'initial',
          },
          params: lastDecision.data.mcpParams.params,
          result: {
            status: 'failed',
            error: {
              code: 'EXECUTION_EXCEPTION',
              message: error instanceof Error ? error.message : '执行异常',
              type: 'unknown',
            },
            executionTime,
          },
        });

        if (attemptCount >= maxAttempts) {
          return false;
        }
      }
    }

    return false;
  }
}
```

### 7.6 决策类型与处理
| 决策类型 | 说明 | 处理逻辑 |
|----------|------|----------|
| **EXECUTE_MCP** | 执行MCP能力 | 调用executeMcpWithRetry，支持最多3次尝试 |
| **COMPLETE** | 任务完成 | 标记任务完成，记录最终交互历史 |
| **NEED_USER** | 需要用户确认 | 暂停任务，等待用户输入后重新触发 |
| **FAILED** | 执行失败 | 标记任务失败，记录失败原因和交互历史 |

### 7.7 达到最大迭代次数处理
```typescript
class SubtaskExecutionEngine {
  /**
   * 处理超过最大迭代次数
   */
  private async handleMaxIterationsExceeded(
    task: typeof agentSubTasks.$inferSelect,
    executorResult: ExecutorAgentResult,
    mcpExecutionHistory: McpAttempt[],
    userInteractions: UserInteraction[],
    iteration: number
  ) {
    console.log('[SubtaskEngine] 达到最大循环次数，强制完成');
    
    // 更新任务状态为 need_support
    await db
      .update(agentSubTasks)
      .set({
        status: 'need_support',
        executionResult: JSON.stringify({
          status: 'max_iterations_exceeded',
          executorResult,
          mcpExecutionHistory,
          userInteractions,
          finalIteration: iteration,
        }),
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));

    // 记录response
    await this.createInteractionStep(
      task.commandResultId,
      task.orderIndex,
      'response',
      iteration,
      'agent B',
      {
        interact_type: 'response',
        consultant: task.fromParentsExecutor,
        responder: 'agent B',
        question: executorResult,
        response: {
          decision: {
            type: 'FAILED',
            reason_code: 'MAX_ITERATIONS_EXCEEDED',
            reasoning: `达到最大迭代次数(${MAX_ITERATIONS})，需要人工介入`,
            final_conclusion: '任务执行达到最大循环次数，需要人工处理',
          },
          mcp_attempts: mcpExecutionHistory,
          user_interactions: userInteractions,
          execution_summary: {
            total_mcp_attempts: mcpExecutionHistory.length,
            successful_mcp_attempts: mcpExecutionHistory.filter(m => m.result.status === 'success').length,
            failed_mcp_attempts: mcpExecutionHistory.filter(m => m.result.status === 'failed').length,
            total_user_interactions: userInteractions.length,
          },
        },
        execution_result: { status: 'failed', reason: 'max_iterations_exceeded' },
        ext_info: { step: 'max_iterations_exceeded', iteration },
      }
    );

    // 上报Agent A
    await reportToAgentA({
      subTaskId: task.id,
      reason: 'max_iterations_exceeded',
      summary: `任务执行达到最大循环次数(${MAX_ITERATIONS})，需要人工处理`,
      mcpExecutionHistory,
    });
  }
}
```

---

## 八、知识库「原料-加工-复用」核心逻辑（规划中·尚未实现）

> ⚠️ **注意**：本节描述的功能为规划阶段设计，当前代码尚未实现。

### 8.1 整体流程（规划）
```
原始交互原料（agent_sub_tasks_step_history）
          ↓ 提取：business_type+scene_tag+interact_content+success_flag
┌─────────────────────┐         ┌─────────────────────┐
│ 保险自媒体知识库     │         │ AI 自媒体知识库      │
└──────────┬───────────┘         └──────────┬───────────┘
           │ 按场景细分                       │ 按场景细分
           ▼                                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 公众号上传经验库  │  │ 合规校验经验库   │  │ 短视频生成经验库  │
└────────┬────────┘  └─────────────────┘  └─────────────────┘
         │
         ├───────────────────────────────────┐
         │                                   │
         ▼                                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ MCP 调用经验      │  │ 决策优化经验     │  │ 失败规避经验     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         ▲                                    ▲
         │ 从 experience_summary 提取          │ 从 fail_reason 提取
         └───────────────────────────────────┘
```

### 8.2 原料：仅来自交互表
- business_type：业务线
- scene_tag：场景
- interact_content：MCP 指令/参数/结果
- success_flag：成功/失败
- fail_reason：失败原因

### 8.3 加工：自动提炼
- MCP 经验：哪些参数组合成功率最高
- 决策经验：哪些场景优先用哪个 MCP
- 失败经验：常见错误与自动修复方案

### 8.4 复用：Agent B 直接使用
- 同场景优先复用成功经验
- 自动规避失败历史
- 参数按最佳实践生成

---

## 九、Agent B 高智能化提升（规划中·尚未实现）

> ⚠️ **注意**：本节描述的功能为规划阶段设计，当前代码尚未实现。包括：智能场景理解、多步骤自动规划、知识图谱推理、异常自动诊断、A/B测试调优、预测性决策引擎、持续学习引擎等。

### 9.1 智能化提升总体架构（规划）

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent B 高智能决策引擎                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ 智能场景理解  │  │ 多步骤规划    │  │ 参数自动优化  │   │
│  │  (语义匹配)   │  │  (自动编排)   │  │  (自适应)     │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                   │                   │            │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐   │
│  │ 知识图谱推理  │  │ 异常自动诊断  │  │ A/B测试调优  │   │
│  │  (关联分析)   │  │  (根因分析)   │  │  (自动迭代)   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                   │                   │            │
│  └──────┴───────────────────┴───────────────────┴───────┘   │
│                           │                               │
│                  ┌────────▼────────┐                     │
│                  │  预测性决策引擎  │                     │
│                  │  (成功率预测)    │                     │
│                  └────────┬────────┘                     │
│                           │                               │
│                  ┌────────▼────────┐                     │
│                  │  持续学习引擎    │                     │
│                  │  (反馈闭环)      │                     │
│                  └─────────────────┘                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 十、低优先级功能：MCP 异常日志分析与自动修复

---

## 十一、低优先级功能：MCP 异常日志分析与自动修复
### 11.1 日志路径规范
```
/var/log/mcp_calls/{business_type}/{capability_type}/{yyyy-mm-dd}_mcp_call.log
```

### 11.2 日志读取 MCP（纳入 capability_list）
- capability_type：`local_log_file_read`
- 仅允许读取上述目录
- 核心参数：file_path、read_mode、read_lines

### 11.3 异常闭环流程
1.  执行器捕获 MCP 异常 → 写入独立日志
2.  通知 Agent B 并携带日志路径
3.  Agent B 调用日志 MCP 读取内容
4.  可修复：自动修正参数重试
5.  不可修复：生成 Agent A 待办

---

## 十二、核心强制约束
1.  **表结构约束**
    - `agent_sub_tasks_step_history` 禁止任何 MCP 专属字段
    - `capability_list` 是 MCP 参数规范唯一来源
2.  **Agent B 约束**
    - 只传业务核心字段，不传技术参数
    - 必须完成五步校验，不合法不生成指令
3.  **执行器约束**
    - 只合并默认技术参数，不修改业务参数
    - 原始结果完整回传
4.  **知识库约束**
    - 所有经验仅来自交互原始数据
    - 经验复用必须留痕

---

## 十三、完整业务示例：公众号文章上传
1.  执行 Agent 请求上传文章
2.  Agent B 读取 `capability_list` 规范
3.  Agent B 生成 `core_params`（账号名、标题、内容）
4.  执行器合并 `default_params`（refresh_token、content_audit）
5.  调用 MCP 并回传结果
6.  Agent B 输出最终结果
7.  全流程落表，成为知识库原料

---

## 十四、总结
本设计**完全基于你现有 `capability_list` 表结构**，不做任何表结构修改，同时解决了之前所有冲突：
1.  **极简**：Agent B 只关心业务，不关心技术参数
2.  **严谨**：参数规范、校验、合并全部标准化
3.  **纯粹**：交互表只存原始数据，是天然知识库原料
4.  **统一**：全系统 MCP 调用格式、流程、规则完全一致
5.  **可扩展**：支持保险/AI 自媒体多业务线无缝扩展
