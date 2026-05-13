'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, ChevronDown, ChevronRight, Loader2, Sparkles, Map, BookOpen, Layers, Type, Atom, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

// ====== 类型定义（与后端 article-extraction-service.ts 保持一致）======

/** 5层提取结果（后端 ArticleExtractionResult 展平） */
export interface FiveLayerExtraction {
  layer1: Layer1MetaInfo;
  layer2: Layer2CoreLogic;
  layer3: Layer3ContentModules;
  layer4: Layer4LanguageStyle;
  layer5: Layer5AtomicMaterials;
  extractionSummary: string;
  assetValueScore: number;
  reusableDimensionCount: number;
}

/** 第一层：文章元信息层 */
export interface Layer1MetaInfo {
  articleTitle: string;
  subtitle?: string;
  alternativeTitles?: string[];
  articleType: string;
  coreTheme: string;
  targetAudience: string;
  emotionalTone: string;
  publishPlatform: string;
  publishTime?: string;
}

/** 第二层：核心逻辑层 */
export interface Layer2CoreLogic {
  coreArgument: string;
  breakthroughLogic: string;
  argumentStructure: string;
  valueProposition: string;
  actionGuide: string;
}

/** 第三层：内容模块层 */
export interface Layer3ContentModules {
  hookIntro: string;
  emotionalAcceptance: string;
  cognitiveBreakthrough: string;
  plainExplanation: string;
  valueReconstruction: string;
  closingElevation: string;
}

/** 第四层：语言风格层 */
export interface Layer4LanguageStyle {
  fixedPatterns: string[];
  toneCharacteristics: string[];
  catchphrases: string[];
  forbiddenWords: string[];
  paragraphRhythm: string;
}

/** 第五层：原子素材单元层 */
export interface Layer5AtomicMaterials {
  misconceptions: string[];
  lifeAnalogies: string[];
  realCases: string[];
  authorityData: string[];
  goldenSentences: string[];
}

// ====== 层配置 ======

const LAYER_CONFIG = [
  { key: 'layer1', name: '文章元信息层', icon: BookOpen, color: 'blue', desc: '基础属性，用于分类与检索' },
  { key: 'layer2', name: '核心逻辑层', icon: Layers, color: 'purple', desc: '文章骨架，决定论证路径' },
  { key: 'layer3', name: '内容模块层', icon: FileText, color: 'emerald', desc: '文章血肉，可独立复用' },
  { key: 'layer4', name: '语言风格层', icon: Type, color: 'amber', desc: '文章灵魂，个人签名' },
  { key: 'layer5', name: '原子素材层', icon: Atom, color: 'rose', desc: '最小价值单元，数字乐高' },
] as const;

// ====== 数字资产地图组件 ======

function DigitalAssetMap({ extraction }: { extraction: FiveLayerExtraction }) {
  const l5ArrayCount = Object.values(extraction.layer5).reduce(
    (sum: number, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
  );

  const assetCounts = [
    { layer: '元信息', count: countNonEmptyFields(extraction.layer1), color: 'bg-blue-500' },
    { layer: '核心逻辑', count: countNonEmptyFields(extraction.layer2), color: 'bg-purple-500' },
    { layer: '内容模块', count: countNonEmptyFields(extraction.layer3), color: 'bg-emerald-500' },
    { layer: '语言风格', count: countNonEmptyFields(extraction.layer4), color: 'bg-amber-500' },
    { layer: '原子素材', count: l5ArrayCount, color: 'bg-rose-500' },
  ];

  const totalAssets = assetCounts.reduce((sum, a) => sum + a.count, 0);

  return (
    <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-indigo-600" />
            <CardTitle className="text-lg text-indigo-800">数字资产地图</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-600 text-white text-sm px-3 py-1">
              共 {totalAssets} 项
            </Badge>
            <Badge className="bg-amber-500 text-white text-sm px-2 py-1">
              价值 {extraction.assetValueScore}分
            </Badge>
          </div>
        </div>
        <CardDescription>可复用维度 {extraction.reusableDimensionCount}/21 — {extraction.extractionSummary}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-3">
          {assetCounts.map((asset) => (
            <div key={asset.layer} className="text-center">
              <div className="relative mx-auto w-16 h-16 mb-2">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" className={asset.color.replace('bg-', 'stroke-')} strokeWidth="3" strokeDasharray={`${totalAssets > 0 ? (asset.count / totalAssets) * 100 : 0} 100`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-slate-700">{asset.count}</span>
              </div>
              <p className="text-xs font-medium text-slate-600">{asset.layer}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-white/60 rounded-lg border border-indigo-100">
          <p className="text-xs text-indigo-700">
            每积累一个提取单元，你的写作能力就变强一分。提取后的资产可直接喂给写作Agent，实现"写一篇，赚N篇"的复利效应。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ====== 单层展开组件 ======

function LayerCard({ layerKey, name, icon: Icon, color, desc, data }: {
  layerKey: string; name: string; icon: any; color: string; desc: string;
  data: any;
}) {
  const [expanded, setExpanded] = useState(false);

  const colorMap: Record<string, { bg: string; border: string; text: string; badge: string; headerBg: string }> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700', headerBg: 'bg-blue-100' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-700', headerBg: 'bg-purple-100' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700', headerBg: 'bg-emerald-100' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700', headerBg: 'bg-amber-100' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', badge: 'bg-rose-100 text-rose-700', headerBg: 'bg-rose-100' },
  };
  const c = colorMap[color] || colorMap.blue;

  const renderFields = () => {
    if (!data) return <p className="text-sm text-slate-400">暂无数据</p>;

    switch (layerKey) {
      case 'layer1':
        return (
          <div className="space-y-3">
            <FieldRow label="文章标题" value={data.articleTitle} highlight />
            {data.subtitle && <FieldRow label="副标题" value={data.subtitle} />}
            {data.alternativeTitles?.length > 0 && (
              <TagRow label="备选标题" values={data.alternativeTitles} />
            )}
            <FieldRow label="文章类型" value={data.articleType} badge />
            <FieldRow label="核心主题" value={data.coreTheme} />
            <FieldRow label="目标人群" value={data.targetAudience} />
            <FieldRow label="情感基调" value={data.emotionalTone} badge />
            <FieldRow label="发布平台" value={data.publishPlatform} badge />
            {data.publishTime && <FieldRow label="发布时间" value={data.publishTime} />}
          </div>
        );
      case 'layer2':
        return (
          <div className="space-y-3">
            <FieldRow label="核心论点" value={data.coreArgument} highlight />
            <FieldRow label="破局逻辑" value={data.breakthroughLogic} />
            <FieldRow label="论证结构" value={data.argumentStructure} />
            <FieldRow label="价值主张" value={data.valueProposition} />
            <FieldRow label="行动指引" value={data.actionGuide} />
          </div>
        );
      case 'layer3':
        return (
          <div className="space-y-3">
            <FieldRow label="钩子引入" value={data.hookIntro} />
            <FieldRow label="情绪接纳" value={data.emotionalAcceptance} />
            <FieldRow label="认知破局" value={data.cognitiveBreakthrough} highlight />
            <FieldRow label="通俗解释" value={data.plainExplanation} />
            <FieldRow label="价值重构" value={data.valueReconstruction} />
            <FieldRow label="收尾升华" value={data.closingElevation} />
          </div>
        );
      case 'layer4':
        return (
          <div className="space-y-3">
            <TagRow label="固定句式" values={data.fixedPatterns} />
            <TagRow label="语气特征" values={data.toneCharacteristics} />
            <TagRow label="个人口头禅" values={data.catchphrases} variant="highlight" />
            <TagRow label="禁忌词汇" values={data.forbiddenWords} variant="danger" />
            <FieldRow label="段落节奏" value={data.paragraphRhythm} />
          </div>
        );
      case 'layer5':
        return (
          <div className="space-y-3">
            <TagRow label="错误认知" values={data.misconceptions} variant="danger" />
            <TagRow label="生活类比" values={data.lifeAnalogies} variant="highlight" />
            <TagRow label="真实案例" values={data.realCases} />
            <TagRow label="权威数据" values={data.authorityData} />
            <TagRow label="金句提炼" values={data.goldenSentences} />
          </div>
        );
      default:
        return <pre className="text-xs bg-white/50 p-2 rounded overflow-auto max-h-60">{JSON.stringify(data, null, 2)}</pre>;
    }
  };

  return (
    <div className={`rounded-xl border-2 ${c.border} overflow-hidden transition-all duration-300`}>
      <div className={`flex items-center justify-between p-4 cursor-pointer ${c.headerBg} hover:opacity-90`} onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${c.text}`} />
          <div>
            <h3 className={`font-semibold ${c.text}`}>{name}</h3>
            <p className="text-xs text-slate-500">{desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={c.badge}>{countNonEmptyFields(data)} 项</Badge>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </div>
      {expanded && (
        <div className={`p-4 ${c.bg} space-y-2 animate-in slide-in-from-top-2 duration-200`}>
          {renderFields()}
        </div>
      )}
    </div>
  );
}

// ====== 辅助组件 ======

function FieldRow({ label, value, sub, badge, highlight }: { label: string; value?: string; sub?: string; badge?: boolean; highlight?: boolean }) {
  if (!value || value === '未检测到') return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs font-medium text-slate-500 min-w-[80px] shrink-0 pt-0.5">{label}</span>
      {badge ? (
        <Badge variant="secondary" className="text-xs">{value}</Badge>
      ) : (
        <span className={`text-sm ${highlight ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
          {value}
          {sub && <span className="text-xs text-slate-400 ml-1">({sub})</span>}
        </span>
      )}
    </div>
  );
}

function TagRow({ label, values, variant }: { label: string; values?: string[]; variant?: 'default' | 'danger' | 'highlight' }) {
  if (!values || values.length === 0) return null;
  const tagClass = variant === 'danger' ? 'bg-red-100 text-red-700 border-red-200' : variant === 'highlight' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-700 border-slate-200';
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs font-medium text-slate-500 min-w-[80px] shrink-0 pt-0.5">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span key={i} className={`text-xs px-2 py-0.5 rounded border ${tagClass}`}>{v}</span>
        ))}
      </div>
    </div>
  );
}

/** 统计非空字段数量 */
function countNonEmptyFields(data: any): number {
  if (!data) return 0;
  let count = 0;
  for (const val of Object.values(data)) {
    if (Array.isArray(val)) count += val.length;
    else if (typeof val === 'object' && val !== null) count += countNonEmptyFields(val);
    else if (val && val !== '未检测到') count++;
  }
  return count;
}

// ====== 主组件 ======

export default function ArticleExtractionPanel() {
  const [articleText, setArticleText] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<FiveLayerExtraction | null>(null);
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

      // 后端返回: { success, data: { extractionId, layer1, layer2, ..., extractionSummary, assetValueScore, reusableDimensionCount, savedMaterialCount } }
      const resultData = resp.data;
      const extractionResult: FiveLayerExtraction = {
        layer1: resultData.layer1,
        layer2: resultData.layer2,
        layer3: resultData.layer3,
        layer4: resultData.layer4,
        layer5: resultData.layer5,
        extractionSummary: resultData.extractionSummary || '',
        assetValueScore: resultData.assetValueScore ?? 0,
        reusableDimensionCount: resultData.reusableDimensionCount ?? 0,
      };

      setExtraction(extractionResult);
      setExtractionId(resultData.extractionId);

      const totalAssets = extractionResult.reusableDimensionCount;
      toast.success(`提取完成！可复用维度 ${totalAssets}/21，资产价值 ${extractionResult.assetValueScore}分`);
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
        // 后端返回 articleTitle，前端统一映射为 title
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
        // 详情 API 返回格式可能不同，需要兼容
        const detail = resp.data;
        // 尝试从 extraction_layers 重建 FiveLayerExtraction
        if (detail.extraction) {
          setExtraction(detail.extraction);
        } else if (detail.layers) {
          const layersMap: Record<string, any> = {};
          for (const layer of detail.layers) {
            layersMap[layer.layerName] = layer.extractionData;
          }
          const extractionResult: FiveLayerExtraction = {
            layer1: layersMap['meta_info'] || {},
            layer2: layersMap['core_logic'] || {},
            layer3: layersMap['content_module'] || {},
            layer4: layersMap['language_style'] || {},
            layer5: layersMap['atomic_material'] || {},
            extractionSummary: detail.extractionSummary || '',
            assetValueScore: detail.assetValueScore ?? 0,
            reusableDimensionCount: detail.reusableDimensionCount ?? 0,
          };
          setExtraction(extractionResult);
        }
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
            全维度文章提取
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            5层21维结构化提取，将单篇文章拆解为可无限复用的数字资产
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadHistory}>
          <BarChart3 className="w-4 h-4 mr-1" /> 提取历史
        </Button>
      </div>

      {/* 输入区 */}
      <Card className="border-2 border-sky-200 bg-sky-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-sky-600" />
            输入文章
          </CardTitle>
          <CardDescription>粘贴一篇代表性文章，系统将自动提取5层21维数字资产</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="文章标题（可选，系统也可自动提取）"
            value={articleTitle}
            onChange={(e) => setArticleTitle(e.target.value)}
            className="bg-white"
          />
          <Textarea
            placeholder={"在此粘贴文章内容...\n\n建议粘贴完整的保险科普文章（至少200字），系统将提取：\n• 文章元信息（标题、类型、情感基调等）\n• 核心逻辑（论点、破局逻辑、论证结构等）\n• 内容模块（钩子引入、情绪接纳、认知破局等）\n• 语言风格（固定句式、口头禅、禁忌词等）\n• 原子素材（错误认知、生活类比、真实案例等）"}
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
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />AI 正在提取...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />开始提取</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数字资产地图（提取后显示） */}
      {extraction && (
        <>
          <DigitalAssetMap extraction={extraction} />

          {/* 5层展开卡片 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                5层提取详情
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
                  <>保存到素材库</>
                )}
              </Button>
            </div>
            {LAYER_CONFIG.map((layer) => (
              <LayerCard
                key={layer.key}
                layerKey={layer.key}
                name={layer.name}
                icon={layer.icon}
                color={layer.color}
                desc={layer.desc}
                data={(extraction as any)[layer.key]}
              />
            ))}
          </div>

          {/* 资产复用提示 */}
          <Card className="border-2 border-amber-200 bg-amber-50/50">
            <CardContent className="p-4">
              <h4 className="font-semibold text-amber-800 mb-2">资产复用路径</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="text-amber-700 font-medium">写作Agent自动消费</p>
                  <ul className="text-amber-600 text-xs space-y-0.5">
                    <li>• 核心逻辑层 → 自动匹配论证结构</li>
                    <li>• 内容模块层 → 快速组合写作零件</li>
                    <li>• 语言风格层 → 消除AI感，保持个人签名</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="text-amber-700 font-medium">素材库自动沉淀</p>
                  <ul className="text-amber-600 text-xs space-y-0.5">
                    <li>• 原子素材层 → 类比/案例/数据素材库</li>
                    <li>• 元信息层 → 标签化分类管理</li>
                    <li>• 错误认知 → 反驳类文章一键生成</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 历史记录弹窗 */}
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
