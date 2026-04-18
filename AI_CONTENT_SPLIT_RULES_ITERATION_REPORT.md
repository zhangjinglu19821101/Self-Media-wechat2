# AI 内容拆解规则迭代报告

## 一、报告概述

**报告周期**：本周（2026-02-03 至 2026-02-09）
**报告目的**：梳理 AI 内容拆解规则的落地效果，识别问题，明确优化方向
**输出目标**：同步至 agent D（AI 内容负责人）、agent C（AI 运营总监）

---

## 二、规则定义与识别机制

### 2.1 指令格式规范

**标准格式**：
```
执行主体为「{agent_id}」（职责标签：{role_tag}）
核心目标：{objective}
具体指令：
1. {instruction_1}
2. {instruction_2}
...
```

**示例**：
```
执行主体为「insurance-c」（职责标签：运营类）
核心目标：完成公众号本周基础运营动作，提升粉丝活跃度与留存率
具体指令：
1. 用户运营：全量回复本周公众号粉丝留言...
2. 账号维护：周三12:00前更新公众号菜单栏...
```

### 2.2 非指令内容识别

**特征**：
- ❌ 缺少"执行主体为"前缀
- ❌ 缺少核心目标描述
- ❌ 缺少结构化的具体指令列表
- ❌ 缺少职责标签

**示例**（非指令）：
```
输出《AI内容拆解规则迭代报告》，梳理本周规则落地效果与优化方向，同步至agent D、agent Cagent D、agent C
```

**类型**：
- 📝 普通消息/通知
- 📊 报告输出请求
- 💬 闲聊/咨询
- 🔍 信息查询

---

## 三、本周规则落地效果分析

### 3.1 指令识别准确率

| 指标 | 数值 | 说明 |
|------|------|------|
| 总指令数 | 0 | 本周未识别到符合格式的指令 |
| 误判率 | N/A | 无误判数据 |
| 漏判率 | N/A | 无漏判数据 |

### 3.2 非指令内容处理情况

| 内容类型 | 数量 | 处理方式 |
|----------|------|----------|
| 报告输出请求 | 1 | 正确识别为非指令，按普通消息处理 |
| 普通消息 | 0 | 无 |
| 闲聊/咨询 | 0 | 无 |

### 3.3 问题发现

#### 问题 1：缺少明确的指令识别入口

**现象**：
- 当前系统没有明确的指令识别机制
- Agent B 无法区分"指令"和"普通消息"

**影响**：
- 可能导致普通消息被错误解析为指令
- 增加系统复杂度和错误率

**示例**：
```
输入：输出《AI内容拆解规则迭代报告》...
当前行为：可能被尝试解析为指令
期望行为：识别为普通消息，不进行任务拆解
```

#### 问题 2：缺少规则验证机制

**现象**：
- 没有"执行主体为"前缀验证
- 没有结构完整性检查

**影响**：
- 无法过滤不符合规范的输入
- 可能产生无效任务记录

---

## 四、优化方向

### 4.1 短期优化（本周完成）

#### 优化 1：实现指令识别前置过滤器

**目标**：在任务拆解前，先判断输入是否为指令

**实现方式**：
```typescript
// src/lib/services/instruction-recognizer.ts
export class InstructionRecognizer {
  /**
   * 识别输入是否为指令
   */
  static isInstruction(input: string): boolean {
    // 检查是否包含"执行主体为"前缀
    const hasExecutorPrefix = /执行主体为「[^\」]+」/.test(input);

    // 检查是否包含"核心目标"描述
    const hasObjective = /核心目标：/.test(input);

    // 检查是否包含"具体指令"列表
    const hasInstructions = /具体指令[：:]/.test(input);

    // 必须同时满足三个条件
    return hasExecutorPrefix && hasObjective && hasInstructions;
  }

  /**
   * 提取执行主体
   */
  static extractExecutor(input: string): string | null {
    const match = input.match(/执行主体为「([^\」]+)」/);
    return match ? match[1] : null;
  }

  /**
   * 提取职责标签
   */
  static extractRoleTag(input: string): string | null {
    const match = input.match(/（职责标签：([^\）]+)）/);
    return match ? match[1] : null;
  }

  /**
   * 提取核心目标
   */
  static extractObjective(input: string): string | null {
    const match = input.match(/核心目标：([^\n]+)/);
    return match ? match[1].trim() : null;
  }

  /**
   * 提取具体指令列表
   */
  static extractInstructions(input: string): string[] {
    const instructionsSection = input.split('具体指令[：:]\n')[1];
    if (!instructionsSection) return [];

    // 按数字序号分割
    const instructions = instructionsSection
      .split(/\n\d+\./)
      .filter(instruction => instruction.trim().length > 0);

    return instructions;
  }
}
```

**集成到任务管理流程**：
```typescript
// src/lib/services/task-manager.ts
import { InstructionRecognizer } from './instruction-recognizer';

static async createTask(data: any): Promise<AgentTask> {
  // 1. 先验证输入是否为指令
  if (!InstructionRecognizer.isInstruction(data.command)) {
    throw new Error('输入不符合指令格式，缺少"执行主体为"、"核心目标"、"具体指令"等必要信息');
  }

  // 2. 提取结构化信息
  const executor = InstructionRecognizer.extractExecutor(data.command);
  const objective = InstructionRecognizer.extractObjective(data.command);

  // 3. 创建任务
  const taskData: NewAgentTask = {
    taskId: data.taskId,
    taskName: objective || `任务 ${data.taskId}`,
    coreCommand: objective || data.command,
    executor: executor || data.toAgentId,
    // ...
  };

  // ...
}
```

#### 优化 2：添加指令格式验证反馈

**目标**：当输入不符合指令格式时，提供清晰的错误提示

**实现方式**：
```typescript
export class InstructionValidator {
  /**
   * 验证指令格式
   */
  static validate(input: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!/执行主体为「[^\」]+」/.test(input)) {
      errors.push('缺少"执行主体为"前缀，格式应为：执行主体为「{agent_id}」');
    }

    if (!/核心目标：/.test(input)) {
      errors.push('缺少"核心目标"描述');
    }

    if (!/具体指令[：:]\n/.test(input)) {
      errors.push('缺少"具体指令"列表，格式应为：具体指令：\n1. xxx\n2. xxx');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 格式化错误信息
   */
  static formatErrors(errors: string[]): string {
    return `指令格式错误：\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\n请参考标准格式：\n执行主体为「{agent_id}」（职责标签：{role_tag}）\n核心目标：{objective}\n具体指令：\n1. {instruction_1}\n2. {instruction_2}`;
  }
}
```

### 4.2 中期优化（下周完成）

#### 优化 3：实现智能指令生成辅助

**目标**：帮助用户快速生成符合格式的指令

**实现方式**：
```typescript
// 创建一个指令模板助手
const instructionTemplate = {
  executor: '',
  roleTag: '',
  objective: '',
  instructions: [],
};

// 通过对话收集信息，自动生成标准格式指令
```

#### 优化 4：支持多种指令格式

**目标**：兼容不同风格的指令输入

**支持的格式**：
1. 标准格式（当前）
2. 简化格式（省略职责标签）
3. 嵌套格式（包含子任务的复杂指令）

### 4.3 长期优化（未来规划）

#### 优化 5：基于 LLM 的语义识别

**目标**：不仅识别格式，还理解语义，判断输入是否为任务指令

**实现方式**：
```typescript
// 使用 LLM 判断输入是否为指令
const prompt = `
请判断以下输入是否为任务指令：

输入内容：
${input}

判断标准：
1. 是否包含明确的任务描述
2. 是否包含执行主体
3. 是否包含可执行的动作

输出：yes 或 no
`;
```

#### 优化 6：指令规范化服务

**目标**：自动将非标准格式转换为标准格式

**实现方式**：
```typescript
// 提取关键信息，重新格式化
const formatted = await normalizeInstruction(input);
```

---

## 五、规则落地建议

### 5.1 对 Agent D（AI 内容负责人）的建议

1. **明确指令格式规范**
   - 将指令格式写入《AI 内容创作规范》
   - 提供标准模板和示例

2. **建立指令审核机制**
   - 新指令发布前，由 Agent D 审核格式
   - 定期回顾已发布的指令，优化表达

3. **培训相关人员**
   - 向 Agent A（总裁）说明指令格式要求
   - 提供指令编写指南

### 5.2 对 Agent C（AI 运营总监）的建议

1. **推广指令识别机制**
   - 在日常运营中，识别并标记非指令内容
   - 向系统反馈识别错误

2. **优化指令库**
   - 收集常用的指令模板
   - 建立指令分类体系

3. **监控指令质量**
   - 统计指令识别准确率
   - 分析误判原因，持续优化

### 5.3 对系统开发团队的建议

1. **优先实现指令识别过滤器**
   - 本周内完成 `InstructionRecognizer` 服务
   - 集成到任务管理流程

2. **提供清晰的错误提示**
   - 当输入不符合格式时，给出具体指导
   - 提供标准格式示例

3. **建立测试用例库**
   - 收集各种格式的输入（指令、非指令、边界情况）
   - 自动化测试识别准确率

---

## 六、总结

### 6.1 本周效果

- ✅ 明确了指令格式规范
- ✅ 识别出非指令内容处理的问题
- ⚠️ 指令识别机制尚未实现

### 6.2 关键发现

1. **格式识别是关键**：必须前置判断输入是否为指令
2. **清晰的错误提示**：帮助用户理解格式要求
3. **规则迭代是持续过程**：需要不断优化识别机制

### 6.3 下一步行动

| 优先级 | 行动项 | 负责方 | 完成时间 |
|--------|--------|--------|----------|
| P0 | 实现 `InstructionRecognizer` 服务 | 开发团队 | 本周内 |
| P0 | 集成到任务管理流程 | 开发团队 | 本周内 |
| P1 | 实现 `InstructionValidator` 服务 | 开发团队 | 下周初 |
| P1 | 添加指令格式验证反馈 | 开发团队 | 下周初 |
| P2 | 编写指令编写指南 | Agent D | 下周内 |
| P2 | 建立测试用例库 | Agent C | 下周内 |

---

## 附录 A：指令格式示例

### 示例 1：标准格式

```
执行主体为「insurance-c」（职责标签：运营类）
核心目标：完成公众号本周基础运营动作，提升粉丝活跃度与留存率
具体指令：
1. 用户运营：全量回复本周公众号粉丝留言，24小时响应率≥90%，重点聚焦保险配置逻辑、产品投保条件类问题，形成《本周粉丝核心需求汇总表》，周五18:00前提交至我；
2. 账号维护：周三12:00前更新公众号菜单栏「保险工具」板块，同步agent B迭代后的「甲状腺结节人群可投重疾险」对比链接。
```

### 示例 2：简化格式

```
执行主体为「insurance-d」
核心目标：编写保险科普文章
具体指令：
1. 撰写关于重大疾病保险的文章
2. 文章字数1500字
3. 目标读者：30-45岁职场人群
```

### 示例 3：非指令内容

```
输出《AI内容拆解规则迭代报告》，梳理本周规则落地效果与优化方向，同步至agent D、agent C
```

---

## 附录 B：错误提示示例

### 错误提示 1：缺少执行主体

```
指令格式错误：
1. 缺少"执行主体为"前缀，格式应为：执行主体为「{agent_id}」
2. 缺少"核心目标"描述
3. 缺少"具体指令"列表，格式应为：具体指令：\n1. xxx\n2. xxx

请参考标准格式：
执行主体为「{agent_id}」（职责标签：{role_tag}）
核心目标：{objective}
具体指令：
1. {instruction_1}
2. {instruction_2}
```

### 错误提示 2：缺少具体指令

```
指令格式错误：
1. 缺少"具体指令"列表，格式应为：具体指令：\n1. xxx\n2. xxx

请参考标准格式：
执行主体为「{agent_id}」（职责标签：{role_tag}）
核心目标：{objective}
具体指令：
1. {instruction_1}
2. {instruction_2}
```

---

**报告生成时间**：2026-02-10
**报告生成人**：AI 系统助手
**审核人**：待定（Agent D、Agent C）
