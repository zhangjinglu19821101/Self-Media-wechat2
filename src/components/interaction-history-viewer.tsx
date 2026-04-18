'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, 
  User, 
  Bot, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Eye,
  Copy,
  CheckCircle2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

// 交互记录类型定义
interface InteractionRecord {
  id: number;
  stepNo: number;
  interactNum: number;
  interactType: 'request' | 'response' | 'agent_consult' | 'agent_response';
  interactUser: string;
  interactTime: string;
  interactContent: any;
}

// 交互对类型（request + response 成对）
interface InteractionPair {
  pairId: string;
  interactNum: number;
  request?: InteractionRecord;
  response?: InteractionRecord;
  timestamp: string;
}

export default function InteractionHistoryViewer() {
  const [commandResultId, setCommandResultId] = useState('');
  const [stepNo, setStepNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<InteractionRecord[]>([]);
  const [error, setError] = useState('');
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('timeline');

  // 查询交互记录
  const handleQuery = async () => {
    if (!commandResultId) {
      setError('请输入 Command Result ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.append('commandResultId', commandResultId);
      if (stepNo) params.append('stepNo', stepNo);

      const response = await fetch(`/api/query/interaction-history?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setRecords(result.data.records);
      } else {
        setError(result.error || '查询失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '查询失败');
    } finally {
      setLoading(false);
    }
  };

  // 构建交互对（将 request 和 response 配对）
  const buildInteractionPairs = (): InteractionPair[] => {
    const pairs: InteractionPair[] = [];
    const numMap = new Map<number, InteractionPair>();

    // 先按 interactNum 分组
    records.forEach(record => {
      const num = record.interactNum;
      if (!numMap.has(num)) {
        numMap.set(num, {
          pairId: `${record.stepNo}-${num}`,
          interactNum: num,
          timestamp: record.interactTime,
        });
      }
      
      const pair = numMap.get(num)!;
      if (record.interactType === 'request') {
        pair.request = record;
      } else {
        pair.response = record;
      }
      
      // 使用较早的时间戳
      if (record.interactTime < pair.timestamp) {
        pair.timestamp = record.interactTime;
      }
    });

    // 转换为数组并排序
    return Array.from(numMap.values())
      .sort((a, b) => a.interactNum - b.interactNum);
  };

  // 切换展开/收起
  const togglePair = (pairId: string) => {
    const newExpanded = new Set(expandedPairs);
    if (newExpanded.has(pairId)) {
      newExpanded.delete(pairId);
    } else {
      newExpanded.add(pairId);
    }
    setExpandedPairs(newExpanded);
  };

  // 获取交互方图标
  const getInteractUserIcon = (user: string) => {
    if (user === 'human' || user.includes('user')) {
      return <User className="w-4 h-4" />;
    } else if (user.includes('agent') || user.includes('Agent')) {
      return <Bot className="w-4 h-4" />;
    }
    return <MessageSquare className="w-4 h-4" />;
  };

  // 获取交互方颜色
  const getInteractUserColor = (user: string) => {
    if (user === 'human' || user.includes('user')) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    } else if (user.includes('agent') || user.includes('Agent')) {
      return 'bg-purple-100 text-purple-700 border-purple-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  // 格式化时间
  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timeStr;
    }
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // 渲染简化的内容摘要
  const renderContentSummary = (content: any, type: string) => {
    if (!content) return <span className="text-gray-400">无内容</span>;

    // 尝试提取关键字段
    if (type === 'request') {
      if (content.question?.prompt_message) {
        const msg = content.question.prompt_message;
        return (
          <div className="space-y-1">
            {msg.title && <div className="font-medium text-blue-700">{msg.title}</div>}
            {msg.description && <div className="text-sm text-gray-600">{msg.description}</div>}
          </div>
        );
      }
      if (content.question?.problem) {
        return <div className="text-sm text-gray-700">{content.question.problem}</div>;
      }
    }

    if (type === 'response') {
      // 🔴🔴🔴 新增：支持 v2 格式 canComplete 字段
      if (content.canComplete !== undefined) {
        return (
          <div className="space-y-1">
            <Badge variant="outline" className={
              content.canComplete ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
            }>
              canComplete: {String(content.canComplete)}
            </Badge>
            {content.isNeedMcp !== undefined && (
              <div className="text-sm text-gray-600">
                isNeedMcp: {String(content.isNeedMcp)}
              </div>
            )}
            {content.isTaskDown !== undefined && (
              <div className="text-sm text-gray-600">
                isTaskDown: {String(content.isTaskDown)}
              </div>
            )}
          </div>
        );
      }
      
      if (content.response?.decision) {
        const dec = content.response.decision;
        return (
          <div className="space-y-1">
            <Badge variant="outline" className={
              dec.type === 'COMPLETE' ? 'bg-green-100 text-green-700' :
              dec.type === 'NEED_USER' ? 'bg-yellow-100 text-yellow-700' :
              dec.type === 'EXECUTE_MCP' ? 'bg-blue-100 text-blue-700' :
              dec.type === 'CANNOT_HANDLE' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }>
              {dec.type}
            </Badge>
            {dec.reasoning && (
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                {dec.reasoning}
              </div>
            )}
          </div>
        );
      }
      
      // 🔴🔴🔴 新增：直接支持 Agent B/Agent T 决策格式
      // 尝试提取决策类型和 reasoning
      const decisionType = content.type || content.decision?.type || content.action;
      const reasoning = content.reasoning || content.decision?.reasoning || content.reason;
      const context = content.context || content.decision?.context;
      
      if (decisionType) {
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={
                decisionType === 'COMPLETE' || decisionType === 'completed' ? 'bg-green-100 text-green-700' :
                decisionType === 'NEED_USER' || decisionType === 'waiting_user' ? 'bg-yellow-100 text-yellow-700' :
                decisionType === 'EXECUTE_MCP' || decisionType === 'execute_mcp' ? 'bg-blue-100 text-blue-700' :
                decisionType === 'CANNOT_HANDLE' ? 'bg-red-100 text-red-700' :
                decisionType === 'reexecute_executor' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-700'
              }>
                {decisionType}
              </Badge>
              {content.reasonCode && (
                <Badge variant="outline" className="text-xs">
                  {content.reasonCode}
                </Badge>
              )}
            </div>
            
            {/* 🔴 决策依据展示 - 更醒目的样式 */}
            {reasoning && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="font-semibold text-blue-800 text-sm">决策依据 (reasoning)</div>
                </div>
                <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                  {typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning, null, 2)}
                </div>
              </div>
            )}
            
            {/* 🔴 决策结果展示（未完成原因）- 更醒目的样式 */}
            {content.notCompletedReason && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <div className="font-semibold text-amber-800 text-sm">决策结果 - 未完成原因 (notCompletedReason)</div>
                </div>
                <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                  {content.notCompletedReason}
                </div>
              </div>
            )}
            
            {/* 🔴 执行上下文展示 */}
            {context && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <div className="font-semibold text-purple-800 text-sm">执行上下文 (context)</div>
                </div>
                <div className="space-y-2 text-sm">
                  {context.executionSummary && (
                    <div className="text-gray-700">
                      <span className="text-purple-600 font-medium">summary:</span> {context.executionSummary}
                    </div>
                  )}
                  {context.riskLevel && (
                    <div className="text-gray-700">
                      <span className="text-purple-600 font-medium">riskLevel:</span>{' '}
                      <Badge className={`text-xs ${
                        context.riskLevel === 'low' ? 'bg-green-100 text-green-700 border-green-300' :
                        context.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                        context.riskLevel === 'high' ? 'bg-red-100 text-red-700 border-red-300' : ''
                      }`}>
                        {context.riskLevel}
                      </Badge>
                    </div>
                  )}
                  {context.suggestedAction && (
                    <div className="text-gray-700">
                      <span className="text-purple-600 font-medium">suggestedAction:</span> {context.suggestedAction}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 🔴 MCP 参数展示 - 支持 content.decision.mcpParams */}
            {(() => {
              const mcpParams = content.data?.mcpParams || content.decision?.mcpParams;
              if (!mcpParams) return null;
              return (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <div className="font-semibold text-emerald-800 text-sm">MCP 参数</div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-600 font-medium">toolName:</span> 
                      <Badge variant="outline" className="bg-white">{mcpParams.toolName}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-600 font-medium">actionName:</span> 
                      <Badge variant="outline" className="bg-white">{mcpParams.actionName}</Badge>
                    </div>
                    {mcpParams.solutionNum && (
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-medium">solutionNum:</span> 
                        <span className="text-gray-700">{mcpParams.solutionNum}</span>
                      </div>
                    )}
                    {mcpParams.hasParams && (
                      <details className="mt-2">
                        <summary className="text-emerald-600 cursor-pointer font-medium hover:text-emerald-700">
                          查看参数详情
                        </summary>
                        <pre className="mt-2 p-3 bg-white rounded border border-emerald-200 text-gray-600 overflow-x-auto max-h-48">
                          {JSON.stringify(mcpParams, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              );
            })()}
            
            {/* 🔴 MCP 执行结果展示 */}
            {content.mcpResult && (
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                  <div className="font-semibold text-cyan-800 text-sm">MCP 执行结果</div>
                </div>
                <div className="text-sm">
                  {content.mcpResult.success ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-700 border-green-300">执行成功</Badge>
                      {content.mcpResult.data && (
                        <span className="text-gray-600">返回数据长度: {JSON.stringify(content.mcpResult.data).length} 字符</span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Badge className="bg-red-100 text-red-700 border-red-300">执行失败</Badge>
                      {content.mcpResult.error && (
                        <div className="text-red-700 mt-1">错误: {content.mcpResult.error}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 🔴 回退到简单摘要 */}
            {!reasoning && !context && !content.data?.mcpParams && !content.mcpResult && (
              <div className="text-sm text-gray-500">
                {content.suggestion || content.output || '无详细信息'}
              </div>
            )}
          </div>
        );
      }
      
      if (content.response?.final_conclusion) {
        return <div className="text-sm text-gray-700">{content.response.final_conclusion}</div>;
      }
    }

    return <span className="text-gray-500">结构化数据</span>;
  };

  const pairs = buildInteractionPairs();

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            交互历史查看器
          </CardTitle>
          <CardDescription>
            可视化查看 agent_sub_tasks_step_history 的交互记录
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 查询区域 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="commandResultId">Command Result ID *</Label>
              <Input
                id="commandResultId"
                placeholder="输入 Command Result ID"
                value={commandResultId}
                onChange={e => setCommandResultId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stepNo">Step No (可选)</Label>
              <Input
                id="stepNo"
                placeholder="输入步骤编号"
                value={stepNo}
                onChange={e => setStepNo(e.target.value)}
              />
            </div>
            <div className="space-y-2 flex items-end">
              <Button onClick={handleQuery} disabled={loading} className="w-full">
                {loading ? '查询中...' : '查询交互记录'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="text-red-600 bg-red-50 p-3 rounded-md flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {records.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>交互记录 ({records.length} 条)</CardTitle>
                <CardDescription>
                  按交互顺序排列，request 和 response 成对显示
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Bot className="w-3 h-3" />
                  Agent
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  User
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="timeline" value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="timeline">
                  <Clock className="w-4 h-4 mr-2" />
                  时间线视图
                </TabsTrigger>
                <TabsTrigger value="table">
                  <Eye className="w-4 h-4 mr-2" />
                  表格视图
                </TabsTrigger>
              </TabsList>

              {/* 时间线视图 */}
              <TabsContent value="timeline" className="mt-4">
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {pairs.map((pair) => {
                      const isExpanded = expandedPairs.has(pair.pairId);
                      
                      return (
                        <div key={pair.pairId} className="border rounded-lg overflow-hidden">
                          {/* 交互对头部 */}
                          <div 
                            className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                            onClick={() => togglePair(pair.pairId)}
                          >
                            <div className="flex items-center gap-4">
                              <Badge variant="outline">
                                #{pair.interactNum}
                              </Badge>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Clock className="w-4 h-4" />
                                {formatTime(pair.timestamp)}
                              </div>
                              {pair.request && (
                                <Badge className={getInteractUserColor(pair.request.interactUser)}>
                                  {getInteractUserIcon(pair.request.interactUser)}
                                  <span className="ml-1">{pair.request.interactUser}</span>
                                </Badge>
                              )}
                              {pair.response && (
                                <Badge className={getInteractUserColor(pair.response.interactUser)}>
                                  {getInteractUserIcon(pair.response.interactUser)}
                                  <span className="ml-1">{pair.response.interactUser}</span>
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                          </div>

                          {/* 简化摘要（始终显示） */}
                          <div className="px-4 py-3 bg-white border-t">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {pair.request && (
                                <div className="space-y-2">
                                  <div className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" />
                                    Request
                                  </div>
                                  {renderContentSummary(pair.request.interactContent, 'request')}
                                </div>
                              )}
                              {pair.response && (
                                <div className="space-y-2">
                                  <div className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Response
                                  </div>
                                  {renderContentSummary(pair.response.interactContent, 'response')}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 详细内容（展开时显示） */}
                          {isExpanded && (
                            <div className="border-t">
                              {pair.request && (
                                <div className="p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium flex items-center gap-2">
                                      <Badge className={getInteractUserColor(pair.request.interactUser)}>
                                        {getInteractUserIcon(pair.request.interactUser)}
                                        <span className="ml-1">Request</span>
                                      </Badge>
                                      <span className="text-sm text-gray-500">
                                        {formatTime(pair.request.interactTime)}
                                      </span>
                                    </h4>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyToClipboard(JSON.stringify(pair.request.interactContent, null, 2));
                                      }}
                                    >
                                      <Copy className="w-4 h-4 mr-1" />
                                      复制
                                    </Button>
                                  </div>
                                  <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-x-auto">
                                    {JSON.stringify(pair.request.interactContent, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {pair.request && pair.response && <Separator />}
                              {pair.response && (
                                <div className="p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium flex items-center gap-2">
                                      <Badge className={getInteractUserColor(pair.response.interactUser)}>
                                        {getInteractUserIcon(pair.response.interactUser)}
                                        <span className="ml-1">Response</span>
                                      </Badge>
                                      <span className="text-sm text-gray-500">
                                        {formatTime(pair.response.interactTime)}
                                      </span>
                                    </h4>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyToClipboard(JSON.stringify(pair.response.interactContent, null, 2));
                                      }}
                                    >
                                      <Copy className="w-4 h-4 mr-1" />
                                      复制
                                    </Button>
                                  </div>
                                  <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-x-auto">
                                    {JSON.stringify(pair.response.interactContent, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* 表格视图 */}
              <TabsContent value="table" className="mt-4">
                <ScrollArea className="h-[600px]">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-3 font-medium">#</th>
                        <th className="text-left p-3 font-medium">类型</th>
                        <th className="text-left p-3 font-medium">发起方</th>
                        <th className="text-left p-3 font-medium">时间</th>
                        <th className="text-left p-3 font-medium">摘要</th>
                        <th className="text-left p-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record, idx) => (
                        <tr key={record.id} className="border-t hover:bg-gray-50">
                          <td className="p-3">{record.interactNum}</td>
                          <td className="p-3">
                            <Badge variant="outline">
                              {record.interactType}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge className={getInteractUserColor(record.interactUser)}>
                              {getInteractUserIcon(record.interactUser)}
                              <span className="ml-1">{record.interactUser}</span>
                            </Badge>
                          </td>
                          <td className="p-3 text-gray-500">
                            {formatTime(record.interactTime)}
                          </td>
                          <td className="p-3 max-w-md truncate">
                            {renderContentSummary(record.interactContent, record.interactType)}
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(JSON.stringify(record.interactContent, null, 2))}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
