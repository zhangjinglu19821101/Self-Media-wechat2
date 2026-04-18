# Agent 任务执行系统 - 项目概述

## 项目概览
这是一个基于 Next.js 的 Agent 任务执行系统，包含 Agent T、Agent B、insurance-d、insurance-c 等多个执行 Agent。系统支持任务拆解、子任务执行、合规校验、用户决策等完整流程。

## 技术栈
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **ORM**: Drizzle ORM
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构
```
.
├── src/
│   ├── app/
│   │   ├── agents/              # Agent 相关页面
│   │   ├── api/                 # API 路由
│   │   │   └── agents/          # Agent API
│   │   └── query/               # 查询页面
│   ├── lib/
│   │   ├── agents/              # Agent 逻辑
│   │   ├── services/            # 业务服务
│   │   └── db/                  # 数据库相关
│   └── components/              # UI 组件
└── .coze                        # 项目配置
```

## 核心功能
1. **任务拆解**: Agent B 负责将主任务拆解为多个子任务
2. **子任务执行**: 各个 Agent 负责执行分配给自己的子任务
3. **合规校验**: 对 insurance-d / insurance-xiaohongshu 完成的文章进行合规性校验
4. **用户决策**: 在关键节点支持用户决策
5. **MCP 集成**: 集成各种 MCP 工具能力

## 关键文件说明

### Agent B 决策逻辑
- **文件**: `src/lib/agents/prompts/agent-b-business-controller.ts`
- **功能**: Agent B 的核心决策逻辑，包括合规校验、任务流转判断等
- **关键修改**: 优化了决策优先级，优先信任执行 Agent 的完成判断（isTaskDown=true 或 MCP 成功）

### 用户决策 API
- **文件**: `src/app/api/agents/user-decision/route.ts`
- **功能**: 处理用户决策请求
- **关键修改**: 新增 "task_completed" 选项，支持用户直接确认任务完成

### 任务详情 API
- **文件**: `src/app/api/agents/tasks/[taskId]/detail/route.ts`
- **功能**: 获取子任务的详细信息，包括执行历史、MCP 执行记录等
- **关键特性**: 已包含 mcpExecutions 字段，传递合规校验结果

### 子任务查询页面
- **文件**: `src/app/query/agent-sub-tasks/page.tsx`
- **功能**: 查询和展示 agent_sub_tasks 表的数据
- **关键修改**: 新增 MCP 执行标签页，特别展示合规校验结果

## 核心流程
1. **任务创建**: 用户或系统创建主任务
2. **任务拆解**: Agent B 将主任务拆解为子任务（orderIndex 1, 2, 3...）
3. **子任务执行**: 各 Agent 按顺序执行子任务
4. **合规校验**: orderIndex=2 的子任务完成后进行合规校验
5. **用户决策**: orderIndex=3 可能需要用户确认
6. **任务完成**: 所有子任务完成后主任务完成

## 合规校验流程
1. insurance-d 完成文章任务（orderIndex=2）
2. 系统自动触发 Agent B 进行合规校验
3. 合规校验结果存储在 agent_sub_tasks_mcp_executions 表中
4. orderIndex=3 的子任务可以访问和展示合规校验结果
5. 用户可以在子任务详情页面查看完整的合规校验结果

## 数据库表
- **daily_task**: 主任务表
- **agent_sub_tasks**: 子任务表
- **agent_sub_tasks_step_history**: 子任务执行历史
- **agent_sub_tasks_mcp_executions**: MCP 执行记录（包含合规校验结果）
- **material_library**: 素材库表（存储可复用的创作素材）
- **material_usage_log**: 素材使用记录表
- **style_templates**: 风格模板表（一组风格规则的集合）
- **platform_accounts**: 平台账号表（各平台的账号信息）
- **account_style_configs**: 账号-模板绑定表

## 素材库模块

### 功能概述
素材库用于存储和管理可复用的创作素材，支持快速查找和智能推荐。

### 核心功能
1. **素材创建**: 手动创建案例、数据、故事、引用等素材
2. **素材列表**: 分页展示、按类型/状态筛选
3. **素材搜索**: 关键词搜索（标题+内容）
4. **标签云**: 主题标签、场景标签、情绪标签统计

### 关键文件
- **Schema**: `src/lib/db/schema/material-library.ts`
- **API**: `src/app/api/materials/` (CRUD + 搜索 + 标签统计)
- **页面**: `src/app/materials/page.tsx`

### API 接口
| 接口 | 方法 | 说明 |
|-----|------|------|
| `/api/materials` | GET | 获取素材列表（支持搜索、筛选、分页） |
| `/api/materials` | POST | 创建新素材 |
| `/api/materials/[id]` | GET | 获取素材详情 |
| `/api/materials/[id]` | PUT | 更新素材 |
| `/api/materials/[id]` | DELETE | 删除素材 |
| `/api/materials/[id]/use` | POST | 记录素材使用 |
| `/api/materials/tags` | GET | 获取标签统计 |
| `/api/materials/recommend` | GET | 根据指令推荐素材（关键词匹配+使用频率排序） |
| `/api/db/create-material-library` | GET | 创建素材库表（迁移） |

### 素材类型
- `case`: 案例素材
- `data`: 数据素材
- `story`: 故事素材
- `quote`: 引用素材
- `opening`: 开头素材
- `ending`: 结尾素材

### 标签维度
- **主题标签** (topicTags): 港险、重疾、医疗险、意外险等
- **场景标签** (sceneTags): 开头案例、收益对比、理赔纠纷等
- **情绪标签** (emotionTags): 踩坑、避坑、省钱、警惕等

### 后续规划
- 预留 `vectorId` 字段，支持升级为混合架构（PostgreSQL + 向量数据库）
- 支持语义搜索和智能推荐

## 创作引导功能

### 功能概述
在主页AI拆解完成后，提供可选的创作引导区域，帮助用户明确核心观点、选择情感基调、关联素材，使 insurance-d 能产出更贴合用户意图的文章。

### 设计原则
1. **可选不强制**：创作引导区域默认折叠，不填写不影响原有流程
2. **兜底保障**：即使不填创作引导，原始指令也会自动作为 userOpinion 传递给 insurance-d
3. **AI辅助**：提供"AI帮我想观点"和"AI推荐素材"功能，降低用户表达门槛

### 核心功能
1. **核心观点**：用户输入想让文章表达的核心立场/结论，insurance-d 会作为最高优先级遵守
2. **情感基调**：4种预设基调（理性客观/踩坑警醒/温情共情/专业权威），影响文章语气风格
3. **素材关联**：从素材库搜索或AI推荐，选取案例/数据等论据注入 insurance-d
4. **AI建议观点**：调用 `/api/agents/b/suggest-opinion` 根据指令生成3个建议核心观点

### 数据流
```
创作引导区域(coreOpinion + emotionTone + selectedMaterialIds)
  → submitToServer 组装 userOpinion
    → /api/agents/b/simple-split 接收 userOpinion + materialIds
      → agent_sub_tasks 存储
        → SubtaskExecutionEngine 执行时读取
          → 注入 insurance-d 提示词（最高优先级）
```

### 关键文件
- **前端**: `src/app/page.tsx`（创作引导UI + submitToServer 传递逻辑）
- **建议观点API**: `src/app/api/agents/b/suggest-opinion/route.ts`
- **素材推荐API**: `src/app/api/materials/recommend/route.ts`
- **后端注入**: `src/lib/services/subtask-execution-engine.ts`（buildExecutionContext + 注入逻辑）

### API 接口
| 接口 | 方法 | 说明 |
|-----|------|------|
| `/api/agents/b/suggest-opinion` | POST | 根据指令AI生成3个建议核心观点 |
| `/api/materials/recommend` | GET | 根据指令关键词推荐素材 |

## 开发规范
1. 使用 TypeScript 进行类型安全开发
2. 遵循 shadcn/ui 组件规范
3. 使用 Tailwind CSS 进行样式开发
4. API 路由遵循 RESTful 规范
5. 数据库操作使用 Drizzle ORM

## 测试说明
- 代码静态检查: `pnpm lint` 和 `pnpm ts-check`
- 构建检查: `pnpm build`
- 接口测试: 使用 curl 或其他工具测试 API 接口

## 最近更新
1. **新用户自动初始化数据**: 注册时自动创建默认平台账号（微信公众号、小红书）和风格模板（10个：公众号6个 + 小红书/知乎/抖音/微博各1个）+ 小红书内容模板（4个：3卡简洁/5卡标准/5卡详尽/7卡深度）
2. 优化了 Agent B 决策逻辑，优先信任执行 Agent 的完成判断
2. 用户决策界面新增"指令已完成"选项
3. 子任务查询页面新增 MCP 执行记录展示，特别突出合规校验结果
4. 确认 order_index=3 的合规校验结果已正确传递（通过任务详情 API 的 mcpExecutions 字段）
5. **内容截断修复**: maxContentLength 从 3000 增大到 20000，解决 order_index=5 内容截断问题
6. **用户观点与素材融入**: 支持 insurance-d 写文章前融入用户观点和素材
7. **代码审核修复**: 审核发现并修复了多条数据流断裂路径（userOpinion/materialIds 未传递），涉及以下文件：
   - `command-result-service.ts`: createDailyTaskWithDuplicateCheck 参数和 insertData 补充
   - `commands/route.ts`: 调用 createDailyTaskWithDuplicateCheck 时传递 userOpinion/materialIds
   - `save-split-result-v2.ts`: 原生 SQL INSERT 补充 user_opinion/material_ids 列
   - `exceptions/[failureId]/resolve/route.ts`: insert dailyTask 时继承 userOpinion/materialIds
   - `agents/b/simple-split/route.ts`: 请求参数解构和 INSERT 补充
   - `agents/[id]/subtasks/route.ts`: 两处 INSERT 均补充，修复 import 为 commandResultService 实例
   - `agent-sub-tasks/confirm-split-fix/route.ts`: 原生 SQL INSERT 补充
   - `split/confirm/route.ts`: 原生 SQL INSERT 补充
   - `subtask-execution-engine.ts`: 自动拆分 INSERT 补充
   - `task-state-machine.ts`: 新增 TaskStatusConst 常量解决 TaskStatus.UNSPLIT 类型问题
8. **数据库迁移 API**: `/api/db/add-user-opinion-fields` 用于给 agent_tasks、agent_sub_tasks、daily_task 表添加 user_opinion 和 material_ids 字段
9. **Phase 2: 提示词动态拼接系统**: 实现需求文档3.2节，insurance-d 提示词从静态v2升级为动态拼接v3
   - `insurance-d-v3.md`: 固定基础提示词（核心铁律4条 + 风格要求4条 + 创作流程3条），精确对齐需求文档3.2.1
   - `digital-asset-service.ts`: 数字资产管理服务，移除Mock数据，使用真实material_library表查询
   - `prompt-assembler-service.ts`: 动态提示词拼接服务，核心锚点完整输出不截断，拼接顺序对齐3.2.3
   - `/api/prompt-assembler/route.ts`: 提示词组装API，含输入校验、GET预览、安全控制
   - `prompt-loader.ts`: insurance-d 指向 v3.md
   - `subtask-execution-engine.ts`: insurance-d 执行时使用 PromptAssemblerService 动态拼接提示词
   - v3.md 包含 v2.md 全部内容（用户观点/素材、写作风格约束、HTML格式、字数约束等），v2.md 保留作历史参考
   - 用户专属规则/风格规则的数据库表属于 Phase 3 范围，当前返回空数组（非Mock）

## 用户观点与素材融入 - 数据流说明

### 数据流全链路
```
用户输入(userOpinion + materialIds)
  → agent_tasks / daily_task (存储)
    → Agent B 拆解时继承到 agent_sub_tasks
      → SubtaskExecutionEngine 执行时：
        1. 从 agent_sub_tasks 读取 userOpinion
        2. 根据 materialIds 查询 material_library 获取素材内容
        3. 构建注入文本 (userOpinionAndMaterialsText)
        4. 注入到 insurance-d 提示词中（最高优先级）
```

### 需传递 userOpinion/materialIds 的所有路径
| 路径 | 入口 | daily_task | agent_sub_tasks |
|------|------|-----------|----------------|
| `/api/tasks` POST | ✅ | ✅ (via createAgentTaskWithDuplicateCheck) | N/A |
| `/api/commands` POST | ✅ | ✅ (via createDailyTaskWithDuplicateCheck) | N/A |
| `/api/daily-tasks/confirm-split` | N/A | ✅ (via save-split-result-v2) | ✅ (via Drizzle INSERT) |
| `/api/agent-sub-tasks/confirm-split` | N/A | N/A | ✅ |
| `/api/agents/b/simple-split` | ✅ (请求参数) | N/A | ✅ |
| `/api/agents/[id]/subtasks` | ✅ (请求参数) | ✅ (via commandResultService) | ✅ (两处) |
| `/api/agent-sub-tasks/confirm-split-fix` | N/A | N/A | ✅ (原生SQL) |
| `/api/split/confirm` | N/A | N/A | ✅ (原生SQL) |
| `/api/exceptions/[failureId]/resolve` | N/A | ✅ | N/A |
| SubtaskExecutionEngine 自动拆分 | N/A | N/A | ✅ (Drizzle INSERT) |

## 最近更新
1. 优化了 Agent B 决策逻辑，优先信任执行 Agent 的完成判断（isTaskDown=true 或 MCP 成功）
2. 用户决策界面新增"指令已完成"选项
3. 子任务查询页面新增 MCP 执行记录展示，特别突出合规校验结果
4. 确认 order_index=3 的合规校验结果已正确传递（通过任务详情 API 的 mcpExecutions 字段）
5. **内容截断修复**: maxContentLength 从 3000 增大到 20000，解决 order_index=5 内容截断问题
6. **用户观点与素材融入**: 支持 insurance-d 写文章前融入用户观点和素材
7. **代码审核修复**: 审核发现并修复了多条数据流断裂路径（userOpinion/materialIds 未传递），涉及以下文件：
   - `command-result-service.ts`: createDailyTaskWithDuplicateCheck 参数和 insertData 补充
   - `commands/route.ts`: 调用 createDailyTaskWithDuplicateCheck 时传递 userOpinion/materialIds
   - `save-split-result-v2.ts`: 原生 SQL INSERT 补充 user_opinion/material_ids 列
   - `exceptions/[failureId]/resolve/route.ts`: insert dailyTask 时继承 userOpinion/materialIds
   - `agents/b/simple-split/route.ts`: 请求参数解构和 INSERT 补充
   - `agents/[id]/subtasks/route.ts`: 两处 INSERT 均补充，修复 import 为 commandResultService 实例
   - `agent-sub-tasks/confirm-split-fix/route.ts`: 原生 SQL INSERT 补充
   - `split/confirm/route.ts`: 原生 SQL INSERT 补充
   - `subtask-execution-engine.ts`: 自动拆分 INSERT 补充
   - `task-state-machine.ts`: 新增 TaskStatusConst 常量解决 TaskStatus.UNSUPPORTED 类型问题
8. **数据库迁移 API**: `/api/db/add-user-opinion-fields` 用于给 agent_tasks、agent_sub_tasks、daily_task 表添加 user_opinion 和 material_ids 字段
9. **Phase 2: 提示词动态拼接系统**: 实现需求文档3.2节，insurance-d 提示词从静态v2升级为动态拼接v3
   - `insurance-d-v3.md`: 固定基础提示词（核心铁律4条 + 风格要求4条 + 创作流程3条），精确对齐需求文档3.2.1
   - `digital-asset-service.ts`: 数字资产管理服务，使用真实 material_library 表查询
   - `prompt-assembler-service.ts`: 动态提示词拼接服务，核心锚点完整输出不截断，拼接顺序对齐3.2.3
   - `/api/prompt-assembler/route.ts`: 提示词组装API，含输入校验、GET预览、安全控制
   - `prompt-loader.ts`: insurance-d 指向 v3.md
   - `subtask-execution-engine.ts`: insurance-d 执行时使用 PromptAssemblerService 动态拼接提示词
   - v3.md 包含 v2.md 全部内容（用户观点/素材、写作风格约束、HTML格式、字数约束等），v2.md 保留作历史参考
   - 用户专属规则/风格规则的数据库表属于 Phase 3 范围，当前返回空数组（非Mock）
10. **Phase 3: 数字资产建表 + 大纲确认 + 规则接入**:
    - `src/lib/db/schema/digital-assets.ts`: 3张新表 Schema（core_anchor_assets + style_assets + feedback_assets）
    - `/api/db/create-digital-assets`: 建表迁移 API
    - `digital-asset-service.ts`: 全面重写，getUserExclusiveRules/getStyleRules 接入真实 DB 查询；新增 CRUD 方法（createStyleRule/updateStyleRule/deleteStyleRule/listStyleRules/archiveCoreAnchor/listCoreAnchors/recordFeedback/validateFeedback）
    - `subtask-execution-engine.ts`: 大纲确认双子任务改造（splitForOutlineConfirmationIfNeeded 方法，复用 auto-split 整数递增模式）；confirmedOutline 传递支持；核心锚点自动归档（archiveCoreAnchorsIfNeeded）
    - `prompt-assembler-service.ts`: PromptAssemblyOptions 扩展 confirmedOutline 字段；formatCurrentTask 追加已确认大纲段落
    - `insurance-d-v3.md`: v3.1 版本，新增第五部分"大纲确认模式"
    - `/api/agents/user-decision/route.ts`: 新增 outline_confirmed + outline_revision 决策类型处理
    - `/api/digital-assets/route.ts`: 数字资产列表 API（GET+POST）
    - `/api/digital-assets/[id]/route.ts`: 单个资产 CRUD API（GET+PUT+DELETE）
    - `src/app/digital-assets/page.tsx`: 数字资产管理页面（风格规则 CRUD + 核心锚点历史查看）
11. **Phase 4: 自动沉淀 + 校验升级**: 实现需求文档5.1节，新增文章校验和风格自动沉淀能力
   - `src/lib/services/article-validation-service.ts`: 文章校验服务（4类校验：锚点完整性≥0.85相似度、结构完整性、素材使用率≥60%、风格合规）
     - 纯JS实现：关键词重叠+LCS组合算法、HTML标签清理、停用词过滤
     - 返回 ValidationResult（overall/scores/summary/rewriteSuggestions/dimensionPassStatus）
   - `src/lib/services/style-deposition-service.ts`: 风格沉淀服务（高频词统计+禁用词提取+句式分析）
     - 纯JS分词（最大正向匹配），无需 node-jieba
     - 高频词提取：分词→词频→停用词→通用词差集→Top30→写入style_assets
     - 句式分析：反问句/排比/假设/转折模式检测 + 段落长度检查
     - 定时聚合：runFullAggregation() 查询最近50篇定稿→全量重算→合并去重→过期降权
   - `src/lib/cron/deposition-cron.ts`: 定时聚合任务封装（runDepositionAggregation + shouldRunDeposition）
   - `src/app/api/cron/deposition/route.ts`: 聚合任务API端点（GET /api/cron/deposition/run 手动触发）
   - `subtask-execution-engine.ts`: Agent B 评审前注入校验逻辑
     - insurance-d 任务完成后、Agent B 评审前自动调用 articleValidationService.validate()
     - 校验结果通过 validationResultText 参数注入 buildAgentBBusinessControllerUserPrompt()
     - 新增 buildValidationResultTextForAgentB() 方法格式化校验报告
     - 校验失败不阻塞主流程（try-catch降级）
   - `agent-b-business-controller.ts`: 新增 validationResultText 参数 + 校验结果解读规则
     - pass → 可考虑COMPLETE；warn → 可COMPLETE但需说明警告；fail → 必须REEXECUTE_EXECUTOR
     - 核心维度强制规则：锚点<85%/结构缺失/style error → 必须 fail
12. **Phase 5: LLM 辅助 + 向量嵌入 + 完整闭环**: 实现需求文档5.2-5.3节，引入 LLM 和 Embedding 能力
   - `src/lib/services/llm-assisted-rule-service.ts`: LLM 辅助规则提取服务（4类能力）
     - 情绪分类(classifyEmotion): 6种情绪(共情/理性/警示/温情/专业/中性) + 置信度
     - 修改意图理解(extractRuleFromFeedback): 从用户反馈提取可复用风格规则(6种ruleType)
     - 核心立场聚类(clusterCoreStances): 从历史观点中提炼反复出现的立场主题
     - 样本风格特征提取(extractStyleProfile): 分析标杆文章的语气/句式/用词特征
     - 使用 doubao-seed-1-6-lite / doubao-seed-2-0-mini 轻量模型，30秒超时，失败降级
     - JSON 解析器带容错（markdown代码块清理、brace定位、降级兜底）
   - `src/lib/services/style-similarity-service.ts`: 风格相似度评估服务（PoC）
     - 文章风格嵌入: EmbeddingClient (doubao-embedding-vision) → 1024维向量
     - 余弦相似度比较: compareStyle() 两篇文章对比 → 5级(identical/high/medium/low/divergent)
     - 风格一致性评估: evaluateConsistency() 多标杆对比 → 4级(excellent/good/acceptable/needs_improvement)
     - 15秒超时控制，失败返回 0.0 不阻塞
   - `subtask-execution-engine.ts`: Phase 5 闭环集成
     - insurance-d 完成后异步调用 runEmotionClassificationAsync()（LLM情绪分类）
     - 有 confirmedOutline 时异步调用 runStyleConsistencyAsync()（风格一致性评估）
     - 两个能力均为后台异步执行（不阻塞 Agent B 评审流程）
     - 结果持久化到 resultData.metadata.emotionClassification / styleConsistency
13. **Phase 5.5: 风格模板 + 平台账号绑定**: 实现多平台多账号不同风格的场景
   - `src/lib/db/schema/style-template.ts`: 3张新表 Schema
     - style_templates: 风格模板表（一组风格规则的集合）
     - platform_accounts: 平台账号表（公众号/小红书/知乎等）
     - account_style_configs: 账号-模板绑定表
   - `/api/db/create-style-template-tables`: 建表迁移 API（含 style_assets.template_id 字段）
   - `src/lib/services/style-template-service.ts`: 风格模板服务
     - 模板 CRUD、账号 CRUD、账号绑定模板
     - getDefaultTemplate(): 获取用户默认模板
     - getTemplateIdByAccount(): 根据账号获取绑定的模板ID
   - `/api/style-templates`: 风格模板 API（GET 列表 / POST 创建）
   - `/api/style-templates/[id]`: 单个模板 API（GET/PUT/DELETE）
   - `/api/platform-accounts`: 平台账号 API（GET 列表 / POST 创建）
   - `/api/platform-accounts/bind-template`: 账号绑定模板 API（POST 绑定 / DELETE 解绑）
   - `src/app/account-management/page.tsx`: 账号管理页面（模板管理 + 账号管理 + 绑定配置）
   - `digital-asset-service.ts`: getStyleRules() 支持 templateId 参数，按模板筛选风格规则
   - `style-deposition-service.ts`: saveDepositionResults() 支持 templateId 参数，规则绑定模板
   - `prompt-assembler-service.ts`: PromptAssemblyOptions 新增 templateId/accountId 字段
   - `subtask-execution-engine.ts`: 
     - 新增 getTemplateIdForTask() 方法，根据任务获取风格模板ID
     - insurance-d 执行时自动使用账号绑定的风格模板
14. **Phase 5.6: 发布账号选择功能**: 在创作引导区域添加账号选择，实现风格模板完整链路
   - `src/app/full-home/page.tsx`: 创作引导区域新增"发布账号"卡片
     - AI拆解后自动加载账号列表
     - 支持选择发布账号（显示平台、账号名、绑定的模板）
     - 提交时传递 accountId 到 API
   - `src/app/api/agents/b/simple-split/route.ts`: 接收并存储 accountId
     - 从请求体解构 accountId
     - 存储到 agent_sub_tasks.metadata.accountId
   - 完整数据流：
     - 用户选择账号 → accountId 存入任务 metadata
     - insurance-d 执行 → getTemplateIdForTask() 读取 accountId
     - 根据 accountId 获取 templateId → 加载对应风格规则
     - 文章生成时应用该账号绑定的风格模板
15. **Phase 5.7: 模板选择功能**: 在风格初始化页面添加模板选择
   - `src/app/style-init/page.tsx`: 新增模板选择区域
     - 加载已有模板列表供选择
     - 支持创建新模板
     - 分析结果保存到选定的模板
   - `src/app/api/style/init-from-upload/route.ts`: 支持 templateId/createTemplate/templateName 参数
   - 完整数据流：
     - 用户选择模板 → 分析文章 → 规则绑定到指定模板
     - 后续文章生成时，根据账号模板加载规则

16. **TypeScript 编译错误修复**:
   - `src/app/api/style/init-from-upload/route.ts`: 修复 createTemplate 调用参数顺序
   - `assets/page.tsx`: 多处 TypeScript 错误修复
     - Message 接口扩展：新增 notificationType、metadata、createdAt 可选字段
     - 移除重复的 notificationId 属性
     - 修复 taskResult.result 类型推断问题（使用 any 类型断言）
     - 添加缺失的 timestamp 属性
     - 补充 Card 子组件导入（CardHeader、CardTitle、CardContent、CardDescription）
17. **代码评审问题修复**: 根据技术专家与业务专家评审建议进行优化
   - `src/hooks/use-agent-websocket.ts`: WSMessage.result 类型扩展，支持 `string | Record<string, any>`
   - `assets/page.tsx`: 移除 `any` 类型断言，使用精确类型处理
   - `src/app/style-init/page.tsx`: 
     - 没有模板时默认勾选"创建新模板"
     - 添加更友好的提示信息
     - 添加 toast 成功反馈
     - 新增 Info 图标导入
   - `src/app/api/style/init-from-upload/route.ts`: 
     - 增加重试机制（最多 3 次，指数退避）
     - 增强错误处理和用户反馈
     - 更新模板规则数量时增加异常捕获
18. **风格规则保存 NaN 错误修复**: 修复 priority 字段为 undefined 时导致数据库更新失败的问题
   - `src/lib/services/style-deposition-service.ts`: 
     - 批量插入时：`priority: r.priority ?? 3`（默认优先级为 3）
     - 批量更新时：`const newPriority = result.priority ?? 3`
     - 降级模式插入时：`priority: result.priority ?? 3`
     - 降级模式更新时：同上处理
   - 根本原因：`convertAnalysisToRules` 函数中大部分规则对象未设置 `priority` 字段
   - 影响：所有已存在的规则更新时会失败（NaN 无法写入数据库）

19. **文章去重检测功能**: 实现零成本的两层去重检测方案
   - `src/lib/db/schema/article-hashes.ts`: 文章哈希表 Schema
   - `/api/db/create-article-hashes`: 建表迁移 API
   - `src/lib/services/article-dedup-service.ts`: 文章去重检测服务
     - 第1层: SHA-256 哈希（完全匹配）
     - 第2层: SimHash 海明距离（近似匹配，距离≤3 认为重复）
     - 纯 JS 实现，零额外成本
   - `/api/style/init-from-upload`: 集成去重检测
     - 检测重复文章，返回缓存结果
     - 支持强制重新分析（forceReanalyze 参数）
     - 返回 fromCache 和 duplicateInfo 信息
   - 前端页面优化：模板下拉展示添加 articleCount 和 sourceArticles

20. **风格相似度校验功能**: 统一的风格相似度校验，覆盖界面和定时任务两个场景
   - `src/lib/services/style-similarity-validator.ts`: 风格相似度校验服务
     - 核心能力：计算文章风格与模板的相似度，防止风格污染
     - 相似度算法：加权平均（6维度50% + 词汇30% + 语气20%）
     - 阈值设置：相似度<50%拒绝保存，50%-70%警告，≥70%正常通过
     - **基准建立**：模板规则数为0时允许保存（建立风格基准），规则数>0时必须校验
     - 推荐功能：拒绝时自动查找更匹配的模板
   - `/api/style/init-from-upload/route.ts`: 集成到风格初始化页面
     - 保存规则前先校验风格相似度
     - 相似度过低返回错误+推荐模板
     - 成功时返回风格相似度信息
   - `src/lib/services/style-deposition-service.ts`: 集成到定时任务
     - runFullAggregation() 中每个账号保存前先校验
     - 校验不通过的文章自动跳过
     - 新增 skippedByStyleValidation 和 styleWarnings 字段
     - **性能优化**：先校验过滤，再分析保存，避免重复分析
   - `src/app/style-init/page.tsx`: 前端展示优化
     - 结果概览卡片展示风格相似度分数
     - 风格相似度过低时显示错误和推荐模板
     - 鼠标悬停显示详细分数（维度/词汇/语气）
   - 设计原则：
     - 防止风格污染：避免将不匹配的风格规则保存到模板
     - 帮助用户选择：推荐更匹配的模板
     - 保持一致性：确保模板风格统一
     - 基准建立：新模板第一篇文章作为风格基准

21. **模板平台维度功能**: 为风格模板添加平台维度，支持多平台风格隔离
   - `src/lib/db/schema/style-template.ts`: 新增平台类型定义
     - PlatformType: 'wechat_official' | 'xiaohongshu' | 'zhihu' | 'douyin' | 'weibo'
     - PLATFORM_LABELS: 平台标签映射（中文显示）
     - PLATFORM_OPTIONS: 平台选项列表（前端下拉使用）
     - styleTemplates 表新增 platform 字段（默认 wechat_official）
   - `/api/db/add-template-platform`: 数据库迁移 API
     - 添加 platform 字段（默认值 wechat_official）
     - 创建 idx_style_templates_platform 索引
     - 更新现有记录的 platform 为 wechat_official
   - `src/lib/services/style-template-service.ts`: 服务层支持
     - createTemplate(): 支持创建时指定平台
     - listTemplates(): 支持按平台筛选
     - getDefaultTemplate(): 支持按平台获取默认模板
     - updateTemplate(): 支持更新平台，同平台内默认模板互斥
   - `/api/style-templates`: API 支持 platform 参数
     - GET: 支持 platform 查询参数筛选
     - POST: 创建模板时支持 platform 字段
   - `src/app/style-init/page.tsx`: 前端平台选择
     - 新增平台选择下拉框（微信公众号/小红书/知乎/抖音/微博）
     - 切换平台时重新加载对应平台的模板列表
     - 创建模板时携带平台参数
   - 设计原则：
     - 风格隔离：不同平台的风格规则互不干扰
     - 平台默认：每个平台可以有独立的默认模板
     - 扩展友好：新增平台只需在 PLATFORM_OPTIONS 添加配置

22. **平台维度代码评审修复**: 根据技术专家评审建议进行修复
   - `src/lib/db/schema/style-template.ts`: 新增类型安全常量和校验函数
     - `VALID_PLATFORMS`: 有效平台列表常量
     - `DEFAULT_PLATFORM`: 默认平台常量（wechat_official）
     - `isValidPlatform(platform)`: 平台有效性校验函数（类型守卫）
     - `getValidPlatform(platform)`: 安全获取有效平台（无效值返回默认）
   - `src/app/api/style-templates/route.ts`: API 层校验集成
     - GET: 使用 `isValidPlatform()` 校验查询参数
     - POST: 使用 `getValidPlatform()` 校验请求体参数
   - `src/app/api/style/init-from-upload/route.ts`: 创建模板时校验平台
     - 使用 `getValidPlatform()` 替代 `as PlatformType` 类型断言
   - `src/app/style-init/page.tsx`: 前端类型安全增强
     - 导入 `DEFAULT_PLATFORM`、`PLATFORM_OPTIONS`、`PLATFORM_LABELS` 常量
     - `selectedPlatform` 状态使用 `PlatformType` 类型
     - 初始值使用 `DEFAULT_PLATFORM` 替代硬编码
     - 平台选择下拉使用 `PLATFORM_OPTIONS` 动态渲染
   - P0 竞态条件修复:
     - 使用 `AbortController` 取消之前的模板加载请求
     - 组件卸载时清理请求
23. **风格规则数据修复**: 修复 insurance-d 使用风格规则的问题
   - 问题 A 修复：未选择账号时的默认模板兜底逻辑
     - `subtask-execution-engine.ts`: getTemplateIdForTask() 方法增加默认模板兜底
     - 未选择账号或账号未绑定模板时，自动使用 getDefaultTemplate() 获取默认模板
   - 问题 B 修复：清理未绑定模板的规则
     - 新增 `/api/db/fix-unbound-style-rules`: 将 templateId=NULL 的规则绑定到默认模板
     - 修复了 45 条未绑定模板的规则
   - 数据统计更新：
     - 新增 `/api/db/update-template-rule-count`: 更新模板的 ruleCount 统计字段
     - "专业严谨"模板规则数量: 22 → 67 条
   - 最终效果：
     - 选择账号 → 使用账号绑定的模板
     - 未选择账号/账号未绑定模板 → 自动使用默认模板
     - 所有 71 条规则均已绑定到模板（67条绑定"专业严谨"，4条绑定"测试模板"）
24. **任务拆解页面入口优化**: 在任务拆解 tab 右上角添加快捷入口
   - `src/app/full-home/page.tsx`: split tab 的按钮区域调整
     - 新增"风格复刻"按钮 → /style-replica（青绿渐变）
     - 与现有的"风格初始化"按钮并列
   - 效果：用户可在任务拆解页面快速跳转到风格复刻系统
26. **多平台风格模板支持修复**: 修复 `getTemplateIdForTask()` 未考虑平台维度的问题
   - 问题：未选择账号或账号未绑定模板时，`getDefaultTemplate(userId)` 返回公众号模板
   - 影响：小红书/知乎/抖音/微博账号无法使用对应平台的风格规则
   - 修复：
     - `style-template-service.ts`: 新增 `getAccountPlatform(accountId)` 方法获取账号平台
     - `subtask-execution-engine.ts`: `getTemplateIdForTask()` 传递 `platform` 参数
     - 数据库：为5个平台各创建默认模板（小红书种草/知乎干货/抖音短视频/微博热点）
   - 效果：每个平台独立风格隔离，选择账号 → 使用账号绑定的模板 → 未绑定时使用对应平台默认模板
27. **账号管理页面入口优化**: 在账号管理页面右上角添加跳转到任务拆解页的入口
   - `src/app/account-management/page.tsx`: 页面标题区域调整
     - 新增"任务拆解"按钮 → /full-home?tab=split（紫渐变）
     - 与现有的"刷新"按钮并列
   - 效果：用户可在账号管理页面快速跳转到任务拆解页面进行创作
28. **任务拆解页面添加入口**: 在任务拆解 tab 添加"专业严谨规则"按钮
   - `src/app/full-home/page.tsx`: split tab 按钮区域调整
     - 新增"专业严谨规则"按钮 → /digital-assets?templateId=xxx（橙渐变）
     - 直接跳转到数字资产页面并筛选专业严谨模板的67条规则
   - 效果：用户可快速查看专业严谨模板的风格规则列表

## 多用户系统改造 (Phase 6)

### 架构概述
- **认证体系**: NextAuth v5 (Credentials Provider + JWT Session)
- **租户模型**: Account(自然人) + Workspace(资源容器) + WorkspaceMember(成员关系)
- **权限模型**: RBAC 4级角色 (Owner/Admin/Editor/Viewer)
- **数据隔离**: 全部业务表按 workspace_id 隔离，API 自动注入 workspaceId 过滤

### 新增核心文件
| 文件 | 说明 |
|------|------|
| `src/lib/db/schema/auth.ts` | 认证 Schema (accounts, workspaces, workspace_members, account_sessions) |
| `src/lib/auth/index.ts` | NextAuth 配置 (Credentials Provider, JWT, 连续失败锁定) |
| `src/lib/auth/password.ts` | 密码工具 (hash/verify/strength validate) |
| `src/lib/auth/roles.ts` | RBAC 权限矩阵 (14种 Action, canDo 函数) |
| `src/lib/auth/context.ts` | API 请求上下文工具 (getAccountId, getWorkspaceId, getAuthContext) |
| `src/lib/db/tenant.ts` | 租户隔离工具 (canAccessWorkspace, getAccessibleWorkspaceIds) |
| `src/lib/api/client.ts` | 前端 Fetch 封装 (自动注入 x-workspace-id, 401 跳转登录) |
| `src/lib/websocket-auth.ts` | WebSocket 连接认证 (Agent 白名单 + User Token 验证) |
| `src/middleware.ts` | 全局认证中间件 (未认证拦截, 公开路径放行) |

### 前端组件
| 文件 | 说明 |
|------|------|
| `src/components/app-navbar.tsx` | 应用顶部导航栏 (集成 Workspace 切换器 + 页面导航) |
| `src/components/client-layout.tsx` | 客户端布局包装器 (在 root layout 中渲染 Navbar) |
| `src/components/workspace-switcher.tsx` | Workspace 切换器 (Popover, localStorage 持久化) |
| `src/components/publish-confirm-panel.tsx` | 发布确认面板 (平台选择/定时发布) |
| `src/app/login/page.tsx` | 登录页面 |
| `src/app/register/page.tsx` | 注册页面 (含密码强度指示器) |
| `src/app/publish/history/page.tsx` | 发布历史页面 |
| `src/app/settings/team/page.tsx` | 团队管理页面 (邀请/角色变更/移除) |

### API 路由改造
已为以下 82 个路由添加认证和 workspaceId 隔离:
- `/api/agents/*` — 所有 Agent 路由（B/intervene, [id]/*, create-task, user-decision, pending-commands 等 30+ 个）
- `/api/tasks/*` — 任务 CRUD + 状态 + 进度 + 确认
- `/api/daily-tasks/*` — 日常任务列表 + 确认拆解
- `/api/materials/*` — 素材库 CRUD + 搜索 + 标签统计
- `/api/digital-assets/*` — 数字资产 CRUD
- `/api/style-templates/*` — 风格模板 CRUD
- `/api/platform-accounts/*` — 平台账号 CRUD
- `/api/subtasks/*` — 子任务列表 + 执行 + 重试 + 跳过 + 状态
- `/api/agent-sub-tasks/*` — 子任务确认拆解 + 排序调整
- `/api/split/*` — 拆解确认
- `/api/commands/*` — 指令列表
- `/api/command-results/*` — 指令结果 + 统计
- `/api/style/*` — 风格初始化（init-from-upload）
- `/api/style-analyzer/*` — 风格分析器全系列（7 个路由）
- `/api/articles/*` — 文章历史 + 生成触发
- `/api/search/*` — 搜索
- `/api/publish/*` — 发布提交/历史
- `/api/rag/*` — RAG 全系列（6 个路由）
- `/api/reports/*` — 报告
- `/api/workspaces/*` — Workspace 管理
- `/api/workspaces/[id]/members/*` — 成员管理
- `/api/notifications/*` — 通知
- `/api/rules/*` — 规则
- `/api/template/*` — 模板
- `/api/stats/*` — 统计
- `/api/decompose/*` — 任务分解
- `/api/download/*` — 下载
- `/api/research-quality/*` — 研究质量

### 数据库迁移
| 迁移 API | 说明 |
|----------|------|
| `/api/db/create-auth-tables` | 创建 accounts, workspaces, workspace_members, account_sessions 表 |
| `/api/db/migrate-to-workspace` | 11张表 user_id→workspace_id 重命名 + 12张表新增 workspace_id |
| `/api/db/create-publish-records` | 创建 publish_records 发布记录表 |

### Schema 改造 (userId → workspaceId)
- `style-template.ts`: styleTemplates, platformAccounts, accountStyleConfigs
- `digital-assets.ts`: styleAssets, coreAnchorAssets
- `material-library.ts`: materialLibrary
- `article-hashes.ts`: articleHashes
- `schema.ts`: agentTasks, dailyTask, agentSubTasks (新增字段)

### 服务层改造
- `style-template-service.ts`: 所有方法签名 userId→workspaceId
- `digital-asset-service.ts`: listStyleRules/createStyleRule 支持 workspaceId 参数
- `article-dedup-service.ts`: workspaceId 替代 userId
- `subtask-execution-engine.ts`: getTemplateIdForTask() 使用 workspaceId

### 开发规范
1. **所有新 API 必须调用** `getWorkspaceId(request)` 获取当前工作区 ID
2. **前端 fetch 应使用** `@/lib/api/client` 的 apiGet/apiPost 封装（自动携带 workspaceId）
3. **公开路径**: /login, /register, /api/auth/*, /api/db/*, /api/cron/*, /api/health
4. **workspaceId 优先级**: 请求头 x-workspace-id > URL 参数 > 用户默认 workspace > 'default-workspace'
5. **注册流程**: 创建 Account → 自动创建 Personal Workspace → 添加 Owner 成员

### WebSocket 认证
- **Agent 连接** (后端内部): `ws://host:5001/agent/{agentId}` — 白名单验证 (A/B/C/D/insurance-c/insurance-d)
- **用户连接** (前端浏览器): `ws://host:5001/user?token={sessionToken}&workspaceId={wsId}` — Session Token + Workspace 权限验证
- **认证模块**: `src/lib/websocket-auth.ts` — `authenticateWebSocket()` 统一入口
- **服务端改造**: `src/lib/websocket-server.ts` — 连接时调用认证，认证失败关闭连接 (code 1008)
- **WSClient 扩展**: 新增 `auth?: WSAuthResult` 字段，存储连接认证信息

29. **多平台发布功能（方案B：多版本生成模式）**: 支持一条指令为多个平台生成差异化文章
   - 核心设计：独立 commandResultId 模式 — 每个平台组使用独立的 commandResultId，天然隔离文章保存、split-publish、大纲确认等流程
   - **前端改造** (`src/app/full-home/page.tsx`):
     - 账号选择从单选改为多选（Checkbox），最多3个平台
     - 新增 `selectedAccountIds` 状态数组，兼容 `selectedAccountId`
     - 多选时展示"主账号"Badge和平台差异化提示
     - 创作引导草稿支持 `selectedAccountIds` 数组（v2版）
   - **API改造** (`src/app/api/agents/b/simple-split/route.ts`):
     - 接收 `accountIds` 数组参数
     - 多平台模式：每个账号创建独立 commandResultId 的一组子任务
     - 子任务 metadata 新增 `multiPlatformGroupId`、`platformGroupIndex`、`platformGroupTotal`、`platformLabel` 字段
     - insurance-d 类型子任务标题添加平台前缀（如 `[小红书] 写文章`）
     - 单平台模式完全兼容旧逻辑
   - **执行引擎适配** (`src/lib/services/subtask-execution-engine.ts`):
     - 新增 `buildPlatformContextPrefix()` 函数，为 insurance-d 注入平台上下文
     - 5种平台风格指南（微信公众号/小红书/知乎/抖音/微博）
     - 多平台时追加"本文为XX专属版本"提示
   - **发布API改造** (`src/app/api/publish/submit/route.ts`):
     - 新增 `platformArticles` 数组参数，支持多平台模式
     - 每个平台使用自己的文章版本发布（而非对同一篇文章格式适配）
     - 单平台模式完全兼容
   - **文章保存修复** (P0 bug修复):
     - `article_content` 表新增 `sub_task_id` 字段
     - `article-content-service.ts`: `saveArticleContentDirectly()` 使用 taskId + subTaskId 组合查询
     - 解决多平台共享 commandResultId 时文章覆盖问题
     - 迁移API: `/api/db/add-article-content-sub-task-id`

29. **BYOK（Bring Your Own Key）改造**: 用户可配置自己的豆包 API Key，系统优先使用用户 Key 调用 LLM，费用由用户承担
   - **Schema**: `src/lib/db/schema/user-api-keys.ts` — 用户 API Key 表（AES-256-GCM 加密存储）
   - **迁移API**: `/api/db/create-user-api-keys-table` — 建表迁移
   - **加密服务**: `src/lib/services/user-api-key-service.ts` — CRUD + Key 验证 + 加密/解密
   - **LLM 工厂**: `src/lib/llm/factory.ts` — `createUserLLMClient(workspaceId)` / `createUserEmbeddingClient(workspaceId)`
     - 优先级：用户 Key → 平台 Key（降级）
     - 5 分钟客户端实例缓存，Key 更新后自动失效
     - 降级模式：fallback（默认）/ strict（未配 Key 时抛错）
   - **API 路由**:
     - `/api/user-api-keys` — GET 列表 / POST 创建
     - `/api/user-api-keys/[id]` — GET/PUT/DELETE 单个 Key
     - `/api/user-api-keys/verify` — POST 验证 Key 有效性
   - **前端页面**: `/settings/api-keys` — Key 管理 UI（添加/验证/禁用/删除）
   - **改造范围（25 个 LLM 调用点）**:
     - `agent-llm.ts`: `callLLM()` 新增 `workspaceId` 参数，内部走工厂方法
     - `subtask-execution-engine.ts`: 5 处 `callLLM` 传入 `task.workspaceId`
     - API 层 8 个路由: `ai-split`/`suggest-opinion`/`chat`/`send-command`/`preview-outline`/`style-analyzer`/`upload-parse`/`commands/send`
     - Service 层 7 个服务: `xiaohongshu-style-analyzer`/`xiaohongshu-visual-analyzer`/`llm-assisted-rule-service`/`style-deposition-service`/`style-similarity-service`/`mcp/vision-tools`/`mcp-result-text-generator`
     - 基础设施层 4 个组件: `orchestration/instance`/`rag/embedding-function`/`split-retry-manager`/`cron`（后两者暂用平台 Key）
   - **环境变量**: `COZE_ENCRYPTION_KEY`（32 字节 hex 密钥，用于 AES-256-GCM 加密）
   - **安全设计**: Key 加密存储 + 日志脱敏 + 认证拦截 + workspaceId 隔离
   - **数据模型** (`src/lib/db/schema.ts`):
     - articleContent 新增 `subTaskId` 字段和索引
   - 详细实施方案文档: `docs/重要-多平台发布功能.md`
30. **平台独立 Agent 拆分**: 将小红书和公众号拆分为独立的执行 Agent
   - 新增 `insurance-xiaohongshu` Agent 专门完成小红书图文创作
   - `insurance-d` 继续负责公众号长文写作
   - Agent B 依然是协调者，Agent T 依然是 MCP 技术专家
   - **新增文件**:
     - `src/lib/agents/prompts/insurance-xiaohongshu.md`: 小红书专属提示词（JSON输出格式、图文分工、emoji风格）
     - `src/components/xiaohongshu-preview.tsx`: 小红书图文预览组件（手机模拟器+卡片渲染+复制/下载）
   - **改造文件**:
     - `src/lib/agent-types.ts`: AgentId 类型新增 `insurance-xiaohongshu`
     - `src/lib/websocket-auth.ts`: Agent 白名单新增 `insurance-xiaohongshu`
     - `src/app/api/agents/b/simple-split/route.ts`: 新增 `getExecutorForPlatform()` 按平台路由 executor
     - `src/lib/services/prompt-assembler-service.ts`: `PromptAssemblyOptions` 新增 `executorType`，按 Agent 类型加载对应提示词文件
     - `src/lib/services/subtask-execution-engine.ts`: 
       - 写作 Agent 检测从 `isInsuranceD` 扩展为 `isWritingAgent`（insurance-d + insurance-xiaohongshu）
       - 传递 `executorType` 给 PromptAssemblerService
       - insurance-xiaohongshu 不注入平台前缀（规则已内置）
       - 文章校验：从 JSON 提取 fullText 进行校验
       - extractArticleTitle 支持新 Agent
     - `src/lib/agents/prompts/agent-b-business-controller.ts`: Agent B 决策支持 insurance-xiaohongshu
     - `src/lib/agents/agent-roles-config.ts`: AgentRole 类型 + 角色配置新增 insurance-xiaohongshu
     - `src/lib/agents/prompt-loader.ts`: EXECUTOR_AGENTS + 文件映射新增 insurance-xiaohongshu
     - `src/components/agent-task-list-normal.tsx`: 
       - executor 配置新增 insurance-xiaohongshu（小红书创作专家）
       - 已完成任务区分显示：小红书→图文预览按钮，公众号→发布文章按钮
     - 后处理逻辑适配：
       - `article-content-service.ts`: isInsuranceAgent 包含 insurance-xiaohongshu
       - `command-result-service.ts`: 合规校验触发支持 insurance-xiaohongshu
       - `agent-task.ts`: completeTask 触发合规校验支持 insurance-xiaohongshu
       - `style-deposition-service.ts`: 风格沉淀查询支持 insurance-xiaohongshu（使用 inArray）
       - `subtask-state-machine.ts`: 公众号自动上传仅限 insurance-d（小红书由前端预览）
       - `splitter-factory.ts`: 拆分器注册表新增 insurance-xiaohongshu
       - `task-assignment-service.ts`: 任务分配支持 insurance-xiaohongshu
   - **小红书图文预览功能**:
     - 手机模拟器渲染（封面卡+要点卡+文字区+标签）
     - 渐变色卡片（5种配色方案）
     - 支持复制正文/复制JSON/生成卡片图
     - 解析多级数据源（stepHistory → resultData）
31. **代码评审修复（insurance-xiaohongshu 完整性补全）**: 对比 insurance-d 完整流程，修复10类遗漏问题
   - **P0 修复**:
     - `agent-llm.ts`: 模型选择仅匹配 `insurance-d`，新增 `insurance-xiaohongshu` 使用高质量模型
     - `executor-identity-config.ts`: 未注册 `insurance-xiaohongshu`，新增 Agent 身份声明
   - **P1 修复**:
     - `agent-builder.ts`: 未注册 `insurance-xiaohongshu` Agent 配置，新增 Agent 能力定义
     - `agent-prompts.ts`: AGENT_NAMES + AGENT_PROMPTS 缺少 `insurance-xiaohongshu`，新增条目
     - `compliance-check.ts`: 提示词硬编码"对 insurance-d 完成"，新增 `executorType` 参数动态适配
     - `agent-task.ts`: 合规校验提示词生成未传递 `executorType`，已修复
     - `insurance-xiaohongshu.md`: JSON 输出格式自相矛盾（result 字段要求），统一为完整 JSON 对象
     - `XiaohongshuPreview.tsx`: useEffect 无限循环风险，改为内联函数 + cancelled 标志 + 依赖优化
   - **P2 修复**:
     - `judge-executor-response.ts`: Agent 名称映射缺少 `insurance-xiaohongshu`
     - `user-decision/route.ts`: EXECUTOR_CONFIG 缺少 `insurance-xiaohongshu`
     - `full-home/page.tsx`: executorOptions 硬编码只有 `insurance-d`
     - `chat/route.ts`: 类型断言 + Agent 名称映射缺少 `insurance-xiaohongshu`
   - **数据流修复**（5个关键路径）:
     - `split-publish/route.ts`: `insuranceDTask` → `writingTask`，支持两种写作 Agent
     - `check-split-status/route.ts`: `fromAgentId` 判断增加 `insurance-xiaohongshu`
     - `commands/send/route.ts`: 文章保存条件增加 `insurance-xiaohongshu`
     - `cron/auto-split-agent-tasks/route.ts`: 自动拆解路由增加 `insurance-xiaohongshu`
     - `draft-storage.ts`: 合规状态判断增加 `insurance-xiaohongshu`
   - **前端 Hook 修复**:
     - `use-split-actions.ts`: API 端点选择增加 `insurance-xiaohongshu`
     - `use-agent-split.ts`: 拆解通知 executor 判断增加 `insurance-xiaohongshu`
     - `use-split-notifications.ts`: 通知处理 executor 判断增加 `insurance-xiaohongshu`
     - `useSplitDialogs.ts`: executor 显示名称增加 `insurance-xiaohongshu`
   - **配置修复**:
     - `style-learning.config.ts`: getAgentConfig/getAgentArticlesPath 支持 `insurance-xiaohongshu`
     - `rag/agent-integration-example.ts`: 知识库路由增加 `insurance-xiaohongshu`
   - **顺带修复**:
     - `agent-roles-config.ts`: insurance-d 任务缺少 `responseExamples`（旧 bug）
32. **子任务标题污染修复**: 修复 syncArticleTitleToGroup 导致的标题覆盖问题
   - **问题**: `syncArticleTitleToGroup` 将文章标题（如"30万到期的真实纠结"）同步到同 commandResultId 的所有子任务，覆盖了"生成创作大纲"、"合规校验"等原始标题
   - **根因**: 上一个版本中 articleTitle 提取后会批量 UPDATE 同组所有子任务的 taskTitle
   - **修复**:
     - `subtask-execution-engine.ts`: 删除 `syncArticleTitleToGroup` 方法和调用，仅更新写作任务自身的 taskTitle
     - `backfill-task-titles/route.ts`: 删除同组同步逻辑
     - `/api/db/fix-polluted-task-titles`: 新增修复 API，恢复被覆盖的原始标题
     - 修复策略：从 taskDescription 提取简洁目标作为标题，写作类子任务保留文章标题
33. **统一输出信封格式（ArticleOutputEnvelope）**: 所有写作 Agent 输出格式统一，确保 result_text 字段正确填充
   - **问题**: insurance-d 的 result 是纯字符串（HTML），insurance-xiaohongshu 的 result 是 JSON 对象（含 fullText/points/tags），导致下游提取逻辑需要逐个适配，小红书合规校验缺失前序文章内容
   - **根因**: 消费端（extractResultTextFromResultData、command-result-service、article-content-service）从 resultData 提取文本时，只检查 content/articleContent 字段，不检查信封格式的 result.content，导致小红书输出无法正确写入 result_text
   - **统一信封格式**:
     ```json
     {
       "isCompleted": true,
       "result": {
         "content": "完整文章正文（公众号HTML/小红书纯文本）",
         "articleTitle": "文章标题（≤15字）",
         "platformData": { "platform": "wechat_official|xiaohongshu", ... }
       },
       "articleTitle": "文章标题（顶层冗余字段，兼容旧代码）"
     }
     ```
   - **改造文件**:
     - `insurance-d-v3.md`: result 从纯字符串改为信封格式 { content, articleTitle, platformData }
     - `insurance-xiaohongshu.md`: 已在上个版本改为信封格式，无需改动
     - `subtask-execution-engine.ts`: extractResultTextFromResultData() 重写，最高优先级读取 executorOutput.result.content，写入 result_text 字段
     - `command-result-service.ts`: triggerComplianceCheck() 内容提取增加信封格式支持和 result_text 兜底
     - `article-content-service.ts`: extractArticleFromHistory() 和 getArticleContent() 增加 result.content 信封格式提取
     - `agent-task.ts`: triggerComplianceCheck() 增加信封格式解析
     - `xiaohongshu-preview.tsx`: parseXhsContent() 支持信封格式，复制/渲染兼容 content 和 fullText
   - **设计原则**:
     - result_text 是统一的消费端字段：前序步骤传递、合规校验、文章保存全部通过 result_text 获取内容
     - extractResultTextFromResultData 是唯一写入 result_text 的入口，只要它能正确解析，下游全部畅通
     - 新增平台时，只要 Agent 输出信封格式，下游零改动
34. **多平台架构改造（配置驱动）**: 将硬编码的写作 Agent 判断改为配置驱动，新增知乎/头条平台支持
   - **核心文件**: `src/lib/agents/agent-registry.ts`（新建）
     - WRITING_AGENTS 常量：所有写作 Agent ID 列表（insurance-d / insurance-xiaohongshu / insurance-zhihu / insurance-toutiao）
     - PLATFORM_EXECUTOR_MAP：平台→执行 Agent 映射（wechat_official→insurance-d, xiaohongshu→insurance-xiaohongshu, zhihu→insurance-zhihu, douyin→insurance-toutiao, weibo→insurance-toutiao）
     - isWritingAgent()：统一判断函数，替代散落在 18+ 文件中的硬编码
     - getExecutorForPlatform() / getPlatformForExecutor()：平台↔Agent 双向映射
     - WRITING_AGENT_INFO：前端 UI 渲染信息
   - **新增 Agent**: insurance-zhihu（知乎创作专家）、insurance-toutiao（头条创作专家）
     - 提示词文件：insurance-zhihu.md / insurance-toutiao.md（信封格式输出）
     - 6 个配置文件注册：agent-types.ts / agent-roles-config.ts / websocket-auth.ts / prompt-loader.ts / agent-builder.ts / executor-identity-config.ts
   - **流程模板**: flow-templates.ts 新增知乎和头条/抖音默认流程模板
   - **平台路由**: simple-split/route.ts 的 getExecutorForPlatform() 改为使用 PLATFORM_EXECUTOR_MAP
   - **硬编码替换**: 18+ 文件中的 `=== 'insurance-d' || === 'insurance-xiaohongshu'` 全部替换为 isWritingAgent()
   - **前端适配**:
     - agent-task-list-normal.tsx: AGENT_CONFIG_MAP 新增知乎/头条、executorOptions 更新、已完成任务按钮分支
     - full-home/page.tsx: agentOptions 新增知乎/头条
     - agents/[id]/page.tsx: 显示名称映射、通知过滤、执行者判断全面适配
     - user-decision/route.ts: EXECUTOR_CONFIG 新增知乎/头条
     - chat/route.ts: agent 名称映射新增知乎/头条
     - ai-split/route.ts: 可用 Agent 列表新增知乎/头条
     - compliance-check.ts: executorLabelMap 支持 4 种写作 Agent
     - judge-executor-response.ts: agentNames 新增知乎/头条
     - draft-storage.ts: AGENT_DRAFT_DIRS 新增知乎/头条目录
   - **设计原则**:
     - 新增平台 Agent 时只需在 agent-registry.ts 添加配置 + 创建提示词文件
     - 下游所有 isWritingAgent() / WRITING_AGENTS 判断自动生效
     - 信封格式确保下游零改动
   - **TypeScript 编译**: 零新增错误，所有新代码通过类型检查
35. **评审修复（多平台架构改造补全）**: 根据技术专家评审报告修复 P1/P2 问题
   - **P1-1**: simple-split/route.ts 本地 `getExecutorForPlatform` 与导入函数重名 → 重命名为 `resolveExecutorForPlatform`，内部委托给导入的 `getExecutorForPlatform`
   - **P1-2**: 前端 6 处硬编码数组 `['insurance-d', ...]` → 统一使用 `WRITING_AGENT_IDS` 常量
     - 新增 `WRITING_AGENT_IDS: string[]` 常量（从 WRITING_AGENTS 展开，支持 .includes()）
     - agent-task-list-normal.tsx / agents/[id]/page.tsx 共 6 处替换
   - **P2-1**: `getExecutorForPlatform` / `getPlatformForExecutor` 新增未知平台日志告警（console.warn）
   - **P2-2**: `WRITING_AGENT_INFO` 类型从 `Record<string, ...>` 收紧为 `Record<WritingAgentId, ...>`
   - **P2-3**: flow-templates.ts PLATFORM_FLOW_MAP 补充 `weibo: TOUTIAO_FLOW_TEMPLATE` 映射
36. **P1 问题修复（PromptAssemblerService 补全）**: 根据代码评审发现的严重问题修复
   - **P1-1**: `prompt-assembler-service.ts` PROMPT_FILE_MAP 缺少 insurance-zhihu/toutiao 映射 → 补充 4 个平台的完整映射
   - **P1-2**: agentLabel 硬编码逻辑（只区分小红书和公众号）→ 改为动态推导 `const agentLabel = options.executorType || DEFAULT_EXECUTOR_TYPE`
   - **P2-1**: relatedMaterials 提示词硬编码 "insurance-d" → 统一使用动态 agentLabel
37. **大纲确认流程修复**: 修复 order_index=3 无法获取前序大纲结果的问题
   - **问题根因**:
     - `user-decision` API 查找全文子任务时，检查 `metadata->>'subTaskRole' = 'full_article'`，但实际存储在 `resultData` 中
     - 判断大纲任务时，检查 `metadata.subTaskRole`，但实际存储在 `resultData` 中
     - `subtask-execution-engine.ts` 读取 `confirmedOutline` 时，从顶层字段读取，但实际存储在 `metadata.confirmedOutline` 或 `userOpinion` 中
   - **修复**:
     - `user-decision/route.ts`:
       - 同时检查 `metadata` 和 `resultData` 中的 `subTaskRole`
       - 增加任务标题匹配作为兜底（`taskTitle.includes('大纲')`）
       - 使用 `or` 组合多个查询条件
       - 如果第一种方式找不到，直接通过 `orderIndex + 1` 查找下一个任务
     - `subtask-execution-engine.ts`:
       - 从多级数据源读取 `confirmedOutline`：`metadata.confirmedOutline > userOpinion > 顶层字段`
       - 修复 `isFullArticleTask` 判断：优先使用 `resultData.subTaskRole`，再检查任务标题（`taskTitle.includes('根据确认大纲生成全文')`）
   - **设计原则**:
     - 存储位置不一致是历史遗留问题，修复采用多级数据源兜底策略
     - 任务标题匹配作为最后的兜底，确保即使 metadata/resultData 都没有正确字段也能工作
38. **交互历史 Agent 执行者显示错误修复**: 修复 step_history 中 `interact_user = 'T'` 显示为"头条创作专家"而非"技术专家"的问题
   - **问题根因**: `findAgentConfig()` 使用包含匹配，`'insurance-toutiao'.includes('t')` = true（'t' 在 'toutiao' 中）
   - **影响**: 当数据库存储 `interact_user = 'T'` 时，前端错误显示为"头条创作专家"
   - **修复** (`agent-task-list-normal.tsx`):
     - 新增 `EXACT_ALIAS_MAP` 精确别名映射：`'t' → 'agent t'`、`'b' → 'agent b'` 等
     - 优先使用精确别名映射，避免包含匹配的副作用
     - 修改包含匹配逻辑：使用 `isWholeWordMatch()` 确保作为独立单词匹配
     - 包含匹配按 configKey 长度降序排序，避免短 key 误匹配
   - **验证**: `'T'` 现在正确映射到"技术专家"
39. **result_text 字段修复**: 修复写作任务完成后 result_text 为空的问题
   - **问题**: `agent_sub_tasks.result_text` 为空，导致前序任务结果无法传递给后续任务
   - **根因**: `structuredResult.resultContent` 是 JSON 字符串 `{"content": "..."}`，而 `extractResultTextFromResultData` 未解析 JSON
   - **修复**:
     - `extractResultTextFromResultData`: 新增 JSON 解析逻辑，正确提取 `resultContent.content` 字段
     - 新增 `/api/db/fix-result-text` API: 批量修复现有数据的 `result_text` 字段
     - 手动执行 SQL 批量更新: 从 `result_data.executorOutput.structuredResult.resultContent` 提取内容
40. **Agent T 前序任务结果获取修复**: 修复合规校验无法获取前序文章内容的问题
   - **问题**: order_index = 4（合规校验）说"需要获取合规校验所需的文章内容"
   - **根因**: Agent T 只在 `isReExecution` 时才调用 `PrecedentInfoExtractor`，首次执行不获取前序结果
   - **修复**:
     - Agent T 执行时无论是否重新执行，都调用 `PrecedentInfoExtractor.extractPreviousTaskResults()`
     - 将前序任务结果格式化后注入到 `initialExecutionContext.priorStepOutput`
     - `callAgentTTechExpert` 方法会将 `priorStepOutput` 注入到 Agent T 提示词中
41. **代码评审修复（P1/P2 问题）**: 根据技术专家评审报告修复发现的问题
   - **P1-1**: `extractResultTextFromResultData` 新增数组情况处理
     - 当 `resultContent` 是数组时，遍历查找第一个有 `content` 字段的元素
     - 同时处理 JSON 字符串解析和对象两种情况
   - **P1-2**: 创建数据库复合索引优化查询性能
     - 新增 `idx_agent_sub_tasks_cmd_order` 索引：`(command_result_id, order_index)`
     - 新增 `/api/db/create-subtasks-index` 迁移 API
     - 优化 `PrecedentInfoExtractor.extractPreviousTaskResults` 查询性能
   - **P2-1**: `findAgentConfig` 正则表达式性能优化
     - 新增 `regexCache` 缓存编译后的正则表达式
     - 避免循环中重复创建 `RegExp` 对象
   - **P2-2**: `user-decision` 大纲确认逻辑简化
     - 移除冗余的 `or` 条件查询
     - 直接使用 `orderIndex + 1` 查询（利用复合索引）
   - **P2-3**: Agent T 执行流程边界情况处理
     - 当 `currentTaskHistoryText` 为空时输出警告日志
     - 避免覆盖 `priorStepOutput` 原有内容
42. **大纲确认流程优化 + 结构模式传递修复**: 实现用户跳过确认直接执行 + 结构信息正确继承
   - **问题 A**: order_index=3（全文任务）无法获取前序大纲内容，需要用户手动确认才能执行
   - **问题 B**: 大纲确认双子任务（order_index=2/3）没有继承原任务的 `structureName` 和 `structureDetail`
   - **根因 A**: `_confirmedOutline` 的获取逻辑不完整，没有从前序任务的 `result_text` 自动提取
   - **根因 B**: `splitForOutlineConfirmationIfNeeded` 方法创建双子任务时未继承结构字段
   - **修复（统一前序内容提取）**:
     - `buildExecutionContext()`: 新增 `extractedOutline` 字段，统一从前序任务提取大纲
     - 提取优先级：`metadata.confirmedOutline` > `task.userOpinion` > 前序大纲任务 `result_text`
     - 支持 JSON 格式的大纲解析（`{"outlineText": "内容"}`）
     - 调用方直接使用 `_execCtx.extractedOutline`，避免重复提取
   - **修复（结构模式继承）**:
     - `splitForOutlineConfirmationIfNeeded()`: 双子任务创建时继承 `structureName` 和 `structureDetail`
     - `assemblePrompt()`: 使用 `task.structureName` 和 `task.structureDetail`（schema 已定义字段）
   - **新增 API**:
     - `/api/db/fix-outline-structure`: 修复现有双子任务的结构信息
   - **设计原则**:
     - 用户可跳过大纲确认，系统自动从前序任务获取大纲内容
43. **文章初稿预览修改节点**: 在写作完成和合规校验之间增加用户预览修改节点
   - **设计思路**: 使用"虚拟执行器"模式，`user_preview_edit` 不是真实 Agent（不调用 LLM），而是用户交互暂停点
   - **流程变更**: 5步 → 6步（分析 → 撰写 → 👤预览修改 → 合规校验 → 运营 → 审核）
   - **核心文件**:
     - `src/lib/agents/flow-templates.ts`: 4个平台模板均新增 `user_preview_edit` 节点（orderIndex=3）
       - 新增 `USER_PREVIEW_EDIT_EXECUTOR` 常量和 `isVirtualExecutor()` 判断函数
       - 新增预览节点样式（wechat_preview/xiaohongshu_preview/zhihu_preview/toutiao_preview）
     - `src/lib/services/subtask-execution-engine.ts`:
       - `executeStepTasks()`: 识别虚拟执行器，跳过 LLM 调用
       - `executeVirtualExecutorTask()`: 虚拟执行器统一入口
       - `executeUserPreviewEditTask()`: 获取前序写作任务文章 → 设为 waiting_user
       - `markTaskWaitingUser()`: 新增 `overrideResultData` 参数，支持注入自定义数据
     - `src/app/api/agents/preview-article/route.ts`: 新增预览文章 API（GET 获取文章内容）
     - `src/app/api/agents/user-decision/route.ts`: 新增 `preview_edit_article` 决策类型
       - 支持 skip（跳过修改）和 save（保存修改）两种操作
       - 修改后内容存入本节点 `result_text`（不修改前序写作任务，保持不可变性）
       - 下游合规校验通过 `priorStepOutput` 自然获取本节点的最终版本
     - `src/components/article-preview-editor.tsx`: 前端预览编辑组件
       - 支持4种平台：微信(HTML预览)、小红书(图文卡片预览+字段编辑)、知乎(文本)、头条(文本)
       - `ArticlePreviewEditor`: 主组件（预览/编辑切换、跳过/保存操作）
       - `PreviewEditSection`: 封装组件（含决策提交逻辑）
     - `src/components/agent-task-list-normal.tsx`: 任务列表渲染
       - AGENT_CONFIG_MAP 新增 `user_preview_edit` 配置
       - waiting_user 状态下渲染 PreviewEditSection（非通用文本框）
       - completed 状态下渲染"已确认文章内容"标识
       - 新增 `submitPreviewEditDecision()` 提交决策方法
     - `src/app/api/agents/b/simple-split/route.ts`: metadata 新增 `platform` 字段（供虚拟执行器确定平台）
   - **数据流**:
     ```
     写作Agent完成 → result_text 存储 HTML/JSON
       → user_preview_edit 节点: 从前序任务获取文章 → waiting_user
         → 用户跳过 → result_text = 原文 → 合规校验读取原文
         → 用户修改 → result_text = 修改后版本 → 合规校验读取修改版
     ```
   - **设计原则**:
     - 虚拟执行器不注册为完整 Agent（不需 websocket-auth/agent-builder/prompt-loader 等配置）
     - 前序写作任务的 `result_text` 不可变，修改内容存入本节点
     - 扩展新虚拟执行器只需在 `isVirtualExecutor` 和 `executeVirtualExecutorTask` 中添加
44. **预览修改节点评审修复**: 根据代码评审发现的问题进行严谨修复
   - **P0-1 修复**: `submitPreviewEditDecision` 中 `commandResultId` 显式传入，不再依赖 `taskDetail/selectedTask` 状态
     - `PreviewEditSection` 新增 `commandResultId` 参数
     - `submitPreviewEditDecision` 签名更新为 `(taskId, commandResultId, result)`
   - **P0-2 修复**: `preview-article` API 增加 `workspaceId` 隔离验证
     - 查询时增加 `eq(agentSubTasks.workspaceId, workspaceId)` 条件
   - **P1-1 修复**: `user_preview_edit` 处于 `failed` 状态时也显示预览编辑器
     - 条件从 `status === 'waiting_user'` 改为 `status === 'waiting_user' || status === 'failed'`
   - **P1-2 修复**: `isWritingAgent` 查找增加 `status === 'completed'` 过滤
     - 优先匹配已完成的写作任务，兜底匹配任意写作任务
   - **P2-1 修复**: `previewResult` 提取为 `PreviewEditResultData` 类型定义
     - 新增类型接口，提高代码可读性和类型安全性
   - **P2-2 修复**: `ArticlePreviewEditor` useEffect 增加 `AbortController`
     - 处理竞态条件，避免更新已卸载组件的 state
     - 结构模式（微信7段/小红书5卡片）正确传递给大纲和全文任务
45. **写作 Agent 身份与使命强化**: 解决执行 Agent 因身份不明确导致拒绝任务的问题
   - **问题现象**: order_index=3 任务（根据确认大纲生成全文）执行时，insurance-xiaohongshu 返回 `isTaskDown=false`，认为"不是自己的任务"
   - **根因分析**: 提示词缺少明确的身份声明和任务接受规则，LLM 在边界情况判断不确定
   - **修复方案**: 为写作 Agent 新增"第零部分：身份与使命"章节
     - `insurance-xiaohongshu.md` v1.1: 强化小红书图文专家身份，明确任务接受关键词
     - `insurance-d-v3.md` v3.1: 强化公众号长文专家身份，明确任务接受关键词
   - **核心内容**:
     - 明确身份：系统唯一授权的 XX 平台内容创作执行者
     - 明确使命：所有 XX 平台的保险内容创作任务都由你完成
     - 任务类型表格：全文创作/大纲生成/文章修改 → 输出格式
     - 擅长领域：保险科普/测评/理赔案例/避坑指南/投保攻略
     - 任务接受原则：看到关键词立即执行，第一反应是"这是我的任务"
   - **设计原则**: 正面强化身份和任务，不使用"禁止拒绝"等负面表述
46. **大纲确认拆分防重复修复**: 解决用户调整拆分指令后触发重复拆分的问题
   - **问题现象**: 公众号任务出现重复的"生成创作大纲"和"根据确认大纲生成全文"节点
   - **根因分析**: `splitForOutlineConfirmationIfNeeded` 未检查同组是否已存在大纲任务，导致重复拆分
   - **修复方案**: 在拆分前检查同组是否存在标题包含"大纲"的任务，已存在则跳过
   - **修复代码**:
     ```typescript
     // 检查同组是否已存在大纲相关任务（防止重复拆分）
     const existingOutlineTasks = await db
       .select({ id: agentSubTasks.id, taskTitle: agentSubTasks.taskTitle })
       .from(agentSubTasks)
       .where(
         and(
           eq(agentSubTasks.commandResultId, task.commandResultId as any),
           or(
             sql`${agentSubTasks.taskTitle} LIKE '%大纲%'`,
             sql`${agentSubTasks.taskTitle} LIKE '%outline%'`
           )
         )
       );
     if (existingOutlineTasks.length > 0) {
       return false; // 跳过拆分
     }
     ```
   - **数据清理**: 删除了重复的 order_index=4,5 任务和 order_index=9000,9001 任务
47. **result_text 提取逻辑修复**: 支持公众号 HTML 格式
   - **问题现象**: 合规校验任务无法获取前序文章内容，导致无法执行
   - **根因分析**: `extractFromResultContent` 方法只检查 `content` 和 `outlineText`，未处理 `htmlContent` 字段
   - **数据结构差异**:
     - 小红书：`resultContent.content` 或 `resultContent.fullText`
     - 公众号：`resultContent.htmlContent`
   - **修复方案**: 在 `extractFromResultContent` 中新增 `htmlContent` 字段检查
   - **数据修复**: 手动更新公众号写作任务的 `result_text`，从 `result_data.executorOutput.structuredResult.resultContent.htmlContent` 提取
48. **result_text 提取服务重构（P1 代码评审修复）**:
   - **问题 1**: executionSummary 是对象而非字符串，路径 7 永远无法提取内容
   - **问题 2**: 代码重复严重，`extractResultTextFromResultData` 在两处有 200+ 行重复代码
   - **修复方案**:
     - 新增 `src/lib/services/result-text-extractor.ts` 共享服务
     - 路径 7 新增对象类型处理：提取 `executionSummary.actionsTaken` 数组
     - 引擎和 API 均使用共享服务，消除代码重复
   - **验证结果**:
     - Agent B 任务 result_text 从 briefResponse（50字）改为 reasoning（104字）
49. **result_text 通用提取架构升级（平台配置驱动 + 动态发现兜底）**:
   - **问题**: 提取逻辑硬编码字段检查序列，新增平台时需逐个适配，遗漏导致内容丢失
   - **架构设计**:
     - `agent-registry.ts` 新增 `PLATFORM_CONTENT_FIELDS` 映射表：每个平台的 executor → 主内容字段映射
     - `agent-registry.ts` 新增 `getPlatformContentField()` 函数：根据 executor 查询配置
     - `result-text-extractor.ts` 重构 `extractFromResultContentObject()` 为三层提取策略
   - **三层提取策略**:
     1. **平台优先**: 根据 executor → 查注册表 → 优先提取该平台的主内容字段
     2. **通用扫描**: 遍历所有已知内容字段（articleHtml/htmlContent/content/fullText 等），取第一个有效值
     3. **动态发现**: 遍历对象所有字符串字段，排除非内容字段后取最长的
   - **executor 参数传递**: 
     - `extractResultTextFromResultData(resultData, { executor })` 新增 executor 选项
     - `subtask-execution-engine.ts`: 5 处调用均传入 `task.fromParentsExecutor`
     - `precedent-info-extractor.ts`: 委托给共享服务，传入 `task.fromParentsExecutor`
     - `precedent-info-fetcher.ts`: 委托给共享服务，传入 `task.fromParentsExecutor`
     - `fix-all-result-text/route.ts`: 传入 `task.executor`
     - `fix-article-html/route.ts`: 传入 `'insurance-d'`
   - **新增平台只需**: 在 `PLATFORM_CONTENT_FIELDS` 添加一条配置，提取逻辑零改动
   - **消除重复代码**: `precedent-info-extractor.ts` 和 `precedent-info-fetcher.ts` 的独立提取逻辑替换为共享服务调用
     - 所有已完成任务 result_text 覆盖率 100%
50. **result_text 提取 P0 问题修复（技术评审修复）**:
   - **P0-1 问题**: 动态发现最小长度阈值（50字）与第一二层（>0）不一致
     - 可能导致边界情况：内容长度 1-49 字时被所有层级跳过
   - **P0-2 问题**: 第一层平台优先只检查 `> 0`，可能返回单字符
     - 对于文章正文来说不合理
   - **修复方案**:
     - 统一最小长度阈值为 **10 字**（`MIN_CONTENT_LENGTH = 10`）
     - 第一层、第二层、第三层（动态发现）全部使用 `>= MIN_CONTENT_LENGTH`
     - 与 `isValidContentText` 函数保持一致
   - **修复文件**: `src/lib/services/result-text-extractor.ts`
51. **创作流程执行者修改 + 数据库连接统一**:
   - **公众号流程修改**:
     - 合规校验：执行者从 `insurance-d` 改为 `T`（技术专家）
     - 上传草稿箱：执行者从 `insurance-d` 改为 `T`（技术专家）
     - 原因：合规校验和技术上传是技术操作，应由技术专家完成
   - **小红书流程修改**:
     - 完成合规整改：执行者从 `T` 改为 `insurance-xiaohongshu`（小红书创作专家）
     - 原因：合规整改是创作纠正，应由内容创作专家完成
   - **数据库连接统一**:
     - 问题：项目代码使用 `PGDATABASE_URL` 环境变量，db.sh 脚本使用硬编码连接字符串
     - 影响：两边连接不同的数据库，定时任务读取不到正确的数据
     - 修复：`src/lib/db/index.ts` 改为直接使用 db.sh 中的连接字符串
     - 移除对 `PGDATABASE_URL` 环境变量的依赖
   - **Next.js 配置修复**:
     - 问题：Next.js 检测到多个 lockfile（项目根目录和父目录）
     - 修复：`next.config.ts` 启用 `outputFileTracingRoot` 配置
   - **修复文件**:
     - `src/lib/agents/flow-templates.ts`: 修改 WECHAT_OFFICIAL_FLOW_TEMPLATE 和 XIAOHONGSHU_FLOW_TEMPLATE
     - `src/lib/db/index.ts`: 统一数据库连接
     - `next.config.ts`: 启用 outputFileTracingRoot
   - **验证结果**:
     - 定时任务执行成功，无数据库连接错误
     - 服务健康检查通过
52. **小红书卡片数量模式统一（cardCountMode）**:
   - **问题**: `imageCountMode` 和 `contentTemplate.cardCountMode` 是同一个概念，存在两套字段导致数据流混乱
   - **设计原则**: 统一数据结构，使用 `contentTemplateId` 作为唯一来源
   - **修复方案**:
     - 前端只传 `contentTemplateId`（内容模板ID）
     - 后端从内容模板推导 `cardCountMode`（3-card/5-card/7-card）
     - `PromptAssemblyOptions` 新增 `cardCountMode` 字段，兼容旧的 `imageCountMode`
   - **修复文件**:
     - `src/app/api/agents/b/simple-split/route.ts`: 从内容模板推导卡片数量模式
     - `src/lib/services/prompt-assembler-service.ts`: 参数重命名 + 兼容旧字段
     - `src/lib/services/subtask-execution-engine.ts`: 传递 `cardCountMode` 而非 `imageCountMode`
   - **数据流**:
     ```
     用户选择内容模板（如"5卡-详尽风"）
       → contentTemplateId 存入 metadata
         → 执行引擎从内容模板读取 cardCountMode
           → PromptAssemblerService 生成提示词（要求输出 3 个要点）
             → insurance-xiaohongshu 输出对应数量的 points
     ```
   - **效果**: 用户选择"5卡-详尽风"模板后，预览会正确显示 5 张图片（封面+3要点+结尾）
53. **添加步骤按钮无反应修复**:
   - **问题**: 点击"添加步骤"按钮后没有反应
   - **根因**: 
     - `addPlatformSubTask` 添加的新任务 `title` 是空字符串
     - `HorizontalFlowDiagram` 过滤掉了 `title.trim()` 为空的任务
   - **修复**:
     - 移除 `HorizontalFlowDiagram` 中的过滤逻辑，显示所有任务
     - `addPlatformSubTask` 新任务添加默认标题"新步骤"
     - 添加后自动选中新任务并打开编辑面板
   - **修复文件**:
     - `src/components/creation-guide/horizontal-flow-diagram.tsx`
     - `src/app/full-home/page.tsx`
54. **P0/P1 技术评审修复（cardCountMode 数据流完善）**:
   - **P0 问题**: 执行引擎未从内容模板读取 cardCountMode
     - **现象**: `subtask-execution-engine.ts` 只读取 `metadata.imageCountMode`，未从内容模板读取
     - **风险**: 其他入口创建任务时可能没有 `imageCountMode`，导致功能失效
     - **修复**: 提前读取内容模板，从模板获取 `cardCountMode`（优先级高于 metadata）
   - **P1 问题**: 类型断言不安全
     - **现象**: `contentTemplate.cardCountMode as '3-card' | '5-card' | '7-card'` 未校验值有效性
     - **风险**: 数据库存在非法值时会导致类型不安全
     - **修复**: 添加类型守卫 `VALID_CARD_COUNT_MODES.includes()` 确保只有有效值才能赋值
   - **修复文件**:
     - `src/lib/services/subtask-execution-engine.ts`: 提前读取内容模板，获取 cardCountMode 和 promptInstruction
     - `src/app/api/agents/b/simple-split/route.ts`: 添加类型守卫
   - **数据流完善**:
     ```
     执行引擎获取 cardCountMode:
       1. 优先从内容模板读取（符合"内容模板是唯一来源"原则）
       2. 兜底从 metadata.imageCountMode 读取（兼容旧数据）
       3. 类型守卫确保值有效（3-card/5-card/7-card）
     ```
55. **Agent B 职责定位修复**: 明确 Agent B 只负责判断任务完成，不纠正文章合规问题
   - **问题现象**: Agent B 收到合规校验结果后，如果发现文章存在合规问题，会拦截下来（返回 REEXECUTE_EXECUTOR）
   - **根因分析**: Agent B 的身份定位不清晰，误将"校验结果"当作"任务未完成"的依据
   - **设计原则**: 
     - Agent B 的职责是判断"当前任务是否完成"，合规整改交给下一个节点
     - 校验结果是信息性参考，记录在 reviewComment 中传递给下一个节点
     - 合规问题的整改由流程中的下一个节点处理（如合规整改任务）
   - **修复方案**: 修改 Agent B 提示词中的校验结果解读规则（使用正面表述）
     - 执行 Agent 说完成了（isTaskDown=true）→ 检查 selfEvaluation 是否与声明一致
     - 一致：返回 COMPLETE，校验结果记录在 reviewComment 中
     - 不一致：返回 NEED_USER，让用户介入处理
     - 校验结果是 fail 也返回 COMPLETE，整改由下一个节点处理
   - **修复文件**:
     - `src/lib/agents/prompts/agent-b-business-controller.ts`: 重写校验结果解读规则
56. **小红书预览卡片数量修复**: 修复预览修改节点只显示一张图片的问题
   - **问题现象**: 小红书预览修改节点只显示一张图片，而非按内容模板显示多张卡片
   - **根因分析**: 
     - 虚拟执行器（user_preview_edit）从写作任务获取内容时，只获取了 `resultText`（纯文本正文）
     - 纯文本正文不包含 `points` 数组
     - 前端预览组件解析后 `points` 为空数组，导致只显示封面卡
   - **修复方案**: 
     - 对于小红书平台，虚拟执行器传递完整的 `resultData`（JSON对象）
     - 前端预览组件可以正确解析 `platformData.points` 数组
     - 卡片数量 = 封面卡(1) + 要点卡(points.length) + 结尾卡(1)
   - **数据流修复**:
     ```
     写作任务输出：
       resultData = { isCompleted, result: { content, articleTitle, platformData: { points: [...] } } }
     
     虚拟执行器获取：
       旧逻辑: articleContent = resultText（纯文本正文，无 points）
       新逻辑: articleContent = resultData（完整 JSON，含 points）
     
     前端预览组件解析：
       parseXhsContent(resultData) → { points: [...], ... }
       渲染：封面卡 + points.length 个要点卡 + 结尾卡
     ```
   - **修复文件**:
     - `src/lib/services/subtask-execution-engine.ts`: 虚拟执行器对小红书传递完整 resultData

57. **小红书卡片图片持久化存储**: 实现卡片图片上传到对象存储，支持永久访问
   - **问题**: 卡片图片使用 Base64 编码传输，占用带宽且无法持久化访问
   - **设计原则**:
     - 持久化存储 key（永久有效），而非 URL（有过期时间）
     - 使用时动态生成签名 URL（有效期 7 天）
     - 文件名规范：`xhs-cards/{subTaskId}/{cardIndex}.png`
   - **数据库表**:
     - `xhs_cards`: 存储每张卡片的元信息和对象存储 key
     - `xhs_card_groups`: 存储一次生成任务产生的一组卡片
   - **新增文件**:
     - `src/lib/db/schema/xhs-cards.ts`: 数据库表 Schema
     - `src/lib/services/xhs-storage-service.ts`: 对象存储服务封装
     - `src/app/api/db/create-xhs-cards-table/route.ts`: 数据库迁移 API
   - **API 改造** (`src/app/api/xiaohongshu/generate-cards/route.ts`):
     - 新增 `persist` 参数：是否持久化存储（默认 false）
     - 新增 `subTaskId` 参数：子任务 ID（持久化时必需）
     - 新增 `cardCountMode` 参数：卡片数量模式（3-card/5-card/7-card）
     - 持久化模式返回：`groupId`、`cardId`、`storageKey`、`url`
   - **GET 接口**: 支持 `?subTaskId=xxx` 查询已持久化的卡片 URL
   - **验证结果**:
     - POST 生成卡片并持久化成功
     - GET 查询已持久化的卡片 URL 成功
     - 图片可通过签名 URL 正常访问

58. **Agent B JSON 解析修复**: 修复贪婪正则匹配导致解析失败的问题
   - **问题现象**: 
     - `JSON 解析失败: Unexpected token '微', position: 4`
     - 解析器尝试解析 `[微信公众号] 依据合...` 这样的非 JSON 内容
   - **根因分析**: 
     - `extractGenericJsonString` 方法中的正则 `/(\[[\s\S]*\])/` 过于贪婪
     - 会匹配任何以 `[` 开头的文本，包括 `[微信公众号]`、`[小红书]` 等平台标签
     - 这些平台标签来自 `buildPlatformContextPrefix` 函数生成的平台上下文前缀
   - **修复方案**:
     - 移除贪婪的数组匹配正则 `/(\[[\s\S]*\])/`
     - 新增 `extractJsonArrayWithStackMatching` 方法，使用栈匹配精确提取 JSON 数组
     - 验证数组内容必须以有效的 JSON 元素开头（`{`、`"`、`[`、数字、`true/false/null`）
   - **警告优化**:
     - 将 "JSON 字符串已标准化处理" 改为具体操作说明
     - 例如 "JSON 标准化: 移除注释, 移除尾随逗号, 压缩空白"
   - **修复文件**:
     - `src/lib/utils/json-parser-enhancer.ts`: 移除贪婪正则，新增栈匹配方法

59. **合规整改职责明确化**: 明确合规整改是写作 Agent 的职责，而非 Agent T 的职责
   - **问题**: order_index=4（合规校验）发现问题后，整改任务应交给写作 Agent，而非 Agent T
   - **微信公众号流程模板修改** (`src/lib/agents/flow-templates.ts`):
     - 新增 order_index=5 "完成合规整改" 节点，执行者为 insurance-d
     - 原来的 order_index=5 "上传公众号草稿箱" 改为 order_index=6
     - 流程变为：分析→撰写→预览修改→合规校验→**合规整改**→上传
   - **Agent B 提示词修改** (`src/lib/agents/prompts/agent-b-business-controller.ts`):
     - 新增"合规整改职责划分"核心规则
     - 明确：合规校验=Agent T 职责，合规整改=写作 Agent 职责
     - 当 order_index=4 发现问题后，order_index=5 必须交给写作 Agent
   - **insurance-d 提示词修改** (`src/lib/agents/prompts/insurance-d-v3.md`):
     - 任务类型表格新增"合规整改"类型
     - 明确合规整改是 insurance-d 的专属职责
     - 新增整改任务的接受原则和执行步骤

60. **小红书预览卡片翻页功能**: 支持左右滑动切换多张卡片
   - **功能**:
     - 左右滑动翻页查看不同卡片
     - 底部页码指示器（小圆点）
     - 左右箭头按钮切换
     - 页码文字显示（如 1/5）
   - **卡片布局**:
     - 第0页：封面卡
     - 第1~N页：要点卡片（N = points.length）
     - 最后一页：结尾卡（如有 conclusion）
   - **交互方式**:
     - 触摸滑动：左滑下一张，右滑上一张
     - 点击按钮：左右箭头切换
     - 点击指示器：跳转到指定页
   - **修改文件**:
     - `src/components/xiaohongshu-preview.tsx`: 新增翻页状态和交互逻辑
61. **小红书预览卡片高度优化**: 提升卡片展示高度，更接近小红书原生卡片比例
   - **问题**: 卡片最小高度 200px 偏短，正文区域 128px 过于局限
   - **修复方案**:
     - 卡片高度：从 `min-h-[200px]` 增加到 `min-h-[280px]`（提升 40%）
     - 正文区域：从 `max-h-32`（128px）改为 `max-h-40`（160px）
     - 新增展开/收起功能：超过 150 字符时显示"展开全文"按钮
     - 动画过渡：使用 `transition-all duration-300` 实现平滑展开
   - **修改文件**:
     - `src/components/xiaohongshu-preview.tsx`: 卡片高度 + 正文展开/收起
   - **效果**: 卡片展示更饱满，正文阅读体验更佳
62. **Agent B 合规校验结果处理修复（彻底修复）**: 明确区分"MCP 调用失败"和"审核错误"
   - **问题**: Agent B 把"合规校验MCP返回审核错误"当成执行失败，导致决策错误
   - **根因分析**:
     1. **提示词混淆**：提示词中混淆了"MCP 调用失败"和"审核未通过"两个概念
     2. **🔴 关键问题**：`generateMcpNaturalLanguage` 方法把业务失败（审核未通过）错误标记为"❌ MCP 执行失败"！
   - **修复内容**:
     - **修复1：MCP 自然语言描述生成**（关键！）:
       - 修改 `generateMcpNaturalLanguage` 方法
       - 审核未通过：从"❌ MCP 执行失败"改为"✅ MCP 调用成功，审核结果: 未通过"
       - 技术性失败：保持"❌ MCP 技术执行失败（需重试）"
       - 新增 `getBusinessResultDescription` 方法处理业务结果描述
     - **修复2：Agent B 提示词**:
       - 新增"核心区分：MCP 调用状态 vs MCP 返回结果"章节
       - 新增"合规校验任务的特殊处理"章节
       - 新增"合规整改任务的特殊处理"章节
       - 修复示例：MCP 调用失败 → REEXECUTE_EXECUTOR
       - 修复示例：MCP 调用成功 + 审核未通过 → COMPLETE
   - **修改文件**:
     - `src/lib/services/subtask-execution-engine.ts`: `generateMcpNaturalLanguage` 方法重构
     - `src/lib/agents/prompts/agent-b-business-controller.ts`: 提示词修复
   - **效果**:
     - 合规校验 MCP 技术性失败 → Agent T 重试
     - 合规校验发现审核问题 → 完成校验，流转到整改节点

