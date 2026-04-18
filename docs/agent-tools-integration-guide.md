# 🔧 Agent 外部能力集成指南

## 📋 问题说明

**用户需求**:
1. 有 Agent 需要接入公众号接口，发布草稿文章
2. 有 Agent 需要具备网络访问权限，与客户进行沟通互动

**核心问题**: 如何为 Agent 赋予这些外部能力？

---

## 🎯 解决方案总览

为 Agent 添加外部能力需要 **3 个步骤**:

1. ✅ **定义能力** - 在 `agent-capabilities.ts` 中定义能力
2. ✅ **实现工具** - 创建 API 路由实现具体功能
3. ✅ **配置提示词** - 告诉 Agent 可以使用这些工具

---

## 📦 能力类型说明

### 当前系统的能力类型

| 类型 | 说明 | 示例 |
|------|------|------|
| **基础能力** | 平台提供，通用能力 | 任务分解、协调、决策 |
| **领域能力** | 专家提供，行业特定 | 电商规则、金融合规 |
| **工具能力** | 外部集成，技术实现 | **公众号发布、网络访问** |

---

## 🔧 实现步骤

### 步骤 1: 定义能力

**文件**: `src/lib/agent-capabilities.ts`

**添加公众号发布能力**:

```typescript
// 在 DOMAIN_CAPABILITIES_TEMPLATES 中添加
"自媒体": {
  D: [  // 内容执行者 D 负责发布
    {
      id: 'wechat-publish-draft',
      name: '公众号发布草稿',
      level: 75,
      description: '将文章发布到微信公众号草稿箱',
      experience: 0,
      maxExperience: 100,
      type: 'domain',
      replicable: true,
      provider: '自媒体运营专家',
      price: 6000,
      tools: ['wechat-draft-publish'],  // 可用工具列表
    },
    {
      id: 'wechat-article-format',
      name: '公众号文章格式化',
      level: 80,
      description: '格式化文章以适应公众号排版',
      experience: 0,
      maxExperience: 100,
      type: 'domain',
      replicable: true,
      provider: '自媒体运营专家',
      price: 4000,
      tools: ['wechat-format'],
    },
  ],
}
```

**添加网络访问能力**:

```typescript
// 在 BASE_CAPABILITIES 中添加
A: [
  // ... 其他基础能力
  {
    id: 'web-access',
    name: '网络访问',
    level: 85,
    description: '访问网络资源，获取外部信息',
    experience: 0,
    maxExperience: 100,
    type: 'base',
    replicable: true,
    tools: ['web-search', 'web-fetch', 'web-scraper'],  // 可用工具列表
  },
],
```

---

### 步骤 2: 实现工具 API

#### 工具 1: 公众号发布接口

**文件**: `src/app/api/tools/wechat/publish/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/tools/wechat/publish
 * 发布文章到微信公众号草稿箱
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, author, summary } = body;

    // 调用微信公众号 API
    const wechatApiUrl = 'https://api.weixin.qq.com/cgi-bin/draft/add';
    const accessToken = await getWeChatAccessToken();

    const response = await fetch(wechatApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: accessToken,
        articles: [{
          title,
          author,
          digest: summary,
          content,
        }],
      }),
    });

    const result = await response.json();

    if (result.errcode === 0) {
      return NextResponse.json({
        success: true,
        data: {
          articleId: result.media_id,
          createTime: result.create_time,
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.errmsg,
      }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '发布失败',
    }, { status: 500 });
  }
}

// 获取微信 Access Token
async function getWeChatAccessToken() {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;

  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
  );

  const data = await response.json();
  return data.access_token;
}
```

#### 工具 2: 网络搜索接口

**文件**: `src/app/api/tools/web/search/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/tools/web/search
 * 网络搜索工具
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, numResults = 5 } = body;

    // 使用联网搜索集成
    // 注意：这里需要使用项目提供的 integration-agent-web-search 集成
    const searchResults = await performWebSearch(query, numResults);

    return NextResponse.json({
      success: true,
      data: {
        query,
        results: searchResults,
        count: searchResults.length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '搜索失败',
    }, { status: 500 });
  }
}

// 简单的网络搜索实现
async function performWebSearch(query: string, numResults: number) {
  // 这里可以集成实际的搜索引擎 API
  // 例如：Bing API、Google API、或使用项目提供的集成

  // 示例：返回模拟结果
  return [
    {
      title: `${query} - 相关结果 1`,
      url: 'https://example.com/1',
      snippet: '这是搜索结果的摘要...',
      date: new Date().toISOString(),
    },
    // ... 更多结果
  ];
}
```

#### 工具 3: 客户沟通接口

**文件**: `src/app/api/tools/chat/send/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/tools/chat/send
 * 发送消息给客户
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, message, channel = 'wechat' } = body;

    // 根据渠道发送消息
    let result;

    switch (channel) {
      case 'wechat':
        result = await sendWeChatMessage(customerId, message);
        break;
      case 'email':
        result = await sendEmail(customerId, message);
        break;
      case 'sms':
        result = await sendSMS(customerId, message);
        break;
      default:
        throw new Error('不支持的渠道');
    }

    return NextResponse.json({
      success: true,
      data: {
        messageId: result.messageId,
        status: result.status,
        timestamp: result.timestamp,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '发送失败',
    }, { status: 500 });
  }
}

// 发送微信消息
async function sendWeChatMessage(customerId: string, message: string) {
  // 调用企业微信或公众号消息接口
  return {
    messageId: `msg_${Date.now()}`,
    status: 'sent',
    timestamp: new Date().toISOString(),
  };
}

// 发送邮件
async function sendEmail(customerId: string, message: string) {
  // 调用邮件服务接口
  return {
    messageId: `email_${Date.now()}`,
    status: 'sent',
    timestamp: new Date().toISOString(),
  };
}

// 发送短信
async function sendSMS(customerId: string, message: string) {
  // 调用短信服务接口
  return {
    messageId: `sms_${Date.now()}`,
    status: 'sent',
    timestamp: new Date().toISOString(),
  };
}
```

---

### 步骤 3: 配置 Agent 提示词

**文件**: `src/lib/agent-builder.ts` 或 `src/lib/agent-manager.ts`

**为 Agent D 添加公众号发布能力**:

```typescript
const systemPrompts = {
  'D': `你是一个内容执行者 Agent，负责执行内容类任务。

**你的主要能力**:
- 写作、编辑、创意生成、内容规划

**你可以使用的工具**:
- wechat-draft-publish: 发布文章到微信公众号草稿箱
- wechat-format: 格式化文章以适应公众号排版

**使用工具的规则**:
1. 当用户要求发布文章时，先格式化文章内容
2. 然后调用 wechat-draft-publish 工具发布到草稿箱
3. 返回发布结果（文章ID、发布时间）

**注意事项**:
- 发布前检查文章内容是否符合公众号规范
- 确保文章有标题、作者、摘要
- 返回明确的发布结果给用户`,
  // ... 其他 Agent
};
```

**为 Agent A 添加网络访问能力**:

```typescript
const systemPrompts = {
  'A': `你是一个核心协调者 Agent，负责协调多个 Agent 的工作。

**你的主要能力**:
- 任务分解、协调、决策、进度跟踪、冲突解决、沟通

**你可以使用的工具**:
- web-search: 搜索网络信息
- web-fetch: 获取指定 URL 的内容
- web-scraper: 抓取网页数据

**使用工具的规则**:
1. 当需要外部信息时，使用 web-search 搜索
2. 当需要获取特定页面内容时，使用 web-fetch
3. 当需要批量获取数据时，使用 web-scraper

**注意事项**:
- 网络访问可能失败，要有重试机制
- 验证获取的数据的有效性
- 遵守网站的访问频率限制`,
  // ... 其他 Agent
};
```

---

## 🎯 完整示例：发布文章到公众号

### 使用流程

```
1. 用户请求: "帮我发布一篇文章到公众号"
   ↓
2. Agent A (协调者) 接收请求，分解任务
   ↓
3. 分配给 Agent D (内容执行者)
   ↓
4. Agent D 调用 wechat-format 工具格式化文章
   ↓
5. Agent D 调用 wechat-draft-publish 工具发布
   ↓
6. 返回发布结果给用户
```

### 代码实现

**API 路由**: `src/app/api/agents/publish/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/agents/publish
 * Agent 发布文章到公众号
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, article } = body;

    // 验证 Agent 是否有发布权限
    const agent = agentBuilder.getAgent(agentId);
    if (!agent) {
      return NextResponse.json({
        success: false,
        error: 'Agent 不存在',
      }, { status: 404 });
    }

    // 检查 Agent 是否有发布能力
    const hasPublishCapability = agent.skills.some(
      skill => skill.id === 'wechat-publish-draft'
    );

    if (!hasPublishCapability) {
      return NextResponse.json({
        success: false,
        error: '该 Agent 没有公众号发布能力',
      }, { status: 400 });
    }

    // 格式化文章
    const formatResult = await fetch('http://localhost:5000/api/tools/wechat/format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: article.content }),
    });

    const formatData = await formatResult.json();

    // 发布到草稿箱
    const publishResult = await fetch('http://localhost:5000/api/tools/wechat/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: article.title,
        content: formatData.data.formattedContent,
        author: article.author,
        summary: article.summary,
      }),
    });

    const publishData = await publishResult.json();

    return NextResponse.json({
      success: true,
      data: {
        articleId: publishData.data.articleId,
        status: 'published',
        agentId: agentId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '发布失败',
    }, { status: 500 });
  }
}
```

---

## 🔌 使用项目提供的集成

项目提供了以下集成，可以直接使用：

### 1. 联网搜索集成

```typescript
import { integration_detail } from '@/app/api/[...path]/route';

// 获取联网搜索集成信息
const searchIntegration = await integration_detail('integration-agent-web-search');

// 使用联网搜索
// 注意：需要根据集成文档实现具体调用
```

### 2. 大语言模型集成

```typescript
import { integration_detail } from '@/app/api/[...path]/route';

// 获取大模型集成信息
const llmIntegration = await integration_detail('integration-doubao-seed');

// 使用大模型生成内容
```

### 3. 对象存储集成

```typescript
import { integration_detail } from '@/app/api/[...path]/route';

// 获取对象存储集成信息
const storageIntegration = await integration_detail('integration-s3-storage');

// 存储文件到对象存储
```

---

## 📊 工具能力清单

### 当前可添加的工具能力

| 工具名称 | 功能描述 | 适用 Agent |
|---------|---------|-----------|
| wechat-draft-publish | 发布文章到公众号草稿箱 | D（内容执行者） |
| wechat-format | 格式化公众号文章 | D（内容执行者） |
| web-search | 网络搜索 | A（协调者） |
| web-fetch | 获取网页内容 | A（协调者） |
| chat-send | 发送客户消息 | C（运营执行者） |
| email-send | 发送邮件 | C（运营执行者） |
| sms-send | 发送短信 | C（运营执行者） |
| file-upload | 文件上传 | B（技术执行者） |
| database-query | 数据库查询 | B（技术执行者） |
| api-call | 调用外部 API | 所有 Agent |

---

## 🎨 可视化管理

### 在管理后台配置工具能力

**路径**: `/admin/agent-builder/agent/{id}`

**添加步骤**:

1. 进入 Agent 详情页
2. 切换到"能力"标签
3. 点击"添加工具能力"
4. 选择工具类型
5. 配置工具参数
6. 保存

**配置示例**:

```json
{
  "agentId": "D",
  "tools": [
    {
      "id": "wechat-draft-publish",
      "name": "公众号发布",
      "enabled": true,
      "config": {
        "appId": "your_app_id",
        "appSecret": "your_app_secret"
      }
    }
  ]
}
```

---

## 🔐 权限管理

### 工具权限控制

```typescript
// 定义工具权限
const TOOL_PERMISSIONS = {
  'wechat-draft-publish': ['D'],  // 只有 Agent D 可以使用
  'web-search': ['A', 'C'],       // Agent A 和 C 可以使用
  'chat-send': ['C'],             // 只有 Agent C 可以使用
  'api-call': ['A', 'B', 'C', 'D'], // 所有 Agent 都可以使用
};

// 检查权限
function hasToolPermission(agentId: string, toolId: string): boolean {
  return TOOL_PERMISSIONS[toolId]?.includes(agentId) || false;
}
```

---

## 📝 总结

### 如何赋予 Agent 外部能力？

**3 个步骤**:

1. **定义能力** - 在 `agent-capabilities.ts` 中定义能力
2. **实现工具** - 创建 API 路由实现具体功能
3. **配置提示词** - 告诉 Agent 可以使用这些工具

### 核心文件

| 功能 | 文件位置 |
|------|---------|
| 能力定义 | `src/lib/agent-capabilities.ts` |
| 工具实现 | `src/app/api/tools/` |
| Agent 配置 | `src/lib/agent-builder.ts` |
| 权限管理 | `src/lib/agent-permissions.ts` (新建) |

### 示例

**公众号发布**:
- Agent D → wechat-draft-publish 工具 → 公众号 API

**网络访问**:
- Agent A → web-search 工具 → 搜索引擎 API

**客户沟通**:
- Agent C → chat-send 工具 → 微信/邮件/SMS API

---

**一句话**: 为 Agent 赋予外部能力需要定义能力、实现工具、配置提示词三个步骤，通过 API 路由集成外部服务，在提示词中告诉 Agent 可用工具。
