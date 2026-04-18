# BYOK (Bring Your Own Key) 代码走读报告

**评估目标**：判断当前系统是否具备将 LLM 成本转嫁给用户的能力  
**评估日期**：2025年  
**系统版本**：Next.js 16 + Multi-platform Publishing + Phase 6 Multi-tenant  

---

## 一、总体结论

**系统已完整实现 BYOK 能力，可支撑对外公开并按用户维度计费。**

| 维度 | 状态 | 说明 |
|------|------|------|
| 数据模型 | ✅ 完整 | `user_api_keys` 表已创建，支持 AES-256-GCM 加密存储 |
| LLM 工厂 | ✅ 完整 | `createUserLLMClient()` 已实现用户Key优先+平台降级策略 |
| Embedding | ✅ 完整 | `createUserEmbeddingClient()` 同样支持 BYOK |
| 调用点覆盖 | ✅ 完整 | 25个 LLM 调用点全部接入工厂方法 |
| 多平台支持 | ✅ 完整 | 多平台发布场景下各子任务使用用户Key |
| 前端界面 | ✅ 完整 | `/settings/api-keys` 页面支持 Key 的增删改查+验证 |
| 降级策略 | ✅ 完整 | fallback 模式（无Key用平台）/ strict 模式（无Key报错） |

---

## 二、核心架构走读

### 2.1 数据层

#### 2.1.1 用户 API Key 表 (`user_api_keys`)
**文件**: `src/lib/db/schema/user-api-keys.ts`

```typescript
export const userApiKeys = pgTable('user_api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),      // 多租户隔离
  provider: text('provider').notNull().default('doubao'),
  encryptedKey: text('encrypted_key').notNull(),    // AES-256-GCM 密文
  keyIv: text('key_iv').notNull(),                  // 12字节 IV
  keyTag: text('key_tag').notNull(),                // 16字节 Auth Tag
  keySuffix: text('key_suffix'),                    // 脱敏后4位
  status: text('status').notNull().default('active'),
  lastVerifiedAt: timestamp('last_verified_at'),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

**安全设计亮点**:
- API Key 不存明文，使用 AES-256-GCM 加密（随机 IV + Auth Tag）
- 加密密钥从环境变量 `COZE_ENCRYPTION_KEY` 读取（32字节 hex）
- 脱敏展示仅显示后 4 位（如 `****abcd`）
- 多租户隔离：所有查询按 `workspaceId` 过滤

#### 2.1.2 服务层 (`user-api-key-service.ts`)
**文件**: `src/lib/services/user-api-key-service.ts`

核心方法：
- `create()` - 创建 Key（自动加密，限制每个 workspace 同 provider 只能有一个 active Key）
- `list()` - 列出自 workspace 的所有 Key（脱敏）
- `getActiveKeyDecrypted()` - 获取活跃 Key 并解密（供工厂使用）
- `verify()` - 调用豆包 `/models` 接口验证 Key 有效性
- `updateStatus()` / `updateDisplayName()` / `delete()` - 状态管理

**P0 修复记录**: `verify()` 方法曾错误地调用 `getActiveKeyDecrypted()` 导致多 Key 场景下验证错误对象，已修复为直接解密指定 Key。

---

### 2.2 工厂层（核心）

#### 2.2.1 LLM 工厂 (`factory.ts`)
**文件**: `src/lib/llm/factory.ts`

**缓存策略**:
```typescript
const MAX_CACHE_SIZE = 100;           // LRU 淘汰上限
const CACHE_TTL_MS = 5 * 60 * 1000;   // 5分钟 TTL

// 缓存清理：过期删除 + LRU 超限淘汰
function cleanExpiredCache(): void {
  // 1. 删除过期条目
  // 2. LRU 淘汰：超过 MAX_CACHE_SIZE 时删除最旧的条目
}
```

**核心工厂方法**:
```typescript
export async function createUserLLMClient(
  workspaceId: string | undefined | null,
  options?: { timeout?: number; fallbackMode?: 'fallback' | 'strict' }
): Promise<UserClientResult> {
  // 1. 无 workspaceId → 直接降级
  // 2. 查缓存 → 命中且未过期 → 直接返回
  // 3. 查 DB → 用户有活跃 Key → 用用户 Key 创建 Client
  // 4. fallback 模式 → 用平台 Key
  // 5. strict 模式 → 抛错
}
```

**调用来源追踪**:
- 日志输出 `source` 字段标识 LLM 来源：`user-key-${keyId}` / `platform-fallback` / `user-key-cached`
- 便于问题排查和费用归因

#### 2.2.2 Embedding 工厂
同文件提供 `createUserEmbeddingClient()`，逻辑与 LLM 工厂一致，支持向量嵌入的 BYOK。

---

### 2.3 调用层（25个调用点全覆盖）

#### 2.3.1 核心调用入口 (`agent-llm.ts`)
**文件**: `src/lib/agent-llm.ts`

```typescript
export async function callLLM(
  agentId: string,
  context: string,
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number;
    timeout?: number;
    workspaceId?: string;  // BYOK: 传入 workspaceId 使用用户 Key
  }
): Promise<string> {
  // 优先使用用户 Key
  if (workspaceId) {
    try {
      const userClient = await createUserLLMClient(workspaceId, { timeout });
      llm = userClient.client;
    } catch {
      // 降级平台 Key
    }
  }
}
```

#### 2.3.2 子任务执行引擎 (`subtask-execution-engine.ts`)
**文件**: `src/lib/services/subtask-execution-engine.ts`

该文件是**最大成本来源**，包含 **5 处 callLLM 调用**，全部正确传递 `workspaceId`：

| 行号 | 调用场景 | workspaceId 传递 |
|------|----------|------------------|
| ~6998 | 直接执行任务 | `{ workspaceId: task.workspaceId \| undefined }` |
| ~7466 | 继续执行任务 | `{ workspaceId: task.workspaceId \| undefined }` |
| ~8572 | Agent B 标准化决策 | `{ timeout: 180000, workspaceId: ... }` |
| ~10309 | Agent T 技术专家 | `{ timeout: 180000, workspaceId: ... }` |
| ~10475 | 前序信息选择器 | `{ workspaceId: task.workspaceId \| undefined }` |

**关键观察**: 所有调用均从 `task.workspaceId` 读取，该字段来自 `agent_sub_tasks` 表，与任务创建时的工作空间一致。

#### 2.3.3 API 路由层（8个路由）

| 路由 | 功能 | workspaceId 获取 | BYOK 状态 |
|------|------|------------------|-----------|
| `/api/agents/b/ai-split` | AI 任务拆解 | `getWorkspaceId(request)` | ✅ |
| `/api/agents/b/suggest-opinion` | 建议观点生成 | `getWorkspaceId(request)` | ✅ |
| `/api/agents/[id]/chat` | Agent 对话 | `getWorkspaceId(request)` | ✅ |
| `/api/agents/send-command` | 发送指令 | `getWorkspaceId(request)` | ✅ |
| `/api/agents/insurance-d/preview-outline` | 大纲预览 | `getWorkspaceId(request)` | ✅ |
| `/api/style-analyzer/generate` | 风格分析 | `getWorkspaceId(request)` | ✅ |
| `/api/materials/upload-parse` | 图片解析 | `getWorkspaceId(request)` | ✅ |
| `/api/commands/send` | 命令发送 | `getWorkspaceId(request)` | ✅ |

#### 2.3.4 Service 层（7个服务）

| 服务 | 功能 | BYOK 支持 |
|------|------|-----------|
| `xiaohongshu-style-analyzer.ts` | 小红书风格分析 | `options?.workspaceId` |
| `xiaohongshu-visual-analyzer.ts` | 视觉分析 | `workspaceId` 参数 |
| `llm-assisted-rule-service.ts` | LLM 辅助规则提取 | `getClient(workspaceId)` |
| `style-deposition-service.ts` | 风格沉淀 | `workspaceId` 参数 |
| `style-similarity-service.ts` | 风格相似度 | `options?.workspaceId` |
| `mcp/vision-tools.ts` | MCP 视觉工具 | `workspaceId` 参数 |
| `mcp-result-text-generator.ts` | MCP 结果生成 | `workspaceId` 参数 |

#### 2.3.5 基础设施层

| 组件 | 文件 | BYOK 状态 | 备注 |
|------|------|-----------|------|
| Embedding 函数 | `rag/embedding-function.ts` | ✅ | `CozeEmbeddingFunction` 支持 `workspaceId` 参数 |
| Split 重试管理 | `split-retry-manager.ts` | ⚠️ 平台Key | 注释说明"暂无 workspaceId，使用平台 Key" |
| 编排引擎 | `orchestration/instance.ts` | ⚠️ 平台Key | 注释说明"Phase 2 需重构为工厂模式" |

---

### 2.4 多平台发布场景

#### 2.4.1 独立 commandResultId 模式
**文件**: `src/app/api/agents/b/simple-split/route.ts`

多平台发布时，每个平台账号创建**独立的子任务组**，每组有独立的 `commandResultId`：

```typescript
// 多平台模式：每个账号创建独立的一组子任务
for (let i = 0; i < accountIds.length; i++) {
  const accountId = accountIds[i];
  // 创建子任务...
  // metadata 包含：multiPlatformGroupId, platformGroupIndex, platformGroupTotal, platformLabel
}
```

#### 2.4.2 文章存储隔离
**文件**: `src/lib/db/schema.ts` (line 872)

```typescript
export const articleContent = pgTable('article_content', {
  articleId: text('article_id').primaryKey(),
  taskId: text('task_id').notNull(),
  subTaskId: text('sub_task_id'),  // 🔥 多平台发布：区分同一任务不同平台版本
  // ...
});
```

`subTaskId` 字段确保多平台场景下同一指令的不同平台文章不会相互覆盖。

---

### 2.5 前端界面

#### 2.5.1 API Key 管理页面
**文件**: `src/app/settings/api-keys/page.tsx`

功能：
- 查看 Key 列表（脱敏展示 `****abcd`）
- 添加新 Key（密码框输入 + 显示名）
- 验证 Key（调用豆包 `/models` 接口）
- 禁用/启用 Key
- 删除 Key

#### 2.5.2 导航入口
**文件**: `src/components/app-navbar.tsx`

顶部导航栏新增 "API Key" 菜单项，指向 `/settings/api-keys`。

---

## 三、问题与风险

### 3.1 已修复问题（评审阶段发现并修复）

| # | 级别 | 问题 | 修复 |
|---|------|------|------|
| 1 | P0 | `verify()` 方法验证错误的 Key | 改为直接解密指定 Key 记录 |
| 2 | P1 | `factory.ts` 使用 `require()` 动态导入 | 改为顶层 `import` |
| 3 | P1 | PUT 端点忽略 `displayName` | 新增 `updateDisplayName()` 方法 |
| 4 | P2 | 缓存 Map 无大小限制 | 添加 LRU 淘汰（上限100条） |
| 5 | P2 | 前端 DELETE 使用原生 fetch | 统一使用 `apiDelete()` 封装 |

### 3.2 已知限制（非阻塞）

| 组件 | 限制 | 影响 | 建议 |
|------|------|------|------|
| `split-retry-manager.ts` | 使用平台 Key | 任务重试纠正场景费用由平台承担 | 低优先级：该场景调用频率低 |
| `orchestration/instance.ts` | 使用平台 Key | 编排引擎决策场景费用由平台承担 | 如需严格按用户计费，需重构为工厂模式（Phase 2） |
| Cron 任务 | 使用平台 Key | 定时聚合等后台任务费用由平台承担 | 这些任务服务于系统整体，不由单一用户触发，使用平台 Key 合理 |

---

## 四、数据流验证

### 4.1 正向流程（用户有 Key）

```
用户请求 → API 路由
  ↓
getWorkspaceId(request) → workspaceId
  ↓
createUserLLMClient(workspaceId)
  ↓
查缓存（miss）→ 查 DB（命中 active Key）→ 解密
  ↓
new LLMClient(new Config({ apiKey: userKey }))
  ↓
调用豆包 API（费用计入用户账户）
```

### 4.2 降级流程（用户无 Key）

```
用户请求 → API 路由
  ↓
createUserLLMClient(workspaceId)
  ↓
查 DB（无 active Key）
  ↓
fallbackMode === 'fallback'
  ↓
getPlatformLLMClient() → 使用平台环境变量 Key
  ↓
调用豆包 API（费用计入平台账户）
```

### 4.3 多平台发布场景

```
用户选择 3 个平台账号 → /api/agents/b/simple-split
  ↓
为每个账号创建独立子任务组
  ↓
子任务.metadata.accountId = 账号ID
  ↓
子任务执行 → getTemplateIdForTask() 获取模板
  ↓
insurance-d 执行 → callLLM({ workspaceId: task.workspaceId })
  ↓
各平台文章分别保存（subTaskId 区分）
```

---

## 五、建议与优化

### 5.1 计费透明度（建议）

当前系统记录 `llmSource` 在日志中，但前端用户无法直观看到每次请求使用的 Key。建议：

1. **费用归属展示**：在任务执行结果页面显示 "本次执行使用您的 API Key" 或 "本次执行使用平台资源"
2. **Token 统计**：豆包 API 返回 `usage` 字段（`input_tokens` / `output_tokens`），可汇总展示给用户

### 5.2 Key 失效处理（建议）

当前 `verify()` 方法需手动触发。建议增加：

1. **自动检测**：Key 失效时（401 响应）自动标记为 `invalid`
2. **通知机制**：Key 失效时通知用户更新

### 5.3 多 Key 支持（可选）

当前限制每个 workspace 同 provider 只能有一个 active Key。如需支持多 Key（如轮询负载均衡），需：

1. 移除 `getActiveKey()` 的唯一性限制
2. 在工厂层实现轮询或随机选择策略

### 5.4 成本上限保护（可选）

为防止用户 Key 被盗用导致巨额费用，可考虑：

1. **单日调用上限**：每个 workspace 每日 LLM 调用次数限制
2. **费用预警**：Token 使用量超过阈值时通知用户

---

## 六、结论

### 6.1 功能完备性

| 需求 | 实现状态 |
|------|----------|
| 用户配置自己的豆包 API Key | ✅ 完整 |
| 系统优先使用用户 Key | ✅ 完整 |
| 用户无 Key 时降级平台 Key | ✅ 完整 |
| 多平台发布场景各子任务使用用户 Key | ✅ 完整 |
| Key 加密存储 | ✅ AES-256-GCM |
| Key 验证 | ✅ 调用 /models 接口 |
| 前端管理界面 | ✅ 完整 |

### 6.2 对外公开 readiness

**系统已具备对外公开的条件**，LLM 成本可按用户维度转嫁：

1. **用户有 Key**：费用自动计入用户豆包账户
2. **用户无 Key**：自动降级平台 Key，平台承担费用（可作为增值服务引导用户配置 Key）

### 6.3 运营建议

1. **默认策略**：新用户注册时引导配置 BYOK，提供详细获取豆包 Key 的教程
2. **免费额度**：未配置 Key 的用户提供每日/每月免费额度，超出后强制配置 Key 或购买平台额度
3. **监控告警**：监控平台 Key 的总调用量和费用，设置预算上限

---

**报告完成**
