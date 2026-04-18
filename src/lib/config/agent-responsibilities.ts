/**
 * Agent 职责范围配置
 * 
 * 这是系统的权威数据源
 * 所有 Agent 的职责边界都定义在这里
 */

/**
 * 执行 Agent 职责定义
 */
export const EXECUTOR_RESPONSIBILITIES = {
  'insurance-d': {
    name: '保险内容 Agent',
    canDo: [
      '文章创作',
      '内容优化',
      '风格模仿',
      '通用合规自查'
    ],
    cannotDo: [
      '专业合规审核',
      '技术开发',
      '数据计算',
      '法律判断'
    ]
  },
  'insurance-c': {
    name: '保险运营 Agent',
    canDo: [
      '数据收集整理',
      '素材准备',
      '格式调整'
    ],
    cannotDo: [
      '内容创作',
      '合规审核'
    ]
  }
} as const;

/**
 * 路由关键词映射
 * 当执行 Agent 说"做不了"时，根据 reason 中的关键词路由
 */
export const ROUTING_KEYWORDS = {
  'agent-t': [
    '合规',
    '审核',
    '判断是否符合',
    '专业工具',
    '技术',
    '代码',
    'API',
    '数据查询'
  ],
  'agent-a': [
    '决定',
    '确认',
    '战略',
    '异常',
    '无法判断'
  ]
} as const;

/**
 * 需要用户介入的关键词
 */
export const USER_INTERVENTION_KEYWORDS = [
  '人工',
  '人工介入',
  '需要用户',
  '无法决定'
] as const;

/**
 * 路由结果类型
 */
export type RoutingTarget = 'agent-t' | 'agent-a' | 'user';

/**
 * 路由函数
 */
export function routeBasedOnReason(reason: string): RoutingTarget {
  const lowerReason = reason.toLowerCase();
  
  // 检查是否需要 Agent T
  for (const keyword of ROUTING_KEYWORDS['agent-t']) {
    if (lowerReason.includes(keyword)) {
      return 'agent-t';
    }
  }
  
  // 检查是否需要 Agent A
  for (const keyword of ROUTING_KEYWORDS['agent-a']) {
    if (lowerReason.includes(keyword)) {
      return 'agent-a';
    }
  }
  
  // 检查是否需要用户介入
  for (const keyword of USER_INTERVENTION_KEYWORDS) {
    if (lowerReason.includes(keyword)) {
      return 'user';
    }
  }
  
  // 默认：交给 Agent T 处理
  return 'agent-t';
}

/**
 * 获取 Agent 职责描述
 */
export function getExecutorResponsibilities(executorId: string) {
  return EXECUTOR_RESPONSIBILITIES[executorId as keyof typeof EXECUTOR_RESPONSIBILITIES] || null;
}
