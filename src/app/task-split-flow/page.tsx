'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TaskSplitFlowPage() {
  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Agent 任务拆解流程</h1>
        <p className="text-muted-foreground text-lg">
          从任务创建到执行的完整流程可视化
        </p>
      </div>

      {/* 主流程图 */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-2xl">🔄 完整流程图</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-6 rounded-lg overflow-x-auto">
            <pre className="text-xs sm:text-sm">
{`
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    🎯 Agent 任务拆解完整流程                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Step 1: Agent A 创建任务                                    Step 2: 任务入库
  ┌─────────────────────┐                                    ┌─────────────────────┐
  │  👨‍💼 Agent A         │ ────────────────────────────────▶ │  💾 agent_tasks 表   │
  │  下达任务指令         │                                    │                     │
  │                      │                                    │  - taskId           │
  │  执行主体: insurance-d│                                    │  - executor: 'B'     │
  │  任务: 4篇科普文章   │                                    │  - splitStatus:     │
  │  时限: 5天          │                                    │    'pending_split'  │
  │                      │                                    │  - taskStatus:      │
  └─────────────────────┘                                    │    'unsplit'        │
                                                                └─────────────────────┘
                                                                          │
                                                                          ▼
                                          ⚠️  【问题点】系统缺少自动触发机制
                                          │
                                          └─▶ 需要手动调用拆解接口
                                                    │
                                                    ▼
  Step 3: 手动触发拆解                                     Step 4: Agent B 执行拆解
  ┌─────────────────────┐                                   ┌─────────────────────┐
  │  🔧 手动触发         │ ────────────────────────────────▶ │  🤖 Agent B         │
  │                      │                                   │  执行任务拆解         │
  │  POST /api/agents/   │                                   │                     │
  │  tasks/[id]/split    │                                   │  分析任务需求        │
  │                      │                                   │  生成拆解方案        │
  └─────────────────────┘                                   │  按日分解子任务      │
                                                              └─────────────────────┘
                                                                          │
                                                                          ▼
  Step 5: 拆解完成                                     Step 6: 拆解方案待确认
  ┌─────────────────────┐                                   ┌─────────────────────┐
  │  ✅ 拆解完成         │ ────────────────────────────────▶ │  💾 agent_tasks 表   │
  │                      │                                   │                     │
  │  生成 3 个子任务：   │                                   │  - splitStatus:     │
  │  1. 需求分析(2天)   │                                   │    'split_pending_  │
  │  2. 内容创作(3天)   │                                   │     review'         │
  │  3. 质量检查(1天)   │                                   │  - taskStatus:      │
  │  总计: 6天          │                                   │    'pending_review' │
  │                      │                                   │  - metadata:        │
  └─────────────────────┘                                   │    {splitResult:   │
                                                                 {...3个子任务...} }|
                                                              └─────────────────────┘
                                                                          │
                                                                          ▼
  Step 7: Agent A 确认拆解                                 Step 8: 生成执行指令
  ┌─────────────────────┐                                   ┌─────────────────────┐
  │  👨‍💼 Agent A         │ ────────────────────────────────▶ │  💾 command_results  │
  │  审核拆解方案         │                                   │     表              │
  │                      │                                   │                     │
  │  确认: 批准          │                                   │  - commandId        │
  │                      │                                   │  - executor:        │
  └─────────────────────┘                                   │    'insurance-d'   │
                                                              │  - executionStatus: │
                                                              │    'new'           │
                                                              │  - 按日生成 5 个    │
                                                              │    command         │
                                                              └─────────────────────┘
                                                                          │
                                                                          ▼
  Step 9: Agent D 执行任务                                 Step 10: 按日完成交付
  ┌─────────────────────┐                                   ┌─────────────────────┐
  │  📝 Agent D         │ ────────────────────────────────▶ │  📦 交付物          │
  │  执行子任务           │                                   │                     │
  │                      │                                   │  Day 1: 第1篇文章  │
  │  Day 1: 创作第1篇   │                                   │         (Word)      │
  │  Day 2: 创作第2篇   │                                   │  Day 2: 第2篇文章  │
  │  Day 3: 创作第3篇   │                                   │         (Word)      │
  │  Day 4: 创作第4篇   │                                   │  Day 3: 第3篇文章  │
  │  Day 5: 合规校验+汇总│                                   │         (Word)      │
  │                      │                                   │  Day 4: 第4篇文章  │
  └─────────────────────┘                                   │         (Word)      │
                                                                │  最终: 插图清单    │
                                                                      (Excel)       │
                                                              └─────────────────────┘
`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* 详细步骤说明 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 左侧：问题分析 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-red-600">⚠️ 问题点分析</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-semibold">Step 2 → Step 3 之间</h3>
              <p className="text-sm text-muted-foreground mt-1">
                任务入库后，系统<strong className="text-red-600">不会自动触发拆解</strong>
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <p><strong>当前状态：</strong></p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>✅ 任务创建成功，保存到数据库</li>
                <li>✅ splitStatus = 'pending_split'</li>
                <li>❌ 没有自动调用拆解接口</li>
                <li>❌ 需要手动触发</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-sm">
                <strong>原因：</strong>系统设计上缺少自动触发机制
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 右侧：拆解方案 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-green-600">✅ Agent B 拆解方案</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold">3 个子任务</h3>
              <p className="text-sm text-muted-foreground mt-1">
                总计 6 天完成，风险等级：<span className="text-green-600 font-semibold">低</span>
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="font-semibold text-sm">子任务 1: 需求分析与规划</p>
                <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-2">
                  <span>👤 执行者: insurance-d</span>
                  <span>⏱️ 时长: 2 天</span>
                  <span>📋 依赖: 无</span>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded p-3">
                <p className="font-semibold text-sm">子任务 2: 内容创作</p>
                <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-2">
                  <span>👤 执行者: insurance-c</span>
                  <span>⏱️ 时长: 3 天</span>
                  <span>📋 依赖: 子任务 1</span>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded p-3">
                <p className="font-semibold text-sm">子任务 3: 质量检查与优化</p>
                <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-2">
                  <span>👤 执行者: insurance-d</span>
                  <span>⏱️ 时长: 1 天</span>
                  <span>📋 依赖: 子任务 2</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 数据流转 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">📊 数据流转图</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-6 rounded-lg overflow-x-auto">
            <pre className="text-xs">
{`
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              agent_tasks 表 (总任务)                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ 字段              │ 拆解前值                    │ 拆解后值                            │
├───────────────────┼───────────────────────────┼───────────────────────────────────────┤
│ taskId            │ task-A-to-B-xxx-nhf       │ (不变)                               │
│ executor          │ 'B'                        │ (不变)                               │
│ splitStatus       │ 'pending_split'            │ 'split_pending_review' ✅           │
│ taskStatus        │ 'unsplit'                  │ 'pending_review' ✅                 │
│ metadata.splitResult│ null                      │ { subtasks: [3个子任务], ... } ✅  │
│ updatedAt         │ 2026-02-13 01:20:11       │ 2026-02-13 01:32:28 ✅             │
└───────────────────┴───────────────────────────┴───────────────────────────────────────┘
                                          │
                                          │ (确认拆解后)
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                            command_results 表 (执行指令)                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ 字段              │ 示例值                                                                │
├───────────────────┼───────────────────────────────────────────────────────────────────┤
│ commandId         │ cmd-1770917890123-abc123                                            │
│ relatedTaskId     │ task-A-to-B-xxx-nhf                                                │
│ executor          │ 'insurance-d'                                                       │
│ executionStatus   │ 'new'                                                               │
│ commandContent    │ '完成「三口之家保险配置优先级」文章创作...'                          │
│ executionDeadline │ 2026-02-14 (Day 1)                                                  │
└───────────────────┴───────────────────────────────────────────────────────────────────┘
                                          │
                                          │ (执行完成后)
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              agent_sub_tasks 表 (子任务)                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ 字段              │ 示例值                                                                │
├───────────────────┼───────────────────────────────────────────────────────────────────┤
│ id                │ uuid-xxx                                                            │
│ commandResultId   │ cmd-1770917890123-abc123                                            │
│ taskTitle         │ '第1天: 完成三口之家保险配置文章'                                    │
│ status            │ 'completed'                                                         │
│ executionResult   │ '文章内容: ...'                                                      │
│ completedAt       │ 2026-02-14 18:00:00                                                  │
└───────────────────┴───────────────────────────────────────────────────────────────────┘
`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* API 接口说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">🔌 关键 API 接口</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-blue-600 mb-2">1. 创建任务</h3>
              <code className="text-xs bg-gray-100 p-2 block rounded">
                POST /api/agents/tasks
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                Agent A 创建任务，保存到 agent_tasks 表
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-yellow-600 mb-2">2. 触发拆解 ⚠️</h3>
              <code className="text-xs bg-gray-100 p-2 block rounded">
                POST /api/agents/tasks/[taskId]/split
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>当前需要手动调用</strong>，Agent B 执行拆解
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-green-600 mb-2">3. 确认拆解</h3>
              <code className="text-xs bg-gray-100 p-2 block rounded">
                POST /api/agents/tasks/[taskId]/confirm-split
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                Agent A 确认拆解方案，生成 command_results
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-purple-600 mb-2">4. 查询任务</h3>
              <code className="text-xs bg-gray-100 p-2 block rounded">
                GET /api/agents/tasks?agentId=insurance-d
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                查询 Agent 的任务列表和状态
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 改进建议 */}
      <Card className="border-2 border-blue-500">
        <CardHeader>
          <CardTitle className="text-xl text-blue-600">💡 改进建议</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <div>
                <h4 className="font-semibold">添加自动触发机制</h4>
                <p className="text-sm text-muted-foreground">
                  在任务创建后，自动调用拆解接口，无需手动触发
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <div>
                <h4 className="font-semibold">增加定时任务扫描</h4>
                <p className="text-sm text-muted-foreground">
                  每 5 分钟扫描 agent_tasks 表，自动拆解 pending_split 状态的任务
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold">3</span>
              </div>
              <div>
                <h4 className="font-semibold">优化拆解策略</h4>
                <p className="text-sm text-muted-foreground">
                  根据 Agent 能力和任务复杂度，智能调整拆解方案
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 实时状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">📈 当前任务状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">01</div>
              <div className="text-sm text-muted-foreground">任务创建</div>
              <div className="text-xs text-green-600 mt-1">✅ 已完成</div>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">02</div>
              <div className="text-sm text-muted-foreground">任务拆解</div>
              <div className="text-xs text-green-600 mt-1">✅ 已完成</div>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">03</div>
              <div className="text-sm text-muted-foreground">等待确认</div>
              <div className="text-xs text-yellow-600 mt-1">⏳ 待处理</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
