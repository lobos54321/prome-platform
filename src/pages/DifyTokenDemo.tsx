import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BalanceProtection from '@/components/BalanceProtection';
import { difyAPI } from '@/api/dify-api';
import { DifyWebhookPayload, User } from '@/types';
import { authService } from '@/lib/auth';

export default function DifyTokenSystemDemo() {
  const [showBalance, setShowBalance] = useState(false);
  const [simulationResult, setSimulationResult] = useState<string>('');
  const [demoUser, setDemoUser] = useState<User | null>(null);

  // Create demo user for testing
  const createDemoUser = () => {
    const user: User = {
      id: 'demo-user-123',
      name: 'Demo User',
      email: 'demo@example.com',
      role: 'admin',
      balance: 1000,
      createdAt: new Date().toISOString()
    };
    
    setDemoUser(user);
    // Temporarily override authService for demo
    (authService as any).currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const logout = () => {
    setDemoUser(null);
    (authService as any).currentUser = null;
    localStorage.removeItem('currentUser');
  };

  // Simulate webhook processing
  const simulateWebhook = async () => {
    const mockPayload: DifyWebhookPayload = {
      event: 'message_end',
      data: {
        event: 'message_end',
        conversation_id: 'conv_demo_123',
        message_id: 'msg_demo_456',
        user_id: demoUser?.id || 'user_demo_789',
        model_name: 'GPT-4',
        input_tokens: 1500,
        output_tokens: 800,
        total_tokens: 2300,
        timestamp: new Date().toISOString()
      },
      request_id: 'req_demo_abc123'
    };

    const headers = {
      'x-api-key': 'prome_wh_key_123456',
      'x-user-id': demoUser?.id || 'user_demo_789',
      'x-service-id': 'demo-service'
    };

    try {
      const result = await difyAPI.processWebhook(mockPayload, headers);
      setSimulationResult(`Webhook processed: ${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      setSimulationResult(`Error: ${error}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Dify Token 消耗监控系统演示</h1>
        <p className="text-muted-foreground">演示 Token 消耗追踪和积分扣费功能</p>
      </div>

      {/* Demo User Control */}
      <Card>
        <CardHeader>
          <CardTitle>演示用户控制</CardTitle>
          <CardDescription>切换演示用户状态来测试不同功能</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {demoUser ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{demoUser.name} ({demoUser.email})</p>
                <p className="text-sm text-muted-foreground">余额: {demoUser.balance} 积分 | 角色: {demoUser.role}</p>
              </div>
              <div className="space-x-2">
                <Button onClick={logout} variant="outline">退出登录</Button>
                <Button onClick={() => window.open('/admin', '_blank')} variant="secondary">
                  打开管理后台
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">未登录状态</p>
              <Button onClick={createDemoUser}>创建演示用户</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">实时监控</CardTitle>
            <CardDescription>监听 Dify message_end 事件</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">已实现</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">精确计费</CardTitle>
            <CardDescription>输入/输出 Token 分别计价</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">已实现</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">余额保护</CardTitle>
            <CardDescription>调用前检查余额是否充足</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">已实现</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Balance Protection Demo */}
      <Card>
        <CardHeader>
          <CardTitle>余额保护组件演示</CardTitle>
          <CardDescription>展示用户余额检查和费用预估功能</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => setShowBalance(!showBalance)}>
            {showBalance ? '隐藏' : '显示'} 余额保护组件
          </Button>
          
          {showBalance && (
            <BalanceProtection
              modelName="GPT-4"
              estimatedInputTokens={1500}
              estimatedOutputTokens={800}
              onProceed={() => alert('AI 调用已授权，可以继续执行')}
              onCancel={() => setShowBalance(false)}
              className="max-w-md"
            />
          )}
        </CardContent>
      </Card>

      {/* Webhook Simulation */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook 处理演示</CardTitle>
          <CardDescription>模拟 Dify message_end 事件处理</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={simulateWebhook}>
            模拟 Webhook 处理
          </Button>
          
          {simulationResult && (
            <div className="bg-gray-100 p-4 rounded-md">
              <pre className="text-sm overflow-auto">{simulationResult}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Implementation Summary */}
      <Card>
        <CardHeader>
          <CardTitle>系统实现总结</CardTitle>
          <CardDescription>已完成的核心功能</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">后端功能</h4>
              <ul className="space-y-1">
                <li>✅ Dify webhook 处理</li>
                <li>✅ Token 消耗计算引擎</li>
                <li>✅ 实时积分扣费</li>
                <li>✅ 余额检查机制</li>
                <li>✅ 消耗历史记录</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">前端功能</h4>
              <ul className="space-y-1">
                <li>✅ 管理员监控界面</li>
                <li>✅ 模型价格管理</li>
                <li>✅ 余额保护组件</li>
                <li>✅ 费用预估显示</li>
                <li>✅ 消耗记录查看</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}