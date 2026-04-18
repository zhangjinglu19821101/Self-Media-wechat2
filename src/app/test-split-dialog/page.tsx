'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SplitResultConfirmDialog } from '@/app/agents/[id]/components/dialogs';
import { AgentTaskList } from '@/components/agent-task-list';
import { ListTodo, UserCheck, MessageSquare, CheckCircle2, XCircle, Loader2, FileText, GitCompare } from 'lucide-react';
import { toast } from 'sonner';

export default function TestSplitDialogPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [splitResult, setSplitResult] = useState<any>(null);
  
  // 🔥 新增：任务列表相关状态
  const [showTaskList, setShowTaskList] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  
  // 🔥 新增：用户决策相关状态
  const [showUserDecisionPanel, setShowUserDecisionPanel] = useState(false);
  const [userDecisionContent, setUserDecisionContent] = useState('');
  const [selectedDecisionOption, setSelectedDecisionOption] = useState<string>('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  
  // 🔥 新增：文章对比相关状态
  const [articleVersions, setArticleVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedVersion1, setSelectedVersion1] = useState<string>('');
  const [selectedVersion2, setSelectedVersion2] = useState<string>('');
  const [selectedCommandResultId, setSelectedCommandResultId] = useState<string>('');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/test/check-notifications');
      if (response.ok) {
        const data = await response.json();
        console.log('📋 通知数据:', data);
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('❌ 加载通知失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 新增：加载文章历史版本
  const loadArticleVersions = async (commandResultId: string) => {
    if (!commandResultId) {
      toast.error('请先选择一个任务');
      return;
    }

    try {
      setLoadingVersions(true);
      console.log('📄 加载文章历史版本:', commandResultId);
      
      const response = await fetch(`/api/articles/history?commandResultId=${commandResultId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setArticleVersions(data.versions);
          if (data.versions.length >= 2) {
            setSelectedVersion1(data.versions[0].timestamp?.toString());
            setSelectedVersion2(data.versions[data.versions.length - 1].timestamp?.toString());
          } else if (data.versions.length === 1) {
            setSelectedVersion1(data.versions[0].timestamp?.toString());
            setSelectedVersion2('');
          }
          toast.success(`找到 ${data.versions.length} 个版本`);
        }
      }
    } catch (error) {
      console.error('❌ 加载文章历史版本失败:', error);
      toast.error('加载失败');
    } finally {
      setLoadingVersions(false);
    }
  };

  // 🔥 新增：计算文本差异（简化版）
  const renderTextDiff = (text1: string, text2: string) => {
    if (!text1 || !text2) return null;
    
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);
    
    return (
      <div className="font-mono text-sm">
        {Array.from({ length: maxLines }).map((_, i) => {
          const line1 = lines1[i] || '';
          const line2 = lines2[i] || '';
          const isSame = line1 === line2;
          
          return (
            <div key={i} className="grid grid-cols-1 gap-1">
              <div className={`p-1 rounded`}>
                <span className={!isSame && line1 ? 'bg-red-100 text-red-800' : ''}>
                  {!isSame && line1 && '- '}
                  {line1}
                </span>
              </div>
              <div className={`p-1 rounded`}>
                <span className={!isSame && line2 ? 'bg-green-100 text-green-800' : ''}>
                  {!isSame && line2 && '+ '}
                  {line2}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const parseNotification = (notification: any) => {
    try {
      console.log('🔍 解析通知:', notification);

      let jsonData: any = null;
      let rawResult: any;

      if (notification.type === 'insurance_d_split_result') {
        console.log('📝 [insurance_d_split_result] 从 content 中解析...');
        if (typeof notification.content === 'string') {
          try {
            const contentObj = JSON.parse(notification.content);
            rawResult = contentObj.splitResult;
            console.log('✅ [insurance_d_split_result] 从 content.splitResult 解析成功');
          } catch (e) {
            console.log('⚠️ [insurance_d_split_result] 解析 content 失败:', e);
          }
        } else if (typeof notification.content === 'object' && notification.content?.splitResult) {
          rawResult = notification.content.splitResult;
          console.log('✅ [insurance_d_split_result] 直接使用 content.splitResult');
        }
      } else {
        rawResult = notification.result || notification.content?.splitResult;
      }

      if (typeof rawResult === 'object') {
        jsonData = rawResult;
        console.log('✅ result 已经是 JSON 对象');
      } else if (typeof rawResult === 'string') {
        const jsonMatch = rawResult.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[1].trim();
          jsonData = JSON.parse(jsonStr);
          console.log('✅ 通过 Markdown 代码块解析成功');
        } else {
          try {
            jsonData = JSON.parse(rawResult.trim());
            console.log('✅ 直接解析成功');
          } catch (e) {
            console.log('⚠️ 直接解析失败');
          }
        }
      }

      if (jsonData) {
        console.log('📋 解析后的 jsonData:', jsonData);

        let subTasks = jsonData.subtasks || jsonData.subTasks;
        
        if ((!subTasks || !Array.isArray(subTasks) || subTasks.length === 0) && 
            jsonData.tasks && Array.isArray(jsonData.tasks) && jsonData.tasks.length > 0) {
          console.log('🔍 [数据兼容] 检测到批量拆解格式，从 tasks[0].subTasks 获取');
          const firstTask = jsonData.tasks[0];
          subTasks = firstTask.subtasks || firstTask.subTasks;
        }

        if (subTasks && Array.isArray(subTasks)) {
          console.log(`✅ 找到 ${subTasks.length} 条子任务`);
          return { jsonData, subTasks };
        }
      }

      return { jsonData: null, subTasks: null };
    } catch (error) {
      console.error('❌ 解析通知失败:', error);
      return { jsonData: null, subTasks: null };
    }
  };

  const testDialog = (notification: any) => {
    const { jsonData, subTasks } = parseNotification(notification);
    
    if (jsonData && subTasks) {
      setSelectedNotification(notification);
      setSplitResult(jsonData);
      setShowDialog(true);
    } else {
      alert('无法解析通知数据');
    }
  };

  const handleConfirm = async () => {
    console.log('✅ 确认拆解结果');
    setShowDialog(false);
  };

  const handleReject = () => {
    console.log('❌ 拒绝拆解结果');
    setShowDialog(false);
  };

  const handleSkip = () => {
    console.log('⏭️ 跳过拆解结果');
    setShowDialog(false);
  };

  // 🔥 新增：用户决策功能
  const handleUserDecision = async (subTask: any) => {
    console.log('🎯 处理用户决策，子任务:', subTask);
    setSelectedTask(subTask);
    setShowUserDecisionPanel(true);
    setUserDecisionContent('');
    setSelectedDecisionOption('');
  };

  // 🔥 新增：提交用户决策
  const submitUserDecision = async () => {
    if (!selectedTask) {
      toast.error('请先选择一个任务');
      return;
    }

    if (!userDecisionContent.trim()) {
      toast.error('请输入决策内容');
      return;
    }

    setIsSubmittingDecision(true);

    try {
      console.log('📤 提交用户决策...');
      console.log('  - 子任务 ID:', selectedTask.id);
      console.log('  - 决策内容:', userDecisionContent);
      console.log('  - 决策选项:', selectedDecisionOption);

      const response = await fetch('/api/agents/user-decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subTaskId: selectedTask.id,
          commandResultId: selectedTask.commandResultId,
          userDecision: userDecisionContent,
          decisionType: selectedDecisionOption || 'redecision',
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('用户决策已提交');
        console.log('✅ 用户决策提交成功:', data);
        setShowUserDecisionPanel(false);
        setUserDecisionContent('');
        setSelectedDecisionOption('');
        setSelectedTask(null);
      } else {
        toast.error(`提交失败: ${data.error}`);
        console.error('❌ 用户决策提交失败:', data.error);
      }
    } catch (error) {
      console.error('❌ 提交用户决策时出错:', error);
      toast.error('提交失败，请重试');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Agent B 简化拆解工具</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowTaskList(!showTaskList)}
          >
            <ListTodo className="w-4 h-4 mr-2" />
            {showTaskList ? '隐藏任务列表' : '显示任务列表'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="notifications" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="notifications">
            <MessageSquare className="w-4 h-4 mr-2" />
            通知列表
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ListTodo className="w-4 h-4 mr-2" />
            任务列表
          </TabsTrigger>
          <TabsTrigger value="user-decision">
            <UserCheck className="w-4 h-4 mr-2" />
            用户决策
          </TabsTrigger>
          <TabsTrigger value="article-compare">
            <GitCompare className="w-4 h-4 mr-2" />
            对比草稿与终稿
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={loadNotifications} disabled={loading}>
                {loading ? '加载中...' : '刷新通知'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>通知列表 ({notifications.length} 条)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">加载中...</div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">没有通知</div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification, index) => (
                    <Card key={index}>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                          <div>
                            <strong>类型:</strong> {notification.type}
                          </div>
                          <div>
                            <strong>接收者:</strong> {notification.recipient}
                          </div>
                          <div>
                            <strong>已读:</strong> {notification.isRead ? '是' : '否'}
                          </div>
                          <div>
                            <strong>弹框状态:</strong> {notification.metadata?.splitPopupStatus || 'null'}
                          </div>
                          <div className="col-span-2">
                            <strong>标题:</strong> {notification.title}
                          </div>
                        </div>
                        
                        <div className="space-x-2">
                          <Button 
                            onClick={() => testDialog(notification)}
                            size="sm"
                          >
                            测试弹框
                          </Button>
                          <Button 
                            onClick={() => console.log('📋 完整通知:', JSON.stringify(notification, null, 2))}
                            size="sm"
                            variant="secondary"
                          >
                            打印日志
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>
                <ListTodo className="w-5 h-5 mr-2 inline" />
                任务列表
              </CardTitle>
              <CardDescription>
                查看和管理当前 Agent 的任务
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showTaskList && (
                <div className="space-y-4">
                  {/* 显示 Agent B 的任务列表 */}
                  <AgentTaskList 
                    agentId="B" 
                    showPanel={true} 
                    onTogglePanel={() => {}} 
                  />
                  
                  {/* 显示 insurance-d 的任务列表 */}
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4">insurance-d 任务</h3>
                    <AgentTaskList 
                      agentId="insurance-d" 
                      showPanel={true} 
                      onTogglePanel={() => {}} 
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user-decision">
          <Card>
            <CardHeader>
              <CardTitle>
                <UserCheck className="w-5 h-5 mr-2 inline" />
                用户决策功能
              </CardTitle>
              <CardDescription>
                模拟用户对任务的决策和建议
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">📋 功能说明</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 支持用户对任务进行重新决策</li>
                  <li>• 支持用户确认 waiting_user 状态的任务</li>
                  <li>• 自动记录用户交互历史</li>
                  <li>• 更新任务状态并触发继续执行</li>
                </ul>
              </div>

              {selectedTask && (
                <Card className="border-2 border-blue-300">
                  <CardHeader>
                    <CardTitle className="text-lg">当前选择的任务</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <strong>任务标题：</strong>
                        <span>{selectedTask.taskTitle}</span>
                      </div>
                      <div>
                        <strong>任务描述：</strong>
                        <p className="text-sm text-gray-600">{selectedTask.taskDescription}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{selectedTask.status}</Badge>
                        <Badge variant="outline">{selectedTask.executor}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">决策选项</label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={selectedDecisionOption === 'redecision' ? 'default' : 'outline'}
                      onClick={() => setSelectedDecisionOption('redecision')}
                      className="justify-start"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      重新决策
                    </Button>
                    <Button
                      variant={selectedDecisionOption === 'waiting_user' ? 'default' : 'outline'}
                      onClick={() => setSelectedDecisionOption('waiting_user')}
                      className="justify-start"
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      确认等待用户
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">决策内容</label>
                  <Textarea
                    value={userDecisionContent}
                    onChange={(e) => setUserDecisionContent(e.target.value)}
                    placeholder="请输入您的决策或建议..."
                    rows={4}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={submitUserDecision}
                    disabled={!userDecisionContent.trim() || isSubmittingDecision}
                  >
                    {isSubmittingDecision ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      '提交决策'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowUserDecisionPanel(false);
                      setUserDecisionContent('');
                      setSelectedDecisionOption('');
                      setSelectedTask(null);
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    取消
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="article-compare">
          <Card>
            <CardHeader>
              <CardTitle>
                <GitCompare className="w-5 h-5 mr-2 inline" />
                对比草稿与终稿
              </CardTitle>
              <CardDescription>
                查看文章不同版本之间的差异对比
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-2">📋 功能说明</h4>
                <ul className="text-sm text-purple-800 space-y-1">
                  <li>• 选择任务的 commandResultId 加载文章历史版本</li>
                  <li>• 对比不同版本之间的文本差异</li>
                  <li>• 查看草稿与终稿的修改内容</li>
                  <li>• 红色表示删除，绿色表示新增</li>
                </ul>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">选择任务 (commandResultId)</label>
                  <div className="flex gap-2">
                    <Input
                      value={selectedCommandResultId}
                      onChange={(e) => setSelectedCommandResultId(e.target.value)}
                      placeholder="输入 commandResultId"
                      className="flex-1"
                    />
                    <Button
                      onClick={() => loadArticleVersions(selectedCommandResultId)}
                      disabled={!selectedCommandResultId || loadingVersions}
                    >
                      {loadingVersions ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          加载中...
                        </>
                      ) : (
                        '加载版本'
                      )}
                    </Button>
                  </div>
                </div>

                {articleVersions.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">版本 1</label>
                        <Select value={selectedVersion1} onValueChange={setSelectedVersion1}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择版本" />
                          </SelectTrigger>
                          <SelectContent>
                            {articleVersions.map((version, index) => (
                              <SelectItem key={version.timestamp?.toString() || index} value={version.timestamp?.toString() || String(index)}>
                                {version.title || `版本 ${index + 1}`}
                                {version.timestamp && (
                                  <span className="text-gray-500 ml-2">
                                    {new Date(version.timestamp).toLocaleString()}
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">版本 2</label>
                        <Select value={selectedVersion2} onValueChange={setSelectedVersion2}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择版本" />
                          </SelectTrigger>
                          <SelectContent>
                            {articleVersions.map((version, index) => (
                              <SelectItem key={version.timestamp?.toString() || `v2-${index}`} value={version.timestamp?.toString() || String(index)}>
                                {version.title || `版本 ${index + 1}`}
                                {version.timestamp && (
                                  <span className="text-gray-500 ml-2">
                                    {new Date(version.timestamp).toLocaleString()}
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {selectedVersion1 && selectedVersion2 && (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-4">差异对比</h3>
                        {(() => {
                          const v1 = articleVersions.find(v => v.timestamp?.toString() === selectedVersion1);
                          const v2 = articleVersions.find(v => v.timestamp?.toString() === selectedVersion2);
                          if (v1 && v2) {
                            return renderTextDiff(v1.content, v2.content);
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </>
                )}

                {articleVersions.length === 0 && !loadingVersions && (
                  <div className="text-center py-8 text-gray-500">
                    请输入 commandResultId 并点击"加载版本"
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showDialog && selectedNotification && splitResult && (
        <SplitResultConfirmDialog
          open={showDialog}
          onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) {
              setSelectedNotification(null);
              setSplitResult(null);
            }
          }}
          splitResult={splitResult}
          splitExecutor="Agent B"
          notification={selectedNotification}
          isMinimized={false}
          onToggleMinimize={() => {}}
          isProcessing={false}
          submitLocked={false}
          onAbandon={handleSkip}
          onReject={handleReject}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

