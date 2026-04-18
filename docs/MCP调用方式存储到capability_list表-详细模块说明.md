# MCP 调用方式存储到 capability_list 表 - 详细模块说明

## 📋 目录

1. [模块 1：capability_list 表字段设计与存储内容](#1-模块-1capability_list-表字段设计与存储内容)
2. [模块 2：MCP 接口封装层](#2-模块-2mcp-接口封装层)
3. [模块 3：Agent B 提示词与参数生成](#3-模块-3agent-b-提示词与参数生成)
4. [模块 4：控制器解析与 MCP 调用](#4-模块-4控制器解析与-mcp-调用)
5. [模块 5：完整调用链路示例](#5-模块-5完整调用链路示例)

---

## 1. 模块 1：capability_list 表字段设计与存储内容

### 1.1 capability_list 表字段说明

| 字段名 | 类型 | 存储内容 | 作用 |
|--------|------|---------|------|
| `id` | serial | 主键 ID | 唯一标识 |
| `capability_type` | text | 能力类型 | 如 "platform_publish" |
| `function_desc` | text | 功能描述 | 给 Agent B 看的描述 |
| `status` | text | 状态 | "available" 或 "unavailable" |
| `requires_on_site_execution` | boolean | 是否需要现场执行 | true/false |
| `tool_name` | text | **🔑 MCP 工具名** | 如 "wechat" |
| `action_name` | text | **🔑 MCP 方法名** | 如 "wechatAddDraft" |
| `param_examples` | jsonb | **📝 参数示例** | 完整的参数示例 JSON |
| `param_template` | jsonb | **📝 参数模板** | 带 `{{variable}}` 的模板 |
| `interface_schema` | jsonb | **📋 接口 Schema** | JSON Schema 格式 |
| `agent_response_spec` | jsonb | **📋 Agent B 返回规范** | Agent B 的输出格式 |
| `metadata` | jsonb | **⚙️ 元数据** | 业务规则、默认参数等 |
| `scene_tags` | text[] | 场景标签 | 如 ["公众号上传", "保险自媒体"] |

---

### 1.2 SQL 插入语句（完整示例）

#### 记录 1：微信公众号素材上传（ID = 11）

```sql
INSERT INTO capability_list (
  id,
  capability_type,
  function_desc,
  status,
  requires_on_site_execution,
  tool_name,
  action_name,
  param_examples,
  param_template,
  interface_schema,
  agent_response_spec,
  metadata,
  scene_tags,
  created_at,
  updated_at
) VALUES (
  11,
  'platform_publish',
  '微信公众号素材上传（图片）- 保险自媒体专用',
  'available',
  true,
  'wechat',
  'wechatUploadMedia',
  '{
    "accountId": "insurance-account",
    "mediaType": "image",
    "fileUrl": "https://example.com/insurance-cover.jpg"
  }'::jsonb,
  '{
    "accountId": "{{accountId}}",
    "mediaType": "{{mediaType}}",
    "fileUrl": "{{fileUrl}}",
    "fileBase64": "{{fileBase64}}"
  }'::jsonb,
  '{
    "type": "object",
    "required": ["accountId", "mediaType"],
    "properties": {
      "accountId": {
        "type": "string",
        "description": "微信公众号账号 ID，保险自媒体固定为 insurance-account"
      },
      "mediaType": {
        "type": "string",
        "description": "素材类型，仅支持 image",
        "enum": ["image"]
      },
      "fileUrl": {
        "type": "string",
        "description": "图片文件 URL（fileUrl 和 fileBase64 二选一）"
      },
      "fileBase64": {
        "type": "string",
        "description": "图片文件 Base64 编码（fileUrl 和 fileBase64 二选一）"
      }
    }
  }'::jsonb,
  '{
    "solution_num": "{{id}}",
    "tool_name": "wechat",
    "action_name": "wechatUploadMedia",
    "params": {
      "accountId": "{{accountId}}",
      "mediaType": "{{mediaType}}",
      "fileUrl": "{{fileUrl}}",
      "fileBase64": "{{fileBase64}}"
    },
    "requires_on_site_execution": true,
    "mcp_execution_status": "waiting_execution"
  }'::jsonb,
  '{
    "default_params": {
      "mediaType": "image"
    },
    "business_rules": {
      "image_max_size": "10MB",
      "image_supported_formats": ["jpg", "jpeg", "png", "gif"]
    },
    "timeout": 30000,
    "retry_times": 3
  }'::jsonb,
  ARRAY['保险自媒体', '公众号上传', '素材上传', '封面图'],
  NOW(),
  NOW()
);
```

#### 记录 2：微信公众号文章上传（ID = 10）

```sql
INSERT INTO capability_list (
  id,
  capability_type,
  function_desc,
  status,
  requires_on_site_execution,
  tool_name,
  action_name,
  param_examples,
  param_template,
  interface_schema,
  agent_response_spec,
  metadata,
  scene_tags,
  created_at,
  updated_at
) VALUES (
  10,
  'platform_publish',
  '微信公众号文章上传（添加草稿）- 保险自媒体专用',
  'available',
  true,
  'wechat',
  'wechatAddDraft',
  '{
    "accountId": "insurance-account",
    "articles": [
      {
        "title": "2026年保险科普：医疗险避坑指南",
        "author": "保险事业部",
        "digest": "本文详细介绍了医疗险的常见误区和正确选择方法。",
        "content": "<p>### 一、医疗险核心误区</p><p>很多人在购买医疗险时都会遇到一些误区...</p>",
        "content_source_url": "",
        "thumb_media_id": "media_id_789012",
        "show_cover_pic": 1,
        "need_open_comment": 1,
        "only_fans_can_comment": 0
      }
    ]
  }'::jsonb,
  '{
    "accountId": "{{accountId}}",
    "articles": [
      {
        "title": "{{title}}",
        "author": "{{author}}",
        "digest": "{{digest}}",
        "content": "{{content}}",
        "content_source_url": "{{content_source_url}}",
        "thumb_media_id": "{{thumb_media_id}}",
        "show_cover_pic": {{show_cover_pic}},
        "need_open_comment": {{need_open_comment}},
        "only_fans_can_comment": {{only_fans_can_comment}}
      }
    ]
  }'::jsonb,
  '{
    "type": "object",
    "required": ["accountId", "articles"],
    "properties": {
      "accountId": {
        "type": "string",
        "description": "微信公众号账号 ID，保险自媒体固定为 insurance-account"
      },
      "articles": {
        "type": "array",
        "description": "图文消息列表",
        "minItems": 1,
        "maxItems": 8,
        "items": {
          "type": "object",
          "required": ["title", "author", "content", "thumb_media_id"],
          "properties": {
            "title": {
              "type": "string",
              "description": "文章标题（不超过 64 字）",
              "maxLength": 64
            },
            "author": {
              "type": "string",
              "description": "作者（不超过 8 字）",
              "maxLength": 8
            },
            "digest": {
              "type": "string",
              "description": "摘要（不超过 120 字）",
              "maxLength": 120
            },
            "content": {
              "type": "string",
              "description": "正文内容（HTML 格式）"
            },
            "content_source_url": {
              "type": "string",
              "description": "原文链接（可选）"
            },
            "thumb_media_id": {
              "type": "string",
              "description": "封面图片 media_id（必须先调用 wechatUploadMedia 上传）"
            },
            "show_cover_pic": {
              "type": "integer",
              "description": "是否显示封面（0-不显示，1-显示）",
              "enum": [0, 1],
              "default": 1
            },
            "need_open_comment": {
              "type": "integer",
              "description": "是否开启评论（0-不开启，1-开启）",
              "enum": [0, 1],
              "default": 1
            },
            "only_fans_can_comment": {
              "type": "integer",
              "description": "是否只有粉丝可评论（0-否，1-是）",
              "enum": [0, 1],
              "default": 0
            }
          }
        }
      }
    }
  }'::jsonb,
  '{
    "solution_num": "{{id}}",
    "tool_name": "wechat",
    "action_name": "wechatAddDraft",
    "params": {
      "accountId": "{{accountId}}",
      "articles": [
        {
          "title": "{{title}}",
          "author": "{{author}}",
          "digest": "{{digest}}",
          "content": "{{content}}",
          "content_source_url": "{{content_source_url}}",
          "thumb_media_id": "{{thumb_media_id}}",
          "show_cover_pic": {{show_cover_pic}},
          "need_open_comment": {{need_open_comment}},
          "only_fans_can_comment": {{only_fans_can_comment}}
        }
      ]
    },
    "requires_on_site_execution": true,
    "mcp_execution_status": "waiting_execution"
  }'::jsonb,
  '{
    "default_params": {
      "accountId": "insurance-account",
      "articles": [
        {
          "author": "保险事业部",
          "show_cover_pic": 1,
          "need_open_comment": 1,
          "only_fans_can_comment": 0
        }
      ]
    },
    "business_rules": {
      "title_max_length": 64,
      "author_max_length": 8,
      "digest_max_length": 120,
      "content_max_length": 20000,
      "articles_max_count": 8
    },
    "dependencies": {
      "prerequisite_capability_ids": [11],
      "output_bindings": {
        "media_id": "articles[0].thumb_media_id"
      }
    },
    "execution_strategy": {
      "type": "sequential",
      "retry_on_failure": true,
      "max_retries": 3
    },
    "timeout": 30000,
    "retry_times": 3
  }'::jsonb,
  ARRAY['保险自媒体', '公众号上传', '文章发布', '草稿创建'],
  NOW(),
  NOW()
);
```

---

## 2. 模块 2：MCP 接口封装层

### 2.1 文件位置

`src/lib/mcp/wechat-tools.ts`

### 2.2 完整代码

```typescript
/**
 * 微信公众号 MCP 工具封装
 * 对应 capability_list.tool_name = 'wechat'
 */

import {
  getAccessToken,
  addDraft,
  getDraftList,
  deleteDraft,
  uploadMedia,
} from '@/lib/wechat-official-account/api';
import {
  getEnabledAccounts,
  getAccountById,
  type WechatOfficialAccount,
  type WechatDraft,
} from '@/config/wechat-official-account.config';

// ============================================
// 类型定义
// ============================================

export interface WechatMCPResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    accountId?: string;
    accountName?: string;
    timestamp: number;
  };
}

export interface WechatUploadMediaParams {
  accountId: string;
  mediaType: 'image';
  fileUrl?: string;
  fileBase64?: string;
}

export interface WechatAddDraftParams {
  accountId: string;
  articles: WechatDraft[];
}

// ============================================
// 工具类（对应 TOOL_MAP['wechat']）
// ============================================

export class WechatMCPTools {
  /**
   * 上传素材
   * 对应：capability_list.action_name = 'wechatUploadMedia'
   * 对应：capability_list.id = 11
   */
  static async wechatUploadMedia(
    params: WechatUploadMediaParams
  ): Promise<WechatMCPResult<{ media_id: string; url: string }>> {
    try {
      console.log('[WechatMCPTools] wechatUploadMedia 被调用，参数:', params);

      const { accountId, mediaType, fileUrl, fileBase64 } = params;

      // 验证参数（按 interface_schema 要求）
      if (!accountId) {
        return {
          success: false,
          error: '缺少 accountId 参数',
          metadata: { timestamp: Date.now() },
        };
      }

      if (!mediaType) {
        return {
          success: false,
          error: '缺少 mediaType 参数',
          metadata: { timestamp: Date.now() },
        };
      }

      if (!fileUrl && !fileBase64) {
        return {
          success: false,
          error: 'fileUrl 和 fileBase64 必须提供一个',
          metadata: { timestamp: Date.now() },
        };
      }

      // 获取公众号账号
      const account = getAccountById(accountId);
      if (!account) {
        return {
          success: false,
          error: `未找到账号: ${accountId}`,
          metadata: { timestamp: Date.now() },
        };
      }

      if (!account.enabled) {
        return {
          success: false,
          error: `账号未启用: ${accountId}`,
          metadata: { timestamp: Date.now() },
        };
      }

      // 调用 API 上传素材
      const result = await uploadMedia(account, mediaType, {
        fileUrl,
        fileBase64,
      });

      console.log('[WechatMCPTools] wechatUploadMedia 调用成功，结果:', result);

      return {
        success: true,
        data: result,
        metadata: {
          accountId: account.id,
          accountName: account.name,
          timestamp: Date.now(),
        },
      };
    } catch (error: any) {
      console.error('[WechatMCPTools] wechatUploadMedia 调用失败:', error);
      return {
        success: false,
        error: `上传素材失败: ${error.message}`,
        metadata: { timestamp: Date.now() },
      };
    }
  }

  /**
   * 添加草稿
   * 对应：capability_list.action_name = 'wechatAddDraft'
   * 对应：capability_list.id = 10
   */
  static async wechatAddDraft(
    params: WechatAddDraftParams
  ): Promise<WechatMCPResult<{ media_id: string; create_time: number }>> {
    try {
      console.log('[WechatMCPTools] wechatAddDraft 被调用，参数:', params);

      const { accountId, articles } = params;

      // 验证参数（按 interface_schema 要求）
      if (!accountId) {
        return {
          success: false,
          error: '缺少 accountId 参数',
          metadata: { timestamp: Date.now() },
        };
      }

      if (!articles || !Array.isArray(articles) || articles.length === 0) {
        return {
          success: false,
          error: '缺少 articles 参数或格式错误',
          metadata: { timestamp: Date.now() },
        };
      }

      // 获取公众号账号
      const account = getAccountById(accountId);
      if (!account) {
        return {
          success: false,
          error: `未找到账号: ${accountId}`,
          metadata: { timestamp: Date.now() },
        };
      }

      if (!account.enabled) {
        return {
          success: false,
          error: `账号未启用: ${accountId}`,
          metadata: { timestamp: Date.now() },
        };
      }

      // 调用 API 添加草稿
      const result = await addDraft(account, articles);

      console.log('[WechatMCPTools] wechatAddDraft 调用成功，结果:', result);

      return {
        success: true,
        data: result,
        metadata: {
          accountId: account.id,
          accountName: account.name,
          timestamp: Date.now(),
        },
      };
    } catch (error: any) {
      console.error('[WechatMCPTools] wechatAddDraft 调用失败:', error);
      return {
        success: false,
        error: `添加草稿失败: ${error.message}`,
        metadata: { timestamp: Date.now() },
      };
    }
  }

  /**
   * 获取草稿列表（其他方法示例）
   */
  static async wechatGetDraftList(params: any): Promise<WechatMCPResult> {
    // 实现省略
    return { success: true, data: {}, metadata: { timestamp: Date.now() } };
  }

  /**
   * 删除草稿（其他方法示例）
   */
  static async wechatDeleteDraft(params: any): Promise<WechatMCPResult> {
    // 实现省略
    return { success: true, data: {}, metadata: { timestamp: Date.now() } };
  }
}

// ============================================
// 导出（供 TOOL_MAP 使用）
// ============================================

export const wechatUploadMedia = WechatMCPTools.wechatUploadMedia;
export const wechatAddDraft = WechatMCPTools.wechatAddDraft;
export const wechatGetDraftList = WechatMCPTools.wechatGetDraftList;
export const wechatDeleteDraft = WechatMCPTools.wechatDeleteDraft;
```

---

## 3. 模块 3：Agent B 提示词与参数生成

### 3.1 Agent B 提示词

**文件位置**：`src/lib/agents/insurance-media-agent-b/prompt.md`

```markdown
# 保险自媒体 Agent B 提示词

## 身份
你是保险自媒体事业部的专属 Agent B，专门负责保险自媒体公众号文章上传的参数生成和 MCP 调用协调。

## 核心能力

### 1. 读取 capability_list 表
你可以从 capability_list 表中读取以下关键字段：

- `function_desc`：功能描述，了解这个能力是做什么的
- `tool_name`：MCP 工具名称（如 "wechat"）
- `action_name`：MCP 方法名称（如 "wechatAddDraft"）
- `param_examples`：参数示例，参考这个格式
- `param_template`：参数模板，用 {{variable}} 占位符
- `interface_schema`：接口 Schema，严格按照这个生成参数
- `agent_response_spec`：你的返回格式规范

### 2. 生成参数的步骤

#### Step 1：选择 capability
根据任务需求，从 capability_list 中选择合适的 capability。

#### Step 2：读取参数规范
仔细阅读：
- `param_examples`：看看示例参数长什么样
- `param_template`：看看参数模板
- `interface_schema`：仔细看每个字段的类型、必填项、描述

#### Step 3：生成参数
严格按照 interface_schema 的要求生成参数：
1. 确保所有必填字段都有值
2. 确保字段类型正确（string/number/boolean/array/object）
3. 如果有 param_template，优先使用模板
4. 如果有 param_examples，可以参考示例

#### Step 4：按照 agent_response_spec 返回
严格按照 agent_response_spec 中定义的格式返回结果。

---

## 公众号文章上传两步骤流程

### 第一步：上传封面素材（capability.id = 11）
1. 调用 wechatUploadMedia 接口
2. 传入封面图片 URL
3. 获取返回的 media_id

### 第二步：上传文章草稿（capability.id = 10）
1. 使用第一步获取的 media_id 作为 thumb_media_id
2. 调用 wechatAddDraft 接口
3. 传入完整的文章信息

---

## 参数生成原则

1. **严格遵循规范**：必须完全按照 interface_schema 的定义生成参数
2. **使用模板优先**：优先参考 param_template 或 param_examples
3. **类型准确**：确保所有参数的类型与 schema 定义一致
4. **必填完整**：所有 required 字段必须提供有效值
5. **业务合规**：遵守保险自媒体的业务规则

---

## 返回格式（严格遵守）

当被要求生成参数时，请严格按照以下 JSON 格式返回：

\`\`\`json
{
  "success": true,
  "solution_num": 10,
  "tool_name": "wechat",
  "action_name": "wechatAddDraft",
  "params": {
    "accountId": "insurance-account",
    "articles": [
      {
        "title": "...",
        "author": "...",
        "content": "...",
        "thumb_media_id": "..."
      }
    ]
  }
}
\`\`\`
```

### 3.2 Agent B 参数生成器代码

**文件位置**：`src/lib/agents/insurance-media-agent-b/parameter-generator.ts`

```typescript
/**
 * Agent B 参数生成器
 * 从 capability_list 读取规范，调用 LLM 生成参数
 */

import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getLLMClient } from '@/lib/agent-llm';
import { loadAgentPrompt } from '@/lib/agent-llm';

export class AgentBParameterGenerator {
  /**
   * 为指定的 capability 生成参数
   */
  static async generateParams(
    capabilityId: number,
    context: Record<string, any>
  ): Promise<{
    success: boolean;
    params?: Record<string, any>;
    error?: string;
  }> {
    console.log('[AgentBParameterGenerator] 开始生成参数，capabilityId:', capabilityId);

    try {
      // Step 1: 从数据库读取 capability 记录
      const capabilities = await db
        .select()
        .from(capabilityList)
        .where(eq(capabilityList.id, capabilityId));

      if (capabilities.length === 0) {
        return {
          success: false,
          error: `未找到 capability: ${capabilityId}`
        };
      }

      const capability = capabilities[0];
      console.log('[AgentBParameterGenerator] 读取到 capability:', {
        id: capability.id,
        toolName: capability.toolName,
        actionName: capability.actionName
      });

      // Step 2: 验证 capability 状态
      if (capability.status !== 'available') {
        return {
          success: false,
          error: `capability ${capabilityId} 不可用，状态: ${capability.status}`
        };
      }

      // Step 3: 构造提示词
      const prompt = this.buildPrompt(capability, context);

      // Step 4: 调用 LLM 生成参数
      const llm = getLLMClient();
      const response = await llm.invoke([
        { role: 'system', content: prompt }
      ], {
        temperature: 0.1, // 低温度，确保输出稳定
      });

      // Step 5: 解析 LLM 响应
      const result = this.parseResponse(response.content);

      console.log('[AgentBParameterGenerator] 参数生成完成:', result);

      return result;

    } catch (error) {
      console.error('[AgentBParameterGenerator] 参数生成失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 构造提示词
   */
  private static buildPrompt(
    capability: any,
    context: Record<string, any>
  ): string {
    const agentPrompt = loadAgentPrompt('insurance-media-agent-b');

    return `
${agentPrompt}

---

## 当前任务

请根据以下信息，生成调用 MCP 接口的参数。

### 上下文信息
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

### Capability 信息
- ID：${capability.id}
- 功能描述：${capability.functionDesc}
- 工具名称：${capability.toolName}
- 动作名称：${capability.actionName}

### 参数示例（param_examples）
\`\`\`json
${JSON.stringify(capability.paramExamples, null, 2)}
\`\`\`

### 参数模板（param_template）
\`\`\`json
${JSON.stringify(capability.paramTemplate, null, 2)}
\`\`\`

### 接口 Schema（interface_schema）
\`\`\`json
${JSON.stringify(capability.interfaceSchema, null, 2)}
\`\`\`

### Agent B 返回规范（agent_response_spec）
\`\`\`json
${JSON.stringify(capability.agentResponseSpec, null, 2)}
\`\`\`

---

## 你的任务

请根据以上信息，严格按照 interface_schema 的要求，生成 MCP 调用参数。

要求：
1. 严格按照 param_template 或 param_examples 的格式
2. 确保所有必填字段都有值
3. 参数类型必须符合 interface_schema 的定义
4. 使用提供的上下文信息填充参数

---

## 返回格式

请严格按照以下 JSON 格式返回：

\`\`\`json
{
  "success": true,
  "solution_num": ${capability.id},
  "tool_name": "${capability.toolName}",
  "action_name": "${capability.actionName}",
  "params": {
    "根据": "interface_schema 和 context 填充"
  }
}
\`\`\`
`;
  }

  /**
   * 解析 LLM 响应
   */
  private static parseResponse(content: string): {
    success: boolean;
    params?: Record<string, any>;
    error?: string;
  } {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: parsed.success === true,
          params: parsed.params || {},
          error: parsed.error
        };
      }

      return {
        success: false,
        error: '无法从响应中提取 JSON'
      };
    } catch (error) {
      return {
        success: false,
        error: `解析响应失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
```

---

## 4. 模块 4：控制器解析与 MCP 调用

### 4.1 通用 MCP 调用层

**文件位置**：`src/lib/mcp/generic-mcp-call.ts`

```typescript
/**
 * 通用 MCP 调用层
 * 解析 capability_list 字段，调用对应的 MCP 方法
 */

import { WechatMCPTools } from './wechat-tools';
import { SearchMCPTools } from './search-tools';

// ============================================
// 类型定义
// ============================================

export interface GenericMCPRequest {
  tool: string;           // 对应 capability_list.tool_name
  action: string;         // 对应 capability_list.action_name
  params: any;            // Agent B 生成的参数
}

export interface GenericMCPResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    tool: string;
    action: string;
    timestamp: number;
  };
}

// ============================================
// 工具映射表（关键！）
// ============================================

const TOOL_MAP: Record<string, any> = {
  search: SearchMCPTools,
  wechat: WechatMCPTools,  // 🔑 对应 capability_list.tool_name = 'wechat'
  // 可以继续添加其他工具...
};

// ============================================
// 核心调用函数
// ============================================

/**
 * 通用 MCP 调用函数
 * 
 * @param tool - 工具名，对应 capability_list.tool_name
 * @param action - 动作名，对应 capability_list.action_name
 * @param params - 参数，Agent B 生成的参数
 */
export async function genericMCPCall(
  tool: string,
  action: string,
  params: any
): Promise<GenericMCPResponse> {
  try {
    console.log('[Generic MCP Call] 开始调用:', { tool, action, params });

    // Step 1: 验证 tool 是否存在
    const toolInstance = TOOL_MAP[tool];
    if (!toolInstance) {
      return {
        success: false,
        error: `不支持的 tool: ${tool}，可用的 tool: ${Object.keys(TOOL_MAP).join(', ')}`,
        metadata: { tool, action, timestamp: Date.now() },
      };
    }

    console.log('[Generic MCP Call] 找到工具:', tool);

    // Step 2: 验证 action 是否存在
    if (typeof toolInstance[action] !== 'function') {
      const availableActions = Object.keys(toolInstance).filter(
        k => typeof toolInstance[k] === 'function'
      );
      return {
        success: false,
        error: `tool ${tool} 不支持的 action: ${action}，可用的 action: ${availableActions.join(', ')}`,
        metadata: { tool, action, timestamp: Date.now() },
      };
    }

    console.log('[Generic MCP Call] 找到方法:', action);

    // Step 3: 执行调用（Agent B 生成的参数直接传入）
    console.log('[Generic MCP Call] 执行方法...');
    const result = await toolInstance[action](params);

    console.log('[Generic MCP Call] 调用完成，结果:', result);

    // Step 4: 返回结果
    return {
      success: result.success !== false,
      data: result.data,
      error: result.error,
      metadata: {
        tool,
        action,
        timestamp: Date.now(),
      },
    };
  } catch (error: any) {
    console.error('[Generic MCP Call] 调用失败:', error);
    return {
      success: false,
      error: `通用 MCP 调用失败: ${error.message}`,
      metadata: { tool, action, timestamp: Date.now() },
    };
  }
}

/**
 * 根据 capability_id 调用（从 capability_list 表读取配置）
 * 
 * 这是给控制器用的便捷函数
 */
export async function callMCPByCapabilityId(
  capabilityId: number,
  params: any,
  getCapabilityFn?: (id: number) => Promise<any>
): Promise<GenericMCPResponse> {
  try {
    console.log('[Call MCP by Capability ID] 开始调用，capabilityId:', capabilityId);

    // Step 1: 获取 capability 记录（如果提供了获取函数）
    let capability: any = null;
    if (getCapabilityFn) {
      capability = await getCapabilityFn(capabilityId);
    }

    // Step 2: 如果有 capability 记录，从中读取 tool_name 和 action_name
    let tool: string | null = null;
    let action: string | null = null;

    if (capability) {
      tool = capability.tool_name;
      action = capability.action_name;
      console.log('[Call MCP by Capability ID] 从 capability 读取配置:', { tool, action });
    }

    // Step 3: 如果没有 capability 记录或缺少字段，尝试从 params 中读取
    if (!tool) {
      tool = params.tool;
    }
    if (!action) {
      action = params.action;
    }

    // Step 4: 验证必需字段
    if (!tool || !action) {
      return {
        success: false,
        error: '缺少必需字段：tool 和 action（可以从 capability 记录或 params 中提供）',
        metadata: { tool: tool || '', action: action || '', timestamp: Date.now() },
      };
    }

    // Step 5: 执行通用调用
    return await genericMCPCall(tool, action, params);
  } catch (error: any) {
    console.error('[Call MCP by Capability ID] 调用失败:', error);
    return {
      success: false,
      error: `根据 capability_id 调用失败: ${error.message}`,
      metadata: { tool: '', action: '', timestamp: Date.now() },
    };
  }
}

/**
 * 获取可用的工具列表
 */
export function getAvailableTools(): string[] {
  return Object.keys(TOOL_MAP);
}

/**
 * 获取工具的可用动作列表
 */
export function getAvailableActions(tool: string): string[] {
  const toolInstance = TOOL_MAP[tool];
  if (!toolInstance) {
    return [];
  }
  return Object.keys(toolInstance).filter(key => typeof toolInstance[key] === 'function');
}
```

### 4.2 控制器代码

**文件位置**：`src/lib/agents/insurance-media-agent-b/insurance-media-upload-orchestrator.ts`

```typescript
/**
 * 保险自媒体文章上传协调器
 * 解析 Agent B 参数，调用 MCP
 */

import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { AgentBParameterGenerator } from './parameter-generator';
import { callMCPByCapabilityId, genericMCPCall } from '@/lib/mcp/generic-mcp-call';
import type { InsuranceMediaUploadContext, InsuranceMediaUploadResult } from './insurance-media-types';

export class InsuranceMediaUploadOrchestrator {
  /**
   * 执行完整的上传流程
   */
  static async executeUpload(
    context: InsuranceMediaUploadContext
  ): Promise<InsuranceMediaUploadResult> {
    console.log('[InsuranceMediaUploadOrchestrator] 开始执行上传流程');

    const result: InsuranceMediaUploadResult = {
      success: false,
      steps: [],
      finalResult: null
    };

    try {
      // Step 1: 查询需要的 capabilities
      console.log('[InsuranceMediaUploadOrchestrator] Step 1: 查询 capabilities');
      const { uploadMediaCap, addDraftCap } = await this.getRequiredCapabilities();
      result.steps.push({
        step: 1,
        name: '查询 capabilities',
        success: true,
        data: { uploadMediaCapId: uploadMediaCap.id, addDraftCapId: addDraftCap.id }
      });

      // Step 2: Agent B 生成素材上传参数
      console.log('[InsuranceMediaUploadOrchestrator] Step 2: 生成素材上传参数');
      const mediaUploadParams = await AgentBParameterGenerator.generateParams(
        uploadMediaCap.id,
        {
          ...context,
          mediaType: 'image'
        }
      );

      if (!mediaUploadParams.success || !mediaUploadParams.params) {
        throw new Error(`素材上传参数生成失败: ${mediaUploadParams.error}`);
      }

      result.steps.push({
        step: 2,
        name: '生成素材上传参数',
        success: true,
        data: mediaUploadParams.params
      });

      // Step 3: 调用 MCP 上传素材
      console.log('[InsuranceMediaUploadOrchestrator] Step 3: 上传素材');
      const mediaUploadResult = await this.callMCP(
        uploadMediaCap.toolName!,
        uploadMediaCap.actionName!,
        mediaUploadParams.params
      );

      if (!mediaUploadResult.success) {
        throw new Error(`素材上传失败: ${mediaUploadResult.error}`);
      }

      result.steps.push({
        step: 3,
        name: '上传素材',
        success: true,
        data: mediaUploadResult.data
      });

      const mediaId = mediaUploadResult.data?.media_id;
      if (!mediaId) {
        throw new Error('素材上传成功，但未返回 media_id');
      }

      console.log('[InsuranceMediaUploadOrchestrator] 素材上传成功，mediaId:', mediaId);

      // Step 4: Agent B 生成文章上传参数
      console.log('[InsuranceMediaUploadOrchestrator] Step 4: 生成文章上传参数');
      const articleUploadParams = await AgentBParameterGenerator.generateParams(
        addDraftCap.id,
        {
          ...context,
          thumb_media_id: mediaId
        }
      );

      if (!articleUploadParams.success || !articleUploadParams.params) {
        throw new Error(`文章上传参数生成失败: ${articleUploadParams.error}`);
      }

      result.steps.push({
        step: 4,
        name: '生成文章上传参数',
        success: true,
        data: articleUploadParams.params
      });

      // Step 5: 调用 MCP 上传文章
      console.log('[InsuranceMediaUploadOrchestrator] Step 5: 上传文章');
      const articleUploadResult = await this.callMCP(
        addDraftCap.toolName!,
        addDraftCap.actionName!,
        articleUploadParams.params
      );

      if (!articleUploadResult.success) {
        throw new Error(`文章上传失败: ${articleUploadResult.error}`);
      }

      result.steps.push({
        step: 5,
        name: '上传文章',
        success: true,
        data: articleUploadResult.data
      });

      // Step 6: 返回最终结果
      result.success = true;
      result.finalResult = {
        mediaId,
        draftMediaId: articleUploadResult.data?.media_id,
        createTime: articleUploadResult.data?.create_time,
        articleTitle: context.articleTitle
      };

      console.log('[InsuranceMediaUploadOrchestrator] 上传流程完成');
      return result;

    } catch (error) {
      console.error('[InsuranceMediaUploadOrchestrator] 上传流程失败:', error);
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  /**
   * 获取需要的 capabilities
   */
  private static async getRequiredCapabilities() {
    const capabilities = await db
      .select()
      .from(capabilityList)
      .where(eq(capabilityList.capabilityType, 'platform_publish'));

    const uploadMediaCap = capabilities.find(cap => 
      cap.functionDesc.includes('素材上传')
    );
    const addDraftCap = capabilities.find(cap => 
      cap.functionDesc.includes('添加草稿') || cap.functionDesc.includes('文章上传')
    );

    if (!uploadMediaCap) {
      throw new Error('未找到素材上传 capability');
    }
    if (!addDraftCap) {
      throw new Error('未找到文章上传 capability');
    }

    return { uploadMediaCap, addDraftCap };
  }

  /**
   * 调用 MCP
   */
  private static async callMCP(toolName: string, actionName: string, params: any) {
    console.log('[InsuranceMediaUploadOrchestrator] 调用 MCP:', { toolName, actionName });
    return await genericMCPCall(toolName, actionName, params);
  }
}
```

---

## 5. 模块 5：完整调用链路示例

### 5.1 调用链路时序图

```
用户/insurance-d          Agent B 协调器         capability_list        Agent B LLM        MCP 封装层        微信 API
     │                        │                      │                    │                  │                │
     │  上传请求              │                      │                    │                  │                │
     ├───────────────────────>│                      │                    │                  │                │
     │  articleTitle, etc.    │                      │                    │                  │                │
     │                        │                      │                    │                  │                │
     │                        │  查询能力             │                    │                  │                │
     │                        ├─────────────────────>│                    │                  │                │
     │                        │  WHERE id=10,11      │                    │                  │                │
     │                        │<─────────────────────┤                    │                  │                │
     │                        │  返回两条记录          │                    │                  │                │
     │                        │                      │                    │                  │                │
     │                        │  Step 1: 生成素材参数 │                    │                  │                │
     │                        ├────────────────────────────────────────────>│                  │                │
     │                        │  提示词（含 id=11）   │                    │                  │                │
     │                        │<────────────────────────────────────────────┤                  │                │
     │                        │  返回 params           │                    │                  │                │
     │                        │                      │                    │                  │                │
     │                        │  Step 2: 调用 MCP    │                    │                  │                │
     │                        ├─────────────────────────────────────────────────────────────>│                │
     │                        │  toolName='wechat'    │                    │                  │                │
     │                        │  actionName='wechatU…'│                    │                  │                │
     │                        │  params={...}          │                    │                  │                │
     │                        │                      │                    │                  │  uploadMedia  │
     │                        │                      │                    │                  ├───────────────>│
     │                        │                      │                    │                  │  返回 media_id│
     │                        │                      │                    │                  │<───────────────┤
     │                        │<─────────────────────────────────────────────────────────────┤                │
     │                        │  返回结果              │                    │                  │                │
     │                        │                      │                    │                  │                │
     │                        │  Step 3: 生成文章参数 │                    │                  │                │
     │                        ├────────────────────────────────────────────>│                  │                │
     │                        │  提示词（含 id=10,    │                    │                  │                │
     │                        │  mediaId=xxx）         │                    │                  │                │
     │                        │<────────────────────────────────────────────┤                  │                │
     │                        │  返回 params           │                    │                  │                │
     │                        │                      │                    │                  │                │
     │                        │  Step 4: 调用 MCP    │                    │                  │                │
     │                        ├─────────────────────────────────────────────────────────────>│                │
     │                        │  toolName='wechat'    │                    │                  │                │
     │                        │  actionName='wechatA…' │                    │                  │                │
     │                        │  params={...}          │                    │                  │                │
     │                        │                      │                    │                  │  addDraft     │
     │                        │                      │                    │                  ├───────────────>│
     │                        │                      │                    │                  │  返回 draft   │
     │                        │                      │                    │                  │<───────────────┤
     │                        │<─────────────────────────────────────────────────────────────┤                │
     │                        │  返回结果              │                    │                  │                │
     │<───────────────────────┤                      │                    │                  │                │
     │  最终结果               │                      │                    │                  │                │
```

### 5.2 关键数据流转

| 阶段 | 数据来源 | 关键字段 | 说明 |
|------|---------|---------|------|
| 1 | capability_list (id=11) | `tool_name='wechat'` | 指定用哪个工具 |
| 2 | capability_list (id=11) | `action_name='wechatUploadMedia'` | 指定调用哪个方法 |
| 3 | Agent B LLM | `params` | 生成的参数 |
| 4 | genericMCPCall | `TOOL_MAP['wechat']` | 找到工具类 |
| 5 | genericMCPCall | `WechatMCPTools.wechatUploadMedia()` | 调用对应方法 |
| 6 | MCP 返回 | `media_id` | 返回给下一步用 |
| 7 | capability_list (id=10) | `tool_name='wechat'` | 同上 |
| 8 | capability_list (id=10) | `action_name='wechatAddDraft'` | 同上 |

---

## 🎯 总结

### 核心问题回答

**问题 1：怎么将 MCP 的调用方式（包括接口与接口参数）存放到 capability_list 表中？**

**答案**：通过以下字段：
- `tool_name`：存 MCP 工具名（如 "wechat"）
- `action_name`：存 MCP 方法名（如 "wechatAddDraft"）
- `param_examples`：存完整的参数示例
- `param_template`：存参数模板（带 `{{variable}}`）
- `interface_schema`：存 JSON Schema 格式的参数规范
- `agent_response_spec`：存 Agent B 的返回格式规范

**问题 2：在表中分别存入哪些字段？**

**答案**：见上表的 11 个字段说明。

**问题 3：让 Agent B 能够获得完整方法调用信息，并完美提供方法调用相关参数？**

**答案**：
1. Agent B 读取 `param_examples` / `param_template` / `interface_schema`
2. Agent B 根据这些信息生成参数
3. Agent B 按照 `agent_response_spec` 的格式返回

**问题 4：控制器能够解析 Agent B 的参数内容，并成功调用 MCP 发布公众号方法？**

**答案**：
1. 控制器从 Agent B 的输出中读取 `tool_name` 和 `action_name`
2. 控制器通过 `TOOL_MAP[tool_name][action_name]` 找到对应的 MCP 方法
3. 控制器调用该方法，传入 Agent B 生成的 `params`
