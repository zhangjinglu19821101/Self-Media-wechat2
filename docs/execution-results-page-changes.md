# 执行结果页面改动方案

## 概述

根据业务联动设计（`agentReports` 与 `commandResults` 联动），Agent A 的对话框中的**执行结果页面**需要进行以下改动。

---

## 现有功能

### 当前统计字段（来自 `commandResultService.getStats`）

| 字段 | 说明 | 数据来源 |
|------|------|---------|
| `total` | 总计 | `count(*)` |
| `pending` | 待处理 | `count(*) filter (where execution_status = 'pending')` |
| `inProgress` | 进行中 | `count(*) filter (where execution_status = 'in_progress')` |
| `completed` | 已完成 | `count(*) filter (where execution_status = 'completed')` |
| `failed` | 失败 | `count(*) filter (where execution_status = 'failed')` |
| `blocked` | 阻塞 | `count(*) filter (where execution_status = 'blocked')` |

---

## 需要新增的功能

### 1. 新增统计字段

#### 1.1 介入相关统计

| 字段 | 说明 | 数据来源 |
|------|------|---------|
| `requiresIntervention` | 需要 Agent A 介入的任务数 | `count(*) filter (where requires_intervention = true)` |
| `reportCount` | 上报的总次数 | `sum(report_count)` |
| `latestReportId` | 最新报告的 ID（可选） | `max(latest_report_id)` |

#### 1.2 上报报告统计

| 字段 | 说明 | 数据来源 |
|------|------|---------|
| `pendingReports` | 待处理报告数 | `count(*) filter (where agent_reports.status = 'pending')` |
| `reviewedReports` | 已审核报告数 | `count(*) filter (where agent_reports.status = 'reviewed')` |
| `processingReports` | 处理中报告数 | `count(*) filter (where agent_reports.status = 'processing')` |
| `processedReports` | 已处理报告数 | `count(*) filter (where agent_reports.status = 'processed')` |
| `dismissedReports` | 已驳回报告数 | `count(*) filter (where agent_reports.status = 'dismissed')` |

#### 1.3 超时相关统计

| 字段 | 说明 | 数据来源 |
|------|------|---------|
| `timeoutSubtasks` | 超时子任务数（>30分钟未更新） | 计数逻辑 |
| `longRunningTasks` | 超长任务数（>1天未完成） | 计数逻辑 |

---

## 实现方案

### 方案 1：扩展现有 API（推荐）

#### 修改 `getStats` 方法

```typescript
// src/lib/services/command-result-service.ts

async getStats(params?: { toAgentId?: string; startDate?: Date; endDate?: Date }) {
  const db = getDatabase();

  // === 现有统计（执行结果） ===
  let query = db
    .select({
      // 现有字段
      total: sql<number>`count(*)`,
      pending: sql<number>`count(*) filter (where execution_status = 'pending')`,
      inProgress: sql<number>`count(*) filter (where execution_status = 'in_progress')`,
      completed: sql<number>`count(*) filter (where execution_status = 'completed')`,
      failed: sql<number>`count(*) filter (where execution_status = 'failed')`,
      blocked: sql<number>`count(*) filter (where execution_status = 'blocked')`,

      // === 新增：介入相关统计 ===
      requiresIntervention: sql<number>`count(*) filter (where requires_intervention = true)`,
      reportCount: sql<number>`coalesce(sum(report_count), 0)`,
    })
    .from(schema.commandResults);

  // 添加过滤条件
  const conditions = [];

  if (params?.toAgentId) {
    conditions.push(eq(schema.commandResults.toAgentId, params.toAgentId));
  }

  if (params?.startDate) {
    conditions.push(gte(schema.commandResults.createdAt, params.startDate));
  }

  if (params?.endDate) {
    conditions.push(lte(schema.commandResults.createdAt, params.endDate));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const [resultStats] = await query;

  // === 新增：上报报告统计 ===
  let reportQuery = db
    .select({
      pendingReports: sql<number>`count(*) filter (where status = 'pending')`,
      reviewedReports: sql<number>`count(*) filter (where status = 'reviewed')`,
      processingReports: sql<number>`count(*) filter (where status = 'processing')`,
      processedReports: sql<number>`count(*) filter (where status = 'processed')`,
      dismissedReports: sql<number>`count(*) filter (where status = 'dismissed')`,
    })
    .from(schema.agentReports);

  // 添加过滤条件（如果需要关联到特定的 toAgentId）
  if (params?.toAgentId) {
    reportQuery = reportQuery
      .innerJoin(
        schema.commandResults,
        eq(schema.agentReports.commandResultId, schema.commandResults.id)
      )
      .where(eq(schema.commandResults.toAgentId, params.toAgentId));
  }

  const [reportStats] = await reportQuery;

  // === 新增：超时相关统计 ===
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  let timeoutQuery = db
    .select({
      timeoutSubtasks: sql<number>`
        count(distinct t.id)
      `,
      longRunningTasks: sql<number>`
        count(*) filter (where cr.execution_status = 'in_progress' and cr.created_at < ${oneDayAgo})
      `,
    })
    .from(schema.commandResults.as('cr'))
    .innerJoin(schema.agentSubTasks.as('t'), eq(schema.commandResults.id, schema.agentSubTasks.commandResultId));

  if (params?.toAgentId) {
    timeoutQuery = timeoutQuery.where(eq(schema.commandResults.toAgentId, params.toAgentId));
  }

  const [timeoutStats] = await timeoutQuery;

  return {
    // === 现有字段 ===
    total: Number(resultStats.total),
    pending: Number(resultStats.pending),
    inProgress: Number(resultStats.inProgress),
    completed: Number(resultStats.completed),
    failed: Number(resultStats.failed),
    blocked: Number(resultStats.blocked),

    // === 新增：介入相关统计 ===
    requiresIntervention: Number(resultStats.requiresIntervention),
    reportCount: Number(resultStats.reportCount),

    // === 新增：上报报告统计 ===
    pendingReports: Number(reportStats.pendingReports),
    reviewedReports: Number(reportStats.reviewedReports),
    processingReports: Number(reportStats.processingReports),
    processedReports: Number(reportStats.processedReports),
    dismissedReports: Number(reportStats.dismissedReports),

    // === 新增：超时相关统计 ===
    timeoutSubtasks: Number(timeoutStats.timeoutSubtasks),
    longRunningTasks: Number(timeoutStats.longRunningTasks),

    // === 保留 ===
    byAgent: {} as Record<string, number>,
  };
}
```

---

### 方案 2：新增独立的报告统计 API

#### 新增 `/api/reports/stats` 接口

```typescript
// src/app/api/reports/stats/route.ts

/**
 * GET /api/reports/stats
 * 获取上报报告统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const toAgentId = searchParams.get('toAgentId');
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    const db = getDatabase();

    let query = db
      .select({
        pendingReports: sql<number>`count(*) filter (where status = 'pending')`,
        reviewedReports: sql<number>`count(*) filter (where status = 'reviewed')`,
        processingReports: sql<number>`count(*) filter (where status = 'processing')`,
        processedReports: sql<number>`count(*) filter (where status = 'processed')`,
        dismissedReports: sql<number>`count(*) filter (where status = 'dismissed')`,
        totalReports: sql<number>`count(*)`,
      })
      .from(schema.agentReports);

    // 添加过滤条件
    const conditions = [];

    if (toAgentId) {
      // 通过 commandResults 关联到 toAgentId
      query = query
        .innerJoin(
          schema.commandResults,
          eq(schema.agentReports.commandResultId, schema.commandResults.id)
        );
      conditions.push(eq(schema.commandResults.toAgentId, toAgentId));
    }

    if (startDate) {
      conditions.push(gte(schema.agentReports.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(schema.agentReports.createdAt, endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const [stats] = await query;

    return NextResponse.json({
      success: true,
      data: {
        pendingReports: Number(stats.pendingReports),
        reviewedReports: Number(stats.reviewedReports),
        processingReports: Number(stats.processingReports),
        processedReports: Number(stats.processedReports),
        dismissedReports: Number(stats.dismissedReports),
        totalReports: Number(stats.totalReports),
      },
    });
  } catch (error) {
    console.error('获取报告统计信息失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取报告统计信息失败',
      },
      { status: 500 }
    );
  }
}
```

---

## 前端页面改动建议

### 建议的 UI 布局

```tsx
// Agent A 对话框 - 执行结果页面

<div className="stats-grid">
  {/* === 现有卡片：执行结果统计 === */}
  <StatCard title="总计" value={stats.total} icon="total" />
  <StatCard title="待处理" value={stats.pending} icon="pending" />
  <StatCard title="进行中" value={stats.inProgress} icon="in-progress" />
  <StatCard title="已完成" value={stats.completed} icon="completed" />
  <StatCard title="失败" value={stats.failed} icon="failed" />
  <StatCard title="阻塞" value={stats.blocked} icon="blocked" />

  {/* === 新增卡片：介入相关统计 === */}
  <StatCard
    title="需要介入"
    value={stats.requiresIntervention}
    icon="intervention"
    highlight={stats.requiresIntervention > 0}
  />
  <StatCard title="上报次数" value={stats.reportCount} icon="report-count" />

  {/* === 新增卡片：上报报告统计 === */}
  <StatCard
    title="待处理报告"
    value={stats.pendingReports}
    icon="pending-report"
    highlight={stats.pendingReports > 0}
    onClick={() => navigateTo('/reports/pending')}
  />
  <StatCard
    title="处理中报告"
    value={stats.processingReports}
    icon="processing-report"
  />
  <StatCard
    title="已处理报告"
    value={stats.processedReports}
    icon="processed-report"
  />

  {/* === 新增卡片：超时相关统计 === */}
  <StatCard
    title="超时子任务"
    value={stats.timeoutSubtasks}
    icon="timeout-subtask"
    highlight={stats.timeoutSubtasks > 0}
  />
  <StatCard
    title="超长任务"
    value={stats.longRunningTasks}
    icon="long-running-task"
    highlight={stats.longRunningTasks > 0}
  />
</div>
```

### UI 设计建议

#### 1. 分组展示

建议将统计卡片分为 3 组：

| 分组 | 说明 | 卡片 |
|------|------|------|
| **执行结果** | 基础执行状态统计 | 总计、待处理、进行中、已完成、失败、阻塞 |
| **上报报告** | Agent B 上报的报告统计 | 需要介入、上报次数、待处理报告、处理中报告、已处理报告 |
| **超时监控** | 超时任务统计 | 超时子任务、超长任务 |

#### 2. 高亮显示

对于需要关注的指标，使用高亮显示（红色、橙色）：
- `requiresIntervention > 0`：橙色高亮，提示需要介入
- `pendingReports > 0`：红色高亮，提示有待处理报告
- `timeoutSubtasks > 0`：橙色高亮，提示有超时子任务
- `longRunningTasks > 0`：橙色高亮，提示有超长任务

#### 3. 点击跳转

对于可操作的卡片，添加点击跳转功能：
- 点击"待处理报告" → 跳转到 `/reports/pending` 页面
- 点击"需要介入" → 跳转到需要介入的任务列表

---

## 数据库查询优化建议

### 1. 添加索引

```sql
-- commandResults 表索引
CREATE INDEX idx_command_results_requires_intervention ON command_results(requires_intervention);
CREATE INDEX idx_command_results_to_agent_id ON command_results(to_agent_id);

-- agentReports 表索引
CREATE INDEX idx_agent_reports_status ON agent_reports(status);
CREATE INDEX idx_agent_reports_command_result_id ON agentReports(command_result_id);

-- agentSubTasks 表索引
CREATE INDEX idx_agent_sub_tasks_command_result_id ON agent_sub_tasks(command_result_id);
```

### 2. 使用缓存

对于统计数据，可以考虑使用 Redis 缓存，减少数据库查询：
```typescript
const cacheKey = `stats:${toAgentId}:${startDate}:${endDate}`;
const cachedStats = await redis.get(cacheKey);

if (cachedStats) {
  return JSON.parse(cachedStats);
}

const stats = await getStats(params);
await redis.setex(cacheKey, 60, JSON.stringify(stats)); // 缓存 60 秒
```

---

## 实施计划

### P0（必须完成）

1. ✅ 为 `commandResults` 表添加字段（`latestReportId`, `reportCount`, `requiresIntervention`）
2. ✅ 创建 `agentReports` 表
3. ✅ 修改 `getStats` 方法，新增介入相关统计
4. ✅ 修改 API 接口，返回新增的统计字段

### P1（建议完成）

1. 🔲 前端页面新增统计卡片
2. 🔲 前端页面高亮显示需要关注的指标
3. 🔲 前端页面添加点击跳转功能

### P2（可选）

1. 🔲 添加数据库索引
2. 🔲 使用 Redis 缓存统计数据
3. 🔲 添加数据可视化图表（趋势图、饼图等）

---

## 总结

### 核心改动点

| 改动点 | 说明 | 优先级 |
|--------|------|--------|
| 新增统计字段 | `requiresIntervention`, `reportCount` | P0 |
| 新增报告统计 | `pendingReports`, `processedReports` 等 | P0 |
| 新增超时统计 | `timeoutSubtasks`, `longRunningTasks` | P1 |
| 前端新增卡片 | 需要介入、上报报告、超时监控 | P1 |
| 高亮显示 | 对需要关注的指标进行高亮 | P1 |
| 点击跳转 | 跳转到对应的详情页面 | P1 |

### 业务价值

- ✅ **实时监控**：Agent A 可以实时查看需要介入的任务
- ✅ **快速响应**：快速发现待处理报告，及时处理
- ✅ **风险预警**：超时任务高亮显示，提前预警
- ✅ **数据驱动**：通过统计数据，优化任务分配和资源配置
