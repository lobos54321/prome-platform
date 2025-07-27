import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart2, InfoIcon, Activity, Wallet, TrendingUp, Clock, Loader2 } from 'lucide-react';
import { authService } from '@/lib/auth';
import { isDifyEnabled } from '@/api/dify-api';
import { db } from '@/lib/supabase';
import { difyIframeMonitor } from '@/lib/dify-iframe-monitor';
import { User, TokenUsage, BillingRecord } from '@/types';
import { toast } from 'sonner';

export default function TokenDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  useEffect(() => {
    const initUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        
        if (!currentUser) {
          navigate('/login');
          return;
        }

        if (isDifyEnabled()) {
          await loadUserData(currentUser.id);
          setupIframeMonitoring(currentUser.id);
        }
      } catch (error) {
        console.error('Failed to get current user:', error);
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };

    initUser();

    return () => {
      difyIframeMonitor.stopListening();
    };
  }, [navigate]);

  const loadUserData = async (userId: string) => {
    try {
      setIsDataLoading(true);
      const [usage, billing] = await Promise.all([
        db.getTokenUsage(userId),
        db.getBillingRecords(userId)
      ]);
      
      setTokenUsage(usage);
      setBillingRecords(billing);
    } catch (error) {
      console.error('Failed to load user data:', error);
      toast.error('加载数据失败');
    } finally {
      setIsDataLoading(false);
    }
  };

  const setupIframeMonitoring = (userId: string) => {
    difyIframeMonitor.setOnTokenConsumption((event) => {
      console.log('Token consumption event:', event);
      toast.success(`Token已消费: ${event.totalTokens} tokens (${event.modelName})`);
      loadUserData(userId); // Reload data
    });

    difyIframeMonitor.setOnBalanceUpdate((newBalance) => {
      if (user) {
        setUser({ ...user, balance: newBalance });
      }
    });

    difyIframeMonitor.startListening(userId);
  };

  const calculateStats = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const monthlyUsage = tokenUsage.filter(usage => 
      new Date(usage.timestamp) >= startOfMonth
    );
    
    const dailyUsage = tokenUsage.filter(usage => 
      new Date(usage.timestamp) >= startOfDay
    );

    const totalTokens = tokenUsage.reduce((sum, usage) => sum + usage.tokensUsed, 0);
    const monthlyTokens = monthlyUsage.reduce((sum, usage) => sum + usage.tokensUsed, 0);
    const dailyTokens = dailyUsage.reduce((sum, usage) => sum + usage.tokensUsed, 0);
    
    const totalCost = tokenUsage.reduce((sum, usage) => sum + usage.cost, 0);
    const monthlyCost = monthlyUsage.reduce((sum, usage) => sum + usage.cost, 0);
    const dailyCost = dailyUsage.reduce((sum, usage) => sum + usage.cost, 0);

    const avgTokensPerCall = tokenUsage.length > 0 ? Math.round(totalTokens / tokenUsage.length) : 0;

    return {
      totalTokens,
      monthlyTokens,
      dailyTokens,
      totalCost,
      monthlyCost,
      dailyCost,
      avgTokensPerCall,
      usageCount: tokenUsage.length
    };
  };

  const stats = calculateStats();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载Token仪表板...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  if (!isDifyEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Token 仪表板</h1>
          <p className="text-gray-600">Token使用情况和统计</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <InfoIcon className="h-5 w-5" />
              Token 仪表板不可用
            </CardTitle>
            <CardDescription>
              Dify集成功能已禁用，无法显示Token使用统计
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                要启用Token仪表板，请在环境变量中设置 VITE_ENABLE_DIFY_INTEGRATION=true
              </AlertDescription>
            </Alert>
            
            <div className="mt-6 flex gap-4">
              <Button onClick={() => navigate('/dashboard')}>
                返回主仪表板
              </Button>
              <Button variant="outline" onClick={() => navigate('/admin')}>
                管理设置
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Token 仪表板</h1>
        <p className="text-gray-600">查看您的Token使用情况和积分统计</p>
      </div>

      {/* Enhanced Balance Display */}
      <div className="mb-8">
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">账户余额</h3>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold text-blue-600">
                    {user?.balance?.toLocaleString() || 0}
                  </span>
                  <span className="text-sm text-gray-500">积分</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  余额充足，可继续使用AI服务
                </p>
              </div>
              <div className="text-right">
                <Button 
                  onClick={() => navigate('/pricing')}
                  className="mb-2"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  充值积分
                </Button>
                <div className="text-xs text-gray-500">
                  支持信用卡和借记卡
                </div>
              </div>
            </div>
            
            {user?.balance && user.balance < 1000 && (
              <Alert className="mt-4 border-orange-200 bg-orange-50">
                <AlertDescription className="text-orange-800">
                  积分余额较低，建议及时充值以免影响服务使用
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage Statistics */}
      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">当前余额</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.balance || 0}</div>
            <p className="text-xs text-muted-foreground">积分</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日消费</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isDataLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.dailyTokens.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Token</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月消费</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isDataLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : Math.round(stats.monthlyCost)}
            </div>
            <p className="text-xs text-muted-foreground">积分</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均每次调用</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isDataLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.avgTokensPerCall}
            </div>
            <p className="text-xs text-muted-foreground">Token</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Summary */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>使用统计</CardTitle>
            <CardDescription>
              Token消费概览
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>总调用次数</span>
                <span className="font-medium">{stats.usageCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>总Token消费</span>
                <span className="font-medium">{stats.totalTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>总积分消费</span>
                <span className="font-medium">{Math.round(stats.totalCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>监控状态</CardTitle>
            <CardDescription>
              实时监控状态
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Dify集成</span>
              <Badge variant="default">已启用</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">实时监控</span>
              <Badge variant={difyIframeMonitor.isCurrentlyListening() ? "default" : "secondary"}>
                {difyIframeMonitor.isCurrentlyListening() ? '运行中' : '已停止'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">余额状态</span>
              <Badge variant={(user?.balance || 0) > 1000 ? "default" : "destructive"}>
                {(user?.balance || 0) > 1000 ? '充足' : '不足'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            最近使用记录
          </CardTitle>
          <CardDescription>
            最新的Token消费记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isDataLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : tokenUsage.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>暂无使用记录</p>
              <p className="text-sm">开始使用Dify服务后将显示记录</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {tokenUsage.slice(0, 10).map((usage) => (
                <div key={usage.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{usage.serviceId}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(usage.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{usage.tokensUsed} tokens</div>
                    <div className="text-sm text-gray-500">{Math.round(usage.cost)} 积分</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-4">
        <Button onClick={() => navigate('/dashboard')}>
          返回主仪表板
        </Button>
        <Button variant="outline" onClick={() => navigate('/pricing')}>
          充值积分
        </Button>
      </div>
    </div>
  );
}