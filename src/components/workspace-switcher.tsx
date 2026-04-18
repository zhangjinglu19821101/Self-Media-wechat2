'use client';

/**
 * Workspace 切换器组件
 * 
 * 显示在导航栏左侧，让用户快速切换工作空间
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, User, ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { setCurrentWorkspaceId, getCurrentWorkspaceId } from '@/lib/api/client';

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  type: string;
  role: string;
}

export function WorkspaceSwitcher() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setWorkspaces(data.data);
          // 从 client 工具恢复或使用第一个
          const savedId = getCurrentWorkspaceId();
          if (savedId && data.data.some((ws: WorkspaceInfo) => ws.id === savedId)) {
            setCurrentId(savedId);
          } else if (data.data.length > 0) {
            setCurrentId(data.data[0].id);
            setCurrentWorkspaceId(data.data[0].id);
          }
        }
      }
    } catch (err) {
      console.error('[WorkspaceSwitcher] loadWorkspaces error:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectWorkspace = useCallback((ws: WorkspaceInfo) => {
    setCurrentId(ws.id);
    setCurrentWorkspaceId(ws.id);
    setOpen(false);
    router.refresh();
  }, [router]);

  const currentWorkspace = workspaces.find(ws => ws.id === currentId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-2">
          {loading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Building2 className="w-4 h-4" />
          )}
          <span className="text-sm font-medium truncate max-w-[150px]">
            {currentWorkspace?.name || '工作空间'}
          </span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => selectWorkspace(ws)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left ${
                currentId === ws.id
                  ? 'bg-slate-100 font-medium'
                  : 'hover:bg-slate-50'
              }`}
            >
              <User className="w-4 h-4 text-slate-400" />
              <span className="flex-1 text-left truncate">{ws.name}</span>
              {ws.type === 'enterprise' && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {ws.role === 'owner' ? '所有者' : ws.role === 'admin' ? '管理员' : ws.role === 'editor' ? '编辑' : '查看'}
                </Badge>
              )}
            </button>
          ))}
          <Separator className="my-1" />
          <button
            onClick={() => { router.push('/settings/team'); setOpen(false); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-slate-500 hover:bg-slate-100"
          >
            <Plus className="w-4 h-4" />
            创建或加入工作空间
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
