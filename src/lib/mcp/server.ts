/**
 * MCP Server 实现
 * 为 Agent B 提供本地文件读取、远程数据查询和微信公众号操作能力
 *
 * 安全机制：
 * 1. 权限控制：仅 Agent B 可调用
 * 2. 路径白名单：限制可访问的文件路径
 * 3. 域名白名单：限制可访问的远程域名
 * 4. 审计日志：记录所有 MCP 调用
 *
 * 微信公众号功能：
 * - 获取账号列表
 * - 添加草稿
 * - 获取草稿列表
 * - 删除草稿
 * - 上传图片素材
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  WechatMCPTools,
  type WechatAddDraftParams,
  type WechatGetDraftListParams,
  type WechatDeleteDraftParams,
  type WechatUploadMediaParams,
} from './wechat-tools';
import {
  SearchMCPTools,
  type WebSearchParams,
  type WebSearchWithSummaryParams,
  type ImageSearchParams,
} from './web-search-executor';

// === 权限控制配置 ===

// 允许调用的 Agent ID 白名单
const ALLOWED_AGENTS = ['agent_b', 'Agent B', 'B'];

// 允许访问的文件路径白名单
const ALLOWED_PATHS = [
  '/workspace/projects',
  '/tmp',
  '/public',
];

// 允许访问的远程域名白名单
const ALLOWED_DOMAINS = [
  'api.openai.com',
  'api.anthropic.com',
  'api.coze.cn',
  '*.volces.com',
];

// === 审计日志配置 ===

interface AuditLogEntry {
  timestamp: Date;
  agentId: string;
  toolName: string;
  params: any;
  result: 'success' | 'failed' | 'denied';
  error?: string;
}

// 内存中存储审计日志（生产环境应该使用数据库）
const auditLogs: AuditLogEntry[] = [];

/**
 * 记录审计日志
 */
function logAudit(entry: AuditLogEntry) {
  auditLogs.push(entry);
  console.log(`[MCP Audit] ${entry.timestamp.toISOString()} | ${entry.agentId} | ${entry.toolName} | ${entry.result}`);
  if (entry.error) {
    console.error(`[MCP Audit] Error: ${entry.error}`);
  }
}

/**
 * 验证 Agent 权限
 */
function validateAgentPermission(agentId: string): boolean {
  if (!agentId) {
    return false;
  }
  return ALLOWED_AGENTS.some(allowed => {
    // 支持精确匹配和模糊匹配
    if (allowed === '*') return true;
    if (allowed === agentId) return true;
    if (allowed.includes('*')) {
      const pattern = allowed.replace('*', '.*');
      return new RegExp(pattern, 'i').test(agentId);
    }
    return false;
  });
}

/**
 * 验证文件路径权限
 */
function validatePathPermission(filePath: string): boolean {
  // 标准化路径
  const normalizedPath = filePath.replace(/\\/g, '/');

  // 检查是否在允许的路径白名单内
  return ALLOWED_PATHS.some(allowedPath => {
    if (allowedPath.endsWith('/*')) {
      const basePath = allowedPath.replace('/*', '');
      return normalizedPath.startsWith(basePath + '/');
    } else {
      return normalizedPath.startsWith(allowedPath);
    }
  });
}

/**
 * 验证域名权限
 */
function validateDomainPermission(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    return ALLOWED_DOMAINS.some(allowedDomain => {
      if (allowedDomain === '*') return true;
      if (allowedDomain === hostname) return true;
      if (allowedDomain.startsWith('*.')) {
        // 支持通配符域名，如 *.volces.com
        const baseDomain = allowedDomain.substring(2);
        return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
      }
      return false;
    });
  } catch (error) {
    return false;
  }
}

/**
 * 创建 MCP Server
 */
export async function createMCPServer(agentId: string) {
  // 验证权限
  if (!validateAgentPermission(agentId)) {
    throw new Error(`Permission denied: Agent ${agentId} is not allowed to access MCP`);
  }

  // 创建 MCP Server
  const server = new McpServer(
    {
      name: 'agent-b-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 注册工具列表处理器
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'read_file',
          description: '读取本地文件内容',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: '文件路径',
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'write_file',
          description: '写入本地文件',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: '文件路径',
              },
              content: {
                type: 'string',
                description: '文件内容',
              },
            },
            required: ['filePath', 'content'],
          },
        },
        {
          name: 'http_get',
          description: '发送 HTTP GET 请求',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: '请求 URL',
              },
              headers: {
                type: 'object',
                description: '请求头（可选）',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'http_post',
          description: '发送 HTTP POST 请求',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: '请求 URL',
              },
              body: {
                type: 'object',
                description: '请求体',
              },
              headers: {
                type: 'object',
                description: '请求头（可选）',
              },
            },
            required: ['url', 'body'],
          },
        },
        {
          name: 'wechat_get_accounts',
          description: '获取微信公众号账号列表',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'wechat_add_draft',
          description: '添加微信公众号草稿',
          inputSchema: {
            type: 'object',
            properties: {
              accountId: {
                type: 'string',
                description: '公众号账号ID',
              },
              articles: {
                type: 'array',
                description: '文章列表',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: '文章标题' },
                    author: { type: 'string', description: '作者（可选）' },
                    digest: { type: 'string', description: '摘要（可选）' },
                    content: { type: 'string', description: '文章内容（HTML格式）' },
                    contentSourceUrl: { type: 'string', description: '原文链接（可选）' },
                    thumbMediaId: { type: 'string', description: '封面素材ID（可选）' },
                    needOpenComment: { type: 'integer', description: '是否开启评论（0/1，可选）' },
                    onlyFansCanComment: { type: 'integer', description: '仅粉丝可评论（0/1，可选）' },
                    showCoverPic: { type: 'integer', description: '是否显示封面（0/1，可选）' },
                  },
                  required: ['title', 'content'],
                },
              },
            },
            required: ['accountId', 'articles'],
          },
        },
        {
          name: 'wechat_get_draft_list',
          description: '获取微信公众号草稿列表',
          inputSchema: {
            type: 'object',
            properties: {
              accountId: {
                type: 'string',
                description: '公众号账号ID',
              },
              offset: {
                type: 'integer',
                description: '偏移量（可选，默认0）',
              },
              count: {
                type: 'integer',
                description: '数量（可选，默认20）',
              },
            },
            required: ['accountId'],
          },
        },
        {
          name: 'wechat_delete_draft',
          description: '删除微信公众号草稿',
          inputSchema: {
            type: 'object',
            properties: {
              accountId: {
                type: 'string',
                description: '公众号账号ID',
              },
              mediaId: {
                type: 'string',
                description: '草稿素材ID',
              },
            },
            required: ['accountId', 'mediaId'],
          },
        },
        {
          name: 'wechat_upload_media',
          description: '上传微信公众号图片素材',
          inputSchema: {
            type: 'object',
            properties: {
              accountId: {
                type: 'string',
                description: '公众号账号ID',
              },
              mediaType: {
                type: 'string',
                description: '素材类型（目前仅支持image）',
                enum: ['image'],
              },
              fileUrl: {
                type: 'string',
                description: '文件URL（fileUrl或fileBase64二选一）',
              },
              fileBase64: {
                type: 'string',
                description: '文件Base64（fileUrl或fileBase64二选一）',
              },
            },
            required: ['accountId', 'mediaType'],
          },
        },
        {
          name: 'web_search',
          description: '联网搜索-网页搜索',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: '搜索查询词',
              },
              count: {
                type: 'integer',
                description: '结果数量（默认10，最大50）',
                minimum: 1,
                maximum: 50,
              },
              needContent: {
                type: 'boolean',
                description: '是否获取完整内容（默认false）',
              },
              agentId: {
                type: 'string',
                description: 'Agent ID（可选，用于记录）',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'web_search_with_summary',
          description: '联网搜索-网页搜索带AI摘要',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: '搜索查询词',
              },
              count: {
                type: 'integer',
                description: '结果数量（默认10，最大50）',
                minimum: 1,
                maximum: 50,
              },
              needContent: {
                type: 'boolean',
                description: '是否获取完整内容（默认false）',
              },
              agentId: {
                type: 'string',
                description: 'Agent ID（可选，用于记录）',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'image_search',
          description: '联网搜索-图片搜索',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: '搜索查询词',
              },
              count: {
                type: 'integer',
                description: '结果数量（默认10，最大50）',
                minimum: 1,
                maximum: 50,
              },
              agentId: {
                type: 'string',
                description: 'Agent ID（可选，用于记录）',
              },
            },
            required: ['query'],
          },
        },
      ],
    };
  });

  // 注册工具调用处理器
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // 记录审计日志
    const auditEntry: AuditLogEntry = {
      timestamp: new Date(),
      agentId,
      toolName: name,
      params: args,
      result: 'success',
    };

    try {
      switch (name) {
        case 'read_file':
          return await handleReadFile(args as { filePath: string }, auditEntry);
        case 'write_file':
          return await handleWriteFile(args as { filePath: string; content: string }, auditEntry);
        case 'http_get':
          return await handleHttpGet(args as { url: string; headers?: Record<string, string> }, auditEntry);
        case 'http_post':
          return await handleHttpPost(args as { url: string; body: any; headers?: Record<string, string> }, auditEntry);
        case 'wechat_get_accounts':
          return await handleWechatGetAccounts(auditEntry);
        case 'wechat_add_draft':
          return await handleWechatAddDraft(args as WechatAddDraftParams, auditEntry);
        case 'wechat_get_draft_list':
          return await handleWechatGetDraftList(args as WechatGetDraftListParams, auditEntry);
        case 'wechat_delete_draft':
          return await handleWechatDeleteDraft(args as WechatDeleteDraftParams, auditEntry);
        case 'wechat_upload_media':
          return await handleWechatUploadMedia(args as WechatUploadMediaParams, auditEntry);
        case 'web_search':
          return await handleWebSearch(args as WebSearchParams, auditEntry);
        case 'web_search_with_summary':
          return await handleWebSearchWithSummary(args as WebSearchWithSummaryParams, auditEntry);
        case 'image_search':
          return await handleImageSearch(args as ImageSearchParams, auditEntry);
        default:
          auditEntry.result = 'failed';
          auditEntry.error = `Unknown tool: ${name}`;
          logAudit(auditEntry);
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      auditEntry.result = 'failed';
      auditEntry.error = error instanceof Error ? error.message : String(error);
      logAudit(auditEntry);
      throw error;
    }
  });

  return server;
}

/**
 * 处理文件读取
 */
async function handleReadFile(args: { filePath: string }, auditEntry: AuditLogEntry) {
  const { filePath } = args;

  // 验证路径权限
  if (!validatePathPermission(filePath)) {
    auditEntry.result = 'denied';
    auditEntry.error = `Path ${filePath} is not in allowed paths`;
    logAudit(auditEntry);
    throw new Error(`Permission denied: Path ${filePath} is not in allowed paths`);
  }

  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');

    logAudit(auditEntry);

    return {
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
    };
  } catch (error) {
    auditEntry.result = 'failed';
    auditEntry.error = error instanceof Error ? error.message : String(error);
    logAudit(auditEntry);
    throw error;
  }
}

/**
 * 处理文件写入
 */
async function handleWriteFile(args: { filePath: string; content: string }, auditEntry: AuditLogEntry) {
  const { filePath, content } = args;

  // 验证路径权限
  if (!validatePathPermission(filePath)) {
    auditEntry.result = 'denied';
    auditEntry.error = `Path ${filePath} is not in allowed paths`;
    logAudit(auditEntry);
    throw new Error(`Permission denied: Path ${filePath} is not in allowed paths`);
  }

  try {
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, content, 'utf-8');

    logAudit(auditEntry);

    return {
      content: [
        {
          type: 'text',
          text: `File ${filePath} written successfully`,
        },
      ],
    };
  } catch (error) {
    auditEntry.result = 'failed';
    auditEntry.error = error instanceof Error ? error.message : String(error);
    logAudit(auditEntry);
    throw error;
  }
}

/**
 * 处理 HTTP GET 请求
 */
async function handleHttpGet(args: { url: string; headers?: Record<string, string> }, auditEntry: AuditLogEntry) {
  const { url, headers } = args;

  // 验证域名权限
  if (!validateDomainPermission(url)) {
    auditEntry.result = 'denied';
    auditEntry.error = `Domain of ${url} is not in allowed domains`;
    logAudit(auditEntry);
    throw new Error(`Permission denied: Domain of ${url} is not in allowed domains`);
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers || {},
    });

    const text = await response.text();

    logAudit(auditEntry);

    return {
      content: [
        {
          type: 'text',
          text: text,
        },
      ],
    };
  } catch (error) {
    auditEntry.result = 'failed';
    auditEntry.error = error instanceof Error ? error.message : String(error);
    logAudit(auditEntry);
    throw error;
  }
}

/**
 * 处理 HTTP POST 请求
 */
async function handleHttpPost(args: { url: string; body: any; headers?: Record<string, string> }, auditEntry: AuditLogEntry) {
  const { url, body, headers } = args;

  // 验证域名权限
  if (!validateDomainPermission(url)) {
    auditEntry.result = 'denied';
    auditEntry.error = `Domain of ${url} is not in allowed domains`;
    logAudit(auditEntry);
    throw new Error(`Permission denied: Domain of ${url} is not in allowed domains`);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    logAudit(auditEntry);

    return {
      content: [
        {
          type: 'text',
          text: text,
        },
      ],
    };
  } catch (error) {
    auditEntry.result = 'failed';
    auditEntry.error = error instanceof Error ? error.message : String(error);
    logAudit(auditEntry);
    throw error;
  }
}

/**
 * 获取审计日志
 */
export function getAuditLogs(): AuditLogEntry[] {
  return [...auditLogs];
}

/**
 * 清空审计日志
 */
export function clearAuditLogs(): void {
  auditLogs.length = 0;
}

// === 微信公众号工具处理函数 ===

/**
 * 处理获取微信公众号账号列表
 */
async function handleWechatGetAccounts(auditEntry: AuditLogEntry) {
  try {
    const result = await WechatMCPTools.getAccounts();

    logAudit(auditEntry);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    auditEntry.result = 'failed';
    auditEntry.error = error instanceof Error ? error.message : String(error);
    logAudit(auditEntry);
    throw error;
  }
}

/**
 * 处理添加微信公众号草稿
 */
async function handleWechatAddDraft(args: WechatAddDraftParams, auditEntry: AuditLogEntry) {
  try {
    const result = await WechatMCPTools.addDraft(args);

    logAudit(auditEntry);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    auditEntry.result = 'failed';
    auditEntry.error = error instanceof Error ? error.message : String(error);
    logAudit(auditEntry);
    throw error;
  }
}

/**
 * 处理获取微信公众号草稿列表
 */
async function handleWechatGetDraftList(args: WechatGetDraftListParams, auditEntry: AuditLogEntry) {
  try {
    const result = await WechatMCPTools.getDraftList(args);

    logAudit(auditEntry);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    auditEntry.result = 'failed';
    auditEntry.error = error instanceof Error ? error.message : String(error);
    logAudit(auditEntry);
    throw error;
  }
}

/**
 * 处理删除微信公众号草稿
 */
async function handleWechatDeleteDraft(args: WechatDeleteDraftParams, auditEntry: AuditLogEntry) {
  try {
    const result = await WechatMCPTools.deleteDraft(args);

    logAudit(auditEntry);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    auditEntry.result = 'failed';
    auditEntry.error = error instanceof Error ? error.message : String(error);
    logAudit(auditEntry);
    throw error;
  }
}

/**
 * 处理上传微信公众号图片素材
 */
async function handleWechatUploadMedia(args: WechatUploadMediaParams, auditEntry: AuditLogEntry) {
  try {
    const result = await WechatMCPTools.uploadMedia(args);

    logAudit(auditEntry);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    auditEntry.result = 'failed';
    auditEntry.error = error instanceof Error ? error.message : String(error);
    logAudit(auditEntry);
    throw error;
  }
}

// === 搜索工具处理函数 ===

/**
 * 处理网页搜索
 */
async function handleWebSearch(args: WebSearchParams, auditEntry: AuditLogEntry) {
  try {
    const result = await SearchMCPTools.webSearch(args);

    logAudit(auditEntry);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    auditEntry.result = 'failed';
    auditEntry.error = error instanceof Error ? error.message : String(error);
    logAudit(auditEntry);
    throw error;
  }
}

/**
 * 处理网页搜索带摘要
 */
async function handleWebSearchWithSummary(args: WebSearchWithSummaryParams, auditEntry: AuditLogEntry) {
  try {
    const result = await SearchMCPTools.webSearchWithSummary(args);

    logAudit(auditEntry);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    auditEntry.result = 'failed';
    auditEntry.error = error instanceof Error ? error.message : String(error);
    logAudit(auditEntry);
    throw error;
  }
}

/**
 * 处理图片搜索
 */
async function handleImageSearch(args: ImageSearchParams, auditEntry: AuditLogEntry) {
  try {
    const result = await SearchMCPTools.imageSearch(args);

    logAudit(auditEntry);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    auditEntry.result = 'failed';
    auditEntry.error = error instanceof Error ? error.message : String(error);
    logAudit(auditEntry);
    throw error;
  }
}
