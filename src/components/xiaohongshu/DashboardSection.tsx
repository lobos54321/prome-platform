import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Settings, LogOut, Pause, FileText, Target, TrendingUp } from 'lucide-react';
import { StatusCard } from './StatusCard';
import { StrategyCard } from './StrategyCard';
import { WeeklyPlanCard } from './WeeklyPlanCard';
import { ContentPreviewCard } from './ContentPreviewCard';
import { ReadyQueueCard } from './ReadyQueueCard';
import { PerformanceCard } from './PerformanceCard';
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
  onReconfigure?: () => void;
  onLogout?: () => void;
}

export function DashboardSection({
  supabaseUuid,
  xhsUserId,
  automationStatus: initialStatus,
  contentStrategy: initialStrategy,
  weeklyPlan: initialPlan,
  onRefresh,
  onReconfigure,
  onLogout,
}: DashboardSectionProps) {
  const [status, setStatus] = useState<AutomationStatus | null>(initialStatus);
  const [strategy, setStrategy] = useState<ContentStrategy | null>(initialStrategy);
  const [plan, setPlan] = useState<WeeklyPlan | null>(initialPlan);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // 新增状态
  const [nextContent, setNextContent] = useState<any>(null);
  const [readyQueue, setReadyQueue] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any>(null);

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
          ...strategyRes.data,
        });
      }

      if (planRes.data) {
        setPlan(planRes.data);
        await xiaohongshuSupabase.saveWeeklyPlan({
          supabase_uuid: supabaseUuid,
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
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 30000);

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

  // 处理下一篇内容预览和待发布队列
  useEffect(() => {
    if (plan && plan.tasks && plan.tasks.length > 0) {
      const upcoming = plan.tasks.find((t: any) => t.status === 'pending' || t.status === 'ready');
      setNextContent(upcoming || plan.tasks[0]);
      
      const ready = plan.tasks.filter((t: any) => t.status === 'ready' || t.status === 'pending');
      setReadyQueue(ready.map((t: any, i: number) => ({
        id: t.id || i.toString(),
        title: t.title,
        scheduledTime: t.scheduled_time || t.scheduledTime,
        status: t.status
      })));
    }
  }, [plan]);

  const handlePause = () => {
    alert('暂停功能开发中...');
  };

  const handleViewPending = () => {
    alert('待发内容功能开发中...');
  };

  const handleAdjustStrategy = () => {
    alert('调整策略功能开发中...');
  };

  const handleViewAnalytics = () => {
    alert('数据分析功能开发中...');
  };

  const handleApprovePost = async (postId: string) => {
    if (!confirm('确认批准发布此内容？')) {
      return;
    }

    try {
      // 调用批准发布API
      const response = await xiaohongshuAPI.approvePost(xhsUserId, postId);
      if (response.success) {
        alert('✅ 内容已批准发布！');
        await fetchData(); // 刷新数据
      } else {
        alert('批准失败：' + (response.error || '未知错误'));
      }
    } catch (error: any) {
      console.error('批准发布失败:', error);
      alert('批准失败：' + error.message);
    }
  };

  const handleEditPost = (postId: string) => {
    alert('修改功能开发中...\n\n将在未来版本中支持：\n- 修改标题和文案\n- 调整发布时间\n- 更换图片');
  };

  const handleRegeneratePost = async (postId: string) => {
    if (!confirm('确认重新生成此内容？当前内容将被替换。')) {
      return;
    }

    try {
      alert('🔄 正在重新生成内容...\n\n这可能需要1-2分钟，请稍候。');
      // 调用重新生成API
      const response = await xiaohongshuAPI.regeneratePost(xhsUserId, postId);
      if (response.success) {
        alert('✅ 内容已重新生成！');
        await fetchData(); // 刷新数据
      } else {
        alert('重新生成失败：' + (response.error || '未知错误'));
      }
    } catch (error: any) {
      console.error('重新生成失败:', error);
      alert('重新生成失败：' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作按钮栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            🤖 自动运营进行中
          </h2>
          <p className="text-sm text-gray-600 mt-1">系统正在为您自动管理小红书内容</p>
        </div>
        <div className="flex items-center gap-2">
          {onReconfigure && (
            <Button
              onClick={onReconfigure}
              variant="outline"
              size="sm"
            >
              <Settings className="h-4 w-4 mr-2" />
              重新配置
            </Button>
          )}
          {onLogout && (
            <Button
              onClick={onLogout}
              variant="destructive"
              size="sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              退出登录
            </Button>
          )}
        </div>
      </div>

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
          {/* 主要数据卡片网格 */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
            <StatusCard status={status} />
            <StrategyCard strategy={strategy} />
            <WeeklyPlanCard weeklyPlan={plan} />
          </div>

          {/* 次要数据卡片网格 */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <ContentPreviewCard 
              content={nextContent}
              onApprove={handleApprovePost}
              onEdit={handleEditPost}
              onRegenerate={handleRegeneratePost}
            />
            <ReadyQueueCard queue={readyQueue} />
            <PerformanceCard data={performanceData} />
          </div>
        </CardContent>
      </Card>

      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">⚙️ 控制面板</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <Button
              onClick={handlePause}
              variant="secondary"
              className="w-full"
            >
              <Pause className="h-4 w-4 mr-2" />
              暂停
            </Button>
            <Button
              onClick={handleViewPending}
              variant="secondary"
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              待发内容
            </Button>
            <Button
              onClick={handleAdjustStrategy}
              variant="secondary"
              className="w-full"
            >
              <Target className="h-4 w-4 mr-2" />
              调整策略
            </Button>
            <Button
              onClick={handleViewAnalytics}
              variant="secondary"
              className="w-full"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              数据分析
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
