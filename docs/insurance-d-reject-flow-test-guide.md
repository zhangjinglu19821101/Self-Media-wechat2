# Agent A 请 insurance-d 拆解任务 - 拒绝流程测试指南

## 流程概述

Agent A 下发指令给 insurance-d 的完整流程包括两个弹框确认环节。

---

## 完整流程说明

### 第一步：Agent A 下发指令

1. 在 Agent A 的对话界面中输入指令，下发给 insurance-d
2. 系统检测到需要拆解的任务
3. 显示**第一次弹框**（拆解确认对话框）

---

### 第二步：第一次弹框（拆解确认对话框）

**显示内容：**
```
是否让任务拆解为日任务？

检测到指令中有向以下 Agent 下达的任务：
  - insurance-d（内容岗）

🤖 拆解执行者：insurance-d
📊 目标表：daily_tasks
ℹ️ 后续流程：insurance-d 可进一步拆解为 agent_sub_tasks

建议：让 insurance-d 将任务拆解为可执行的每日子任务，便于跟踪和管理。

[取消] [不拆解，直接发送] [确认拆解]
```

**关键问题：此时 daily_task 表中有数据吗？**
- ❌ **没有数据**
- daily_task 表是空的
- 这个弹框只是询问用户"是否允许拆解"
- 还没有执行实际的拆解操作

---

### 第三步：用户点击"确认拆解"

**后续流程：**

1. **关闭第一次弹框**
   - `setShowSplitDialog(false)`

2. **创建拆解任务记录到 agent_tasks 表**
   ```sql
   INSERT INTO agent_tasks (
     task_id,
     task_name,
     core_command,
     executor,
     from_agent_id,
     to_agent_id,
     task_status,        -- 'splitting'（拆解中）
     split_status,      -- 'splitting'（拆解中）
     ...
   ) VALUES (
     'task-A-to-insurance-d-1770953513980-rph',
     '任务拆解：...',
     '【任务拆解指令】...',
     'B',               -- Agent B 是拆解执行者
     'A',
     'agent B',
     'splitting',
     'splitting',
     ...
   )
   ```

3. **向 Agent B 发送拆解指令**
   - Agent B 接收拆解任务
   - Agent B 调用 LLM 进行任务拆解
   - Agent B 返回拆解结果（JSON 格式）

4. **等待 Agent B 完成拆解**
   - 前端等待 Agent B 返回结果
   - 更新 agent_tasks 表的状态为 `split` + `completed`

5. **显示第二次弹框**（拆解结果确认对话框）

**此时 daily_task 表中还是没有数据！**

---

### 第四步：第二次弹框（拆解结果确认对话框）

**显示内容：**
```
✅ 确认拆解方案

[insurance-d] 已完成任务拆解，请确认是否接受此方案
📊 确认后，拆解结果将保存到 daily_tasks 表（insurance-d 可进一步拆解为 agent_sub_tasks）

┌─ 拆解结果总览 ────────────────────┐
│ 总交付物：7                      │
│ 时间周期：7天                    │
│ 摘要：将保险科普内容创作任务...  │
└────────────────────────────────────┘

┌─ 拆解后的任务列表 (7 个子任务) ────┐
│ 第1天：三口之家保险配置逻辑...    │
│ 第2天：中老年医疗险避坑指南...    │
│ 第3天：小额理赔真实案例解析...    │
│ ...                             │
└────────────────────────────────────┘

[拒绝并重新拆解] [确认并接受]
```

**此时 daily_task 表中还是没有数据！**

---

### 第五步：用户选择操作

#### ✅ 场景 A：用户点击"确认并接受"

**后续流程：**

1. **保存拆解结果到 daily_task 表** ✅
   ```sql
   INSERT INTO daily_task (
     task_id,                    -- 'daily-task-insurance-d-2026-02-13-001'
     related_task_id,            -- 'task-A-to-insurance-d-1770953513980-rph'
     task_title,
     task_description,
     executor,                   -- 'insurance-d'
     execution_status,           -- 'new'
     is_confirmed,               -- false
     splitter,                   -- 'insurance-d'
     ...
   ) VALUES (...)
   ```

2. **更新 agent_tasks 表状态**
   ```sql
   UPDATE agent_tasks
   SET task_status = 'split',
       split_status = 'completed'
   WHERE task_id = 'task-A-to-insurance-d-1770953513980-rph'
   ```

3. **关闭弹框**
   - `setShowSplitResultConfirm(false)`

4. **显示成功提示**
   - Toast 消息："拆解结果已保存到 daily_tasks 表"

#### ❌ 场景 B：用户点击"拒绝并重新拆解"（测试重点）

**后续流程：**

1. **显示拒绝原因输入对话框**
   ```
   ⚠️ 请输入拒绝原因

   [输入框：请说明为什么拒绝这个拆解方案...]

   [取消] [提交拒绝原因]
   ```

2. **用户输入拒绝原因**
   - 例如："拆解不够详细，需要更具体的执行步骤"

3. **用户点击"提交拒绝原因"**

4. **更新 agent_tasks 表的 metadata（拒绝历史）**
   ```sql
   UPDATE agent_tasks
   SET metadata = metadata || jsonb_build_object(
     'rejectionHistory', jsonb_build_array(
       jsonb_build_object(
         'timestamp', '2026-02-13T12:00:00Z',
         'rejectedBy', 'A',
         'reason', '拆解不够详细，需要更具体的执行步骤',
         'deletedDailyTasksCount', 7
       )
     )
   )
   WHERE task_id = 'task-A-to-insurance-d-1770953513980-rph'
   ```

5. **删除已有的 daily_task 记录**
   ```sql
   DELETE FROM daily_task
   WHERE related_task_id = 'task-A-to-insurance-d-1770953513980-rph'
   ```

6. **通知 Agent B 重新拆解**
   - 发送通知给 Agent B
   - 包含拒绝原因
   - Agent B 根据反馈重新拆解

7. **更新 agent_tasks 表状态**
   ```sql
   UPDATE agent_tasks
   SET task_status = 'unsplit',
       split_status = 'pending_split'
   WHERE task_id = 'task-A-to-insurance-d-1770953513980-rph'
   ```

8. **Agent B 重新拆解**
   - Agent B 调用 LLM 重新拆解
   - 返回新的拆解结果

9. **重新显示第二次弹框**
   - 显示新的拆解结果
   - 用户再次选择"确认并接受"或"拒绝并重新拆解"

---

## 测试步骤

### 测试准备

1. 打开 Agent A 的对话界面
2. 输入一个需要拆解的任务指令
3. 确认指令中包含 insurance-d 的任务

### 测试步骤

#### 步骤 1：触发拆解流程

1. 在 Agent A 对话中输入指令：
   ```
   请 insurance-d 在 7 天内完成 4 篇保险科普文章创作
   ```

2. 点击发送

3. 系统自动检测并显示**第一次弹框**

#### 步骤 2：查看第一次弹框

1. 确认弹框内容：
   - 拆解执行者：insurance-d
   - 目标表：daily_tasks
   - 后续流程：insurance-d 可进一步拆解为 agent_sub_tasks

2. **验证**：查询 daily_task 表
   ```bash
   node scripts/query-db.js --table insurance-d --task-id [任务ID]
   ```
   - 预期结果：**0 条记录**（还没数据）

#### 步骤 3：点击"确认拆解"

1. 点击"确认拆解"按钮

2. **验证**：查询 agent_tasks 表
   ```bash
   node scripts/query-task-info.js
   ```
   - 预期结果：
     - 任务状态：`splitting`
     - 拆分状态：`splitting`

3. **验证**：查询 daily_task 表
   - 预期结果：**0 条记录**（还没数据）

4. 等待 Agent B 完成拆解（约 3-5 秒）

#### 步骤 4：查看第二次弹框

1. 系统显示**第二次弹框**（拆解结果确认对话框）

2. 查看拆解结果：
   - 总交付物：7
   - 时间周期：7天
   - 拆解后的任务列表（7 条）

3. **验证**：查询 daily_task 表
   ```bash
   node scripts/query-db.js --table insurance-d --task-id [任务ID]
   ```
   - 预期结果：**0 条记录**（还没数据）

#### 步骤 5：测试拒绝流程（重点）

1. 点击"拒绝并重新拆解"按钮

2. 系统显示拒绝原因输入对话框

3. 输入拒绝原因：
   ```
   拆解不够详细，需要更具体的执行步骤
   ```

4. 点击"提交拒绝原因"

5. **验证**：查询 agent_tasks 表
   ```bash
   node scripts/query-task-metadata.js
   ```
   - 预期结果：
     - Metadata 中包含 `rejectionHistory`
     - 记录拒绝时间、拒绝者、拒绝原因
     - `deletedDailyTasksCount`: 7（即使实际删除了 0 条，也应该记录）

6. **验证**：查询 daily_task 表
   ```bash
   node scripts/query-db.js --table insurance-d --task-id [任务ID]
   ```
   - 预期结果：**0 条记录**（删除成功）

7. 等待 Agent B 重新拆解（约 3-5 秒）

8. 系统重新显示**第二次弹框**

9. 点击"确认并接受"

10. **验证**：查询 daily_task 表
    ```bash
    node scripts/query-db.js --table insurance-d --task-id [任务ID]
    ```
    - 预期结果：**7 条记录**（保存成功）

---

## 验证方法

### 方法 1：使用数据库查询脚本

```bash
# 查询任务信息
node scripts/query-task-info.js

# 查询任务元数据（包含拒绝历史）
node scripts/query-task-metadata.js

# 查询 daily_task 表
node scripts/query-db.js --table insurance-d --task-id [任务ID]
```

### 方法 2：直接查看数据库表

```sql
-- 查询 agent_tasks 表
SELECT task_id, task_status, split_status, metadata
FROM agent_tasks
WHERE task_id = 'task-A-to-insurance-d-1770953513980-rph';

-- 查询 daily_task 表
SELECT task_id, related_task_id, task_title, executor
FROM daily_task
WHERE related_task_id = 'task-A-to-insurance-d-1770953513980-rph';
```

---

## 关键结论

### Q: 第一次弹框时，daily_task 表中有数据吗？

**A: ❌ 没有**
- 第一次弹框只是询问用户"是否允许拆解"
- 还没有执行实际的拆解操作
- daily_task 表是空的

### Q: 点击"确认拆解"后，后续流程是怎样的？

**A: 分为两个阶段：**

**阶段 1：请求拆解（第一次点击）**
1. 关闭第一次弹框
2. 创建任务记录到 agent_tasks 表（状态：splitting）
3. 向 Agent B 发送拆解指令
4. Agent B 调用 LLM 进行拆解
5. Agent B 返回拆解结果
6. 显示第二次弹框

**阶段 2：保存拆解结果（第二次点击）**
- 用户点击"确认并接受"
- **保存拆解结果到 daily_task 表**
- 更新 agent_tasks 表状态为 split/completed

**或者**
- 用户点击"拒绝并重新拆解"
- **删除 daily_task 表记录**
- 更新拒绝历史到 agent_tasks.metadata
- 通知 Agent B 重新拆解

---

## 数据表关系总结

```
agent_tasks（主任务）
  ├─ task_status: 'unsplit' → 'splitting' → 'split'
  ├─ split_status: 'pending_split' → 'splitting' → 'completed'
  └─ metadata.rejectionHistory: []（拒绝历史）

daily_task（每日任务）
  ├─ related_task_id → agent_tasks.task_id
  ├─ executor: 'insurance-d'
  ├─ is_confirmed: false
  └─ execution_status: 'new'

agent_sub_tasks（子任务）
  ├─ command_result_id → daily_task.id
  ├─ agent_id: 'insurance-d' | 'insurance-b' | 'insurance-c'
  └─ status: 'pending' | 'in_progress' | 'completed'
```

---

## 注意事项

1. **第一次弹框只是确认**，不涉及数据操作
2. **第二次弹框才是真正的数据保存点**
3. **拒绝流程会删除已有的 daily_task 记录**
4. **拒绝历史保存在 agent_tasks.metadata.rejectionHistory**
5. **每次拒绝都会追加一条拒绝历史记录**
