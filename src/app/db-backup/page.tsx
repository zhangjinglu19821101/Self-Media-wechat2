'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Database,
  HardDrive,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  Trash2,
  Download,
  Shield,
} from 'lucide-react';

interface BackupMetadata {
  backupId: string;
  type: 'full' | 'incremental';
  schema: string;
  timestamp: string;
  fileSize: number;
  storageKey: string;
  tables: string[];
  rowCount: Record<string, number>;
  checksum: string;
}

interface BackupListResponse {
  success: boolean;
  data: {
    backups: BackupMetadata[];
    total: number;
    totalSizeMB: number;
  };
}

interface BackupStatusResponse {
  success: boolean;
  data: {
    database: {
      connected: boolean;
      schema: string;
      latencyMs: number;
    };
    backupService: {
      status: string;
      tempDir: string;
      lastBackup: string | null;
    };
  };
}

export default function DatabaseBackupPage() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [status, setStatus] = useState<BackupStatusResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState<string | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 加载备份列表
  const loadBackups = async () => {
    try {
      const response = await fetch('/api/db-backup');
      const data: BackupListResponse = await response.json();
      if (data.success) {
        setBackups(data.data.backups);
      }
    } catch (error) {
      console.error('加载备份列表失败:', error);
    }
  };

  // 加载状态
  const loadStatus = async () => {
    try {
      const response = await fetch('/api/db-backup?action=status');
      const data: BackupStatusResponse = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      console.error('加载状态失败:', error);
    }
  };

  // 初始化加载
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadBackups(), loadStatus()]);
      setLoading(false);
    };
    init();
  }, []);

  // 手动触发备份
  const triggerBackup = async (type: 'full' | 'incremental') => {
    setOperating(`backup-${type}`);
    setMessage(null);

    try {
      const response = await fetch('/api/db-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `${type === 'full' ? '全量' : '增量'}备份成功: ${data.data.backupId}` });
        await loadBackups();
      } else {
        setMessage({ type: 'error', text: `备份失败: ${data.error}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `备份失败: ${error}` });
    } finally {
      setOperating(null);
    }
  };

  // 验证备份
  const verifyBackup = async (backupId: string) => {
    setOperating(`verify-${backupId}`);
    setMessage(null);

    try {
      const response = await fetch('/api/db-backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId, action: 'verify' }),
      });
      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `备份验证成功: ${backupId}` });
      } else {
        setMessage({ type: 'error', text: `备份验证失败: ${data.error}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `验证失败: ${error}` });
    } finally {
      setOperating(null);
    }
  };

  // 恢复备份
  const restoreBackup = async (backupId: string, dropExisting: boolean) => {
    setOperating(`restore-${backupId}`);
    setMessage(null);
    setRestoreDialogOpen(false);

    try {
      const response = await fetch('/api/db-backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId, action: 'restore', dropExisting }),
      });
      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `恢复成功: ${backupId}` });
      } else {
        setMessage({ type: 'error', text: `恢复失败: ${data.error}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `恢复失败: ${error}` });
    } finally {
      setOperating(null);
    }
  };

  // 删除备份
  const deleteBackup = async (backupId: string) => {
    setOperating(`delete-${backupId}`);
    setMessage(null);
    setDeleteDialogOpen(false);

    try {
      const response = await fetch(`/api/db-backup/restore?backupId=${backupId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `备份已删除: ${backupId}` });
        await loadBackups();
      } else {
        setMessage({ type: 'error', text: `删除失败: ${data.error}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `删除失败: ${error}` });
    } finally {
      setOperating(null);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">数据库备份管理</h1>
          <p className="text-muted-foreground mt-1">
            管理生产数据库备份，支持全量备份、增量备份和数据恢复
          </p>
        </div>
        <Button variant="outline" onClick={() => { loadBackups(); loadStatus(); }}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {/* 消息提示 */}
      {message && (
        <Alert variant={message.type === 'success' ? 'default' : 'destructive'}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <AlertTitle>{message.type === 'success' ? '成功' : '错误'}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* 状态卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* 数据库状态 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">数据库连接</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">加载中...</div>
            ) : status ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {status.database.connected ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      已连接
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" />
                      断开
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Schema: {status.database.schema}
                </div>
                <div className="text-sm text-muted-foreground">
                  延迟: {status.database.latencyMs}ms
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">无法获取状态</div>
            )}
          </CardContent>
        </Card>

        {/* 备份统计 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">备份统计</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{backups.length}</div>
              <div className="text-sm text-muted-foreground">
                总备份数: {backups.length} 个
              </div>
              <div className="text-sm text-muted-foreground">
                全量备份: {backups.filter(b => b.type === 'full').length} 个
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 最近备份 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">最近备份</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {backups.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">{backups[0].backupId}</div>
                <div className="text-sm text-muted-foreground">
                  {formatTime(backups[0].timestamp)}
                </div>
                <Badge variant={backups[0].type === 'full' ? 'default' : 'secondary'}>
                  {backups[0].type === 'full' ? '全量' : '增量'}
                </Badge>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">暂无备份</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 操作区域 */}
      <Card>
        <CardHeader>
          <CardTitle>备份操作</CardTitle>
          <CardDescription>
            手动触发备份，建议在生产环境低峰期执行
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            onClick={() => triggerBackup('full')}
            disabled={operating !== null}
          >
            {operating === 'backup-full' ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            全量备份
          </Button>
          <Button
            variant="outline"
            onClick={() => triggerBackup('incremental')}
            disabled={operating !== null}
          >
            {operating === 'backup-incremental' ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            增量备份
          </Button>
        </CardContent>
      </Card>

      {/* 备份列表 */}
      <Card>
        <CardHeader>
          <CardTitle>备份列表</CardTitle>
          <CardDescription>
            所有可用的数据库备份，支持验证、恢复和删除操作
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无备份记录，请点击上方按钮手动触发备份
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>备份ID</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>Schema</TableHead>
                  <TableHead>大小</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>表数量</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.backupId}>
                    <TableCell className="font-mono text-xs">
                      {backup.backupId}
                    </TableCell>
                    <TableCell>
                      <Badge variant={backup.type === 'full' ? 'default' : 'secondary'}>
                        {backup.type === 'full' ? '全量' : '增量'}
                      </Badge>
                    </TableCell>
                    <TableCell>{backup.schema}</TableCell>
                    <TableCell>{formatSize(backup.fileSize)}</TableCell>
                    <TableCell>{formatTime(backup.timestamp)}</TableCell>
                    <TableCell>{backup.tables.length}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => verifyBackup(backup.backupId)}
                          disabled={operating !== null}
                        >
                          {operating === `verify-${backup.backupId}` ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Shield className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBackup(backup);
                            setRestoreDialogOpen(true);
                          }}
                          disabled={operating !== null}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBackup(backup);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={operating !== null}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 恢复确认对话框 */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              恢复备份
            </DialogTitle>
            <DialogDescription>
              您即将从备份恢复数据。此操作可能会覆盖现有数据，请确认。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>备份ID</Label>
              <div className="font-mono text-sm bg-muted p-2 rounded">
                {selectedBackup?.backupId}
              </div>
            </div>
            <div className="space-y-2">
              <Label>备份时间</Label>
              <div className="text-sm">
                {selectedBackup && formatTime(selectedBackup.timestamp)}
              </div>
            </div>
            <div className="space-y-2">
              <Label>备份大小</Label>
              <div className="text-sm">
                {selectedBackup && formatSize(selectedBackup.fileSize)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => restoreBackup(selectedBackup?.backupId || '', false)}
              disabled={operating !== null}
            >
              {operating?.startsWith('restore-') ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              确认恢复
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              删除备份
            </DialogTitle>
            <DialogDescription>
              此操作不可撤销，请确认是否删除此备份。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>备份ID</Label>
              <div className="font-mono text-sm bg-muted p-2 rounded">
                {selectedBackup?.backupId}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteBackup(selectedBackup?.backupId || '')}
              disabled={operating !== null}
            >
              {operating?.startsWith('delete-') ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
