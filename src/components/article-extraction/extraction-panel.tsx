'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Sparkles, Upload, Loader2, Layers, BookOpen, Target, Quote,
  TrendingUp, AlertTriangle, FileText, ChevronDown, ChevronRight,
  BarChart3, Save, CheckCircle2, ArrowRight, Lightbulb, MessageSquare,
  Database, BookmarkCheck, GitBranch, Search
} from 'lucide-react';

// ====== 类型定义 ======

/** 范式识别结果 */
interface ParadigmRecognition {
  matchedParadigm: string;
  matchScore: number;
  structureDifference: string;
}

/** 关系型素材项（与后端 RelationalMaterial 接口对齐） */
interface RelationalMaterial {
  id: string;
  materialType: 'misconception' | 'analogy' | 'case' | 'data' | 'golden_sentence' | 'fixed_phrase' | 'personal_fragment';
  content: string;
  position: number;
  contextBefore: string;
  contextAfter: string;
  emotion: string;
  relationToPrevious: string;
  paradigmStep: string;
  topicTags: string[];
  sceneTags: string[];
}

/** 7维素材分组（前端展示用，从扁平数组转换而来） */
interface GroupedMaterials {
  misconception: RelationalMaterial[];
  analogy: RelationalMaterial[];
  case: RelationalMaterial[];
  data: RelationalMaterial[];
  golden_sentence: RelationalMaterial[];
  fixed_phrase: RelationalMaterial[];
  personal_fragment: RelationalMaterial[];
}

/** 完整提取结果 */
interface ExtractionResult {
  paradigmRecognition: ParadigmRecognition;
  relationalMaterials: RelationalMaterial[];
  groupedMaterials: GroupedMaterials;
  extractionSummary: string;
  assetValueScore: number;
  totalMaterialCount: number;
}

// ====== 常量配置 ======

/** 10套标准范式 */
const PARADIGM_OPTIONS = [
  { key: 'standard_misalignment', name: '标准错位破局范式', desc: '抛出错误认知→共情→点破错位→类比→案例→反问→重构→金句' },
  { key: 'industry_reflection', name: '行业反思范式', desc: '引出行业问题→承认不足→区分工具与人→分析根源→改进方向→升华' },
  { key: 'case_reductio', name: '案例归谬范式', desc: '抛出错误观点→反面案例→归谬→正确结论→收尾' },
  { key: 'essence_definition', name: '本质定义范式', desc: '错误定义→拆解问题→正确本质→类比解释→案例佐证→收尾' },
  { key: 'hot_event', name: '热点事件范式', desc: '引出热点→分析保险问题→正确应对→延伸普遍→收尾' },
  { key: 'product_review', name: '产品解读范式', desc: '产品信息→优势→不足→适合人群→不适合人群→购买建议' },
  { key: 'personal_experience', name: '个人经历范式', desc: '亲身经历→感悟→延伸保险价值→升华' },
  { key: 'pitfall_guide', name: '避坑指南范式', desc: '常见问题→逐条坑的表现危害→避坑方法→收尾' },
  { key: 'comparison', name: '对比分析范式', desc: '两种选择→各自优缺点→不同情况建议→收尾' },
  { key: 'year_end_review', name: '年终总结范式', desc: '回顾变化→感悟→展望→建议→收尾' },
];

/** 7维素材配置（与设计方案严格对齐） */
const MATERIAL_DIMENSIONS = [
  { key: 'misconception' as const, name: '错误认知', icon: AlertTriangle, color: 'red', desc: '大众的错误观点 + 共情接纳句' },
  { key: 'analogy' as const, name: '生活类比', icon: Lightbulb, color: 'amber', desc: '生活化比喻 + 引出比喻的前一句' },
  { key: 'case' as const, name: '真实案例', icon: FileText, color: 'blue', desc: '完整案例 + 引出案例的前一句' },
  { key: 'data' as const, name: '权威数据', icon: Database, color: 'emerald', desc: '数据 + 基于数据得出的结论' },
  { key: 'golden_sentence' as const, name: '金句', icon: Quote, color: 'purple', desc: '总结性金句 + 引出金句的前一句' },
  { key: 'fixed_phrase' as const, name: '固定句式组合', icon: MessageSquare, color: 'sky', desc: '不可分割的2-3个连续标志性句子' },
  { key: 'personal_fragment' as const, name: '个人碎片', icon: TrendingUp, color: 'rose', desc: '小吐槽/小自嘲/小停顿等个人化表达' },
] as const;

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string; headerBg: string; tag: string }> = {
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-700', headerBg: 'bg-red-100', tag: 'bg-red-100 text-red-700 border-red-200' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700', headerBg: 'bg-amber-100', tag: 'bg-amber-100 text-amber-700 border-amber-200' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700', headerBg: 'bg-blue-100', tag: 'bg-blue-100 text-blue-700 border-blue-200' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700', headerBg: 'bg-emerald-100', tag: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-700', headerBg: 'bg-purple-100', tag: 'bg-purple-100 text-purple-700 border-purple-200' },
  sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800', badge: 'bg-sky-100 text-sky-700', headerBg: 'bg-sky-100', tag: 'bg-sky-100 text-sky-700 border-sky-200' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', badge: 'bg-rose-100 text-rose-700', headerBg: 'bg-rose-100', tag: 'bg-rose-100 text-rose-700 border-rose-200' },
};

const EMOTION_COLORS: Record<string, string> = {
  '共情': 'bg-blue-100 text-blue-700',
  '理性': 'bg-slate-100 text-slate-700',
  '警示': 'bg-red-100 text-red-700',
  '温情': 'bg-pink-100 text-pink-700',
  '专业': 'bg-indigo-100 text-indigo-700',
  '中性': 'bg-gray-100 text-gray-700',
};

// ====== 工具函数 ======

/** 将后端返回的扁平 RelationalMaterial[] 数组按 materialType 分组为 GroupedMaterials */
function groupMaterialsByType(materials: RelationalMaterial[]): GroupedMaterials {
  const empty: GroupedMaterials = {
    misconception: [], analogy: [], case: [], data: [],
    golden_sentence: [], fixed_phrase: [], personal_fragment: [],
  };
  if (!Array.isArray(materials) || materials.length === 0) return empty;
  for (const m of materials) {
    const key = m.materialType as keyof GroupedMaterials;
    if (key in empty) {
      empty[key].push(m);
    }
  }
  return empty;
}

// ====== 子组件 ======

/** 范式匹配结果卡片 */
function ParadigmMatchCard({ recognition }: { recognition: ParadigmRecognition }) {
  const paradigm = PARADIGM_OPTIONS.find(p => p.key === recognition.matchedParadigm);
  const scoreColor = recognition.matchScore >= 90 ? 'text-emerald-600' : recognition.matchScore >= 80 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = recognition.matchScore >= 90 ? 'bg-emerald-50 border-emerald-200' : recognition.matchScore >= 80 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <Card className={`border-2 ${scoreBg}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-500" />
          范式识别结果
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-800">
              {paradigm?.name || recognition.matchedParadigm}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{paradigm?.desc}</p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${scoreColor}`}>{recognition.matchScore}</p>
            <p className="text-xs text-slate-500">匹配度</p>
          </div>
        </div>
        {recognition.structureDifference && recognition.structureDifference !== '完全符合' && (
          <div className="bg-white/80 rounded-lg p-3 border">
            <p className="text-xs font-medium text-slate-600 mb-1">结构差异说明</p>
            <p className="text-sm text-slate-700">{recognition.structureDifference}</p>
          </div>
        )}
        {recognition.matchScore >= 90 && (
          <div className="flex items-center gap-1.5 text-emerald-600 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>文章结构完全符合该范式</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** 关系型素材卡片 */
function MaterialDimensionCard({
  dimension,
  materials,
}: {
  dimension: typeof MATERIAL_DIMENSIONS[number];
  materials: RelationalMaterial[];
}) {
  const [expanded, setExpanded] = useState(false);
  const c = COLOR_MAP[dimension.color] || COLOR_MAP.blue;
  const Icon = dimension.icon;

  return (
    <div className={`rounded-xl border-2 ${c.border} overflow-hidden transition-all duration-300`}>
      <div
        className={`flex items-center justify-between p-3 cursor-pointer ${c.headerBg} hover:opacity-90`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${c.text}`} />
          <div>
            <h4 className={`font-semibold text-sm ${c.text}`}>{dimension.name}</h4>
            <p className="text-xs text-slate-500">{dimension.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={c.badge}>{materials?.length ?? 0} 条</Badge>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </div>
      {expanded && (
        <div className={`p-3 ${c.bg} space-y-2`}>
          {(!materials || materials.length === 0) ? (
            <p className="text-sm text-slate-400">未提取到相关素材</p>
          ) : (
            materials.map((m, i) => (
              <RelationalMaterialItem key={i} material={m} index={i + 1} color={dimension.color} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** 单条关系型素材展示 */
function RelationalMaterialItem({ material, index, color }: { material: RelationalMaterial; index: number; color: string }) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div className="bg-white/80 rounded-lg p-3 border border-slate-100 space-y-2">
      {/* 核心内容 */}
      <div className="flex items-start gap-2">
        <span className={`text-xs font-bold ${c.text} min-w-[20px]`}>{index}.</span>
        <p className="text-sm font-medium text-slate-800 flex-1 whitespace-pre-wrap">{material.content}</p>
      </div>

      {/* 元信息标签行 */}
      <div className="flex flex-wrap gap-1.5 pl-7">
        {material.paradigmStep && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
            {material.paradigmStep}
          </span>
        )}
        {material.emotion && (
          <span className={`text-xs px-1.5 py-0.5 rounded border ${EMOTION_COLORS[material.emotion] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
            {material.emotion}
          </span>
        )}
        {material.relationToPrevious && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-100">
            {material.relationToPrevious}
          </span>
        )}
      </div>

      {/* 上下文 */}
      {(material.contextBefore || material.contextAfter) && (
        <div className="pl-7 space-y-1">
          {material.contextBefore && (
            <p className="text-xs text-slate-400">前文：{material.contextBefore}</p>
          )}
          {material.contextAfter && (
            <p className="text-xs text-slate-400">后文：{material.contextAfter}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ====== 主组件 ======

export default function ArticleExtractionPanel() {
  const [articleText, setArticleText] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [extractionId, setExtractionId] = useState<string>('');
  const [history, setHistory] = useState<Array<{ id: string; title: string; createdAt: string }>>([]);
  const [savingToLibrary, setSavingToLibrary] = useState(false);

  // 执行提取
  const handleExtract = useCallback(async () => {
    if (!articleText.trim()) {
      toast.warning('请先输入文章内容');
      return;
    }
    if (articleText.trim().length < 200) {
      toast.warning('文章内容太短，建议至少200字以获得准确提取');
      return;
    }

    setExtracting(true);
    setExtraction(null);

    try {
      const res = await fetch('/api/article-extraction/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleContent: articleText,
          articleTitle: articleTitle || undefined,
        }),
      });

      const resp = await res.json();
      if (!resp.success) {
        toast.error(resp.error || '提取失败');
        return;
      }

      const resultData = resp.data;
      const materials: RelationalMaterial[] = Array.isArray(resultData.relationalMaterials)
        ? resultData.relationalMaterials
        : [];
      const grouped = groupMaterialsByType(materials);

      // 从后端范式识别结果构建前端格式（后端返回 matchedParadigmId + matchedParadigmName）
      const paradigmRec = resultData.paradigmRecognition;
      const extractionResult: ExtractionResult = {
        paradigmRecognition: {
          matchedParadigm: paradigmRec?.matchedParadigmId || paradigmRec?.matchedParadigmName || '',
          matchScore: paradigmRec?.matchScore ?? resultData.paradigmMatchScore ?? 0,
          structureDifference: paradigmRec?.structureDifference || '',
        },
        relationalMaterials: materials,
        groupedMaterials: grouped,
        extractionSummary: resultData.extractionSummary || '',
        assetValueScore: resultData.assetValueScore ?? 0,
        totalMaterialCount: resultData.totalMaterialCount ?? materials.length,
      };

      setExtraction(extractionResult);
      setExtractionId(resultData.extractionId);

      toast.success(`提取完成！匹配范式: ${extractionResult.paradigmRecognition.matchedParadigm}，${extractionResult.totalMaterialCount} 条关系型素材`);
    } catch (err: any) {
      toast.error(err.message || '网络错误');
    } finally {
      setExtracting(false);
    }
  }, [articleText, articleTitle]);

  // 保存到素材库
  const handleSaveToLibrary = useCallback(async () => {
    if (!extractionId) {
      toast.warning('请先完成提取');
      return;
    }
    setSavingToLibrary(true);
    try {
      const res = await fetch(`/api/article-extraction/${extractionId}/save-to-library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const resp = await res.json();
      if (resp.success) {
        toast.success(`已保存 ${resp.data?.savedCount ?? 0} 条素材到素材库`);
      } else {
        toast.error(resp.error || '保存失败');
      }
    } catch (err: any) {
      toast.error(err.message || '网络错误');
    } finally {
      setSavingToLibrary(false);
    }
  }, [extractionId]);

  // 加载历史
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/article-extraction/list?limit=10');
      const data = await res.json();
      if (data.success) {
        const items = data.data?.items || data.data?.list || [];
        const mapped = items.map((item: any) => ({
          id: item.id,
          title: item.articleTitle || item.title || '未命名文章',
          createdAt: item.createdAt,
        }));
        setHistory(mapped);
      }
    } catch { /* ignore */ }
  }, []);

  // 加载历史提取详情
  const loadExtraction = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/article-extraction/${id}`);
      const resp = await res.json();
      if (resp.success && resp.data) {
        const detail = resp.data;
        const materials: RelationalMaterial[] = Array.isArray(detail.relationalMaterials)
          ? detail.relationalMaterials
          : [];
        const grouped = groupMaterialsByType(materials);
        // 从详情API构建范式识别结果（详情API从独立字段重构 paradigmRecognition）
        const paradigmRec = detail.paradigmRecognition;
        const extractionResult: ExtractionResult = {
          paradigmRecognition: {
            matchedParadigm: paradigmRec?.matchedParadigmId || paradigmRec?.matchedParadigmName || detail.paradigmName || '',
            matchScore: paradigmRec?.matchScore ?? detail.paradigmMatchScore ?? 0,
            structureDifference: paradigmRec?.structureDifference || '',
          },
          relationalMaterials: materials,
          groupedMaterials: grouped,
          extractionSummary: detail.extractionSummary || '',
          assetValueScore: detail.assetValueScore ?? 0,
          totalMaterialCount: detail.materialCount ?? materials.length,
        };
        setExtraction(extractionResult);
        setExtractionId(id);
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            文章拆解提取器
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            范式识别 + 关系型素材提取，保留上下文和情绪关系
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadHistory}>
          <BarChart3 className="w-4 h-4 mr-1" /> 提取历史
        </Button>
      </div>

      {/* 方法论说明 */}
      <Card className="border-2 border-indigo-200 bg-indigo-50/30">
        <CardContent className="p-4">
          <h4 className="font-semibold text-indigo-800 mb-2 flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            两步拆解法
          </h4>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-indigo-200">
              <Search className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-medium text-indigo-700">范式识别</span>
              <span className="text-xs text-slate-500">（10套标准范式匹配）</span>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-400" />
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-indigo-200">
              <BookmarkCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-medium text-indigo-700">7维关系型素材提取</span>
              <span className="text-xs text-slate-500">（保留上下文+情绪+关系）</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 输入区 */}
      <Card className="border-2 border-sky-200 bg-sky-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-sky-600" />
            输入文章
          </CardTitle>
          <CardDescription>粘贴一篇代表性文章，系统将自动识别范式并提取关系型素材</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="文章标题（可选，系统也可自动提取）"
            value={articleTitle}
            onChange={(e) => setArticleTitle(e.target.value)}
            className="bg-white"
          />
          <Textarea
            placeholder={"在此粘贴文章内容...\n\n建议粘贴完整的保险科普文章（至少200字），系统将：\n1. 自动识别文章属于10套标准范式中的哪一套\n2. 提取7维关系型素材（错误认知/类比/案例/数据/金句/固定句式组合/个人碎片）\n3. 每条素材保留上下文、位置、情绪标签和搭配关系"}
            value={articleText}
            onChange={(e) => setArticleText(e.target.value)}
            className="min-h-[200px] bg-white"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{articleText.length} 字</span>
            <Button
              onClick={handleExtract}
              disabled={extracting || !articleText.trim()}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
            >
              {extracting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />AI 正在拆解...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />开始拆解</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 提取结果 */}
      {extraction && (
        <>
          {/* 范式识别结果 */}
          <ParadigmMatchCard recognition={extraction.paradigmRecognition} />

          {/* 概览统计 */}
          <Card className="border-2 border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                关系型素材概览
                <Badge variant="secondary" className="ml-2">{extraction.totalMaterialCount} 条</Badge>
              </CardTitle>
              {extraction.extractionSummary && (
                <CardDescription className="mt-1">{extraction.extractionSummary}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {MATERIAL_DIMENSIONS.map((dim) => {
                  const count = extraction.groupedMaterials[dim.key]?.length ?? 0;
                  const c = COLOR_MAP[dim.color];
                  const Icon = dim.icon;
                  return (
                    <div key={dim.key} className={`text-center p-2 rounded-lg border ${c.border} ${c.bg}`}>
                      <Icon className={`w-4 h-4 mx-auto ${c.text}`} />
                      <p className={`text-lg font-bold mt-1 ${c.text}`}>{count}</p>
                      <p className="text-xs text-slate-500">{dim.name}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 7维素材展开卡片 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                7维关系型素材详情
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveToLibrary}
                disabled={savingToLibrary}
                className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
              >
                {savingToLibrary ? (
                  <><Loader2 className="w-3 h-3 mr-1 animate-spin" />保存中...</>
                ) : (
                  <><Save className="w-3 h-3 mr-1" />保存到素材库</>
                )}
              </Button>
            </div>
            {MATERIAL_DIMENSIONS.map((dim) => (
              <MaterialDimensionCard
                key={dim.key}
                dimension={dim}
                materials={extraction.groupedMaterials[dim.key] ?? []}
              />
            ))}
          </div>

          {/* 资产复用提示 */}
          <Card className="border-2 border-amber-200 bg-amber-50/50">
            <CardContent className="p-4">
              <h4 className="font-semibold text-amber-800 mb-2">关系型素材优势</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="text-amber-700 font-medium">保留人味</p>
                  <ul className="text-amber-600 text-xs space-y-0.5">
                    <li>• 每条素材携带上下文 → 不丢失语境</li>
                    <li>• 情绪标签 → 保持情感流动</li>
                    <li>• 搭配关系 → 维持句子节奏</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="text-amber-700 font-medium">精准复用</p>
                  <ul className="text-amber-600 text-xs space-y-0.5">
                    <li>• 范式模板 → 自动匹配写作结构</li>
                    <li>• 位置标注 → 素材放在正确位置</li>
                    <li>• 7维覆盖 → 仅积累有用素材</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 历史记录 */}
      {history.length > 0 && (
        <Card className="border-2 border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">最近提取记录</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-slate-50 ${extractionId === h.id ? 'bg-indigo-50 border border-indigo-200' : ''}`}
                  onClick={() => loadExtraction(h.id)}
                >
                  <span className="text-sm font-medium text-slate-700">{h.title}</span>
                  <span className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
