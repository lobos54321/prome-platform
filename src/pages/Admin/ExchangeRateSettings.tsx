import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DollarSign, History, Save, Loader2, TrendingUp, InfoIcon } from 'lucide-react';
import { authService } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { ExchangeRateHistory } from '@/types';
import { toast } from 'sonner';

export default function ExchangeRateSettings() {
  const [currentRate, setCurrentRate] = useState<number>(10000);
  const [newRate, setNewRate] = useState<number>(10000);
  const [reason, setReason] = useState<string>('');
  const [history, setHistory] = useState<ExchangeRateHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [rate, historyData] = await Promise.all([
        db.getCurrentExchangeRate(),
        db.getExchangeRateHistory()
      ]);
      
      setCurrentRate(rate);
      setNewRate(rate);
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to load exchange rate data:', error);
      toast.error('加载汇率数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRate = async () => {
    if (newRate <= 0) {
      toast.error('汇率必须大于0');
      return;
    }

    if (newRate === currentRate) {
      toast.error('新汇率与当前汇率相同');
      return;
    }

    try {
      setIsUpdating(true);
      const user = await authService.getCurrentUser();
      if (!user || user.role !== 'admin') {
        toast.error('没有权限执行此操作');
        return;
      }

      await db.updateExchangeRate(newRate, user.id, reason || undefined);
      
      toast.success('汇率更新成功');
      await loadData(); // Reload data to reflect changes
      setReason(''); // Clear reason after successful update
    } catch (error) {
      console.error('Failed to update exchange rate:', error);
      toast.error('更新汇率失败');
    } finally {
      setIsUpdating(false);
    }
  };

  const calculateUSDEquivalent = (points: number) => {
    return (points / currentRate).toFixed(2);
  };

  const calculatePointsEquivalent = (usd: number) => {
    return Math.round(usd * newRate);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">加载中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <DollarSign className="h-6 w-6" />
        <h1 className="text-2xl font-bold">汇率设置管理</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Rate Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>当前汇率</span>
            </CardTitle>
            <CardDescription>
              当前生效的美元与积分兑换比例
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {currentRate.toLocaleString()} 积分
              </div>
              <div className="text-muted-foreground">= 1 美元</div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center">
                <div className="font-medium">$5</div>
                <div className="text-muted-foreground">
                  {calculatePointsEquivalent(5).toLocaleString()} 积分
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium">$10</div>
                <div className="text-muted-foreground">
                  {calculatePointsEquivalent(10).toLocaleString()} 积分
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium">$25</div>
                <div className="text-muted-foreground">
                  {calculatePointsEquivalent(25).toLocaleString()} 积分
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium">$100</div>
                <div className="text-muted-foreground">
                  {calculatePointsEquivalent(100).toLocaleString()} 积分
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rate Update Form */}
        <Card>
          <CardHeader>
            <CardTitle>更新汇率</CardTitle>
            <CardDescription>
              设置新的美元与积分兑换比例
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newRate">新汇率 (积分/美元)</Label>
              <Input
                id="newRate"
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(Number(e.target.value))}
                placeholder="例如: 10000"
                min="1"
                step="1"
              />
              <p className="text-xs text-muted-foreground">
                当前输入: 1 美元 = {newRate.toLocaleString()} 积分
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">变更原因 (可选)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="说明本次汇率调整的原因..."
                rows={3}
              />
            </div>

            {newRate !== currentRate && (
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  汇率变化: {currentRate.toLocaleString()} → {newRate.toLocaleString()} 积分/美元
                  <br />
                  变化幅度: {((newRate - currentRate) / currentRate * 100).toFixed(1)}%
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleUpdateRate}
              disabled={isUpdating || newRate === currentRate || newRate <= 0}
              className="w-full"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  更新中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  更新汇率
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Exchange Rate History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>汇率变更历史</span>
          </CardTitle>
          <CardDescription>
            最近的汇率调整记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              暂无汇率变更记录
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        {record.oldRate.toLocaleString()} → {record.newRate.toLocaleString()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        积分/美元
                      </span>
                    </div>
                    {record.reason && (
                      <p className="text-sm text-muted-foreground">
                        原因: {record.reason}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      操作员: {record.adminEmail}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {new Date(record.timestamp).toLocaleDateString('zh-CN')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(record.timestamp).toLocaleTimeString('zh-CN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}