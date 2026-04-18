'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, CheckCircle, TrendingUp, Activity, BarChart3, Zap } from 'lucide-react';

interface QualityMetrics {
  feedbackAuthenticity: number;
  predictionAccuracy: number;
  adoptionRate: number;
  vetoAdoptionRate: number;
  majorRiskAdoptionRate: number;
  optimizationAdoptionRate: number;
}

interface MonthlyReview {
  id: string;
  year: number;
  month: number;
  qualityMetrics: QualityMetrics;
  summary: {
    totalResearchCount: number;
    redLevelCount: number;
    yellowLevelCount: number;
    greenLevelCount: number;
    fastTrackCount: number;
  };
  status: 'pending' | 'approved' | 'rejected';
}

interface FastTrackStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  byType: Record<string, number>;
  averageDuration: number;
  successRate: number;
}

export default function OptimizationPage() {
  const [activeTab, setActiveTab] = useState('quality');
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [monthlyReviews, setMonthlyReviews] = useState<MonthlyReview[]>([]);
  const [fastTrackStats, setFastTrackStats] = useState<FastTrackStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 并行加载所有数据
      const [qualityRes, reviewsRes, fastTrackRes] = await Promise.all([
        fetch('/api/research-quality/aggregate'),
        fetch('/api/monthly-review'),
        fetch('/api/fast-track/stats'),
      ]);

      const qualityData = await qualityRes.json();
      const reviewsData = await reviewsRes.json();
      const fastTrackData = await fastTrackRes.json();

      if (qualityData.success) {
        setQualityMetrics(qualityData.data);
      }

      if (reviewsData.success) {
        setMonthlyReviews(reviewsData.data || []);
      }

      if (fastTrackData.success) {
        setFastTrackStats(fastTrackData.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />已通过</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />已驳回</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">待审批</Badge>;
    }
  };

  const getGradeBadge = (value: number, target: number) => {
    const percentage = (value / target) * 100;
    if (percentage >= 100) {
      return <span className="text-green-600 font-bold">{value}%</span>;
    } else if (percentage >= 80) {
      return <span className="text-yellow-600 font-bold">{value}%</span>;
    } else {
      return <span className="text-red-600 font-bold">{value}%</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Agent 协同优化系统</h1>
          <p className="text-gray-600">
            分级调研、动态验收、质量评估、快速通道
          </p>
        </div>

        {/* 总览卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">总调研次数</p>
                <p className="text-3xl font-bold text-gray-900">
                  {monthlyReviews.reduce((sum, r) => sum + r.summary.totalResearchCount, 0)}
                </p>
              </div>
              <BarChart3 className="w-10 h-10 text-blue-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">质量达标率</p>
                <p className="text-3xl font-bold text-gray-900">
                  {qualityMetrics ? Math.round(qualityMetrics.adoptionRate) : 0}%
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">快速通道</p>
                <p className="text-3xl font-bold text-gray-900">
                  {fastTrackStats?.total || 0}
                </p>
              </div>
              <Zap className="w-10 h-10 text-yellow-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">活跃执行</p>
                <p className="text-3xl font-bold text-gray-900">
                  {fastTrackStats?.active || 0}
                </p>
              </div>
              <Activity className="w-10 h-10 text-purple-600" />
            </div>
          </Card>
        </div>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="quality">质量评估</TabsTrigger>
            <TabsTrigger value="reviews">月度复盘</TabsTrigger>
            <TabsTrigger value="fasttrack">快速通道</TabsTrigger>
            <TabsTrigger value="graded">分级调研</TabsTrigger>
          </TabsList>

          {/* 质量评估 */}
          <TabsContent value="quality">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">调研质量指标</h2>
              {qualityMetrics ? (
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">调研反馈真实度</span>
                      <span className="text-sm text-gray-600">目标: ≥70%</span>
                    </div>
                    <Progress value={qualityMetrics.feedbackAuthenticity} className="h-3" />
                    <p className="text-right text-sm mt-1">
                      当前: {getGradeBadge(qualityMetrics.feedbackAuthenticity, 70)}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">调研预测准确性</span>
                      <span className="text-sm text-gray-600">目标: ≥80%</span>
                    </div>
                    <Progress value={qualityMetrics.predictionAccuracy} className="h-3" />
                    <p className="text-right text-sm mt-1">
                      当前: {getGradeBadge(qualityMetrics.predictionAccuracy, 80)}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">决策采纳率</span>
                      <span className="text-sm text-gray-600">目标: ≥60%</span>
                    </div>
                    <Progress value={qualityMetrics.adoptionRate} className="h-3" />
                    <p className="text-right text-sm mt-1">
                      当前: {getGradeBadge(qualityMetrics.adoptionRate, 60)}
                    </p>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium mb-3">细分指标</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-600">一票否决采纳率</p>
                        <p className="text-xl font-bold text-blue-600">{qualityMetrics.vetoAdoptionRate}%</p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-600">重大风险采纳率</p>
                        <p className="text-xl font-bold text-yellow-600">{qualityMetrics.majorRiskAdoptionRate}%</p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-600">优化建议采纳率</p>
                        <p className="text-xl font-bold text-green-600">{qualityMetrics.optimizationAdoptionRate}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">暂无质量数据</p>
              )}
            </Card>
          </TabsContent>

          {/* 月度复盘 */}
          <TabsContent value="reviews">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">月度复盘报告</h2>
                <Button onClick={loadData}>刷新</Button>
              </div>

              {monthlyReviews.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>月份</TableHead>
                      <TableHead>调研次数</TableHead>
                      <TableHead>分级分布</TableHead>
                      <TableHead>质量指标</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyReviews.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell className="font-medium">
                          {review.year}年{review.month}月
                        </TableCell>
                        <TableCell>{review.summary.totalResearchCount}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-red-600 border-red-600">
                              红{review.summary.redLevelCount}
                            </Badge>
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                              黄{review.summary.yellowLevelCount}
                            </Badge>
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              绿{review.summary.greenLevelCount}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>真实度: {review.qualityMetrics.feedbackAuthenticity}%</div>
                            <div>准确性: {review.qualityMetrics.predictionAccuracy}%</div>
                            <div>采纳率: {review.qualityMetrics.adoptionRate}%</div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(review.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  暂无复盘报告
                </div>
              )}
            </Card>
          </TabsContent>

          {/* 快速通道 */}
          <TabsContent value="fasttrack">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">快速通道统计</h2>
                <Button onClick={loadData}>刷新</Button>
              </div>

              {fastTrackStats ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded">
                      <p className="text-sm text-gray-600">总数</p>
                      <p className="text-2xl font-bold text-blue-600">{fastTrackStats.total}</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded">
                      <p className="text-sm text-gray-600">已完成</p>
                      <p className="text-2xl font-bold text-green-600">{fastTrackStats.completed}</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded">
                      <p className="text-sm text-gray-600">执行中</p>
                      <p className="text-2xl font-bold text-yellow-600">{fastTrackStats.active}</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded">
                      <p className="text-sm text-gray-600">已回滚</p>
                      <p className="text-2xl font-bold text-red-600">{fastTrackStats.failed}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600 mb-2">成功率</p>
                      <Progress value={fastTrackStats.successRate} className="h-4" />
                      <p className="text-right text-sm mt-1 font-bold">
                        {fastTrackStats.successRate}%
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600 mb-2">平均执行时长</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {Math.round(fastTrackStats.averageDuration / 60)} 分钟
                      </p>
                    </div>
                  </div>

                  {Object.keys(fastTrackStats.byType).length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="font-medium mb-3">按类型分布</h3>
                      <div className="flex gap-4">
                        {Object.entries(fastTrackStats.byType).map(([type, count]) => (
                          <Badge key={type} variant="outline" className="px-4 py-2">
                            {type}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-600">暂无快速通道数据</p>
              )}
            </Card>
          </TabsContent>

          {/* 分级调研 */}
          <TabsContent value="graded">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">分级调研说明</h2>

              <div className="space-y-6">
                <div className="p-4 border-l-4 border-red-500 bg-red-50 rounded-r">
                  <div className="flex items-center mb-2">
                    <Badge className="bg-red-100 text-red-800 mr-2">红色级</Badge>
                    <h3 className="font-bold text-red-900">高风险 - 全员详细调研</h3>
                  </div>
                  <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                    <li>调研范围：向所有执行层Agent（C/D/insurance-c/d）调研</li>
                    <li>调研深度：痛点、场景、风险、可行性4大维度全覆盖</li>
                    <li>调研耗时：2-3天</li>
                    <li>触发条件：核心拆解逻辑变更、跨赛道影响、架构调整等</li>
                  </ul>
                </div>

                <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 rounded-r">
                  <div className="flex items-center mb-2">
                    <Badge className="bg-yellow-100 text-yellow-800 mr-2">黄色级</Badge>
                    <h3 className="font-bold text-yellow-900">中风险 - 相关赛道标准调研</h3>
                  </div>
                  <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                    <li>调研范围：仅向相关赛道Agent调研</li>
                    <li>调研深度：场景、风险、可行性3大维度</li>
                    <li>调研耗时：1-2天</li>
                    <li>触发条件：单一赛道优化、流程调整、插件优化等</li>
                  </ul>
                </div>

                <div className="p-4 border-l-4 border-green-500 bg-green-50 rounded-r">
                  <div className="flex items-center mb-2">
                    <Badge className="bg-green-100 text-green-800 mr-2">绿色级</Badge>
                    <h3 className="font-bold text-green-900">低风险 - 简化调研</h3>
                  </div>
                  <ul className="list-disc list-inside text-sm text-green-800 space-y-1">
                    <li>调研范围：轻量问卷或豁免</li>
                    <li>调研深度：关键问题确认</li>
                    <li>调研耗时：0.5天</li>
                    <li>触发条件：文案优化、参数微调、Bug修复等</li>
                  </ul>
                </div>

                <div className="p-4 border-l-4 border-purple-500 bg-purple-50 rounded-r">
                  <div className="flex items-center mb-2">
                    <Badge className="bg-purple-100 text-purple-800 mr-2">⚡ 快速通道</Badge>
                    <h3 className="font-bold text-purple-900">紧急 - 关键问题确认</h3>
                  </div>
                  <ul className="list-disc list-inside text-sm text-purple-800 space-y-1">
                    <li>调研范围：仅向核心Agent调研</li>
                    <li>调研深度：关键问题确认</li>
                    <li>调研耗时：≤4小时</li>
                    <li>触发条件：Bug修复、业务紧急、监管要求</li>
                    <li>验收：72小时密集监控，每8小时检查一次</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
