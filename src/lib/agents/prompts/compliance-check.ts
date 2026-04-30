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
请严格按照以下合规规则对文章进行逐项校验：

---

## 一、绝对禁止创作内容（违反任意一条即判定为不合规）

### 1. 虚假信息类
| 编号 | 禁止项 | 检查要点 |
|------|--------|---------|
| 1.1 | 编造报刊、媒体名称 | 是否存在未标注来源的媒体背书？ |
| 1.2 | 编造真实名人、企业家 | 是否使用真人姓名作为案例或背书？ |
| 1.3 | 编造具体资产、保额、保费 | 是否杜撰具体的金额数据？ |
| 1.4 | 真人案例杜撰背书 | 是否编造用户案例作为证明？ |

### 2. 税务相关类
| 编号 | 禁止项 | 检查要点 |
|------|--------|---------|
| 2.1 | 提及大陆遗产税 | 是否提及、宣传、规避大陆遗产税？ |

### 3. 功能夸大类
| 编号 | 禁止项 | 检查要点 |
|------|--------|---------|
| 3.1 | 夸大保险债务隔离功能 | 是否夸大保险的债务隔离效果？ |
| 3.2 | 夸大婚姻资产隔离功能 | 是否夸大保险的婚姻资产隔离效果？ |
| 3.3 | 绝对化传承表述 | 是否使用"无需公证"、"零纠纷"、"直接拿钱"等表述？ |

### 4. 境外产品类
| 编号 | 禁止项 | 检查要点 |
|------|--------|---------|
| 4.1 | 提及香港保险及境外保险 | 是否提及、点评、推介、对比香港保险或境外保险？ |

### 5. 安全性混淆类
| 编号 | 禁止项 | 检查要点 |
|------|--------|---------|
| 5.1 | 将保险与银行存款等同 | 是否将保险安全性与银行存款等同？ |

### 6. 极限词类
| 编号 | 禁止项 | 检查要点 |
|------|--------|---------|
| 6.1 | 极限词和营销诱导话术 | 是否使用：最安全、零风险、保本稳赚、顶级收益、错过再无、绝版、闭眼入等？ |

### 7. 收益对比类
| 编号 | 禁止项 | 检查要点 |
|------|--------|---------|
| 7.1 | 暗示保险收益一定高于银行 | 是否做绝对化收益优劣定论？ |
| 7.2 | 混淆保险与银行产品 | 是否使用"保险存款"、"存进保险"等混淆表述？ |

### 8. 数据编造类
| 编号 | 禁止项 | 检查要点 |
|------|--------|---------|
| 8.1 | 编造无权威来源的数据 | 是否编造收益倍数、利息差额、通胀数据、测算数值？ |

### 9. 规则隐瞒类
| 编号 | 禁止项 | 检查要点 |
|------|--------|---------|
| 9.1 | 隐瞒保单贷款规则 | 是否宣传"保单贷款不影响收益"、"随时无损支取"而未说明贷款付息、减保限制？ |

### 10. 历史产品类
| 编号 | 禁止项 | 检查要点 |
|------|--------|---------|
| 10.1 | 随意渲染历史高利率产品 | 若提及8.8%、老3.5%等产品，是否标注：已停售、仅历史参考、不构成当前投保收益依据？ |

### 11. 贬低竞品类
| 编号 | 禁止项 | 检查要点 |
|------|--------|---------|
| 11.1 | 贬低银行存款、理财、同业产品 | 是否有"踩一捧一"或抹黑其他金融产品的表述？ |

### 12. 概念偷换类
| 编号 | 禁止项 | 检查要点 |
|------|--------|---------|
| 12.1 | 偷换概念 | 是否把保额增长率、现金价值增速直接等同于年化收益率？ |

### 13. 导流私域类
| 编号 | 禁止项 | 检查要点 |
|------|--------|---------|
| 13.1 | 导流私域 | 是否引导私下投保、硬性推荐具体保险公司、具体单品？ |

---

## 二、强制必须遵守写作规范（未遵守需在 issues 中指出）

| 编号 | 规范项 | 检查要点 |
|------|--------|---------|
| 2.1 | 开篇明确产品属性 | 开篇是否明确：储蓄型保险属于人寿保险产品，不等同银行存款、理财产品？ |
| 2.2 | 收益表述规范 | 是否严格区分保证收益与非保证收益，明示非保证收益具有不确定性？ |
| 2.3 | 退保风险提示 | 是否提示：储蓄险前期退保会产生本金损失，仅适合5年以上长期闲置资金？ |
| 2.4 | 历史产品风险提示 | 历史停售产品案例是否标配合规风险提示？ |
| 2.5 | 银行保险对比规范 | 银行与保险是否仅客观对比流动性、资金周期、传承规则？ |
| 2.6 | 中立科普视角 | 是否保持中立科普视角，不构成投保、投资、税务、法律专业建议？ |
| 2.7 | 结尾免责声明 | 文章结尾是否标配完整标准合规免责声明？ |

---

## 三、创作要求

| 编号 | 要求项 | 检查要点 |
|------|--------|---------|
| 3.1 | 创作原则 | 是否按用户给定主题、结构、口吻创作？是否产出违规表述？ |

---

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
      "category": "禁止项-编号/强制规范-编号",
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

## 违规判定标准
- **严重违规（critical）**：触犯"绝对禁止创作内容"任一条
- **一般违规（warning）**：未遵守"强制写作规范"任一条
- **轻微问题（info）**：表述不够严谨或有歧义

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
