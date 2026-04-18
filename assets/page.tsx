'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, ArrowLeft, RefreshCw, MessageSquare, TrendingUp, CheckCircle, AlertTriangle, Clock, XCircle, ChevronUp, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { AgentWebSocketStatus } from '@/components/agent-websocket-status';
import { FeedbackCard } from '@/components/feedback-card';
import { CommandResultsPanel } from '@/components/command-results-panel';
import { SubmitCommandResultDialog } from '@/components/submit-command-result-dialog';
import { SubmitFeedbackDialog } from '@/components/submit-feedback-dialog';
import { ReceivedTasksPanel } from '@/components/received-tasks-panel';
import { DraftListPanel } from '@/components/draft-list-panel';
import { SaveDraftButton } from '@/components/save-draft-button';
import { AgentReceiptManager } from '@/components/agent-receipt-manager';
import { AgentTaskList } from '@/components/agent-task-list';
import { detectCommands, formatCommandForAgent, sendCommandToAgent } from '@/lib/command-detector';
import { useAgentWebSocket } from '@/hooks/use-agent-websocket';
import { mapExecutorId } from '@/lib/utils/agent-mapper';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Info } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  splitResult?: any; // 🔥 新增：存储拆解结果（如果有）
  notificationId?: string; // 🔥 新增：通知ID（用于去重）
  taskId?: string; // 🔥 新增：任务ID
  notificationType?: string; // 🔥 新增：通知类型
  metadata?: any; // 🔥 新增：元数据
  createdAt?: Date; // 🔥 新增：创建时间
}

// 🔥 提取完整的指令内容
function extractCommandSections(content: string): any[] {
  const commands: any[] = [];

  // 🔥 模式1：#### 1. 【技术类】向架构师B（技术支撑）下达的执行指令
  // 支持格式：
  // - #### 1. 【技术类】向架构师B（技术支撑）下达的执行指令
  // - #### 2. 【AI业务类】向AI事业部Agent C（业务经理）下达的执行指令
  const quadrupleHashPattern = /####\s*(\d+|[\u4e00-\u9fa5]+)[\）、.]\s*【([^\]]+】)?\s*向([^#\n]+)/g;
  let match;
  let lastEndPos = 0;

  // 先找到所有匹配的位置
  const quadrupleMatches: Array<{index: number, length: number, fullMatch: string, agentId: string, agentName: string}> = [];

  while ((match = quadrupleHashPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const agentInfo = match[3].trim(); // "架构师B（技术支撑）下达的执行指令" 或 "AI事业部Agent C（业务经理）下达的执行指令"

    // 从 agentInfo 中提取 Agent ID
    // 格式1：包含 "Agent" 关键字 -> "AI事业部Agent C（业务经理）下达的执行指令" -> ID="C"
    // 格式2：架构师B -> ID="B"
    // 格式3：保险事业部Agent insurance-c -> ID="insurance-c"
    let agentId = 'unknown';
    let agentName = agentInfo;

    if (agentInfo.includes('Agent')) {
      const agentMatch = agentInfo.match(/Agent\s*([A-Za-z0-9-]+)/i);
      if (agentMatch) {
        agentId = agentMatch[1];
        // 提取 Agent 名称（去除执行指令等后缀）
        const agentNameMatch = agentInfo.match(/([^（]+)\([^)]*\)/);
        agentName = agentNameMatch ? agentNameMatch[1].trim() : agentInfo.replace(/Agent\s+[A-Za-z0-9-]+.*/i, '').trim();
      }
    } else if (agentInfo.includes('架构师B')) {
      agentId = 'B';
      agentName = '架构师B（技术支撑）';
    } else if (agentInfo.includes('Agent B')) {
      agentId = 'B';
      agentName = '架构师B（技术支撑）';
    }

    console.log(`🔍 提取指令（四级标题）: "${fullMatch}" -> agentId="${agentId}", agentName="${agentName}"`);

    quadrupleMatches.push({
      index: match.index,
      length: fullMatch.length,
      fullMatch: fullMatch,
      agentId: agentId,
      agentName: agentName,
    });
  }

  // 提取每个指令的完整内容
  for (let i = 0; i < quadrupleMatches.length; i++) {
    const currentMatch = quadrupleMatches[i];
    const nextMatch = quadrupleMatches[i + 1];

    // 指令内容的起始位置：标题结束位置
    const contentStart = currentMatch.index + currentMatch.length;

    // 指令内容的结束位置：下一个指令的起始位置 或 内容的末尾
    const contentEnd = nextMatch ? nextMatch.index : content.length;

    // 提取指令内容
    const commandContent = content.substring(contentStart, contentEnd).trim();

    if (commandContent) {
      commands.push({
        id: `cmd_${Date.now()}_${commands.length}`,
        targetAgentId: currentMatch.agentId,
        targetAgentName: currentMatch.agentName,
        commandContent: currentMatch.fullMatch + '\n' + commandContent,
        commandType: 'instruction' as const,
        priority: 'normal' as const,
      });
    }
  }

  // 🔥 模式2：### （一）致 AI 事业部 Agent C
  // 支持格式：
  // - ### （一）致 AI 事业部 Agent C
  // - ### (1) 致 Agent B
  // - ### (2)致Agent insurance-c
  // - ### 三）致保险事业部 Agent insurance-d
  const tripleHashPattern = /###\s*[(（]?([\d一二三四五六七八九十]+)[)）\、.\s]*\s*致\s+([^\n]+)/g;

  // 先找到所有匹配的位置
  const tripleMatches: Array<{index: number, length: number, fullMatch: string, agentId: string, agentName: string}> = [];

  while ((match = tripleHashPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const agentInfo = match[2].trim(); // "AI 事业部 Agent C" 或 "Agent B"

    // 从 agentInfo 中提取 Agent ID
    // 格式1：包含 "Agent" 关键字 -> "AI 事业部 Agent C" -> ID="C"
    // 格式2：直接就是 Agent ID -> "Agent insurance-c" -> ID="insurance-c"
    // 格式3：纯中文 -> "保险事业部" -> ID=unknown
    let agentId = 'unknown';
    let agentName = agentInfo;

    if (agentInfo.includes('Agent')) {
      const agentMatch = agentInfo.match(/Agent\s*([A-Za-z0-9-]+)/i);
      if (agentMatch) {
        agentId = agentMatch[1];
        agentName = agentInfo.replace(/Agent\s+[A-Za-z0-9-]+/i, '').trim() || agentInfo;
      }
    } else if (/^[A-Za-z0-9-]+$/.test(agentInfo)) {
      // 如果整个信息就是 Agent ID（如 "Agent insurance-c" 中的 "insurance-c"）
      agentId = agentInfo;
      agentName = agentInfo;
    }

    console.log(`🔍 提取指令（三级标题）: "${fullMatch}" -> agentId="${agentId}", agentName="${agentName}"`);

    tripleMatches.push({
      index: match.index,
      length: fullMatch.length,
      fullMatch: fullMatch,
      agentId: agentId,
      agentName: agentName,
    });
  }

  // 提取每个指令的完整内容
  for (let i = 0; i < tripleMatches.length; i++) {
    const currentMatch = tripleMatches[i];
    const nextMatch = tripleMatches[i + 1];

    // 指令内容的起始位置：标题结束位置
    const contentStart = currentMatch.index + currentMatch.length;

    // 指令内容的结束位置：下一个指令的起始位置 或 内容的末尾
    const contentEnd = nextMatch ? nextMatch.index : content.length;

    // 提取指令内容
    const commandContent = content.substring(contentStart, contentEnd).trim();

    if (commandContent) {
      commands.push({
        id: `cmd_${Date.now()}_${commands.length}`,
        targetAgentId: currentMatch.agentId,
        targetAgentName: currentMatch.agentName,
        commandContent: currentMatch.fullMatch + '\n' + commandContent,
        commandType: 'instruction' as const,
        priority: 'normal' as const,
      });
    }
  }

  // 🔥 模式2：## 致 Agent B
  // 支持格式：
  // - ## 致 Agent B
  // - ##致Agent insurance-c
  const doubleHashPattern = /##\s*致\s+([^\n]+)/g;
  const doubleHashMatches: Array<{index: number, length: number, fullMatch: string, agentId: string, agentName: string}> = [];

  // 重置 lastIndex
  tripleHashPattern.lastIndex = 0;

  while ((match = doubleHashPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const agentInfo = match[1].trim();

    let agentId = 'unknown';
    let agentName = agentInfo;

    if (agentInfo.includes('Agent')) {
      const agentMatch = agentInfo.match(/Agent\s*([A-Za-z0-9-]+)/i);
      if (agentMatch) {
        agentId = agentMatch[1];
        agentName = agentInfo.replace(/Agent\s+[A-Za-z0-9-]+/i, '').trim() || agentInfo;
      }
    } else if (/^[A-Za-z0-9-]+$/.test(agentInfo)) {
      agentId = agentInfo;
      agentName = agentInfo;
    }

    console.log(`🔍 提取指令（双井号）: "${fullMatch}" -> agentId="${agentId}", agentName="${agentName}"`);

    doubleHashMatches.push({
      index: match.index,
      length: fullMatch.length,
      fullMatch: fullMatch,
      agentId: agentId,
      agentName: agentName,
    });
  }

  for (let i = 0; i < doubleHashMatches.length; i++) {
    const currentMatch = doubleHashMatches[i];
    const nextMatch = doubleHashMatches[i + 1];

    const contentStart = currentMatch.index + currentMatch.length;
    const contentEnd = nextMatch ? nextMatch.index : content.length;

    const commandContent = content.substring(contentStart, contentEnd).trim();

    if (commandContent) {
      commands.push({
        id: `cmd_${Date.now()}_${commands.length}`,
        targetAgentId: currentMatch.agentId,
        targetAgentName: currentMatch.agentName,
        commandContent: currentMatch.fullMatch + '\n' + commandContent,
        commandType: 'instruction' as const,
        priority: 'normal' as const,
      });
    }
  }

  // 🔥 模式4：## 【AI事业部内容岗指令 - Agent D】
  // 支持用户的格式：
  // - ## 【AI事业部内容岗指令 - Agent D】
  // - ## 【技术岗指令 - Agent B】
  // - ### 【强制前置】指令身份-任务匹配校验
  const bracketedHashPattern = /(?:###|##)\s*【([^】]+?)\s*-\s*Agent\s*([A-Za-z0-9-]+)】/g;

  // 重置 lastIndex
  doubleHashPattern.lastIndex = 0;

  while ((match = bracketedHashPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const instructionType = match[1].trim(); // "AI事业部内容岗指令"
    const agentId = match[2].trim(); // "D" 或 "B"

    // 从标题中提取 Agent 名称
    let agentName = `Agent ${agentId}`;
    if (instructionType.includes('AI事业部')) {
      agentName = `AI事业部 Agent ${agentId}`;
    } else if (instructionType.includes('保险事业部')) {
      agentName = `保险事业部 Agent ${agentId}`;
    } else if (instructionType.includes('技术')) {
      agentName = `架构师${agentId}（技术支撑）`;
    } else if (agentId === 'B') {
      agentName = `架构师${agentId}（技术支撑）`;
    }

    console.log(`🔍 提取指令（方括号格式）: "${fullMatch}" -> agentId="${agentId}", agentName="${agentName}"`);

    // 查找匹配的位置
    const startIndex = content.indexOf(fullMatch);

    // 查找下一个指令的开始位置
    const nextMatch = bracketedHashPattern.exec(content);
    let endIndex = content.length;

    if (nextMatch) {
      endIndex = content.indexOf(nextMatch[0]);
      // 重置 lastIndex 以便下一次循环
      bracketedHashPattern.lastIndex = 0;
      // 重新匹配当前位置
      bracketedHashPattern.exec(content);
    }

    // 提取指令内容
    const commandContent = content.substring(startIndex + fullMatch.length, endIndex).trim();

    if (commandContent) {
      commands.push({
        id: `cmd_${Date.now()}_${commands.length}`,
        targetAgentId: agentId,
        targetAgentName: agentName,
        commandContent: fullMatch + '\n' + commandContent,
        commandType: 'instruction' as const,
        priority: 'normal' as const,
      });
    }
  }

  // 🔥 模式5：#### 执行主体：insurance-c（运营类）
  // 支持用户的格式：
  // - #### 执行主体：insurance-c（运营类）
  // - #### 执行主体：agent B（技术类）
  // - #### 执行主体：insurance-d（内容类）
  const executionBodyPattern = /####\s*执行主体[：:]\s*([^\n（(]+?)[（(]([^）)]+)[）)]/g;

  // 重置 lastIndex
  bracketedHashPattern.lastIndex = 0;

  const executionBodyMatches: Array<{index: number, length: number, fullMatch: string, agentId: string, agentName: string, agentRole: string}> = [];

  while ((match = executionBodyPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const agentInfo = match[1].trim(); // "insurance-c" 或 "agent B"
    const agentRole = match[2].trim(); // "运营类" 或 "技术类"

    // 从 agentInfo 中提取 Agent ID
    let agentId = 'unknown';
    let agentName = agentInfo;

    // 去除 "agent " 或 "Agent " 前缀
    if (agentInfo.toLowerCase().startsWith('agent ')) {
      agentId = agentInfo.replace(/^agent\s*/i, '').trim();
      agentName = `Agent ${agentId}`;
    } else {
      agentId = agentInfo;
      agentName = agentInfo;
    }

    console.log(`🔍 提取指令（执行主体格式）: "${fullMatch}" -> agentId="${agentId}", agentName="${agentName}", agentRole="${agentRole}"`);

    executionBodyMatches.push({
      index: match.index,
      length: fullMatch.length,
      fullMatch: fullMatch,
      agentId: agentId,
      agentName: agentName,
      agentRole: agentRole,
    });
  }

  // 提取每个指令的完整内容
  for (let i = 0; i < executionBodyMatches.length; i++) {
    const currentMatch = executionBodyMatches[i];
    const nextMatch = executionBodyMatches[i + 1];

    // 指令内容的起始位置：标题结束位置
    const contentStart = currentMatch.index + currentMatch.length;

    // 指令内容的结束位置：下一个指令的起始位置 或 内容的末尾
    let contentEnd = content.length;
    if (nextMatch) {
      contentEnd = nextMatch.index;
    }

    // 提取指令内容
    const commandContent = content.substring(contentStart, contentEnd).trim();

    if (commandContent) {
      commands.push({
        id: `cmd_${Date.now()}_${commands.length}`,
        targetAgentId: currentMatch.agentId,
        targetAgentName: `${currentMatch.agentName}（${currentMatch.agentRole}）`,
        commandContent: currentMatch.fullMatch + '\n' + commandContent,
        commandType: 'instruction' as const,
        priority: 'normal' as const,
      });
    }
  }

  return commands;
}

export default function AgentChatPage() {
  const params = useParams();
  const agentId = params.id as string;
  const [agent, setAgent] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 使用 localStorage 持久化存储 sessionId，确保关闭窗口后能恢复对话历史
  const [sessionId] = useState(() => {
    const storageKey = `agent_${agentId}_sessionId`;
    let storedSessionId = '';
    if (typeof window !== 'undefined') {
      storedSessionId = localStorage.getItem(storageKey) || '';
    }
    // 如果没有存储的 sessionId，生成新的
    if (!storedSessionId) {
      storedSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, storedSessionId);
      }
    }
    return storedSessionId;
  });

  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [lastAssistantContent, setLastAssistantContent] = useState('');

  // 🔥 新增：任务拆解提示相关状态
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [pendingCommandsForSplit, setPendingCommandsForSplit] = useState<any[]>([]);
  const SPLIT_KEYWORDS = ['B', 'insurance-c', 'insurance-d', 'C', 'D']; // 需要拆解的 Agent（包括常见的 Agent）

  // 🔥 调试：监控 showSplitDialog 状态变化
  useEffect(() => {
    console.log('[Debug] showSplitDialog 状态变化:', showSplitDialog);
    console.log('[Debug] agentId:', agentId);
    console.log('[Debug] agentId === "A":', agentId === 'A');
    console.log('[Debug] pendingCommandsForSplit:', pendingCommandsForSplit);
    console.log('[Debug] SPLIT_KEYWORDS:', SPLIT_KEYWORDS);
  }, [showSplitDialog, agentId, pendingCommandsForSplit, SPLIT_KEYWORDS]);

  // 🔥 新增：拆解结果确认相关状态
  const [showSplitConfirmDialog, setShowSplitConfirmDialog] = useState(false);
  const [splitResultTaskId, setSplitResultTaskId] = useState('');
  const [splitResultCommands, setSplitResultCommands] = useState<any[]>([]);

  // 🔥 新增：Agent B 拆解结果确认相关状态
  const [showSplitResultConfirm, setShowSplitResultConfirm] = useState(false);
  const [splitResult, setSplitResult] = useState<any>(null);
  const [isProcessingSplitResult, setIsProcessingSplitResult] = useState(false);
  const [splitExecutor, setSplitExecutor] = useState('Agent B'); // 🔥 新增：拆解执行者
  const [isSplitResultDialogMinimized, setIsSplitResultDialogMinimized] = useState(false); // 🔥 新增：拆解结果弹框最小化状态

  // 🔥 新增：insurance-d 拆解 daily_task 相关状态
  const [showInsuranceDSplitDialog, setShowInsuranceDSplitDialog] = useState(false);
  const [selectedDailyTaskForSplit, setSelectedDailyTaskForSplit] = useState<any>(null);
  const [insuranceDSplitResult, setInsuranceDSplitResult] = useState<any>(null);
  const [isSplittingDailyTask, setIsSplittingDailyTask] = useState(false);

  // 🔥 新增：当前处理任务的 taskId（用于发送任务结果时使用）
  const [currentTaskId, setCurrentTaskId] = useState('');

  // 🔥 新增：拆解后发送失败的子任务（用于重试）
  const [failedSubTasks, setFailedSubTasks] = useState<any[]>([]);

  // 🔥 新增：拒绝原因输入对话框
  const [showRejectReasonDialog, setShowRejectReasonDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // 🔥 新增：反馈列表显示控制
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(true);

  // 🔥 新增：执行结果面板显示控制
  const [showCommandResultsPanel, setShowCommandResultsPanel] = useState(true);

  // 🔥 新增：已发送的拆解任务ID（用于去重）
  const sentSplitTaskIdsRef = useRef<Set<string>>(new Set());

  // 🔥 新增：任务列表相关状态
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [taskStats, setTaskStats] = useState<any>(null);
  const [showTaskListPanel, setShowTaskListPanel] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<any>(null);
  const [receivedTaskResults, setReceivedTaskResults] = useState<any[]>([]); // 🔥 新增：存储收到的任务结果
  const [pendingCommands, setPendingCommands] = useState<any[]>([]); // 🔥 新增：待处理指令列表
  const [showCancelDialog, setShowCancelDialog] = useState(false); // 🔥 新增：显示取消确认对话框
  const [cancelCommandTaskId, setCancelCommandTaskId] = useState<string>(''); // 🔥 新增：要取消的指令 taskId
  const [cancelReason, setCancelReason] = useState(''); // 🔥 新增：取消原因
  const [showClearConfirmDialog, setShowClearConfirmDialog] = useState(false); // 🔥 新增：显示清空历史确认对话框
  const [currentNotificationId, setCurrentNotificationId] = useState<string>(''); // 🔥 新增：当前拆解结果的通知 ID
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const processedNotificationsRef = useRef<Set<string>>(new Set()); // 🔥 避免重复添加通知消息到对话框
  const displayedCountRef = useRef(0); // 🔥 拆解结果显示计数器
  const pendingSplitNotificationsRef = useRef<any[]>([]); // 🔥 待显示的拆解结果队列
  const submitLockRef = useRef(false); // 🔥 请求锁：防止重复提交
  const isClosingByButtonRef = useRef(false); // 🔥 标记是否通过按钮关闭弹框

  // 🔥 使用 WebSocket 连接
  const wsStatus = useAgentWebSocket(agentId as any);

  // 🔥 保存当前任务的 taskId（用于发送任务结果时使用）
  useEffect(() => {
    if (wsStatus.lastMessage?.type === 'new_command' && wsStatus.lastMessage.taskId) {
      console.log(`📋 保存当前任务的 taskId: ${wsStatus.lastMessage.taskId}`);
      setCurrentTaskId(wsStatus.lastMessage.taskId);

      // 重新加载待处理指令
      loadPendingCommands();
    }
  }, [wsStatus.lastMessage]);

  // 🔥 加载待处理指令
  useEffect(() => {
    if (agentId === 'A') {
      loadPendingCommands();
    }
  }, [agentId]);

  // 🔥 处理收到的任务结果
  useEffect(() => {
    (async () => {
      if (wsStatus.lastMessage?.type === 'task_result') {
        const taskResult = wsStatus.lastMessage;
        console.log('🎉 Agent A 收到任务结果:', taskResult);
        console.log(`🎉 WebSocket 消息完整内容:`, JSON.stringify(taskResult, null, 2));
        console.log(`🎉 WebSocket 消息关键字段:`);
        console.log(`  - fromAgentId: ${taskResult.fromAgentId}`);
        console.log(`  - toAgentId: ${taskResult.toAgentId}`);
        console.log(`  - taskId: ${taskResult.taskId}`);
        console.log(`  - notificationId: ${taskResult.notificationId}`);
        console.log(`  - result 类型: ${typeof taskResult.result}`);

        // 将任务结果添加到列表中
        setReceivedTaskResults(prev => [
          {
            id: `result_${Date.now()}`,
            fromAgentId: taskResult.fromAgentId,
            toAgentId: taskResult.toAgentId,
            taskId: taskResult.taskId,
            result: taskResult.result,
            status: taskResult.status,
            timestamp: taskResult.timestamp,
          },
          ...prev,
        ]);

        // 🔥 检测是否是 Agent B 的拆解结果
        if (taskResult.fromAgentId === 'B' && taskResult.result && taskResult.taskId) {
          // 🔥 修复：从通知 API 获取真实的 notificationId
          let notificationId = taskResult.notificationId;
          
          if (!notificationId) {
            // 如果 WebSocket 消息中没有 notificationId，从通知 API 获取
            console.log(`📝 [WebSocket] WebSocket 消息中没有 notificationId，尝试从通知 API 获取...`);
            try {
              const notifResponse = await fetch('/api/agents/A/notifications?limit=10');
              if (notifResponse.ok) {
                const notifData = await notifResponse.json();
                // 🔥 修复：查找与当前 taskId 相关的未读通知，并且 splitPopupStatus 不是 rejected/confirmed/skipped
                const relatedNotification = notifData.data?.notifications?.find((n: any) => 
                  n.relatedTaskId === taskResult.taskId && 
                  n.fromAgentId === 'B' &&
                  !n.isRead &&
                  !['rejected', 'confirmed', 'skipped'].includes(n.metadata?.splitPopupStatus)
                );
                
                if (relatedNotification) {
                  notificationId = relatedNotification.notificationId;
                  console.log(`✅ [WebSocket] 从通知 API 获取到 notificationId: ${notificationId}`);
                  console.log(`📝 [WebSocket] 通知状态: ${relatedNotification.metadata?.splitPopupStatus}`);
                } else {
                  console.warn(`⚠️ [WebSocket] 未找到匹配的未处理通知（可能已拒绝/确认/跳过），跳过弹框`);
                  // 🔥 如果找不到匹配的通知，说明通知已被处理，跳过弹框
                  return;
                }
              }
            } catch (error) {
              console.error('❌ [WebSocket] 从通知 API 获取 notificationId 失败:', error);
              notificationId = `notif-${agentId}-${taskResult.fromAgentId}-${Date.now()}`;
            }
          }
          
          console.log(`✅ 处理新的拆解结果: ${notificationId}`);

          try {
            console.log('🔍 尝试解析 Agent B 的拆解结果...');
            console.log('📝 原始结果内容:', taskResult.result);

            let jsonData: any = null;

              // 🔥 修复：处理 JSON 对象和字符串格式的 result
              if (typeof taskResult.result === 'object') {
                // 如果已经是 JSON 对象，直接使用
                jsonData = taskResult.result;
                console.log('✅ result 已经是 JSON 对象');
              } else if (typeof taskResult.result === 'string') {
                // 如果是字符串，尝试解析
                // 尝试方法 1: 从 Markdown 代码块中提取 JSON
                const jsonMatch = taskResult.result.match(/```json\n?([\s\S]*?)\n?```/);
                if (jsonMatch) {
                  const jsonStr = jsonMatch[1].trim();
                  jsonData = JSON.parse(jsonStr);
                  console.log('✅ 通过方法 1（Markdown 代码块）成功解析');
                }
                // 尝试方法 2: 直接尝试解析整个结果为 JSON
                else {
                  try {
                    jsonData = JSON.parse(taskResult.result.trim());
                    console.log('✅ 通过方法 2（直接解析）成功解析');
                  } catch (e) {
                    console.log('⚠️ 直接解析失败，尝试其他方法');
                  }
                }

                // 尝试方法 3: 查找可能的 JSON 对象
                if (!jsonData) {
                  const jsonObjMatch = taskResult.result.match(/\{[\s\S]*"subTasks"[\s\S]*\}/);
                  if (jsonObjMatch) {
                    jsonData = JSON.parse(jsonObjMatch[0]);
                    console.log('✅ 通过方法 3（查找 subTasks 对象）成功解析');
                  }
                }
              } else {
                console.log('⚠️ result 格式不支持:', typeof taskResult.result);
              }

            // 验证解析结果
            if (jsonData && jsonData.subTasks && Array.isArray(jsonData.subTasks) && jsonData.subTasks.length > 0) {
              console.log(`🎉 检测到 Agent B 的拆解结果，包含 ${jsonData.subTasks.length} 条子任务`);
              console.log('📋 拆解结果:', jsonData);

              // 🔥 从拆解结果中获取实际的拆解执行者
              const firstExecutor = jsonData.subTasks[0]?.executor;
              console.log('🔍 拆解结果中的 executor:', firstExecutor);
              const mappedExecutor = mapExecutorId(firstExecutor);
              console.log('🔍 映射后的 executor:', mappedExecutor);
              const displayExecutor = mappedExecutor === 'insurance-d' ? 'insurance-d' :
                                      mappedExecutor === 'insurance-c' ? 'insurance-c' :
                                      'Agent B';
              console.log('🔥 显示的拆解执行者:', displayExecutor);

              // 🔥 修复：删除 insurance-d 预保存逻辑，直接使用 agent_tasks 的 taskId
              // 所有拆解结果（无论是 Agent B 还是 insurance-d）都先显示弹框，用户确认后才保存
              const actualTaskId = taskResult.taskId || '';

              // 显示拆解结果确认对话框
              // 🔥 修复：在弹框显示前，更新通知 metadata，标记为 popup_shown
              try {
                console.log(`📝 [弹框前] 更新通知状态为 popup_shown: ${notificationId}`);
                await fetch('/api/notifications/update-metadata', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    notificationId,
                    metadata: {
                      splitPopupStatus: 'popup_shown',
                      popupShownAt: new Date().toISOString(),
                    },
                  }),
                });
                console.log(`✅ [弹框前] 通知状态已更新为 popup_shown`);
              } catch (error) {
                console.error('❌ [弹框前] 更新通知状态失败:', error);
                // 不影响弹框显示，继续执行
              }

              setShowSplitResultConfirm(true);
              setSplitResultTaskId(actualTaskId);
              setSplitResult(jsonData);
              setSplitExecutor(displayExecutor);
              setCurrentNotificationId(taskResult.notificationId || '');
            } else {
              console.log('⚠️ 不是有效的拆解结果，作为普通任务结果处理');
              if (jsonData) {
                console.log('❌ 解析结果不包含 subTasks 字段或格式不正确:', jsonData);
              }
            }
          } catch (error) {
            console.log('⚠️ 解析拆解结果时出错:', error);
            console.log('⚠️ 将作为普通任务结果处理');
          }
        }

        // 显示通知
        if (taskResult.fromAgentId) {
        const agentName = taskResult.fromAgentId === 'B' ? '架构师B' :
                         taskResult.fromAgentId === 'C' ? 'Agent C' :
                         taskResult.fromAgentId === 'D' ? 'Agent D' :
                         `Agent ${taskResult.fromAgentId}`;

        // 🔥 修复：处理 JSON 对象和字符串格式的 result（使用精确类型）
        let resultDisplay = '';
        const result = taskResult.result;
        if (typeof result === 'string') {
          resultDisplay = result;
        } else if (typeof result === 'object' && result !== null) {
          // 如果是 JSON 对象，格式化显示
          const resultObj = result as Record<string, any>;
          if (resultObj.summary && resultObj.subTasks) {
            resultDisplay = `**摘要**: ${resultObj.summary}\n\n**子任务数量**: ${resultObj.subTasks.length}`;
          } else {
            resultDisplay = JSON.stringify(resultObj, null, 2);
          }
        } else {
          resultDisplay = String(result);
        }

        // 添加助手消息显示结果
        const resultMessage: Message = {
          id: `task_result_${Date.now()}`,
          role: 'assistant',
          content: `✅ **收到 ${agentName} 的执行结果**\n\n**任务 ID**: ${taskResult.taskId}\n\n**执行结果**:\n${resultDisplay}`,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, resultMessage]);
      }
    }
    })();
  }, [wsStatus.lastMessage]);

  // 🔥 加载历史任务结果（通知）
  useEffect(() => {
    console.log(`🔄 开始加载 Agent ${agentId} 的历史通知`);

    const loadNotifications = async () => {
      try {
        // 🔥 首次加载时清空 processedNotificationsRef，确保每次刷新页面都能重新加载所有通知
        // 注意：因为我们已经移除了轮询逻辑，所以不会重复添加通知
        processedNotificationsRef.current.clear();
        console.log(`🧹 已清空 processedNotificationsRef`);

        // 🔥 移除重置 showSplitResultConfirm，避免覆盖弹框状态
        // setShowSplitResultConfirm(false);
        // console.log(`🧹 已重置 showSplitResultConfirm 为 false`);

        // 🔥 修改：获取最近的已读通知，以便显示拆解结果弹框
        const response = await fetch(`/api/agents/${agentId}/notifications?includeRead=true`);
        console.log(`📡 通知 API 响应状态: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          console.log(`📦 通知 API 返回数据:`, data);

          if (data.success && data.data.notifications.length > 0) {
            console.log(`📨 加载了 ${data.data.notifications.length} 条历史通知`);

            // 🔥 新增：按拆解类型分组通知
            const allSplitNotifications = data.data.notifications.filter((n: any) =>
              (n.type === 'task_result' || n.type === 'insurance_d_split_result') &&
              (n.content?.fromAgentId === 'B' || n.content?.fromAgentId === 'insurance-d') &&
              (n.result || n.content?.splitResult)
            );

            console.log(`📊 找到 ${allSplitNotifications.length} 条拆解结果通知`);

            // 🔥 分离 Agent B 和 insurance-d 的通知
            const agentBNotifications = allSplitNotifications.filter((n: any) => n.content?.fromAgentId === 'B');
            const insuranceDNotifications = allSplitNotifications.filter((n: any) => n.content?.fromAgentId === 'insurance-d');

            console.log(`📊 Agent B 拆解通知: ${agentBNotifications.length} 条`);
            console.log(`📊 insurance-d 拆解通知: ${insuranceDNotifications.length} 条`);

            // 🔥 只对 insurance-d 的通知按日期分组
            const insuranceDNotificationsByDate = insuranceDNotifications.reduce((acc: Record<string, any[]>, notification: any) => {
              let date = 'unknown';
              const metadataTaskId = notification.metadata?.taskId || '';
              if (metadataTaskId.includes('-2025-')) {
                const dateMatch = metadataTaskId.match(/2025-(\d{2}-\d{2})/);
                if (dateMatch) {
                  date = '2025-' + dateMatch[1];
                }
              } else if (metadataTaskId.includes('-2026-')) {
                const dateMatch = metadataTaskId.match(/2026-(\d{2}-\d{2})/);
                if (dateMatch) {
                  date = '2026-' + dateMatch[1];
                }
              } else if (notification.metadata?.dates?.[0]) {
                date = notification.metadata.dates[0];
              }

              if (!acc[date]) acc[date] = [];
              acc[date].push(notification);
              return acc;
            }, {});

            const dates = Object.keys(insuranceDNotificationsByDate).sort();
            console.log(`📅 insurance-d 拆解结果按日期分组:`, dates.map(date => ({ date, count: insuranceDNotificationsByDate[date].length })));

            // 🔥 只对 insurance-d 的通知设置日期优先级
            const validDates = dates.filter(d => d !== 'unknown');
            const earliestDate = validDates[0];

            if (earliestDate) {
              console.log(`🎯 优先处理日期: ${earliestDate}`);
            }

            // 🔥 限制并行显示数量（最多 2 个）
            const displayLimit = 2;
            displayedCountRef.current = 0; // 重置计数

            // 🔥 先收集所有需要显示弹框的通知
            const pendingSplitNotifications: Array<{ notification: any, jsonData: any, displayExecutor: string }> = [];

            // 🔥 将通知添加到对话框中，并检查是否有拆解通知
            const notificationMessages = data.data.notifications
              .reverse() // 按时间正序显示
              .map((notification: any) => {
                // 🔥 获取 fromAgentId，优先从 content 中获取，兼容 insurance-d 拆解通知
                const fromAgentId = notification.content?.fromAgentId || notification.fromAgentId;
                const agentName = fromAgentId === 'B' ? '架构师B' :
                                 fromAgentId === 'C' ? 'Agent C' :
                                 fromAgentId === 'D' ? 'Agent D' :
                                 fromAgentId === 'insurance-d' ? 'insurance-d' :
                                 `Agent ${fromAgentId}`;

                // 🔥 提前定义 jsonData 变量，避免作用域问题
                let jsonData: any = null;

                  // 🔍 对于拆解结果通知，检查日期优先级
                  if (agentId === 'A' &&
                      (notification.type === 'task_result' || notification.type === 'insurance_d_split_result') &&
                      (fromAgentId === 'B' || fromAgentId === 'insurance-d') &&
                      (notification.result || notification.content?.splitResult)) {

                  // 🔥 对于拆解结果通知，不管是已读还是未读，都尝试显示弹框
                  // 但要避免重复显示同一个通知的弹框
                  console.log(`🔍 [弹框检查] 检查通知 ${notification.notificationId}`);
                  console.log(`🔍 [弹框检查] notificationId=${notification.notificationId}, taskId=${notification.taskId}`);
                  console.log(`🔍 [弹框检查] type=${notification.type}, isRead=${notification.isRead}, fromAgentId=${fromAgentId}`);
                  console.log(`🔍 [弹框检查] splitPopupStatus=${notification.metadata?.splitPopupStatus}`);

                  // 🔥 只对 insurance-d 的通知检查日期优先级（Agent B 的通知不需要日期检查）
                  if (fromAgentId === 'insurance-d') {
                    console.log(`🔍 [弹框检查] insurance-d 通知，检查日期优先级`);
                    const metadataTaskId = notification.metadata?.taskId || '';
                    let notificationDate = 'unknown';
                    if (metadataTaskId.includes('-2026-')) {
                      // 格式：daily-task-insurance-d-2026-02-19-010
                      const dateMatch = metadataTaskId.match(/2026-(\d{2}-\d{2})/);
                      if (dateMatch) {
                        notificationDate = '2026-' + dateMatch[1];
                      }
                    } else if (notification.metadata?.dates?.[0]) {
                      notificationDate = notification.metadata.dates[0];
                    }

                    if (notificationDate !== 'unknown' && earliestDate && notificationDate !== earliestDate) {
                      console.log(`⚠️ [弹框检查] insurance-d 通知跳过日期 ${notificationDate}，当前处理: ${earliestDate}`);
                      return null;
                    }
                  } else {
                    console.log(`🔍 [弹框检查] Agent B 通知，跳过日期检查`);
                  }

                  // 🔥 新增：限制并行显示数量
                  if (displayedCountRef.current >= displayLimit) {
                    console.log(`⚠️ [弹框检查] 已显示 ${displayedCountRef.current} 个弹框，等待用户确认`);
                    return null;
                  }

                  // 🔥 修复：检查通知的 splitPopupStatus，只显示状态为 null（未弹框）的通知
                  const splitPopupStatus = notification.metadata?.splitPopupStatus;
                  console.log(`🔍 [弹框检查] splitPopupStatus=${splitPopupStatus}`);

                  if (splitPopupStatus) {
                    // 通知已经有状态，不需要再弹框
                    const statusMap: Record<string, string> = {
                      'popup_shown': '已弹框',
                      'confirmed': '已确认',
                      'rejected': '已拒绝',
                      'skipped': '已跳过',
                    };
                    console.log(`⚠️ [弹框检查] 通知 ${notification.notificationId} 状态为 ${statusMap[splitPopupStatus] || splitPopupStatus}，跳过`);
                    return null;
                  }

                  // 🔥 新增：增加显示计数
                  displayedCountRef.current++;
                  console.log(`📊 [弹框检查] 显示计数: ${displayedCountRef.current}/${displayLimit}`);



                    try {
                      console.log(`🔍 尝试解析历史通知中的拆解结果...`);
                      console.log(`📝 原始结果:`, notification.result);

                      let rawResult: any = notification.result || notification.content?.splitResult;

                    // 🔥 修复：处理 JSON 对象和字符串格式的 result
                    if (typeof rawResult === 'object') {
                      // 如果已经是 JSON 对象，直接使用
                      jsonData = rawResult;
                      console.log('✅ result 已经是 JSON 对象');
                    } else if (typeof rawResult === 'string') {
                      // 尝试从 Markdown 代码块中提取 JSON
                      const jsonMatch = notification.result.match(/```json\n?([\s\S]*?)\n?```/);
                      if (jsonMatch) {
                        const jsonStr = jsonMatch[1].trim();
                        jsonData = JSON.parse(jsonStr);
                        console.log('✅ 通过 Markdown 代码块解析成功');
                      } else {
                        // 尝试直接解析
                        try {
                          jsonData = JSON.parse(notification.result.trim());
                          console.log('✅ 直接解析成功');
                        } catch (e) {
                          console.log('⚠️ 直接解析失败');
                        }
                      }

                      // 尝试查找 subTasks 对象
                      if (!jsonData) {
                        const jsonObjMatch = rawResult.match(/\{[\s\S]*"subTasks"[\s\S]*\}/);
                        if (jsonObjMatch) {
                          jsonData = JSON.parse(jsonObjMatch[0]);
                          console.log('✅ 通过 subTasks 对象解析成功');
                        }
                      }
                    } else {
                      console.log('⚠️ result 格式不支持:', typeof rawResult);
                    }

                    // 验证并显示弹框
                    if (jsonData && jsonData.subTasks && Array.isArray(jsonData.subTasks) && jsonData.subTasks.length > 0) {
                      console.log(`🎉 历史通知中找到拆解结果，包含 ${jsonData.subTasks.length} 条子任务`);
                      console.log(`🎉 [弹框显示] 准备显示拆解结果确认弹框...`);

                      // 🔥 从拆解结果中获取实际的拆解执行者
                      const firstExecutor = jsonData.subTasks[0]?.executor;
                      console.log('🔍 [历史通知] 拆解结果中的 executor:', firstExecutor);
                      const mappedExecutor = mapExecutorId(firstExecutor);
                      console.log('🔍 [历史通知] 映射后的 executor:', mappedExecutor);
                      const displayExecutor = mappedExecutor === 'insurance-d' ? 'insurance-d' :
                                             mappedExecutor === 'insurance-c' ? 'insurance-c' :
                                             'Agent B';
                      console.log('🔥 [历史通知] 显示的拆解执行者:', displayExecutor);

                      console.log(`🎉 [弹框显示] 准备设置状态...`);
                      console.log(`🎉 [弹框显示] notification.notificationId:`, notification.notificationId);

                      // 🔥 确保 notificationId 存在
                      if (!notification.notificationId) {
                        console.error('❌ [弹框显示] notification.notificationId 为空！');
                        console.error('❌ [弹框显示] notification 对象:', notification);
                        // 即使 notificationId 为空，也显示弹框，但会在确认时失败
                      }

                      // 🔥 状态驱动：直接使用通知的 taskId，不预保存
                      const taskIdToUse = notification.taskId || '';
                      console.log(`🔍 [历史通知] 使用通知的 taskId: ${taskIdToUse}`);

                      // 🔥 新增：检查是否已经有弹框显示
                      // 如果已经有弹框显示，将通知加入队列
                      if (showSplitResultConfirm || displayedCountRef.current > 0) {
                        console.log(`⚠️ [弹框显示] 已有弹框显示，将通知加入队列`);

                        // 🔥 修复：检查队列中是否已经存在相同的通知ID，避免重复添加
                        const existsInQueue = pendingSplitNotificationsRef.current.some(
                          item => item.notification.notificationId === notification.notificationId
                        );
                        if (existsInQueue) {
                          console.log(`⚠️ [弹框显示] 通知 ${notification.notificationId} 已在队列中，跳过`);
                          displayedCountRef.current--;
                          console.log(`📊 [弹框显示] 显示计数回退: ${displayedCountRef.current}/${displayLimit}`);
                          return null;
                        }

                        pendingSplitNotificationsRef.current.push({
                          notification,
                          jsonData,
                          taskIdToUse,
                          displayExecutor,
                        });
                        // 减少显示计数，因为这次没有真正显示
                        displayedCountRef.current--;
                        console.log(`📊 [弹框显示] 显示计数回退: ${displayedCountRef.current}/${displayLimit}`);
                        console.log(`📝 队列长度: ${pendingSplitNotificationsRef.current.length}`);
                        return null;
                      }

                      console.log(`🎉 [弹框显示] 准备显示弹框...`);
                      console.log(`🎉 [弹框显示] setShowSplitResultConfirm(true)`);
                      setShowSplitResultConfirm(true);

                      console.log(`🎉 [弹框显示] setSplitResultTaskId(${taskIdToUse})`);
                      setSplitResultTaskId(taskIdToUse); // ✅ 使用 UUID

                      console.log(`🎉 [弹框显示] setCurrentNotificationId(${notification.notificationId || 'NULL'})`);
                      setCurrentNotificationId(notification.notificationId || '');

                      console.log(`🎉 [弹框显示] setSplitResult(...)`);
                      setSplitResult(jsonData);
                      console.log(`🎉 [弹框显示] setSplitExecutor(${displayExecutor})`);
                      setSplitExecutor(displayExecutor);

                      console.log(`🎉 [弹框显示] 所有状态设置完成！`);
                    }
                  } catch (error) {
                    console.log('⚠️ 解析历史通知中的拆解结果失败:', error);
                  }
                }

                // 🔥 根据通知类型显示不同的内容
                let displayContent = '';
                if (notification.type === 'new_command' || notification.type === 'command') {
                  // 显示指令内容
                  const commandData = JSON.parse(notification.content || '{}');
                  displayContent = commandData.command || notification.content || '无内容';
                  return {
                    id: `notification_${notification.notificationId}`,
                    role: 'assistant' as const,
                    content: `✅ **收到来自 ${agentName} 的指令**\n\n**任务 ID**: ${notification.taskId || 'N/A'}\n\n**指令内容**:\n${displayContent}`,
                    notificationId: notification.notificationId,
                    taskId: notification.taskId,
                    notificationType: notification.type,
                    timestamp: new Date(notification.timestamp),
                  };
                }

                // 🔥 处理 task_result 类型的通知
                let resultDisplay = '';
                if (typeof notification.result === 'string') {
                  resultDisplay = notification.result;
                } else if (typeof notification.result === 'object') {
                  // 如果是 JSON 对象，格式化显示
                  if (notification.result.summary && notification.result.subTasks) {
                    resultDisplay = `**摘要**: ${notification.result.summary}\n\n**子任务数量**: ${notification.result.subTasks.length}`;
                  } else {
                    resultDisplay = JSON.stringify(notification.result, null, 2);
                  }
                } else {
                  resultDisplay = String(notification.result || '');
                }

                // 🔥 保存解析后的拆解结果（如果成功解析）
                let parsedSplitResult = null;
                let actualTaskId = notification.taskId; // 默认使用 taskId

                // 🔥 如果是 insurance-d 拆解，使用 relatedTaskId 或 metadata.dailyTaskId
                // 通过拆解结果中的 executor 字段判断是否是 insurance-d 拆解
                if (jsonData && jsonData.subTasks && jsonData.subTasks.length > 0) {
                  const firstExecutor = jsonData.subTasks[0]?.executor;
                  const mappedExecutor = mapExecutorId(firstExecutor);
                  if (mappedExecutor === 'insurance-d' || mappedExecutor === 'insurance-c') {
                    actualTaskId = notification.metadata?.dailyTaskId || notification.relatedTaskId || notification.taskId;
                  }
                }

                if (jsonData && jsonData.subTasks && Array.isArray(jsonData.subTasks) && jsonData.subTasks.length > 0) {
                  parsedSplitResult = jsonData;
                }

                return {
                  id: `notification_${notification.notificationId}`,
                  role: 'assistant' as const,
                  content: `✅ **收到 ${agentName} 的执行结果**\n\n**任务 ID**: ${notification.taskId}\n\n**执行结果**:\n${resultDisplay}`,
                  splitResult: parsedSplitResult, // 🔥 保存拆解结果
                  notificationId: notification.notificationId, // 🔥 保存通知ID（用于去重）
                  taskId: actualTaskId, // 🔥 保存实际任务 ID（insurance-d 拆解时使用 dailyTaskId）
                  notificationType: notification.type, // 🔥 保存通知类型
                  metadata: notification.metadata, // 🔥 保存 metadata
                  timestamp: new Date(notification.timestamp),
                };
              });

            // 🔥 过滤掉已处理过的通知消息和 null/undefined 元素
            const newNotifications = notificationMessages.filter((msg: any) => {
              if (!msg) return false; // 过滤掉 null/undefined
              if (processedNotificationsRef.current.has(msg.notificationId)) {
                console.log(`⚠️ 通知消息 ${msg.notificationId} 已处理过，跳过`);
                return false;
              }
              return true;
            });

            // 🔥 将新通知添加到已处理集合
            newNotifications.forEach((msg: any) => {
              processedNotificationsRef.current.add(msg.notificationId);
            });

            if (newNotifications.length > 0) {
              console.log(`📝 准备添加 ${newNotifications.length} 条新通知消息`);
              setMessages(prev => {
                console.log(`📝 当前消息数量: ${prev.length}`);
                const newMessages = [...prev, ...newNotifications];
                console.log(`📝 添加后消息数量: ${newMessages.length}`);
                return newMessages;
              });
            } else {
              console.log(`📝 没有新的通知消息需要添加`);
            }
          } else {
            console.log(`⚠️ 没有找到历史通知`);
          }
        } else {
          console.log(`❌ 通知 API 调用失败: ${response.status}`);
        }
      } catch (e) {
        console.error('❌ 加载历史通知失败:', e);
      }
    };

    // 首次加载通知（一次性）
    loadNotifications();

    // 🔥 启用定期轮询，检测新的拆解结果通知
    const pollInterval = setInterval(() => {
      console.log(`🔄 [轮询] 检查新的通知...`);
      loadNotifications();
    }, 5000); // 每 5 秒轮询一次

    // 清理函数：组件卸载时清除定时器
    return () => {
      clearInterval(pollInterval);
      console.log(`🧹 清除轮询定时器`);
    };
  }, [agentId]);

  // 从数据库加载对话历史（仅在首次加载时）
  useEffect(() => {
    if (historyLoaded) return;

    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/agents/${agentId}/history?sessionId=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.messages.length > 0) {
            setMessages(data.data.messages.map((m: any, idx: number) => ({
              id: `db_msg_${idx}`,
              role: m.role,
              content: m.content,
              timestamp: new Date(),
            })));
          }
        }
      } catch (e) {
        console.error('加载对话历史失败:', e);
      } finally {
        setHistoryLoaded(true);
      }
    };

    loadHistory();
  }, [agentId, sessionId, historyLoaded]);

  // 获取 Agent 信息
  useEffect(() => {
    fetch(`/api/admin/agent-builder/agent/${agentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAgent(data.data);
          // 如果没有历史记录，才添加欢迎消息
          if (messages.length === 0 && historyLoaded) {
            const welcomeContent = `你好！我是 ${data.data.name}（${data.data.role}）。\n\n${data.data.systemPrompt.substring(0, 200)}...\n\n请问有什么我可以帮您的？`;

            // 如果是 Agent A，添加指令下发说明
            const finalWelcomeContent = agentId === 'A'
              ? `${welcomeContent}\n\n---\n\n📌 **指令下达流程**：\n1. 你可以要求我整理并下发指令给其他 Agent\n2. 我会在对话框中整理完整的指令内容\n3. 系统会自动检测并显示确认对话框\n4. 你确认后，系统会自动发送指令给对应 Agent\n5. 其他 Agent 会实时收到通知\n\n💡 示例：输入"请再次下发全员的执行指令"`
              : welcomeContent;

            const welcomeMessage: Message = {
              id: 'welcome',
              role: 'assistant',
              content: finalWelcomeContent,
              timestamp: new Date(),
            };
            setMessages([welcomeMessage]);
          }
        }
      })
      .catch((err) => setError('获取 Agent 信息失败'));
  }, [agentId, messages.length, historyLoaded]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 🔥 获取反馈（仅Agent A）
  useEffect(() => {
    if (agentId !== 'A') return;

    const loadFeedbacks = async () => {
      try {
        const response = await fetch(`/api/feedback?toAgentId=A`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setFeedbacks(data.data.feedbacks);
            setFeedbackStats(data.data.stats);
          }
        }
      } catch (e) {
        console.error('加载反馈失败:', e);
      }
    };

    loadFeedbacks();

    // 每30秒刷新一次反馈
    const interval = setInterval(loadFeedbacks, 30000);
    return () => clearInterval(interval);
  }, [agentId]);

  // 🔥 处理反馈的函数
  const handleResolveFeedback = async (feedbackId: string, resolution: string, resolvedCommand: string) => {
    try {
      const response = await fetch(`/api/feedback/${feedbackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'resolved',
          resolution,
          resolvedCommand,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 刷新反馈列表
          const feedbacksRes = await fetch(`/api/feedback?toAgentId=A`);
          if (feedbacksRes.ok) {
            const feedbacksData = await feedbacksRes.json();
            if (feedbacksData.success) {
              setFeedbacks(feedbacksData.data.feedbacks);
              setFeedbackStats(feedbacksData.data.stats);
            }
          }
          alert('反馈已处理，新指令已下发');
        }
      }
    } catch (error) {
      console.error('处理反馈失败:', error);
      alert('操作失败，请重试');
    }
  };

  const handleRejectFeedback = async (feedbackId: string, resolution: string) => {
    try {
      const response = await fetch(`/api/feedback/${feedbackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          resolution,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 刷新反馈列表
          const feedbacksRes = await fetch(`/api/feedback?toAgentId=A`);
          if (feedbacksRes.ok) {
            const feedbacksData = await feedbacksRes.json();
            if (feedbacksData.success) {
              setFeedbacks(feedbacksData.data.feedbacks);
              setFeedbackStats(feedbacksData.data.stats);
            }
          }
          alert('反馈已驳回');
        }
      }
    } catch (error) {
      console.error('驳回反馈失败:', error);
      alert('操作失败，请重试');
    }
  };

  const clearHistory = async () => {
    // 显示确认对话框
    setShowClearConfirmDialog(true);
  };

  // 🔥 新增：确认清空历史
  const confirmClearHistory = async () => {
    try {
      console.log('🗑️ 清空历史指令...');

      // 1. 调用后端 API 删除数据库中的历史记录
      await fetch(`/api/agents/${agentId}/history?sessionId=${sessionId}`, {
        method: 'DELETE',
      });

      // 2. 清空对话框消息
      setMessages([]);

      // 3. 清空待处理指令列表
      setPendingCommands([]);

      // 4. 清空接收到的任务结果
      setReceivedTaskResults([]);

      // 5. 清空拆解结果相关状态
      setShowSplitResultConfirm(false);
      setSplitResult(null);
      setSplitResultTaskId('');
      setCurrentNotificationId(''); // 🔥 新增：清空当前通知 ID

      // 6. 清空拒绝原因
      setRejectReason('');
      setShowRejectReasonDialog(false);

      // 7. 重新生成 sessionId
      if (typeof window !== 'undefined') {
        const storageKey = `agent_${agentId}_sessionId`;
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(storageKey, newSessionId);
        console.log(`✅ 已生成新的 sessionId: ${newSessionId}`);
      }

      toast.success('历史记录已清空');
      setShowClearConfirmDialog(false);
    } catch (error) {
      console.error('❌ 清空历史记录时出错:', error);
      toast.error('清空失败，请重试');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setLoading(true);
    setError('');

    // 创建 AbortController 用于取消请求
    abortControllerRef.current = new AbortController();

    // 🔥 超时标记（120秒）
    let isTimeout = false;

    try {
      // 🔥 限制对话历史长度，避免 Token 使用过多
      const MAX_HISTORY_LENGTH = 20; // 限制最近 20 条消息
      const limitedHistory = messages
        .filter((m) => m.id !== 'welcome') // 排除欢迎消息
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))
        .slice(-MAX_HISTORY_LENGTH); // 只保留最近 20 条消息

      console.log(`📝 对话历史: 原始 ${messages.length} 条, 限制后 ${limitedHistory.length} 条`);

      const response = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userInput,
          conversationHistory: limitedHistory,
          sessionId, // 添加 sessionId 以保存到数据库
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let assistantContent = '';
      let buffer = '';

      // 创建助手消息占位符
      const assistantId = `msg_${Date.now()}_assistant`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ]);

      // 设置超时标记（120秒）
      const timeoutId = setTimeout(() => {
        isTimeout = true;
        abortControllerRef.current?.abort();
      }, 120000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // 解码并追加到缓冲区
          buffer += decoder.decode(value, { stream: true });

          // 按行分割
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个不完整的行

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith('data: ')) continue;

            const data = trimmedLine.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantContent += parsed.content;
                // 增量更新消息内容
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: assistantContent }
                      : m
                  )
                );
              }
            } catch (e) {
              // 忽略 JSON 解析错误，可能是数据不完整
            }
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }

      // 如果没有收到任何内容，添加错误消息
      if (!assistantContent) {
        throw new Error('未收到响应内容');
      }

      // 🔥 检测 Agent B 的回复中是否包含任务拆解结果（JSON 格式）
      if (agentId === 'B' && assistantContent) {
        console.log('🔍 Agent B 检测到响应，检查是否包含任务拆解结果...');
        
        // 尝试提取 JSON 格式的拆解结果
        const jsonMatch = assistantContent.match(/```json\s*([\s\S]*?)\s*```/);
        
        if (jsonMatch) {
          console.log('🔍 找到 JSON 格式的拆解结果');
          
          try {
            const splitResult = JSON.parse(jsonMatch[1]);
            console.log('✅ 拆解结果解析成功:', splitResult);
            
            // 🔥 发送 task_result 通知给 Agent A
            try {
              // 🔥 使用保存的 currentTaskId（而不是从 wsStatus.lastMessage 中读取）
              // 因为 wsStatus.lastMessage 可能已经被其他消息更新了
              const taskId = currentTaskId || `task-A-B-split-${Date.now()}`;
              
              console.log(`📋 准备发送拆解结果通知，taskId=${taskId}`);
              console.log(`📋 currentTaskId=${currentTaskId}`);
              
              // 调用通知 API 发送 task_result
              const notificationResponse = await fetch('/api/agents/A/notifications', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  type: 'task_result',
                  fromAgentId: 'B',
                  toAgentId: 'A',
                  message: 'Agent B 已完成任务拆解',
                  taskId,
                  result: JSON.stringify(splitResult),
                  status: 'completed',
                  timestamp: new Date().toISOString(),
                  data: {
                    splitResult,
                    subTasksCount: splitResult.subTasks?.length || 0,
                  },
                }),
              });
              
              const notificationResult = await notificationResponse.json();
              
              if (notificationResult.success) {
                console.log('✅ 拆解结果通知已发送给 Agent A');
                toast.success('✅ 拆解结果已发送给 Agent A');
              } else {
                console.error('❌ 拆解结果通知发送失败:', notificationResult.error);
              }
            } catch (error) {
              console.error('❌ 发送拆解结果通知时出错:', error);
            }
          } catch (error) {
            console.error('❌ 解析拆解结果 JSON 失败:', error);
          }
        } else {
          console.log('⚠️ 未找到 JSON 格式的拆解结果');
        }
      }

      // 🔥 检测 Agent A 的回复中是否包含指令（仅在 Agent A 页面启用）
      // 🔥 使用 detectCommands 函数进行准确的指令检测
      if (agentId === 'A' && assistantContent) {
        console.log('🔍 开始指令检测（使用 detectCommands）');
        console.log('📝 内容长度:', assistantContent.length);

        // 使用 detectCommands 函数检测指令
        const detectionResult = detectCommands(assistantContent);

        console.log('📤 指令检测结果:');
        console.log('  - 检测到指令:', detectionResult.hasCommands);
        console.log('  - 指令数量:', detectionResult.commands.length);

        if (detectionResult.hasCommands && detectionResult.commands.length > 0) {
          console.log('📋 检测到的指令列表:');
          detectionResult.commands.forEach((cmd, idx) => {
            console.log(`  ${idx + 1}. ${cmd.targetAgentName} (${cmd.targetAgentId})`);
            console.log(`     类型: ${cmd.commandType}, 优先级: ${cmd.priority}`);
            console.log(`     内容长度: ${cmd.commandContent.length}`);
          });

          console.log(`📋 准备自动发送 ${detectionResult.commands.length} 条指令（无需确认）`);

          // 🔥 新增：检查是否有需要拆解任务的 Agent
          console.log('[page] 检查是否需要拆解任务...');
          console.log('[page] SPLIT_KEYWORDS:', SPLIT_KEYWORDS);
          console.log('[page] 检测到的指令:', detectionResult.commands.map(cmd => ({
            targetAgentId: cmd.targetAgentId,
            targetAgentName: cmd.targetAgentName,
            commandContent: cmd.commandContent.substring(0, 50)
          })));

          const needsSplitAgent = detectionResult.commands.some(cmd => {
            const needsSplit = SPLIT_KEYWORDS.includes(cmd.targetAgentId);
            console.log(`[page] 检查指令: targetAgentId="${cmd.targetAgentId}" (type: ${typeof cmd.targetAgentId}), needsSplit=${needsSplit}`);
            console.log(`[page] SPLIT_KEYWORDS.includes("${cmd.targetAgentId}") =`, SPLIT_KEYWORDS.includes(cmd.targetAgentId));
            return needsSplit;
          });

          console.log('[page] 检测到', detectionResult.commands.length, '条指令，需要拆解:', needsSplitAgent);

          if (needsSplitAgent) {
            console.log('🔍 检测到需要拆解任务的 Agent，先显示拆解提示');
            console.log('🔍 调用 setPendingCommandsForSplit');
            setPendingCommandsForSplit(detectionResult.commands);
            console.log('🔍 调用 setLastAssistantContent');
            setLastAssistantContent(assistantContent);
            console.log('🔍 调用 setShowSplitDialog(true)');
            setShowSplitDialog(true);
            console.log('✅ setShowSplitDialog(true) 已调用');
          } else {
            console.log('🔍 不需要拆解任务，直接自动发送指令');
            // 🔥 直接自动发送指令，不再显示确认对话框
            sendCommandsAutomatically(detectionResult.commands, 'A');
          }
        } else {
          console.log('❌ 未检测到任何指令');
        }
      }

    } catch (err: any) {
      console.error('发送消息失败:', err);

      // 处理 AbortError
      if (err.name === 'AbortError') {
        // 如果是超时导致的 AbortError，显示超时错误
        if (isTimeout) {
          setError('请求超时，请重试');
          // 移除空的助手消息
          setMessages((prev) => prev.filter(m => m.role !== 'assistant' || m.content !== ''));
        }
        // 如果不是超时（用户主动取消），不显示错误
        return;
      }

      // 其他错误，显示错误信息
      setError(err.message || '发送消息失败，请重试');

      // 移除空的助手消息（如果有的话）
      setMessages((prev) => prev.filter(m => m.role !== 'assistant' || m.content !== ''));
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 🔥 新增：任务拆解对话框处理函数
  const handleSplitConfirm = async () => {
    console.log('✅ 用户确认让 Agent B 拆解任务');
    setShowSplitDialog(false);

    try {
      // 1. 向 Agent B 发送拆解任务指令
      const splitTaskCommand = {
        id: `split_${Date.now()}`,
        targetAgentId: 'B',
        targetAgentName: '架构师B（技术支撑）',
        commandContent: `【任务拆解指令】

请对以下任务进行拆解，将任务按日分解为可执行的子任务：

${lastAssistantContent}

**要求：**
1. 识别所有需要拆解的任务（特别是 insurance-c、insurance-d 的任务）
2. 将每个任务按日分解为可执行的子任务
3. 为每个子任务设定具体的验收标准和时间范围

**【重要】返回格式要求：**
你必须严格按照以下 JSON 格式返回拆解结果（不要包含任何其他文字说明）：

\`\`\`json
{
  "totalDeliverables": "总交付物数量（例如：3）",
  "timeFrame": "时间周期（例如：3天）",
  "summary": "拆解方案的简要说明（例如：将保险爆文筛选任务拆解为3个每日子任务）",
  "subTasks": [
    {
      "taskTitle": "子任务标题（例如：第1天：筛选保险爆文）",
      "commandContent": "具体的子任务描述（例如：从公众号全平台筛选2篇爆文）",
      "executor": "执行主体的 Agent ID（例如：insurance-c）",
      "taskType": "任务类型（例如：内容生产、数据分析等）",
      "priority": "优先级（高、中、低）",
      "deadline": "截止时间（例如：2026-06-26）",
      "estimatedHours": "预计工时（例如：4小时）",
      "acceptanceCriteria": "验收标准（例如：筛选结果清单、数据截图）"
    }
  ]
}
\`\`\`

**【样例说明】**
这是一个将任务拆分成 3 天的 JSON 样例，请参考此格式生成你的拆解结果：

如果任务是"在3天内完成保险爆文筛选"，你应该拆解为：

\`\`\`json
{
  "totalDeliverables": "3",
  "timeFrame": "3天",
  "summary": "将保险爆文筛选任务拆解为3个每日子任务",
  "subTasks": [
    {
      "taskTitle": "第1天：筛选保险爆文",
      "commandContent": "从公众号全平台筛选2篇近3个月内阅读量≥10万的保险爆文",
      "executor": "insurance-c",
      "taskType": "内容生产",
      "priority": "高",
      "deadline": "2026-06-26",
      "estimatedHours": 4,
      "acceptanceCriteria": "筛选结果清单（包含爆文标题、阅读量、点赞数、评论数）+ 数据截图"
    },
    {
      "taskTitle": "第2天：分析爆文特征",
      "commandContent": "分析爆文特征，输出《爆文复用运营计划初稿》",
      "executor": "insurance-c",
      "taskType": "内容生产",
      "priority": "高",
      "deadline": "2026-06-27",
      "estimatedHours": 6,
      "acceptanceCriteria": "《爆文复用运营计划初稿》（包含爆文特征拆解、推送策略、获流玩法）"
    },
    {
      "taskTitle": "第3天：优化运营计划",
      "commandContent": "优化运营计划，输出最终版《爆文复用运营落地计划》",
      "executor": "insurance-c",
      "taskType": "内容生产",
      "priority": "高",
      "deadline": "2026-06-28",
      "estimatedHours": 8,
      "acceptanceCriteria": "《爆文复用运营落地计划》+《执行SOP》+ 落地准备验收清单"
    }
  ]
}
\`\`\`

**注意：**
1. 只返回 JSON 数据，不要包含任何其他文字
2. executor 必须是有效的 Agent ID（B、insurance-c、insurance-d 等）
3. priority 必须是：高、中、低
4. 每个子任务必须包含所有字段
5. 请参考上述 3 天拆解样例的格式和结构`,
        commandType: 'task' as const,
        priority: 'high' as const,
      };

      console.log('📤 向 Agent B 发送拆解任务指令...');

      // 1. 创建拆解任务（状态为 SPLITTING）
      // 🔥 修复：使用后端返回的实际任务 ID，而不是前端生成的临时 ID
      let actualTaskId = '';
      try {
        const createResponse = await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskName: `任务拆解：${lastAssistantContent.substring(0, 50)}...`,
            coreCommand: lastAssistantContent, // 🔥 修复：存储 Agent A 的原始回复，而不是拆解指令
            executor: 'B',
            taskDurationStart: new Date().toISOString(),
            taskDurationEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天后
            totalDeliverables: pendingCommandsForSplit.length.toString(),
            taskPriority: 'high',
            fromAgentId: 'A',
            toAgentId: 'B',
            taskStatus: 'splitting', // 🔥 设置为拆解状态（小写）
            acceptanceCriteria: '拆解结果包含完整的子任务列表',
            taskType: 'master',
            metadata: {
              splitRequest: {
                originalCommands: pendingCommandsForSplit,
                originalContent: lastAssistantContent,
              },
            },
          }),
        });

        if (createResponse.ok) {
          const createResult = await createResponse.json();
          actualTaskId = createResult.data.taskId;
          console.log('✅ 拆解任务已创建:', createResult.data.taskId);
        } else {
          const errorText = await createResponse.text();
          console.error('❌ 拆解任务创建失败:', errorText);
        }
      } catch (error) {
        console.error('❌ 创建拆解任务时出错:', error);
      }

      // 2. 向 Agent B 发送拆解指令（带 taskId）
      const { sendCommandToAgent, formatCommandForAgent } = await import('@/lib/command-detector');

      const result = await sendCommandToAgent(
        'B',
        splitTaskCommand.commandContent,
        splitTaskCommand.commandType,
        splitTaskCommand.priority,
        'A',
        actualTaskId // 🔥 使用后端返回的实际任务 ID
      );

      if (result.success) {
        console.log('✅ 拆解任务指令已发送给 Agent B');
      } else {
        console.error('❌ 拆解任务指令发送失败:', result.error);
      }

      // 🔥 修复：不发送原有指令，等待 Agent B 拆解完成后发送拆解后的子任务
      console.log('📋 等待 Agent B 完成任务拆解...');
      console.log('✅ 拆解任务已发起，等待 Agent B 完成拆解');

    } catch (error) {
      console.error('❌ 发送指令时出错:', error);
    }
  };

  const handleSplitCancel = async () => {
    console.log('❌ 用户取消任务拆解，直接发送所有原有指令（无需确认）');
    setShowSplitDialog(false);

    try {
      // 🔥 修复：自动发送所有原有指令（包括需要拆解的指令）
      console.log('📋 自动发送所有原有指令（无需确认）');
      await sendCommandsAutomatically(pendingCommandsForSplit, 'A');
      console.log('✅ 已自动发送所有原有指令');

    } catch (error) {
      console.error('❌ 自动发送原有指令时出错:', error);
    }
  };

  // 🔥 新增：自动发送指令（无需确认对话框）
  const sendCommandsAutomatically = async (commands: any[], fromAgentId: string = 'A') => {
    console.log(`📤 开始自动发送 ${commands.length} 条指令（无需确认）`);

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];

      console.log(`  ${i + 1}. 发送指令到 ${command.targetAgentName} (${command.targetAgentId})`);

      // 格式化指令内容
      const formattedCommand = formatCommandForAgent(command, fromAgentId);

      // 发送指令
      const result = await sendCommandToAgent(
        command.targetAgentId,
        formattedCommand,
        command.commandType,
        command.priority,
        fromAgentId
      );

      if (result.success) {
        console.log(`    ✅ 指令发送成功`);
      } else {
        console.log(`    ❌ 指令发送失败: ${result.error}`);
      }

      // 等待一小段时间再发送下一个
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ 自动发送完成`);
  };

  // 🔥 新增：重试发送失败的子任务
  const handleRetryFailedTasks = async () => {
    console.log(`🔄 准备重试 ${failedSubTasks.length} 条失败的子任务`);

    let successCount = 0;
    let failCount = 0;
    const stillFailedTasks: any[] = [];

    for (const subTask of failedSubTasks) {
      console.log(`🔄 重试发送子任务到 ${subTask.executor}: ${subTask.taskTitle}`);

      const commandContent = `【${subTask.taskTitle}】

${subTask.commandContent}

**任务信息：**
- 任务类型：${subTask.taskType}
- 优先级：${subTask.priority}
- 截止时间：${subTask.deadline || '未设置'}
- 预计工时：${subTask.estimatedHours || '未设置'}h

**验收标准：**
${subTask.acceptanceCriteria || '无具体标准'}`;

      const result = await sendCommandToAgent(
        subTask.executor,
        commandContent,
        'instruction',
        subTask.priority === '高' ? 'high' : 'normal',
        'B'
      );

      if (result.success) {
        console.log(`✅ 子任务重试成功到 ${subTask.executor}: ${subTask.taskTitle}`);
        successCount++;
      } else {
        console.error(`❌ 子任务重试失败到 ${subTask.executor}:`, result.error);
        failCount++;
        stillFailedTasks.push(subTask);
      }
    }

    // 更新失败的子任务列表
    setFailedSubTasks(stillFailedTasks);

    // 添加重试结果消息
    const retryMessage: Message = {
      id: `retry_${Date.now()}`,
      role: 'assistant',
      content: `🔄 **重试失败任务结果**

${stillFailedTasks.length === 0 ? '✅ 所有失败任务已成功重新发送！' : `发送结果：\n- ✅ 成功：${successCount} 条\n- ❌ 仍然失败：${failCount} 条`}

${stillFailedTasks.length > 0 ? `\n**仍然失败的子任务：**\n${stillFailedTasks.map((ft: any) => `- ${ft.taskTitle} → ${ft.executor}`).join('\n')}` : ''}`,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, retryMessage]);
  };

  // 🔥 新增：Agent B 拆解结果确认处理函数
  const handleSplitResultConfirm = async () => {
    // 🔥 强制检查锁，防止重复点击
    if (submitLockRef.current) {
      console.log('⚠️ 请求正在进行中，忽略重复点击');
      return;
    }
    
    // 🔥 立即加锁（同步操作）
    submitLockRef.current = true;
    
    console.log('✅ 用户确认拆解结果');
    
    // 🔥 标记为通过按钮关闭，避免触发 Dialog 的 onOpenChange 回调
    isClosingByButtonRef.current = true;
    
    setShowSplitResultConfirm(false);
    setIsProcessingSplitResult(true);

    try {
      if (splitResult && splitResult.subTasks && splitResult.subTasks.length > 0) {
        // 🔥 新逻辑：根据 splitExecutor 区分处理
          // Agent B 拆解：保持原有逻辑，直接向 Agent 发送指令
          console.log('🔍 [Agent B 拆解] 直接向 Agent 发送指令...');

          // 🔥 步骤 0：先保存拆解结果到 daily_task 表
          console.log('💾 开始保存拆解结果到 daily_task 表...');
          try {
            const saveResponse = await fetch('/api/save-split-result', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                taskId: splitResultTaskId,
                splitResult: splitResult,
              }),
            });

            if (saveResponse.ok) {
              const saveResult = await saveResponse.json();
              console.log(`✅ 拆解结果已保存到 daily_task 表:`, saveResult);
              toast.success(`已保存 ${saveResult.data?.totalTasks || splitResult.subTasks.length} 条任务记录`);
            } else {
              const errorText = await saveResponse.text();
              console.error('❌ 保存拆解结果失败:', errorText);
              toast.error('保存拆解结果失败');
            }
          } catch (error) {
            console.error('❌ 保存拆解结果时出错:', error);
            toast.error('保存拆解结果时出错');
          }

          // 🔥 步骤 1：去重检查：检查拆解任务是否已发送过
          const alreadySentCount = splitResult.subTasks.filter((st: any) => st.id && sentSplitTaskIdsRef.current.has(st.id)).length;
          if (alreadySentCount > 0) {
            console.warn(`⚠️ 检测到 ${alreadySentCount} 个子任务已发送过，已跳过`);
            alert(`⚠️ 有 ${alreadySentCount} 个子任务已发送过，已自动跳过`);
          }

          console.log(`📤 准备发送 ${splitResult.subTasks.length} 条子任务指令`);

          let successCount = 0;
          let failCount = 0;
          const failedTasks: any[] = [];

          // 遍历每条子任务，向对应的 Agent 发送指令
          for (const subTask of splitResult.subTasks) {
            console.log(`📤 处理子任务到 ${subTask.executor}: ${subTask.taskTitle}`);

            // 获取执行主体的显示名称（差异化格式）
            const getExecutorDisplayName = (executor: string): string => {
              // insurance-d 不带 "Agent" 前缀
              if (executor === 'insurance-d') {
                return executor;
              }
              // 其他 executor 都带 "Agent" 前缀
              return `Agent ${executor}`;
            };

            // 构造指令内容
            const commandContent = `【${subTask.taskTitle}】

${subTask.commandContent}

**任务信息：**
- 执行主体：${getExecutorDisplayName(subTask.executor)}
- 任务类型：${subTask.taskType}
- 优先级：${subTask.priority}
- 截止时间：${subTask.deadline || '未设置'}
- 预计工时：${subTask.estimatedHours || '未设置'}h

**验收标准：**
${subTask.acceptanceCriteria || '无具体标准'}`;

            // 🔥 步骤 1：向执行 Agent 发送指令
            const result = await sendCommandToAgent(
              subTask.executor, // 目标 Agent
              commandContent,   // 指令内容
              'instruction',    // 指令类型
              subTask.priority === '高' ? 'high' : 'normal', // 优先级
              'B',             // 发送方：Agent B
              subTask.id        // 传递子任务 ID 作为 taskId
            );

            if (result.success) {
              console.log(`✅ 子任务指令已发送到 ${subTask.executor}: ${subTask.taskTitle}`);

              // 🔥 步骤 2：只在 insurance-d 拆解时才插入到 agent_sub_tasks 表
              // Agent B 拆解只保存到 daily_task 表，不需要插入 agent_sub_tasks 表
              if (splitExecutor === 'insurance-d') { 
                try {
                  // 调用子任务拆分 API，直接插入子任务
                  const insertResponse = await fetch(`/api/agents/${subTask.executor}/subtasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      subTaskData: {
                        taskTitle: subTask.taskTitle,
                        commandContent: subTask.commandContent,
                        executor: subTask.executor,
                        taskType: subTask.taskType,
                        priority: subTask.priority,
                        deadline: subTask.deadline,
                        estimatedHours: subTask.estimatedHours,
                        acceptanceCriteria: subTask.acceptanceCriteria,
                      },
                    }),
                  });

                  if (insertResponse.ok) {
                    const insertResult = await insertResponse.json();
                    console.log(`✅ 子任务已插入 agent_sub_tasks 表:`, insertResult);
                  } else {
                    console.warn(`⚠️ 子任务插入 agent_sub_tasks 表失败:`, await insertResponse.text());
                  }
                } catch (error) {
                  console.error(`❌ 插入子任务到 agent_sub_tasks 表时出错:`, error);
                }
              } else {
                console.log(`ℹ️ Agent B 拆解，跳过插入 agent_sub_tasks 表（仅保存到 daily_task 表）`);
              } 

              successCount++;
              // 记录已发送的子任务ID，防止重复发送
              if (subTask.id) {
                sentSplitTaskIdsRef.current.add(subTask.id);
              }
            } else {
              console.error(`❌ 子任务发送失败到 ${subTask.executor}:`, result.error);
              failCount++;
              failedTasks.push(subTask);
            }
          }

          // 保存失败的子任务，用于重试
          setFailedSubTasks(failedTasks);

          // 构造消息内容
          let messageContent = `✅ **拆解结果已确认**

`;
          if (failCount === 0) {
            messageContent += `✅ 已成功创建 ${splitResult.subTasks.length} 个子任务，正在分配执行。

**任务分布：**
${splitResult.subTasks.map((st: any) => `- ${st.taskTitle} → ${st.executor}`).join('\n')}

**总交付物：**${splitResult.totalDeliverables}
**时间周期：**${splitResult.timeFrame}

💡 您可以查看任务列表了解详细进度`;
          } else {
            messageContent += `发送结果：
- ✅ 成功：${successCount} 条
- ❌ 失败：${failCount} 条

**失败的子任务：**
${failedTasks.map((ft: any) => `- ${ft.taskTitle} → ${ft.executor}`).join('\n')}

如果需要重新发送失败的子任务，请点击下方的"重试失败任务"按钮。`;
          }

          // 添加结果消息
          const resultMessage: Message = {
            id: `split_confirm_${Date.now()}`,
            role: 'assistant',
            content: messageContent,
            timestamp: new Date(),
          };

          setMessages(prev => [...prev, resultMessage]);
          
          // 🔥 新增：Agent B 拆解确认成功后，标记通知为已读
          if (currentNotificationId) {
            try {
              console.log(`📝 标记通知为已读: ${currentNotificationId}`);
              await fetch('/api/agents/notifications/mark-read', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  notificationId: currentNotificationId,
                }),
              });
              console.log(`✅ 通知已标记为已读`);
            } catch (error) {
              console.error('❌ 标记通知为已读失败:', error);
            }
          }

          // 🔥 新增：Agent B 拆解确认成功后，更新通知 metadata，标记为 confirmed
          if (currentNotificationId) {
            try {
              console.log(`📝 [Agent B 确认] 更新通知状态为 confirmed: ${currentNotificationId}`);
              await fetch('/api/notifications/update-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  notificationId: currentNotificationId,
                  metadata: {
                    splitPopupStatus: 'confirmed',
                    confirmedAt: new Date().toISOString(),
                  },
                }),
              });
              console.log(`✅ [Agent B 确认] 通知状态已更新为 confirmed`);
            } catch (error) {
              console.error('❌ [Agent B 确认] 更新通知状态失败:', error);
            }
          }

      }
    } catch (error) {
      console.error('❌ 确认拆解结果时出错:', error);
      const errorMessage: Message = {
        id: `split_error_${Date.now()}`,
        role: 'assistant',
        content: `❌ **拆解结果确认失败**

错误：${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      toast.error(`确认失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessingSplitResult(false);
      // 🔥 释放请求锁
      submitLockRef.current = false;
      // ❌ 移除：不再在这里添加到 ref，改为在显示弹框时添加
      
      // 🔥 新增：显示队列中的下一个拆解结果
      setTimeout(() => {
        console.log(`🔍 [队列] 检查队列中的待显示通知...`);
        if (pendingSplitNotificationsRef.current.length > 0) {
          const nextNotification = pendingSplitNotificationsRef.current.shift();
          console.log(`📝 [队列] 取出下一个通知: ${nextNotification?.notification?.notificationId}`);
          console.log(`📝 [队列] 剩余队列长度: ${pendingSplitNotificationsRef.current.length}`);
          
          if (nextNotification) {
            const { notification, jsonData, taskIdToUse, displayExecutor } = nextNotification;
            
            // 🔥 在弹框显示前，更新通知 metadata，标记为 popup_shown
            if (notification.notificationId) {
              try {
                console.log(`📝 [队列] 更新通知状态为 popup_shown: ${notification.notificationId}`);
                fetch('/api/notifications/update-metadata', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    notificationId: notification.notificationId,
                    metadata: {
                      splitPopupStatus: 'popup_shown',
                      popupShownAt: new Date().toISOString(),
                    },
                  }),
                });
              } catch (error) {
                console.error('❌ [队列] 更新通知状态失败:', error);
              }
            }
            
            console.log(`🎉 [队列] 准备显示下一个弹框...`);
            console.log(`🎉 [队列] setShowSplitResultConfirm(true)`);
            setShowSplitResultConfirm(true);
            
            console.log(`🎉 [队列] setSplitResultTaskId(${taskIdToUse})`);
            setSplitResultTaskId(taskIdToUse);
            
            console.log(`🎉 [队列] setCurrentNotificationId(${notification.notificationId || 'NULL'})`);
            setCurrentNotificationId(notification.notificationId || '');
            
            console.log(`🎉 [队列] setSplitResult(...)`);
            setSplitResult(jsonData);
            
            console.log(`🎉 [队列] setSplitExecutor(${displayExecutor})`);
            setSplitExecutor(displayExecutor);
            
            displayedCountRef.current++;
            console.log(`📊 [队列] 显示计数: ${displayedCountRef.current}`);
          }
        } else {
          console.log(`📝 [队列] 队列为空，无需显示更多弹框`);
          displayedCountRef.current = 0;
        }
      }, 300); // 延迟 300ms，确保前一个弹框完全关闭
    }
  };

  // 🔥 新增：处理 Dialog 关闭（当用户点击 X 或外部时）
  const handleSplitResultDialogClose = async (open: boolean) => {
    if (!open && !isClosingByButtonRef.current && currentNotificationId) {
      // 弹框关闭，且不是通过按钮关闭（可能是用户点击 X 或外部）
      console.log('⚠️ 弹框被关闭（非按钮操作），更新状态为 skipped');
      try {
        await fetch('/api/notifications/update-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notificationId: currentNotificationId,
            metadata: {
              splitPopupStatus: 'skipped',
              skippedAt: new Date().toISOString(),
            },
          }),
        });
        console.log(`✅ 通知状态已更新为 skipped`);
      } catch (error) {
        console.error('❌ 更新通知状态失败:', error);
      }
    }
    // 重置标记
    isClosingByButtonRef.current = false;
  };

  const handleSplitResultReject = async () => {
    console.log('❌ 用户拒绝拆解结果，显示原因输入对话框');
    
    // 🔥 标记为通过按钮关闭，避免触发 Dialog 的 onOpenChange 回调
    isClosingByButtonRef.current = true;
    
    setShowSplitResultConfirm(false);
    setShowRejectReasonDialog(true);
  };

  // 🔥 新增：放弃拆解（关闭弹框，不做任何操作）
  const handleSplitResultAbandon = async () => {
    console.log('⚠️ 用户放弃拆解结果，关闭弹框');

    // 🔥 标记为通过按钮关闭，避免触发 Dialog 的 onOpenChange 回调
    isClosingByButtonRef.current = true;

    // 如果有 notificationId，标记通知为已读
    if (currentNotificationId) {
      try {
        console.log(`📝 [放弃] 更新通知状态为 skipped: ${currentNotificationId}`);
        await fetch('/api/notifications/update-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notificationId: currentNotificationId,
            metadata: {
              splitPopupStatus: 'skipped',
              skippedAt: new Date().toISOString(),
            },
          }),
        });
        console.log(`✅ [放弃] 通知状态已更新为 skipped`);
      } catch (error) {
        console.error('❌ [放弃] 更新通知状态失败:', error);
      }
    }

    // 关闭弹框
    setShowSplitResultConfirm(false);

    // 清空状态
    setSplitResult(null);
    setSplitResultTaskId('');
    setSplitExecutor('Agent B');
    setCurrentNotificationId('');

    toast.info('已放弃此拆解方案');

    // 🔥 修复：显示队列中的下一个拆解结果
    setTimeout(() => {
      console.log(`🔍 [放弃后队列] 检查队列中的待显示通知...`);
      if (pendingSplitNotificationsRef.current.length > 0) {
        const nextNotification = pendingSplitNotificationsRef.current.shift();
        console.log(`📝 [放弃后队列] 取出下一个通知: ${nextNotification?.notification?.notificationId}`);
        console.log(`📝 [放弃后队列] 剩余队列长度: ${pendingSplitNotificationsRef.current.length}`);
        
        if (nextNotification) {
          const { notification, jsonData, taskIdToUse, displayExecutor } = nextNotification;
          
          // 🔥 在弹框显示前，更新通知 metadata，标记为 popup_shown
          if (notification.notificationId) {
            try {
              console.log(`📝 [放弃后队列] 更新通知状态为 popup_shown: ${notification.notificationId}`);
              fetch('/api/notifications/update-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  notificationId: notification.notificationId,
                  metadata: {
                    splitPopupStatus: 'popup_shown',
                    popupShownAt: new Date().toISOString(),
                  },
                }),
              });
            } catch (error) {
              console.error('❌ [放弃后队列] 更新通知状态失败:', error);
            }
          }
          
          console.log(`🎉 [放弃后队列] 准备显示下一个弹框...`);
          console.log(`🎉 [放弃后队列] setShowSplitResultConfirm(true)`);
          setShowSplitResultConfirm(true);
          
          console.log(`🎉 [放弃后队列] setSplitResultTaskId(${taskIdToUse})`);
          setSplitResultTaskId(taskIdToUse);
          
          console.log(`🎉 [放弃后队列] setCurrentNotificationId(${notification.notificationId || 'NULL'})`);
          setCurrentNotificationId(notification.notificationId || '');
          
          console.log(`🎉 [放弃后队列] setSplitResult(...)`);
          setSplitResult(jsonData);
          
          console.log(`🎉 [放弃后队列] setSplitExecutor(${displayExecutor})`);
          setSplitExecutor(displayExecutor);
          
          displayedCountRef.current++;
          console.log(`📊 [放弃后队列] 显示计数: ${displayedCountRef.current}`);
        }
      } else {
        console.log(`📝 [放弃后队列] 队列为空，无需显示更多弹框`);
        displayedCountRef.current = 0;
      }
    }, 300); // 延迟 300ms，确保前一个弹框完全关闭
  };

  // 🔥 新增：加载待处理指令
  const loadPendingCommands = async () => {
    try {
      console.log('📥 加载待处理指令...');
      const response = await fetch(`/api/agents/pending-commands?agentId=${agentId}`);
      const data = await response.json();

      if (data.success) {
        setPendingCommands(data.data.pendingCommands);
        console.log(`✅ 加载到 ${data.data.pendingCommands.length} 条待处理指令`);
      } else {
        console.error('❌ 加载待处理指令失败:', data.error);
      }
    } catch (error) {
      console.error('❌ 加载待处理指令时出错:', error);
    }
  };

  // 🔥 新增：显示取消指令确认对话框
  const showCancelConfirm = (taskId: string) => {
    setCancelCommandTaskId(taskId);
    setCancelReason('');
    setShowCancelDialog(true);
  };

  // 🔥 新增：提交取消指令请求
  const handleCancelCommand = async () => {
    if (!cancelReason.trim()) {
      toast.error('请输入取消原因');
      return;
    }

    try {
      console.log('📥 取消指令:', { taskId: cancelCommandTaskId, reason: cancelReason });

      const response = await fetch('/api/agents/cancel-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: cancelCommandTaskId,
          cancelReason,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ 指令已取消');
        toast.success('指令已取消');

        // 重新加载待处理指令
        loadPendingCommands();

        // 添加取消消息到对话框
        const cancelMessage: Message = {
          id: `cancel_${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **指令已取消**

**取消原因：**
${cancelReason}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, cancelMessage]);

        setShowCancelDialog(false);
      } else {
        console.error('❌ 取消指令失败:', data.error);
        toast.error(data.error || '取消失败，请重试');
      }
    } catch (error) {
      console.error('❌ 取消指令时出错:', error);
      toast.error('取消失败，请重试');
    }
  };

  // 🔥 新增：提交拒绝原因并通知目标 Agent 重新拆解
  // 根据任务的 toAgentId 决定通知哪个 Agent，而不是硬编码通知 Agent B
  const handleSubmitRejectReason = async () => {
    console.log('🔥 [handleSubmitRejectReason] 函数开始执行');
    console.log(`🔥 [handleSubmitRejectReason] rejectReason: "${rejectReason}"`);
    console.log(`🔥 [handleSubmitRejectReason] splitExecutor: "${splitExecutor}"`);
    console.log(`🔥 [handleSubmitRejectReason] splitResultTaskId: "${splitResultTaskId}"`);
    console.log(`🔥 [handleSubmitRejectReason] currentNotificationId: "${currentNotificationId}"`);
    
    // 🔥 新增：检查必填参数
    if (!splitResultTaskId) {
      console.error('❌ [handleSubmitRejectReason] splitResultTaskId 为空，无法提交拒绝！');
      toast.error('缺少任务ID，无法提交拒绝');
      return;
    }
    
    if (!currentNotificationId) {
      console.error('❌ [handleSubmitRejectReason] currentNotificationId 为空，无法提交拒绝！');
      toast.error('缺少通知ID，无法提交拒绝');
      return;
    }
    
    if (!rejectReason.trim()) {
      console.log('❌ [handleSubmitRejectReason] 拒绝原因为空，返回');
      toast.error('请输入拒绝原因');
      return;
    }

    console.log('🔥 [handleSubmitRejectReason] 设置 isSubmittingReject = true');
    setIsSubmittingReject(true);
    console.log('🔥 [handleSubmitRejectReason] 关闭拒绝原因对话框');
    setShowRejectReasonDialog(false);

    // 🔥 区分处理：Agent B 拆解 vs insurance-d 拆解
    if (splitExecutor === 'insurance-d') {
      // === insurance-d 拆解拒绝逻辑 ===
      console.log('🔧 [insurance-d 拆解] 处理拒绝...');
      console.log(`🔧 [insurance-d 拆解] splitResultTaskId: ${splitResultTaskId}`);

      try {
        // 🔥 添加超时保护
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
        
        let response = await fetch('/api/insurance-d/reject-split', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notificationId: currentNotificationId,
            taskId: splitResultTaskId,
            rejectionReason: rejectReason,
            retry: true, // 重新触发拆解
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        // 🔥 如果第一次请求失败，尝试使用通知中的原始 taskId 重试
        if (!response.ok && response.status === 404) {
          console.warn('⚠️ [insurance-d 拒绝] 第一次请求失败 (404)，尝试使用原始 taskId 重试');
          
          // 从通知中获取原始 taskId
          const originalTaskId = messages.find(m => m.notificationId === currentNotificationId)?.taskId || '';
          console.log(`🔧 [insurance-d 拒绝] 使用原始 taskId 重试: ${originalTaskId}`);
          
          if (originalTaskId && originalTaskId !== splitResultTaskId) {
            // 🔥 添加超时保护
            const retryController = new AbortController();
            const retryTimeoutId = setTimeout(() => retryController.abort(), 30000); // 30秒超时
            
            response = await fetch('/api/insurance-d/reject-split', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                notificationId: currentNotificationId,
                taskId: originalTaskId,
                rejectionReason: rejectReason,
                retry: true,
              }),
              signal: retryController.signal,
            });
            
            clearTimeout(retryTimeoutId);
          }
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`拒绝失败: ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ [insurance-d 拆解] 拒绝成功:', result);

        // 🔥 新增：拒绝成功后，更新通知 metadata，标记为 rejected
        if (currentNotificationId) {
          try {
            console.log(`📝 [拒绝] 更新通知状态为 rejected: ${currentNotificationId}`);
            await fetch('/api/notifications/update-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                notificationId: currentNotificationId,
                metadata: {
                  splitPopupStatus: 'rejected',
                  rejectedAt: new Date().toISOString(),
                  rejectionReason: rejectReason,
                },
              }),
            });
            console.log(`✅ [拒绝] 通知状态已更新为 rejected`);
          } catch (error) {
            console.error('❌ [拒绝] 更新通知状态失败:', error);
          }
        }

        toast.success(`✅ 已拒绝拆解，并重新拆解生成 ${result.data?.retryResult?.subTaskCount || '新'} 个子任务`);

        // 添加结果消息
        const resultMessage: Message = {
          id: `split_reject_${Date.now()}`,
          role: 'assistant',
          content: `❌ **拆解结果已拒绝**

**拒绝原因：**
${rejectReason}

**处理结果：**
- 已删除 ${result.data?.deletedSubTaskCount || 0} 个子任务
- 已重新拆解任务，生成 ${result.data?.retryResult?.subTaskCount || '新'} 个子任务

**新的子任务列表：**
${result.data?.retryResult?.subTasks?.map((st: any) => `- ${st.title} → ${st.executor}`).join('\n') || '生成中...'}

insurance-d 将根据您的反馈重新拆解任务，请等待新的拆解结果通知。`,
          timestamp: new Date(),
          createdAt: new Date(),
        };

        setMessages(prev => [...prev, resultMessage]);

        // 清空状态
        setShowSplitResultConfirm(false);
        setSplitResult(null);
        setSplitResultTaskId('');
        setSplitExecutor('Agent B');
        setCurrentNotificationId('');
        setRejectReason('');

        // 🔥 清空 displayedCountRef，允许显示新的弹框
        displayedCountRef.current = 0;
        console.log(`🧹 [insurance-d 拒绝] 已重置 displayedCountRef: ${displayedCountRef.current}`);

        // 🔥 处理队列中的下一个通知（如果有）
        setTimeout(() => {
          console.log(`🔍 [insurance-d 拒绝后队列] 检查队列中的待显示通知...`);
          if (pendingSplitNotificationsRef.current.length > 0) {
            const nextNotification = pendingSplitNotificationsRef.current.shift();
            console.log(`📝 [insurance-d 拒绝后队列] 取出下一个通知: ${nextNotification?.notification?.notificationId}`);
            console.log(`📝 [insurance-d 拒绝后队列] 剩余队列长度: ${pendingSplitNotificationsRef.current.length}`);
            
            if (nextNotification) {
              const { notification, jsonData, taskIdToUse, displayExecutor } = nextNotification;
              
              // 🔥 在弹框显示前，更新通知 metadata，标记为 popup_shown
              if (notification.notificationId) {
                try {
                  console.log(`📝 [insurance-d 拒绝后队列] 更新通知状态为 popup_shown: ${notification.notificationId}`);
                  fetch('/api/notifications/update-metadata', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      notificationId: notification.notificationId,
                      metadata: {
                        splitPopupStatus: 'popup_shown',
                        popupShownAt: new Date().toISOString(),
                      },
                    }),
                  });
                } catch (error) {
                  console.error('❌ [insurance-d 拒绝后队列] 更新通知状态失败:', error);
                }
              }
              
              console.log(`🎉 [insurance-d 拒绝后队列] 准备显示下一个弹框...`);
              console.log(`🎉 [insurance-d 拒绝后队列] setShowSplitResultConfirm(true)`);
              setShowSplitResultConfirm(true);
              
              console.log(`🎉 [insurance-d 拒绝后队列] setSplitResultTaskId(${taskIdToUse})`);
              setSplitResultTaskId(taskIdToUse);
              
              console.log(`🎉 [insurance-d 拒绝后队列] setCurrentNotificationId(${notification.notificationId || 'NULL'})`);
              setCurrentNotificationId(notification.notificationId || '');
              
              console.log(`🎉 [insurance-d 拒绝后队列] setSplitResult(...)`);
              setSplitResult(jsonData);
              console.log(`🎉 [insurance-d 拒绝后队列] setSplitExecutor(${displayExecutor})`);
              setSplitExecutor(displayExecutor);
              
              // 🔥 增加显示计数
              displayedCountRef.current++;
              console.log(`📊 [insurance-d 拒绝后队列] 显示计数: ${displayedCountRef.current}/2`);
            }
          } else {
            console.log(`📝 [insurance-d 拒绝后队列] 队列为空，等待新的拆解结果通知...`);
          }
        }, 500); // 延迟 500ms，确保当前弹框已完全关闭

      } catch (error) {
        console.error('❌ [insurance-d 拆解] 拒绝失败:', error);
        
        // 🔥 区分超时错误和其他错误
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        const errorMessage = isTimeout 
          ? '请求超时，请检查网络连接或稍后重试'
          : `拒绝失败: ${error instanceof Error ? error.message : String(error)}`;
        
        toast.error(errorMessage);

        // 恢复对话框
        setShowRejectReasonDialog(true);
      }
    } else { // 删除代码 张晶璐 if 结束行 2556-2690
      // === Agent B 拆解拒绝逻辑 ===
      console.log('🔧 [Agent B 拆解] 处理拒绝...');
      console.log(`🔧 [Agent B 拆解] 准备请求参数:`);
      console.log(`  - notificationId: ${currentNotificationId}`);
      console.log(`  - taskId: ${splitResultTaskId}`);
      console.log(`  - rejectionReason: ${rejectReason}`);
      console.log(`  - retry: true`);

      try {
        console.log('🔧 [Agent B 拆解] 开始发起 fetch 请求...');
        console.log('🔧 [Agent B 拆解] 请求 URL: /api/agents/b/reject-split');
        
        const requestStartTime = Date.now();
        console.log(`🔧 [Agent B 拆解] 请求开始时间: ${new Date(requestStartTime).toISOString()}`);

        // 🔥 修复：调用 Agent B 拒绝 API，触发重新拆解（添加超时保护）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          const elapsed = Date.now() - requestStartTime;
          console.error(`⏱️ [Agent B 拆解] 请求超时！已耗时 ${elapsed}ms`);
          controller.abort();
        }, 30000); // 30秒超时
        
        const response = await fetch('/api/agents/b/reject-split', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notificationId: currentNotificationId,
            taskId: splitResultTaskId,
            rejectionReason: rejectReason,
            retry: true, // 重新触发拆解
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        const requestEndTime = Date.now();
        const elapsed = requestEndTime - requestStartTime;
        console.log(`🔧 [Agent B 拆解] 请求完成时间: ${new Date(requestEndTime).toISOString()}`);
        console.log(`🔧 [Agent B 拆解] 请求耗时: ${elapsed}ms`);
        console.log(`🔧 [Agent B 拆解] 响应状态: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          console.log(`🔧 [Agent B 拆解] 响应不成功 (status: ${response.status})`);
          const errorText = await response.text();
          console.log(`🔧 [Agent B 拆解] 错误响应: ${errorText}`);
          throw new Error(`拒绝失败: ${errorText}`);
        }

        console.log('🔧 [Agent B 拆解] 开始解析响应 JSON...');
        const result = await response.json();
        console.log(`✅ [Agent B 拆解] 解析成功`);
        console.log(`✅ [Agent B 拆解] 响应数据:`, result);
        console.log(`✅ [Agent B 拆解] 拒绝成功:`);

        // 🔥 新增：拒绝成功后，更新通知 metadata，标记为 rejected
        if (currentNotificationId) {
          try {
            console.log(`📝 [Agent B 拒绝] 更新通知状态为 rejected: ${currentNotificationId}`);
            await fetch('/api/notifications/update-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                notificationId: currentNotificationId,
                metadata: {
                  splitPopupStatus: 'rejected',
                  rejectedAt: new Date().toISOString(),
                  rejectionReason: rejectReason,
                },
              }),
            });
            console.log(`✅ [Agent B 拒绝] 通知状态已更新为 rejected`);
          } catch (error) {
            console.error('❌ [Agent B 拒绝] 更新通知状态失败:', error);
          }
        }

        toast.success(`✅ 已拒绝拆解，并重新拆解生成 ${result.data?.retryResult?.splitResult?.subtasks?.length || '新'} 个子任务`);

        // 添加结果消息
        const resultMessage: Message = {
          id: `split_reject_${Date.now()}`,
          role: 'assistant',
          content: `❌ **拆解结果已拒绝**

**拒绝原因：**
${rejectReason}

**处理结果：**
- 已重新拆解任务，生成 ${result.data?.retryResult?.splitResult?.subtasks?.length || '新'} 个子任务

**新的子任务列表：**
${result.data?.retryResult?.splitResult?.subtasks?.map((st: any) => `- ${st.name || st.title} → ${st.executor}`).join('\n') || '生成中...'}

Agent B 将根据您的反馈重新拆解任务，请等待新的拆解结果通知。`,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, resultMessage]);

        // 清空状态
        setShowSplitResultConfirm(false);
        setSplitResult(null);
        setSplitResultTaskId('');
        setSplitExecutor('Agent B');
        setCurrentNotificationId('');
        setRejectReason('');

        // 🔥 清空 displayedCountRef，允许显示新的弹框
        displayedCountRef.current = 0;
        console.log(`🧹 [Agent B 拒绝] 已重置 displayedCountRef: ${displayedCountRef.current}`);

        // 🔥 处理队列中的下一个通知（如果有）
        setTimeout(() => {
          console.log(`🔍 [Agent B 拒绝后队列] 检查队列中的待显示通知...`);
          if (pendingSplitNotificationsRef.current.length > 0) {
            const nextNotification = pendingSplitNotificationsRef.current.shift();
            console.log(`📝 [Agent B 拒绝后队列] 取出下一个通知: ${nextNotification?.notification?.notificationId}`);
            console.log(`📝 [Agent B 拒绝后队列] 剩余队列长度: ${pendingSplitNotificationsRef.current.length}`);
            
            if (nextNotification) {
              const { notification, jsonData, taskIdToUse, displayExecutor } = nextNotification;
              
              // 🔥 在弹框显示前，更新通知 metadata，标记为 popup_shown
              if (notification.notificationId) {
                try {
                  console.log(`📝 [Agent B 拒绝后队列] 更新通知状态为 popup_shown: ${notification.notificationId}`);
                  fetch('/api/notifications/update-metadata', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      notificationId: notification.notificationId,
                      metadata: {
                        splitPopupStatus: 'popup_shown',
                        popupShownAt: new Date().toISOString(),
                      },
                    }),
                  });
                } catch (error) {
                  console.error('❌ [Agent B 拒绝后队列] 更新通知状态失败:', error);
                }
              }
              
              console.log(`🎉 [Agent B 拒绝后队列] 准备显示下一个弹框...`);
              console.log(`🎉 [Agent B 拒绝后队列] setShowSplitResultConfirm(true)`);
              setShowSplitResultConfirm(true);
              
              console.log(`🎉 [Agent B 拒绝后队列] setSplitResultTaskId(${taskIdToUse})`);
              setSplitResultTaskId(taskIdToUse);
              
              console.log(`🎉 [Agent B 拒绝后队列] setCurrentNotificationId(${notification.notificationId || 'NULL'})`);
              setCurrentNotificationId(notification.notificationId || '');
              
              console.log(`🎉 [Agent B 拒绝后队列] setSplitResult(...)`);
              setSplitResult(jsonData);
              console.log(`🎉 [Agent B 拒绝后队列] setSplitExecutor(${displayExecutor})`);
              setSplitExecutor(displayExecutor);
              
              // 🔥 增加显示计数
              displayedCountRef.current++;
              console.log(`📊 [Agent B 拒绝后队列] 显示计数: ${displayedCountRef.current}/2`);
            }
          } else {
            console.log(`📝 [Agent B 拒绝后队列] 队列为空，等待新的拆解结果通知...`);
          }
        }, 500); // 延迟 500ms，确保当前弹框已完全关闭
      } catch (error) {
        console.error('❌ [Agent B 拆解] 拒绝失败');
        console.error('❌ [Agent B 拆解] 错误对象:', error);
        
        // 🔥 详细错误日志
        if (error instanceof Error) {
          console.error('❌ [Agent B 拆解] 错误名称:', error.name);
          console.error('❌ [Agent B 拆解] 错误消息:', error.message);
          console.error('❌ [Agent B 拆解] 错误堆栈:', error.stack);
        }
        
        // 🔥 区分超时错误和其他错误
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        console.log(`🔧 [Agent B 拆解] 是否超时: ${isTimeout}`);
        
        const errorMessage = isTimeout 
          ? '请求超时，请检查网络连接或稍后重试'
          : `拒绝失败: ${error instanceof Error ? error.message : String(error)}`;
        
        console.log(`🔧 [Agent B 拆解] 显示错误提示: ${errorMessage}`);
        toast.error(errorMessage);

        console.log('🔧 [Agent B 拆解] 恢复拒绝原因对话框');
        // 恢复对话框
        setShowRejectReasonDialog(true);
      }
    }

    console.log('🔥 [handleSubmitRejectReason] 函数执行完成，设置 isSubmittingReject = false');
    setIsSubmittingReject(false);
  };

  // 🔥 新增：insurance-d 拆解 daily_task 到 agent_sub_tasks
  const handleInsuranceDSplitConfirm = async () => {
    if (!selectedDailyTaskForSplit) {
      toast.error('请先选择要拆解的任务');
      return;
    }

    setIsSplittingDailyTask(true);

    try {
      console.log('🔧 insurance-d 开始拆解 daily_task:', selectedDailyTaskForSplit.id);

      // 调用拆解 API
      const response = await fetch('/api/agents/insurance-d/split-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commandResultId: selectedDailyTaskForSplit.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ insurance-d 拆解成功:', data);
        setInsuranceDSplitResult(data);
        setShowInsuranceDSplitDialog(false);
        toast.success(`拆解成功，生成了 ${data.subTaskCount} 个子任务`);
      } else {
        console.error('❌ insurance-d 拆解失败:', data.error);
        toast.error(`拆解失败: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ 拆解时出错:', error);
      toast.error('拆解失败，请重试');
    } finally {
      setIsSplittingDailyTask(false);
    }
  };

  // 🔥 新增：手动检查待处理的拆解结果
  const checkPendingSplitResults = async () => {
    console.log('🔍 手动检查待处理的拆解结果...');
    
    try {
      // 查询最新的 task_result 通知
      const response = await fetch('/api/agents/A/notifications?since=0');
      const data = await response.json();
      
      if (data.success && data.data.notifications) {
        // 查找最新的 task_result 类型通知
        const taskResults = data.data.notifications.filter((n: any) => n.type === 'task_result');
        
        if (taskResults.length === 0) {
          toast.info('没有找到待处理的拆解结果');
          return;
        }
        
        // 取最新的 task_result
        const latestResult = taskResults[0];

        // 检查是否来自 Agent B 或 insurance-d
        if ((latestResult.fromAgentId === 'B' || latestResult.fromAgentId === 'insurance-d') && latestResult.result) {
          console.log(`✅ 找到 ${latestResult.fromAgentId} 的拆解结果`);
          
          // 尝试解析 JSON
          try {
            let jsonData: any = null;
            
            // 方法 1: 从 Markdown 代码块提取
            const jsonMatch = latestResult.result.match(/```json\n?([\s\S]*?)\n?```/);
            if (jsonMatch) {
              jsonData = JSON.parse(jsonMatch[1].trim());
            }
            // 方法 2: 直接解析
            else {
              jsonData = JSON.parse(latestResult.result.trim());
            }
            
            // 验证是否包含 subTasks
            if (jsonData && jsonData.subTasks && Array.isArray(jsonData.subTasks) && jsonData.subTasks.length > 0) {
              console.log(`🎉 找到 ${jsonData.subTasks.length} 条子任务`);

              // 🔥 从拆解结果中获取实际的拆解执行者
              const firstExecutor = jsonData.subTasks[0]?.executor;
              console.log('🔍 [查询] 拆解结果中的 executor:', firstExecutor);
              const mappedExecutor = mapExecutorId(firstExecutor);
              console.log('🔍 [查询] 映射后的 executor:', mappedExecutor);
              const displayExecutor = mappedExecutor === 'insurance-d' ? 'insurance-d' :
                                     mappedExecutor === 'insurance-c' ? 'insurance-c' :
                                     'Agent B';
              console.log('🔍 [查询] 显示的拆解执行者:', displayExecutor);

              // 🔥 修复：删除 insurance-d 预保存逻辑，直接使用 agent_tasks 的 taskId
              const actualTaskId = latestResult.taskId || '';

              // 显示拆解结果确认对话框
              setShowSplitResultConfirm(true);
              setSplitResultTaskId(actualTaskId); // ✅ 使用 agent_tasks 的 taskId
              setSplitResult(jsonData);
              setSplitExecutor(displayExecutor);
              setCurrentNotificationId(latestResult.notificationId || ''); // 🔥 修复：设置 currentNotificationId
              
              toast.success(`找到 ${jsonData.subTasks.length} 条待处理的拆解结果`);
            } else {
              toast.warning('找到拆解结果，但格式不正确');
            }
          } catch (error) {
            console.error('❌ 解析拆解结果失败:', error);
            toast.error('解析拆解结果失败');
          }
        } else {
          toast.info('没有找到来自 Agent B 的拆解结果');
        }
      } else {
        toast.error('获取通知失败');
      }
    } catch (error) {
      console.error('❌ 检查拆解结果时出错:', error);
      toast.error('检查拆解结果失败');
    }
  };

  if (!agent) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const getAgentColor = (id: string) => {
    switch (id) {
      case 'A': return 'bg-red-500';
      case 'B': return 'bg-blue-500';
      case 'C': return 'bg-green-500';
      case 'D': return 'bg-purple-500';
      case 'insurance-c': return 'bg-amber-500';
      case 'insurance-d': return 'bg-teal-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        {/* 头部 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <Link href="/admin/agent-builder">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回 Agent 列表
              </Button>
            </Link>
            <div className="flex gap-2">
              <Link href={`/agents/${agentId}/progress`}>
                <Button variant="outline" size="sm">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  工作进展
                </Button>
              </Link>
              <Link href={`/agents/${agentId}/commands`}>
                <Button variant="outline" size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  指令历史
                </Button>
              </Link>
              {agentId === 'A' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={checkPendingSplitResults}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  查看拆解结果
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={clearHistory}>
                <RefreshCw className="h-4 w-4 mr-2" />
                清除历史
              </Button>
            </div>
          </div>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full text-white font-bold text-xl ${getAgentColor(agentId)}`}>
                {agentId}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                <p className="text-muted-foreground">{agent.role}</p>
                <Badge variant="outline" className="mt-2">
                  {agent.description}
                </Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* WebSocket 连接状态和指令通知 */}
        <AgentWebSocketStatus agentId={agentId as any} />

        {/* 🔥 待处理指令列表 */}
        {agentId === 'A' && pendingCommands.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  待处理指令 ({pendingCommands.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadPendingCommands}
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  刷新
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingCommands.map((cmd) => (
                <div
                  key={cmd.taskId}
                  className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white font-bold text-sm ${getAgentColor(cmd.executor)}`}>
                    {cmd.executor}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {cmd.taskStatus === 'pending' ? '待处理' : cmd.taskStatus === 'in_progress' ? '执行中' : '拆解中'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(cmd.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">{cmd.taskName}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {cmd.coreCommand.substring(0, 100)}...
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => showCancelConfirm(cmd.taskId)}
                    className="shrink-0"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    取消
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 聊天窗口 */}
        <Card className="h-[600px] flex flex-col">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white font-bold text-sm ${getAgentColor(agentId)}`}>
                    {agentId}
                  </div>
                )}
                <div className={`flex flex-col gap-2 max-w-[70%]`}>
                  <div
                    className={`rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  </div>
                  {/* 🔥 新增：如果消息包含拆解结果，显示确认/拒绝按钮 */}
                  {message.splitResult && message.splitResult.subTasks && message.splitResult.subTasks.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // 设置拆解结果到状态
                          setSplitResult(message.splitResult);
                          setSplitResultTaskId(message.taskId || '');
                          setCurrentNotificationId(message.notificationId || ''); // 🔥 修复：设置 currentNotificationId
                          const firstExecutor = message.splitResult.subTasks[0]?.executor;
                          const mappedExecutor = mapExecutorId(firstExecutor);
                          const displayExecutor = mappedExecutor === 'insurance-d' ? 'insurance-d' :
                                                 mappedExecutor === 'insurance-c' ? 'insurance-c' :
                                                 'Agent B';
                          setSplitExecutor(displayExecutor);
                          // 显示弹框
                          setShowSplitResultConfirm(true);
                        }}
                      >
                        查看详情
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isProcessingSplitResult || submitLockRef.current}
                        onClick={async () => {
                          // 设置状态
                          setSplitResult(message.splitResult);
                          setSplitResultTaskId(message.taskId || '');
                          setCurrentNotificationId(message.notificationId || ''); // 🔥 设置 notificationId
                          const firstExecutor = message.splitResult.subTasks[0]?.executor;
                          const mappedExecutor = mapExecutorId(firstExecutor);
                          const displayExecutor = mappedExecutor === 'insurance-d' ? 'insurance-d' :
                                                 mappedExecutor === 'insurance-c' ? 'insurance-c' :
                                                 'Agent B';
                          setSplitExecutor(displayExecutor);

                          // 🔥 修复：删除 insurance-d 预保存逻辑，直接调用确认处理函数
                          // 调用确认处理函数
                          await handleSplitResultConfirm();
                        }}
                      >
                        确认拆解
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleSplitResultReject}
                      >
                        拒绝拆解
                      </Button>
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-primary font-semibold">U</span>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white font-bold text-sm ${getAgentColor(agentId)}`}>
                  {agentId}
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>正在思考{agentId === 'A' ? '战略任务' : ''}...</span>
                    <span className="text-xs text-muted-foreground/60">
                      （复杂任务可能需要较长时间，请耐心等待）
                    </span>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入框 */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入消息... (Shift+Enter 换行)"
                rows={2}
                className="resize-none"
                disabled={loading}
              />
              <div className="flex flex-col gap-2">
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
                {['D', 'insurance-d'].includes(agentId) && (
                  <SaveDraftButton
                    agentId={agentId as 'D' | 'insurance-d'}
                    initialContent={input}
                    onSaveSuccess={() => setInput('')}
                  />
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* 快捷测试 */}
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium">快捷测试：</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInput('你好，请介绍一下你的职责')}
              disabled={loading}
            >
              介绍职责
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInput('你当前有哪些核心能力？')}
              disabled={loading}
            >
              查看能力
            </Button>
            {agentId === 'A' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput('请帮我制定一个战略计划')}
                  disabled={loading}
                >
                  制定战略
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setInput('触发工作流程：用户增长优化 - 通过数据分析优化用户增长策略')}
                  disabled={loading}
                >
                  🚀 触发工作流程
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setInput('启动战略计划：Q3产品迭代计划')}
                  disabled={loading}
                >
                  🎯 启动战略计划
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setInput('向 C 下达任务：分析上周的用户活跃数据并生成报告')}
                  disabled={loading}
                >
                  📋 下达任务给 C
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setInput('向 D 下达任务：创作一篇关于产品功能的宣传文章')}
                  disabled={loading}
                >
                  📋 下达任务给 D
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    console.log('🧪 测试按钮：手动触发拆解弹框');
                    console.log('🧪 当前 agentId:', agentId);
                    console.log('🧪 agentId === "A":', agentId === 'A');
                    setShowSplitDialog(true);
                    setPendingCommandsForSplit([
                      {
                        id: 'test_1',
                        targetAgentId: 'B',
                        targetAgentName: '架构师B（技术支撑）',
                        commandContent: '测试指令',
                        commandType: 'instruction',
                        priority: 'normal'
                      }
                    ]);
                  }}
                  disabled={loading}
                >
                  🧪 测试：拆解弹框
                </Button>
                {failedSubTasks.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRetryFailedTasks}
                    disabled={loading}
                  >
                    🔄 重试失败任务 ({failedSubTasks.length})
                  </Button>
                )}
              </>
            )}
            {['B', 'C', 'D', 'insurance-c', 'insurance-d'].includes(agentId) && (
              <>
                <SubmitFeedbackDialog
                  taskId={`task_${Date.now()}`}
                  commandId={`cmd_${Date.now()}`}
                  fromAgentId={agentId}
                  toAgentId="A"
                  originalCommand={input || "示例指令"}
                  onSuccess={() => {
                    console.log('反馈已提交');
                  }}
                />
                <SubmitCommandResultDialog
                  taskId={`task_${Date.now()}`}
                  commandId={`cmd_${Date.now()}`}
                  fromAgentId={agentId}
                  toAgentId="A"
                  originalCommand={input || "示例指令"}
                  onSuccess={() => {
                    console.log('执行结果已提交');
                  }}
                />
              </>
            )}
            {agentId === 'B' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput('收到运营反馈数据，需要提取经验')}
                  disabled={loading}
                >
                  提取经验
                </Button>
              </>
            )}
            {agentId === 'C' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput('需要提交运营任务执行反馈报告')}
                  disabled={loading}
                >
                  提交报告
                </Button>
              </>
            )}
            {agentId === 'D' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput('需要提交内容生产任务执行反馈报告')}
                  disabled={loading}
                >
                  提交报告
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 接收到的任务面板（非Agent A） */}
        {!['A'].includes(agentId) && <ReceivedTasksPanel agentId={agentId} />}

        {/* 🔥 新增：insurance-d 拆解 daily_task 面板 */}
        {['insurance-d', 'D'].includes(agentId) && (
          <Card className="w-full mt-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">拆解 daily_task</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    // 查询待拆解的 daily_task
                    try {
                      const response = await fetch(`/api/daily-tasks?executor=${agentId}&status=new`);
                      const data = await response.json();
                      if (data.success && data.data.tasks.length > 0) {
                        // 显示第一个待拆解的任务
                        setSelectedDailyTaskForSplit(data.data.tasks[0]);
                        setShowInsuranceDSplitDialog(true);
                      } else {
                        toast.info('没有找到待拆解的 daily_task');
                      }
                    } catch (error) {
                      console.error('查询 daily_task 失败:', error);
                      toast.error('查询失败，请重试');
                    }
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  查询待拆解任务
                </Button>
              </div>
              <CardDescription className="text-xs">
                将 daily_task 表中的任务拆解为 agent_sub_tasks
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* 草稿列表面板（Agent D 和 insurance-d） */}
        {['D', 'insurance-d'].includes(agentId) && <DraftListPanel agentId={agentId as 'D' | 'insurance-d'} />}

        {/* 回执和状态反馈管理面板（执行端 Agent） */}
        {['B', 'C', 'D', 'insurance-c', 'insurance-d'].includes(agentId) && (
          <AgentReceiptManager agentId={agentId} />
        )}
      </div>

      {/* 🔥 新增：任务拆解确认对话框 */}
      {agentId === 'A' && (
        <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                是否让任务拆解为日任务？
              </DialogTitle>
              <DialogDescription>
                <div className="space-y-3">
                  <div>
                    检测到指令中有向以下 Agent 下达的任务：
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {pendingCommandsForSplit
                        .filter(cmd => SPLIT_KEYWORDS.includes(cmd.targetAgentId))
                        .map((cmd, idx) => (
                          <li key={idx}>
                            <strong>{cmd.targetAgentName}</strong>（{cmd.targetAgentId}）
                          </li>
                        ))}
                    </ul>
                  </div>
                  
                  {/* 🔥 拆解执行者说明 */}
                  {(() => {
                    // 判断是否有需要 insurance-d 接收的子任务
                    const hasInsuranceDTasks = pendingCommandsForSplit
                      .filter(cmd => SPLIT_KEYWORDS.includes(cmd.targetAgentId))
                      .some(cmd => cmd.targetAgentId === 'insurance-d' || cmd.targetAgentId === 'D');

                    // 拆解执行者：Agent B（始终）
                    const splitExecutor = 'Agent B';
                    // 第一次拆解保存到 daily_task 表
                    const targetTable = 'daily_task';

                    return (
                      <>
                        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-xs space-y-1">
                          <div className="flex items-center gap-1">
                            <span>🤖</span>
                            <span><strong>拆解执行者：</strong>{splitExecutor}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>📊</span>
                            <span><strong>目标表：</strong><code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">{targetTable}</code></span>
                          </div>
                          {hasInsuranceDTasks && (
                            <div className="flex items-center gap-1 mt-1 text-orange-600 dark:text-orange-400">
                              <span>ℹ️</span>
                              <span><strong>后续流程：</strong>拆解完成后，insurance-d 可进一步拆解为 agent_sub_tasks</span>
                            </div>
                          )}
                        </div>

                        <div>
                          <strong>建议：</strong>让 {splitExecutor} 将任务拆解为可执行的每日子任务，便于跟踪和管理。
                        </div>
                      </>
                    );
                  })()}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-row justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowSplitDialog(false)}>
                取消
              </Button>
              <Button variant="outline" onClick={handleSplitCancel}>
                不拆解，直接发送
              </Button>
              <Button onClick={handleSplitConfirm} className="bg-blue-600 hover:bg-blue-700">
                确认拆解
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 拆解结果确认对话框 */}
      <Dialog open={showSplitResultConfirm} onOpenChange={(open) => {
        handleSplitResultDialogClose(open);
        setShowSplitResultConfirm(open);
      }}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] p-0">
          <div className="flex flex-col h-full max-h-[80vh]">
            <DialogHeader className="p-6 pb-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  确认拆解方案
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSplitResultDialogMinimized(!isSplitResultDialogMinimized)}
                  className="h-8 w-8 p-0"
                >
                  {isSplitResultDialogMinimized ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <DialogDescription className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{splitExecutor}</Badge>
                  <span>已完成任务拆解，请确认是否接受此方案</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span>📊</span>
                  <span>确认后，拆解结果将保存到 <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">daily_task</code> 表</span>
                  {splitExecutor === 'insurance-d' && (
                    <span className="text-orange-600 dark:text-orange-400 ml-1">（insurance-d 可进一步拆解为 agent_sub_tasks）</span>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>

            {!isSplitResultDialogMinimized && (
            <ScrollArea className="flex-1 px-6 min-h-0">
              {splitResult && (
                <div className="space-y-4 pb-4">
                  {/* 拆解结果总览 */}
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">总交付物：</span>
                        <span className="font-semibold ml-2">{splitResult.totalDeliverables || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">时间周期：</span>
                        <span className="font-semibold ml-2">{splitResult.timeFrame || 'N/A'}</span>
                      </div>
                    </div>
                    {splitResult.summary && (
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                        <strong>摘要：</strong>{splitResult.summary}
                      </p>
                    )}
                  </div>

                  {/* 拆解后的任务列表 */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      拆解后的任务列表 ({splitResult.subTasks?.length || 0} 个子任务)
                    </h4>
                    <div className="space-y-3">
                  {splitResult.subTasks?.map((subTask: any, index: number) => (
                    <div
                      key={index}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {/* 🔥 兼容两种字段格式：taskTitle（Agent B）和 title（insurance-d） */}
                              {subTask.taskTitle || subTask.title}
                            </span>
                            {/* 🔥 兼容两种字段格式：taskType（Agent B）和无此字段（insurance-d） */}
                            {subTask.taskType && (
                              <Badge variant="outline" className="text-xs">
                                {subTask.taskType}
                              </Badge>
                            )}
                            {/* 🔥 显示是否为关键任务 */}
                            {subTask.isCritical && (
                              <Badge variant="destructive" className="text-xs">
                                关键任务
                              </Badge>
                            )}
                          </div>
                          {/* 🔥 兼容两种字段格式：commandContent（Agent B）和 description（insurance-d） */}
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {subTask.commandContent || subTask.description}
                          </p>

                          {/* 任务元数据 */}
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-500">
                            <div>
                              <span>执行者：</span>
                              <span className="font-medium text-gray-700 dark:text-gray-300 ml-1">
                                {subTask.executor}
                              </span>
                            </div>
                            {/* 🔥 兼容两种字段格式：priority（Agent B）和无此字段（insurance-d） */}
                            {subTask.priority && (
                              <div>
                                <span>优先级：</span>
                                <span className={`font-medium ml-1 ${
                                  subTask.priority === '高' || subTask.priority === 'high' ? 'text-red-600' :
                                  subTask.priority === '中' || subTask.priority === 'medium' ? 'text-orange-600' :
                                  'text-green-600'
                                }`}>
                                  {subTask.priority}
                                </span>
                              </div>
                            )}
                            <div>
                              <span>截止时间：</span>
                              <span className="font-medium text-gray-700 dark:text-gray-300 ml-1">
                                {subTask.deadline || '未设置'}
                              </span>
                            </div>
                            <div>
                              <span>预计工时：</span>
                              <span className="font-medium text-gray-700 dark:text-gray-300 ml-1">
                                {subTask.estimatedHours || 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* 验收标准 */}
                          {subTask.acceptanceCriteria && (
                            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs">
                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                验收标准：
                              </span>
                              <p className="text-gray-600 dark:text-gray-400 mt-1">
                                {subTask.acceptanceCriteria}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}
            </ScrollArea>
            )}
            <DialogFooter className="flex flex-row justify-end gap-2 p-6 pt-4 flex-shrink-0 border-t">
              <Button
                variant="ghost"
                onClick={handleSplitResultAbandon}
                disabled={isProcessingSplitResult}
              >
                <XCircle className="h-4 w-4 mr-2" />
                放弃拆解
              </Button>
              <Button
                variant="outline"
                onClick={handleSplitResultReject}
                disabled={isProcessingSplitResult || submitLockRef.current}
              >
                拒绝并重新拆解
              </Button>
              <Button
                onClick={handleSplitResultConfirm}
                className="bg-green-600 hover:bg-green-700"
                disabled={isProcessingSplitResult || submitLockRef.current}
              >
                {isProcessingSplitResult ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    处理中...
                  </>
                ) : (
                  '确认并接受'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🔥 新增：insurance-d 拆解 daily_task 确认对话框 */}
      {(agentId === 'insurance-d' || agentId === 'D') && (
        <Dialog open={showInsuranceDSplitDialog} onOpenChange={setShowInsuranceDSplitDialog}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] p-0">
            <DialogHeader className="p-6 pb-4 flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                确认拆解 daily_task 为子任务
              </DialogTitle>
              <DialogDescription>
                <div className="space-y-2">
                  <div>
                    将以下 daily_task 拆解为可执行的子任务（agent_sub_tasks）：
                  </div>
                  {selectedDailyTaskForSplit && (
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-sm space-y-2">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">任务标题：</span>
                        <span className="font-medium ml-2">{selectedDailyTaskForSplit.taskTitle || selectedDailyTaskForSplit.taskName || '未知'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">任务内容：</span>
                        <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                          {selectedDailyTaskForSplit.commandContent || selectedDailyTaskForSplit.core_command || '无内容'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>🤖</span>
                        <span><strong>拆解执行者：</strong>insurance-d</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>📊</span>
                        <span><strong>目标表：</strong><code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">agent_sub_tasks</code></span>
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <strong>说明：</strong>insurance-d 将按照 8 个标准步骤拆解任务，生成可执行的子任务。
                  </div>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-row justify-end gap-2 p-6">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowInsuranceDSplitDialog(false);
                  setSelectedDailyTaskForSplit(null);
                }}
                disabled={isSplittingDailyTask}
              >
                取消
              </Button>
              <Button
                onClick={handleInsuranceDSplitConfirm}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isSplittingDailyTask}
              >
                {isSplittingDailyTask ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    拆解中...
                  </>
                ) : (
                  '确认拆解'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 🔥 新增：拒绝原因输入对话框 */}
      <Dialog open={showRejectReasonDialog} onOpenChange={setShowRejectReasonDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              拒绝拆解结果
            </DialogTitle>
            <DialogDescription>
              请输入拒绝原因，Agent B 将根据您的反馈重新拆解任务。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="rejectReason" className="text-sm font-medium mb-2 block">
                拒绝原因 <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="请详细说明拒绝的原因，例如：
- 子任务数量过多/过少
- 某些子任务的验收标准不明确
- 时间安排不合理
- 任务分配不均衡
..."
                rows={5}
                disabled={isSubmittingReject}
                className="resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                提示：详细的反馈能帮助 {splitExecutor} 更准确地重新拆解任务
              </p>
            </div>

            {/* 快捷反馈选项 */}
            <div>
              <label className="text-sm font-medium mb-2 block">快捷反馈：</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectReason(prev => prev ? prev + '\n- 子任务数量过多，建议拆解为更细粒度的任务' : '- 子任务数量过多，建议拆解为更细粒度的任务')}
                  disabled={isSubmittingReject}
                >
                  子任务过多
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectReason(prev => prev ? prev + '\n- 某些子任务的验收标准不够明确，请补充具体指标' : '- 某些子任务的验收标准不够明确，请补充具体指标')}
                  disabled={isSubmittingReject}
                >
                  验收标准不明确
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectReason(prev => prev ? prev + '\n- 时间安排不合理，某些任务截止时间过紧' : '- 时间安排不合理，某些任务截止时间过紧')}
                  disabled={isSubmittingReject}
                >
                  时间安排不合理
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectReason(prev => prev ? prev + '\n- 任务分配不均衡，某些执行者任务过重' : '- 任务分配不均衡，某些执行者任务过重')}
                  disabled={isSubmittingReject}
                >
                  任务分配不均衡
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowRejectReasonDialog(false);
                setRejectReason('');
              }}
              disabled={isSubmittingReject}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmitRejectReason}
              disabled={!rejectReason.trim() || isSubmittingReject}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmittingReject ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                '提交并重新拆解'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🔥 新增：取消指令确认对话框 */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              取消指令
            </DialogTitle>
            <DialogDescription>
              确定要取消这条指令吗？目标 Agent 将停止执行此任务。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="cancelReason" className="text-sm font-medium mb-2 block">
                取消原因 <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="请输入取消原因，例如：
- 指令内容有误，需要重新发送
- 任务不需要了
- 重复发送的指令"
                rows={4}
                className="resize-none"
              />
            </div>

            {/* 快捷选项 */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">快捷选项：</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelReason(prev => prev ? prev + '\n- 指令内容有误，需要重新发送' : '- 指令内容有误，需要重新发送')}
                >
                  指令内容有误
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelReason(prev => prev ? prev + '\n- 任务不需要了' : '- 任务不需要了')}
                >
                  任务不需要了
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelReason(prev => prev ? prev + '\n- 重复发送的指令' : '- 重复发送的指令')}
                >
                  重复发送
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCancelDialog(false);
                setCancelReason('');
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleCancelCommand}
              disabled={!cancelReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              确认取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🔥 新增：清空历史确认对话框 */}
      <Dialog open={showClearConfirmDialog} onOpenChange={setShowClearConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              清空历史记录
            </DialogTitle>
            <DialogDescription>
              确定要清空所有历史记录吗？此操作将：
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-red-500" />
              <span>清空对话框中的所有消息</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-red-500" />
              <span>清空待处理指令列表</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-red-500" />
              <span>清空所有拆解结果和任务结果</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-red-500" />
              <span>重新生成会话 ID</span>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-red-600 font-medium">
                ⚠️ 此操作不可撤销，请谨慎操作！
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowClearConfirmDialog(false);
              }}
            >
              取消
            </Button>
            <Button
              onClick={confirmClearHistory}
              className="bg-red-600 hover:bg-red-700"
            >
              确认清空
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 反馈展示区域（仅Agent A） - 调整到屏幕中间 */}
      {agentId === 'A' && feedbacks.length > 0 && showFeedbackPanel && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-96 max-h-[60vh] overflow-y-auto z-50 bg-white rounded-lg shadow-lg border">
          <div className="p-4 border-b sticky top-0 bg-white">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">反馈列表</h3>
              <div className="flex items-center gap-2">
                {feedbackStats && (
                  <Badge variant="outline">
                    待处理: {feedbackStats.pending}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setShowFeedbackPanel(false)}
                >
                  ×
                </Button>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {feedbacks.map((feedback) => (
              <FeedbackCard
                key={feedback.feedbackId}
                feedback={feedback}
                onResolve={handleResolveFeedback}
                onReject={handleRejectFeedback}
              />
            ))}
          </div>
        </div>
      )}

      {/* 🔥 新增：反馈列表重新打开按钮（仅Agent A） */}
      {agentId === 'A' && feedbacks.length > 0 && !showFeedbackPanel && (
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40"
          onClick={() => setShowFeedbackPanel(true)}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          反馈 ({feedbackStats?.pending || 0})
        </Button>
      )}

      {/* 执行结果展示区域（仅Agent A） - 添加显示控制 */}
      {agentId === 'A' && showCommandResultsPanel && (
        <div className="fixed top-4 right-4 z-50">
          <CommandResultsPanel toAgentId="A" onClose={() => setShowCommandResultsPanel(false)} />
        </div>
      )}

      {/* 任务列表面板（仅insurance-d） */}
      {agentId === 'insurance-d' && showTaskListPanel && (
        <div className="fixed top-4 right-4 z-50">
          <AgentTaskList
            agentId={agentId}
            showPanel={showTaskListPanel}
            onTogglePanel={() => setShowTaskListPanel(false)}
          />
        </div>
      )}

      {/* 🔥 新增：执行结果面板重新打开按钮（仅Agent A） */}
      {agentId === 'A' && !showCommandResultsPanel && (
        <Button
          variant="outline"
          size="sm"
          className="fixed top-4 right-4 z-40"
          onClick={() => setShowCommandResultsPanel(true)}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          执行结果
        </Button>
      )}
    </div>
  );
}
