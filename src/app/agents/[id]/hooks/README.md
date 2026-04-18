# Agent Hooks

本目录包含 Agent 页面相关的自定义 Hooks，用于管理不同的功能模块。

## 📁 目录结构

```
hooks/
├── useAgentChat.ts      # 聊天状态管理
├── useAgentSplit.ts     # 拆解流程管理
├── useFeedback.ts       # 反馈处理管理
└── README.md            # 本文档
```

## 🎯 Hook 说明

### 1. useAgentChat

**职责**：
- 管理聊天消息状态
- 处理消息发送逻辑
- 管理加载状态和错误状态
- 管理对话历史

**使用示例**：

```typescript
import { useAgentChat } from './hooks/useAgentChat';

function MyComponent() {
  const {
    messages,
    input,
    loading,
    sendMessage,
    setInput,
    clearHistory,
  } = useAgentChat({
    agentId: 'A',
    onMessageSent: (message) => {
      console.log('消息已发送:', message);
    },
    onMessageReceived: (message) => {
      console.log('收到消息:', message);
    },
  });

  return (
    <div>
      <div>
        {messages.map((msg) => (
          <div key={msg.id}>{msg.content}</div>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        }}
      />
      <button onClick={sendMessage} disabled={loading}>
        {loading ? '发送中...' : '发送'}
      </button>
    </div>
  );
}
```

**API**：

| 属性/方法 | 类型 | 说明 |
|----------|------|------|
| `messages` | `Message[]` | 消息列表 |
| `input` | `string` | 输入框内容 |
| `loading` | `boolean` | 是否正在发送 |
| `error` | `string` | 错误信息 |
| `sessionId` | `string` | 会话 ID |
| `sendMessage` | `() => Promise<void>` | 发送消息 |
| `cancelSending` | `() => void` | 取消发送 |
| `clearHistory` | `() => void` | 清空历史 |
| `deleteMessage` | `(id: string) => void` | 删除消息 |
| `addMessage` | `(message: Message) => void` | 添加消息 |
| `setInput` | `(value: string) => void` | 设置输入框内容 |

---

### 2. useAgentSplit

**职责**：
- 管理拆解结果相关的状态
- 处理拆解结果的确认、拒绝、放弃操作
- 管理拆解结果弹框的显示和隐藏
- 处理拆解任务的队列管理

**使用示例**：

```typescript
import { useAgentSplit } from './hooks/useAgentSplit';

function MyComponent() {
  const {
    showSplitResultConfirm,
    splitResult,
    splitExecutor,
    handleSplitResultConfirm,
    handleSplitResultReject,
    handleSplitResultAbandon,
    showSplitResult,
  } = useAgentSplit({
    agentId: 'B',
    onSplitConfirmed: (result) => {
      console.log('拆解已确认:', result);
    },
    onSplitRejected: (reason) => {
      console.log('拆解已拒绝:', reason);
    },
    onSplitAbandoned: () => {
      console.log('拆解已放弃');
    },
  });

  // 显示拆解结果
  const handleShowSplitResult = () => {
    showSplitResult(
      {
        subTasks: [
          {
            taskTitle: '任务1',
            commandContent: '描述1',
            executor: 'insurance-d',
            taskType: 'daily',
            priority: '高',
            deadline: '2025-02-18',
            estimatedHours: '4',
            acceptanceCriteria: '标准1',
          },
        ],
      },
      'task-123',
      'notification-456',
      'Agent B'
    );
  };

  return (
    <div>
      {showSplitResultConfirm && (
        <Dialog>
          <DialogTitle>确认拆解方案</DialogTitle>
          <DialogContent>
            <div>执行者：{splitExecutor}</div>
            <div>任务数：{splitResult?.subTasks?.length || 0}</div>
          </DialogContent>
          <DialogFooter>
            <Button onClick={handleSplitResultAbandon}>放弃</Button>
            <Button onClick={handleSplitResultReject}>拒绝</Button>
            <Button onClick={handleSplitResultConfirm}>确认</Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
```

**API**：

| 属性/方法 | 类型 | 说明 |
|----------|------|------|
| `showSplitResultConfirm` | `boolean` | 是否显示拆解结果确认弹框 |
| `splitResult` | `SplitResult \| null` | 拆解结果 |
| `splitExecutor` | `string` | 拆解执行者 |
| `handleSplitResultConfirm` | `() => Promise<void>` | 确认拆解结果 |
| `handleSplitResultReject` | `() => void` | 拒绝拆解结果 |
| `handleSplitResultAbandon` | `() => void` | 放弃拆解结果 |
| `showSplitResult` | `(result, taskId, notificationId, executor) => void` | 显示拆解结果 |
| `addToPendingQueue` | `(notification, jsonData, taskId, executor) => void` | 添加到待显示队列 |

---

### 3. useFeedback

**职责**：
- 管理反馈列表状态
- 处理反馈的解决和驳回
- 管理反馈统计信息
- 定时加载反馈列表

**使用示例**：

```typescript
import { useFeedback } from './hooks/useFeedback';

function MyComponent() {
  const {
    feedbacks,
    feedbackStats,
    loading,
    handleResolveFeedback,
    handleRejectFeedback,
  } = useFeedback({
    agentId: 'A',
    pollingInterval: 30000, // 30 秒轮询
    autoLoad: true,
    onFeedbackResolved: (feedback) => {
      console.log('反馈已解决:', feedback);
      toast.success('反馈已处理');
    },
    onFeedbackRejected: (feedback) => {
      console.log('反馈已驳回:', feedback);
      toast.success('反馈已驳回');
    },
  });

  const handleResolve = async (feedbackId: string) => {
    const result = await handleResolveFeedback(
      feedbackId,
      '已处理完成',
      '新的指令内容'
    );
    
    if (result.success) {
      console.log('解决成功');
    } else {
      console.error('解决失败:', result.error);
    }
  };

  return (
    <div>
      {feedbackStats && (
        <div>
          <span>总计：{feedbackStats.total}</span>
          <span>待处理：{feedbackStats.pending}</span>
        </div>
      )}
      <div>
        {feedbacks.map((feedback) => (
          <div key={feedback.feedbackId}>
            <div>{feedback.message}</div>
            <div>状态：{feedback.status}</div>
            <button onClick={() => handleResolve(feedback.feedbackId)}>
              解决
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**API**：

| 属性/方法 | 类型 | 说明 |
|----------|------|------|
| `feedbacks` | `Feedback[]` | 反馈列表 |
| `feedbackStats` | `FeedbackStats \| null` | 反馈统计 |
| `loading` | `boolean` | 是否正在加载 |
| `error` | `string` | 错误信息 |
| `loadFeedbacks` | `() => Promise<void>` | 加载反馈列表 |
| `handleResolveFeedback` | `(id, resolution, command) => Promise<Result>` | 解决反馈 |
| `handleRejectFeedback` | `(id, resolution) => Promise<Result>` | 驳回反馈 |
| `handleDeleteFeedback` | `(id) => Promise<Result>` | 删除反馈 |

---

## 🔄 集成到 page.tsx

### 简化后的 page.tsx 示例：

```typescript
'use client';

import { useAgentChat } from './hooks/useAgentChat';
import { useAgentSplit } from './hooks/useAgentSplit';
import { useFeedback } from './hooks/useFeedback';
import { MessageList } from './components/chat/MessageList';
import { MessageInput } from './components/chat/MessageInput';
import { SplitResultDialog } from './components/dialogs/SplitResultDialog';
import { FeedbackPanel } from './components/feedback/FeedbackPanel';

export default function AgentPage() {
  const params = useParams();
  const agentId = params.id as string;

  // 使用自定义 Hooks
  const {
    messages,
    input,
    loading,
    sendMessage,
    setInput,
    clearHistory,
  } = useAgentChat({
    agentId,
  });

  const {
    showSplitResultConfirm,
    splitResult,
    splitExecutor,
    handleSplitResultConfirm,
    handleSplitResultReject,
    handleSplitResultAbandon,
    showSplitResult,
  } = useAgentSplit({
    agentId,
  });

  const {
    feedbacks,
    feedbackStats,
    handleResolveFeedback,
    handleRejectFeedback,
  } = useFeedback({
    agentId,
  });

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto">
        <MessageList messages={messages} />
      </div>

      <MessageInput
        input={input}
        setInput={setInput}
        onSend={sendMessage}
        loading={loading}
      />

      <SplitResultDialog
        open={showSplitResultConfirm}
        onOpenChange={() => {}}
        splitResult={splitResult}
        splitExecutor={splitExecutor}
        onConfirm={handleSplitResultConfirm}
        onReject={handleSplitResultReject}
        onAbandon={handleSplitResultAbandon}
      />

      {agentId === 'A' && (
        <FeedbackPanel
          feedbacks={feedbacks}
          feedbackStats={feedbackStats}
          onResolve={handleResolveFeedback}
          onReject={handleRejectFeedback}
        />
      )}
    </div>
  );
}
```

---

## 📊 优化效果

### 优化前：
- page.tsx：3826 行
- 状态管理：30+ 个 useState
- 可维护性：低

### 优化后（Phase 1 完成）：
- page.tsx：可减少约 800 行（Chat 相关 400 行 + Split 相关 300 行 + Feedback 相关 100 行）
- 状态管理：封装在 Hooks 中
- 可维护性：显著提升
- 可复用性：提升

---

## 🚀 下一步

- [x] Phase 1：提取自定义 Hooks ✅
- [ ] Phase 2：提取 Dialog 组件
- [ ] Phase 3：提取工具函数和常量
- [ ] Phase 4：重构主页面

---

## 📝 注意事项

1. **渐进式重构**：不要一次性重构所有代码，分阶段进行
2. **保持向后兼容**：每次重构后都要测试功能
3. **类型安全**：使用 TypeScript 严格模式
4. **错误处理**：所有异步操作都要有错误处理
