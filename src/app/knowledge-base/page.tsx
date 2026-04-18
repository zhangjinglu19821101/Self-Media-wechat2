'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, Search, Database, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function KnowledgeBasePage() {
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('text');
  const [textContent, setTextContent] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [metadata, setMetadata] = useState({
    title: '',
    document_type: 'compliance_rules',
    platform: 'wechat',
    category: '合规规则',
    version: '1.0'
  });
  const [collectionName, setCollectionName] = useState('wechat_compliance_rules');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stats, setStats] = useState<any>(null);

  // 加载统计数据
  const loadStats = async () => {
    try {
      const response = await fetch('/api/rag/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setMetadata(prev => ({ ...prev, title: file.name }));

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
    };
    reader.readAsText(file);
  };

  // 导入文档
  const handleImport = async (content: string, source: string) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/rag/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: content,
          metadata: {
            source,
            title: metadata.title || source,
            document_type: metadata.document_type,
            platform: metadata.platform,
            category: metadata.category,
            version: metadata.version,
            created_date: new Date().toISOString(),
          },
          collectionName,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: `✅ 导入成功！文档已分块为 ${data.chunkCount} 个片段`,
        });
        setTextContent('');
        setFileContent('');
        setFileName('');
        loadStats();
      } else {
        setMessage({
          type: 'error',
          text: `❌ 导入失败：${data.error}`,
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `❌ 导入失败：${error instanceof Error ? error.message : '未知错误'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // 初始加载统计
  useState(() => {
    loadStats();
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">知识库管理</h1>
        <p className="text-muted-foreground">
          上传和管理您的文档，支持向量检索和Agent调用
        </p>
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总文档数</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDocuments || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总分块数</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalChunks || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collection数</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.collections ? Object.keys(stats.collections).length : 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Collection 详情 */}
      {stats && stats.collections && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Collection 详情</CardTitle>
            <CardDescription>各个知识库集合的统计信息</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.collections).map(([name, info]: [string, any]) => (
                <div key={name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-sm text-muted-foreground">
                      {info.documentCount} 文档 · {info.chunkCount} 分块
                    </div>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 上传文档 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            上传文档到知识库
          </CardTitle>
          <CardDescription>
            支持上传文本文件或直接粘贴文本内容
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="text" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text" onClick={() => setUploadMode('text')}>
                粘贴文本
              </TabsTrigger>
              <TabsTrigger value="file" onClick={() => setUploadMode('file')}>
                上传文件
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <div>
                <Label htmlFor="textContent">文档内容</Label>
                <Textarea
                  id="textContent"
                  placeholder="粘贴您的文档内容..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={10}
                  className="mt-2"
                />
              </div>
              <Button
                onClick={() => handleImport(textContent, 'manual_input')}
                disabled={!textContent || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    导入中...
                  </>
                ) : (
                  '导入文档'
                )}
              </Button>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div>
                <Label htmlFor="fileInput">选择文件</Label>
                <Input
                  id="fileInput"
                  type="file"
                  accept=".txt,.md,.json"
                  onChange={handleFileUpload}
                  className="mt-2"
                />
              </div>

              {fileName && (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    已选择文件：{fileName} ({fileContent.length} 字符)
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={() => handleImport(fileContent, fileName)}
                disabled={!fileContent || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    导入中...
                  </>
                ) : (
                  '导入文件'
                )}
              </Button>
            </TabsContent>
          </Tabs>

          {/* Metadata 表单 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="collectionName">Collection 名称</Label>
              <Input
                id="collectionName"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                className="mt-2"
                placeholder="例如：wechat_compliance_rules"
              />
            </div>
            <div>
              <Label htmlFor="title">文档标题</Label>
              <Input
                id="title"
                value={metadata.title}
                onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
                className="mt-2"
                placeholder="文档标题"
              />
            </div>
            <div>
              <Label htmlFor="documentType">文档类型</Label>
              <Input
                id="documentType"
                value={metadata.document_type}
                onChange={(e) => setMetadata(prev => ({ ...prev, document_type: e.target.value }))}
                className="mt-2"
                placeholder="compliance_rules"
              />
            </div>
            <div>
              <Label htmlFor="platform">平台</Label>
              <Input
                id="platform"
                value={metadata.platform}
                onChange={(e) => setMetadata(prev => ({ ...prev, platform: e.target.value }))}
                className="mt-2"
                placeholder="wechat"
              />
            </div>
            <div>
              <Label htmlFor="category">分类</Label>
              <Input
                id="category"
                value={metadata.category}
                onChange={(e) => setMetadata(prev => ({ ...prev, category: e.target.value }))}
                className="mt-2"
                placeholder="合规规则"
              />
            </div>
            <div>
              <Label htmlFor="version">版本</Label>
              <Input
                id="version"
                value={metadata.version}
                onChange={(e) => setMetadata(prev => ({ ...prev, version: e.target.value }))}
                className="mt-2"
                placeholder="1.0"
              />
            </div>
          </div>

          {/* 消息提示 */}
          {message && (
            <Alert className={`mt-4 ${message.type === 'success' ? 'border-green-500' : 'border-red-500'}`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 快速上传微信公众号合规规则 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>快速导入</CardTitle>
          <CardDescription>快速导入预配置的文档</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="font-medium">微信公众号合规规则</div>
              <div className="text-sm text-muted-foreground">
                路径：./backup/download_log/AgentB/公众号合规规则合并.md
              </div>
            </div>
            <Button
              onClick={async () => {
                try {
                  const response = await fetch('/api/wechat-rules/import');
                  const data = await response.json();
                  if (data.success) {
                    setMessage({
                      type: 'success',
                      text: `✅ 导入成功！文档已分块为 ${data.chunkCount} 个片段`,
                    });
                    loadStats();
                  } else {
                    setMessage({
                      type: 'error',
                      text: `❌ 导入失败：${data.error}`,
                    });
                  }
                } catch (error) {
                  setMessage({
                    type: 'error',
                    text: `❌ 导入失败：${error instanceof Error ? error.message : '未知错误'}`,
                  });
                }
              }}
            >
              一键导入
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
