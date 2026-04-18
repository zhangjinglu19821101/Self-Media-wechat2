'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Zap,
  Layers,
  Search,
  RefreshCw,
  Download,
  Upload,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

// 类型定义
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
  agentId: string;
  base: BaseCapability[];
  domain: Record<string, DomainCapability[]>;
}

export default function CapabilitiesManagement() {
  const [allCapabilities, setAllCapabilities] = useState<Record<string, AgentCapabilities>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterDomain, setFilterDomain] = useState('all');
  const [activeTab, setActiveTab] = useState('base');

  const agents = ['A', 'B', 'C', 'D'];
  const domains = ['电商', '金融', '医疗'];

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const capabilities: Record<string, AgentCapabilities> = {};

      for (const agentId of agents) {
        const res = await fetch(`/api/admin/agent-builder/agent/${agentId}/capabilities`);
        const data = await res.json();

        if (data.success) {
          capabilities[agentId] = {
            agentId,
            base: data.data.base,
            domain: data.data.domain,
          };
        }
      }

      setAllCapabilities(capabilities);
      setLoading(false);
    } catch (error) {
      console.error('Error loading capabilities:', error);
      setLoading(false);
    }
  };

  // 过滤基础能力
  const filteredBaseCapabilities = () => {
    let results: Array<{ agentId: string; cap: BaseCapability }> = [];

    Object.entries(allCapabilities).forEach(([agentId, caps]) => {
      if (filterAgent !== 'all' && filterAgent !== agentId) return;

      caps.base.forEach((cap) => {
        if (searchQuery && !cap.name.toLowerCase().includes(searchQuery.toLowerCase())) return;
        results.push({ agentId, cap });
      });
    });

    return results;
  };

  // 过滤领域能力
  const filteredDomainCapabilities = () => {
    let results: Array<{ agentId: string; domain: string; cap: DomainCapability }> = [];

    Object.entries(allCapabilities).forEach(([agentId, caps]) => {
      if (filterAgent !== 'all' && filterAgent !== agentId) return;

      Object.entries(caps.domain).forEach(([domain, capsList]) => {
        if (filterDomain !== 'all' && filterDomain !== domain) return;

        capsList.forEach((cap) => {
          if (searchQuery && !cap.name.toLowerCase().includes(searchQuery.toLowerCase())) return;
          results.push({ agentId, domain, cap });
        });
      });
    });

    return results;
  };

  const exportBaseCapabilities = async (agentId?: string) => {
    const url = agentId 
      ? `/api/admin/capabilities/export/base?agentId=${agentId}`
      : '/api/admin/capabilities/export/base';

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        const blob = new Blob([data.data.output], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = data.data.filename;
        a.click();
      }
    } catch (error) {
      console.error('Error exporting capabilities:', error);
      alert('导出失败');
    }
  };

  const exportDomainCapabilities = async (domain?: string) => {
    const params = new URLSearchParams();
    if (domain) params.append('domain', domain);

    const url = `/api/admin/capabilities/export/domain?${params.toString()}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        const blob = new Blob([data.data.output], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = data.data.filename;
        a.click();
      }
    } catch (error) {
      console.error('Error exporting capabilities:', error);
      alert('导出失败');
    }
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
            <div className="flex items-center gap-4">
              <Link href="/admin/agent-builder">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold">能力管理</h1>
                <p className="text-sm text-muted-foreground">查看和管理所有 Agent 的能力</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={loadData}>
                <RefreshCw className="mr-2 h-4 w-4" />
                刷新
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* 过滤器 */}
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索能力..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Select value={filterAgent} onValueChange={setFilterAgent}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="筛选 Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有 Agent</SelectItem>
                  {agents.map((agentId) => (
                    <SelectItem key={agentId} value={agentId}>
                      Agent {agentId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activeTab === 'domain' && (
              <div>
                <Select value={filterDomain} onValueChange={setFilterDomain}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="筛选领域" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有领域</SelectItem>
                    {domains.map((domain) => (
                      <SelectItem key={domain} value={domain}>
                        {domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="base">
              <Zap className="mr-2 h-4 w-4" />
              基础能力
            </TabsTrigger>
            <TabsTrigger value="domain">
              <Layers className="mr-2 h-4 w-4" />
              领域能力
            </TabsTrigger>
          </TabsList>

          {/* 基础能力 Tab */}
          <TabsContent value="base" className="mt-6">
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">基础能力</h2>
                <Button
                  variant="outline"
                  onClick={() => exportBaseCapabilities(filterAgent === 'all' ? undefined : filterAgent)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>熟练度</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>可复制</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBaseCapabilities().map(({ agentId, cap }) => (
                    <TableRow key={`${agentId}-${cap.id}`}>
                      <TableCell>
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-bold text-xs">
                          {agentId}
                        </div>
                      </TableCell>
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
                          <Badge variant="default" className="bg-green-500">是</Badge>
                        ) : (
                          <Badge variant="secondary">否</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredBaseCapabilities().length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        没有找到匹配的能力
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* 领域能力 Tab */}
          <TabsContent value="domain" className="mt-6">
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">领域能力</h2>
                <Button
                  variant="outline"
                  onClick={() => exportDomainCapabilities(filterDomain === 'all' ? undefined : filterDomain)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>领域</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>价格</TableHead>
                    <TableHead>提供方</TableHead>
                    <TableHead>版本</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDomainCapabilities().map(({ agentId, domain, cap }) => (
                    <TableRow key={`${agentId}-${domain}-${cap.id}`}>
                      <TableCell>
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-bold text-xs">
                          {agentId}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{domain}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{cap.name}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {cap.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">¥{cap.price.toLocaleString()}</Badge>
                      </TableCell>
                      <TableCell>{cap.provider}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{cap.version}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDomainCapabilities().length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        没有找到匹配的能力
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
