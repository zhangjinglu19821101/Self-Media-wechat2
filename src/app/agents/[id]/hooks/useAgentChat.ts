'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  splitResult?: any;
  notificationId?: string;
  taskId?: string;
}

interface UseAgentChatOptions {
  agentId: string;
  sessionId: string;
  messages: Message[];
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  currentTaskId: string;
  setCurrentTaskId: (taskId: string) => void;
  SPLIT_KEYWORDS: string[];
  setPendingCommandsForSplit: (commands: any[]) => void;
  setLastAssistantContent: (content: string) => void;
  setShowSplitDialog: (show: boolean) => void;
  sendCommandsAutomatically: (commands: any[], fromAgentId: string) => void;
}

export function useAgentChat({
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
}: UseAgentChatOptions) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 发送消息
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

    // 超时标记（120秒）
    let isTimeout = false;

    try {
      // 限制对话历史长度，避免 Token 使用过多
      const MAX_HISTORY_LENGTH = 20;
      const limitedHistory = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))
        .slice(-MAX_HISTORY_LENGTH);

      console.log(`📝 对话历史: 原始 ${messages.length} 条, 限制后 ${limitedHistory.length} 条`);

      const response = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userInput,
          conversationHistory: limitedHistory,
          sessionId,
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

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith('data: ')) continue;

            const data = trimmedLine.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantContent += parsed.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: assistantContent } : m
                  )
                );
              }
            } catch (e) {
              // 忽略 JSON 解析错误
            }
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }

      if (!assistantContent) {
        throw new Error('未收到响应内容');
      }

      // 检测 Agent B 的回复中是否包含任务拆解结果
      if (agentId === 'B' && assistantContent) {
        await handleAgentBSplitResult(assistantContent);
      }

      // 检测 Agent A 的回复中是否包含指令
      if (agentId === 'A' && assistantContent) {
        await handleAgentACommands(assistantContent);
      }
    } catch (err: any) {
      console.error('发送消息失败:', err);

      if (err.name === 'AbortError') {
        if (isTimeout) {
          setError('请求超时，请重试');
          setMessages((prev) => prev.filter(m => m.role !== 'assistant' || m.content !== ''));
        }
        return;
      }

      setError(err.message || '发送消息失败，请重试');
      setMessages((prev) => prev.filter(m => m.role !== 'assistant' || m.content !== ''));
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 处理 Agent B 的拆解结果
  const handleAgentBSplitResult = async (assistantContent: string) => {
    console.log('🔍 Agent B 检测到响应，检查是否包含任务拆解结果...');

    const jsonMatch = assistantContent.match(/```json\s*([\s\S]*?)\s*```/);

    if (jsonMatch) {
      console.log('🔍 找到 JSON 格式的拆解结果');

      try {
        const splitResult = JSON.parse(jsonMatch[1]);
        console.log('✅ 拆解结果解析成功:', splitResult);

        // 发送 task_result 通知给 Agent A
        try {
          const taskId = currentTaskId || `task-A-B-split-${Date.now()}`;
          console.log(`📋 准备发送拆解结果通知，taskId=${taskId}`);
          console.log(`📋 currentTaskId=${currentTaskId}`);

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
  };

  // 处理 Agent A 的指令
  const handleAgentACommands = async (assistantContent: string) => {
    // 这里需要导入 detectCommands 函数
    // 由于循环依赖问题，这个函数应该从外部传入或者使用动态导入
    console.log('🔍 开始指令检测（使用 detectCommands）');
    console.log('📝 内容长度:', assistantContent.length);

    // 动态导入 detectCommands 以避免循环依赖
    const { detectCommands } = await import('@/lib/command-detector');
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

      // 检查是否有需要拆解任务的 Agent
      console.log('[page] 检查是否需要拆解任务...');
      console.log('[page] SPLIT_KEYWORDS:', SPLIT_KEYWORDS);

      const needsSplitAgent = detectionResult.commands.some(cmd => {
        const needsSplit = SPLIT_KEYWORDS.includes(cmd.targetAgentId);
        console.log(`[page] 检查指令: targetAgentId="${cmd.targetAgentId}" (type: ${typeof cmd.targetAgentId}), needsSplit=${needsSplit}`);
        console.log(`[page] SPLIT_KEYWORDS.includes("${cmd.targetAgentId}") =`, SPLIT_KEYWORDS.includes(cmd.targetAgentId));
        return needsSplit;
      });

      console.log('[page] 检测到', detectionResult.commands.length, '条指令，需要拆解:', needsSplitAgent);

      if (needsSplitAgent) {
        console.log('🔍 检测到需要拆解任务的 Agent，先显示拆解提示');
        setPendingCommandsForSplit(detectionResult.commands);
        setLastAssistantContent(assistantContent);
        setShowSplitDialog(true);
        console.log('✅ setShowSplitDialog(true) 已调用');
      } else {
        console.log('🔍 不需要拆解任务，直接自动发送指令');
        sendCommandsAutomatically(detectionResult.commands, 'A');
      }
    } else {
      console.log('❌ 未检测到任何指令');
    }
  };

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 取消请求
  const cancelRequest = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
  };

  return {
    input,
    setInput,
    loading,
    error,
    messagesEndRef,
    sendMessage,
    handleKeyPress,
    cancelRequest,
  };
}
