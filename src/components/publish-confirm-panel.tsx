'use client';

/**
 * 发布确认面板组件
 * 
 * 在任务完成后弹出，让用户选择发布平台、预览内容、设置定时
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Send, ExternalLink } from 'lucide-react';
import { PLATFORM_OPTIONS, PLATFORM_LABELS } from '@/lib/db/schema/style-template';
import { getCurrentWorkspaceId } from '@/lib/api/client';

interface PlatformAccount {
  id: string;
  platform: string;
  accountName: string;
  templateId?: string;
  templateName?: string;
}

interface PublishConfirmPanelProps {
  subTaskId: string;
  taskResult: any;
  currentAccountId?: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function PublishConfirmPanel({
  subTaskId,
  taskResult,
  currentAccountId,
  onComplete,
  onCancel,
}: PublishConfirmPanelProps) {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Map<string, string>>(new Map());
  const [scheduleType, setScheduleType] = useState<'now' | 'scheduled'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<any>(null);

  // 加载平台账号
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const wsId = getCurrentWorkspaceId();
      const res = await fetch('/api/platform-accounts', {
        headers: { 'x-workspace-id': wsId },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const flatAccounts: PlatformAccount[] = [];
          for (const config of data.data) {
            if (config.accounts) {
              for (const acct of config.accounts) {
                flatAccounts.push({
                  id: acct.id,
                  platform: config.platform,
                  accountName: acct.accountName,
                  templateId: acct.templateId,
                  templateName: acct.templateName,
                });
              }
            }
          }
          setAccounts(flatAccounts);
        }
      }
    } catch (err) {
      console.error('[PublishConfirmPanel] 加载账号失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePlatform = (platform: string, accountId: string) => {
    setSelectedPlatforms(prev => {
      const next = new Map(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.set(platform, accountId);
      }
      return next;
    });
  };

  const handlePublish = async () => {
    if (selectedPlatforms.size === 0) return;

    setPublishing(true);
    try {
      const platforms = Array.from(selectedPlatforms.entries()).map(([platform, accountId]) => ({
        platform,
        accountId,
      }));

      const wsId = getCurrentWorkspaceId();
      const res = await fetch('/api/publish/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': wsId,
        },
        body: JSON.stringify({
          subTaskId,
          platforms,
          scheduledAt: scheduleType === 'scheduled' ? scheduledAt : undefined,
        }),
      });

      const data = await res.json();
      setResult(data);

      if (data.success) {
        onComplete?.();
      }
    } catch (err) {
      console.error('[PublishConfirmPanel] 发布失败:', err);
      setResult({ success: false, error: '发布失败' });
    } finally {
      setPublishing(false);
    }
  };

  // 按平台分组账号
  const accountsByPlatform = new Map<string, PlatformAccount[]>();
  for (const acct of accounts) {
    const list = accountsByPlatform.get(acct.platform) || [];
    list.push(acct);
    accountsByPlatform.set(acct.platform, list);
  }

  const title = taskResult?.title || taskResult?.taskName || '未命名文章';
  const wordCount = taskResult?.wordCount || taskResult?.content?.length || 0;

  if (result) {
    return (
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6 text-center space-y-4">
          {result.success ? (
            <>
              <div className="text-green-500 text-4xl">✓</div>
              <h3 className="text-lg font-semibold">发布任务已提交</h3>
              <p className="text-sm text-slate-500">
                文章「{result.data?.articleTitle}」已提交到 {result.data?.platformCount} 个平台
              </p>
              <p className="text-xs text-slate-400">
                状态：{result.data?.status === 'scheduled' ? '定时发布' : '立即发布'}
              </p>
            </>
          ) : (
            <>
              <div className="text-red-500 text-4xl">✗</div>
              <h3 className="text-lg font-semibold">发布失败</h3>
              <p className="text-sm text-red-500">{result.error || '未知错误'}</p>
            </>
          )}
          <Button variant="outline" onClick={onCancel}>关闭</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          发布文章
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 文章信息 */}
        <div className="space-y-1">
          <h3 className="font-medium truncate">{title}</h3>
          <p className="text-sm text-slate-500">{wordCount} 字</p>
        </div>

        <Separator />

        {/* 平台选择 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">选择发布平台</Label>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              加载账号中...
            </div>
          ) : (
            PLATFORM_OPTIONS.map(platform => {
              const platformAccounts = accountsByPlatform.get(platform.value) || [];
              if (platformAccounts.length === 0) return null;

              return (
                <div key={platform.value} className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">{platform.label}</p>
                  {platformAccounts.map(acct => (
                    <label
                      key={acct.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        selectedPlatforms.get(acct.platform) === acct.id
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Checkbox
                        checked={selectedPlatforms.get(acct.platform) === acct.id}
                        onCheckedChange={() => togglePlatform(acct.platform, acct.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{acct.accountName}</p>
                        {acct.templateName && (
                          <p className="text-xs text-slate-400">模板: {acct.templateName}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {PLATFORM_LABELS[acct.platform as keyof typeof PLATFORM_LABELS] || acct.platform}
                      </Badge>
                    </label>
                  ))}
                </div>
              );
            })
          )}

          {accounts.length === 0 && !loading && (
            <p className="text-sm text-slate-400 py-2">
              尚未配置平台账号，请先在「账号管理」中添加
            </p>
          )}
        </div>

        <Separator />

        {/* 发布时机 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">发布时机</Label>
          <RadioGroup value={scheduleType} onValueChange={(v) => setScheduleType(v as 'now' | 'scheduled')}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="now" id="now" />
              <Label htmlFor="now" className="text-sm cursor-pointer">立即发布</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="scheduled" id="scheduled" />
              <Label htmlFor="scheduled" className="text-sm cursor-pointer">定时发布</Label>
            </div>
          </RadioGroup>

          {scheduleType === 'scheduled' && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
              min={new Date().toISOString().slice(0, 16)}
            />
          )}
        </div>

        <Separator />

        {/* 操作按钮 */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button
            onClick={handlePublish}
            disabled={selectedPlatforms.size === 0 || publishing}
          >
            {publishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                发布中...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                确认发布 ({selectedPlatforms.size})
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
