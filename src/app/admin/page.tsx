'use client';

/**
 * 超级管理员后台页面
 * 
 * 功能：
 * - 用户管理：查看所有用户、禁用/启用、重置密码、设置角色
 * - 机构管理：查看所有 Workspace
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Building2, Search, Shield, Ban, CheckCircle, Key, Unlock,
  ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api/client';

// ==================== 类型定义 ====================

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  workspaceCount: number;
  failedLoginAttempts: number;
  lockedUntil: string | null;
}

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  llmKeySource?: string;
  createdAt: string;
  memberCount: number;
  owner: { id: string; name: string; email: string } | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ==================== 主组件 ====================

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('users');

  // 用户管理状态
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userPagination, setUserPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [userSearch, setUserSearch] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [userLoading, setUserLoading] = useState(false);

  // 机构管理状态
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [wsPagination, setWsPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [wsSearch, setWsSearch] = useState('');
  const [wsType, setWsType] = useState('');
  const [wsStatus, setWsStatus] = useState('');
  const [wsLoading, setWsLoading] = useState(false);

  // 操作对话框
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: 'disable' | 'enable' | 'reset_password' | 'set_role' | 'unlock' | null;
    user: UserItem | null;
    newPassword?: string;
    newRole?: string;
  }>({ open: false, action: null, user: null });

  // 机构操作对话框
  const [wsActionDialog, setWsActionDialog] = useState<{
    open: boolean;
    action: 'disable' | 'enable' | 'set_key_source' | null;
    workspace: WorkspaceItem | null;
    keySource?: string; // set_key_source 时的新值
  }>({ open: false, action: null, workspace: null });

  // 权限检查
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // 通过调用 API 来检查权限
      const res = await apiGet<{ success: boolean; data: UserItem[] }>('/api/admin/accounts?page=1&pageSize=1');
      if (res.success) {
        setIsSuperAdmin(true);
        loadUsers(1);
      } else {
        setIsSuperAdmin(false);
        router.push('/login');
      }
    } catch (err: any) {
      if (err?.status === 403) {
        toast.error('需要超级管理员权限');
        router.push('/full-home');
      } else {
        toast.error('请先登录');
        router.push('/login');
      }
    } finally {
      setCheckingAuth(false);
    }
  };

  // ==================== 用户管理 ====================

  const loadUsers = useCallback(async (page?: number) => {
    setUserLoading(true);
    try {
      const p = page || userPagination.page;
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(userPagination.pageSize),
      });
      if (userSearch) params.set('search', userSearch);
      if (userStatus) params.set('status', userStatus);

      const res = await apiGet<{ success: boolean; data: UserItem[]; pagination: Pagination }>(
        `/api/admin/accounts?${params.toString()}`
      );
      
      if (res.success) {
        setUsers(res.data);
        setUserPagination(res.pagination);
      }
    } catch (err) {
      toast.error('加载用户列表失败');
    } finally {
      setUserLoading(false);
    }
  }, [userPagination.page, userPagination.pageSize, userSearch, userStatus]);

  // 搜索防抖：userSearch 变化后自动触发搜索
  useEffect(() => {
    if (!isSuperAdmin) return;
    const timer = setTimeout(() => {
      loadUsers(1); // 搜索时重置到第一页
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch]);

  useEffect(() => {
    if (isSuperAdmin) loadUsers();
  }, [isSuperAdmin, userPagination.page, userStatus]);

  // 二次确认输入状态
  const [confirmInput, setConfirmInput] = useState('');

  const handleUserAction = async () => {
    if (!actionDialog.action || !actionDialog.user) return;

    // 危险操作二次确认：检查输入的用户名是否匹配
    const dangerousActions = ['disable', 'reset_password', 'set_role'];
    if (dangerousActions.includes(actionDialog.action)) {
      if (confirmInput.trim() !== actionDialog.user.name) {
        toast.error('输入的用户名不匹配');
        return;
      }
    }

    try {
      const body: any = {
        action: actionDialog.action,
        accountId: actionDialog.user.id,
      };

      if (actionDialog.action === 'reset_password') {
        body.data = { password: actionDialog.newPassword };
      } else if (actionDialog.action === 'set_role') {
        body.data = { role: actionDialog.newRole };
      }

      const res = await apiPost<{ success: boolean; message: string; newPassword?: string }>(
        '/api/admin/accounts',
        body
      );

      if (res.success) {
        toast.success(res.message);
        if (res.newPassword) {
          toast.info(`新密码: ${res.newPassword}`, { duration: 10000 });
        }
        loadUsers();
      }
    } catch (err: any) {
      toast.error(err?.message || '操作失败');
    } finally {
      setActionDialog({ open: false, action: null, user: null });
      setConfirmInput('');
    }
  };

  // ==================== 机构管理 ====================

  const loadWorkspaces = useCallback(async (page?: number) => {
    setWsLoading(true);
    try {
      const p = page || wsPagination.page;
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(wsPagination.pageSize),
      });
      if (wsSearch) params.set('search', wsSearch);
      if (wsType) params.set('type', wsType);
      if (wsStatus) params.set('status', wsStatus);

      const res = await apiGet<{ success: boolean; data: WorkspaceItem[]; pagination: Pagination }>(
        `/api/admin/workspaces?${params.toString()}`
      );
      
      if (res.success) {
        setWorkspaces(res.data);
        setWsPagination(res.pagination);
      }
    } catch (err) {
      toast.error('加载机构列表失败');
    } finally {
      setWsLoading(false);
    }
  }, [wsPagination.page, wsPagination.pageSize, wsSearch, wsType, wsStatus]);

  useEffect(() => {
    if (isSuperAdmin && activeTab === 'workspaces') {
      loadWorkspaces();
    }
  }, [isSuperAdmin, activeTab, wsPagination.page, wsType, wsStatus]);

  // 机构操作
  const handleWorkspaceAction = async () => {
    if (!wsActionDialog.action || !wsActionDialog.workspace) return;

    try {
      const body: Record<string, string> = {
        action: wsActionDialog.action,
        workspaceId: wsActionDialog.workspace.id,
      };
      if (wsActionDialog.action === 'set_key_source' && wsActionDialog.keySource) {
        body.keySource = wsActionDialog.keySource;
      }

      const res = await apiPost<{ success: boolean; message: string }>(
        '/api/admin/workspaces',
        body
      );

      if (res.success) {
        toast.success(res.message);
        loadWorkspaces();
      }
    } catch (err) {
      toast.error('操作失败');
    } finally {
      setWsActionDialog({ open: false, action: null, workspace: null });
    }
  };

  // ==================== 渲染 ====================

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-red-500" />
          <h1 className="text-2xl font-bold">超级管理员后台</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              用户管理
            </TabsTrigger>
            <TabsTrigger value="workspaces" className="gap-2">
              <Building2 className="w-4 h-4" />
              机构管理
            </TabsTrigger>
          </TabsList>

          {/* 用户管理 */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>用户列表</CardTitle>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="搜索邮箱/姓名"
                      value={userSearch}
                      onChange={(e) => { setUserSearch(e.target.value); setUserPagination(p => ({ ...p, page: 1 })); }}
                      className="w-48"
                    />
                    <Select value={userStatus || "all"} onValueChange={(v) => { setUserStatus(v === "all" ? "" : v); setUserPagination(p => ({ ...p, page: 1 })); }}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="active">正常</SelectItem>
                        <SelectItem value="disabled">已禁用</SelectItem>
                        <SelectItem value="suspended">已暂停</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => loadUsers()}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {userLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>用户</TableHead>
                          <TableHead>角色</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>锁定</TableHead>
                          <TableHead>工作空间</TableHead>
                          <TableHead>最后登录</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => {
                          const isLocked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
                          return (
                            <TableRow key={user.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{user.name}</div>
                                  <div className="text-sm text-muted-foreground">{user.email}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={user.role === 'super_admin' ? 'destructive' : 'secondary'}>
                                  {user.role === 'super_admin' ? '超管' : '普通'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                                  {user.status === 'active' ? '正常' : user.status === 'disabled' ? '已禁用' : '已暂停'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {isLocked ? (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="destructive" className="gap-1">
                                      <AlertTriangle className="w-3 h-3" />
                                      已锁定
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      ({user.failedLoginAttempts}次)
                                    </span>
                                  </div>
                                ) : user.failedLoginAttempts > 0 ? (
                                  <span className="text-xs text-muted-foreground">
                                    失败 {user.failedLoginAttempts} 次
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>{user.workspaceCount}</TableCell>
                              <TableCell>
                                {user.lastLoginAt
                                  ? new Date(user.lastLoginAt).toLocaleString('zh-CN')
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {/* 解锁按钮 - 仅当用户被锁定时显示 */}
                                  {isLocked && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setActionDialog({ open: true, action: 'unlock', user })}
                                      title="解锁账号"
                                    >
                                      <Unlock className="w-4 h-4 text-amber-500" />
                                    </Button>
                                  )}
                                  {user.status === 'active' ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setActionDialog({ open: true, action: 'disable', user })}
                                      title="禁用"
                                    >
                                      <Ban className="w-4 h-4 text-red-500" />
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setActionDialog({ open: true, action: 'enable', user })}
                                      title="启用"
                                    >
                                      <CheckCircle className="w-4 h-4 text-green-500" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setActionDialog({ open: true, action: 'reset_password', user, newPassword: '' })}
                                    title="重置密码"
                                  >
                                    <Key className="w-4 h-4 text-orange-500" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setActionDialog({
                                      open: true,
                                      action: 'set_role',
                                      user,
                                      newRole: user.role === 'super_admin' ? 'normal' : 'super_admin',
                                    })}
                                    title={user.role === 'super_admin' ? '取消超管' : '设为超管'}
                                  >
                                    <Shield className={`w-4 h-4 ${user.role === 'super_admin' ? 'text-slate-400' : 'text-blue-500'}`} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    {/* 分页 */}
                    {userPagination.totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                          共 {userPagination.total} 条
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={userPagination.page <= 1}
                            onClick={() => setUserPagination(p => ({ ...p, page: p.page - 1 }))}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-sm">
                            {userPagination.page} / {userPagination.totalPages}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={userPagination.page >= userPagination.totalPages}
                            onClick={() => setUserPagination(p => ({ ...p, page: p.page + 1 }))}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 机构管理 */}
          <TabsContent value="workspaces">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>机构列表</CardTitle>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="搜索机构名称"
                      value={wsSearch}
                      onChange={(e) => { setWsSearch(e.target.value); setWsPagination(p => ({ ...p, page: 1 })); }}
                      className="w-48"
                    />
                    <Select value={wsStatus || "all"} onValueChange={(v) => { setWsStatus(v === "all" ? "" : v); setWsPagination(p => ({ ...p, page: 1 })); }}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="active">正常</SelectItem>
                        <SelectItem value="disabled">已禁用</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={wsType || "all"} onValueChange={(v) => { setWsType(v === "all" ? "" : v); setWsPagination(p => ({ ...p, page: 1 })); }}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="personal">个人</SelectItem>
                        <SelectItem value="enterprise">企业</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => loadWorkspaces()}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {wsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>机构名称</TableHead>
                          <TableHead>类型</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>Key来源</TableHead>
                          <TableHead>成员数</TableHead>
                          <TableHead>所有者</TableHead>
                          <TableHead>创建时间</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workspaces.map((ws) => (
                          <TableRow key={ws.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{ws.name}</div>
                                <div className="text-sm text-muted-foreground">{ws.slug}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={ws.type === 'enterprise' ? 'default' : 'secondary'}>
                                {ws.type === 'enterprise' ? '企业' : '个人'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={ws.status === 'active' ? 'default' : 'destructive'}>
                                {ws.status === 'active' ? '正常' : '已禁用'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant={ws.llmKeySource === 'user_key' ? 'secondary' : 'outline'}>
                                  {ws.llmKeySource === 'user_key' ? '自有Key' : '平台积分'}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1"
                                  onClick={() => {
                                    const newSource = ws.llmKeySource === 'user_key' ? 'platform_credits' : 'user_key';
                                    setWsActionDialog({
                                      open: true,
                                      action: 'set_key_source',
                                      workspace: ws,
                                      keySource: newSource,
                                    });
                                  }}
                                  title="切换Key来源"
                                >
                                  <Key className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>{ws.memberCount}</TableCell>
                            <TableCell>
                              {ws.owner ? (
                                <div>
                                  <div className="font-medium">{ws.owner.name}</div>
                                  <div className="text-sm text-muted-foreground">{ws.owner.email}</div>
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {new Date(ws.createdAt).toLocaleString('zh-CN')}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {ws.status === 'active' ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setWsActionDialog({ open: true, action: 'disable', workspace: ws })}
                                    title="禁用"
                                  >
                                    <Ban className="w-4 h-4 text-red-500" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setWsActionDialog({ open: true, action: 'enable', workspace: ws })}
                                    title="启用"
                                  >
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* 分页 */}
                    {wsPagination.totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                          共 {wsPagination.total} 条
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={wsPagination.page <= 1}
                            onClick={() => setWsPagination(p => ({ ...p, page: p.page - 1 }))}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-sm">
                            {wsPagination.page} / {wsPagination.totalPages}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={wsPagination.page >= wsPagination.totalPages}
                            onClick={() => setWsPagination(p => ({ ...p, page: p.page + 1 }))}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 操作确认对话框 */}
        <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog(prev => ({ ...prev, open }))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionDialog.action === 'disable' && '禁用账号'}
                {actionDialog.action === 'enable' && '启用账号'}
                {actionDialog.action === 'unlock' && '解锁账号'}
                {actionDialog.action === 'reset_password' && '重置密码'}
                {actionDialog.action === 'set_role' && '设置角色'}
              </DialogTitle>
            </DialogHeader>
            
            {actionDialog.user && (
              <div className="py-4">
                <p className="text-sm text-muted-foreground mb-2">
                  用户：{actionDialog.user.name} ({actionDialog.user.email})
                </p>

                {actionDialog.action === 'disable' && (
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertTriangle className="w-4 h-4" />
                    <span>禁用后该用户将无法登录系统</span>
                  </div>
                )}

                {actionDialog.action === 'enable' && (
                  <p>该用户将恢复正常使用权限</p>
                )}

                {actionDialog.action === 'unlock' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-600">
                      <Unlock className="w-4 h-4" />
                      <span>将清除登录失败记录并解除账号锁定</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      当前失败次数：{actionDialog.user.failedLoginAttempts} 次
                    </p>
                  </div>
                )}

                {actionDialog.action === 'reset_password' && (
                  <div className="space-y-2">
                    <Input
                      placeholder="留空则自动生成随机密码"
                      value={actionDialog.newPassword || ''}
                      onChange={(e) => setActionDialog(prev => ({ ...prev, newPassword: e.target.value }))}
                    />
                    <p className="text-sm text-muted-foreground">新密码将显示一次，请妥善保存</p>
                  </div>
                )}

                {actionDialog.action === 'set_role' && (
                  <p>
                    {actionDialog.newRole === 'super_admin'
                      ? '将设置为超级管理员，拥有所有权限'
                      : '将取消超级管理员权限，恢复为普通用户'}
                  </p>
                )}

                {/* 危险操作二次确认：输入用户名 */}
                {['disable', 'reset_password', 'set_role'].includes(actionDialog.action || '') && actionDialog.user && (
                  <div className="mt-4 pt-4 border-t">
                    <Label className="text-sm font-medium text-red-600">
                      请输入用户名 "{actionDialog.user.name}" 以确认操作：
                    </Label>
                    <Input
                      value={confirmInput}
                      onChange={(e) => setConfirmInput(e.target.value)}
                      placeholder={`请输入：${actionDialog.user.name}`}
                      className="mt-2"
                    />
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setActionDialog({ open: false, action: null, user: null }); setConfirmInput(''); }}>
                取消
              </Button>
              <Button 
                onClick={handleUserAction}
                disabled={
                  ['disable', 'reset_password', 'set_role'].includes(actionDialog.action || '') 
                  && actionDialog.user 
                  && confirmInput.trim() !== actionDialog.user.name
                }
              >
                确认
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 机构操作确认对话框 */}
        <Dialog open={wsActionDialog.open} onOpenChange={(open) => setWsActionDialog(prev => ({ ...prev, open }))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {wsActionDialog.action === 'disable' && '禁用机构'}
                {wsActionDialog.action === 'enable' && '启用机构'}
                {wsActionDialog.action === 'set_key_source' && '切换 Key 来源'}
              </DialogTitle>
            </DialogHeader>
            
            {wsActionDialog.workspace && (
              <div className="py-4">
                <p className="text-sm text-muted-foreground mb-2">
                  机构：{wsActionDialog.workspace.name}
                </p>

                {wsActionDialog.action === 'disable' && (
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertTriangle className="w-4 h-4" />
                    <span>禁用后该机构下所有成员将无法访问</span>
                  </div>
                )}

                {wsActionDialog.action === 'enable' && (
                  <p>该机构将恢复正常使用</p>
                )}

                {wsActionDialog.action === 'set_key_source' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 text-amber-800">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span className="text-sm">
                        {wsActionDialog.keySource === 'user_key'
                          ? '切换后，该机构下所有 LLM 调用将使用用户自有 API Key，费用由用户承担。用户需在设置页配置豆包 API Key，未配置将无法使用 AI 功能。'
                          : '切换后，该机构下所有 LLM 调用将使用平台积分，费用由平台承担。'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">当前：</span>
                      <Badge variant={wsActionDialog.workspace.llmKeySource === 'user_key' ? 'secondary' : 'outline'}>
                        {wsActionDialog.workspace.llmKeySource === 'user_key' ? '自有Key' : '平台积分'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">切换为：</span>
                      <Badge variant={wsActionDialog.keySource === 'user_key' ? 'secondary' : 'outline'}>
                        {wsActionDialog.keySource === 'user_key' ? '自有Key' : '平台积分'}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setWsActionDialog({ open: false, action: null, workspace: null })}>
                取消
              </Button>
              <Button
                variant={wsActionDialog.action === 'disable' ? 'destructive' : 'default'}
                onClick={handleWorkspaceAction}
              >
                确认
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
