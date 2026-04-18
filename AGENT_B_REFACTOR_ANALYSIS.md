# Agent B 提示词重构 - 技术分析报告

## 问题1：提示词是新加的吗？依据是什么？与原有提示词的差异？

### 1.1 提示词由来分析

**不是全新的，而是重构和优化**。新提示词文件是基于 `src/lib/services/subtask-execution-engine.ts` 中原有的硬编码提示词提取出来的。

### 1.2 原有提示词位置和内容

**原有位置**：
- `subtask-execution-engine.ts` 第 3121 行：`callAgentB` 方法中的提示词
- `subtask-execution-engine.ts` 第 3813 行：`callAgentBWithContext` 方法中的提示词
- `subtask-execution-engine.ts` 第 4058 行：其他 Agent B 相关提示词

**原有提示词特点**：
```typescript
// 原有方式 - 硬编码在服务文件中
const prompt = 
'你是 Agent B，负责解决方案选型和 MCP 参数生成。\n\n' +
'【执行 agent 反馈的问题】\n' +
'- isNeedMcp: ' + executorResult.isNeedMcp + '\n' +
// ... 更多硬编码内容
```

### 1.3 重构依据

1. **代码可维护性**：硬编码的超长提示词字符串难以维护和阅读
2. **模块化设计**：将提示词逻辑从业务逻辑中分离
3. **类型安全**：为提示词输入输出添加完整的 TypeScript 类型定义
4. **可测试性**：独立的提示词模块更容易进行单元测试
5. **复用性**：相同的提示词构建逻辑可以在多个地方复用

### 1.4 新旧提示词差异对比

| 维度 | 原有提示词 | 新提示词 |
|------|-----------|---------|
| **位置** | 硬编码在 subtask-execution-engine.ts | 独立模块 src/lib/agents/prompts/ |
| **类型定义** | 无，使用 any | 完整的 TypeScript 接口定义 |
| **结构** | 单一字符串拼接 | 分离系统提示词和用户提示词构建函数 |
| **可维护性** | 难以修改，容易出错 | 模块化，便于维护和更新 |
| **可测试性** | 难以单独测试 | 可以独立测试提示词生成逻辑 |
| **文档** | 无文档 | 包含完整的 JSDoc 注释和输出格式说明 |

---

## 问题2：返回格式有没有定义标准化？标准化的依据是哪里？

### 2.1 返回格式标准化定义

**有完整的标准化定义**，主要在以下文件中：

#### 2.1.1 核心类型定义文件
- `src/lib/agents/prompts/agent-b-business-controller.ts` - Agent B 输出格式定义
- `src/lib/agents/prompts/agent-t-tech-expert.ts` - Agent T 输出格式定义  
- `src/lib/agents/prompts/compliance-check.ts` - 合规校验输出格式定义

#### 2.1.2 Agent B 标准化输出格式

```typescript
// 核心输出类型
export interface AgentBOutput {
  action: 'EXECUTE_MCP' | 'NEED_USER' | 'FAILED';
  solutionNum?: number;
  toolName?: string;
  actionName?: string;
  params?: Record<string, any>;
  reasoning?: string;
  userMessage?: string;
  failedReason?: string;
}
```

#### 2.1.3 输出格式说明文档

新提示词文件中包含了**详细的输出格式说明**：
- `OUTPUT_FORMAT` 常量：标准化的 JSON 格式定义
- `FORMAT_EXPLANATION` 常量：各字段的详细说明
- `EXAMPLE_OUTPUT` 常量：完整的输出示例

### 2.2 标准化依据

#### 2.2.1 依据来源
1. **原有代码逻辑**：基于 `subtask-execution-engine.ts` 中实际使用的输出格式
2. **LLM 最佳实践**：参考业界大语言模型输出格式化的最佳实践
3. **业务需求**：根据多 Agent 协作系统的实际业务流程设计
4. **容错设计**：考虑 LLM 输出的不稳定性，设计了容错和兜底机制

#### 2.2.2 原有代码中的格式验证逻辑

在 `subtask-execution-engine.ts` 中可以看到原有的格式验证：

```typescript
// 原有的验证逻辑（约 3170-3220 行）
if (!parsedOutput.action) {
  parsedOutput.action = 'EXECUTE_MCP';
}
if (!parsedOutput.solutionNum) {
  throw new Error('Agent B 输出缺少必需字段：solutionNum');
}
// ... 更多验证和兜底逻辑
```

#### 2.2.3 统一响应解析器

项目中还有统一的 Agent 响应解析器（虽然本次重构中没有直接使用，但展示了标准化的思路）：

```typescript
// 使用统一响应解析器
const parseResult = AgentResponseParser.parseAgentBResponse(response);
```

---

## 问题3：那3个更新导入路径的文件原来主要作用是啥？

### 3.1 更新的文件列表

1. `src/lib/services/subtask-execution-engine.ts` - 子任务执行引擎
2. `src/lib/services/agent-task.ts` - Agent 任务管理服务
3. `src/lib/services/command-result-service.ts` - 指令执行结果管理服务
4. `src/lib/utils/compliance-result-formatter.ts` - 合规校验结果格式化器

### 3.2 各文件详细作用

#### 3.2.1 `subtask-execution-engine.ts` - 子任务执行引擎（核心）

**主要职责**：
- 管理子任务的执行流程
- 协调 Agent B 和 Agent T 的交互
- 执行 MCP 工具调用
- 处理多轮对话和历史上下文
- 任务状态管理和错误处理

**关键方法**：
- `callAgentB()` - 调用 Agent B 进行解决方案选型
- `callAgentBWithContext()` - 带上下文的 Agent B 调用（支持多轮）
- `executeMcp()` - 执行 MCP 工具
- `runSubtask()` - 运行子任务主流程

**为什么需要更新导入**：
- 该文件是 Agent B 提示词的主要使用者
- 原有硬编码的提示词被提取到独立模块
- 需要导入新的提示词构建函数替换原有逻辑

#### 3.2.2 `agent-task.ts` - Agent 任务管理服务

**主要职责**：
- 创建 Agent 间的任务
- 任务状态跟踪和查询
- 任务优先级管理
- 合规校验功能集成
- 任务元数据管理

**关键方法**：
- `createTask()` - 创建新任务
- `getTask()` - 获取任务详情
- `getPendingTasks()` - 获取待执行任务
- `getInProgressTasks()` - 获取进行中任务

**为什么需要更新导入**：
- 使用合规校验功能
- 导入 `generateComplianceCheckPrompt` 进行合规检查
- 导入 `generateComplianceTaskMetadata` 生成合规任务元数据

#### 3.2.3 `command-result-service.ts` - 指令执行结果管理服务

**主要职责**：
- 记录各 Agent 的执行结果
- 管理执行状态（in_progress/completed/failed）
- 防重复任务检测
- 通知服务集成
- 执行结果统计和查询

**关键方法**：
- `createResult()` - 创建执行结果
- `updateResult()` - 更新执行结果
- `queryResults()` - 查询执行结果
- `createDailyTaskWithDuplicateCheck()` - 带防重的任务创建

**为什么需要更新导入**：
- 在创建执行结果时可能需要进行合规校验
- 导入 `generateComplianceCheckPrompt` 用于合规检查
- 导入 `generateComplianceTaskMetadata` 用于元数据生成

#### 3.2.4 `compliance-result-formatter.ts` - 合规校验结果格式化器

**主要职责**：
- 将合规校验的 JSON 结果转换为自然语言文本
- 按严重程度分组展示问题（critical/warning/info）
- 生成整改建议和改进意见
- 提供用户友好的输出格式

**关键方法**：
- `format()` - 格式化合规校验结果
- `buildIssuesSection()` - 构建问题部分
- `buildRecommendationsSection()` - 构建建议部分

**为什么需要更新导入**：
- 需要导入合规校验的类型定义
- 使用 `ComplianceCheckResult` 和 `ComplianceIssue` 类型
- 确保类型安全和一致性

---

## 总结

### 重构的核心价值

1. **代码组织优化**：将提示词从业务逻辑中分离，提高可维护性
2. **类型安全增强**：完整的 TypeScript 类型定义，减少运行时错误
3. **文档完善**：详细的 JSDoc 注释和格式说明
4. **易于测试**：独立模块便于单元测试和集成测试
5. **标准化输出**：明确的输出格式定义和验证机制

### 导入路径变更的影响

- **旧路径**：`@/lib/prompts/compliance-check`
- **新路径**：`@/lib/agents/prompts/compliance-check`
- **变更原因**：统一将所有 Agent 相关的提示词放在 `src/lib/agents/prompts/` 目录下
- **影响范围**：4 个文件需要更新导入路径

### 后续建议

1. **逐步迁移**：可以考虑将 `task-assignment-service.ts` 中的 Agent B 提示词也逐步迁移
2. **统一解析器**：推广使用统一的 Agent 响应解析器，减少重复代码
3. **测试覆盖**：为新的提示词模块添加单元测试
4. **文档更新**：更新相关的开发文档，说明新的目录结构和使用方式
