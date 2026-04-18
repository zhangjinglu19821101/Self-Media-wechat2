# Agent 任务执行系统 - 功能文档

## 1. 系统概述

这是一个基于 Next.js 的多 Agent 协作任务执行系统，支持任务拆解、子任务执行、合规校验、用户决策等完整流程。

### 技术栈
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **ORM**: Drizzle ORM
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

---

## 2. 核心角色

### 2.1 Agent B - 业务流程控制者
**职责**：
- 任务拆解：将主任务拆解为多个子任务（orderIndex 1, 2, 3...）
- 任务完成判断：判断子任务是否完成
- 身份匹配检查：检查当前执行者是否匹配任务
- 用户交互协调：判断是否需要用户交互
- 流程状态管理：管理任务的流程状态

**核心决策原则（最新）**：
1. **最高优先级**：MCP 执行结果 → 任何一次 "result: success" → 直接 COMPLETE
2. **原则1**：身份匹配 → COMPLETE（业务 Agent，非 Agent T）
3. **原则2**：身份不匹配 → REEXECUTE_EXECUTOR（切换到正确的执行者）
4. **原则3**：模糊地带 → 优先 Agent T（业务 Agent 和 Agent T 都可以时，优先 Agent T）

### 2.2 Agent T - 技术执行者
**职责**：
- MCP 工具调用：执行各种技术操作（上传、搜索、合规审核等）
- 技术任务处理：处理需要技术能力的任务
- 执行结果返回：返回 MCP 执行结果和判断

**记录字段（最新）**：
- `canComplete`: 是否可以完成
- `isCompleted`: 是否完成（基于 mcpSuccess）
- `isTaskDown`: 任务是否完成
- `mcpSuccess`: MCP 是否执行成功
- `result`: 执行结论
- `suggestion`: 建议
- `reasoning`: 推理过程
- `decisionContent`: 完整决策内容
- `mcpParams`: MCP 参数
- `toolsUsed`: 使用的工具
- `actionsTaken`: 采取的行动
- `decisionType`: 决策类型（COMPLETE / FAILED）

### 2.3 insurance-d - 内容创作 Agent
**职责**：
- 文章撰写：创作保险相关文章
- 内容修改：根据反馈修改文章
- 框架搭建：搭建文章框架

### 2.4 insurance-c - 运营 Agent
**职责**：
- 运营相关任务：处理保险运营相关工作
- 内容审核：审核内容是否符合运营要求

---

## 3. 核心功能

### 3.1 任务拆解
- Agent B 负责将主任务拆解为多个子任务
- 每个子任务有独立的 orderIndex（1, 2, 3...）
- 子任务按顺序执行

### 3.2 子任务执行
- 各 Agent 按顺序执行分配给自己的子任务
- 支持任务切换：如果当前执行者不匹配，自动切换到正确的执行者
- 支持 MCP 集成：Agent T 可以调用各种 MCP 工具

### 3.3 合规校验
- 对 insurance-d 完成的文章进行合规性校验
- 合规校验结果存储在 `agent_sub_tasks_mcp_executions` 表
- orderIndex=3 的子任务可以访问和展示合规校验结果

### 3.4 用户决策
- 在关键节点支持用户决策
- 用户决策界面新增"指令已完成"选项
- 支持用户直接确认任务完成

### 3.5 MCP 集成
- 集成各种 MCP 工具能力
- 支持搜索、合规审核、微信公众号上传等功能
- MCP 执行历史完整记录

---

## 4. 核心流程

### 4.1 完整任务流程
```
1. 任务创建
   ↓
2. Agent B 拆解任务（生成多个子任务，orderIndex 1, 2, 3...）
   ↓
3. 子任务按顺序执行
   ├─ orderIndex=1: 框架搭建（insurance-d）
   ├─ orderIndex=2: 正文撰写（insurance-d）
   ├─ orderIndex=3: 合规校验（MCP）
   ├─ orderIndex=4: 根据合规结果修改（insurance-d）
   ├─ orderIndex=5: 上传微信公众号（Agent T）
   └─ ...
   ↓
4. Agent B 审核子任务
   ├─ 检查 MCP 执行结果（最高优先级）
   ├─ 检查身份匹配
   └─ 做出决策（COMPLETE / REEXECUTE_EXECUTOR / NEED_USER）
   ↓
5. 用户决策（如需要）
   ↓
6. 任务完成
```

### 4.2 Agent B 决策流程（最新）
```
【最高优先级】先检查 MCP 执行结果！
   ├─ MCP 执行历史中有 "result: success"？
   └─ 是 → 直接返回 COMPLETE（忽略其他判断）
   ↓
【原则1】身份匹配
   ├─ 当前执行者身份与任务匹配？
   ├─ 是（非 Agent T）→ 返回 COMPLETE
   └─ 是（Agent T）→ 验证 MCP 真实执行情况
   ↓
【原则2】身份不匹配
   ├─ 当前执行者身份与任务不匹配？
   └─ 是 → 更新匹配的身份与 pending 状态，REEXECUTE_EXECUTOR
   ↓
【原则3】模糊地带
   ├─ 业务 Agent 与 Agent T 似乎都可以执行？
   └─ 是 → 优先 Agent T，REEXECUTE_EXECUTOR，suggestedExecutor: "agent T"
```

### 4.3 Agent T 执行流程
```
1. 接收任务
   ↓
2. 判断是否需要 MCP
   ├─ 需要 → 调用 MCP 工具
   └─ 不需要 → 直接处理
   ↓
3. 执行 MCP（如需要）
   ↓
4. 生成执行结果
   ├─ isCompleted: mcpSuccess
   ├─ mcpSuccess: true/false
   ├─ result: 执行结论
   ├─ suggestion: 建议
   ├─ reasoning: 推理过程
   └─ decisionContent: 完整决策内容
   ↓
5. 记录交互历史
   ↓
6. 状态设置为 pre_completed，等待 Agent B 审核
```

---

## 5. 数据库表

### 5.1 核心表
| 表名 | 说明 |
|------|------|
| `daily_task` | 主任务表 |
| `agent_sub_tasks` | 子任务表 |
| `agent_sub_tasks_step_history` | 子任务执行历史（Agent 交互记录） |
| `agent_sub_tasks_mcp_executions` | MCP 执行记录（包含合规校验结果） |

### 5.2 子任务状态
| 状态 | 说明 |
|------|------|
| `pending` | 等待执行 |
| `pre_completed` | 执行完成，等待 Agent B 审核 |
| `pre_need_support` | 需要技术支持（Agent T） |
| `waiting_user` | 等待用户决策 |
| `completed` | 已完成 |
| `failed` | 失败 |

---

## 6. 关键文件

### 6.1 Agent B 相关
| 文件 | 说明 |
|------|------|
| `src/lib/agents/prompts/agent-b-business-controller.ts` | Agent B 核心提示词 |
| `src/app/api/agents/user-decision/route.ts` | 用户决策 API |
| `src/app/api/agents/tasks/[taskId]/detail/route.ts` | 任务详情 API |

### 6.2 Agent T 相关
| 文件 | 说明 |
|------|------|
| `src/lib/services/subtask-execution-engine.ts` | 子任务执行引擎（核心） |
| `src/lib/agents/prompts/executor-standard-result-new.md` | 执行 Agent 标准结果格式 |

### 6.3 页面相关
| 文件 | 说明 |
|------|------|
| `src/app/query/agent-sub-tasks/page.tsx` | 子任务查询页面 |

---

## 7. 最近更新（2026-04-03）

### 7.1 Agent B 决策逻辑优化
**修改内容**：
- 将 MCP 成功判断提到最高优先级
- 任何一次 MCP "result: success" → 直接 COMPLETE
- 优先级：MCP 成功 > 原则1-3 > 执行 Agent 声明

**文件**：`src/lib/agents/prompts/agent-b-business-controller.ts`

### 7.2 Agent T 交互记录修复
**问题**：
- Agent T 交互记录信息少
- 缺少 `isCompleted` 字段
- 缺少 `mcpSuccess` 字段
- 缺少 Agent T 对执行结果的判断说明

**修复内容**：
- `agentTResultToSave` 增加 `isCompleted: mcpSuccess`
- `storedResponseContent` 增加 `mcpSuccess` 字段
- 补充 4 个判断说明字段：
  - `result`: 执行结论
  - `suggestion`: 建议
  - `reasoning`: 推理过程
  - `decisionContent`: 完整决策内容

**文件**：`src/lib/services/subtask-execution-engine.ts`

### 7.3 其他优化
- 用户决策界面新增"指令已完成"选项
- 子任务查询页面新增 MCP 执行记录展示
- 确认 order_index=3 的合规校验结果已正确传递

---

## 8. 开发规范

### 8.1 代码规范
- 使用 TypeScript 进行类型安全开发
- 遵循 shadcn/ui 组件规范
- 使用 Tailwind CSS 进行样式开发
- API 路由遵循 RESTful 规范
- 数据库操作使用 Drizzle ORM

### 8.2 测试说明
- 代码静态检查: `pnpm lint` 和 `pnpm ts-check`
- 构建检查: `pnpm build`
- 接口测试: 使用 curl 或其他工具测试 API 接口

### 8.3 端口规范
- Web 服务必须运行在 5000 端口
- 禁止使用 9000 端口（系统保留）

---

## 9. 目录结构

```
.
├── src/
│   ├── app/
│   │   ├── agents/              # Agent 相关页面
│   │   ├── api/                 # API 路由
│   │   │   └── agents/          # Agent API
│   │   └── query/               # 查询页面
│   ├── lib/
│   │   ├── agents/              # Agent 逻辑和提示词
│   │   ├── services/            # 业务服务（执行引擎等）
│   │   └── db/                  # 数据库相关
│   └── components/              # UI 组件
├── AGENTS.md                    # 项目概述
├── .coze                        # 项目配置
└── package.json                 # 项目依赖
```

---

## 10. 常见问题

### Q1: order_index=5 的任务为什么先由 Agent B 插入记录？
**A**: Agent B 负责拆解任务并创建所有子任务记录，Agent T 负责执行。这是架构设计，不是 bug。

### Q2: Agent T 执行 MCP 失败怎么办？
**A**: Agent B 会审核，如果是技术问题，会重新执行 Agent T 或切换方案。

### Q3: 如何查看 MCP 执行结果？
**A**: 在子任务查询页面的 MCP 执行标签页查看，或通过任务详情 API 的 mcpExecutions 字段获取。

### Q4: Agent B 决策优先级是什么？
**A**: 1. MCP 成功（最高） 2. 身份匹配 3. 身份不匹配 4. 模糊地带（优先 Agent T）

---

*文档版本: v1.0 (2026-04-03)*