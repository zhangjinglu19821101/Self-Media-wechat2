/**
 * 微信公众号-添加草稿 MCP 能力实现
 *
 * 能力 ID：11
 * 能力名称：微信公众号-添加草稿
 *
 * 设计原则：
 * 1. 继承 BaseMCPCapabilityExecutor
 * 2. 实现 execute 方法
 * 3. 注册到 MCPCapabilityExecutorFactory
 *
 * 实现说明：
 * - 使用项目中已有的微信公众号 API 封装
 * - 支持多种账号匹配方式
 * - 支持至少 2 个微信公众号账号的管理
 * - 🔥 上传草稿后自动通过 Playwright 配置原创声明/赞赏/合集
 */

import { BaseMCPCapabilityExecutor, MCPCapabilityExecutorFactory } from './mcp-executor';
import { MCPExecutionResult } from './types';
import { matchAccount, listAvailableAccounts, getDraftDefaults } from '@/config/wechat-official-account.config';
import { addDraft, formatArticleForWechat } from '@/lib/wechat-official-account/api';
// wechat-automation 使用动态导入，避免 Playwright 模块缺失阻断 MCP 注册

/**
 * 微信公众号-添加草稿 MCP 能力执行器
 */
export class WeChatDraftCreatorExecutor extends BaseMCPCapabilityExecutor {
  readonly capabilityId = 11;
  readonly capabilityName = '微信公众号-添加草稿';

  /**
   * 执行微信公众号添加草稿
   *
   * 流程：
   * 1. 智能匹配公众号
   * 2. 格式化文章内容（自动应用默认配置）
   * 3. 调用微信 API 添加草稿
   * 4. 🔥 自动配置原创声明/赞赏/合集（需 Cookie 授权）
   *
   * @param params 参数（包含 accountName?, agent?, title, content
   * @returns MCP 执行结果
   */
  protected async execute(params: Record<string, any>): Promise<MCPExecutionResult> {
    const { accountName, agent, title, content } = params;

    console.log(`[WeChatDraftCreator] 开始添加草稿...`);
    console.log(`[WeChatDraftCreator] 账号名称：${accountName || '未指定'}`);
    console.log(`[WeChatDraftCreator] Agent 类型：${agent || '未指定'}`);
    console.log(`[WeChatDraftCreator] 文章标题：${title}`);
    console.log(`[WeChatDraftCreator] 文章内容长度：${content?.length || 0} 字符`);

    try {
      // 步骤 1：智能匹配公众号
      console.log(`[WeChatDraftCreator] 步骤 1：智能匹配公众号...`);

      const account = matchAccount({
        accountId: accountName,
        agent: agent as 'insurance-d' | 'agent-d' | undefined,
      });

      // 如果没有匹配到账号，返回可用账号列表
      if (!account) {
        console.log(`[WeChatDraftCreator] 未匹配到账号，返回可用账号列表`);
        const availableAccounts = listAvailableAccounts(agent as 'insurance-d' | 'agent-d' | undefined);

        return {
          success: false,
          error: '未找到匹配的公众号，请选择以下账号之一',
          data: {
            availableAccounts,
            hint: '请在 accountName 或 agent 参数中指定账号',
          },
          executionTime: new Date().toISOString(),
        };
      }

      console.log(`[WeChatDraftCreator] 步骤 1 完成：找到公众号 ${account.name}`);

      // 步骤 2：格式化文章内容（自动应用默认配置）
      console.log(`[WeChatDraftCreator] 步骤 2：格式化文章内容...`);
      const draftDefaults = getDraftDefaults(account.id);
      const draft = formatArticleForWechat(
        title,
        content,
        draftDefaults.author || account.defaultAuthor,
        undefined,
        undefined,
        account.id  // 🔥 传入 accountId，自动应用默认配置
      );
      console.log(`[WeChatDraftCreator] 步骤 2 完成：文章格式化完成`);

      // 步骤 3：调用微信公众号 API 添加草稿
      console.log(`[WeChatDraftCreator] 步骤 3：调用微信公众号 API...`);
      const result = await addDraft(account, [draft]);
      console.log(`[WeChatDraftCreator] 步骤 3 完成：草稿添加成功，media_id: ${result.media_id}`);

      // 步骤 4：🔥 自动配置原创声明/赞赏/合集（需 Cookie 授权）
      let autoConfigResult = null;
      try {
        const { hasValidCookie, autoConfigureDraft } = await import('@/lib/wechat-automation/wechat-automation');
        if (hasValidCookie(account.id)) {
          console.log(`[WeChatDraftCreator] 步骤 4：检测到有效 Cookie，开始自动配置...`);
          try {
            autoConfigResult = await autoConfigureDraft({
              accountId: account.id,
              mediaId: result.media_id,
              config: draftDefaults,
            });

            if (autoConfigResult.success) {
              console.log(`[WeChatDraftCreator] 步骤 4 完成：自动配置成功，已设置字段:`, autoConfigResult.configuredFields);
            } else {
              console.warn(`[WeChatDraftCreator] 步骤 4 失败：${autoConfigResult.error}`);
            }
          } catch (configError) {
            console.warn(`[WeChatDraftCreator] 步骤 4 异常（不影响草稿上传）:`, configError);
          }
        } else {
          console.log(`[WeChatDraftCreator] 步骤 4：Cookie 未授权，跳过自动配置（用户可在配置页扫码授权）`);
        }
      } catch (automationImportError) {
        console.warn(`[WeChatDraftCreator] 步骤 4：wechat-automation 模块不可用，跳过自动配置:`, automationImportError);
      }

      // 构建返回结果
      return {
        success: true,
        data: {
          mediaId: result.media_id,
          createTime: result.create_time,
          account: {
            id: account.id,
            name: account.name,
            agent: account.agent,
          },
          draft: {
            title,
            author: draft.author,
            digest: draft.digest,
          },
          // 🔥 新增：自动配置结果
          autoConfig: autoConfigResult ? {
            success: autoConfigResult.success,
            configuredFields: autoConfigResult.configuredFields,
            editUrl: autoConfigResult.editUrl,
          } : {
            success: false,
            configuredFields: [],
            reason: 'Cookie 未授权，请在公众号配置页扫码登录',
          },
        },
        executionTime: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[WeChatDraftCreator] 草稿添加失败：`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        executionTime: new Date().toISOString(),
      };
    }
  }
}

// 注册执行器到工厂
MCPCapabilityExecutorFactory.registerExecutor(new WeChatDraftCreatorExecutor());
