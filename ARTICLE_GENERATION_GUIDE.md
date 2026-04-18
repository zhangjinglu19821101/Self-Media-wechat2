# 每日自动生成文章功能使用指南

## 📖 功能概述

本系统实现了每天自动生成 AI 文章和保险文章的功能，通过定时任务调度器自动执行文章生成任务。

---

## 🚀 核心功能

### 1. 定时自动生成

- **AI 文章**：每天 09:00 自动生成 1 篇 AI 相关文章
- **保险文章**：每天 14:00 自动生成 1 篇保险相关文章
- 自动选择主题，无需人工干预

### 2. 手动触发生成

- 可以随时手动触发文章生成
- 支持批量生成多篇文章

### 3. 工作流集成

- 与编排引擎完美集成
- 支持多 Agent 协作生成文章
- 支持文章审核流程

---

## 🔧 配置说明

### 默认配置

```typescript
{
  enabled: true,                    // 是否启用定时生成
  timezone: 'Asia/Shanghai',       // 时区
  aiArticleTime: '09:00',         // AI 文章生成时间
  insuranceArticleTime: '14:00',  // 保险文章生成时间
  aiArticleCount: 1,              // AI 文章生成数量
  insuranceArticleCount: 1,       // 保险文章生成数量
}
```

### 修改配置

可以通过以下方式修改配置：

1. **修改默认配置**：编辑 `src/lib/article-generator/instance.ts`
2. **动态更新配置**：使用 API 或代码更新

---

## 📡 API 接口

### 1. 获取生成状态

**接口**：`GET /api/articles/generate/status`

**响应示例**：
```json
{
  "success": true,
  "data": {
    "config": {
      "enabled": true,
      "timezone": "Asia/Shanghai",
      "aiArticleTime": "09:00",
      "insuranceArticleTime": "14:00",
      "aiArticleCount": 1,
      "insuranceArticleCount": 1
    },
    "nextExecution": {
      "ai": "2026-02-02T09:00:00.000Z",
      "insurance": "2026-02-02T14:00:00.000Z"
    },
    "status": "running"
  }
}
```

### 2. 手动触发生成

**接口**：`POST /api/articles/generate/trigger`

**请求体**：
```json
{
  "type": "ai",        // "ai" 或 "insurance"
  "count": 1           // 生成数量
}
```

**响应示例**：
```json
{
  "success": true,
  "message": "Article generation triggered successfully. Type: ai, Count: 1"
}
```

---

## 🔄 工作流程

### AI 文章生成流程

```
开始
  ↓
Agent A 选择主题
  ↓
Agent D 生成内容
  ↓
Agent A 审核文章
  ↓
完成
```

### 保险文章生成流程

```
开始
  ↓
Agent A 选择主题
  ↓
Agent insurance-c 分析市场
  ↓
Agent insurance-d 生成内容
  ↓
Agent A 审核文章
  ↓
完成
```

---

## 🎯 使用场景

### 场景 1：定时自动发布

每天自动生成文章，用于：
- 每日资讯推送
- 内容营销
- SEO 优化

### 场景 2：热点事件响应

手动触发文章生成：
- AI 技术突破
- 保险行业新闻
- 市场趋势分析

### 场景 3：批量内容生产

批量生成多篇文章：
- 系列文章
- 专题内容
- 知识库填充

---

## 💡 最佳实践

### 1. 主题选择

- 定期更新主题列表
- 结合时事热点
- 考虑用户需求

### 2. 文章质量

- 设置合理的温度参数（0.6-0.8）
- 启用文章审核流程
- 人工干预关键词选择

### 3. 发布策略

- 固定时间发布，培养用户习惯
- 跨平台分发，扩大覆盖面
- 收集反馈，持续优化

### 4. 数据监控

- 监控文章生成成功率
- 跟踪文章阅读量
- 分析用户偏好

---

## 🛠️ 扩展功能

### 1. 集成微信公众号

生成文章后自动发布到微信公众号：
```typescript
// 在 ArticleGenerator.saveArticle() 中添加
await publishToWeChat(article);
```

### 2. 添加文章评分

使用 LLM 对生成的文章进行评分：
```typescript
const score = await evaluateArticle(article);
```

### 3. 多语言支持

支持生成中英文双语文章：
```typescript
const articleEn = await generateArticle({ language: 'en' });
const articleZh = await generateArticle({ language: 'zh' });
```

### 4. 图片生成

配合生图模型，生成配图：
```typescript
const image = await generateImage(article.summary);
```

---

## 📊 监控与日志

### 事件监听

调度器会触发以下事件：

```typescript
scheduler.on('aiArticleGenerationStarted', () => {
  console.log('AI article generation started');
});

scheduler.on('aiArticleGenerated', (article) => {
  console.log('Article generated:', article.title);
});

scheduler.on('aiArticleGenerationCompleted', ({ articles, duration }) => {
  console.log(`Completed: ${articles.length} articles in ${duration}ms`);
});
```

### 日志查看

文章生成过程会输出详细日志：
```
=== Executing AI Article Generation ===
✅ AI Article generated: 2024年人工智能发展趋势
✅ AI Article Generation completed in 5000ms. Generated 1 articles.
```

---

## ❓ 常见问题

### Q: 如何修改生成时间？

A: 编辑 `src/lib/article-generator/instance.ts` 中的配置：
```typescript
aiArticleTime: '10:00',         // 修改为 10:00
insuranceArticleTime: '16:00',  // 修改为 16:00
```

### Q: 如何增加每天生成的文章数量？

A: 修改配置中的 `aiArticleCount` 和 `insuranceArticleCount`：
```typescript
aiArticleCount: 3,              // 每天 3 篇
insuranceArticleCount: 2,       // 每天 2 篇
```

### Q: 如何禁用定时生成？

A: 设置 `enabled: false`：
```typescript
enabled: false,  // 禁用定时生成
```

### Q: 生成的文章如何发布？

A: 目前文章保存到控制台日志，可以集成：
- 微信公众号 API
- 博客平台 API
- 内容管理系统（CMS）

### Q: 如何自定义文章主题？

A: 修改 `ArticleGenerator` 中的 `getRandomAITopic()` 和 `getRandomInsuranceTopic()` 方法，或者使用 API 手动指定主题。

---

## 🎉 总结

每日自动生成文章功能已经完全实现，包括：

- ✅ 定时自动生成（每天 2 篇）
- ✅ 手动触发生成
- ✅ 工作流集成
- ✅ 多 Agent 协作
- ✅ API 接口
- ✅ 配置灵活
- ✅ 事件监听

您可以根据实际需求调整配置和扩展功能！
