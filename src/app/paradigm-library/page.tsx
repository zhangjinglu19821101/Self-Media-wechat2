'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================
// 类型定义
// ============================================================

interface ParadigmStep {
  order: number;
  stepName: string;
  titleTemplate: string;
  contentRequirement: string;
  wordRange: { min: number; max: number };
  required: boolean;
  fixedPhrases?: string[];
  emojiSuggestions?: string[];
  shortSentence?: boolean;
  emotion?: string;
}

interface ParadigmEmotion {
  paragraphOrder: number;
  stepName: string;
  emotion: string;
  intensity: number;
}

interface ParadigmPositionMap {
  paragraphOrder: number;
  stepName: string;
  materialTypes: string[];
  isPrimary: boolean;
}

interface ParadigmListItem {
  paradigmCode: string;
  paradigmName: string;
  description: string;
  applicableArticleTypes: string[];
  applicableIndustries: string[];
  sortOrder: number;
}

interface ParadigmDetail extends ParadigmListItem {
  officialAccountStructure: ParadigmStep[];
  xiaohongshuStructure: ParadigmStep[];
  materialPositionMap: ParadigmPositionMap[];
  emotionCurve: ParadigmEmotion[];
  signaturePhrases: string[];
  isActive: boolean;
}

// ============================================================
// 常量映射
// ============================================================

const INDUSTRY_LABELS: Record<string, string> = {
  insurance_life: '人寿保险',
  insurance_health: '健康保险',
  insurance_property: '财产保险',
  finance: '金融理财',
  general: '通用',
};

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  analogy: '生活类比',
  misconception: '错误认知',
  case: '真实案例',
  data: '数据佐证',
  fixed_phrase: '固定句式',
  golden_sentence: '金句',
  personal_fragment: '个人碎片',
};

const EMOTION_COLORS: Record<string, string> = {
  '警醒': 'bg-red-100 text-red-700',
  '共情': 'bg-blue-100 text-blue-700',
  '突破': 'bg-orange-100 text-orange-700',
  '释然': 'bg-green-100 text-green-700',
  '坚定': 'bg-purple-100 text-purple-700',
  '温暖': 'bg-yellow-100 text-yellow-700',
  '升华': 'bg-indigo-100 text-indigo-700',
  '质疑': 'bg-red-100 text-red-700',
  '坦诚': 'bg-teal-100 text-teal-700',
  '理性': 'bg-cyan-100 text-cyan-700',
  '建设性': 'bg-emerald-100 text-emerald-700',
  '希望': 'bg-lime-100 text-lime-700',
  '务实': 'bg-slate-100 text-slate-700',
  '分析': 'bg-sky-100 text-sky-700',
  '行动': 'bg-amber-100 text-amber-700',
  '建议': 'bg-violet-100 text-violet-700',
  '客观': 'bg-gray-100 text-gray-700',
  '肯定': 'bg-green-100 text-green-700',
  '谨慎': 'bg-amber-100 text-amber-700',
  '困惑': 'bg-purple-100 text-purple-700',
  '清晰': 'bg-cyan-100 text-cyan-700',
  '确信': 'bg-emerald-100 text-emerald-700',
  '叙事': 'bg-blue-100 text-blue-700',
  '感悟': 'bg-indigo-100 text-indigo-700',
  '权衡': 'bg-teal-100 text-teal-700',
  '关注': 'bg-rose-100 text-rose-700',
  '顿悟': 'bg-fuchsia-100 text-fuchsia-700',
  '惋惜': 'bg-pink-100 text-pink-700',
  '感慨': 'bg-violet-100 text-violet-700',
  '期待': 'bg-sky-100 text-sky-700',
  '感恩': 'bg-rose-100 text-rose-700',
};

const INTENSITY_BAR_COLORS = [
  'bg-gray-300', // 0-2
  'bg-blue-400', // 3-4
  'bg-green-500', // 5-6
  'bg-orange-500', // 7-8
  'bg-red-500',   // 9-10
];

function getIntensityColor(intensity: number): string {
  if (intensity <= 2) return INTENSITY_BAR_COLORS[0];
  if (intensity <= 4) return INTENSITY_BAR_COLORS[1];
  if (intensity <= 6) return INTENSITY_BAR_COLORS[2];
  if (intensity <= 8) return INTENSITY_BAR_COLORS[3];
  return INTENSITY_BAR_COLORS[4];
}

// ============================================================
// 主组件
// ============================================================

export default function ParadigmLibraryPage() {
  const [paradigms, setParadigms] = useState<ParadigmListItem[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [detail, setDetail] = useState<ParadigmDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'structure' | 'xhs' | 'materials' | 'emotion'>('structure');
  const [recognitionResult, setRecognitionResult] = useState<any>(null);
  const [recognizeInput, setRecognizeInput] = useState({ articleType: '', industry: '', topic: '' });

  // 加载范式列表
  const fetchParadigms = useCallback(async () => {
    try {
      const res = await fetch('/api/paradigm-library');
      const data = await res.json();
      if (data.success) {
        setParadigms(data.data);
        if (data.data.length > 0 && !selectedCode) {
          setSelectedCode(data.data[0].paradigmCode);
        }
      }
    } catch (err) {
      console.error('加载范式列表失败:', err);
    }
  }, [selectedCode]);

  // 加载范式详情
  const fetchDetail = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/paradigm-library?code=${code}`);
      const data = await res.json();
      if (data.success) {
        setDetail(data.data);
      }
    } catch (err) {
      console.error('加载范式详情失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParadigms();
  }, [fetchParadigms]);

  useEffect(() => {
    if (selectedCode) {
      fetchDetail(selectedCode);
    }
  }, [selectedCode, fetchDetail]);

  // 范式识别
  const handleRecognize = async () => {
    try {
      const res = await fetch('/api/paradigm-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recognize',
          ...recognizeInput,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRecognitionResult(data.data);
        setSelectedCode(data.data.paradigmCode);
      }
    } catch (err) {
      console.error('范式识别失败:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部标题 */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">
            10套创作范式库
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            「范式锁骨架 + 素材填血肉」的零AI味创作闭环 — 覆盖所有保险科普场景
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* 范式识别区 */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 mb-6 border border-indigo-100">
          <h2 className="text-base font-semibold text-indigo-900 mb-3">范式识别器</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-600 mb-1">文章类型</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="如：客户误区型"
                value={recognizeInput.articleType}
                onChange={(e) => setRecognizeInput(prev => ({ ...prev, articleType: e.target.value }))}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-600 mb-1">行业</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={recognizeInput.industry}
                onChange={(e) => setRecognizeInput(prev => ({ ...prev, industry: e.target.value }))}
              >
                <option value="">全部行业</option>
                <option value="insurance_life">人寿保险</option>
                <option value="insurance_health">健康保险</option>
                <option value="insurance_property">财产保险</option>
                <option value="finance">金融理财</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-600 mb-1">主题关键词</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="如：骗人、不赔、避坑"
                value={recognizeInput.topic}
                onChange={(e) => setRecognizeInput(prev => ({ ...prev, topic: e.target.value }))}
              />
            </div>
            <button
              onClick={handleRecognize}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
            >
              识别范式
            </button>
          </div>
          {recognitionResult && (
            <div className="mt-3 bg-white rounded-lg p-3 border border-indigo-200 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-indigo-700">{recognitionResult.paradigmCode}</span>
                <span className="text-gray-800">{recognitionResult.paradigmName}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  置信度 {Math.round(recognitionResult.confidence * 100)}%
                </span>
              </div>
              <p className="text-gray-500 mt-1">{recognitionResult.matchReason}</p>
            </div>
          )}
        </div>

        <div className="flex gap-6">
          {/* 左侧范式列表 */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="text-sm font-semibold text-gray-700">范式列表</h3>
              </div>
              <div className="divide-y max-h-[calc(100vh-300px)] overflow-y-auto">
                {paradigms.map((p) => (
                  <button
                    key={p.paradigmCode}
                    onClick={() => { setSelectedCode(p.paradigmCode); setRecognitionResult(null); }}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition ${
                      selectedCode === p.paradigmCode ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                        {p.paradigmCode}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{p.paradigmName}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.applicableIndustries.slice(0, 3).map((ind) => (
                        <span key={ind} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {INDUSTRY_LABELS[ind] || ind}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧详情 */}
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-400">加载中...</div>
              </div>
            ) : detail ? (
              <div className="bg-white rounded-xl border overflow-hidden">
                {/* 范式头部 */}
                <div className="px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                      {detail.paradigmCode}
                    </span>
                    <h2 className="text-lg font-bold text-gray-900">{detail.paradigmName}</h2>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{detail.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {detail.applicableArticleTypes.map((t) => (
                      <span key={t} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {t}
                      </span>
                    ))}
                    {detail.applicableIndustries.map((ind) => (
                      <span key={ind} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        {INDUSTRY_LABELS[ind] || ind}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Tab切换 */}
                <div className="flex border-b">
                  {[
                    { key: 'structure', label: '公众号7段结构' },
                    { key: 'xhs', label: '小红书版结构' },
                    { key: 'materials', label: '素材位置映射' },
                    { key: 'emotion', label: '情绪节奏曲线' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as any)}
                      className={`px-5 py-3 text-sm font-medium transition ${
                        activeTab === tab.key
                          ? 'text-indigo-600 border-b-2 border-indigo-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab内容 */}
                <div className="p-6 max-h-[calc(100vh-420px)] overflow-y-auto">
                  {/* 公众号7段结构 */}
                  {activeTab === 'structure' && (
                    <div className="space-y-4">
                      {(detail.officialAccountStructure || []).map((step) => (
                        <div key={step.order} className="border rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold">
                              {step.order}
                            </span>
                            <span className="font-semibold text-gray-900">{step.stepName}</span>
                            {step.required && (
                              <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">必须</span>
                            )}
                          </div>
                          <div className="ml-9 space-y-1.5 text-sm text-gray-600">
                            <p><span className="font-medium text-gray-700">标题模板：</span>{step.titleTemplate}</p>
                            <p><span className="font-medium text-gray-700">内容要求：</span>{step.contentRequirement}</p>
                            <p><span className="font-medium text-gray-700">字数：</span>{step.wordRange?.min}~{step.wordRange?.max}字</p>
                            {step.fixedPhrases && step.fixedPhrases.length > 0 && (
                              <div>
                                <span className="font-medium text-gray-700">固定句式：</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {step.fixedPhrases.map((phrase, i) => (
                                    <span key={i} className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs">
                                      &ldquo;{phrase}&rdquo;
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 小红书版结构 */}
                  {activeTab === 'xhs' && (
                    <div className="space-y-4">
                      {(detail.xiaohongshuStructure || []).map((step) => (
                        <div key={step.order} className="border rounded-lg p-4 bg-gradient-to-r from-pink-50 to-white">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-pink-100 text-pink-700 text-sm font-bold">
                              {step.order}
                            </span>
                            <span className="font-semibold text-gray-900">{step.stepName}</span>
                            {step.shortSentence && (
                              <span className="text-xs bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded">短句模式</span>
                            )}
                          </div>
                          <div className="ml-9 space-y-1.5 text-sm text-gray-600">
                            <p><span className="font-medium text-gray-700">标题模板：</span>{step.titleTemplate}</p>
                            <p><span className="font-medium text-gray-700">内容要求：</span>{step.contentRequirement}</p>
                            <p><span className="font-medium text-gray-700">字数：</span>{step.wordRange?.min}~{step.wordRange?.max}字</p>
                            {step.emojiSuggestions && step.emojiSuggestions.length > 0 && (
                              <div>
                                <span className="font-medium text-gray-700">推荐emoji：</span>
                                <span className="ml-1 text-lg">{step.emojiSuggestions.join(' ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 素材位置映射 */}
                  {activeTab === 'materials' && (
                    <div className="space-y-3">
                      {(detail.materialPositionMap || []).map((slot) => {
                        const step = (detail.officialAccountStructure || []).find(s => s.order === slot.paragraphOrder);
                        return (
                          <div key={slot.paragraphOrder} className={`border rounded-lg p-4 ${slot.isPrimary ? 'border-indigo-200 bg-indigo-50/30' : ''}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold">
                                {slot.paragraphOrder}
                              </span>
                              <span className="font-semibold text-gray-900">{slot.stepName}</span>
                              {slot.isPrimary && (
                                <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-medium">
                                  主素材槽位
                                </span>
                              )}
                              {!slot.isPrimary && (
                                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                  辅助素材槽位
                                </span>
                              )}
                            </div>
                            <div className="ml-9 flex flex-wrap gap-2">
                              {slot.materialTypes.map((type) => (
                                <span key={type} className="bg-white border px-2.5 py-1 rounded-lg text-sm">
                                  <span className="font-medium text-gray-700">{MATERIAL_TYPE_LABELS[type] || type}</span>
                                  <span className="text-gray-400 text-xs ml-1">({type})</span>
                                </span>
                              ))}
                            </div>
                            {step && (
                              <p className="ml-9 mt-2 text-xs text-gray-500">
                                对应结构：{step.titleTemplate}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 情绪节奏曲线 */}
                  {activeTab === 'emotion' && (
                    <div className="space-y-3">
                      {(detail.emotionCurve || []).map((e) => (
                        <div key={e.paragraphOrder} className="flex items-center gap-4 border rounded-lg p-4">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-700 text-sm font-bold flex-shrink-0">
                            {e.paragraphOrder}
                          </span>
                          <span className="text-sm font-medium text-gray-700 w-20 flex-shrink-0">{e.stepName}</span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${EMOTION_COLORS[e.emotion] || 'bg-gray-100 text-gray-700'}`}>
                            {e.emotion}
                          </span>
                          <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${getIntensityColor(e.intensity)}`}
                                style={{ width: `${e.intensity * 10}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-8">{e.intensity}/10</span>
                          </div>
                        </div>
                      ))}

                      {/* 标志性句式 */}
                      {detail.signaturePhrases && detail.signaturePhrases.length > 0 && (
                        <div className="mt-6 border-t pt-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">标志性句式</h4>
                          <div className="flex flex-wrap gap-2">
                            {detail.signaturePhrases.map((phrase, i) => (
                              <span key={i} className="bg-yellow-50 text-yellow-800 border border-yellow-200 px-3 py-1.5 rounded-lg text-sm">
                                &ldquo;{phrase}&rdquo;
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                请从左侧选择一个范式查看详情
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
