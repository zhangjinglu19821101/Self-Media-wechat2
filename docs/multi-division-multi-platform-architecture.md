# 多事业部 × 多平台架构设计方案 v2.0

## 1. 需求分析

### 1.1 核心挑战

| 维度 | 实例 | 差异点 |
|------|------|--------|
| **事业部维度** | 保险事业部、AI事业部 | 业务逻辑、知识库、内容方向 |
| **平台维度** | 微信公众号、小红书、知乎、今日头条、微博 | 合规规则、运营规则、内容格式、用户群体 |
| **需求** | 统一指令管理、统一管理 | 统一接口、统一调度、统一监控 |

### 1.2 二维矩阵结构

```
                    平台维度
            ┌─────┬─────┬─────┬─────┬─────┐
            │微信  │小红  │知乎  │头条  │微博  │
      ┌─────┼─────┼─────┼─────┼─────┼─────┤
事     │保险 │✅    │✅    │✅    │✅    │✅    │
业     ├─────┼─────┼─────┼─────┼─────┼─────┤
部     │AI   │✅    │✅    │✅    │✅    │✅    │
      ├─────┼─────┼─────┼─────┼─────┼─────┤
      │...  │✅    │✅    │✅    │✅    │✅    │
      └─────┴─────┴─────┴─────┴─────┴─────┘
```

### 1.3 核心问题

1. **合规规则差异化**：每个平台有独立的合规规则
2. **运营规则差异化**：每个平台的运营策略不同
3. **内容格式差异化**：小红书图文、知乎长文、微博短内容
4. **统一管理需求**：需要统一的指令下发、调度、监控

## 2. 架构设计方案

### 2.1 核心设计理念

**三层抽象 + 两个维度**:

```
┌─────────────────────────────────────────────────┐
│        平台能力层 (Platform Capability Layer)     │
│  - 平台适配器 (Platform Adapter)                  │
│  - 合规规则引擎 (Compliance Rules Engine)         │
│  - 运营规则引擎 (Operation Rules Engine)          │
│  - 内容格式化器 (Content Formatter)               │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│        事业部业务层 (Division Business Layer)      │
│  - 事业部业务逻辑 (Division Business Logic)       │
│  - 知识库管理 (Knowledge Base)                     │
│  - 内容策略 (Content Strategy)                    │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│        统一管理层 (Unified Management Layer)      │
│  - 统一指令管理 (Unified Command Management)      │
│  - 统一调度系统 (Unified Scheduler)               │
│  - 统一监控系统 (Unified Monitoring)              │
│  - 统一配置中心 (Unified Config Center)           │
└─────────────────────────────────────────────────┘
```

### 2.2 配置文件设计

**文件**: `config/platforms-and-divisions.json`

```json
{
  "platforms": {
    "wechat": {
      "name": "微信公众号",
      "code": "WECHAT",
      "type": "longform",
      "config": {
        "maxWordCount": 2000,
        "minWordCount": 800,
        "supportsImages": true,
        "supportsVideo": false
      },
      "rules": {
        "compliance": "./rules/platforms/wechat-compliance.md",
        "operation": "./rules/platforms/wechat-operation.md",
        "format": "./rules/platforms/wechat-format.md"
      },
      "adapter": "./src/lib/platforms/adapters/wechat-adapter.ts"
    },
    "xiaohongshu": {
      "name": "小红书",
      "code": "XHS",
      "type": "图文",
      "config": {
        "maxWordCount": 1000,
        "minWordCount": 300,
        "supportsImages": true,
        "supportsVideo": true,
        "emojiSupport": true,
        "hashtagsRequired": true
      },
      "rules": {
        "compliance": "./rules/platforms/xiaohongshu-compliance.md",
        "operation": "./rules/platforms/xiaohongshu-operation.md",
        "format": "./rules/platforms/xiaohongshu-format.md"
      },
      "adapter": "./src/lib/platforms/adapters/xiaohongshu-adapter.ts"
    },
    "zhihu": {
      "name": "知乎",
      "code": "ZHIHU",
      "type": "长文",
      "config": {
        "maxWordCount": 5000,
        "minWordCount": 1500,
        "supportsImages": true,
        "supportsVideo": true
      },
      "rules": {
        "compliance": "./rules/platforms/zhihu-compliance.md",
        "operation": "./rules/platforms/zhihu-operation.md",
        "format": "./rules/platforms/zhihu-format.md"
      },
      "adapter": "./src/lib/platforms/adapters/zhihu-adapter.ts"
    },
    "toutiao": {
      "name": "今日头条",
      "code": "TOUTIAO",
      "type": "资讯",
      "config": {
        "maxWordCount": 3000,
        "minWordCount": 600,
        "supportsImages": true,
        "supportsVideo": true
      },
      "rules": {
        "compliance": "./rules/platforms/toutiao-compliance.md",
        "operation": "./rules/platforms/toutiao-operation.md",
        "format": "./rules/platforms/toutiao-format.md"
      },
      "adapter": "./src/lib/platforms/adapters/toutiao-adapter.ts"
    },
    "weibo": {
      "name": "微博",
      "code": "WEIBO",
      "type": "短内容",
      "config": {
        "maxWordCount": 140,
        "minWordCount": 10,
        "supportsImages": true,
        "supportsVideo": true,
        "emojiSupport": true,
        "hashtagsRequired": true
      },
      "rules": {
        "compliance": "./rules/platforms/weibo-compliance.md",
        "operation": "./rules/platforms/weibo-operation.md",
        "format": "./rules/platforms/weibo-format.md"
      },
      "adapter": "./src/lib/platforms/adapters/weibo-adapter.ts"
    }
  },

  "divisions": {
    "insurance": {
      "name": "保险事业部",
      "code": "INS",
      "config": {
        "knowledgeBase": "./backup/agent_log/AgentB/知识库/保险/",
        "complianceRules": "./backup/agent_log/AgentB/合规规则/保险/"
      },
      "agents": {
        "content": {
          "baseAgentId": "insurance-d",
          "promptFile": "src/lib/agents/prompts/insurance-d.md",
          "role": "content_creation"
        },
        "operation": {
          "baseAgentId": "insurance-c",
          "promptFile": "src/lib/agents/prompts/insurance-c.md",
          "role": "operation"
        }
      },
      "platformInstances": {
        "wechat": {
          "agentId": "insurance-d-wechat",
          "enabled": true,
          "taskSchedule": [
            {
              "taskType": "daily_draft",
              "hour": 6,
              "minute": 0
            },
            {
              "taskType": "daily_final",
              "hour": 7,
              "minute": 0
            }
          ]
        },
        "xiaohongshu": {
          "agentId": "insurance-d-xiaohongshu",
          "enabled": true,
          "taskSchedule": [
            {
              "taskType": "daily_draft",
              "hour": 8,
              "minute": 0
            }
          ]
        },
        "zhihu": {
          "agentId": "insurance-d-zhihu",
          "enabled": true,
          "taskSchedule": []
        },
        "toutiao": {
          "agentId": "insurance-d-toutiao",
          "enabled": false,
          "taskSchedule": []
        },
        "weibo": {
          "agentId": "insurance-d-weibo",
          "enabled": true,
          "taskSchedule": [
            {
              "taskType": "daily_draft",
              "hour": 12,
              "minute": 0
            }
          ]
        }
      }
    },
    "ai": {
      "name": "AI事业部",
      "code": "AI",
      "config": {
        "knowledgeBase": "./backup/agent_log/AgentB/知识库/AI/",
        "complianceRules": "./backup/agent_log/AgentB/合规规则/AI/"
      },
      "agents": {
        "content": {
          "baseAgentId": "ai-content-d",
          "promptFile": "src/lib/agents/prompts/ai-content-d.md",
          "role": "content_creation"
        }
      },
      "platformInstances": {
        "wechat": {
          "agentId": "ai-content-d-wechat",
          "enabled": true,
          "taskSchedule": []
        },
        "xiaohongshu": {
          "agentId": "ai-content-d-xiaohongshu",
          "enabled": false,
          "taskSchedule": []
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
      "platforms": "./backup/agent_log/platforms",
      "compliance": "./backup/agent_log/AgentB/合规规则",
      "knowledge": "./backup/agent_log/AgentB/知识库"
    }
  }
}
```

### 2.3 平台适配器设计

**基础接口**: `src/lib/platforms/base-platform-adapter.ts`

```typescript
export interface PlatformConfig {
  name: string;
  code: string;
  type: 'longform' | 'image_text' | 'shortform' | 'news';
  config: {
    maxWordCount: number;
    minWordCount: number;
    supportsImages: boolean;
    supportsVideo: boolean;
    emojiSupport?: boolean;
    hashtagsRequired?: boolean;
  };
  rules: {
    compliance: string;
    operation: string;
    format: string;
  };
}

export interface ContentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export abstract class BasePlatformAdapter {
  protected config: PlatformConfig;
  protected complianceRules: string;
  protected operationRules: string;
  protected formatRules: string;

  constructor(config: PlatformConfig) {
    this.config = config;
  }

  /**
   * 初始化加载规则
   */
  async initialize(): Promise<void> {
    this.complianceRules = await this.loadRules(this.config.rules.compliance);
    this.operationRules = await this.loadRules(this.config.rules.operation);
    this.formatRules = await this.loadRules(this.config.rules.format);
  }

  /**
   * 校验内容合规性
   */
  abstract validateCompliance(content: string): Promise<ContentValidationResult>;

  /**
   * 格式化内容为平台特定格式
   */
  abstract formatContent(content: string, metadata?: any): Promise<string>;

  /**
   * 应用运营规则（如话题标签、发布时间优化）
   */
  abstract applyOperationRules(content: string): Promise<{ content: string; metadata: any }>;

  /**
   * 获取平台特定提示词
   */
  abstract getPlatformSpecificPrompt(basePrompt: string): string;

  /**
   * 保存内容到平台特定路径
   */
  getPlatformSavePath(divisionCode: string, agentId: string, fileType: string): string {
    return `./backup/agent_log/${agentId}/${this.config.code}/${fileType}`;
  }

  private async loadRules(rulePath: string): Promise<string> {
    // 实现规则文件加载逻辑
    return '';
  }
}
```

**微信适配器示例**: `src/lib/platforms/adapters/wechat-adapter.ts`

```typescript
import { BasePlatformAdapter, ContentValidationResult } from '../base-platform-adapter';

export class WeChatAdapter extends BasePlatformAdapter {
  async validateCompliance(content: string): Promise<ContentValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 字数校验
    if (content.length < this.config.config.minWordCount) {
      errors.push(`字数不足，最少需要 ${this.config.config.minWordCount} 字`);
    }
    if (content.length > this.config.config.maxWordCount) {
      errors.push(`字数超标，最多允许 ${this.config.config.maxWordCount} 字`);
    }

    // 2. 敏感词校验
    const sensitiveWords = this.extractSensitiveWords(this.complianceRules);
    for (const word of sensitiveWords) {
      if (content.includes(word)) {
        errors.push(`包含违规敏感词: ${word}`);
      }
    }

    // 3. 格式校验
    if (!content.match(/^#\s+.+/m)) {
      warnings.push('建议添加标题');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async formatContent(content: string, metadata?: any): Promise<string> {
    // 微信公众号格式化
    let formatted = content;

    // 添加分隔线
    formatted = formatted.replace(/(\n\s*\n)/g, '\n\n---\n\n');

    return formatted;
  }

  async applyOperationRules(content: string): Promise<{ content: string; metadata: any }> {
    // 微信运营规则：添加引导关注
    const cta = '\n\n---\n\n👉 欢迎关注【XXX公众号】，获取更多精彩内容！';
    return {
      content: content + cta,
      metadata: {
        platform: 'wechat',
        cta: true
      }
    };
  }

  getPlatformSpecificPrompt(basePrompt: string): string {
    return basePrompt + '\n\n【平台要求】\n' +
      `- 字数要求：${this.config.config.minWordCount}-${this.config.config.maxWordCount}字\n` +
      `- 格式要求：Markdown格式，支持标题、列表、引用\n` +
      `- 合规要求：${this.complianceRules.substring(0, 200)}...\n`;
  }

  private extractSensitiveWords(rules: string): string[] {
    // 从合规规则中提取敏感词列表
    return [];
  }
}
```

**小红书适配器示例**: `src/lib/platforms/adapters/xiaohongshu-adapter.ts`

```typescript
import { BasePlatformAdapter, ContentValidationResult } from '../base-platform-adapter';

export class XiaohongshuAdapter extends BasePlatformAdapter {
  async validateCompliance(content: string): Promise<ContentValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 字数校验（小红书更短）
    if (content.length < this.config.config.minWordCount) {
      errors.push(`字数不足，最少需要 ${this.config.config.minWordCount} 字`);
    }

    // 2. 表情符号校验
    if (this.config.config.emojiSupport) {
      const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
      if (emojiCount === 0) {
        warnings.push('小红书建议添加表情符号增强吸引力');
      }
    }

    // 3. 话题标签校验
    if (this.config.config.hashtagsRequired) {
      const hashtags = content.match(/#[^\s#]+/g) || [];
      if (hashtags.length < 3) {
        warnings.push('小红书建议至少添加3个话题标签');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async formatContent(content: string, metadata?: any): Promise<string> {
    // 小红书格式化：标题+正文+标签
    let formatted = content;

    // 自动添加话题标签
    if (!formatted.includes('#')) {
      formatted += '\n\n#保险 #理财 #小红书';
    }

    // 添加分隔符
    formatted = formatted.replace(/(\n\s*\n)/g, '\n✨\n\n');

    return formatted;
  }

  async applyOperationRules(content: string): Promise<{ content: string; metadata: any }> {
    // 小红书运营规则：添加互动引导
    const cta = '\n\n💬 评论区聊聊你的看法吧~\n👇 点赞收藏不迷路！';
    return {
      content: content + cta,
      metadata: {
        platform: 'xiaohongshu',
        engagement: true
      }
    };
  }

  getPlatformSpecificPrompt(basePrompt: string): string {
    return basePrompt + '\n\n【小红书平台要求】\n' +
      `- 字数要求：${this.config.config.minWordCount}-${this.config.config.maxWordCount}字（短图文）\n` +
      `- 格式要求：适合手机阅读，段落简短，适当使用emoji\n` +
      `- 标签要求：必须添加至少3个话题标签（#标签）\n` +
      `- 互动要求：引导用户评论、点赞、收藏\n` +
      `- 合规要求：${this.complianceRules.substring(0, 200)}...\n`;
  }
}
```

### 2.4 统一管理器设计

**统一配置管理器**: `src/lib/config/unified-config-manager.ts`

```typescript
import { promises as fs } from 'fs';
import path from 'path';
import { BasePlatformAdapter } from '../platforms/base-platform-adapter';
import { WeChatAdapter } from '../platforms/adapters/wechat-adapter';
import { XiaohongshuAdapter } from '../platforms/adapters/xiaohongshu-adapter';
// ... 其他适配器

export interface PlatformConfigData {
  name: string;
  code: string;
  type: string;
  config: any;
  rules: any;
  adapter: string;
}

export interface DivisionConfigData {
  name: string;
  code: string;
  config: any;
  agents: any;
  platformInstances: Record<string, any>;
}

export class UnifiedConfigManager {
  private static config: any = null;
  private static platformAdapters: Map<string, BasePlatformAdapter> = new Map();

  static async loadConfig(): Promise<any> {
    if (!this.config) {
      const configPath = path.join(process.cwd(), 'config', 'platforms-and-divisions.json');
      const content = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(content);
    }
    return this.config;
  }

  /**
   * 获取平台配置
   */
  static getPlatformConfig(platformCode: string): PlatformConfigData | null {
    return this.config?.platforms?.[platformCode] || null;
  }

  /**
   * 获取事业部配置
   */
  static getDivisionConfig(divisionCode: string): DivisionConfigData | null {
    return this.config?.divisions?.[divisionCode] || null;
  }

  /**
   * 获取事业部×平台的完整Agent ID
   */
  static getAgentId(divisionCode: string, platformCode: string, role: string): string | null {
    const division = this.getDivisionConfig(divisionCode);
    const platformInstance = division?.platformInstances?.[platformCode];
    return platformInstance?.agentId || null;
  }

  /**
   * 获取平台适配器（单例模式）
   */
  static async getPlatformAdapter(platformCode: string): Promise<BasePlatformAdapter> {
    // 如果已缓存，直接返回
    if (this.platformAdapters.has(platformCode)) {
      return this.platformAdapters.get(platformCode)!;
    }

    // 获取平台配置
    const platformConfig = this.getPlatformConfig(platformCode);
    if (!platformConfig) {
      throw new Error(`平台 ${platformCode} 配置不存在`);
    }

    // 根据配置创建适配器
    let adapter: BasePlatformAdapter;
    switch (platformCode) {
      case 'wechat':
        adapter = new WeChatAdapter(platformConfig);
        break;
      case 'xiaohongshu':
        adapter = new XiaohongshuAdapter(platformConfig);
        break;
      case 'zhihu':
        adapter = new ZhihuAdapter(platformConfig);
        break;
      case 'toutiao':
        adapter = new ToutiaoAdapter(platformConfig);
        break;
      case 'weibo':
        adapter = new WeiboAdapter(platformConfig);
        break;
      default:
        throw new Error(`不支持的平台: ${platformCode}`);
    }

    // 初始化适配器
    await adapter.initialize();

    // 缓存适配器
    this.platformAdapters.set(platformCode, adapter);

    return adapter;
  }

  /**
   * 获取所有启用的平台实例
   */
  static getEnabledPlatformInstances(divisionCode: string): Array<{
    platformCode: string;
    agentId: string;
    taskSchedule: any[];
  }> {
    const division = this.getDivisionConfig(divisionCode);
    if (!division?.platformInstances) return [];

    const instances: Array<{
      platformCode: string;
      agentId: string;
      taskSchedule: any[];
    }> = [];

    for (const [platformCode, instance] of Object.entries(division.platformInstances)) {
      if ((instance as any).enabled) {
        instances.push({
          platformCode,
          agentId: (instance as any).agentId,
          taskSchedule: (instance as any).taskSchedule || []
        });
      }
    }

    return instances;
  }
}
```

### 2.5 统一指令管理

**统一指令接口**: `src/app/api/unified-commands/send/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { UnifiedConfigManager } from '@/lib/config/unified-config-manager';
import { BasePlatformAdapter } from '@/lib/platforms/base-platform-adapter';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    divisionCode,      // 事业部代码：insurance, ai
    platformCode,      // 平台代码：wechat, xiaohongshu, zhihu, toutiao, weibo
    command,           // 指令内容
    taskType = 'normal_create', // 任务类型
    priority = 'normal'
  } = body;

  // 1. 获取完整的 Agent ID
  const agentId = UnifiedConfigManager.getAgentId(divisionCode, platformCode, 'content');
  if (!agentId) {
    return NextResponse.json({
      success: false,
      error: `未找到事业部 ${divisionCode} 平台 ${platformCode} 的内容创作 Agent`
    }, { status: 404 });
  }

  // 2. 获取平台适配器
  const adapter = await UnifiedConfigManager.getPlatformAdapter(platformCode);

  // 3. 应用平台特定规则
  const platformSpecificPrompt = adapter.getPlatformSpecificPrompt(command);

  // 4. 发送指令到对应的 Agent
  const response = await fetch('http://localhost:5000/api/agents/' + agentId + '/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: platformSpecificPrompt,
      metadata: {
        divisionCode,
        platformCode,
        taskType,
        priority
      }
    })
  });

  const result = await response.json();

  // 5. 平台格式化（如果需要）
  if (result.success && result.data?.content) {
    const formattedContent = await adapter.formatContent(result.data.content);
    result.data.content = formattedContent;

    // 6. 合规校验
    const validationResult = await adapter.validateCompliance(formattedContent);
    result.data.complianceCheck = validationResult;
  }

  return NextResponse.json(result);
}
```

### 2.6 统一调度系统增强

**调度器配置**: 扩展支持事业部×平台

```typescript
async function generateTasksForAllPlatforms(divisionCode: string) {
  const instances = UnifiedConfigManager.getEnabledPlatformInstances(divisionCode);

  for (const instance of instances) {
    for (const schedule of instance.taskSchedule) {
      // 为每个平台实例生成任务
      const task = {
        taskId: `task-${divisionCode}-${instance.platformCode}-${schedule.taskType}-${Date.now()}`,
        agentId: instance.agentId,
        platformCode: instance.platformCode,
        divisionCode: divisionCode,
        schedule: schedule,
        // ...
      };
      // 添加到调度系统
    }
  }
}
```

## 3. 平台规则文件结构

### 3.1 目录结构

```
rules/
├── platforms/
│   ├── wechat-compliance.md
│   ├── wechat-operation.md
│   ├── wechat-format.md
│   ├── xiaohongshu-compliance.md
│   ├── xiaohongshu-operation.md
│   ├── xiaohongshu-format.md
│   ├── zhihu-compliance.md
│   ├── zhihu-operation.md
│   ├── zhihu-format.md
│   ├── toutiao-compliance.md
│   ├── toutiao-operation.md
│   ├── toutiao-format.md
│   ├── weibo-compliance.md
│   ├── weibo-operation.md
│   └── weibo-format.md
└── divisions/
    ├── insurance/
    │   ├── knowledge-base.md
    │   └── content-strategy.md
    └── ai/
        ├── knowledge-base.md
        └── content-strategy.md
```

### 3.2 平台规则文件示例

**小红书合规规则**: `rules/platforms/xiaohongshu-compliance.md`

```markdown
# 小红书平台合规规则

## 1. 内容禁止项

- 禁止发布虚假宣传、夸大功效的内容
- 禁止发布涉及医疗、药品等敏感内容
- 禁止发布涉及政治、暴力、色情内容
- 禁止发布诱导分享、诱导关注内容

## 2. 敏感词列表

敏感词：[包治百病、绝对有效、百分百治愈、官方认证、世界首创、特效...（具体列表由Agent B维护）]

## 3. 内容要求

- 必须真实、准确，不得虚构
- 必须有实际价值，不得误导用户
- 不得抄袭他人内容

## 4. 合规检查项

- [ ] 是否包含敏感词
- [ ] 是否夸大宣传
- [ ] 是否真实准确
- [ ] 是否有实际价值
```

## 4. 统一管理界面设计

### 4.1 统一指令下发

```bash
# 向保险事业部的所有平台发送统一指令
POST /api/unified-commands/broadcast
{
  "divisionCode": "insurance",
  "command": "创作关于重疾险的内容",
  "targetPlatforms": ["wechat", "xiaohongshu", "zhihu"]  // 可选，不指定则发送到所有平台
}

# 向特定事业部的特定平台发送指令
POST /api/unified-commands/send
{
  "divisionCode": "insurance",
  "platformCode": "xiaohongshu",
  "command": "创作关于理财的短图文"
}
```

### 4.2 统一监控面板

```typescript
// 获取所有事业部×平台的状态
GET /api/unified-monitor/status

// 响应
{
  "insurance": {
    "name": "保险事业部",
    "platforms": {
      "wechat": {
        "name": "微信公众号",
        "status": "running",
        "tasks": { "pending": 2, "running": 1, "completed": 15 },
        "lastExecution": "2026-02-07T06:00:00Z"
      },
      "xiaohongshu": {
        "name": "小红书",
        "status": "running",
        "tasks": { "pending": 1, "running": 0, "completed": 10 },
        "lastExecution": "2026-02-07T08:00:00Z"
      }
      // ...
    }
  },
  "ai": {
    "name": "AI事业部",
    "platforms": {
      // ...
    }
  }
}
```

## 5. 实施计划

### 阶段1: 平台基础设施（3-4小时）
- [ ] 创建平台配置文件
- [ ] 实现基础平台适配器接口
- [ ] 实现5个平台的适配器（微信、小红书、知乎、今日头条、微博）
- [ ] 实现统一配置管理器

### 阶段2: 规则文件创建（2-3小时）
- [ ] 创建5个平台的合规规则文件
- [ ] 创建5个平台的运营规则文件
- [ ] 创建5个平台的格式规则文件
- [ ] 创建事业部知识库和内容策略文件

### 阶段3: 统一管理实现（3-4小时）
- [ ] 实现统一指令接口
- [ ] 重构调度系统支持事业部×平台
- [ ] 实现统一监控面板
- [ ] 测试统一指令下发

### 阶段4: 保险事业部迁移（2-3小时）
- [ ] 将现有保险事业部迁移到新架构
- [ ] 测试保险事业部在各平台的功能
- [ ] 验证合规校验和格式化功能

### 阶段5: AI事业部创建（1-2小时）
- [ ] 创建AI事业部配置
- [ ] 为AI事业部启用部分平台
- [ ] 测试AI事业部功能

**总计**: 约 11-16 小时

## 6. 新增平台/事业部流程

### 新增平台（30分钟）

```bash
# 1. 创建平台适配器
# src/lib/platforms/adapters/newplatform-adapter.ts

# 2. 创建平台规则文件
# rules/platforms/newplatform-*.md

# 3. 更新配置文件
# config/platforms-and-divisions.json

# 4. 测试平台功能
```

### 新增事业部（20分钟）

```bash
# 1. 创建事业部配置
# config/platforms-and-divisions.json

# 2. 创建事业部规则文件
# rules/divisions/newdivision/

# 3. 为事业部启用需要的平台
# 配置 enabled: true

# 4. 测试事业部功能
```

## 7. 预期效果

### 快速扩展能力

| 操作 | 时间 | 说明 |
|------|------|------|
| 新增事业部 | 20分钟 | 配置 + 规则文件 |
| 新增平台 | 30分钟 | 适配器 + 规则文件 + 配置 |
| 为事业部启用新平台 | 5分钟 | 修改配置文件 |
| 统一指令下发 | 1次调用 | 自动适配所有平台 |
| 统一监控 | 1次调用 | 获取所有状态 |

### 管理便利性

- ✅ **统一指令管理**: 一次调用，多平台适配
- ✅ **统一调度系统**: 自动管理所有事业部×平台
- ✅ **统一监控面板**: 一站式查看所有状态
- ✅ **规则隔离**: 每个平台独立的合规和运营规则
- ✅ **低维护成本**: 新增平台/事业部无需修改核心代码

## 8. 总结

本架构方案通过以下方式解决您的需求：

1. **二维架构**: 支持事业部×平台的矩阵结构
2. **平台适配器**: 每个平台独立的合规规则、运营规则、内容格式化
3. **统一管理**: 统一的指令、调度、监控系统
4. **快速扩展**: 新增平台30分钟，新增事业部20分钟
5. **规则隔离**: 不同平台的规则完全独立，互不干扰

**这个架构完全可以满足您添加小红书、知乎、今日头条、微博的需求，同时保持统一管理和独立规则的平衡。**
