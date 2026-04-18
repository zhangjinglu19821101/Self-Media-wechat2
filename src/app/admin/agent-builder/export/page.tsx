'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ArrowLeft,
  Download,
  FileJson,
  FileCode,
  FileText,
  Zap,
  Layers,
  Package,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

export default function CapabilitiesExport() {
  const [exporting, setExporting] = useState<string | null>(null);

  const agents = ['A', 'B', 'C', 'D'];
  const domains = ['电商', '金融', '医疗'];

  // 导出配置
  const [baseExportConfig, setBaseExportConfig] = useState({
    agentId: 'all',
    format: 'json',
  });

  const [domainExportConfig, setDomainExportConfig] = useState({
    domain: 'all',
    agentId: 'all',
    format: 'json',
  });

  const [allExportConfig, setAllExportConfig] = useState({
    format: 'json',
  });

  // 导出基础能力
  const exportBaseCapabilities = async () => {
    setExporting('base');
    try {
      const params = new URLSearchParams();
      if (baseExportConfig.agentId !== 'all') {
        params.append('agentId', baseExportConfig.agentId);
      }
      params.append('format', baseExportConfig.format);

      const res = await fetch(`/api/admin/capabilities/export/base?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const blob = new Blob([data.data.output], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = data.data.filename;
        a.click();
        URL.revokeObjectURL(downloadUrl);
      } else {
        alert('导出失败：' + data.error);
      }
    } catch (error) {
      console.error('Error exporting base capabilities:', error);
      alert('导出失败');
    } finally {
      setExporting(null);
    }
  };

  // 导出领域能力
  const exportDomainCapabilities = async () => {
    setExporting('domain');
    try {
      const params = new URLSearchParams();
      if (domainExportConfig.domain !== 'all') {
        params.append('domain', domainExportConfig.domain);
      }
      if (domainExportConfig.agentId !== 'all') {
        params.append('agentId', domainExportConfig.agentId);
      }
      params.append('format', domainExportConfig.format);

      const res = await fetch(`/api/admin/capabilities/export/domain?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const blob = new Blob([data.data.output], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = data.data.filename;
        a.click();
        URL.revokeObjectURL(downloadUrl);
      } else {
        alert('导出失败：' + data.error);
      }
    } catch (error) {
      console.error('Error exporting domain capabilities:', error);
      alert('导出失败');
    } finally {
      setExporting(null);
    }
  };

  // 导出所有能力
  const exportAllCapabilities = async () => {
    setExporting('all');
    try {
      const params = new URLSearchParams();
      params.append('format', allExportConfig.format);

      const res = await fetch(`/api/admin/capabilities/export/all?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const blob = new Blob([data.data.output], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = data.data.filename;
        a.click();
        URL.revokeObjectURL(downloadUrl);
      } else {
        alert('导出失败：' + data.error);
      }
    } catch (error) {
      console.error('Error exporting all capabilities:', error);
      alert('导出失败');
    } finally {
      setExporting(null);
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'json':
        return <FileJson className="h-5 w-5" />;
      case 'yaml':
        return <FileCode className="h-5 w-5" />;
      case 'toml':
        return <FileText className="h-5 w-5" />;
      default:
        return <FileJson className="h-5 w-5" />;
    }
  };

  const getFormatBadge = (format: string) => {
    switch (format) {
      case 'json':
        return <Badge variant="outline">JSON</Badge>;
      case 'yaml':
        return <Badge variant="outline">YAML</Badge>;
      case 'toml':
        return <Badge variant="outline">TOML</Badge>;
      default:
        return <Badge variant="outline">JSON</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/agent-builder">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">能力导出</h1>
              <p className="text-sm text-muted-foreground">导出 Agent 能力配置文件</p>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <Tabs defaultValue="base">
          <TabsList>
            <TabsTrigger value="base">
              <Zap className="mr-2 h-4 w-4" />
              基础能力
            </TabsTrigger>
            <TabsTrigger value="domain">
              <Layers className="mr-2 h-4 w-4" />
              领域能力
            </TabsTrigger>
            <TabsTrigger value="all">
              <Package className="mr-2 h-4 w-4" />
              完整能力包
            </TabsTrigger>
          </TabsList>

          {/* 基础能力导出 */}
          <TabsContent value="base" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* 导出配置 */}
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-semibold">导出配置</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Agent 筛选</label>
                    <Select
                      value={baseExportConfig.agentId}
                      onValueChange={(value) =>
                        setBaseExportConfig({ ...baseExportConfig, agentId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
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

                  <div>
                    <label className="mb-2 block text-sm font-medium">导出格式</label>
                    <Select
                      value={baseExportConfig.format}
                      onValueChange={(value) =>
                        setBaseExportConfig({ ...baseExportConfig, format: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">
                          <div className="flex items-center gap-2">
                            <FileJson className="h-4 w-4" />
                            JSON
                          </div>
                        </SelectItem>
                        <SelectItem value="yaml">
                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4" />
                            YAML
                          </div>
                        </SelectItem>
                        <SelectItem value="toml">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            TOML
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full"
                    onClick={exportBaseCapabilities}
                    disabled={exporting === 'base'}
                  >
                    {exporting === 'base' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        导出中...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        导出基础能力
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              {/* 说明 */}
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-semibold">说明</h2>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <h3 className="mb-2 font-medium text-foreground">基础能力</h3>
                    <p>
                      基础能力是 Agent 的核心能力，包括任务分解、协调能力、决策能力等。
                      这些能力由平台统一开发和维护，具有高复用性和稳定性。
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-2 font-medium text-foreground">导出格式</h3>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>JSON：通用格式，易于解析和处理</li>
                      <li>YAML：可读性好，适合作为配置文件</li>
                      <li>TOML：简洁清晰，适合技术配置</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 font-medium text-foreground">使用场景</h3>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>备份当前的基础能力配置</li>
                      <li>在不同环境之间迁移能力</li>
                      <li>分析和审计能力配置</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* 领域能力导出 */}
          <TabsContent value="domain" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* 导出配置 */}
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-semibold">导出配置</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">领域筛选</label>
                    <Select
                      value={domainExportConfig.domain}
                      onValueChange={(value) =>
                        setDomainExportConfig({ ...domainExportConfig, domain: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
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

                  <div>
                    <label className="mb-2 block text-sm font-medium">Agent 筛选</label>
                    <Select
                      value={domainExportConfig.agentId}
                      onValueChange={(value) =>
                        setDomainExportConfig({ ...domainExportConfig, agentId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
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

                  <div>
                    <label className="mb-2 block text-sm font-medium">导出格式</label>
                    <Select
                      value={domainExportConfig.format}
                      onValueChange={(value) =>
                        setDomainExportConfig({ ...domainExportConfig, format: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">
                          <div className="flex items-center gap-2">
                            <FileJson className="h-4 w-4" />
                            JSON
                          </div>
                        </SelectItem>
                        <SelectItem value="yaml">
                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4" />
                            YAML
                          </div>
                        </SelectItem>
                        <SelectItem value="toml">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            TOML
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full"
                    onClick={exportDomainCapabilities}
                    disabled={exporting === 'domain'}
                  >
                    {exporting === 'domain' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        导出中...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        导出领域能力
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              {/* 说明 */}
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-semibold">说明</h2>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <h3 className="mb-2 font-medium text-foreground">领域能力</h3>
                    <p>
                      领域能力是行业特定能力，由行业专家提供，支持热插拔和快速替换。
                      当前支持电商、金融、医疗等领域的领域能力。
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-2 font-medium text-foreground">支持领域</h3>
                    <div className="flex flex-wrap gap-2">
                      {domains.map((domain) => (
                        <Badge key={domain} variant="outline">
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 font-medium text-foreground">使用场景</h3>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>分发行业特定能力包</li>
                      <li>在能力市场发布能力</li>
                      <li>迁移到其他部署环境</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* 完整能力包导出 */}
          <TabsContent value="all" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* 导出配置 */}
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-semibold">导出配置</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">导出格式</label>
                    <Select
                      value={allExportConfig.format}
                      onValueChange={(value) =>
                        setAllExportConfig({ ...allExportConfig, format: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">
                          <div className="flex items-center gap-2">
                            <FileJson className="h-4 w-4" />
                            JSON
                          </div>
                        </SelectItem>
                        <SelectItem value="yaml">
                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4" />
                            YAML
                          </div>
                        </SelectItem>
                        <SelectItem value="toml">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            TOML
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full"
                    onClick={exportAllCapabilities}
                    disabled={exporting === 'all'}
                  >
                    {exporting === 'all' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        导出中...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        导出完整能力包
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              {/* 说明 */}
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-semibold">说明</h2>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <h3 className="mb-2 font-medium text-foreground">完整能力包</h3>
                    <p>
                      完整能力包包含所有 Agent 的基础能力和领域能力，适合完整的备份和迁移场景。
                      导出的文件包含元数据、校验和，确保数据完整性。
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-2 font-medium text-foreground">导出内容</h3>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>所有 Agent 的基础能力配置</li>
                      <li>所有领域的领域能力配置</li>
                      <li>元数据和版本信息</li>
                      <li>数据校验和</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 font-medium text-foreground">使用场景</h3>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>完整备份系统配置</li>
                      <li>迁移到新部署环境</li>
                      <li>版本控制和审计</li>
                      <li>灾难恢复</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>

            {/* 导出统计 */}
            <Card className="mt-6 p-6">
              <h2 className="mb-4 text-lg font-semibold">能力统计</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Zap className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">21</div>
                    <div className="text-sm text-muted-foreground">基础能力</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                    <Layers className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">22</div>
                    <div className="text-sm text-muted-foreground">领域能力</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <Package className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">43</div>
                    <div className="text-sm text-muted-foreground">总能力数</div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
