# 两阶段流程验证方案

## 🎯 验证目标

验证"先合规检查，后上传公众号"的两阶段流程是否正确实现。

---

## 📋 验证前确认

请确认以下内容已准备好：

- [ ] 核心功能已实现（`subtask-execution-engine.ts`）
- [ ] 专项测试文件已创建（`two-phase-process-validation.ts`）
- [ ] 数据库中有测试数据
- [ ] 服务正在运行（端口 5000）

---

## 🔍 验证方案

### 方案 A：使用现有测试数据验证（推荐）

**适用场景**：数据库中已有测试数据

#### 验证步骤

1. **查询测试数据**
   ```bash
   curl 'http://localhost:5000/api/test/check-step-history?limit=10'
   ```

2. **选择一个内容发布测试用例**
   - 例如：TC-01B（初始合规→直接上传公众号）
   - 记录其 `commandResultId`

3. **使用专项验证器验证**
   - 调用 `TwoPhaseProcessValidator` 验证该测试用例
   - 检查：
     - ✅ mcp_attempts 数量是否为 2
     - ✅ 第1条是否为合规检查（compliance_audit/checkContent）
     - ✅ 第2条是否为公众号上传（wechat_mp/addDraft）
     - ✅ 合规检查是否在公众号上传之前
     - ✅ 合规检查结果是否通过

---

### 方案 B：手动创建测试任务验证

**适用场景**：想完整测试新流程

#### 验证步骤

1. **创建测试任务**
   - 创建一个 insurance-d 的内容发布任务
   - 任务标题包含"公众号"、"发布"等关键词

2. **触发任务执行**
   - 调用 SubtaskEngine 执行任务

3. **监控执行过程**
   - 查看日志，确认：
     - ✅ 是否检测到需要两阶段流程
     - ✅ 是否强制执行了合规检查
     - ✅ 合规检查是否记录到 mcpExecutionHistory
     - ✅ 合规检查完成后是否继续下一轮
     - ✅ 是否执行了公众号上传
     - ✅ 最终 mcp_attempts 是否包含2条记录

4. **验证数据库记录**
   - 查询 `agent_sub_tasks_step_history` 表
   - 检查最终 response 的 mcp_attempts

---

### 方案 C：单元测试验证

**适用场景**：想快速验证核心逻辑

#### 验证步骤

1. **测试辅助函数**
   - 测试 `needsTwoPhaseProcess()` - 是否正确识别两阶段场景
   - 测试 `hasCompletedComplianceCheck()` - 是否正确检测合规检查
   - 测试 `isComplianceCheckPassed()` - 是否正确判断合规通过
   - 测试 `forceComplianceCheckDecision()` - 是否正确生成强制决策

2. **测试主流程**
   - 模拟输入，验证两阶段流程控制逻辑

---

## 📊 预期验证结果

### 成功的验证结果

```
✅ 两阶段流程验证报告

执行概览：
| 指标 | 数值 |
|------|------|
| 总测试用例数 | 1 |
| 通过 | 1 |
| 失败 | 0 |
| 警告 | 0 |

详细结果：
✅ TC-01B
  - MCP 尝试次数: 2
  - 有合规检查: ✅
  - 有公众号上传: ✅
  - 合规检查在前: ✅
```

### 失败的验证结果

```
❌ 两阶段流程验证报告

详细结果：
❌ TC-01B
  - MCP 尝试次数: 1（期望：2）
  - 有合规检查: ❌
  - 有公众号上传: ✅
  - 合规检查在前: ❌
  
错误：
- ❌ 缺少合规检查 MCP 记录
```

---

## 🔧 验证工具

### 使用专项验证器

```typescript
import { TwoPhaseProcessValidator } from '@/lib/test/two-phase-process-validation';

// 初始化验证器
const validator = new TwoPhaseProcessValidator();

// 验证单个测试用例
const result = await validator.validateTestCase(
  'command-result-id-xxx',
  'TC-01B'
);

console.log('验证结果:', result);

// 批量验证并生成报告
const report = await validator.validateAll([
  { testCaseId: 'TC-01A', commandResultId: 'xxx' },
  { testCaseId: 'TC-01B', commandResultId: 'yyy' },
  { testCaseId: 'TC-01C', commandResultId: 'zzz' },
  // ...
]);

// 生成 Markdown 报告
const markdown = validator.generateReport(report);
console.log(markdown);
```

---

## 📝 验证检查清单

### 代码层面检查

- [ ] `needsTwoPhaseProcess()` 函数逻辑正确
- [ ] `hasCompletedComplianceCheck()` 函数逻辑正确
- [ ] `isComplianceCheckPassed()` 函数逻辑正确
- [ ] `forceComplianceCheckDecision()` 函数逻辑正确
- [ ] 两阶段流程控制逻辑正确插入到主循环
- [ ] Agent B Prompt 包含两阶段流程说明
- [ ] 类型检查通过（`npx tsc --noEmit`）

### 功能层面检查

- [ ] 能正确识别保险事业部内容发布场景
- [ ] 能强制执行合规检查
- [ ] 合规检查能正确记录到 mcpExecutionHistory
- [ ] 合规检查完成后能继续下一轮
- [ ] 能正确处理合规未通过的情况
- [ ] 非内容发布场景不受影响

### 数据层面检查

- [ ] mcp_attempts 包含2条记录（对于内容发布场景）
- [ ] 第1条是合规检查（compliance_audit/checkContent）
- [ ] 第2条是公众号上传（wechat_mp/addDraft）
- [ ] 合规检查在公众号上传之前
- [ ] 合规检查结果显示 is_compliant = true

---

## 🎯 建议验证顺序

1. **先进行代码层面检查**（最快）
   - 运行类型检查
   - 检查代码逻辑

2. **再进行单元测试验证**（较快）
   - 测试辅助函数
   - 测试主流程逻辑

3. **最后进行端到端验证**（最完整）
   - 使用现有测试数据验证
   - 或手动创建测试任务验证

---

## ❓ 请确认

请审核以上验证方案，并确认：

1. **验证目标**是否正确？
2. **验证方案**是否合适？
3. **验证步骤**是否完整？
4. **预期结果**是否合理？
5. **验证顺序**是否可行？

确认后我再执行验证！
