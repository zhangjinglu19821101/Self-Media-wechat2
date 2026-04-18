# 微信公众号 MCP 集成使用指南

## 📋 概述

本文档说明如何将微信公众号集成应用到当前项目的 MCP 能力体系中。

## 🎯 已完成的工作

### 1. **数据库层** - capability_list 表更新
- ✅ 已添加 5 条微信公众号相关的能力记录
- ✅ 能力类型：`platform_publish`
- ✅ 包含功能：添加草稿、获取草稿列表、删除草稿、上传图片素材、获取账号列表

### 2. **工具层** - 微信公众号 MCP 工具封装
- ✅ 创建 `src/lib/mcp/wechat-tools.ts`
- ✅ 封装了完整的微信公众号 API 调用
- ✅ 包含类型安全的参数和返回值定义

### 3. **MCP Server 层** - 集成微信公众号工具
- ✅ 更新 `src/lib/mcp/server.ts`
- ✅ 添加了 5 个微信公众号 MCP 工具
- ✅ 支持权限控制和审计日志

## 📚 能力清单

### capability_list 表中的微信公众号能力

| ID | 能力类型 | 功能描述 | 是否需现场执行 |
|----|---------|---------|--------------|
| - | platform_publish | 微信公众号-添加草稿 | ❌ |
| - | platform_publish | 微信公众号-获取草稿列表 | ❌ |
| - | platform_publish | 微信公众号-删除草稿 | ❌ |
| - | platform_publish | 微信公众号-上传图片素材 | ❌ |
| - | platform_publish | 微信公众号-获取账号列表 | ❌ |

## 🛠️ 使用方式

### 方式 1：通过 MCP Server 使用（推荐）

#### 1. 获取公众号账号列表
```typescript
import { createMCPServer } from '@/lib/mcp/server';

// 创建 MCP Server
const server = await createMCPServer('agent_b');

// 调用工具
const result = await server.callTool({
  name: 'wechat_get_accounts',
  arguments: {},
});
```

#### 2. 添加草稿
```typescript
const result = await server.callTool({
  name: 'wechat_add_draft',
  arguments: {
    accountId: 'insurance-account',
    articles: [
      {
        title: '保险科普文章标题',
        author: '保险科普',
        digest: '这是文章摘要',
        content: '<p>这是文章内容，支持HTML格式</p>',
        showCoverPic: 0,
      },
    ],
  },
});
```

#### 3. 获取草稿列表
```typescript
const result = await server.callTool({
  name: 'wechat_get_draft_list',
  arguments: {
    accountId: 'insurance-account',
    offset: 0,
    count: 20,
  },
});
```

#### 4. 删除草稿
```typescript
const result = await server.callTool({
  name: 'wechat_delete_draft',
  arguments: {
    accountId: 'insurance-account',
    mediaId: 'MEDIA_ID_HERE',
  },
});
```

#### 5. 上传图片素材
```typescript
const result = await server.callTool({
  name: 'wechat_upload_media',
  arguments: {
    accountId: 'insurance-account',
    mediaType: 'image',
    fileUrl: 'https://example.com/image.jpg',
    // 或者使用 fileBase64
    // fileBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
  },
});
```

### 方式 2：直接使用工具函数

```typescript
import { WechatMCPTools } from '@/lib/mcp/wechat-tools';

// 1. 获取账号列表
const accountsResult = await WechatMCPTools.getAccounts();

// 2. 添加草稿
const addDraftResult = await WechatMCPTools.addDraft({
  accountId: 'insurance-account',
  articles: [...],
});

// 3. 获取草稿列表
const draftListResult = await WechatMCPTools.getDraftList({
  accountId: 'insurance-account',
});
```

### 方式 3：通过现有的微信公众号 API

```typescript
import {
  addDraft,
  getDraftList,
  deleteDraft,
  uploadMedia,
} from '@/lib/wechat-official-account/api';
import { getAccountById } from '@/config/wechat-official-account.config';

const account = getAccountById('insurance-account');
if (account) {
  const result = await addDraft(account, articles);
}
```

## 🔄 与 MCP 能力体系的集成流程

### 完整的 Agent 交互流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    执行 Agent (insurance-d)                      │
│         发现需要发布微信公众号文章，但无发布能力                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ 1. 输出标准化结果
                       │    {
                       │      isNeedAgentB: true,
                       │      problemDescription: "微信公众号发布能力缺失",
                       │      extInfo: {
                       │        capabilityType: "platform_publish",
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
                       │    - 调用 wechat_add_draft MCP 工具
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                      MCP Server                                   │
│         8. 执行微信公众号工具，添加草稿                           │
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

## 📝 配置说明

### 公众号账号配置

文件位置：`src/config/wechat-official-account.config.ts`

```typescript
export const defaultWechatConfig: Record<string, WechatOfficialAccount> = {
  'insurance-account': {
    id: 'insurance-account',
    name: '保险科普公众号',
    appId: 'wxdb3ea2f8e0bb2496',  // 请填写真实的 AppID
    appSecret: '9dffee725f3ce4efbd66991a01898727',  // 请填写真实的 AppSecret
    agent: 'insurance-d',
    description: 'insurance-d 对应的保险科普公众号',
    enabled: true,
    defaultAuthor: '保险科普',
    defaultAuthorId: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  // ... 更多账号
};
```

**重要**：请确保填写真实的 AppID 和 AppSecret！

## 🔐 安全机制

### 1. 权限控制
- ✅ 仅 Agent B 可调用微信公众号 MCP 工具
- ✅ 公众号账号配置中 `enabled` 字段控制是否启用
- ✅ 隐藏敏感信息（AppSecret 在返回时被遮罩）

### 2. 审计日志
- ✅ 所有 MCP 工具调用都记录审计日志
- ✅ 包含时间戳、Agent ID、工具名称、参数、结果

### 3. 参数验证
- ✅ 所有输入参数都经过验证
- ✅ 账号存在性检查
- ✅ 账号启用状态检查

## 🧪 测试

### 测试数据库中的能力
```bash
# 查询 capability_list 表中的微信公众号能力
cd /workspace/projects
./db.sh "SELECT * FROM capability_list WHERE capability_type = 'platform_publish';"
```

### 测试 MCP 工具
```typescript
// 创建测试文件 src/test-wechat-mcp.ts
import { WechatMCPTools } from '@/lib/mcp/wechat-tools';

async function testWechatMCP() {
  // 1. 测试获取账号列表
  const accounts = await WechatMCPTools.getAccounts();
  console.log('账号列表:', accounts);

  // 2. 测试添加草稿（需要真实的 AppID/AppSecret）
  // const draft = await WechatMCPTools.addDraft({...});
}

testWechatMCP();
```

## 📚 相关文件

### 核心文件
- `src/config/wechat-official-account.config.ts` - 公众号账号配置
- `src/lib/wechat-official-account/api.ts` - 微信公众号 API 封装
- `src/lib/mcp/wechat-tools.ts` - 微信公众号 MCP 工具封装
- `src/lib/mcp/server.ts` - MCP Server（已集成微信公众号工具）

### 数据库文件
- `scripts/migrations/001_create_capability_list_table.sql` - capability_list 表迁移
- `db.sh` - 数据库查询工具

### 文档文件
- `docs/详细设计文档agent智能交互MCP能力设计capability_type.md` - MCP 能力设计文档
- `MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md` - 实施计划与进度跟踪

## 🎉 总结

微信公众号已成功集成到 MCP 能力体系中！现在可以：

1. ✅ 通过 capability_list 表管理微信公众号能力
2. ✅ 通过 MCP Server 调用微信公众号工具
3. ✅ 支持完整的 Agent 交互流程（执行 Agent → Agent B → MCP）
4. ✅ 具备完善的安全机制和审计日志

**下一步**：在实际的 Agent 业务逻辑中集成这些能力！
