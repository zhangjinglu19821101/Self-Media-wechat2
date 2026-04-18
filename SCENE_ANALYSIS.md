# 业务场景梳理与评估分析

## 📋 场景梳理概览

基于13个测试用例和代码分析，梳理出以下主要业务场景。

---

## 🎯 核心问题确认

### 用户问题
> 1. 强制执行合规检查，那对agent B来说，他的输入是啥？
> 2. 之前是insurance-d提供文章，问题是无法上传微信公众号？这样的场景有多少？

---

## 📊 13个测试用例场景分类

| 类别 | 测试用例 | 场景描述 | 是否需要合规检查 |
|------|---------|---------|-----------------|
| **内容合规审核** | TC-01A | 初始不合规→整改→成功上传公众号 | ✅ **是** |
| **内容合规审核** | TC-01B | 初始合规→直接上传公众号 | ✅ **是** |
| **内容合规审核** | TC-01C | 合规审核-流程完整性 | ✅ **是** |
| **内容合规审核** | TC-23 | 多次违规→多次整改→最终成功上传公众号 | ✅ **是** |
| **内容合规审核** | TC-24 | 合规通过-正常发布流程 | ✅ **是** |
| **内容合规审核** | TC-25 | 合规不通过-提示修改后重试 | ✅ **是** |
| **网页搜索** | TC-02 | 网页搜索带摘要 | ❌ 否 |
| **网页搜索** | TC-03 | 网页搜索（基础版） | ❌ 否 |
| **公众号发布** | TC-04 | 添加草稿 | ❌ 否（但可能依赖合规检查结果） |
| **重试机制** | TC-05 | MCP首次失败重试成功 | ❌ 否（技术场景） |
| **重试机制** | TC-06 | MCP多次失败最终失败 | ❌ 否（技术场景） |
| **迭代限制** | TC-07 | 达到最大迭代次数 | ❌ 否（技术场景） |
| **用户交互** | TC-08 | 用户确认后继续执行 | ❌ 否（技术场景） |

---

## 🔍 场景深度分析

### 类别1：内容合规审核场景（6个测试用例）

#### 场景描述
这是**保险事业部的核心业务场景**，涉及：
1. insurance-d 生成文章内容
2. Agent B 进行合规审核
3. 根据审核结果决定：
   - 合规 → 直接上传公众号
   - 违规 → 提示修改，等待用户整改
   - 多次违规 → 多次整改

#### insurance-d 的输出（Agent B 的输入）
根据 `src/lib/types/branch1-types.ts`：

```typescript
interface InsuranceDAnalysisResult {
  isNeedMcp: boolean;              // 是否需要调用 MCP
  problem: string;                  // 补全后的创作任务描述（含文章内容）
  domainScene: string;              // 保险创作场景标签
  capabilityType: string;           // 建议调用的 MCP 能力类型
  creationSuggestion: string;        // 创作决策建议
}
```

**关键点**：
- ✅ `problem` 字段包含了文章内容
- ✅ `capabilityType` 字段建议了需要调用的能力类型（如 "compliance_audit"、"wechat_upload"）

#### Agent B 的输入全貌
除了 insurance-d 的输出，Agent B 还接收：
1. **MCP 执行历史** (`mcpExecutionHistory`) - 之前的 MCP 调用记录
2. **用户反馈** (`userFeedback`) - 用户的交互反馈
3. **任务元数据** (`taskMeta`) - 任务ID、优先级、迭代次数等
4. **可用能力列表** (`availableCapabilities`) - 所有可用的 MCP 能力

#### 当前流程的问题
```
当前流程（有缺陷）：
1. insurance-d 输出文章内容
2. SubtaskEngine 调用 Agent B
3. Agent B 直接决策（可能直接输出合规/违规结论）
   ↓ 缺陷在此！
   - 如果 Agent B 说"合规"，但没有调用合规检查 MCP
   - 如果 Agent B 说"违规"，但没有调用合规检查 MCP
4. SubtaskEngine 记录 response（mcp_attempts = []）
```

---

### 类别2：网页搜索场景（2个测试用例）

#### 场景描述
- 执行网页搜索
- 生成搜索摘要（TC-02）或返回基础结果（TC-03）
- **不涉及内容合规审核**

#### 是否需要强制合规检查
❌ **不需要**

---

### 类别3：公众号发布场景（1个测试用例）

#### 场景描述
- 直接添加微信公众号草稿
- **可能依赖之前的合规检查结果**

#### 是否需要强制合规检查
⚠️ **视情况而定**：
- 如果是独立的发布任务 → 不需要
- 如果是内容审核后的发布 → 需要确保已经通过合规检查

---

### 类别4：技术场景（4个测试用例）

#### 场景描述
- TC-05：MCP 失败重试机制
- TC-06：MCP 重试限制
- TC-07：最大迭代次数限制
- TC-08：用户交互确认

#### 是否需要强制合规检查
❌ **不需要** - 这些是纯技术场景

---

## 📊 场景统计

### 按是否需要合规检查分类

| 分类 | 测试用例数 | 占比 |
|------|-----------|------|
| **需要合规检查** | 6 | 46.2% |
| **不需要合规检查** | 7 | 53.8% |
| **总计** | 13 | 100% |

### 需要合规检查的场景详情

| 测试用例 | 场景 | 核心特征 |
|---------|------|---------|
| TC-01A | 初始不合规→整改→成功 | 有违规内容，需要整改 |
| TC-01B | 初始合规→直接上传 | 内容合规，直接发布 |
| TC-01C | 合规审核流程完整性 | 纯审核流程 |
| TC-23 | 多次违规→多次整改→成功 | 多轮违规整改 |
| TC-24 | 合规通过-正常发布 | 合规后发布 |
| TC-25 | 合规不通过-提示修改 | 违规后提示修改 |

---

## 🎯 关键问题回答

### 问题1：强制执行合规检查，那对 Agent B 来说，他的输入是啥？

**答案**：

Agent B 的输入包括：

1. **insurance-d 的输出**（核心）：
   ```typescript
   {
     isNeedMcp: boolean,
     problem: string,           // ← 这里包含文章内容！
     domainScene: string,
     capabilityType: string,    // ← 建议的能力类型
     creationSuggestion: string
   }
   ```

2. **MCP 执行历史**：之前的 MCP 调用记录
3. **用户反馈**：用户的交互反馈
4. **任务元数据**：任务ID、优先级、迭代次数等
5. **可用能力列表**：所有可用的 MCP 能力

**关键点**：
- ✅ `problem` 字段已经包含了文章内容
- ✅ Agent B 有完整的信息来调用合规检查 MCP

---

### 问题2：之前是 insurance-d 提供文章，问题是无法上传微信公众号？这样的场景有多少？

**答案**：

#### "无法上传微信公众号"这类场景
让我梳理一下可能的场景：

| 场景类型 | 说明 | 测试用例 |
|---------|------|---------|
| **内容违规导致无法发布** | 文章内容违规，需要先整改 | TC-01A, TC-23, TC-25 |
| **技术问题导致上传失败** | MCP 调用失败，需要重试 | TC-05, TC-06 |
| **用户确认后再发布** | 需要用户确认后才发布 | TC-08 |

#### 场景数量统计
- **内容违规相关**：3个测试用例（TC-01A, TC-23, TC-25）
- **技术失败相关**：2个测试用例（TC-05, TC-06）
- **用户交互相关**：1个测试用例（TC-08）
- **总计**：6个测试用例涉及"无法直接发布"的情况

---

## 💡 修复方案建议

### 方案 A：按场景分类处理（推荐）

**核心思想**：不是所有场景都需要强制合规检查，只对内容审核场景强制执行。

**实现思路**：

```typescript
// 1. 判断是否需要强制合规检查
private needsMandatoryComplianceCheck(task: Task): boolean {
  // 条件1：来自 insurance-d
  const isInsuranceD = task.fromParentsExecutor === 'insurance-d';
  
  // 条件2：任务类型涉及内容审核/发布
  const isContentTask = 
    task.taskType?.includes('article') ||
    task.taskType?.includes('content') ||
    task.taskType?.includes('compliance') ||
    task.taskTitle?.includes('审核') ||
    task.taskTitle?.includes('合规') ||
    task.taskTitle?.includes('发布') ||
    task.taskTitle?.includes('公众号');
  
  return isInsuranceD && isContentTask;
}

// 2. 在主循环中强制执行
if (needsMandatoryComplianceCheck && mcpExecutionHistory.length === 0) {
  // 强制先执行合规检查
  const complianceResult = await this.forceExecuteComplianceCheck(task, executionContext);
  if (!complianceResult.success) {
    // 合规检查失败的处理
  }
}
```

### 方案 B：决策后验证（兜底方案）

**核心思想**：在 Agent B 输出决策后，验证逻辑一致性。

```typescript
// 验证决策逻辑
private validateDecisionLogic(decision: AgentBDecision, mcpHistory: McpAttempt[]): string | null {
  // 如果决策包含合规结论，但没有 MCP 记录
  const hasComplianceConclusion = this.hasComplianceConclusion(decision);
  const hasMcpRecord = mcpHistory.length > 0;
  
  if (hasComplianceConclusion && !hasMcpRecord) {
    return '有合规结论但无 MCP 执行记录';
  }
  return null;
}
```

---

## 📊 总结

### 关键发现

1. **需要合规检查的场景**：6个测试用例（46.2%）
2. **不需要合规检查的场景**：7个测试用例（53.8%）
3. **insurance-d 的输出**：已包含完整的文章内容（`problem` 字段）
4. **Agent B 的输入**：信息充分，完全可以调用合规检查 MCP

### 建议

✅ **推荐实施方案 A（按场景分类处理）**：
- 只对保险事业部内容审核场景强制合规检查
- 其他场景保持原有逻辑
- 同时加上方案 B（决策后验证）作为双重保障

### 下一步行动

1. 确认需要强制合规检查的场景判断逻辑
2. 实现方案 A（按场景分类处理）
3. 实现方案 B（决策后验证）作为兜底
4. 回归测试所有13个测试用例
