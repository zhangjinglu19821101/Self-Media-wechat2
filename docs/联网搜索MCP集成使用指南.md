# 联网搜索 MCP 集成使用指南

## 📋 概述

本文档说明如何将联网搜索能力快速集成到当前项目的 MCP 能力体系中。

## 🎯 已完成的工作

### 1. **数据库层** - capability_list 表更新
- ✅ 已添加 **4 条**搜索相关的能力记录
- ✅ 能力类型：`search` 和 `data_acquire`
- ✅ 包含功能：
  - 联网搜索-网页搜索
  - 联网搜索-网页搜索带摘要
  - 联网搜索-图片搜索
  - 热点数据爬取

### 2. **工具层** - 联网搜索 MCP 工具封装
- ✅ 创建 `src/lib/mcp/search-tools.ts`
- ✅ 封装了完整的搜索 API 调用
- ✅ 包含类型安全的参数和返回值定义
- ✅ 提供 `SearchMCPTools` 工具集

### 3. **MCP Server 层** - 集成搜索工具
- ✅ 更新 `src/lib/mcp/server.ts`
- ✅ 添加了 **3 个**搜索 MCP 工具：
  - `web_search` - 网页搜索
  - `web_search_with_summary` - 网页搜索带AI摘要
  - `image_search` - 图片搜索
- ✅ 支持权限控制和审计日志

## 📚 能力清单

### capability_list 表中的搜索能力

| ID | 能力类型 | 功能描述 | 是否需现场执行 |
|----|---------|---------|--------------|
| - | search | 联网搜索-网页搜索 | ❌ |
| - | search | 联网搜索-网页搜索带摘要 | ❌ |
| - | search | 联网搜索-图片搜索 | ❌ |
| - | data_acquire | 热点数据爬取 | ❌ |

## 🛠️ 使用方式

### 方式 1：通过 MCP Server 使用（推荐）

#### 1. 网页搜索
```typescript
import { createMCPServer } from '@/lib/mcp/server';

// 创建 MCP Server
const server = await createMCPServer('agent_b');

// 调用工具
const result = await server.callTool({
  name: 'web_search',
  arguments: {
    query: '人工智能最新发展',
    count: 10,
    needContent: false,
    agentId: 'insurance-d',
  },
});
```

#### 2. 网页搜索带摘要
```typescript
const result = await server.callTool({
  name: 'web_search_with_summary',
  arguments: {
    query: '什么是机器学习',
    count: 5,
    needContent: true,
    agentId: 'insurance-d',
  },
});
```

#### 3. 图片搜索
```typescript
const result = await server.callTool({
  name: 'image_search',
  arguments: {
    query: '可爱的猫咪',
    count: 10,
    agentId: 'insurance-d',
  },
});
```

### 方式 2：直接使用工具函数

```typescript
import { SearchMCPTools } from '@/lib/mcp/search-tools';

// 1. 网页搜索
const webResult = await SearchMCPTools.webSearch({
  query: '人工智能最新发展',
  count: 10,
});

// 2. 网页搜索带摘要
const summaryResult = await SearchMCPTools.webSearchWithSummary({
  query: '什么是机器学习',
  count: 5,
});

// 3. 图片搜索
const imageResult = await SearchMCPTools.imageSearch({
  query: '可爱的猫咪',
  count: 10,
});
```

### 方式 3：通过现有的搜索 API

```typescript
// 直接调用已有的搜索 API
const response = await fetch(
  'http://localhost:5000/api/search?q=人工智能&type=web_summary&count=10'
);
const result = await response.json();
```

## 🔄 与 MCP 能力体系的集成流程

### 完整的 Agent 交互流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    执行 Agent (insurance-d)                      │
│         发现需要搜索信息，但无搜索能力                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ 1. 输出标准化结果
                       │    {
                       │      isNeedAgentB: true,
                       │      problemDescription: "需要搜索最新信息",
                       │      extInfo: {
                       │        capabilityType: "search",
                       │        isNeedMcp: true
                       │      }
                       │    }
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                         控制器                                    │
│         2. 保存交互记录到 agent_sub_tasks_step_history          │
│         3. 查询 capability_list 表                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ 4. 提供能力清单给 Agent B
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Agent B                                    │
│         5. 分析并选择解决方案（solution_num）                    │
│         6. 输出标准化结果                                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ 7. 控制器根据 solution_num 执行对应操作
                       │    - 调用 web_search MCP 工具
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                      MCP Server                                   │
│         8. 执行搜索工具，返回搜索结果                             │
│         9. 返回执行结果                                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ 10. 将结果反馈给执行 Agent
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                    执行 Agent (insurance-d)                      │
│         11. 收到结果，继续执行任务                               │
└─────────────────────────────────────────────────────────────────┘
```

## 📝 API 说明

### 搜索 API 端点

**基础 URL**: `http://localhost:5000/api/search`

### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| q | string | 是 | - | 搜索查询词 |
| count | integer | 否 | 10 | 结果数量（1-50） |
| type | string | 否 | web_summary | 搜索类型：web/web_summary/image |
| needContent | boolean | 否 | false | 是否获取完整内容 |
| agentId | string | 否 | - | Agent ID（用于记录） |

### 响应格式

```typescript
{
  success: boolean;
  data?: {
    query: string;
    type: string;
    count: number;
    agentId?: string;
    timestamp: string;
    result: {
      web_items?: Array<{
        title: string;
        url: string;
        content?: string;
        summary?: string;
        published_time?: string;
        author?: string;
      }>;
      image_items?: Array<{
        url: string;
        title?: string;
        thumbnail_url?: string;
        width?: number;
        height?: number;
      }>;
      summary?: string;
    };
  };
  error?: string;
  message?: string;
}
```

## 🔐 安全机制

### 1. 权限控制
- ✅ 仅 Agent B 可调用搜索 MCP 工具
- ✅ 查询词长度验证
- ✅ 结果数量范围限制（1-50）

### 2. 审计日志
- ✅ 所有 MCP 工具调用都记录审计日志
- ✅ 包含时间戳、Agent ID、工具名称、参数、结果

### 3. 参数验证
- ✅ 所有输入参数都经过验证
- ✅ 查询词非空检查
- ✅ 结果数量范围检查

## 🧪 测试

### 测试数据库中的能力
```bash
# 查询 capability_list 表中的搜索能力
cd /workspace/projects
./db.sh "SELECT * FROM capability_list WHERE capability_type IN ('search', 'data_acquire');"
```

### 测试搜索 API
```bash
# 测试网页搜索
curl "http://localhost:5000/api/search?q=人工智能&type=web&count=5"

# 测试网页搜索带摘要
curl "http://localhost:5000/api/search?q=什么是机器学习&type=web_summary&count=3"

# 测试图片搜索
curl "http://localhost:5000/api/search?q=可爱的猫咪&type=image&count=10"
```

### 测试 MCP 工具
```typescript
// 创建测试文件 src/test-search-mcp.ts
import { SearchMCPTools } from '@/lib/mcp/search-tools';

async function testSearchMCP() {
  // 1. 测试网页搜索
  const webResult = await SearchMCPTools.webSearch({
    query: '人工智能最新发展',
    count: 10,
  });
  console.log('网页搜索结果:', webResult);

  // 2. 测试网页搜索带摘要
  const summaryResult = await SearchMCPTools.webSearchWithSummary({
    query: '什么是机器学习',
    count: 5,
  });
  console.log('摘要搜索结果:', summaryResult);

  // 3. 测试图片搜索
  const imageResult = await SearchMCPTools.imageSearch({
    query: '可爱的猫咪',
    count: 10,
  });
  console.log('图片搜索结果:', imageResult);
}

testSearchMCP();
```

## 📚 相关文件

### 核心文件
- `src/app/api/search/route.ts` - 搜索 API（已存在）
- `src/lib/mcp/search-tools.ts` - 搜索 MCP 工具封装（新建）
- `src/lib/mcp/server.ts` - MCP Server（已集成搜索工具）

### 数据库文件
- `scripts/migrations/001_create_capability_list_table.sql` - capability_list 表迁移
- `db.sh` - 数据库查询工具

### 文档文件
- `docs/详细设计文档agent智能交互MCP能力设计capability_type.md` - MCP 能力设计文档
- `docs/联网搜索MCP集成使用指南.md` - 本文档
- `docs/微信公众号MCP集成使用指南.md` - 微信公众号集成文档

## 🎉 总结

联网搜索能力已成功集成到 MCP 能力体系中！现在可以：

1. ✅ 通过 capability_list 表管理搜索能力
2. ✅ 通过 MCP Server 调用搜索工具
3. ✅ 支持完整的 Agent 交互流程（执行 Agent → Agent B → MCP）
4. ✅ 具备完善的安全机制和审计日志
5. ✅ 支持三种搜索类型：网页搜索、网页搜索带摘要、图片搜索

**下一步**：在实际的 Agent 业务逻辑中集成这些能力！
