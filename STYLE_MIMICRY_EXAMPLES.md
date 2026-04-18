# 风格模仿功能使用示例

## 快速开始

### 方式 1: 通过 API 调用（推荐用于自动化）

```javascript
// 1. 上传文章并学习风格
async function learnStyle() {
  const response = await fetch('/api/style-analyzer/learn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articles: [
        '你的第一篇保险科普文章...',
        '你的第二篇保险科普文章...',
        '你的第三篇保险科普文章...'
      ],
      categoryName: '保险科普'
    })
  });

  const { data } = await response.json();
  const templateId = data.template.id;
  console.log('风格模板已创建:', templateId);
  return templateId;
}

// 2. 使用风格模板生成新文章
async function generateWithStyle(templateId, topic) {
  const response = await fetch('/api/style-analyzer/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: templateId,
      topic: topic,
      additionalInstructions: '增加实际案例，让内容更生动'
    })
  });

  const { data } = await response.json();
  console.log('生成的文章:', data.article);
  return data.article;
}

// 使用示例
(async () => {
  const templateId = await learnStyle();
  const article = await generateWithStyle(templateId, '如何选择重疾险');
  console.log(article);
})();
```

### 方式 2: 通过 insurance-d Agent 对话

在聊天界面中，可以直接向 insurance-d 发送指令：

```
请按照之前的保险科普文章风格，写一篇关于"少儿保险配置"的文章
```

insurance-d 会自动：
1. 加载最新的风格模板
2. 分析风格特征
3. 按照该风格生成新文章

### 方式 3: 批量处理（适用于大量文章）

```javascript
async function batchProcess() {
  // 读取所有文章
  const articles = [
    // 从数据库或文件读取
  ];

  // 上传文章并学习风格
  const response = await fetch('/api/style-analyzer/learn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articles: articles,
      categoryName: '保险科普'
    })
  });

  const { data } = await response.json();
  const templateId = data.template.id;

  // 批量生成新文章
  const topics = [
    '如何选择医疗险',
    '重疾险的常见误区',
    '意外险的保障范围',
    '寿险的必要性'
  ];

  for (const topic of topics) {
    const article = await generateWithStyle(templateId, topic);
    console.log(`已生成文章: ${topic}`);
  }
}
```

## 完整示例：从零开始

### 前端页面示例（React）

```tsx
'use client';

import { useState } from 'react';

export default function StyleMimicryDemo() {
  const [articles, setArticles] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [topic, setTopic] = useState('');
  const [generatedArticle, setGeneratedArticle] = useState('');
  const [loading, setLoading] = useState(false);

  // 上传文章并学习风格
  const handleLearnStyle = async () => {
    setLoading(true);
    try {
      const articleList = articles
        .split('\n---\n')
        .filter(a => a.trim());

      const response = await fetch('/api/style-analyzer/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles: articleList,
          categoryName: '保险科普'
        })
      });

      const data = await response.json();
      if (data.success) {
        setTemplateId(data.data.template.id);
        alert(`风格学习成功！模板 ID: ${data.data.template.id}`);
      } else {
        alert(`学习失败: ${data.error}`);
      }
    } catch (error) {
      alert('请求失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  // 生成文章
  const handleGenerate = async () => {
    if (!templateId || !topic) {
      alert('请先学习风格并输入主题');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/style-analyzer/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          topic,
          additionalInstructions: '增加实际案例'
        })
      });

      const data = await response.json();
      if (data.success) {
        setGeneratedArticle(data.data.article);
      } else {
        alert(`生成失败: ${data.error}`);
      }
    } catch (error) {
      alert('请求失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">风格模仿演示</h1>

      {/* 上传文章部分 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">1. 上传文章学习风格</h2>
        <textarea
          value={articles}
          onChange={(e) => setArticles(e.target.value)}
          placeholder="粘贴你的文章，每篇用 '---' 分隔"
          className="w-full h-40 p-3 border rounded-lg mb-4"
        />
        <button
          onClick={handleLearnStyle}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? '学习中...' : '学习风格'}
        </button>
      </div>

      {/* 生成文章部分 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">2. 按照风格生成文章</h2>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="输入文章主题"
          className="w-full p-3 border rounded-lg mb-4"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !templateId}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400"
        >
          {loading ? '生成中...' : '生成文章'}
        </button>
      </div>

      {/* 显示结果 */}
      {generatedArticle && (
        <div>
          <h2 className="text-xl font-semibold mb-4">生成的文章</h2>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="whitespace-pre-wrap">{generatedArticle}</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

## 风格特征说明

生成的风格模板包含以下 17 维特征：

1. **tone**: 语气（专业/亲切/幽默/严肃）
2. **complexity**: 复杂度（simple/moderate/complex）
3. **length**: 文章长度偏好（short/medium/long）
4. **vocabularyLevel**: 词汇水平（basic/intermediate/advanced）
5. **sentenceStructure**: 句式结构（simple/mixed/complex）
6. **punctuationStyle**: 标点风格（minimal/standard/rich）
7. **contentStructure**: 内容结构（如：引言-正文-结论）
8. **typicalSections**: 典型段落类型
9. **useOfExamples**: 案例使用频率（none/few/many）
10. **useOfMetaphors**: 比喻使用（none/occasional/frequent）
11. **useOfData**: 数据使用（none/minimal/moderate/extensive）
12. **useOfQuotes**: 引用使用（none/occasional/frequent）
13. **commonKeywords**: 常用关键词
14. **keyPhrases**: 关键短语
15. **titleStyle**: 标题风格
16. **averageParagraphLength**: 平均段落长度
17. **paragraphCount**: 段落数量

## 最佳实践

### 1. 提供高质量样本文章

```javascript
// ✅ 好的样本：风格一致、质量高
const goodArticles = [
  '文章1：专业的保险科普文章...',
  '文章2：同样风格的保险科普文章...',
  '文章3：保持一致的保险科普文章...'
];

// ❌ 差的样本：风格混乱
const badArticles = [
  '文章1：专业风格的保险文章...',
  '文章2：随意风格的保险文章...',
  '文章3：完全不同风格的文章...'
];
```

### 2. 分类管理风格模板

```javascript
// 为不同类型文章创建不同模板
const templates = {
  '保险科普': await learnStyle科普Articles(),
  '产品介绍': await learnStyle产品Articles(),
  '案例分析': await learnStyle案例Articles()
};
```

### 3. 定期更新风格

```javascript
// 每月更新一次风格模板
async function updateStyleMonthly() {
  const newArticles = await getRecentArticles();
  const templateId = await learnStyle(newArticles);
  console.log('风格模板已更新:', templateId);
}
```

### 4. 使用额外指令增强效果

```javascript
await generateWithStyle(templateId, topic, '增加实际案例，使用数据支撑');
```

## 故障排除

### 问题：生成的文章风格不一致

**原因**：样本文章数量不足或风格不一致

**解决**：
```javascript
// 提供更多样本（建议 5 篇以上）
const articles = [
  // 至少 5 篇风格一致的高质量文章
];
```

### 问题：API 调用失败

**原因**：网络问题或服务未启动

**解决**：
```javascript
// 检查服务状态
async function checkHealth() {
  const response = await fetch('/api/system/health');
  console.log(await response.json());
}
```

## 进阶用法

### 风格混合

```javascript
// 混合多个风格模板（未来功能）
const mixedStyle = mergeStyles([template1, template2], [0.7, 0.3]);
```

### 风格对比

```javascript
// 对比两个风格模板
const diff = compareStyles(template1, template2);
console.log('风格差异:', diff);
```

### 集成到工作流

```javascript
// 每日自动生成文章
async function dailyArticleGeneration() {
  const template = await getLatestTemplate('保险科普');
  const topic = getRandomTopic();
  const article = await generateWithStyle(template.id, topic);
  await publishArticle(article);
}
```

## 注意事项

1. **样本质量**：提供高质量的样本文章，风格一致
2. **样本数量**：建议至少 3-5 篇，越多越好
3. **定期更新**：定期更新风格模板以保持一致性
4. **置信度检查**：关注模板的置信度（> 0.7 为佳）
5. **地区限制**：如果遇到 API 调用限制，可能是地区问题，需要配置合适的代理或 API 服务

## 获取帮助

如有问题，请查看：
- 完整文档：`STYLE_MIMICRY_GUIDE.md`
- API 文档：`/api/style-analyzer/`
- 测试脚本：`test-style-mimicry.sh`
