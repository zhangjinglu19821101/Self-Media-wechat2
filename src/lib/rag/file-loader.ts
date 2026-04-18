// 文件加载器 - 支持从文件加载规则

import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

export interface RuleDocument {
  id: string;
  text: string;
  metadata: {
    source: string;
    title: string;
    rule_id?: string;
    platform?: string;
    division?: string;
    category?: string;
    [key: string]: any;
  };
}

export interface FileStats {
  path: string;
  size: number;
  md5: string;
  lineCount: number;
  lastModified: Date;
}

/**
 * 规则文件加载器
 *
 * 支持格式：
 * - TXT: 每行一条规则，格式 "WX-RULE-001 文本内容"
 * - MD: 同TXT
 * - JSON: 数组格式 [{rule_id: "WX-RULE-001", text: "..."}]
 */
export class RuleFileLoader {
  /**
   * 从文件加载规则
   */
  async loadFromFile(filePath: string): Promise<{
    documents: RuleDocument[];
    stats: FileStats;
  }> {
    const ext = path.extname(filePath).toLowerCase();
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await this.getFileStats(filePath);

    let documents: RuleDocument[];

    switch (ext) {
      case '.txt':
      case '.md':
        documents = this.parseTextFile(filePath, content);
        break;
      case '.json':
        documents = this.parseJsonFile(filePath, content);
        break;
      default:
        throw new Error(`不支持的文件格式: ${ext}`);
    }

    console.log(`📖 从 ${filePath} 加载了 ${documents.length} 条规则`);

    return { documents, stats };
  }

  /**
   * 批量加载文件
   */
  async loadFromFiles(
    filePaths: string[]
  ): Promise<{ documents: RuleDocument[]; fileStats: FileStats[] }> {
    const allDocuments: RuleDocument[] = [];
    const allStats: FileStats[] = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.loadFromFile(filePath);
        allDocuments.push(...result.documents);
        allStats.push(result.stats);
      } catch (error) {
        console.error(`加载文件失败: ${filePath}`, error);
      }
    }

    return { documents: allDocuments, fileStats: allStats };
  }

  /**
   * 解析TXT/MD文件
   * 格式：WX-RULE-001 用户使用腾讯服务应当阅读并遵守...
   */
  private parseTextFile(filePath: string, content: string): RuleDocument[] {
    const lines = content.split('\n').filter(line => line.trim());
    const documents: RuleDocument[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 匹配格式：WX-RULE-001 文本内容
      const match = line.match(/^([A-Z]+-RULE-\d+)\s+(.+)$/);

      if (match) {
        const [, ruleId, text] = match;
        documents.push({
          id: `rule_${ruleId}_${i}`,
          text: line,
          metadata: {
            source: filePath,
            title: ruleId,
            rule_id: ruleId,
            platform: this.extractPlatform(ruleId),
            division: this.extractDivision(ruleId),
            category: 'rule',
            line_number: i + 1,
          },
        });
      } else {
        console.log(`⚠️  跳过无效格式: ${line.substring(0, 40)}...`);
      }
    }

    return documents;
  }

  /**
   * 解析JSON文件
   */
  private parseJsonFile(filePath: string, content: string): RuleDocument[] {
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      throw new Error('JSON文件格式错误：必须是数组');
    }

    return data.map((item: any, index: number) => ({
      id: `rule_${item.rule_id || index}`,
      text: item.text || item.content || '',
      metadata: {
        source: filePath,
        title: item.title || item.rule_id || `Rule ${index + 1}`,
        rule_id: item.rule_id,
        platform: item.platform || this.extractPlatform(item.rule_id || ''),
        division: item.division || this.extractDivision(item.rule_id || ''),
        category: item.category || 'rule',
      },
    }));
  }

  /**
   * 获取文件统计信息
   */
  private async getFileStats(filePath: string): Promise<FileStats> {
    const content = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);

    return {
      path: filePath,
      size: stats.size,
      md5: crypto.createHash('md5').update(content).digest('hex'),
      lineCount: content.toString('utf-8').split('\n').length,
      lastModified: stats.mtime,
    };
  }

  /**
   * 从规则ID提取平台
   */
  private extractPlatform(ruleId: string): string | undefined {
    if (ruleId.includes('WX-')) return 'wechat';
    if (ruleId.includes('XHS-')) return 'xiaohongshu';
    if (ruleId.includes('ZH-')) return 'zhihu';
    if (ruleId.includes('TT-')) return 'toutiao';
    if (ruleId.includes('WB-')) return 'weibo';
    return undefined;
  }

  /**
   * 从规则ID提取事业部
   */
  private extractDivision(ruleId: string): string | undefined {
    if (ruleId.includes('INSURANCE-')) return 'insurance';
    if (ruleId.includes('AI-')) return 'ai';
    if (ruleId.includes('WX-')) return 'insurance'; // 微信规则通常属于保险事业部
    return undefined;
  }
}

/**
 * 计算文件MD5
 */
export function calculateMD5(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * 获取默认的文件加载器
 */
export function getRuleFileLoader(): RuleFileLoader {
  return new RuleFileLoader();
}
