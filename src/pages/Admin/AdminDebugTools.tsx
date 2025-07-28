import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/supabase';
import { difyIframeMonitor } from '@/lib/dify-iframe-monitor';
import { authService } from '@/lib/auth';
import { 
  Bug, 
  Database, 
  PlayCircle, 
  TestTube, 
  RefreshCw, 
  ExternalLink,
  DollarSign,
  Users,
  Settings 
} from 'lucide-react';

export default function AdminDebugTools() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  
  // Credit addition form
  const [creditForm, setCreditForm] = useState({
    email: 'lobos54321@gmail.com',
    amount: '10000',
    description: 'Test credits'
  });

  // Token simulation form
  const [tokenForm, setTokenForm] = useState({
    modelName: 'gpt-4',
    inputTokens: '1500',
    outputTokens: '800'
  });

  const currentUser = authService.getCurrentUserSync();

  const addCredits = async () => {
    setIsLoading(true);
    setResult('Adding credits...');
    
    try {
      const amount = parseInt(creditForm.amount);
      if (isNaN(amount) || amount <= 0) {
        setResult('❌ Invalid amount. Please enter a positive number.');
        return;
      }

      const result = await db.addCreditsToAdmin(
        creditForm.email,
        amount,
        creditForm.description
      );

      if (result.success) {
        setResult(`✅ Successfully added ${amount} credits to ${creditForm.email}\nNew balance: ${result.newBalance}`);
      } else {
        setResult(`❌ Failed to add credits: ${result.message}`);
      }
    } catch (error) {
      console.error('Error adding credits:', error);
      setResult(`❌ Error adding credits: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const simulateTokenUsage = async () => {
    if (!currentUser) {
      setResult('❌ You must be logged in to simulate token usage');
      return;
    }

    setIsLoading(true);
    setResult('Simulating token usage...');
    
    try {
      const inputTokens = parseInt(tokenForm.inputTokens);
      const outputTokens = parseInt(tokenForm.outputTokens);
      
      if (isNaN(inputTokens) || isNaN(outputTokens) || inputTokens <= 0 || outputTokens <= 0) {
        setResult('❌ Invalid token counts. Please enter positive numbers.');
        return;
      }

      await difyIframeMonitor.simulateTokenConsumption(
        currentUser.id,
        tokenForm.modelName,
        inputTokens,
        outputTokens
      );

      setResult(`✅ Simulated token usage:\nModel: ${tokenForm.modelName}\nInput: ${inputTokens} tokens\nOutput: ${outputTokens} tokens\nTotal: ${inputTokens + outputTokens} tokens`);
    } catch (error) {
      console.error('Error simulating token usage:', error);
      setResult(`❌ Error simulating token usage: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testDatabaseConnection = async () => {
    setIsLoading(true);
    setResult('Testing database connection...');
    
    try {
      const configs = await db.getModelConfigs();
      const exchangeRate = await db.getCurrentExchangeRate();
      const user = await db.getUserById(currentUser?.id || '');
      
      setResult(`✅ Database connection successful!\n` +
        `Model configs loaded: ${configs.length}\n` +
        `Exchange rate: ${exchangeRate}\n` +
        `Current user found: ${user ? 'Yes' : 'No'}`);
    } catch (error) {
      console.error('Database test failed:', error);
      setResult(`❌ Database connection failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshMonitorStatus = () => {
    const status = difyIframeMonitor.getStatus();
    setResult(`📊 Monitor Status:\n${JSON.stringify(status, null, 2)}`);
  };

  const openTestPage = () => {
    navigate('/token-monitor-test');
  };

  const runTokenTest = () => {
    // Open a new window to run the admin script
    const script = `
cd /home/runner/work/prome-platform/prome-platform
node admin-scripts/test-token-monitoring.js
`;
    setResult(`📝 Run this command in terminal:\n${script}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Bug className="h-6 w-6 text-orange-600" />
        <h2 className="text-2xl font-bold">调试工具</h2>
        <Badge variant="outline">管理员专用</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Credit Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              积分充值
            </CardTitle>
            <CardDescription>
              为指定用户添加积分余额
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">用户邮箱</Label>
              <Input
                id="email"
                value={creditForm.email}
                onChange={(e) => setCreditForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label htmlFor="amount">积分数量</Label>
              <Input
                id="amount"
                value={creditForm.amount}
                onChange={(e) => setCreditForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="10000"
                type="number"
              />
            </div>
            <div>
              <Label htmlFor="description">描述</Label>
              <Input
                id="description"
                value={creditForm.description}
                onChange={(e) => setCreditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Test credits"
              />
            </div>
            <Button onClick={addCredits} disabled={isLoading} className="w-full">
              <DollarSign className="h-4 w-4 mr-2" />
              添加积分
            </Button>
          </CardContent>
        </Card>

        {/* Token Usage Simulation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Token消耗模拟
            </CardTitle>
            <CardDescription>
              模拟AI模型的token消耗事件
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="modelName">模型名称</Label>
              <Input
                id="modelName"
                value={tokenForm.modelName}
                onChange={(e) => setTokenForm(prev => ({ ...prev, modelName: e.target.value }))}
                placeholder="gpt-4"
              />
            </div>
            <div>
              <Label htmlFor="inputTokens">输入Token数</Label>
              <Input
                id="inputTokens"
                value={tokenForm.inputTokens}
                onChange={(e) => setTokenForm(prev => ({ ...prev, inputTokens: e.target.value }))}
                placeholder="1500"
                type="number"
              />
            </div>
            <div>
              <Label htmlFor="outputTokens">输出Token数</Label>
              <Input
                id="outputTokens"
                value={tokenForm.outputTokens}
                onChange={(e) => setTokenForm(prev => ({ ...prev, outputTokens: e.target.value }))}
                placeholder="800"
                type="number"
              />
            </div>
            <Button onClick={simulateTokenUsage} disabled={isLoading} className="w-full">
              <PlayCircle className="h-4 w-4 mr-2" />
              模拟消耗
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* System Tests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            系统测试
          </CardTitle>
          <CardDescription>
            测试各系统组件的功能状态
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Button onClick={testDatabaseConnection} variant="outline" disabled={isLoading}>
              <Database className="h-4 w-4 mr-2" />
              数据库测试
            </Button>
            <Button onClick={refreshMonitorStatus} variant="outline" disabled={isLoading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              监控状态
            </Button>
            <Button onClick={openTestPage} variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              测试页面
            </Button>
            <Button onClick={runTokenTest} variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              完整测试
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              执行结果
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={result}
              readOnly
              className="min-h-[200px] font-mono text-sm"
              placeholder="执行结果将显示在这里..."
            />
          </CardContent>
        </Card>
      )}

      {/* Environment Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            环境信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Dify集成状态</Label>
              <Badge variant={import.meta.env.VITE_ENABLE_DIFY_INTEGRATION === 'true' ? 'default' : 'secondary'}>
                {import.meta.env.VITE_ENABLE_DIFY_INTEGRATION === 'true' ? '已启用' : '已禁用'}
              </Badge>
            </div>
            <div>
              <Label>环境模式</Label>
              <Badge variant={import.meta.env.DEV ? 'secondary' : 'default'}>
                {import.meta.env.DEV ? '开发环境' : '生产环境'}
              </Badge>
            </div>
            <div>
              <Label>当前用户</Label>
              <p className="text-sm">{currentUser?.email || 'Not logged in'}</p>
            </div>
            <div>
              <Label>监控状态</Label>
              <Badge variant={difyIframeMonitor.isCurrentlyListening() ? 'default' : 'secondary'}>
                {difyIframeMonitor.isCurrentlyListening() ? '运行中' : '已停止'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}