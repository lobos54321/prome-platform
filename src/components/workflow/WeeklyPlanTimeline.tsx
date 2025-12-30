'use client';

import React from 'react';
import { Calendar, CheckCircle, Circle, Clock } from 'lucide-react';
import type { WeeklyPlan, DayPlan } from '@/types/xiaohongshu';

interface WeeklyPlanTimelineProps {
    weeklyPlan?: WeeklyPlan | null;
    compact?: boolean;
}

const DAY_NAMES: Record<string, string> = {
    monday: '周一',
    tuesday: '周二',
    wednesday: '周三',
    thursday: '周四',
    friday: '周五',
    saturday: '周六',
    sunday: '周日',
};

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const WeeklyPlanTimeline: React.FC<WeeklyPlanTimelineProps> = ({
    weeklyPlan,
    compact = false,
}) => {
    // 获取今天是周几
    const today = new Date().getDay();
    const todayIndex = today === 0 ? 6 : today - 1; // 0=周日 -> 6, 1=周一 -> 0

    if (!weeklyPlan?.plan_data) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                    <Calendar size={14} className="text-blue-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        📅 本周计划
                    </h3>
                </div>
                <div className="text-center py-4 text-slate-400 text-sm">
                    暂无本周计划
                </div>
            </div>
        );
    }

    const planData = weeklyPlan.plan_data;

    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-blue-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        📅 本周计划
                    </h3>
                </div>
                <span className="text-[10px] text-slate-400">
                    {weeklyPlan.week_start_date} ~ {weeklyPlan.week_end_date}
                </span>
            </div>

            <div className="relative">
                {/* 时间轴线 */}
                <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-slate-100"></div>

                <div className="space-y-2">
                    {DAY_ORDER.map((day, index) => {
                        const dayPlan = planData[day as keyof typeof planData] as DayPlan | undefined;
                        const isToday = index === todayIndex;
                        const isPast = index < todayIndex;
                        const hasContent = !!dayPlan?.theme;

                        return (
                            <div
                                key={day}
                                className={`relative flex items-start gap-3 pl-0 py-1.5 ${isToday ? 'bg-blue-50/50 -mx-2 px-2 rounded-xl' : ''
                                    }`}
                            >
                                {/* 节点 */}
                                <div className={`relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isPast && hasContent
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : isToday
                                        ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                                        : hasContent
                                            ? 'bg-slate-100 text-slate-400'
                                            : 'bg-slate-50 text-slate-300'
                                    }`}>
                                    {isPast && hasContent ? (
                                        <CheckCircle size={12} />
                                    ) : (
                                        <Circle size={10} fill={isToday ? 'currentColor' : 'none'} />
                                    )}
                                </div>

                                {/* 内容 */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold ${isToday ? 'text-blue-600' : 'text-slate-500'
                                            }`}>
                                            {DAY_NAMES[day]}
                                            {isToday && <span className="ml-1 text-[10px] font-normal">(今天)</span>}
                                        </span>
                                    </div>

                                    {hasContent ? (
                                        <div className="mt-0.5">
                                            <p className={`text-xs truncate ${isPast ? 'text-slate-400' : 'text-slate-600'
                                                }`}>
                                                {dayPlan!.theme}
                                            </p>
                                            {dayPlan!.scheduled_time && !compact && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <Clock size={10} className="text-slate-300" />
                                                    <span className="text-[10px] text-slate-400">
                                                        {(() => {
                                                            const timeStr = dayPlan!.scheduled_time;
                                                            // 如果是 HH:mm 格式，补全日期以便 parse
                                                            if (typeof timeStr === 'string' && timeStr.includes(':') && !timeStr.includes('-')) {
                                                                const [h, m] = timeStr.split(':');
                                                                return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
                                                            }
                                                            const d = new Date(timeStr);
                                                            return isNaN(d.getTime()) ? timeStr : d.toLocaleTimeString('zh-CN', {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                hour12: false
                                                            });
                                                        })()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-slate-300 mt-0.5">未安排</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default WeeklyPlanTimeline;
