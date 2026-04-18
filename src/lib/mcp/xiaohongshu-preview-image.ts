/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 小红书预览图生成 MCP 能力实现
 *
 * 能力 ID：26
 * 能力名称：小红书-生成预览图
 *
 * 设计原则：
 * 1. 继承 BaseMCPCapabilityExecutor，与微信公众号添加草稿完全对称
 * 2. 使用 Playwright 访问预览页面 → 截图 → 上传到对象存储 → 返回图片 URL
 * 3. Agent T 完成此任务后，Agent B 顺势完成评审（与公众号上传逻辑一致）
 *
 * 流程：
 * 1. 根据 taskId 构建预览页面 URL
 * 2. Playwright 打开页面，等待渲染完成
 * 3. 截取小红书手机模拟器区域
 * 4. 上传图片到对象存储
 * 5. 返回预览图 URL
 */

import { BaseMCPCapabilityExecutor, MCPCapabilityExecutorFactory } from './mcp-executor';
import { MCPExecutionResult } from './types';
import { S3Storage } from 'coze-coding-dev-sdk';

// 对象存储实例（懒初始化）
let storageInstance: S3Storage | null = null;
function getStorage(): S3Storage {
  if (!storageInstance) {
    storageInstance = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });
  }
  return storageInstance;
}

/**
 * 小红书预览图生成 MCP 能力执行器
 */
export class XiaohongshuPreviewImageExecutor extends BaseMCPCapabilityExecutor {
  readonly capabilityId = 26;
  readonly capabilityName = '小红书-生成预览图';

  /**
   * 执行小红书预览图生成
   *
   * 流程：
   * 1. 根据 taskId 构建预览页面 URL
   * 2. Playwright 打开页面，等待渲染完成
   * 3. 截取预览区域
   * 4. 上传图片到对象存储
   * 5. 返回预览图 URL
   *
   * @param params 参数（taskId: 子任务ID）
   * @returns MCP 执行结果
   */
  protected async execute(params: Record<string, any>): Promise<MCPExecutionResult> {
    const { taskId } = params;

    console.log(`[XhsPreviewImage] 开始生成小红书预览图...`);
    console.log(`[XhsPreviewImage] 任务ID：${taskId}`);

    if (!taskId) {
      return {
        success: false,
        error: '缺少必填参数：taskId',
        executionTime: new Date().toISOString(),
      };
    }

    try {
      // 步骤 1：构建预览页面 URL
      const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
      const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
      const previewUrl = `${baseUrl}/xiaohongshu-preview/${taskId}`;
      console.log(`[XhsPreviewImage] 步骤 1：预览页面 URL = ${previewUrl}`);

      // 步骤 2：Playwright 打开页面并截图
      console.log(`[XhsPreviewImage] 步骤 2：启动 Playwright 截图...`);

      let screenshotBuffer: Buffer;

      try {
        const { chromium } = await import('playwright');
        const browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage({
          viewport: { width: 430, height: 932 }, // 手机尺寸
          deviceScaleFactor: 2, // 高清截图
        });

        // 访问预览页面
        await page.goto(previewUrl, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });

        // 等待页面渲染完成（window.__XHS_PREVIEW_READY__ = true）
        await page.waitForFunction(
          () => (window as any).__XHS_PREVIEW_READY__ === true,
          { timeout: 15000 }
        ).catch(() => {
          console.warn(`[XhsPreviewImage] 等待渲染完成超时，继续截图`);
        });

        // 额外等待确保字体和图片加载
        await page.waitForTimeout(1000);

        // 截取手机模拟器区域（.w-\\[375px\\] 容器）
        const phoneFrame = await page.$('.w-\\[375px\\]');
        if (phoneFrame) {
          screenshotBuffer = await phoneFrame.screenshot({ type: 'png' }) as Buffer;
          console.log(`[XhsPreviewImage] 截取手机模拟器区域成功`);
        } else {
          // 回退：截取整个页面
          screenshotBuffer = await page.screenshot({ type: 'png', fullPage: true }) as Buffer;
          console.log(`[XhsPreviewImage] 未找到手机模拟器区域，截取整个页面`);
        }

        await browser.close();
      } catch (playwrightError) {
        console.error(`[XhsPreviewImage] Playwright 截图失败:`, playwrightError);
        return {
          success: false,
          error: `截图失败: ${playwrightError instanceof Error ? playwrightError.message : '未知错误'}`,
          executionTime: new Date().toISOString(),
        };
      }

      // 步骤 3：上传图片到对象存储
      console.log(`[XhsPreviewImage] 步骤 3：上传截图到对象存储...`);
      const storage = getStorage();
      const fileName = `xiaohongshu-preview/${taskId}_${Date.now()}.png`;
      const fileKey = await storage.uploadFile({
        fileContent: screenshotBuffer!,
        fileName,
        contentType: 'image/png',
      });
      console.log(`[XhsPreviewImage] 步骤 3 完成：文件已上传，key = ${fileKey}`);

      // 步骤 4：生成签名 URL
      const presignedUrl = await storage.generatePresignedUrl({
        key: fileKey,
        expireTime: 86400 * 7, // 7天有效期
      });
      console.log(`[XhsPreviewImage] 步骤 4 完成：预览图 URL 已生成`);

      return {
        success: true,
        data: {
          taskId,
          previewImageUrl: presignedUrl,
          previewImageKey: fileKey,
          previewPageUrl: previewUrl,
          fileName,
        },
        executionTime: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[XhsPreviewImage] 预览图生成失败：`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        executionTime: new Date().toISOString(),
      };
    }
  }
}

// 注册执行器到工厂
MCPCapabilityExecutorFactory.registerExecutor(new XiaohongshuPreviewImageExecutor());
