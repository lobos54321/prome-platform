import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AutomationStatus } from '@/types/xiaohongshu';
import { Activity, Clock, Calendar } from 'lucide-react';

interface StatusCardProps {
  status: AutomationStatus | null;
  className?: string;
}

export function StatusCard({ status, className = '' }: StatusCardProps) {
  if (!status) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">运营状态</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">暂无数据</p>
        </CardContent>
      </Card>
    );
  }

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return '暂无';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          运营状态
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 运行状态 */}
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
          <span className="text-sm font-medium">当前状态</span>
          <div className="flex items-center gap-2">
            {status.is_running ? (
              <>
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
                <span className="text-sm font-bold text-green-600">运行中</span>
              </>
            ) : (
              <>
                <div className="h-3 w-3 rounded-full bg-gray-400"></div>
                <span className="text-sm font-medium text-gray-600">已停止</span>
              </>
            )}
          </div>
        </div>

        {/* 在线时长 */}
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm">在线时长</span>
          </div>
          <span className="text-sm font-medium">
            {formatUptime(status.uptime_seconds)}
          </span>
        </div>

        {/* 最后活动 */}
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-2 text-gray-600">
            <Activity className="h-4 w-4" />
            <span className="text-sm">最后活动</span>
          </div>
          <span className="text-sm font-medium">
            {formatDateTime(status.last_activity)}
          </span>
        </div>

        {/* 下次任务 */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">下次任务</span>
          </div>
          <span className="text-sm font-medium">
            {formatDateTime(status.next_scheduled_task)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
