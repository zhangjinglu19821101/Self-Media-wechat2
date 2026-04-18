## 今天的问题分析

### 用户的正确逻辑
- **属于 insurance-d 的任务** → 下发给 insurance-d，由 insurance-d 拆解
- **不属于 insurance-d 的任务** → Agent B 自己拆解

### 今天实际发生的事情

#### 1. 任务创建阶段（问题根源）
```
任务创建时：
  toAgentId = 'agent B'  ❌ 错误！
  executor = 'agent B'   ❌ 错误！

但指令中明确写着：
  执行主体：「insurance-d」
```

**问题**：任务创建时，`toAgentId` 应该设置为 `insurance-d`，但实际设置为 `agent B`

#### 2. 任务入库后
```
agent_tasks 表：
  taskId: task-A-to-B-xxx-nhf
  executor: 'B'              ❌ 错误！应该是 'insurance-d'
  toAgentId: 'agent B'       ❌ 错误！应该是 'insurance-d'
  splitStatus: 'pending_split'
  coreCommand: "执行主体：「insurance-d」..."  ✅ 正确
```

#### 3. 没有定时任务触发
```
现状：
  ❌ 没有定时任务扫描 agent_tasks 表
  ❌ 没有自动拆解机制
  ⏸️ 任务一直处于 pending_split 状态
```

**原因**：
- 系统只有扫描 `commandResults` 表的定时任务
- **没有扫描 `agent_tasks` 表并触发拆解的定时任务**

#### 4. 我手动触发拆解
```
我执行的步骤：
  1. 发现任务没有自动拆解
  2. 手动调用：POST /api/agents/tasks/[taskId]/split
  3. 拆解接口检查 executor='B'
  4. 调用 Agent B 的拆解逻辑
  5. Agent B 生成 3 个子任务
```

**结果**：
- ✅ 拆解完成了
- ❌ **但拆解错误的！应该由 insurance-d 拆解**

---

### 问题总结

| 环节 | 应该怎么做 | 实际怎么做的 | 问题 |
|------|----------|-------------|------|
| **任务创建** | toAgentId='insurance-d'<br>executor='insurance-d' | toAgentId='agent B'<br>executor='agent B' | ❌ 参数错误 |
| **自动触发** | 定时任务扫描 agent_tasks 表 | 没有定时任务 | ❌ 缺少机制 |
| **拆解逻辑** | 根据指令中的执行主体决定谁拆解 | 根据 executor 字段决定 | ❌ 逻辑错误 |
| **实际执行** | insurance-d 拆解任务 | Agent B 拆解任务 | ❌ 执行主体错误 |

---

### 为什么没有定时任务？

**当前系统架构**：
1. ✅ 有定时任务扫描 `commandResults` 表（`/api/cron/check-pending-tasks`）
2. ❌ **没有定时任务扫描 `agent_tasks` 表**
3. ❌ 没有任务创建后自动触发拆解的机制

**需要添加**：
```typescript
// 新增定时任务：扫描 agent_tasks 表并触发拆解
POST /api/cron/auto-split-tasks

逻辑：
1. 扫描 agent_tasks 表
2. 找到 splitStatus='pending_split' 的任务
3. 提取指令中的"执行主体"
4. 调用对应 Agent 的拆解接口
```

---

### 正确的流程应该是

```
Step 1: Agent A 创建任务
  ├─ 解析指令，提取"执行主体：「insurance-d」"
  ├─ 设置 toAgentId = 'insurance-d'
  ├─ 设置 executor = 'insurance-d'
  └─ 任务入库

Step 2: 自动触发拆解（定时任务或自动触发）
  ├─ 扫描 agent_tasks 表
  ├─ 找到 executor='insurance-d' 的任务
  ├─ 调用 insurance-d 的拆解接口
  └─ insurance-d 生成拆解方案

Step 3: Agent A 确认拆解
  └─ 生成 command_results 记录
```

---

### 今天的问题本质

1. **任务创建时参数错误**：
   - 应该：toAgentId = 'insurance-d'
   - 实际：toAgentId = 'agent B'

2. **缺少自动触发机制**：
   - 应该：定时任务扫描 agent_tasks 表
   - 实际：没有定时任务

3. **拆解逻辑不正确**：
   - 应该：根据指令中的"执行主体"决定谁拆解
   - 实际：根据 executor 字段决定

---

### 需要修复的地方

1. **修复任务创建逻辑**
   - 解析指令中的"执行主体"
   - 正确设置 toAgentId 和 executor

2. **添加自动触发机制**
   - 新增定时任务扫描 agent_tasks 表
   - 或者在任务创建后立即触发拆解

3. **优化拆解接口**
   - 根据指令内容判断实际执行主体
   - 而不是只依赖 executor 字段
