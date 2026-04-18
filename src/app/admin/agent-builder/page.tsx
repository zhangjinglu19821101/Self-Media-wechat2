'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Settings,
  Plus,
  Eye,
  Edit,
  Download,
  ExternalLink,
  Layers,
  Zap,
  Users,
  ChevronRight,
  FileText,
  Package,
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

export default function AgentBuilderAdmin() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [allCapabilities, setAllCapabilities] = useState<Record<string, AgentCapabilities>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('agents');

  // 创建 Agent 表单状态
  const [createAgentForm, setCreateAgentForm] = useState({
    id: '',
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
  }, []);

  const loadData = async () => {
    try {
      // 加载 Agent 列表
      const agentsRes = await fetch('/api/admin/agent-builder/agents');
      const agentsData = await agentsRes.json();

      if (agentsData.success) {
        setAgents(agentsData.data);

        // 为每个 Agent 加载能力数据
        const capabilities: Record<string, AgentCapabilities> = {};
        for (const agent of agentsData.data) {
          const capRes = await fetch(`/api/admin/agent-builder/agent/${agent.id}/capabilities`);
          const capData = await capRes.json();
          if (capData.success) {
            capabilities[agent.id] = capData.data;
          }
        }
        setAllCapabilities(capabilities);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const createAgent = async () => {
    if (!createAgentForm.id || !createAgentForm.name || !createAgentForm.systemPrompt) {
      alert('请填写必填字段（ID、名称、系统提示词）');
      return;
    }

    try {
      const response = await fetch('/api/admin/agent-builder/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createAgentForm),
      });

      const data = await response.json();
      if (data.success) {
        alert('Agent 创建成功！');
        setCreateAgentForm({
          id: '',
          name: '',
          role: '',
          description: '',
          systemPrompt: '',
          maxConcurrentTasks: 3,
          canSendTo: [],
          canReceiveFrom: [],
        });
        loadData();
      } else {
        alert('Agent 创建失败：' + data.error);
      }
    } catch (error) {
      console.error('Error creating agent:', error);
      alert('Agent 创建失败');
    }
  };

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { color: string }> = {
      'core-coordinator': { color: 'bg-blue-500' },
      'technical-executor': { color: 'bg-green-500' },
      'operations-executor': { color: 'bg-purple-500' },
      'content-executor': { color: 'bg-orange-500' },
    };
    const roleInfo = roleMap[role.toLowerCase()] || { color: 'bg-gray-500' };
    return <div className={`inline-block h-3 w-3 rounded-full ${roleInfo.color}`} />;
  };

  const getCapabilitiesCount = (agentId: string) => {
    const caps = allCapabilities[agentId];
    if (!caps) return { base: 0, domain: 0, total: 0 };

    const baseCount = caps.base.length;
    const domainCount = Object.values(caps.domain).reduce((sum, arr) => sum + arr.length, 0);

    return { base: baseCount, domain: domainCount, total: baseCount + domainCount };
  };

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

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Agent Builder 管理后台</h1>
                <p className="text-sm text-muted-foreground">管理和配置 Agent 能力</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/agent-builder/agent-capabilities">
                <Button variant="outline" size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  能力文档
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  系统监控
                </Button>
              </Link>
              <Link href="/workflow">
                <Button variant="outline" size="sm">
                  <Layers className="mr-2 h-4 w-4" />
                  工作流程
                </Button>
              </Link>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    创建 Agent
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>创建新 Agent</DialogTitle>
                    <DialogDescription>
                      填写以下信息创建一个新的 Agent
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium">
                          Agent ID <span className="text-red-500">*</span>
                        </label>
                        <Input
                          placeholder="例如: E"
                          value={createAgentForm.id}
                          onChange={(e) => setCreateAgentForm({ ...createAgentForm, id: e.target.value })}
                          maxLength={1}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium">
                          Agent 名称 <span className="text-red-500">*</span>
                        </label>
                        <Input
                          placeholder="例如: 数据分析师"
                          value={createAgentForm.name}
                          onChange={(e) => setCreateAgentForm({ ...createAgentForm, name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">角色标识</label>
                      <Select
                        value={createAgentForm.role}
                        onValueChange={(value) => setCreateAgentForm({ ...createAgentForm, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择角色" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="core-coordinator">核心协调者</SelectItem>
                          <SelectItem value="technical-executor">技术执行者</SelectItem>
                          <SelectItem value="operations-executor">运营执行者</SelectItem>
                          <SelectItem value="content-executor">内容执行者</SelectItem>
                          <SelectItem value="custom">自定义</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">描述</label>
                      <Input
                        placeholder="简短描述这个 Agent 的职责"
                        value={createAgentForm.description}
                        onChange={(e) => setCreateAgentForm({ ...createAgentForm, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        系统提示词 <span className="text-red-500">*</span>
                      </label>
                      <Textarea
                        placeholder="输入系统提示词，定义 Agent 的行为和角色"
                        rows={6}
                        value={createAgentForm.systemPrompt}
                        onChange={(e) => setCreateAgentForm({ ...createAgentForm, systemPrompt: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">最大并发任务数</label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={createAgentForm.maxConcurrentTasks}
                        onChange={(e) => setCreateAgentForm({ ...createAgentForm, maxConcurrentTasks: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={createAgent}>创建</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="agents">
              <Users className="mr-2 h-4 w-4" />
              Agents
            </TabsTrigger>
            <TabsTrigger value="capabilities">
              <Layers className="mr-2 h-4 w-4" />
              能力管理
            </TabsTrigger>
            <TabsTrigger value="export">
              <Download className="mr-2 h-4 w-4" />
              能力导出
            </TabsTrigger>
            <TabsTrigger value="assets">
              <Package className="mr-2 h-4 w-4" />
              资产导出
            </TabsTrigger>
          </TabsList>

          {/* Agents Tab */}
          <TabsContent value="agents" className="mt-6 space-y-4">
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Agent 列表</h2>
                <Badge variant="secondary">共 {agents.length} 个 Agent</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>能力统计</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => {
                    const caps = getCapabilitiesCount(agent.id);
                    return (
                      <TableRow key={agent.id}>
                        <TableCell className="font-mono font-bold">{agent.id}</TableCell>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getRoleBadge(agent.role)}
                            <span className="text-sm">{agent.role}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {agent.description || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-xs">
                              <Zap className="mr-1 h-3 w-3" />
                              基础: {caps.base}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <Layers className="mr-1 h-3 w-3" />
                              领域: {caps.domain}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Settings className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>操作</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link href={`/agents/${agent.id}`}>
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  测试对话
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/agent-builder/agent/${agent.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  查看详情
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/agent-builder/agent/${agent.id}/edit`}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  编辑提示词
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/agent-builder/agent/${agent.id}/capabilities`}>
                                  <Layers className="mr-2 h-4 w-4" />
                                  管理能力
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            {/* 快捷操作卡片 */}
            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/admin/agent-builder/capabilities">
                <Card className="group cursor-pointer p-6 transition-all hover:shadow-md">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                    <Zap className="h-6 w-6 text-blue-500" />
                  </div>
                  <h3 className="mb-2 font-semibold">管理基础能力</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    查看和管理所有 Agent 的基础能力
                  </p>
                  <div className="flex items-center text-sm text-blue-500">
                    查看详情
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </div>
                </Card>
              </Link>

              <Link href="/admin/agent-builder/domains">
                <Card className="group cursor-pointer p-6 transition-all hover:shadow-md">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                    <Layers className="h-6 w-6 text-purple-500" />
                  </div>
                  <h3 className="mb-2 font-semibold">管理领域能力</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    为 Agent 添加或替换行业特定能力
                  </p>
                  <div className="flex items-center text-sm text-purple-500">
                    查看详情
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </div>
                </Card>
              </Link>

              <Link href="/admin/agent-builder/export">
                <Card className="group cursor-pointer p-6 transition-all hover:shadow-md">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                    <Download className="h-6 w-6 text-green-500" />
                  </div>
                  <h3 className="mb-2 font-semibold">导出能力</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    导出基础能力和领域能力到文件
                  </p>
                  <div className="flex items-center text-sm text-green-500">
                    查看详情
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </div>
                </Card>
              </Link>
            </div>
          </TabsContent>

          {/* 能力管理 Tab */}
          <TabsContent value="capabilities" className="mt-6">
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">能力概览</h2>
                <div className="flex gap-2">
                  <Link href="/admin/agent-builder/capabilities">
                    <Button variant="outline" size="sm">
                      基础能力
                    </Button>
                  </Link>
                  <Link href="/admin/agent-builder/domains">
                    <Button variant="outline" size="sm">
                      领域能力
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="space-y-6">
                {agents.map((agent) => {
                  const caps = allCapabilities[agent.id];
                  if (!caps) return null;

                  return (
                    <Card key={agent.id} className="p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-bold">
                            {agent.id}
                          </div>
                          <div>
                            <div className="font-semibold">{agent.name}</div>
                            <div className="text-xs text-muted-foreground">{agent.role}</div>
                          </div>
                        </div>
                        <Link href={`/admin/agent-builder/agent/${agent.id}/capabilities`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="mr-2 h-4 w-4" />
                            编辑
                          </Button>
                        </Link>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {/* 基础能力 */}
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-sm font-medium">基础能力</h4>
                            <Badge variant="outline" className="text-xs">
                              {caps.base.length} 项
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            {caps.base.slice(0, 3).map((cap) => (
                              <div key={cap.id} className="flex items-center justify-between text-sm">
                                <span>{cap.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {cap.level}%
                                </Badge>
                              </div>
                            ))}
                            {caps.base.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                还有 {caps.base.length - 3} 项...
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 领域能力 */}
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-sm font-medium">领域能力</h4>
                            <Badge variant="outline" className="text-xs">
                              {Object.values(caps.domain).reduce((sum, arr) => sum + arr.length, 0)} 项
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            {Object.entries(caps.domain).slice(0, 2).map(([domain, capabilities]) => (
                              <div key={domain} className="flex items-center justify-between text-sm">
                                <span>{domain}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {capabilities.length} 项
                                </Badge>
                              </div>
                            ))}
                            {Object.keys(caps.domain).length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                还有 {Object.keys(caps.domain).length - 2} 个领域...
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          {/* 资产导出 Tab */}
          <TabsContent value="assets" className="mt-6 space-y-4">
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-semibold">资产导出</h2>
              <p className="mb-6 text-muted-foreground">
                导出系统中的所有资产,包括Agent提示词、规则配置、代码实现等。这些资产完全属于你,可以随时导出。
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                {/* 导出Agent提示词 */}
                <Card className="p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="mb-2 font-semibold">Agent 提示词</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    导出所有Agent的系统提示词、能力定义、限制条件等
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={async () => {
                        const res = await fetch('/api/admin/export/prompts');
                        const data = await res.json();
                        if (data.success) {
                          const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `agent-prompts-${new Date().toISOString().split('T')[0]}.json`;
                          a.click();
                        }
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={async () => {
                        const res = await fetch('/api/admin/export/prompts', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ format: 'markdown', agentId: 'B' }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          const blob = new Blob([data.data.content], { type: 'text/markdown' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = data.data.filename;
                          a.click();
                        }
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Markdown
                    </Button>
                  </div>
                </Card>

                {/* 导出规则配置 */}
                <Card className="p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                    <Zap className="h-5 w-5 text-purple-500" />
                  </div>
                  <h3 className="mb-2 font-semibold">规则配置</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    导出Agent B的新媒体通用规则(6大类)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={async () => {
                        const res = await fetch('/api/admin/export/rules');
                        const data = await res.json();
                        if (data.success) {
                          const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `agent-b-rules-${new Date().toISOString().split('T')[0]}.json`;
                          a.click();
                        }
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={async () => {
                        const res = await fetch('/api/admin/export/rules', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ format: 'markdown' }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          const blob = new Blob([data.data.content], { type: 'text/markdown' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = data.data.filename;
                          a.click();
                        }
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Markdown
                    </Button>
                  </div>
                </Card>

                {/* 完整项目导出 */}
                <Card className="p-4 md:col-span-2">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <Package className="h-5 w-5 text-green-500" />
                  </div>
                  <h3 className="mb-2 font-semibold">完整项目导出</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    导出所有资产(Agent提示词 + 规则配置 + 架构信息 + 技术栈 + 使用指南)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={async () => {
                        const res = await fetch('/api/admin/export/full');
                        const data = await res.json();
                        if (data.success) {
                          const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `multi-agent-system-full-export-${new Date().toISOString().split('T')[0]}.json`;
                          a.click();
                        }
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={async () => {
                        const res = await fetch('/api/admin/export/full', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ format: 'markdown' }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          const blob = new Blob([data.data.content], { type: 'text/markdown' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = data.data.filename;
                          a.click();
                        }
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Markdown
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
                <h4 className="mb-2 font-semibold text-yellow-900 dark:text-yellow-100">资产归属说明</h4>
                <ul className="list-inside list-disc space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
                  <li>✅ <strong>代码实现</strong>: 规则引擎、拆解引擎、权限管理等代码完全属于你</li>
                  <li>✅ <strong>提示词定义</strong>: Agent的系统提示词、能力定义完全属于你</li>
                  <li>✅ <strong>规则配置</strong>: 新媒体通用规则的内容完全属于你</li>
                  <li>✅ <strong>知识库内容</strong>: 存储的经验、技术方案完全属于你</li>
                  <li>✅ <strong>执行数据</strong>: 对话历史、执行记录完全属于你</li>
                  <li>🔗 <strong>平台资源</strong>: 大语言模型能力、SDK能力由平台提供(依赖项)</li>
                </ul>
              </div>
            </Card>
          </TabsContent>

          {/* 导出 Tab */}
          <TabsContent value="export" className="mt-6">
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-semibold">能力导出</h2>
              <p className="mb-6 text-muted-foreground">
                导出 Agent 的基础能力和领域能力，支持 JSON、YAML、TOML 格式
              </p>

              <div className="grid gap-4 md:grid-cols-3">
                {/* 导出基础能力 */}
                <Card className="p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Zap className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="mb-2 font-semibold">基础能力</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    导出所有 Agent 的基础能力配置
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      const res = await fetch('/api/admin/capabilities/export/base');
                      const data = await res.json();
                      if (data.success) {
                        const blob = new Blob([data.data.output], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = data.data.filename;
                        a.click();
                      }
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    导出 JSON
                  </Button>
                </Card>

                {/* 导出领域能力 */}
                <Card className="p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                    <Layers className="h-5 w-5 text-purple-500" />
                  </div>
                  <h3 className="mb-2 font-semibold">领域能力</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    导出所有 Agent 的领域能力配置
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      const res = await fetch('/api/admin/capabilities/export/domain');
                      const data = await res.json();
                      if (data.success) {
                        const blob = new Blob([data.data.output], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = data.data.filename;
                        a.click();
                      }
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    导出 JSON
                  </Button>
                </Card>

                {/* 导出所有能力 */}
                <Card className="p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <Download className="h-5 w-5 text-green-500" />
                  </div>
                  <h3 className="mb-2 font-semibold">完整能力包</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    导出所有能力（基础 + 领域）
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      const res = await fetch('/api/admin/capabilities/export/all');
                      const data = await res.json();
                      if (data.success) {
                        const blob = new Blob([data.data.output], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = data.data.filename;
                        a.click();
                      }
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    导出 JSON
                  </Button>
                </Card>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
