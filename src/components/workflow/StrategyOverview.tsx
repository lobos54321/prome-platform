'use client';

import React from 'react';
import { Target, Calendar, TrendingUp, Hash, Clock } from 'lucide-react';

interface StrategyOverviewProps {
    productName?: string;
    marketingGoal?: 'brand' | 'sales' | 'traffic' | 'community';
    postFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    brandStyle?: string;
    keyThemes?: string[];
    hashtags?: string[];
}

const GOAL_LABELS: Record<string, string> = {
    brand: '品牌曝光',
    sales: '销售转化',
    traffic: '引流获客',
    community: '社群运营',
};

const FREQUENCY_LABELS: Record<string, string> = {
    daily: '每日发布',
    weekly: '每周发布',
    biweekly: '双周发布',
    monthly: '每月发布',
};

export const StrategyOverview: React.FC<StrategyOverviewProps> = ({
    productName = '未配置',
    marketingGoal = 'brand',
    postFrequency = 'daily',
    brandStyle,
    keyThemes = [],
    hashtags = [],
}) => {
    return (
        <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-2xl border border-slate-100 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    📋 运营策略
                </h3>
                <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">
                    {productName}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* 营销目标 */}
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-50">
                    <Target size={14} className="text-rose-500" />
                    <div>
                        <div className="text-[10px] text-slate-400">目标</div>
                        <div className="text-xs font-semibold text-slate-700">
                            {GOAL_LABELS[marketingGoal]}
                        </div>
                    </div>
                </div>

                {/* 发布频率 */}
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-50">
                    <Calendar size={14} className="text-blue-500" />
                    <div>
                        <div className="text-[10px] text-slate-400">频率</div>
                        <div className="text-xs font-semibold text-slate-700">
                            {FREQUENCY_LABELS[postFrequency]}
                        </div>
                    </div>
                </div>
            </div>

            {/* 关键主题 */}
            {keyThemes.length > 0 && (
                <div className="mt-3">
                    <div className="flex items-center gap-1 mb-1.5">
                        <TrendingUp size={12} className="text-amber-500" />
                        <span className="text-[10px] text-slate-400">内容主题</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {keyThemes.slice(0, 4).map((theme, i) => (
                            <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full"
                            >
                                {theme}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* 热门标签 */}
            {hashtags.length > 0 && (
                <div className="mt-3">
                    <div className="flex items-center gap-1 mb-1.5">
                        <Hash size={12} className="text-emerald-500" />
                        <span className="text-[10px] text-slate-400">推荐标签</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {hashtags.slice(0, 5).map((tag, i) => (
                            <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StrategyOverview;
