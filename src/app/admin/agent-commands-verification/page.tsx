'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Inbox, CheckCircle, AlertCircle } from 'lucide-react';

const AGENTS = ['A', 'B', 'C', 'D', 'insurance-c', 'insurance-d'];

interface Command {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  commandType: string;
  priority: string;
  content: string;
  sessionId: string;
  createdAt: string;
}

interface AgentCommands {
  agentId: string;
  commands: Command[];
  count: number;
}

export default function AgentCommandsVerification() {
  const [agentCommands, setAgentCommands] = useState<AgentCommands[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取 Agent 名称
  const getAgentName = (id: string) => {
    const agentNames: Record<string, string> = {
      A: '总裁（A）',
      B: '技术负责人（B）',
      C: 'AI运营（C）',
      D: 'AI内容（D）',
      'insurance-c': '保险运营（C）',
      'insurance-d': '保险内容（D）',
    };
    return agentNames[id] || id;
  };

  // 获取优先级 Badge
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">高</Badge>;
      case 'normal':
        return <Badge variant="default">普通</Badge>;
      case 'low':
        return <Badge variant="secondary">低</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  // 获取指令类型 Badge
  const getCommandTypeBadge = (commandType: string) => {
    switch (commandType) {
      case 'instruction':
        return <Badge variant="outline">指令</Badge>;
      case 'task':
        return <Badge variant="default">任务</Badge>;
      case 'report':
        return <Badge variant="secondary">报告</Badge>;
      case 'urgent':
        return <Badge variant="destructive">紧急</Badge>;
      default:
        return <Badge variant="outline">{commandType}</Badge>;
    }
  };

  // 加载所有 Agent 的指令
  const loadAllCommands = async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        AGENTS.map(async (agentId) => {
          const response = await fetch(`/api/agents/${agentId}/commands`);
          const data = await response.json();
          if (data.success) {
            return {
              agentId,
              commands: data.data.commands,
              count: data.data.count,
            };
          }
          return {
            agentId,
            commands: [],
            count: 0,
          };
        })
      );
      setAgentCommands(results);
    } catch (error) {
      console.error('加载指令列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllCommands();
  }, []);

  // 统计数据
  const stats = {
    totalCommands: agentCommands.reduce((sum, ac) => sum + ac.count, 0),
    highPriority: agentCommands.reduce(
      (sum, ac) => sum + ac.commands.filter((c) => c.priority === 'high').length,
      0
    ),
    urgentCommands: agentCommands.reduce(
      (sum, ac) => sum + ac.commands.filter((c) => c.commandType === 'urgent').length,
      0
    ),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Agent 指令验证中心
            </h1>
            <p className="text-gray-600 mt-2">
              查看所有 Agent 收到的指令，验证 Agent A 是否真的下达了指令
            </p>
          </div>
          <Button onClick={loadAllCommands} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>总指令数</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalCommands}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>高优先级</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {stats.highPriority}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>紧急指令</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {stats.urgentCommands}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent 指令列表 */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            {AGENTS.map((agentId) => (
              <TabsTrigger key={agentId} value={agentId}>
                {getAgentName(agentId)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all">
            <div className="space-y-6">
              {agentCommands.map((ac) => (
                <Card key={ac.agentId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{getAgentName(ac.agentId)}</CardTitle>
                      <div className="flex items-center gap-2">
                        {ac.count > 0 ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-gray-400" />
                        )}
                        <span className="text-sm text-gray-600">{ac.count} 条指令</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {ac.count === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        暂无指令
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {ac.commands.map((command) => (
                          <Card key={command.id}>
                            <CardContent className="pt-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold">
                                    来自 {getAgentName(command.fromAgentId)}
                                  </span>
                                  {getCommandTypeBadge(command.commandType)}
                                  {getPriorityBadge(command.priority)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(command.createdAt).toLocaleString('zh-CN')}
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                  <p className="text-sm whitespace-pre-wrap">
                                    {command.content}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {AGENTS.map((agentId) => (
            <TabsContent key={agentId} value={agentId}>
              <Card>
                <CardHeader>
                  <CardTitle>{getAgentName(agentId)} 的指令历史</CardTitle>
                  <CardDescription>
                    共 {agentCommands.find((ac) => ac.agentId === agentId)?.count || 0} 条指令
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-gray-500">加载中...</div>
                    </div>
                  ) : agentCommands.find((ac) => ac.agentId === agentId)?.commands.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Inbox className="h-16 w-16 text-gray-300 mb-4" />
                      <div className="text-gray-500 text-lg font-medium">
                        暂无指令
                      </div>
                      <div className="text-gray-400 text-sm mt-2">
                        {getAgentName(agentId)} 还没有收到任何指令
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {agentCommands
                        .find((ac) => ac.agentId === agentId)
                        ?.commands.map((command) => (
                          <Card key={command.id}>
                            <CardContent className="pt-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold">
                                    来自 {getAgentName(command.fromAgentId)}
                                  </span>
                                  {getCommandTypeBadge(command.commandType)}
                                  {getPriorityBadge(command.priority)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(command.createdAt).toLocaleString('zh-CN')}
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                  <p className="text-sm whitespace-pre-wrap">
                                    {command.content}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
