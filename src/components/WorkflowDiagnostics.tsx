import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Download, 
  Eye, 
  Pause, 
  Play, 
  RefreshCw, 
  Settings, 
  Trash2,
  Zap,
  BarChart3,
  Bug,
  Timer,
  Layers
} from 'lucide-react';
import { useWorkflowDiagnostics } from '@/hooks/useWorkflowDiagnostics';
import { 
  WorkflowEvent, 
  WorkflowSession, 
  DiagnosticIssue, 
  ParameterComparison,
  NodeExecution 
} from '@/types/workflow-diagnostics';

interface WorkflowDiagnosticsProps {
  className?: string;
}

const getSeverityColor = (severity: DiagnosticIssue['severity']) => {
  switch (severity) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
};

const getIssueTypeIcon = (type: DiagnosticIssue['type']) => {
  switch (type) {
    case 'infinite_loop': return <RefreshCw className="h-4 w-4" />;
    case 'stuck_node': return <Pause className="h-4 w-4" />;
    case 'timeout': return <Clock className="h-4 w-4" />;
    case 'parameter_anomaly': return <Bug className="h-4 w-4" />;
    case 'memory_leak': return <AlertTriangle className="h-4 w-4" />;
    default: return <AlertTriangle className="h-4 w-4" />;
  }
};

const getEventTypeColor = (event: WorkflowEvent['event']) => {
  switch (event) {
    case 'workflow_started': return 'bg-green-500';
    case 'workflow_finished': return 'bg-blue-500';
    case 'node_started': return 'bg-yellow-500';
    case 'node_finished': return 'bg-green-400';
    case 'error': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

const formatExecutionTime = (ms: number | undefined) => {
  if (!ms) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('zh-CN');
};

export function WorkflowDiagnostics({ className }: WorkflowDiagnosticsProps) {
  const {
    state,
    settings,
    resolveIssue,
    generateReport,
    exportData,
    clearAllData,
    setSettings,
  } = useWorkflowDiagnostics();

  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(1000);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Force re-render to update real-time data
      setSelectedSession(prev => prev);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const activeSessions = Array.from(state.activeSessions.values());
  const activeIssues = state.detectedIssues.filter(issue => !issue.resolved);
  const selectedSessionData = selectedSession ? state.activeSessions.get(selectedSession) : null;

  const handleGenerateReport = () => {
    if (selectedSession) {
      const report = generateReport(selectedSession);
      if (report) {
        const dataStr = JSON.stringify(report, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `workflow-report-${selectedSession}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
      }
    }
  };

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">工作流诊断</h2>
          <p className="text-muted-foreground">实时监控和诊断 Dify 工作流执行状态</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={state.isEnabled ? "default" : "secondary"}>
            {state.isEnabled ? '已启用' : '已禁用'}
          </Badge>
          <Button variant="outline" size="sm" onClick={exportData}>
            <Download className="h-4 w-4 mr-1" />
            导出数据
          </Button>
          <Button variant="outline" size="sm" onClick={clearAllData}>
            <Trash2 className="h-4 w-4 mr-1" />
            清空数据
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃会话</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.statistics.activeSessionsCount}</div>
            <p className="text-xs text-muted-foreground">
              总计 {state.statistics.totalSessions} 个会话
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总事件数</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.statistics.totalEvents}</div>
            <p className="text-xs text-muted-foreground">
              最近记录的工作流事件
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">检测到问题</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{activeIssues.length}</div>
            <p className="text-xs text-muted-foreground">
              未解决的问题
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均执行时间</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatExecutionTime(state.statistics.averageSessionDuration)}
            </div>
            <p className="text-xs text-muted-foreground">
              工作流平均时长
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Issues Alert */}
      {activeIssues.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">检测到 {activeIssues.length} 个问题</AlertTitle>
          <AlertDescription className="text-red-700">
            有工作流问题需要关注，请查看问题详情页面进行处理。
          </AlertDescription>
        </Alert>
      )}

      {/* Settings Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            诊断设置
          </CardTitle>
          <CardDescription>配置诊断系统的行为和阈值</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-refresh">自动刷新</Label>
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refresh-interval">刷新间隔 (ms)</Label>
              <Input
                id="refresh-interval"
                type="number"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 1000)}
                min={500}
                max={10000}
                step={500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-node-executions">最大节点执行次数</Label>
              <Input
                id="max-node-executions"
                type="number"
                value={settings.detectionThresholds.maxNodeExecutions}
                onChange={(e) => setSettings({
                  ...settings,
                  detectionThresholds: {
                    ...settings.detectionThresholds,
                    maxNodeExecutions: parseInt(e.target.value) || 3
                  }
                })}
                min={1}
                max={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-session-duration">最大会话时长 (分钟)</Label>
              <Input
                id="max-session-duration"
                type="number"
                value={Math.round(settings.detectionThresholds.maxSessionDuration / 60000)}
                onChange={(e) => setSettings({
                  ...settings,
                  detectionThresholds: {
                    ...settings.detectionThresholds,
                    maxSessionDuration: (parseInt(e.target.value) || 5) * 60000
                  }
                })}
                min={1}
                max={60}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">活跃会话</TabsTrigger>
          <TabsTrigger value="events">事件日志</TabsTrigger>
          <TabsTrigger value="issues">问题列表</TabsTrigger>
          <TabsTrigger value="parameters">参数分析</TabsTrigger>
        </TabsList>

        {/* Active Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Session List */}
            <Card>
              <CardHeader>
                <CardTitle>会话列表</CardTitle>
                <CardDescription>当前活跃的工作流会话</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {activeSessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">暂无活跃会话</p>
                  ) : (
                    <div className="space-y-2">
                      {activeSessions.map((session) => (
                        <div
                          key={session.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedSession === session.id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedSession(session.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">会话 {session.id.slice(-8)}</p>
                              <p className="text-xs text-muted-foreground">
                                开始时间: {formatTimestamp(session.startTime)}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={
                                session.status === 'active' ? 'default' : 
                                session.status === 'completed' ? 'secondary' : 'destructive'
                              }>
                                {session.status === 'active' ? '运行中' : 
                                 session.status === 'completed' ? '已完成' : '错误'}
                              </Badge>
                              {session.detectedIssues.filter(i => !i.resolved).length > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {session.detectedIssues.filter(i => !i.resolved).length} 问题
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>{session.events.length} 事件</span>
                            <span>{session.nodeExecutions.size} 节点</span>
                            <span>{session.messageCount} 消息</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Session Details */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>会话详情</CardTitle>
                    <CardDescription>
                      {selectedSessionData ? `会话 ${selectedSessionData.id.slice(-8)}` : '请选择一个会话'}
                    </CardDescription>
                  </div>
                  {selectedSessionData && (
                    <Button variant="outline" size="sm" onClick={handleGenerateReport}>
                      <Download className="h-4 w-4 mr-1" />
                      生成报告
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedSessionData ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {/* Session Info */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">基本信息</h4>
                        <div className="text-sm space-y-1">
                          <p><span className="text-muted-foreground">状态:</span> {selectedSessionData.status}</p>
                          <p><span className="text-muted-foreground">开始时间:</span> {formatTimestamp(selectedSessionData.startTime)}</p>
                          {selectedSessionData.endTime && (
                            <p><span className="text-muted-foreground">结束时间:</span> {formatTimestamp(selectedSessionData.endTime)}</p>
                          )}
                          <p><span className="text-muted-foreground">事件数量:</span> {selectedSessionData.events.length}</p>
                          <p><span className="text-muted-foreground">节点数量:</span> {selectedSessionData.nodeExecutions.size}</p>
                        </div>
                      </div>

                      <Separator />

                      {/* Node Executions */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">节点执行情况</h4>
                        <div className="space-y-2">
                          {Array.from(selectedSessionData.nodeExecutions.values()).map((node) => (
                            <div key={node.nodeId} className="p-2 border rounded text-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{node.nodeName}</span>
                                <Badge variant={
                                  node.status === 'completed' ? 'secondary' :
                                  node.status === 'error' ? 'destructive' :
                                  node.status === 'running' ? 'default' : 'outline'
                                }>
                                  {node.status}
                                </Badge>
                              </div>
                              <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                                <span>执行 {node.executionCount} 次</span>
                                <span>平均 {formatExecutionTime(node.averageExecutionTime)}</span>
                                {node.executionCount > settings.detectionThresholds.maxNodeExecutions && (
                                  <Badge variant="destructive" className="text-xs">
                                    可能循环
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Recent Events */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">最近事件</h4>
                        <div className="space-y-1">
                          {selectedSessionData.events.slice(-10).reverse().map((event) => (
                            <div key={event.id} className="flex items-center space-x-2 text-xs">
                              <div className={`w-2 h-2 rounded-full ${getEventTypeColor(event.event)}`} />
                              <span className="text-muted-foreground">
                                {formatTimestamp(event.timestamp)}
                              </span>
                              <span>{event.event}</span>
                              {event.nodeId && <span className="text-muted-foreground">({event.nodeId})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-center text-muted-foreground py-8">请从左侧选择一个会话查看详情</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>事件日志</CardTitle>
              <CardDescription>所有工作流事件的详细记录</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {state.eventHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无事件记录</p>
                ) : (
                  <div className="space-y-2">
                    {state.eventHistory.slice().reverse().map((event) => (
                      <div key={event.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${getEventTypeColor(event.event)}`} />
                            <span className="font-medium">{event.event}</span>
                            {event.nodeId && (
                              <Badge variant="outline" className="text-xs">
                                {event.nodeName || event.nodeId}
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                        {event.executionTime && (
                          <p className="text-sm text-muted-foreground mt-1">
                            执行时间: {formatExecutionTime(event.executionTime)}
                          </p>
                        )}
                        {event.conversationId && (
                          <p className="text-xs text-muted-foreground mt-1">
                            会话: {event.conversationId.slice(-8)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues">
          <Card>
            <CardHeader>
              <CardTitle>问题列表</CardTitle>
              <CardDescription>自动检测到的工作流问题</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {state.detectedIssues.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无检测到问题</p>
                ) : (
                  <div className="space-y-3">
                    {state.detectedIssues.slice().reverse().map((issue) => (
                      <div key={issue.id} className={`p-4 border rounded-lg ${issue.resolved ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className={`p-1 rounded ${getSeverityColor(issue.severity)} text-white`}>
                              {getIssueTypeIcon(issue.type)}
                            </div>
                            <div>
                              <h4 className="font-medium">{issue.message}</h4>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge variant={
                                  issue.severity === 'critical' ? 'destructive' :
                                  issue.severity === 'high' ? 'destructive' :
                                  issue.severity === 'medium' ? 'outline' : 'secondary'
                                }>
                                  {issue.severity}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {issue.type}
                                </Badge>
                                {issue.autoDetected && (
                                  <Badge variant="secondary" className="text-xs">自动检测</Badge>
                                )}
                                {issue.resolved && (
                                  <Badge variant="secondary" className="text-xs">已解决</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {formatTimestamp(issue.timestamp)}
                              </p>
                            </div>
                          </div>
                          {!issue.resolved && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => resolveIssue(issue.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              标记解决
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Parameters Tab */}
        <TabsContent value="parameters">
          <Card>
            <CardHeader>
              <CardTitle>参数分析</CardTitle>
              <CardDescription>对话参数变化追踪和对比</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {state.parameterHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无参数记录</p>
                ) : (
                  <div className="space-y-4">
                    {state.parameterHistory.slice().reverse().map((comparison, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium">
                              消息 #{comparison.messageIndex + 1}
                              {comparison.isFirstMessage && (
                                <Badge variant="secondary" className="ml-2 text-xs">首次对话</Badge>
                              )}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {formatTimestamp(comparison.timestamp)} - 会话 {comparison.conversationId.slice(-8)}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {comparison.changes.length} 个变化
                          </Badge>
                        </div>
                        
                        {comparison.changes.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium">参数变化:</h5>
                            <div className="space-y-1 text-sm">
                              {comparison.changes.filter(c => c.type !== 'unchanged').map((change, i) => (
                                <div key={i} className="flex items-center space-x-2">
                                  <Badge variant={
                                    change.type === 'added' ? 'default' :
                                    change.type === 'removed' ? 'destructive' :
                                    change.type === 'modified' ? 'outline' : 'secondary'
                                  } className="text-xs">
                                    {change.type === 'added' ? '+' :
                                     change.type === 'removed' ? '-' :
                                     change.type === 'modified' ? '~' : '='}
                                  </Badge>
                                  <span className="font-mono text-xs">{change.key}</span>
                                  {change.type === 'modified' && (
                                    <span className="text-muted-foreground text-xs">
                                      {JSON.stringify(change.previousValue)} → {JSON.stringify(change.currentValue)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}