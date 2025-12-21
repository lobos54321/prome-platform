'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { History, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Calendar, Target, ArrowRight, RefreshCw } from 'lucide-react';
import type { StrategyEvolution } from '@/types/sentiment';

interface StrategyHistoryCardProps {
    userId: string;
    backendUrl?: string;
    className?: string;
}

// Demo 数据
const DEMO_HISTORY: StrategyEvolution[] = [
    {
        id: 'cycle-3',
        cycleNumber: 3,
        startDate: '2024-12-15',
        endDate: '2024-12-21',
        contentAnalyzed: 8,
        totalViews: 25600,
        totalEngagement: 1840,
        topPerformingContent: ['产品使用教程', '真实用户反馈'],
        underperformingPatterns: ['纯产品图发布'],
        audienceFeedback: ['希望看到更多使用场景', '可以增加视频内容'],
        personaAdjustments: [],
        contentStrategyUpdates: [
            { metric: 'key_themes', oldValue: ['产品介绍'], newValue: ['产品介绍', '使用场景'], reason: '用户反馈显示对使用场景内容兴趣更高' },
        ],
        nextCycleGoals: ['增加视频内容占比', '优化发布时间'],
    },
    {
        id: 'cycle-2',
        cycleNumber: 2,
        startDate: '2024-12-08',
        endDate: '2024-12-14',
        contentAnalyzed: 6,
        totalViews: 18200,
        totalEngagement: 1120,
        topPerformingContent: ['开箱体验'],
        underperformingPatterns: ['长文字内容', '深夜发布'],
        audienceFeedback: ['图片质量很好', '希望有更多细节'],
        personaAdjustments: [],
        contentStrategyUpdates: [
            { metric: 'optimal_times', oldValue: ['22:00'], newValue: ['19:00', '20:00'], reason: '深夜发布互动率低于平均30%' },
        ],
        nextCycleGoals: ['提升发布频率', '增加教程类内容'],
    },
    {
        id: 'cycle-1',
        cycleNumber: 1,
        startDate: '2024-12-01',
        endDate: '2024-12-07',
        contentAnalyzed: 4,
        totalViews: 8500,
        totalEngagement: 420,
        topPerformingContent: ['首发开箱'],
        underperformingPatterns: ['标题不够吸引'],
        audienceFeedback: ['期待更多内容'],
        personaAdjustments: [],
        contentStrategyUpdates: [],
        nextCycleGoals: ['建立内容节奏', '收集用户反馈'],
    },
];

export const StrategyHistoryCard: React.FC<StrategyHistoryCardProps> = ({
    userId,
    backendUrl = 'https://xiaohongshu-automation-ai.zeabur.app',
    className = '',
}) => {
    const [history, setHistory] = useState<StrategyEvolution[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedCycle, setExpandedCycle] = useState<string | null>(null);

    // 加载历史数据
    const loadHistory = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${backendUrl}/api/strategy/history/${userId}`);
            const data = await response.json();

            if (data.success && data.history?.length > 0) {
                setHistory(data.history);
            } else {
                // 使用 Demo 数据
                setHistory(DEMO_HISTORY);
            }
        } catch (err) {
            console.error('加载历史失败:', err);
            setHistory(DEMO_HISTORY);
        } finally {
            setLoading(false);
        }
    }, [userId, backendUrl]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    // 计算环比变化
    const getChangePercent = (current: number, previous: number): { value: number; isPositive: boolean } => {
        if (previous === 0) return { value: 0, isPositive: true };
        const change = ((current - previous) / previous) * 100;
        return { value: Math.abs(change), isPositive: change >= 0 };
    };

    // 格式化日期
    const formatDateRange = (start: string, end: string) => {
        const s = new Date(start);
        const e = new Date(end);
        return `${s.getMonth() + 1}/${s.getDate()} - ${e.getMonth() + 1}/${e.getDate()}`;
    };

    return (
        <div className={`bg-white rounded-xl border border-slate-200 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600">
                        <History size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">策略演化历史</h3>
                </div>
                <button
                    onClick={loadHistory}
                    disabled={loading}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded transition"
                >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Content */}
            <div className="p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-8">
                        <History size={40} className="mx-auto text-slate-200 mb-3" />
                        <p className="text-sm text-slate-400">暂无策略演化记录</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((cycle, index) => {
                            const isExpanded = expandedCycle === cycle.id;
                            const prevCycle = history[index + 1];
                            const viewChange = prevCycle ? getChangePercent(cycle.totalViews, prevCycle.totalViews) : null;
                            const engagementChange = prevCycle ? getChangePercent(cycle.totalEngagement, prevCycle.totalEngagement) : null;

                            return (
                                <div
                                    key={cycle.id}
                                    className={`border rounded-lg transition-all ${isExpanded ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100'
                                        }`}
                                >
                                    {/* Cycle Header */}
                                    <button
                                        onClick={() => setExpandedCycle(isExpanded ? null : cycle.id)}
                                        className="w-full p-3 flex items-center justify-between text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${index === 0
                                                    ? 'bg-indigo-500 text-white'
                                                    : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {cycle.cycleNumber}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-slate-700">
                                                        第 {cycle.cycleNumber} 周期
                                                    </span>
                                                    {index === 0 && (
                                                        <span className="px-1.5 py-0.5 text-[10px] bg-indigo-100 text-indigo-600 rounded">
                                                            当前
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                                    <Calendar size={10} />
                                                    {formatDateRange(cycle.startDate, cycle.endDate)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {/* 数据指标 */}
                                            <div className="flex gap-3 text-xs">
                                                <div className="text-right">
                                                    <div className="text-slate-400">浏览</div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-medium">{(cycle.totalViews / 1000).toFixed(1)}k</span>
                                                        {viewChange && (
                                                            <span className={`flex items-center ${viewChange.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {viewChange.isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                                {viewChange.value.toFixed(0)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-slate-400">互动</div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-medium">{cycle.totalEngagement}</span>
                                                        {engagementChange && (
                                                            <span className={`flex items-center ${engagementChange.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {engagementChange.isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                                {engagementChange.value.toFixed(0)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                        </div>
                                    </button>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="px-3 pb-3 space-y-3">
                                            {/* 策略调整 */}
                                            {cycle.contentStrategyUpdates.length > 0 && (
                                                <div className="bg-white rounded-lg p-3 border border-slate-100">
                                                    <div className="text-xs font-medium text-slate-500 mb-2">📊 策略调整</div>
                                                    {cycle.contentStrategyUpdates.map((update, i) => (
                                                        <div key={i} className="flex items-center gap-2 text-xs mb-1.5">
                                                            <span className="text-slate-400">{update.metric}:</span>
                                                            <span className="text-rose-400 line-through">
                                                                {Array.isArray(update.oldValue) ? update.oldValue.join(', ') : String(update.oldValue)}
                                                            </span>
                                                            <ArrowRight size={10} className="text-slate-300" />
                                                            <span className="text-emerald-600 font-medium">
                                                                {Array.isArray(update.newValue) ? update.newValue.join(', ') : String(update.newValue)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    <p className="text-[10px] text-slate-400 mt-1 italic">
                                                        原因：{cycle.contentStrategyUpdates[0]?.reason}
                                                    </p>
                                                </div>
                                            )}

                                            {/* 表现分析 */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-emerald-50 rounded-lg p-2">
                                                    <div className="text-[10px] font-medium text-emerald-600 mb-1">✅ 高表现</div>
                                                    <ul className="text-xs text-slate-600 space-y-0.5">
                                                        {cycle.topPerformingContent.map((item, i) => (
                                                            <li key={i}>• {item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className="bg-amber-50 rounded-lg p-2">
                                                    <div className="text-[10px] font-medium text-amber-600 mb-1">⚠️ 待优化</div>
                                                    <ul className="text-xs text-slate-600 space-y-0.5">
                                                        {cycle.underperformingPatterns.map((item, i) => (
                                                            <li key={i}>• {item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            {/* 下周期目标 */}
                                            {cycle.nextCycleGoals.length > 0 && (
                                                <div className="flex items-center gap-2 text-xs">
                                                    <Target size={12} className="text-indigo-500" />
                                                    <span className="text-slate-400">下周期目标：</span>
                                                    {cycle.nextCycleGoals.map((goal, i) => (
                                                        <span key={i} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[10px]">
                                                            {goal}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StrategyHistoryCard;
