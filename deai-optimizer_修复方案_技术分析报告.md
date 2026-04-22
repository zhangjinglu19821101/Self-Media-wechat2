# deai-optimizer 修复方案 - 技术专家深度分析报告

**分析时间**: 2026-04-22  
**分析人**: 技术专家  
**问题等级**: P0 (生产阻断)

---

## 1. 问题根因分析

### 1.1 问题现象
- order_index = 3 (deai-optimizer) 报错无法执行
- 具体错误未在日志中明确显示，但任务无法正常推进

### 1.2 Git 历史完整追踪

| 版本 | Commit | 说明 | 问题 |
|------|--------|------|------|
| v1 | `8d979080` | 初始版本，信封格式 | 无格式保持要求 |
| v2 | `1e8bd42c` | 引用 executor-standard-result.md | 格式未保持 |
| v3 | `35ead696` | **问题版本** - 添加格式保持，**但破坏了 JSON 结构** | ⚠️ JSON 结构不兼容 |
| v4 | 当前 | 试图修复 JSON，但仍不匹配 | ⚠️ 与信封格式不兼容 |

### 1.3 核心问题定位

#### 问题 1：JSON 结构不兼容（P0 级别）

**原始信封格式（v1, 8d979080）**：
```json
{
  "isCompleted": true,
  "result": {
    "content": "优化后的完整正文内容（纯文本格式）",
    "articleTitle": "文章标题（不超过15字）",
    "platformData": {
      "platform": "xiaohongshu|wechat_official|zhihu|toutiao",
      "optimizationNotes": "本次优化的主要改动说明（简短）"
    }
  },
  "articleTitle": "文章标题（顶层冗余字段，兼容旧代码）"
}
```

**我错误修改后的结构（v3, 35ead696）**：
```json
{
  "isCompleted": true,
  "briefResponse": "...",
  "selfEvaluation": "...",
  "result": "【执行结论】...",
  "structuredResult": {
    "resultContent": {  // ❌ 这里被改成了对象！
      "content": "...",
      "articleTitle": "...",
      "platformData": {...}
    }
  },
  "articleTitle": "..."
}
```

**关键问题**：
- ❌ 原始结构：`result.content` 是字符串
- ❌ 修改后：`structuredResult.resultContent` 是对象
- ❌ 完全破坏了与下游解析器的兼容性

---

## 2. 我的修复方案评估

### 2.1 第一次修复（v3, 35ead696）- 不合格

**问题清单**：
1. ❌ **JSON 结构破坏**：从信封格式改为 executor-standard-result 格式，但两者混用
2. ❌ **字段不匹配**：`resultContent` 应该是字符串，被改成了对象
3. ❌ **与历史版本不兼容**：下游代码期望 `result.content`，现在变成了 `structuredResult.resultContent.content`

### 2.2 第二次修复（当前版本）- 仍不合格

**问题清单**：
1. ❌ **JSON 结构仍不匹配**：`structuredResult.resultContent` 是字符串，不是原始的 `result.content`
2. ❌ **信封格式丢失**：原始的 `result: { content, articleTitle, platformData }` 结构完全丢失
3. ❌ **与 executor-standard-result.md 的要求不明确**：不知道应该用哪种格式

---

## 3. 正确的修复方案

### 3.1 方案选择：保持信封格式（推荐）

**理由**：
1. ✅ 向下兼容：与 v1 版本完全兼容
2. ✅ 风险最低：下游解析器不需要修改
3. ✅ 与其他写作 Agent 保持一致

### 3.2 具体修复步骤

#### 步骤 1：恢复信封格式 JSON 结构

```json
{
  "isCompleted": true,
  "result": {
    "content": "优化后的完整正文内容（公众号需完整保留HTML标签和内联样式，小红书/知乎/头条为纯文本）",
    "articleTitle": "文章标题（不超过15字）",
    "platformData": {
      "platform": "xiaohongshu|wechat_official|zhihu|toutiao",
      "optimizationNotes": "本次优化的主要改动说明（简短）"
    }
  },
  "articleTitle": "文章标题（顶层冗余字段，兼容旧代码）"
}
```

#### 步骤 2：只在文字说明中添加格式保持规则

不要修改 JSON 示例结构，只在文字说明中强调：
- 在"第一步"中明确公众号格式保持
- 在"最终输出要求"中明确公众号格式保持
- **JSON 示例保持原样**

---

## 4. 详细修复实施计划

### 4.1 文件修改清单

| 文件 | 修改内容 | 风险等级 |
|------|---------|---------|
| `src/lib/agents/prompts/deai-optimizer.md` | 恢复信封格式，添加格式保持文字说明 | P0 |

### 4.2 具体修改内容

#### 修改 1：恢复信封格式 JSON 示例

**修改前（错误）**：
```json
{
  "isCompleted": true,
  "briefResponse": "...",
  "selfEvaluation": "...",
  "result": "【执行结论】...",
  "structuredResult": {
    "resultContent": "优化后的完整正文内容..."
  },
  "articleTitle": "..."
}
```

**修改后（正确）**：
```json
{
  "isCompleted": true,
  "result": {
    "content": "优化后的完整正文内容（公众号需完整保留HTML标签和内联样式，小红书/知乎/头条为纯文本）",
    "articleTitle": "文章标题（不超过15字）",
    "platformData": {
      "platform": "xiaohongshu|wechat_official|zhihu|toutiao",
      "optimizationNotes": "本次优化的主要改动说明（简短）"
    }
  },
  "articleTitle": "文章标题（顶层冗余字段，兼容旧代码）"
}
```

#### 修改 2：在公众号部分添加强格式保持规则

在"若目标平台为公众号"部分添加：
```
- 🔴 **格式保持优先级最高**：必须100%完整保留原始HTML标签和内联样式，包括：
  - 橙色引导文字、青绿色小标题、灰色分隔线、段落结构等所有格式标签
  - `<p>`、`<span>`、`<br>` 等所有HTML标签
  - `style="..."` 所有内联样式
```

#### 修改 3：在"最终输出要求"中添加格式保持规则

新增独立章节：
```
### 🔴 格式保持规则（优先级最高）

1. **公众号平台**：必须100%完整保留原始HTML标签和内联样式，不得删除或修改任何 `<p>`、`<span>`、`<br>` 标签和 `style` 属性
2. **小红书/知乎/头条平台**：可以输出纯文本格式
```

---

## 5. 验证方案

### 5.1 验证步骤

1. **静态验证**：检查 JSON 语法正确
2. **对比验证**：与 v1 版本的 JSON 结构对比，完全一致
3. **执行验证**：触发 order_index = 3 任务，检查是否正常执行
4. **格式验证**：检查输出是否完整保留了公众号 HTML 格式

### 5.2 回滚方案

如果修复后仍有问题，立即回滚到 v1 版本：
```bash
git checkout 8d979080 -- src/lib/agents/prompts/deai-optimizer.md
```

---

## 6. 风险评估

| 风险项 | 风险等级 | 缓解措施 |
|--------|---------|---------|
| JSON 结构仍不匹配 | P0 | 严格按照 v1 版本恢复 |
| 下游解析器不兼容 | P0 | 保持与 v1 完全一致 |
| 格式保持规则不生效 | P1 | 在多处重复强调规则 |

---

## 7. 总结与建议

### 7.1 核心教训

1. **不要随意修改 JSON 结构**：JSON 示例是与下游的契约，修改会破坏兼容性
2. **文字说明 ≠ 结构修改**：格式保持规则应该用文字说明，不要修改 JSON 示例结构
3. **先看 Git 历史**：修改前应该查看完整的历史，理解为什么是那样的结构

### 7.2 推荐行动

✅ **立即执行**：按照本报告的方案 3.2 进行修复  
✅ **验证测试**：修复后立即验证 order_index = 3 是否正常执行  
✅ **文档记录**：在 AGENTS.md 中记录本次修复，避免重复犯错

---

**报告结束**
