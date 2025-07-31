import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  Clock, 
  FileText, 
  BarChart3, 
  AlertTriangle,
  Zap,
  Target,
  Activity
} from 'lucide-react';
import { useWorkflowDiagnostics } from '@/hooks/useWorkflowDiagnostics';

interface WorkflowDiagnosticsOverviewProps {
  className?: string;
}

export function WorkflowDiagnosticsOverview({ className }: WorkflowDiagnosticsOverviewProps) {
  const { state, settings } = useWorkflowDiagnostics();

  const activeIssues = state.detectedIssues.filter(issue => !issue.resolved);
  const recentEvents = state.eventHistory.slice(-5);
  const activeSessions = Array.from(state.activeSessions.values()).filter(s => s.status === 'active');

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold tracking-tight">工作流诊断系统</h3>
        <p className="text-sm text-muted-foreground">
          实时监控 Dify 工作流执行状态，自动检测问题并提供诊断报告
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">系统状态</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={state.isEnabled ? "default" : "secondary"}>
                {state.isEnabled ? '运行中' : '已停用'}
              </Badge>
              {state.isEnabled && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {settings.enableAutoDetection ? '自动检测已启用' : '手动模式'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃会话</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSessions.length}</div>
            <p className="text-xs text-muted-foreground">
              总计 {state.statistics.totalSessions} 个会话
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">检测问题</CardTitle>
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
            <CardTitle className="text-sm font-medium">总事件数</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.statistics.totalEvents}</div>
            <p className="text-xs text-muted-foreground">
              工作流事件记录
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Issues Alert */}
      {activeIssues.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            检测到 {activeIssues.length} 个工作流问题需要关注。
            {activeIssues.some(i => i.type === 'infinite_loop') && ' 包含可能的无限循环问题。'}
            {activeIssues.some(i => i.type === 'stuck_node') && ' 包含节点卡住问题。'}
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">最近事件</CardTitle>
            <CardDescription>最新的工作流事件记录</CardDescription>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">暂无事件记录</p>
            ) : (
              <div className="space-y-2">
                {recentEvents.reverse().map((event) => (
                  <div key={event.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        event.event === 'workflow_started' ? 'bg-green-500' :
                        event.event === 'workflow_finished' ? 'bg-blue-500' :
                        event.event === 'node_started' ? 'bg-yellow-500' :
                        event.event === 'node_finished' ? 'bg-green-400' :
                        event.event === 'error' ? 'bg-red-500' : 'bg-gray-500'
                      }`} />
                      <span>{event.event}</span>
                      {event.nodeId && (
                        <Badge variant="outline" className="text-xs">
                          {event.nodeName || event.nodeId}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString('zh-CN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">活跃会话</CardTitle>
            <CardDescription>当前运行中的工作流会话</CardDescription>
          </CardHeader>
          <CardContent>
            {activeSessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">暂无活跃会话</p>
            ) : (
              <div className="space-y-3">
                {activeSessions.slice(0, 3).map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="text-sm font-medium">会话 {session.id.slice(-8)}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.events.length} 事件 • {session.nodeExecutions.size} 节点
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="default">运行中</Badge>
                      {session.detectedIssues.filter(i => !i.resolved).length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {session.detectedIssues.filter(i => !i.resolved).length} 问题
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {activeSessions.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    还有 {activeSessions.length - 3} 个会话...
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">功能特性</CardTitle>
          <CardDescription>工作流诊断系统提供的主要功能</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <Target className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium">实时事件监控</h4>
                <p className="text-xs text-muted-foreground">
                  监控所有工作流事件（启动、节点执行、完成、错误）
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <BarChart3 className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium">参数对比分析</h4>
                <p className="text-xs text-muted-foreground">
                  比较首次对话和后续对话的参数差异
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium">自动问题检测</h4>
                <p className="text-xs text-muted-foreground">
                  自动检测无限循环、节点卡住、超时等问题
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <FileText className="h-5 w-5 text-purple-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium">诊断报告生成</h4>
                <p className="text-xs text-muted-foreground">
                  生成详细的诊断报告和修复建议
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">配置概览</CardTitle>
          <CardDescription>当前的诊断系统配置</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium">检测阈值</p>
              <div className="text-muted-foreground space-y-1">
                <p>最大节点执行: {settings.detectionThresholds.maxNodeExecutions} 次</p>
                <p>最大会话时长: {Math.round(settings.detectionThresholds.maxSessionDuration / 60000)} 分钟</p>
                <p>事件间隔超时: {Math.round(settings.detectionThresholds.maxEventInterval / 1000)} 秒</p>
              </div>
            </div>
            <div>
              <p className="font-medium">功能开关</p>
              <div className="text-muted-foreground space-y-1">
                <p>自动检测: {settings.enableAutoDetection ? '✓ 已启用' : '✗ 已禁用'}</p>
                <p>参数追踪: {settings.enableParameterTracking ? '✓ 已启用' : '✗ 已禁用'}</p>
                <p>事件记录: {settings.enableEventLogging ? '✓ 已启用' : '✗ 已禁用'}</p>
              </div>
            </div>
            <div>
              <p className="font-medium">存储配置</p>
              <div className="text-muted-foreground space-y-1">
                <p>历史记录上限: {settings.maxHistorySize} 条</p>
                <p>问题提醒: {settings.alertOnIssues ? '✓ 已启用' : '✗ 已禁用'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}