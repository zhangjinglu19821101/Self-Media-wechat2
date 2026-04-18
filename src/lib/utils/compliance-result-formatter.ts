/**
 * 合规校验结果格式化器
 * 将JSON结构转换为简洁的自然语言文本，重点突出整改问题点
 */

import { ComplianceCheckResult, ComplianceIssue } from '../agents/prompts/compliance-check';

export class ComplianceResultFormatter {
  /**
   * 格式化合规校验结果为简洁的自然语言文本
   */
  static format(result: ComplianceCheckResult): string {
    const sections = [
      this.buildIssuesSection(result),
      this.buildRecommendationsSection(result)
    ];

    return sections.filter(Boolean).join('\n\n');
  }

  /**
   * 构建整改问题点部分
   */
  private static buildIssuesSection(result: ComplianceCheckResult): string {
    if (result.issues.length === 0) {
      return '## ✅ 合规校验通过\n\n未发现任何合规问题！';
    }

    const sections: string[] = [];
    sections.push('## 🔧 整改问题点');

    // 按严重程度分组
    const criticalIssues = result.issues.filter(i => i.type === 'critical');
    const warningIssues = result.issues.filter(i => i.type === 'warning');
    const infoIssues = result.issues.filter(i => i.type === 'info');

    // 严重问题
    if (criticalIssues.length > 0) {
      sections.push(`\n### 🔴 严重问题 (${criticalIssues.length}个)`);
      criticalIssues.forEach((issue, index) => {
        sections.push(this.formatIssue(issue, index + 1));
      });
    }

    // 警告问题
    if (warningIssues.length > 0) {
      sections.push(`\n### 🟡 警告问题 (${warningIssues.length}个)`);
      warningIssues.forEach((issue, index) => {
        sections.push(this.formatIssue(issue, index + 1));
      });
    }

    // 提示问题
    if (infoIssues.length > 0) {
      sections.push(`\n### 🟢 提示问题 (${infoIssues.length}个)`);
      infoIssues.forEach((issue, index) => {
        sections.push(this.formatIssue(issue, index + 1));
      });
    }

    return sections.join('\n');
  }

  /**
   * 格式化单个问题
   */
  private static formatIssue(issue: ComplianceIssue, index: number): string {
    const lines: string[] = [];
    
    let title = `**${index}. ${issue.category}`;
    if (issue.location) {
      title += ` - ${issue.location}`;
    }
    title += '**';
    lines.push(title);
    
    lines.push(`- 问题: ${issue.description}`);
    lines.push(`- 建议: ${issue.suggestion}`);
    
    return lines.join('\n');
  }

  /**
   * 构建改进建议部分
   */
  private static buildRecommendationsSection(result: ComplianceCheckResult): string {
    if (result.recommendations.length === 0) return '';

    const sections: string[] = [];
    sections.push('## 💡 改进建议');
    
    result.recommendations.forEach((rec, index) => {
      sections.push(`${index + 1}. ${rec}`);
    });

    return sections.join('\n');
  }
}
