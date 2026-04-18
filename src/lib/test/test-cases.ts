/**
 * 集成测试案例统一文件
 * 
 * 基于以下核心设计文档：
 * 1. 《详细设计文档agent高智能交互的MCP能力设计与capability_list的MCP能力存储.md》- MCP能力设计
 * 2. 《详细设计文档-执行指令过程-V2.md》- 执行指令流程
 * 3. 《详细设计-agent_sub_task_step_history.md》- 交互历史记录
 * 
 * 当前案例数量：8个已实现 + 14个待补充 = 22个
 * 最后更新：2026-03-05
 */

// ==================== 类型定义 ====================

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'complex' | 'regression' | 'edge' | 'performance';
  priority: 'P0' | 'P1' | 'P2';
  designDoc: 'MCP能力设计' | '执行指令过程' | '交互历史记录' | '多个文档';
  target: string;
  entryPoint: string;
  params: Record<string, any>;
  expected: {
    status: string;
    tables: string[];
    validations: DataValidation[];
  };
  status: '已实现' | '待实现';
  note?: string;
}

export interface DataValidation {
  table: string;
  field: string;
  expected: any;
  operator: 'eq' | 'gt' | 'lt' | 'contains' | 'regex' | 'gte' | 'lte';
}

// ==================== 基础功能测试（TC-01 ~ TC-04）====================

export const TC01_COMPLIANCE: TestCase = {
  id: 'TC-01',
  name: '合规审核',
  description: '验证合规检查MCP调用流程，包括能力查询、参数拼装、执行和结果回传',
  category: 'basic',
  priority: 'P0',
  designDoc: 'MCP能力设计',
  target: '验证content_audit能力调用',
  entryPoint: '/api/test/run-all-tests',
  params: { testCaseId: 1 },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history', 'capability_list'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks', field: 'capability_type', expected: 'content_audit', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'record_count', expected: 2, operator: 'gte' },
      { table: 'agent_sub_tasks_step_history', field: 'has_request', expected: true, operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'has_response', expected: true, operator: 'eq' },
      { table: 'capability_list', field: 'capability_exists', expected: true, operator: 'eq' },
      { table: 'capability_list', field: 'status', expected: 'available', operator: 'eq' },
    ]
  },
  status: '已实现'
};

export const TC02_SEARCH_SUMMARY: TestCase = {
  id: 'TC-02',
  name: '网页搜索带摘要',
  description: '验证搜索+摘要生成MCP调用流程',
  category: 'basic',
  priority: 'P0',
  designDoc: 'MCP能力设计',
  target: '验证search+摘要生成能力',
  entryPoint: '/api/test/run-all-tests',
  params: { testCaseId: 2 },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history', 'capability_list'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks', field: 'capability_type', expected: 'search', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'record_count', expected: 2, operator: 'gte' },
      { table: 'capability_list', field: 'capability_exists', expected: true, operator: 'eq' },
    ]
  },
  status: '已实现'
};

export const TC03_SEARCH_BASIC: TestCase = {
  id: 'TC-03',
  name: '网页搜索',
  description: '验证基础网页搜索MCP调用流程',
  category: 'basic',
  priority: 'P1',
  designDoc: 'MCP能力设计',
  target: '验证基础search能力',
  entryPoint: '/api/test/run-all-tests',
  params: { testCaseId: 3 },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history', 'capability_list'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks', field: 'capability_type', expected: 'search', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'record_count', expected: 2, operator: 'gte' },
    ]
  },
  status: '已实现'
};

export const TC04_WECHAT_DRAFT: TestCase = {
  id: 'TC-04',
  name: '添加草稿',
  description: '验证微信公众号添加草稿MCP调用流程',
  category: 'basic',
  priority: 'P0',
  designDoc: 'MCP能力设计',
  target: '验证platform_publish能力',
  entryPoint: '/api/test/run-all-tests',
  params: { testCaseId: 4 },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history', 'capability_list'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks', field: 'capability_type', expected: 'platform_publish', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'record_count', expected: 2, operator: 'gte' },
    ]
  },
  status: '已实现'
};

// ==================== 复杂场景测试（TC-05 ~ TC-08）====================

export const TC05_RETRY_SUCCESS: TestCase = {
  id: 'TC-05',
  name: 'MCP首次失败重试成功',
  description: '验证MCP失败后重试策略，首次失败后重试成功',
  category: 'complex',
  priority: 'P1',
  designDoc: '执行指令过程',
  target: '验证重试策略（同方案重试）',
  entryPoint: '/api/test/complex-scenarios',
  params: { scenario: 'retry_success' },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'record_count', expected: 2, operator: 'gte' },
      { table: 'agent_sub_tasks_step_history', field: 'mcp_attempt_count', expected: 2, operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'first_attempt_failed', expected: true, operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'second_attempt_success', expected: true, operator: 'eq' },
    ]
  },
  status: '已实现'
};

export const TC06_RETRY_FAILED: TestCase = {
  id: 'TC-06',
  name: 'MCP多次失败最终失败',
  description: '验证最大重试限制处理，达到MAX_MCP_ATTEMPTS后失败',
  category: 'complex',
  priority: 'P1',
  designDoc: '执行指令过程',
  target: '验证MAX_MCP_ATTEMPTS限制',
  entryPoint: '/api/test/complex-scenarios',
  params: { scenario: 'max_retry_failed' },
  expected: {
    status: 'failed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'failed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'mcp_attempt_count', expected: 3, operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'all_attempts_failed', expected: true, operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'failure_analysis_exists', expected: true, operator: 'eq' },
    ]
  },
  status: '已实现'
};

export const TC07_MAX_ITERATIONS: TestCase = {
  id: 'TC-07',
  name: '达到最大迭代次数',
  description: '验证最大迭代次数限制，达到MAX_ITERATIONS后终止',
  category: 'complex',
  priority: 'P1',
  designDoc: '执行指令过程',
  target: '验证MAX_ITERATIONS限制',
  entryPoint: '/api/test/complex-scenarios',
  params: { scenario: 'max_iterations' },
  expected: {
    status: 'failed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'failed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'iteration_count', expected: 5, operator: 'gte' },
      { table: 'agent_sub_tasks_step_history', field: 'termination_reason', expected: 'MAX_ITERATIONS', operator: 'eq' },
    ]
  },
  status: '已实现'
};

export const TC08_USER_CONFIRM: TestCase = {
  id: 'TC-08',
  name: '用户确认后继续执行',
  description: '验证用户交互流程，NEED_USER决策和用户确认数据完整记录',
  category: 'complex',
  priority: 'P1',
  designDoc: '多个文档',
  target: '验证NEED_USER决策和数据记录',
  entryPoint: '/api/test/complex-scenarios',
  params: { scenario: 'user_confirm_continue' },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'has_need_user_decision', expected: true, operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'has_user_confirm', expected: true, operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'pending_key_fields_exists', expected: true, operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'user_modifications_recorded', expected: true, operator: 'eq' },
    ]
  },
  status: '已实现'
};

// ==================== 待补充测试（TC-09 ~ TC-22）====================

export const TC09_PARAM_VALIDATION_FAILED: TestCase = {
  id: 'TC-09',
  name: '参数校验失败',
  description: '验证五步强制校验失败场景，参数不符合要求时拒绝执行',
  category: 'edge',
  priority: 'P0',
  designDoc: 'MCP能力设计',
  target: '验证五步强制校验失败处理',
  entryPoint: '/api/test/run-all-tests',
  params: { testCaseId: 9, forceValidationFail: true },
  expected: {
    status: 'failed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'failed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'validation_failed', expected: true, operator: 'eq' },
    ]
  },
  status: '待实现',
  note: '需补充：验证参数缺失、类型错误、范围超限等场景'
};

export const TC10_SCHEMA_MISMATCH: TestCase = {
  id: 'TC-10',
  name: 'Schema不匹配',
  description: '验证interface_schema校验，参数结构与schema不匹配时拒绝执行',
  category: 'edge',
  priority: 'P0',
  designDoc: 'MCP能力设计',
  target: '验证interface_schema校验',
  entryPoint: '/api/test/run-all-tests',
  params: { testCaseId: 10, schemaMismatch: true },
  expected: {
    status: 'failed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'failed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'schema_validation_failed', expected: true, operator: 'eq' },
    ]
  },
  status: '待实现'
};

export const TC11_SAME_TYPE_SWITCH: TestCase = {
  id: 'TC-11',
  name: '同类型切换策略',
  description: '验证方案A→方案B切换，同capability_type不同solution切换',
  category: 'complex',
  priority: 'P0',
  designDoc: '执行指令过程',
  target: '验证同类型切换策略',
  entryPoint: '/api/test/complex-scenarios',
  params: { scenario: 'same_type_switch' },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'solution_switched', expected: true, operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'switch_reason', expected: 'MCP_FAILED', operator: 'eq' },
    ]
  },
  status: '待实现'
};

export const TC12_CROSS_TYPE_SWITCH: TestCase = {
  id: 'TC-12',
  name: '跨类型切换策略',
  description: '验证搜索→直接访问切换，不同capability_type间切换',
  category: 'complex',
  priority: 'P0',
  designDoc: '执行指令过程',
  target: '验证跨类型切换策略',
  entryPoint: '/api/test/complex-scenarios',
  params: { scenario: 'cross_type_switch' },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'capability_type_switched', expected: true, operator: 'eq' },
    ]
  },
  status: '待实现'
};

export const TC13_DEGRADE_STRATEGY: TestCase = {
  id: 'TC-13',
  name: '降级处理策略',
  description: '验证全功能→简化版切换，当高级功能不可用时降级执行',
  category: 'complex',
  priority: 'P1',
  designDoc: '执行指令过程',
  target: '验证降级处理策略',
  entryPoint: '/api/test/complex-scenarios',
  params: { scenario: 'degrade_strategy' },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'degraded', expected: true, operator: 'eq' },
    ]
  },
  status: '待实现'
};

export const TC14_NETWORK_ERROR: TestCase = {
  id: 'TC-14',
  name: 'Network错误处理',
  description: '验证网络错误重试，网络超时后重试机制',
  category: 'edge',
  priority: 'P1',
  designDoc: '执行指令过程',
  target: '验证网络错误重试',
  entryPoint: '/api/test/complex-scenarios',
  params: { scenario: 'network_error' },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'network_error_count', expected: 1, operator: 'gte' },
    ]
  },
  status: '待实现'
};

export const TC15_TIMEOUT_ERROR: TestCase = {
  id: 'TC-15',
  name: 'Timeout错误处理',
  description: '验证超时错误处理，MCP调用超时后的处理',
  category: 'edge',
  priority: 'P1',
  designDoc: '执行指令过程',
  target: '验证超时错误处理',
  entryPoint: '/api/test/complex-scenarios',
  params: { scenario: 'timeout_error' },
  expected: {
    status: 'failed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'failed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'timeout_occurred', expected: true, operator: 'eq' },
    ]
  },
  status: '待实现'
};

export const TC16_PERMISSION_ERROR: TestCase = {
  id: 'TC-16',
  name: 'Permission错误处理',
  description: '验证权限错误处理，MCP权限不足时的处理',
  category: 'edge',
  priority: 'P1',
  designDoc: '执行指令过程',
  target: '验证权限错误处理',
  entryPoint: '/api/test/complex-scenarios',
  params: { scenario: 'permission_error' },
  expected: {
    status: 'failed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'failed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'permission_denied', expected: true, operator: 'eq' },
    ]
  },
  status: '待实现'
};

export const TC17_TIMEOUT_CONTROL: TestCase = {
  id: 'TC-17',
  name: '超时控制机制',
  description: '验证timeout参数生效，自定义超时时间控制',
  category: 'edge',
  priority: 'P1',
  designDoc: '执行指令过程',
  target: '验证timeout参数',
  entryPoint: '/api/test/complex-scenarios',
  params: { scenario: 'timeout_control', timeout: 5000 },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'custom_timeout_used', expected: true, operator: 'eq' },
    ]
  },
  status: '待实现'
};

export const TC18_BUSINESS_RULES: TestCase = {
  id: 'TC-18',
  name: '业务规则校验',
  description: '验证business_rules校验，业务规则不满足时拒绝执行',
  category: 'edge',
  priority: 'P1',
  designDoc: 'MCP能力设计',
  target: '验证business_rules校验',
  entryPoint: '/api/test/run-all-tests',
  params: { testCaseId: 18, businessRuleFail: true },
  expected: {
    status: 'failed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'failed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'business_rule_failed', expected: true, operator: 'eq' },
    ]
  },
  status: '待实现'
};

export const TC19_USER_INTERACTION_RECORD: TestCase = {
  id: 'TC-19',
  name: '完整用户交互记录',
  description: '验证user_interactions字段完整性，用户交互数据完整记录',
  category: 'regression',
  priority: 'P2',
  designDoc: '交互历史记录',
  target: '验证user_interactions字段',
  entryPoint: '/api/test/complex-scenarios',
  params: { scenario: 'user_interaction_record' },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'user_interactions_exists', expected: true, operator: 'eq' },
    ]
  },
  status: '待实现',
  note: '需完善TC-08的数据验证'
};

export const TC20_FAILURE_ANALYSIS: TestCase = {
  id: 'TC-20',
  name: '失败分析记录',
  description: '验证failure_analysis字段，失败场景分析数据记录',
  category: 'regression',
  priority: 'P2',
  designDoc: '交互历史记录',
  target: '验证failure_analysis字段',
  entryPoint: '/api/test/complex-scenarios',
  params: { scenario: 'failure_analysis' },
  expected: {
    status: 'failed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'failed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'failure_analysis_exists', expected: true, operator: 'eq' },
    ]
  },
  status: '待实现',
  note: '需完善TC-06的数据验证'
};

export const TC21_TAGS_VALIDATION: TestCase = {
  id: 'TC-21',
  name: '标签数据验证',
  description: '验证scene_tag/business_type标签数据正确记录',
  category: 'regression',
  priority: 'P2',
  designDoc: '交互历史记录',
  target: '验证标签数据',
  entryPoint: '/api/test/run-all-tests',
  params: { testCaseId: 21 },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'scene_tag_exists', expected: true, operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'business_type_exists', expected: true, operator: 'eq' },
    ]
  },
  status: '待实现'
};

export const TC22_EXPERIENCE_REUSE: TestCase = {
  id: 'TC-22',
  name: '知识库经验复用',
  description: '验证experience_used字段，知识库经验复用记录',
  category: 'regression',
  priority: 'P2',
  designDoc: '交互历史记录',
  target: '验证experience_used字段',
  entryPoint: '/api/test/run-all-tests',
  params: { testCaseId: 22, useExperience: true },
  expected: {
    status: 'completed',
    tables: ['agent_sub_tasks', 'agent_sub_tasks_step_history'],
    validations: [
      { table: 'agent_sub_tasks', field: 'status', expected: 'completed', operator: 'eq' },
      { table: 'agent_sub_tasks_step_history', field: 'experience_used_exists', expected: true, operator: 'eq' },
    ]
  },
  status: '待实现',
  note: '依赖知识库功能实现'
};

// ==================== 导出所有测试案例 ====================

export const ALL_TEST_CASES: TestCase[] = [
  // 已实现（8个）
  TC01_COMPLIANCE,
  TC02_SEARCH_SUMMARY,
  TC03_SEARCH_BASIC,
  TC04_WECHAT_DRAFT,
  TC05_RETRY_SUCCESS,
  TC06_RETRY_FAILED,
  TC07_MAX_ITERATIONS,
  TC08_USER_CONFIRM,
  // 待实现（14个）
  TC09_PARAM_VALIDATION_FAILED,
  TC10_SCHEMA_MISMATCH,
  TC11_SAME_TYPE_SWITCH,
  TC12_CROSS_TYPE_SWITCH,
  TC13_DEGRADE_STRATEGY,
  TC14_NETWORK_ERROR,
  TC15_TIMEOUT_ERROR,
  TC16_PERMISSION_ERROR,
  TC17_TIMEOUT_CONTROL,
  TC18_BUSINESS_RULES,
  TC19_USER_INTERACTION_RECORD,
  TC20_FAILURE_ANALYSIS,
  TC21_TAGS_VALIDATION,
  TC22_EXPERIENCE_REUSE,
];

// 按状态筛选
export const IMPLEMENTED_TEST_CASES = ALL_TEST_CASES.filter(tc => tc.status === '已实现');
export const PENDING_TEST_CASES = ALL_TEST_CASES.filter(tc => tc.status === '待实现');

// 按分类筛选
export const BASIC_TEST_CASES = ALL_TEST_CASES.filter(tc => tc.category === 'basic');
export const COMPLEX_TEST_CASES = ALL_TEST_CASES.filter(tc => tc.category === 'complex');
export const EDGE_TEST_CASES = ALL_TEST_CASES.filter(tc => tc.category === 'edge');

// 按优先级筛选
export const P0_TEST_CASES = ALL_TEST_CASES.filter(tc => tc.priority === 'P0');
export const P1_TEST_CASES = ALL_TEST_CASES.filter(tc => tc.priority === 'P1');
export const P2_TEST_CASES = ALL_TEST_CASES.filter(tc => tc.priority === 'P2');

// 按设计文档筛选
export const MCP_DESIGN_CASES = ALL_TEST_CASES.filter(tc => tc.designDoc === 'MCP能力设计' || tc.designDoc === '多个文档');
export const EXECUTION_DESIGN_CASES = ALL_TEST_CASES.filter(tc => tc.designDoc === '执行指令过程' || tc.designDoc === '多个文档');
export const HISTORY_DESIGN_CASES = ALL_TEST_CASES.filter(tc => tc.designDoc === '交互历史记录' || tc.designDoc === '多个文档');

// 统计信息
export const TEST_CASES_STATS = {
  total: ALL_TEST_CASES.length,
  implemented: IMPLEMENTED_TEST_CASES.length,
  pending: PENDING_TEST_CASES.length,
  byCategory: {
    basic: BASIC_TEST_CASES.length,
    complex: COMPLEX_TEST_CASES.length,
    edge: EDGE_TEST_CASES.length,
  },
  byPriority: {
    P0: P0_TEST_CASES.length,
    P1: P1_TEST_CASES.length,
    P2: P2_TEST_CASES.length,
  },
  byDesignDoc: {
    'MCP能力设计': MCP_DESIGN_CASES.length,
    '执行指令过程': EXECUTION_DESIGN_CASES.length,
    '交互历史记录': HISTORY_DESIGN_CASES.length,
  }
};
