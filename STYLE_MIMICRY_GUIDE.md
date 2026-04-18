# 风格模仿功能使用指南

## 功能概述

insurance-d 和 Agent D 现已具备**风格学习和模仿**能力，可以：
1. 分析原有文章的写作风格（语气、结构、词汇等）
2. 提取风格特征并生成风格模板
3. 按照提取的风格创作新文章，保持高度一致性

**Agent 区别**：
- **insurance-d**：保险赛道内容 Agent，专注于保险相关内容的风格模仿
- **Agent D**：AI 赛道内容 Agent，专注于 AI 技术内容的风格模仿

两个 Agent 共享相同的风格分析器底层能力，但各自维护独立的风格模板库。

## 核心能力

### 1. 风格分析能力
- 分析文章语气（专业/亲切/幽默/严肃）
- 识别词汇水平和句式结构
- 提取关键词和关键短语
- 分析内容结构和段落特征
- 评估数据使用和案例使用习惯

### 2. 风格特征提取
- 17 维风格特征分析
- 置信度评分（0-1）
- 支持多篇文章综合分析

### 3. 风格模仿能力
- 严格按照风格特征生成文章
- 保持标题风格和长度
- 匹配段落结构和内容
- 使用相同的关键词和表达方式

## API 接口

### 1. 学习文章风格

**接口**: `POST /api/style-analyzer/learn`

**请求体**:
```json
{
  "articles": [
    "第一篇文章内容...",
    "第二篇文章内容...",
    "第三篇文章内容..."
  ],
  "categoryName": "保险科普"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "template": {
      "id": "style_保险科普_1234567890_abc123",
      "name": "保险科普风格模板",
      "category": "保险科普",
      "features": {
        "tone": "亲切",
        "complexity": "simple",
        "length": "medium",
        "vocabularyLevel": "basic",
        "sentenceStructure": "mixed",
        "contentStructure": ["引言", "正文", "总结"],
        "typicalSections": ["背景介绍", "问题分析", "解决方案"],
        "useOfExamples": "many",
        "useOfData": "minimal",
        "commonKeywords": ["保险", "保障", "风险", "家庭"],
        "keyPhrases": ["提前规划", "未雨绸缪"],
        "averageParagraphLength": 120,
        "confidence": 0.85
      },
      "summary": "基于 3 篇文章分析生成的保险科普风格模板...",
      "recommendations": ["建议提供更多样本文章..."]
    }
  }
}
```

### 2. 按照风格生成文章

**接口**: `POST /api/style-analyzer/generate`

**请求体**:
```json
{
  "templateId": "style_保险科普_1234567890_abc123",
  "topic": "如何为家庭配置合适的保险",
  "additionalInstructions": "增加实际案例"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "article": "完整的文章内容...",
    "template": {
      "id": "style_保险科普_1234567890_abc123",
      "name": "保险科普风格模板",
      "confidence": 0.85
    },
    "topic": "如何为家庭配置合适的保险"
  }
}
```

### 3. 获取风格模板

**接口**: `GET /api/style-analyzer/templates`

**查询参数**:
- `category`: 按分类筛选（可选）
- `latest`: 获取最新模板（可选，值为 `true`）

**示例**:
```
GET /api/style-analyzer/templates
GET /api/style-analyzer/templates?category=保险科普
GET /api/style-analyzer/templates?latest=true
```

### 4. 管理单个模板

**接口**:
- `GET /api/style-analyzer/templates/:id` - 获取模板详情
- `DELETE /api/style-analyzer/templates/:id` - 删除模板
- `PATCH /api/style-analyzer/templates/:id` - 更新模板

## 使用流程

### 方式 1: 通过 API 使用

```bash
# 1. 上传文章并学习风格
curl -X POST http://localhost:5000/api/style-analyzer/learn \
  -H "Content-Type: application/json" \
  -d '{
    "articles": ["文章1内容", "文章2内容"],
    "categoryName": "保险科普"
  }'

# 2. 使用生成的模板 ID 创建新文章
curl -X POST http://localhost:5000/api/style-analyzer/generate \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "style_保险科普_1234567890_abc123",
    "topic": "重疾险的常见误区"
  }'
```

### 方式 2: 通过 insurance-d Agent 使用

insurance-d Agent 已内置风格模仿能力，可以向其发送如下指令：

```
请按照之前的保险科普文章风格，写一篇关于"如何选择医疗险"的文章
```

insurance-d 会：
1. 自动加载最新的风格模板
2. 提取风格特征
3. 按照该风格生成新文章

## 如何提供文章给 insurance-d

### 方法 1: 通过 API 学习风格（推荐）

```javascript
// 上传原有文章
const response = await fetch('/api/style-analyzer/learn', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    articles: [
      '你的第一篇文章内容',
      '你的第二篇文章内容',
      // ... 更多文章
    ],
    categoryName: '保险科普'
  })
});

const { data } = await response.json();
const templateId = data.template.id;
```

### 方法 2: 直接向 insurance-d 发送文章

在聊天界面中，发送类似消息：

```
请学习以下文章的写作风格，并记住这个风格：
---
[粘贴你的文章内容]
---

现在请用这个风格写一篇关于"少儿保险"的文章。
```

### 方法 3: 批量上传和定期更新

```bash
# 定期上传新文章，更新风格模板
for file in articles/*.txt; do
  content=$(cat "$file")
  curl -X POST http://localhost:5000/api/style-analyzer/learn \
    -H "Content-Type: application/json" \
    -d "{
      \"articles\": [\"$content\"],
      \"categoryName\": \"保险科普\"
    }"
done
```

## 最佳实践

### 1. 提供足够的样本文章
- 建议：至少 3-5 篇文章
- 质量：选择风格一致的高质量文章
- 多样性：覆盖不同主题，但保持相同风格

### 2. 分类管理风格模板
- 按照不同分类创建模板（如：保险科普、产品介绍、案例分析）
- 定期更新模板以保持风格一致性

### 3. 结合额外指令
```json
{
  "templateId": "xxx",
  "topic": "重疾险的常见误区",
  "additionalInstructions": "增加实际案例，使用数据支撑观点"
}
```

### 4. 监控置信度
- 置信度 > 0.8：风格特征明显，模仿效果好
- 置信度 0.6-0.8：风格特征较明显，建议提供更多样本
- 置信度 < 0.6：风格特征不明显，需要更多样本文章

## 示例场景

### 场景 1: 保持公众号风格一致性

1. 收集公众号过去 10 篇热门文章
2. 通过 API 上传并学习风格
3. 生成新文章时使用该模板
4. 确保所有文章风格一致

### 场景 2: 不同文章类型使用不同风格

- 保险科普：使用亲切、简洁的风格
- 产品介绍：使用专业、详细的风格
- 案例分析：使用故事化、案例丰富的风格

### 场景 3: 定期更新风格

- 每月上传新文章
- 更新风格模板
- 保持风格与时俱进

## 技术细节

### 风格特征维度（17 维）

1. 语气（tone）
2. 复杂度（complexity）
3. 文章长度（length）
4. 词汇水平（vocabularyLevel）
5. 句式结构（sentenceStructure）
6. 标点风格（punctuationStyle）
7. 内容结构（contentStructure）
8. 典型段落（typicalSections）
9. 案例使用（useOfExamples）
10. 比喻使用（useOfMetaphors）
11. 数据使用（useOfData）
12. 引用使用（useOfQuotes）
13. 常用关键词（commonKeywords）
14. 关键短语（keyPhrases）
15. 标题风格（titleStyle）
16. 段落长度（averageParagraphLength）
17. 段落数量（paragraphCount）

### 置信度评分

- 0.9-1.0：风格特征非常明显
- 0.7-0.9：风格特征明显
- 0.5-0.7：风格特征较明显
- <0.5：风格特征不明显，需要更多样本

## 故障排除

### 问题 1: 生成的文章风格不一致

**解决方案**:
- 提供更多样本文章（建议 5 篇以上）
- 确保样本文章风格一致
- 检查模板置信度是否 > 0.7

### 问题 2: 分析失败或出错

**解决方案**:
- 确保文章内容不为空
- 检查文章格式是否正确
- 查看日志获取详细错误信息

### 问题 3: API 调用超时

**解决方案**:
- 减少单次分析的文章数量（最多 3 篇）
- 检查网络连接
- 确保服务正常运行

## 后续优化计划

- [ ] 支持从 URL 直接抓取文章
- [ ] 支持批量导入文章文件
- [ ] 提供风格对比和可视化
- [ ] 支持风格混合（多个模板加权）
- [ ] 集成到每日自动文章生成流程
- [ ] 提供风格质量评分

---

## Agent D 风格模仿使用指南

### Agent D 简介

Agent D 是 AI 赛道的内容执行者，负责执行内容类任务。与 insurance-d 类似，Agent D 也具备风格学习和模仿能力。

### Agent D 适用场景

Agent D 专注于以下类型的内容风格模仿：
1. **AI 技术文章**：ChatGPT、Midjourney、GPT-4 等技术分析
2. **编程教程**：前端、后端、移动端开发教程
3. **行业分析**：AI 行业动态、技术趋势分析
4. **产品评测**：AI 产品、工具评测
5. **技术博客**：技术分享、最佳实践

### Agent D 使用示例

#### 示例 1: 模仿 AI 技术文章风格

```
请按照以下文章的写作风格，写一篇关于"Stable Diffusion 最新功能"的文章：
---
[粘贴一篇 AI 技术文章]
---
```

Agent D 会：
1. 分析原文的风格特征
2. 提取技术术语使用习惯
3. 学习文章结构和表达方式
4. 按照该风格创作新文章

#### 示例 2: 保持技术博客风格一致性

```
请按照我之前的技术博客风格，写一篇关于"React 18 并发模式"的文章
```

#### 示例 3: 学习并模仿热门文章风格

```
请学习这篇热门 AI 文章的风格，写一篇关于"LLM 微调技巧"的文章：
---
[粘贴热门文章]
---
```

### Agent D 风格特征维度

Agent D 的风格分析同样包含 17 维特征：

1. **语气**：专业/亲切/幽默/严肃
2. **复杂度**：simple/moderate/complex
3. **文章长度**：short/medium/long
4. **词汇水平**：basic/intermediate/advanced（技术术语使用频率）
5. **句式结构**：simple/mixed/complex
6. **标点风格**：minimal/standard/rich
7. **内容结构**：如：引言-技术原理-实践案例-总结
8. **典型段落**：代码示例、图示说明、案例分析
9. **案例使用**：none/few/many（实际代码案例）
10. **比喻使用**：none/occasional/frequent
11. **数据使用**：none/minimal/moderate/extensive（性能数据、测试结果）
12. **引用使用**：none/occasional/frequent（技术文档、API 引用）
13. **常用关键词**：如：API、接口、框架、性能、优化等
14. **关键短语**：如："最佳实践"、"性能优化"、"架构设计"等
15. **标题风格**：技术标题风格（如："深入理解XXX"、"XXX实战指南"）
16. **段落长度**：平均段落长度（技术文章通常较长）
17. **段落数量**：段落数量

### Agent D 与 insurance-d 的对比

| 特性 | Agent D（AI 赛道） | insurance-d（保险赛道） |
|------|-------------------|----------------------|
| 适用领域 | AI 技术、编程、行业分析 | 保险科普、产品介绍、理赔案例 |
| 词汇特点 | 技术术语、API、框架名称 | 保险术语、产品名称、法规引用 |
| 内容结构 | 原理-实践-案例-总结 | 问题-分析-解决方案-建议 |
| 案例类型 | 代码示例、性能测试数据 | 真实案例、理赔故事、用户反馈 |
| 数据使用 | 性能数据、测试结果、对比数据 | 保费数据、理赔数据、统计结果 |
| 标题风格 | "深入理解XXX"、"XXX实战指南" | "如何XXX"、"XXX的N个要点" |
| 典型段落 | 代码块、图示、架构图 | 案例故事、场景描述、建议清单 |

### Agent D 最佳实践

1. **提供高质量技术文章样本**
   - 选择专业、准确的技术文章
   - 确保样本包含代码示例和实际案例
   - 风格要一致，避免混合多种风格

2. **分类管理技术风格模板**
   - 技术教程风格
   - 产品评测风格
   - 行业分析风格
   - 技术博客风格

3. **结合技术术语和代码**
   ```
   请按照技术教程的风格写一篇关于"Vue 3 Composition API"的文章，
   增加代码示例和实际应用场景
   ```

4. **定期更新技术风格**
   - AI 技术发展迅速，定期学习最新的技术文章风格
   - 关注热门技术文章的写作风格

### Agent D 注意事项

1. **技术准确性**
   - 确保技术术语使用正确
   - 代码示例必须可运行
   - 技术原理表述准确

2. **风格一致性**
   - 保持与目标文章相同的专业度
   - 使用相同的技术术语表达习惯
   - 保持代码注释风格一致

3. **知识库记忆**
   - 记录成功的技术写作策略
   - 记录高转化率的代码示例模板
   - 记录用户反馈的技术要点

### Agent D 完整对话示例

**用户**:
```
我写了一篇技术文章，风格比较专业，包含了很多代码示例和性能测试数据。
请你学习这篇文章的风格，写一篇关于"Next.js 14 Server Actions"的文章。
```

**粘贴文章**:
```
[粘贴技术文章内容]
```

**Agent D 回复**:
```
收到！我已经分析了你的技术文章风格：

风格特征：
- 语气：专业、严谨
- 复杂度：complex（涉及深层次技术原理）
- 词汇水平：advanced（使用大量技术术语）
- 内容结构：引言→技术原理→实现步骤→性能测试→总结
- 案例使用：many（多个代码示例）
- 数据使用：extensive（详细的性能测试数据）
- 常用关键词：API、接口、性能、优化、并发、缓存等
- 标题风格："深入理解XXX"类型

现在我按照这个风格为你创作关于"Next.js 14 Server Actions"的文章...

[生成的文章]
```

### API 调用示例（Agent D）

虽然 Agent D 主要通过对话交互使用，但你也可以直接调用底层 API：

```bash
# 1. 学习技术文章风格
curl -X POST http://localhost:5000/api/style-analyzer/learn \
  -H "Content-Type: application/json" \
  -d '{
    "articles": ["技术文章1", "技术文章2"],
    "categoryName": "AI技术"
  }'

# 2. 生成新文章
curl -X POST http://localhost:5000/api/style-analyzer/generate \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "style_AI技术_xxx",
    "topic": "GPT-4 Turbo 新特性解析",
    "additionalInstructions": "增加代码示例和性能测试数据"
  }'
```
