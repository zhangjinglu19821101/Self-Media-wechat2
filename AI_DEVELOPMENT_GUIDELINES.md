# AI 开发规范文档

> **目标**：约束 AI 的开发行为，避免反复修改、改坏功能、理解错误等问题
> **适用范围**：所有代码修改、功能开发、Bug 修复

---

## 🚨 🔴 最新追加：绝对禁止跳过业务逻辑（2026年2月25日）

### 🚨 典型错误案例：UUID 格式问题处理

**问题场景**：
- 遇到错误：`invalid input syntax for type uuid: "notification-xxx"`
- 表 `agent_notifications` 有两个字段：
  - `id` (uuid 类型) - 标准 UUID
  - `notification_id` (text 类型) - `"notification-xxx"` 格式

**❌ 绝对禁止的做法**：
```typescript
// ❌ 错误：直接跳过业务逻辑
let notifications: any[] = [];
console.log(`⚠️ 跳过通知查询，避免 UUID 格式问题`);

// ❌ 错误：继续跳过标记通知已读
console.log(`⚠️ 跳过标记通知已读，避免 UUID 格式问题`);
```

**✅ 正确的做法**：
```typescript
// 第一步：先查数据库 schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agent_notifications';

// 第二步：找到正确的字段，使用它！
let notifications = await sql`
  SELECT * FROM agent_notifications
  WHERE notification_id = ${notificationId}  -- ✅ 用这个！text 类型
  LIMIT 1;
`;

// 第三步：更新也用正确的字段
await sql`
  UPDATE agent_notifications
  SET is_read = ${'true'}
  WHERE notification_id = ${notificationId}  -- ✅ 用这个！
`;
```

**📋 核心教训**：
1. ✅ **宁可报错，也不能跳过业务逻辑**
2. ✅ **遇到数据库错误，先查 schema**
3. ✅ **找到正确的字段，再修复代码**
4. ✅ **业务流程完整性 > 避免报错**

---

## 🚨 最高优先级规则（2026年2月22日新增）

### 🔴 绝对禁止：未确认就改动代码

### 🔴 强制要求：所有时间字段必须使用 getCurrentBeijingTime() 函数

**用户明确要求：**
1. ✅ **所有时间字段必须使用 getCurrentBeijingTime() 函数**
2. ✅ **禁止直接使用 new Date() 来设置数据库时间字段**
3. ✅ **所有与北京时间相关的操作都必须使用 src/lib/utils/date-time.ts 中的工具函数**
4. ✅ **这是强制性要求，没有例外**

**常见错误示例（禁止使用）：**
```typescript
// ❌ 错误：直接使用 new Date() 设置时间字段
await db.update(agentSubTasks).set({
  startedAt: new Date(),        // ❌ 禁止！
  updatedAt: new Date(),        // ❌ 禁止！
  completedAt: new Date(),      // ❌ 禁止！
});

// ❌ 错误：使用 UTC 时间
const today = new Date().toISOString().split('T')[0];
```

**正确做法（必须使用）：**
```typescript
// ✅ 正确：导入并使用 getCurrentBeijingTime()
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

await db.update(agentSubTasks).set({
  startedAt: getCurrentBeijingTime(),    // ✅ 正确！
  updatedAt: getCurrentBeijingTime(),    // ✅ 正确！
  completedAt: getCurrentBeijingTime(),  // ✅ 正确！
});

// ✅ 正确：使用其他时间工具函数
import { formatBeijingTime, formatRelativeTime } from '@/lib/utils/date-time';

const formattedTime = formatBeijingTime(task.startedAt);
const relativeTime = formatRelativeTime(task.updatedAt);
```

**为什么这很重要：**
- 项目中已有统一的北京时间工具函数，避免重复造轮子
- 确保所有时间字段都使用同一套逻辑，保持一致性
- 未来如果需要调整时间处理逻辑，只需要修改一个地方
- 防止时区问题导致的功能错误

**检查清单（修改时间相关代码前必须确认）：**
```
□ 我导入了 getCurrentBeijingTime() 吗？
□ 我使用 getCurrentBeijingTime() 而不是 new Date() 吗？
□ 我是从 '@/lib/utils/date-time' 导入的吗？
□ 我没有直接使用 new Date() 设置数据库字段吗？
```

**可用的时间工具函数（src/lib/utils/date-time.ts）：**
- `getCurrentBeijingTime()` - 获取当前北京时间（返回 Date 对象）
- `formatBeijingTime()` - 格式化北京时间
- `formatRelativeTime()` - 格式化为相对时间（如：3分钟前）
- `formatDeadline()` - 格式化截止时间

---

**违反后果：**
- 日期计算错误
- 定时任务无法正常执行
- 功能逻辑混乱
- 需要反复修复

**用户明确要求：**
1. ❌ **没有让你改动都不得改动**
2. ❌ **必须跟用户确认才动手**
3. ❌ **不要直接就改动代码也不确认**
4. ❌ **不要沟通非常少就动手**
5. ✅ **只要不修改代码都是允许的**（查看、分析、找问题、写文档等都可以！）

**正确流程：**
```
1. 听用户描述问题
   ↓
2. 理解问题（不理解就问）
   ↓
3. 跟用户确认理解
   ↓
4. 用户同意后才动手
   ↓
5. 改动前再确认一次
```

**违反后果：**
- 可能造成代码混乱
- 可能引入新问题
- 可能需要反复回退

---

### ✅ 允许做的事情（不需要确认）

- ✅ 查看日志
- ✅ 查看代码
- ✅ 查看 git 历史
- ✅ 分析问题
- ✅ 写文档
- ✅ 添加注释
- ✅ 任何只读操作

---

### ❌ 需要确认才能做的事情

- ❌ 修改代码
- ❌ 删除文件
- ❌ 新增文件
- ❌ 运行 git 命令（除了只读命令）
- ❌ 任何修改操作

---

## 📋 修改前必读（绝对禁止跳过）

---

## 📋 修改前必读（绝对禁止跳过）

### 第一步：理解业务
在动手写代码之前，必须：

1. **画出业务流程图**
   - 明确每个节点的责任方（Agent B、insurance-d 等）
   - 标注数据流向
   - 标注边界条件

2. **和用户确认**
   - "我的理解是 X，对吗？"
   - "这个场景是这样处理吗？"
   - 如果不确定，**不要继续，先问清楚**

3. **分析现有代码**
   - 查找相关功能的实现
   - 理解为什么这样设计
   - 不要盲目修改"看着奇怪"的代码

### 第二步：自检清单
在写代码前，必须回答以下问题：

```
□ 我理解了业务流程吗？
□ 我画了流程图吗？
□ 我和用户确认理解了吗？
□ 我知道为什么要这样改吗？
□ 修改后如何验证？
□ 修改会不会影响其他功能？
```

---

## 🔴 禁止事项（绝对不可违反）

### 1. 禁止盲目修改
❌ 看到问题就直接改，改坏了再修
❌ 看到复杂逻辑就简化，导致功能失效
❌ 看到不理解的代码就删除

✅ **正确做法**：先理解、再确认、最后修改

### 2. 禁止混用不同业务阶段
❌ 将 Agent B 和 insurance-d 的通知混在一起处理
❌ 将不同拆解阶段的逻辑合并

**当前业务流程**：
```
agent_tasks (由 Agent A 管理)
  ↓ (第一步拆解：agent_tasks → daily_task)
daily_task (由 Agent B 拆分)
  - 通知格式：notif-A-B-split-xxx
  - taskId 格式：task-A-to-B-xxx
  - 特点：无日期信息
  - 处理规则：跳过日期优先级检查，允许所有未读通知显示

  ↓ (第二步拆解：daily_task → agent_sub_tasks)
agent_sub_tasks (由具体 agent 拆分，如 insurance-d)
  - 通知格式：notification-xxx
  - taskId 格式：daily-task-{agent}-{YYYY-MM-DD}-xxx
  - 特点：包含日期信息
  - 处理规则：按日期优先级处理，只显示最早日期的通知
```

### 3. 禁止破坏现有功能
❌ 为了修复一个问题，引入新问题
❌ 为了简化代码，删除重要逻辑
❌ 为了某个场景，影响其他场景

✅ **正确做法**：增量修改，每改一处验证一处

### 4. 禁止不充分验证
❌ 修改后只看部分日志
❌ 只测试正面用例，不测试边界情况
❌ 不测试相关联的功能

✅ **正确做法**：
- 修改后立即验证
- 看完整日志，确认无错误
- 测试所有相关场景

---

## ✅ 推荐做法

### 1. 修改流程
```
1. 理解需求
   ↓
2. 画流程图
   ↓
3. 和用户确认
   ↓
4. 分析现有代码
   ↓
5. 制定修改方案
   ↓
6. 增量修改（每次修改小步骤）
   ↓
7. 立即验证（每步都要验证）
   ↓
8. 完整测试
```

### 2. 增加注释
在关键代码位置添加详细注释：

```typescript
// 🔴 禁止修改警告
// 业务逻辑说明：
// 1. Agent B 负责第一步拆解（agent_tasks → daily_task）
//    - 通知无日期信息，不需要日期优先级控制
// 2. insurance-d 负责第二步拆解（daily_task → agent_sub_tasks）
//    - 通知有日期信息，需要按日期优先级处理
//
// ⚠️ 修改前必须：
// 1. 理解业务流程
// 2. 画流程图
// 3. 和用户确认
// 4. 增量验证
```

### 3. 验证步骤
每次修改后，必须：

1. **查看日志**
   - 检查是否有错误日志
   - 确认逻辑是否按预期执行

2. **检查页面**
   - 确认修改的功能正常
   - 确认相关功能未被破坏

3. **测试边界情况**
   - 测试空数据、异常数据
   - 测试多个通知同时显示的情况

---

## 📋 拆解结果通知统一规范（2026年2月23日新增）

### 🔴 强制要求：所有拆解结果通知必须遵循此规范

**适用范围：**
- Agent B 拆解通知
- insurance-d 拆解通知
- insurance-c 拆解通知（未来）
- 所有其他 Agent 拆解通知

### 统一规范内容

#### 1. 数据结构统一

**所有拆解结果通知必须设置 `content.splitResult`（对象格式）**

```typescript
// ✅ 正确做法
await createNotification({
  type: 'agent_b_split_result' | 'insurance_d_split_result' | 'insurance_c_split_result',
  content: {
    fromAgentId: 'B' | 'insurance-d' | 'insurance-c',
    toAgentId: 'A',
    message: '拆解完成，请确认拆解方案',
    splitResult: splitResultObject, // 🔥 必须：对象格式，不是字符串
  },
  result: JSON.stringify(splitResultObject), // 可选：向后兼容
});
```

**字段说明：**
- `content.splitResult`: **必须**，对象格式，包含完整的拆解结果
- `result`: 可选，JSON 字符串格式，用于向后兼容
- 前端统一从 `content.splitResult` 获取数据

#### 2. 前端解析逻辑统一

**所有拆解结果通知统一从 `content.splitResult` 获取数据**

```typescript
// ✅ 正确做法：统一解析逻辑
let rawResult: any;

// 优先从 content.splitResult 获取（对象格式）
if (typeof notification.content === 'string') {
  try {
    const contentObj = JSON.parse(notification.content);
    rawResult = contentObj.splitResult;
  } catch (e) {
    // 解析失败，尝试其他方式
  }
} else if (typeof notification.content === 'object' && notification.content?.splitResult) {
  rawResult = notification.content.splitResult;
}

// 兜底：从 result 字段获取（向后兼容）
if (!rawResult) {
  rawResult = notification.result;
}
```

**禁止：**
- ❌ 不要根据通知类型使用不同的解析逻辑
- ❌ 不要只从 `result` 字段获取数据
- ❌ 不要假设 `content.splitResult` 不存在

#### 3. 需要修改的清单

**当前状态：**
- ✅ insurance-d 单个拆解通知：已符合规范
- ✅ insurance-d 批量拆解通知：已符合规范（刚修复）
- ❌ Agent B 拆解通知：不符合规范（缺少 `content.splitResult`）
- ❌ 前端解析逻辑：不符合规范（根据通知类型区分）

**改造计划：**
1. 修改 Agent B 拆解通知，添加 `content.splitResult`
2. 修改前端解析逻辑，统一从 `content.splitResult` 获取
3. 确保 insurance-c 等未来 Agent 也遵循此规范

---

## 📝 当前已知业务规则

### 拆解通知处理规则

#### Agent B 的拆解通知
- **业务阶段**：第一步拆解（agent_tasks → daily_task）
- **通知特征**：
  - `notificationId` 格式：`notif-A-B-split-xxx`
  - `taskId` 格式：`task-A-to-B-xxx`
  - `fromAgentId`：`B`
  - `type`：`task_result`
  - `isRead`：可能为 true 或 false
- **处理规则**：
  - ✅ 跳过日期优先级检查
  - ✅ 允许所有未读通知显示弹框
  - ✅ 已读通知不显示弹框
- **禁止**：
  - ❌ 不要对 Agent B 的通知进行日期过滤

#### insurance-d 的拆解通知
- **业务阶段**：第二步拆解（daily_task → agent_sub_tasks）
- **通知特征**：
  - `notificationId` 格式：`notification-xxx`
  - `taskId` 格式：`daily-task-insurance-d-{YYYY-MM-DD}-xxx`
  - `fromAgentId`：`insurance-d`
  - `type`：`insurance_d_split_result` 或 `task_result`
  - `metadata.taskId` 包含日期信息
- **处理规则**：
  - ✅ 按日期优先级处理
  - ✅ 只显示最早日期的通知
  - ✅ 其他日期的通知跳过
  - ✅ 已读通知不显示弹框
- **禁止**：
  - ❌ 不要显示多个日期的通知

### 日期优先级逻辑
- **目标**：避免多个日期的拆解结果同时显示，导致混乱
- **规则**：
  1. 提取所有 insurance-d 通知的日期
  2. 排序找到最早日期
  3. 只显示最早日期的通知
  4. 其他日期的通知跳过

### 弹框队列机制
- **目标**：避免多个弹框同时显示，导致状态覆盖
- **规则**：
  1. 最多同时显示 2 个弹框
  2. 超过 2 个的通知加入队列
  3. 用户确认当前弹框后，显示队列中的下一个

---

## 🚨 常见错误案例

### 案例1：混淆 Agent B 和 insurance-d
**错误做法**：
```typescript
// ❌ 将 Agent B 和 insurance-d 混在一起处理
const splitNotifications = notifications.filter(n =>
  n.fromAgentId === 'B' || n.fromAgentId === 'insurance-d'
);
// 然后对 mixedNotifications 进行日期过滤
```

**正确做法**：
```typescript
// ✅ 分离处理
const agentBNotifications = notifications.filter(n => n.fromAgentId === 'B');
const insuranceDNotifications = notifications.filter(n => n.fromAgentId === 'insurance-d');

// Agent B 的通知不进行日期过滤
processAgentBNotifications(agentBNotifications);

// insurance-d 的通知进行日期过滤
processInsuranceDNotifications(insuranceDNotifications);
```

### 案例2：不充分验证
**错误做法**：
```typescript
// ❌ 只看了一个通知的日志
console.log(`处理通知: ${notificationId}`);
// 就以为成功了
```

**正确做法**：
```typescript
// ✅ 查看完整日志
console.log(`处理通知: ${notificationId}`);
console.log(`Agent B 通知数量: ${agentBCount}`);
console.log(`insurance-d 通知数量: ${insuranceDCount}`);
console.log(`日期分组: ${dateGroups}`);
// 确认所有场景都正常
```

---

## 📋 每次对话开始时的提示

**用户提示 AI**：
```
请记住：
1. 先理解业务，画流程图，和用户确认
2. Agent B 和 insurance-d 的业务阶段不同，不能混在一起
3. 修改后立即验证
4. 遵循 AI_DEVELOPMENT_GUIDELINES.md 文档
```

**AI 自检**：
```
🔍 我是否已经：
□ 画了业务流程图？
□ 和用户确认了理解？
□ 分析了现有代码？
□ 制定了修改方案？
```

---

## 🔄 文档维护

- **创建日期**：2026-02-15
- **维护规则**：每次发现新规则或错误案例，立即更新此文档
- **版本**：v1.0

---

## 💡 记住

> "宁可多花 5 分钟理解，也不要花 50 分钟反复修改"
> "先想清楚，再动手，不要边改边想"
