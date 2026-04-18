'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Zap,
  Layers,
  Settings,
  Eye,
  Check,
} from 'lucide-react';
import Link from 'next/link';

// 类型定义
interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  maxConcurrentTasks: number;
  canSendTo: string[];
  canReceiveFrom: string[];
}

interface BaseCapability {
  id: string;
  name: string;
  level: number;
  description: string;
  type: string;
  replicable: boolean;
}

interface DomainCapability {
  id: string;
  name: string;
  price: number;
  description: string;
  domain: string;
  provider: string;
  version: string;
}

interface AgentCapabilities {
  base: BaseCapability[];
  domain: Record<string, DomainCapability[]>;
}

export default function AgentDetail() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [capabilities, setCapabilities] = useState<AgentCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 编辑表单状态
  const [editForm, setEditForm] = useState({
    name: '',
    role: '',
    description: '',
    systemPrompt: '',
    maxConcurrentTasks: 3,
    canSendTo: [] as string[],
    canReceiveFrom: [] as string[],
  });

  // 加载数据
  useEffect(() => {
    loadData();
  }, [agentId]);

  const loadData = async () => {
    try {
      // 加载 Agent 信息
      const agentRes = await fetch(`/api/admin/agent-builder/agent/${agentId}`);
      const agentData = await agentRes.json();

      // 加载能力信息
      const capRes = await fetch(`/api/admin/agent-builder/agent/${agentId}/capabilities`);
      const capData = await capRes.json();

      if (agentData.success) {
        setAgent(agentData.data);
        setEditForm({
          name: agentData.data.name,
          role: agentData.data.role,
          description: agentData.data.description,
          systemPrompt: agentData.data.systemPrompt,
          maxConcurrentTasks: agentData.data.maxConcurrentTasks,
          canSendTo: agentData.data.canSendTo || [],
          canReceiveFrom: agentData.data.canReceiveFrom || [],
        });
      }

      if (capData.success) {
        setCapabilities(capData.data);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/agent-builder/agent/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();
      if (data.success) {
        alert('保存成功！');
        setEditing(false);
        loadData();
      } else {
        alert('保存失败：' + data.error);
      }
    } catch (error) {
      console.error('Error saving agent:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleCanSendTo = (targetAgentId: string) => {
    if (editForm.canSendTo.includes(targetAgentId)) {
      setEditForm({
        ...editForm,
        canSendTo: editForm.canSendTo.filter(id => id !== targetAgentId),
      });
    } else {
      setEditForm({
        ...editForm,
        canSendTo: [...editForm.canSendTo, targetAgentId],
      });
    }
  };

  const toggleCanReceiveFrom = (sourceAgentId: string) => {
    if (editForm.canReceiveFrom.includes(sourceAgentId)) {
      setEditForm({
        ...editForm,
        canReceiveFrom: editForm.canReceiveFrom.filter(id => id !== sourceAgentId),
      });
    } else {
      setEditForm({
        ...editForm,
        canReceiveFrom: [...editForm.canReceiveFrom, sourceAgentId],
      });
    }
  };

  const allAgents = ['A', 'B', 'C', 'D'];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium">Agent 不存在</p>
          <Link href="/admin/agent-builder" className="mt-4 inline-block text-primary">
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/agent-builder">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 font-bold">
                    {agent.id}
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">{agent.name}</h1>
                    <p className="text-sm text-muted-foreground">{agent.role}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Button variant="outline" onClick={() => setEditing(false)}>
                    <X className="mr-2 h-4 w-4" />
                    取消
                  </Button>
                  <Button onClick={saveChanges} disabled={saving}>
                    {saving ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        保存
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">
              <Eye className="mr-2 h-4 w-4" />
              概览
            </TabsTrigger>
            <TabsTrigger value="capabilities">
              <Zap className="mr-2 h-4 w-4" />
              能力
            </TabsTrigger>
            <TabsTrigger value="config">
              <Settings className="mr-2 h-4 w-4" />
              配置
            </TabsTrigger>
          </TabsList>

          {/* 概览 Tab */}
          <TabsContent value="overview" className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* 基本信息 */}
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-semibold">基本信息</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Agent ID</label>
                    <div className="font-mono font-bold">{agent.id}</div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">名称</label>
                    {editing ? (
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    ) : (
                      <div className="font-medium">{agent.name}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">角色</label>
                    {editing ? (
                      <Select
                        value={editForm.role}
                        onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="core-coordinator">核心协调者</SelectItem>
                          <SelectItem value="technical-executor">技术执行者</SelectItem>
                          <SelectItem value="operations-executor">运营执行者</SelectItem>
                          <SelectItem value="content-executor">内容执行者</SelectItem>
                          <SelectItem value="custom">自定义</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="font-medium">{agent.role}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">描述</label>
                    {editing ? (
                      <Input
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      />
                    ) : (
                      <div className="text-sm">{agent.description || '-'}</div>
                    )}
                  </div>
                </div>
              </Card>

              {/* 系统提示词 */}
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-semibold">系统提示词</h2>
                {editing ? (
                  <Textarea
                    value={editForm.systemPrompt}
                    onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })}
                    rows={12}
                    className="font-mono text-sm"
                    placeholder="输入系统提示词..."
                  />
                ) : (
                  <div className="max-h-96 overflow-y-auto rounded-lg border bg-muted/50 p-4">
                    <pre className="whitespace-pre-wrap font-mono text-sm">
                      {agent.systemPrompt}
                    </pre>
                  </div>
                )}
              </Card>
            </div>

            {/* 能力统计 */}
            {capabilities && (
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-semibold">能力统计</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-medium">
                        <Zap className="h-4 w-4" />
                        基础能力
                      </h3>
                      <Badge variant="secondary">{capabilities.base.length} 项</Badge>
                    </div>
                    <div className="space-y-2">
                      {capabilities.base.slice(0, 5).map((cap) => (
                        <div key={cap.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <div className="font-medium text-sm">{cap.name}</div>
                            <div className="text-xs text-muted-foreground">{cap.description}</div>
                          </div>
                          <Badge variant="outline">{cap.level}%</Badge>
                        </div>
                      ))}
                      {capabilities.base.length > 5 && (
                        <div className="text-center text-sm text-muted-foreground">
                          还有 {capabilities.base.length - 5} 项...
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-medium">
                        <Layers className="h-4 w-4" />
                        领域能力
                      </h3>
                      <Badge variant="secondary">
                        {Object.values(capabilities.domain).reduce((sum, arr) => sum + arr.length, 0)} 项
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(capabilities.domain).slice(0, 3).map(([domain, caps]) => (
                        <div key={domain} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <div className="font-medium text-sm">{domain}</div>
                            <div className="text-xs text-muted-foreground">{caps.length} 项技能</div>
                          </div>
                          <Badge variant="outline">{domain}</Badge>
                        </div>
                      ))}
                      {Object.keys(capabilities.domain).length > 3 && (
                        <div className="text-center text-sm text-muted-foreground">
                          还有 {Object.keys(capabilities.domain).length - 3} 个领域...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* 能力 Tab */}
          <TabsContent value="capabilities" className="mt-6 space-y-4">
            {capabilities && (
              <>
                <Card className="p-6">
                  <h2 className="mb-4 text-lg font-semibold">基础能力</h2>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>名称</TableHead>
                        <TableHead>描述</TableHead>
                        <TableHead>熟练度</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>可复制</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {capabilities.base.map((cap) => (
                        <TableRow key={cap.id}>
                          <TableCell className="font-mono text-xs">{cap.id}</TableCell>
                          <TableCell className="font-medium">{cap.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{cap.description}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-16 bg-muted rounded-full">
                                <div
                                  className="h-2 bg-primary rounded-full"
                                  style={{ width: `${cap.level}%` }}
                                />
                              </div>
                              <span className="text-xs">{cap.level}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{cap.type}</Badge>
                          </TableCell>
                          <TableCell>
                            {cap.replicable ? (
                              <Badge variant="default" className="bg-green-500">
                                <Check className="mr-1 h-3 w-3" />
                                是
                              </Badge>
                            ) : (
                              <Badge variant="secondary">否</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                <Card className="p-6">
                  <h2 className="mb-4 text-lg font-semibold">领域能力</h2>
                  <div className="space-y-6">
                    {Object.entries(capabilities.domain).map(([domain, caps]) => (
                      <div key={domain}>
                        <h3 className="mb-3 flex items-center gap-2 text-lg font-medium">
                          <Layers className="h-5 w-5" />
                          {domain}
                          <Badge variant="secondary">{caps.length} 项</Badge>
                        </h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>名称</TableHead>
                              <TableHead>描述</TableHead>
                              <TableHead>价格</TableHead>
                              <TableHead>提供方</TableHead>
                              <TableHead>版本</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {caps.map((cap) => (
                              <TableRow key={cap.id}>
                                <TableCell className="font-mono text-xs">{cap.id}</TableCell>
                                <TableCell className="font-medium">{cap.name}</TableCell>
                                <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                                  {cap.description}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">¥{cap.price.toLocaleString()}</Badge>
                                </TableCell>
                                <TableCell>{cap.provider}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{cap.version}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}
          </TabsContent>

          {/* 配置 Tab */}
          <TabsContent value="config" className="mt-6 space-y-4">
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Agent 配置</h2>
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium">最大并发任务数</label>
                  {editing ? (
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={editForm.maxConcurrentTasks}
                      onChange={(e) => setEditForm({ ...editForm, maxConcurrentTasks: parseInt(e.target.value) })}
                    />
                  ) : (
                    <div className="text-lg font-bold">{agent.maxConcurrentTasks}</div>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-medium">可以发送消息给</h3>
                  <div className="flex flex-wrap gap-2">
                    {allAgents.map((otherAgentId) => {
                      if (otherAgentId === agent.id) return null;
                      const canSend = editing 
                        ? editForm.canSendTo.includes(otherAgentId)
                        : agent.canSendTo?.includes(otherAgentId);
                      
                      return (
                        <Badge
                          key={otherAgentId}
                          variant={canSend ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => editing && toggleCanSendTo(otherAgentId)}
                        >
                          Agent {otherAgentId}
                          {canSend && <Check className="ml-1 h-3 w-3" />}
                        </Badge>
                      );
                    })}
                  </div>
                  {!editing && agent.canSendTo?.length === 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">无</p>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-medium">可以接收消息来自</h3>
                  <div className="flex flex-wrap gap-2">
                    {allAgents.map((otherAgentId) => {
                      if (otherAgentId === agent.id) return null;
                      const canReceive = editing 
                        ? editForm.canReceiveFrom.includes(otherAgentId)
                        : agent.canReceiveFrom?.includes(otherAgentId);
                      
                      return (
                        <Badge
                          key={otherAgentId}
                          variant={canReceive ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => editing && toggleCanReceiveFrom(otherAgentId)}
                        >
                          Agent {otherAgentId}
                          {canReceive && <Check className="ml-1 h-3 w-3" />}
                        </Badge>
                      );
                    })}
                  </div>
                  {!editing && agent.canReceiveFrom?.length === 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">无</p>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
