import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart2, InfoIcon, Activity, Wallet, TrendingUp, Clock, Loader2 } from 'lucide-react';
import { authService } from '@/lib/auth';
import { isDifyEnabled } from '@/lib/dify-api-client';
import { db } from '@/lib/supabase';
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
          // Token monitoring is now handled automatically through API integration
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
      // Cleanup if needed
    };
  }, [navigate]);

  // 🔧 修复：监听余额和token使用更新事件，实时刷新数据
  useEffect(() => {
    if (!user || !user.id) return;

    const handleBalanceUpdate = () => {
      console.log('[TokenDashboard] Balance updated, refreshing token usage data...');
      loadUserData(user.id);
    };

    // 监听余额更新事件
    window.addEventListener('balance-updated', handleBalanceUpdate);

    return () => {
      window.removeEventListener('balance-updated', handleBalanceUpdate);
    };
  }, [user]);

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

  // Token monitoring is now handled automatically through the API integration
  // No need for separate iframe monitoring setup

  const calculateStats = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const monthlyUsage = tokenUsage.filter(usage => 
      usage.timestamp && new Date(usage.timestamp) >= startOfMonth
    );
    
    const dailyUsage = tokenUsage.filter(usage => 
      usage.timestamp && new Date(usage.timestamp) >= startOfDay
    );

    const totalTokens = tokenUsage.reduce((sum, usage) => sum + (usage.tokensUsed || 0), 0);
    const monthlyTokens = monthlyUsage.reduce((sum, usage) => sum + (usage.tokensUsed || 0), 0);
    const dailyTokens = dailyUsage.reduce((sum, usage) => sum + (usage.tokensUsed || 0), 0);
    
    const totalCost = tokenUsage.reduce((sum, usage) => sum + (usage.cost || 0), 0);
    const monthlyCost = monthlyUsage.reduce((sum, usage) => sum + (usage.cost || 0), 0);
    const dailyCost = dailyUsage.reduce((sum, usage) => sum + (usage.cost || 0), 0);

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
              ProMe集成功能已禁用，无法显示Token使用统计
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

      {/* Balance and Status */}
      <div className="grid gap-6 md:grid-cols-5 mb-8">
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
              {isDataLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.monthlyTokens.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Token</p>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月积分消费</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isDataLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : Math.round(stats.monthlyCost)}
            </div>
            <p className="text-xs text-muted-foreground">积分</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Summary */}
      <div className="grid gap-6 mb-8">
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
              <p className="text-sm">开始使用ProMe服务后将显示记录</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {tokenUsage.slice(0, 10).map((usage) => (
                <div key={usage.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">
                      {usage.serviceId?.includes('dify') ? 'ProMe AI Chat' : 
                       usage.serviceId?.includes('workflow') ? 'ProMe Workflow' : 
                       usage.serviceId || 'ProMe Service'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(usage.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{usage.tokensUsed?.toLocaleString() || 0} tokens</div>
                    <div className="text-sm text-gray-500">{Math.round(usage.cost || 0)} 积分</div>
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