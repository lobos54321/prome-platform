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
        // 只保存符合AutomationStatus类型的字段
        const statusToSave = {
          supabase_uuid: supabaseUuid,
          xhs_user_id: xhsUserId,
          is_running: statusRes.data.is_running || false,
          is_logged_in: statusRes.data.is_logged_in || false,
          has_config: statusRes.data.has_config || false,
          last_activity: statusRes.data.last_activity || null,
          uptime_seconds: statusRes.data.uptime_seconds || 0,
          next_scheduled_task: statusRes.data.next_scheduled_task || null,
        };
        await xiaohongshuSupabase.saveAutomationStatus(statusToSave).catch(err => {
          console.warn('Save status failed:', err);
        });
      }

      if (strategyRes.data) {
        setStrategy(strategyRes.data);
        const strategyToSave = {
          supabase_uuid: supabaseUuid,
          xhs_user_id: xhsUserId,
          key_themes: strategyRes.data.key_themes || [],
          trending_topics: strategyRes.data.trending_topics || [],
          hashtags: strategyRes.data.hashtags || [],
          optimal_times: strategyRes.data.optimal_times || [],
        };
        await xiaohongshuSupabase.saveContentStrategy(strategyToSave).catch(err => {
          console.warn('Save strategy failed:', err);
        });
      }

      if (planRes.data) {
        setPlan(planRes.data);
        const planToSave = {
          supabase_uuid: supabaseUuid,
          xhs_user_id: xhsUserId,
          week_start_date: planRes.data.week_start_date,
          week_end_date: planRes.data.week_end_date,
          plan_data: planRes.data.plan_data || {},
          tasks: planRes.data.tasks || [],
        };
        await xiaohongshuSupabase.saveWeeklyPlan(planToSave).catch(err => {
          console.warn('Save plan failed:', err);
        });
      }
    } catch (error) {
      console.error('Fetch data error:', error);
      // 404错误是正常的（用户还没启动运营）
      if (error instanceof Error && error.message.includes('404')) {
        console.log('User has not started auto operation yet');
      }
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

  const handlePause = async () => {
    if (!confirm('确定要暂停自动运营吗？您可以稍后恢复。')) {
      return;
    }

    try {
      const response = await xiaohongshuAPI.pauseAutoOperation(xhsUserId);
      if (response.success) {
        alert('✅ 自动运营已暂停！');
        await fetchData();
      } else {
        alert('暂停失败：' + (response.error || '未知错误'));
      }
    } catch (error: any) {
      console.error('暂停失败:', error);
      alert('暂停失败：' + error.message);
    }
  };

  const handleViewPending = () => {
    // 显示待发布队列详情
    if (readyQueue.length === 0) {
      alert('当前没有待发布的内容');
      return;
    }

    const content = readyQueue.map((item, i) => 
      `${i + 1}. ${item.title}\n   时间: ${item.scheduledTime}\n   状态: ${item.status}`
    ).join('\n\n');

    alert(`📝 待发布内容 (${readyQueue.length}条)\n\n${content}`);
  };

  const handleAdjustStrategy = async () => {
    const newStrategy = prompt('请输入新的内容策略关键词（用逗号分隔）：');
    if (!newStrategy) return;

    try {
      const keywords = newStrategy.split(',').map(k => k.trim());
      const response = await xiaohongshuAPI.updateStrategy(xhsUserId, {
        keywords,
        updateTime: new Date().toISOString(),
      });

      if (response.success) {
        alert('✅ 策略已更新！系统将根据新策略生成内容。');
        await fetchData();
      } else {
        alert('更新失败：' + (response.error || '未知错误'));
      }
    } catch (error: any) {
      console.error('更新策略失败:', error);
      alert('更新策略失败：' + error.message);
    }
  };

  const handleViewAnalytics = () => {
    if (!performanceData || performanceData.totalPosts === 0) {
      alert('暂无运营数据，等待首次发布后可查看统计信息。');
      return;
    }

    const stats = `
📊 运营数据统计

📝 总发布数: ${performanceData.totalPosts || 0}
👁️ 总浏览量: ${performanceData.totalViews || 0}
❤️ 总点赞数: ${performanceData.totalLikes || 0}
💬 总评论数: ${performanceData.totalComments || 0}
📈 平均互动率: ${((performanceData.avgEngagementRate || 0) * 100).toFixed(2)}%
    `.trim();

    alert(stats);
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

  const handleEditPost = async (postId: string) => {
    const newTitle = prompt('请输入新的标题（留空则不修改）：');
    const newContent = prompt('请输入新的文案（留空则不修改）：');

    if (!newTitle && !newContent) {
      alert('没有任何修改');
      return;
    }

    try {
      const updates: any = {};
      if (newTitle) updates.title = newTitle;
      if (newContent) updates.content = newContent;

      const response = await xiaohongshuAPI.editPost(xhsUserId, postId, updates);
      if (response.success) {
        alert('✅ 内容已修改！');
        await fetchData();
      } else {
        alert('修改失败：' + (response.error || '未知错误'));
      }
    } catch (error: any) {
      console.error('修改失败:', error);
      alert('修改失败：' + error.message);
    }
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
