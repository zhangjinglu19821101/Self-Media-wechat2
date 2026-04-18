# 多事业部架构设计方案

## 1. 架构目标

支持快速复制事业部（从保险事业部到AI事业部），最小化代码修改和重复工作。

## 2. 当前架构分析

### 2.1 硬编码问题

**问题1：Agent ID 硬编码**
- `/api/commands/send/route.ts`: `fromAgentId: 'insurance-d'`
- 需要根据任务动态获取 Agent ID

**问题2：保存路径硬编码**
- `saveArticleToFile()`: `backup/agent_log/insurance-d/文章初稿/`
- 需要根据事业部配置动态生成路径

**问题3：系统提示词硬编码**
- `buildSystemPrompt()`: "你是一个保险内容创作助手"
- 需要根据 Agent 配置动态生成提示词

**问题4：业务逻辑耦合**
- 保险特定的逻辑（如文章保存格式、合规校验流程）
- 需要抽象为可配置的业务逻辑

### 2.2 可复用部分

✅ **已通用化的组件**：
- Agent B（架构师智能体）：技术/合规/知识兜底，已支持AI+保险
- 全局调度系统：`src/lib/global-schedule/` - 基本通用
- Agent 通信机制：`/api/commands/send/` - 接口通用
- Agent 注册系统：`agentBuilder` - 已支持多Agent

## 3. 架构设计方案

### 3.1 核心原则

1. **配置驱动**：事业部特定信息通过配置文件管理
2. **接口抽象**：定义统一的 Agent 接口和业务逻辑接口
3. **模板化**：提示词、任务模板支持参数化
4. **分层解耦**：通用框架层 + 事业部特定层

### 3.2 分层架构

```
┌─────────────────────────────────────────┐
│   事业部配置层（Division Config Layer）   │
│  - 事业部配置文件（JSON/YAML）            │
│  - Agent 配置映射                         │
│  - 路径配置                               │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│    事业部适配层（Division Adapter）       │
│  - 提示词模板管理                         │
│  - 业务逻辑适配器                         │
│  - 文件路径解析器                         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│    通用框架层（Common Framework）         │
│  - Agent 注册系统                         │
│  - 全局调度系统                           │
│  - Agent 通信机制                         │
│  - 任务管理系统                           │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│    基础设施层（Infrastructure）           │
│  - LLM 集成                               │
│  - 文件系统                               │
│  - 数据库                                 │
│  - SSE 通知                               │
└─────────────────────────────────────────┘
```

### 3.3 核心设计

#### 3.3.1 事业部配置文件

**位置**: `config/divisions.json`

```json
{
  "divisions": {
    "insurance": {
      "name": "保险事业部",
      "code": "INS",
      "agents": {
        "content": {
          "agentId": "insurance-d",
          "agentName": "保险内容创作智能体",
          "promptFile": "src/lib/agents/prompts/insurance-d.md",
          "role": "content_creation",
          "businessType": "insurance"
        },
        "operation": {
          "agentId": "insurance-c",
          "agentName": "保险运营智能体",
          "promptFile": "src/lib/agents/prompts/insurance-c.md",
          "role": "operation",
          "businessType": "insurance"
        }
      },
      "paths": {
        "root": "./backup/agent_log",
        "draft": "{root}/{agentId}/文章初稿",
        "final": "{root}/{agentId}/文章终稿",
        "compliance": "{root}/{agentId}/校验记录",
        "templates": "{root}/{agentId}/模版文章"
      },
      "taskTemplates": {
        "daily_draft": {
          "taskName": "文章初稿生成",
          "schedule": "daily",
          "hour": 6,
          "minute": 0,
          "taskType": "draft_6h",
          "contentDirection": "case_analysis",
          "wordCount": 1550,
          "materialSource": "优先调用Agent B知识库，无对应素材可调用行业合规渠道",
          "complianceRule": "严格遵循Agent B微信公众号合规规则+保险行业监管要求"
        },
        "daily_final": {
          "taskName": "文章合规校验+自主修正+终稿生成",
          "schedule": "daily",
          "hour": 7,
          "minute": 0,
          "taskType": "final_7h",
          "dependencies": ["daily_draft"]
        }
      }
    },
    "ai": {
      "name": "AI事业部",
      "code": "AI",
      "agents": {
        "content": {
          "agentId": "ai-content-d",
          "agentName": "AI内容创作智能体",
          "promptFile": "src/lib/agents/prompts/ai-content-d.md",
          "role": "content_creation",
          "businessType": "ai"
        },
        "operation": {
          "agentId": "ai-operation-c",
          "agentName": "AI运营智能体",
          "promptFile": "src/lib/agents/prompts/ai-operation-c.md",
          "role": "operation",
          "businessType": "ai"
        }
      },
      "paths": {
        "root": "./backup/agent_log",
        "draft": "{root}/{agentId}/内容初稿",
        "final": "{root}/{agentId}/内容终稿",
        "compliance": "{root}/{agentId}/校验记录",
        "templates": "{root}/{agentId}/模版文章"
      },
      "taskTemplates": {
        "daily_draft": {
          "taskName": "内容初稿生成",
          "schedule": "daily",
          "hour": 6,
          "minute": 0,
          "taskType": "draft_6h",
          "contentDirection": "case_analysis",
          "wordCount": 1600,
          "materialSource": "优先调用Agent B知识库",
          "complianceRule": "严格遵循Agent B微信公众号合规规则"
        }
      }
    }
  },
  "shared": {
    "agents": {
      "A": {
        "agentId": "A",
        "agentName": "总裁智能体",
        "promptFile": "src/lib/agents/prompts/A.md",
        "role": "manager"
      },
      "B": {
        "agentId": "B",
        "agentName": "架构师智能体",
        "promptFile": "src/lib/agents/prompts/B.md",
        "role": "architect"
      }
    },
    "paths": {
      "root": "./backup/agent_log",
      "compliance": "{root}/AgentB/合规规则",
      "knowledge": "{root}/AgentB/知识库"
    }
  }
}
```

#### 3.3.2 事业部管理器

**文件**: `src/lib/divisions/division-manager.ts`

```typescript
import { promises as fs } from 'fs';
import path from 'path';

export interface DivisionConfig {
  name: string;
  code: string;
  agents: Record<string, AgentConfig>;
  paths: Record<string, string>;
  taskTemplates: Record<string, TaskTemplate>;
}

export interface AgentConfig {
  agentId: string;
  agentName: string;
  promptFile: string;
  role: 'content_creation' | 'operation' | 'manager' | 'architect';
  businessType: string;
}

export interface TaskTemplate {
  taskName: string;
  schedule: 'daily' | 'weekly' | 'monthly' | 'once';
  hour: number;
  minute: number;
  taskType: 'draft_6h' | 'final_7h' | 'normal_create';
  contentDirection?: string;
  wordCount?: number;
  materialSource?: string;
  complianceRule?: string;
  dependencies?: string[];
}

export class DivisionManager {
  private static config: any = null;

  static async loadConfig(): Promise<any> {
    if (!this.config) {
      const configPath = path.join(process.cwd(), 'config', 'divisions.json');
      const content = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(content);
    }
    return this.config;
  }

  static getDivision(divisionCode: string): DivisionConfig | null {
    return this.config?.divisions?.[divisionCode] || null;
  }

  static getAgentConfig(agentId: string): AgentConfig | null {
    // 在所有事业部中查找 Agent 配置
    for (const division of Object.values(this.config?.divisions || {})) {
      const agent = (division as DivisionConfig).agents[agentId];
      if (agent) return agent as AgentConfig;
    }
    return this.config?.shared?.agents?.[agentId] || null;
  }

  static resolvePath(template: string, variables: Record<string, string>): string {
    let path = template;
    for (const [key, value] of Object.entries(variables)) {
      path = path.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return path;
  }

  static getTaskTemplate(divisionCode: string, templateKey: string): TaskTemplate | null {
    const division = this.getDivision(divisionCode);
    return division?.taskTemplates?.[templateKey] || null;
  }
}
```

#### 3.3.3 提示词模板管理器

**文件**: `src/lib/prompts/prompt-template-manager.ts`

```typescript
import { DivisionManager } from '@/lib/divisions/division-manager';
import { promises as fs } from 'fs';
import path from 'path';

export class PromptTemplateManager {
  /**
   * 构建系统提示词（支持事业部和业务类型）
   */
  static async buildSystemPrompt(
    agentId: string,
    taskParams?: any
  ): Promise<string> {
    // 获取 Agent 配置
    const agentConfig = DivisionManager.getAgentConfig(agentId);
    if (!agentConfig) {
      throw new Error(`Agent ${agentId} 配置未找到`);
    }

    // 读取提示词模板
    const promptPath = path.join(process.cwd(), agentConfig.promptFile);
    const template = await fs.readFile(promptPath, 'utf-8');

    // 如果有任务参数，进行参数替换
    if (taskParams?.createRequirement) {
      const req = taskParams.createRequirement;
      let systemPrompt = template;

      // 替换业务特定占位符
      systemPrompt = systemPrompt.replace(/\{BUSINESS_TYPE\}/g, agentConfig.businessType);
      systemPrompt = systemPrompt.replace(/\{AGENT_ROLE\}/g, agentConfig.role);

      // 添加任务特定要求
      if (taskParams.taskType === 'draft_6h') {
        systemPrompt += `\n\n【当前任务】文章初稿生成\n`;
        systemPrompt += `- 内容方向：${req.contentDirection}\n`;
        systemPrompt += `- 字数要求：${req.wordCount}字\n`;
        systemPrompt += `- 素材来源：${req.materialSource}\n`;
        systemPrompt += `- 合规规则：${req.complianceRule}\n`;
      }

      return systemPrompt;
    }

    return template;
  }

  /**
   * 获取提示词模板（支持事业部复制）
   */
  static async getPromptTemplate(
    sourceAgentId: string,
    targetDivisionCode: string,
    targetRole: string
  ): Promise<string> {
    // 读取源 Agent 提示词
    const sourceConfig = DivisionManager.getAgentConfig(sourceAgentId);
    const sourcePath = path.join(process.cwd(), sourceConfig!.promptFile);
    let template = await fs.readFile(sourcePath, 'utf-8');

    // 替换事业部特定内容
    const targetDivision = DivisionManager.getDivision(targetDivisionCode);
    template = template.replace(new RegExp(sourceConfig!.businessType, 'g'), targetDivision!.name);

    return template;
  }
}
```

#### 3.3.4 业务逻辑适配器

**文件**: `src/lib/divisions/business-adapter.ts`

```typescript
import { DivisionManager } from './division-manager';
import * as fs from 'fs';
import * as path from 'path';

export class BusinessAdapter {
  /**
   * 保存文章到文件（支持事业部）
   */
  static async saveArticle(
    agentId: string,
    content: string,
    taskId: string,
    taskName: string,
    fileType: 'draft' | 'final' | 'compliance'
  ): Promise<string> {
    // 获取事业部配置
    const agentConfig = DivisionManager.getAgentConfig(agentId);
    const divisionCode = agentConfig?.businessType === 'insurance' ? 'insurance' : 'ai';

    // 解析保存路径
    const division = DivisionManager.getDivision(divisionCode);
    const rootPath = path.join(
      process.env.COZE_WORKSPACE_PATH || '/workspace/projects',
      'backup',
      'agent_log'
    );

    let savePath: string;
    switch (fileType) {
      case 'draft':
        savePath = path.join(rootPath, agentId, division!.paths.draft.split('/').pop()!);
        break;
      case 'final':
        savePath = path.join(rootPath, agentId, division!.paths.final.split('/').pop()!);
        break;
      case 'compliance':
        savePath = path.join(rootPath, agentId, division!.paths.compliance.split('/').pop()!);
        break;
    }

    // 确保目录存在
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
    }

    // 生成文件名
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '').slice(0, 19).replace('T', '_');
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePrefix = fileType === 'draft' ? '文章初稿' : fileType === 'final' ? '文章终稿' : '校验记录';
    const filename = `${filePrefix}_${timestamp}_${safeTaskId}.md`;
    const filepath = path.join(savePath, filename);

    // 写入文件
    fs.writeFileSync(filepath, content, 'utf-8');

    console.log(`✅ 文件已保存: ${filepath}`);
    return filepath;
  }

  /**
   * 构建任务参数（支持事业部模板）
   */
  static buildTaskParams(
    divisionCode: string,
    templateKey: string,
    taskId: string
  ): any {
    const template = DivisionManager.getTaskTemplate(divisionCode, templateKey);
    if (!template) {
      throw new Error(`任务模板 ${templateKey} 不存在`);
    }

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 6);

    return {
      taskType: template.taskType,
      taskId,
      createRequirement: {
        contentDirection: template.contentDirection || 'case_analysis',
        wordCount: template.wordCount || 1550,
        materialSource: template.materialSource || '优先调用Agent B知识库',
        complianceRule: template.complianceRule || '严格遵循合规规则',
      },
      triggerSource: 'ts_schedule',
      timeout: 45,
    };
  }
}
```

### 3.4 重构计划

#### 阶段1：创建事业部配置基础设施
1. 创建 `config/divisions.json` 配置文件
2. 实现 `DivisionManager`
3. 实现 `PromptTemplateManager`
4. 实现 `BusinessAdapter`

#### 阶段2：重构现有代码
1. 重构 `/api/commands/send/route.ts`：
   - 使用 `DivisionManager` 动态获取 Agent 配置
   - 使用 `BusinessAdapter` 保存文章
   - 使用 `PromptTemplateManager` 构建系统提示词

2. 重构全局调度系统：
   - 使用事业部配置生成任务
   - 支持从模板创建任务

#### 阶段3：测试验证
1. 验证保险事业部功能正常
2. 创建 AI 事业部配置
3. 测试 AI 事业部功能
4. 编写事业部复制脚本

## 4. 事业部复制流程

### 4.1 自动化复制脚本

**文件**: `scripts/division-clone.ts`

```typescript
import { DivisionManager } from '@/lib/divisions/division-manager';
import { PromptTemplateManager } from '@/lib/prompts/prompt-template-manager';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 复制事业部
 */
async function cloneDivision(
  sourceDivisionCode: string,
  targetDivisionCode: string,
  targetName: string
) {
  console.log(`📋 开始复制事业部: ${sourceDivisionCode} → ${targetDivisionCode}`);

  // 1. 复制配置
  const sourceDivision = DivisionManager.getDivision(sourceDivisionCode);
  const targetDivision = {
    ...sourceDivision,
    code: targetDivisionCode,
    name: targetName,
  };

  // 2. 生成新的 Agent 提示词
  for (const [agentKey, agentConfig] of Object.entries(targetDivision.agents)) {
    const sourceAgentId = (agentConfig as any).agentId;
    const newAgentId = sourceAgentId.replace(sourceDivisionCode, targetDivisionCode);

    // 读取源提示词并替换事业部名称
    const promptTemplate = await PromptTemplateManager.getPromptTemplate(
      sourceAgentId,
      targetDivisionCode,
      (agentConfig as any).role
    );

    // 保存新提示词
    const promptPath = path.join(
      process.cwd(),
      'src/lib/agents/prompts',
      `${newAgentId}.md`
    );
    await fs.writeFile(promptPath, promptTemplate, 'utf-8');

    // 更新 Agent 配置
    (targetDivision.agents[agentKey] as any).agentId = newAgentId;
    (targetDivision.agents[agentKey] as any).promptFile = `src/lib/agents/prompts/${newAgentId}.md`;
  }

  // 3. 更新配置文件
  const config = await DivisionManager.loadConfig();
  config.divisions[targetDivisionCode] = targetDivision;
  const configPath = path.join(process.cwd(), 'config', 'divisions.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

  // 4. 创建目录结构
  const rootPath = path.join(process.cwd(), 'backup/agent_log');
  for (const agentKey of Object.keys(targetDivision.agents)) {
    const agentId = (targetDivision.agents[agentKey] as any).agentId;
    const agentPath = path.join(rootPath, agentId);
    if (!fs.existsSync(agentPath)) {
      fs.mkdirSync(agentPath, { recursive: true });
    }
  }

  console.log(`✅ 事业部复制完成: ${targetDivisionCode}`);
  console.log(`   - 提示词文件: ${Object.keys(targetDivision.agents).length} 个`);
  console.log(`   - 任务模板: ${Object.keys(targetDivision.taskTemplates).length} 个`);
}

// 执行复制
cloneDivision('insurance', 'ai', 'AI事业部');
```

### 4.2 复制命令

```bash
# 从保险事业部复制到 AI 事业部
pnpm tsx scripts/division-clone.ts insurance ai "AI事业部"

# 复制后需要手动调整：
# 1. 检查并更新提示词中的业务特定内容
# 2. 调整任务模板中的参数
# 3. 测试新事业部的功能
```

## 5. 实施计划

### 阶段1：基础设施搭建（2-3小时）
- [ ] 创建事业部配置文件
- [ ] 实现 DivisionManager
- [ ] 实现 PromptTemplateManager
- [ ] 实现 BusinessAdapter

### 阶段2：代码重构（3-4小时）
- [ ] 重构 /api/commands/send/route.ts
- [ ] 重构全局调度系统
- [ ] 更新现有保险事业部配置
- [ ] 测试保险事业部功能

### 阶段3：AI事业部创建（1-2小时）
- [ ] 创建 AI 事业部配置
- [ ] 生成 AI 事业部提示词
- [ ] 创建目录结构
- [ ] 测试 AI 事业部功能

### 阶段4：文档和优化（1小时）
- [ ] 编写事业部复制文档
- [ ] 编写最佳实践指南
- [ ] 优化复制脚本

## 6. 预期效果

### 复制新事业部的步骤（5分钟）

1. **运行复制命令**：
   ```bash
   pnpm tsx scripts/division-clone.ts <source> <target> "<name>"
   ```

2. **调整配置**（可选）：
   - 编辑 `config/divisions.json` 中的任务模板
   - 调整提示词中的业务特定内容

3. **测试功能**：
   ```bash
   # 测试新事业部的 Agent
   curl -X POST http://localhost:5000/api/agents/<new-agent-id>/chat
   ```

### 维护成本

- **新增事业部**：5分钟 + 配置调整
- **修改通用功能**：修改一次，所有事业部受益
- **修改事业部特定功能**：仅修改对应配置和提示词

## 7. 风险和挑战

### 风险1：配置复杂度增加
- **缓解措施**：提供配置验证工具和生成向导

### 风险2：提示词差异化
- **缓解措施**：建立提示词模板库，支持参数化和继承

### 风险3：测试覆盖不足
- **缓解措施**：编写事业部测试套件，支持快速验证

## 8. 总结

本架构方案通过以下方式支持快速复制事业部：

1. **配置驱动**：事业部信息集中在配置文件中
2. **接口抽象**：统一的 Agent 接口和业务逻辑接口
3. **模板化**：提示词和任务支持模板复用
4. **自动化工具**：提供复制脚本，最小化手动操作

通过这套架构，新事业部的复制时间从数天缩短到数分钟，同时保持了代码的可维护性和可扩展性。
