/**
 * API 动态注册使用示例
 * 
 * 展示如何使用 API 动态注册 MCP 工具
 */

// ============================================
// 示例 1: 简单的邮件工具
// ============================================

export const EmailExample = {
  name: 'email',
  description: '邮件相关工具：发送邮件',
  tools: {
    async sendEmail(params: {
      to: string;
      subject: string;
      body: string;
    }) {
      console.log('[Email Example] 发送邮件:', params);
      
      // TODO: 这里接入真实的邮件服务
      // 比如：nodemailer, SendGrid, AWS SES 等
      
      // 模拟发送成功
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        success: true,
        messageId: `msg_${Date.now()}`,
        sentAt: new Date().toISOString(),
        to: params.to,
        subject: params.subject,
      };
    },
  },
};

// ============================================
// 示例 2: 天气工具
// ============================================

export const WeatherExample = {
  name: 'weather',
  description: '天气相关工具：获取天气信息',
  tools: {
    async getWeather(params: {
      city: string;
    }) {
      console.log('[Weather Example] 获取天气:', params.city);
      
      // TODO: 这里接入真实的天气 API
      // 比如：和风天气、OpenWeatherMap 等
      
      // 模拟返回天气数据
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const conditions = ['晴天', '多云', '阴天', '小雨', '大雨'];
      const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
      
      return {
        success: true,
        city: params.city,
        temperature: Math.floor(Math.random() * 30) + 10,
        condition: randomCondition,
        humidity: Math.floor(Math.random() * 50) + 30,
        windSpeed: Math.floor(Math.random() * 20) + 5,
        updatedAt: new Date().toISOString(),
      };
    },
  },
};

// ============================================
// 示例 3: 计算工具
// ============================================

export const CalculatorExample = {
  name: 'calculator',
  description: '计算器工具：加减乘除',
  tools: {
    add(a: number, b: number) {
      return { success: true, result: a + b };
    },
    subtract(a: number, b: number) {
      return { success: true, result: a - b };
    },
    multiply(a: number, b: number) {
      return { success: true, result: a * b };
    },
    divide(a: number, b: number) {
      if (b === 0) {
        return { success: false, error: '除数不能为零' };
      }
      return { success: true, result: a / b };
    },
  },
};

// ============================================
// 所有示例工具
// ============================================

export const ALL_EXAMPLES = [
  EmailExample,
  WeatherExample,
  CalculatorExample,
];
