/**
 * Agent WebSocket Status Component
 * 显示 WebSocket 连接状态和新指令通知
 */

'use client';

import { useAgentWebSocket } from '@/hooks/use-agent-websocket';
import { Wifi, WifiOff, Bell, BellRing, X, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AgentId } from '@/lib/agent-types';

interface AgentWebSocketStatusProps {
  agentId: AgentId;
}

export function AgentWebSocketStatus({ agentId }: AgentWebSocketStatusProps) {
  const { status, commands, clearCommand, clearAllCommands } = useAgentWebSocket(agentId);

  const { connected, connecting, error } = status;

  const fromAgentNames: Record<string, string> = {
    A: '总裁',
    B: '技术负责人',
    C: 'AI运营总监',
    D: 'AI内容负责人',
    'insurance-c': '保险运营总监',
    'insurance-d': '保险内容负责人',
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-red-500',
    normal: 'bg-blue-500',
    low: 'bg-gray-400',
  };

  const typeColors: Record<string, string> = {
    instruction: 'bg-gray-200 text-gray-800',
    task: 'bg-blue-100 text-blue-800',
    report: 'bg-green-100 text-green-800',
    urgent: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-4">
      {/* WebSocket 连接状态 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {connected ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <div className="font-medium text-sm">
                  {connected ? '实时连接中' : connecting ? '连接中...' : '离线'}
                </div>
                {error && (
                  <div className="text-xs text-red-500">{error}</div>
                )}
              </div>
            </div>
            {commands.length > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {commands.length} 条新指令
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 新指令通知列表 */}
      {commands.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <BellRing className="h-5 w-5 text-yellow-600" />
                新指令通知
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllCommands}
                className="text-xs"
              >
                清除全部
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {commands.map((command, index) => (
                  <Card
                    key={index}
                    className="bg-white border-gray-200"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          {/* 发送方和时间 */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <Bell className="h-4 w-4 text-yellow-600" />
                              <span>
                                来自 {fromAgentNames[command.fromAgentId] || command.fromAgentId}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(command.timestamp).toLocaleString('zh-CN')}
                            </div>
                          </div>

                          {/* 指令类型和优先级 */}
                          <div className="flex items-center gap-2">
                            <Badge className={typeColors[command.commandType]}>
                              {command.commandType === 'instruction' && '一般指令'}
                              {command.commandType === 'task' && '任务型'}
                              {command.commandType === 'report' && '报告型'}
                              {command.commandType === 'urgent' && '紧急指令'}
                            </Badge>
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${priorityColors[command.priority]}`} />
                              <span className="text-xs text-gray-600">
                                {command.priority === 'high' && '高优先级'}
                                {command.priority === 'normal' && '普通'}
                                {command.priority === 'low' && '低优先级'}
                              </span>
                            </div>
                          </div>

                          {/* 指令内容 */}
                          <div className="text-sm text-gray-700">
                            {command.command}
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex items-center gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                window.location.href = `/agents/${agentId}/commands`;
                              }}
                            >
                              查看详情
                            </Button>
                          </div>
                        </div>

                        {/* 关闭按钮 */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => clearCommand(index)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
