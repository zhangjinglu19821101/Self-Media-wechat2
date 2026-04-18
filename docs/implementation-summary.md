# 实施工作汇总

## 概述

本文档汇总了多 Agent 协作系统的所有实施工作，按照优先级分为 P0（必须完成）、P1（建议完成）、P2（可选）三个等级。

---

## 📋 实施工作清单

### P0 - 数据库表变更（必须完成，约 2 小时）

#### 1.1 为 `commandResults` 表添加字段

**SQL 脚本**：
```sql
ALTER TABLE command_results
ADD COLUMN dialogue_session_id VARCHAR(100),
ADD COLUMN dialogue_rounds INTEGER DEFAULT 0,
ADD COLUMN dialogue_status VARCHAR(50) DEFAULT 'none',
ADD COLUMN last_dialogue_at TIMESTAMP,
ADD COLUMN latest_report_id UUID REFERENCES agent_reports(id),
ADD COLUMN report_count INTEGER DEFAULT 0,
ADD COLUMN requires_intervention BOOLEAN DEFAULT FALSE;
```

**Drizzle ORM Schema 更新**：
- 更新 `src/lib/db/schema.ts` 中的 `commandResults` 表定义
- 添加 `dialogueSessionId`, `dialogueRounds`, `dialogueStatus`, `lastDialogueAt`, `latestReportId`, `reportCount`, `requiresIntervention` 字段

**预计时间**：30 分钟

---

#### 1.2 为 `agentSubTasks` 表添加字段

**SQL 脚本**：
```sql
ALTER TABLE agent_sub_tasks
ADD COLUMN dialogue_session_id VARCHAR(100),
ADD COLUMN dialogue_rounds INTEGER DEFAULT 0,
ADD COLUMN dialogue_status VARCHAR(50) DEFAULT 'none',
ADD COLUMN last_dialogue_at TIMESTAMP;
```

**Drizzle ORM Schema 更新**：
- 更新 `src/lib/db/schema.ts` 中的 `agentSubTasks` 表定义
- 添加 `dialogueSessionId`, `dialogueRounds`, `dialogueStatus`, `lastDialogueAt` 字段

**预计时间**：20 分钟

---

#### 1.3 为 `agentInteractions` 表添加字段

**SQL 脚本**：
```sql
ALTER TABLE agent_interactions
ADD COLUMN is_understand BOOLEAN DEFAULT FALSE;
```

**Drizzle ORM Schema 更新**：
- 更新 `src/lib/db/schema.ts` 中的 `agentInteractions` 表定义
- 添加 `isUnderstand` 字段

**预计时间**：10 分钟

---

#### 1.4 创建 `agentReports` 表

**SQL 脚本**：
```sql
CREATE TABLE agent_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(50) NOT NULL,
  command_result_id UUID NOT NULL REFERENCES command_results(id) ON DELETE CASCADE,
  sub_task_id UUID REFERENCES agent_sub_tasks(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  dialogue_process JSONB NOT NULL,
  suggested_actions JSONB NOT NULL,
  reported_to VARCHAR(50) NOT NULL,
  reported_from VARCHAR(50) NOT NULL,

  -- 状态管理字段
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR(50),
  reviewed_at TIMESTAMP,
  processed_by VARCHAR(50),
  processed_at TIMESTAMP,
  processed_actions JSONB DEFAULT [],
  dismissed_reason TEXT,
  related_task_id UUID REFERENCES agent_tasks(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_agent_reports_status ON agent_reports(status);
CREATE INDEX idx_agent_reports_command_result_id ON agent_reports(command_result_id);
CREATE INDEX idx_agent_reports_reported_to ON agent_reports(reported_to);
```

**Drizzle ORM Schema 更新**：
- 在 `src/lib/db/schema.ts` 中添加 `agentReports` 表定义
- 添加所有字段和类型定义

**预计时间**：30 分钟

---

#### 1.5 执行数据库迁移

**操作步骤**：
1. 生成迁移文件：`pnpm drizzle-kit generate`
2. 执行迁移：`pnpm drizzle-kit migrate`
3. 验证表结构：查看数据库表是否正确创建

**预计时间**：10 分钟

---

### P0 - MCP 集成（必须完成，约 2-3 小时）

#### 2.1 安装 MCP SDK

**命令**：
```bash
pnpm add @modelcontextprotocol/sdk
```

**预计时间**：5 分钟

---

#### 2.2 实现 MCP Server

**文件**：`src/lib/mcp/server.ts`

**功能**：
- 实现 MCP Server 基础框架
- 实现权限控制（仅 Agent B 可调用）
- 实现安全机制（路径、域名、表白名单）
- 实现审计日志

**预计时间**：1.5 小时

---

#### 2.3 实现 MCP Client

**文件**：`src/lib/mcp/client.ts`

**功能**：
- 实现 MCP Client 基础框架
- 实现连接管理
- 实现工具调用封装

**预计时间**：1 小时

---

#### 2.4 实现 MCP 工具

**文件**：`src/lib/mcp/tools/`

**工具列表**：
- `file-read`：读取本地文件
- `file-write`：写入本地文件
- `http-get`：HTTP GET 请求
- `http-post`：HTTP POST 请求

**预计时间**：1 小时

---

### P0 - 定时任务实现（必须完成，约 3-4 小时）

#### 3.1 配置定时任务调度

**选项 A：开发环境使用 node-cron**

**安装**：
```bash
pnpm add node-cron
pnpm add -D @types/node-cron
```

**配置文件**：`src/lib/cron/scheduler.ts`

**预计时间**：30 分钟

---

**选项 B：生产环境使用 Vercel Cron**

**配置文件**：`vercel.json`

**预计时间**：30 分钟

---

#### 3.2 实现定时任务 1：check-subtask-progress

**功能**：每 10 分钟监控 `agent_sub_tasks` 表，检测未推进任务（>30 分钟未更新），触发 Agent B 10 轮对话判断。

**文件**：`src/app/api/cron/check-subtask-progress/route.ts`

**实现步骤**：
1. 查询 `agent_sub_tasks` 表，筛选未推进的任务
2. 调用 `judgeExecutorResponse` 函数
3. 调用 `summarizeDialogue` 函数
4. 调用 `reportToAgentA` 函数

**预计时间**：1 小时

---

#### 3.3 实现定时任务 2：check-long-running-tasks

**功能**：每日 13:00 巡检 `command_results` 表，检测超过 1 天未完成的任务，触发 Agent B 10 轮对话判断。

**文件**：`src/app/api/cron/check-long-running-tasks/route.ts`

**实现步骤**：
1. 查询 `command_results` 表，筛选超长任务
2. 调用 `judgeExecutorResponse` 函数
3. 调用 `summarizeDialogue` 函数
4. 调用 `reportToAgentA` 函数

**预计时间**：1 小时

---

#### 3.4 实现定时任务 3：check-new-tasks-to-split

**功能**：每 10 分钟扫描 `command_results` 表，检测新确认任务（`status='new'`, `questionStatus='resolved'`），自动调用 `splitTaskForAgent` 拆分。

**文件**：`src/app/api/cron/check-new-tasks-to-split/route.ts`

**实现步骤**：
1. 查询 `command_results` 表，筛选新确认任务
2. 调用 `splitTaskForAgent` 函数
3. 创建子任务

**预计时间**：1 小时

---

### P0 - Agent B 判断和上报机制（必须完成，约 2-3 小时）

#### 4.1 实现对话判断函数

**文件**：`src/lib/agents/agent-b/judge-executor-response.ts`

**功能**：Agent B 与执行 Agent 进行最多 10 轮对话，判断执行 Agent 是否理解任务。

**实现步骤**：
1. 初始化对话会话
2. 循环调用 LLM 进行对话
3. 检查 `isUnderstand` 标志
4. 超时或理解后返回对话历史

**预计时间**：1 小时

---

#### 4.2 实现对话总结函数

**文件**：`src/lib/agents/agent-b/summarize-dialogue.ts`

**功能**：总结对话内容，生成总结信息（`summary`）、结论（`conclusion`）、建议行动（`suggestedActions`）。

**实现步骤**：
1. 提取对话历史
2. 调用 LLM 生成总结
3. 返回总结信息

**预计时间**：30 分钟

---

#### 4.3 实现上报函数

**文件**：`src/lib/agents/agent-b/report-to-agent-a.ts`

**功能**：Agent B 上报报告给 Agent A，将总结信息和对话过程存储到 `agentReports` 表。

**实现步骤**：
1. 创建 `agentReports` 记录
2. 存储总结信息（`summary`, `conclusion`, `suggestedActions`）
3. 存储对话过程（`dialogueProcess`）
4. 通知 Agent A

**预计时间**：30 分钟

---

### P0 - 统计 API 改造（必须完成，约 1 小时）

#### 5.1 修改 `getStats` 方法

**文件**：`src/lib/services/command-result-service.ts`

**功能**：在现有统计基础上，新增介入相关、上报报告、超时相关统计。

**新增字段**：
- `requiresIntervention`：需要 Agent A 介入的任务数
- `reportCount`：上报的总次数
- `pendingReports`：待处理报告数
- `processedReports`：已处理报告数
- `timeoutSubtasks`：超时子任务数
- `longRunningTasks`：超长任务数

**预计时间**：1 小时

---

### P1 - 报告管理 API（建议完成，约 2-3 小时）

#### 6.1 实现查询待处理报告 API

**文件**：`src/app/api/reports/pending/route.ts`

**功能**：Agent A 查看待处理报告。

**预计时间**：30 分钟

---

#### 6.2 实现标记报告已审核 API

**文件**：`src/app/api/reports/[id]/review/route.ts`

**功能**：Agent A 标记报告已审核。

**预计时间**：30 分钟

---

#### 6.3 实现获取处理建议 API

**文件**：`src/app/api/reports/[id]/suggestions/route.ts`

**功能**：Agent A 获取处理建议。

**预计时间**：30 分钟

---

#### 6.4 实现执行处理行动 API

**文件**：`src/app/api/reports/[id]/process/route.ts`

**功能**：Agent A 执行处理行动，触发回调。

**预计时间**：30 分钟

---

#### 6.5 实现驳回报告 API

**文件**：`src/app/api/reports/[id]/dismiss/route.ts`

**功能**：Agent A 驳回报告。

**预计时间**：30 分钟

---

#### 6.6 实现回调函数

**文件**：`src/lib/reports/report-callbacks.ts`

**功能**：报告处理完成后，自动触发回调，更新 `commandResults` 表。

**预计时间**：30 分钟

---

### P1 - 前端页面改动（建议完成，约 2-3 小时）

#### 7.1 新增统计卡片

**文件**：`src/components/agent-a/execution-results-stats.tsx`

**功能**：在执行结果页面新增统计卡片（需要介入、上报报告、超时监控）。

**预计时间**：1 小时

---

#### 7.2 实现高亮显示

**功能**：对需要关注的指标进行高亮（橙色/红色）。

**预计时间**：30 分钟

---

#### 7.3 实现点击跳转

**功能**：点击"待处理报告"跳转到 `/reports/pending` 页面。

**预计时间**：30 分钟

---

#### 7.4 实现报告列表页面

**文件**：`src/app/reports/pending/page.tsx`

**功能**：展示待处理报告列表。

**预计时间**：1 小时

---

#### 7.5 实现报告详情页面

**文件**：`src/app/reports/[id]/page.tsx`

**功能**：展示报告详情，支持查看对话过程、执行处理行动。

**预计时间**：1 小时

---

### P2 - 性能优化（可选，约 2-3 小时）

#### 8.1 添加数据库索引

**索引列表**：
```sql
CREATE INDEX idx_command_results_requires_intervention ON command_results(requires_intervention);
CREATE INDEX idx_command_results_to_agent_id ON command_results(to_agent_id);
CREATE INDEX idx_agent_sub_tasks_command_result_id ON agent_sub_tasks(command_result_id);
```

**预计时间**：30 分钟

---

#### 8.2 使用 Redis 缓存统计数据

**功能**：对统计数据使用 Redis 缓存，减少数据库查询。

**预计时间**：1.5 小时

---

#### 8.3 实现数据可视化图表

**功能**：添加趋势图、饼图等数据可视化图表。

**预计时间**：1 小时

---

## 📊 总工作量估算

| 优先级 | 模块 | 工作量 | 说明 |
|--------|------|--------|------|
| **P0** | 数据库表变更 | 2 小时 | 添加字段、创建表、迁移 |
| **P0** | MCP 集成 | 3.5 小时 | Server、Client、工具实现 |
| **P0** | 定时任务 | 3 小时 | 3 个定时任务实现 |
| **P0** | Agent B 判断上报 | 2 小时 | 对话判断、总结、上报 |
| **P0** | 统计 API 改造 | 1 小时 | 新增统计字段 |
| **P1** | 报告管理 API | 3 小时 | 5 个 API + 回调 |
| **P1** | 前端页面改动 | 3 小时 | 统计卡片、报告页面 |
| **P2** | 性能优化 | 3 小时 | 索引、缓存、图表 |
| **总计** | - | **20.5 小时** | - |

---

## 🎯 建议实施顺序

### 阶段 1：数据库基础（P0，2 小时）

1. 为 `commandResults` 表添加字段
2. 为 `agentSubTasks` 表添加字段
3. 为 `agentInteractions` 表添加字段
4. 创建 `agentReports` 表
5. 执行数据库迁移

**完成后**：数据库结构准备就绪

---

### 阶段 2：MCP 集成（P0，3.5 小时）

1. 安装 MCP SDK
2. 实现 MCP Server
3. 实现 MCP Client
4. 实现 MCP 工具

**完成后**：Agent B 可以调用 MCP 获取本地文件和查询远程数据

---

### 阶段 3：Agent B 判断上报机制（P0，2 小时）

1. 实现对话判断函数
2. 实现对话总结函数
3. 实现上报函数

**完成后**：Agent B 可以与执行 Agent 对话并上报报告

---

### 阶段 4：定时任务（P0，3 小时）

1. 配置定时任务调度
2. 实现 check-subtask-progress
3. 实现 check-long-running-tasks
4. 实现 check-new-tasks-to-split

**完成后**：系统自动监控任务状态并触发上报

---

### 阶段 5：统计 API 改造（P0，1 小时）

1. 修改 `getStats` 方法

**完成后**：API 返回新增的统计字段

---

### 阶段 6：报告管理 API（P1，3 小时）

1. 实现查询待处理报告 API
2. 实现标记报告已审核 API
3. 实现获取处理建议 API
4. 实现执行处理行动 API
5. 实现驳回报告 API
6. 实现回调函数

**完成后**：Agent A 可以管理报告

---

### 阶段 7：前端页面改动（P1，3 小时）

1. 新增统计卡片
2. 实现高亮显示
3. 实现点击跳转
4. 实现报告列表页面
5. 实现报告详情页面

**完成后**：Agent A 可以在界面上查看和管理报告

---

### 阶段 8：性能优化（P2，3 小时）

1. 添加数据库索引
2. 使用 Redis 缓存
3. 实现数据可视化图表

**完成后**：系统性能优化完成

---

## 📝 注意事项

### 关键依赖关系

1. **P0 阶段必须按顺序完成**：
   - 阶段 1（数据库）→ 阶段 2（MCP）→ 阶段 3（Agent B）→ 阶段 4（定时任务）→ 阶段 5（统计 API）

2. **P1 阶段依赖于 P0**：
   - 阶段 6（报告管理 API）依赖于阶段 3（Agent B）和阶段 4（定时任务）
   - 阶段 7（前端页面）依赖于阶段 6（报告管理 API）

3. **P2 阶段可并行进行**：
   - 性能优化可以在其他阶段完成后进行

### 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 数据库表变更可能影响现有功能 | 中 | 充分测试，备份现有数据 |
| MCP SDK 集成可能遇到兼容性问题 | 中 | 查阅文档，逐步实现 |
| 定时任务可能误报或漏报 | 中 | 完善日志，监控定时任务执行 |
| 前端改动可能影响用户体验 | 低 | 充分测试，逐步发布 |

---

## 📄 相关文档

1. **定时任务详细设计**：`docs/scheduled-tasks-detailed-design.md`
2. **MCP 集成方案**：`docs/mcp-integration-for-agent-b-only.md`
3. **Agent B 判断上报机制**：`docs/agent-b-judgment-and-agent-a-reporting.md`
4. **业务联动设计**：`docs/report-business-linkage-design.md`
5. **执行结果页面改动方案**：`docs/execution-results-page-changes.md`
6. **实施条件检查报告**：`docs/implementation-readiness-check-revised.md`

---

## ✅ 实施检查清单

### P0 - 数据库表变更
- [ ] 为 `commandResults` 表添加字段
- [ ] 为 `agentSubTasks` 表添加字段
- [ ] 为 `agentInteractions` 表添加字段
- [ ] 创建 `agentReports` 表
- [ ] 执行数据库迁移

### P0 - MCP 集成
- [ ] 安装 MCP SDK
- [ ] 实现 MCP Server
- [ ] 实现 MCP Client
- [ ] 实现 MCP 工具

### P0 - 定时任务
- [ ] 配置定时任务调度
- [ ] 实现 check-subtask-progress
- [ ] 实现 check-long-running-tasks
- [ ] 实现 check-new-tasks-to-split

### P0 - Agent B 判断上报
- [ ] 实现对话判断函数
- [ ] 实现对话总结函数
- [ ] 实现上报函数

### P0 - 统计 API 改造
- [ ] 修改 `getStats` 方法

### P1 - 报告管理 API
- [ ] 实现查询待处理报告 API
- [ ] 实现标记报告已审核 API
- [ ] 实现获取处理建议 API
- [ ] 实现执行处理行动 API
- [ ] 实现驳回报告 API
- [ ] 实现回调函数

### P1 - 前端页面改动
- [ ] 新增统计卡片
- [ ] 实现高亮显示
- [ ] 实现点击跳转
- [ ] 实现报告列表页面
- [ ] 实现报告详情页面

### P2 - 性能优化
- [ ] 添加数据库索引
- [ ] 使用 Redis 缓存
- [ ] 实现数据可视化图表

---

## 🎉 总结

### 核心工作

| 优先级 | 模块 | 工作量 | 关键产出 |
|--------|------|--------|---------|
| P0 | 数据库表变更 | 2 小时 | 完整的数据库表结构 |
| P0 | MCP 集成 | 3.5 小时 | Agent B 可调用 MCP |
| P0 | 定时任务 | 3 小时 | 3 个定时任务自动运行 |
| P0 | Agent B 判断上报 | 2 小时 | Agent B 自动上报报告 |
| P0 | 统计 API 改造 | 1 小时 | 新增统计字段 |
| P1 | 报告管理 API | 3 小时 | 完整的报告管理 API |
| P1 | 前端页面改动 | 3 小时 | 完整的报告管理界面 |
| P2 | 性能优化 | 3 小时 | 性能优化完成 |

### 总工作量

- **P0（必须完成）**：11.5 小时
- **P1（建议完成）**：6 小时
- **P2（可选）**：3 小时
- **总计**：20.5 小时

### 实施建议

1. **优先完成 P0**：确保核心功能可用
2. **按顺序实施**：遵循依赖关系，逐步推进
3. **充分测试**：每个阶段完成后进行测试
4. **及时反馈**：遇到问题及时沟通

---

**最后更新时间**：2025-01-01
