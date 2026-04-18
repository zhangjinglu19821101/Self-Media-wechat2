/**
 * MCP Client 实现
 * 用于 Agent B 调用 MCP Server 获取本地文件和远程数据
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// MCP Client 实例
let mcpClient: Client | null = null;

/**
 * 创建 MCP Client
 */
export async function createMCPClient(agentId: string) {
  // 如果已经创建了客户端，直接返回
  if (mcpClient) {
    return mcpClient;
  }

  // 创建客户端
  const client = new Client(
    {
      name: 'agent-b-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  // 创建传输层（使用 Streamable HTTP）
  const transport = new StreamableHTTPClientTransport(
    new URL('http://localhost:5000/api/mcp')
  );

  // 连接到服务器
  await client.connect(transport);

  // 保存客户端实例
  mcpClient = client;

  console.log(`[MCP Client] Connected for agent: ${agentId}`);

  return client;
}

/**
 * 获取 MCP Client 实例
 */
export function getMCPClient(): Client | null {
  return mcpClient;
}

/**
 * 关闭 MCP Client
 */
export async function closeMCPClient(): Promise<void> {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
    console.log('[MCP Client] Disconnected');
  }
}

/**
 * 获取工具列表
 */
export async function listTools() {
  const client = getMCPClient();
  if (!client) {
    throw new Error('MCP Client not initialized');
  }

  const response = await client.listTools();
  return response.tools;
}

/**
 * 调用工具
 */
export async function callTool(toolName: string, args: any) {
  const client = getMCPClient();
  if (!client) {
    throw new Error('MCP Client not initialized');
  }

  const response = await client.callTool({
    name: toolName,
    arguments: args,
  });

  return response;
}

/**
 * 读取文件
 */
export async function readFile(filePath: string): Promise<string> {
  const response = await callTool('read_file', { filePath });

  // 提取文本内容
  const content = response.content.find((c: any) => c.type === 'text');
  if (!content) {
    throw new Error('No text content in response');
  }

  return content.text;
}

/**
 * 写入文件
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await callTool('write_file', { filePath, content });
}

/**
 * 发送 HTTP GET 请求
 */
export async function httpGet(url: string, headers?: Record<string, string>): Promise<string> {
  const response = await callTool('http_get', { url, headers });

  // 提取文本内容
  const content = response.content.find((c: any) => c.type === 'text');
  if (!content) {
    throw new Error('No text content in response');
  }

  return content.text;
}

/**
 * 发送 HTTP POST 请求
 */
export async function httpPost(url: string, body: any, headers?: Record<string, string>): Promise<string> {
  const response = await callTool('http_post', { url, body, headers });

  // 提取文本内容
  const content = response.content.find((c: any) => c.type === 'text');
  if (!content) {
    throw new Error('No text content in response');
  }

  return content.text;
}
