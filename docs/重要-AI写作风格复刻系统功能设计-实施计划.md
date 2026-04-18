# AI 写作风格复刻系统 — 分阶段实施计划（Phase 3-5）

> **编制日期**：2026-02-24
> **基于版本**：需求文档 v2.0 + Phase 1/2 已完成代码
> **编制原则**：每项任务可独立验收、依赖关系明确、风险前置识别

---

## 一、现状基线

### 1.1 已完成资产

| 模块 | 核心文件 | 关键能力 |
|------|----------|----------|
| 创作引导 UI | `src/components/creation-guide/*` (8个文件) | Context+Reducer状态管理、4种结构模板、防抖保存、核心锚点输入(30~600字)、情感基调4种、素材关联 |
| 提示词动态拼接 | `insurance-d-v3.md` + `prompt-assembler-service.ts` + `digital-asset-service.ts` | 固定基础提示词(4934字符)、单次assemblePrompt调用、动态规则格式化、素材查询(真实DB) |
| 执行引擎接入 | `subtask-execution-engine.ts`(L6173-6336) | insurance-d检测→PromptAssemblerService→结果复用、InsuranceDTaskExtension类型安全 |
| 提示词组装 API | `/api/prompt-assembler/route.ts` | GET预览(元数据)、POST组装(含完整校验) |
| 素材库 CRUD | `/api/materials/*` + `material-library.ts` Schema | 6类素材、3维标签、使用记录、推荐接口 |

### 1.2 现有数据库表

| 表名 | Schema 文件 | 用途 | 状态 |
|------|-------------|------|------|
| `daily_task` | `correct-schema.ts` | 主任务表 | ✅ 在用 |
| `agent_sub_tasks` | `correct-schema.ts` | 子任务表(orderIndex顺序执行) | ✅ 在用 |
| `agent_sub_tasks_step_history` | schema文件 | 执行历史记录 | ✅ 在用 |
| `agent_sub_tasks_mcp_executions` | schema文件 | MCP执行记录(含合规校验) | ✅ 在用 |
| `material_library` | `material-library.ts` | 素材库(6类型+3维标签) | ✅ 在用 |
| `material_usage_log` | `material-library.ts` | 素材使用记录 | ✅ 在用 |

### 1.3 关键架构约束

1. **执行引擎是单次调用模式**：`executeAgent()` 方法对 insurance-d 只调用一次，一次性返回完整文章。大纲确认需要改造为双子任务(2a+2b)
2. **orderIndex 是严格递增的**：子任务按 orderIndex=1,2,3... 顺序执行，前序完成后才执行后续。双子任务需要支持非整数索引(2a/2b)或小数(2.1/2.2)
3. **Agent B 决策是中枢**：每个子任务完成后都经过 Agent B 决策(COMPLETE/NEED_USER/REEXECUTE等)。2a完成后需让 Agent B 输出 NEED_USER
4. **用户决策 API 已有基础**：`/api/agents/user-decision` 支持 waiting_user 状态接收决策，已有"指令已完成"选项
5. **DigitalAssetService 框架就绪**：`getUserExclusiveRules()`/`getStyleRules()`/`getSampleArticles()` 均返回空数组，等待建表后接入真实数据

---

## 二、Phase 3：数字资产建表 + 大纲确认 + 规则接入

**目标**：建立数字资产的物理存储层，打通"用户规则→提示词拼接→insurance-d"的数据链路，实现大纲确认交互。

**预估规模**：新增 ~2500 行代码，修改 ~800 行现有代码，新建 3 张数据库表。

### 3.1 任务分解

#### 任务 3.1 [P0] 数据库表创建 — core_anchor_assets + style_assets + feedback_assets

**技术方案**：
- 使用 Drizzle ORM 定义 Schema（与现有 `material-library.ts` 风格一致）
- 创建迁移 API 端点 `/api/db/create-digital-assets`（复用现有 `/api/db/create-material-library` 模式）

**新建文件**：

```
src/lib/db/schema/digital-assets.ts    # 3张新表的 Drizzle Schema 定义
```

**Schema 设计细节**：

```typescript
// === 1. 核心锚点资产表 ===
export const coreAnchorAssets = pgTable('core_anchor_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id'),                          // 多用户扩展预留
  sourceTaskId: text('source_task_id'),             // 来源子任务ID
  anchorType: text('anchor_type').notNull(),        // 'opening_case' | 'core_viewpoint' | 'ending_conclusion'
  rawContent: text('raw_content').notNull(),         // 原始内容文本
  extractedKeywords: jsonb('extracted_keywords').$type<string[]>().default([]), // NLP提取关键词
  usageCount: integer('usage_count').notNull().default(0),
  isEffective: boolean('is_effective').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// === 2. 风格规则资产表 ===
export const styleAssets = pgTable('style_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleType: text('rule_type').notNull(),             // 'tone' | 'vocabulary' | 'logic' | 'emotion'
  ruleContent: text('rule_content').notNull(),       // 规则具体内容
  ruleCategory: text('rule_category').notNull(),      // 'positive'(正向要求) | 'negative'(禁止项)
  sampleExtract: text('sample_extract'),              // 来源样本摘录
  confidence: numeric('confidence').default(0.5),     // 置信度 0-1
  sourceType: text('source_type').notNull().default('manual'), // 'manual' | 'auto_nlp' | 'feedback'
  isActive: boolean('is_active').notNull().default(true),
  priority: integer('priority').notNull().default(2), // 1=最高, 2=高, 3=中
  userId: text('user_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// === 3. 反馈迭代资产表 ===
export const feedbackAssets = pgTable('feedback_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceArticleId: text('source_article_id'),         // 关联文章ID
  feedbackType: text('feedback_type').notNull(),      // 'content' | 'style' | 'structure' | 'overall'
  feedbackRaw: text('feedback_raw').notNull(),         // 用户原始反馈
  extractedRuleType: text('extracted_rule_type'),     // 提取的规则类型
  extractedRuleContent: text('extracted_rule_content'),// 提取的规则内容
  isValidated: boolean('is_validated').notNull().default(false),
  validityExpiresAt: timestamp('validity_expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

**迁移 API**：

```
GET /api/db/create-digital-assets
  → 依次 CREATE TABLE IF NOT EXISTS (core_anchor_assets, style_assets, feedback_assets)
  → 返回 { success: true, createdTables: [...] }
```

**验收标准**：
- [ ] 调用迁移 API 后，3 张表在 PostgreSQL 中可见
- [ ] Drizzle 类型推断正确（`$inferSelect` / `$inferInsert` 可用）
- [ ] 索引合理（userId + ruleType + isActive 组合索引）

**风险点**：
- ⚠️ ENUM 类型在 Drizzle 中需用 `.asEnum()` 或直接用 text + 约束（建议 text + 应用层校验，更灵活）
- ⚠️ 如果生产环境无 DDL 权限，需改为手动 SQL 脚本

---

#### 任务 3.2 [P0] DigitalAssetService 接入真实数据源

**技术方案**：将 `digital-asset-service.ts` 中返回空数组的方法改造为真实 DB 查询

**修改文件**：

```
src/lib/services/digital-asset-service.ts   # 改造 3 个方法
```

**具体改动**：

| 方法 | 当前实现 | 目标实现 | 数据来源 |
|------|----------|----------|----------|
| `getUserExclusiveRules()` | `return []` | 查询 `style_assets` + `feedback_assets`，按 ruleType 映射到 5 类 UserExclusiveRule | style_assets(ruleCategory='positive') + feedback_assets(isValidated=true) |
| `getStyleRules()` | `return []` | 查询 `style_assets` WHERE isActive=true，映射到 StyleRule 接口 | style_assets |
| `getSampleArticles()` | `return []` | MVP 阶段仍返回空数组（sample_articles 表暂不建，Phase 4 再补） | 保留空返回 + TODO 注释 |

**getUserExclusiveRules 实现逻辑**：

```typescript
async getUserExclusiveRules(userId?: string): Promise<UserExclusiveRule[]> {
  // 1. 从 style_assets 查询正向风格规则 → 映射为 high_frequency_word / structure_supplement / material_habit
  const styleRules = await db.select().from(styleAssets)
    .where(and(eq(styleAssets.isActive, true), eq(styleAssets.ruleCategory, 'positive')))
    .orderBy(styleAssets.priority)
    .limit(20); // 提示词长度控制：最多20条
  
  // 2. 从 feedback_assets 查询已验证的反馈规则 → 映射为 forbidden_supplement / core_stance
  const feedbackRules = await db.select().from(feedbackAssets)
    .where(and(
      eq(feedbackAssets.isValidated, true),
      or(
        isNull(feedbackAssets.validityExpiresAt),
        gte(feedbackAssets.validityExpiresAt, new Date())
      )
    ))
    .limit(10);
  
  // 3. 合并去重，按优先级排序，映射为 UserExclusiveRule[]
  return this.mapToUserExclusiveRules([...styleRules, ...feedbackRules]);
}
```

**验收标准**：
- [ ] `getUserExclusiveRules()` 返回 style_assets 中的真实数据（插入测试数据后验证）
- [ ] `getStyleRules()` 返回 style_assets 中的真实数据
- [ ] 规则数量超限时按 priority 截断低优先级（≤20条）
- [ ] 过期规则自动过滤（validityExpiresAt < NOW() 的不返回）
- [ ] TS 零错误

**风险点**：
- ⚠️ 5 类 ruleType 与 style_assets 的 4 类 ruleType 存在映射关系，需维护清晰的映射表
- ⚠️ 首次使用时表为空，行为应与当前一致（返回空数组 + "暂无规则"占位文本），不能报错

---

#### 任务 3.3 [P1] 大纲确认双子任务改造（方案 A 核心）

**这是 Phase 3 最复杂的架构级改动**，涉及执行引擎的核心流程变更。

**技术方案概述**：
- Agent B 拆解"保险文案创作"任务时，自动生成 2a(生成大纲) + 2b(生成全文) 两个子任务
- 2a 完成后，Agent B 决策输出 NEED_USER，触发用户确认交互
- 用户确认后，2b 获得已确认的大纲内容作为额外上下文，生成全文

**修改文件清单**：

| 文件 | 改动类型 | 改动说明 |
|------|----------|----------|
| `src/lib/services/subtask-execution-engine.ts` | 修改 | 子任务拆分逻辑：检测 insurance-d 任务时拆为 2a+2b |
| `src/lib/services/subtask-execution-engine.ts` | 修改 | executeAgent：2b 时传入 confirmedOutline 参数 |
| `src/lib/services/prompt-assembler-service.ts` | 修改 | PromptAssemblyOptions 新增 confirmedOutline 字段 |
| `src/lib/agents/prompts/insurance-d-v3.md` | 修改 | 新增"大纲确认模式"提示词段落 |
| `src/app/api/agents/user-decision/route.ts` | 修改 | 新增"确认大纲"选项 + 大纲修改意见传递 |
| `src/lib/types/agent-execution-result.ts` | 可能修改 | ExecutorAgentResult 新增 outlineOutput 字段 |

**详细设计**：

##### 3.3.1 子任务拆分改造

位置：`subtask-execution-engine.ts` 的 `autoSplitOrExecute()` 或 `processSplitTask()` 方法

**改造前**（当前）：
```
Agent B 拆解 → orderIndex=2 "撰写保险文案文章" (单个子任务)
```

**改造后**：
```
Agent B 拆解 → orderIndex=2 "撰写保险文案文章" (父任务, status=completed)
                ├─ orderIndex=2.1 "生成创作大纲" (子任务A, executor=insurance-d)
                └─ orderIndex=2.2 "根据确认大纲生成全文" (子任务B, executor=insurance-d)
```

**关键实现细节**：

```typescript
// 在 autoSplitOrExecute() 中检测 insurance-d 创作任务
const isInsuranceDCreationTask = task.taskDescription?.includes('保险') 
  && task.fromParentsExecutor === 'insurance-d';

if (isInsuranceDCreationTask && !task.metadata?.isSplitForOutlineConfirm) {
  // 拆分为 2.1 + 2.2
  await this.splitIntoOutlineSubtasks(task);
  return; // 原任务标记 completed，不再直接执行
}

// splitIntoOutlineSubtasks 实现
private async splitIntoOutlineSubtasks(parentTask) {
  // 1. 原任务搬到 orderIndex=1000（保留历史记录）
  await db.update(agentSubTasks).set({ 
    orderIndex: 1000, status: 'completed',
    metadata: { ...(parentTask.metadata || {}), isSplitForOutlineConfirm: true }
  }).where(eq(agentSubTasks.id, parentTask.id));
  
  // 2. 创建 2.1: 生成大纲
  await db.insert(agentSubTasks).values({
    commandResultId: parentTask.commandResultId,
    fromParentsExecutor: 'insurance-d',
    taskTitle: '生成创作大纲',
    taskDescription: `根据以下创作需求生成大纲：${parentTask.taskDescription}`,
    orderIndex: 2.1,  // 使用小数表示子步骤
    status: 'pending',
    metadata: { parentTaskId: parentTask.id, subTaskRole: 'outline_generation' }
  });
  
  // 3. 创建 2.2: 生成全文（初始状态为 pending，但需等 2.1 完成+用户确认后才可执行）
  await db.insert(agentSubTasks).values({
    commandResultId: parentTask.commandResultId,
    fromParentsExecutor: 'insurance-d',
    taskTitle: '根据确认大纲生成全文',
    taskDescription: parentTask.taskDescription,
    orderIndex: 2.2,
    status: 'pending',  // 将由用户决策 API 激活
    metadata: { parentTaskId: parentTask.id, subTaskRole: 'full_article', dependsOn: '2.1' }
  });
}
```

##### 3.3.2 2a 完成后的处理流程

```
2.1 (生成大纲) 执行完成
  → insurance-d 返回 isCompleted=true, result 包含 outlineText
  → Agent B 审查 → 输出 NEED_USER (reason: awaiting_outline_confirmation)
  → 2.1 状态变为 waiting_user
  → 前端展示大纲内容 + 确认/修改按钮
```

**Agent B 提示词补充**（在 `agent-b-business-controller.ts` 中追加）：

```
[🔴🔴🔴 大纲确认规则（新增）🔴🔴🔴]
当检测到子任务 metadata.subTaskRole === 'outline_generation' 且 insurance-d 返回 isCompleted=true 时：
  → 必须返回 NEED_USER
  → notCompletedReason = "awaiting_outline_confirmation"
  → context.outlineContent = 执行结果的 outlineText（传递给前端展示）
```

##### 3.3.3 用户确认后的 2b 触发

**用户决策 API 扩展** (`/api/agents/user-decision/route.ts`)：

```typescript
// POST body 新增字段
{
  subTaskId: "2.1的ID",
  decisionType: "outline_confirmed",  // 新增选项
  outlineFeedback: "用户对大纲的修改意见（可选）",
  confirmedOutline: "用户确认后的大纲文本（可能被修改过）"
}

// 处理逻辑：
// 1. 记录用户决策到 step_history
// 2. 将 confirmedOutline 写入 2.2 的 metadata.confirmedOutline
// 3. 将 2.2 状态从 pending 改为 pending（激活）
// 4. 定时任务会自动拾取 2.2 执行
```

##### 3.3.4 2b 执行时的提示词增强

**PromptAssemblyOptions 扩展**：

```typescript
interface PromptAssemblyOptions {
  // ... 现有字段 ...
  confirmedOutline?: string;  // 新增：用户确认的大纲内容
}

// formatCurrentTask() 中新增：
if (options.confirmedOutline) {
  result += `### 已确认的创作大纲（必须严格按照此大纲展开写作）\n\n`;
  result += `${options.confirmedOutline}\n\n`;
}
```

**insurance-d-v3.md 补充**（在第三部分创作流程中追加）：

```markdown
##### 【大纲确认模式（当提供已确认大纲时）】

当系统提供了「已确认的创作大纲」时：
1. 必须严格以大纲为骨架展开写作，不得偏离大纲的结构和核心论点
2. 大纲中规划的素材使用位置必须遵守
3. 如果用户在大纲确认阶段提出了修改意见，必须在全文中体现这些修改
4. 大纲是用户确认过的，具有最高优先级（等同于核心锚点级别）
```

**验收标准**：
- [ ] insurance-d 创作任务自动拆分为 2.1 + 2.2
- [ ] 2.1 执行后 insurance-d 输出大纲文本（而非全文）
- [ ] Agent B 对 2.1 自动输出 NEED_USER（无需人工干预）
- [ ] 用户可通过 API 提交"确认大纲"/"修改意见"
- [ ] 2.2 执行时能获取到用户确认的大纲内容
- [ ] 2.2 生成的全文与大纲结构一致
- [ ] 非 insurance-d 任务不受影响（向后兼容）

**风险点**（高）：
- 🔴 **orderIndex 小数兼容性**：现有执行引擎的 `groupTasks()` 和 `selectTargetOrderIndex()` 使用整数排序逻辑，需验证小数(2.1/2.2)是否正确排序在 2 和 3 之间
- 🔴 **2.2 的激活机制**：当前引擎只拾取 pending 状态的最小 orderIndex 任务。2.2 需要在 2.1 完成且用户确认后才变为可执行。可能需要引入新状态（如 `waiting_dependency`）或在 metadata 中加锁
- 🟡 **Agent B 提示词膨胀**：大纲确认规则会增加提示词长度，需评估是否影响决策质量
- 🟡 **回退路径**：如果用户对 2.2 的全文不满意，是否允许回到 2.1 重新生成大纲？这涉及子任务状态回滚

**缓解措施**：
- orderIndex 方案备选：不用小数，改用 `2a`/`2b` 字符串（需改造排序逻辑），或者用连续整数（原 2 变成 2 和 3，后续顺延）。**推荐先用小数快速验证，如果有排序问题再改方案**
- 2.2 激活：在用户决策 API 中显式将 2.2 设为 `pending`，同时设置 metadata.outlineConfirmedAt 时间戳。引擎在拾取 2.2 时检查此时间戳是否存在

---

#### 任务 3.4 [P2] 数字资产管理 UI（MVP 版本）

**目标**：提供一个最小可行的管理界面，用于查看和维护数字资产

**新建文件**：

```
src/app/digital-assets/page.tsx                    # 数字资产管理页面
src/app/api/digital-assets/route.ts                 # 资产列表 API
src/app/api/digital-assets/[id]/route.ts            # 单个资产 CRUD API
```

**功能范围（MVP）**：

| 功能 | 说明 | Phase |
|------|------|-------|
| 风格规则列表 | 查看 style_assets 所有记录，支持按 ruleType/isActive 筛选 | Phase 3 |
| 风格规则手工录入 | 新增/编辑/禁用风格规则（sourceType='manual'） | Phase 3 |
| 核心锚点历史 | 查看 core_anchor_assets 历史记录 | Phase 3 |
| 反馈记录 | 查看 feedback_assets 记录 | Phase 3 |
| 规则效果统计 | 每条规则的使用次数、最近使用时间 | Phase 4 |
| 自动提取规则展示 | 从反馈中自动提取的规则（待审核队列） | Phase 4 |

**验收标准**：
- [ ] 页面可访问 `/digital-assets`
- [ ] 风格规则支持 CRUD 操作
- [ ] 列表支持分页和筛选
- [ ] TS 零错误

---

#### 任务 3.5 [P2] 核心锚点自动归档

**目标**：每次 insurance-d 执行完成后，自动将 userOpinion/coreAnchorData 归档到 core_anchor_assets

**修改文件**：

```
src/lib/services/subtask-execution-engine.ts   # 在 markTaskCompleted 或 executeAgent 结束处增加归档逻辑
```

**实现逻辑**：

```typescript
// 在 insurance-d 任务完成时触发
private async archiveCoreAnchors(task, executionContext): Promise<void> {
  const extension = task as InsuranceDTaskExtension;
  
  if (extension.userOpinion || extension.structureName) {
    // 归档核心观点
    if (extension.userOpinion) {
      await db.insert(coreAnchorAssets).values({
        sourceTaskId: task.id,
        anchorType: 'core_viewpoint',
        rawContent: extension.userOpinion,
        usageCount: 0,
        isEffective: true,
      }).onConflictDoNothing(); // 避免重复归档
    }
    
    // 后续可在 metadata 中解析 openingCase / endingConclusion 并分别归档
  }
}
```

**验收标准**：
- [ ] insurance-d 任务完成后，core_anchor_assets 中出现对应记录
- [ ] 重复执行不产生重复记录（幂等性）
- [ ] 归档失败不影响主流程（try-catch 包裹）

---

### 3.2 Phase 3 任务依赖图

```
3.1 建表(core_anchor_assets + style_assets + feedback_assets)
  │
  ├──→ 3.2 DigitalAssetService 接入真实数据
  │       │
  │       └──→ 3.5 核心锚点自动归档（依赖 DigitalAssetService 写入能力）
  │
  ├──→ 3.3 大纲确认双子任务改造（依赖 3.1 建表存储大纲数据）
  │       │
  │       └──→ 3.4 数字资产管理 UI（依赖 3.3 的数据流跑通）
  │
  └──→ 3.4 数字资产管理 UI（可直接基于 3.1 建表做 CRUD）
```

**建议执行顺序**：3.1 → 3.2 → 3.5 → 3.3 → 3.4

（3.4 和 3.3 可并行开发前端部分，但 3.4 的完整功能依赖 3.3 的数据流）

---

## 三、Phase 4：自动沉淀 + 校验升级

**目标**：实现"越用越像用户"的核心机制——从定稿文章和用户反馈中自动提取风格规则；建立可量化的校验体系。

**预估规模**：新增 ~2000 行代码，新建 1 个服务类 + 1 个定时任务 + 1 个校验服务。

### 4.1 任务分解

#### 任务 4.1 [P0] 用词习惯沉淀服务（纯规则）

**技术方案**：新建 `StyleDepositionService`，实现基于统计学的用词分析

**新建文件**：

```
src/lib/services/style-deposition-service.ts    # 风格沉淀核心服务
```

**能力矩阵**：

| 能力 | 技术路径 | 依赖 | 复杂度 |
|------|----------|------|--------|
| 高频词统计 | jieba/node-jieba 分词 + 词频计数 + 停用词过滤 | node-jieba 包 | 中 |
| 禁用词维护 | 正则匹配否定句式 + 黑名单写入 | 无外部依赖 | 低 |
| 句式习惯统计 | 正则匹配反问句/短句 + 比例计算 | 无外部依赖 | 低 |
| 核心立场聚类 | LLM 辅助（轻量模型） | LLM 调用能力 | 高（可延后） |

**高频词统计实现**：

```typescript
async extractHighFrequencyWords(articleTexts: string[]): Promise<StyleAssetInsert[]> {
  // 1. 合并最近50篇定稿文章
  const fullText = articleTexts.join('\n');
  
  // 2. jieba 分词
  const words = jieba.cut(fullText);
  
  // 3. 词频统计
  const freqMap = new Map<string, number>();
  for (const word of words) {
    if (word.length >= 2 && !STOP_WORDS.has(word)) {
      freqMap.set(word, (freqMap.get(word) || 0) + 1);
    }
  }
  
  // 4. 取 Top 30
  const top30 = [...freqMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  
  // 5. 与通用高频词表做差集 → 用户专属高频词
  const userUniqueWords = top30.filter(([word]) => !COMMON_WORDS.has(word));
  
  // 6. 写入 style_assets
  return userUniqueWords.map(([word, count]) => ({
    ruleType: 'vocabulary',
    ruleContent: `高频使用词汇：「${word}」`,
    ruleCategory: 'positive',
    sourceType: 'auto_nlp',
    confidence: Math.min(count / articleTexts.length, 1),
  }));
}
```

**验收标准**：
- [ ] 输入 10 篇样本文本后，能输出高频词列表
- [ ] 结果写入 style_assets 表（ruleType='vocabulary', sourceType='auto_nlp'）
- [ ] 通用停用词过滤生效（不含"的/了/是/在"等）

**风险点**：
- ⚠️ node-jieba 在 Node.js 22+ 的兼容性（需验证）
- ⚠️ 中文分词性能：50篇文章合并分词可能在较大内存占用
- 缓解：可限制每次分析的文本总量（如最近 20 篇）

---

#### 任务 4.2 [P0] 校验服务实现（4 类校验规则）

**技术方案**：新建 `ArticleValidationService`，实现需求文档 5.1 定义的 4 类校验

**新建文件**：

```
src/lib/services/article-validation-service.ts   # 文章校验服务
```

**校验规则实现**：

| 校验维度 | 判定方法 | 通过阈值 | 实现复杂度 |
|----------|----------|----------|-----------|
| 核心锚点完整性 | 文本相似度（关键词重叠率 + LCS） | ≥ 0.85 | 中 |
| 结构完整性 | 段落标题序列匹配 + 编辑距离 | 全模块出现 | 低 |
| 素材使用率 | 素材片段在输出中出现次数 / 总素材数 | ≥ 60% | 中 |
| 风格合规 | 禁用词正则 + 绝对化词汇 + 口吻检查 + 段落长度 | 零违规/警告 | 低 |

**核心接口设计**：

```typescript
interface ValidationResult {
  overall: 'pass' | 'warn' | 'fail';
  scores: {
    anchorIntegrity: { score: number; threshold: number; details: string };
    structureCompleteness: { score: number; passed: boolean; details: string };
    materialUsage: { usedCount: number; totalCount: number; rate: number };
    styleCompliance: { violations: Violation[]; severity: 'clean' | 'warning' | 'error' };
  };
  summary: string;  // 给 Agent B 的汇总描述
  rewriteSuggestions?: string[];  // 不通过时的修改建议
}

class ArticleValidationService {
  async validate(articleHtml: string, options: ValidationOptions): Promise<ValidationResult>
}
```

**验收标准**：
- [ ] 输入一篇包含核心锚点的文章，anchorIntegrity score ≥ 0.85 时返回 pass
- [ ] 输入缺少某结构模块的文章，structureCompleteness 返回 fail + 具体缺失模块名
- [ ] 输入包含"最/第一/100%"的文章，styleCompliance 检测出违规
- [ ] 校验耗时 < 500ms（不应成为性能瓶颈）

**风险点**：
- ⚠️ 文本相似度算法选择：BLEU 需要额外包，关键词重叠率更简单但精度较低。**MVP 建议用关键词重叠率 + LCS 长度比组合**
- ⚠️ HTML 标签干扰：insurance-d 输出的是 HTML 格式，校验前需先 strip tags

---

#### 任务 4.3 [P1] 校验集成到 Agent B 决策流程

**目标**：Agent B 在评审 insurance-d 输出时，自动调用校验服务获得量化依据

**修改文件**：

```
src/lib/agents/prompts/agent-b-business-controller.ts   # 补充校验结果解读规则
src/lib/services/subtask-execution-engine.ts             # 在 Agent B 评审前调用校验服务
```

**集成点**：在 `executeAgent()` 的阶段 4（Agent B 评审）之前，调用 `ArticleValidationService.validate()`，将校验结果注入 Agent B 的上下文

```typescript
// 在构建 Agent B 的 userPrompt 前
if (isInsuranceD && executorResult.resultData?.articleContent) {
  const validation = await articleValidationService.validate(
    executorResult.resultData.articleContent,
    {
      coreAnchorData: { openingCase, coreViewpoint, endingConclusion },
      structureName: (task as InsuranceDTaskExtension).structureName,
      materials: userOpinionAndMaterials?.materials,
    }
  );
  
  // 将校验结果注入 Agent B 上下文
  agentBContext.validationResult = validation;
}
```

**Agent B 提示词补充**：

```
[🔴🔴🔴 校验结果解读规则（新增）🔴🔴🔴]
当你收到 validationResult 时，按以下规则决策：
  - overall='pass' → 可以考虑 COMPLETE（结合其他因素）
  - overall='warn' → 标记警告但可放行，在 reviewComment 中说明
  - overall='fail' → 必须返回 REEXECUTE_EXECUTOR，附上 rewriteSuggestions
  - 任一核心维度(anchorIntegrity/structureCompleteness) < 阈值 → 必须 fail
```

**验收标准**：
- [ ] Agent B 决策日志中包含校验分数
- [ ] 校验 fail 时 Agent B 输出 REEXECUTE_EXECUTOR（而非 COMPLETE）
- [ ] 校验 warn 时 Agent B 输出 COMPLETE 但 reviewComment 中包含警告说明

---

#### 任务 4.4 [P2] 定时聚合任务

**目标**：每日凌晨自动执行全量词频重算和规则权重调整

**新建/修改文件**：

```
src/lib/cron/deposition-cron.ts          # 定时任务（复用现有 cron 架构）
```

**执行逻辑**：

```
每日 02:00 触发:
  1. 查询最近 50 篇已定稿文章（status=completed + executor=insurance-d）
  2. 调用 StyleDepositionService.extractHighFrequencyWords()
  3. 与现有 style_assets 记录合并且去重
  4. 更新权重（usageCount + 最近7天使用频率）
  5. 过期规则降权（validityExpiresAt < NOW() 的 isActive=false）
```

**验收标准**：
- [ ] 定时任务可手动触发（API 或脚本）
- [ ] 执行后有日志输出（处理了多少篇文章、提取了多少新规则）
- [ ] 不影响正在执行的写作任务（后台低优先级运行）

---

### 4.2 Phase 4 任务依赖图

```
4.1 用词习惯沉淀服务（StyleDepositionService）
  │
  ├──→ 4.4 定时聚合任务（依赖 4.1 的沉淀能力）
  │
4.2 校验服务（ArticleValidationService）
  │
  └──→ 4.3 校验集成到 Agent B（依赖 4.2 的校验能力）
```

**建议执行顺序**：4.2 → 4.3 → 4.1 → 4.4

（4.2 校验服务是独立模块，可先行；4.1 沉淀服务也独立，可与 4.2 并行）

---

## 四、Phase 5：完整闭环 + 风格相似度

**目标**：实现完整的"写作→校验→沉淀→优化"闭环，引入 LLM 辅助能力和向量嵌入。

**预估规模**：新增 ~1500 行代码，涉及 LLM 调用集成和向量数据库评估。

### 5.1 任务分解

#### 任务 5.1 [P1] LLM 辅助规则提取

**目标**：对于纯规则难以处理的场景（情绪分类、修改意图理解、核心立场聚类），引入 LLM 辅助

**技术方案**：在 `StyleDepositionService` 中新增 LLM 辅助方法

**新增能力**：

| 能力 | LLM Prompt 要点 | 输入 | 输出 |
|------|-----------------|------|------|
| 情绪分类 | "分析这段文字的情绪基调，从[共情/理性/警示/温情]中选择" | 文章全文 | emotion tag + confidence |
| 修改意图理解 | "用户的这条反馈想表达什么修改意图？提炼为一条风格规则" | 用户反馈原文 | ruleType + ruleContent |
| 核心立场聚类 | "从以下历史观点中提炼反复出现的 3-5 个立场主题" | 最近20条 userOpinion | stance summary list |
| 样本风格特征提取 | "分析这篇文章的风格特征：语气、句式、用词习惯" | 标杆样本全文 | structured style profile |

**实现约束**：
- 使用轻量/便宜模型（不需要 GPT-4 级别）
- 结果必须经人工确认后才激活（isValidated=false → 人工审核 → true）
- 单次 LLM 调用超时 30 秒

**验收标准**：
- [ ] 输入用户反馈"不要用太多专业术语"，能提取出 ruleType='forbidden_supplement', ruleContent='减少专业术语使用'
- [ ] 输入 10 条历史观点，能聚类出 2-3 个立场主题
- [ ] LLM 调用失败时不阻塞主流程（降级为跳过该条规则提取）

---

#### 任务 5.2 [P2] 向量嵌入 + 相似度搜索评估

**目标**：评估向量嵌入在风格相似度计算中的可行性

**技术方案**：
- 利用已有的 embedding skill（`/skills/public/prod/embedding`）
- 对标杆样本文章生成向量嵌入，存储 vectorId 到 sample_articles/core_anchor_assets
- 新文章生成后，计算与标杆样本的余弦相似度

**前置问题需先回答**：
1. 是否已部署向量数据库（pgvector 扩展或独立 Milvus/Qdrant）？
2. embedding 模型的 token 限制和成本？
3. 相似度阈值设定多少算"风格一致"？

**建议**：Phase 5 先做 PoC（概念验证），不投入大量工程量：
- 选 3-5 篇标杆文章生成 embedding
- 手动计算相似度看效果
- 如果效果好再建设完整的向量检索管道

**验收标准（PoC 级别）**：
- [ ] 能对给定文本生成 embedding 向量
- [ ] 能计算两篇文本的余弦相似度
- [ ] 输出相似度评分报告（供决策参考）

---

#### 任务 5.3 [P2] 完整闭环端到端测试

**目标**：编写完整的端到端测试用例，覆盖"用户输入→大纲→全文→校验→沉淀"全链路

**测试场景**：

| # | 场景 | 预期结果 | 优先级 |
|---|------|----------|--------|
| E2E-1 | 正常流程：输入核心锚点→2a大纲→确认→2b全文→校验通过→沉淀 | 全链路畅通，数字资产增加 | P0 |
| E2E-2 | 大纲不满意：2a大纲→用户拒绝→重新生成2a→再次确认 | 大纲迭代不丢失数据 | P0 |
| E2E-3 | 全文不满意：2b全文→校验不通过→重写→通过 | 重写次数 ≤ 2 | P1 |
| E2E-4 | 用户反馈"太多术语"→反馈记录→自动提取禁用词规则 | feedback_assets + style_assets 同步更新 | P1 |
| E2E-5 | 连续写 5 篇文章→观察高频词变化 | style_assets 中 vocabulary 类规则逐渐丰富 | P2 |

---

### 5.2 Phase 5 任务依赖图

```
5.1 LLM 辅助规则提取（依赖 Phase 4 的 StyleDepositionService 框架）
  │
  ├──→ 5.2 向量嵌入 PoC（可独立进行）
  │
  └──→ 5.3 端到端测试（依赖 5.1 + 5.2 的全部能力就绪）
```

---

## 五、跨阶段关键风险与缓解措施

### 5.1 架构级风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **orderIndex 小数排序异常** | Phase 3 大纲确认功能完全不可用 | 中 | 先写单元测试验证排序逻辑；备选用字符串 '2a'/'2b' 方案 |
| **Agent B 提示词过长导致决策质量下降** | 错误的决策（该 NEED_USER 却 COMPLETE） | 低 | 监控 prompt 长度；必要时精简非核心规则 |
| **定时任务与在线任务资源竞争** | 写作任务变慢 | 低 | 定时任务设低优先级（CPU 限流）；凌晨执行避开高峰 |
| **jieba 分词 Node.js 22 兼容性** | Phase 4 沉淀服务启动失败 | 中 | 备选方案：用简单正则分词（按标点+中文字符切分），精度略低但可用 |
| **LLM 调用成本失控** | Phase 5 运营成本过高 | 中 | 设置日调用量上限；批量处理替代逐条调用 |

### 5.2 数据质量风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 初期无数字资产，动态规则为空 | 提示词退化为仅固定基础提示词（即当前行为） | 这是预期行为，不影响功能 |
| 用户录入低质量风格规则 | 提示词包含矛盾规则 | 规则冲突检测（Phase 5）；人工审核机制（isValidated 门控） |
| 自动提取的规则不准确 | 沉淀垃圾数据 | 置信度阈值（< 0.3 不写入）；90 天过期机制 |

---

## 六、里程碑与交付节奏建议

```
Week 1-2:  Phase 3.1 建表 + 3.2 DigitalAssetService 接入
           ↓ 可交付：数字资产物理层就绪，规则可手工录入并生效
           
Week 3-4:  Phase 3.3 大纲确认双子任务改造（核心攻坚）
           ↓ 可交付：用户可体验"先看大纲再写全文"的交互
           
Week 5:    Phase 3.4 管理 UI + 3.5 锚点归档
           ↓ 可交付：Phase 3 完整交付
           
Week 6-7:  Phase 4.2 校验服务 + 4.3 Agent B 集成
           ↓ 可交付：文章产出有量化质量分数
           
Week 8:    Phase 4.1 沉淀服务 + 4.4 定时任务
           ↓ 可交付：Phase 4 完整交付，系统开始"越用越聪明"
           
Week 9-10: Phase 5.1 LLM 辅助 + 5.3 E2E 测试
           ↓ 可交付：完整闭环运行
```

---

## 七、文件变更总览

### 新增文件清单

| 文件 | Phase | 行数估算 | 说明 |
|------|-------|----------|------|
| `src/lib/db/schema/digital-assets.ts` | 3 | ~120 | 3 张新表 Schema 定义 |
| `src/app/api/db/create-digital-assets/route.ts` | 3 | ~50 | 建表迁移 API |
| `src/lib/services/style-deposition-service.ts` | 4 | ~400 | 风格沉淀服务 |
| `src/lib/services/article-validation-service.ts` | 4 | ~350 | 文章校验服务 |
| `src/lib/cron/deposition-cron.ts` | 4 | ~100 | 定时聚合任务 |
| `src/app/digital-assets/page.tsx` | 3 | ~300 | 资产管理页面 |
| `src/app/api/digital-assets/route.ts` | 3 | ~150 | 资产列表 API |
| `src/app/api/digital-assets/[id]/route.ts` | 3 | ~120 | 资产 CRUD API |
| **合计新增** | | **~1590** | |

### 修改文件清单

| 文件 | Phase | 改动范围 | 说明 |
|------|-------|----------|------|
| `src/lib/services/digital-asset-service.ts` | 3 | 3 个方法重写 | 空数组→真实 DB 查询 |
| `src/lib/services/prompt-assembler-service.ts` | 3 | ~30 行新增 | confirmedOutline 字段支持 |
| `src/lib/services/subtask-execution-engine.ts` | 3+4 | ~200 行新增/修改 | 双子任务拆分 + 归档 + 校验集成 |
| `src/lib/agents/prompts/insurance-d-v3.md` | 3 | ~20 行新增 | 大纲确认模式提示词 |
| `src/lib/agents/prompts/agent-b-business-controller.ts` | 3+4 | ~30 行新增 | 大纲确认规则 + 校验解读规则 |
| `src/app/api/agents/user-decision/route.ts` | 3 | ~40 行新增 | 大纲确认选项 |
| `src/components/creation-guide/types.ts` | 3 | ~10 行新增 | confirmedOutline 相关类型 |
| **合计修改** | | **~330** | 7 个文件 |

---

*文档结束。以上计划基于需求文档 v2.0 和截至 2026-02-24 的代码现状制定。*
