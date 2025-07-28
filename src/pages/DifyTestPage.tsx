import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  StopCircle, 
  Activity, 
  MessageSquare, 
  DollarSign, 
  CheckCircle, 
  XCircle,
  RefreshCw
} from 'lucide-react';
import { difyIframeMonitor, TokenConsumptionEvent } from '@/lib/dify-iframe-monitor';
import { authService } from '@/lib/auth';
import { isDifyEnabled } from '@/api/dify-api';
import { User } from '@/types';
import { toast } from 'sonner';

export default function DifyTestPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [recentEvents, setRecentEvents] = useState<TokenConsumptionEvent[]>([]);
  const [balance, setBalance] = useState(0);
  const [globalMonitorStatus, setGlobalMonitorStatus] = useState(false);

  useEffect(() => {
    const initUser = async () => {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        setBalance(currentUser.balance);
      }
    };

    initUser();

    // Check initial global monitoring status
    setGlobalMonitorStatus(difyIframeMonitor.isCurrentlyListening());

    // Listen for global monitoring changes
    const handleBalanceUpdate = (event: CustomEvent) => {
      const { balance } = event.detail;
      setBalance(balance);
      toast.info(`全局监控: 余额更新为 ${balance} 积分`);
    };

    const handleTokenConsumed = (event: CustomEvent) => {
      const { event: tokenEvent } = event.detail;
      setRecentEvents(prev => [tokenEvent, ...prev.slice(0, 4)]);
      toast.success(`全局监控: 检测到Token消费`);
    };

    window.addEventListener('balance-updated', handleBalanceUpdate as EventListener);
    window.addEventListener('token-consumed', handleTokenConsumed as EventListener);

    // Check monitoring status periodically
    const interval = setInterval(() => {
      setGlobalMonitorStatus(difyIframeMonitor.isCurrentlyListening());
    }, 2000);

    return () => {
      window.removeEventListener('balance-updated', handleBalanceUpdate as EventListener);
      window.removeEventListener('token-consumed', handleTokenConsumed as EventListener);
      clearInterval(interval);
    };
  }, []);

  const startMonitoring = () => {
    if (!user) {
      toast.error('用户未登录');
      return;
    }

    difyIframeMonitor.setOnTokenConsumption((event) => {
      setRecentEvents(prev => [event, ...prev.slice(0, 4)]); // Keep last 5 events
      toast.success(`检测到Token消费: ${event.totalTokens} tokens`);
    });

    difyIframeMonitor.setOnBalanceUpdate((newBalance) => {
      setBalance(newBalance);
      toast.info(`余额已更新: ${newBalance} 积分`);
    });

    difyIframeMonitor.startListening(user.id);
    setIsMonitoring(true);
    toast.success('开始监控Dify iframe事件');
  };

  const stopMonitoring = () => {
    difyIframeMonitor.stopListening();
    setIsMonitoring(false);
    toast.info('停止监控Dify iframe事件');
  };

  const simulateTokenEvent = () => {
    // Simulate a message_end event for testing
    const mockEvent = {
      origin: 'https://dify.ai',
      data: {
        event: 'message_end',
        data: {
          model_name: 'gpt-3.5-turbo',
          input_tokens: 150,
          output_tokens: 200,
          total_tokens: 350,
          conversation_id: 'test-conv-' + Date.now(),
          message_id: 'test-msg-' + Date.now(),
          timestamp: new Date().toISOString()
        }
      }
    };

    // Dispatch a custom message event
    window.postMessage(mockEvent.data, window.location.origin);
    toast.info('发送了模拟Token消费事件');
  };

  const refreshStatus = () => {
    setGlobalMonitorStatus(difyIframeMonitor.isCurrentlyListening());
    toast.info('状态已刷新');
  };

  if (!isDifyEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Dify集成测试</CardTitle>
            <CardDescription>测试iframe通信和Token消费监控</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Dify集成功能已禁用。请设置环境变量 VITE_ENABLE_DIFY_INTEGRATION=true
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dify集成测试</h1>
        <p className="text-gray-600">测试iframe通信和Token消费监控功能</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Global Monitor Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              全局监控状态
              <Button 
                onClick={refreshStatus}
                variant="ghost" 
                size="sm"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              应用级别的Dify监控状态（自动启动）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>全局监控状态</span>
              <Badge variant={globalMonitorStatus ? "default" : "secondary"}>
                {globalMonitorStatus ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    自动运行中
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    未运行
                  </>
                )}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span>当前余额</span>
              <span className="font-medium">{balance} 积分</span>
            </div>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {globalMonitorStatus 
                  ? '全局监控已自动启动，会监控所有Dify iframe事件'
                  : '全局监控未运行，需要登录用户才能自动启动'
                }
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Local Monitoring Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              本地监控控制
            </CardTitle>
            <CardDescription>
              页面级别的监控控制（测试用）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>本地监控状态</span>
              <Badge variant={isMonitoring ? "default" : "secondary"}>
                {isMonitoring ? '运行中' : '已停止'}
              </Badge>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={startMonitoring} 
                disabled={isMonitoring || !user || globalMonitorStatus}
                size="sm"
              >
                <Play className="mr-2 h-4 w-4" />
                开始监控
              </Button>
              <Button 
                onClick={stopMonitoring} 
                disabled={!isMonitoring}
                variant="outline"
                size="sm"
              >
                <StopCircle className="mr-2 h-4 w-4" />
                停止监控
              </Button>
            </div>

            {globalMonitorStatus && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  全局监控已运行，无需启动本地监控
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              测试功能
            </CardTitle>
            <CardDescription>
              模拟Dify事件进行测试
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                点击下方按钮模拟一个Token消费事件，观察系统响应
              </AlertDescription>
            </Alert>

            <Button 
              onClick={simulateTokenEvent}
              disabled={!globalMonitorStatus && !isMonitoring}
              className="w-full"
            >
              <DollarSign className="mr-2 h-4 w-4" />
              模拟Token消费事件
            </Button>

            <p className="text-sm text-gray-500">
              模拟事件: GPT-3.5-Turbo, 150输入+200输出=350总Token
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>最近事件</CardTitle>
          <CardDescription>
            最近检测到的Token消费事件
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>暂无事件记录</p>
              <p className="text-sm">启动监控并模拟事件来测试功能</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentEvents.map((event, index) => (
                <div key={`${event.timestamp}-${index}`} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{event.modelName}</div>
                      <div className="text-sm text-gray-500">
                        输入: {event.inputTokens} • 输出: {event.outputTokens} • 总计: {event.totalTokens}
                      </div>
                      {event.conversationId && (
                        <div className="text-xs text-gray-400">
                          会话: {event.conversationId}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>登录后，全局监控会自动启动（无需手动操作）</li>
            <li>查看页面顶部导航栏的"Token监控"状态指示器</li>
            <li>确保已在管理面板中配置了模型定价</li>
            <li>使用"模拟Token消费事件"测试系统响应</li>
            <li>观察余额变化和事件记录</li>
            <li>在实际环境中，系统会自动监听Dify iframe的message_end事件</li>
            <li>如果全局监控未启动，可以手动使用本地监控进行测试</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}