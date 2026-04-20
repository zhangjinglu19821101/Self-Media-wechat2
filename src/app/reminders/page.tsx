'use client';

/**
 * 提醒中心页面 - 双视角设计
 * 
 * 核心概念：谁要求谁做什么事情
 * 
 * 两个视角：
 * 1. 我要求别人的（出向）- 我 → 要求 [某人] → 做某事
 * 2. 别人要求我的（入向）- [某人] → 要求 我 → 做某事
 * 
 * 检索维度：
 * - 按人名快速筛选
 * - 按状态筛选（待完成/已逾期/已完成）
 * - 按内容关键词搜索
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  RefreshCw,
  Edit2,
  Search,
  User,
  Bell,
  BellOff,
  Users,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api/client';
import type { RepeatMode, Direction } from '@/lib/db/schema/reminders';

// ================================================================
// 类型定义
// ================================================================

interface Reminder {
  id: string;
  requesterName: string;
  assigneeName: string;
  content: string;
  direction: Direction;
  remindAt: string;
  remindedAt: string | null;
  status: 'pending' | 'triggered' | 'completed';
  repeatMode: RepeatMode;
  notifyMethods: string[];
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

interface PersonSummary {
  name: string;
  outboundCount: number;
  inboundCount: number;
  overdueCount: number;
}

interface Stats {
  outbound: { pending: number; overdue: number; completed: number };
  inbound: { pending: number; overdue: number; completed: number };
  total: { pending: number; triggered: number; completed: number; overdue: number };
}

// ================================================================
// 主组件
// ================================================================

export default function RemindersPage() {
  const [groups, setGroups] = useState<ReminderGroup[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [persons, setPersons] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // 视角：outbound(我要求别人) / inbound(别人要求我)
  const [activeDirection, setActiveDirection] = useState<Direction>('outbound');

  // 检索条件
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterPerson, setFilterPerson] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('pending');

  // 对话框
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  // 创建表单
  const [formRequesterName, setFormRequesterName] = useState('');
  const [formAssigneeName, setFormAssigneeName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formRemindAt, setFormRemindAt] = useState('');
  const [formRepeatMode, setFormRepeatMode] = useState<RepeatMode>('once');
  const [formDirection, setFormDirection] = useState<Direction>('outbound');

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dirParam = activeDirection || '';
      const [groupsRes, statsRes, personsRes] = await Promise.all([
        apiGet<{ success: boolean; data: ReminderGroup[] }>(`/api/reminders?mode=grouped&direction=${dirParam}`),
        apiGet<{ success: boolean; data: Stats }>('/api/reminders?mode=stats'),
        apiGet<{ success: boolean; data: PersonSummary[] }>('/api/reminders?mode=persons'),
      ]);

      if (groupsRes.success) setGroups(groupsRes.data);
      if (statsRes.success) setStats(statsRes.data);
      if (personsRes.success) setPersons(personsRes.data);
    } catch (error) {
      console.error('加载提醒失败:', error);
    } finally {
      setLoading(false);
    }
  }, [activeDirection]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 搜索
  const handleSearch = async () => {
    if (!searchKeyword && !filterPerson && filterStatus === 'pending') {
      loadData();
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ mode: 'list' });
      if (activeDirection) params.set('direction', activeDirection);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (searchKeyword) params.set('keyword', searchKeyword);
      if (filterPerson) params.set('personName', filterPerson);

      const res = await apiGet<{ success: boolean; data: Reminder[]; total: number }>(
        `/api/reminders?${params.toString()}`
      );
      if (res.success) {
        // 搜索结果包装成一个组
        setGroups(res.data.length > 0
          ? [{ label: '搜索结果', key: 'search', reminders: res.data, isOverdue: false }]
          : []
        );
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 创建提醒
  const handleCreate = async () => {
    if (!formRequesterName.trim() || !formAssigneeName.trim() || !formContent.trim() || !formRemindAt) {
      return;
    }

    try {
      const res = await apiPost<{ success: boolean; data: Reminder }>('/api/reminders', {
        requesterName: formRequesterName,
        assigneeName: formAssigneeName,
        content: formContent,
        direction: formDirection,
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
    if (!editingReminder || !formContent.trim() || !formRemindAt) return;

    try {
      const res = await apiPut<{ success: boolean; data: Reminder }>(
        `/api/reminders/${editingReminder.id}`,
        {
          requesterName: formRequesterName,
          assigneeName: formAssigneeName,
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
      if (res.success) loadData();
    } catch (error) {
      console.error('完成提醒失败:', error);
    }
  };

  // 删除提醒
  const handleDelete = async (id: string) => {
    try {
      const res = await apiDelete<{ success: boolean }>(`/api/reminders/${id}`);
      if (res.success) loadData();
    } catch (error) {
      console.error('删除提醒失败:', error);
    }
  };

  // 打开编辑对话框
  const openEditDialog = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setFormRequesterName(reminder.requesterName);
    setFormAssigneeName(reminder.assigneeName);
    setFormContent(reminder.content);
    setFormRemindAt(new Date(reminder.remindAt).toISOString().slice(0, 16));
    setFormRepeatMode(reminder.repeatMode);
    setFormDirection(reminder.direction);
    setEditDialogOpen(true);
  };

  // 打开创建对话框（预填方向）
  const openCreateDialog = (direction: Direction) => {
    resetForm();
    setFormDirection(direction);
    setCreateDialogOpen(true);
  };

  // 重置表单
  const resetForm = () => {
    setFormRequesterName('');
    setFormAssigneeName('');
    setFormContent('');
    setFormRemindAt('');
    setFormRepeatMode('once');
    setFormDirection('outbound');
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

    if (isToday) return `今天 ${timeStr}`;
    if (isTomorrow) return `明天 ${timeStr}`;
    return `${date.getMonth() + 1}/${date.getDate()} ${timeStr}`;
  };

  // 渲染人物头像
  const renderAvatar = (name: string, size: 'sm' | 'md' = 'sm') => {
    const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-green-100 text-green-700',
      'bg-purple-100 text-purple-700',
      'bg-orange-100 text-orange-700',
      'bg-pink-100 text-pink-700',
      'bg-teal-100 text-teal-700',
    ];
    const colorIndex = name.charCodeAt(0) % colors.length;

    return (
      <div className={`${sizeClass} rounded-full flex items-center justify-center font-medium ${colors[colorIndex]}`}>
        {name.charAt(0)}
      </div>
    );
  };

  // 渲染重复标签
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

  // 渲染方向箭头
  const renderDirectionArrow = (direction: Direction) => {
    if (direction === 'outbound') {
      return <ArrowRight className="w-4 h-4 text-blue-500" />;
    }
    return <ArrowLeft className="w-4 h-4 text-orange-500" />;
  };

  // ================== 渲染 ==================

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            提醒中心
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            谁要求谁做什么事情
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新
          </Button>
          <Button size="sm" onClick={() => openCreateDialog('outbound')}>
            <Plus className="w-4 h-4 mr-1" />
            我要求别人
          </Button>
          <Button size="sm" variant="outline" onClick={() => openCreateDialog('inbound')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            别人要求我
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* 出向统计：我要求别人 */}
          <Card className="border-blue-100">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-blue-500" />
                我要求别人
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-xl font-bold">{stats.outbound.pending}</div>
                  <div className="text-xs text-muted-foreground">待完成</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-500">{stats.outbound.overdue}</div>
                  <div className="text-xs text-muted-foreground">已逾期</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-500">{stats.outbound.completed}</div>
                  <div className="text-xs text-muted-foreground">已完成</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 入向统计：别人要求我 */}
          <Card className="border-orange-100">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 text-orange-500" />
                别人要求我
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-xl font-bold">{stats.inbound.pending}</div>
                  <div className="text-xs text-muted-foreground">待完成</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-500">{stats.inbound.overdue}</div>
                  <div className="text-xs text-muted-foreground">已逾期</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-500">{stats.inbound.completed}</div>
                  <div className="text-xs text-muted-foreground">已完成</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 人物快捷筛选 */}
      {persons.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              相关人员
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {persons.map((person) => (
                <button
                  key={person.name}
                  onClick={() => {
                    setFilterPerson(filterPerson === person.name ? '' : person.name);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    filterPerson === person.name
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {renderAvatar(person.name)}
                  <span className="font-medium">{person.name}</span>
                  {person.overdueCount > 0 && (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0">
                      {person.overdueCount}逾期
                    </Badge>
                  )}
                  {person.outboundCount > 0 && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0 text-blue-600">
                      我→{person.outboundCount}
                    </Badge>
                  )}
                  {person.inboundCount > 0 && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0 text-orange-600">
                      {person.inboundCount}→我
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 搜索栏 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索提醒内容..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待完成</SelectItem>
            <SelectItem value="triggered">已到期</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleSearch}>
          <Search className="w-4 h-4" />
        </Button>
        {(searchKeyword || filterPerson || filterStatus !== 'pending') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchKeyword('');
              setFilterPerson('');
              setFilterStatus('pending');
              loadData();
            }}
          >
            重置
          </Button>
        )}
      </div>

      {/* 双视角 Tab */}
      <Tabs value={activeDirection} onValueChange={(v) => setActiveDirection(v as Direction)}>
        <TabsList className="mb-4">
          <TabsTrigger value="outbound" className="flex items-center gap-1.5">
            <ArrowRight className="w-4 h-4" />
            我要求别人
            {stats && stats.outbound.overdue > 0 && (
              <Badge variant="destructive" className="text-xs ml-1 px-1.5 py-0">
                {stats.outbound.overdue}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inbound" className="flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            别人要求我
            {stats && stats.inbound.overdue > 0 && (
              <Badge variant="destructive" className="text-xs ml-1 px-1.5 py-0">
                {stats.inbound.overdue}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeDirection}>
          {/* 提醒列表 */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">加载中...</div>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BellOff className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  {activeDirection === 'outbound' ? '暂无你要求别人的事项' : '暂无别人要求你的事项'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-520px)]">
              <div className="space-y-4">
                {groups.map((group) => (
                  <Card key={group.key} className={group.isOverdue ? 'border-red-200 bg-red-50/30' : ''}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {group.isOverdue ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                        )}
                        {group.label}
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {group.reminders.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-0">
                      <div className="space-y-2 pb-3">
                        {group.reminders.map((reminder) => (
                          <div
                            key={reminder.id}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                          >
                            {/* 人名区域 */}
                            <div className="flex items-center gap-2 shrink-0">
                              {activeDirection === 'outbound' ? (
                                <>
                                  {renderAvatar(reminder.assigneeName)}
                                  <div className="text-sm">
                                    <div className="font-medium text-blue-700">{reminder.assigneeName}</div>
                                    <div className="text-xs text-muted-foreground">我去要求</div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {renderAvatar(reminder.requesterName)}
                                  <div className="text-sm">
                                    <div className="font-medium text-orange-700">{reminder.requesterName}</div>
                                    <div className="text-xs text-muted-foreground">要求我</div>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* 箭头 + 内容 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {renderDirectionArrow(reminder.direction)}
                                <span className="font-medium truncate">{reminder.content}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span>{formatTime(reminder.remindAt)}</span>
                                {renderRepeatBadge(reminder.repeatMode)}
                              </div>
                            </div>

                            {/* 操作按钮 */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => openEditDialog(reminder)} title="编辑">
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600"
                                onClick={() => handleComplete(reminder.id)} title="完成">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600"
                                onClick={() => handleDelete(reminder.id)} title="删除">
                                <Trash2 className="w-3.5 h-3.5" />
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
        </TabsContent>
      </Tabs>

      {/* 创建对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formDirection === 'outbound' ? '我要求别人做某事' : '别人要求我做某事'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 方向提示 */}
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              formDirection === 'outbound' ? 'bg-blue-50 border border-blue-100' : 'bg-orange-50 border border-orange-100'
            }`}>
              {formDirection === 'outbound' ? (
                <>
                  <User className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-blue-700">我</span>
                  <ArrowRight className="w-4 h-4 text-blue-400" />
                  <Input
                    placeholder="对方姓名"
                    value={formAssigneeName}
                    onChange={(e) => setFormAssigneeName(e.target.value)}
                    className="h-7 text-sm border-blue-200"
                  />
                </>
              ) : (
                <>
                  <Input
                    placeholder="对方姓名"
                    value={formRequesterName}
                    onChange={(e) => setFormRequesterName(e.target.value)}
                    className="h-7 text-sm border-orange-200"
                  />
                  <ArrowRight className="w-4 h-4 text-orange-400" />
                  <User className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-orange-700">我</span>
                </>
              )}
            </div>

            {/* 做什么事情 */}
            <div>
              <label className="text-sm font-medium">做什么事情</label>
              <Textarea
                placeholder="描述要做的事情..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>

            {/* 截止时间 */}
            <div>
              <label className="text-sm font-medium">截止时间</label>
              <Input
                type="datetime-local"
                value={formRemindAt}
                onChange={(e) => setFormRemindAt(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* 重复模式 */}
            <div>
              <label className="text-sm font-medium">重复</label>
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
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑提醒</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="要求者"
                value={formRequesterName}
                onChange={(e) => setFormRequesterName(e.target.value)}
                className="flex-1"
              />
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="被要求者"
                value={formAssigneeName}
                onChange={(e) => setFormAssigneeName(e.target.value)}
                className="flex-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">做什么事情</label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium">截止时间</label>
              <Input
                type="datetime-local"
                value={formRemindAt}
                onChange={(e) => setFormRemindAt(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">重复</label>
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
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
