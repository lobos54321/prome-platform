import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, DollarSign, TrendingDown, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { authService } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { User } from '@/types';
import { useTranslation } from 'react-i18next';

interface PointsDisplayProps {
  className?: string;
  showDetails?: boolean;
}

export default function PointsDisplay({ className = '', showDetails = true }: PointsDisplayProps) {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(10000); // Default rate
  const [isLoadingRate, setIsLoadingRate] = useState(true);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [pointsHistory, setPointsHistory] = useState<{
    change: number;
    timestamp: string;
  }[]>([]);
  
  useEffect(() => {
    const currentUser = authService.getCurrentUserSync();
    
    // 🔧 验证用户ID格式，如果不是UUID则清除缓存
    if (currentUser && currentUser.id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(currentUser.id)) {
        // 防止无限循环：检查是否已经标记过
        const alreadyClearing = sessionStorage.getItem('clearing-invalid-user');
        if (alreadyClearing) {
          console.log('Already clearing invalid user, skipping...');
          return;
        }
        
        console.error('⚠️ Invalid user ID detected in PointsDisplay:', currentUser.id);
        console.log('Clearing invalid cache and forcing re-login...');
        
        // 标记正在清除
        sessionStorage.setItem('clearing-invalid-user', 'true');
        
        // 清除所有缓存
        localStorage.clear();
        
        // 强制登出
        authService.forceLogout();
        
        // 重定向到登录页（不使用 window.location.href，使用 replace）
        window.location.replace('/login');
        
        return; // 阻止继续执行
      }
    }
    
    setUser(currentUser);

    // Load exchange rate
    loadExchangeRate();

    // 🔧 从数据库刷新余额，确保显示最新数据
    if (currentUser && currentUser.id) {
      console.log('PointsDisplay initialized, refreshing balance from database...', {
        userId: currentUser.id,
        cachedBalance: currentUser.balance
      });
      
      // 立即刷新余额（不延迟，确保新打开页面时能立即显示正确余额）
      refreshBalanceFromDatabase();
    }

    // 监听认证状态变化
    const handleAuthChange = (event: CustomEvent) => {
      setUser(event.detail.user);
    };

    // 监听余额更新
    const handleBalanceUpdate = (event: CustomEvent) => {
      console.log('🔥 [PointsDisplay] Received balance-updated event:', {
        currentBalance: user?.balance,
        newBalance: event.detail.balance,
        eventDetail: event.detail,
        userId: user?.id,
        timestamp: new Date().toISOString()
      });
      
      if (user && event.detail.balance !== undefined && typeof event.detail.balance === 'number') {
        const oldBalance = user.balance || 0;
        const newBalance = event.detail.balance;
        
        // 🔧 避免重复更新相同余额
        if (oldBalance !== newBalance) {
          setUser(prev => prev ? { ...prev, balance: newBalance } : null);
          
          const changeAmount = newBalance - oldBalance;
          console.log('✅ [PointsDisplay] Balance updated:', {
            oldBalance,
            newBalance,
            difference: changeAmount,
            timestamp: new Date().toISOString()
          });
          
          // 🔧 添加使用记录到历史中
          if (changeAmount !== 0) {
            const newHistoryEntry = {
              change: changeAmount,
              timestamp: new Date().toISOString(),
              tokens: event.detail.usage?.total_tokens || event.detail.tokens || 0,
              cost: event.detail.usage?.total_price || event.detail.cost || '0'
            };
            
            console.log('📊 [PointsDisplay] Creating new history entry:', newHistoryEntry);
            
            // 🔧 确保新记录添加到历史顶部，并保持完整记录
            setPointsHistory(prev => {
              // 避免重复记录：检查最近记录是否相同
              const isDuplicate = prev.length > 0 && 
                prev[0].change === changeAmount && 
                Math.abs(new Date(prev[0].timestamp).getTime() - new Date(newHistoryEntry.timestamp).getTime()) < 5000; // 5秒内相同记录认为重复
              
              if (isDuplicate) {
                console.log('🚫 [PointsDisplay] Skipped duplicate history entry');
                return prev;
              }
              
              const updatedHistory = [newHistoryEntry, ...prev.slice(0, 19)]; // Keep last 20 entries
              console.log('📊 [PointsDisplay] Added history entry, total records:', updatedHistory.length);
              return updatedHistory;
            });
          }
          
          // 🔧 强制触发组件重新渲染
          setTimeout(() => {
            console.log('🔄 [PointsDisplay] Force re-render check:', {
              currentUserBalance: user?.balance,
              expectedBalance: newBalance
            });
          }, 100);
        } else {
          console.log('ℹ️ [PointsDisplay] Skipped duplicate balance update:', {
            currentBalance: oldBalance,
            sameAsNewBalance: newBalance
          });
        }
      } else {
        console.warn('⚠️ [PointsDisplay] Balance update ignored:', {
          hasUser: !!user,
          hasBalance: event.detail.balance !== undefined,
          balanceType: typeof event.detail.balance,
          balanceValue: event.detail.balance,
          userId: user?.id,
          eventDetail: event.detail
        });
      }
    };

    window.addEventListener('auth-state-changed', handleAuthChange as EventListener);
    window.addEventListener('balance-updated', handleBalanceUpdate as EventListener);
    
    // 🔧 修复：不再载入模拟数据，只使用真实的历史记录
    // loadPointsHistory(); // 已注释掉：使用真实数据而非模拟数据

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange as EventListener);
      window.removeEventListener('balance-updated', handleBalanceUpdate as EventListener);
    };
  }, [user?.id]); // Re-run when user ID changes

  const refreshBalanceFromDatabase = async () => {
    if (isRefreshingBalance) return;
    
    try {
      setIsRefreshingBalance(true);
      console.log('Refreshing balance from database...');
      
      const newBalance = await authService.refreshBalance();
      console.log('Balance refresh completed, new balance:', newBalance);
      
      // The balance update event will be triggered by authService.refreshBalance()
      // which will update the user state through the event listener
    } catch (error) {
      console.error('Failed to refresh balance from database:', error);
    } finally {
      setIsRefreshingBalance(false);
    }
  };

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
  
  // 🔧 调试：记录余额显示状态
  console.log('🔍 [PointsDisplay] Current render state:', {
    userExists: !!user,
    userId: user?.id,
    userBalance: user?.balance,
    displayedPoints: pointsValue,
    balanceType: typeof user?.balance,
    timestamp: new Date().toISOString()
  });
  const usdEquivalent = pointsValue / exchangeRate;
  const recentChange = pointsHistory.length > 0 ? pointsHistory[0].change : 0;

  // Check if this might be a stale cache issue
  const isPotentialCacheIssue = pointsValue === 0 && user.id === '9dee4891-89a6-44ee-8fe8-69097846e97d';

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
                  <span className="text-sm text-gray-500">{t('billing.points')}</span>
                  {isPotentialCacheIssue && (
                    <AlertCircle className="h-4 w-4 text-amber-500" title={t('dashboard.refresh_balance')} />
                  )}
                  {showDetails && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={refreshBalanceFromDatabase}
                      disabled={isRefreshingBalance}
                      title={t('dashboard.refresh_balance')}
                    >
                      <RefreshCw className={`h-3 w-3 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>
                {showDetails && (
                  <div className="flex items-center space-x-1 text-sm text-gray-500">
                    <DollarSign className="h-3 w-3" />
                    <span>
                      {isLoadingRate ? t('common.loading') : `≈ $${usdEquivalent.toFixed(4)}`}
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
            <div className="text-xs text-gray-500 mb-2">{t('token_dashboard.recent_usage_records')}</div>
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
        
        {isPotentialCacheIssue && showDetails && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              <div className="flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>{t('dashboard.refresh_balance')} - {t('common.loading')}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}