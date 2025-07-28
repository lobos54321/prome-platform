import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, DollarSign, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import { authService } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { User } from '@/types';

interface PointsDisplayProps {
  className?: string;
  showDetails?: boolean;
}

export default function PointsDisplay({ className = '', showDetails = true }: PointsDisplayProps) {
  const [user, setUser] = useState<User | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(10000); // Default rate
  const [isLoadingRate, setIsLoadingRate] = useState(true);
  const [pointsHistory, setPointsHistory] = useState<{
    change: number;
    timestamp: string;
  }[]>([]);
  
  useEffect(() => {
    const currentUser = authService.getCurrentUserSync();
    setUser(currentUser);

    // Load exchange rate
    loadExchangeRate();

    // 监听认证状态变化
    const handleAuthChange = (event: CustomEvent) => {
      setUser(event.detail.user);
    };

    // 监听余额更新
    const handleBalanceUpdate = (event: CustomEvent) => {
      if (user && event.detail.balance !== undefined) {
        setUser(prev => prev ? { ...prev, balance: event.detail.balance } : null);
      }
    };

    window.addEventListener('auth-state-changed', handleAuthChange as EventListener);
    window.addEventListener('balance-updated', handleBalanceUpdate as EventListener);
    
    // 模拟积分历史数据
    loadPointsHistory();

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange as EventListener);
      window.removeEventListener('balance-updated', handleBalanceUpdate as EventListener);
    };
  }, [user?.id]); // Re-run when user ID changes

  const loadExchangeRate = async () => {
    try {
      setIsLoadingRate(true);
      const rate = await db.getCurrentExchangeRate();
      setExchangeRate(rate);
      console.log('Loaded exchange rate for points display:', rate);
    } catch (error) {
      console.warn('Failed to load exchange rate, using default:', error);
      setExchangeRate(10000);
    } finally {
      setIsLoadingRate(false);
    }
  };

  const loadPointsHistory = () => {
    // 模拟最近的积分变化记录
    const mockHistory = [
      { change: -150, timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() }, // 30分钟前
      { change: -200, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() }, // 2小时前
      { change: 10000, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() }, // 1天前充值
    ];
    setPointsHistory(mockHistory);
  };

  if (!user) {
    return null;
  }

  const pointsValue = (user && typeof user.balance === 'number') ? user.balance : 0;
  const usdEquivalent = pointsValue / exchangeRate;
  const recentChange = pointsHistory.length > 0 ? pointsHistory[0].change : 0;

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Coins className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-semibold">
                    {pointsValue.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-500">积分</span>
                  {pointsValue === 0 && user.id === '9dee4891-89a6-44ee-8fe8-69097846e97d' && (
                    <AlertCircle className="h-4 w-4 text-amber-500" title="余额显示可能有延迟" />
                  )}
                </div>
                {showDetails && (
                  <div className="flex items-center space-x-1 text-sm text-gray-500">
                    <DollarSign className="h-3 w-3" />
                    <span>
                      {isLoadingRate ? '加载中...' : `≈ $${usdEquivalent.toFixed(4)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {showDetails && recentChange !== 0 && (
            <Badge 
              variant={recentChange > 0 ? "default" : "destructive"}
              className="flex items-center space-x-1"
            >
              {recentChange > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>
                {recentChange > 0 ? '+' : ''}{recentChange}
              </span>
            </Badge>
          )}
        </div>
        
        {showDetails && pointsHistory.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-gray-500 mb-2">最近使用记录</div>
            <div className="space-y-1">
              {pointsHistory.slice(0, 3).map((record, index) => (
                <div key={index} className="flex justify-between items-center text-xs">
                  <span className="text-gray-600">
                    {new Date(record.timestamp).toLocaleString()}
                  </span>
                  <span className={record.change > 0 ? 'text-green-600' : 'text-red-600'}>
                    {record.change > 0 ? '+' : ''}{record.change}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}