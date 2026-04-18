'use client';

/**
 * 数字资产管理页面
 * Phase 3 MVP：风格规则 CRUD + 核心锚点历史查看
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api/client';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// ========== 类型定义 ==========

interface StyleRuleItem {
  id: string;
  ruleType: string;
  ruleContent: string;
  ruleCategory: string;
  sampleExtract?: string;
  confidence: number;
  priority: number;
  isActive: boolean;
  sourceType: string;
  createdAt: string;
}

interface AnchorAssetItem {
  id: string;
  anchorType: string;
  rawContent: string;
  usageCount: number;
  isEffective: boolean;
  createdAt: string;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  tone: '语气与句式习惯',
  vocabulary: '高频词/禁用词',
  logic: '思维逻辑和论证方式',
  emotion: '情感基调',
};

const RULE_CATEGORY_LABELS: Record<string, string> = {
  positive: '正向要求',
  negative: '禁止项',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  manual: '手工录入',
  auto_nlp: '自动提取',
  feedback: '反馈提取',
  llm_assist: 'LLM 辅助',
};

const ANCHOR_TYPE_LABELS: Record<string, string> = {
  opening_case: '开篇案例',
  core_viewpoint: '核心观点',
  ending_conclusion: '结尾结论',
};

// ========== 主组件 ==========

export default function DigitalAssetsPage() {
  // 状态管理
  const [styleRules, setStyleRules] = useState<StyleRuleItem[]>([]);
  const [anchors, setAnchors] = useState<AnchorAssetItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 筛选状态
  const [filterRuleType, setFilterRuleType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');

  // 创建/编辑对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<StyleRuleItem | null>(null);
  const [formData, setFormData] = useState({
    ruleType: 'tone' as string,
    ruleContent: '',
    ruleCategory: 'positive' as string,
    sampleExtract: '',
    priority: 2,
  });

  // 加载风格规则列表
  const fetchStyleRules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', 'style');
      if (filterRuleType !== 'all') params.set('ruleType', filterRuleType);
      if (filterCategory !== 'all') params.set('ruleCategory', filterCategory);
      if (filterActive !== 'all') params.set('isActive', filterActive);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const json = await apiGet(`/api/digital-assets?${params}`) as Record<string, any>;

      if (json.success) {
        setStyleRules(json.data || []);
        setTotal(json.total || 0);
      }
    } catch (error) {
      console.error('加载风格规则失败:', error);
    } finally {
      setLoading(false);
    }
  }, [filterRuleType, filterCategory, filterActive, page, pageSize]);

  // 加载核心锚点历史
  const fetchAnchors = useCallback(async () => {
    try {
      const json = await apiGet(`/api/digital-assets?type=anchor&pageSize=50`) as Record<string, any>;
      if (json.success) {
        setAnchors(json.data || []);
      }
    } catch (error) {
      console.error('加载核心锚点失败:', error);
    }
  }, []);

  useEffect(() => {
    fetchStyleRules();
  }, [fetchStyleRules]);

  useEffect(() => {
    fetchAnchors();
  }, [fetchAnchors]);

  // 创建/更新规则
  const handleSubmit = async () => {
    if (!formData.ruleContent.trim()) return;

    try {
      if (editingRule) {
        // 更新
        await apiPut(`/api/digital-assets/${editingRule.id}`, formData);
      } else {
        // 创建
        await apiPost('/api/digital-assets', { type: 'style', ...formData });
      }

      setDialogOpen(false);
      setEditingRule(null);
      setFormData({
        ruleType: 'tone',
        ruleContent: '',
        ruleCategory: 'positive',
        sampleExtract: '',
        priority: 2,
      });
      fetchStyleRules();
    } catch (error) {
      console.error('保存规则失败:', error);
    }
  };

  // 软删除规则
  const handleDelete = async (id: string) => {
    if (!confirm('确定要禁用这条规则吗？')) return;

    try {
      await apiDelete(`/api/digital-assets/${id}`);
      fetchStyleRules();
    } catch (error) {
      console.error('删除规则失败:', error);
    }
  };

  // 打开编辑对话框
  const openEditDialog = (rule?: StyleRuleItem) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        ruleType: rule.ruleType,
        ruleContent: rule.ruleContent,
        ruleCategory: rule.ruleCategory,
        sampleExtract: rule.sampleExtract || '',
        priority: rule.priority,
      });
    } else {
      setEditingRule(null);
      setFormData({
        ruleType: 'tone',
        ruleContent: '',
        ruleCategory: 'positive',
        sampleExtract: '',
        priority: 2,
      });
    }
    setDialogOpen(true);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">数字资产管理</h1>
        <p className="text-muted-foreground mt-1">
          管理用户专属风格规则、核心锚点资产、反馈记录。这些数据将自动注入 insurance-d 提示词。
        </p>
      </div>

      <Tabs defaultValue="style-rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="style-rules">风格规则</TabsTrigger>
          <TabsTrigger value="core-anchors">核心锚点历史</TabsTrigger>
        </TabsList>

        {/* 风格规则 Tab */}
        <TabsContent value="style-rules" className="space-y-4">
          {/* 操作栏 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                {/* 规则类型筛选 */}
                <Select value={filterRuleType} onValueChange={setFilterRuleType}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="规则类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="tone">语气与句式</SelectItem>
                    <SelectItem value="vocabulary">高频词/禁用词</SelectItem>
                    <SelectItem value="logic">思维逻辑</SelectItem>
                    <SelectItem value="emotion">情感基调</SelectItem>
                  </SelectContent>
                </Select>

                {/* 分类筛选 */}
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分类</SelectItem>
                    <SelectItem value="positive">正向要求</SelectItem>
                    <SelectItem value="negative">禁止项</SelectItem>
                  </SelectContent>
                </Select>

                {/* 状态筛选 */}
                <Select value={filterActive} onValueChange={setFilterActive}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="true">活跃</SelectItem>
                    <SelectItem value="false">已禁用</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex-1" />

                {/* 新建按钮 */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openEditDialog()}>+ 新建规则</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>{editingRule ? '编辑风格规则' : '新建风格规则'}</DialogTitle>
                      <DialogDescription>
                        {editingRule ? '修改现有风格规则的属性' : '创建一条新的风格规则，将注入 insurance-d 提示词'}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>规则类型</Label>
                          <Select
                            value={formData.ruleType}
                            onValueChange={(v) => setFormData((f) => ({ ...f, ruleType: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tone">语气与句式习惯</SelectItem>
                              <SelectItem value="vocabulary">高频词/禁用词</SelectItem>
                              <SelectItem value="logic">思维逻辑和论证方式</SelectItem>
                              <SelectItem value="emotion">情感基调</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>分类</Label>
                          <Select
                            value={formData.ruleCategory}
                            onValueChange={(v) => setFormData((f) => ({ ...f, ruleCategory: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="positive">正向要求（应该做）</SelectItem>
                              <SelectItem value="negative">禁止项（不该做）</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>规则内容 *</Label>
                        <Textarea
                          value={formData.ruleContent}
                          onChange={(e) => setFormData((f) => ({ ...f, ruleContent: e.target.value }))}
                          placeholder="例如：使用第一人称「我」，称呼用户为「你/咱们」"
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>示例摘录（可选）</Label>
                        <Input
                          value={formData.sampleExtract}
                          onChange={(e) => setFormData((f) => ({ ...f, sampleExtract: e.target.value }))}
                          placeholder="来源样本中的示例文本"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>优先级（1=最高）</Label>
                        <Select
                          value={String(formData.priority)}
                          onValueChange={(v) => setFormData((f) => ({ ...f, priority: parseInt(v) }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - 最高优先级</SelectItem>
                            <SelectItem value="2">2 - 高优先级</SelectItem>
                            <SelectItem value="3">3 - 中优先级</SelectItem>
                            <SelectItem value="4">4 - 低优先级</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={handleSubmit} disabled={!formData.ruleContent.trim()}>
                        {editingRule ? '保存修改' : '创建'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* 规则列表 */}
          <Card>
            <CardHeader>
              <CardTitle>风格规则列表</CardTitle>
              <CardDescription>
                共 {total} 条规则 · 第 {page}/{totalPages || 1} 页
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">加载中...</div>
              ) : styleRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无风格规则。
                  <br />
                  点击&quot;+ 新建规则&quot;添加第一条规则，它将被自动注入 insurance-d 提示词。
                </div>
              ) : (
                <div className="space-y-3">
                  {styleRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`flex items-start gap-4 p-4 rounded-lg border ${
                        !rule.isActive ? 'opacity-50 bg-muted' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={rule.ruleCategory === 'negative' ? 'destructive' : 'default'}>
                            {RULE_CATEGORY_LABELS[rule.ruleCategory] || rule.ruleCategory}
                          </Badge>
                          <Badge variant="outline">{RULE_TYPE_LABELS[rule.ruleType] || rule.ruleType}</Badge>
                          <Badge variant="secondary">{SOURCE_TYPE_LABELS[rule.sourceType] || rule.sourceType}</Badge>
                          {!rule.isActive && <Badge variant="outline">已禁用</Badge>}
                          <span className="text-xs text-muted-foreground ml-auto">
                            优先级 {rule.priority}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{rule.ruleContent}</p>
                        {rule.sampleExtract && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            示例：{rule.sampleExtract}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          创建于 {new Date(rule.createdAt).toLocaleDateString('zh-CN')}
                          {rule.confidence > 0 && ` · 置信度 ${Math.round(rule.confidence * 100)}%`}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(rule)}>
                          编辑
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(rule.id)}>
                          {rule.isActive ? '禁用' : '启用'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 核心锚点 Tab */}
        <TabsContent value="core-anchors">
          <Card>
            <CardHeader>
              <CardTitle>核心锚点归档历史</CardTitle>
              <CardDescription>
                insurance-d 执行时使用的核心锚点数据自动归档记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              {anchors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无核心锚点归档记录。
                  <br />
                  当 insurance-d 完成文章创作后，系统会自动将 userOpinion 和结构选择归档到此处。
                </div>
              ) : (
                <div className="space-y-3">
                  {anchors.map((anchor) => (
                    <div key={anchor.id} className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{ANCHOR_TYPE_LABELS[anchor.anchorType] || anchor.anchorType}</Badge>
                        <span className="text-xs text-muted-foreground">
                          使用 {anchor.usageCount} 次 · {new Date(anchor.createdAt).toLocaleDateString('zh-CN')}
                        </span>
                        {!anchor.isEffective && <Badge variant="destructive">无效</Badge>}
                      </div>
                      <p className="text-sm mt-1 line-clamp-3">{anchor.rawContent}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
