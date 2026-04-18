'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Inbox } from 'lucide-react';
import Link from 'next/link';
import { formatBeijingTime } from '@/lib/utils/date-time';

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

export default function AgentCommandsPage() {
  const params = useParams();
  const agentId = params.id as string;
  const [commands, setCommands] = useState<Command[]>([]);
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
        return <Badge variant="destructive">高优先级</Badge>;
      case 'normal':
        return <Badge variant="default">普通</Badge>;
      case 'low':
        return <Badge variant="secondary">低优先级</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  // 获取指令类型 Badge
  const getCommandTypeBadge = (commandType: string) => {
    switch (commandType) {
      case 'instruction':
        return <Badge variant="outline">一般指令</Badge>;
      case 'task':
        return <Badge variant="default">任务型</Badge>;
      case 'report':
        return <Badge variant="secondary">报告型</Badge>;
      case 'urgent':
        return <Badge variant="destructive">紧急</Badge>;
      default:
        return <Badge variant="outline">{commandType}</Badge>;
    }
  };

  // 加载指令列表
  const loadCommands = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/commands`);
      const data = await response.json();
      if (data.success) {
        setCommands(data.data.commands);
      }
    } catch (error) {
      console.error('加载指令列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommands();
  }, [agentId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/agents/${agentId}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {getAgentName(agentId)} - 指令历史
              </h1>
              <p className="text-gray-600 mt-1">
                查看 {getAgentName(agentId)} 收到的所有指令
              </p>
            </div>
          </div>
          <Button onClick={loadCommands} disabled={loading} variant="outline">
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
              <div className="text-3xl font-bold">{commands.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>高优先级</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {commands.filter((c) => c.priority === 'high').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>紧急指令</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {commands.filter((c) => c.commandType === 'urgent').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 指令列表 */}
        <Card>
          <CardHeader>
            <CardTitle>指令列表</CardTitle>
            <CardDescription>
              按时间倒序排列，最新的指令在最前面
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">加载中...</div>
              </div>
            ) : commands.length === 0 ? (
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
              <div className="space-y-4">
                {commands.map((command) => (
                  <Card key={command.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">
                              来自 {getAgentName(command.fromAgentId)} 的指令
                            </span>
                            {getCommandTypeBadge(command.commandType)}
                            {getPriorityBadge(command.priority)}
                          </div>
                          <div className="text-xs text-gray-500">
                            接收时间：{formatBeijingTime(command.createdAt)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{command.content}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
