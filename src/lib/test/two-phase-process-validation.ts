/**
 * 两阶段流程专项测试
 * 测试"先合规检查，后上传公众号"的流程正确性
 */

import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export interface TestCaseResult {
  testCaseId: string;
  success: boolean;
  errors: string[];
  warnings: string[];
  mcpAttemptsCount: number;
  hasComplianceCheck: boolean;
  hasWechatUpload: boolean;
  complianceCheckFirst: boolean;
}

export interface ValidationReport {
  testCases: TestCaseResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

/**
 * 两阶段流程验证器
 */
export class TwoPhaseProcessValidator {
  /**
   * 判断是否为内容发布测试用例
   */
  private isContentPublishingTestCase(testCaseId: string): boolean {
    const contentPublishingTestCases = [
      'TC-01A', 'TC-01B', 'TC-01C',
      'TC-23', 'TC-24', 'TC-25'
    ];
    return contentPublishingTestCases.includes(testCaseId);
  }

  /**
   * 验证单个测试用例的两阶段流程
   */
  async validateTestCase(commandResultId: string, testCaseId: string): Promise<TestCaseResult> {
    const result: TestCaseResult = {
      testCaseId,
      success: true,
      errors: [],
      warnings: [],
      mcpAttemptsCount: 0,
      hasComplianceCheck: false,
      hasWechatUpload: false,
      complianceCheckFirst: false
    };

    try {
      // 1. 查询 step history 记录
      const allRecords = await db
        .select()
        .from(agentSubTasksStepHistory)
        .orderBy(agentSubTasksStepHistory.interactTime);
      
      const stepRecords = allRecords.filter(r => r.commandResultId === commandResultId);

      if (stepRecords.length === 0) {
        result.success = false;
        result.errors.push(`未找到 commandResultId = ${commandResultId} 的记录`);
        return result;
      }

      // 2. 找到最终的 response 记录
      const finalResponse = stepRecords.find(
        (record: any) => record.interactType === 'response' && 
                          record.interactContent?.response?.decision?.type === 'COMPLETE'
      );

      if (!finalResponse) {
        result.success = false;
        result.errors.push('未找到最终的 COMPLETE 决策记录');
        return result;
      }

      const interactContent = finalResponse.interactContent;
      const mcpAttempts = interactContent?.response?.mcp_attempts || [];

      result.mcpAttemptsCount = mcpAttempts.length;

      // 3. 如果是内容发布测试用例，进行两阶段流程验证
      if (this.isContentPublishingTestCase(testCaseId)) {
        this.validateContentPublishingFlow(mcpAttempts, result);
      } else {
        // 非内容发布场景，只做基本检查
        result.warnings.push('非内容发布场景，跳过两阶段流程验证');
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`验证异常: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * 验证内容发布场景的两阶段流程
   */
  private validateContentPublishingFlow(mcpAttempts: any[], result: TestCaseResult): void {
    // 检查1：是否有合规检查记录
    result.hasComplianceCheck = mcpAttempts.some(
      (attempt: any) => attempt.decision?.toolName === 'compliance_audit' &&
                        attempt.decision?.actionName === 'checkContent'
    );

    if (!result.hasComplianceCheck) {
      result.errors.push('缺少合规检查 MCP 记录（compliance_audit/checkContent）');
      result.success = false;
    }

    // 检查2：是否有公众号上传记录
    result.hasWechatUpload = mcpAttempts.some(
      (attempt: any) => attempt.decision?.toolName === 'wechat_mp' &&
                        attempt.decision?.actionName === 'addDraft'
    );

    if (!result.hasWechatUpload) {
      // 对于某些测试用例（如 TC-01C），可能只有合规检查
      result.warnings.push('缺少公众号上传 MCP 记录（wechat_mp/addDraft）');
    }

    // 检查3：合规检查是否在公众号上传之前
    if (result.hasComplianceCheck && result.hasWechatUpload) {
      const complianceIndex = mcpAttempts.findIndex(
        (attempt: any) => attempt.decision?.toolName === 'compliance_audit'
      );
      const uploadIndex = mcpAttempts.findIndex(
        (attempt: any) => attempt.decision?.toolName === 'wechat_mp'
      );

      result.complianceCheckFirst = complianceIndex < uploadIndex;

      if (!result.complianceCheckFirst) {
        result.errors.push('合规检查应该在公众号上传之前执行');
        result.success = false;
      }
    }

    // 检查4：合规检查结果是否通过
    if (result.hasComplianceCheck) {
      const complianceAttempt = mcpAttempts.find(
        (attempt: any) => attempt.decision?.toolName === 'compliance_audit'
      );

      if (complianceAttempt?.result?.status !== 'success') {
        result.errors.push('合规检查执行失败');
        result.success = false;
      }

      const resultData = complianceAttempt?.result?.data;
      if (resultData?.is_compliant !== true && resultData?.check_passed !== true) {
        result.warnings.push('合规检查结果未明确显示通过');
      }
    }
  }

  /**
   * 执行完整的两阶段流程验证
   */
  async validateAll(testCases: Array<{ testCaseId: string; commandResultId: string }>): Promise<ValidationReport> {
    const report: ValidationReport = {
      testCases: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };

    for (const { testCaseId, commandResultId } of testCases) {
      const result = await this.validateTestCase(commandResultId, testCaseId);
      report.testCases.push(result);
      report.summary.total++;

      if (result.success) {
        report.summary.passed++;
      } else {
        report.summary.failed++;
      }

      report.summary.warnings += result.warnings.length;
    }

    return report;
  }

  /**
   * 生成验证报告（Markdown 格式）
   */
  generateReport(report: ValidationReport): string {
    let markdown = '# 两阶段流程验证报告\n\n';

    markdown += '## 📊 执行概览\n\n';
    markdown += `| 指标 | 数值 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 总测试用例数 | ${report.summary.total} |\n`;
    markdown += `| 通过 | ${report.summary.passed} |\n`;
    markdown += `| 失败 | ${report.summary.failed} |\n`;
    markdown += `| 警告 | ${report.summary.warnings} |\n\n`;

    markdown += '## 📋 详细结果\n\n';

    for (const result of report.testCases) {
      const statusIcon = result.success ? '✅' : '❌';
      markdown += `### ${statusIcon} ${result.testCaseId}\n\n`;
      markdown += `- MCP 尝试次数: ${result.mcpAttemptsCount}\n`;
      markdown += `- 有合规检查: ${result.hasComplianceCheck ? '✅' : '❌'}\n`;
      markdown += `- 有公众号上传: ${result.hasWechatUpload ? '✅' : '❌'}\n`;
      markdown += `- 合规检查在前: ${result.complianceCheckFirst ? '✅' : '❌'}\n`;

      if (result.errors.length > 0) {
        markdown += '\n**错误:**\n';
        for (const error of result.errors) {
          markdown += `- ❌ ${error}\n`;
        }
      }

      if (result.warnings.length > 0) {
        markdown += '\n**警告:**\n';
        for (const warning of result.warnings) {
          markdown += `- ⚠️ ${warning}\n`;
        }
      }

      markdown += '\n';
    }

    markdown += '---\n\n';
    markdown += `报告生成时间: ${new Date().toISOString()}\n`;

    return markdown;
  }
}
