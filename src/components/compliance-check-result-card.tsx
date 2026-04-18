'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ShieldCheck,
  RefreshCw,
  Loader2,
} from 'lucide-react';

interface ComplianceIssue {
  type: 'critical' | 'warning' | 'info';
  category: string;
  location?: string;
  description: string;
  suggestion: string;
}

interface ComplianceCheckResult {
  isCompliant: boolean;
  score: number;
  summary: string;
  issues: ComplianceIssue[];
  recommendations: string[];
}

interface ComplianceCheckResultProps {
  taskId: string;
  onRefresh?: () => void;
}

export function ComplianceCheckResultCard({ taskId, onRefresh }: ComplianceCheckResultProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ComplianceCheckResult | null>(null);
  const [complianceTaskId, setComplianceTaskId] = useState<string>('');
  const [articleTitle, setArticleTitle] = useState<string>('');
  const [error, setError] = useState<string>('');

  const loadResult = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/agents/compliance/check-result/${taskId}`);

      const data = await response.json();

      if (data.success) {
        setResult(data.data.complianceResult);
        setComplianceTaskId(data.data.complianceTaskId);
        setArticleTitle(data.data.articleTitle || '');
      } else {
        setError(data.error || '获取校验结果失败');
      }
    } catch (err) {
      setError('获取校验结果失败');
      console.error('Error loading compliance result:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResult();
  }, [taskId]);

  const handleRefresh = () => {
    loadResult();
    if (onRefresh) {
      onRefresh();
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 75) return 'bg-blue-100 text-blue-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getIssueBadge = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'info':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">正在加载合规校验结果...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <XCircle className="h-8 w-8 text-red-500" />
          <span className="ml-2 text-muted-foreground">{error}</span>
        </div>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Info className="h-8 w-8 text-gray-500" />
          <span className="ml-2 text-muted-foreground">暂无合规校验结果</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* 头部 */}
      <div className="border-b bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            <div>
              <h3 className="font-semibold">Agent B 合规校验结果</h3>
              {articleTitle && (
                <p className="text-sm text-muted-foreground mt-1">
                  文章：{articleTitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-lg font-bold ${getScoreBadge(result.score)}`}>
              {result.score} 分
            </Badge>
            <Button variant="ghost" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 内容 */}
      <ScrollArea className="h-auto max-h-[600px]">
        <div className="p-4 space-y-4">
          {/* 总体评价 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              {result.isCompliant ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className={`font-semibold ${getScoreColor(result.score)}`}>
                {result.isCompliant ? '合规' : '不合规'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{result.summary}</p>
          </div>

          {/* 问题列表 */}
          {result.issues && result.issues.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                检查到的问题 ({result.issues.length})
              </h4>
              <div className="space-y-3">
                {result.issues.map((issue, index) => (
                  <Card key={index} className="p-3 border-l-4" style={{
                    borderLeftColor: issue.type === 'critical' ? '#ef4444' :
                                    issue.type === 'warning' ? '#eab308' : '#3b82f6'
                  }}>
                    <div className="flex items-start gap-2 mb-2">
                      {getIssueIcon(issue.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getIssueBadge(issue.type)}>
                            {issue.type === 'critical' ? '严重' :
                             issue.type === 'warning' ? '警告' : '提示'}
                          </Badge>
                          <Badge variant="outline">{issue.category}</Badge>
                          {issue.location && (
                            <span className="text-xs text-muted-foreground">{issue.location}</span>
                          )}
                        </div>
                        <p className="text-sm">{issue.description}</p>
                      </div>
                    </div>
                    {issue.suggestion && (
                      <div className="mt-2 pl-7">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold">建议：</span>{issue.suggestion}
                        </p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 改进建议 */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Info className="h-4 w-4" />
                改进建议
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {result.recommendations.map((rec, index) => (
                  <li key={index} className="text-muted-foreground">{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 校验任务ID */}
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              校验任务ID: {complianceTaskId}
            </p>
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
}
