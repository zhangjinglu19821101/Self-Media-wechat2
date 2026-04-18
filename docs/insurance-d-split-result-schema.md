# Insurance-D 拆解返回结果约束规范

## 📋 概述

本文档定义了 insurance-d 拆解返回结果的完整数据结构约束，确保所有 Agent 返回的拆解结果格式一致。

---

## 🔒 核心约束（必须遵守）

### 1. SplitResult 主结构

```typescript
export interface SplitResult {
  // 子任务列表（两种写法都支持，推荐用 subTasks）
  subtasks?: SubTask[];
  subTasks?: SubTask[];
  
  // 总交付物描述
  totalDeliverables?: string;
  
  // 时间范围
  timeFrame?: string;
  
  // 摘要信息
  summary?: string;
}
```

### 2. SubTask 子任务结构

```typescript
export interface SubTask {
  // 🔥 必填字段
  taskTitle: string;              // 子任务标题
  taskDescription?: string;        // 子任务描述（推荐）
  commandContent?: string;         // 指令内容
  executor: string;                // 执行者
  
  // 🔥 推荐字段
  taskType?: string;               // 任务类型
  priority?: string;               // 优先级
  deadline?: string;               // 截止日期
  estimatedHours?: string;          // 预估工时
  acceptanceCriteria?: string;      // 验收标准
  orderIndex?: number;              // 执行顺序（从 1 开始）
  
  // 其他字段
  id?: string;                     // 任务 ID
  isCritical?: boolean;            // 是否关键任务
  criticalReason?: string;          // 关键原因
}
```

---

## 📝 完整示例

### 示例 1：最小化格式（必填字段）

```json
{
  "subTasks": [
    {
      "taskTitle": "分析客户需求",
      "executor": "insurance-d",
      "orderIndex": 1
    },
    {
      "taskTitle": "制定保险方案",
      "executor": "insurance-d",
      "orderIndex": 2
    }
  ]
}
```

### 示例 2：完整格式（所有字段）

```json
{
  "subTasks": [
    {
      "taskTitle": "分析客户需求",
      "taskDescription": "深入分析客户的保险需求和风险承受能力",
      "commandContent": "请分析客户的保险需求",
      "executor": "insurance-d",
      "taskType": "analysis",
      "priority": "high",
      "deadline": "2026-02-20",
      "estimatedHours": "4",
      "acceptanceCriteria": "完成客户需求分析报告",
      "orderIndex": 1,
      "isCritical": true,
      "criticalReason": "这是整个保险方案的基础"
    },
    {
      "taskTitle": "制定保险方案",
      "taskDescription": "根据客户需求制定个性化保险方案",
      "commandContent": "请制定保险方案",
      "executor": "insurance-d",
      "taskType": "planning",
      "priority": "high",
      "deadline": "2026-02-21",
      "estimatedHours": "6",
      "acceptanceCriteria": "完成保险方案制定",
      "orderIndex": 2
    }
  ],
  "totalDeliverables": "客户需求分析报告 + 保险方案",
  "timeFrame": "2026-02-20 至 2026-02-21",
  "summary": "为客户制定完整的保险方案，包括需求分析和方案制定"
}
```

---

## ✅ 字段检查清单

### SplitResult 主字段检查
- [ ] 至少有 `subTasks` 或 `subtasks` 字段（推荐用 `subTasks`）
- [ ] `subTasks` 是数组类型
- [ ] `subTasks` 数组不为空
- [ ] 可选：`totalDeliverables`（推荐）
- [ ] 可选：`timeFrame`（推荐）
- [ ] 可选：`summary`（推荐）

### SubTask 子任务字段检查
- [ ] `taskTitle` 必填
- [ ] `executor` 必填
- [ ] `orderIndex` 推荐（从 1 开始）
- [ ] `taskDescription` 推荐
- [ ] 每个子任务的 `orderIndex` 不重复
- [ ] `orderIndex` 连续（1, 2, 3, ...）

---

## ❌ 常见错误

### 错误 1：缺少必填字段

```json
{
  "subTasks": [
    {
      "taskTitle": "分析客户需求"
      // ❌ 缺少 executor 字段
    }
  ]
}
```

### 错误 2：orderIndex 不连续

```json
{
  "subTasks": [
    {
      "taskTitle": "任务1",
      "executor": "insurance-d",
      "orderIndex": 1
    },
    {
      "taskTitle": "任务2",
      "executor": "insurance-d",
      "orderIndex": 3  // ❌ 跳过了 2
    }
  ]
}
```

### 错误 3：子任务数组为空

```json
{
  "subTasks": []  // ❌ 不能为空
}
```

---

## 🔗 相关文件

- `src/app/agents/[id]/hooks/useAgentSplit.ts` - `SplitResult` 接口定义
- `src/app/agents/[id]/components/dialogs/SplitResultConfirmDialog.tsx` - 弹框组件
- `src/app/api/agent-sub-tasks/confirm-split/route.ts` - 确认接口

---

## 📞 遇到问题？

如果返回的拆解结果格式不符合规范，请检查：
1. 阅读本文档
2. 查看 `src/app/agents/[id]/hooks/useAgentSplit.ts` 中的 `SplitResult` 接口
3. 查看数据库中已有的拆解结果作为参考
