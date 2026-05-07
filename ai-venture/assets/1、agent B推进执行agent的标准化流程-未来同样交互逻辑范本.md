# Agent B 与执行Agent（如insurance-d）通用交互框架（Coze执行版）

# 一、文档说明

本文档用于 Coze 执行 Agent B 与各类执行Agent（如insurance-d）的通用交互逻辑落地，明确流程、规则和约束，新增执行Agent或子任务时，无需修改核心逻辑，直接遵循本文档规范即可。

核心目标：实现标准化、可扩展的 Agent 交互流程，支持 MCP 协助重试、人工介入机制，确保每一步执行可追溯、无歧义。

# 二、核心定义（Coze执行必看）

## 2.1 核心角色

- 定时任务：触发整个交互流程的入口，负责从数据库拉取待执行子任务。

- 控制器：核心调度角色，负责串联所有步骤，处理状态判断、参数传递、重试计数、历史记录。

- 执行Agent：具体任务执行角色（如insurance-d），负责执行子任务，返回执行状态和结果。

- Agent B：决策角色，负责分析执行Agent的MCP协助需求，输出MCP调用参数、处理MCP执行结果，给执行Agent反馈。

- Agent A：人工介入触发角色，当重试次数超限，负责弹出对话框，寻求人类协助。

## 2.2 核心术语/表/接口定义

- agent_sub_tasks 表：存储待执行的子任务，核心字段：taskId（子任务ID）、taskName（任务名称）、agentType（绑定执行Agent类型）、params（任务参数）、status（任务状态）、retryCount（已重试次数）、createTime（创建时间）、updateTime（更新时间）。

- agent_sub_tasks_step_history 表：存储每次完整交互的历史记录，1次完整交互对应1条记录，核心字段：historyId（历史ID）、taskId（子任务ID）、agentType（执行Agent类型）、step（重试步骤1-3）、status（步骤状态）、execAgentResponse（执行Agent返回结果）、agentBResponse（Agent B返回结果）、createTime（创建时间）。

- 执行Agent接口：统一实现 ExecAgent 接口，包含 agentType（唯一标识，如“insurance-d”）、execute（task: AgentSubTask）: Promise<ExecAgentResponse>（执行方法）。

- Agent B接口：包含 analyze（mcpRequire: 协助参数, taskContext: 子任务上下文）: Promise<AgentBResponse>（分析MCP需求）、processResult（mcpResult: MCP执行结果）: Promise<any>（处理MCP结果，生成给执行Agent的反馈）。

## 2.3 状态枚举（统一标准，Coze执行严格遵循）

执行Agent/子任务的状态统一使用以下枚举，禁止自定义状态：

- PENDING：待执行

- EXECUTING：执行中

- NEED_MCP_ASSIST：需要MCP协助（触发Agent B介入）

- SUCCESS：执行成功（流程终止）

- FAILED：执行失败（流程终止）

- HUMAN_INTERVENTION：需要人工介入（重试3次后触发）

# 三、通用交互流程（Coze执行核心，单次完整交互=1条历史记录）

## 3.1 流程步骤（按顺序执行，无跳转）

1. 定时任务触发，唤起控制器，控制器从 agent_sub_tasks 表中拉取状态为 PENDING 的子任务，依次处理（单任务串行执行）。

2. 控制器调用当前子任务绑定的执行Agent的 execute 方法，传入子任务完整参数（agent_sub_tasks 表的 params 字段）。

3. 控制器等待执行Agent执行完成，接收其返回的 ExecAgentResponse 结果，通过 status 字段判断执行状态：
        

    - 若状态为 SUCCESS：控制器更新 agent_sub_tasks 表该子任务状态为 SUCCESS，流程终止，无需后续步骤。

    - 若状态为 FAILED：控制器更新 agent_sub_tasks 表该子任务状态为 FAILED，流程终止，无需后续步骤。

    - 若状态为 NEED_MCP_ASSIST：进入MCP协助流程（步骤3-6），触发Agent B介入。

4. 控制器提取执行Agent返回结果中的 mcpRequire 字段（含 capabilityId：MCP能力ID、params：MCP调用参数），同时收集子任务上下文（taskId、agentType、当前retryCount），调用 Agent B 的 analyze 方法。

5. Agent B 分析 MCP 协助需求，返回 AgentBResponse 结果（含目标MCP能力ID、标准化MCP调用参数）。

6. 控制器接收 Agent B 的分析结果，调用 MCP 执行器，执行对应 capabilityId 的 MCP 能力，获取 MCP 执行结果（MCPExecutionResult）。

7. 控制器将 MCP 执行结果传入 Agent B 的 processResult 方法，Agent B 处理后，输出可直接提供给执行Agent的标准化反馈结果。

8. 控制器生成1条 agent_sub_tasks_step_history 记录（step=当前 retryCount+1），录入执行Agent返回结果、Agent B返回结果、当前状态。

9. 控制器更新 agent_sub_tasks 表该子任务的 retryCount（ retryCount += 1 ），将 Agent B 处理后的反馈结果，重新传入执行Agent的 execute 方法，触发执行Agent新一轮执行。

10. 重复步骤3-9，直至执行Agent返回 SUCCESS/FAILED，或重试次数达到上限。

## 3.2 流程流程图（Coze执行可参考，Word中可插入对应流程图）

（建议在Word中插入以下流程图，清晰呈现流转逻辑）

流程节点：定时任务 → 控制器拉取待执行子任务 → 调用执行Agent执行 → 判断执行状态 → （SUCCESS/FAILED→流程终止）→ （NEED_MCP_ASSIST→调用Agent B分析→执行MCP→Agent B处理结果→记录历史→更新重试次数→重新调用执行Agent）→ 重复直至终止或重试超限

# 四、核心规则约束（Coze执行严格遵循，不可修改）

## 4.1 重试规则

- 单次完整交互定义：“执行Agent执行→返回NEED_MCP_ASSIST→Agent B分析→MCP执行→Agent B反馈→执行Agent重新执行”，视为1次完整交互，对应1条历史记录。

- 每个子任务最多支持3次完整交互，即 retryCount 最大为3（初始值0，每次交互后+1）。

- 若执行Agent返回 SUCCESS 或 FAILED，无论当前重试次数多少，均立即终止流程，不再重试。

## 4.2 人工介入规则

- 当 agent_sub_tasks 表中某子任务的 retryCount ≥ 3，且执行Agent仍返回 NEED_MCP_ASSIST 状态时，控制器更新该子任务状态为 HUMAN_INTERVENTION。

- 控制器触发 Agent A 的弹窗接口，传入参数：taskId（子任务ID）、retryCount（3次）、reason（“经3次MCP协助重试，执行Agent仍需协助，无法完成任务”），请求人类介入处理。

- 人工介入后，由人类更新子任务状态（SUCCESS/FAILED），流程终止。

## 4.3 历史记录规则

- 每次完整交互（步骤3-9）必须生成1条 agent_sub_tasks_step_history 记录，不可遗漏。

- 历史记录需完整录入：historyId（唯一标识）、taskId、agentType、step（当前重试步骤）、status（当前步骤状态）、execAgentResponse、agentBResponse、createTime（当前时间）。

# 五、框架扩展性要求（Coze执行时，新增执行Agent/子任务需遵循）

1. 新增执行Agent（如finance-d、health-d）：仅需实现 ExecAgent 接口，定义 agentType（唯一标识）和 execute 方法，无需修改控制器、Agent B、MCP执行器的核心逻辑。

2. 新增子任务：仅需在 agent_sub_tasks 表中新增记录，指定 taskId、agentType（绑定对应执行Agent）、params（任务参数），控制器会自动按通用流程处理。

3. 新增MCP能力：仅需将MCP能力注册到MCP执行器工厂，Agent B 会通过 analyze 方法自动适配，无需修改交互流程。

# 六、Coze执行注意事项

- 所有接口调用、参数传递需严格遵循本文档定义的格式，禁止自定义参数或状态。

- 执行过程中，若出现异常（如执行Agent超时、MCP执行失败、Agent B分析失败），控制器需将子任务状态更新为 FAILED，记录异常信息，流程终止。

- 确保 agent_sub_tasks 表和 agent_sub_tasks_step_history 表的字段与本文档一致，避免因字段缺失导致流程中断。

- 重试次数、状态流转、历史记录生成，需严格按规则执行，不可跳过或修改步骤。

# 七、补充说明（Coze执行参考）

## 7.1 字段字典（数据库表核心字段）

|表名|字段名|数据类型|说明|
|---|---|---|---|
|agent_sub_tasks|taskId|string|子任务唯一ID|
||taskName|string|子任务名称|
||agentType|string|执行Agent类型（如“insurance-d”）|
||params|object|子任务执行参数|
||status|string|子任务状态（遵循状态枚举）|
||retryCount|number|已重试次数（0-3）|
||createTime|string|子任务创建时间（ISO格式）|
||updateTime|string|子任务更新时间（ISO格式）|
|agent_sub_tasks_step_history|historyId|string|历史记录唯一ID|
||taskId|string|关联子任务ID|
||agentType|string|执行Agent类型|
||step|number|重试步骤（1-3）|
||status|string|当前步骤状态|
||execAgentResponse|object|执行Agent返回结果|
||agentBResponse|object|Agent B返回结果|
## 7.2 异常场景处理（Coze执行补充）

- 执行Agent超时：控制器等待执行Agent响应超过30秒，视为执行失败，更新子任务状态为 FAILED，记录错误信息“执行Agent超时未响应”。

- MCP执行失败：控制器调用MCP执行器后，MCP返回 success: false，Agent B 处理后，反馈执行Agent“MCP协助失败，请重试”，控制器正常计数重试。

- Agent B分析失败：Agent B 分析MCP需求时抛出异常，控制器更新子任务状态为 FAILED，记录错误信息“Agent B分析失败”。
> （注：文档部分内容可能由 AI 生成）