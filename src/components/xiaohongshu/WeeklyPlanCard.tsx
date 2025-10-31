import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WeeklyPlan } from '@/types/xiaohongshu';
import { Calendar, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface WeeklyPlanCardProps {
  weeklyPlan: WeeklyPlan | null;
  className?: string;
}

const WEEKDAYS = [
  { key: 'monday', label: '周一' },
  { key: 'tuesday', label: '周二' },
  { key: 'wednesday', label: '周三' },
  { key: 'thursday', label: '周四' },
  { key: 'friday', label: '周五' },
  { key: 'saturday', label: '周六' },
  { key: 'sunday', label: '周日' },
] as const;

const STATUS_CONFIG = {
  planned: { icon: Clock, text: '计划中', color: 'text-gray-600 bg-gray-100' },
  generating: { icon: Loader2, text: '生成中', color: 'text-blue-600 bg-blue-100' },
  pending: { icon: Clock, text: '待发布', color: 'text-orange-600 bg-orange-100' },
  published: { icon: CheckCircle2, text: '已发布', color: 'text-green-600 bg-green-100' },
  failed: { icon: AlertCircle, text: '失败', color: 'text-red-600 bg-red-100' },
};

export function WeeklyPlanCard({ weeklyPlan, className = '' }: WeeklyPlanCardProps) {
  if (!weeklyPlan) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            本周计划
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">暂无计划数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-purple-600" />
          本周计划
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          {new Date(weeklyPlan.week_start_date).toLocaleDateString('zh-CN')} - {new Date(weeklyPlan.week_end_date).toLocaleDateString('zh-CN')}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {WEEKDAYS.map(({ key, label }) => {
            const dayPlan = weeklyPlan.plan_data[key];
            
            if (!dayPlan) {
              return (
                <div key={key} className="flex items-center gap-3 py-2 opacity-50">
                  <div className="w-12 text-sm font-medium text-gray-500">{label}</div>
                  <div className="flex-1 text-sm text-gray-400">休息</div>
                </div>
              );
            }

            const statusConfig = STATUS_CONFIG[dayPlan.status];
            const StatusIcon = statusConfig.icon;

            return (
              <div key={key} className="flex items-start gap-3 py-2 border-b last:border-0">
                <div className="w-12 text-sm font-medium text-gray-700 pt-1">{label}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{dayPlan.title || dayPlan.theme}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${statusConfig.color}`}>
                      <StatusIcon className={`h-3 w-3 ${dayPlan.status === 'generating' ? 'animate-spin' : ''}`} />
                      {statusConfig.text}
                    </span>
                  </div>
                  {dayPlan.content && (
                    <p className="text-xs text-gray-600 line-clamp-2">{dayPlan.content}</p>
                  )}
                  {dayPlan.scheduled_time && (
                    <p className="text-xs text-gray-500">
                      ⏰ {new Date(dayPlan.scheduled_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
