# AI 事业部管理功能标准化方案

## 📋 方案概述

### 核心目标
构建一个**配置驱动、模块复用、快速接入**的标准化 AI 事业部管理平台，实现：
- ✅ Agent T（技术能力）+ Agent B（协调能力）100% 复用
- ✅ 业务团队能力通过**配置文件**快速定义和修改
- ✅ 新事业部接入时间从「周级」降到「天级」

---

## 🏗️ 当前架构评估

### ✅ 已有的优秀基础

#### 1. Agent 角色配置系统
**文件**: `src/lib/agents/agent-roles-config.ts`

**优势**:
- 已实现标准化的 Agent 角色定义
- 支持标准响应和自定义响应两种模式
- 有完整的任务描述、响应示例、判断标准配置

**当前实现**:
```typescript
interface AgentRoleConfig {
  id: AgentRole;
  name: string;
  description: string;
  version: string;
  responseType: 'standard' | 'custom';
  tasks: AgentTaskDescription[];
  // ...
}
```

#### 2. 执行者身份配置
**文件**: `src/lib/agents/executor-identity-config.ts`

**优势**:
- 自然语言声明，便于 Agent B 智能理解
- 清晰的职责边界定义
- 支持智能路由判断

#### 3. 核心 Agent 实现
- **Agent T**: 技术专家，负责 MCP 调用、合规校验等
- **Agent B**: 业务协调专家，负责任务流转、用户交互等
- **子任务执行引擎**: 完整的任务状态机和执行流程

#### 4. MCP 能力管理
- `capability_list` 表：存储可用的 MCP 能力
- 支持能力匹配、参数映射、结果解析

---

## 🎯 标准化架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      平台层 (Platform Layer)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Agent T (技术专家 - 100% 复用)                       │  │
│  │  - MCP 调用管理                                        │  │
│  │  - 合规校验引擎                                        │  │
│  │  - 技术执行路由                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Agent B (协调专家 - 100% 复用)                       │  │
│  │  - 任务拆解与分配                                      │  │
│  │  - 流程状态管理                                        │  │
│  │  - 用户交互协调                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                   业务配置层 (Business Config Layer)           │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │ 保险事业部配置    │  │ 电商事业部配置    │                  │
│  │ business-insurance│  │ business-ecommerce│                  │
│  └──────────────────┘  └──────────────────┘                  │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │ 教育事业部配置    │  │ [新事业部]       │                  │
│  │ business-education│  │ business-xxx     │                  │
│  └──────────────────┘  └──────────────────┘                  │
├─────────────────────────────────────────────────────────────────┤
│                   配置加载层 (Config Loader)                    │
│  - 热加载支持                                                   │
│  - 配置验证                                                     │
│  - 版本管理                                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 核心设计原则

#### 1. **配置驱动 (Config-Driven)**
- 所有业务逻辑通过配置文件定义
- 代码只负责执行配置，不包含业务逻辑
- 配置变更无需重新部署

#### 2. **模块复用 (Module Reuse)**
- Agent T 和 Agent B 作为「平台级服务」完全复用
- 业务 Agent 作为「插件」接入
- 通用工具库、服务层完全复用

#### 3. **快速接入 (Quick Onboarding)**
- 提供「事业部配置模板」
- 提供「配置生成器」工具
- 提供「配置验证器」确保正确性

---

## 📦 标准化模块设计

### 1. 事业部配置模块 (Business Unit Config)

#### 目录结构
```
src/
├── config/
│   ├── business-units/
│   │   ├── insurance/              # 保险事业部（当前）
│   │   │   ├── index.ts
│   │   │   ├── agents.ts           # Agent 配置
│   │   │   ├── prompts.ts          # 提示词配置
│   │   │   ├── capabilities.ts     # MCP 能力映射
│   │   │   └── workflows.ts        # 工作流配置
│   │   ├── ecommerce/              # 电商事业部（示例）
│   │   │   ├── index.ts
│   │   │   ├── agents.ts
│   │   │   ├── prompts.ts
│   │   │   └── workflows.ts
│   │   └── [new-business]/         # 新事业部
│   │       └── ...
│   └── loader.ts                   # 配置加载器
```

#### 配置文件格式

**文件**: `src/config/business-units/insurance/agents.ts`

```typescript
import { BusinessUnitAgentConfig } from '@/types/business-unit';

export const insuranceAgents: BusinessUnitAgentConfig = {
  businessUnitId: 'insurance',
  businessUnitName: '保险事业部',
  
  // 业务执行者配置
  executors: [
    {
      id: 'insurance-d',
      name: 'D - 保险内容主编',
      identity: '文章创作专家，负责保险科普文章的撰写、修改',
      declaration: `
我是文章创作专家，擅长撰写通俗易懂的保险科普文章。
我负责：
  - 撰写新的保险科普文章
  - 修改完善已有文章内容
重要说明：
  - 技术操作、合规校验不是我负责，请交给 Agent T
      `.trim(),
      
      // 任务配置
      tasks: [
        {
          id: 'insurance-content-creation',
          name: '保险科普文章创作',
          description: '创作适合中老年群体的保险科普文章',
          responseType: 'custom',
          customResponseConfig: {
            formatDescription: '...',
            validationRules: ['...'],
            examples: ['...']
          },
          outputConstraints: [
            '全程用大白话，杜绝专业术语',
            '标题18-26字，包含三类词',
            '全文1000字左右'
          ]
        }
      ],
      
      // 提示词配置（引用外部文件）
      promptFile: './prompts/insurance-d-prompt.md'
    },
    
    {
      id: 'insurance-c',
      name: 'C - 保险运营专家',
      identity: '运营总监，负责运营相关任务',
      declaration: '...',
      tasks: [...]
    }
  ],
  
  // 工作流配置
  workflows: {
    default: [
      {
        name: '内容创作流程',
        steps: [
          { executor: 'insurance-d', taskType: 'content-creation' },
          { executor: 'agent-t', taskType: 'compliance-check' },
          { executor: 'insurance-c', taskType: 'content-review' }
        ]
      }
    ]
  },
  
  // MCP 能力映射
  capabilityMapping: {
    'compliance-check': ['solution-1', 'solution-2'],
    'wechat-publish': ['solution-3']
  }
};
```

### 2. 配置加载器 (Config Loader)

**文件**: `src/config/loader.ts`

```typescript
import { BusinessUnitConfig } from '@/types/business-unit';

export class BusinessUnitConfigLoader {
  private configs: Map<string, BusinessUnitConfig> = new Map();
  private currentBusinessUnit: string = 'insurance'; // 默认
  
  /**
   * 加载事业部配置
   */
  async loadBusinessUnit(businessUnitId: string): Promise<BusinessUnitConfig> {
    // 1. 检查缓存
    if (this.configs.has(businessUnitId)) {
      return this.configs.get(businessUnitId)!;
    }
    
    // 2. 动态加载配置文件
    const configModule = await import(
      `./business-units/${businessUnitId}/index.ts`
    );
    const config = configModule.default;
    
    // 3. 验证配置
    this.validateConfig(config);
    
    // 4. 缓存配置
    this.configs.set(businessUnitId, config);
    
    return config;
  }
  
  /**
   * 验证配置完整性
   */
  private validateConfig(config: BusinessUnitConfig): void {
    // 检查必需字段
    // 检查 Agent 配置
    // 检查工作流配置
    // 检查 MCP 能力映射
  }
  
  /**
   * 热加载配置（支持运行时切换）
   */
  async hotReload(businessUnitId: string): Promise<void> {
    this.configs.delete(businessUnitId);
    await this.loadBusinessUnit(businessUnitId);
  }
  
  /**
   * 获取当前事业部的 Agent 配置
   */
  getAgentConfig(agentId: string) {
    const config = this.configs.get(this.currentBusinessUnit);
    return config?.executors.find(e => e.id === agentId);
  }
}
```

### 3. 事业部切换中间件

**文件**: `src/middleware/business-unit.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { businessUnitConfigLoader } from '@/config/loader';

export async function businessUnitMiddleware(
  request: NextRequest
) {
  // 从请求头、Cookie 或环境变量获取当前事业部
  const businessUnitId = request.headers.get('x-business-unit') || 
    process.env.DEFAULT_BUSINESS_UNIT || 
    'insurance';
  
  // 加载事业部配置
  await businessUnitConfigLoader.loadBusinessUnit(businessUnitId);
  
  // 将事业部信息存储到请求上下文
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-current-business-unit', businessUnitId);
  
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
```

---

## 🔧 核心组件改造

### 1. Agent 提示词生成器改造

**改造前**: 硬编码在各个文件中

**改造后**: 从配置动态生成

```typescript
// src/lib/agents/prompt-loader.ts

export class DynamicPromptLoader {
  /**
   * 根据当前事业部动态生成 Agent 提示词
   */
  static async getAgentSystemPrompt(agentId: string): Promise<string> {
    const config = businessUnitConfigLoader.getAgentConfig(agentId);
    
    if (!config) {
      throw new Error(`Agent ${agentId} not found in current business unit`);
    }
    
    // 从配置文件加载提示词
    if (config.promptFile) {
      return fs.readFileSync(config.promptFile, 'utf-8');
    }
    
    // 或者从配置动态生成
    return this.generatePromptFromConfig(config);
  }
  
  /**
   * 动态生成执行者身份文本（供 Agent B 使用）
   */
  static buildExecutorIdentityText(): string {
    const config = businessUnitConfigLoader.getCurrentConfig();
    
    let text = '\n\n【执行者身份配置表】\n\n';
    text += '根据当前事业部配置，可用的执行者如下：\n\n';
    
    config.executors.forEach((executor, index) => {
      text += `【执行者 ${index + 1}：${executor.name}】\n`;
      text += `核心身份: ${executor.identity}\n`;
      text += `自我声明: \n${executor.declaration}\n\n`;
    });
    
    // 始终包含 Agent T 和 Agent B
    text += `【平台级执行者】\n`;
    text += `Agent T - 技术专家：负责技术操作、MCP调用、合规校验\n`;
    text += `Agent B - 协调专家：负责任务协调、流程管理\n`;
    
    return text;
  }
}
```

### 2. 任务执行引擎改造

**改造点**: 支持动态工作流

```typescript
// src/lib/services/subtask-execution-engine.ts

export class DynamicSubtaskExecutionEngine {
  /**
   * 根据事业部配置动态执行工作流
   */
  async executeWorkflow(
    workflowName: string,
    taskContext: TaskContext
  ): Promise<ExecutionResult> {
    const config = businessUnitConfigLoader.getCurrentConfig();
    const workflow = config.workflows[workflowName];
    
    if (!workflow) {
      throw new Error(`Workflow ${workflowName} not found`);
    }
    
    // 按工作流步骤执行
    const results = [];
    for (const step of workflow.steps) {
      const result = await this.executeStep(step, taskContext);
      results.push(result);
      
      // 检查是否需要中断
      if (result.needsIntervention) {
        break;
      }
    }
    
    return {
      success: true,
      results,
      workflow: workflowName
    };
  }
}
```

---

## 📋 实施步骤

### 阶段一：基础设施搭建（1-2天）

#### Day 1: 配置系统框架
- [ ] 创建 `src/config/` 目录结构
- [ ] 实现 `BusinessUnitConfigLoader` 配置加载器
- [ ] 实现配置验证器
- [ ] 创建事业部配置 TypeScript 类型定义

#### Day 2: 现有代码迁移
- [ ] 将保险事业部的 Agent 配置提取到配置文件
- [ ] 将保险事业部的提示词提取到独立文件
- [ ] 修改 Agent 提示词生成器，支持动态加载
- [ ] 测试保险事业部功能正常

### 阶段二：核心组件改造（2-3天）

#### Day 3-4: Agent B 改造
- [ ] 修改 Agent B 提示词，支持动态执行者身份
- [ ] 改造任务分配逻辑，从配置读取
- [ ] 实现事业部切换中间件
- [ ] 测试 Agent B 协调逻辑

#### Day 5: 任务执行引擎改造
- [ ] 实现动态工作流执行
- [ ] 改造子任务执行引擎
- [ ] 实现配置热加载
- [ ] 端到端测试

### 阶段三：工具与文档（1-2天）

#### Day 6: 开发工具
- [ ] 创建「事业部配置生成器」CLI 工具
- [ ] 创建「配置验证器」工具
- [ ] 创建「配置模板」目录

#### Day 7: 文档与示例
- [ ] 编写事业部接入指南
- [ ] 创建电商事业部示例配置
- [ ] 创建教育事业部示例配置
- [ ] 编写架构设计文档

### 阶段四：测试与优化（1-2天）

#### Day 8-9: 测试与优化
- [ ] 多事业部切换测试
- [ ] 性能测试
- [ ] 错误处理优化
- [ ] 文档完善

---

## 🚀 新事业部接入流程

### 步骤 1: 创建配置目录
```bash
mkdir -p src/config/business-units/[new-business]/
```

### 步骤 2: 复制模板
```bash
cp -r src/config/business-units/_template/* \
  src/config/business-units/[new-business]/
```

### 步骤 3: 修改配置文件
编辑以下文件：
- `agents.ts` - 定义业务 Agent
- `prompts.ts` - 配置提示词
- `workflows.ts` - 定义工作流
- `capabilities.ts` - 映射 MCP 能力

### 步骤 4: 验证配置
```bash
pnpm validate-config [new-business]
```

### 步骤 5: 切换并测试
```bash
# 设置环境变量
export DEFAULT_BUSINESS_UNIT=[new-business]

# 重启服务并测试
```

---

## 📊 预期效果

### 接入效率提升
- **接入前**: 2-4周（需要修改代码、重新部署）
- **接入后**: 1-2天（仅需修改配置文件）
- **效率提升**: 70-80%

### 代码复用率
- **Agent T**: 100% 复用
- **Agent B**: 100% 复用
- **平台服务**: 90%+ 复用
- **业务代码**: 配置化，零代码

### 维护成本降低
- **修改业务逻辑**: 只需修改配置，无需改代码
- **新增业务 Agent**: 只需添加配置文件
- **排查问题**: 配置与代码分离，问题定位更快

---

## ⚠️ 风险与应对

### 风险 1: 配置复杂度上升
**应对**:
- 提供配置生成器工具
- 提供详细的配置文档和示例
- 实现配置自动验证

### 风险 2: 性能影响
**应对**:
- 配置缓存机制
- 懒加载策略
- 性能监控和优化

### 风险 3: 向后兼容性
**应对**:
- 保持现有保险事业部配置不变
- 提供迁移工具和文档
- 渐进式迁移策略

---

## 🎯 总结

### 核心优势
1. **技术能力完全复用**: Agent T 和 Agent B 无需任何修改
2. **业务能力快速定制**: 通过配置文件定义，无需编码
3. **新事业部快速接入**: 从天级降到小时级
4. **维护成本大幅降低**: 配置与代码分离，问题定位更快

### 下一步行动
1. **立即开始**: 启动阶段一，搭建配置系统框架
2. **并行开发**: 基础设施和核心组件改造可并行
3. **持续验证**: 每阶段完成后进行充分测试
4. **文档优先**: 同步编写文档，确保知识传承

---

*方案制定时间: 2026-04-08*
*方案版本: v1.0*
