import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { StatusCard } from './StatusCard';
import { StrategyCard } from './StrategyCard';
import { WeeklyPlanCard } from './WeeklyPlanCard';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';
import { xiaohongshuSupabase } from '@/lib/xiaohongshu-supabase';
import type { AutomationStatus, ContentStrategy, WeeklyPlan } from '@/types/xiaohongshu';

interface DashboardSectionProps {
  supabaseUuid: string;
  xhsUserId: string;
  automationStatus: AutomationStatus | null;
  contentStrategy: ContentStrategy | null;
  weeklyPlan: WeeklyPlan | null;
  onRefresh: () => void;
}

export function DashboardSection({
  supabaseUuid,
  xhsUserId,
  automationStatus: initialStatus,
  contentStrategy: initialStrategy,
  weeklyPlan: initialPlan,
  onRefresh,
}: DashboardSectionProps) {
  const [status, setStatus] = useState<AutomationStatus | null>(initialStatus);
  const [strategy, setStrategy] = useState<ContentStrategy | null>(initialStrategy);
  const [plan, setPlan] = useState<WeeklyPlan | null>(initialPlan);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, strategyRes, planRes] = await Promise.all([
        xiaohongshuAPI.getAutomationStatus(xhsUserId),
        xiaohongshuAPI.getContentStrategy(xhsUserId),
        xiaohongshuAPI.getWeeklyPlan(xhsUserId),
      ]);

      if (statusRes.data) {
        setStatus(statusRes.data);
        await xiaohongshuSupabase.saveAutomationStatus({
          supabase_uuid: supabaseUuid,
          xhs_user_id: xhsUserId,
          ...statusRes.data,
        });
      }

      if (strategyRes.data) {
        setStrategy(strategyRes.data);
        await xiaohongshuSupabase.saveContentStrategy({
          supabase_uuid: supabaseUuid,
          xhs_user_id: xhsUserId,
          ...strategyRes.data,
        });
      }

      if (planRes.data) {
        setPlan(planRes.data);
        await xiaohongshuSupabase.saveWeeklyPlan({
          supabase_uuid: supabaseUuid,
          xhs_user_id: xhsUserId,
          ...planRes.data,
        });
      }
    } catch (error) {
      console.error('Fetch data error:', error);
    }
  }, [supabaseUuid, xhsUserId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    onRefresh();
    setRefreshing(false);
  };

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && autoRefresh) {
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [autoRefresh, fetchData]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              📊 运营仪表盘
            </CardTitle>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                自动刷新
              </label>
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <StatusCard status={status} />
            <div className="md:col-span-2 lg:col-span-2 space-y-6">
              <StrategyCard strategy={strategy} />
              <WeeklyPlanCard weeklyPlan={plan} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
