'use client';

/**
 * 提醒中心页面
 * 
 * 功能：
 * - 分组展示提醒（今天/明天/本周/更晚/逾期）
 * - 创建新提醒（支持自然语言时间解析）
 * - 编辑、删除、完成提醒
 * - 支持重复提醒（每日/每周/每月）
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  BellOff,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  RefreshCw,
  Edit2,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api/client';
import type { RepeatMode, NotifyMethod } from '@/lib/db/schema/reminders';

// ================================================================
// 类型定义
// ================================================================

interface Reminder {
  id: string;
  content: string;
  remindAt: string;
  remindedAt: string | null;
  status: 'pending' | 'triggered' | 'completed';
  repeatMode: RepeatMode;
  notifyMethods: NotifyMethod[];
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

interface ReminderGroup {
  label: string;
  key: string;
  reminders: Reminder[];
  isOverdue: boolean;
}

interface ReminderStats {
  pending: number;
  triggered: number;
  completed: number;
  overdue: number;
}

// ================================================================
// 主组件
// ================================================================

export default function RemindersPage() {
  const [groups, setGroups] = useState<ReminderGroup[]>([]);
  const [stats, setStats] = useState<ReminderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  // 表单状态
  const [formContent, setFormContent] = useState('');
  const [formRemindAt, setFormRemindAt] = useState('');
  const [formRepeatMode, setFormRepeatMode] = useState<RepeatMode>('once');

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsRes, statsRes] = await Promise.all([
        apiGet<{ success: boolean; data: ReminderGroup[] }>('/api/reminders?mode=grouped'),
        apiGet<{ success: boolean; data: ReminderStats }>('/api/reminders?mode=stats'),
      ]);

      if (groupsRes.success) setGroups(groupsRes.data);
      if (statsRes.success) setStats(statsRes.data);
    } catch (error) {
      console.error('加载提醒失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 创建提醒
  const handleCreate = async () => {
    if (!formContent.trim() || !formRemindAt) {
      return;
    }

    try {
      const res = await apiPost<{ success: boolean; data: Reminder }>('/api/reminders', {
        content: formContent,
        remindAt: new Date(formRemindAt).toISOString(),
        repeatMode: formRepeatMode,
        notifyMethods: ['browser', 'popup'],
      });

      if (res.success) {
        setCreateDialogOpen(false);
        resetForm();
        loadData();
      }
    } catch (error) {
      console.error('创建提醒失败:', error);
    }
  };

  // 编辑提醒
  const handleEdit = async () => {
    if (!editingReminder || !formContent.trim() || !formRemindAt) {
      return;
    }

    try {
      const res = await apiPut<{ success: boolean; data: Reminder }>(
        `/api/reminders/${editingReminder.id}`,
        {
          content: formContent,
          remindAt: new Date(formRemindAt).toISOString(),
          repeatMode: formRepeatMode,
        }
      );

      if (res.success) {
        setEditDialogOpen(false);
        setEditingReminder(null);
        resetForm();
        loadData();
      }
    } catch (error) {
      console.error('更新提醒失败:', error);
    }
  };

  // 完成提醒
  const handleComplete = async (id: string) => {
    try {
      const res = await apiPost<{ success: boolean; message: string }>(
        `/api/reminders/${id}/complete`
      );

      if (res.success) {
        loadData();
      }
    } catch (error) {
      console.error('完成提醒失败:', error);
    }
  };

  // 删除提醒
  const handleDelete = async (id: string) => {
    try {
      const res = await apiDelete<{ success: boolean }>(`/api/reminders/${id}`);

      if (res.success) {
        loadData();
      }
    } catch (error) {
      console.error('删除提醒失败:', error);
    }
  };

  // 打开编辑对话框
  const openEditDialog = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setFormContent(reminder.content);
    setFormRemindAt(new Date(reminder.remindAt).toISOString().slice(0, 16));
    setFormRepeatMode(reminder.repeatMode);
    setEditDialogOpen(true);
  };

  // 重置表单
  const resetForm = () => {
    setFormContent('');
    setFormRemindAt('');
    setFormRepeatMode('once');
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === date.toDateString();

    if (isToday) {
      return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (isTomorrow) {
      return `明天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else {
      return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
  };

  // 渲染重复模式标签
  const renderRepeatBadge = (mode: RepeatMode) => {
    if (mode === 'once') return null;
    const labels = { daily: '每日', weekly: '每周', monthly: '每月' };
    return (
      <Badge variant="outline" className="text-xs">
        <RefreshCw className="w-3 h-3 mr-1" />
        {labels[mode]}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            提醒中心
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            管理你的所有提醒事项
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新
          </Button>

          {/* 创建提醒按钮 */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" />
                新建提醒
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建提醒</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium">提醒内容</label>
                  <Textarea
                    placeholder="输入提醒内容..."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">提醒时间</label>
                  <Input
                    type="datetime-local"
                    value={formRemindAt}
                    onChange={(e) => setFormRemindAt(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">重复模式</label>
                  <Select value={formRepeatMode} onValueChange={(v) => setFormRepeatMode(v as RepeatMode)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">仅一次</SelectItem>
                      <SelectItem value="daily">每天</SelectItem>
                      <SelectItem value="weekly">每周</SelectItem>
                      <SelectItem value="monthly">每月</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreate}>创建</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.pending}</div>
              <div className="text-xs text-muted-foreground">待处理</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-500">{stats.overdue}</div>
              <div className="text-xs text-muted-foreground">已逾期</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-500">{stats.triggered}</div>
              <div className="text-xs text-muted-foreground">已触发</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
              <div className="text-xs text-muted-foreground">已完成</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 提醒列表 */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BellOff className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">暂无提醒事项</p>
            <p className="text-sm text-muted-foreground mt-1">点击右上角"新建提醒"创建你的第一个提醒</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="space-y-6">
            {groups.map((group) => (
              <Card key={group.key} className={group.isOverdue ? 'border-red-200 bg-red-50/50' : ''}>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {group.isOverdue ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    )}
                    {group.label}
                    <Badge variant="secondary" className="ml-auto">
                      {group.reminders.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-0">
                  <div className="space-y-2">
                    {group.reminders.map((reminder) => (
                      <div
                        key={reminder.id}
                        className="flex items-start justify-between p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{reminder.content}</div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>{formatTime(reminder.remindAt)}</span>
                            {renderRepeatBadge(reminder.repeatMode)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(reminder)}
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleComplete(reminder.id)}
                            className="text-green-600 hover:text-green-700"
                            title="完成"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(reminder.id)}
                            className="text-red-600 hover:text-red-700"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑提醒</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">提醒内容</label>
              <Textarea
                placeholder="输入提醒内容..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">提醒时间</label>
              <Input
                type="datetime-local"
                value={formRemindAt}
                onChange={(e) => setFormRemindAt(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">重复模式</label>
              <Select value={formRepeatMode} onValueChange={(v) => setFormRepeatMode(v as RepeatMode)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">仅一次</SelectItem>
                  <SelectItem value="daily">每天</SelectItem>
                  <SelectItem value="weekly">每周</SelectItem>
                  <SelectItem value="每月">每月</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
