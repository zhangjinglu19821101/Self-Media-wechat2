/**
 * Agent B 合规校验提示词模板
 * 用于校验写作类 Agent（insurance-d / insurance-xiaohongshu）完成的保险文章是否符合合规要求
 */

export interface ComplianceCheckParams {
  articleTitle: string;
  articleContent: string;
  taskId: string;
  originalCommand: string;
  executorType?: string; // 写作 Agent 类型，用于区分内容格式
}

export interface ComplianceCheckResult {
  isCompliant: boolean;
  score: number; // 0-100 合规评分
  issues: ComplianceIssue[];
  summary: string;
  recommendations: string[];
}

export interface ComplianceIssue {
  type: 'critical' | 'warning' | 'info';
  category: string; // '内容合规' | '风险提示' | '术语规范' | '数据准确' | '监管要求'
  location?: string; // 问题所在位置（如：段落3、标题等）
  description: string;
  suggestion: string;
}

/**
 * 生成 Agent B 合规校验提示词
 */
export function generateComplianceCheckPrompt(params: ComplianceCheckParams): string {
  const { articleTitle, articleContent, taskId, originalCommand, executorType } = params;
  const executorLabelMap: Record<string, string> = {
    'insurance-d': 'insurance-d（公众号文章）',
    'insurance-xiaohongshu': 'insurance-xiaohongshu（小红书图文）',
    'insurance-zhihu': 'insurance-zhihu（知乎回答/文章）',
    'insurance-toutiao': 'insurance-toutiao（头条/信息流文章）',
  };
  const executorLabel = executorLabelMap[executorType || ''] || executorType || 'insurance-d（公众号文章）';

  return `你现在是架构师B（技术支撑），负责对 ${executorLabel} 完成的保险内容进行合规性校验。

## 背景信息
- 任务ID: ${taskId}
- 原始指令: ${originalCommand}
- 文章标题: ${articleTitle}

## 文章内容
${articleContent}

## 你的任务
请从以下几个维度对文章进行合规性校验：

### 1. 内容合规性
- 是否包含误导性或夸大的表述
- 是否有虚假宣传或不当承诺
- 是否违反保险行业相关规定

### 2. 风险提示
- 是否充分提示了保险产品的风险
- 是否清晰说明了责任免除条款
- 是否平衡了收益与风险的描述

### 3. 术语规范
- 保险术语是否准确、规范
- 是否使用了未经解释的专业术语
- 是否符合保险行业的专业标准

### 4. 数据准确性
- 引用的数据、案例是否有出处
- 百分比、概率等数据是否合理
- 是否有编造或夸大的数据

### 5. 监管要求
- 是否符合银保监会相关规定
- 是否涉及需要审批的内容
- 是否有违反广告法的内容

## 输出格式
请严格按照以下 JSON 格式输出校验结果：

\`\`\`json
{
  "isCompliant": true/false,
  "score": 0-100,
  "summary": "总体合规性评价（1-2句话）",
  "issues": [
    {
      "type": "critical/warning/info",
      "category": "内容合规/风险提示/术语规范/数据准确/监管要求",
      "location": "问题所在位置（可选）",
      "description": "问题描述",
      "suggestion": "修改建议"
    }
  ],
  "recommendations": [
    "改进建议1",
    "改进建议2"
  ]
}
\`\`\`

## 评分标准
- 90-100分：优秀，完全符合合规要求
- 75-89分：良好，基本符合，有少量改进空间
- 60-74分：一般，存在一些合规问题，需要修改
- 低于60分：不合格，存在严重合规风险

请开始校验...`;
}

/**
 * 解析合规校验结果
 */
export function parseComplianceCheckResult(llmResponse: string): ComplianceCheckResult {
  try {
    // 尝试提取 JSON 部分
    const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : llmResponse;

    const result = JSON.parse(jsonStr) as ComplianceCheckResult;

    // 验证必要字段
    if (!result.isCompliant || typeof result.score !== 'number' || !result.issues) {
      throw new Error('合规校验结果格式不正确');
    }

    return result;
  } catch (error) {
    console.error('解析合规校验结果失败:', error);
    throw new Error('LLM 返回的合规校验结果格式不正确');
  }
}

/**
 * 生成合规校验任务的元数据
 */
export function generateComplianceTaskMetadata(params: {
  originalTaskId: string;
  articleTitle: string;
  articleContent: string;
}) {
  return {
    taskType: 'compliance_check', // 🔥 合规校验任务类型
    originalTaskId: params.originalTaskId,
    articleTitle: params.articleTitle,
    articleContent: params.articleContent,
    requiresManualReview: false, // 是否需要人工复核
  };
}
