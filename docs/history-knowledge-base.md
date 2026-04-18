# 历史开发知识库

## 2026-03-03 子任务执行引擎测试总结

### 📋 测试背景
测试子任务执行引擎的完整流程：执行 agent 反馈 → Agent B 决策 → MCP 执行 → 返回结果

### ⚠️ 遇到的问题及解决方案

#### 1. capability_list 表缺少关键字段

**问题描述：**
- `tool_name` 和 `action_name` 字段为 null
- `param_desc` 字段为 null
- Agent B 无法获取工具名、方法名和参数说明

**解决方案：**
```sql
-- 更新微信公众号相关能力
UPDATE capability_list SET 
  tool_name = 'wechat',
  action_name = 'addDraft',
  param_desc = '{"accountId": "微信公众号账号ID", "articles": "文章数组..."}'
WHERE function_desc LIKE '%微信公众号%';
```

**经验总结：**
- 必须确保 capability_list 表中的关键字段（tool_name、action_name、param_desc）有值
- param_desc 应该用自然语言描述每个参数的含义，便于 Agent B 理解

---

#### 2. capability_list 表存在重复记录

**问题描述：**
- id=1 和 id=6 的功能完全相同（都是微信公众号文章上传）
- Agent B 有时选 1，有时选 6，导致不一致

**解决方案：**
```sql
-- 删除重复记录，保留 id 较小的
DELETE FROM capability_list WHERE id IN (6, 7, 8, 9, 10);
```

**经验总结：**
- 必须确保 capability_list 表中没有重复记录
- 重复记录会导致 Agent B 决策不一致

---

#### 3. Agent B 输出不完整

**问题描述：**
- Agent B 最初只输出 `solutionNum`
- 缺少 `toolName`、`actionName`、`params` 等关键字段
- MCP 调用失败

**解决方案（第一版 - 代码补全）：**
```typescript
// 在代码中补全缺失的字段
if (output.solutionNum && (!output.toolName || !output.actionName)) {
  const selectedCapability = capabilities.find(cap => cap.id === output.solutionNum);
  output.toolName = selectedCapability.toolName;
  output.actionName = selectedCapability.actionName;
  // ...
}
```

**解决方案（第二版 - 优化提示词）：**
```
【重要规则】
1. 必须严格按照 JSON 格式输出
2. solutionNum 必须从可用的能力清单中选择
3. toolName 和 actionName 必须与 capability 记录完全一致
4. params 必须根据 param_desc 来填充
5. 从执行 agent 的 problem 字段中提取关键信息，填充到 params 中
```

**经验总结：**
- 首选方案：优化提示词，让 Agent B 严格输出所有字段
- 备选方案：在代码中做简单的验证和默认值填充
- 不要在代码中做复杂的补全逻辑

---

#### 4. 提示词中缺少样例

**问题描述：**
- 最初提示词中只有格式说明，没有具体样例
- Agent B 不知道该如何填充参数

**解决方案：**
```
【输出样例】
{
  "solutionNum": 1,
  "toolName": "wechat",
  "actionName": "addDraft",
  "params": {
    "accountId": "insurance-account",
    "articles": [{...}]
  },
  "reasoning": "...",
  "isNotifyAgentA": false
}
```

**经验总结：**
- 提示词中必须包含清晰的样例
- 样例应该从 capability_list 表的 example_output 字段动态获取

---

#### 5. capability_list 表缺少 example_output 字段

**问题描述：**
- 没有地方存储每个能力的输出样例
- 样例只能写死在提示词中

**解决方案：**
```sql
-- 添加字段
ALTER TABLE capability_list ADD COLUMN IF NOT EXISTS example_output jsonb;

-- 更新数据
UPDATE capability_list SET 
  example_output = '{"solutionNum": 1, "toolName": "wechat", ...}'
WHERE id = 1;
```

**经验总结：**
- example_output 应该与每个能力绑定
- 便于维护和复用

---

#### 6. 执行 agent 反馈缺少关键信息

**问题描述：**
- 最初 `problem` 字段只描述了问题："无法上传微信公众号文章草稿"
- 没有提供文章标题、作者、内容、账号ID 等关键信息
- Agent B 无法生成完整的 params

**解决方案：**
```typescript
const mockExecutorResult = {
  isNeedMcp: true,
  problem: '无法上传微信公众号文章草稿...' + 
           '待上传文章信息：标题《保险科普：如何选择医疗险》，' +
           '作者保险事业部，摘要本文详细介绍...，' +
           '内容<h1>如何选择医疗险</h1>...，' +
           '公众号账号ID：insurance-account',
  capabilityType: 'platform_publish',
  isTaskDown: false,
};
```

**经验总结：**
- 执行 agent 的 `problem` 字段必须包含完整的业务信息
- Agent B 需要从 problem 中提取关键信息生成 params

---

#### 7. 微信 API 调用失败（IP 白名单限制）

**问题描述：**
- 微信 API 返回错误："invalid ip ... not in whitelist"
- 无法继续测试后续步骤

**解决方案：**
- 创建独立的 Mock 测试 API：`
- 在测试 API 中模拟 MCP 成功返回
- 不调用真实的微信 API

**代码实现：**
```typescript
// 在测试 API 中独立 Mock，不修改业务文件
const mockMcpResult = {
  success: true,
  data: {
    media_id: 'mock_media_id_' + Date.now(),
    create_time: Date.now()
  },
  metadata: { tool: 'wechat', action: 'addDraft' }
};
```

**经验总结：**
- 外部 API 限制时，使用 Mock 测试继续验证流程
- Mock 应该在独立的测试文件中实现，不要修改业务代码
- 通过依赖注入或策略模式实现更优雅

---

### ✅ 最终成果

#### 完整测试流程（全部成功）

| 步骤 | 内容 | 状态 |
|------|------|------|
| 1 | 执行 agent 反馈（包含完整信息） | ✅ 成功 |
| 2 | 查询 capability_list | ✅ 成功 |
| 3 | Agent B 决策（提取信息生成参数） | ✅ 成功 |
| 4 | MCP 执行（Mock 成功） | ✅ 成功 |
| 5 | 返回给执行 agent | ✅ 成功 |
| 6 | 标记任务完成 | ✅ 成功 |

#### Agent B 完美输出

```json
{
  "solutionNum": 1,
  "toolName": "wechat",
  "actionName": "addDraft",
  "params": {
    "accountId": "insurance-account",
    "articles": [{
      "title": "保险科普：如何选择医疗险",
      "author": "保险事业部",
      "digest": "本文详细介绍如何选择适合自己的医疗险",
      "content": "<h1>如何选择医疗险</h1><p>...</p>",
      "show_cover_pic": 0
    }]
  },
  "reasoning": "该方案为微信公众号文章上传能力...",
  "isNotifyAgentA": false
}
```

---

### 💡 关键经验

1. **数据完整性**：确保 capability_list 表的关键字段都有值
2. **数据唯一性**：避免 capability_list 表有重复记录
3. **提示词优化**：给 Agent B 清晰的格式要求和样例
4. **信息传递**：执行 agent 必须提供完整的业务信息
5. **Mock 测试**：外部 API 限制时，使用 Mock 继续验证流程
6. **代码分离**：Mock 实现应该在独立的测试文件中，不要修改业务代码

---

### 📚 相关文件

- 测试 API：`/src/app/api/test/real-engine-full-test-mock/route.ts`
- 子任务执行引擎：`/src/lib/services/subtask-execution-engine.ts`
- 数据库 Schema：`/src/lib/db/schema.ts`

---

*记录时间：2026-03-03*  
*记录人：AI Assistant*

---

## 2026-03-03 知识库文件目录整理


## 2026-03-03 知识库文件目录整理

### 📁 发现的 knowledge 相关文件

今天搜索整个项目，发现了以下与 "knowledge" 相关的文件：

#### 1. src/utils/knowledge/ 目录下的工具文件
- **`base-manager.ts`** - 知识库管理器的基类，定义了通用的增删改查接口
- **`memory-manager.ts`** - 具体实现类，用于管理记忆/历史知识
- **`note-manager.ts`** - 具体实现类，用于管理笔记类知识

#### 2. docs/ 目录下的知识库相关文档
- **`history-knowledge-base.md`** (本文件) - 历史开发知识库，记录开发中的问题和解决方案

#### 3. Business-insurance-knowledge/ 业务知识目录
- **`wechat/`** - 微信公众号相关的业务知识

#### 4. Business-AI-knowledge/ AI 业务知识目录
- **`wechat/`** - 微信公众号相关的 AI 业务知识

#### 5. 代码中引用的 knowledge 文件
搜索整个项目，发现以下代码文件引用了 knowledge 相关功能：
- `src/app/api/execute/route.ts` - 执行代理，处理任务执行
- `src/app/api/agentB/route.ts` - Agent B 决策代理
- `src/app/api/notify/route.ts` - 通知代理
- `src/app/api/capability/route.ts` - 能力管理 API
- 以及多个子任务相关的 API 文件

### 📝 知识库架构总结

项目的知识库系统采用分层架构：

1. **基础层**：`base-manager.ts` 提供通用接口
2. **实现层**：`memory-manager.ts` 和 `note-manager.ts` 分别实现不同类型的知识管理
3. **业务层**：`Business-*-knowledge/` 目录存放具体业务领域的知识
4. **文档层**：`docs/` 目录存放开发过程中的经验和总结

### 💡 最佳实践建议

1. **历史知识库**（本文件）：记录开发过程中的问题和解决方案，便于团队复用
2. **业务知识库**：按业务领域分类存储，如 `Business-insurance-knowledge/wechat/`
3. **代码知识库**：使用 `memory-manager` 和 `note-manager` 在运行时管理动态知识

---

## 附录：文件查找命令记录

```bash
# 查找所有包含 "knowledge" 的文件
grep -r "knowledge" /workspace/projects --include="*.ts" --include="*.tsx" --include="*.md" --include="*.json"

# 查找 knowledge 目录下的所有文件
ls -la /workspace/projects/src/utils/knowledge/

# 查找 docs 目录下的所有文件
ls -la /workspace/projects/docs/
```

**查找时间**：2026-03-03  
**查找人**：AI Assistant
