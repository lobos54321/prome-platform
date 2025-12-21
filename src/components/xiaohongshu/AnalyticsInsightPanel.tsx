'use client';

import React, { useState, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Lightbulb, Zap, RefreshCw, CheckCircle } from 'lucide-react';

interface ContentPerformanceSummary {
    totalPosts: number;
    avgViews: number;
    avgEngagementRate: number;
    topPerformingContent: string[];
    underperformingPatterns: string[];
}

interface StrategySuggestion {
    type: 'theme' | 'hashtag' | 'timing' | 'format';
    suggestion: string;
    reason: string;
    impact: 'high' | 'medium' | 'low';
    applied?: boolean;
}

interface AnalyticsInsightPanelProps {
    userId: string;
    backendUrl?: string;
    onApplySuggestion?: (suggestion: StrategySuggestion) => Promise<void>;
    className?: string;
}

export const AnalyticsInsightPanel: React.FC<AnalyticsInsightPanelProps> = ({
    userId,
    backendUrl = 'https://xiaohongshu-automation-ai.zeabur.app',
    onApplySuggestion,
    className = '',
}) => {
    const [loading, setLoading] = useState(false);
    const [performance, setPerformance] = useState<ContentPerformanceSummary | null>(null);
    const [suggestions, setSuggestions] = useState<StrategySuggestion[]>([]);
    const [error, setError] = useState<string | null>(null);

    // 加载分析数据
    const loadAnalytics = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${backendUrl}/api/analytics/insights/${userId}`);
            const data = await response.json();

            if (data.success) {
                setPerformance(data.performance);
                setSuggestions(data.suggestions || []);
            } else {
                // Demo 数据
                setPerformance({
                    totalPosts: 15,
                    avgViews: 2340,
                    avgEngagementRate: 4.2,
                    topPerformingContent: ['产品使用教程', '真实测评'],
                    underperformingPatterns: ['纯文字长图', '深夜发布'],
                });
                setSuggestions([
                    {
                        type: 'theme',
                        suggestion: '增加"使用场景"类内容',
                        reason: '此类内容平均互动率高出 35%',
                        impact: 'high',
                    },
                    {
                        type: 'timing',
                        suggestion: '将发布时间调整到 18:00-20:00',
                        reason: '这个时段曝光率最高',
                        impact: 'medium',
                    },
                    {
                        type: 'hashtag',
                        suggestion: '添加 #好物推荐 标签',
                        reason: '该标签近期热度上升 50%',
                        impact: 'medium',
                    },
                ]);
            }
        } catch (err) {
            console.error('加载分析失败:', err);
            setError('加载分析数据失败');
        } finally {
            setLoading(false);
        }
    }, [userId, backendUrl]);

    // 应用建议
    const handleApplySuggestion = async (suggestion: StrategySuggestion, index: number) => {
        if (onApplySuggestion) {
            try {
                await onApplySuggestion(suggestion);
                setSuggestions(prev => prev.map((s, i) =>
                    i === index ? { ...s, applied: true } : s
                ));
            } catch (err) {
                console.error('应用建议失败:', err);
            }
        }
    };

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'high': return 'bg-rose-100 text-rose-700';
            case 'medium': return 'bg-amber-100 text-amber-700';
            case 'low': return 'bg-slate-100 text-slate-600';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const getSuggestionIcon = (type: string) => {
        switch (type) {
            case 'theme': return <TrendingUp size={14} />;
            case 'hashtag': return <span className="text-xs">#</span>;
            case 'timing': return <span className="text-xs">⏰</span>;
            case 'format': return <span className="text-xs">📝</span>;
            default: return <Lightbulb size={14} />;
        }
    };

    return (
        <div className={`bg-white rounded-xl border border-slate-200 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-100 text-purple-600">
                        <BarChart3 size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">数据洞察</h3>
                </div>
                <button
                    onClick={loadAnalytics}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    {loading ? '分析中...' : '刷新分析'}
                </button>
            </div>

            {/* Content */}
            <div className="p-4">
                {error && (
                    <div className="text-center py-4 text-rose-500 text-sm">{error}</div>
                )}

                {!performance && !loading && !error && (
                    <div className="text-center py-8">
                        <BarChart3 size={40} className="mx-auto text-slate-200 mb-3" />
                        <p className="text-sm text-slate-400 mb-3">点击"刷新分析"获取内容表现洞察</p>
                        <button
                            onClick={loadAnalytics}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition"
                        >
                            开始分析
                        </button>
                    </div>
                )}

                {performance && (
                    <>
                        {/* 数据概览 */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-slate-50 rounded-lg p-3 text-center">
                                <div className="text-lg font-bold text-slate-800">{performance.totalPosts}</div>
                                <div className="text-xs text-slate-400">总发布</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 text-center">
                                <div className="text-lg font-bold text-blue-600">{performance.avgViews.toLocaleString()}</div>
                                <div className="text-xs text-slate-400">平均浏览</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 text-center">
                                <div className="text-lg font-bold text-emerald-600">{performance.avgEngagementRate}%</div>
                                <div className="text-xs text-slate-400">互动率</div>
                            </div>
                        </div>

                        {/* 表现分析 */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-emerald-50 rounded-lg p-3">
                                <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium mb-2">
                                    <TrendingUp size={12} /> 高表现内容
                                </div>
                                <ul className="space-y-1">
                                    {performance.topPerformingContent.map((item, i) => (
                                        <li key={i} className="text-xs text-slate-600">• {item}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-rose-50 rounded-lg p-3">
                                <div className="flex items-center gap-1 text-rose-600 text-xs font-medium mb-2">
                                    <TrendingDown size={12} /> 待优化
                                </div>
                                <ul className="space-y-1">
                                    {performance.underperformingPatterns.map((item, i) => (
                                        <li key={i} className="text-xs text-slate-600">• {item}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* AI 建议 */}
                        {suggestions.length > 0 && (
                            <div>
                                <div className="flex items-center gap-1 text-purple-600 text-xs font-medium mb-2">
                                    <Zap size={12} /> AI 优化建议
                                </div>
                                <div className="space-y-2">
                                    {suggestions.map((suggestion, i) => (
                                        <div
                                            key={i}
                                            className={`flex items-start gap-3 p-3 rounded-lg border ${suggestion.applied
                                                    ? 'bg-emerald-50 border-emerald-200'
                                                    : 'bg-white border-slate-100'
                                                }`}
                                        >
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                                {getSuggestionIcon(suggestion.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-medium text-slate-800">
                                                        {suggestion.suggestion}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getImpactColor(suggestion.impact)}`}>
                                                        {suggestion.impact === 'high' ? '高影响' : suggestion.impact === 'medium' ? '中影响' : '低影响'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400">{suggestion.reason}</p>
                                            </div>
                                            {suggestion.applied ? (
                                                <div className="flex items-center gap-1 text-emerald-600 text-xs">
                                                    <CheckCircle size={14} /> 已应用
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleApplySuggestion(suggestion, i)}
                                                    className="px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded transition"
                                                >
                                                    应用
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default AnalyticsInsightPanel;
