'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sparkles, ListTodo, ArrowRight, History, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

// 导入新组件
import {
  CoreAnchorInput
} from '@/components/creation-guide/core-anchor-input';
import {
  MaterialProvider
} from '@/components/creation-guide/material-provider';
import {
  StructureSelector
} from '@/components/creation-guide/structure-selector';
import {
  CreationController
} from '@/components/creation-guide/creation-controller';

// 从统一类型文件导入类型和常量
import type {
  CoreAnchorData,
  MaterialData,
  StructureTemplate,
  CreationControlData
} from '@/components/creation-guide/types';
import {
  DEFAULT_CORE_ANCHOR_DATA,
  DEFAULT_MATERIAL_DATA,
  DEFAULT_CREATION_CONTROL_DATA
} from '@/components/creation-guide/types';
import { USER_DEFAULT_7_SECTION_STRUCTURE } from '@/components/creation-guide/structure-templates';

// localStorage Key
const STORAGE_KEY = 'creationGuide_v2_draft';

export default function HomePageV2() {
  const [activeTab, setActiveTab] = useState('new');
  
  // 新创作引导状态
  const [coreAnchorData, setCoreAnchorData] = useState<CoreAnchorData>(DEFAULT_CORE_ANCHOR_DATA);
  const [materialData, setMaterialData] = useState<MaterialData>(DEFAULT_MATERIAL_DATA);
  const [selectedStructure, setSelectedStructure] = useState<StructureTemplate>(USER_DEFAULT_7_SECTION_STRUCTURE);
  const [creationControlData, setCreationControlData] = useState<CreationControlData>(DEFAULT_CREATION_CONTROL_DATA);
  
  // 加载状态
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [generatingFullText, setGeneratingFullText] = useState(false);

  // 计算是否可以生成大纲
  const canGenerateOutline = 
    coreAnchorData.openingCase.trim().length >= 100 &&
    coreAnchorData.coreViewpoint.trim().length >= 50 &&
    coreAnchorData.endingConclusion.trim().length >= 50;

  // 加载本地草稿
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.coreAnchorData) setCoreAnchorData(data.coreAnchorData);
        if (data.materialData) setMaterialData(data.materialData);
        if (data.creationControlData) setCreationControlData(data.creationControlData);
      }
    } catch (error) {
      console.warn('加载草稿失败:', error);
    }
  }, []);

  // 自动保存
  useEffect(() => {
    try {
      const data = {
        coreAnchorData,
        materialData,
        creationControlData,
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('保存草稿失败:', error);
    }
  }, [coreAnchorData, materialData, creationControlData]);

  // 生成大纲（占位函数，后续对接真实API）
  const handleGenerateOutline = useCallback(async () => {
    setGeneratingOutline(true);
    try {
      // 模拟API调用 - 后续对接真实API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockOutline = `【创作大纲】

1. 真实故事/案例开头（约300字）
   - 使用用户提供的开篇核心案例
   - 突出真实人物、场景、情绪
   - 核心素材：${coreAnchorData.openingCase.substring(0, 50)}...

2. 抛出用户最关心的疑问（约150字）
   - 基于案例提出3个核心问题
   - 引发读者共鸣和思考

3. 情绪/立场表达（约150字）
   - 表达共情、不平、惋惜
   - 站在消费者立场
   - 核心观点：${coreAnchorData.coreViewpoint.substring(0, 50)}...

4. 理性拆解真相（约400字）
   - 纠正保险误区
   - 专业理性解读
   - 使用关联素材

5. 权威数据/规则支撑（约300字）
   - 引用用户提供的关键素材
   - 数据支撑：${materialData.keyMaterials ? '有用户提供的关键素材' : '使用默认素材'}

6. 给普通人可落地的避坑建议（约300字）
   - 具体可操作的建议
   - 实用性强

7. 结尾互动+合规声明（约200字）
   - 使用用户提供的结尾结论
   - 引导互动
   - 合规声明
   - 结尾内容：${coreAnchorData.endingConclusion.substring(0, 50)}...

【结构说明】严格按照用户专属7段结构创作
【字数控制】目标${creationControlData.targetWordCount}字，浮动±200字`;

      setCreationControlData(prev => ({
        ...prev,
        outline: mockOutline,
        outlineConfirmed: false
      }));
      
      toast.success('大纲已生成！请核对后确认');
    } catch (error) {
      toast.error('生成大纲失败');
    } finally {
      setGeneratingOutline(false);
    }
  }, [coreAnchorData, materialData, creationControlData.targetWordCount]);

  // 生成全文（占位函数，后续对接真实API）
  const handleGenerateFullText = useCallback(async () => {
    setGeneratingFullText(true);
    try {
      // 模拟API调用 - 后续对接真实API
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      toast.success('全文生成任务已提交！前往任务列表查看进度');
      
      // 跳转到任务列表
      setTimeout(() => {
        window.location.href = '/full-home';
      }, 1500);
    } catch (error) {
      toast.error('生成全文失败');
    } finally {
      setGeneratingFullText(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent">
                  AI写作风格复刻系统
                </h1>
                <p className="text-xs text-slate-500">V2.0 - 第一阶段MVP</p>
              </div>
            </div>

            {/* 快捷导航 */}
            <div className="flex items-center gap-2">
              <Link href="/full-home">
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
        {/* 版本切换提示 */}
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">
                  这是第一阶段MVP版本 - 新创作引导界面
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  包含：核心锚点输入、素材提供、固定结构选择、创作控制。大纲生成和全文生成当前为模拟，后续对接真实API。
                </p>
              </div>
              <Link href="/">
                <Button variant="outline" size="sm" className="border-slate-300">
                  返回旧版
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="new" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              新创作引导
            </TabsTrigger>
            <TabsTrigger value="quick" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              快速入口
            </TabsTrigger>
          </TabsList>

          {/* 新创作引导标签页 */}
          <TabsContent value="new" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 左侧：核心创作区域 */}
              <div className="lg:col-span-2 space-y-6">
                {/* 核心锚点输入 */}
                <CoreAnchorInput
                  value={coreAnchorData}
                  onChange={setCoreAnchorData}
                />

                {/* 素材提供 */}
                <MaterialProvider
                  value={materialData}
                  onChange={setMaterialData}
                />

                {/* 固定结构选择 */}
                <StructureSelector
                  selectedStructure={selectedStructure}
                  onStructureChange={setSelectedStructure}
                />
              </div>

              {/* 右侧：创作控制 */}
              <div className="space-y-6">
                <CreationController
                  value={creationControlData}
                  onChange={setCreationControlData}
                  onGenerateOutline={handleGenerateOutline}
                  onGenerateFullText={handleGenerateFullText}
                  canGenerateOutline={canGenerateOutline}
                  generatingOutline={generatingOutline}
                  generatingFullText={generatingFullText}
                />

                {/* 快速链接 */}
                <Card className="border border-slate-200">
                  <CardContent className="pt-6 pb-6">
                    <div className="space-y-3">
                      <Link href="/full-home">
                        <Button variant="outline" className="w-full h-12">
                          <History className="w-5 h-5 mr-2" />
                          查看任务列表
                        </Button>
                      </Link>
                      <Link href="/creation-guide-legacy">
                        <Button variant="outline" className="w-full h-12">
                          <ArrowRight className="w-5 h-5 mr-2" />
                          旧版创作引导
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* 快速入口标签页 */}
          <TabsContent value="quick" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link href="/full-home">
                <Button variant="outline" className="w-full h-24 flex-col gap-2">
                  <ListTodo className="w-8 h-8" />
                  <span className="text-sm font-medium">任务列表</span>
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
                  <Sparkles className="w-8 h-8" />
                  <span className="text-sm font-medium">发布配置</span>
                </Button>
              </Link>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
