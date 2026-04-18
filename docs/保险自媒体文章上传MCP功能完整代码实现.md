# 保险自媒体文章上传 MCP 功能 - 完整代码实现

## 📋 目录

1. [SQL 数据准备](#1-sql-数据准备)
2. [Agent B 保险自媒体专用控制器](#2-agent-b-保险自媒体专用控制器)
3. [Agent B 提示词文件](#3-agent-b-提示词文件)
4. [完整流程协调器](#4-完整流程协调器)
5. [类型定义](#5-类型定义)

---

## 1. SQL 数据准备

### 1.1 插入 capability_list 表记录

```sql
-- ============================================
-- 1. 微信公众号素材上传（图片）
-- ============================================
INSERT INTO capability_list (
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
        "description": "图片文件 URL（fileUrl 和 fileBase64 二选一），保险自媒体文章封面图通常使用此方式"
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
      "image_supported_formats": ["jpg", "jpeg", "png", "gif"],
      "image_aspect_ratio": "2.35:1 (公众号封面推荐比例)"
    },
    "timeout": 30000,
    "retry_times": 3,
    "apply_agent_types": ["insurance-media-agent-b"]
  }'::jsonb,
  ARRAY['保险自媒体', '公众号上传', '素材上传', '封面图'],
  NOW(),
  NOW()
);

-- ============================================
-- 2. 微信公众号文章上传（添加草稿）
-- ============================================
INSERT INTO capability_list (
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
        "digest": "本文详细介绍了医疗险的常见误区和正确选择方法，帮助消费者避免踩坑。",
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
        "description": "图文消息列表，保险自媒体通常一次只发1篇文章",
        "minItems": 1,
        "maxItems": 8,
        "items": {
          "type": "object",
          "required": ["title", "author", "content", "thumb_media_id"],
          "properties": {
            "title": {
              "type": "string",
              "description": "文章标题（不超过 64 字），保险文章标题通常包含保险类型、科普、避坑等关键词",
              "maxLength": 64
            },
            "author": {
              "type": "string",
              "description": "作者（不超过 8 字），保险自媒体通常为「保险事业部」",
              "maxLength": 8
            },
            "digest": {
              "type": "string",
              "description": "摘要（不超过 120 字），简要概括文章内容，吸引读者点击",
              "maxLength": 120
            },
            "content": {
              "type": "string",
              "description": "正文内容（HTML 格式），支持的标签：p, br, strong, em, a, img, h1-h6, ul, ol, li 等。保险文章内容需要确保合规，无敏感词。"
            },
            "content_source_url": {
              "type": "string",
              "description": "原文链接（可选）"
            },
            "thumb_media_id": {
              "type": "string",
              "description": "封面图片 media_id（必须先调用 wechatUploadMedia 上传获取）"
            },
            "show_cover_pic": {
              "type": "integer",
              "description": "是否显示封面（0-不显示，1-显示），保险文章通常设为 1",
              "enum": [0, 1],
              "default": 1
            },
            "need_open_comment": {
              "type": "integer",
              "description": "是否开启评论（0-不开启，1-开启），保险文章建议开启互动",
              "enum": [0, 1],
              "default": 1
            },
            "only_fans_can_comment": {
              "type": "integer",
              "description": "是否只有粉丝可评论（0-否，1-是），保险文章通常设为 0 吸引新粉丝",
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
      "articles_max_count": 8,
      "sensitive_word_check": true,
      "insurance_content_compliance": true
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
    "retry_times": 3,
    "apply_agent_types": ["insurance-media-agent-b"]
  }'::jsonb,
  ARRAY['保险自媒体', '公众号上传', '文章发布', '草稿创建'],
  NOW(),
  NOW()
);
```

---

## 2. Agent B 保险自媒体专用控制器

### 文件路径：`src/lib/agents/insurance-media-agent-b/insurance-media-upload-orchestrator.ts`

```typescript
/**
 * 保险自媒体文章上传协调器
 * 专门负责保险自媒体公众号文章上传的完整流程
 */

import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getLLMClient } from '@/lib/agent-llm';
import { loadAgentPrompt } from '@/lib/agent-llm';
import { callMCPByCapabilityId } from '@/lib/mcp/generic-mcp-call';
import type {
  InsuranceMediaUploadContext,
  InsuranceMediaUploadResult,
  CapabilityInfo,
  AgentBResponse
} from './insurance-media-types';

/**
 * 保险自媒体文章上传协调器
 */
export class InsuranceMediaUploadOrchestrator {
  /**
   * 执行完整的保险自媒体文章上传流程
   */
  static async executeUpload(
    context: InsuranceMediaUploadContext
  ): Promise<InsuranceMediaUploadResult> {
    console.log('[InsuranceMediaUploadOrchestrator] 开始执行保险自媒体文章上传流程');
    console.log('[InsuranceMediaUploadOrchestrator] 上传上下文:', JSON.stringify(context, null, 2));

    const result: InsuranceMediaUploadResult = {
      success: false,
      steps: [],
      finalResult: null
    };

    try {
      // Step 1: 查询 capability_list 表，获取所需的能力信息
      console.log('[InsuranceMediaUploadOrchestrator] Step 1: 查询 capability_list 表');
      const capabilities = await this.getRequiredCapabilities();
      result.steps.push({
        step: 1,
        name: '查询 capability_list',
        success: true,
        data: { capabilitiesRetrieved: capabilities.length }
      });

      // Step 2: 调用 Agent B LLM，生成第一步：上传素材的参数
      console.log('[InsuranceMediaUploadOrchestrator] Step 2: 调用 Agent B 生成素材上传参数');
      const mediaUploadParams = await this.callAgentBForMediaUpload(context, capabilities.uploadMedia);
      result.steps.push({
        step: 2,
        name: 'Agent B 生成素材上传参数',
        success: true,
        data: mediaUploadParams
      });

      // Step 3: 执行素材上传 MCP
      console.log('[InsuranceMediaUploadOrchestrator] Step 3: 执行素材上传 MCP');
      const mediaUploadResult = await this.executeMediaUpload(
        capabilities.uploadMedia.id,
        mediaUploadParams
      );
      result.steps.push({
        step: 3,
        name: '执行素材上传 MCP',
        success: mediaUploadResult.success,
        data: mediaUploadResult
      });

      if (!mediaUploadResult.success) {
        throw new Error(`素材上传失败: ${mediaUploadResult.error}`);
      }

      const mediaId = mediaUploadResult.data?.media_id;
      if (!mediaId) {
        throw new Error('素材上传成功，但未返回 media_id');
      }

      console.log('[InsuranceMediaUploadOrchestrator] 素材上传成功，media_id:', mediaId);

      // Step 4: 调用 Agent B LLM，生成第二步：添加草稿的参数
      console.log('[InsuranceMediaUploadOrchestrator] Step 4: 调用 Agent B 生成文章上传参数');
      const articleUploadParams = await this.callAgentBForArticleUpload(
        context,
        capabilities.addDraft,
        mediaId
      );
      result.steps.push({
        step: 4,
        name: 'Agent B 生成文章上传参数',
        success: true,
        data: articleUploadParams
      });

      // Step 5: 执行文章上传 MCP
      console.log('[InsuranceMediaUploadOrchestrator] Step 5: 执行文章上传 MCP');
      const articleUploadResult = await this.executeArticleUpload(
        capabilities.addDraft.id,
        articleUploadParams
      );
      result.steps.push({
        step: 5,
        name: '执行文章上传 MCP',
        success: articleUploadResult.success,
        data: articleUploadResult
      });

      if (!articleUploadResult.success) {
        throw new Error(`文章上传失败: ${articleUploadResult.error}`);
      }

      // Step 6: 返回最终结果
      result.success = true;
      result.finalResult = {
        mediaId,
        draftMediaId: articleUploadResult.data?.media_id,
        createTime: articleUploadResult.data?.create_time,
        articleTitle: context.articleTitle
      };

      console.log('[InsuranceMediaUploadOrchestrator] 保险自媒体文章上传流程完成');
      
      return result;

    } catch (error) {
      console.error('[InsuranceMediaUploadOrchestrator] 保险自媒体文章上传流程失败:', error);
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  /**
   * 获取所需的 capability 信息
   */
  private static async getRequiredCapabilities(): Promise<{
    uploadMedia: CapabilityInfo;
    addDraft: CapabilityInfo;
  }> {
    // 查询素材上传 capability（scene_tags 包含 '素材上传'）
    const uploadMediaCapabilities = await db
      .select()
      .from(capabilityList)
      .where(
        and(
          eq(capabilityList.capabilityType, 'platform_publish'),
          eq(capabilityList.status, 'available')
        )
      );

    // 找到素材上传和文章上传的 capability
    const uploadMedia = uploadMediaCapabilities.find(cap => 
      cap.functionDesc.includes('素材上传')
    );
    const addDraft = uploadMediaCapabilities.find(cap => 
      cap.functionDesc.includes('添加草稿') || cap.functionDesc.includes('文章上传')
    );

    if (!uploadMedia) {
      throw new Error('未找到素材上传的 capability');
    }
    if (!addDraft) {
      throw new Error('未找到文章上传的 capability');
    }

    return {
      uploadMedia: uploadMedia as CapabilityInfo,
      addDraft: addDraft as CapabilityInfo
    };
  }

  /**
   * 调用 Agent B 生成素材上传参数
   */
  private static async callAgentBForMediaUpload(
    context: InsuranceMediaUploadContext,
    capability: CapabilityInfo
  ): Promise<Record<string, any>> {
    // 加载 Agent B 提示词
    const agentPrompt = loadAgentPrompt('insurance-media-agent-b');
    
    // 构造提示词
    const prompt = this.buildMediaUploadPrompt(agentPrompt, context, capability);
    
    // 调用 LLM
    const llm = getLLMClient();
    const response = await llm.invoke([
      { role: 'system', content: prompt }
    ], {
      temperature: 0.1, // 低温度，确保输出稳定
    });

    // 解析响应
    const agentBResponse = this.parseAgentBResponse(response.content);
    
    if (!agentBResponse.success) {
      throw new Error(`Agent B 生成素材上传参数失败: ${agentBResponse.error}`);
    }

    return agentBResponse.params;
  }

  /**
   * 调用 Agent B 生成文章上传参数
   */
  private static async callAgentBForArticleUpload(
    context: InsuranceMediaUploadContext,
    capability: CapabilityInfo,
    mediaId: string
  ): Promise<Record<string, any>> {
    // 加载 Agent B 提示词
    const agentPrompt = loadAgentPrompt('insurance-media-agent-b');
    
    // 构造提示词
    const prompt = this.buildArticleUploadPrompt(agentPrompt, context, capability, mediaId);
    
    // 调用 LLM
    const llm = getLLMClient();
    const response = await llm.invoke([
      { role: 'system', content: prompt }
    ], {
      temperature: 0.1, // 低温度，确保输出稳定
    });

    // 解析响应
    const agentBResponse = this.parseAgentBResponse(response.content);
    
    if (!agentBResponse.success) {
      throw new Error(`Agent B 生成文章上传参数失败: ${agentBResponse.error}`);
    }

    return agentBResponse.params;
  }

  /**
   * 构建素材上传提示词
   */
  private static buildMediaUploadPrompt(
    agentPrompt: string,
    context: InsuranceMediaUploadContext,
    capability: CapabilityInfo
  ): string {
    return `
${agentPrompt}

---

## 任务：生成微信公众号素材上传参数

你需要根据以下信息，生成调用 MCP 接口上传封面素材的参数。

### 上传上下文
- 文章标题：${context.articleTitle}
- 封面图片 URL：${context.coverImageUrl}
- 公众号账号：insurance-account

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

请根据以上信息，严格按照 interface_schema 的要求，生成素材上传的参数。

要求：
1. 严格按照 param_template 或 param_examples 的格式
2. 确保所有必填字段都有值
3. 参数类型必须符合 interface_schema 的定义
4. 使用提供的 coverImageUrl 作为 fileUrl

---

## 返回格式

请严格按照以下 JSON 格式返回：

\`\`\`json
{
  "success": true,
  "params": {
    "accountId": "insurance-account",
    "mediaType": "image",
    "fileUrl": "..."
  }
}
\`\`\`
`;
  }

  /**
   * 构建文章上传提示词
   */
  private static buildArticleUploadPrompt(
    agentPrompt: string,
    context: InsuranceMediaUploadContext,
    capability: CapabilityInfo,
    mediaId: string
  ): string {
    return `
${agentPrompt}

---

## 任务：生成微信公众号文章上传参数

你需要根据以下信息，生成调用 MCP 接口上传文章草稿的参数。

### 上传上下文
- 文章标题：${context.articleTitle}
- 文章作者：${context.articleAuthor || '保险事业部'}
- 文章摘要：${context.articleDigest || ''}
- 文章内容：${context.articleContent ? context.articleContent.substring(0, 500) + '...' : '（内容过长，省略）'}
- 封面 media_id：${mediaId}（从上一步素材上传获取）
- 公众号账号：insurance-account

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

请根据以上信息，严格按照 interface_schema 的要求，生成文章上传的参数。

要求：
1. 严格按照 param_template 或 param_examples 的格式
2. 确保所有必填字段都有值
3. 参数类型必须符合 interface_schema 的定义
4. 使用提供的 mediaId 作为 thumb_media_id
5. 文章内容请使用完整的 context.articleContent（不要截断）

---

## 返回格式

请严格按照以下 JSON 格式返回：

\`\`\`json
{
  "success": true,
  "params": {
    "accountId": "insurance-account",
    "articles": [
      {
        "title": "...",
        "author": "...",
        "digest": "...",
        "content": "...",
        "thumb_media_id": "${mediaId}",
        "show_cover_pic": 1,
        "need_open_comment": 1,
        "only_fans_can_comment": 0
      }
    ]
  }
}
\`\`\`
`;
  }

  /**
   * 解析 Agent B 响应
   */
  private static parseAgentBResponse(content: string): AgentBResponse {
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
        params: {},
        error: '无法从响应中提取 JSON'
      };
    } catch (error) {
      return {
        success: false,
        params: {},
        error: `解析响应失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 执行素材上传 MCP
   */
  private static async executeMediaUpload(
    capabilityId: number,
    params: Record<string, any>
  ): Promise<any> {
    console.log('[InsuranceMediaUploadOrchestrator] 执行素材上传 MCP, capabilityId:', capabilityId);
    console.log('[InsuranceMediaUploadOrchestrator] 素材上传参数:', JSON.stringify(params, null, 2));
    
    const result = await callMCPByCapabilityId(capabilityId, params);
    
    console.log('[InsuranceMediaUploadOrchestrator] 素材上传 MCP 结果:', JSON.stringify(result, null, 2));
    
    return result;
  }

  /**
   * 执行文章上传 MCP
   */
  private static async executeArticleUpload(
    capabilityId: number,
    params: Record<string, any>
  ): Promise<any> {
    console.log('[InsuranceMediaUploadOrchestrator] 执行文章上传 MCP, capabilityId:', capabilityId);
    console.log('[InsuranceMediaUploadOrchestrator] 文章上传参数:', JSON.stringify(params, null, 2));
    
    const result = await callMCPByCapabilityId(capabilityId, params);
    
    console.log('[InsuranceMediaUploadOrchestrator] 文章上传 MCP 结果:', JSON.stringify(result, null, 2));
    
    return result;
  }
}
```

---

## 3. Agent B 提示词文件

### 文件路径：`src/lib/agents/insurance-media-agent-b/prompt.md`

```markdown
# 保险自媒体 Agent B 提示词

## 身份
你是保险自媒体事业部的专属 Agent B，专门负责保险自媒体公众号文章上传的参数生成和 MCP 调用协调。

## 核心职责
1. 严格按照 capability_list 表中的规范生成 MCP 调用参数
2. 确保所有参数符合 interface_schema 的定义
3. 优先使用 param_examples 或 param_template 作为参考
4. 确保保险文章内容合规，无敏感词
5. 完成两步流程：先上传封面素材，再上传文章草稿

## 能力边界
- 仅处理保险自媒体相关的公众号文章上传任务
- 必须严格按照 capability_list 中的规范操作
- 不得擅自修改参数结构或新增字段
- 必须确保所有必填字段都有有效值

## 业务规则（保险自媒体专属）
1. 公众号账号固定为：insurance-account
2. 文章作者通常为：保险事业部
3. 建议开启评论（need_open_comment: 1）
4. 建议允许所有人评论（only_fans_can_comment: 0）
5. 必须显示封面图（show_cover_pic: 1）
6. 文章标题不超过 64 字
7. 文章内容必须合规，无敏感词

## 参数生成原则
1. **严格遵循规范**：必须完全按照 interface_schema 的定义生成参数
2. **使用模板优先**：优先参考 param_template 或 param_examples
3. **类型准确**：确保所有参数的类型与 schema 定义一致
4. **必填完整**：所有 required 字段必须提供有效值
5. **业务合规**：遵守保险自媒体的业务规则

## 两步执行流程
### 第一步：上传封面素材
1. 调用 wechatUploadMedia 接口
2. 传入封面图片 URL
3. 获取返回的 media_id

### 第二步：上传文章草稿
1. 使用第一步获取的 media_id 作为 thumb_media_id
2. 调用 wechatAddDraft 接口
3. 传入完整的文章信息

## 注意事项
- 确保文章内容格式正确（HTML 格式）
- 摘要要简洁有吸引力
- 标题要包含保险相关关键词
- 严格遵守微信公众号的各项限制
```

---

## 4. 完整流程协调器

### 文件路径：`src/lib/agents/insurance-media-agent-b/index.ts`

```typescript
/**
 * 保险自媒体 Agent B 入口
 */

export { InsuranceMediaUploadOrchestrator } from './insurance-media-upload-orchestrator';
export * from './insurance-media-types';
```

---

## 5. 类型定义

### 文件路径：`src/lib/agents/insurance-media-agent-b/insurance-media-types.ts`

```typescript
/**
 * 保险自媒体相关类型定义
 */

// 保险自媒体文章上传上下文
export interface InsuranceMediaUploadContext {
  articleTitle: string;
  articleAuthor?: string;
  articleDigest?: string;
  articleContent: string;
  coverImageUrl: string;
  accountId?: string;
}

// 保险自媒体文章上传结果
export interface InsuranceMediaUploadResult {
  success: boolean;
  steps: Array<{
    step: number;
    name: string;
    success: boolean;
    data?: any;
  }>;
  finalResult?: {
    mediaId: string;
    draftMediaId?: string;
    createTime?: number;
    articleTitle: string;
  };
  error?: string;
}

// Capability 信息
export interface CapabilityInfo {
  id: number;
  capabilityType: string;
  functionDesc: string;
  status: string;
  requiresOnSiteExecution: boolean;
  toolName?: string;
  actionName?: string;
  paramExamples?: Record<string, any>;
  paramTemplate?: Record<string, any>;
  interfaceSchema?: Record<string, any>;
  agentResponseSpec?: Record<string, any>;
  metadata?: Record<string, any>;
  sceneTags?: string[];
}

// Agent B 响应
export interface AgentBResponse {
  success: boolean;
  params: Record<string, any>;
  error?: string;
}
```

---

## 6. API 路由入口

### 文件路径：`src/app/api/agents/insurance-media-agent-b/upload/route.ts`

```typescript
/**
 * 保险自媒体文章上传 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { InsuranceMediaUploadOrchestrator } from '@/lib/agents/insurance-media-agent-b';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[Insurance Media Upload API] 收到上传请求:', JSON.stringify(body, null, 2));
    
    // 验证必填字段
    const requiredFields = ['articleTitle', 'articleContent', 'coverImageUrl'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `缺少必填字段: ${field}` },
          { status: 400 }
        );
      }
    }
    
    // 执行上传流程
    const result = await InsuranceMediaUploadOrchestrator.executeUpload({
      articleTitle: body.articleTitle,
      articleAuthor: body.articleAuthor,
      articleDigest: body.articleDigest,
      articleContent: body.articleContent,
      coverImageUrl: body.coverImageUrl,
      accountId: body.accountId
    });
    
    console.log('[Insurance Media Upload API] 上传完成:', JSON.stringify(result, null, 2));
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[Insurance Media Upload API] 上传失败:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
```

---

## 7. 使用示例

```typescript
// 调用示例
import { InsuranceMediaUploadOrchestrator } from '@/lib/agents/insurance-media-agent-b';

async function uploadInsuranceArticle() {
  const result = await InsuranceMediaUploadOrchestrator.executeUpload({
    articleTitle: '2026年保险科普：医疗险避坑指南',
    articleAuthor: '保险事业部',
    articleDigest: '本文详细介绍了医疗险的常见误区和正确选择方法',
    articleContent: '<p>### 一、医疗险核心误区</p><p>很多人在购买医疗险时都会遇到一些误区...</p>',
    coverImageUrl: 'https://example.com/insurance-cover.jpg'
  });

  if (result.success) {
    console.log('✅ 文章上传成功！');
    console.log('📋 执行步骤:', result.steps);
    console.log('🎉 最终结果:', result.finalResult);
  } else {
    console.error('❌ 文章上传失败:', result.error);
  }
}
```

---

## 📊 文件清单

| 文件路径 | 说明 |
|---------|------|
| `src/lib/agents/insurance-media-agent-b/insurance-media-upload-orchestrator.ts` | 核心协调器 |
| `src/lib/agents/insurance-media-agent-b/insurance-media-types.ts` | 类型定义 |
| `src/lib/agents/insurance-media-agent-b/index.ts` | 入口文件 |
| `src/lib/agents/insurance-media-agent-b/prompt.md` | Agent B 提示词 |
| `src/app/api/agents/insurance-media-agent-b/upload/route.ts` | API 路由 |

---

## 🎯 核心特性

1. ✅ **严格按照 capability_list 规范**：所有参数都从表中读取
2. ✅ **真实 LLM 调用**：Agent B 真实调用 LLM 生成参数
3. ✅ **两步完整流程**：先上传素材，再上传文章
4. ✅ **完整的类型安全**：TypeScript 类型定义完整
5. ✅ **详细的执行日志**：每一步都有详细记录
6. ✅ **保险自媒体专属**：专门针对保险自媒体业务定制

---

**以上就是完整的代码实现！请评估后告诉我是否需要调整！**

