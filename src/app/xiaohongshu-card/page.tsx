/**
 * 小红书卡片生成 - 预览与测试页面
 * 
 * /xiaohongshu-card
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const GRADIENT_OPTIONS = [
  { value: 'pinkOrange', label: '粉橙渐变（热门）' },
  { value: 'bluePurple', label: '蓝紫渐变（专业）' },
  { value: 'tealGreen', label: '青绿渐变（清新）' },
  { value: 'deepBlue', label: '深蓝渐变（稳重）' },
  { value: 'coralPink', label: '珊瑚粉（女性向）' },
];

interface GeneratedCard {
  index: number;
  base64: string;
  width: number;
  height: number;
}

export default function XiaohongshuCardPage() {
  const [title, setTitle] = useState('我已经不卖重疾险了，但我能告诉你一些真相');
  const [intro, setIntro] = useState('今天我想卸下保险销售的面具，说说那些没人愿意明说的大实话');
  const [pointsText, setPointsText] = useState(
    `别把重疾险当医药费报销|重疾险赔的钱，从来不是医疗费，而是收入损失\n别迷信病种数量|银保监会规定的28种重疾，已覆盖95%以上理赔\n别为了返本多交钱|同样30万保额，消费型年保费3000元，返还型要8000元`
  );
  const [conclusion, setConclusion] = useState('希望这些真相能帮你少踩坑');
  const [tags, setTags] = useState('保险,重疾险,避坑指南');
  const [gradient, setGradient] = useState('pinkOrange');
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const parsePoints = () => {
    return pointsText
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [title, content] = line.split('|');
        return { title: title?.trim() || '', content: content?.trim() || '' };
      });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setCards([]);

    try {
      const points = parsePoints();
      if (!title || points.length === 0) {
        setError('请填写标题和至少一个要点');
        return;
      }

      const response = await fetch('/api/xiaohongshu/generate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'article',
          title,
          intro,
          points,
          conclusion,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          gradientScheme: gradient,
        }),
      });

      // 🔥 P1 修复：检查 HTTP 状态码
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        setError(data.error || '生成失败');
        return;
      }

      setCards(data.cards || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const downloadCard = (base64: string, index: number) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64}`;
    link.download = `xhs_card_${index + 1}.png`;
    link.click();
  };

  const downloadAll = () => {
    cards.forEach((card, index) => {
      setTimeout(() => downloadCard(card.base64, index), index * 200);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">小红书卡片生成器</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：输入区 */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">文章内容</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>标题</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="文章标题（≤20字）"
                    maxLength={30}
                  />
                </div>

                <div>
                  <Label>副标题/引言</Label>
                  <Input
                    value={intro}
                    onChange={(e) => setIntro(e.target.value)}
                    placeholder="副标题（可选）"
                  />
                </div>

                <div>
                  <Label>
                    要点（每行一条，格式：标题|内容）
                  </Label>
                  <Textarea
                    value={pointsText}
                    onChange={(e) => setPointsText(e.target.value)}
                    placeholder="要点标题|要点内容"
                    rows={6}
                  />
                </div>

                <div>
                  <Label>结语</Label>
                  <Input
                    value={conclusion}
                    onChange={(e) => setConclusion(e.target.value)}
                    placeholder="总结语"
                  />
                </div>

                <div>
                  <Label>话题标签（逗号分隔）</Label>
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="保险,重疾险"
                  />
                </div>

                <div>
                  <Label>配色方案</Label>
                  <Select value={gradient} onValueChange={setGradient}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADIENT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? '生成中...' : '生成卡片'}
                </Button>

                {error && (
                  <p className="text-red-500 text-sm">{error}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：预览区 */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                生成结果 {cards.length > 0 && `(${cards.length}张)`}
              </h2>
              {cards.length > 0 && (
                <Button variant="outline" size="sm" onClick={downloadAll}>
                  下载全部
                </Button>
              )}
            </div>

            {cards.length === 0 ? (
              <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-lg text-gray-400">
                填写左侧内容后点击生成
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {cards.map((card, index) => (
                  <div
                    key={index}
                    className="relative group cursor-pointer"
                    onClick={() => downloadCard(card.base64, index)}
                  >
                    <img
                      src={`data:image/png;base64,${card.base64}`}
                      alt={`卡片 ${index + 1}`}
                      className="w-full rounded-lg shadow-md hover:shadow-xl transition-shadow"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium">
                        点击下载
                      </span>
                    </div>
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                      {index === 0
                        ? '封面'
                        : index === cards.length - 1
                          ? '结尾'
                          : `要点${index}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
