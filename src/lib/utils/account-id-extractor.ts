/**
 * 账号ID智能提取工具
 * 
 * 功能：
 * 1. 从任务内容中直接提取账号ID（如"公众号账号ID：insurance-account"）
 * 2. 根据任务所属的Agent类型智能匹配默认账号ID
 * 3. 提供多种匹配策略
 */

import { 
  getAgentAccount, 
  getAccountById, 
  listAvailableAccounts,
  WechatOfficialAccount
} from '@/config/wechat-official-account.config';

export interface AccountIdExtractionResult {
  success: boolean;
  accountId?: string;
  account?: WechatOfficialAccount;
  method: 'extracted' | 'agent_default' | 'fallback';
  message: string;
}

/**
 * 从文本中提取账号ID
 * 
 * 支持的格式：
 * - "公众号账号ID：insurance-account"
 * - "accountId: insurance-account"
 * - "使用账号：insurance-account"
 * - "上传到：insurance-account"
 */
export function extractAccountIdFromText(text: string): string | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // 模式1：中文冒号格式
  const pattern1 = /公众号账号ID[：:]\s*([a-zA-Z0-9_-]+)/i;
  const match1 = text.match(pattern1);
  if (match1 && match1[1]) {
    return match1[1];
  }

  // 模式2：accountId格式
  const pattern2 = /accountId[：:]\s*([a-zA-Z0-9_-]+)/i;
  const match2 = text.match(pattern2);
  if (match2 && match2[1]) {
    return match2[1];
  }

  // 模式3：使用账号格式
  const pattern3 = /使用账号[：:]\s*([a-zA-Z0-9_-]+)/i;
  const match3 = text.match(pattern3);
  if (match3 && match3[1]) {
    return match3[1];
  }

  // 模式4：上传到格式
  const pattern4 = /上传到[：:]\s*([a-zA-Z0-9_-]+)/i;
  const match4 = text.match(pattern4);
  if (match4 && match4[1]) {
    return match4[1];
  }

  return null;
}

/**
 * 智能获取账号ID
 * 
 * @param options 选项
 * @returns 账号ID提取结果
 */
export function smartGetAccountId(options: {
  text?: string;
  agent?: 'insurance-d' | 'agent-d';
  preferredAccountId?: string;
}): AccountIdExtractionResult {
  const { text, agent, preferredAccountId } = options;

  // 策略1：优先使用指定的 preferredAccountId
  if (preferredAccountId) {
    const account = getAccountById(preferredAccountId);
    if (account && account.enabled) {
      return {
        success: true,
        accountId: preferredAccountId,
        account,
        method: 'fallback',
        message: `使用指定的账号ID: ${preferredAccountId}`,
      };
    }
  }

  // 策略2：从文本中提取
  if (text) {
    const extractedAccountId = extractAccountIdFromText(text);
    if (extractedAccountId) {
      const account = getAccountById(extractedAccountId);
      if (account && account.enabled) {
        return {
          success: true,
          accountId: extractedAccountId,
          account,
          method: 'extracted',
          message: `从文本中提取到账号ID: ${extractedAccountId}`,
        };
      } else {
        return {
          success: false,
          accountId: extractedAccountId,
          method: 'extracted',
          message: `提取到账号ID: ${extractedAccountId}，但账号不存在或未启用`,
        };
      }
    }
  }

  // 策略3：根据Agent类型获取默认账号
  if (agent) {
    const account = getAgentAccount(agent);
    if (account && account.enabled) {
      return {
        success: true,
        accountId: account.id,
        account,
        method: 'agent_default',
        message: `使用Agent ${agent} 的默认账号: ${account.id}`,
      };
    }
  }

  // 策略4：返回第一个可用账号作为兜底
  const availableAccounts = listAvailableAccounts();
  if (availableAccounts.length > 0) {
    const firstAccount = getAccountById(availableAccounts[0].id);
    if (firstAccount) {
      return {
        success: true,
        accountId: firstAccount.id,
        account: firstAccount,
        method: 'fallback',
        message: `使用第一个可用账号: ${firstAccount.id}`,
      };
    }
  }

  // 所有策略都失败
  return {
    success: false,
    method: 'fallback',
    message: '未找到可用的账号',
  };
}

/**
 * 获取任务应该使用的账号ID
 * 
 * 这是一个便捷函数，整合了所有策略
 * 
 * @param taskContent 任务内容（如problem字段、commandContent等）
 * @param agentType Agent类型（insurance-d或agent-d）
 * @returns 账号ID提取结果
 */
export function getTaskAccountId(
  taskContent?: string,
  agentType?: 'insurance-d' | 'agent-d'
): AccountIdExtractionResult {
  return smartGetAccountId({
    text: taskContent,
    agent: agentType,
  });
}

/**
 * 列出所有可用的账号选项（用于UI展示）
 */
export function getAccountOptions(agent?: 'insurance-d' | 'agent-d') {
  const accounts = listAvailableAccounts(agent);
  return accounts.map(acc => ({
    value: acc.id,
    label: `${acc.name} (${acc.id})`,
    description: acc.description,
    agent: acc.agent,
  }));
}

/**
 * 验证账号ID是否有效
 */
export function isValidAccountId(accountId: string): boolean {
  const account = getAccountById(accountId);
  return !!account && account.enabled;
}
