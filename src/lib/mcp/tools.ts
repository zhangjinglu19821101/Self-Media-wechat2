/**
 * MCP 工具封装
 * 为 Agent B 提供高级工具接口
 */

import {
  readFile,
  writeFile,
  httpGet as mcpHttpGet,
  httpPost as mcpHttpPost,
  createMCPClient as initMCPClient,
} from './client';

/**
 * 初始化 MCP 客户端
 */
export async function initializeMCP(agentId: string = 'agent_b') {
  return await initMCPClient(agentId);
}

/**
 * === 文件操作工具 ===
 */

/**
 * 读取文件内容（支持 JSON 解析）
 */
export async function readJSON<T = any>(filePath: string): Promise<T> {
  const content = await readFile(filePath);
  return JSON.parse(content) as T;
}

/**
 * 读取 Markdown 文件
 */
export async function readMarkdown(filePath: string): Promise<string> {
  return await readFile(filePath);
}

/**
 * 写入 JSON 文件
 */
export async function writeJSON(filePath: string, data: any): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await writeFile(filePath, content);
}

/**
 * 写入 Markdown 文件
 */
export async function writeMarkdown(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content);
}

/**
 * 追加内容到文件
 */
export async function appendFile(filePath: string, content: string): Promise<void> {
  const existingContent = await readFile(filePath).catch(() => '');
  await writeFile(filePath, existingContent + content);
}

/**
 * === HTTP 请求工具 ===
 */

/**
 * 发送 HTTP GET 请求（支持 JSON 解析）
 */
export async function httpGetJSON<T = any>(url: string, headers?: Record<string, string>): Promise<T> {
  const response = await mcpHttpGet(url, headers);
  return JSON.parse(response) as T;
}

/**
 * 发送 HTTP GET 请求（文本）
 */
export async function httpGetText(url: string, headers?: Record<string, string>): Promise<string> {
  return await mcpHttpGet(url, headers);
}

/**
 * 发送 HTTP POST 请求（支持 JSON 解析）
 */
export async function httpPostJSON<T = any>(url: string, body: any, headers?: Record<string, string>): Promise<T> {
  const response = await mcpHttpPost(url, body, headers);
  return JSON.parse(response) as T;
}

/**
 * 发送 HTTP POST 请求（文本）
 */
export async function httpPostText(url: string, body: any, headers?: Record<string, string>): Promise<string> {
  return await mcpHttpPost(url, body, headers);
}

/**
 * === 数据库查询工具 ===
 */

/**
 * 查询数据库（通过 HTTP API）
 */
export async function queryDatabase(query: string, params?: any[]): Promise<any[]> {
  // 这里假设有一个数据库查询的 HTTP API
  // 实际实现需要根据具体的数据库架构调整
  const response = await httpPostJSON<{ success: boolean; data: any[] }>(
    '/api/database/query',
    { query, params }
  );

  if (!response.success) {
    throw new Error('Database query failed');
  }

  return response.data;
}

/**
 * === 知识库工具 ===
 */

/**
 * 搜索知识库
 */
export async function searchKnowledge(query: string, topK: number = 5): Promise<any[]> {
  const response = await httpPostJSON<{ success: boolean; results: any[] }>(
    '/api/knowledge/search',
    { query, topK }
  );

  if (!response.success) {
    throw new Error('Knowledge search failed');
  }

  return response.results;
}

/**
 * === 工具集 ===
 */

/**
 * Agent B 工具集
 */
export const AgentBTools = {
  // 文件操作
  readJSON,
  readMarkdown,
  writeJSON,
  writeMarkdown,
  appendFile,

  // HTTP 请求
  httpGetJSON,
  httpGetText,
  httpPostJSON,
  httpPostText,

  // 数据库
  queryDatabase,

  // 知识库
  searchKnowledge,
};

/**
 * 工具使用示例
 */
export async function exampleUsage() {
  // 初始化 MCP
  await initializeMCP('agent_b');

  // 读取配置文件
  const config = await readJSON<any>('/workspace/projects/package.json');
  console.log('Project name:', config.name);

  // 读取文档
  const doc = await readMarkdown('/workspace/projects/README.md');
  console.log('Doc length:', doc.length);

  // 发送 HTTP 请求
  const data = await httpGetJSON<any>('https://api.example.com/data');
  console.log('API response:', data);

  // 搜索知识库
  const results = await searchKnowledge('如何使用 MCP');
  console.log('Search results:', results);
}
