# 测试方案完善计划

## 📊 现状评估

### ✅ 现有架构优势
1. **完整的13个测试案例定义** - 包含详细的业务场景说明
2. **两阶段流程验证** - 专门针对"合规检查+公众号上传"的验证
3. **业务场景级验证** - 每个测试案例都有对应的验证逻辑
5. **统一测试入口** - `/api/test/run-all-tests` 一站式执行

### 🔧 需要完善的地方

| 序号 | 问题 | 优先级 | 说明 |
|------|------|--------|------|
| 1 | 缺少测试执行进度实时反馈 | 🔴 高 | 长时间运行的测试无法看到进度 |
| 2 | 缺少测试报告导出功能 | 🟡 中 | 无法导出 HTML/PDF 格式的测试报告 |
| 3 | 缺少测试失败重试机制 | 🟡 中 | 单次失败就标记整个测试失败 |
| 4 | 缺少测试数据对比功能 | 🟡 中 | 无法对比历史测试结果 |
| 5 | 缺少性能指标收集 | 🟢 低 | 没有记录每个测试案例的执行时间 |
| 6 | 缺少测试环境健康检查 | 🟡 中 | 测试前不检查依赖服务状态 |
| 7 | 缺少测试用例分组功能 | 🟢 低 | 无法按业务域分组执行测试 |

---

## 🎯 完善方案

### 方案一：测试执行进度实时反馈（优先级：🔴 高）

#### 功能说明
通过 Server-Sent Events (SSE) 实时推送测试执行进度，让用户能看到：
- 当前正在执行的测试案例
- 已完成的测试案例数量
- 每个测试案例的执行状态
- 预计剩余时间

#### 实现建议

**新增 API：`/api/test/run-all-tests-stream`**

```typescript
// src/app/api/test/run-all-tests-stream/route.ts
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // 阶段1：初始化
        send({ type: 'init', message: '开始初始化测试环境...', progress: 0 });

        // 阶段2：创建测试数据
        send({ type: 'phase', phase: 'create-data', message: '创建测试数据...', progress: 10 });
        const testData = await createTestData();
        send({ type: 'data-created', testGroupId: testData.testGroupId, progress: 20 });

        // 阶段3：执行测试
        send({ type: 'phase', phase: 'execute', message: '开始执行测试...', progress: 25 });

        for (let i = 0; i < testData.subTasks.length; i++) {
          const subTask = testData.subTasks[i];
          send({
            type: 'test-start',
            testCaseId: subTask.testCaseId,
            testCaseName: subTask.testCaseName,
            progress: 25 + (i / testData.subTasks.length) * 60
          });

          // 执行单个测试...
          const result = await executeSingleTest(subTask);

          send({
            type: 'test-complete',
            testCaseId: subTask.testCaseId,
            testCaseName: subTask.testCaseName,
            status: result.status,
            duration: result.duration,
            progress: 25 + ((i + 1) / testData.subTasks.length) * 60
          });
        }

        // 阶段4：验证
        send({ type: 'phase', phase: 'validation', message: '验证测试结果...', progress: 85 });
        const validation = await validateResults(testData);

        // 阶段5：完成
        send({ type: 'phase', phase: 'complete', message: '测试执行完成！', progress: 100 });
        send({ type: 'final', result: validation });

      } catch (error) {
        send({ type: 'error', error: String(error) });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**前端使用示例：**

```javascript
const eventSource = new EventSource('/api/test/run-all-tests-stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'init':
      console.log('初始化:', data.message);
      updateProgressBar(data.progress);
      break;
    case 'test-start':
      console.log(`开始执行: ${data.testCaseName}`);
      updateCurrentTest(data.testCaseName);
      break;
    case 'test-complete':
      console.log(`完成: ${data.testCaseName} - ${data.status}`);
      addToTestResults(data);
      break;
    case 'final':
      console.log('测试完成:', data.result);
      eventSource.close();
      break;
  }
};
```

---

### 方案二：测试报告导出功能（优先级：🟡 中）

#### 功能说明
支持导出多种格式的测试报告：
- **HTML 格式** - 美观的网页报告，支持在线查看
- **JSON 格式** - 结构化数据，便于程序处理
- **Markdown 格式** - 简洁的文本报告

#### 实现建议

**新增 API：`/api/test/export-report`**

```typescript
// src/app/api/test/export-report/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const testGroupId = searchParams.get('testGroupId');
  const format = searchParams.get('format') || 'html';

  if (!testGroupId) {
    return NextResponse.json(
      { error: '缺少 testGroupId 参数' },
      { status: 400 }
    );
  }

  // 获取测试结果
  const testResults = await getTestResults(testGroupId);

  let content: string;
  let contentType: string;
  let filename: string;

  switch (format) {
    case 'json':
      content = generateJsonReport(testResults);
      contentType = 'application/json';
      filename = `test-report-${testGroupId}.json`;
      break;
    case 'markdown':
      content = generateMarkdownReport(testResults);
      contentType = 'text/markdown';
      filename = `test-report-${testGroupId}.md`;
      break;
    case 'html':
    default:
      content = generateHtmlReport(testResults);
      contentType = 'text/html';
      filename = `test-report-${testGroupId}.html`;
      break;
  }

  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function generateHtmlReport(results: any): string {
  const passedCount = results.testCases.filter(t => t.status === 'completed').length;
  const totalCount = results.testCases.length;
  const passRate = ((passedCount / totalCount) * 100).toFixed(1);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>测试报告 - ${results.testGroupId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #0070f3; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 30px 0; }
    .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
    .summary-card .number { font-size: 36px; font-weight: bold; }
    .summary-card.passed .number { color: #10b981; }
    .summary-card.failed .number { color: #ef4444; }
    .summary-card.rate .number { color: #0070f3; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
    th { background: #f8f9fa; font-weight: 600; }
    .status-passed { color: #10b981; font-weight: 600; }
    .status-failed { color: #ef4444; font-weight: 600; }
    .priority { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .timestamp { color: #666; font-size: 14px; margin-top: 20px; text-align: right; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 端到端测试报告</h1>
    
    <div class="summary">
      <div class="summary-card">
        <div class="number">${totalCount}</div>
        <div>总测试案例</div>
      </div>
      <div class="summary-card passed">
        <div class="number">${passedCount}</div>
        <div>通过</div>
      </div>
      <div class="summary-card failed">
        <div class="number">${totalCount - passedCount}</div>
        <div>失败</div>
      </div>
      <div class="summary-card rate">
        <div class="number">${passRate}%</div>
        <div>通过率</div>
      </div>
    </div>

    <h2>📋 测试案例详情</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>测试案例名称</th>
          <th>状态</th>
          <th>执行时间</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>
        ${results.testCases.map(tc => `
          <tr>
            <td>${tc.testCaseId}${tc.isPriority ? ' <span class="priority">重点</span>' : ''}</td>
            <td>${tc.testCaseName}</td>
            <td class="${tc.status === 'completed' ? 'status-passed' : 'status-failed'}">
              ${tc.status === 'completed' ? '✅ 通过' : '❌ 失败'}
            </td>
            <td>${tc.duration || '-'}</td>
            <td>${tc.notes || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="timestamp">
      报告生成时间: ${new Date().toLocaleString('zh-CN')}<br>
      测试组 ID: ${results.testGroupId}
    </div>
  </div>
</body>
</html>
  `;
}
```

---

### 方案三：测试失败重试机制（优先级：🟡 中）

#### 功能说明
为单个测试案例添加自动重试机制：
- 可配置重试次数（默认3次）
- 可配置重试间隔（默认5秒）
- 记录每次重试的结果
- 只有所有重试都失败才标记为失败

#### 实现建议

**修改 `executeTasks` 函数：**

```typescript
// 在 route.ts 中添加重试配置
interface RetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  retryableStatuses: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelayMs: 5000,
  retryableStatuses: ['in_progress', 'pending']
};

async function executeSingleTestWithRetry(
  subTaskId: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{
  success: boolean;
  finalStatus: string;
  attempts: number;
  duration: number;
}> {
  const startTime = Date.now();
  let lastStatus = '';

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    console.log(`🔄 测试执行尝试 ${attempt}/${config.maxRetries}`);

    // 执行测试
    const engine = new SubtaskExecutionEngine();
    await engine.execute();

    // 等待执行完成
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 查询状态
    const result = await db
      .select({ status: agentSubTasks.status })
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subTaskId));

    lastStatus = result[0]?.status || 'unknown';
    console.log(`   状态: ${lastStatus}`);

    // 如果成功完成，直接返回
    if (lastStatus === 'completed' || lastStatus === 'failed') {
      return {
        success: lastStatus === 'completed',
        finalStatus: lastStatus,
        attempts: attempt,
        duration: Date.now() - startTime
      };
    }

    // 如果是可重试状态，继续重试
    if (attempt < config.maxRetries && config.retryableStatuses.includes(lastStatus)) {
      console.log(`   ⏳ 等待 ${config.retryDelayMs / 1000}秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, config.retryDelayMs));
    }
  }

  // 所有重试都失败
  return {
    success: false,
    finalStatus: lastStatus,
    attempts: config.maxRetries,
    duration: Date.now() - startTime
  };
}
```

---

### 方案四：测试环境健康检查（优先级：🟡 中）

#### 功能说明
在执行测试前，先检查依赖服务的健康状态：
- 数据库连接状态
- MCP 服务器连接状态
- 其他外部服务状态

#### 实现建议

**新增文件：`src/lib/test/health-check.ts`**

```typescript
/**
 * 测试环境健康检查
 */

import { db } from '@/lib/db';

export interface HealthCheckResult {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  checks: {
    database: HealthCheckItem;
    mcpServers?: HealthCheckItem;
    [key: string]: HealthCheckItem | undefined;
  };
  timestamp: string;
}

export interface HealthCheckItem {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTimeMs?: number;
  error?: string;
  details?: any;
}

export class TestEnvironmentHealthChecker {
  async checkAll(): Promise<HealthCheckResult> {
    const results: HealthCheckResult = {
      overall: 'healthy',
      checks: {
        database: { status: 'healthy' }
      },
      timestamp: new Date().toISOString()
    };

    // 1. 检查数据库
    const dbCheck = await this.checkDatabase();
    results.checks.database = dbCheck;

    // 2. 检查其他服务...

    // 计算整体状态
    const allChecks = Object.values(results.checks);
    if (allChecks.some(c => c.status === 'unhealthy')) {
      results.overall = 'unhealthy';
    } else if (allChecks.some(c => c.status === 'degraded')) {
      results.overall = 'degraded';
    }

    return results;
  }

  private async checkDatabase(): Promise<HealthCheckItem> {
    const startTime = Date.now();
    try {
      // 执行简单查询测试数据库连接
      await db.execute(sql`SELECT 1`);
      return {
        status: 'healthy',
        responseTimeMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
```

**在测试执行前添加健康检查：**

```typescript
// 在 route.ts 的 GET 函数开头添加
console.log('🏥 步骤0：测试环境健康检查...');
const healthChecker = new TestEnvironmentHealthChecker();
const healthCheck = await healthChecker.checkAll();

console.log('健康检查结果:', healthCheck.overall);
console.log('数据库状态:', healthCheck.checks.database.status);

if (healthCheck.overall === 'unhealthy') {
  console.error('❌ 测试环境不健康，终止测试执行');
  return NextResponse.json({
    success: false,
    error: '测试环境健康检查失败',
    healthCheck
  }, { status: 503 });
}
```

---

### 方案五：性能指标收集（优先级：🟢 低）

#### 功能说明
收集并展示每个测试案例的性能指标：
- 执行耗时
- MCP 调用次数
- 数据库查询次数
- 内存使用情况

#### 实现建议

**新增性能监控中间件：**

```typescript
// src/lib/test/performance-metrics.ts
export interface PerformanceMetrics {
  testCaseId: string;
  testCaseName: string;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  mcpCallCount: number;
  dbQueryCount: number;
  memoryUsage?: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
}

export class PerformanceMetricsCollector {
  private metrics: Map<string, PerformanceMetrics> = new Map();

  startTestCase(testCaseId: string, testCaseName: string): void {
    this.metrics.set(testCaseId, {
      testCaseId,
      testCaseName,
      startTime: new Date(),
      mcpCallCount: 0,
      dbQueryCount: 0
    });
  }

  endTestCase(testCaseId: string): PerformanceMetrics | undefined {
    const metrics = this.metrics.get(testCaseId);
    if (metrics) {
      metrics.endTime = new Date();
      metrics.durationMs = metrics.endTime.getTime() - metrics.startTime.getTime();
      metrics.memoryUsage = process.memoryUsage();
      return metrics;
    }
    return undefined;
  }

  incrementMcpCall(testCaseId: string): void {
    const metrics = this.metrics.get(testCaseId);
    if (metrics) {
      metrics.mcpCallCount++;
    }
  }

  incrementDbQuery(testCaseId: string): void {
    const metrics = this.metrics.get(testCaseId);
    if (metrics) {
      metrics.dbQueryCount++;
    }
  }

  getAllMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }
}
```

---

## 📅 实施优先级建议

### 第一阶段（立即实施）
1. ✅ **测试环境健康检查** - 确保测试环境稳定
2. ✅ **测试失败重试机制** - 提高测试稳定性
3. ✅ **性能指标收集** - 基础性能监控

### 第二阶段（短期实施）
4. ✅ **测试执行进度实时反馈** - 提升用户体验
5. ✅ **测试报告导出功能** - 便于结果分享

### 第三阶段（长期优化）
6. ✅ **测试数据对比功能** - 版本对比分析
7. ✅ **测试用例分组功能** - 灵活的测试执行

---

## 🎯 总结

### 当前状态
- ✅ 测试案例定义完整
- ✅ 业务场景验证完善
- ✅ 数据完整性检查到位
- ✅ 两阶段流程验证专门

### 改进方向
通过上述5个主要方案的实施，可以：
1. **提高测试稳定性** - 通过重试机制和健康检查
2. **改善用户体验** - 通过实时进度反馈和报告导出
3. **增强可观测性** - 通过性能指标收集
4. **提升测试效率** - 通过自动重试和分组执行

这些改进将使整个测试系统更加健壮、易用和高效！
