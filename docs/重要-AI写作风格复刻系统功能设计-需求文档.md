# AI 写作风格复刻系统 — 功能设计需求文档（v2.0 修订版）

> **修订说明**：本文档基于 v1.0 原版，结合 Phase 1（创作引导 UI）和 Phase 2（提示词动态拼接系统）的实际实现成果，以及三轮代码评审的结论，进行系统性修订。
>
> **修订原则**：
> - 对齐实现：已完成的模块，文档描述与代码实现严格一致
> - 修复缺陷：解决原版中发现的 4 个结构性缺陷（D1-D4）和 13 个细节问题（d1-d13）
> - 明确边界：区分"已完成"、"进行中"、"待规划"三种状态
> - 技术可行：每项需求标注技术实现路径和前置依赖

---

## 一、核心理念与技术路线

### 1.1 核心目标

**不训练大模型、仅通过提示词动态拼接 + 本地知识沉淀，让 AI 越用越像用户。**

### 1.2 技术路线

```
用户输入（核心锚点/观点/素材/结构）
    ↓
PromptAssemblerService 动态拼接
    ↓
最终提示词 = 固定基础提示词(v3.md) + 用户专属动态规则(数字资产) + 本次创作需求
    ↓
insurance-d 执行 → 输出文章
    ↓
Agent B 校验 → 定稿 → 自动沉淀 → 更新数字资产
```

### 1.3 关键约束

| 约束 | 说明 |
|------|------|
| 不微调模型 | 所有能力通过提示词工程实现 |
| 不依赖外部服务 | 数字资产存储在本地 PostgreSQL |
| 渐进式增强 | 从空资产起步，越用越丰富 |
| 可校验性 | 每条铁律都有明确的通过/不通过判定标准 |

---

## 二、当前实现状态总览

### 2.1 已完成模块

| 模块 | 版本 | 文件 | 状态 |
|------|------|------|------|
| 创作引导 UI | Phase 1 | `src/components/creation-guide/*` | ✅ 已上线 |
| Context + Reducer 状态管理 | Phase 1 | `creation-guide-context.tsx` | ✅ 已上线 |
| 4种预设结构模板 | Phase 1 | `structure-templates.ts` | ✅ 已上线 |
| 防抖自动保存 | Phase 1 | `use-debounced-storage.ts` | ✅ 已上线 |
| 固定基础提示词 v3 | Phase 2 | `insurance-d-v3.md` | ✅ 已上线 |
| 数字资产管理服务 | Phase 2 | `digital-asset-service.ts` | ✅ 已上线（素材查询可用）|
| 提示词动态拼接服务 | Phase 2 | `prompt-assembler-service.ts` | ✅ 已上线 |
| 提示词组装 API | Phase 2 | `/api/prompt-assembler/route.ts` | ✅ 已上线 |
| 执行引擎接入 | Phase 2 | `subtask-execution-engine.ts` | ✅ 已上线 |
| 素材库 CRUD | 前置 | `src/app/api/materials/*` | ✅ 已上线 |

### 2.2 进行中 / 待规划

| 模块 | 阶段 | 状态 | 前置依赖 |
|------|------|------|----------|
| 大纲确认交互流程 | Phase 3 | 📋 待规划 | 需改造执行引擎子任务拆分逻辑 |
| 用户专属规则数据库表 | Phase 3 | 📋 待规划 | 需要 style_assets 等5张新表 |
| 风格资产自动沉淀 | Phase 4 | 📋 待规划 | 依赖 Phase 3 表结构 + NLP 能力评估 |
| 校验规则升级 | Phase 4 | 📋 待规划 | 依赖具体判定标准定义 |
| 完整闭环流程 | Phase 5 | 📋 待规划 | 依赖上述全部 |

---

## 三、功能详细设计

### 3.1 创作引导界面（Phase 1 ✅ 已完成）

#### 3.1.1 核心锚点输入区

**实现文件**: `core-anchor-input-optimized.tsx`
**状态**: ✅ 已完成并上线

**字段定义**：

| 字段 | 类型 | 字数限制 | 说明 |
|------|------|----------|------|
| 开篇核心案例段 | textarea | 30~600字 | 必须是真实人物+真实场景，带情绪冲突 |
| 全文核心观点段 | textarea | 20~400字 | 用户想让文章表达的核心立场/结论 |
| 结尾核心结论段 | textarea | 20~400字 | 文章最终的行动号召或总结 |

> **v2.0 修订**：原版限制为 150~300 字，实际使用中发现偏紧。已放宽为 30~600 / 20~400 的区间范围，并在前端做了实时字数统计和超限提示。

**安全处理**：
- HTML 实体编码（`&` 最先替换，防止双重编码）
- XSS 防护（前端 sanitize + 后端二次校验）
- 敏感词过滤（预留接口，可对接外部审核服务）

#### 3.1.2 情感基调选择

**实现文件**: `creation-controller.tsx`（EmotionToneSelector 组件）
**状态**: ✅ 已完成

**4 种预设基调**：

| 基调 | 值 | 适用场景 |
|------|-----|----------|
| 理性客观 | `rational` | 数据分析、政策解读类 |
| 踩坑警醒 | `warning` | 避坑指南、理赔纠纷类 |
| 温情共情 | `empathetic` | 故事分享、情感共鸣类 |
| 专业权威 | `professional` | 行业深度、专业科普类 |

**数据流**：`emotionTone` → `submitToServer()` → 组装为 `userOpinion` 的一部分 → 写入 `agent_sub_tasks.user_opinion` → 注入 insurance-d 提示词。

#### 3.1.3 素材关联区

**实现文件**: `material-provider.tsx`
**状态**: ✅ 已完成

**功能**：
- 从素材库搜索/筛选素材（支持关键词、类型、标签）
- AI 推荐素材（调用 `/api/materials/recommend`）
- 选中后显示在列表中，提交时以 `materialIds` 数组传给后端

**素材类型**（6种）：case / data / story / quote / opening / ending

#### 3.1.4 固定文章结构选择

**实现文件**: `structure-selector.tsx` + `structure-templates.ts`
**状态**: ✅ 已完成

> **v2.0 修订**：原版只描述了"7段固定结构"，但实际已实现 4 种预设模板：

| 结构 ID | 名称 | 段落数 | 总建议字数 | 适用场景 | 是否默认 |
|---------|------|--------|-----------|----------|---------|
| `user-default-7-section` | 用户专属7段结构 | 7 | 1800 | 保险科普（默认） | ✅ 默认 |
| `deep-analysis-8-section` | 深度分析型8段 | 8 | 2000 | 金融深度分析 | 可选 |
| `quick-read-5-section` | 快速阅读型5段 | 5 | 1100 | 手机端快速阅读 | 可选 |
| `story-driven-6-section` | 故事驱动型6段 | 6 | 1600 | 生活故事类 | 可选 |

**每个段落包含**：
- `id`: 唯一标识
- `name`: 段落名称
- `description`: 功能说明
- `suggestedWordCount`: 建议字数
- `requirements`: 具体要求清单（数组）

**推荐算法** (`recommendStructure`)：
- 文章类型优先于字数条件
- 保险类始终推荐 7 段结构
- 未指定类型时按字数降级推荐

#### 3.1.5 [📋 待规划] 大纲生成与确认交互

> **v2.0 重大修订**：此节为原版的结构性缺陷（D1），现重新设计以对齐现有执行引擎架构。

**问题背景**：
- 原版设计：insurance-d 先输出大纲 → 用户确认 → 再输出全文
- 现有架构：subtask-execution-engine 单次调用 insurance-d，一次性返回完整结果
- **两者存在结构性断层**

**修订方案（推荐方案A：双子任务模式）**：

将 insurance-d 的执行拆分为两个独立子任务，中间插入用户决策节点：

```
orderIndex=2a: "生成创作大纲"
  → insurance-d 输出大纲（含各段落核心内容、素材使用规划）
  → isCompleted=true, result 包含大纲文本
  → 触发 Agent B 决策 → NEED_USER（等待用户确认）
  
  ──── 用户交互节点 ────
  用户操作: 确认大纲 / 修改意见 / 要求重写
  
orderIndex=2b: "根据确认大纲生成全文"
  → insurance-d 收到确认后的大纲 + 用户修改意见
  → 输出完整 HTML 文章
  → isCompleted=true, result 包含文章内容
```

**需要改造的点**：
1. `Agent B 拆解逻辑`：当检测到任务类型为"保险文案创作"时，自动拆出 2a + 2b 两个子任务
2. `SubtaskExecutionEngine`：2a 完成后设置 status 为 `NEED_USER`，等待用户决策后再触发 2b
3. `用户决策 API`：新增"确认大纲"选项（已有"指令已完成"选项可复用）
4. `prompt-assembler-service`：2b 的组装参数需额外传入"已确认的大纲内容"

**备选方案B（单次调用内部分阶段）**：
- insurance-d 在一次调用中同时输出大纲和全文
- 大纲作为中间产物写入 MCP execution record
- 前端展示时先呈现大纲区域供用户查看，再展示全文
- **优点**：无需改执行引擎架构
- **缺点**：无法真正实现"用户修改大纲后再写全文"的交互

**建议**：Phase 3 采用方案 A，Phase 3 前先用方案 B 作为过渡。

---

### 3.2 提示词动态拼接系统（Phase 2 ✅ 已完成）

#### 3.2.1 固定基础提示词

**实现文件**: `src/lib/agents/prompts/insurance-d-v3.md`
**状态**: ✅ 已完成，精确对齐需求文档原文

**四大部分**：

**第一部分：固定基础提示词（不可修改，所有请求共享）**

##### 【一、核心铁律（绝对不可违反）】

1. 必须完整使用用户提供的：开篇核心案例段、全文核心观点段、结尾核心结论段，不得修改、替换、删减、反向解读，仅可对结尾结论做细节润色（不改变原意）。
2. 必须严格按照用户选定的固定文章结构，按顺序写作，不得跳步、调换结构顺序、删减结构模块，每个模块需贴合用户设定的功能要求。
3. 必须优先使用用户提供的关联素材和本篇关键素材，不编造数据、案例、保险条款，无依据的内容绝对禁止出现。
4. 禁止使用任何绝对化、营销类词汇（包括但不限于：最、第一、100%、保本、稳赚、绝对），禁止堆砌专业术语，所有专业内容需用大白话解读。

##### 【二、风格复刻基础要求】

1. 口吻：第一人称「我」，称呼用户为「你/咱们」，语气共情、亲切，像朋友掏心窝聊天，不端着、不偏激。
2. 排版：短句为主，每段1-3行，手机阅读无压力，避免大段文字堆砌。
3. 人设：站在消费者立场，不推荐任何具体保险产品，专业理性有温度，不制造焦虑、不夸大风险。
4. 篇幅：严格控制在用户设定的目标字数范围内，结构占比贴合用户习惯（案例30%+拆解40%+建议20%+互动合规10%）。

##### 【三、创作流程要求】

1. 先根据用户输入的核心锚点、素材、固定结构，生成创作大纲，等待用户确认后，再生成完整文章。
2. 大纲需清晰呈现：结构模块、每个模块的核心内容、素材使用规划，确保贴合用户核心思想。
3. 全文禁止使用通用AI套话，禁止偏离用户写作逻辑，禁止出现与用户风格不符的表述。

**第二部分：提示词拼接规则（系统自动执行）**

```
最终提示词 = 固定基础提示词（第一部分）
          + 用户专属动态规则（从数字资产提取，见 3.2.2）
          + 本次创作需求（核心锚点、素材、结构、目标字数）
```

**优先级矩阵**（v2.0 新增，修复 d6 缺失）：

| 优先级 | 来源 | 示例 | 冲突处理 |
|--------|------|------|----------|
| 🔴 P0 最高 | 用户专属动态规则中的"绝对服从类" | "禁止使用'您'" | 无条件覆盖基础提示词 |
| 🟡 P1 高 | 用户专属动态规则中的"风格补充类" | "多用反问句" | 与基础提示词叠加，不矛盾则共存 |
| 🟢 P2 中 | 创作流程要求 + 素材使用习惯 | "先大纲后全文" | 按流程执行 |
| ⚪ P3 低 | 补充建议 | "可适当增加互动" | 有余力时采纳 |

**第三部分：动态规则追加区域**

> 由 PromptAssemblerService 在运行时**追加**到固定基础提示词之后（不是字符串替换，而是顺序拼接）。

**第四部分：v2版本兼容内容**

> 从 insurance-d-v2.md 迁移而来，确保 v3 包含 v2 的全部功能：
> - 用户观点与素材注入机制
> - 写作风格强制约束（10项细则）
> - HTML 输出格式模板
> - 字数风格强制约束
> - Executor Output 标准格式

#### 3.2.2 用户专属动态规则（Phase 3 📋 待建表）

**实现文件**: `digital-asset-service.ts`（框架已就绪，数据源为空）
**状态**: ⚠️ 框架完成，等待数据库表创建

> **v2.0 修订**：原版直接给出了具体的规则示例内容（如"踩坑、门道..."），但这应该是**数据库中的动态数据**而非硬编码。以下为规则类型定义和示例格式。

**5 类动态规则**：

| 规则类型 | type值 | 说明 | 数据来源 | MVP可行？ |
|---------|--------|------|----------|-----------|
| 用户高频用词 | `high_frequency_word` | 需高频使用的词汇 | feedback_assets 聚合 | ✅ 词频统计即可 |
| 用户禁用补充 | `forbidden_supplement` | 禁止使用的称呼/行为 | feedback_assets + 人工审核 | ✅ 黑名单匹配 |
| 用户核心立场补充 | `core_stance` | 从历史观点中提炼的核心立场 | core_anchor_assets 聚合 | ⚠️ 需LLM辅助提炼 |
| 用户固定结构补充 | `structure_supplement` | 各结构模块的风格要求 | style_assets | ✅ 规则配置 |
| 用户素材使用习惯 | `material_habit` | 偏好的素材来源和使用方式 | material_usage_log 聚合 | ✅ 使用频次排序 |

**TypeScript 接口定义**（已在 `digital-asset-service.ts` 中实现）：

```typescript
interface UserExclusiveRule {
  id: string;
  ruleType: 'high_frequency_word' | 'forbidden_supplement'
           | 'core_stance' | 'structure_supplement' | 'material_habit';
  ruleContent: string;       // 规则具体内容
  priority: number;           // 1=最高优先级
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**当前状态**：`getUserExclusiveRules()` 返回空数组（非 Mock），Phase 3 创建 `style_assets` / `feedback_assets` 等表后自动生效。

**提示词长度控制**（v2.0 新增，修复 d7 缺失）：
- 动态规则上限：最多加载 20 条（按 priority 排序，截断低优先级）
- 总提示词长度上限：不超过 8000 token（约 6000 中文字符）
- 超出时：丢弃 P3 低优先级规则，保留 P0-P1

#### 3.2.3 拼接规则与实现

**实现文件**: `prompt-assembler-service.ts`
**状态**: ✅ 已完成

**拼接实现**（`assemblePrompt()` 方法）：

```
输入: PromptAssemblyOptions {
  userId, taskInstruction, samples,
  materials, targetWordCount, coreAnchorData,
  structureName, structureDetail, userOpinion, materialIds
}

输出: AssembledPrompt {
  fixedBasePrompt,       // v3.md 第一部分全文（4934字符）
  userExclusiveRules,    // StructuredRuleSection（结构化+格式化文本）
  styleRules,            // StructuredRuleSection
  currentTask,           // 本次创作需求（核心锚点+素材+结构+字数）
  fullPrompt,            // 最终拼接结果
  assemblyMetadata       // 元数据（规则数量、素材数量等）
}
```

**关键特性**：
- 核心锚点数据**完整输出不做截断**（修复 C4）
- 文件路径使用 `process.cwd()` 兼容 Next.js 生产构建（修复 M3）
- 缓存机制：内容比对缓存 + `invalidateCache()` 强制刷新（修复 m3）
- 单次 I/O：删除冗余双次文件读取（修复 N1）

**API 端点**：

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/api/prompt-assembler` | 预览元数据和摘要（不暴露完整提示词） | ✅ |
| POST | `/api/prompt-assembler` | 组装完整提示词（含输入校验） | ✅ |

**输入校验规则**（POST）：

| 字段 | 类型 | 校验规则 |
|------|------|----------|
| taskInstruction | string | 非空字符串 |
| samples | string[] | 字符串数组 |
| materials | string[] | 字符串数组 |
| targetWordCount | string | 500~10000 数字 |
| coreAnchorData.openingCase | string | 30~600字 |
| coreAnchorData.coreViewpoint | string | 20~400字 |
| coreAnchorData.endingConclusion | string | 20~400字 |

---

### 3.3 数字资产体系（Phase 3-4 📋 规划中）

#### 3.3.1 资产总览

> **v2.0 修订**：明确 5 类资产与现有数据源的关系，消除 D3 歧义。

| 资产类别 | 新增表? | 与现有表的关系 | Phase | MVP方案 |
|---------|---------|---------------|-------|---------|
| **核心锚点资产** | `core_anchor_assets` | 从 `agent_sub_tasks.user_opinion` 聚合 | Phase 3 | 直接聚合历史记录 |
| **风格规则资产** | `style_assets` | 全新表，人工录入 + 自动提取 | Phase 3 | 先人工录入，后接NLP |
| **样本文章资产** | `sample_articles` 或复用 `daily_task` | 从已定稿文章中选取 | Phase 3 | 手动标记"标杆文章" |
| **素材资产** | ❌ 不新建 | 复用现有 `material_library` 表 | ✅ 已有 | 已完成 CRUD |
| **反馈迭代资产** | `feedback_assets` | 从用户反馈 + Agent B 校验结果聚合 | Phase 4 | 先记录反馈，后自动提取规则 |

**关键决策**：`material_assets` 不再新建表，直接复用已有的 `material_library` + `material_usage_log`。

#### 3.3.2 核心锚点资产（core_anchor_assets）

**用途**：存储用户历史上填写的核心锚点，用于：
- 分析用户的常用案例主题（如：港险理赔、重疾拒赔、储蓄分红...）
- 提炼用户的核心立场倾向（如：反对返还型、强调保障属性...）
- 为"用户核心立场补充"类动态规则提供数据源

**Schema 草案**：

```sql
CREATE TABLE core_anchor_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64),                    -- Phase 3 多用户扩展
  source_task_id UUID REFERENCES agent_sub_tasks(id), -- 来源子任务
  anchor_type ENUM('opening_case', 'core_viewpoint', 'ending_conclusion'),
  raw_content TEXT NOT NULL,              -- 原始内容
  extracted_keywords TEXT[],              -- 提取的关键词（NLP或规则）
  usage_count INT DEFAULT 0,              -- 被引用次数
  is_effective BOOLEAN DEFAULT TRUE,      -- 是否有效（用户可能废弃旧观点）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**自动填充策略**：每次 insurance-d 执行完成后，如果 `agent_sub_tasks.user_opinion` 非空，自动拆解并写入此表。

#### 3.3.3 风格规则资产（style_assets）

**用途**：存储从样本分析和用户反馈中提取的风格规则。

**Schema 草案**：

```sql
CREATE TABLE style_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type ENUM('tone', 'vocabulary', 'logic', 'emotion'),
  rule_content TEXT NOT NULL,
  rule_category ENUM('positive', 'negative'),  -- 正向要求 or 禁止项
  sample_extract TEXT,                      -- 从哪个样本/反馈中提取
  confidence FLOAT DEFAULT 0.5,             -- 置信度 0-1
  source_type ENUM('manual', 'auto_nlp', 'feedback'),  -- 来源
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**MVP 策略**（v2.0 修订，回应 D2）：

| 能力 | 技术路径 | MVP可行性 | Phase |
|------|----------|-----------|-------|
| 高频词统计 | 分词 + 词频计数（simple-statistics 库） | ✅ 纯规则可实现 | Phase 3 |
| 禁用词维护 | 黑名单表 + 正则匹配 | ✅ 纯规则可实现 | Phase 3 |
| 句式识别 | 正则匹配反问句/短句模式 | ✅ 纯规则可实现 | Phase 3 |
| 情绪分类 | LLM 辅助（调用 insurance-d 做情绪标注） | ⚠️ 需要LLM调用 | Phase 4 |
| 修改意图理解 | LLM 辅助（分析用户反馈语义） | ⚠️ 需要LLM调用 | Phase 4 |
| 风格相似度计算 | 向量嵌入 + 余弦相似度 | ⚠️ 需要向量数据库 | Phase 5 |

#### 3.3.4 素材资产（复用 material_library）

**现状**：✅ 已完成，详见 AGENTS.md "素材库模块" 章节。

**与 prompt-assembler 的集成**：
- `DigitalAssetService.getMaterials()` 查询 `material_library` 表
- 查询结果传入 `PromptAssemblerService.assemblePrompt()`
- 在"本次创作需求"中以推荐素材形式展示给 insurance-d

#### 3.3.5 反馈迭代资产（feedback_assets）

**用途**：记录用户对生成文章的反馈，从中提取新的禁令和偏好。

**Schema 草案**：

```sql
CREATE TABLE feedback_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_article_id UUID,                   -- 关联的文章
  feedback_type ENUM('content', 'style', 'structure', 'overall'),
  feedback_raw TEXT NOT NULL,               -- 用户原始反馈
  extracted_rule_type VARCHAR(32),          -- 提取出的规则类型
  extracted_rule_content TEXT,              -- 提取出的规则内容
  is_validated BOOLEAN DEFAULT FALSE,       -- 是否经人工确认
  validity_expires_at TIMESTAMPTZ,          -- 有效期（v2.0 新增，回应 d9）
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**生命周期管理**（v2.0 新增）：
- 新提取的规则：`is_validated = false`，进入待审核队列
- 人工确认后：`is_validated = true`，激活
- 有效期：默认 90 天，过期后自动降权（priority 降低但仍保留）
- 统计窗口：默认最近 50 篇文章的反馈（回应 d8）

---

## 四、自动沉淀机制（Phase 4 📋 规划中）

### 4.1 沉淀触发时机

| 时机 | 触发条件 | 沉淀内容 |
|------|----------|----------|
| 文章定稿 | insurance-d 返回 isCompleted=true 且 Agent B 校验通过 | 样本标记 + 锚点归档 |
| 用户反馈 | 用户提交反馈（满意/不满意/修改意见） | 反馈记录 + 规则提取 |
| 定期聚合 | 每日凌晨定时任务 | 全局词频重算 + 规则权重调整 |

### 4.2 沉淀内容与规则实现

> **v2.0 修订**：明确每项沉淀的技术实现路径，区分"纯规则"和"需LLM辅助"。

#### 4.2.1 用词习惯沉淀（纯规则 ✅ 可行）

```
输入：最近50篇定稿文章全文
处理：
  1. jieba 分词
  2. 过滤停用词（的、了、是...）
  3. 词频统计 → 取 Top 30 高频词
  4. 与通用高频词表做差集 → 得到"用户专属高频词"
  5. 写入 style_assets (rule_type='vocabulary', rule_category='positive')
```

#### 4.2.2 禁用词沉淀（纯规则 ✅ 可行）

```
输入：用户反馈中包含"不要""太多""别用"等否定表述的记录
处理：
  1. 正则匹配否定句式
  2. 提取被否定的关键词
  3. 写入 style_assets (rule_type='vocabulary', rule_category='negative')
  4. 设置 validity_expires_at = NOW() + 90天
```

#### 4.2.3 句式习惯沉淀（纯规则 ✅ 可行）

```
输入：最近50篇定稿文章
处理：
  1. 正则匹配反问句模式（"你想想...？""...吗？"）
  2. 统计短句比例（<15字的句子占比）
  3. 统计段落平均长度
  4. 写入 style_assets (rule_type='tone') 
```

#### 4.2.4 核心立场沉淀（⚠️ 需 LLM 辅助）

```
输入：历史 user_opinion + core_anchor_assets
处理：
  1. 调用 LLM（轻量模型即可）对历史观点做聚类
  2. 提取 3-5 个反复出现的立场主题
  3. 生成立场摘要
  4. 写入 style_assets (rule_type='logic', confidence=聚类强度)
  注：MVP 阶段可跳过，由人工定期维护
```

#### 4.2.5 样本标记（人工 + 半自动）

```
触发：用户或管理员标记某篇文章为"标杆样本"
处理：
  1. 记录到 sample_articles（或 daily_task 加 is_benchmark 标记）
  2. 可选：调用 LLM 提取风格特征（Phase 5）
  3. 用于后续风格相似度对比
```

---

## 五、校验规则体系（Phase 4 📋 规划中）

### 5.1 校验规则定义

> **v2.0 修订**：为每条规则补充具体的"通过/不通过判定标准"，解决 D4 问题。

#### 5.1.1 核心锚点完整性校验

| 维度 | 标准 | 判定方法 | 通过阈值 |
|------|------|----------|----------|
| 开篇案例保留率 | AI输出的开头是否包含用户输入的开篇案例核心要素 | 文本相似度（余弦/BLEU） | ≥ 0.85 |
| 核心观点一致性 | AI的核心论点是否与用户观点方向一致 | LLM 判定（二分类） | 一致 |
| 结尾结论偏差度 | AI的结论是否偏离用户指定的结论方向 | 关键词重叠率 | ≥ 0.80 |

> **注意**："100%保留"在实际中不现实（AI必然会有过渡句和衔接），因此采用**相似度阈值**而非**完全匹配**。阈值 0.85 意味着允许 15% 的改写空间，但核心要素必须保留。

#### 5.1.2 结构完整性校验

| 维度 | 标准 | 判定方法 |
|------|------|----------|
| 段落完整性 | 所有选定的结构模块都在输出中出现 | 检查每个 section.name 的关键词是否出现在输出中 |
| 顺序正确性 | 段落顺序与选定结构一致 | 提取输出中的标题序列，与模板序列做编辑距离 |
| 字数合规 | 总字数在目标范围 ±200 字内 | 字符计数 |

#### 5.1.3 素材使用校验

| 维度 | 标准 | 判定方法 |
|------|------|----------|
| 素材引用率 | 用户提供的素材是否被使用 | 素材内容片段在输出中的出现次数 |
| 编造检测 | 是否出现了无依据的数据/案例 | 与素材库做交叉验证（模糊匹配）|

#### 5.1.4 风格合规校验

| 维度 | 标准 | 判定方法 |
|------|------|----------|
| 禁用词检测 | 不含黑名单词汇 | 正则匹配 |
| 绝对化词汇 | 不含"最/第一/100%/保证"等 | 正则匹配 + 白名单例外 |
| 口吻检查 | 使用第一人称"我" | 代词统计 |
| 段落长度 | 每段 ≤ 3 行（手机端） | 按 `\n\n` 分段后统计 |

### 5.2 校验执行流程

```
insurance-d 输出文章
    ↓
Agent B 执行 4 类校验（并行）
    ↓
┌─────────────────────────────────────┐
│  校验结果汇总                        │
│  - 通过：所有维度 ≥ 阈值              │
│  - 警告：部分维度 < 阈值但不严重        │
│  - 不通过：任一核心维度 < 阈值         │
└─────────────────────────────────────┘
    ↓
通过 → 进入定稿流程
警告 → 标记但放行（记录到 mcpExecutions）
不通过 → 打回重写（最多 2 次，第 3 次升级 NEED_USER）
```

> **v2.0 新增**：重写次数限制（回应 d12），避免无限循环。

---

## 六、完整闭环流程（Phase 5 📋 规划中）

### 6.1 端到端流程图

```
┌──────────────┐
│  用户输入     │  核心锚点 + 观点 + 素材 + 结构 + 字数
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────────────┐
│  Agent B     │────▶│  子任务拆解            │
│  任务拆解     │     │  2a:生成大纲(NEED_USER)│
│              │     │  2b:生成全文           │
└──────────────┘     └──────────┬───────────┘
                                │
       ┌────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  PromptAssemblerService                  │
│  ┌────────────────────────────────────┐  │
│  │ 固定基础提示词 (v3.md)             │  │ ← 4934字符，不变
│  ├────────────────────────────────────┤  │
│  │ 用户专属动态规则 (数字资产)         │  │ ← Phase 3 建表后自动加载
│  ├────────────────────────────────────┤  │
│  │ 本次创作需求                       │  │ ← 核心锚点+素材+结构+字数
│  └────────────────────────────────────┘  │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  insurance-d 执行                         │
│  2a: 输出大纲 → 用户确认                  │ ◄── 大纲确认交互（D1 方案A）
│  2b: 输出完整 HTML 文章                   │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  Agent B 校验（4类并行）                   │
│  ✓ 核心锚点完整性 (≥0.85相似度)           │
│  ✓ 结构完整性 (全模块+顺序)                │
│  ✓ 素材使用 (引用率+编造检测)              │
│  ✓ 风格合规 (禁用词+口吻+段落)             │
└──────────────────┬───────────────────────┘
                   │
       ┌───────────┴───────────┐
       │ 通过                   │ 不通过
       ▼                       ▼
┌──────────────┐        ┌──────────────┐
│  定稿 + 沉淀  │        │  打回重写     │
│  (≤2次重试)   │        │  (升级NEED_USER│
└──────┬───────┘        └──────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  自动沉淀                                 │
│  • 用词习惯 → style_assets (高频词)       │  ← 纯规则
│  • 禁用词 → style_assets (黑名单)         │  ← 纯规则
│  • 句式习惯 → style_assets (句式)         │  ← 纯规则
│  • 核心锚点 → core_anchor_assets          │  ← 聚合
│  • 用户反馈 → feedback_assets             │  ← 记录
│  • 素材使用 → material_usage_log (+1)     │  ← 已有
└──────────────────────────────────────────┘
       │
       ▼
  🔄 下次写作时，动态规则更丰富 → AI 更像用户
```

### 6.2 用户不满意时的回退路径（v2.0 新增，回应 d13）

| 场景 | 回退路径 | 实现 |
|------|----------|------|
| 大纲不满意 | 修改意见 → 重新生成大纲 | 用户决策 API 的"修改意见"选项 |
| 全文不满意 | 拒绝全文 → 回到大纲环节 | 子任务 2b 重置为初始状态 |
| 风格整体不对 | 手动编辑后标记为定稿 | 前端富文本编辑器（未来） |
| 要换一种结构 | 重新选择结构 → 重新走流程 | 创作引导 UI 的结构切换 |

---

## 七、分阶段实施计划（更新版）

| 阶段 | 内容 | 状态 | 核心交付物 | 前置依赖 |
|------|------|------|-----------|----------|
| **Phase 1** | 创作引导 UI | ✅ 完成 | Context/Reducer、4种结构模板、防抖保存 | 无 |
| **Phase 2** | 提示词动态拼接 | ✅ 完成 | v3.md、PromptAssemblerService、执行引擎接入 | Phase 1 |
| **Phase 3** | 数字资产建表 + 大纲确认 | 📋 待做 | 5张新表（core_anchor_assets/style_assets等）、大纲双子任务改造 | Phase 2 |
| **Phase 4** | 自动沉淀 + 校验升级 | 📋 待做 | 用词/禁用/句式沉淀（纯规则）、4类校验规则+判定标准 | Phase 3 |
| **Phase 5** | 完整闭环 + 风格相似度 | 📋 待做 | LLM辅助沉淀、向量嵌入、样本自动分析 | Phase 4 |

---

## 八、附录

### A. 文件索引（当前实现）

| 文件 | 职责 | 阶段 |
|------|------|------|
| `src/components/creation-guide/types.ts` | 统一类型定义 | P1 |
| `src/components/creation-guide/creation-guide-context.tsx` | Context + Reducer 状态管理 | P1 |
| `src/components/creation-guide/structure-templates.ts` | 4种预设结构模板 | P1 |
| `src/components/creation-guide/core-anchor-input-optimized.tsx` | 核心锚点输入组件 | P1 |
| `src/components/creation-guide/material-provider.tsx` | 素材关联组件 | P1 |
| `src/components/creation-guide/creation-controller.tsx` | 情感基调+控制面板 | P1 |
| `src/components/creation-guide/structure-selector.tsx` | 结构选择组件 | P1 |
| `src/components/creation-guide/safety-utils.ts` | 安全工具函数 | P1 |
| `src/hooks/use-debounced-storage.ts` | 防抖本地存储 Hook | P1 |
| `src/lib/agents/prompts/insurance-d-v3.md` | 固定基础提示词 | P2 |
| `src/lib/services/digital-asset-service.ts` | 数字资产管理服务 | P2 |
| `src/lib/services/prompt-assembler-service.ts` | 提示词动态拼接服务 | P2 |
| `src/app/api/prompt-assembler/route.ts` | 提示词组装 API | P2 |
| `src/lib/agents/prompt-loader.ts` | 提示词加载器（指向v3） | P2 |
| `src/lib/services/subtask-execution-engine.ts` | 执行引擎（insurance-d接入） | P2 |
| `src/app/page-v3.tsx` | 主页（Context版本） | P1 |
| `src/lib/db/schema/material-library.ts` | 素材库 Schema | 前置 |

### B. 术语表

| 术语 | 定义 |
|------|------|
| 核心锚点 | 用户输入的3段不可修改的内容（开篇案例、核心观点、结尾结论）|
| 动态规则 | 从数字资产中提取的、随用户使用不断更新的个性化规则 |
| 固定基础提示词 | v3.md 中的不变部分（铁律+风格+流程），所有请求共享 |
| 拼接 | 将固定基础、动态规则、本次需求按顺序组合成最终提示词 |
| 沉淀 | 从定稿文章/用户反馈中自动提取信息并写入数字资产的过程 |
| 校验 | Agent B 对 insurance-d 输出文章的质量检查 |

### C. 修订日志

| 版本 | 日期 | 主要变更 |
|------|------|----------|
| v1.0 | 原始版 | 初始需求文档 |
| v2.0 | 当前 | 对齐 Phase 1+2 实现；修复 D1-D4 结构性缺陷；修复 d1-d13 细节问题；补充优先级矩阵/校验标准/沉淀技术路径/回退路径 |

---

**文档状态**: v2.0 修订版
**最后更新**: 2025年
**适用范围**: AI 写作风格复刻系统 全生命周期
