/**
 * Agent 配置导出工具
 * 支持将 Agent 配置、技能树、知识库数据打包导出，用于商业化部署
 */

import { AGENT_CONFIGS } from './agent-configs';
import { AGENT_PROMPTS } from './agent-prompts';
import { SKILL_TREES } from './skills';
import { agentKnowledgeBase } from './knowledge-base';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface AgentExportData {
  version: string;
  exportDate: string;
  agents: {
    [agentId: string]: {
      config: any;
      prompt: string;
      skillTree: any;
      knowledgeBase: {
        experience: number;
        knowledge: number;
        history: number;
        memories?: any[];
      };
    };
  };
}

/**
 * 导出所有 Agent 配置（不含知识库内容）
 */
export async function exportAgentConfigs(): Promise<AgentExportData> {
  const exportData: AgentExportData = {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    agents: {},
  };

  // 导出每个 Agent 的配置
  for (const agentId of Object.keys(AGENT_CONFIGS)) {
    const config = AGENT_CONFIGS[agentId];
    const prompt = AGENT_PROMPTS[agentId]?.systemPrompt || '';
    const skillTree = SKILL_TREES[agentId] || {};

    // 获取知识库统计
    const kbStats = await agentKnowledgeBase[agentId]?.getSummary(agentId);

    exportData.agents[agentId] = {
      config,
      prompt,
      skillTree,
      knowledgeBase: kbStats?.summary || { experience: 0, knowledge: 0, history: 0 },
    };
  }

  return exportData;
}

/**
 * 导出指定 Agent 的知识库内容
 */
export async function exportAgentKnowledge(agentId: string): Promise<any[]> {
  const kb = agentKnowledgeBase[agentId];
  if (!kb) {
    throw new Error(`Agent ${agentId} 的知识库不存在`);
  }

  // 尝试搜索所有类型的记忆
  const searchQueries = ['experience', 'knowledge', 'history', '任务', '技术', '决策'];
  const memories: any[] = new Set();

  for (const query of searchQueries) {
    try {
      const result = await kb.searchAgentMemory(agentId, query, 100);
      if (result.results) {
        result.results.forEach(memory => {
          memories.push({
            docId: memory.docId,
            content: memory.content,
            metadata: memory.metadata,
            score: memory.score,
          });
        });
      }
    } catch (error) {
      console.warn(`搜索知识库失败: ${query}`, error);
    }
  }

  return Array.from(memories);
}

/**
 * 导出完整的 Agent 数据（包含知识库内容）
 */
export async function exportAgentComplete(
  agentId: string,
  includeKnowledgeBase: boolean = true
): Promise<any> {
  const config = AGENT_CONFIGS[agentId];
  const prompt = AGENT_PROMPTS[agentId]?.systemPrompt || '';
  const skillTree = SKILL_TREES[agentId] || {};

  const exportData: any = {
    agentId,
    config,
    prompt,
    skillTree,
    knowledgeBase: {
      included: includeKnowledgeBase,
      summary: {},
      memories: [],
    },
    exportDate: new Date().toISOString(),
    version: '1.0.0',
  };

  if (includeKnowledgeBase) {
    try {
      const summary = await agentKnowledgeBase[agentId]?.getSummary(agentId);
      exportData.knowledgeBase.summary = summary?.summary || {};

      const memories = await exportAgentKnowledge(agentId);
      exportData.knowledgeBase.memories = memories;
    } catch (error) {
      console.warn(`导出 ${agentId} 知识库失败:`, error);
    }
  }

  return exportData;
}

/**
 * 导出所有 Agent（完整）
 */
export async function exportAllAgents(
  includeKnowledgeBase: boolean = true
): Promise<{ [agentId: string]: any }> {
  const allExports: { [agentId: string]: any } = {};

  for (const agentId of Object.keys(AGENT_CONFIGS)) {
    allExports[agentId] = await exportAgentComplete(agentId, includeKnowledgeBase);
  }

  return allExports;
}

/**
 * 生成商业化部署包
 */
export async function generateCommercialPackage(
  outputPath: string = '/tmp/agent-commercial-package'
): Promise<string> {
  // 创建输出目录
  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true });
  }

  // 1. 导出配置
  const configs = await exportAgentConfigs();
  writeFileSync(
    join(outputPath, 'agent-configs.json'),
    JSON.stringify(configs, null, 2)
  );

  // 2. 导出完整数据（包含知识库）
  const fullData = await exportAllAgents(true);
  writeFileSync(
    join(outputPath, 'agent-complete-export.json'),
    JSON.stringify(fullData, null, 2)
  );

  // 3. 生成部署说明
  const deploymentGuide = generateDeploymentGuide();
  writeFileSync(
    join(outputPath, 'DEPLOYMENT.md'),
    deploymentGuide
  );

  // 4. 生成许可证文件
  const license = generateLicense();
  writeFileSync(
    join(outputPath, 'LICENSE'),
    license
  );

  // 5. 生成 README
  const readme = generateReadme();
  writeFileSync(
    join(outputPath, 'README.md'),
    readme
  );

  return outputPath;
}

/**
 * 生成部署指南
 */
function generateDeploymentGuide(): string {
  return `# 多 Agent 系统 - 商业化部署指南

## 📦 部署包内容

本部署包包含以下文件：

- \`agent-configs.json\` - Agent 配置文件（不含知识库内容）
- \`agent-complete-export.json\` - 完整 Agent 数据（包含知识库）
- \`README.md\` - 产品说明文档
- \`LICENSE\` - 许可证文件

---

## 🚀 部署步骤

### 前置要求

- Node.js 24+
- pnpm
- Next.js 16
- PostgreSQL 数据库
- Coze API Key（豆包大模型）

### 1. 安装依赖

\`\`\`bash
pnpm install
\`\`\`

### 2. 配置环境变量

创建 \`.env.local\` 文件：

\`\`\`env
# Coze API Key
COZE_API_KEY=your_api_key_here

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/agent_system
\`\`\`

### 3. 导入配置

有两种方式导入 Agent 配置：

#### 方式 1: 仅导入配置（不含知识库）

\`\`\`bash
# 使用 API 导入
curl -X POST -H "Content-Type: application/json" \\
  -d @agent-configs.json \\
  http://localhost:5000/api/admin/import-configs
\`\`\`

#### 方式 2: 导入完整数据（包含知识库）

\`\`\`bash
# 使用 API 导入
curl -X POST -H "Content-Type: application/json" \\
  -d @agent-complete-export.json \\
  http://localhost:5000/api/admin/import-complete
\`\`\`

### 4. 启动服务

\`\`\`bash
# 开发环境
pnpm dev

# 生产环境
pnpm build
pnpm start
\`\`\`

### 5. 验证部署

访问 http://localhost:5000，检查：
- Agent 列表是否正常
- 技能树是否加载
- 知识库是否可用

---

## 📊 数据说明

### Agent A（核心协调者）
- 职责：任务分配、进度跟踪、冲突解决
- 技能：领导力、决策、沟通、协调
- 经验：任务管理经验

### Agent B（技术执行者）
- 职责：技术开发、系统维护、技术支持
- 技能：前端、后端、DevOps、数据库
- 经验：技术问题和解决方案

### Agent C（运营推广）
- 职责：市场推广、用户运营、数据分析
- 技能：市场分析、内容运营、用户增长
- 经验：运营策略和效果

### Agent D（内容创作）
- 职责：内容创作、文案撰写、素材制作
- 技能：写作、编辑、创意、设计
- 经验：内容策略和效果

---

## 🔧 自定义配置

### 修改 Agent 提示词

编辑 \`src/lib/agent-prompts.ts\` 文件：

\`\`\`typescript
export const AGENT_PROMPTS = {
  A: {
    systemPrompt: "你的自定义提示词..."
  }
};
\`\`\`

### 添加新技能

编辑 \`src/lib/skills.ts\` 文件：

\`\`\`typescript
export const SKILL_TREES = {
  A: {
    skills: [
      {
        id: 'new-skill',
        name: '新技能',
        level: 1,
        maxLevel: 10,
        // ...
      }
    ]
  }
};
\`\`\`

### 配置通信关系

编辑 \`src/lib/agent-configs.ts\` 文件：

\`\`\`typescript
export const AGENT_CONFIGS = {
  A: {
    canCommunicateWith: ['B', 'C', 'D'],
    // ...
  }
};
\`\`\`

---

## 📈 性能优化

### 1. 并发控制

在 \`src/lib/agent-configs.ts\` 中设置：

\`\`\`typescript
maxConcurrentTasks: 5, // 最大并发任务数
\`\`\`

### 2. 知识库缓存

启用知识库搜索缓存：

\`\`\`typescript
// 在 knowledge-base.ts 中
cacheEnabled: true,
cacheTTL: 300, // 缓存 5 分钟
\`\`\`

### 3. 任务优先级

调整任务优先级权重：

\`\`\`typescript
PRIORITY_WEIGHTS = {
  emergency: 4,
  high: 3,
  medium: 2,
  low: 1,
};
\`\`\`

---

## 🔒 安全建议

1. **保护 API Key**
   - 使用环境变量存储
   - 定期轮换 API Key
   - 限制 API Key 权限

2. **数据库安全**
   - 使用强密码
   - 定期备份数据
   - 启用 SSL 连接

3. **访问控制**
   - 实施身份认证
   - 设置权限管理
   - 记录访问日志

---

## 📞 技术支持

如需技术支持，请联系：
- Email: support@example.com
- 文档: https://docs.example.com
- 社区: https://community.example.com

---

## 📄 许可证

请参考 \`LICENSE\` 文件了解许可证详情。

---

**祝部署顺利！🎉**
`;
}

/**
 * 生成许可证文件
 */
function generateLicense(): string {
  return `MULTI-AGENT SYSTEM LICENSE

Copyright (c) 2025 Your Company Name

本软件及其文档受版权保护。

使用条款：

1. 商业使用
   本软件可用于商业目的，包括但不限于：
   - 为客户提供 Agent 服务
   - 将 Agent 集成到商业产品中
   - 基于 Agent 开发商业应用

2. 分发
   在遵守本许可证的前提下，您可以：
   - 复制和分发本软件
   - 修改和分发本软件的衍生版本
   - 将本软件打包到其他产品中

3. 限制
   您不得：
   - 声称自己是本软件的作者
   - 删除或修改版权声明
   - 将本软件用于非法目的

4. 免责声明
   本软件按"原样"提供，不提供任何明示或暗示的保证。
   作者不对使用本软件造成的任何损失负责。

5. 支持
   付费支持服务：
   - 技术支持
   - 定制开发
   - 培训服务

如需购买支持服务，请联系 support@example.com

完整许可证文本请参考：https://www.yourcompany.com/license
`;
}

/**
 * 生成 README
 */
function generateReadme(): string {
  return `# 多 Agent 系统 - 商业化部署包

## 🎯 产品概述

这是一个高度可扩展的多 Agent 协作系统，支持：
- ✅ 多 Agent 协作（A、B、C、D）
- ✅ 智能任务分配和调度
- ✅ 能力评估和技能树系统
- ✅ 知识库记忆和经验积累
- ✅ 定时任务和自主决策
- ✅ 并发控制和优先级管理

## 🏢 商业价值

### 1. 提高效率
- 自动化任务分配
- 智能协调多个 Agent
- 减少人工干预

### 2. 降低成本
- 替代部分人工工作
- 提高任务完成速度
- 减少错误率

### 3. 可扩展性
- 动态添加新 Agent
- 灵活配置技能树
- 积累经验知识

## 🚀 快速开始

详见 DEPLOYMENT.md 文件。

## 📊 系统架构

\`\`\`
用户输入
    |
Agent A（核心协调者）
    |
    |--> Agent B（技术）
    |--> Agent C（运营）
    |--> Agent D（内容）
    |
知识库 (经验积累)
\`\`\`

## 🎁 包含内容

- 4 个预配置的 Agent（A、B、C、D）
- 完整的技能树系统
- 知识库记忆功能
- 任务调度引擎
- 实时监控系统

## 💰 商业模式建议

### 1. SaaS 服务
- 按月/年订阅收费
- 不同等级提供不同功能

### 2. 定制服务
- 为企业定制 Agent
- 开发特定技能
- 集成到现有系统

### 3. API 服务
- 提供 Agent API
- 按调用次数收费
- 支持第三方集成

## 📞 联系我们

- 网站: https://www.yourcompany.com
- 邮箱: contact@yourcompany.com
- 文档: https://docs.yourcompany.com

---

**让 AI 为你工作！🤖✨**
`;
}
