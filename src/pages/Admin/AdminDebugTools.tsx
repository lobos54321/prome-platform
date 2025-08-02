import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/supabase';
import { authService } from '@/lib/auth';
import { WorkflowDiagnosticsOverview } from '@/components/WorkflowDiagnosticsOverview';
import { 
  Bug, 
  Database, 
  TestTube, 
  RefreshCw, 
  DollarSign,
  Users,
  Settings,
  Activity,
  AlertCircle
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

  const currentUser = authService.getCurrentUserSync();
  const isDifyEnabled = import.meta.env.VITE_ENABLE_DIFY_INTEGRATION === 'true';

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

  const testAuthSystem = async () => {
    setIsLoading(true);
    setResult('Testing authentication system...');
    
    try {
      const syncUser = authService.getCurrentUserSync();
      const asyncUser = await authService.getCurrentUser();
      const isAuth = authService.isAuthenticated();
      
      setResult(`✅ Authentication system test:\n` +
        `Sync user: ${syncUser ? syncUser.email : 'None'}\n` +
        `Async user: ${asyncUser ? asyncUser.email : 'None'}\n` +
        `Is authenticated: ${isAuth}\n` +
        `User balance: ${syncUser?.balance || 0}`);
    } catch (error) {
      console.error('Auth test failed:', error);
      setResult(`❌ Authentication test failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runSystemDiagnostics = () => {
    setResult(`📋 系统诊断信息:\n` +
      `环境: ${import.meta.env.DEV ? '开发' : '生产'}\n` +
      `Dify集成: ${isDifyEnabled ? '启用' : '禁用'}\n` +
      `当前用户: ${currentUser?.email || '未登录'}\n` +
      `用户余额: ${currentUser?.balance || 0}\n` +
      `API模式: Direct API (不使用iframe监控)\n` +
      `时间戳: ${new Date().toISOString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Bug className="h-6 w-6 text-orange-600" />
        <h2 className="text-2xl font-bold">调试工具</h2>
        <Badge variant="outline">管理员专用</Badge>
      </div>

      {/* Workflow Diagnostics Overview */}
      {isDifyEnabled && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                工作流诊断概览
              </CardTitle>
              <CardDescription>
                Dify 工作流实时监控和诊断状态 • 完整功能请查看 "工作流诊断" 标签页
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkflowDiagnosticsOverview />
            </CardContent>
          </Card>
          <Separator />
        </>
      )}

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

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              系统状态
            </CardTitle>
            <CardDescription>
              检查各系统组件的运行状态
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Direct API mode: Iframe monitoring has been removed in favor of direct API calls for better reliability.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 gap-2">
              <Button onClick={testDatabaseConnection} variant="outline" disabled={isLoading}>
                <Database className="h-4 w-4 mr-2" />
                数据库连接测试
              </Button>
              <Button onClick={testAuthSystem} variant="outline" disabled={isLoading}>
                <Users className="h-4 w-4 mr-2" />
                认证系统测试
              </Button>
              <Button onClick={runSystemDiagnostics} variant="outline" disabled={isLoading}>
                <Settings className="h-4 w-4 mr-2" />
                系统诊断
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

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
              <Label>API模式</Label>
              <Badge variant="default">
                Direct API (Iframe monitoring removed)
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}