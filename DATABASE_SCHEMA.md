# 数据库表结构文档

本文档描述 Agent 任务管理系统中的核心表结构，用于指导 Agent B 进行任务拆解和结构化数据提取。

---

## 表一：agent_tasks（任务表）

存储 Agent 间的任务信息，包括任务创建、拆解、执行的全生命周期。

### 核心字段

| 字段名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| **task_id** | text | ✅ | 任务ID，唯一标识 | `task-A-to-insurance-c-1770660000000` |
| **task_name** | text | ✅ | 任务名称 | `公众号本周基础运营任务` |
| **core_command** | text | ✅ | 核心指令（简短描述） | `完成公众号本周基础运营动作，提升粉丝活跃度与留存率` |
| **executor** | text | ✅ | 执行主体 | `insurance-c` |
| **task_duration_start** | timestamp | ✅ | 任务开始时间 | `2026-02-10 09:00:00` |
| **task_duration_end** | timestamp | ✅ | 任务结束时间 | `2026-02-17 18:00:00` |
| **total_deliverables** | text | ✅ | 总交付物（多行文本） | `1. 本周粉丝核心需求汇总表（周五18:00前）
2. 社群引流数据报告（周四18:00前）` |
| **task_priority** | text | ✅ | 任务优先级 | `high` / `normal` / `low` |
| **task_status** | text | ✅ | 任务状态 | `unsplit` / `split_completed` / `in_progress` / `completed` / `failed` |
| **creator** | text | ✅ | 创建人 | `A` |
| **updater** | text | ✅ | 更新人 | `A` |
| **remarks** | text | ❌ | 备注 | `运营类任务，4个核心动作` |

### 兼容字段（旧版本保留）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| **from_agent_id** | text | ✅ | 发送方Agent ID |
| **to_agent_id** | text | ✅ | 接收方Agent ID |
| **command** | text | ✅ | 原始指令（完整内容） |
| **command_type** | text | ✅ | 指令类型 |
| **priority** | text | ✅ | 优先级（兼容字段） |
| **status** | text | ✅ | 状态（兼容字段） |
| **result** | text | ❌ | 执行结果 |
| **metadata** | jsonb | ❌ | 元数据 |

### 状态流转

```
unsplit（未拆分）
  ↓ Agent B 拆解
split_completed（拆分完成）
  ↓ Agent A 确认
in_progress（执行中）
  ↓
completed（完成） / failed（失败）
```

---

## 表二：command_results（指令表）

存储任务拆解后的子指令及其执行结果。

### 核心字段

| 字段名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| **command_id** | text | ✅ | 指令ID | `cmd-task-A-to-insurance-c-1770660000000-1` |
| **related_task_id** | text | ✅ | 关联任务ID | `task-A-to-insurance-c-1770660000000` |
| **command_content** | text | ✅ | 指令内容 | `全量回复本周公众号粉丝留言，24小时响应率≥90%` |
| **executor** | text | ✅ | 执行主体 | `insurance-c` |
| **command_priority** | text | ✅ | 指令优先级 | `urgent` / `normal` |
| **execution_deadline_start** | timestamp | ✅ | 执行开始时间 | `2026-02-10 09:00:00` |
| **execution_deadline_end** | timestamp | ✅ | 执行结束时间 | `2026-02-14 18:00:00` |
| **deliverables** | text | ✅ | 交付物描述 | `本周粉丝核心需求汇总表` |
| **execution_status** | text | ✅ | 执行状态 | `new` / `in_progress` / `completed` / `feedback_completed` / `helping_tech_expert` / `helping_president` / `failed` |
| **status_proof** | text | ❌ | 状态更新佐证 | `已完成留言回复，响应率95%` |
| **help_record** | text | ❌ | 求助记录 | `2026-02-12 10:00:00 - TS唤起：超过1小时无进展` |
| **audit_opinion** | text | ❌ | 审核意见 | `数据完整，通过审核` |

### 审计字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| **splitter** | text | ✅ | 拆分人 | `agent B` |
| **entry_user** | text | ✅ | 录入人 | `TS` |
| **remarks** | text | ❌ | 备注 |

### 监控字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| **last_ts_check_time** | timestamp | ❌ | 上次TS检查时间 |
| **last_ts_awakening_time** | timestamp | ❌ | 上次TS唤起时间 |
| **ts_awakening_count** | integer | ✅ | TS唤起次数 |
| **last_inspection_time** | timestamp | ❌ | 上次Agent B巡检时间 |
| **last_consult_time** | timestamp | ❌ | 上次咨询时间 |
| **awakening_count** | integer | ✅ | 总唤起次数 |

### 元数据字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| **task_id** | text | ❌ | 兼容旧版字段 |
| **from_agent_id** | text | ✅ | 提交执行结果的Agent ID |
| **to_agent_id** | text | ✅ | 接收执行结果的Agent ID（通常是A） |
| **original_command** | text | ✅ | 原始指令内容 |
| **execution_result** | text | ❌ | 执行结果描述 |
| **output_data** | jsonb | ❌ | 输出数据 |
| **metrics** | jsonb | ❌ | 指标数据 |
| **attachments** | jsonb | ❌ | 附件列表 |
| **completed_at** | timestamp | ❌ | 完成时间 |
| **scenario_type** | text | ❌ | 场景类型 |
| **task_name** | text | ❌ | 任务名称 |
| **trigger_source** | text | ❌ | 触发方式 |
| **retry_status** | text | ❌ | 重试状态 |
| **metadata** | jsonb | ❌ | 额外元数据 |

### 执行状态流转

```
new（新建）
  ↓ 执行主体接收到指令
in_progress（执行中）
  ↓
completed（执行完成）
  ↓ Agent A审核
feedback_completed（反馈完成）
  ↓
  或
helping_tech_expert（向技术专家求助）
  ↓
helping_president（向总裁求助）
  ↓
  或
failed（执行失败）
```

---

## 表三：agent_notifications（通知表）

存储 Agent 间通信的所有通知。

### 核心字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| **notification_id** | text | ✅ | 通知ID |
| **from_agent_id** | text | ✅ | 发送方Agent ID |
| **to_agent_id** | text | ✅ | 接收方Agent ID |
| **notification_type** | text | ✅ | 通知类型 | `command` / `result` / `feedback` / `system` |
| **title** | text | ✅ | 通知标题 |
| **content** | text | ✅ | 通知内容（JSON格式字符串） |
| **related_task_id** | text | ❌ | 关联任务ID |
| **status** | text | ✅ | 状态 | `unread` / `read` / `processed` |
| **priority** | text | ✅ | 优先级 | `low` / `normal` / `high` / `urgent` |
| **metadata** | jsonb | ❌ | 额外元数据 |
| **is_read** | boolean | ✅ | 是否已读 |
| **read_at** | timestamp | ❌ | 读取时间 |

---

## Agent B 任务拆解指南

### 步骤 1：理解任务

从 `agent_tasks` 表中读取任务信息：
- 读取 `task_name`（任务名称）
- 读取 `core_command`（核心指令）
- 读取 `command`（原始完整指令）
- 读取 `executor`（执行主体）

### 步骤 2：识别子任务

从原始指令中识别并列出所有子任务，每个子任务应包含：
1. 具体动作
2. 执行要求（时间、数量等）
3. 交付物

### 步骤 3：为每个子任务提取结构化信息

根据本文档的表结构，为每个子任务填充以下字段：

#### 必填字段

- **command_id**: 格式为 `cmd-${task_id}-${index}`（从1开始）
- **related_task_id**: 关联的 `task_id`
- **command_content**: 去除时间、优先级等元信息后的指令内容
- **executor**: 执行主体（继承自主任务）
- **command_priority**: 根据指令重要性判断
  - 包含"≥"、"重点"、"必须"、"立即"等关键词 → `urgent`
  - 包含"如有可能"、"可选"、"建议"等关键词 → `normal`
  - 其他 → `normal`
- **execution_deadline_start**: 当前时间
- **execution_deadline_end**: 从指令中提取的截止时间
  - "周三12:00" → 下一个周三12:00
  - "周五18:00" → 下一个周五18:00
  - "周日24:00" → 下一个周日24:00
- **deliverables**: 提取《标题》格式的交付物描述
- **from_agent_id**: 继承自主任务的 `executor`
- **to_agent_id**: 继承自主任务的 `creator`
- **original_command**: 完整的子任务指令内容
- **splitter**: `agent B`
- **entry_user**: `TS`

### 步骤 4：插入数据

将所有子任务插入到 `command_results` 表中。

### 步骤 5：更新主任务状态

将 `agent_tasks` 表中的 `task_status` 更新为 `split_completed`。

---

## 示例

### 输入任务

```json
{
  "task_id": "task-A-to-insurance-c-1770660000000",
  "task_name": "公众号本周基础运营任务",
  "core_command": "完成公众号本周基础运营动作，提升粉丝活跃度与留存率",
  "command": "1. 用户运营：全量回复本周公众号粉丝留言，24小时响应率≥90%，重点聚焦保险配置逻辑、产品投保条件类问题，形成《本周粉丝核心需求汇总表》，周五18:00前提交至我...",
  "executor": "insurance-c",
  "creator": "A"
}
```

### 输出子任务 1

```json
{
  "command_id": "cmd-task-A-to-insurance-c-1770660000000-1",
  "related_task_id": "task-A-to-insurance-c-1770660000000",
  "command_content": "全量回复本周公众号粉丝留言，重点聚焦保险配置逻辑、产品投保条件类问题",
  "executor": "insurance-c",
  "command_priority": "urgent",
  "execution_deadline_start": "2026-02-10 09:00:00",
  "execution_deadline_end": "2026-02-14 18:00:00",
  "deliverables": "本周粉丝核心需求汇总表",
  "from_agent_id": "insurance-c",
  "to_agent_id": "A",
  "original_command": "用户运营：全量回复本周公众号粉丝留言，24小时响应率≥90%，重点聚焦保险配置逻辑、产品投保条件类问题，形成《本周粉丝核心需求汇总表》，周五18:00前提交至我",
  "splitter": "agent B",
  "entry_user": "TS"
}
```

---

## 注意事项

1. **时间处理**: 所有时间应转换为 ISO 8601 格式
2. **优先级判断**: 根据关键词自动判断，不要主观推断
3. **交付物提取**: 优先提取《标题》格式的描述，如果没有则从指令中总结
4. **字段完整性**: 确保所有必填字段都有值
5. **ID生成**: `command_id` 应保持唯一性，格式为 `cmd-${task_id}-${index}`

---

## 版本信息

- 文档版本: v1.0
- 最后更新: 2026-02-10
- 维护者: TS（任务调度器）
