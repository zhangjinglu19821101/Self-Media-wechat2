/**
 * 邮件工具示例
 * 
 * 展示如何使用 ToolRegistry 动态注册新的 MCP 工具
 * 
 * 使用方式：
 * 1. 定义工具类/对象
 * 2. 调用 toolRegistry.registerTool() 注册
 * 3. Agent B 就能自动发现并使用这个工具
 */

import { toolRegistry } from '../tool-registry';

// === 邮件工具类型定义 ===

export interface SendEmailParams {
  to: string;              // 收件人邮箱
  subject: string;         // 邮件主题
  body: string;            // 邮件内容
  cc?: string[];           // 抄送（可选）
  bcc?: string[];          // 密送（可选）
  attachments?: string[];  // 附件（可选）
}

export interface SendEmailResult {
  success: boolean;
  messageId: string;
  sentAt: Date;
}

// === 邮件工具实现 ===

export const EmailMCPTools = {
  /**
   * 发送邮件
   */
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    console.log('[Email Tools] 发送邮件:', params);

    // TODO: 这里是示例，实际需要对接邮件服务
    // 比如：nodemailer, AWS SES, SendGrid 等
    
    // 模拟发送成功
    return {
      success: true,
      messageId: `msg_${Date.now()}`,
      sentAt: new Date(),
    };
  },

  /**
   * 获取邮件模板
   */
  async getTemplate(templateId: string) {
    console.log('[Email Tools] 获取邮件模板:', templateId);
    return {
      templateId,
      subject: '模板主题',
      body: '模板内容',
    };
  },
};

// === 动态注册邮件工具 ===

/**
 * 初始化邮件工具
 * 
 * 可以在应用启动时调用，或者在需要时动态注册
 */
export function registerEmailTools() {
  toolRegistry.registerTool(
    'email',
    EmailMCPTools,
    '邮件相关工具：发送邮件、获取邮件模板'
  );
  
  console.log('[Email Tools] 邮件工具已注册');
  console.log('[Email Tools] 当前可用工具:', toolRegistry.getAvailableTools());
}

// === 使用示例 ===

/*
// 在应用启动时注册
import { registerEmailTools } from './mcp/examples/email-tools.example';

registerEmailTools();

// 或者在需要时动态注册
// 甚至可以从数据库读取配置，动态加载插件
*/
