/**
 * 用户交互处理组件
 * 用于处理 waiting_user 状态任务的用户交互
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  UserCheck,
  Check,
  X,
  ListTodo,
  MessageSquare,
  AlertCircle,
  Clock,
  ChevronRight,
  Save,
  Send,
  Zap,  // 🔴 新增：闪电图标表示强制执行
} from 'lucide-react';
import { toast } from 'sonner';

interface KeyField {
  fieldId: string;
  fieldName: string;
  fieldType: 'text' | 'number' | 'select' | 'date' | 'boolean';
  description: string;
  currentValue: any;
  options?: any[];
  validationRules?: {
    required: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface AvailableSolution {
  solutionId: string;
  label: string;
  description: string;
  pros?: string[];
  cons?: string[];
  estimatedTime?: number;
}

interface PromptMessage {
  title: string;
  description: string;
  deadline?: Date;
  priority?: 'low' | 'medium' | 'high';
}

interface WaitingTask {
  id: string;
  taskTitle: string;
  taskDescription: string;
  status: string;
  priority: 'high' | 'normal' | 'low';
  orderIndex: number;
  isCritical: boolean;
  executor: string;
  createdAt: string;
  startedAt?: string;
  updatedAt?: string;
  metadata: {
    [key: string]: any;
  };
  pendingKeyFields: KeyField[];
  availableSolutions: AvailableSolution[];
  promptMessage?: PromptMessage;
  relatedDailyTask?: {
    id: string;
    taskId: string;
    executionDate: string;
    commandContent?: string;
  };
}

interface UserInteractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: WaitingTask | null;
  onSubmit?: (taskId: string, interactionData: any) => Promise<void>;
}

export function UserInteractionDialog({
  open,
  onOpenChange,
  task,
  onSubmit,
}: UserInteractionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'fields' | 'solutions'>('fields');
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [selectedSolution, setSelectedSolution] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  
  // 🔴 用户强制执行功能
  const [enableForcedExecutor, setEnableForcedExecutor] = useState(false);
  const [forcedExecutor, setForcedExecutor] = useState<string>('');

  // 当任务改变时重置状态
  useEffect(() => {
    if (task) {
      // 初始化字段值
      const initialFieldValues: Record<string, any> = {};
      task.pendingKeyFields.forEach((field) => {
        initialFieldValues[field.fieldId] = field.currentValue;
      });
      setFieldValues(initialFieldValues);

      // 如果有方案且默认选择第一个
      if (task.availableSolutions.length > 0 && !selectedSolution) {
        setSelectedSolution(task.availableSolutions[0].solutionId);
      }

      setNotes('');
      setActiveTab(task.pendingKeyFields.length > 0 ? 'fields' : 'solutions');
      
      // 🔴 重置强制执行者状态
      setEnableForcedExecutor(false);
      setForcedExecutor('');
    }
  }, [task]);

  // 处理字段值变化
  const handleFieldChange = (fieldId: string, value: any) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  // 验证字段
  const validateFields = () => {
    if (!task) return true;

    for (const field of task.pendingKeyFields) {
      const value = fieldValues[field.fieldId];
      const rules = field.validationRules;

      if (rules?.required) {
        if (value === undefined || value === null || value === '') {
          toast.error(`请填写必填字段: ${field.fieldName}`);
          return false;
        }
      }

      if (field.fieldType === 'number' && value) {
        const numValue = Number(value);
        if (rules?.min !== undefined && numValue < rules.min) {
          toast.error(`字段 ${field.fieldName} 不能小于 ${rules.min}`);
          return false;
        }
        if (rules?.max !== undefined && numValue > rules.max) {
          toast.error(`字段 ${field.fieldName} 不能大于 ${rules.max}`);
          return false;
        }
      }
    }

    return true;
  };

  // 提交用户交互
  const handleSubmit = async () => {
    if (!task) return;

    // 验证字段
    if (activeTab === 'fields' && !validateFields()) {
      return;
    }

    // 验证方案选择（如果有方案）
    if (task.availableSolutions.length > 0 && !selectedSolution) {
      toast.error('请选择一个方案');
      return;
    }
    
    // 🔴 验证强制执行者选择
    if (enableForcedExecutor && !forcedExecutor) {
      toast.error('请选择要强制执行的 Agent');
      return;
    }

    setLoading(true);

    try {
      const interactionData = {
        fieldValues: fieldValues,
        selectedSolution: selectedSolution,
        notes: notes,
        submittedAt: new Date().toISOString(),
        // 🔴 添加强制执行者信息
        forcedExecutor: enableForcedExecutor ? forcedExecutor : null,
      };

      if (onSubmit) {
        await onSubmit(task.id, interactionData);
      }

      toast.success('用户交互已提交');
      onOpenChange(false);
    } catch (error) {
      console.error('提交用户交互失败:', error);
      toast.error('提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'normal':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <UserCheck className="w-6 h-6 text-purple-600" />
            <div>
              <DialogTitle className="text-xl">待办任务处理</DialogTitle>
              <DialogDescription>请完成以下任务的用户交互</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 任务信息 */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-purple-100 text-purple-700">
                  待处理
                </Badge>
                <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                <span className="text-sm text-gray-500">顺序 #{task.orderIndex}</span>
                {task.isCritical && (
                  <Badge variant="destructive" className="text-xs">
                    关键
                  </Badge>
                )}
              </div>
            </div>
            <CardTitle className="text-lg mt-2">{task.taskTitle}</CardTitle>
            <CardDescription>{task.taskDescription}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {/* 提示信息 */}
            {task.promptMessage && (
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 mb-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="font-medium text-purple-900">{task.promptMessage.title}</h5>
                    <p className="text-sm text-purple-700 mt-1">
                      {task.promptMessage.description}
                    </p>
                    {task.promptMessage.deadline && (
                      <div className="flex items-center gap-1 text-xs text-purple-600 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>截止: {formatDate(task.promptMessage.deadline.toString())}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 原始指令内容 */}
            {task.relatedDailyTask?.commandContent && (
              <div className="mt-4 bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                  <ListTodo className="w-5 h-5" />
                  原始指令
                </h4>
                <pre className="text-amber-800 text-sm whitespace-pre-wrap overflow-x-auto">
                  {task.relatedDailyTask.commandContent}
                </pre>
              </div>
            )}

            {/* 元信息 */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span>执行者: {task.executor}</span>
              <span>创建: {formatDate(task.createdAt)}</span>
              {task.updatedAt && <span>更新: {formatDate(task.updatedAt)}</span>}
            </div>
          </CardContent>
        </Card>

        {/* 标签页切换 */}
        {(task.pendingKeyFields.length > 0 || task.availableSolutions.length > 0) && (
          <div className="flex border-b mb-4">
            {task.pendingKeyFields.length > 0 && (
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'fields'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('fields')}
              >
                <ListTodo className="w-4 h-4 inline mr-1" />
                待确认字段 ({task.pendingKeyFields.length})
              </button>
            )}
            {task.availableSolutions.length > 0 && (
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'solutions'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('solutions')}
              >
                <MessageSquare className="w-4 h-4 inline mr-1" />
                可选方案 ({task.availableSolutions.length})
              </button>
            )}
          </div>
        )}

        {/* 内容区域 */}
        <ScrollArea className="h-[35vh]">
          {activeTab === 'fields' && task.pendingKeyFields.length > 0 ? (
            <div className="space-y-4">
              {task.pendingKeyFields.map((field) => (
                <div key={field.fieldId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="font-medium text-sm text-gray-900">
                      {field.fieldName}
                      {field.validationRules?.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">{field.description}</p>

                  {/* 根据字段类型渲染不同的输入控件 */}
                  {field.fieldType === 'text' && (
                    <Textarea
                      value={fieldValues[field.fieldId] || ''}
                      onChange={(e) => handleFieldChange(field.fieldId, e.target.value)}
                      placeholder={`请输入 ${field.fieldName}`}
                      rows={3}
                    />
                  )}

                  {field.fieldType === 'number' && (
                    <Input
                      type="number"
                      value={fieldValues[field.fieldId] || ''}
                      onChange={(e) => handleFieldChange(field.fieldId, e.target.value)}
                      placeholder={`请输入 ${field.fieldName}`}
                      min={field.validationRules?.min}
                      max={field.validationRules?.max}
                    />
                  )}

                  {field.fieldType === 'select' && field.options && (
                    <Select
                      value={fieldValues[field.fieldId] || ''}
                      onValueChange={(value) => handleFieldChange(field.fieldId, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`请选择 ${field.fieldName}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {field.fieldType === 'date' && (
                    <Input
                      type="date"
                      value={fieldValues[field.fieldId] || ''}
                      onChange={(e) => handleFieldChange(field.fieldId, e.target.value)}
                    />
                  )}

                  {field.fieldType === 'boolean' && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={field.fieldId}
                        checked={fieldValues[field.fieldId] || false}
                        onCheckedChange={(checked) => handleFieldChange(field.fieldId, checked)}
                      />
                      <label htmlFor={field.fieldId} className="text-sm">
                        {field.fieldName}
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'solutions' && task.availableSolutions.length > 0 ? (
            <div className="space-y-3">
              {task.availableSolutions.map((solution) => (
                <div
                  key={solution.solutionId}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedSolution === solution.solutionId
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                  onClick={() => setSelectedSolution(solution.solutionId)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedSolution === solution.solutionId
                            ? 'border-purple-600 bg-purple-600'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedSolution === solution.solutionId && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{solution.label}</h4>
                      <p className="text-sm text-gray-600 mt-1">{solution.description}</p>

                      {/* 优缺点 */}
                      {(solution.pros || solution.cons) && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          {solution.pros && solution.pros.length > 0 && (
                            <div className="space-y-1">
                              <div className="font-medium text-green-700">优点:</div>
                              <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                                {solution.pros.map((pro, idx) => (
                                  <li key={idx}>{pro}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {solution.cons && solution.cons.length > 0 && (
                            <div className="space-y-1">
                              <div className="font-medium text-red-700">缺点:</div>
                              <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                                {solution.cons.map((con, idx) => (
                                  <li key={idx}>{con}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 预计时间 */}
                      {solution.estimatedTime && (
                        <div className="mt-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3 inline mr-1" />
                          预计时间: {solution.estimatedTime} 小时
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </ScrollArea>

        {/* 🔴 强制执行区域 */}
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Checkbox
              id="enableForcedExecutor"
              checked={enableForcedExecutor}
              onCheckedChange={(checked) => {
                setEnableForcedExecutor(checked === true);
                if (!checked) setForcedExecutor('');
              }}
            />
            <label
              htmlFor="enableForcedExecutor"
              className="text-sm font-medium text-amber-900 cursor-pointer flex items-center gap-1"
            >
              <Zap className="w-4 h-4" />
              强制指定执行者（绕过 Agent B 智能路由）
            </label>
          </div>
          
          {enableForcedExecutor && (
            <div className="space-y-3 pl-6">
              <div>
                <label className="text-xs font-medium text-amber-800 mb-1 block">
                  选择执行 Agent
                </label>
                <Select value={forcedExecutor} onValueChange={setForcedExecutor}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="请选择执行者" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent T">Agent T（技术专家 - MCP 工具调用）</SelectItem>
                    <SelectItem value="insurance-d">insurance-d（内容创作 - 文章撰写修改）</SelectItem>
                    <SelectItem value="insurance-c">insurance-c（运营专家 - 策略分析）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-amber-700">
                ⚠️ 强制指定后，系统将忽略 Agent B 的路由建议，直接使用您选择的执行者。
                通常用于：测试特定执行者、调试问题、或 Agent B 判断错误时。
              </p>
            </div>
          )}
        </div>

        {/* 备注输入 */}
        <div className="mt-4">
          <label className="font-medium text-sm text-gray-900">备注（可选）</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="请输入备注信息..."
            rows={2}
            className="mt-1"
          />
        </div>

        <DialogFooter className="mt-4 flex-row justify-start">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                提交中...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                提交
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
