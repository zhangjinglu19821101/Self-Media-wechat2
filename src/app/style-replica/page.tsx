'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sparkles, ListTodo, ArrowRight, History, ShieldAlert, Save, CheckCircle2, Settings, Clock, FileText, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';

// 导入Context
import {
  CreationGuideProvider,
  useCreationGuide,
  useCoreAnchorData,
  useMaterialData,
  useSelectedStructure,
  useCreationControlData,
  type CreationGuideState
} from '@/components/creation-guide/creation-guide-context';

import {
  getDefaultStructure
} from '@/components/creation-guide/structure-templates';

import {
  generateSafeOutline
} from '@/components/creation-guide/safety-utils';

import {
  loadFromStorage,
  STORAGE_KEY,
} from '@/hooks/use-debounced-storage';

// 导入组件
import { CoreAnchorInput } from '@/components/creation-guide/core-anchor-input-optimized';
import { MaterialProvider } from '@/components/creation-guide/material-provider';
import { StructureSelector } from '@/components/creation-guide/structure-selector';
import { CreationController } from '@/components/creation-guide/creation-controller';

// ========== 自动保存 Hook (内联实现) ==========

const AUTO_SAVE_DELAY = 1000; // 1秒防抖

function useAutoSave() {
  const { state } = useCreationGuide();
  const { dispatch } = useCreationGuide();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStateRef = useRef<string>('');

  useEffect(() => {
    const serialized = JSON.stringify({
      coreAnchorData: state.coreAnchorData,
      materialData: state.materialData,
      creationControlData: state.creationControlData,
    });

    // 无变化时不保存
    if (serialized === prevStateRef.current) return;
    prevStateRef.current = serialized;

    // 防抖保存
    dispatch({ type: 'SET_SAVING', payload: true });

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...state,
          savedAt: Date.now(),
        }));
        dispatch({ type: 'SET_LAST_SAVED', payload: new Date() });
      } catch (err) {
        console.warn('自动保存失败:', err);
      } finally {
        dispatch({ type: 'SET_SAVING', payload: false });
      }
    }, AUTO_SAVE_DELAY);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [state, dispatch]);
}

// ========== 主内容组件 ==========

function CreationGuideContent() {
  // 使用便利 Hooks 订阅特定状态
  const { state: { isSaving, lastSaved, error }, canGenerateOutline } = useCreationGuide();
  const { data: coreAnchorData, update: updateCoreAnchor } = useCoreAnchorData();
  const { data: materialData, update: updateMaterial } = useMaterialData();
  const { structure: selectedStructure, select: selectStructure } = useSelectedStructure();
  const { data: creationControlData, update: updateCreationControl } = useCreationControlData();

  // 🔴 融合新增：全文生成加载状态
  const [generatingFullText, setGeneratingFullText] = useState(false);

  // [C5修复] 集成自动保存
  useAutoSave();

  // 生成大纲
  const handleGenerateOutline = useCallback(async () => {
    try {
      const safeOutline = generateSafeOutline({
        openingCase: coreAnchorData.openingCase,
        coreViewpoint: coreAnchorData.coreViewpoint,
        endingConclusion: coreAnchorData.endingConclusion,
        keyMaterials: materialData.keyMaterials,
        relatedMaterials: materialData.relatedMaterials,
        targetWordCount: creationControlData.targetWordCount,
        structure: selectedStructure,  // 传入当前选择的结构模板
      });

      updateCreationControl({
        outline: safeOutline,
        outlineConfirmed: false,
      });

      toast.success('大纲已生成！请核对后确认');
    } catch (err) {
      toast.error('生成大纲失败');
    }
  }, [coreAnchorData, materialData, creationControlData.targetWordCount, updateCreationControl]);

  // 🔴 融合核心：生成全文（AI 拆解 → 创建子任务 → 执行）
  const handleGenerateFullText = useCallback(async () => {
    // 前置校验：至少填写了一段核心内容
    const hasContent =
      (coreAnchorData.openingCase?.trim()?.length > 0) ||
      (coreAnchorData.coreViewpoint?.trim()?.length > 0) ||
      (coreAnchorData.endingConclusion?.trim()?.length > 0);

    if (!hasContent) {
      toast.error('请至少填写一段核心内容（开篇案例/核心观点/结尾结论）');
      return;
    }

    setGeneratingFullText(true);
    try {
      // 组装 userOpinion：将三段内容拼接为结构化文本
      const opinionParts: string[] = [];
      if (coreAnchorData.openingCase?.trim()) {
        opinionParts.push(`【开篇核心案例】\n${coreAnchorData.openingCase.trim()}`);
      }
      if (coreAnchorData.coreViewpoint?.trim()) {
        opinionParts.push(`【全文核心观点】\n${coreAnchorData.coreViewpoint.trim()}`);
      }
      if (coreAnchorData.endingConclusion?.trim()) {
        opinionParts.push(`【结尾核心结论】\n${coreAnchorData.endingConclusion.trim()}`);
      }
      const userOpinion = opinionParts.join('\n\n');

      // 提取素材 ID（当前素材区为文本输入，暂不支持结构化 ID 提取）
      const materialIds: string[] = [];

      // 获取情感基调（默认理性客观）
      const emotionTone = 'rational';

      // 构造创作指令（用于 AI 拆解）
      const instruction = [
        userOpinion,
        creationControlData.targetWordCount ? `目标字数：约${creationControlData.targetWordCount}字` : '',
        emotionTone ? `情感基调：${emotionTone === 'rational' ? '理性客观' : emotionTone}` : '',
      ].filter(Boolean).join('\n');

      console.log('[HomePage] 🚀 开始一键创作流程（异步模式）:', {
        instructionLength: instruction.length,
        userOpinionLength: userOpinion.length,
      });

      // ═══ 异步架构：立即创建任务（毫秒级返回）═══
      toast.loading('正在创建任务...', { duration: 2000 });

      const createRes = await fetch('/api/agents/b/async-create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle: instruction,
          instruction,
          userOpinion,
          materialIds,
          relatedMaterials: materialData.relatedMaterials?.trim() || '',
          keyMaterials: materialData.keyMaterials?.trim() || '',
        }),
      });
      
      const createData = await createRes.json();

      if (!createData.success) {
        throw new Error(createData.error || '创建任务失败');
      }

      // 立即提示成功
      toast.dismiss();
      
      // 清理本地草稿
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }

      toast.success('🚀 任务已创建！正在后台执行 AI 拆解...');

      // 跳转到任务列表页面查看进度
      setTimeout(() => {
        window.location.href = '/full-home?tab=tasks';
      }, 1000);

    } catch (err) {
      console.error('[HomePage] ❌ 提交失败:', err);
      toast.dismiss();
      toast.error(err instanceof Error ? err.message : '提交失败，请检查网络连接');
    } finally {
      setGeneratingFullText(false);
    }
  }, [coreAnchorData, materialData, creationControlData]);

  // 保存状态显示
  const renderSaveStatus = () => {
    if (isSaving) {
      return (
        <div className="flex items-center gap-2 text-xs text-amber-600">
          <Save className="w-3 h-3 animate-pulse" />
          保存中...
        </div>
      );
    }
    
    if (lastSaved) {
      return (
        <div className="flex items-center gap-2 text-xs text-green-600">
          <CheckCircle2 className="w-3 h-3" />
          最后保存: {lastSaved.toLocaleTimeString()}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent">
                  AI写作风格复刻系统
                </h1>
                <p className="text-xs text-slate-500">智能多Agent协作创作平台</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {renderSaveStatus()}
              <Link href="/style-init">
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">风格配置</span>
                </Button>
              </Link>
              <Link href="/full-home?tab=tasks">
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <ListTodo className="w-4 h-4" />
                  <span className="hidden sm:inline">任务列表</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-6 border-sky-200 bg-sky-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-sky-600 flex-shrink-0" />
              <p className="text-sm text-sky-800">
                创作前请先填写三段核心内容（开篇案例 / 核心观点 / 结尾结论），再生成大纲并提交全文。
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：核心创作区域 */}
          <div className="lg:col-span-2 space-y-6">
            <CoreAnchorInput
              value={coreAnchorData}
              onChange={(data) => updateCoreAnchor(data)}
            />
            <StructureSelector
              selectedStructure={selectedStructure}
              onStructureChange={selectStructure}
            />
            <MaterialProvider
              value={materialData}
              onChange={(data) => updateMaterial(data)}
            />
          </div>

          {/* 右侧：创作控制 */}
          <div className="space-y-6">
            <CreationController
              value={creationControlData}
              onChange={(data) => updateCreationControl(data)}
              onGenerateOutline={handleGenerateOutline}
              onGenerateFullText={handleGenerateFullText}
              canGenerateOutline={canGenerateOutline}
              generatingOutline={false}
              generatingFullText={generatingFullText}  // 🔴 传入真实加载状态
            />

            {/* 结构明细展示 */}
            {selectedStructure && (
              <Card className="border border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LayoutTemplate className="w-4 h-4 text-sky-500" />
                    结构明细
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {selectedStructure.name} · 共{selectedStructure.sections.length}个段落
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {selectedStructure.sections.map((section, index) => (
                      <div key={section.id} className="flex items-start gap-3 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-900">{section.name}</span>
                            <span className="text-xs text-slate-500">(约{section.suggestedWordCount}字)</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{section.description}</p>
                          {section.requirements && section.requirements.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {section.requirements.map((req, i) => (
                                <span key={i} className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                                  {req}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ========== 主组件 ==========

export default function HomePage() {
  const [initialState, setInitialState] = useState<Partial<CreationGuideState> | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('new');

  // 加载本地草稿
  useEffect(() => {
    const saved = loadFromStorage(STORAGE_KEY, {} as Record<string, unknown>);
    if (saved && (saved.coreAnchorData || saved.materialData || saved.creationControlData)) {
      setInitialState({
        coreAnchorData: saved.coreAnchorData as any,
        materialData: saved.materialData as any,
        creationControlData: saved.creationControlData as any,
        selectedStructure: getDefaultStructure(),
      });
    }
  }, []);

  return (
    <CreationGuideProvider initialState={initialState}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="new" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            新创作
          </TabsTrigger>
          <TabsTrigger value="quick" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            快捷入口
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <CreationGuideContent />
        </TabsContent>

        <TabsContent value="quick" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/full-home?tab=tasks">
              <Button variant="outline" className="w-full h-24 flex-col gap-2">
                <ListTodo className="w-8 h-8" />
                <span className="text-sm font-medium">任务列表</span>
              </Button>
            </Link>
            <Link href="/task-timeline">
              <Button variant="outline" className="w-full h-24 flex-col gap-2">
                <Clock className="w-8 h-8" />
                <span className="text-sm font-medium">时间线视图</span>
              </Button>
            </Link>
            <Link href="/materials">
              <Button variant="outline" className="w-full h-24 flex-col gap-2">
                <Sparkles className="w-8 h-8" />
                <span className="text-sm font-medium">素材库</span>
              </Button>
            </Link>
            <Link href="/wechat-config">
              <Button variant="outline" className="w-full h-24 flex-col gap-2">
                <FileText className="w-8 h-8" />
                <span className="text-sm font-medium">发布配置</span>
              </Button>
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </CreationGuideProvider>
  );
}
