'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components-ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components-ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Search,
  FileText,
  Zap,
  Layers,
  Shield,
  Brain,
  Users,
  ChevronRight,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';

// Agent 数据
const AGENTS = [
  {
    id: 'A',
    name: '总裁',
    role: '核心协调者',
    department: '总枢纽',
    description: 'AI事业部、保险事业部的最高战略决策者，唯一总枢纽',
    color: 'bg-blue-500',
    capabilities: [
      '行业动态监测与战略调整',
      '痛点穿透分析与精准战略',
      '应急预案制定',
      '月度战略复盘',
      '任务分解与分配',
      '协调管理与风险应对',
      '规则迭代分级评估',
      '快速通道判断',
      '调研结果权重评估',
      '动态验收周期决策',
    ],
    tools: [
      { name: '对话接口', url: '/api/agents/A/chat' },
      { name: '知识库记忆', url: 'agent_a_memory' },
      { name: '工作流触发器', url: 'workflow' },
      { name: '联网搜索', url: '/api/search', status: '待实现' },
    ],
    restrictions: [
      '核心执行动作必须先向董事长汇报',
      '战略制定必须聚焦核心痛点',
      '不得混淆两大事业部的战略优先级',
    ],
  },
  {
    id: 'B',
    name: 'AI商业运营体系技术总负责人',
    role: '技术执行者',
    department: '双事业部支撑',
    description: '闭环技术落地人，统筹两大事业部新媒体行业通用规则与技能累积',
    color: 'bg-green-500',
    capabilities: [
      '规则存储管理',
      '拆解引擎能力',
      '权限管理系统',
      '规则API接口',
      '统计追踪',
      '热加载支持',
      '新媒体通用规则累积（6大类）',
      '分级调研执行',
      '调研质量分析',
    ],
    tools: [
      { name: '对话接口', url: '/api/agents/B/chat' },
      { name: '知识库记忆', url: 'agent_b_memory' },
      { name: '规则管理系统', url: '/api/rules' },
      { name: '拆解引擎', url: '/api/decompose' },
      { name: '联网搜索', url: '/api/search', status: '待实现' },
    ],
    restrictions: [
      '规则更新需要Agent A审批',
      '不得跨赛道共享规则',
    ],
  },
  {
    id: 'C',
    name: 'AI运营Agent',
    role: '运营执行者',
    department: 'AI事业部',
    description: 'AI赛道运营执行，负责新媒体运营、用户增长、数据分析',
    color: 'bg-purple-500',
    capabilities: [
      '多平台运营',
      '数据分析',
      '热点运营',
      '用户互动',
      '流量获取',
      '活动策划',
      '指令执行闭环',
    ],
    tools: [
      { name: '对话接口', url: '/api/agents/C/chat' },
      { name: '知识库记忆', url: 'agent_c_memory' },
      { name: '规则引擎', url: '/api/rules' },
      { name: '联网搜索', url: '/api/search', status: '待实现' },
    ],
    restrictions: [
      '严格遵循A为唯一总枢纽规则',
      '不与保险事业部Agent交互',
    ],
  },
  {
    id: 'D',
    name: 'AI内容创作Agent',
    role: '内容执行者',
    department: 'AI事业部',
    description: 'AI赛道内容创作，负责内容生产、去AI化处理、质量把控',
    color: 'bg-orange-500',
    capabilities: [
      '内容创作',
      '去AI化处理',
      '质量把控',
      '多平台发布',
      '内容优化',
      '内容数据分析',
    ],
    tools: [
      { name: '对话接口', url: '/api/agents/D/chat' },
      { name: '知识库记忆', url: 'agent_d_memory' },
      { name: '规则引擎', url: '/api/rules' },
      { name: '联网搜索', url: '/api/search', status: '待实现' },
    ],
    restrictions: [
      '严格遵循A为唯一总枢纽规则',
      '不与保险事业部Agent交互',
    ],
  },
  {
    id: 'insurance-c',
    name: '保险运营Agent',
    role: '运营执行者',
    department: '保险事业部',
    description: '保险赛道运营执行，负责新媒体运营、合规管控、用户增长',
    color: 'bg-pink-500',
    capabilities: [
      '合规运营',
      '多平台运营',
      '数据分析',
      '用户信任构建',
      '流量获取',
      '指令执行闭环',
    ],
    tools: [
      { name: '对话接口', url: '/api/agents/insurance-c/chat' },
      { name: '知识库记忆', url: 'agent_insurance_c_memory' },
      { name: '规则引擎', url: '/api/rules' },
      { name: '联网搜索', url: '/api/search', status: '待实现' },
    ],
    restrictions: [
      '严格遵循A为唯一总枢纽规则',
      '不与AI事业部Agent交互',
    ],
  },
  {
    id: 'insurance-d',
    name: '保险内容创作Agent',
    role: '内容执行者',
    department: '保险事业部',
    description: '保险赛道内容创作，负责内容生产、合规把控、信任构建',
    color: 'bg-red-500',
    capabilities: [
      '内容创作',
      '合规把控',
      '去AI化处理',
      '多平台发布',
      '内容优化',
      '内容数据分析',
    ],
    tools: [
      { name: '对话接口', url: '/api/agents/insurance-d/chat' },
      { name: '知识库记忆', url: 'agent_insurance_d_memory' },
      { name: '规则引擎', url: '/api/rules' },
      { name: '联网搜索', url: '/api/search', status: '待实现' },
    ],
    restrictions: [
      '严格遵循A为唯一总枢纽规则',
      '不与AI事业部Agent交互',
    ],
  },
];

// 共享能力
const SHARED_CAPABILITIES = [
  { name: '对话历史记忆', description: '自动保存到数据库，支持跨会话恢复', icon: Brain },
  { name: '知识库记忆', description: '每个Agent有独立的知识库实例', icon: BookOpen },
  { name: '工作流协作', description: '16步闭环工作流', icon: Layers },
];

// 集成服务
const INTEGRATIONS = [
  { name: '大语言模型', description: '文本生成、对话交互、意图识别', icon: Brain, status: '已集成' },
  { name: '向量大模型', description: '语义分析与检索', icon: Zap, status: '已集成' },
  { name: '联网搜索', description: 'Web搜索、图片搜索、AI总结', icon: Search, status: 'SDK已集成，API待实现' },
  { name: '知识库', description: '内容导入、向量搜索', icon: BookOpen, status: '已集成' },
  { name: '数据库', description: '结构化数据CRUD操作', icon: Layers, status: '已集成' },
  { name: '对象存储', description: '文件上传、管理', icon: FileText, status: '已集成' },
  { name: '生图大模型', description: '文生图、图生图', icon: ExternalLink, status: '已集成' },
  { name: '视频生成大模型', description: '文生视频、图生视频', icon: FileText, status: '已集成' },
  { name: '语音大模型', description: '语音识别、合成', icon: ExternalLink, status: '已集成' },
];

export default function AgentCapabilitiesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  const filteredAgents = AGENTS.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.capabilities.some((cap) => cap.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDepartment =
      selectedDepartment === 'all' ||
      agent.department === selectedDepartment ||
      (selectedDepartment === 'AI事业部' && agent.department === 'AI事业部') ||
      (selectedDepartment === '保险事业部' && agent.department === '保险事业部') ||
      (selectedDepartment === '总枢纽' && agent.id === 'A');

    return matchesSearch && matchesDepartment;
  });

  const departments = ['all', '总枢纽', 'AI事业部', '保险事业部', '双事业部支撑'];

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/admin/agent-builder">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Agent 能力文档</h1>
                <p className="text-sm text-muted-foreground">查看所有Agent的能力、职责和可用工具</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/docs/AGENT_CAPABILITIES.md" target="_blank">
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  查看Markdown文档
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <Tabs defaultValue="agents" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="agents">
              <Users className="mr-2 h-4 w-4" />
              Agents ({AGENTS.length})
            </TabsTrigger>
            <TabsTrigger value="shared">
              <Brain className="mr-2 h-4 w-4" />
              共享能力 ({SHARED_CAPABILITIES.length})
            </TabsTrigger>
            <TabsTrigger value="integrations">
              <Zap className="mr-2 h-4 w-4" />
              集成服务 ({INTEGRATIONS.length})
            </TabsTrigger>
            <TabsTrigger value="collaboration">
              <Layers className="mr-2 h-4 w-4" />
              协作规则
            </TabsTrigger>
          </TabsList>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            {/* 搜索和过滤 */}
            <Card className="p-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="搜索Agent名称、描述或能力..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="筛选事业部" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept === 'all' ? '全部' : dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Agent 列表 */}
            <div className="grid gap-4 md:grid-cols-2">
              {filteredAgents.map((agent) => (
                <Card key={agent.id} className="p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${agent.color} text-white font-bold text-lg`}>
                        {agent.id}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{agent.name}</h3>
                        <p className="text-sm text-muted-foreground">{agent.role}</p>
                      </div>
                    </div>
                    <Badge variant="secondary">{agent.department}</Badge>
                  </div>

                  <p className="mb-4 text-sm text-muted-foreground">{agent.description}</p>

                  <div className="space-y-3">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-medium flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          核心能力
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {agent.capabilities.length} 项
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities.slice(0, 4).map((cap) => (
                          <Badge key={cap} variant="secondary" className="text-xs">
                            {cap}
                          </Badge>
                        ))}
                        {agent.capabilities.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{agent.capabilities.length - 4}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 text-sm font-medium flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        可用工具
                      </h4>
                      <div className="space-y-1">
                        {agent.tools.slice(0, 3).map((tool) => (
                          <div key={tool.name} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{tool.name}</span>
                            {tool.status ? (
                              <Badge variant="outline" className="text-xs text-yellow-500">
                                {tool.status}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs text-green-500">
                                已集成
                              </Badge>
                            )}
                          </div>
                        ))}
                        {agent.tools.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            还有 {agent.tools.length - 3} 项...
                          </div>
                        )}
                      </div>
                    </div>

                    {agent.restrictions.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-medium flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          限制条件
                        </h4>
                        <div className="space-y-1">
                          {agent.restrictions.map((restriction) => (
                            <div key={restriction} className="text-xs text-muted-foreground flex items-start gap-1">
                              <span className="text-red-500">•</span>
                              {restriction}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <Link href={`/agents/${agent.id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        测试对话
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* 共享能力 Tab */}
          <TabsContent value="shared" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {SHARED_CAPABILITIES.map((capability, index) => {
                const Icon = capability.icon;
                return (
                  <Card key={index} className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 font-semibold">{capability.name}</h3>
                    <p className="text-sm text-muted-foreground">{capability.description}</p>
                  </Card>
                );
              })}
            </div>

            <Card className="p-6">
              <h3 className="mb-4 font-semibold">知识库记忆系统</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-medium">AI事业部</h4>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>Agent A</span>
                      <Badge variant="secondary" className="text-xs">agent_a_memory</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Agent B</span>
                      <Badge variant="secondary" className="text-xs">agent_b_memory</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Agent C</span>
                      <Badge variant="secondary" className="text-xs">agent_c_memory</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Agent D</span>
                      <Badge variant="secondary" className="text-xs">agent_d_memory</Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-medium">保险事业部</h4>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>Agent insurance-c</span>
                      <Badge variant="secondary" className="text-xs">agent_insurance_c_memory</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Agent insurance-d</span>
                      <Badge variant="secondary" className="text-xs">agent_insurance_d_memory</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* 集成服务 Tab */}
          <TabsContent value="shared" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {INTEGRATIONS.map((integration, index) => {
                const Icon = integration.icon;
                const isReady = integration.status === '已集成';
                return (
                  <Card key={index} className="p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <Badge variant={isReady ? 'secondary' : 'outline'} className={isReady ? 'text-xs' : 'text-xs text-yellow-500'}>
                        {integration.status}
                      </Badge>
                    </div>
                    <h3 className="mb-2 font-semibold">{integration.name}</h3>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* 协作规则 Tab */}
          <TabsContent value="collaboration" className="space-y-4">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">双事业部架构</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-4 border-blue-200">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <h4 className="font-medium">AI事业部</h4>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">技术实操科普 + Agent快速迭代</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge className="bg-purple-500 text-white text-xs">C</Badge>
                      <span>AI运营Agent</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge className="bg-orange-500 text-white text-xs">D</Badge>
                      <span>AI内容创作Agent</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border-pink-200">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-pink-500" />
                    <h4 className="font-medium">保险事业部</h4>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">合规管控 + 大众信任构建</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge className="bg-pink-500 text-white text-xs">insurance-c</Badge>
                      <span>保险运营Agent</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge className="bg-red-500 text-white text-xs">insurance-d</Badge>
                      <span>保险内容创作Agent</span>
                    </div>
                  </div>
                </Card>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="mb-4 font-semibold">沟通路径</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-500 text-white font-bold">用户</div>
                  <ChevronRight className="h-4 w-4" />
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-green-500 text-white font-bold">A</div>
                  <ChevronRight className="h-4 w-4" />
                  <div className="flex gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-purple-500 text-white font-bold">C</div>
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-orange-500 text-white font-bold">D</div>
                  </div>
                  <span className="text-muted-foreground">/</span>
                  <div className="flex gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-pink-500 text-white font-bold">insurance-c</div>
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-red-500 text-white font-bold">insurance-d</div>
                  </div>
                </div>
                <div className="text-center text-xs text-muted-foreground">
                  Agent A（总裁）是唯一总枢纽，所有跨赛道交互必须通过A中转
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="mb-4 font-semibold">权限体系</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>通用规则</TableHead>
                      <TableHead>AI赛道规则</TableHead>
                      <TableHead>保险赛道规则</TableHead>
                      <TableHead>权限类型</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-bold">A</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读取</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读取</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读取</Badge></TableCell>
                      <TableCell className="text-xs">读取</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">B</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读写执行删除</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读写执行删除</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读写执行删除</Badge></TableCell>
                      <TableCell className="text-xs">读写执行删除</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">C</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读取执行</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读取执行</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">-</Badge></TableCell>
                      <TableCell className="text-xs">读取执行</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">D</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读取执行</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读取执行</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">-</Badge></TableCell>
                      <TableCell className="text-xs">读取执行</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">insurance-c</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读取执行</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">-</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读取执行</Badge></TableCell>
                      <TableCell className="text-xs">读取执行</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">insurance-d</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读取执行</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">-</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">读取执行</Badge></TableCell>
                      <TableCell className="text-xs">读取执行</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
