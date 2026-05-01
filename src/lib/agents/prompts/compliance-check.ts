/**
 * Agent B 合规校验提示词模板
 * 用于校验写作类 Agent（insurance-d / insurance-xiaohongshu / insurance-zhihu / insurance-toutiao）完成的保险文章是否符合合规要求
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
  category: string; // 对应禁止项编号或强制规范编号
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
请严格按照以下合规规则对文章进行逐项校验，每条规则均附有「判定细则」，请严格按照细则判定：

---

## 一、绝对禁止创作内容（违反任意一条即判定为不合规）

1. 严禁编造报刊、媒体名称、真实名人、企业家、具体资产、保额、保费真人案例杜撰背书；
判定细则：任何提及具体媒体（如《南京财经报》）、真实名人 / 企业家（如宗庆后、霍英东）、具体保费 / 保额 / 理赔金额（如 2500 万保费、8000 万赔付），均属于违规；虚构真人姓名（如周明）+ 具体资产案例，也属于违规。

2. 严禁提及、宣传、规避大陆遗产税相关一切表述；
判定细则：任何出现 "遗产税、不用交遗产税、避遗产税、少缴遗产税" 等相关文字，无论语境如何，均属于违规。

3. 严禁夸大保险债务隔离、婚姻资产隔离，严禁使用无需公证、零纠纷、直接拿钱等绝对化传承表述；
判定细则：① 不得说 "离婚不分、欠债不被执行、绝对隔离" 等绝对化表述；② 不得说 "不需要公证、零纠纷、直接拿钱"，不得弱化传承所需手续；③ 不得暗示保险能 100% 实现债务 / 婚姻隔离。

4. 严禁提及、点评、推介、对比香港保险及所有境外保险产品；
判定细则：任何出现 "香港保险、境外保险、海外保险" 等字眼，无论正面还是负面点评，均属于违规。

5. 严禁将保险安全性与银行存款等同、宣称安全级别一致；
判定细则：不得说 "保险和银行一样安全、安全级别相同"，仅可客观说明两者均为正规金融工具，安全保障机制不同。

6. 严禁使用最安全、零风险、保本稳赚、顶级收益、错过再无、绝版、闭眼入等极限词和营销诱导话术；
判定细则：任何极限词、诱导性营销话术，无论用于描述保险还是其他金融产品，均严禁使用。

7. 严禁暗示保险收益一定高于银行，不做绝对化收益优劣定论；
判定细则：不得说 "保险收益比银行高、存保险比存银行划算"，仅可客观对比两者收益规则差异。

8. 严禁把保险说成银行存款、大额存单、理财，禁用保险存款、存进保险等混淆表述；
判定细则：不得使用 "保险存款、存保险、保险理财" 等混淆产品属性的表述，必须明确保险与银行存款、理财的区别。

9. 严禁编造无权威来源的收益倍数、利息差额、通胀数据、测算数值；
判定细则：任何无权威来源的收益测算、数据对比，均属于违规，不得杜撰。

10. 严禁宣传保单贷款不影响收益、随时无损支取，不得隐瞒贷款付息、减保比例限制规则；
判定细则：不得说 "保单贷款不影响收益、随时可取"，必须提及贷款需支付利息、减保可能有比例限制。

11. 严禁随意渲染 8.8%、老 3.5% 等历史高利率产品，若必须提及，务必标注：已停售、仅历史参考、不构成当前投保收益依据；
判定细则：未标配合规提示的历史高利率产品宣传，均属于违规。

12. 严禁刻意贬低、抹黑银行存款、理财、同业保险产品，禁止踩一捧一；
判定细则：不得说 "银行存款不划算、理财风险高" 等贬低性表述，仅可客观讲差异。

13. 严禁把保额增长率、现金价值增速直接等同于年化收益率偷换概念；
判定细则：不得将 "保额增长、现金价值增长" 说成 "年化收益、理财收益"，必须明确区分。

14. 严禁导流私域、引导私下投保、硬性推荐具体保险公司、具体单品；
判定细则：不得出现 "私信我、加微信、推荐 XX 保险公司、XX 产品" 等导流 / 推荐表述。

---

## 二、强制必须遵守写作规范（未遵守需在 issues 中指出）

1. 开篇必须明确：储蓄型保险属于人寿保险产品，不等同银行存款、理财产品；
检查要点：开篇是否包含产品属性说明？

2. 所有收益表述，必须严格区分保证收益与非保证收益，明示非保证收益具有不确定性；
检查要点：是否区分保证收益与非保证收益？是否明示不确定性？

3. 全文必须隐含或显性提示：储蓄险前期退保会产生本金损失，仅适合 5 年以上长期闲置资金；
检查要点：是否提示退保风险？是否说明适合长期资金？

4. 历史停售产品案例必须标配合规风险提示；
检查要点：是否标注已停售、仅历史参考、不构成当前投保收益依据？

5. 银行与保险仅客观对比流动性、资金周期、传承规则，不对比安全等级、不做收益绝对优劣判断；
检查要点：对比是否客观？是否有绝对优劣判断？

6. 全程保持中立科普视角，不构成投保、投资、税务、法律专业建议；
检查要点：是否保持中立？是否构成专业建议？

7. 文章结尾必须标配完整标准合规免责声明，不得简化删减；
检查要点：是否包含完整免责声明？是否与标准模板一致？
标准免责声明模板：【免责声明】本文内容仅供参考，不构成任何投保、投资、税务或法律建议。保险产品的具体条款、责任免除、收益情况等以正式保险合同及保险公司官方说明为准。投保前请仔细阅读保险条款，根据自身需求和风险承受能力谨慎选择。历史收益不代表未来表现，储蓄型保险前期退保可能产生本金损失，仅适合长期闲置资金配置。文中涉及的保证收益与非保证收益说明，非保证收益部分具有不确定性，不构成收益承诺。

---

## 三、创作要求

按用户给定主题、结构、口吻创作，只在后台自动合规收口，不主动增加无关内容，不产出任何违规表述，全程自动合规。

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
      "suggestion": "修改建议（优先使用合规替代话术）"
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
- **严重违规（critical）**：触犯"绝对禁止创作内容"任一条（按判定细则判定）
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
    taskType: 'compliance_check',
    originalTaskId: params.originalTaskId,
    articleTitle: params.articleTitle,
    articleContent: params.articleContent,
    requiresManualReview: false,
  };
}
