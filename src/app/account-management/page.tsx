'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api/client';
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
  Palette,
  Users,
  Plus,
  Trash2,
  Link2,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Settings,
  Globe,
  Scissors,
  BookOpen,
  FileText,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Sliders,
  Save,
  X,
} from 'lucide-react';
import { PLATFORM_LABELS, PLATFORM_TYPES, PLATFORM_CONFIG_FIELDS } from '@/lib/db/schema/style-template';
import type { PlatformConfig } from '@/lib/db/schema/style-template';

// 类型定义
interface StyleTemplate {
  id: string;
  name: string;
  description: string | null;
  ruleCount: number;
  articleCount: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PlatformAccount {
  id: string;
  platform: string;
  platformLabel: string | null;
  accountName: string;
  accountId: string | null;
  accountDescription: string | null;
  platformConfig: PlatformConfig | null;
  isActive: boolean;
  createdAt: string;
}

interface AccountConfig {
  account: PlatformAccount;
  template: StyleTemplate | null;
}

export default function AccountManagementPage() {
  // 状态
  const [templates, setTemplates] = useState<StyleTemplate[]>([]);
  const [accountConfigs, setAccountConfigs] = useState<AccountConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 新建模板对话框
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  
  // 新建账号对话框
  const [newAccountPlatform, setNewAccountPlatform] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountDesc, setNewAccountDesc] = useState('');
  const [newAccountTemplateId, setNewAccountTemplateId] = useState('');
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  
  // 编辑绑定对话框
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [editTemplateId, setEditTemplateId] = useState('');
  const [editBindOpen, setEditBindOpen] = useState(false);

  // 平台专属配置：折叠/展开 + 编辑
  const [expandedConfigId, setExpandedConfigId] = useState<string | null>(null);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<Record<string, string | string[]>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesData, accountsData] = await Promise.all([
        apiGet('/api/style-templates'),
        apiGet('/api/platform-accounts'),
      ]);
      
      const tData = templatesData as Record<string, any>;
      const aData = accountsData as Record<string, any>;
      
      if (tData.success) {
        setTemplates(tData.data || []);
      }
      if (aData.success) {
        setAccountConfigs(aData.data || []);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 创建模板
  const handleCreateTemplate = useCallback(async () => {
    if (!newTemplateName.trim()) {
      alert('请输入模板名称');
      return;
    }
    
    setSaving(true);
    try {
      const data = await apiPost('/api/style-templates', {
          name: newTemplateName,
          description: newTemplateDesc,
          isDefault: templates.length === 0,
        }) as Record<string, any>;
      
      if (data.success) {
        setTemplates(prev => [...prev, data.data]);
        setCreateTemplateOpen(false);
        setNewTemplateName('');
        setNewTemplateDesc('');
      } else {
        alert(data.error || '创建失败');
      }
    } catch (error) {
      console.error('创建模板失败:', error);
      alert('创建失败');
    } finally {
      setSaving(false);
    }
  }, [newTemplateName, newTemplateDesc, templates.length]);

  // 创建账号
  const handleCreateAccount = useCallback(async () => {
    if (!newAccountPlatform || !newAccountName.trim()) {
      alert('请选择平台并输入账号名称');
      return;
    }
    
    setSaving(true);
    try {
      const data = await apiPost('/api/platform-accounts', {
          platform: newAccountPlatform,
          accountName: newAccountName,
          accountDescription: newAccountDesc,
          templateId: newAccountTemplateId || undefined,
        }) as Record<string, any>;
      
      if (data.success) {
        loadData(); // 重新加载
        setCreateAccountOpen(false);
        setNewAccountPlatform('');
        setNewAccountName('');
        setNewAccountDesc('');
        setNewAccountTemplateId('');
      } else {
        alert(data.error || '创建失败');
      }
    } catch (error) {
      console.error('创建账号失败:', error);
      alert('创建失败');
    } finally {
      setSaving(false);
    }
  }, [newAccountPlatform, newAccountName, newAccountDesc, newAccountTemplateId, loadData]);

  // 绑定账号到模板
  const handleBindTemplate = useCallback(async () => {
    if (!editAccountId || !editTemplateId) {
      alert('请选择要绑定的模板');
      return;
    }
    
    setSaving(true);
    try {
      const data = await apiPost('/api/platform-accounts/bind-template', {
          accountId: editAccountId,
          templateId: editTemplateId,
        }) as Record<string, any>;
      
      if (data.success) {
        loadData(); // 重新加载
        setEditBindOpen(false);
        setEditAccountId(null);
        setEditTemplateId('');
      } else {
        alert(data.error || '绑定失败');
      }
    } catch (error) {
      console.error('绑定失败:', error);
      alert('绑定失败');
    } finally {
      setSaving(false);
    }
  }, [editAccountId, editTemplateId, loadData]);

  // 删除模板
  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    if (!confirm('确定要删除这个模板吗？关联的风格规则将保留但不绑定模板。')) {
      return;
    }
    
    try {
      const data = await apiDelete(`/api/style-templates/${templateId}`) as Record<string, any>;
      
      if (data.success) {
        setTemplates(prev => prev.filter(t => t.id !== templateId));
        loadData(); // 重新加载账号配置
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  }, [loadData]);

  // 设为默认模板
  const handleSetDefault = useCallback(async (templateId: string) => {
    try {
      const data = await apiPut(`/api/style-templates/${templateId}`, { isDefault: true }) as Record<string, any>;
      
      if (data.success) {
        setTemplates(prev => prev.map(t => ({
          ...t,
          isDefault: t.id === templateId,
        })));
      } else {
        alert(data.error || '设置失败');
      }
    } catch (error) {
      console.error('设置默认模板失败:', error);
      alert('设置失败');
    }
  }, []);

  // 删除账号
  const handleDeleteAccount = useCallback(async (accountId: string, accountName: string) => {
    if (!confirm(`确定要删除账号「${accountName}」吗？\n\n删除后，该账号的模板绑定关系也会解除。`)) {
      return;
    }
    
    try {
      const data = await apiDelete(`/api/platform-accounts/${accountId}`) as Record<string, any>;
      
      if (data.success) {
        loadData(); // 重新加载
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除账号失败:', error);
      alert('删除失败');
    }
  }, [loadData]);

  // 切换平台配置折叠/展开
  const handleToggleConfig = useCallback((accountId: string) => {
    setExpandedConfigId(prev => prev === accountId ? null : accountId);
    setEditingConfigId(null);
  }, []);

  // 开始编辑平台配置
  const handleStartEditConfig = useCallback((accountId: string, platform: string, currentConfig: PlatformConfig | null) => {
    const platformConfig = (currentConfig as Record<string, any>)?.[platform] || {};
    // 归一化：空字符串 '' → undefined，避免被计入"已配置"
    const normalized: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(platformConfig)) {
      if (v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)) {
        normalized[k] = v as string | string[];
      }
    }
    setConfigDraft(normalized);
    setEditingConfigId(accountId);
  }, []);

  // 保存平台配置
  const handleSaveConfig = useCallback(async (accountId: string, platform: string) => {
    setSavingConfig(true);
    try {
      const updatePayload: PlatformConfig = {};
      (updatePayload as Record<string, any>)[platform] = configDraft;

      const data = await apiPut(`/api/platform-accounts/${accountId}`, {
        platformConfig: updatePayload,
      }) as Record<string, any>;

      if (data.success) {
        setEditingConfigId(null);
        loadData();
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存平台配置失败:', error);
      alert('保存失败');
    } finally {
      setSavingConfig(false);
    }
  }, [configDraft, loadData]);

  // 计算账号已配置的平台专属项数（非空值才算已配置）
  const getConfiguredCount = useCallback((account: PlatformAccount) => {
    const config = account.platformConfig as Record<string, any> | null;
    if (!config) return 0;
    const platformConfig = config[account.platform];
    if (!platformConfig || typeof platformConfig !== 'object') return 0;
    return Object.entries(platformConfig as Record<string, any>).filter(([k, v]) => {
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
    }).length;
  }, []);

  // 获取平台配置字段总数（安全处理无效平台）
  const getTotalConfigFields = useCallback((platform: string) => {
    const fields = PLATFORM_CONFIG_FIELDS[platform as keyof typeof PLATFORM_CONFIG_FIELDS];
    return fields?.length || 0;
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="w-7 h-7 text-sky-500" />
              风格模板与发布平台管理
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              管理风格模板，将模板绑定到不同平台的账号
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              size="sm" 
              asChild
              className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg shadow-violet-200/50"
            >
              <Link href="/full-home?tab=split">
                <Scissors className="w-4 h-4 mr-2" />
                任务拆解
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：风格模板列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-sky-500" />
                  风格模板
                </span>
                <Dialog open={createTemplateOpen} onOpenChange={setCreateTemplateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      新建模板
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>创建风格模板</DialogTitle>
                      <DialogDescription>
                        风格模板是一组风格规则的集合，可以绑定到多个账号
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium">模板名称 *</label>
                        <Input
                          placeholder="例如：专业严谨、轻松活泼"
                          value={newTemplateName}
                          onChange={(e) => setNewTemplateName(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">模板描述</label>
                        <Input
                          placeholder="适用场景、风格特点等"
                          value={newTemplateDesc}
                          onChange={(e) => setNewTemplateDesc(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateTemplateOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={handleCreateTemplate} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                        创建
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardTitle>
              <CardDescription>
                风格模板是一组风格规则的集合，用于统一管理写作风格
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Palette className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>暂无风格模板</p>
                  <p className="text-xs mt-1">创建模板后可绑定到账号</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{template.name}</span>
                          {template.isDefault && (
                            <Badge variant="default" className="text-xs">默认</Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">{template.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link 
                                href={`/digital-assets?templateId=${template.id}`} 
                                className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold
                                         text-slate-600 hover:text-sky-700 
                                         bg-slate-50 hover:bg-sky-50
                                         border border-slate-200 hover:border-sky-300
                                         shadow-sm hover:shadow-[0_2px_8px_rgba(56,189,248,0.12)]
                                         active:scale-[0.98]
                                         transition-all duration-250"
                              >
                                <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-sky-500 group-hover:scale-110 transition-all" />
                                <span className="text-slate-700 group-hover:text-sky-800">{template.ruleCount}</span>
                                <span className="text-slate-400 group-hover:text-sky-500">条规则</span>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              查看规则列表
                            </TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link 
                                href={`/style-init?templateId=${template.id}`}
                                className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold
                                          transition-all duration-250
                                          ${template.articleCount > 0 
                                            ? 'text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 shadow-sm hover:shadow-[0_2px_8px_rgba(16,185,129,0.12)]' 
                                            : 'text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-[0_2px_8px_rgba(148,163,184,0.1)]'
                                          } active:scale-[0.98]`}
                              >
                                <FileText className={`w-4 h-4 transition-all ${template.articleCount > 0 ? 'text-slate-400 group-hover:text-emerald-500 group-hover:scale-110' : 'text-slate-300 group-hover:text-slate-500'}`} />
                                <span className={`${template.articleCount > 0 ? 'text-slate-700 group-hover:text-emerald-800' : 'text-slate-600 group-hover:text-slate-800'}`}>
                                  {template.articleCount}
                                </span>
                                <span className={`${template.articleCount > 0 ? 'text-slate-400 group-hover:text-emerald-500' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                  篇分析
                                </span>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {template.articleCount > 0 ? '查看分析文章' : '添加分析文章'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!template.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(template.id)}
                            title="设为默认"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 右侧：平台账号列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-500" />
                  平台账号
                </span>
                <Dialog open={createAccountOpen} onOpenChange={setCreateAccountOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      新建账号
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>添加平台账号</DialogTitle>
                      <DialogDescription>
                        添加你的各平台账号，并绑定到对应的风格模板
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium">平台 *</label>
                        <Select value={newAccountPlatform} onValueChange={setNewAccountPlatform}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="选择平台" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">账号名称 *</label>
                        <Input
                          placeholder="例如：保险科普小助手"
                          value={newAccountName}
                          onChange={(e) => setNewAccountName(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">账号描述</label>
                        <Input
                          placeholder="账号定位、内容方向等"
                          value={newAccountDesc}
                          onChange={(e) => setNewAccountDesc(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">绑定风格模板</label>
                        <Select value={newAccountTemplateId} onValueChange={setNewAccountTemplateId}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="选择模板（可选）" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name} {t.isDefault ? '(默认)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateAccountOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={handleCreateAccount} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                        创建
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardTitle>
              <CardDescription>
                各平台的账号，每个账号可绑定一个风格模板
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : accountConfigs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>暂无平台账号</p>
                  <p className="text-xs mt-1">添加账号后可绑定风格模板</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {accountConfigs.map(({ account, template }) => {
                    const isExpanded = expandedConfigId === account.id;
                    const isEditing = editingConfigId === account.id;
                    const configuredCount = getConfiguredCount(account);
                    const totalFields = getTotalConfigFields(account.platform);
                    const platformFields = PLATFORM_CONFIG_FIELDS[account.platform as keyof typeof PLATFORM_CONFIG_FIELDS] || [];
                    const currentPlatformConfig = (account.platformConfig as Record<string, any> | null)?.[account.platform] || {};

                    return (
                      <div
                        key={account.id}
                        className="rounded-lg border bg-white hover:bg-slate-50 transition-colors overflow-hidden"
                      >
                        {/* 账号基本信息行 */}
                        <div className="flex items-center justify-between p-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {PLATFORM_LABELS[account.platform as keyof typeof PLATFORM_LABELS] || account.platform}
                              </Badge>
                              <span className="font-medium">{account.accountName}</span>
                            </div>
                            {account.accountDescription && (
                              <p className="text-sm text-muted-foreground mt-0.5">{account.accountDescription}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                              {template ? (
                                <div className="flex items-center gap-2">
                                  <Link2 className="w-3.5 h-3.5 text-sky-500" />
                                  <span className="text-xs text-slate-500">绑定模板:</span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Link 
                                        href={`/digital-assets?templateId=${template.id}`}
                                        className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold
                                                 text-sky-700 hover:text-sky-800 
                                                 bg-sky-50 hover:bg-sky-100
                                                 border border-sky-200 hover:border-sky-300
                                                 shadow-sm hover:shadow-[0_2px_8px_rgba(56,189,248,0.15)]
                                                 active:scale-[0.98]
                                                 transition-all duration-250"
                                      >
                                        {template.name}
                                        <ArrowUpRight className="w-3.5 h-3.5 text-sky-500 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                                      </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">
                                      查看模板详情
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              ) : (
                                <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 shadow-sm">
                                  未绑定模板
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditAccountId(account.id);
                                setEditTemplateId(template?.id || '');
                                setEditBindOpen(true);
                              }}
                            >
                              <Link2 className="w-4 h-4 mr-1" />
                              {template ? '更换' : '绑定'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAccount(account.id, account.accountName)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="删除账号"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* 平台专属配置折叠区域 */}
                        <div className="border-t border-dashed border-slate-200">
                          <button
                            onClick={() => handleToggleConfig(account.id)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50/50 transition-colors"
                          >
                            <span className="flex items-center gap-1.5 text-slate-500">
                              <Sliders className="w-3.5 h-3.5" />
                              平台专属配置
                              {configuredCount > 0 ? (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                                  已配置 {configuredCount}/{totalFields}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-slate-50 text-slate-400 border-slate-200">
                                  未配置
                                </Badge>
                              )}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </button>

                          {/* 展开的配置内容 */}
                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-3">
                              {platformFields.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                  该平台暂无专属配置项
                                </p>
                              ) : isEditing ? (
                                /* 编辑模式 */
                                <div className="space-y-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                                  {platformFields.map((field) => (
                                    <div key={field.key}>
                                      <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                                        {field.label}
                                        {field.description && (
                                          <span className="text-[10px] text-slate-400 font-normal">({field.description})</span>
                                        )}
                                      </label>
                                      {field.type === 'select' && field.options ? (
                                        <Select
                                          value={(configDraft[field.key] as string | undefined) ?? ''}
                                          onValueChange={(v) => setConfigDraft(prev => ({ ...prev, [field.key]: v }))}
                                        >
                                          <SelectTrigger className="mt-1 h-8 text-xs">
                                            <SelectValue placeholder={`选择${field.label}`} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {field.options.map(opt => (
                                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                {opt.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : field.type === 'textarea' ? (
                                        <textarea
                                          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-sky-400"
                                          placeholder={field.placeholder || `输入${field.label}`}
                                          value={(configDraft[field.key] as string | undefined) ?? ''}
                                          onChange={(e) => setConfigDraft(prev => ({ ...prev, [field.key]: e.target.value }))}
                                        />
                                      ) : field.type === 'tags' ? (
                                        <Input
                                          className="mt-1 h-8 text-xs"
                                          placeholder={field.placeholder || '用逗号分隔标签'}
                                          value={Array.isArray(configDraft[field.key]) ? (configDraft[field.key] as string[]).join('、') : (configDraft[field.key] ?? '')}
                                          onChange={(e) => setConfigDraft(prev => ({
                                            ...prev,
                                            [field.key]: e.target.value ? e.target.value.split(/[、,，]/).map(s => s.trim()).filter(Boolean) : [],
                                          }))}
                                        />
                                      ) : (
                                        <Input
                                          className="mt-1 h-8 text-xs"
                                          placeholder={field.placeholder || `输入${field.label}`}
                                          value={(configDraft[field.key] as string | undefined) ?? ''}
                                          onChange={(e) => setConfigDraft(prev => ({ ...prev, [field.key]: e.target.value }))}
                                        />
                                      )}
                                    </div>
                                  ))}
                                  <div className="flex items-center gap-2 pt-1">
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => handleSaveConfig(account.id, account.platform)}
                                      disabled={savingConfig}
                                    >
                                      {savingConfig ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                                      保存配置
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => setEditingConfigId(null)}
                                    >
                                      <X className="w-3 h-3 mr-1" />
                                      取消
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                /* 展示模式 */
                                <div className="space-y-2">
                                  {configuredCount > 0 ? (
                                    <>
                                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-1.5">
                                        {platformFields.map((field) => {
                                          const value = currentPlatformConfig[field.key];
                                          if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
                                          
                                          const displayValue = field.type === 'select' && field.options
                                            ? field.options.find(o => o.value === value)?.label || String(value)
                                            : Array.isArray(value) ? (value as string[]).join('、')
                                            : String(value);

                                          return (
                                            <div key={field.key} className="flex items-center gap-2 text-xs">
                                              <span className="text-slate-400 min-w-[60px]">{field.label}</span>
                                              <span className="text-slate-700 font-medium">{displayValue}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs w-full"
                                        onClick={() => handleStartEditConfig(account.id, account.platform, account.platformConfig)}
                                      >
                                        <Sliders className="w-3 h-3 mr-1" />
                                        编辑配置
                                      </Button>
                                    </>
                                  ) : (
                                    <div className="text-center py-3">
                                      <p className="text-xs text-muted-foreground mb-2">
                                        为{PLATFORM_LABELS[account.platform as keyof typeof PLATFORM_LABELS] || account.platform}账号配置专属风格参数
                                      </p>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => handleStartEditConfig(account.id, account.platform, account.platformConfig)}
                                      >
                                        <Plus className="w-3 h-3 mr-1" />
                                        添加配置
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">使用说明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>1. 风格模板</strong>：一组风格规则的集合，如「专业严谨」「轻松活泼」等</p>
            <p><strong>2. 平台账号</strong>：你在各平台的账号，如公众号A、小红书B等</p>
            <p><strong>3. 绑定关系</strong>：账号绑定模板后，该账号发布的文章将使用对应模板的风格</p>
            <p><strong>4. 默认模板</strong>：未绑定模板的账号会使用默认模板的风格规则</p>
            <p><strong>5. 平台专属配置</strong>：每个账号可单独设置平台特有参数（如小红书的卡片模式、公众号的段落风格），不配置则使用模板默认值</p>
            <Separator className="my-3" />
            <p className="text-xs">
              提示：先在「风格初始化」页面上传文章分析风格，规则会自动入库。然后在此页面创建模板并绑定账号，再按需配置各平台的专属参数。
            </p>
          </CardContent>
        </Card>

        {/* 编辑绑定对话框 */}
        <Dialog open={editBindOpen} onOpenChange={setEditBindOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>绑定风格模板</DialogTitle>
              <DialogDescription>
                选择要绑定到此账号的风格模板
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={editTemplateId} onValueChange={setEditTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择模板" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.isDefault ? '(默认)' : ''} - {t.ruleCount} 条规则
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditBindOpen(false)}>
                取消
              </Button>
              <Button onClick={handleBindTemplate} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                确认绑定
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </TooltipProvider>
  );
}
