'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Package, CheckCircle, Loader2, ExternalLink } from 'lucide-react';

interface Package {
  id: string;
  name: string;
  description: string;
  size: string;
  downloadUrl: string;
}

export default function DownloadPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await fetch('/api/download');
      const data = await response.json();

      if (data.success) {
        setPackages(data.packages);
      } else {
        setError(data.error || '获取下载列表失败');
      }
    } catch (err: any) {
      setError(err.message || '网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (pkg: Package) => {
    try {
      const response = await fetch(pkg.downloadUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `agent-collaboration-system-${pkg.id}.tar.gz`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert('下载失败: ' + err.message);
    }
  };

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">正在准备下载包...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">出错了</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">{error}</p>
            <Button onClick={fetchPackages} className="mt-4">
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Agent 协作系统 - 代码下载
          </h1>
          <p className="text-lg text-slate-600">
            选择适合您的版本，一键下载完整代码
          </p>
        </div>

        <div className="grid gap-6">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      {pkg.name}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {pkg.description}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{pkg.size}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleDownload(pkg)}
                    className="flex-1"
                    size="lg"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    立即下载
                  </Button>
                  <Button
                    onClick={() => handleOpenUrl(pkg.downloadUrl)}
                    variant="outline"
                    size="lg"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-slate-900 mb-3">
              💡 使用说明
            </h3>
            <ul className="space-y-2 text-sm text-slate-700">
              <li>• <strong>完整项目</strong>：适合直接部署，包含所有依赖</li>
              <li>• <strong>源代码</strong>：适合开发环境，需要运行 pnpm install</li>
              <li>• <strong>纯净代码</strong>：适合代码审查或迁移，不包含 Git 历史</li>
              <li>• 下载链接有效期 7 天，过期后请重新生成</li>
              <li>• 解压命令：<code className="bg-slate-200 px-2 py-1 rounded">tar -xzf agent-collaboration-system-*.tar.gz</code></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
