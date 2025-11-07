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
import { AccountBadge } from './AccountBadge';
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

  // 🔥 发布作业状态
  const [publishJob, setPublishJob] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      // ✅ 方案A：从后端API获取实时数据
      const [statusRes, strategyRes, planRes] = await Promise.all([
        xiaohongshuAPI.getAutomationStatus(xhsUserId).catch(() => ({ success: false, data: null })),
        xiaohongshuAPI.getContentStrategy(xhsUserId).catch(() => ({ success: false })),
        xiaohongshuAPI.getWeeklyPlan(xhsUserId).catch(() => ({ success: false })),
      ]);

      console.log('📊 [fetchData] Status:', statusRes.success ? '✅' : '❌');
      console.log('📊 [fetchData] Strategy:', strategyRes.success ? '✅' : '❌');
      console.log('📊 [fetchData] Plan:', planRes.success ? '✅' : '❌');

      // 处理 strategy（后端返回 {success, strategy}）
      let strategyData = null;
      if (strategyRes.success && (strategyRes as any).strategy) {
        strategyData = (strategyRes as any).strategy;
        setStrategy(strategyData);
        console.log('✅ 已更新 strategy');
      }

      // 处理 plan（后端返回 {success, plan}）
      let planData = null;
      if (planRes.success && (planRes as any).plan) {
        planData = (planRes as any).plan;
        setPlan(planData);
        console.log('✅ 已更新 plan');
      }

      // 处理 status（后端返回 {success, data}）
      if (statusRes.success && statusRes.data) {
        const now = new Date();
        const createdAt = statusRes.data.created_at ? new Date(statusRes.data.created_at) : now;
        const uptimeSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

        // 从 planData 获取下一个待发布任务
        let nextTask = null;
        if (planData?.tasks) {
          const pendingTasks = planData.tasks
            .filter((t: any) => t.status === 'pending' || t.status === 'in-progress')
            .sort((a: any, b: any) => {
              // 🔥 支持两种命名方式
              const timeA = new Date(a.scheduled_time || a.scheduledTime).getTime();
              const timeB = new Date(b.scheduled_time || b.scheduledTime).getTime();
              return timeA - timeB;
            });
          console.log('📋 [fetchData] 找到 pending/in-progress 任务:', pendingTasks.length);
          if (pendingTasks.length > 0) {
            // 🔥 支持两种命名方式
            nextTask = pendingTasks[0].scheduled_time || pendingTasks[0].scheduledTime;
            console.log('📅 [fetchData] 下一个任务时间:', nextTask);
            console.log('🔍 [DEBUG] 第一个任务完整数据:', pendingTasks[0]);
          }
        }

        // 🔥 FIX: 修复运行状态计算逻辑
        // 不能仅根据数据存在性判断，需要检查是否有活跃任务
        const hasActiveTasks = planData?.tasks?.some(
          (t: any) => t.status === 'in-progress' || t.status === 'pending'
        ) ?? false;
        
        // 如果后端明确返回了is_running，优先使用后端的状态
        // 否则根据是否有活跃任务判断
        const isRunning = statusRes.data?.is_running !== undefined 
          ? statusRes.data.is_running 
          : hasActiveTasks;
        
        console.log('🔄 [fetchData] is_running 计算结果:', isRunning);
        console.log('🔍 [fetchData] statusData:', {
          hasStatusData: !!statusRes.data,
          strategyData: !!strategyData,
          planData: !!planData,
          hasActiveTasks,
          backendIsRunning: statusRes.data?.is_running
        });

        const enrichedStatus = {
          ...statusRes.data,
          is_running: isRunning,
          uptime_seconds: uptimeSeconds,
          last_activity: statusRes.data.last_activity || statusRes.data.updated_at || new Date().toISOString(),
          next_scheduled_task: nextTask,
        };

        setStatus(enrichedStatus);
        console.log('✅ 已更新 status (含计算字段)');
      }
    } catch (error) {
      console.error('Fetch data error:', error);
    }
  }, [xhsUserId]);

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
      // 🔥 优先显示最近发布的内容（published状态）
      const recentPublished = plan.tasks.find((t: any) => t.status === 'published');

      // 如果有刚发布的内容，显示它；否则显示下一个待发布的
      const upcoming = plan.tasks.find((t: any) => t.status === 'pending' || t.status === 'in-progress');
      const nextContentData = recentPublished || upcoming || plan.tasks[0];

      console.log('🔍 [DEBUG] 下一篇内容数据:', nextContentData);
      console.log('🔍 [DEBUG] 内容ID:', nextContentData?.id);
      console.log('🔍 [DEBUG] 内容状态:', nextContentData?.status);
      setNextContent(nextContentData);

      // 🔥 待发布队列：查找in-progress（即原始ready/generating）和pending状态的任务
      const ready = plan.tasks.filter((t: any) => t.status === 'in-progress' || t.status === 'pending');
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
    console.log('🚀 [handleApprovePost] 开始批准发布 - postId:', postId);

    if (!postId) {
      alert('❌ 错误：内容ID为空，无法批准发布');
      console.error('❌ [handleApprovePost] postId 为空');
      return;
    }

    if (!confirm('确认批准发布此内容？')) {
      return;
    }

    try {
      console.log('📤 [handleApprovePost] 调用 API - userId:', xhsUserId, 'postId:', postId);
      // 调用批准发布API
      const response = await xiaohongshuAPI.approvePost(xhsUserId, postId);
      console.log('📥 [handleApprovePost] API 响应:', response);

      if (response.success && response.data) {
        const { jobId, status: jobStatus, message } = response.data;

        // 🔥 设置初始作业状态
        setPublishJob({
          jobId,
          status: jobStatus || 'pending',
          progress: 0,
        });

        console.log('✅ [handleApprovePost] 发布作业已创建:', jobId);
        alert(`✅ ${message || '发布作业已创建'}\n作业ID: ${jobId}`);

        // 🔥 启动轮询查询作业状态
        startJobPolling(jobId);
      } else {
        alert('批准失败：' + (response.error || '未知错误'));
      }
    } catch (error: any) {
      console.error('❌ [handleApprovePost] 批准发布失败:', error);
      alert('批准失败：' + error.message);
    }
  };

  // 🔥 轮询查询作业状态
  const startJobPolling = (jobId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 最多查询60次（5分钟）
    const pollInterval = 5000; // 每5秒查询一次

    const pollTimer = setInterval(async () => {
      attempts++;
      console.log(`📊 [JobPolling] 查询作业状态 (${attempts}/${maxAttempts}):`, jobId);

      try {
        const statusRes = await xiaohongshuAPI.getPublishJobStatus(jobId, xhsUserId);

        if (statusRes.success && statusRes.data) {
          const { status: jobStatus, progress, error, result } = statusRes.data;

          // 更新作业状态
          setPublishJob({
            jobId,
            status: jobStatus,
            progress: progress || 0,
            error: error,
          });

          console.log(`📊 [JobPolling] 作业状态: ${jobStatus}, 进度: ${progress}%`);

          // 🔥 如果作业完成或失败，停止轮询
          if (jobStatus === 'completed' || jobStatus === 'failed') {
            clearInterval(pollTimer);
            console.log(`✅ [JobPolling] 作业${jobStatus === 'completed' ? '完成' : '失败'}，停止轮询`);

            // 🔥 显示用户友好的通知
            if (jobStatus === 'completed') {
              const taskTitle = result?.title || '内容';
              alert(`🎉 发布成功！\n\n标题：${taskTitle}\n\n内容已成功发布到小红书，可以在平台查看。`);
            } else if (jobStatus === 'failed') {
              const errorMsg = error || '未知错误';
              alert(`❌ 发布失败\n\n错误信息：${errorMsg}\n\n请检查登录状态或重试。`);
            }

            // 刷新数据显示最新状态
            await fetchData();

            // 🔥 不自动清除状态，保持显示已发布状态
            // 用户可以通过刷新数据来更新显示
          }
        }
      } catch (error) {
        console.error('❌ [JobPolling] 查询作业状态失败:', error);
      }

      // 🔥 达到最大尝试次数，停止轮询
      if (attempts >= maxAttempts) {
        clearInterval(pollTimer);
        console.log('⚠️ [JobPolling] 达到最大查询次数，停止轮询');
        setPublishJob((prev: any) => ({
          ...prev,
          error: '查询超时，请手动刷新页面查看结果',
        }));
      }
    }, pollInterval);
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
          {(!status || !strategy || !plan) && (
            <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
              <span className="inline-block animate-spin">⏳</span>
              内容生成中，首次启动需要2-5分钟，系统每10秒自动刷新，最长等待16分钟...
            </p>
          )}
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
              publishJob={publishJob}
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
