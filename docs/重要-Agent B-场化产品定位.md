# AGENTS.md - 智能体任务执行系统

## 项目概览
基于 Next.js 16 的智能体任务执行系统，包含执行 Agent（insurance-d、Agent T）和 Agent B 的协作流程，支持任务拆分、执行、评审和用户交互。

## 技术栈
- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Drizzle ORM
- PostgreSQL

## 核心模块

### 1. 子任务执行引擎 (SubtaskExecutionEngine)
- 位置：`src/lib/services/subtask-execution-engine.ts`
- 功能：管理子任务的生命周期，支持 Agent T 和 Agent B 两种执行模式

### 2. MCP 工具集成 (wechat-tools)
- 位置：`src/lib/mcp/wechat-tools.ts`
- 功能：封装微信公众号 API，包括草稿箱操作
- 关键函数：
  - `wechatAddDraft`: 上传文章到草稿箱
  - `wechatUploadMedia`: 上传媒体文件
  - `wechatGetAccounts`: 获取公众号列表

### 3. 微信公众号 API
- 位置：`src/lib/wechat-official-account/api.ts`
- 功能：与微信服务器交互的底层 API
- 关键函数：
  - `uploadPermanentThumb`: 上传永久缩略图

### 4. JSON 解析增强器 (JsonParserEnhancer)
- 位置：`src/lib/utils/json-parser-enhancer.ts`
- 功能：智能解析 Agent 返回的 JSON，支持多种格式
- 新增功能：`repairCommonJsonErrors` - 修复常见 JSON 格式错误

## 提示词问题排查文档

### 排查流程（按顺序检查）

1. **检查 Agent B 是否返回了完整字段**
   - 日志关键词：`[AgentResponseParser] 🔴🔴🔴 完整原始响应`
   - 检查字段：`decisionBasis`、`notCompletedReason`、`context.suggestedExecutor`

2. **检查解析是否成功**
   - 日志关键词：`[AgentResponseParser] ✅ JSON 解析成功`
   - 失败关键词：`[AgentResponseParser] ❌ JSON 解析失败`

3. **检查 decision 是否传递到 handleDecisionType**
   - 日志关键词：`[AgentB决策] EXECUTE_MCP`
   - 检查 decision.type 是否为 `EXECUTE_MCP`

4. **检查 from_parents_executor 是否更新**
   - 数据库查询：`SELECT from_parents_executor FROM agent_sub_tasks WHERE order_index = 2;`
   - 预期结果：`agent T`

### 最近修改的文件和方法

| 文件 | 方法 | 修改内容 |
|------|------|---------|
| `src/lib/services/agent-response-parser.ts` | `parseAgentBResponse` | 添加详细日志，输出完整原始响应、解析后数据、各字段值 |
| `src/lib/services/subtask-execution-engine.ts` | `recordAgentInteraction` | 添加格式识别逻辑，支持两种输入格式（直接 decision 对象或包装对象） |
| `src/lib/services/subtask-execution-engine.ts` | `handleCompleteDecision` / `handleNeedUserDecision` / `handleFailedDecision` | 修改为直接传入 decision 对象作为 responseContent |
| `src/lib/services/subtask-execution-engine.ts` | `callAgentBWithDecision` | 添加 Agent B 原始返回的完整日志输出 |
| `src/lib/utils/json-parser-enhancer.ts` | `extractJsonWithStackMatching` / `repairCommonJsonErrors` | 添加 JSON 常见错误修复逻辑 |

## 测试接口

### 直接测试 add_draft
```bash
curl -X POST http://localhost:5000/api/test/add-draft-direct
```

### 完整流程测试 order_index=4
```bash
curl -X POST http://localhost:5000/api/test/full-test-order-4
```

### 测试 Agent B 解析
```bash
curl -X POST http://localhost:5000/api/test/agent-b-parse
```

### 测试 Agent B 真实场景
```bash
curl -X POST http://localhost:5000/api/test/real-agent-b-review
```

## 已知问题与解决方案

### ✅ 问题 1：Agent B 返回字段丢失（已修复）
- **状态**：已修复 ✅
- **问题描述**：Agent B 返回的 `suggestedExecutor`、`decisionBasis`、`notCompletedReason` 字段在新生成的交互记录中丢失
- **根因**：
  1. `recordAgentInteraction` 方法没有正确识别输入格式
  2. 解析失败后使用了兜底的 NEED_USER 决策
- **修复方案**：
  1. 在 `AgentResponseParser.parseAgentBResponse` 中添加详细日志
  2. 修复 `recordAgentInteraction` 方法，支持两种输入格式
  3. 在 `callAgentBWithDecision` 中添加完整原始响应日志
  4. 在 `JsonParserEnhancer` 中添加常见 JSON 错误修复

### ✅ 问题 2：Agent T 无法获取前序任务结果（已修复）
- **状态**：已修复 ✅
- **问题描述**：Agent T 执行 order_index=4 时，`previousResultText` 被获取但没有传递给 `executionContext`，导致 Agent T 无法看到前序任务（order_index=2 内容创作）的结果。
- **根因**：
  1. `executeAgentTExecutorWorkflow` 方法获取了 `previousResultText`
  2. 但 `buildExecutionContext` 只接收 `executorResult`，不包含前序任务结果
  3. `priorStepOutput` 为空
- **修复方案**：在 `buildExecutionContext` 后，将 `previousResultText` 赋值给 `initialExecutionContext.priorStepOutput`
- **修复位置**：`src/lib/services/subtask-execution-engine.ts` 第 1348-1356 行

## 配置说明

### 微信公众号账号
- 默认账号 ID：`insurance-account`
- 配置位置：`src/lib/config/wechat-accounts.ts`

### Capability 列表
- 位置：`src/lib/config/capability-list.ts`
- 关键配置：wechat add_draft (ID: 11)

## 日志位置
- 应用日志：`/app/work/logs/bypass/app.log`
- 开发日志：`/app/work/logs/bypass/dev.log`
- 控制台日志：`/app/work/logs/bypass/console.log`

## 优化记录

### ✅ 优化 1：mcpExecutionHistory 查询合并到 buildExecutionContext 内部
- **时间**：2025-05-28
- **状态**：已完成 ✅
- **优化目标**：将 `mcpExecutionHistory` 的查询逻辑从调用处移到 `buildExecutionContext` 内部，提高内聚性

### ✅ 优化 2：消除 buildExecutionContext 中的重复解析
- **时间**：2025-05-28
- **状态**：已完成 ✅
- **优化目标**：消除 `resultDataData` 的重复解析和信息冗余

### ✅ 优化 3：Agent T CANNOT_HANDLE 处理与简化版智能路由
- **时间**：2025-05-28
- **状态**：已完成 ✅
- **优化目标**：实现简化版智能路由：执行 Agent 无法处理 → Agent T → 用户介入

### ✅ 优化 4：增强 JSON 解析容错性
- **时间**：2026-04-01
- **状态**：已完成 ✅
- **优化目标**：修复常见 JSON 格式错误，提高解析成功率
- **新增方法**：`JsonParserEnhancer.repairCommonJsonErrors`

### ✅ 优化 5：MCP 业务层失败检测增强
- **时间**：2026-04-02
- **状态**：已完成 ✅
- **优化目标**：修复 `hasValidMcpResult` 方法只检查 HTTP 层成功，忽略业务层失败的问题
- **问题描述**：当 MCP 返回 HTTP 200 但业务层失败（如 `success: false`）时，系统误判为有效结果
- **修复方案**：
  1. 修改 `hasValidMcpResult` 方法，同时检查 HTTP 层状态和业务层状态
  2. 新增检查：`businessData.success === false` 时返回 `false`
  3. 添加详细日志输出，区分 HTTP 层失败和业务层失败
- **修复位置**：`src/lib/services/subtask-execution-engine.ts` 第 4307-4336 行
- **验证结果**：order_index=5 任务 MCP 失败后正确转为 `waiting_user` 状态

### ✅ 优化 6：微信公众号 markdown 内容自动转换
- **时间**：2026-04-02
- **状态**：已完成 ✅
- **问题描述**：微信公众号上传失败，错误信息 "empty content"
- **根因分析**：
  1. Agent T 返回的 `mcpParams` 包含 markdown 格式的 `content` 字段
  2. 执行引擎只执行了 `add_draft`，没有先执行 `wechat_format` 进行 markdown → HTML 转换
  3. 导致上传到微信的 `content` 字段为空
- **修复方案**：在 `wechatAddDraft` 函数中自动检测并转换 markdown 内容到 HTML
  1. 检测正则：`/(\*\*|#{1,6}|- |\d+\. |> |\`{1,3})/`
  2. 如果检测到 markdown 内容，自动调用 `formatContentForWechat` 进行转换
  3. 添加详细日志输出
- **修复位置**：`src/lib/mcp/wechat-tools.ts` 第 161-181 行
- **验证结果**：
  - 测试接口：`curl -X POST http://localhost:5000/api/test/markdown-conversion`
  - 日志显示：markdown 内容自动转换成功，原始长度 231 → 转换后长度 299
  - 微信公众号草稿箱上传成功

### ✅ 优化 7：修复 hasValidMcpResult 导致 Agent B 不评审的问题
- **时间**：2026-04-02
- **状态**：已完成 ✅
- **问题描述**：修改判断 MCP 业务执行是否成功的代码后，Agent B 都不出来评审了，特别是 order_index = 2 的执行
- **根因分析**：
  1. `hasValidMcpResult` 方法在调用 Agent B 之前（第 2205 行）就检查 MCP 结果
  2. 如果返回 true，就**直接跳过 Agent B 评审**，直接完成任务
  3. 之前的修复让这个方法太宽松了，导致一些任务被误判为"有有效 MCP 结果"
- **修复方案**：让 `hasValidMcpResult` 方法**更严格**
  1. 只有明确有 `businessData.success === true` 才返回 true
  2. 如果没有 `success` 字段，或者 `success` 不是 true，都返回 false
  3. 这样确保 Agent B 有机会出来评审任务
- **修复位置**：`src/lib/services/subtask-execution-engine.ts` 第 4307-4362 行
- **关键修改**：
  ```typescript
  // 🔴 关键修复：必须明确有 success: true 才返回 true
  // 如果没有 success 字段，或者 success 不是 true，都返回 false，让 Agent B 来评审
  if (!businessData) {
    console.log('[SubtaskEngine] ⚠️ MCP 无业务数据 → 让 Agent B 评审');
    return false;
  }
  
  if (businessData.success !== true) {
    console.log('[SubtaskEngine] ❌ MCP 业务层未明确成功:', { 
      businessSuccess: businessData.success, 
      error: businessData.error || businessData.message 
    });
    return false;
  }
  ```

### ✅ 优化 8：重要产品决策 - Agent B 始终优先调用
- **时间**：2026-04-02
- **状态**：已完成 ✅
- **决策背景**：用户提出非常重要的产品观点
  > "不要跳过，谁说后面 Agent B 能力不争强了吗？强了以后它还会补充功能。"
- **问题**：在调用 Agent B 之前就检查 `hasValidMcpResult`，如果返回 true 就直接跳过 Agent B 评审
- **产品决策**：**Agent B 应该始终有机会先评审！**
  - 哪怕有 MCP 结果，也要让 Agent B 先看
  - 未来 Agent B 能力增强后，还会补充更多功能
  - 不要低估 Agent B 的成长潜力
- **修复方案**：
  1. **删除**在调用 Agent B 之前检查 `hasValidMcpResult` 的逻辑（原第 2205-2209 行）
  2. **保留**Agent B 超时时的兜底逻辑（第 2210-2214 行），但标注为"正常情况不会走到这里"
  3. **添加注释**强调这个重要的产品决策
- **修复位置**：`src/lib/services/subtask-execution-engine.ts` 第 2202-2214 行
- **修改后的流程**：
  ```
  Step 1: 构建执行上下文
  Step 2: 调用 Agent B 决策！（这是始终优先的）
  Step 3: 只有当 Agent B 超时时，才检查是否有有效 MCP 结果作为兜底
  ```
- **关键注释**：
  ```typescript
  // 🔴 重要：始终先调用 Agent B！哪怕有 MCP 结果也要让 Agent B 先评审
  // 未来 Agent B 能力增强后，还会补充更多功能
  ```

## 🚀 Agent B 能力 - 市场化产品定位

### 战略定位
Agent B 的职责匹配检查能力 → **不只是内部效率工具**

> "但是 Agent B 的这个能力，我们后续要单独放到市场竞争的，协助推动业务。但是不一定我们都能分派任务。"

### 核心价值
| 价值点 | 说明 |
|--------|------|
| **独立商业价值** | 可以作为独立产品/服务，不依赖特定任务调度系统 |
| **智能分发引擎** | 帮用户判断"这个任务应该交给哪个 Agent/执行者" |
| **可嵌入性** | 作为判断引擎 API，可嵌入到任何现有系统 |

### 商业化方向
| 方向 | 说明 |
|------|------|
| **SaaS 服务** | 提供 API，让客户接入自己的任务系统 |
| **企业解决方案** | 帮企业优化内部 Agent 协作流程 |
| **智能调度中台** | 作为独立产品，解决"任务应该谁来干"的问题 |

### 关键设计原则
1. **解耦**：职责匹配能力独立于当前系统的调度逻辑
2. **可复用**：设计成可复用的判断服务
3. **灵活性**：不强制依赖特定任务分配方式

### 后续优化方向
1. **代码层自动职责判断**：任务分配时自动判断任务类型
2. **Agent B 职责简化**：专注 MCP 结果判断，职责匹配作为兜底
3. **效率优化**：一次到位，不需要重新执行流程
4. **能力封装**：将 Agent B 的职责匹配能力封装为独立服务
