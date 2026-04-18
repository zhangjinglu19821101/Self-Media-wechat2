# Coze MCP 能力 capability_type 实施计划与进度跟踪

## ⚠️ 重要提醒
**开始工作前，请先阅读 [DOCUMENT_INDEX.md](./DOCUMENT_INDEX.md) 了解文档结构！**

**不要创建新文档！** 所有进展在本文档追加。

---

## 📋 文档概述

本文档跟踪 `/docs/详细设计文档agent智能交互MCP能力设计capability_type.md` 的实施进度，确保功能完整落地，避免重复迭代。

**创建时间**: 2026-02-26
**最后更新**: 2026-02-26

---

## 📝 今日工作记录（2026-02-26）

### ✅ 已完成的工作

1. **创建了本文档** - `MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md`
2. **需求理解确认** - 与用户确认了对详细设计文档的理解
3. **绘制了交互流程图** - 基于详细设计文档的MCP能力体系交互流程
4. **完善了交互流程图** - 加入控制器视角，明确了5个阶段的完整流程
5. **重要需求变更确认**（2026-02-26 新增）：
   - ✅ 将 `agent_interactions` 表替换为 `agent_sub_tasks_step_history` 表（计划后续删除 `agent_interactions` 表）
   - ✅ 删除"阶段 2：Agent B解决方案选型"节点，改为控制器直接查询能力清单后提供信息给 Agent B
   - ✅ 控制器依据 Agent B 的标准化返回产生 2 个分支
   - ✅ **补充闭环逻辑**：执行Agent第二次执行还有疑问的闭环
   - ✅ **更新 agent_sub_tasks 表数据**：不要遗漏相关字段更新
   - ✅ **交互步骤记录逻辑**：首先保存执行agent的相关请求与问题，交互状态为 executing
   - ✅ **Agent A 处理环节设计**：待办任务 + 内容输入框 + 点击处理完成下发给执行agent

### 🎯 需求理解（关键要点）

#### 核心目标
- 实现完整的 Coze MCP 能力体系
- 包含 15个通用 `capability_type` 枚举
- 支持执行Agent能力边界判定
- 支持控制器直接查询能力清单后提供给 Agent B
- 支持MCP现场执行状态同步
- 支持两个分支：执行 capability num / 上报 Agent A

#### 与当前超时处理的关系
- 当前问题：超时处理只是简单通知，没有能力匹配、没有MCP现场执行支持、依赖交互次数
- 改造方向：超时触发时让执行Agent按MCP格式输出，控制器查询能力清单后提供给 Agent B，支持两个分支处理

#### 关键交付物
1. **类型定义**：`capability_type` 枚举、Agent交互类型
2. **数据库层**：`capability_list` 表、`agent_sub_tasks_step_history` 表
3. **API层**：能力清单查询API、Mock测试API
4. **文档**：本文档用于记录需求理解和进展

#### 工作方式
- 分步骤实施，每个步骤完成后跟用户确认
- 使用本文档记录需求理解和进展
- 不跳跃，不并行，严格按步骤确认后再继续

#### 重要数据表说明
- **`agent_sub_tasks_step_history`**：按步骤存储交互历史（使用此表）
- **`agent_interactions`**：计划后续删除此表

---

## 🔄 完善后的交互流程图（基于控制器视角 - 2026-02-26 更新）

### ⚠️ 重要修改记录
1. ✅ **数据表替换**：将 `agent_interactions` 表替换为 `agent_sub_tasks_step_history` 表（计划后续删除 `agent_interactions` 表）
2. ✅ **删除阶段2节点**：删除"阶段 2：Agent B解决方案选型"，改为控制器直接查询能力清单后提供信息给 Agent B
3. ✅ **两个分支逻辑**：控制器依据 Agent B 的标准化返回产生 2 个分支

---

### 完整流程概述

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   Coze MCP 能力体系完整交互流程（含控制器）                         │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              控制器（Controller）                                 │
│                   核心角色：任务调度、状态管理、流程协调                              │
└─────────────────────────────────────────────────────────────────────────────────┘
         │
         │ 0️⃣ 拉取 agent_sub_tasks 任务
         │
         ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        阶段 1：执行Agent能力边界判定                                │
└─────────────────────────────────────────────────────────────────────────────────┘
         │
         │ 1️⃣ 控制器将任务分发给执行Agent
         │
         ↓
┌─────────────┐
│  执行Agent   │
│ (insurance-d)│
└──────┬──────┘
       │
       │ 2️⃣ 执行任务，自主判断能力边界
       │
       ↓
       │ 3️⃣ 执行Agent返回标准化结果
       │    {
       │      is_need_mcp: boolean,
       │      problem?: string,
       │      capability_type?: string,
       │      execution_result?: any
       │    }
       │
       ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        控制器：接收执行Agent返回结果                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
         │
         │ 4️⃣ 控制器保存 execution_result 到 agent_sub_tasks 表
         │
         ├─────────────────────────────────────────────────────────────────────┐
         │                                                                     │
         │ is_need_mcp = false                                                │ is_need_mcp = true
         │ (不依赖MCP，直接完成)                                               │ (依赖MCP，需要Agent B介入)
         │                                                                     │
         ↓                                                                     ↓
┌───────────────────┐                                                ┌─────────────────────────────────┐
│  ✅ 任务完成       │                                                │  控制器直接查询能力清单           │
│  状态：completed   │                                                └─────────────────────────────────┘
└───────────────────┘                                                              │
                                                                                   │ 5️⃣ 控制器创建交互步骤记录
                                                                                   │    （使用 agent_sub_tasks_step_history 表）
                                                                                   │
                                                                                   ↓
                                                                         ┌───────────────────────┐
                                                                         │   控制器查询能力清单     │
                                                                         └───────────┬───────────┘
                                                                                     │
                                                                                     │ 6️⃣ 查询 capability_list 表
                                                                                     │    按 capability_type 过滤
                                                                                     │
                                                                                     ↓
                                                                         ┌───────────────────────┐
                                                                         │  控制器提供信息给Agent B  │
                                                                         └───────────┬───────────┘
                                                                                     │
                                                                                     │ 7️⃣ 控制器将以下信息发给Agent B：
                                                                                     │    - capability 清单
                                                                                     │    - 执行Agent反馈的问题
                                                                                     │    - 要求Agent B标准化返回
                                                                                     │
                                                                                     ↓
                                                                         ┌───────────────────────┐
                                                                         │       Agent B          │
                                                                         │  分析并返回标准化结果   │
                                                                         └───────────┬───────────┘
                                                                                     │
                                                                                     │ 8️⃣ Agent B分析并返回标准化结果
                                                                                     │
                                                                                     ↓
                                                                         ┌───────────────────────┐
                                                                         │  Agent B返回标准化结果  │
                                                                         └───────────┬───────────┘
                                                                                     │
                                                                                     ↓
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    阶段 2：控制器依据Agent B返回产生两个分支                              │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │ 9️⃣ 控制器保存Agent B的返回内容到 agent_sub_tasks_step_history 表
         │
         ├──────────────────────────────────────────────────────────────────────┐
         │                                                                      │
         │ 分支1：具备解决执行Agent的问题                                      │ 分支2：不具备解决Agent的问题
         │ （执行 capability num 的内容）                                      │ （上报 Agent A）
         │                                                                      │
         ↓                                                                      ↓
┌─────────────────────────────────┐                                  ┌─────────────────────────────────┐
│  执行 capability num 的内容     │                                  │  输出解决方案选型总结            │
└───────────────┬─────────────────┘                                  └───────────────┬─────────────────┘
                │                                                              │
                │ 🔟 控制器依据 solution_num 执行对应的 capability            │ 1️⃣1️⃣ 输出解决方案选型总结
                │                                                              │
                ├──────────────────────────────────────────┐                  │
                │                                          │                  │
                │ requires_on_site_execution = true       │ requires_on_site_execution = false  ↓
                │ (MCP需现场执行)                          │ (无需现场执行)          ┌─────────────────────────────┐
                ↓                                          ↓                        │ 通过弹框将问题上报       │
┌───────────────────────┐                  ┌───────────────────────┐              │ 决策 Agent A              │
│   MCP 现场执行         │                  │   直接使用方案结果     │              └───────────────┬─────────────┘
│   状态同步             │                  └───────────┬───────────┘                              │
└───────────┬───────────┘                              │                                          ↓
            │                                          │                              ┌─────────────────────────────┐
            │ 状态流转：                              │                              │  Agent A 处理              │
            │ waiting_execution → executing →        │                              └───────────────┬─────────────┘
            │ success/failed                          │                                          │
            ↓                                          │                                          ↓
┌───────────────────────┐                              │                              ┌─────────────────────────────┐
│  MCP执行完成返回结果   │                              │                              │  返回给执行Agent继续执行     │
└───────────┬───────────┘                              │                              └───────────────┬─────────────┘
            │                                          │                                          │
            └──────────────────────────┬───────────────┘                                          ↓
                                       ↓                                                    ┌─────────────────────────┐
                    ┌───────────────────────────────────────┐                              │  执行Agent继续执行       │
                    │  控制器收集：                          │                              └───────────────┬─────────┘
                    │  1. 执行Agent的问题                    │                                              │
                    │  2. Agent B给出的建议                  │                                              ↓
                    │  3. capability num 执行后的结果        │                                    ┌───────────────────┐
                    └───────────────────┬───────────────────┘                                    │  ✅ 任务完成       │
                                        ↓                                                         │  状态：completed   │
┌─────────────────────────────────────────────────────────────────────────────────┐             └───────────────────┘
│                        阶段 3：返回给执行Agent继续执行                                │
└─────────────────────────────────────────────────────────────────────────────────┘
         │
         │ 1️⃣2️⃣ 控制器将以下内容发给执行Agent：
         │     - 执行Agent的问题
         │     - Agent B给出的建议
         │     - capability num 执行后的结果
         │
         ↓
┌─────────────┐
│  执行Agent   │
│ (insurance-d)│
└──────┬──────┘
       │
       │ 1️⃣3️⃣ 执行Agent依据以上信息继续执行任务
       │
       ↓
       │ 1️⃣4️⃣ 执行Agent返回最终结果
       │
       ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        阶段 4：控制器保存最终结果                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
         │
         │ 1️⃣5️⃣ 控制器保存执行Agent的最终返回内容
         │    （使用 agent_sub_tasks_step_history 表）
         │
         │ 1️⃣6️⃣ 控制器更新状态为 completed
         │
         ↓
┌───────────────────┐
│  ✅ 任务完成       │
│  状态：completed   │
└───────────────────┘
```

### 用户提供的交互过程框架（已整合到上图）

#### 1. 控制器成功等到执行Agent的返回结果

**1.1 不依赖MCP，返回结果正常**
```
流程：控制器 → 执行Agent → 控制器 → 保存 execution_result
字段更新：agent_sub_tasks.execution_result, status = 'completed'
```

**1.2 依赖MCP，返回结果正常**
```
流程：
  1. 保存 execution_result 到 agent_sub_tasks 表
  2. 增加交互步骤（agent_interactions 表）
  3. 控制器把执行Agent的标准化返回 + capability清单 给到Agent B
  4. Agent B返回标准化结果
  5. 控制器依据 solution_num 执行对应的 capability 内容
```

**1.3 带着执行Agent的问题 + Agent B给出的建议 + capability num执行后的结果，给到执行Agent**
```
流程：
  1. 控制器收集：问题 + 建议 + 执行结果
  2. 一起发给执行Agent
  3. 控制器补充到交互步骤表中Agent B的返回内容
```

**1.4 控制器保存执行Agent依据3）提供的信息后返回的内容**
```
流程：
  1. 执行Agent继续执行并返回最终结果
  2. 控制器保存到 agent_sub_tasks.execution_result
  3. 控制器更新状态为 completed
```

---

## 🗂️ 关键数据表

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `agent_sub_tasks` | 子任务主表 | `execution_result`, `status` |
| `capability_list` | 能力清单表 | `id`（对应solution_num）, `capability_type`, `requires_on_site_execution` |
| `agent_sub_tasks_step_history` | 按步骤存储交互历史 | `command_result_id + step_no`, `interact_content`, `interact_num` |
| `agent_interactions` | 计划后续删除此表 | - |

---

## 📝 新增需求详细说明（2026-02-26）

### 需求1：更新 agent_sub_tasks 表数据，不要遗漏

**说明**：
- 在整个MCP流程中，需要及时更新 `agent_sub_tasks` 表的相关字段
- 不要遗漏任何状态变更、元数据更新等

**需要更新的字段清单**：
| 字段 | 更新时机 | 说明 |
|------|----------|------|
| `execution_result` | 执行Agent返回结果时 | 保存执行结果 |
| `status` | 状态变更时 | pending → in_progress → timeout → completed/failed |
| `timeout_handling_count` | 超时时 | 递增处理次数 |
| `feedback_history` | 有反馈时 | 追加反馈记录 |
| `last_feedback_at` | 有反馈时 | 更新最后反馈时间 |
| `dialogue_rounds` | 对话轮次增加时 | 递增对话轮数 |
| `dialogue_status` | 对话状态变更时 | none → in_progress → completed |
| `last_dialogue_at` | 有对话时 | 更新最后对话时间 |

---

### 需求2：控制器创建交互步骤记录的逻辑

**说明**：
- 使用 `agent_sub_tasks_step_history` 表
- 首先保存执行agent的相关请求与问题
- 交互状态应该是 `executing`

**记录时机与内容**：
| 阶段 | 记录内容 | interact_user | interact_status |
|------|----------|---------------|-----------------|
| 1. 执行Agent返回问题 | 执行Agent的请求与问题 | `insurance-d` | `executing` |
| 2. 控制器查询能力清单 | 查询能力清单的请求 | `controller` | `executing` |
| 3. Agent B返回结果 | Agent B的解决方案 | `agent B` | `executing` |
| 4. 执行capability num | 执行MCP能力 | `controller` | `executing` |
| 5. 执行Agent返回最终结果 | 最终结果 | `insurance-d` | `completed` |

**interact_num 递增规则**：
- 同 `command_result_id + step_no` 下的交流次数从1开始递增
- 每一轮闭环，interact_num 加 1

---

### 需求3：Agent A 待办任务独立功能设计

**说明**：
- 待办任务需要创建**独立功能**
- 通过**列表清单**展示所有待办任务
- 不是简单的输入框，而是完整的待办任务管理功能

**设计方案**：

---

#### 功能架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Agent A 待办任务管理系统                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. 待办任务列表页（首页）                            │   │
│  │     - 展示所有待办任务                                │   │
│  │     - 支持筛选（状态、时间、执行人）                  │   │
│  │     - 支持搜索                                        │   │
│  │     - 点击任务进入详情页                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  2. 待办任务详情页                                    │   │
│  │     - 展示任务详细信息                                │   │
│  │     - 展示问题历史                                    │   │
│  │     - 解决方案输入框                                  │   │
│  │     - 操作按钮（取消/处理完成）                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

#### 1. 待办任务列表页设计

**UI布局**：
```
┌─────────────────────────────────────────────────────────────────────┐
│  Agent A 待办任务列表                        [刷新] [筛选] [搜索]      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  筛选条件：[全部] [待处理] [处理中] [已完成]    搜索：[输入框]      │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  任务列表                                                    │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │                                                                  │ │
│  │  ○ [待处理]  任务标题1                                        │ │
│  │      问题：执行Agent反馈的问题描述...                         │ │
│  │      创建时间：2026-02-26 10:30:00    [查看详情]              │ │
│  │                                                                  │ │
│  │  ○ [处理中]  任务标题2                                        │ │
│  │      问题：执行Agent反馈的问题描述...                         │ │
│  │      创建时间：2026-02-26 11:00:00    [查看详情]              │ │
│  │                                                                  │ │
│  │  ✓ [已完成]  任务标题3                                        │ │
│  │      问题：执行Agent反馈的问题描述...                         │ │
│  │      完成时间：2026-02-26 09:30:00    [查看详情]              │ │
│  │                                                                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  [上一页]  1 / 10  [下一页]                                         │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**列表字段**：
| 字段 | 说明 | 显示方式 |
|------|------|----------|
| 状态图标 | pending/processing/completed | 图标显示 |
| 任务标题 | 子任务标题 | 完整显示 |
| 问题描述 | 执行Agent反馈的问题 | 截断显示（点击详情看完整） |
| 创建时间 | 待办任务创建时间 | 格式化显示 |
| 完成时间 | 待办任务完成时间 | 仅已完成状态显示 |
| 操作按钮 | 查看详情 | 按钮 |

---

#### 2. 待办任务详情页设计

**UI布局**：
```
┌─────────────────────────────────────────────────────────────────────┐
│  待办任务详情                        [返回列表]                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  基本信息                                                    │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  状态：[待处理]                    创建时间：2026-02-26 10:30 │   │
│  │  任务标题：[子任务标题]                                      │   │
│  │  执行人：[insurance-d]                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  问题历史（可展开）                                           │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  [展开]                                                      │   │
│  │  1. 执行Agent第一次反馈问题：...                            │   │
│  │  2. Agent B分析结果：...                                    │   │
│  │  3. 执行Agent第二次反馈问题：...                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  问题描述（完整）                                             │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  [执行Agent反馈的完整问题描述]                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  解决方案输入                                                │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │                                                     │   │   │
│  │  │  请输入解决方案内容（支持多行）...                   │   │   │
│  │  │                                                     │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  [取消]                                [处理完成]                    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**详情页字段**：
| 字段 | 说明 |
|------|------|
| 状态 | pending / processing / completed |
| 创建时间 | 待办任务创建时间 |
| 任务标题 | 子任务标题 |
| 执行人 | 执行Agent ID（insurance-d等） |
| 问题历史 | 可展开的历史记录（可选） |
| 问题描述 | 执行Agent反馈的完整问题 |
| 解决方案输入框 | Agent A输入解决方案 |
| 操作按钮 | 取消 / 处理完成 |

---

#### 3. 交互流程

```
1. Agent B 上报问题给 Agent A
   ↓
2. 创建待办任务记录（status = pending）
   ↓
3. Agent A 访问待办任务列表页
   ↓
4. Agent A 浏览列表，点击某个任务的"查看详情"
   ↓
5. 进入待办任务详情页
   ↓
6. Agent A 查看问题描述和历史
   ↓
7. Agent A 在输入框中输入解决方案
   ↓
8. 点击"处理完成"按钮
   ↓
9. 控制器更新待办任务（status = completed，记录solution_content）
   ↓
10. 控制器将解决方案下发给反馈问题的执行Agent
    ↓
11. 执行Agent继续执行任务
    ↓
12. Agent A 自动返回列表页（显示"处理完成"提示）
```

---

#### 4. 待办任务数据表设计（必须）

**表名**：`agent_a_todos`

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| `id` | UUID | PRIMARY KEY | 主键 |
| `sub_task_id` | UUID | NOT NULL, FOREIGN KEY | 关联的子任务ID（agent_sub_tasks.id） |
| `task_title` | TEXT | NOT NULL | 任务标题（冗余，方便列表展示） |
| `problem_description` | TEXT | NOT NULL | 执行Agent反馈的问题描述 |
| `problem_history` | JSONB | DEFAULT '[]' | 问题历史记录（可选，JSON数组） |
| `executor_agent_id` | TEXT | NOT NULL | 执行Agent ID（insurance-d等） |
| `solution_content` | TEXT | NULLABLE | Agent A输入的解决方案 |
| `status` | TEXT | NOT NULL DEFAULT 'pending' | 状态：pending / processing / completed |
| `created_by` | TEXT | NOT NULL | 创建者（通常是 'agent_b'） |
| `processed_by` | TEXT | NULLABLE | 处理者（Agent A 的用户ID） |
| `created_at` | TIMESTAMP | NOT NULL DEFAULT NOW() | 创建时间 |
| `processed_at` | TIMESTAMP | NULLABLE | 处理时间 |
| `completed_at` | TIMESTAMP | NULLABLE | 完成时间 |

**索引设计**：
- `idx_agent_a_todos_status`: 对 `status` 建立索引
- `idx_agent_a_todos_sub_task_id`: 对 `sub_task_id` 建立索引
- `idx_agent_a_todos_created_at`: 对 `created_at` 建立索引

---

#### 5. API 接口设计

**待办任务列表 API**：
- `GET /api/agent-a/todos` - 获取待办任务列表
- 查询参数：`status`（筛选状态）、`search`（搜索关键词）、`page`、`limit`

**待办任务详情 API**：
- `GET /api/agent-a/todos/:id` - 获取待办任务详情

**处理待办任务 API**：
- `POST /api/agent-a/todos/:id/process` - 处理待办任务
- 请求体：`{ solution_content: string }`

**取消待办任务 API**：
- `POST /api/agent-a/todos/:id/cancel` - 取消待办任务

---

#### 6. 状态流转图

```
pending (待处理)
    │
    ├─→ 点击"处理完成"
    │       ↓
    │   processing (处理中)
    │       ↓
    │   completed (已完成)
    │
    └─→ 点击"取消"
            ↓
         cancelled (已取消)
```

---

---

---

## 🎯 关键决策点

1. **is_need_mcp = true/false？** （执行Agent决定）
2. **requires_on_site_execution = true/false？**（capability_list表决定）
3. **is_notify_agentA = true/false？**（Agent B决定）

---

## 📋 如何确保明天记得这些信息？

### 保障措施

1. **本文档记录完整** - 所有需求理解、流程图、关键决策点都已记录在本文档中
2. **文件路径明确** - `/workspace/projects/MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md`
3. **版本控制** - 项目使用 Git，可查看历史变更
4. **结构化记录** - 本文档按章节组织，信息清晰易查

### 明天开始工作前的检查清单

- [ ] 阅读本文档的"今日工作记录"部分
- [ ] 查看"需求理解（关键要点）"
- [ ] 回顾"完善后的交互流程图"
- [ ] 确认"关键决策点"
- [ ] 查看"实施进度总览"，确认当前进度

### 本文档的阅读顺序

1. 先看 **"今日工作记录"** - 了解最新进展
2. 再看 **"需求理解（关键要点）"** - 确认需求理解
3. 然后看 **"完善后的交互流程图"** - 理解完整流程
4. 最后看 **"实施进度总览"** - 确认下一步要做什么

---

## 🔄 重要补充：执行Agent第二次执行还有疑问的闭环逻辑

### 问题识别
原流程图缺少了执行Agent第二次执行还有疑问的闭环。

### 闭环逻辑说明

```
执行Agent返回结果
    │
    ├─ is_need_mcp = false → 任务完成（无疑问）
    │
    └─ is_need_mcp = true → 还有疑问！形成闭环
                              │
                              ↓
                    控制器创建交互步骤记录
                    （使用 agent_sub_tasks_step_history 表）
                              │
                              ↓
                    控制器查询 capability_list 表
                              │
                              ↓
                    控制器提供信息给Agent B：
                      - capability 清单
                      - 执行Agent反馈的新问题
                      - 要求Agent B标准化返回
                              │
                              ↓
                    Agent B分析并返回标准化结果
                              │
                              ↓
                    再次产生两个分支：
                      分支1：执行 capability num
                      分支2：上报 Agent A
                              │
                              ↓
                    继续循环，直到 is_need_mcp = false
```

### 关键要点

1. **执行Agent可以多次有疑问**：不是一次就完，可能形成多轮循环
2. **每一轮都记录到 agent_sub_tasks_step_history**：保证全链路可追溯
3. **循环终止条件**：执行Agent返回 `is_need_mcp = false`
4. **interact_num 递增**：同一步骤下的交流次数从1开始递增

---

---

---

## 🎯 设计目标回顾

统一MCP能力的分类标准，定义全局唯一的capability_type枚举，支撑多Agent协作（执行Agent、Agent B、Agent A）的能力匹配、解决方案选型，适配所有业务线（无业务绑定），保证Agent间交互规范、可追溯、可扩展。

---

## 📊 实施进度总览

| 阶段 | 状态 | 完成度 | 说明 |
|------|------|--------|------|
| 第一阶段：基础定义 | 🔄 进行中 | 0% | capability_type 枚举、类型定义 |
| 第二阶段：数据层 | ⏳ 待开始 | 0% | 数据库表、迁移脚本 |
| 第三阶段：类型系统 | ⏳ 待开始 | 0% | Agent 交互类型定义 |
| 第四阶段：API层 | ⏳ 待开始 | 0% | Mock API、测试接口 |
| 第五阶段：集成测试 | ⏳ 待开始 | 0% | 端到端流程测试 |

---

## 🔧 详细实施计划与进度

### **第一阶段：基础定义**

#### 1.1 capability_type 枚举类型定义
- **文件**: `src/lib/types/capability-types.ts`
- **状态**: ⏳ 待开始
- **优先级**: 🔴 高
- **预期输出**: 15个通用 capability_type 枚举

**内容清单**:
```typescript
export const CAPABILITY_TYPES = {
  DATA_ACQUIRE: 'data_acquire',           // 数据获取
  DATA_PROCESS: 'data_process',           // 数据处理
  CONTENT_GENERATE: 'content_generate',   // 内容生成
  CONTENT_OPTIMIZE: 'content_optimize',   // 内容优化
  CONTENT_CHECK: 'content_check',         // 内容审核
  MEDIA_OPERATE: 'media_operate',         // 媒体操作
  PLATFORM_PUBLISH: 'platform_publish',   // 平台发布
  TOOL_EXECUTE: 'tool_execute',           // 工具调用
  AGENT_COLLABORATE: 'agent_collaborate', // Agent协作
  HUMAN_INTERACT: 'human_interact',       // 人工交互
  TASK_CONTROL: 'task_control',           // 任务控制
  RESOURCE_ACCESS: 'resource_access',     // 资源访问
  KNOWLEDGE_SEARCH: 'knowledge_search',   // 知识检索
  SCHEDULE_PLAN: 'schedule_plan',         // 规划编排
  EXCEPTION_HANDLE: 'exception_handle',   // 异常处理
} as const;
```

---

### **第二阶段：数据层**

#### 2.1 capability_list 数据库表设计
- **文件**: `src/lib/db/schema.ts`
- **状态**: ⏳ 待开始
- **优先级**: 🔴 高
- **表名**: `capability_list`

**字段设计**:
| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| `id` | SERIAL | PRIMARY KEY | 能力ID（solution_num对应） |
| `capability_type` | TEXT | NOT NULL | 能力类型（枚举值） |
| `function_desc` | TEXT | NOT NULL | 功能描述 |
| `status` | TEXT | NOT NULL DEFAULT 'active' | 状态（active/inactive） |
| `requires_on_site_execution` | BOOLEAN | NOT NULL DEFAULT false | 是否需现场执行 |
| `metadata` | JSONB | DEFAULT '{}' | 额外元数据 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | 更新时间 |

**索引设计**:
- `idx_capability_list_type`: 对 `capability_type` 建立索引
- `idx_capability_list_status`: 对 `status` 建立索引

---

#### 2.2 数据库迁移脚本
- **文件**: `src/lib/db/migrations/0001_create_capability_list_table.sql`
- **状态**: ⏳ 待开始
- **优先级**: 🔴 高

**迁移内容**:
```sql
-- 创建 capability_list 表
CREATE TABLE IF NOT EXISTS capability_list (
  id SERIAL PRIMARY KEY,
  capability_type TEXT NOT NULL,
  function_desc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  requires_on_site_execution BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_capability_list_type ON capability_list(capability_type);
CREATE INDEX IF NOT EXISTS idx_capability_list_status ON capability_list(status);

-- 插入初始数据（15个通用能力）
INSERT INTO capability_list (capability_type, function_desc, requires_on_site_execution) VALUES
  ('data_acquire', '获取各类数据（外网爬取、数据库查询、文件读取、第三方接口调用）', false),
  ('data_process', '对获取的数据进行清洗、解析、结构化、格式转换', false),
  ('content_generate', '生成各类文本内容（标题、正文、摘要、文案等）', false),
  ('content_optimize', '对生成的内容进行润色、去AI化、语气调整、逻辑优化', false),
  ('content_check', '对内容进行合规校验、风险检测、格式检查', false),
  ('media_operate', '处理各类媒体资源（图片、文件、音视频的上传、下载、编辑）', true),
  ('platform_publish', '将内容发布至各类平台（公众号、小红书、抖音等）', true),
  ('tool_execute', '调用各类工具（计算器、搜索工具、MCP连接器等）', true),
  ('agent_collaborate', '多Agent间的咨询、转交、协同处理任务', false),
  ('human_interact', '与人工进行交互（确认、反馈、审批、修改意见接收）', false),
  ('task_control', '任务的调度、重试、超时处理、状态更新', false),
  ('resource_access', '访问各类资源（文件、数据库、外部接口、知识库）', false),
  ('knowledge_search', '从知识库、文档、FAQ中检索相关知识', false),
  ('schedule_plan', '对任务流程、步骤、策略进行规划和编排', false),
  ('exception_handle', '处理任务执行中的报错、降级、兜底逻辑', false);
```

---

### **第三阶段：类型系统**

#### 3.1 执行Agent输出规范类型定义
- **文件**: `src/lib/types/agent-interaction.ts`
- **状态**: ⏳ 待开始
- **优先级**: 🔴 高

**类型定义**:
```typescript
// 执行Agent输出规范（能力边界判定）
export interface ExecutionAgentOutput {
  is_need_mcp: boolean;                    // true：超出自身能力范围，需Agent B介入
  problem?: string;                         // 问题描述（is_need_mcp=true时必填）
  capability_type?: CapabilityType;        // 能力类型（is_need_mcp=true时必填）
}

// MCP执行状态枚举
export type MCPExecutionStatus = 
  | 'waiting_execution'   // 待执行
  | 'executing'           // 执行中
  | 'success'             // 执行成功
  | 'failed';             // 执行失败
```

---

#### 3.2 Agent B输出规范类型定义
- **文件**: `src/lib/types/agent-interaction.ts`
- **状态**: ⏳ 待开始
- **优先级**: 🔴 高

**类型定义**:
```typescript
// Agent B输出规范（解决方案选型 + MCP执行状态 + 上报决策）
export interface AgentBOutput {
  // 解决方案选型相关
  list_capabilities: boolean;              // true：需要查询能力清单
  capability_type?: CapabilityType;        // 查询维度（list_capabilities=true时可选）
  solution_num?: number;                    // 选定的解决方案ID（与capability_list.id对应）
  solution_desc?: string;                   // 解决方案描述（可选）

  // MCP执行状态相关
  mcp_execution_status?: MCPExecutionStatus;  // MCP执行状态
  mcp_return_info?: Record<string, any>;       // MCP执行完成后返回结果
  dialog_history?: Array<Record<string, any>>; // 对话历史

  // 上报决策相关
  is_notify_agentA: boolean;              // true：需要上报Agent A
  report_content?: string | Record<string, any>;  // 上报内容（is_notify_agentA=true时必填）
}

// 能力清单查询返回格式
export interface CapabilityListItem {
  id: number;
  capability_type: CapabilityType;
  function_desc: string;
  requires_on_site_execution: boolean;
  status: string;
}

export interface CapabilityListResponse {
  problem: string;
  capabilities: CapabilityListItem[];
}
```

---

#### 3.3 更新 interact_content 类型
- **文件**: `src/lib/types/interact-content.ts`
- **状态**: ⏳ 待开始
- **优先级**: 🔴 高

**需要新增的字段**:
```typescript
// 在 InteractContent 中新增以下字段
export interface InteractContent {
  // ... 现有字段 ...

  // === 新增：MCP能力相关字段 ===
  is_need_mcp?: boolean;
  problem?: string;
  capability_type?: CapabilityType;

  list_capabilities?: boolean;
  solution_num?: number;
  solution_desc?: string;

  mcp_execution_status?: MCPExecutionStatus;
  mcp_return_info?: Record<string, any>;

  is_notify_agentA?: boolean;
  report_content?: string | Record<string, any>;
}
```

---

### **第四阶段：API层**

#### 4.1 能力清单查询 API
- **文件**: `src/app/api/capability-list/route.ts`
- **状态**: ⏳ 待开始
- **优先级**: 🔴 高
- **端点**: `GET /api/capability-list`

**功能**:
- 按 `capability_type` 过滤
- 按 `status` 过滤
- 返回匹配的能力清单

**请求参数**:
```typescript
interface CapabilityListQuery {
  capability_type?: CapabilityType;
  status?: string;  // 默认 'active'
}
```

---

---

---

## 📝 今日工作记录（2026-02-26 第二部分）

### ✅ 已完成的工作（分支1智能化）

1. **需求理解与确认**
   - 阅读并理解用户提供的分支1智能化需求文档
   - 明确 insurance-d 和 Agent B 的责任边界
   - 确认核心功能：根据 solution_num 执行 + 闭环学习

2. **领域知识库实现**
   - 创建 4 类表结构：
     - `domain_rule`: 业务规则库（敏感词、token规则、发布规则）
     - `domain_case`: 案例库（成功/失败案例）
     - `domain_terminology`: 术语库（保险+MCP术语）
     - 扩展 `capability_list`: 新增 `param_template`、`scene_tags` 字段
   - 创建完整索引优化查询性能
   - 初始化基础数据：8个领域术语 + 3个业务规则

3. **核心代码模块实现**
   - **类型定义** (`src/lib/types/branch1-types.ts`)
     - `InsuranceDAnalysisResult`: insurance-d 输出类型
     - `AgentBParamResult`: Agent B 输出类型
     - `DomainKnowledge`: 领域知识聚合类型
     - `Branch1ExecutionResult`: 执行结果类型
   
   - **领域知识检索器** (`src/lib/mcp/domain-knowledge-retriever.ts`)
     - `getRulesForScene()`: 获取场景相关规则
     - `getCasesForCapability()`: 获取能力相关案例
     - `getTerminologyForScene()`: 获取场景相关术语
     - `getCapabilityInfo()`: 获取能力信息（含参数模板）
     - `getDomainKnowledge()`: 聚合获取完整领域知识
     - `formatKnowledgeForPrompt()`: 格式化为 Prompt 字符串
   
   - **案例仓库（闭环学习）** (`src/lib/mcp/case-repository.ts`)
     - `saveSuccessCase()`: 保存成功案例
     - `saveFailureCase()`: 保存失败案例
     - `updateParamTemplate()`: 自动优化参数模板
     - `getSuccessCases()`: 获取成功案例
     - `getFailureCases()`: 获取失败案例
   
   - **分支1智能执行器** (`src/lib/mcp/branch1-intelligent-executor.ts`)
     - `execute()`: 完整执行入口
     - `getSimplifiedInsuranceDAnalysis()`: 简化版 insurance-d（待接入真实 LLM）
     - `callAgentB()`: 简化版 Agent B（待接入真实 LLM）
     - `executeMCP()`: 执行 MCP 调用
     - `handleClosedLoopLearning()`: 闭环学习处理
   
   - **测试 API** (`src/app/api/test/branch1-intelligent/route.ts`)
     - `POST`: 执行分支1完整智能流程
     - `GET ?action=stats`: 查看知识库统计
     - `GET ?action=knowledge&solutionNum=16`: 查看指定能力的领域知识
     - `GET ?action=cases`: 查看所有案例

4. **数据库迁移文件**
   - `scripts/migrations/005_create_domain_knowledge_tables.sql`: 领域知识库表创建

5. **测试验证**
   - 知识库统计 API 正常工作
   - 领域知识检索 API 正常工作
   - 返回完整的规则、案例、术语、参数模板

### 📊 当前实现状态

| 模块 | 状态 | 说明 |
|-----|------|------|
| 数据库表结构 | ✅ 完成 | 4类表 + 索引 + 初始化数据 |
| 类型定义 | ✅ 完成 | 完整的 TypeScript 类型 |
| 领域知识检索器 | ✅ 完成 | 可正常检索和格式化知识 |
| 案例仓库 | ✅ 完成 | 支持成功/失败案例保存 + 参数模板优化 |
| 分支1执行器 | ⚠️ 部分完成 | 框架已完成，LLM 调用使用简化版 |
| 测试 API | ✅ 完成 | 完整的测试和调试接口 |

### 📋 待完成的工作

#### 高优先级
1. **接入真实的 insurance-d LLM**
   - 创建 insurance-d 的 Prompt 模板
   - 实现 LLM 调用逻辑
   - 替换当前的简化版分析逻辑

2. **接入真实的 Agent B LLM**
   - 创建 Agent B 的 Prompt 模板
   - 实现 LLM 调用逻辑
   - 替换当前的简化版参数生成逻辑

#### 中优先级
3. **运行完整流程测试**
   - 积累成功案例
   - 验证参数模板自优化
   - 测试失败案例学习

4. **增加更多领域知识**
   - 补充更多保险术语
   - 补充更多 MCP 调用规则
   - 添加场景标签

### 🔑 关键文件清单

- `src/lib/types/branch1-types.ts` - 类型定义
- `src/lib/mcp/domain-knowledge-retriever.ts` - 领域知识检索器
- `src/lib/mcp/case-repository.ts` - 案例仓库
- `src/lib/mcp/branch1-intelligent-executor.ts` - 分支1执行器
- `src/app/api/test/branch1-intelligent/route.ts` - 测试 API
- `scripts/migrations/005_create_domain_knowledge_tables.sql` - 数据库迁移

### 💡 关键设计决策

1. **领域知识库结构**
   - 选择 4 类表结构，覆盖规则、案例、术语、参数模板
   - 所有表都有业务关联字段（capability_type、solution_num、scene）

2. **弱化硬编码**
   - 仅保留 HTTP、DB、类型定义的硬编码
   - 所有业务逻辑交给 LLM 决策
   - 领域知识通过检索方式提供

3. **闭环学习机制**
   - 成功案例自动优化参数模板
   - 失败案例保存失败原因供后续学习
   - 参数模板采用增量合并策略

4. **可扩展架构**
   - 为接入真实 LLM 预留了清晰接口
   - 领域知识检索器可独立演进
   - 案例仓库可支持更多学习策略

---

### 🚫 错误记录与纠正

**错误**: 创建了一堆冗余的 BRANCH1_*.md 文档
**纠正**: 已删除冗余文档，仅在现有 `MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md` 上更新进展

---

### 🎯 下一步行动建议

1. **立即行动**：接入真实的 insurance-d 和 Agent B LLM
2. **短期行动**：运行完整流程测试，积累案例
3. **中期行动**：根据实际使用优化领域知识

```

**响应格式**:
```typescript
{
  success: boolean;
  data: CapabilityListResponse;
}
```

---

#### 4.2 Mock 测试 API：执行Agent能力边界判定
- **文件**: `src/app/api/test/mcp-execution-agent-boundary/route.ts`
- **状态**: ⏳ 待开始
- **优先级**: 🟡 中
- **端点**: `POST /api/test/mcp-execution-agent-boundary`

**功能**:
- Mock 执行Agent的能力边界判定
- 测试各种场景（正常/需要MCP/无匹配方案）

---

#### 4.3 Mock 测试 API：Agent B解决方案选型
- **文件**: `src/app/api/test/mcp-agent-b-solution/route.ts`
- **状态**: ⏳ 待开始
- **优先级**: 🟡 中
- **端点**: `POST /api/test/mcp-agent-b-solution`

**功能**:
- Mock Agent B的解决方案选型
- 测试查询能力清单、选定方案、MCP现场执行等场景

---

#### 4.4 Mock 测试 API：完整MCP工作流程
- **文件**: `src/app/api/test/mcp-full-workflow/route.ts`
- **状态**: ⏳ 待开始
- **优先级**: 🟡 中
- **端点**: `POST /api/test/mcp-full-workflow`

**功能**:
- 端到端测试完整的MCP工作流程
- 包含：执行Agent → Agent B → MCP现场执行 → 返回结果

---

### **第五阶段：集成测试**

#### 5.1 单元测试：类型定义验证
- **文件**: `src/lib/types/__tests__/capability-types.test.ts`
- **状态**: ⏳ 待开始
- **优先级**: 🟢 低

---

#### 5.2 集成测试：数据库操作
- **文件**: `src/lib/db/__tests__/capability-list.test.ts`
- **状态**: ⏳ 待开始
- **优先级**: 🟢 低

---

#### 5.3 E2E测试：完整工作流程
- **文件**: `src/app/api/test/mcp-full-workflow/e2e.test.ts`
- **状态**: ⏳ 待开始
- **优先级**: 🟢 低

---

## 📝 核心功能点检查清单

### 第三章：通用 capability_type 枚举清单（15个）

- [ ] `data_acquire` - 数据获取
- [ ] `data_process` - 数据处理
- [ ] `content_generate` - 内容生成
- [ ] `content_optimize` - 内容优化
- [ ] `content_check` - 内容审核
- [ ] `media_operate` - 媒体操作
- [ ] `platform_publish` - 平台发布
- [ ] `tool_execute` - 工具调用
- [ ] `agent_collaborate` - Agent协作
- [ ] `human_interact` - 人工交互
- [ ] `task_control` - 任务控制
- [ ] `resource_access` - 资源访问
- [ ] `knowledge_search` - 知识检索
- [ ] `schedule_plan` - 规划编排
- [ ] `exception_handle` - 异常处理

---

### 第四章：Agent交互流程与核心功能设计

#### 4.2 执行Agent核心功能（能力边界判定）

- [ ] 输出 `is_need_mcp` 字段
- [ ] 输出 `problem` 字段（is_need_mcp=true时必填）
- [ ] 输出 `capability_type` 字段（is_need_mcp=true时必填）
- [ ] 格式：「能力类型+具体问题」
- [ ] 字数限制：不超过500字

---

#### 4.3 Agent B核心功能（解决方案选型+上报决策+MCP执行状态同步）

**解决方案选型流程**：
- [ ] 接收执行Agent的 `is_need_mcp`、`problem`、`capability_type`
- [ ] 输出 `list_capabilities` 字段（是否查询能力清单）
- [ ] 携带 `capability_type` 参数（指定查询维度）
- [ ] 控制器查询 `capability_list` 表
- [ ] 返回「执行Agent问题+匹配的能力清单」
- [ ] Agent B输出 `solution_num`（与能力清单id一一对应）
- [ ] 可选输出 `solution_desc`（补充解决方案描述）

**MCP现场执行状态同步**：
- [ ] 输出 `mcp_execution_status` 字段
- [ ] 状态流转：waiting_execution → executing → success/failed
- [ ] 输出 `mcp_return_info` 字段（MCP执行完成后必填）
- [ ] 输出 `dialog_history` 字段（提交给执行Agent时必填）

**上报决策功能**：
- [ ] 输出 `is_notify_agentA` 字段（自主决策是否上报）
- [ ] 输出 `report_content` 字段（is_notify_agentA=true时必填）
- [ ] 上报内容包含：问题描述、解决方案、上报原因
- [ ] 字数限制：不超过500字

---

## 🔗 与当前超时处理的结合

### 当前超时处理的问题
1. ❌ 超时处理与MCP能力体系脱节
2. ❌ 缺少能力匹配机制
3. ❌ 缺少MCP现场执行支持
4. ❌ 交互流程依赖次数（5次）

### 改造方向
1. ✅ 超时触发时，让执行Agent按MCP能力体系格式输出
2. ✅ Agent B介入时，按MCP能力体系进行解决方案选型
3. ✅ 支持MCP现场执行场景
4. ✅ 由Agent B自主决策是否上报，不依赖交互次数

---

## 📅 实施优先级排序

### 第一优先级（必须完成）
1. [ ] 创建 capability_type 枚举类型定义
2. [ ] 创建 capability_list 数据库表（Drizzle schema）
3. [ ] 创建 capability_list 表的迁移 SQL 并执行
4. [ ] 创建执行 Agent 输出规范的类型定义
5. [ ] 创建 Agent B 输出规范的类型定义
6. [ ] 更新 interact_content 类型以支持新的字段

### 第二优先级（应该完成）
7. [ ] 创建能力清单查询 API
8. [ ] 创建 Mock 测试 API：执行Agent能力边界判定
9. [ ] 创建 Mock 测试 API：Agent B解决方案选型

### 第三优先级（可以完成）
10. [ ] 创建 Mock 测试 API：完整MCP工作流程
11. [ ] 测试完整的端到端流程
12. [ ] 编写单元测试和集成测试

---

## 📚 相关文档与参考

| 文档 | 位置 | 说明 |
|------|------|------|
| 详细设计文档 | `/docs/详细设计文档agent智能交互MCP能力设计capability_type.md` | 原始需求文档 |
| 数据库Schema | `/src/lib/db/schema.ts` | 现有数据库表结构 |
| 交互类型定义 | `/src/lib/types/interact-content.ts` | 现有交互类型 |
| 子任务执行引擎 | `/src/lib/services/subtask-execution-engine.ts` | 现有执行逻辑 |
| 定时任务调度器 | `/src/lib/cron/scheduler.ts` | 现有超时处理逻辑 |

---

## 🎯 成功验收标准

### 功能验收
- [ ] 15个 capability_type 枚举完整定义
- [ ] capability_list 表创建成功并包含初始数据
- [ ] 执行Agent能按规范输出能力边界判定结果
- [ ] Agent B能按规范进行解决方案选型
- [ ] 支持MCP现场执行状态同步
- [ ] Agent B能自主决策是否上报Agent A

### 测试验收
- [ ] 类型定义通过 TypeScript 编译检查
- [ ] 数据库迁移脚本执行成功
- [ ] Mock API 能正常响应
- [ ] 端到端流程测试通过

### 文档验收
- [ ] 本文档更新至最新状态
- [ ] 代码注释完整清晰
- [ ] API 文档齐全

---

## 📞 联系方式与问题反馈

如有问题或建议，请通过以下方式反馈：
- 查看最新代码变更
- 检查本文档的更新状态
- 确认需求理解无误后再实施

---

**文档维护者**: AI Assistant
**最后更新时间**: 2026-02-26
**版本**: v1.0.0
