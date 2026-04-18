/**
 * ============================================
 * 完整的 MCP 服务端示例
 * 
 * 这个文件展示了如何实现一个标准的 MCP 服务端
 * 客户端可以零开发接入！
 * ============================================
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ============================================
// 1. 类型定义
// ============================================

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
}

export interface SendEmailResult {
  success: boolean;
  messageId: string;
  sentAt: string;
}

export interface GetWeatherParams {
  city: string;
}

export interface GetWeatherResult {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
}

// ============================================
// 2. 工具实现
// ============================================

class EmailService {
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    console.log('[EmailService] 发送邮件:', JSON.stringify(params, null, 2));
    
    // TODO: 这里接入真实的邮件服务（如 SendGrid、AWS SES 等）
    // 现在模拟成功
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sentAt: new Date().toISOString(),
    };
  }
}

class WeatherService {
  async getWeather(params: GetWeatherParams): Promise<GetWeatherResult> {
    console.log('[WeatherService] 获取天气:', params.city);
    
    // TODO: 这里接入真实的天气 API
    // 现在模拟返回数据
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const conditions = ['晴天', '多云', '阴天', '小雨'];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    
    return {
      city: params.city,
      temperature: Math.floor(Math.random() * 30) + 10,
      condition: randomCondition,
      humidity: Math.floor(Math.random() * 50) + 30,
    };
  }
}

// ============================================
// 3. 创建 MCP 服务端
// ============================================

async function createMCPServer() {
  console.log('[MCP Server] 正在启动...');

  // 创建服务实例
  const emailService = new EmailService();
  const weatherService = new WeatherService();

  // 创建 MCP Server
  const server = new McpServer(
    {
      name: 'my-awesome-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // ============================================
  // 4. 注册工具列表（最重要的部分！）
  // ============================================

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.log('[MCP Server] 客户端请求工具列表');
    
    return {
      tools: [
        {
          name: 'send_email',
          description: '发送邮件到指定邮箱地址，支持抄送和密送',
          inputSchema: {
            type: 'object',
            properties: {
              to: {
                type: 'string',
                description: '收件人邮箱地址，例如：user@example.com',
              },
              subject: {
                type: 'string',
                description: '邮件主题',
              },
              body: {
                type: 'string',
                description: '邮件内容，支持 HTML 格式',
              },
              cc: {
                type: 'array',
                items: { type: 'string' },
                description: '抄送邮箱列表（可选）',
              },
              bcc: {
                type: 'array',
                items: { type: 'string' },
                description: '密送邮箱列表（可选）',
              },
            },
            required: ['to', 'subject', 'body'],
          },
        },
        {
          name: 'get_weather',
          description: '获取指定城市的天气信息',
          inputSchema: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
                description: '城市名称，例如：北京、上海、深圳',
              },
            },
            required: ['city'],
          },
        },
      ],
    };
  });

  // ============================================
  // 5. 注册工具调用处理器
  // ============================================

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    console.log(`[MCP Server] 调用工具: ${name}`, JSON.stringify(args, null, 2));

    try {
      let result: any;

      switch (name) {
        case 'send_email':
          result = await emailService.sendEmail(args as SendEmailParams);
          break;

        case 'get_weather':
          result = await weatherService.getWeather(args as GetWeatherParams);
          break;

        default:
          throw new Error(`未知工具: ${name}`);
      }

      console.log('[MCP Server] 工具调用成功:', JSON.stringify(result, null, 2));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error('[MCP Server] 工具调用失败:', error);
      return {
        content: [
          {
            type: 'text',
            text: `错误: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // ============================================
  // 6. 启动服务
  // ============================================

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log('[MCP Server] 启动成功！等待客户端连接...');
  console.log('[MCP Server] 可用工具: send_email, get_weather');
}

// ============================================
// 启动服务
// ============================================

createMCPServer().catch((error) => {
  console.error('[MCP Server] 启动失败:', error);
  process.exit(1);
});
