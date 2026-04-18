# 压缩摘要

## 用户需求与目标
- 原始目标: 基于 Next.js 的多 Agent 协作系统，支持任务拆解、指令执行、监控巡检等全流程管理。
- 当前目标: 
  1. 实现异常补偿机制，将重试 10 次仍失败的拆解任务存入异常表。
  2. 提供人工界面，支持手动输入拆解结果并入库到 commandResults。
  3. 优化 Agent B 拆解提示词，包含具体的 3 天拆解样例及说明。

## 项目概览
- 概述: 基于 Next.js 的多 Agent 协作系统，支持 WebSocket 实时指令推送、任务管理、Agent 间通信。当前扩展为支持多平台（微信、小红书等）的智能内容创作与管理平台，核心功能为基于 RAG 的 AI 辅助写作与多平台一键部署。
- 技术栈:
  - Next.js 16 (App Router)
  - React 19
  - TypeScript 5
  - shadcn/ui
  - Tailwind CSS 4
  - PostgreSQL (Drizzle ORM)
  - 豆包 Embedding API (已集成)
- 编码规范: Airbnb

## 关键决策
- **异常补偿机制**：当自动重试（10次）失败后，自动将任务插入 `split_failures` 表，等待人工介入。
- **人工处理流程**：通过 `/exceptions` 页面查看异常，手动输入拆解结果，系统自动将结果保存到 `commandResults` 表。
- **提示词优化**：在 `JsonParserEnhancer.generateFormatErrorFeedback` 和异常处理弹窗中，明确提供将任务拆分为 3 天的 JSON 样例及详细说明。

## 核心文件修改
- 文件操作:
  - create: `src/lib/db/schema.ts` (新增 `split_failures` 表定义)
  - create: `src/lib/services/split-retry-manager.ts` (新增异常插入逻辑)
  - create: `src/app/api/exceptions/route.ts` (异常查询 API)
  - create: `src/app/api/exceptions/[failureId]/route.ts` (异常详情 API)
  - create: `src/app/api/exceptions/[failureId]/assign/route.ts` (异常分配 API)
  - create: `src/app/api/exceptions/[failureId]/resolve/route.ts` (异常解决 API)
  - create: `src/app/exceptions/page.tsx` (异常管理页面)
  - create: `src/components/exceptions/exception-resolve-modal.tsx` (异常处理弹窗)
  - create: `src/lib/db/init-split-failures.ts` (数据库初始化脚本)
  - create: `src/app/api/db/create-split-failures/route.ts` (表创建 API)
  - edit: `src/lib/utils/json-parser-enhancer.ts` (优化错误提示词，增加样例说明)
  - edit: `src/app/agents/[id]/page.tsx` (优化拆解指令，增加样例说明；修复拆解结果弹窗显示逻辑)
  - edit: `src/app/api/commands/send/route.ts` (修复拆解任务成功后 responseContent 更新逻辑)
- 关键修改:
  - **新增 split_failures 表**：存储重试失败的拆解任务，包含失败原因、重试历史、人工处理信息等。
  - **修改重试机制**：在 `SplitRetryManager.retryWithAgent` 中，达到最大重试次数时调用 `insertExceptionRecord` 插入异常记录。
  - **实现异常处理 API**：提供完整的 CRUD 接口，支持查询、分配、解决异常。
  - **实现人工界面**：提供异常列表展示、统计卡片、处理弹窗（包含重试历史和手动输入表单）。
  - **优化提示词**：在错误反馈中增加具体的 3 天拆解样例，帮助 Agent B 理解格式要求。
  - **修复拆解结果弹窗**：
    - 后端：确保 Agent B 拆解任务成功后，`responseContent` 更新为正确的 JSON 格式
    - 前端：增加多种 JSON 解析方法，能够处理不同格式的响应并正确显示确认弹窗

## 问题或错误及解决方案
- 问题: split_failures 表不存在
  - 解决方案: 创建 `src/lib/db/init-split-failures.ts` 和 `src/app/api/db/create-split-failures/route.ts`，通过 API 初始化表结构。
- 问题: 测试脚本语法错误
  - 解决方案: 修正 JavaScript 测试脚本中的类型注解语法错误。
- 问题: Agent A 页面没有弹出 Agent B 拆分结果的对话框
  - 解决方案: 
    1. **后端修复**：修改 `/api/commands/send/route.ts`，当 Agent B 拆解任务重试成功后，将 `responseContent` 更新为正确的 JSON 格式，确保发送给 Agent A 的通知包含正确的 JSON 数据。
    2. **前端修复**：修改 `src/app/agents/[id]/page.tsx`，增加多种 JSON 解析方法（Markdown 代码块、纯 JSON、包含 subTasks 的对象），能够处理不同格式的响应并正确显示拆解结果确认弹窗。
- 问题: Agent A 指令确认对话框消失
  - 解决方案: 修改 `src/app/agents/[id]/page.tsx` 中的 `handleSplitConfirm` 和 `handleSplitCancel` 函数，移除直接发送原有指令的逻辑，改为显示指令确认对话框，让用户能够查看和确认原有指令

## TODO
- 测试异常处理流程（当前已实现代码，等待用户测试反馈）
- Agent B 拆解任务已在第 1 次尝试中成功，无需重试机制介入（2026-02-10）
- 修复 agent A 指令确认对话框消失问题（2026-02-10）
- 重构通知轮询机制，使用状态控制而非时间戳（2026-02-10）
