'use client';

import { CheckCircle, XCircle, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SubTask {
  taskTitle?: string;
  title?: string;
  taskType?: string;
  isCritical?: boolean;
  commandContent?: string;
  description?: string;
  executor: string;
  priority?: string;
  deadline?: string;
  estimatedHours?: string;
  acceptanceCriteria?: string;
}

interface SplitResult {
  totalDeliverables?: string;
  timeFrame?: string;
  summary?: string;
  productTags?: string[]; // 🔥 新增：产品标签
  subtasks?: SubTask[];
  subTasks?: SubTask[];
}

interface SplitResultConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  splitResult: SplitResult | null;
  splitExecutor: string;
  notification: any; // 🔥 新增：通知信息
  isMinimized: boolean;
  onToggleMinimize: () => void;
  isProcessing: boolean;
  submitLocked: boolean;
  processingProgress?: {
    current: number;
    total: number;
    message: string;
  } | null;
  processingResult?: {
    success: boolean;
    successCount: number;
    failCount: number;
    message: string;
  } | null;
  onAbandon: () => void;
  onReject: () => void;
  onConfirm: () => void;
  onCloseAfterSuccess?: () => void;
}

export function SplitResultConfirmDialog({
  open,
  onOpenChange,
  splitResult,
  splitExecutor,
  notification, // 🔥 新增：通知信息
  isMinimized,
  onToggleMinimize,
  isProcessing,
  submitLocked,
  processingProgress,
  processingResult,
  onAbandon,
  onReject,
  onConfirm,
  onCloseAfterSuccess,
}: SplitResultConfirmDialogProps) {
  const subTasks = splitResult?.subtasks || splitResult?.subTasks || [];
  
  // 🔥 调试日志
  console.log('🔍 [SplitResultConfirmDialog] 调试信息:');
  console.log('  - notification:', notification);
  console.log('  - notification?.notification_type:', notification?.notification_type);
  console.log('  - notification?.type:', notification?.type);
  console.log('  - notification?.metadata:', notification?.metadata);
  
  // 🔥 判断当前处理的是哪个表
  // ✅ 新的逻辑：
  // - agentA_command → daily_task
  // - daily_task_result → agent_sub_tasks
  // - daily_task_redivide → daily_task（重新拆分）
  // 🔥 兼容两个字段：notification_type 和 type
  const notifType = notification?.notification_type || notification?.type;
  console.log('  - 使用的通知类型:', notifType);
  
  const isAgentSubTasksFlow = notifType === 'daily_task_result';
  const targetTable = isAgentSubTasksFlow ? 'agent_sub_tasks' : 'daily_task';
  
  console.log('  - isAgentSubTasksFlow:', isAgentSubTasksFlow);
  console.log('  - targetTable:', targetTable);
  
  // 🔥 动态生成 Title
  const getDialogTitle = () => {
    return isAgentSubTasksFlow ? '确认 agent_sub_tasks 拆解方案' : '确认 daily_task 拆解方案';
  };
  
  // 🔥 动态生成图标颜色
  const getIconColor = () => {
    return isAgentSubTasksFlow ? 'text-blue-600' : 'text-purple-600';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] p-0">
        <div className="flex flex-col h-full max-h-[80vh]">
          <DialogHeader className="p-6 pb-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className={`w-5 h-5 ${getIconColor()}`} />
                {getDialogTitle()}
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleMinimize}
                className="h-8 w-8 p-0"
              >
                {isMinimized ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>
            {/* 🔥 不使用 DialogDescription，避免 p 标签内嵌套 div 的 Hydration 错误 */}
            <div className="text-muted-foreground text-sm space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{splitExecutor}</Badge>
                <span>已完成任务拆解，请确认是否接受此方案</span>
              </div>
              
              {/* 🔥 目标表信息 - 更突出显示 */}
              <div className={`p-3 rounded-lg text-xs ${isAgentSubTasksFlow ? 'bg-blue-50 border border-blue-200' : 'bg-purple-50 border border-purple-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold">🎯 目标表：</span>
                  <code className={`px-2 py-1 rounded font-mono font-bold ${isAgentSubTasksFlow ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                    {targetTable}
                  </code>
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  <strong>当前状态：</strong> 表中<span className="font-bold text-red-600">尚无记录</span>，记录将在您确认后保存
                </div>
              </div>
              
              {/* 🔥 按钮操作说明 */}
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs">
                <div className="font-semibold mb-2">📋 操作说明：</div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-start gap-2">
                    <span className="text-orange-600 font-bold">↺</span>
                    <div>
                      <span className="font-medium">拒绝并重新拆解：</span>
                      <span className="text-gray-600">不保存当前方案，请求重新拆解（仍处理 <code className="bg-gray-200 px-1 rounded">{targetTable}</code> 表）</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <div>
                      <span className="font-medium">确认并接受：</span>
                      <span className="text-gray-600">保存当前拆解方案到 <code className="bg-gray-200 px-1 rounded">{targetTable}</code> 表</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          {!isMinimized && (
            <ScrollArea className="flex-1 px-6 min-h-0">
              {splitResult && (
                <div className="space-y-4 pb-4">
                  {/* 🔥 新增：原任务信息 */}
                  {notification?.metadata?.originalTaskContent && (
                    <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        📋 原任务内容
                      </h4>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto">
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {notification.metadata.originalTaskContent}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 🔥 新增：产品标签识别结果 */}
                  <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                      🏷️ 识别到的产品标签
                    </h4>
                    {splitResult?.productTags && splitResult.productTags.length > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {splitResult.productTags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-200">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          💡 系统已自动识别产品标签，确认后将用于案例推荐匹配
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        暂未识别到产品标签，可手动补充或在任务内容中明确产品类型
                      </p>
                    )}
                  </div>

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
                      拆解后的任务列表 ({subTasks.length} 个子任务)
                    </h4>
                    <div className="space-y-3">
                      {subTasks.map((subTask, index) => (
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
                                  {subTask.taskTitle || subTask.title}
                                </span>
                                {subTask.taskType && (
                                  <Badge variant="outline" className="text-xs">
                                    {subTask.taskType}
                                  </Badge>
                                )}
                                {subTask.isCritical && (
                                  <Badge variant="destructive" className="text-xs">
                                    关键任务
                                  </Badge>
                                )}
                              </div>
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

          <DialogFooter className="flex flex-col gap-4 p-6 pt-4 flex-shrink-0 border-t">
            {/* 处理进度显示 */}
            {isProcessing && processingProgress && (
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{processingProgress.message}</span>
                  <span className="font-medium">{processingProgress.current}/{processingProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* 处理结果显示 */}
            {processingResult && (
              <div className={`w-full p-4 rounded-lg ${
                processingResult.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {processingResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${
                      processingResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {processingResult.message}
                    </p>
                    {(processingResult.successCount > 0 || processingResult.failCount > 0) && (
                      <div className="mt-1 flex items-center gap-4 text-sm">
                        {processingResult.successCount > 0 && (
                          <span className="text-green-700">
                            ✅ 成功：{processingResult.successCount} 条
                          </span>
                        )}
                        {processingResult.failCount > 0 && (
                          <span className="text-red-700">
                            ❌ 失败：{processingResult.failCount} 条
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {processingResult.success && (
                  <Button
                    onClick={onCloseAfterSuccess}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    完成
                  </Button>
                )}
              </div>
            )}

            {/* 正常操作按钮（仅在非处理状态且无结果时显示） */}
            {!isProcessing && !processingResult && (
              <div className="flex flex-row justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={onAbandon}
                  disabled={isProcessing}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  放弃拆解
                </Button>
                <Button
                  variant="outline"
                  onClick={onReject}
                  disabled={isProcessing || submitLocked}
                >
                  拒绝并重新拆解
                </Button>
                <Button
                  onClick={onConfirm}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={isProcessing || submitLocked}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    '确认并接受'
                  )}
                </Button>
              </div>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
