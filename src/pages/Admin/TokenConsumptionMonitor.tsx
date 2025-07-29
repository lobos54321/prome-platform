import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Activity, InfoIcon, DollarSign, Coins } from 'lucide-react';
import { isDifyEnabled } from '@/api/dify-api';
import { db } from '@/lib/supabase';

interface TokenStats {
  totalConsumptions: number;
  totalCreditsDeducted: number;
}

interface ConsumptionRecord {
  id: string;
  timestamp: string;
  userEmail: string;
  service: string;
  tokens: number;
  costUsd: number;
  credits: number;
  model?: string;
}

export default function TokenConsumptionMonitor() {
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<TokenStats>({ totalConsumptions: 0, totalCreditsDeducted: 0 });
  const [records, setRecords] = useState<ConsumptionRecord[]>([]);
  const [hasError, setHasError] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setHasError(false);
    
    try {
      // Load statistics
      const statsData = await db.getTokenConsumptionStats();
      setStats(statsData);

      // Load detailed records
      const recordsData = await db.getDetailedTokenConsumptionRecords();
      setRecords(recordsData);
    } catch (error) {
      console.error('Error loading token consumption data:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    loadData();
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(4)}`;
  };

  if (!isDifyEnabled()) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">消耗监控</h2>
            <p className="text-gray-500">Dify集成已禁用</p>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <InfoIcon className="h-5 w-5" />
              监控功能不可用
            </CardTitle>
            <CardDescription>
              Dify集成功能已禁用，无法监控Token消耗
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                要启用此功能，请在环境变量中设置 VITE_ENABLE_DIFY_INTEGRATION=true
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Token 消耗监控</h2>
          <p className="text-gray-500">基本的Dify Token消耗监控</p>
        </div>
        <Button onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总消耗次数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded"></div>
              ) : hasError ? (
                "-"
              ) : (
                stats.totalConsumptions.toLocaleString()
              )}
            </div>
            <p className="text-xs text-muted-foreground">监控数据</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">扣费积分</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded"></div>
              ) : hasError ? (
                "-"
              ) : (
                stats.totalCreditsDeducted.toLocaleString()
              )}
            </div>
            <p className="text-xs text-muted-foreground">总扣费</p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>消耗记录</CardTitle>
          <CardDescription>
            Token消耗详细记录 - 显示用户使用AI服务的详细信息
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 animate-pulse rounded w-5/6"></div>
            </div>
          ) : hasError ? (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                数据库连接失败，显示Token消耗记录遇到问题。请检查数据库连接或稍后重试。
              </AlertDescription>
            </Alert>
          ) : records.length === 0 ? (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                暂无Token消耗记录。当用户开始使用AI服务时，消耗记录将显示在这里。
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">时间</th>
                    <th className="text-left p-2 font-medium">用户</th>
                    <th className="text-left p-2 font-medium">服务</th>
                    <th className="text-right p-2 font-medium">Tokens</th>
                    <th className="text-right p-2 font-medium">费用</th>
                    <th className="text-right p-2 font-medium">积分</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 text-sm">{formatTimestamp(record.timestamp)}</td>
                      <td className="p-2 text-sm">{record.userEmail}</td>
                      <td className="p-2 text-sm">{record.service}</td>
                      <td className="p-2 text-sm text-right">{record.tokens.toLocaleString()}</td>
                      <td className="p-2 text-sm text-right">{formatCurrency(record.costUsd)}</td>
                      <td className="p-2 text-sm text-right">{record.credits.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {records.length >= 100 && (
                <p className="text-sm text-gray-500 mt-2">
                  显示最近100条记录。如需查看更多历史记录，请联系系统管理员。
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}