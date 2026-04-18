'use client';

/**
 * 团队管理页面
 * 
 * 管理工作空间成员、邀请/移除/角色变更
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UserPlus, Trash2, Shield, Loader2, Users, Building2 } from 'lucide-react';
import { getRoleLabel, WorkspaceRole } from '@/lib/auth/roles';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { getCurrentWorkspaceId } from '@/lib/api/client';

interface Member {
  id: string;
  accountId: string;
  role: string;
  status: string;
  joinedAt: string;
  accountName: string;
  accountEmail: string;
  accountAvatar: string | null;
}

export default function TeamManagementPage() {
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);
  const [ownerId, setOwnerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    const id = getCurrentWorkspaceId();
    if (id) {
      setWorkspaceId(id);
      loadMembers(id);
    }
  }, []);

  const loadMembers = async (wsId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${wsId}/members`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMembers(data.data?.members || []);
          setOwnerId(data.data?.ownerId || '');
        }
      }
    } catch (err) {
      console.error('[TeamManagement] 加载成员失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !workspaceId) return;
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteOpen(false);
        setInviteEmail('');
        loadMembers(workspaceId);
      } else {
        alert(data.error || '邀请失败');
      }
    } catch (err) {
      alert('邀请失败');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (accountId: string) => {
    if (!confirm('确定要移除该成员吗？')) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members?accountId=${accountId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        loadMembers(workspaceId);
      } else {
        alert(data.error || '移除失败');
      }
    } catch (err) {
      alert('移除失败');
    }
  };

  const handleChangeRole = async (accountId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, newRole }),
      });
      const data = await res.json();
      if (data.success) {
        loadMembers(workspaceId);
      } else {
        alert(data.error || '变更失败');
      }
    } catch (err) {
      alert('变更角色失败');
    }
  };

  const getRoleBadge = (role: string, isOwner: boolean) => {
    if (isOwner) {
      return <Badge className="bg-amber-100 text-amber-700">所有者</Badge>;
    }
    const colors: Record<string, string> = {
      admin: 'bg-blue-100 text-blue-700',
      editor: 'bg-green-100 text-green-700',
      viewer: 'bg-slate-100 text-slate-600',
    };
    return <Badge className={colors[role] || ''}>{getRoleLabel(role)}</Badge>;
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            团队管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">管理工作空间成员和权限</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              邀请成员
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>邀请成员</DialogTitle>
              <DialogDescription>输入成员的邮箱地址，选择角色后发送邀请</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>邮箱地址</Label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>角色</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理员 - 全部数据权限</SelectItem>
                    <SelectItem value="editor">编辑者 - 可创建和编辑</SelectItem>
                    <SelectItem value="viewer">查看者 - 只读</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleInvite} disabled={!inviteEmail || inviteLoading} className="w-full">
                {inviteLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                发送邀请
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 成员列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">成员列表</CardTitle>
            <CardDescription>{members.length} 位成员</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((member) => {
                const isOwner = member.accountId === ownerId;
                return (
                  <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                        {member.accountName?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.accountName}</p>
                        <p className="text-xs text-slate-400">{member.accountEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getRoleBadge(member.role, isOwner)}
                      {!isOwner && (
                        <div className="flex items-center gap-2">
                          <Select
                            value={member.role}
                            onValueChange={(role) => handleChangeRole(member.accountId, role)}
                          >
                            <SelectTrigger className="w-24 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">管理员</SelectItem>
                              <SelectItem value="editor">编辑者</SelectItem>
                              <SelectItem value="viewer">查看者</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleRemoveMember(member.accountId)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
