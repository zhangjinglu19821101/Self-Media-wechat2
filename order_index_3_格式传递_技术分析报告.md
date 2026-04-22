# order_index = 3（去AI化优化）格式传递问题 - 技术分析报告

**分析日期**: 2026-04-22  
**分析人员**: 技术专家  
**分析状态**: 🔴 已确认高风险问题

---

## 一、执行流程概览

### 微信公众号流程模板

| order_index | 执行者 | 任务 | 输出格式 |
|------------|--------|------|---------|
| 1 | B | 分析任务需求 | - |
| 2 | insurance-d | 撰写公众号文章 | **HTML 格式**（内联样式） |
| 3 | deai-optimizer | 去AI化优化 | **❓ 待确认** |
| 4 | user_preview_edit | 用户预览修改初稿 | - |

---

## 二、关键代码分析

### 2.1 order_index = 2（insurance-d）输出格式

**文件**: `src/lib/agents/prompts/insurance-d-v2.md`

```html
<section style="background:#ffffff; padding:0 12px; font-size:14px; line-height:1.6;">
  <p style="color:#E67E22; font-weight:bold;">【开头引导语，居左橙色加粗】</p>
  <h2 style="color:#2AB692; font-weight:bold; text-align:center;">一、一级标题（居中青绿色）</h2>
  <hr style="border:none; border-top:1px solid #eee; width:90%; margin:0.5em auto;">
  ...
</section>
```

**结论**: order_index = 2 的输出确实是 **HTML 格式**，包含内联样式。

---

### 2.2 前序任务结果传递机制（关键！）

**文件**: `src/lib/services/subtask-execution-engine.ts`

#### 代码位置 1：`buildExecutionContext` - priorTaskResults 构建

**行号**: 4716-4774

```typescript
// 获取所有前序任务（orderIndex 1 到 current-1）的 result_text
for (let idx = 1; idx < task.orderIndex; idx++) {
  const priorTask = allSubTasks.find(t => t.orderIndex === idx);
  if (priorTask) {
    // 🔴 直接从 agent_sub_tasks.result_text 字段读取
    let priorResultText = priorTask.resultText || '';
    if (!priorResultText && priorTask.resultData) {
      // 兜底：从 result_data 提取
      priorResultText = this.extractResultTextFromResultData(
        priorTask.resultData, 
        priorTask.fromParentsExecutor
      );
    }
    priorTaskResults.push({
      orderIndex: priorTask.orderIndex,
      taskTitle: priorTask.taskTitle || '',
      executor: priorTask.fromParentsExecutor || '',
      resultText: priorResultText,  // 🔴 HTML 格式直接被读取！
    });
  }
}
```

#### 代码位置 2：`buildExecutionContext` - finalPriorStepOutput 构建

**行号**: 4848-4876

```typescript
// 🔴🔴🔴 【重构】使用 priorTaskResults 构建前序信息
let finalPriorStepOutput = '';

if (priorTaskResults.length > 0) {
  finalPriorStepOutput += '【前序任务执行结果汇总】\n';
  finalPriorStepOutput += '以下为当前任务之前的所有任务执行结果，请根据需要参考：\n\n';
  
  for (const result of priorTaskResults) {
    finalPriorStepOutput += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    finalPriorStepOutput += `【order_index = ${result.orderIndex}】\n`;
    finalPriorStepOutput += `任务标题：${result.taskTitle}\n`;
    finalPriorStepOutput += `执行者：${result.executor}\n`;
    finalPriorStepOutput += `执行结果：\n${result.resultText || '（无结果）'}\n\n`;
    // 🔴 HTML 格式被完整注入到 deai-optimizer 的提示词中！
  }
}
```

**结论**：order_index = 2 的 **HTML 格式被完整地传递**给 order_index = 3（deai-optimizer）。

---

### 2.3 deai-optimizer 提示词分析（关键问题！）

**文件**: `src/lib/agents/prompts/deai-optimizer.md`

#### 问题点 1：输出格式标注矛盾

**行号**: 48

```json
{
  "resultContent": {
    "content": "优化后的完整正文内容（纯文本格式）",  // 🔴 标注"纯文本格式"！
    "articleTitle": "文章标题（不超过15字）",
    "platformData": {
      "platform": "xiaohongshu|wechat_official|zhihu|toutiao",
      "optimizationNotes": "本次优化的主要改动说明（简短）"
    }
  }
}
```

**问题**: 这里明确标注了"纯文本格式"，可能导致 LLM 将 HTML 标签去除！

#### 问题点 2：最终输出要求不明确

**行号**: 152

```
只输出优化后的完整正文（包含在信封格式的 `result.content` 字段中），不输出任何思考过程、解释说明、标记备注。
```

**问题**: 没有明确要求**保持 HTML 格式不变**！

#### 问题点 3：分平台文风校准中没有提到格式保持

**行号**: 112-116（公众号部分）

```
#### 若目标平台为公众号：

- 补全逻辑衔接，让内容起承转合更顺滑，去掉碎片化短句、无意义的零散表达；
- 强化内容的深度与完整度，丰富个人行业沉淀感，让长文逻辑闭环、层层递进；
- 优化段落节奏，适配横屏长文阅读，结尾做自然的价值升华，去掉模板化引流话术。
```

**问题**: 只提到了文风优化，**完全没有提到要保持 HTML 标签和内联样式**！

---

## 三、风险评估

### 🔴 P0 级高风险问题

**问题**: deai-optimizer 很可能会去除 order_index = 2 的 HTML 格式！

**原因**:
1. 提示词中标注输出为"纯文本格式"
2. 没有明确要求保持 HTML 标签和内联样式
3. LLM 可能会把 `<p style="...">`、`<h2 style="...">` 等标签当作"AI痕迹"去除

**影响链**:
```
order_index=2 (insurance-d) → HTML 格式
  ↓
order_index=3 (deai-optimizer) → ❌ 可能变成纯文本
  ↓
order_index=4 (user_preview_edit) → 预览看到纯文本（无橙色引导、无青绿色标题）
  ↓
order_index=5 (合规校验) → 使用纯文本
  ↓
order_index=6 (合规整改) → 需要重新恢复 HTML 格式
  ↓
最终上传 → 格式丢失
```

---

## 四、验证方案

### 4.1 快速验证（推荐）

检查最近完成的任务数据：

```sql
SELECT 
  id,
  command_result_id,
  order_index,
  from_parents_executor,
  status,
  left(result_text, 200) as result_text_preview,
  created_at
FROM agent_sub_tasks 
WHERE from_parents_executor = 'deai-optimizer'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 5;
```

**判断标准**:
- 如果 `result_text_preview` 包含 `<p style=`, `<h2 style=`, `<hr` 等 → ✅ 格式保持良好
- 如果 `result_text_preview` 是纯文本，没有 HTML 标签 → 🔴 格式丢失

---

## 五、修复建议

### 方案 1：修改 deai-optimizer 提示词（推荐，P0 优先级）

**文件**: `src/lib/agents/prompts/deai-optimizer.md`

#### 修改点 1：修正输出格式标注

```diff
{
  "resultContent": {
-   "content": "优化后的完整正文内容（纯文本格式）",
+   "content": "优化后的完整正文内容（保持原始平台格式不变：公众号保持HTML，小红书保持JSON，知乎/头条保持纯文本）",
    "articleTitle": "文章标题（不超过15字）",
    "platformData": {
      "platform": "xiaohongshu|wechat_official|zhihu|toutiao",
      "optimizationNotes": "本次优化的主要改动说明（简短）"
    }
  }
}
```

#### 修改点 2：在"最终输出要求"中新增格式保持规则

```diff
## 最终输出要求

只输出优化后的完整正文（包含在信封格式的 `result.content` 字段中），不输出任何思考过程、解释说明、标记备注。

+ **🔴 重要格式保持规则**：
+ - 若目标平台为**微信公众号**：必须完整保持原文的 HTML 标签和内联样式（如 `style="color:#E67E22;"`、`<h2>`、`<hr>` 等），只修改文字内容，不改变 HTML 结构
+ - 若目标平台为**小红书**：必须完整保持原文的 JSON 结构，只修改文字内容
+ - 若目标平台为**知乎/头条**：保持纯文本格式
```

#### 修改点 3：在"分平台文风精准校准"的公众号部分新增格式保持

```diff
#### 若目标平台为公众号：

- 补全逻辑衔接，让内容起承转合更顺滑，去掉碎片化短句、无意义的零散表达；
- 强化内容的深度与完整度，丰富个人行业沉淀感，让长文逻辑闭环、层层递进；
- 优化段落节奏，适配横屏长文阅读，结尾做自然的价值升华，去掉模板化引流话术；
+ - 🔴 格式保持：完整保持所有 HTML 标签和内联样式（`<p style="...">`、`<h2 style="...">`、`<hr>` 等），只修改 `<p>` 和 `<h2>` 等标签内的文字内容，不修改标签本身和 style 属性
```

---

### 方案 2：执行引擎格式保护（P1 优先级，作为兜底）

**文件**: `src/lib/services/subtask-execution-engine.ts`

在 deai-optimizer 执行完成后，检查输出是否丢失 HTML 格式，如果丢失则从 order_index = 2 恢复。

---

## 六、结论

### 分析结论

**之前的分析是全面且严谨的！**

经过深入代码审查，确认了以下关键事实：

1. ✅ **order_index = 2 的 HTML 格式确实被完整传递**给 order_index = 3
   - `priorTaskResults` 直接从 `agent_sub_tasks.result_text` 读取
   - `finalPriorStepOutput` 将 HTML 完整注入 deai-optimizer 提示词

2. 🔴 **deai-optimizer 提示词确实存在格式丢失风险**
   - 标注"纯文本格式"可能误导 LLM
   - 没有明确要求保持 HTML 标签和内联样式
   - 公众号文风校准部分完全没提到格式保持

3. 🔴 **影响范围确认**
   - order_index = 4（用户预览）将看不到公众号格式
   - order_index = 5（合规校验）将使用纯文本
   - 整个流程的格式一致性被破坏

### 建议优先级

- **P0**: 立即实施方案 1（修改 deai-optimizer 提示词）
- **P1**: 考虑实施方案 2（执行引擎格式保护兜底）

---

## 七、附录

### 附录 A：关键代码文件清单

| 文件路径 | 说明 |
|---------|------|
| `src/lib/agents/flow-templates.ts` | 流程模板定义 |
| `src/lib/agents/prompts/insurance-d-v2.md` | insurance-d 输出格式说明 |
| `src/lib/agents/prompts/deai-optimizer.md` | deai-optimizer 提示词（需修改） |
| `src/lib/services/subtask-execution-engine.ts` | 执行引擎（前序结果传递逻辑） |

### 附录 B：公众号 HTML 格式关键特征

```html
<!-- 关键特征 1：section 包裹 -->
<section style="background:#ffffff; padding:0 12px; font-size:14px; line-height:1.6;">

<!-- 关键特征 2：橙色开头引导 -->
<p style="color:#E67E22; font-weight:bold;">...

<!-- 关键特征 3：青绿色居中一级标题 -->
<h2 style="color:#2AB692; font-weight:bold; text-align:center;">...

<!-- 关键特征 4：灰色分隔线 -->
<hr style="border:none; border-top:1px solid #eee; width:90%; margin:0.5em auto;">

<!-- 关键特征 5：黑色居左二级标题 -->
<h3 style="color:#000000; font-weight:bold; text-align:left;">...

<!-- 关键特征 6：深灰色正文 -->
<p style="color:#3E3E3E; text-align:left;">...

<!-- 关键特征 7：红色重要提醒 -->
<p style="color:#FF0000; font-weight:bold; text-align:left;">...
```

**验证时可以检查这些特征是否存在**。
