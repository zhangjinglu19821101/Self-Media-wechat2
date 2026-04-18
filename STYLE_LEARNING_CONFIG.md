# 风格模板学习配置指南

## 配置文件路径

### 主配置文件
- **路径**: `src/config/style-learning.config.ts`
- **作用**: 定义 insurance-d 和 Agent D 的风格学习配置

### 文章存储路径
- **insurance-d 文章**: `./data/articles/insurance-d/`
- **Agent D 文章**: `./data/articles/agent-d/`

## 配置方式

### 方式 1: 通过配置文件配置

编辑 `src/config/style-learning.config.ts` 文件：

```typescript
export const defaultStyleLearningConfig: StyleLearningConfig = {
  insuranceD: {
    sources: [
      {
        id: 'insurance-sample-1',
        type: 'file',                    // 类型：file 或 url
        path: './data/articles/insurance-d/sample1.txt',  // 文件路径或 URL
        agent: 'insurance-d',
        category: '保险科普',
        description: '保险科普示例文章1',
        enabled: true,                   // 是否启用
      },
      {
        id: 'insurance-wechat-1',
        type: 'url',                     // URL 类型
        path: 'https://mp.weixin.qq.com/s/xxx',  // 文章 URL
        agent: 'insurance-d',
        category: '保险科普',
        description: '微信公众号文章',
        enabled: true,
      },
    ],
    autoLearnEnabled: false,             // 是否自动学习
    autoLearnSchedule: '0 2 * * *',     // 自动学习时间（每天凌晨2点）
    maxArticlesPerLearn: 10,            // 每次学习的最大文章数
  },
  agentD: {
    sources: [
      {
        id: 'ai-tech-sample-1',
        type: 'file',
        path: './data/articles/agent-d/chatgpt-tutorial.txt',
        agent: 'agent-d',
        category: 'AI技术',
        description: 'ChatGPT 教程',
        enabled: true,
      },
      {
        id: 'ai-tech-juejin-1',
        type: 'url',
        path: 'https://juejin.cn/post/xxx',  // 掘金文章
        agent: 'agent-d',
        category: 'AI技术',
        description: '掘金技术文章',
        enabled: true,
      },
    ],
    autoLearnEnabled: false,
    autoLearnSchedule: '0 3 * * *',     // 每天凌晨3点
    maxArticlesPerLearn: 10,
  },
};
```

### 方式 2: 通过 API 动态配置

#### 1. 获取配置

```bash
curl http://localhost:5000/api/style-analyzer/config
```

**响应**:
```json
{
  "success": true,
  "data": {
    "insuranceD": {
      "sources": [...],
      "autoLearnEnabled": false,
      "autoLearnSchedule": "0 2 * * *",
      "maxArticlesPerLearn": 10
    },
    "agentD": {
      "sources": [...],
      "autoLearnEnabled": false,
      "autoLearnSchedule": "0 3 * * *",
      "maxArticlesPerLearn": 10
    }
  }
}
```

#### 2. 更新配置

```bash
curl -X PUT http://localhost:5000/api/style-analyzer/config \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "insurance-d",
    "updates": {
      "autoLearnEnabled": true,
      "autoLearnSchedule": "0 4 * * *",
      "maxArticlesPerLearn": 20
    }
  }'
```

## 文章来源配置

### 1. 本地文件

将文章文件放到指定目录：

```bash
# insurance-d 文章
./data/articles/insurance-d/
├── 保险科普/
│   ├── article1.txt
│   └── article2.md
├── 产品介绍/
│   └── product1.txt
└── 理赔案例/
    └── case1.txt

# Agent D 文章
./data/articles/agent-d/
├── AI技术/
│   ├── chatgpt.txt
│   └── midjourney.md
├── 编程教程/
│   └── react.txt
└── 技术博客/
    └── blog1.txt
```

### 2. URL 文章

支持从以下来源抓取文章：
- 微信公众号 (`mp.weixin.qq.com`)
- 掘金 (`juejin.cn`)
- 知乎 (`zhihu.com`)
- CSDN (`csdn.net`)
- GitHub (`github.com`)
- 自定义 URL

## 使用 API 学习

### 1. 从 URL 学习

**接口**: `POST /api/style-analyzer/fetch-and-learn`

**请求**:
```bash
curl -X POST http://localhost:5000/api/style-analyzer/fetch-and-learn \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://mp.weixin.qq.com/s/xxx",
      "https://juejin.cn/post/xxx",
      "https://zhihu.com/question/xxx"
    ],
    "categoryName": "保险科普",
    "agent": "insurance-d"
  }'
```

**响应**:
```json
{
  "success": true,
  "data": {
    "template": {
      "id": "style_insurance-d_保险科普_xxx",
      "name": "保险科普风格模板",
      "features": {...},
      "confidence": 0.85
    },
    "summary": "基于 3 篇文章分析生成的保险科普风格模板...",
    "recommendations": [...],
    "statistics": {
      "totalUrls": 3,
      "successCount": 3,
      "failCount": 0
    }
  }
}
```

### 2. 上传单个文件学习

**接口**: `POST /api/style-analyzer/upload-and-learn`

**请求**:
```bash
curl -X POST http://localhost:5000/api/style-analyzer/upload-and-learn \
  -F "file=@article1.txt" \
  -F "categoryName=保险科普" \
  -F "agent=insurance-d" \
  -F "saveFile=true"
```

**参数说明**:
- `file`: 上传的文件
- `categoryName`: 分类名称
- `agent`: Agent 类型（insurance-d 或 agent-d）
- `saveFile`: 是否保存文件到本地（true/false）

### 3. 批量上传文件学习

**接口**: `POST /api/style-analyzer/upload-batch`

**请求**:
```bash
curl -X POST http://localhost:5000/api/style-analyzer/upload-batch \
  -F "file1=@article1.txt" \
  -F "file2=@article2.txt" \
  -F "file3=@article3.txt" \
  -F "categoryName=AI技术" \
  -F "agent=agent-d" \
  -F "saveFiles=true"
```

**注意事项**:
- 文件命名格式：`file1`, `file2`, `file3`, ...
- 单次最多支持 10 个文件

## 配置示例

### insurance-d 配置示例

#### 场景 1: 使用本地文件

```typescript
{
  agent: 'insurance-d',
  sources: [
    {
      id: 'insurance-article-1',
      type: 'file',
      path: './data/articles/insurance-d/保险科普/重疾险入门.txt',
      agent: 'insurance-d',
      category: '保险科普',
      description: '重疾险入门教程',
      enabled: true,
    },
    {
      id: 'insurance-article-2',
      type: 'file',
      path: './data/articles/insurance-d/产品介绍/百万医疗险.txt',
      agent: 'insurance-d',
      category: '产品介绍',
      description: '百万医疗险产品介绍',
      enabled: true,
    },
  ],
  autoLearnEnabled: false,
  autoLearnSchedule: '0 2 * * *',
  maxArticlesPerLearn: 10,
}
```

#### 场景 2: 使用 URL 来源

```typescript
{
  agent: 'insurance-d',
  sources: [
    {
      id: 'insurance-wechat-1',
      type: 'url',
      path: 'https://mp.weixin.qq.com/s/abc123',
      agent: 'insurance-d',
      category: '保险科普',
      description: '微信公众号文章 - 重疾险攻略',
      enabled: true,
    },
    {
      id: 'insurance-zhihu-1',
      type: 'url',
      path: 'https://zhuanlan.zhihu.com/p/def456',
      agent: 'insurance-d',
      category: '保险科普',
      description: '知乎专栏 - 如何购买保险',
      enabled: true,
    },
  ],
  autoLearnEnabled: true,  // 启用自动学习
  autoLearnSchedule: '0 2 * * *',  // 每天凌晨2点自动学习
  maxArticlesPerLearn: 10,
}
```

#### 场景 3: 混合来源

```typescript
{
  agent: 'insurance-d',
  sources: [
    {
      id: 'insurance-local-1',
      type: 'file',
      path: './data/articles/insurance-d/sample1.txt',
      agent: 'insurance-d',
      category: '保险科普',
      description: '本地文章',
      enabled: true,
    },
    {
      id: 'insurance-url-1',
      type: 'url',
      path: 'https://mp.weixin.qq.com/s/abc123',
      agent: 'insurance-d',
      category: '保险科普',
      description: '微信公众号文章',
      enabled: true,
    },
  ],
  autoLearnEnabled: false,
  autoLearnSchedule: '0 2 * * *',
  maxArticlesPerLearn: 10,
}
```

### Agent D 配置示例

#### 场景 1: 使用本地文件

```typescript
{
  agent: 'agent-d',
  sources: [
    {
      id: 'ai-tech-local-1',
      type: 'file',
      path: './data/articles/agent-d/AI技术/ChatGPT教程.txt',
      agent: 'agent-d',
      category: 'AI技术',
      description: 'ChatGPT 使用教程',
      enabled: true,
    },
    {
      id: 'ai-tech-local-2',
      type: 'file',
      path: './data/articles/agent-d/编程教程/React入门.txt',
      agent: 'agent-d',
      category: '编程教程',
      description: 'React 框架入门',
      enabled: true,
    },
  ],
  autoLearnEnabled: false,
  autoLearnSchedule: '0 3 * * *',
  maxArticlesPerLearn: 10,
}
```

#### 场景 2: 使用 URL 来源

```typescript
{
  agent: 'agent-d',
  sources: [
    {
      id: 'ai-tech-juejin-1',
      type: 'url',
      path: 'https://juejin.cn/post/7123456789',
      agent: 'agent-d',
      category: 'AI技术',
      description: '掘金 - 深入理解 GPT-4',
      enabled: true,
    },
    {
      id: 'ai-tech-github-1',
      type: 'url',
      path: 'https://github.com/openai/gpt-4/discussions',
      agent: 'agent-d',
      category: 'AI技术',
      description: 'GitHub - GPT-4 讨论',
      enabled: true,
    },
  ],
  autoLearnEnabled: true,
  autoLearnSchedule: '0 3 * * *',
  maxArticlesPerLearn: 10,
}
```

## 目录结构

```
workspace/projects/
├── src/
│   ├── config/
│   │   └── style-learning.config.ts    # 主配置文件
│   └── lib/
│       └── style-analyzer/             # 风格分析器模块
│           ├── types.ts
│           ├── analyzer.ts
│           ├── learner.ts
│           └── index.ts
├── data/
│   └── articles/                       # 文章存储目录
│       ├── insurance-d/                # insurance-d 文章
│       │   ├── 保险科普/
│       │   ├── 产品介绍/
│       │   └── 理赔案例/
│       └── agent-d/                    # Agent D 文章
│           ├── AI技术/
│           ├── 编程教程/
│           └── 技术博客/
└── STYLE_LEARNING_CONFIG.md            # 本文档
```

## 快速开始

### 1. 创建文章目录

```bash
mkdir -p data/articles/insurance-d/保险科普
mkdir -p data/articles/agent-d/AI技术
```

### 2. 添加示例文章

```bash
# insurance-d 示例文章
echo "大家好！今天我们来聊聊保险..." > data/articles/insurance-d/保险科普/article1.txt

# Agent D 示例文章
echo "ChatGPT 是基于 GPT-3.5 架构的大语言模型..." > data/articles/agent-d/AI技术/article1.txt
```

### 3. 使用 API 学习

```bash
# 学习 insurance-d 文章
curl -X POST http://localhost:5000/api/style-analyzer/learn \
  -H "Content-Type: application/json" \
  -d '{
    "articles": ["大家好！今天我们来聊聊保险..."],
    "categoryName": "保险科普"
  }'

# 学习 Agent D 文章
curl -X POST http://localhost:5000/api/style-analyzer/learn \
  -H "Content-Type: application/json" \
  -d '{
    "articles": ["ChatGPT 是基于 GPT-3.5 架构的大语言模型..."],
    "categoryName": "AI技术"
  }'
```

## 注意事项

1. **文件格式**: 支持 `.txt`, `.md`, `.json`, `.html` 格式
2. **文件大小**: 单个文件建议不超过 1MB
3. **文章长度**: 文章内容至少 50 个字符
4. **URL 限制**: 单次最多支持 10 个 URL
5. **批量上传**: 单次最多支持 10 个文件
6. **自动学习**: 需要启用 `autoLearnEnabled` 并配置定时任务
7. **地区限制**: URL 抓取可能受地区限制，建议使用本地文件

## 常见问题

### Q1: 如何批量导入大量文章？

**A**: 使用批量上传 API 或将文件放到对应目录，然后调用学习 API。

### Q2: URL 抓取失败怎么办？

**A**:
1. 检查 URL 是否可访问
2. 检查是否存在地区限制
3. 考虑使用本地文件替代

### Q3: 如何定期更新风格模板？

**A**:
1. 启用 `autoLearnEnabled`
2. 配置 `autoLearnSchedule`（使用 cron 表达式）
3. 定期上传新文章到对应目录

### Q4: 如何查看已学习的风格模板？

**A**: 使用以下 API：
```bash
# 获取所有模板
curl http://localhost:5000/api/style-analyzer/templates

# 获取指定模板
curl http://localhost:5000/api/style-analyzer/templates/{templateId}
```

### Q5: 如何删除风格模板？

**A**:
```bash
curl -X DELETE http://localhost:5000/api/style-analyzer/templates/{templateId}
```

## 进阶功能

### 1. 定时任务

配置自动学习后，需要实现定时任务（可以使用 node-cron）：

```typescript
import cron from 'node-cron';

// 每天凌晨 2 点学习 insurance-d 文章
cron.schedule('0 2 * * *', async () => {
  console.log('开始学习 insurance-d 文章...');
  // 调用学习 API
});

// 每天凌晨 3 点学习 Agent D 文章
cron.schedule('0 3 * * *', async () => {
  console.log('开始学习 Agent D 文章...');
  // 调用学习 API
});
```

### 2. 风格模板版本管理

为每个风格模板添加版本号，支持版本回滚：

```typescript
interface StyleTemplateVersion {
  version: string;
  template: StyleTemplate;
  createdAt: number;
}
```

### 3. 风格对比

对比两个风格模板的差异：

```bash
curl -X POST http://localhost:5000/api/style-analyzer/compare \
  -H "Content-Type: application/json" \
  -d '{
    "templateId1": "style_xxx",
    "templateId2": "style_yyy"
  }'
```
