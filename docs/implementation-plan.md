# 实施方案：三个核心任务

## 任务概览

| 任务 | 优先级 | 核心价值 | 预计时间 |
|------|--------|---------|---------|
| **任务1：RAG实现微信公众号平台** | P0 | 验证平台架构，作为第一个落地场景 | 4-5小时 |
| **任务2：架构调整** | P1 | 实现多事业部×多平台架构 | 6-8小时 |
| **任务3：AI辅助写作核心功能** | P0 | 产品核心功能，直接面向用户 | 8-10小时 |

**总计**：约 18-23 小时

---

## 任务1：RAG实现微信公众号平台

### 目标
- 创建第一个落地的平台（微信公众号）
- 验证平台适配器架构
- 实现基础RAG功能
- 作为后续其他平台的参考

### 实施步骤

#### 步骤1.1：创建微信公众号规则文件（1小时）

**文件1：合规规则**
```
文件：rules/platforms/wechat-compliance.md
内容：
- 内容禁止项
- 敏感词列表
- 合规检查项
- 典型违规案例
```

**文件2：运营规则**
```
文件：rules/platforms/wechat-operation.md
内容：
- 发布时机建议
- 标题优化技巧
- 引导关注策略
- 互动引导方式
```

**文件3：格式规则**
```
文件：rules/platforms/wechat-format.md
内容：
- 字数要求（800-2000字）
- 格式要求（Markdown）
- 标题层级
- 排版建议
```

#### 步骤1.2：创建微信公众号适配器（2小时）

```typescript
文件：src/lib/platforms/adapters/wechat-adapter.ts

功能：
1. validateCompliance(content) - 合规校验
2. formatContent(content) - 格式化
3. applyOperationRules(content) - 应用运营规则
4. getPlatformSpecificPrompt(basePrompt) - 获取平台特定提示词
```

#### 步骤1.3：实现基础RAG功能（1-2小时）

```typescript
文件：src/lib/rag/basic-rag.ts

功能：
1. 向量化文档（embedding）
2. 存储到向量数据库
3. 检索相关文档
4. 构建上下文
5. LLM生成回答
```

#### 步骤1.4：测试验证（1小时）

```bash
# 测试合规校验
curl -X POST http://localhost:5000/api/platforms/wechat/validate

# 测试格式化
curl -X POST http://localhost:5000/api/platforms/wechat/format

# 测试RAG问答
curl -X POST http://localhost:5000/api/rag/query
```

---

## 任务2：架构调整

### 目标
- 实现多事业部×多平台架构
- 创建配置文件
- 实现统一管理器
- 支持快速扩展

### 实施步骤

#### 步骤2.1：创建配置文件（2小时）

```json
文件：config/platforms-and-divisions.json

内容：
1. 平台配置（微信公众号 + 其他平台预留）
2. 事业部配置（保险事业部 + 其他事业部预留）
3. 共享配置（Agent A、Agent B）
```

#### 步骤2.2：实现统一配置管理器（2小时）

```typescript
文件：src/lib/config/unified-config-manager.ts

功能：
1. loadConfig() - 加载配置
2. getPlatformConfig() - 获取平台配置
3. getDivisionConfig() - 获取事业部配置
4. getAgentId() - 获取完整Agent ID
5. getPlatformAdapter() - 获取平台适配器
```

#### 步骤2.3：重构现有代码（2小时）

```typescript
重构文件：
1. src/app/api/commands/send/route.ts
   - 使用UnifiedConfigManager
   - 动态获取Agent配置
   - 使用BusinessAdapter保存文件

2. src/lib/global-schedule/scheduler.ts
   - 支持事业部×平台配置
   - 支持从模板创建任务
```

#### 步骤2.4：实现统一指令管理（1小时）

```typescript
文件：src/app/api/unified-commands/send/route.ts

功能：
1. 接收统一指令（事业部 + 平台）
2. 获取对应的平台适配器
3. 应用平台特定规则
4. 发送到对应的Agent
```

#### 步骤2.5：测试验证（1小时）

```bash
# 测试配置加载
curl http://localhost:5000/api/config/status

# 测试统一指令
curl -X POST http://localhost:5000/api/unified-commands/send

# 测试保险事业部×微信公众号
curl -X POST http://localhost:5000/api/unified-commands/send \
  -d '{"divisionCode":"insurance","platformCode":"wechat"}'
```

---

## 任务3：AI辅助写作核心功能（重点）

### 目标（核心价值）
- **人工输出核心文章内容（材料）**
- **AI基于材料进行辅助写作**
- **AI根据不同平台规则调整内容**
- **一键部署到多个平台**

### 工作流程

```
┌─────────────────────────────────────────────────┐
│  用户输入核心材料                                 │
│  (文本/文档/链接)                                 │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  AI理解材料                                      │
│  - 提取核心观点                                   │
│  - 识别关键信息                                   │
│  - 理解业务逻辑                                   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  AI辅助写作                                      │
│  - 基于材料扩展内容                               │
│  - 优化表达方式                                   │
│  - 补充案例和数据                                 │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  平台适配                                        │
│  微信公众号 → 800-2000字，长文格式                │
│  小红书 → 300-1000字，图文+emoji                  │
│  知乎 → 1500-5000字，专业长文                     │
│  ...                                             │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  合规校验                                        │
│  - 每个平台独立的合规规则                          │
│  - 自动检测违规内容                               │
│  - 提供修改建议                                   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  一键部署到多个平台                               │
│  - 批量发布                                       │
│  - 进度跟踪                                       │
│  - 结果反馈                                       │
└─────────────────────────────────────────────────┘
```

### 实施步骤

#### 步骤3.1：材料输入功能（2小时）

**文件1：材料输入接口**
```typescript
文件：src/app/api/writing/material-upload/route.ts

功能：
1. 接收文本材料
2. 接收文档上传（PDF、Word、Markdown）
3. 接收URL（自动抓取内容）
4. 存储材料到数据库
```

**文件2：材料处理服务**
```typescript
文件：src/lib/services/material-processor.ts

功能：
1. 文本提取（从文档）
2. 内容清洗
3. 结构化处理
4. 向量化（用于RAG）
```

#### 步骤3.2：AI理解材料（2小时）

**文件1：材料理解服务**
```typescript
文件：src/lib/ai/material-understander.ts

功能：
1. 提取核心观点（关键句子）
2. 识别关键信息（时间、地点、人物、数据）
3. 理解业务逻辑（因果、层次、重点）
4. 生成材料摘要
```

**文件2：理解Prompt**
```typescript
请分析以下材料，提取核心信息：

【材料】
{material}

【分析要求】
1. 提取3-5个核心观点
2. 识别关键信息（时间、地点、人物、数据）
3. 理解业务逻辑和重点
4. 生成200字摘要

【输出格式】
{
  "corePoints": ["观点1", "观点2", ...],
  "keyInfo": {"时间": "...", "地点": "...", ...},
  "businessLogic": "...",
  "summary": "..."
}
```

#### 步骤3.3：AI辅助写作（3小时）

**文件1：写作服务**
```typescript
文件：src/lib/ai/content-writer.ts

功能：
1. 基于材料理解结果生成内容
2. 扩展和优化表达
3. 补充案例和数据
4. 保持原意和准确性
```

**文件2：写作Prompt**
```typescript
基于以下材料理解结果，撰写文章：

【材料理解】
{materialUnderstanding}

【写作要求】
1. 保持原意和准确性
2. 扩展表达，增加细节
3. 补充相关的案例和数据
4. 使用通俗易懂的语言
5. 结构清晰，逻辑连贯

【输出格式】
# 标题
{自动生成标题}

## 正文
{正文内容，1500-1600字}

## 总结
{总结段落}
```

#### 步骤3.4：平台适配（2小时）

**文件1：平台适配服务**
```typescript
文件：src/lib/services/platform-adapter-service.ts

功能：
1. 接收统一内容
2. 为每个平台调用对应的适配器
3. 生成平台特定版本的内容
4. 返回所有平台版本
```

**文件2：适配流程**
```typescript
async function adaptContentToPlatforms(
  content: string,
  divisionCode: string,
  targetPlatforms: string[]
) {
  const results = [];

  for (const platformCode of targetPlatforms) {
    // 1. 获取平台适配器
    const adapter = await UnifiedConfigManager.getPlatformAdapter(platformCode);

    // 2. 格式化内容
    const formatted = await adapter.formatContent(content);

    // 3. 应用运营规则
    const operationApplied = await adapter.applyOperationRules(formatted);

    // 4. 合规校验
    const validation = await adapter.validateCompliance(operationApplied.content);

    results.push({
      platform: platformCode,
      content: operationApplied.content,
      validation: validation,
      metadata: operationApplied.metadata
    });
  }

  return results;
}
```

#### 步骤3.5：合规校验与修改（1小时）

**文件1：合规校验服务**
```typescript
文件：src/lib/services/compliance-checker.ts

功能：
1. 执行合规校验
2. 违规内容检测
3. 提供修改建议
4. 自动修复部分问题
```

**文件2：校验流程**
```typescript
async function checkAndFixCompliance(
  content: string,
  platformCode: string
) {
  const adapter = await UnifiedConfigManager.getPlatformAdapter(platformCode);

  // 1. 合规校验
  const validation = await adapter.validateCompliance(content);

  if (!validation.valid) {
    // 2. 提供修改建议
    const suggestions = generateSuggestions(validation.errors);

    // 3. 自动修复部分问题（如替换敏感词）
    const fixed = autoFixIssues(content, validation.errors);

    return {
      original: content,
      fixed: fixed,
      validation: validation,
      suggestions: suggestions
    };
  }

  return {
    original: content,
    fixed: content,
    validation: validation,
    suggestions: []
  };
}
```

#### 步骤3.6：一键部署（1小时）

**文件1：部署服务**
```typescript
文件：src/lib/services/deployment-service.ts

功能：
1. 批量部署到多个平台
2. 进度跟踪
3. 结果反馈
4. 失败重试
```

**文件2：部署流程**
```typescript
async function deployToPlatforms(
  contents: Array<{
    platformCode: string;
    content: string;
  }>,
  deploymentId: string
) {
  const results = [];

  for (const item of contents) {
    try {
      // 1. 保存到文件系统
      const filePath = await saveContentToFile(
        item.platformCode,
        item.content,
        deploymentId
      );

      // 2. 发布到平台（如果集成了平台API）
      // const platformResponse = await publishToPlatformAPI(...);

      results.push({
        platform: item.platformCode,
        status: 'success',
        filePath: filePath
      });

    } catch (error) {
      results.push({
        platform: item.platformCode,
        status: 'failed',
        error: error.message
      });
    }
  }

  return results;
}
```

#### 步骤3.7：统一接口（1小时）

**文件1：写作接口**
```typescript
文件：src/app/api/writing/create-and-deploy/route.ts

请求：
{
  "divisionCode": "insurance",
  "material": "核心材料内容...",
  "targetPlatforms": ["wechat", "xiaohongshu", "zhihu"],
  "options": {
    "autoFix": true,
    "deployImmediately": true
  }
}

响应：
{
  "success": true,
  "data": {
    "taskId": "task-xxx",
    "materialSummary": "...",
    "platformContents": [
      {
        "platform": "wechat",
        "content": "...",
        "validation": { "valid": true, "errors": [], "warnings": [] },
        "deployStatus": "success"
      },
      {
        "platform": "xiaohongshu",
        "content": "...",
        "validation": { "valid": true, "errors": [], "warnings": ["建议添加更多emoji"] },
        "deployStatus": "success"
      }
    ]
  }
}
```

---

## 实施计划（时间安排）

### Week 1：任务1（微信公众号）

**Day 1-2**：
- 创建微信公众号规则文件（3个文件，1小时）
- 创建微信公众号适配器（2小时）
- 测试验证（1小时）

**Day 3**：
- 实现基础RAG功能（2小时）
- 测试RAG功能（1小时）

**Day 4-5**：
- 集成到现有系统（2小时）
- 完整测试（1小时）
- 文档编写（1小时）

### Week 2：任务2（架构调整）

**Day 6-7**：
- 创建配置文件（2小时）
- 实现统一配置管理器（2小时）

**Day 8-9**：
- 重构现有代码（2小时）
- 实现统一指令管理（1小时）
- 测试验证（1小时）

**Day 10**：
- 完整测试（2小时）
- 文档编写（1小时）

### Week 3：任务3（AI辅助写作）

**Day 11-12**：
- 实现材料输入功能（2小时）
- 实现AI理解材料（2小时）

**Day 13-14**：
- 实现AI辅助写作（3小时）
- 实现平台适配（2小时）

**Day 15-16**：
- 实现合规校验与修改（1小时）
- 实现一键部署（1小时）
- 实现统一接口（1小时）

**Day 17-18**：
- 完整测试（3小时）
- 用户测试（2小时）
- 文档编写（2小时）

---

## 技术要点

### 1. 材料理解
- 使用LLM提取核心观点
- 使用RAG补充相关知识和案例
- 保持原意和准确性

### 2. 平台适配
- 使用平台适配器模式
- 每个平台独立的规则
- 自动格式化和优化

### 3. 合规校验
- 敏感词检测
- 格式检查
- 自动修复和人工审核结合

### 4. 批量部署
- 并发处理多个平台
- 进度跟踪
- 失败重试机制

---

## 核心价值

### 对用户的价值

| 功能 | 价值 |
|------|------|
| **材料输入** | 支持多种方式，方便快捷 |
| **AI理解** | 准确理解核心观点，不偏离原意 |
| **AI辅助写作** | 提升写作效率，保证内容质量 |
| **平台适配** | 一键生成多平台版本，节省时间 |
| **合规校验** | 避免违规，降低风险 |
| **批量部署** | 一次操作，多平台发布 |

### 对产品的价值

| 功能 | 价值 |
|------|------|
| **差异化** | 独特的"材料→内容→部署"流程 |
| **易用性** | 操作简单，无需技术背景 |
| **可扩展性** | 快速增加平台和事业部 |
| **稳定性** | 架构清晰，易于维护 |

---

## 下一步

1. **立即开始任务1**：RAG实现微信公众号平台
2. **准备材料库**：收集保险、AI等行业的素材
3. **设计用户界面**：材料输入、内容预览、部署界面
4. **准备种子用户**：找1-2个客户测试

---

**准备开始实施吗？我可以先从任务1开始！**
