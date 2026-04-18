'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, Plus, Edit, Trash2, Eye, Tag, Filter, 
  FileText, BarChart2, BookOpen, Quote, Play, CheckCircle,
  ChevronLeft, ChevronRight, X, Layers, List
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api/client';

// ==================== 类型定义 ====================
interface Material {
  id: string;
  title: string;
  type: MaterialType;
  content: string;
  sourceType: string;
  sourceDesc: string | null;
  sourceUrl: string | null;
  topicTags: string[];
  sceneTags: string[];
  emotionTags: string[];
  applicablePositions: string[];
  useCount: number;
  effectiveCount: number | null;
  ineffectiveCount: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

type MaterialType = 'case' | 'data' | 'story' | 'quote' | 'opening' | 'ending';

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ==================== 常量定义 ====================
const MATERIAL_TYPES: { value: MaterialType; label: string; icon: React.ReactNode }[] = [
  { value: 'case', label: '案例', icon: <FileText className="w-4 h-4" /> },
  { value: 'data', label: '数据', icon: <BarChart2 className="w-4 h-4" /> },
  { value: 'story', label: '故事', icon: <BookOpen className="w-4 h-4" /> },
  { value: 'quote', label: '引用', icon: <Quote className="w-4 h-4" /> },
  { value: 'opening', label: '开头', icon: <Play className="w-4 h-4" /> },
  { value: 'ending', label: '结尾', icon: <CheckCircle className="w-4 h-4" /> },
];

const STATUS_OPTIONS = [
  { value: 'active', label: '活跃' },
  { value: 'archived', label: '已归档' },
  { value: 'draft', label: '草稿' },
];

const SOURCE_TYPES = [
  { value: 'manual', label: '手动创建' },
  { value: 'article', label: '从文章提取' },
  { value: 'ai_generate', label: 'AI生成' },
  { value: 'import', label: '外部导入' },
];

// ==================== 工具函数 ====================
const getTypeInfo = (type: MaterialType) => {
  return MATERIAL_TYPES.find(t => t.value === type) || MATERIAL_TYPES[0];
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// ==================== 主组件 ====================
export default function MaterialsPage() {
  // 列表状态
  const [materials, setMaterials] = useState<Material[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 筛选状态
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 标签云数据
  const [tagCloud, setTagCloud] = useState<{ tag: string; count: number }[]>([]);
  const [tagType, setTagType] = useState<'topic' | 'scene' | 'emotion'>('topic');

  // 弹窗状态
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    type: 'case' as MaterialType,
    content: '',
    sourceType: 'manual',
    sourceDesc: '',
    sourceUrl: '',
    topicTags: [] as string[],
    sceneTags: [] as string[],
    emotionTags: [] as string[],
    applicablePositions: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // ==================== 数据加载 ====================
  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (filterType && filterType !== 'all') params.append('type', filterType);
      if (filterStatus) params.append('status', filterStatus);
      if (searchKeyword) params.append('search', searchKeyword);
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','));
        params.append('tagType', tagType);
      }
      params.append('page', pagination.page.toString());
      params.append('pageSize', pagination.pageSize.toString());

      const result = await apiGet(`/api/materials?${params.toString()}`) as Record<string, any>;

      if (result.success) {
        setMaterials(result.data.list);
        setPagination(prev => ({ ...prev, ...result.data.pagination }));
      } else {
        setError(result.error || '加载失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, searchKeyword, selectedTags, tagType, pagination.page, pagination.pageSize]);

  const fetchTagCloud = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('type', tagType);
      if (filterType && filterType !== 'all') params.append('materialType', filterType);

      const result = await apiGet(`/api/materials/tags?${params.toString()}`) as Record<string, any>;

      if (result.success) {
        setTagCloud(result.data);
      }
    } catch (e) {
      console.error('加载标签云失败:', e);
    }
  }, [tagType, filterType]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  useEffect(() => {
    fetchTagCloud();
  }, [fetchTagCloud]);

  // ==================== 事件处理 ====================
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchMaterials();
  };

  const handleReset = () => {
    setFilterType('');
    setFilterStatus('active');
    setSearchKeyword('');
    setSelectedTags([]);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // 打开创建弹窗
  const openCreateDialog = () => {
    setFormData({
      title: '',
      type: 'case',
      content: '',
      sourceType: 'manual',
      sourceDesc: '',
      sourceUrl: '',
      topicTags: [],
      sceneTags: [],
      emotionTags: [],
      applicablePositions: [],
    });
    setSelectedMaterial(null);
    setEditDialogOpen(true);
  };

  // 打开编辑弹窗
  const openEditDialog = (material: Material) => {
    setSelectedMaterial(material);
    setFormData({
      title: material.title,
      type: material.type,
      content: material.content,
      sourceType: material.sourceType,
      sourceDesc: material.sourceDesc || '',
      sourceUrl: material.sourceUrl || '',
      topicTags: material.topicTags || [],
      sceneTags: material.sceneTags || [],
      emotionTags: material.emotionTags || [],
      applicablePositions: material.applicablePositions || [],
    });
    setEditDialogOpen(true);
  };

  // 打开详情弹窗
  const openDetailDialog = (material: Material) => {
    setSelectedMaterial(material);
    setDetailDialogOpen(true);
  };

  // 打开删除确认弹窗
  const openDeleteDialog = (material: Material) => {
    setSelectedMaterial(material);
    setDeleteDialogOpen(true);
  };

  // 提交表单（创建/编辑）
  const handleSubmit = async () => {
    if (!formData.title || !formData.type || !formData.content) {
      setError('请填写必要字段：标题、类型、内容');
      return;
    }

    setFormLoading(true);
    try {
      const isEdit = !!selectedMaterial;
      const url = isEdit ? `/api/materials/${selectedMaterial.id}` : '/api/materials';

      const result = isEdit 
        ? await apiPut(url, formData) as Record<string, any>
        : await apiPost(url, formData) as Record<string, any>;

      if (result.success) {
        setEditDialogOpen(false);
        fetchMaterials();
      } else {
        setError(result.error || '保存失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setFormLoading(false);
    }
  };

  // 删除素材
  const handleDelete = async () => {
    if (!selectedMaterial) return;

    setFormLoading(true);
    try {
      const result = await apiDelete(`/api/materials/${selectedMaterial.id}?hard=true`) as Record<string, any>;
      if (result.success) {
        setDeleteDialogOpen(false);
        fetchMaterials();
      } else {
        setError(result.error || '删除失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setFormLoading(false);
    }
  };

  // 添加标签
  const handleAddTag = (field: 'topicTags' | 'sceneTags' | 'emotionTags') => {
    if (tagInput.trim()) {
      setFormData(prev => ({
        ...prev,
        [field]: [...(prev[field] as string[]), tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  // 移除标签
  const handleRemoveTag = (field: 'topicTags' | 'sceneTags' | 'emotionTags', tag: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter(t => t !== tag)
    }));
  };

  // ==================== 渲染 ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-sky-100/50 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 p-3 shadow-lg">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent">素材库管理</h1>
              <p className="text-muted-foreground mt-1">管理可复用的创作素材</p>
            </div>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            新建素材
          </Button>
        </div>

      {/* 搜索和筛选区域 */}
      <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 p-2 shadow-md">
              <Filter className="w-4 h-4 text-white" />
            </div>
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 关键词搜索 */}
            <div className="space-y-2">
              <Label>关键词搜索</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="搜索标题/内容..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="outline" size="icon" onClick={handleSearch}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 类型筛选 */}
            <div className="space-y-2">
              <Label>素材类型</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {MATERIAL_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 状态筛选 */}
            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 重置按钮 */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button variant="outline" onClick={handleReset} className="w-full">
                <X className="w-4 h-4 mr-2" />
                重置筛选
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 标签云 */}
      <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 p-2 shadow-md">
                <Tag className="w-4 h-4 text-white" />
              </div>
              标签云
            </CardTitle>
            <Tabs value={tagType} onValueChange={(v) => setTagType(v as 'topic' | 'scene' | 'emotion')}>
              <TabsList>
                <TabsTrigger value="topic">主题</TabsTrigger>
                <TabsTrigger value="scene">场景</TabsTrigger>
                <TabsTrigger value="emotion">情绪</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {tagCloud.length === 0 ? (
              <p className="text-muted-foreground text-sm">暂无标签数据</p>
            ) : (
              tagCloud.map(({ tag, count }) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => handleTagClick(tag)}
                >
                  {tag} ({count})
                </Badge>
              ))
            )}
          </div>
          {selectedTags.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">已选标签:</span>
              {selectedTags.map(tag => (
                <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleTagClick(tag)}>
                  {tag} <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 素材列表 */}
      <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 p-2 shadow-md">
              <List className="w-4 h-4 text-white" />
            </div>
            <CardTitle className="text-lg">素材列表</CardTitle>
          </div>
          <CardDescription>
            共 {pagination.total} 条素材
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : materials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无素材，点击右上角"新建素材"开始创建
            </div>
          ) : (
            <div className="space-y-4">
              {materials.map((material) => {
                const typeInfo = getTypeInfo(material.type);
                return (
                  <div
                    key={material.id}
                    className="border border-sky-100/50 bg-white/50 rounded-xl p-4 hover:border-sky-300 hover:bg-sky-50/50 transition-all shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="flex items-center gap-1">
                            {typeInfo.icon}
                            {typeInfo.label}
                          </Badge>
                          <span className="font-medium truncate">{material.title}</span>
                          {material.useCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              使用 {material.useCount} 次
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {material.content}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {material.topicTags?.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                          ))}
                          {material.topicTags?.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{material.topicTags.length - 3}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button variant="ghost" size="icon" onClick={() => openDetailDialog(material)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(material)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(material)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="icon"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">
                第 {pagination.page} / {pagination.totalPages} 页
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 详情弹窗 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>素材详情</DialogTitle>
          </DialogHeader>
          {selectedMaterial && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {/* 基本信息 */}
                <div>
                  <Label className="text-muted-foreground">标题</Label>
                  <p className="font-medium">{selectedMaterial.title}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground">类型</Label>
                    <p>{getTypeInfo(selectedMaterial.type).label}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">状态</Label>
                    <p>{STATUS_OPTIONS.find(s => s.value === selectedMaterial.status)?.label}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">来源</Label>
                    <p>{SOURCE_TYPES.find(s => s.value === selectedMaterial.sourceType)?.label}</p>
                  </div>
                </div>
                {selectedMaterial.sourceDesc && (
                  <div>
                    <Label className="text-muted-foreground">来源描述</Label>
                    <p>{selectedMaterial.sourceDesc}</p>
                  </div>
                )}

                <Separator />

                {/* 内容 */}
                <div>
                  <Label className="text-muted-foreground">素材内容</Label>
                  <div className="mt-2 p-4 bg-muted rounded-lg whitespace-pre-wrap">
                    {selectedMaterial.content}
                  </div>
                </div>

                <Separator />

                {/* 标签 */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground">主题标签</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedMaterial.topicTags?.map(tag => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">场景标签</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedMaterial.sceneTags?.map(tag => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">情绪标签</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedMaterial.emotionTags?.map(tag => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 使用统计 */}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label className="text-muted-foreground">使用次数</Label>
                    <p className="text-2xl font-bold">{selectedMaterial.useCount}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">有效次数</Label>
                    <p className="text-2xl font-bold text-green-600">{selectedMaterial.effectiveCount || 0}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">无效次数</Label>
                    <p className="text-2xl font-bold text-red-600">{selectedMaterial.ineffectiveCount || 0}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">最后使用</Label>
                    <p className="text-sm">{formatDate(selectedMaterial.lastUsedAt)}</p>
                  </div>
                </div>

                <Separator />

                {/* 时间信息 */}
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div>创建时间: {formatDate(selectedMaterial.createdAt)}</div>
                  <div>更新时间: {formatDate(selectedMaterial.updatedAt)}</div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* 编辑/创建弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedMaterial ? '编辑素材' : '新建素材'}</DialogTitle>
            <DialogDescription>
              {selectedMaterial ? '修改素材信息' : '创建新的可复用素材'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>标题 *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="素材标题"
                  />
                </div>
                <div className="space-y-2">
                  <Label>类型 *</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as MaterialType })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            {type.icon}
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 内容 */}
              <div className="space-y-2">
                <Label>内容 *</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="素材内容..."
                  rows={6}
                />
              </div>

              {/* 来源信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>来源类型</Label>
                  <Select value={formData.sourceType} onValueChange={(v) => setFormData({ ...formData, sourceType: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_TYPES.map(source => (
                        <SelectItem key={source.value} value={source.value}>
                          {source.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>来源描述</Label>
                  <Input
                    value={formData.sourceDesc}
                    onChange={(e) => setFormData({ ...formData, sourceDesc: e.target.value })}
                    placeholder="如：原创、XX报告、XX新闻"
                  />
                </div>
              </div>

              <Separator />

              {/* 标签编辑 */}
              <Tabs defaultValue="topic">
                <TabsList>
                  <TabsTrigger value="topic">主题标签</TabsTrigger>
                  <TabsTrigger value="scene">场景标签</TabsTrigger>
                  <TabsTrigger value="emotion">情绪标签</TabsTrigger>
                </TabsList>
                <TabsContent value="topic" className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="输入标签后回车添加"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag('topicTags'))}
                    />
                    <Button onClick={() => handleAddTag('topicTags')}>添加</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.topicTags.map(tag => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag('topicTags', tag)}>
                        {tag} <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="scene" className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="输入标签后回车添加"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag('sceneTags'))}
                    />
                    <Button onClick={() => handleAddTag('sceneTags')}>添加</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.sceneTags.map(tag => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag('sceneTags', tag)}>
                        {tag} <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="emotion" className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="输入标签后回车添加"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag('emotionTags'))}
                    />
                    <Button onClick={() => handleAddTag('emotionTags')}>添加</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.emotionTags.map(tag => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag('emotionTags', tag)}>
                        {tag} <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={formLoading}>
              {formLoading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除素材 "{selectedMaterial?.title}" 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={formLoading}>
              {formLoading ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
