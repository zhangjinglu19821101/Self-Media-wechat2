# 实施总结：先合规检查，后上传公众号

## ✅ 已完成的工作

### 1. 方案设计 ✅
- 文档：[IMPLEMENTATION_PLAN.md](/workspace/projects/IMPLEMENTATION_PLAN.md)
- 设计了两阶段流程：先合规检查，后上传公众号

### 2. 代码修改 ✅

#### 修改文件：`src/lib/services/subtask-execution-engine.ts`

**新增辅助函数（4个）：**

1. **`needsTwoPhaseProcess()`** - 判断是否需要两阶段流程
   - 条件1：来自 insurance-d
   - 条件2：任务类型涉及内容发布

2. **`hasCompletedComplianceCheck()`** - 判断是否已完成合规检查
   - 检查 mcpExecutionHistory 中是否有成功的合规检查记录

3. **`isComplianceCheckPassed()`** - 判断合规检查是否通过
   - 检查合规检查结果中的 is_compliant 或 check_passed 字段

4. **`forceComplianceCheckDecision()`** - 强制生成合规检查决策
   - 查找合规检查能力
   - 构造强制 EXECUTE_MCP 决策

**修改主循环逻辑：**
- 在调用 Agent B 之前添加两阶段流程控制
- 如果需要两阶段流程但未做合规检查，强制先执行合规检查
- 合规检查完成后，继续下一轮迭代

**修改 Agent B Prompt：**
- 在 Prompt 开头添加两阶段流程说明
- 添加当前状态检查（是否已完成合规检查、是否通过）
- 引导 Agent B 遵循正确的执行顺序

---

## 📊 新流程说明

### 完整流程（两阶段）

```
1. insurance-d 输出文章内容
   ↓
2. SubtaskEngine 检测到是内容发布场景
   ↓
3. 强制第一阶段：先执行合规检查
   - SubtaskEngine 强制生成合规检查决策
   - 执行 compliance_audit/checkContent MCP
   - 记录到 mcp_attempts[0]
   ↓
4. 合规检查完成，进入第二阶段
   - 继续下一轮迭代
   ↓
5. Agent B 决策：执行公众号上传
   - 执行 wechat_mp/addDraft MCP
   - 记录到 mcp_attempts[1]
   ↓
6. Agent B 决策：COMPLETE
   - 记录最终 response
   - mcp_attempts 包含2条记录
```

---

## 🔍 关键代码片段

### 1. 两阶段流程控制

```typescript
// ========== 两阶段流程控制 ==========
const needsTwoPhase = this.needsTwoPhaseProcess(task, executorResult);
const hasComplianceCheck = this.hasCompletedComplianceCheck(mcpExecutionHistory);
const isCompliancePassed = this.isComplianceCheckPassed(mcpExecutionHistory);

console.log('[SubtaskEngine] 两阶段流程检查:', {
  needsTwoPhase,
  hasComplianceCheck,
  isCompliancePassed
});

// 如果需要两阶段流程，但还没做合规检查
if (needsTwoPhase && !hasComplianceCheck) {
  console.log('[SubtaskEngine] 强制第一阶段：先执行合规检查');
  
  // 强制 Agent B 先调用合规检查
  const forcedComplianceDecision = await this.forceComplianceCheckDecision(...);
  
  if (forcedComplianceDecision.type === 'EXECUTE_MCP') {
    // 执行合规检查 MCP
    const mcpSuccess = await this.executeMcpWithRetry(...);
    
    if (mcpSuccess) {
      console.log('[SubtaskEngine] 合规检查完成，继续流程');
      continue; // 继续下一轮
    }
  }
}
```

### 2. Agent B Prompt 中的两阶段说明

```typescript
【重要：两阶段流程】
如果任务涉及保险事业部内容发布（insurance-d + 公众号发布），必须严格遵循：
1. 第一阶段：先调用合规检查 MCP（compliance_audit/checkContent）
2. 第二阶段：合规通过后，再调用公众号上传 MCP（wechat_mp/addDraft）

【当前状态检查】
- 是否已完成合规检查：是/否
- 合规检查是否通过：是/否
```

---

## 📈 预期的 Step History 记录

### 完整流程示例

| 记录 | interactType | interactNum | 说明 | mcp_attempts |
|------|-------------|-------------|------|--------------|
| 1 | `'request'` | 1 | insurance-d 发起请求 | - |
| 2 | `'response'` | 1 | 执行合规检查 MCP | - |
| 3 | `'response'` | 2 | 执行公众号上传 MCP | [合规检查] |
| 4 | `'response'` | 3 | Agent B 最终决策（COMPLETE） | [合规检查, 公众号上传] |

### mcp_attempts 数据结构

```json
{
  "mcp_attempts": [
    {
      "attemptId": "mcp-xxx-1",
      "attemptNumber": 1,
      "decision": {
        "toolName": "compliance_audit",
        "actionName": "checkContent",
        "reasoning": "强制执行合规检查（两阶段流程第一阶段）"
      },
      "result": {
        "status": "success",
        "data": {
          "is_compliant": true,
          "check_passed": true
        }
      }
    },
    {
      "attemptId": "mcp-xxx-2",
      "attemptNumber": 2,
      "decision": {
        "toolName": "wechat_mp",
        "actionName": "addDraft",
        "reasoning": "合规通过，执行公众号上传"
      },
      "result": {
        "status": "success",
        "data": {
          "media_id": "1234567890"
        }
      }
    }
  ]
}
```

---

## ✅ 验证清单

- [x] 新增 4 个辅助函数
- [x] 修改主循环逻辑，添加两阶段流程控制
- [x] 修改 Agent B Prompt，添加两阶段流程说明
- [ ] 类型检查通过
- [ ] 测试验证流程正确性

---

## 🎯 下一步

1. **类型检查**：运行 `npx tsc --noEmit` 验证代码
2. **测试验证**：运行相关测试用例验证流程
3. **回归测试**：确保非内容发布场景不受影响
