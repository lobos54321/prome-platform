import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  RefreshCw, 
  Activity, 
  DollarSign, 
  Users, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { PointsConsumption } from '@/types';
import { difyConsumptionTracker } from '@/lib/dify-consumption-tracker';
import { adminServicesAPI } from '@/lib/admin-services';
import { toast } from '@/hooks/use-toast';

export default function TokenConsumptionMonitor() {
  const [recentConsumptions, setRecentConsumptions] = useState<PointsConsumption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalConsumptions: 0,
    totalPointsDeducted: 0,
    activeUsers: 0,
    failedTransactions: 0
  });

  useEffect(() => {
    loadData();
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setError('');
      setRefreshing(true);

      // Load recent consumptions across all users
      // In a real implementation, this would be an admin-only endpoint
      const mockConsumptions: PointsConsumption[] = [
        {
          id: 'cons_1',
          userId: 'user_1',
          serviceId: 'service_1',
          modelName: 'GPT-4',
          inputTokens: 1500,
          outputTokens: 800,
          totalTokens: 2300,
          inputCost: 75,
          outputCost: 160,
          totalCost: 235,
          pointsDeducted: 235,
          conversationId: 'conv_1',
          messageId: 'msg_1',
          requestId: 'req_1',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          status: 'completed'
        },
        {
          id: 'cons_2',
          userId: 'user_2',
          serviceId: 'service_2',
          modelName: 'GPT-3.5-Turbo',
          inputTokens: 800,
          outputTokens: 600,
          totalTokens: 1400,
          inputCost: 16,
          outputCost: 24,
          totalCost: 40,
          pointsDeducted: 40,
          conversationId: 'conv_2',
          messageId: 'msg_2',
          requestId: 'req_2',
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          status: 'completed'
        },
        {
          id: 'cons_3',
          userId: 'user_3',
          serviceId: 'service_1',
          modelName: 'Claude-3-Opus',
          inputTokens: 1200,
          outputTokens: 0,
          totalTokens: 1200,
          inputCost: 36,
          outputCost: 0,
          totalCost: 36,
          pointsDeducted: 36,
          conversationId: 'conv_3',
          messageId: 'msg_3',
          requestId: 'req_3',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          status: 'failed'
        }
      ];

      setRecentConsumptions(mockConsumptions);

      // Calculate stats
      const totalPointsDeducted = mockConsumptions.reduce((sum, c) => sum + c.pointsDeducted, 0);
      const activeUsers = new Set(mockConsumptions.map(c => c.userId)).size;
      const failedTransactions = mockConsumptions.filter(c => c.status === 'failed').length;

      setStats({
        totalConsumptions: mockConsumptions.length,
        totalPointsDeducted,
        activeUsers,
        failedTransactions
      });

    } catch (err) {
      setError('加载数据失败: ' + (err as Error).message);
      toast({
        title: "加载失败",
        description: (err as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    
    return (
      <Badge className={variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>加载监控数据...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Token 消耗监控</h2>
          <p className="text-muted-foreground">实时监控 Dify Token 消耗和积分扣费</p>
        </div>
        <Button 
          onClick={loadData} 
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总消耗次数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalConsumptions}</div>
            <p className="text-xs text-muted-foreground">最近活动</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">扣费积分</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPointsDeducted}</div>
            <p className="text-xs text-muted-foreground">总扣费</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">使用中</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">失败事务</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failedTransactions}</div>
            <p className="text-xs text-muted-foreground">需要关注</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Consumptions */}
      <Card>
        <CardHeader>
          <CardTitle>最近消耗记录</CardTitle>
          <CardDescription>实时 Token 消耗和积分扣费记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left">时间</th>
                  <th className="px-4 py-3 text-left">用户</th>
                  <th className="px-4 py-3 text-left">模型</th>
                  <th className="px-4 py-3 text-left">Tokens</th>
                  <th className="px-4 py-3 text-left">扣费积分</th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-left">请求ID</th>
                </tr>
              </thead>
              <tbody>
                {recentConsumptions.map((consumption) => (
                  <tr key={consumption.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {new Date(consumption.timestamp).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {consumption.userId.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{consumption.modelName}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="space-y-1">
                        <div>总计: {consumption.totalTokens}</div>
                        <div className="text-xs text-muted-foreground">
                          输入: {consumption.inputTokens} | 输出: {consumption.outputTokens}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">
                      {consumption.pointsDeducted}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(consumption.status)}
                        {getStatusBadge(consumption.status)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {consumption.requestId?.slice(0, 12)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {recentConsumptions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                暂无消耗记录
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}