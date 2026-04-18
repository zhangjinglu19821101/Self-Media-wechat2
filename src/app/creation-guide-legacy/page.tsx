'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Plus, Trash2, Send, CheckCircle2, BookmarkPlus, ExternalLink, BookOpen, X, HelpCircle, AlertTriangle, ListTodo } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';

// 🔥 素材项类型定义
interface MaterialItem {
  id: string;
  title: string;
  type: string;
  content: string;
  sourceDesc?: string;
  topicTags?: string[];
  sceneTags?: string[];
  emotionTags?: string[];
  useCount?: number;
}

// 🔥 创作引导持久化数据类型
interface CreationGuideDraft {
  coreOpinion: string;
  emotionTone: string;
  selectedMaterialIds: string[];
  savedAt: number;
  version: number;
}

// localStorage Key 前缀
const STORAGE_KEY_PREFIX = 'creationGuide_draft_new_';
const CURRENT_DRAFT_VERSION = 1;

// 获取本地存储 Key
function getStorageKey(): string {
  return `${STORAGE_KEY_PREFIX}default`;
}

// 保存到本地
function saveDraft(data: Omit<CreationGuideDraft, 'savedAt' | 'version'>) {
  if (typeof window === 'undefined') return;
  try {
    const draft: CreationGuideDraft = {
      ...data,
      savedAt: Date.now(),
      version: CURRENT_DRAFT_VERSION,
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(draft));
  } catch (error) {
    console.warn('[CreationGuide] 保存失败:', error);
  }
}

// 加载本地草稿
function loadDraft(): CreationGuideDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return null;
    const draft = JSON.parse(raw) as CreationGuideDraft;
    if (draft.version !== CURRENT_DRAFT_VERSION) return null;
    if (Date.now() - draft.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return draft;
  } catch { return null; }
}

// 情感基调选项
const EMOTION_OPTIONS = [
  { value: 'rational', label: '理性客观', desc: '冷静分析、数据支撑、客观呈现' },
  { value: 'caution', label: '踩坑警醒', desc: '风险警示、避坑指南、警示教育' },
  { value: 'empathy', label: '温情共情', desc: '情感共鸣、人文关怀、温暖叙事' },
  { value: 'authority', label: '专业权威', desc: '专家视角、深度解读、权威背书' },
];

// 标签颜色映射
function getTagColor(tag: string): string {
  const tagLower = tag.toLowerCase();
  if (tagLower.includes('港险') || tagLower.includes('重疾')) return 'bg-purple-100 text-purple-700';
  if (tagLower.includes('医疗') || tagLower.includes('报销')) return 'bg-blue-100 text-blue-700';
  if (tagLower.includes('意外') || tagLower.includes('理赔')) return 'bg-orange-100 text-orange-700';
  if (tagLower.includes('踩坑') || tagLower.includes('警告')) return 'bg-red-100 text-red-700';
  if (tagLower.includes('省钱') || tagLower.includes('划算')) return 'bg-green-100 text-green-700';
  return 'bg-gray-100 text-gray-700';
}

// 素材类型图标
function getMaterialTypeIcon(type: string) {
  switch (type) {
    case 'case': return '📋';
    case 'data': return '📊';
    case 'story': return '📖';
    case 'quote': return '💬';
    case 'opening': return '🎬';
    case 'ending': return '🎬';
    default: return '📄';
  }
}

export default function CreationGuidePage() {
  // 创作引导状态
  const [mainInstruction, setMainInstruction] = useState('');
  const [coreOpinion, setCoreOpinion] = useState('');
  const [emotionTone, setEmotionTone] = useState('rational');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  
  // AI 建议
  const [suggestedOpinions, setSuggestedOpinions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [recommendedMaterials, setRecommendedMaterials] = useState<MaterialItem[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  
  // 素材库
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loadingMaterialsList, setLoadingMaterialsList] = useState(false);
  const [materialFilter, setMaterialFilter] = useState('all');
  const [materialSearch, setMaterialSearch] = useState('');
  
  // 提交状态
  const [submitting, setSubmitting] = useState(false);

  // 加载素材库列表
  const loadMaterialsList = useCallback(async () => {
    setLoadingMaterialsList(true);
    try {
      const response = await fetch('/api/materials?limit=50');
      const data = await response.json();
      if (data.success) {
        setMaterials(data.data.items || []);
      }
    } catch (error) {
      console.error('加载素材库失败:', error);
    } finally {
      setLoadingMaterialsList(false);
    }
  }, []);

  // 初始化
  useEffect(() => {
    loadMaterialsList();
    
    // 加载本地草稿
    const draft = loadDraft();
    if (draft) {
      setCoreOpinion(draft.coreOpinion);
      setEmotionTone(draft.emotionTone);
      setSelectedMaterialIds(draft.selectedMaterialIds);
    }
  }, [loadMaterialsList]);

  // 自动保存
  useEffect(() => {
    if (mainInstruction || coreOpinion || emotionTone !== 'rational' || selectedMaterialIds.length > 0) {
      saveDraft({ coreOpinion, emotionTone, selectedMaterialIds });
    }
  }, [mainInstruction, coreOpinion, emotionTone, selectedMaterialIds]);

  // 🔥 AI 生成建议观点
  const handleSuggestOpinions = async () => {
    if (!mainInstruction.trim()) {
      toast.error('请先输入创作主题');
      return;
    }
    
    setLoadingSuggestions(true);
    try {
      const response = await fetch('/api/agents/b/suggest-opinion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: mainInstruction }),
      });
      const data = await response.json();
      if (data.success && data.suggestions) {
        setSuggestedOpinions(data.suggestions);
      } else {
        toast.error(data.error || '生成建议失败');
      }
    } catch (error) {
      toast.error('生成建议失败');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // 🔥 AI 推荐素材
  const handleMaterialRecommend = async () => {
    if (!mainInstruction.trim()) {
      toast.error('请先输入创作主题');
      return;
    }
    
    setLoadingMaterials(true);
    try {
      const response = await fetch(`/api/materials/recommend?instruction=${encodeURIComponent(mainInstruction)}&limit=6`);
      const data = await response.json();
      if (data.success) {
        setRecommendedMaterials(data.data || []);
      }
    } catch (error) {
      console.error('推荐素材失败:', error);
    } finally {
      setLoadingMaterials(false);
    }
  };

  // 选择建议观点
  const handleSelectOpinion = (opinion: string) => {
    setCoreOpinion(opinion);
    setSuggestedOpinions([]);
  };

  // 切换素材选中
  const toggleMaterial = (materialId: string) => {
    setSelectedMaterialIds(prev => 
      prev.includes(materialId)
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
  };

  // 筛选素材
  const filteredMaterials = materials.filter(m => {
    const matchFilter = materialFilter === 'all' || m.type === materialFilter;
    const matchSearch = !materialSearch || 
      m.title.toLowerCase().includes(materialSearch.toLowerCase()) ||
      m.content.toLowerCase().includes(materialSearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  // 提交创作
  const handleSubmit = async () => {
    if (!mainInstruction.trim()) {
      toast.error('请输入创作主题');
      return;
    }

    setSubmitting(true);
    try {
      // 组装 userOpinion
      const userOpinion = coreOpinion || mainInstruction;

      const response = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userOpinion,
          emotionTone,
          materialIds: selectedMaterialIds,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('创作任务已提交！');
        
        // 清理本地草稿
        localStorage.removeItem(getStorageKey());
        
        // 跳转到任务管理页面
        setTimeout(() => {
          window.location.href = '/home';
        }, 1000);
      } else {
        toast.error(data.error || '提交失败');
      }
    } catch (error) {
      toast.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* 页面标题 */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">创作引导</h1>
          <p className="text-gray-600">明确创作意图，让 AI 产出更贴合你的期望</p>
        </div>

        {/* 创作主题 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              创作主题
            </CardTitle>
            <CardDescription>告诉 AI 你想要创作什么内容</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="例如：写一篇关于香港保险和内地保险对比的文章，目标是帮助读者了解两者的优缺点..."
              value={mainInstruction}
              onChange={(e) => setMainInstruction(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </CardContent>
        </Card>

        {/* 创作引导（始终展开） */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              创作引导（可选）
            </CardTitle>
            <CardDescription>
              帮助 AI 更好地理解你的创作意图，让产出更符合预期
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* 核心观点 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">核心观点</Label>
                  <p className="text-sm text-gray-500">想让文章表达的核心立场或结论</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestOpinions}
                  disabled={!mainInstruction.trim() || loadingSuggestions}
                >
                  {loadingSuggestions ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  AI 帮我想观点
                </Button>
              </div>
              
              <Textarea
                placeholder="例如：香港保险在保障范围和分红方面更有优势，但内地保险在理赔便利性和监管保障方面更胜一筹..."
                value={coreOpinion}
                onChange={(e) => setCoreOpinion(e.target.value)}
                rows={3}
                className="resize-none"
              />
              
              {/* AI 建议的观点 */}
              {suggestedOpinions.length > 0 && (
                <div className="bg-indigo-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-indigo-700">AI 建议的核心观点：</p>
                  {suggestedOpinions.map((opinion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSelectOpinion(opinion)}
                      className="w-full text-left p-3 bg-white rounded-lg hover:bg-indigo-100 transition-colors text-sm"
                    >
                      {opinion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 情感基调 */}
            <div className="space-y-3">
              <div>
                <Label className="text-base font-medium">情感基调</Label>
                <p className="text-sm text-gray-500">影响文章的语气和风格</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {EMOTION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setEmotionTone(option.value)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      emotionTone === option.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 素材关联 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">关联素材</Label>
                  <p className="text-sm text-gray-500">选择可引用的案例、数据或故事</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMaterialRecommend}
                  disabled={!mainInstruction.trim() || loadingMaterials}
                >
                  {loadingMaterials ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  AI 推荐素材
                </Button>
              </div>
              
              {/* AI 推荐的素材 */}
              {recommendedMaterials.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-green-700">AI 推荐的素材：</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {recommendedMaterials.map((material) => (
                      <button
                        key={material.id}
                        onClick={() => toggleMaterial(material.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selectedMaterialIds.includes(material.id)
                            ? 'border-green-500 bg-green-100'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{getMaterialTypeIcon(material.type)}</span>
                          <span className="font-medium text-sm">{material.title}</span>
                          {selectedMaterialIds.includes(material.id) && (
                            <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 素材库列表 */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="搜索素材..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    className="flex-1"
                  />
                  <select
                    value={materialFilter}
                    onChange={(e) => setMaterialFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="all">全部类型</option>
                    <option value="case">案例</option>
                    <option value="data">数据</option>
                    <option value="story">故事</option>
                    <option value="quote">引用</option>
                    <option value="opening">开头</option>
                    <option value="ending">结尾</option>
                  </select>
                </div>
                
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {loadingMaterialsList ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    </div>
                  ) : filteredMaterials.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">暂无素材</p>
                  ) : (
                    filteredMaterials.map((material) => (
                      <div
                        key={material.id}
                        onClick={() => toggleMaterial(material.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedMaterialIds.includes(material.id)
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl">{getMaterialTypeIcon(material.type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{material.title}</p>
                            <p className="text-xs text-gray-500 line-clamp-2">{material.content}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(material.topicTags || []).slice(0, 3).map((tag) => (
                                <span key={tag} className={`px-1.5 py-0.5 rounded text-xs ${getTagColor(tag)}`}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          {selectedMaterialIds.includes(material.id) && (
                            <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* 已选素材 */}
              {selectedMaterialIds.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">已选 {selectedMaterialIds.length} 个素材</span>
                  <button
                    onClick={() => setSelectedMaterialIds([])}
                    className="text-xs text-red-600 hover:underline"
                  >
                    清空
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 底部功能入口 */}
        <div className="flex justify-center gap-4">
          <Link href="/full-home">
            <Button size="lg">
              <ListTodo className="w-5 h-5 mr-2" />
              任务列表（查看执行详情/MCP记录）
            </Button>
          </Link>
        </div>

        {/* 提交按钮 */}
        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={!mainInstruction.trim() || submitting}
            size="lg"
            className="px-8"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Send className="w-5 h-5 mr-2" />
            )}
            {submitting ? '提交中...' : '提交创作'}
          </Button>
        </div>
      </div>
    </div>
  );
}
