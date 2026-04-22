# deai-optimizer 两个问题深度分析报告

**分析时间**: 2026-04-22  
**分析人**: 技术专家

---

## 问题 1："优化总结"显示 HTML 内容

### 1.1 问题现象
- order_index = 3 (deai-optimizer) 执行完成后
- 任务列表的交互历史中，"优化总结"部分显示了 HTML 内容
- 而不是显示简要的总结文本

### 1.2 根因分析

查看 `agent-task-list-normal.tsx` 第 578-584 行：

```typescript
const briefResponse = !isAgentBReviewer
  ? (responseContent?.briefResponse || 
     responseContent?.resultSummary ||
     responseContent?.summary ||
     responseContent?.result ||  // ⚠️ 问题在这里！
     (typeof responseContent === 'string' ? responseContent.substring(0, 500) : '') ||
     '')
  : '';
```

**问题核心**：

deai-optimizer 输出的是**信封格式**：
```json
{
  "isCompleted": true,
  "result": {
    "content": "<p>HTML 内容...</p>",  // ⚠️ 这里是 HTML
    "articleTitle": "...",
    "platformData": {...}
  }
}
```

但是提取逻辑：
1. 先找 `responseContent?.briefResponse` → 没有
2. 再找 `responseContent?.resultSummary` → 没有  
3. 再找 `responseContent?.summary` → 没有
4. **然后找到 `responseContent?.result`** → 这是一个对象 `{ content, articleTitle, platformData }`
5. 当这个对象被渲染时，React 会把它转为字符串，或者直接显示对象内容！

### 1.3 影响范围
- ✅ deai-optimizer（信封格式）
- ❌ insurance-d（如果也是信封格式，同样有问题）
- ❌ 其他使用信封格式的执行 Agent

---

## 问题 2：提示词是否影响了 insurance-d

### 2.1 问题分析
查看 `prompt-loader.ts`：

```typescript
const legacyAgentPromptFiles: Record<string, string> = {
  'insurance-d': 'insurance-d-v3.md',        // ✅ 独立文件
  'deai-optimizer': 'deai-optimizer.md',      // ✅ 独立文件
  // ...
};
```

**结论**：
- ✅ **每个 Agent 的提示词是独立加载的**
- ✅ deai-optimizer.md 的修改**不会影响** insurance-d-v3.md
- ✅ 提示词之间完全隔离，没有共享或交叉影响

### 2.2 验证
- insurance-d 使用 `insurance-d-v3.md`
- deai-optimizer 使用 `deai-optimizer.md`
- 两个文件在文件系统中是完全独立的
- 加载逻辑也是独立的

---

## 修复方案

### 方案 A：修改提取逻辑（推荐）

在 `agent-task-list-normal.tsx` 中，对信封格式做特殊处理：

```typescript
// 先判断是否是信封格式
const isEnvelopeFormat = responseContent?.result?.content !== undefined;

const briefResponse = !isAgentBReviewer
  ? (responseContent?.briefResponse || 
     responseContent?.resultSummary ||
     responseContent?.summary ||
     (isEnvelopeFormat ? '去AI化优化已完成' : responseContent?.result) ||  // ⚠️ 信封格式给默认文本
     (typeof responseContent === 'string' ? responseContent.substring(0, 500) : '') ||
     '')
  : '';
```

### 方案 B：修改 deai-optimizer 输出格式

让 deai-optimizer 也输出 `briefResponse` 字段：

```json
{
  "isCompleted": true,
  "briefResponse": "已完成去AI化优化，剔除了机器腔，增加了自然表达",
  "result": {
    "content": "<p>HTML 内容...</p>",
    "articleTitle": "...",
    "platformData": {...}
  }
}
```

---

## 推荐行动

1. **立即修复问题 1**：采用方案 A，修改提取逻辑
2. **验证问题 2**：确认 insurance-d 不受影响（已确认）
3. **测试验证**：修复后验证 order_index = 3 的"优化总结"显示正常
