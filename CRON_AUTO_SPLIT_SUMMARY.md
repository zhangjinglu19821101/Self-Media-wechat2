# 定时任务自动拆解方案总结

## 📋 概述

本方案实现了定时扫描 `agent_tasks` 表，自动触发任务拆解的功能。系统每 5 分钟扫描一次 `agent_tasks` 表，将 `status` 为 `pending_split` 的任务自动进行拆解。

---

## 🎯 核心功能

### 1. 定时扫描 `agent_tasks` 表
- **扫描频率**：每 5 分钟
- **扫描条件**：`status = 'pending_split'` 且 `toAgentId` 与 `executor` 不匹配
- **扫描数量限制**：每次最多处理 10 个任务

### 2. 自动触发任务拆解
- 调用 `/api/split-task` API 接口进行任务拆解
- 支持 Agent B 指令拆解
- 自动更新任务状态为 `split`

### 3. 错误处理与重试
- 单个任务失败不影响其他任务
- 错误任务记录在结果中，便于追踪
- 任务保持 `pending_split` 状态，等待下次重试

---

## 📁 核心文件

### 1. API 路由
- **`/api/cron/auto-split-agent-tasks`**：定时任务执行接口
  - `GET`：查询待拆解任务数量
  - `POST`：执行自动拆解

### 2. 调度器
- **`/src/lib/cron/scheduler.ts`**：定时任务调度器
  - 管理定时任务的生命周期
  - 支持启动、停止、查询状态

### 3. 启动/停止接口
- **`/api/cron/start`**：启动定时任务
  - `POST /api/cron/start?cronJobId=auto-split-agent-tasks`：启动指定定时任务

### 4. 测试接口
- **`/api/test/trigger-auto-split`**：手动触发定时任务
  - `POST`：手动触发自动拆解
  - `GET`：查询待拆解任务状态

---

## 🔧 实现细节

### 定时任务配置
```typescript
const CRON_CONFIG = {
  cronExpression: '*/5 * * * *', // 每 5 分钟执行一次
  timezone: 'Asia/Shanghai', // 使用中国时区
};
```

### 扫描逻辑
```typescript
const pendingTasks = await db
  .select()
  .from(agentTasks)
  .where(
    and(
      eq(agentTasks.status, 'pending_split'), // 只扫描 pending_split 状态的任务
      sql`${agentTasks.toAgentId} != ${agentTasks.executor}` // toAgentId 与 executor 不匹配
    )
  )
  .limit(10); // 每次最多处理 10 个任务
```

### 任务拆解调用
```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000'}/api/split-task`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskId: task.taskId,
    toAgentId: task.toAgentId,
    taskName: task.taskName,
    taskPriority: task.taskPriority,
  }),
});
```

---

## 🧪 测试结果

### 测试环境
- **数据库**：PostgreSQL + Drizzle ORM
- **框架**：Next.js 16 (App Router)
- **测试数据**：6 个待拆解任务（5 个 Agent B 指令 + 1 个 insurance-d 指令）

### 测试过程
1. **首次触发**：
   - 处理了 5 个任务
   - 跳过 1 个任务（insurance-d 相关）
   - 0 个失败

2. **再次触发**：
   - 处理了 0 个任务（所有任务已处理）
   - 跳过 1 个任务（insurance-d 相关）
   - 0 个失败

### 测试结论
✅ 定时任务运行正常，能够正确识别待拆解任务并执行拆解操作。
✅ 错误处理机制正常，跳过了不匹配的任务。
✅ 任务状态更新正确。

---

## 📊 任务状态流转

```
Agent A 指令入库
    ↓
status = 'pending_split'
    ↓
定时任务扫描
    ↓
[匹配检查]
    ↓
[toAgentId === 'agent B' ?]
    ↓ Yes
调用 /api/split-task
    ↓
status = 'split'
    ↓ No
跳过任务
    ↓
保持 status = 'pending_split'
```

---

## 🚀 启动定时任务

### 方式一：手动触发
```bash
curl -X POST http://localhost:5000/api/test/trigger-auto-split
```

### 方式二：启动定时任务
```bash
curl -X POST "http://localhost:5000/api/cron/start?cronJobId=auto-split-agent-tasks"
```

### 方式三：查询待拆解任务
```bash
curl http://localhost:5000/api/cron/auto-split-agent-tasks
```

---

## 📝 注意事项

1. **安全性**：
   - 定时任务 API 添加了 CORS 允许所有来源（生产环境应限制）
   - 建议添加 API 认证机制

2. **性能优化**：
   - 每次扫描限制最多处理 10 个任务，避免一次性处理过多任务
   - 5 分钟的间隔可以根据实际需求调整

3. **错误处理**：
   - 单个任务失败不影响其他任务
   - 错误任务保持 `pending_split` 状态，等待下次重试

4. **监控建议**：
   - 记录定时任务执行日志
   - 统计任务拆解成功率
   - 配置错误告警

---

## 🔮 后续优化

1. **智能调度**：根据任务优先级调整扫描频率
2. **批量处理**：支持批量调用拆解接口，减少 HTTP 请求
3. **任务优先级**：优先处理高优先级任务
4. **任务追踪**：记录任务拆解历史，便于回溯
5. **自动回滚**：拆解失败时自动回滚任务状态

---

## 📚 相关文档

- [Agent A 指令入库流程分析](./AGENT_TASK_CREATION_FLOW.md)
- [数据库表结构文档](./SCHEMA_GUIDE.md)
- [任务拆解 API 文档](./API_GUIDE.md)

---

## 📞 维护联系人

如有问题，请联系开发团队。
