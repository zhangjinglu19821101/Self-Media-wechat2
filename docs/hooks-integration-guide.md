# Hooks 集成指南

## 当前状态

✅ **已完成**:
- 创建了 4 个自定义 Hooks (useAgentChat, useSplitDialogs, useNotifications, useTaskResults)
- 添加了 hooks 的导入到 page.tsx
- 所有 hooks 编译通过

⚠️ **待完成**:
- 在 page.tsx 中使用这些 hooks 替换现有状态和函数
- 清理重复代码
- 测试验证功能

## 集成步骤

### 1. 导入 Hooks (已完成 ✅)

```typescript
import {
  useAgentChat,
  useSplitDialogs,
  useNotifications,
  useTaskResults,
} from './hooks';
```

### 2. 使用 Hooks 替换现有状态

由于 page.tsx 文件很大（2968 行），完全集成需要以下步骤：

#### 步骤 2.1: 初始化 Hooks

在 `AgentChatPage` 组件中，在现有的状态声明之后添加：

```typescript
// 🔥 使用自定义 Hooks
const SPLIT_KEYWORDS = ['B', 'insurance-c', 'insurance-d', 'C', 'D'];

// 📦 useAgentChat Hook
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

// 📦 useSplitDialogs Hook
const splitDialogs = useSplitDialogs({
  agentId,
  messages,
  setMessages,
  sendCommandToAgent,
  setSplitResult,
  setSplitExecutor,
  setSplitResultTaskId,
  setCurrentNotificationId,
  setRejectReason,
  setShowRejectReasonDialog,
  setShowSplitResultConfirm,
  setShowSplitDialog,
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

// 📦 useNotifications Hook
const notifications = useNotifications({
  agentId,
});

// 📦 useTaskResults Hook
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

#### 步骤 2.2: 替换使用旧状态的代码

**聊天相关**:
```typescript
// ❌ 旧代码
const [input, setInput] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const messagesEndRef = useRef<HTMLDivElement>(null);

// ✅ 新代码
const { input, setInput, loading, error, messagesEndRef } = agentChat;
```

**拆解对话框相关**:
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

**通知相关**:
```typescript
// ❌ 旧代码
const [feedbacks, setFeedbacks] = useState<any[]>([]);
const [feedbackStats, setFeedbackStats] = useState<any>(null);

// ✅ 新代码
const { feedbacks, feedbackStats, handleResolveFeedback, handleRejectFeedback } = notifications;
```

**任务结果相关**:
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

#### 步骤 2.3: 替换函数调用

**发送消息**:
```typescript
// ❌ 旧代码
const sendMessage = async () => { /* ... */ };

// ✅ 新代码
const { sendMessage } = agentChat;
```

**拆解确认/取消**:
```typescript
// ❌ 旧代码
const handleSplitConfirm = async () => { /* ... */ };
const handleSplitCancel = async () => { /* ... */ };

// ✅ 新代码
const { handleSplitConfirm, handleSplitCancel } = splitDialogs;
```

**反馈处理**:
```typescript
// ❌ 旧代码
const handleResolveFeedback = async (feedbackId: string, resolution: string, resolvedCommand: string) => { /* ... */ };
const handleRejectFeedback = async (feedbackId: string, resolution: string) => { /* ... */ };

// ✅ 新代码
const { handleResolveFeedback, handleRejectFeedback } = notifications;
```

#### 步骤 2.4: 移除重复代码

在集成 hooks 后，可以移除以下内容：
- 重复的状态声明
- 重复的函数定义
- 重复的 useEffect

### 3. 验证和测试

```bash
# 检查编译
npx tsc --noEmit

# 检查服务运行
curl -I http://localhost:5000

# 测试各个功能
```

## 注意事项

⚠️ **重要**: 完全集成需要大量修改，建议：

1. **渐进式集成**: 一次集成一个 hook，测试通过后再集成下一个
2. **备份代码**: 每次修改前都备份当前版本
3. **充分测试**: 每次集成后都要充分测试功能
4. **保留备份**: 保留 `page.tsx.backup` 作为回退版本

## 当前文件状态

- ✅ `page.tsx` - 原始文件（未修改）
- ✅ `page.tsx.backup` - 备份文件
- ✅ `src/app/agents/[id]/hooks/` - Hooks 目录
- ✅ 所有 hooks 已创建并编译通过

## 下一步

建议按照以下顺序逐步集成：

1. ✅ 先集成 `useNotifications` (最独立)
2. ⏳ 然后集成 `useTaskResults`
3. ⏳ 再集成 `useAgentChat`
4. ⏳ 最后集成 `useSplitDialogs` (最复杂)

这样可以确保每一步都是可控的，出现问题可以快速定位和修复。
