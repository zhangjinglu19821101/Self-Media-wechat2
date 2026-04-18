/**
 * Mock LLM 服务
 * 用于测试 Agent B 决策逻辑
 */

import { AgentBDecision } from '@/lib/services/subtask-execution-engine';

// Mock 场景配置
interface MockScenario {
  name: string;
  decisions: AgentBDecision[];
  currentIndex: number;
}

// 预定义的Mock场景
const mockScenarios: Record<string, MockScenario> = {
  // 场景1：单次MCP成功
  'single_mcp_success': {
    name: '单次MCP执行成功',
    decisions: [
      {
        type: 'EXECUTE_MCP',
        reasonCode: 'MCP_CONTINUE',
        reasoning: '需要执行MCP完成任务',
        context: {
          executionSummary: '首次执行MCP',
          riskLevel: 'low',
          suggestedAction: '执行MCP'
        },
        data: {
          mcpParams: {
            solutionNum: 21,
            toolName: 'web_search',
            actionName: 'searchEngine',
            params: {
              accountId: 'test-account',
              query: '保险产品对比'
            }
          }
        }
      },
      {
        type: 'COMPLETE',
        reasonCode: 'TASK_DONE',
        reasoning: 'MCP执行成功，任务完成',
        context: {
          executionSummary: '任务已完成',
          riskLevel: 'low',
          suggestedAction: '标记完成'
        },
        data: {
          completionResult: { success: true, data: '搜索结果' }
        }
      }
    ],
    currentIndex: 0
  },

  // 场景2：MCP重试后成功
  'mcp_retry_success': {
    name: 'MCP重试后成功',
    decisions: [
      {
        type: 'EXECUTE_MCP',
        reasonCode: 'MCP_CONTINUE',
        reasoning: '首次尝试搜索引擎',
        context: {
          executionSummary: '首次执行',
          riskLevel: 'low',
          suggestedAction: '执行MCP'
        },
        data: {
          mcpParams: {
            solutionNum: 21,
            toolName: 'web_search',
            actionName: 'searchEngine',
            params: { accountId: 'test-account', query: '保险' }
          }
        }
      },
      {
        type: 'EXECUTE_MCP',
        reasonCode: 'MCP_RETRY',
        reasoning: '搜索引擎超时，尝试模拟浏览器',
        context: {
          executionSummary: '首次失败，切换方案',
          riskLevel: 'medium',
          suggestedAction: '切换MCP方案'
        },
        data: {
          mcpParams: {
            solutionNum: 22,
            toolName: 'web_search',
            actionName: 'simulateBrowser',
            params: { accountId: 'test-account', url: 'https://example.com' }
          }
        }
      },
      {
        type: 'COMPLETE',
        reasonCode: 'TASK_DONE',
        reasoning: '重试后成功，任务完成',
        context: {
          executionSummary: '重试成功',
          riskLevel: 'low',
          suggestedAction: '标记完成'
        },
        data: {
          completionResult: { success: true, data: '模拟浏览结果' }
        }
      }
    ],
    currentIndex: 0
  },

  // 场景3：MCP 3次都失败
  'mcp_three_failures': {
    name: 'MCP 3次尝试都失败',
    decisions: [
      {
        type: 'EXECUTE_MCP',
        reasonCode: 'MCP_CONTINUE',
        reasoning: '尝试搜索引擎',
        context: { executionSummary: '尝试1', riskLevel: 'low', suggestedAction: '执行' },
        data: {
          mcpParams: {
            solutionNum: 21,
            toolName: 'web_search',
            actionName: 'searchEngine',
            params: { accountId: 'test-account', query: '保险' }
          }
        }
      },
      {
        type: 'EXECUTE_MCP',
        reasonCode: 'MCP_RETRY',
        reasoning: '搜索引擎失败，尝试模拟浏览器',
        context: { executionSummary: '尝试2', riskLevel: 'medium', suggestedAction: '切换' },
        data: {
          mcpParams: {
            solutionNum: 22,
            toolName: 'web_search',
            actionName: 'simulateBrowser',
            params: { accountId: 'test-account', url: 'https://example.com' }
          }
        }
      },
      {
        type: 'EXECUTE_MCP',
        reasonCode: 'MCP_RETRY',
        reasoning: '模拟浏览器失败，尝试直接访问',
        context: { executionSummary: '尝试3', riskLevel: 'high', suggestedAction: '最后尝试' },
        data: {
          mcpParams: {
            solutionNum: 23,
            toolName: 'web_search',
            actionName: 'directFetch',
            params: { accountId: 'test-account', url: 'https://backup.com' }
          }
        }
      },
      {
        type: 'FAILED',
        reasonCode: 'MCP_ERROR_UNRECOVERABLE',
        reasoning: '所有MCP尝试都失败，无法继续',
        context: { executionSummary: '3次尝试均失败', riskLevel: 'high', suggestedAction: '标记失败' },
        data: {
          failedDetails: {
            errorType: 'ALL_ATTEMPTS_FAILED',
            errorMessage: '搜索引擎、模拟浏览器、直接访问都失败',
            recoverable: false,
            suggestedFix: '检查网络连接或更换数据源'
          }
        }
      }
    ],
    currentIndex: 0
  },

  // 场景4：需要用户介入
  'need_user_select': {
    name: '需要用户选择方案',
    decisions: [
      {
        type: 'NEED_USER',
        reasonCode: 'USER_SELECT',
        reasoning: '生成了多个版本，需要用户选择',
        context: { executionSummary: '等待用户选择', riskLevel: 'medium', suggestedAction: '等待用户' },
        data: {
          pendingKeyFields: [
            {
              fieldId: 'title',
              fieldName: '文章标题',
              fieldType: 'text',
              description: '请确认文章标题',
              currentValue: '保险产品对比分析',
              validationRules: { required: true }
            }
          ],
          availableSolutions: [
            {
              solutionId: 'v1',
              label: '正式版',
              description: '专业详细版本',
              pros: ['权威', '详细'],
              cons: ['较长']
            },
            {
              solutionId: 'v2',
              label: '通俗版',
              description: '易懂版本',
              pros: ['易懂', '简洁'],
              cons: ['专业度降低']
            }
          ],
          promptMessage: {
            title: '请选择发布版本',
            description: '请确认标题并选择发布版本',
            priority: 'medium'
          }
        }
      }
    ],
    currentIndex: 0
  },

  // 场景5：循环5轮后强制失败
  'max_iterations_exceeded': {
    name: '循环5轮后强制失败',
    decisions: Array(5).fill(null).map((_, i) => ({
      type: 'EXECUTE_MCP' as const,
      reasonCode: 'MCP_CONTINUE',
      reasoning: `第${i + 1}轮执行`,
      context: { executionSummary: `第${i + 1}轮`, riskLevel: 'medium', suggestedAction: '继续' },
      data: {
        mcpParams: {
          solutionNum: 21,
          toolName: 'web_search',
          actionName: 'searchEngine',
          params: { accountId: 'test-account', query: `查询${i + 1}` }
        }
      }
    })),
    currentIndex: 0
  }
};

// 当前激活的场景
let activeScenario: MockScenario | null = null;

/**
 * 设置Mock场景
 */
export function setMockScenario(scenarioName: string): boolean {
  if (mockScenarios[scenarioName]) {
    activeScenario = {
      ...mockScenarios[scenarioName],
      currentIndex: 0
    };
    console.log(`[MockLLM] 场景已设置: ${mockScenarios[scenarioName].name}`);
    return true;
  }
  console.error(`[MockLLM] 未知场景: ${scenarioName}`);
  return false;
}

/**
 * 获取下一个决策
 */
export function getNextMockDecision(): AgentBDecision | null {
  if (!activeScenario) {
    console.error('[MockLLM] 未设置场景');
    return null;
  }

  if (activeScenario.currentIndex >= activeScenario.decisions.length) {
    console.log('[MockLLM] 场景决策已用完，返回最后一个');
    return activeScenario.decisions[activeScenario.decisions.length - 1];
  }

  const decision = activeScenario.decisions[activeScenario.currentIndex];
  activeScenario.currentIndex++;
  
  console.log(`[MockLLM] 返回决策 ${activeScenario.currentIndex}/${activeScenario.decisions.length}:`, decision.type);
  return decision;
}

/**
 * 获取当前场景信息
 */
export function getMockScenarioInfo() {
  if (!activeScenario) return null;
  return {
    name: activeScenario.name,
    totalDecisions: activeScenario.decisions.length,
    currentIndex: activeScenario.currentIndex,
    remaining: activeScenario.decisions.length - activeScenario.currentIndex
  };
}

/**
 * 重置Mock状态
 */
export function resetMockScenario() {
  if (activeScenario) {
    activeScenario.currentIndex = 0;
    console.log('[MockLLM] 场景已重置');
  }
}

/**
 * 获取所有可用场景
 */
export function getAvailableScenarios() {
  return Object.entries(mockScenarios).map(([key, scenario]) => ({
    key,
    name: scenario.name,
    description: `${scenario.decisions.length}个决策节点`
  }));
}
