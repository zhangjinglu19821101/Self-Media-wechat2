/**
 * 文章元数据接口（agent_sub_tasks.article_metadata）
 * 
 * 用于存储文章相关的元数据，包括：
 * - 文章基础信息（全任务共享）
 * - 当前步骤信息（仅存当前步骤的核心信息）
 * - 微信公众号核心数据（每步都更新）
 * 
 * 🔥 核心原则：
 * 1. 每步骤完成都要更新该步骤的 article_metadata 的值
 * 2. article_basic 是全任务共享的，每步都更新（article_id 仅最后一步后有值）
 * 3. current_step 仅存当前步骤的核心信息（无任何冗余）
 * 4. wechat_mp_core_data 每步都更新（标题候选、话题、痛点、热点等）
 * 5. article_content_status: "已生成" | "未生成"（不保存实际内容）
 * 6. step_output: 最后一步时为固定提示语"文章已经生成，请通过 article_content 表查看。"
 * 7. exception_info: 由 Agent B 依据执行 Agent 的实际情况进行填充
 * 8. task_type: 任务类型标识，用于判断是否为文章生成任务
 * 9. total_steps: 总步骤数，用于判断是否为最后一步
 */
export interface ArticleMetadata {
  /**
   * 文章基础信息（全任务共享，每步都带）
   */
  article_basic: {
    /**
     * 任务类型（用于判断是否为文章生成任务）
     */
    task_type: 'article_generation' | 'other';
    
    /**
     * 总步骤数（用于判断是否为最后一步）
     */
    total_steps: number;
    
    /**
     * 文章 ID（仅文章生成任务且为最后一步时有值，格式：ART + 日期(8位) + 序号(3位)）
     */
    article_id: string;
    
    /**
     * 文章标题
     */
    article_title: string;
    
    /**
     * 创建者 Agent
     */
    creator_agent: string;
    
    /**
     * 文章内容状态（"已生成" | "未生成"）
     */
    article_content_status: '已生成' | '未生成';
  };

  /**
   * 当前步骤信息（仅存当前步骤的核心信息）
   */
  current_step: {
    /**
     * 步骤编号
     */
    step_no: number;
    
    /**
     * 步骤名称
     */
    step_name: string;
    
    /**
     * 步骤状态
     */
    step_status: 'pending' | 'in_progress' | 'success' | 'failed' | 'timeout';
    
    /**
     * 步骤输出（步骤8时为固定提示语）
     */
    step_output: string;
    
    /**
     * 确认状态
     */
    confirm_status: '未确认' | '已确认';
    
    /**
     * 异常信息（由 Agent B 依据执行 Agent 的实际情况进行填充）
     */
    exception_info: string;
  };

  /**
   * 微信公众号核心数据（每步都更新）
   */
  wechat_mp_core_data: {
    /**
     * 标题候选集
     */
    title_idea_set: string[];
    
    /**
     * 话题
     */
    topics: string[];
    
    /**
     * 用户痛点
     */
    user_pain_point: string[];
    
    /**
     * 热点
     */
    hot_spot: string[];
  };
}

/**
 * 步骤配置
 */
export const STEP_CONFIGS = [
  { stepNo: 1, stepName: '选题与规划' },
  { stepNo: 2, stepName: '资料收集与热点结合' },
  { stepNo: 3, stepName: '写作大纲' },
  { stepNo: 4, stepName: '标题及封面' },
  { stepNo: 5, stepName: '正文写作' },
  { stepNo: 6, stepName: '引言、互动引导' },
  { stepNo: 7, stepName: '摘要、关键词设置' },
  { stepNo: 8, stepName: '输出完整文章' },
];

/**
 * 步骤8的固定提示语
 */
export const STEP_8_OUTPUT = '文章已经生成，请通过 article_content 表查看。';

/**
 * 生成文章 ID
 * 
 * @returns 文章 ID，格式：ART + 日期(8位) + 序号(3位)
 */
export function generateArticleId(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ART${dateStr}${randomNum}`;
}

/**
 * 创建初始的 ArticleMetadata（第一个步骤时调用）
 * 
 * @param params - 初始化参数
 * @returns 初始的 ArticleMetadata 对象
 */
export function createInitialArticleMetadata(params: {
  articleTitle: string;
  creatorAgent: string;
  taskType?: 'article_generation' | 'other';
  totalSteps?: number;
}): ArticleMetadata {
  return {
    article_basic: {
      task_type: params.taskType || 'article_generation',
      total_steps: params.totalSteps || 8,
      article_id: '',  // 初始为空
      article_title: params.articleTitle,
      creator_agent: params.creatorAgent,
      article_content_status: '未生成',
    },
    current_step: {
      step_no: 1,
      step_name: STEP_CONFIGS[0].stepName,
      step_status: 'pending',
      step_output: '',
      confirm_status: '未确认',
      exception_info: '',
    },
    wechat_mp_core_data: {
      title_idea_set: [],
      topics: [],
      user_pain_point: [],
      hot_spot: [],
    },
  };
}

/**
 * 更新当前步骤的 ArticleMetadata
 * 
 * @param metadata - 原有的 ArticleMetadata 对象
 * @param params - 更新参数
 * @returns 更新后的 ArticleMetadata 对象
 */
export function updateArticleMetadataStep(
  metadata: ArticleMetadata,
  params: {
    stepNo: number;
    stepStatus: 'pending' | 'in_progress' | 'success' | 'failed' | 'timeout';
    stepOutput: string;
    confirmStatus: '未确认' | '已确认';
    exceptionInfo?: string;
    wechatData?: {
      titleIdeaSet?: string[];
      topics?: string[];
      userPainPoint?: string[];
      hotSpot?: string[];
    };
  }
): ArticleMetadata {
  const stepConfig = STEP_CONFIGS.find(s => s.stepNo === params.stepNo);
  
  // 🔥 判断是否为文章生成任务且为最后一步
  const isArticleGeneration = metadata.article_basic.task_type === 'article_generation';
  const isLastStep = params.stepNo === metadata.article_basic.total_steps;
  const shouldGenerateArticle = isArticleGeneration && isLastStep && params.stepStatus === 'success';
  
  // 步骤输出处理
  let stepOutput = params.stepOutput;
  if (shouldGenerateArticle) {
    stepOutput = STEP_8_OUTPUT;
  }
  
  // 更新 article_basic
  const updatedArticleBasic = { ...metadata.article_basic };
  if (shouldGenerateArticle) {
    updatedArticleBasic.article_id = generateArticleId();
    updatedArticleBasic.article_content_status = '已生成';
  }

  return {
    ...metadata,
    article_basic: updatedArticleBasic,
    current_step: {
      step_no: params.stepNo,
      step_name: stepConfig?.stepName || '',
      step_status: params.stepStatus,
      step_output: stepOutput,
      confirm_status: params.confirmStatus,
      exception_info: params.exceptionInfo || '',
    },
    wechat_mp_core_data: {
      title_idea_set: params.wechatData?.titleIdeaSet || metadata.wechat_mp_core_data.title_idea_set,
      topics: params.wechatData?.topics || metadata.wechat_mp_core_data.topics,
      user_pain_point: params.wechatData?.userPainPoint || metadata.wechat_mp_core_data.user_pain_point,
      hot_spot: params.wechatData?.hotSpot || metadata.wechat_mp_core_data.hot_spot,
    },
  };
}

/**
 * 设置异常信息（Agent B 调用）
 * 
 * @param metadata - 原有的 ArticleMetadata 对象
 * @param exceptionInfo - 异常信息
 * @returns 更新后的 ArticleMetadata 对象
 */
export function setArticleMetadataException(
  metadata: ArticleMetadata,
  exceptionInfo: string
): ArticleMetadata {
  return {
    ...metadata,
    current_step: {
      ...metadata.current_step,
      exception_info: exceptionInfo,
    },
  };
}
