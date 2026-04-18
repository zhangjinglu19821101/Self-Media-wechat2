# Agent B 合规校验功能文档

## 功能概述

当 insurance-d 完成文章创作后，系统会自动触发 Agent B（架构师B，技术支撑）对文章进行合规性校验，确保文章符合保险行业的相关规定和标准。

## 工作流程

```
┌─────────────┐
│ insurance-d │
│  完成文章   │
└──────┬──────┘
       │
       ├─> 提交任务结果 (completeTask)
       │
       ├─> 检测到文章创建任务
       │
       ├─> 自动触发 Agent B 合规校验
       │
       ├─> 调用 LLM 进行合规检查
       │
       ├─> 创建合规校验任务记录
       │
       └─> 返回校验结果
```

## 校验维度

Agent B 会从以下 5 个维度对文章进行合规性校验：

### 1. 内容合规性
- 是否包含误导性或夸大的表述
- 是否有虚假宣传或不当承诺
- 是否违反保险行业相关规定

### 2. 风险提示
- 是否充分提示了保险产品的风险
- 是否清晰说明了责任免除条款
- 是否平衡了收益与风险的描述

### 3. 术语规范
- 保险术语是否准确、规范
- 是否使用了未经解释的专业术语
- 是否符合保险行业的专业标准

### 4. 数据准确性
- 引用的数据、案例是否有出处
- 百分比、概率等数据是否合理
- 是否有编造或夸大的数据

### 5. 监管要求
- 是否符合银保监会相关规定
- 是否涉及需要审批的内容
- 是否有违反广告法的内容

## 评分标准

- **90-100分**：优秀，完全符合合规要求
- **75-89分**：良好，基本符合，有少量改进空间
- **60-74分**：一般，存在一些合规问题，需要修改
- **低于60分**：不合格，存在严重合规风险

## 问题类型

校验结果中的问题分为三个级别：

- **critical（严重）**：必须立即修复的合规问题
- **warning（警告）**：建议修复的合规问题
- **info（提示）**：改进建议

## 使用方法

### 方法1：通过 insurance-d 正常流程（推荐）

1. insurance-d 创建文章任务（taskType: 'article_creation'）
2. insurance-d 完成文章并提交结果
3. 系统自动触发 Agent B 合规校验
4. 在前端查看校验结果

### 方法2：测试接口

```bash
# 测试完整的合规校验流程
curl -X POST http://localhost:5000/api/test/compliance-check \
  -H "Content-Type: application/json" \
  -d '{
    "articleTitle": "测试文章：如何选择适合的保险产品",
    "articleContent": "文章内容..."
  }'
```

### 方法3：查询校验结果

```bash
# 查询特定任务的合规校验结果
GET /api/agents/compliance/check-result/:taskId
```

## 前端展示

使用 `ComplianceCheckResultCard` 组件展示校验结果：

```tsx
import { ComplianceCheckResultCard } from '@/components/compliance-check-result-card';

<ComplianceCheckResultCard taskId="task-xxx" onRefresh={() => {}} />
```

## 数据结构

### 校验结果

```typescript
interface ComplianceCheckResult {
  isCompliant: boolean;       // 是否合规
  score: number;              // 合规评分（0-100）
  summary: string;            // 总体评价
  issues: ComplianceIssue[];  // 问题列表
  recommendations: string[];  // 改进建议
}

interface ComplianceIssue {
  type: 'critical' | 'warning' | 'info';
  category: string;           // 问题类别
  location?: string;          // 问题位置
  description: string;        // 问题描述
  suggestion: string;         // 修改建议
}
```

## 任务元数据

合规校验任务会在 `agent_tasks` 表中创建记录，包含以下元数据：

```typescript
{
  taskType: 'compliance_check',
  originalTaskId: string,     // 原始任务 ID
  articleTitle: string,       // 文章标题
  articleContent: string,     // 文章内容
  complianceResult: object,  // 校验结果
  isCompliant: boolean,       // 是否合规
  complianceScore: number,    // 合规评分
}
```

## 注意事项

1. **自动触发**：只有当任务类型为 `article_creation` 且执行者为 `insurance-d` 时，才会自动触发合规校验。

2. **LLM 调用**：合规校验通过调用 LLM 实现，需要确保 LLM 服务正常运行。

3. **结果存储**：校验结果会存储在 `agent_tasks` 表中，可以通过 API 查询。

4. **异常处理**：如果合规评分低于 60 分，系统会触发异常通知。

5. **人工复核**：对于严重问题，建议进行人工复核。

## 相关文件

- 提示词模板：`src/lib/prompts/compliance-check.ts`
- 任务服务：`src/lib/services/agent-task.ts`
- 查询 API：`src/app/api/agents/compliance/check-result/[taskId]/route.ts`
- 测试 API：`src/app/api/test/compliance-check/route.ts`
- 前端组件：`src/components/compliance-check-result-card.tsx`
