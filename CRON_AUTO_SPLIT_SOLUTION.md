# 定时任务方案：扫描 agent_tasks 表

## 📋 方案概述

**目标**: 自动扫描 `agent_tasks` 表，识别待拆解的任务，触发对应的 Agent 拆解接口

**核心问题**:
- 任务创建后，`splitStatus='pending_split'`
- 没有定时任务扫描并触发拆解
- 导致任务一直停留在待拆解状态

---

## 🎯 解决方案

### 1. 定时任务 API

**文件**: `src/app/api/cron/auto-split-agent-tasks/route.ts`

**功能**:
- ✅ 扫描 `splitStatus='pending_split'` 的任务
- ✅ 解析指令中的"执行主体"
- ✅ 调用对应的 Agent 拆解接口
- ✅ 更新任务状态
- ✅ 返回处理结果

**接口**:
```typescript
// 执行定时任务
POST /api/cron/auto-split-agent-tasks

// 查询待拆解任务
GET  /api/cron/auto-split-agent-tasks
```

---

### 2. 执行逻辑

```typescript
Step 1: 扫描 agent_tasks 表
  SELECT * FROM agent_tasks
  WHERE splitStatus = 'pending_split'

Step 2: 遍历每个任务
  ┌─ 提取指令中的"执行主体"
  │   正则：/\*\*执行主体[：:]\s*「([^\"]+)」/
  │
  ├─ 判断拆解方式
  │   if 执行主体 == 'insurance-d':
  │     由 insurance-d 自己拆解
  │   else:
  │     由 Agent B 拆解
  │
  └─ 调用拆解接口
      POST /api/agents/tasks/[taskId]/split

Step 3: 更新任务状态
  splitStatus: 'pending_split' → 'split_pending_review'
```

---

### 3. 调度方式

#### 方案 A: 使用 node-cron（推荐）

**优点**:
- ✅ 简单直接，易于维护
- ✅ 支持复杂的时间表达式
- ✅ 项目中已经使用

**实现**:
```typescript
// src/lib/cron/scheduler.ts
import cron from 'node-cron';

export function startCronJobs() {
  // 每 5 分钟执行一次
  cron.schedule('*/5 * * * *', async () => {
    try {
      await fetch('http://localhost:5000/api/cron/auto-split-agent-tasks', {
        method: 'POST',
      });
      console.log('✅ 定时任务执行成功');
    } catch (error) {
      console.error('❌ 定时任务执行失败:', error);
    }
  });

  console.log('🕐 定时任务已启动');
}
```

**启动位置**:
```typescript
// src/app/layout.tsx 或 src/app/api/start-cron/route.ts
import { startCronJobs } from '@/lib/cron/scheduler';

// 在应用启动时调用
startCronJobs();
```

---

#### 方案 B: 使用外部 Cron 服务（如 GitHub Actions）

**优点**:
- ✅ 不占用服务器资源
- ✅ 支持分布式部署
- ✅ 可以查看执行日志

**实现**:
```yaml
# .github/workflows/auto-split-agent-tasks.yml
name: Auto Split Agent Tasks

on:
  schedule:
    - cron: '*/5 * * * *'  # 每 5 分钟

jobs:
  auto-split:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cron Job
        run: |
          curl -X POST \
            "https://your-domain.com/api/cron/auto-split-agent-tasks"
```

---

#### 方案 C: 使用 Vercel Cron（如果部署在 Vercel）

**优点**:
- ✅ 完全托管
- ✅ 自动重试
- ✅ 无需额外配置

**实现**:
```typescript
// vercel.json
{
  "crons": [{
    "path": "/api/cron/auto-split-agent-tasks",
    "schedule": "*/5 * * * *"
  }]
}
```

---

### 4. 执行流程图

```
┌─────────────────────────────────────────────────────┐
│           定时任务触发（每5分钟）                      │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│         扫描 agent_tasks 表                          │
│  WHERE splitStatus = 'pending_split'                │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│         遍历每个待拆解任务                            │
└─────────────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │任务1   │ │任务2   │ │任务3   │
   │insurance-d│ │insurance-c│ │  B     │
   └─────────┘ └─────────┘ └─────────┘
        │           │           │
        │           │           │
        ▼           ▼           ▼
   解析指令     解析指令     解析指令
        │           │           │
        │           │           │
        ▼           ▼           ▼
   调用拆解接口 调用拆解接口 调用拆解接口
        │           │           │
        │           │           │
        ▼           ▼           ▼
   更新状态     更新状态     更新状态
        │           │           │
        └───────────┼───────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│              返回处理结果                              │
│  { processedCount: 3, errorCount: 0 }               │
└─────────────────────────────────────────────────────┘
```

---

### 5. 执行主体判断逻辑

```typescript
// 提取指令中的"执行主体"
const coreCommand = task.coreCommand || '';
const executorMatch = coreCommand.match(/\*\*执行主体[：:]\s*「([^\"]+)」/);
const actualExecutor = executorMatch ? executorMatch[1] : task.toAgentId;

// 判断拆解方式
if (actualExecutor === 'insurance-d') {
  // insurance-d 自己拆解
  // POST /api/agents/insurance-d/split-task
} else if (actualExecutor === 'insurance-c') {
  // insurance-c 自己拆解
  // POST /api/agents/insurance-c/split-task
} else {
  // 其他任务由 Agent B 拆解
  // POST /api/agents/tasks/[taskId]/split
}
```

---

### 6. 错误处理

```typescript
// 单个任务失败不影响其他任务
for (const task of tasks) {
  try {
    await splitTask(task);
  } catch (error) {
    console.error(`处理任务 ${task.taskId} 失败:`, error);
    // 记录错误，继续处理下一个任务
    errorCount++;
  }
}

// 返回详细的错误信息
return {
  success: true,
  processedCount: 3,
  errorCount: 1,
  errors: [
    { taskId: 'task-xxx', error: 'xxx' }
  ]
}
```

---

### 7. 监控与日志

```typescript
console.log('🕐 [auto-split-agent-tasks] 开始扫描...');
console.log(`📋 找到 ${tasks.length} 个待拆解任务`);
console.log(`✅ 处理 ${processedCount} 个，跳过 ${skippedCount} 个，失败 ${errorCount} 个`);
```

**日志输出**:
```
🕐 [auto-split-agent-tasks] 开始扫描 agent_tasks 表...
📋 找到 2 个待拆解任务

📦 处理任务 task-A-to-B-xxx-nhf
  🎯 指令中的执行主体: insurance-d
  📋 任务中的 toAgentId: agent B
  ✅ 拆解成功: task-A-to-B-xxx-nhf

📦 处理任务 task-A-to-B-xxx-abc
  🎯 指令中的执行主体: insurance-c
  📋 任务中的 toAgentId: agent B
  ⏭️  跳过：执行主体 insurance-c 与 toAgentId agent B 不一致

✅ 定时任务完成: 处理 1 个，跳过 1 个，失败 0 个
```

---

### 8. 测试接口

```bash
# 手动触发定时任务
curl -X POST http://localhost:5000/api/cron/auto-split-agent-tasks

# 查询待拆解任务
curl http://localhost:5000/api/cron/auto-split-agent-tasks

# 验证拆解状态
curl http://localhost:5000/api/test/check-split-status
```

---

### 9. 配置文件

**环境变量** (`.env`):
```env
# 定时任务配置
CRON_AUTO_SPLIT_ENABLED=true
CRON_AUTO_SPLIT_INTERVAL=5  # 分钟
```

---

### 10. 部署检查清单

- [x] 创建定时任务 API
- [ ] 配置 node-cron 调度器
- [ ] 添加启动脚本
- [ ] 配置日志输出
- [ ] 测试定时任务执行
- [ ] 监控任务执行情况
- [ ] 配置错误告警

---

## 🎯 总结

### 核心优势

1. **自动化**: 无需手动触发，定时自动扫描
2. **智能判断**: 自动识别执行主体，调用对应的拆解接口
3. **容错机制**: 单个任务失败不影响其他任务
4. **可监控**: 详细的日志和结果返回

### 实现步骤

1. ✅ 创建定时任务 API (`auto-split-agent-tasks/route.ts`)
2. ⏳ 配置调度器 (node-cron)
3. ⏳ 添加启动脚本
4. ⏳ 测试执行
5. ⏳ 监控与告警

### 下一步行动

1. 实现调度器配置
2. 添加启动脚本
3. 部署到生产环境
4. 配置监控告警
