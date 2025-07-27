import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DollarSign, History, Save, Loader2, TrendingUp } from 'lucide-react';
import { isDifyEnabled } from '@/api/dify-api';
import { authService } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { ExchangeRateHistory } from '@/types';
import { toast } from 'sonner';

export default function ExchangeRateSettings() {
  const [currentRate, setCurrentRate] = useState(10000);
  const [newRate, setNewRate] = useState(10000);
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<ExchangeRateHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isDifyEnabled()) {
      loadData();
    }
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [rate, rateHistory] = await Promise.all([
        db.getCurrentExchangeRate(),
        db.getExchangeRateHistory()
      ]);
      
      setCurrentRate(rate);
      setNewRate(rate);
      setHistory(rateHistory);
    } catch (error) {
      console.error('Failed to load exchange rate data:', error);
      toast.error('加载汇率数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRate = async () => {
    if (newRate === currentRate) {
      toast.info('汇率无变化');
      return;
    }

    if (newRate <= 0) {
      toast.error('汇率必须大于0');
      return;
    }

    try {
      setIsUpdating(true);
      const user = await authService.getCurrentUser();
      
      if (!user || user.role !== 'admin') {
        toast.error('无权限操作');
        return;
      }

      await db.updateExchangeRate(newRate, user.id, reason);
      
      toast.success('汇率更新成功');
      await loadData(); // 重新加载数据
      setReason(''); // 清空原因
    } catch (error) {
      console.error('Failed to update exchange rate:', error);
      toast.error('更新汇率失败');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const formatRate = (rate: number) => {
    return `${rate.toLocaleString()} 积分/美元`;
  };

  if (!isDifyEnabled()) {
    return (
      <Alert>
        <AlertDescription>
          Dify功能未启用，无法管理汇率设置。
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Exchange Rate */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <CardTitle>当前汇率设置</CardTitle>
          </div>
          <CardDescription>
            设置美元与积分的兑换比例，影响用户充值和消耗计算
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>当前汇率</Label>
              <div className="text-2xl font-bold text-green-600">
                {formatRate(currentRate)}
              </div>
              <div className="text-sm text-muted-foreground">
                1美元 = {currentRate.toLocaleString()}积分
              </div>
            </div>
            <div>
              <Label>示例充值</Label>
              <div className="space-y-1 text-sm">
                <div>$10 → {(10 * currentRate).toLocaleString()} 积分</div>
                <div>$25 → {(25 * currentRate).toLocaleString()} 积分</div>
                <div>$50 → {(50 * currentRate).toLocaleString()} 积分</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Update Exchange Rate */}
      <Card>
        <CardHeader>
          <CardTitle>更新汇率</CardTitle>
          <CardDescription>
            调整汇率设置，所有更改都会被记录在历史中
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="newRate">新汇率 (积分/美元)</Label>
              <Input
                id="newRate"
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(Number(e.target.value))}
                placeholder="例如: 10000"
                min="1"
                step="100"
              />
              <div className="text-xs text-muted-foreground mt-1">
                建议范围: 5,000 - 20,000 积分/美元
              </div>
            </div>
            <div>
              <Label htmlFor="reason">变更原因</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请说明调整汇率的原因..."
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-4">
            <div className="text-sm text-muted-foreground">
              {newRate !== currentRate && (
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>
                    变化: {currentRate.toLocaleString()} → {newRate.toLocaleString()} 
                    ({newRate > currentRate ? '增加' : '减少'} {Math.abs(((newRate - currentRate) / currentRate) * 100).toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
            <Button 
              onClick={handleUpdateRate}
              disabled={isUpdating || newRate === currentRate}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  更新中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  更新汇率
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exchange Rate History */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <CardTitle>汇率变更历史</CardTitle>
          </div>
          <CardDescription>
            查看所有汇率调整记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无汇率变更记录
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((record) => (
                <div key={record.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={record.newRate > record.oldRate ? "default" : "secondary"}>
                          {record.newRate > record.oldRate ? '上调' : '下调'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(record.timestamp)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">操作人员: </span>
                        {record.adminEmail}
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm">
                          <span className="text-muted-foreground">原汇率: </span>
                          {formatRate(record.oldRate)}
                        </span>
                        <span className="text-sm">
                          <span className="text-muted-foreground">新汇率: </span>
                          {formatRate(record.newRate)}
                        </span>
                      </div>
                      {record.reason && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">原因: </span>
                          {record.reason}
                        </div>
                      )}
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