# 测试文件修改清单（评审版）

## 📋 概述

由于实现了"先合规检查，后上传公众号"的两阶段流程，需要更新相关的测试文档、测试案例和测试执行代码。

---

## 📁 预计修改的文件清单

### 1️⃣ 测试文档（3个文件）

| 文件路径 | 修改内容 | 优先级 |
|---------|---------|--------|
| `docs/13-test-cases-unified-testing-document.md` | 更新6个内容合规审核测试用例的预期结果，增加 mcp_attempts 应包含2条记录的要求 | P0 |
| `docs/13-test-cases-analysis.md` | 更新测试用例分析，增加两阶段流程的说明 | P1 |
| `docs/13-test-cases-execution-report.md` | 更新执行报告模板，增加两阶段流程验证项 | P1 |

---

### 2️⃣ 测试代码（4个文件）

| 文件路径 | 修改内容 | 优先级 |
|---------|---------|--------|
| `src/lib/test/test-cases-detailed.ts` | 更新6个内容合规审核测试用例的预期数据结构，增加对 mcp_attempts 的验证（应包含合规检查和公众号上传2条记录） | P0 |
| `src/lib/test/business-scenario-validation.ts` | 更新验证逻辑，增加两阶段流程的验证（合规检查必须在公众号上传之前执行） | P0 |
| `src/app/api/test/run-all-tests/route.ts` | 更新测试执行流程，增加两阶段流程专项检查 | P1 |
| `src/app/api/test/check-step-history/route.ts` | 更新 step history 验证逻辑，增加对 mcp_attempts 数量和顺序的检查 | P1 |

---

### 3️⃣ 新增测试文件（1个文件）

| 文件路径 | 说明 | 优先级 |
|---------|------|--------|
| `src/lib/test/two-phase-process-validation.ts` | 新增两阶段流程专项测试文件，专门测试"先合规检查，后上传公众号"的流程正确性 | P0 |

---

## 🔍 具体修改内容详解

### A. 测试文档修改

#### 1. `docs/13-test-cases-unified-testing-document.md`

**需要更新的测试用例（6个）：**
- TC-01A：初始不合规→整改→成功上传公众号
- TC-01B：初始合规→直接上传公众号
- TC-01C：合规审核-流程完整性
- TC-23：多次违规→多次整改→最终成功上传公众号
- TC-24：合规通过-正常发布流程
- TC-25：合规不通过-提示修改后重试

**具体修改：**
1. 更新"预期结果"部分，明确 mcp_attempts 应包含2条记录
2. 第一条：compliance_audit/checkContent（合规检查）
3. 第二条：wechat_mp/addDraft（公众号上传）
4. 更新验证点清单，增加对 mcp_attempts 顺序和内容的验证

---

### B. 测试代码修改

#### 1. `src/lib/test/test-cases-detailed.ts`

**需要更新的测试用例数据（6个）：**
- 更新 expectedInteractContent 中的 mcp_attempts 预期数据
- 增加对合规检查 MCP 记录的验证
- 增加对公众号上传 MCP 记录的验证
- 验证两条记录的顺序（合规检查在前，上传在后）

**示例修改（以 TC-01B 为例）：**
```typescript
// 修改前
mcp_attempts: [
  {
    toolName: 'wechat_mp',
    actionName: 'addDraft',
    // ...
  }
]

// 修改后
mcp_attempts: [
  {
    toolName: 'compliance_audit',
    actionName: 'checkContent',
    // ... 合规检查记录
  },
  {
    toolName: 'wechat_mp',
    actionName: 'addDraft',
    // ... 公众号上传记录
  }
]
```

---

#### 2. `src/lib/test/business-scenario-validation.ts`

**需要新增的验证逻辑：**

```typescript
/**
 * 验证两阶段流程：先合规检查，后上传公众号
 */
function validateTwoPhaseProcess(
  interactContent: any,
  testCaseId: string
): ValidationResult {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: []
  };

  // 1. 检查 mcp_attempts 是否存在
  if (!interactContent.response?.mcp_attempts) {
    result.success = false;
    result.errors.push('缺少 mcp_attempts 字段');
    return result;
  }

  const mcpAttempts = interactContent.response.mcp_attempts;

  // 2. 检查 mcp_attempts 数量（对于内容发布场景，应该有2条记录）
  if (isContentPublishingTestCase(testCaseId)) {
    if (mcpAttempts.length < 1) {
      result.success = false;
      result.errors.push('内容发布场景应该至少有1条 MCP 记录（合规检查）');
    }
    if (mcpAttempts.length === 2 && mcpAttempts[1].decision.toolName !== 'wechat_mp') {
      result.success = false;
      result.errors.push('第二条 MCP 记录应该是公众号上传');
    }
  }

  // 3. 检查第一条记录是否是合规检查（如果存在）
  if (mcpAttempts.length >= 1) {
    const firstAttempt = mcpAttempts[0];
    if (firstAttempt.decision.toolName !== 'compliance_audit' ||
        firstAttempt.decision.actionName !== 'checkContent') {
      result.warnings.push('第一条 MCP 记录应该是合规检查');
    }
  }

  // 4. 检查合规检查是否在公众号上传之前
  if (mcpAttempts.length >= 2) {
    const complianceIndex = mcpAttempts.findIndex(
      (m: any) => m.decision.toolName === 'compliance_audit'
    );
    const uploadIndex = mcpAttempts.findIndex(
      (m: any) => m.decision.toolName === 'wechat_mp'
    );

    if (complianceIndex !== -1 && uploadIndex !== -1 && complianceIndex > uploadIndex) {
      result.success = false;
      result.errors.push('合规检查应该在公众号上传之前执行');
    }
  }

  return result;
}
```

---

#### 3. 新增文件：`src/lib/test/two-phase-process-validation.ts`

**专项测试文件内容：**

```typescript
/**
 * 两阶段流程专项测试
 * 测试"先合规检查，后上传公众号"的流程正确性
 */

export class TwoPhaseProcessValidator {
  /**
   * 执行完整的两阶段流程验证
   */
  async validateAll(): Promise<ValidationReport> {
    const report: ValidationReport = {
      testCases: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };

    // 测试6个内容合规审核用例
    const testCases = ['TC-01A', 'TC-01B', 'TC-01C', 'TC-23', 'TC-24', 'TC-25'];

    for (const testCaseId of testCases) {
      const result = await this.validateTestCase(testCaseId);
      report.testCases.push(result);
      report.summary.total++;

      if (result.success) {
        report.summary.passed++;
      } else {
        report.summary.failed++;
      }

      if (result.warnings.length > 0) {
        report.summary.warnings += result.warnings.length;
      }
    }

    return report;
  }

  /**
   * 验证单个测试用例
   */
  private async validateTestCase(testCaseId: string): Promise<TestCaseResult> {
    // 1. 从数据库获取测试数据
    // 2. 验证两阶段流程
    // 3. 返回验证结果
  }
}
```

---

## 📊 修改优先级总结

### P0（必须修改）
1. `docs/13-test-cases-unified-testing-document.md` - 更新测试用例预期
2. `src/lib/test/test-cases-detailed.ts` - 更新测试数据
3. `src/lib/test/business-scenario-validation.ts` - 更新验证逻辑
4. `src/lib/test/two-phase-process-validation.ts` - 新增专项测试

### P1（建议修改）
1. `docs/13-test-cases-analysis.md` - 更新分析文档
2. `docs/13-test-cases-execution-report.md` - 更新报告模板
3. `src/app/api/test/run-all-tests/route.ts` - 更新测试执行
4. `src/app/api/test/check-step-history/route.ts` - 更新验证逻辑

---

## ✅ 评审确认项

请确认以下内容：

- [ ] 修改清单是否完整？
- [ ] 优先级划分是否合理？
- [ ] 是否有遗漏的文件？
- [ ] 修改内容是否符合预期？
- [ ] 是否需要新增其他测试？

---

## 🎯 下一步行动

评审通过后，将按照以下顺序执行：
1. 先修改 P0 文件
2. 再修改 P1 文件
3. 运行测试验证
4. 输出测试报告
