# MCP 参数映射服务使用指南

## 📋 概述

`McpParameterMapper` 是一个通用的 LLM 参数映射服务，实现了"查表 + LLM 参数映射"的架构。

---

## 🎯 核心设计思想

### 旧架构（硬编码，不推荐）
```
新增MCP → 修改代码 → 修改提示词 → 重新部署 → 重启服务
```

### 新架构（查表 + LLM，推荐）
```
新增MCP → INSERT capability_list → 等待10分钟自动刷新 → 生效
```

---

## 📖 场景一：当前使用 LLM 的场景

基于代码分析，当前 LLM 的使用场景：

| 场景 | 使用位置 | LLM 任务 | 是否需要优化 |
|------|---------|---------|-------------|
| 1️⃣ 执行Agent直接执行任务 | `subtask-execution-engine.ts` | 理解任务，决定是否能完成 | ❌ 不需要 |
| 2️⃣ **Agent B 解决方案选型** | `subtask-execution-engine.ts` | 选择用哪个 MCP，生成参数 | ✅ **需要优化** |
| 3️⃣ Agent B 标准化决策 | `subtask-execution-engine.ts` | 综合多方信息做出决策 | ❌ 不需要 |
| 4️⃣ 合规校验 | `command-result-service.ts` | 校验文章是否合规 | ❌ 不需要 |
| 5️⃣ 超时智能决策 | `timeout-intelligent-decision.ts` | 分析超时原因，给出建议 | ❌ 不需要 |
| 6️⃣ 能力边界判定 | `executor-capability-checker.ts` | 判断执行Agent是否能完成 | ❌ 不需要 |

---

## 🚀 场景二：新增 MCP 的完整流程

### 步骤 1：在 capability_list 表中插入新能力

```sql
INSERT INTO capability_list (
  capability_type,
  function_desc,
  status,
  tool_name,
  action_name,
  param_desc,
  param_examples,
  example_output,
  dedicated_task_type,
  dedicated_task_priority,
  is_primary_for_task
) VALUES (
  'compliance_audit',
  '保险文章合规审核',
  'available',
  'search',
  'complianceCheck',
  -- 🎯 paramDesc：给 LLM 看的参数说明
  '{
    "articleTitle": "文章标题（字符串）",
    "articleContent": "文章正文内容（字符串）",
    "auditType": "审核类型（枚举：insurance_finance, medical_health, general_content）",
    "strictLevel": "严格级别（1-5，1最宽松，5最严格）"
  }',
  -- 🎯 paramExamples：参数示例
  '{
    "articleTitle": "2024年增额终身寿险产品分析",
    "articleContent": "这是一篇关于增额终身寿险的文章...",
    "auditType": "insurance_finance",
    "strictLevel": 3
  }',
  -- 🎯 exampleOutput：输出样例
  '{
    "success": true,
    "complianceScore": 85,
    "issues": ["用词需要调整"],
    "suggestions": ["建议修改为更中性的表述"]
  }',
  -- 🎯 专用任务类型绑定
  'compliance_audit',
  1,
  true
);
```

### 步骤 2：等待 10 分钟自动刷新

系统每 10 分钟自动刷新 capability_list 缓存，新能力会自动生效。

### 步骤 3：使用 McpParameterMapper 调用

```typescript
import { getMcpParameterMapper } from '@/lib/services/mcp-parameter-mapper';
import { genericMCPCall } from '@/lib/mcp/generic-mcp-call';

// 1. 查表：从数据库获取 capability_list
const capabilities = await db
  .select()
  .from(capabilityList)
  .where(eq(capabilityList.status, 'available'));

// 2. 初始化映射器
const mapper = getMcpParameterMapper();

// 3. 按专用任务类型快速选择并映射参数
const result = await mapper.mapByDedicatedTaskType(
  '这是一篇关于增额终身寿险的文章...', // 上游内容
  'compliance_audit', // 专用任务类型
  capabilities
);

if (result.success && result.capability) {
  // 4. 直接调用 MCP
  const mcpResult = await genericMCPCall(
    result.capability.toolName!,
    result.capability.actionName!,
    result.params!
  );
  
  console.log('MCP 执行结果:', mcpResult);
}
```

---

## 💻 API 文档

### McpParameterMapper.mapParameters()

核心方法：执行参数映射

```typescript
interface ParameterMappingRequest {
  upstreamContent: string;              // 上游任务内容
  capability: CapabilityList;           // 能力配置
  taskType?: string;                     // 任务类型（可选）
  extraContext?: Record<string, any>;   // 额外上下文（可选）
}

interface ParameterMappingResult {
  success: boolean;                      // 是否成功
  params?: Record<string, any>;          // 映射后的参数
  error?: string;                         // 错误信息
  reasoning?: string;                     // 推理过程（调试用）
}

const result = await mapper.mapParameters({
  upstreamContent: '文章内容...',
  capability: capabilityFromDB,
  taskType: 'compliance_audit',
});
```

### McpParameterMapper.mapByDedicatedTaskType()

便捷方法：按专用任务类型快速选择能力并映射

```typescript
const result = await mapper.mapByDedicatedTaskType(
  upstreamContent,
  'compliance_audit',  // 专用任务类型
  capabilities          // 可用能力列表
);

// 返回结果包含 capability 字段
if (result.success && result.capability) {
  console.log('选定的能力:', result.capability.toolName);
  console.log('映射的参数:', result.params);
}
```

---

## 🏗️ capability_list 关键字段说明

| 字段 | 说明 | 是否必填 | 示例 |
|------|------|---------|------|
| `toolName` | 工具名称 | ✅ 必填 | `"search"` |
| `actionName` | 动作名称 | ✅ 必填 | `"complianceCheck"` |
| `paramDesc` | 🎯 **参数说明**（给 LLM 看的自然语言描述） | ✅ **必填** | `{"articleTitle": "文章标题"}` |
| `paramExamples` | 参数示例 | ⭐ 推荐 | `{"articleTitle": "示例标题"}` |
| `exampleOutput` | 输出样例 | ⭐ 推荐 | `{"success": true}` |
| `dedicatedTaskType` | 🔴 **专用任务类型** | ⭐ 推荐 | `"compliance_audit"` |
| `dedicatedTaskPriority` | 专用任务优先级 | ⭐ 推荐 | `1` |
| `isPrimaryForTask` | 是否为首选能力 | ⭐ 推荐 | `true` |

---

## 🎯 最佳实践

### 1. paramDesc 怎么写？

**❌ 不好的写法**
```json
{
  "title": "字符串",
  "content": "字符串"
}
```

**✅ 好的写法**
```json
{
  "title": "文章标题（字符串，不超过100字）",
  "content": "文章正文内容（字符串，完整的文章文本）",
  "auditType": "审核类型（枚举值：insurance_finance=保险金融, medical_health=医疗健康, general_content=通用内容）",
  "strictLevel": "严格级别（数字1-5，1最宽松，5最严格）"
}
```

### 2. 如何支持多个能力供同一个任务使用？

```sql
-- 能力1：合规审核（首选）
INSERT INTO capability_list (
  ...,
  dedicated_task_type = 'compliance_audit',
  dedicated_task_priority = 1,
  is_primary_for_task = true
);

-- 能力2：合规审核（备选，优先级2）
INSERT INTO capability_list (
  ...,
  dedicated_task_type = 'compliance_audit',
  dedicated_task_priority = 2,
  is_primary_for_task = false
);
```

### 3. 如何测试新能力？

使用测试 API：
```bash
curl -X POST http://localhost:5000/api/test/mcp-parameter-mapper \
  -H "Content-Type: application/json" \
  -d '{
    "upstreamContent": "测试文章内容...",
    "dedicatedTaskType": "compliance_audit"
  }'
```

---

## 🔄 完整流程图

```
┌─────────────────┐
│  上游任务内容    │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│  步骤1：查表                  │
│  SELECT * FROM capability_list│
│  WHERE dedicated_task_type = ?│
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  步骤2：选择能力              │
│  优先 is_primary_for_task    │
│  其次按 priority 排序        │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  步骤3：LLM 参数映射          │
│  ┌──────────────────────┐   │
│  │ 理解 paramDesc       │   │
│  │ 理解上游内容         │   │
│  │ 生成正确的参数格式   │   │
│  └──────────────────────┘   │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  步骤4：执行 MCP              │
│  genericMCPCall()             │
└────────┬─────────────────────┘
         │
         ▼
┌─────────────────┐
│  返回结果        │
└─────────────────┘
```

---

## ✅ 总结

| 问题 | 答案 |
|------|------|
| **LLM 要不要？** | ✅ **必须要！** 参数映射必须用 LLM |
| **查表要不要？** | ✅ **要！** 选择能力用查表，快速确定 |
| **硬编码要不要？** | ❌ **不要！** 参数说明存在数据库，LLM 自动理解 |
| **新增 MCP 流程？** | `INSERT capability_list` → 等待10分钟 → 生效 |
| **你的分析对不对？** | ✅ **完全正确！** 你的理解非常准确 |
