'use client';

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { mapExecutorId } from '@/lib/utils/agent-mapper';
import { isWritingAgent, getWritingAgentName } from '@/lib/agents/agent-registry';

interface UseSplitDialogsOptions {
  agentId: string;
  messages: any[];
  setMessages: (messages: any[] | ((prev: any[]) => any[])) => void;
  sendCommandToAgent: (targetAgentId: string, commandContent: string, commandType: string, priority: string, fromAgentId: string, taskId?: string) => Promise<{ success: boolean; error?: string }>;
  setSplitResult: (result: any) => void;
  setSplitExecutor: (executor: string) => void;
  setSplitResultTaskId: (taskId: string) => void;
  setCurrentNotificationId: (notificationId: string) => void;
  setRejectReason: (reason: string) => void;
  setShowRejectReasonDialog: (show: boolean) => void;
  setShowSplitResultConfirm: (show: boolean) => void;
  setShowSplitDialog: (show: boolean) => void;
  setIsProcessingSplitResult: (processing: boolean) => void;
  setProcessingProgress: (progress: { current: number; total: number; message: string } | null) => void;
  setProcessingResult: (result: { success: boolean; message: string; successCount: number; failCount: number } | null) => void;
  displayedCountRef: React.MutableRefObject<number>;
  pendingSplitNotificationsRef: React.MutableRefObject<any[]>;
  submitLockRef: React.MutableRefObject<boolean>;
  isClosingByButtonRef: React.MutableRefObject<boolean>;
  currentNotificationId: string;
  splitResultTaskId: string;
  rejectReason: string;
  splitExecutor: string;
  splitResult: any;
  refreshTaskList?: () => void;
}

export function useSplitDialogs({
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
  setProcessingProgress,
  setProcessingResult,
  displayedCountRef,
  pendingSplitNotificationsRef,
  submitLockRef,
  isClosingByButtonRef,
  currentNotificationId,
  splitResultTaskId,
  rejectReason,
  splitExecutor,
  splitResult,
  refreshTaskList,
}: UseSplitDialogsOptions) {
  // 拆解提示对话框状态
  const [pendingCommandsForSplit, setPendingCommandsForSplit] = useState<any[]>([]);
  const [lastAssistantContent, setLastAssistantContent] = useState('');

  // Agent B 拆解结果确认相关状态
  const [isProcessingSplitResult, setIsProcessingSplitResultLocal] = useState(false);
  const [isSplitResultDialogMinimized, setIsSplitResultDialogMinimized] = useState(false);

  // insurance-d 拆解 daily_task 相关状态
  const [showInsuranceDSplitDialog, setShowInsuranceDSplitDialog] = useState(false);
  const [selectedDailyTaskForSplit, setSelectedDailyTaskForSplit] = useState<any>(null);
  const [insuranceDSplitResult, setInsuranceDSplitResult] = useState<any>(null);
  const [isSplittingDailyTask, setIsSplittingDailyTask] = useState(false);

  // 拒绝原因输入对话框状态
  const [showRejectReasonDialog, setShowRejectReasonDialogLocal] = useState(false);
  const [rejectReasonLocal, setRejectReasonLocal] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // 当前处理任务的 taskId
  const [currentTaskId, setCurrentTaskId] = useState('');

  // 拆解后发送失败的子任务
  const [failedSubTasks, setFailedSubTasks] = useState<any[]>([]);

  // 同步 isProcessingSplitResult 状态
  const handleSetIsProcessingSplitResult = useCallback((processing: boolean) => {
    setIsProcessingSplitResultLocal(processing);
    setIsProcessingSplitResult(processing);
  }, [setIsProcessingSplitResult]);

  // 同步 showRejectReasonDialog 状态
  const handleSetShowRejectReasonDialog = useCallback((show: boolean) => {
    setShowRejectReasonDialogLocal(show);
    setShowRejectReasonDialog(show);
  }, [setShowRejectReasonDialog]);

  // 同步 rejectReason 状态
  const handleSetRejectReason = useCallback((reason: string) => {
    setRejectReasonLocal(reason);
    setRejectReason(reason);
  }, [setRejectReason]);

  // 处理拆解确认
  const handleSplitConfirm = async () => {
    console.log('✅ 用户确认让 Agent B 拆解任务');
    setShowSplitDialog(false);

    try {
      // 向 Agent B 发送拆解任务指令
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

${'```'}
json
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
${'```'}`,
        commandType: 'instruction',
        priority: 'high',
      };

      const result = await sendCommandToAgent(
        'B',
        splitTaskCommand.commandContent,
        splitTaskCommand.commandType,
        splitTaskCommand.priority,
        'A',
        splitTaskCommand.id
      );

      if (result.success) {
        toast.success('✅ 已发送拆解任务给 Agent B');
      } else {
        toast.error('❌ 发送拆解任务失败');
      }
    } catch (error) {
      console.error('❌ 发送拆解任务时出错:', error);
      toast.error('❌ 发送拆解任务时出错');
    }
  };

  // 处理拆解取消
  const handleSplitCancel = async () => {
    console.log('❌ 用户取消拆解任务');
    setShowSplitDialog(false);

    try {
      // 直接自动发送指令
      console.log(`📋 直接自动发送 ${pendingCommandsForSplit.length} 条指令`);

      let successCount = 0;
      let failCount = 0;

      for (const cmd of pendingCommandsForSplit) {
        const result = await sendCommandToAgent(
          cmd.targetAgentId,
          cmd.commandContent,
          cmd.commandType,
          cmd.priority,
          'A',
          cmd.id
        );

        if (result.success) {
          console.log(`✅ 指令已发送到 ${cmd.targetAgentId}`);
          successCount++;
        } else {
          console.error(`❌ 指令发送失败: ${cmd.targetAgentId}`);
          failCount++;
        }
      }

      if (failCount > 0) {
        toast.error(`⚠️ ${failCount} 条指令发送失败`);
      } else {
        toast.success(`✅ 已发送 ${successCount} 条指令`);
      }
    } catch (error) {
      console.error('❌ 发送指令时出错:', error);
      toast.error('❌ 发送指令时出错');
    }
  };

  // 处理拆解结果确认
  const handleSplitResultConfirm = async () => {
    // 强制检查锁，防止重复点击
    if (submitLockRef.current) {
      console.log('⚠️ 请求正在进行中，忽略重复点击');
      return;
    }

    // 立即加锁（同步操作）
    submitLockRef.current = true;

    console.log('✅ 用户确认拆解结果');

    // 标记为通过按钮关闭，避免触发 Dialog 的 onOpenChange 回调
    isClosingByButtonRef.current = true;

    handleSetIsProcessingSplitResult(true);
    setProcessingResult(null); // 清除之前的结果

    // 🔥 定义统计变量（放在 try 块外部，确保作用域正确）
    let successCount = 0;
    let failCount = 0;
    const failedTasks: any[] = [];

    try {
      // 🔥 修复：同时支持 subtasks（小写）和 subTasks（大写）两种写法
      const subTasks = splitResult?.subtasks || splitResult?.subTasks;
      
      if (splitResult && subTasks && subTasks.length > 0) {
        // 更新进度：开始保存任务记录
        setProcessingProgress({
          current: 0,
          total: subTasks.length + 1, // +1 表示保存任务记录这一步
          message: '正在保存任务记录...'
        });

        // 🔥 统一调用 /api/split/confirm API
        console.log('🔍 [统一拆解确认] 调用统一 API...');
        
        try {
          const saveResponse = await fetch('/api/split/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: splitResultTaskId,
              splitResult: splitResult,
              notificationId: currentNotificationId,
              splitExecutor: splitExecutor // 明确指定
            }),
          });

          if (saveResponse.ok) {
            const saveResult = await saveResponse.json();
            console.log(`✅ 统一拆解确认成功:`, saveResult);
            successCount = 0; // 重置，后面发送指令时再累加
          } else {
            const errorText = await saveResponse.text();
            console.error('❌ 统一拆解确认失败:', errorText);
            throw new Error(`保存任务记录失败: ${errorText}`);
          }
        } catch (error) {
          console.error('❌ 统一拆解确认时出错:', error);
          throw error;
        }

        console.log(`📤 准备发送 ${subTasks.length} 条子任务指令`);

        // 更新进度：开始发送指令
        setProcessingProgress({
          current: 1,
          total: subTasks.length + 1,
          message: '正在发送子任务指令...'
        });

        // 遍历每条子任务，向对应的 Agent 发送指令
        for (let i = 0; i < subTasks.length; i++) {
          const subTask = subTasks[i];
          console.log(`📤 处理子任务到 ${subTask.executor}: ${subTask.taskTitle}`);

          // 更新进度
          setProcessingProgress({
            current: i + 1,
            total: subTasks.length + 1,
            message: `正在发送子任务 ${i + 1}/${subTasks.length}: ${subTask.taskTitle}`
          });

          // 获取执行主体的显示名称
          const getExecutorDisplayName = (executor: string): string => {
            if (isWritingAgent(executor)) {
              return getWritingAgentName(executor);
            }
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

          // 向执行 Agent 发送指令
          const result = await sendCommandToAgent(
            subTask.executor,
            commandContent,
            'instruction',
            subTask.priority === '高' ? 'high' : 'normal',
            'B',
            subTask.id
          );

          if (result.success) {
            console.log(`✅ 子任务指令已发送到 ${subTask.executor}: ${subTask.taskTitle}`);
            successCount++;
          } else {
            console.error(`❌ 子任务指令发送失败: ${subTask.taskTitle}`);
            failCount++;
            failedTasks.push(subTask);
          }
        }

        // 显示处理结果
        setProcessingResult({
          success: failCount === 0,
          message: failCount === 0 
            ? `成功创建并发送 ${successCount} 条子任务` 
            : `部分子任务发送失败`,
          successCount,
          failCount
        });

        // 添加结果消息
        const failedTasksContent = failCount > 0
          ? `**失败的子任务：**
${failedTasks.map((ft: any) => `- ${ft.taskTitle} → ${ft.executor}`).join('\n')}

Agent B 将重试失败的子任务。`
          : '';

        const resultMessage: any = {
          id: `split_confirm_${Date.now()}`,
          role: 'assistant',
          content: `✅ **拆解结果已确认**

**处理结果：**
- 成功发送 ${successCount} 条子任务指令
${failCount > 0 ? `- 失败 ${failCount} 条子任务指令` : ''}

${failedTasksContent}
${failedTasksContent ? '' : '所有子任务已成功发送到对应的 Agent。'}`,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, resultMessage]);

        // 更新通知 metadata，标记为 confirmed
        if (currentNotificationId) {
          try {
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
          } catch (error) {
            console.error('❌ 更新通知状态失败:', error);
          }
        }

        // 刷新任务列表
        if (refreshTaskList) {
          refreshTaskList();
        }
      }
    } catch (error) {
      console.error('❌ 发送子任务时出错:', error);
      
      // 显示错误结果
      setProcessingResult({
        success: false,
        message: error instanceof Error ? error.message : '处理失败，请重试',
        successCount,
        failCount
      });

      // 添加错误消息
      const errorMessage: any = {
        id: `split_error_${Date.now()}`,
        role: 'assistant',
        content: `❌ **确认拆解结果失败**

**错误信息：**
${error instanceof Error ? error.message : String(error)}

请重试或联系管理员。`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      // 确保无论成功或失败都重置状态（但保留处理结果用于显示）
      handleSetIsProcessingSplitResult(false);
      setProcessingProgress(null); // 清除进度
      submitLockRef.current = false;
    }
  };

  // 处理成功后关闭对话框
  const handleCloseAfterSuccess = useCallback(() => {
    // 清空处理结果
    setProcessingResult(null);
    
    // 显示队列中的下一个拆解结果
    setTimeout(() => {
      console.log(`🔍 [确认后队列] 检查队列中的待显示通知...`);
      if (pendingSplitNotificationsRef.current.length > 0) {
        const nextNotification = pendingSplitNotificationsRef.current.shift();
        console.log(`🎉 [确认后队列] 找到下一个通知: ${nextNotification?.notification?.notificationId}`);

        if (nextNotification) {
          const { notification, jsonData, taskIdToUse, displayExecutor } = nextNotification;

          // 更新通知状态
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

          console.log(`🎉 [确认后队列] 准备显示下一个弹框...`);
          setShowSplitResultConfirm(true);
          setSplitResultTaskId(taskIdToUse);
          setCurrentNotificationId(notification.notificationId || '');
          setSplitResult(jsonData);
          setSplitExecutor(displayExecutor);
        }
      } else {
        console.log(`📋 [确认后队列] 队列为空，没有待显示的通知`);
        setShowSplitResultConfirm(false);
      }
    }, 300);
  }, [setShowSplitResultConfirm, setSplitResultTaskId, setCurrentNotificationId, setSplitResult, setSplitExecutor, setProcessingResult]);

  // 提交拒绝原因
  const handleSubmitRejectReason = async () => {
    console.log('🔧 [拆解拒绝] ===== 开始处理拒绝 =====');
    console.log('🔧 [拆解拒绝] 处理拒绝...');
    console.log('🔧 [拆解拒绝] 当前状态：');
    console.log(`  - splitExecutor: "${splitExecutor}"`);
    console.log(`  - rejectReason: "${rejectReasonLocal}"`);
    console.log(`  - rejectReason.trim(): "${rejectReasonLocal.trim()}"`);
    console.log(`  - !rejectReason.trim(): ${!rejectReasonLocal.trim()}`);
    console.log(`  - isSubmittingReject: ${isSubmittingReject}`);
    console.log(`  - currentNotificationId: ${currentNotificationId}`);
    console.log(`  - splitResultTaskId: ${splitResultTaskId}`);

    // 前置检查
    if (!rejectReasonLocal.trim()) {
      console.error('❌ [拆解拒绝] 拒绝原因为空，不允许提交');
      toast.error('请输入拒绝原因');
      return;
    }

    if (isSubmittingReject) {
      console.error('❌ [拆解拒绝] 正在提交中，不允许重复提交');
      return;
    }

    // 检查必要的状态变量
    if (!currentNotificationId || !splitResultTaskId) {
      console.error('❌ [拆解拒绝] 缺少必要的状态变量');
      console.error(`  - currentNotificationId: ${currentNotificationId}`);
      console.error(`  - splitResultTaskId: ${splitResultTaskId}`);
      toast.error('系统错误：缺少必要的状态信息，请刷新页面重试');
      return;
    }

    console.log('🔧 [拆解拒绝] 前置检查通过，准备提交...');
    console.log('🔧 [拆解拒绝] 设置 isSubmittingReject = true');
    setIsSubmittingReject(true);

    console.log(`🔧 [拆解拒绝] 准备请求参数:`);
    console.log(`  - notificationId: ${currentNotificationId}`);
    console.log(`  - taskId: ${splitResultTaskId}`);
    console.log(`  - rejectionReason: ${rejectReasonLocal}`);
    console.log(`  - retry: true`);

    try {
      console.log('🔧 [拆解拒绝] 开始发起 fetch 请求...');

      // 根据 splitExecutor 选择不同的拒绝 API
      const apiUrl = '/api/commands/reject';

      console.log(`🔧 [拆解拒绝] 请求 URL: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: currentNotificationId,
          taskId: splitResultTaskId,
          rejectionReason: rejectReasonLocal,
          splitResult: splitResult, // 🔥 传递上次拆解结果
          retry: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`🔧 [拆解拒绝] 响应不成功 (status: ${response.status})`);
        console.log(`🔧 [拆解拒绝] 错误响应: ${errorText}`);
        throw new Error(`拒绝失败: ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ [拆解拒绝] 解析成功`);
      console.log(`✅ [拆解拒绝] 响应数据:`, result);

      // 更新通知 metadata，标记为 rejected
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
                rejectionReason: rejectReasonLocal,
              },
            }),
          });
          console.log(`✅ [Agent B 拒绝] 通知状态已更新为 rejected`);
        } catch (error) {
          console.error('❌ [Agent B 拒绝] 更新通知状态失败:', error);
        }
      }

      // 显示成功提示
      if (result.data?.asyncSplit) {
        toast.success(`✅ 已拒绝拆解，正在后台重新拆解任务，请稍候...`, {
          duration: 5000,
          description: '新的拆解结果将通过 WebSocket 实时推送',
        });
      }

      // 添加结果消息
      let resultContent = '';
      if (result.data?.asyncSplit) {
        resultContent = `❌ **拆解结果已拒绝**

**拒绝原因：**
${rejectReasonLocal}

**处理结果：**
- ✅ 已拒绝当前的拆解结果
- 🔄 正在后台重新拆解任务...
- 📡 新的拆解结果将通过 WebSocket 实时推送

请稍候，Agent B 正在根据您的反馈重新拆解任务。`;
      }

      const resultMessage: any = {
        id: `split_reject_${Date.now()}`,
        role: 'assistant',
        content: resultContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, resultMessage]);

      // 关闭对话框
      console.log('🔧 [Agent B 拒绝] 立即关闭弹框...');
      handleSetShowRejectReasonDialog(false);
      setShowSplitResultConfirm(false);
      console.log(`🔧 [Agent B 拒绝] 已关闭弹框`);

      // 清空相关状态
      setSplitResult(null);
      setSplitResultTaskId('');
      setSplitExecutor('Agent B');
      setCurrentNotificationId('');
      handleSetRejectReason('');
      console.log('🔧 [Agent B 拒绝] 已清空所有相关状态');

      // 重置 displayedCountRef
      displayedCountRef.current = 0;
      console.log(`🧹 [Agent B 拒绝] 已重置 displayedCountRef: ${displayedCountRef.current}`);

      // 显示队列中的下一个通知
      setTimeout(() => {
        console.log(`🔍 [Agent B 拒绝后队列] 检查队列中的待显示通知...`);
        if (pendingSplitNotificationsRef.current.length > 0) {
          const nextNotification = pendingSplitNotificationsRef.current.shift();
          console.log(`📝 [Agent B 拒绝后队列] 取出下一个通知: ${nextNotification?.notification?.notificationId}`);
          console.log(`📝 [Agent B 拒绝后队列] 剩余队列长度: ${pendingSplitNotificationsRef.current.length}`);

          if (nextNotification) {
            const { notification, jsonData, taskIdToUse, displayExecutor } = nextNotification;

            // 更新通知状态
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
            setShowSplitResultConfirm(true);
            setSplitResultTaskId(taskIdToUse);
            setCurrentNotificationId(notification.notificationId || '');
            setSplitResult(jsonData);
            setSplitExecutor(displayExecutor);

            displayedCountRef.current++;
            console.log(`📊 [Agent B 拒绝后队列] 显示计数: ${displayedCountRef.current}/2`);
          }
        } else {
          console.log(`📝 [Agent B 拒绝后队列] 队列为空，等待新的拆解结果通知...`);
        }
      }, 1000);
    } catch (error) {
      console.error('❌ [Agent B 拆解] 拒绝失败');
      console.error('❌ [Agent B 拆解] 错误对象:', error);

      if (error instanceof Error) {
        console.error('❌ [Agent B 拆解] 错误名称:', error.name);
        console.error('❌ [Agent B 拆解] 错误消息:', error.message);
        console.error('❌ [Agent B 拆解] 错误堆栈:', error.stack);
      }

      const isTimeout = error instanceof Error && error.name === 'AbortError';
      const errorMessage = isTimeout
        ? '请求超时，请检查网络连接或稍后重试'
        : `拒绝失败: ${error instanceof Error ? error.message : String(error)}`;

      console.log(`🔧 [Agent B 拆解] 显示错误提示: ${errorMessage}`);
      toast.error(errorMessage);

      console.log('🔧 [Agent B 拆解] 恢复拒绝原因对话框');
      handleSetShowRejectReasonDialog(true);
    } finally {
      // 恢复按钮状态
      setTimeout(() => {
        console.log('🔧 [Agent B 拒绝] finally 块执行，设置 isSubmittingReject = false');
        setIsSubmittingReject(false);
      }, 50);
    }
  };

  // 拒绝拆解结果
  const handleSplitResultReject = () => {
    console.log('❌ 用户拒绝拆解结果');
    console.log(`🔧 [拆解拒绝] 当前状态：`);
    console.log(`  - submitLockRef.current: ${submitLockRef.current}`);
    console.log(`  - isProcessingSplitResult: ${isProcessingSplitResult}`);
    console.log(`  - isSplitResultDialogMinimized: ${isSplitResultDialogMinimized}`);

    if (submitLockRef.current) {
      console.error('❌ [拆解拒绝] 请求正在进行中，无法拒绝');
      toast.error('请求正在进行中，请稍后再试');
      return;
    }

    if (isProcessingSplitResult) {
      console.error('❌ [拆解拒绝] 正在处理拆解结果，无法拒绝');
      toast.error('正在处理拆解结果，请稍后再试');
      return;
    }

    console.log('✅ [拆解拒绝] 检查通过，打开拒绝原因对话框');
    handleSetShowRejectReasonDialog(true);
  };

  // 关闭拆解结果对话框
  const handleSplitResultDialogClose = (open: boolean) => {
    if (!open && !isClosingByButtonRef.current) {
      console.log('🔥 用户通过其他方式关闭了拆解结果对话框');
    }
    isClosingByButtonRef.current = false;
  };

  // 放弃拆解结果
  const handleSplitResultAbandon = () => {
    console.log('🗑️ 用户放弃拆解结果');

    // 标记为通过按钮关闭，避免触发 Dialog 的 onOpenChange 回调
    isClosingByButtonRef.current = true;

    setShowSplitResultConfirm(false);

    // 清空相关状态
    setSplitResult(null);
    setSplitResultTaskId('');
    setSplitExecutor('Agent B');
    setCurrentNotificationId('');
    handleSetRejectReason('');

    toast.info('已放弃拆解结果');
  };

  return {
    // 拆解提示对话框
    pendingCommandsForSplit,
    setPendingCommandsForSplit,
    lastAssistantContent,
    setLastAssistantContent,
    handleSplitConfirm,
    handleSplitCancel,

    // 拆解结果确认对话框
    splitResult,
    setSplitResult,
    splitResultTaskId,
    setSplitResultTaskId,
    splitExecutor,
    setSplitExecutor,
    currentNotificationId,
    setCurrentNotificationId,
    isProcessingSplitResult,
    isSplitResultDialogMinimized,
    setIsSplitResultDialogMinimized,
    handleSplitResultConfirm,
    handleSplitResultReject,
    handleSplitResultDialogClose,
    handleSplitResultAbandon,
    handleCloseAfterSuccess,

    // 拒绝原因对话框
    showRejectReasonDialog,
    setShowRejectReasonDialog: handleSetShowRejectReasonDialog,
    rejectReason,
    setRejectReason: handleSetRejectReason,
    isSubmittingReject,
    handleSubmitRejectReason,

    // insurance-d 拆解对话框
    showInsuranceDSplitDialog,
    setShowInsuranceDSplitDialog,
    selectedDailyTaskForSplit,
    setSelectedDailyTaskForSplit,
    insuranceDSplitResult,
    setInsuranceDSplitResult,
    isSplittingDailyTask,
    setIsSplittingDailyTask,

    // 其他状态
    currentTaskId,
    setCurrentTaskId,
    failedSubTasks,
    setFailedSubTasks,
  };
}
