# Hooks 集成到 page.tsx 的渐进式替换方案

## 📋 方案目标

将自定义 Hooks 完全集成到 `page.tsx`，替换现有逻辑，提高代码可维护性和可复用性。

## 🎯 核心原则

1. **渐进式集成**: 一次集成一个 Hook，测试通过后再进行下一步
2. **可回滚**: 每个步骤都能快速回滚到上一步
3. **保持可用**: 集成过程中服务必须保持可用
4. **充分测试**: 每个步骤都要进行功能测试

## 📊 方案概览

| 阶段 | Hook | 状态 | 预计难度 | 风险等级 |
|------|------|------|---------|---------|
| 阶段 1 | useNotifications | ⏳ 待开始 | ⭐ 低 | 🟢 低 |
| 阶段 2 | useTaskResults | ⏳ 待开始 | ⭐⭐ 中 | 🟡 中 |
| 阶段 3 | useAgentChat | ⏳ 待开始 | ⭐⭐⭐ 高 | 🟠 高 |
| 阶段 4 | useSplitDialogs | ⏳ 待开始 | ⭐⭐⭐⭐ 很高 | 🔴 高 |

## 🔧 集成前准备

### 1. 创建备份分支

```bash
git checkout -b hooks-integration-backup
git add -A
git commit -m "backup: 创建 Hooks 集成前的备份"
git checkout main
```

### 2. 创建功能分支

```bash
git checkout -b feature/hooks-integration
```

### 3. 记录当前状态

```bash
# 记录当前 commit
git log -1 > /tmp/hooks-integration-before.txt

# 记录当前 page.tsx 的行数
wc -l /workspace/projects/src/app/agents/[id]/page.tsx
```

---

## 🚀 阶段 1: 集成 useNotifications（最简单）

### 目标

将通知处理逻辑替换为 `useNotifications` Hook。

### 影响范围

- 状态变量：`feedbacks`, `feedbackStats`
- 函数：`handleResolveFeedback`, `handleRejectFeedback`
- useEffect：加载通知的 useEffect

### 步骤

#### Step 1.1: 添加 Hook 导入和初始化

```typescript
// 在文件顶部添加导入
import {
  useNotifications,
} from './hooks';

// 在 AgentChatPage 组件内部，useEffect 之后添加
const {
  feedbacks,
  feedbackStats,
  handleResolveFeedback,
  handleRejectFeedback,
} = useNotifications();
```

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 1.2: 移除重复的状态声明

删除以下代码：
```typescript
const [feedbacks, setFeedbacks] = useState<any[]>([]);
const [feedbackStats, setFeedbackStats] = useState<any>(null);
```

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 1.3: 移除重复的函数声明

删除以下函数：
- `handleResolveFeedback`
- `handleRejectFeedback`

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 1.4: 移除重复的 useEffect

删除加载通知的 useEffect（如果 Hook 内部已经包含）

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 1.5: 测试验证

测试功能：
1. 打开 Agent A 页面
2. 检查反馈列表是否正常显示
3. 测试"解决反馈"功能
4. 测试"拒绝反馈"功能

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 1.6: 提交

```bash
git add src/app/agents/[id]/page.tsx
git commit -m "feat(agents): 集成 useNotifications Hook"
```

**回滚方式**：
```bash
git reset --hard HEAD~1
```

### 验证清单

- [ ] 页面正常加载
- [ ] 反馈列表正常显示
- [ ] 解决反馈功能正常
- [ ] 拒绝反馈功能正常
- [ ] 无控制台错误
- [ ] 无 TypeScript 错误

---

## 🚀 阶段 2: 集成 useTaskResults（中等难度）

### 目标

将任务结果处理逻辑替换为 `useTaskResults` Hook。

### 影响范围

- 状态变量：`receivedTaskResults`, `pendingCommands`, `showCancelDialog`, `showClearConfirmDialog`
- 函数：`handleCancelCommand`, `confirmClearHistory`
- useEffect：处理任务结果的 useEffect

### 步骤

#### Step 2.1: 添加 Hook 导入和初始化

```typescript
// 在文件顶部添加导入
import {
  useNotifications,
  useTaskResults,
} from './hooks';

// 在 AgentChatPage 组件内部添加
const taskResults = useTaskResults({
  agentId,
  sessionId,
  messages,
  setMessages,
  setShowSplitResultConfirm,
  setSplitResult,
  setSplitResultTaskId,
  setCurrentNotificationId,
  setSplitExecutor,
  pendingSplitNotificationsRef,
  displayedCountRef,
  processedTaskResultsRef,
});
```

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 2.2: 替换状态变量

替换以下代码：
```typescript
// ❌ 旧代码
const [receivedTaskResults, setReceivedTaskResults] = useState<any[]>([]);
const [pendingCommands, setPendingCommands] = useState<any[]>([]);
const [showCancelDialog, setShowCancelDialog] = useState(false);
const [showClearConfirmDialog, setShowClearConfirmDialog] = useState(false);

// ✅ 新代码
const {
  receivedTaskResults, setReceivedTaskResults,
  pendingCommands, setPendingCommands,
  showCancelDialog, setShowCancelDialog,
  showClearConfirmDialog, setShowClearConfirmDialog,
  handleCancelCommand,
  confirmClearHistory,
} = taskResults;
```

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 2.3: 移除重复的函数

删除以下函数：
- `handleCancelCommand`
- `confirmClearHistory`

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 2.4: 测试验证

测试功能：
1. 接收任务结果通知
2. 查看任务结果列表
3. 测试取消命令功能
4. 测试清空历史功能

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 2.5: 提交

```bash
git add src/app/agents/[id]/page.tsx
git commit -m "feat(agents): 集成 useTaskResults Hook"
```

### 验证清单

- [ ] 任务结果正常接收
- [ ] 任务结果列表正常显示
- [ ] 取消命令功能正常
- [ ] 清空历史功能正常
- [ ] 无控制台错误
- [ ] 无 TypeScript 错误

---

## 🚀 阶段 3: 集成 useAgentChat（高难度）

### 目标

将聊天相关逻辑替换为 `useAgentChat` Hook。

### 影响范围

- 状态变量：`input`, `loading`, `error`, `messagesEndRef`
- 函数：`sendMessage`, `handleAutoScroll`
- useEffect：自动滚动的 useEffect

### 步骤

#### Step 3.1: 添加 Hook 导入和初始化

```typescript
import {
  useNotifications,
  useTaskResults,
  useAgentChat,
} from './hooks';

const SPLIT_KEYWORDS = ['B', 'insurance-c', 'insurance-d', 'C', 'D'];

const agentChat = useAgentChat({
  agentId,
  sessionId,
  messages,
  setMessages,
  currentTaskId,
  setCurrentTaskId,
  SPLIT_KEYWORDS,
  setPendingCommandsForSplit,
  setLastAssistantContent,
  setShowSplitDialog,
  sendCommandsAutomatically,
});
```

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 3.2: 替换状态变量

```typescript
// ❌ 旧代码
const [input, setInput] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const messagesEndRef = useRef<HTMLDivElement>(null);

// ✅ 新代码
const {
  input, setInput,
  loading, setLoading,
  error, setError,
  messagesEndRef,
  sendMessage,
} = agentChat;
```

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 3.3: 移除重复的函数

删除以下函数：
- `sendMessage`
- `handleAutoScroll`

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 3.4: 测试验证

测试功能：
1. 发送消息
2. 查看消息显示
3. 测试自动滚动
4. 测试错误处理

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 3.5: 提交

```bash
git add src/app/agents/[id]/page.tsx
git commit -m "feat(agents): 集成 useAgentChat Hook"
```

### 验证清单

- [ ] 发送消息功能正常
- [ ] 消息正常显示
- [ ] 自动滚动功能正常
- [ ] 错误处理正常
- [ ] 无控制台错误
- [ ] 无 TypeScript 错误

---

## 🚀 阶段 4: 集成 useSplitDialogs（最高难度）

### 目标

将拆解对话框逻辑替换为 `useSplitDialogs` Hook。

### 影响范围

- 状态变量：`splitResult`, `splitResultTaskId`, `splitExecutor`, `isProcessingSplitResult`
- 函数：`handleSplitResultConfirm`, `handleSplitResultReject`, `handleSubmitRejectReason`
- 对话框组件的 onConfirm, onReject 等回调

### 步骤

#### Step 4.1: 添加 Hook 导入和初始化

```typescript
import {
  useNotifications,
  useTaskResults,
  useAgentChat,
  useSplitDialogs,
} from './hooks';

const splitDialogs = useSplitDialogs({
  agentId,
  messages,
  setMessages,
  sendCommandToAgent,
  setSplitResult,
  setSplitResultTaskId,
  setCurrentNotificationId,
  setRejectReason,
  setShowRejectReasonDialog,
  setShowSplitResultConfirm,
  setIsProcessingSplitResult,
  displayedCountRef,
  pendingSplitNotificationsRef,
  submitLockRef,
  isClosingByButtonRef,
  currentNotificationId,
  splitResultTaskId,
  rejectReason,
  splitExecutor,
  splitResult,
});
```

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 4.2: 替换状态变量

```typescript
// ❌ 旧代码
const [splitResult, setSplitResult] = useState<any>(null);
const [splitResultTaskId, setSplitResultTaskId] = useState('');
const [splitExecutor, setSplitExecutor] = useState('Agent B');
const [isProcessingSplitResult, setIsProcessingSplitResult] = useState(false);

// ✅ 新代码
const {
  splitResult, setSplitResult,
  splitResultTaskId, setSplitResultTaskId,
  splitExecutor, setSplitExecutor,
  isProcessingSplitResult,
  handleSplitResultConfirm,
  handleSplitResultReject,
  handleSubmitRejectReason,
} = splitDialogs;
```

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 4.3: 移除重复的函数

删除以下函数：
- `handleSplitResultConfirm`
- `handleSplitResultReject`
- `handleSubmitRejectReason`

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 4.4: 测试验证

测试功能：
1. 显示拆解结果确认对话框
2. 测试确认拆解功能
3. 测试拒绝拆解功能
4. 测试输入拒绝原因

**回滚方式**：
```bash
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

#### Step 4.5: 提交

```bash
git add src/app/agents/[id]/page.tsx
git commit -m "feat(agents): 集成 useSplitDialogs Hook"
```

### 验证清单

- [ ] 拆解结果确认对话框正常显示
- [ ] 确认拆解功能正常
- [ ] 拒绝拆解功能正常
- [ ] 拒绝原因输入功能正常
- [ ] 无控制台错误
- [ ] 无 TypeScript 错误

---

## 🔄 回滚策略

### 单步回滚

如果某个步骤失败，执行：

```bash
# 回滚到上一个 commit
git reset --hard HEAD~1

# 或者恢复文件
git checkout HEAD -- src/app/agents/[id]/page.tsx
```

### 完全回滚

如果整个集成方案失败，执行：

```bash
# 切换到备份分支
git checkout hooks-integration-backup

# 或者回滚到集成前的 commit
git reset --hard <commit-hash>
```

### 快速回滚脚本

创建 `/tmp/rollback-hooks.sh`：

```bash
#!/bin/bash
echo "🔄 回滚 Hooks 集成..."
cd /workspace/projects

# 恢复 page.tsx
git checkout HEAD -- src/app/agents/[id]/page.tsx

# 清理 .next
rm -rf .next

# 重启服务
pkill -f "next dev"
sleep 2
coze dev > /app/work/logs/bypass/dev.log 2>&1 &

echo "✅ 回滚完成"
```

---

## 📝 集成检查清单

### 每个步骤完成后都要检查：

- [ ] TypeScript 编译通过：`npx tsc --noEmit`
- [ ] 服务正常运行：`curl -I http://localhost:5000`
- [ ] 无控制台错误：浏览器控制台无红色错误
- [ ] 功能正常测试：相关功能可用
- [ ] 日志健康检查：`tail -n 50 /app/work/logs/bypass/app.log | grep -i error`

### 最终集成完成后检查：

- [ ] 所有 4 个 Hooks 都已集成
- [ ] page.tsx 代码行数明显减少
- [ ] 所有功能正常工作
- [ ] 无编译错误
- [ ] 无运行时错误
- [ ] 性能无明显下降

---

## ⚠️ 注意事项

### 1. 不要一次性修改太多

每个 Step 都要小而独立，方便回滚。

### 2. 每个步骤都要测试

不要跳过测试，确保每个功能都正常工作。

### 3. 保留备份

始终有备份分支可以快速回滚。

### 4. 记录问题

如果遇到问题，详细记录下来，方便后续修复。

### 5. 服务可用性

集成过程中服务必须保持可用，不能长时间中断。

---

## 📈 预期成果

### 代码质量提升

- **可维护性**: 代码结构更清晰，职责分离
- **可复用性**: Hooks 可以在其他组件中复用
- **可测试性**: Hooks 可以单独测试

### 代码行数减少

- **原始 page.tsx**: ~2968 行
- **集成后 page.tsx**: ~1500-2000 行（预计减少 30-50%）
- **Hooks 代码**: ~800 行（4 个 Hooks）

### 性能影响

- **无影响**: Hooks 不会引入额外的性能开销
- **可能的优化**: React 的 memo 优化可能更有效

---

## 🚦 决策点

### 阶段 1 完成后

- ✅ 如果成功：继续阶段 2
- ❌ 如果失败：回滚，重新设计 useNotifications Hook

### 阶段 2 完成后

- ✅ 如果成功：继续阶段 3
- ❌ 如果失败：回滚，重新设计 useTaskResults Hook

### 阶段 3 完成后

- ✅ 如果成功：继续阶段 4
- ❌ 如果失败：回滚，重新设计 useAgentChat Hook

### 阶段 4 完成后

- ✅ 如果成功：集成完成，进行全面测试
- ❌ 如果失败：回滚，重新设计 useSplitDialogs Hook

---

## 📚 参考资料

- [React Hooks 最佳实践](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [React Hooks 规则](https://react.dev/warnings/invalid-hook-call-warning)
- [TypeScript 和 React Hooks](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/hooks/)

---

## 🎉 完成标准

### 功能完成

- [ ] 所有 4 个 Hooks 都已成功集成
- [ ] 所有功能正常工作
- [ ] 无回归问题

### 代码质量

- [ ] 代码结构清晰
- [ ] 职责分离明确
- [ ] 无重复代码

### 测试覆盖

- [ ] 所有功能都已测试
- [ ] 无已知 bug
- [ ] 性能无明显下降

### 文档完善

- [ ] Hooks 使用文档完整
- [ ] 代码注释清晰
- [ ] 集成过程文档完整

---

## 📞 联系方式

如果在集成过程中遇到问题，请：
1. 查看相关文档
2. 检查日志
3. 回滚到上一个步骤
4. 重新设计 Hook

---

**版本**: v1.0
**创建时间**: 2026-02-17
**最后更新**: 2026-02-17
**状态**: ⏳ 待开始
