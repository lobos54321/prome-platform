import React, { useState } from 'react';
import XiaohongshuAnalyticsDashboard from '@/components/XiaohongshuAnalyticsDashboard';

export default function AnalyticsPage() {
    const currentUser = localStorage.getItem('currentUser') || 'user_9dee489189a644ee8fe869097846e97d_prome';

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">📊 数据分析</h1>
                    <p className="text-gray-600 mt-2">查看小红书笔记表现和 AI 分析建议</p>
                </div>

                <XiaohongshuAnalyticsDashboard
                    userId={currentUser}
                    onAnalysisComplete={(analysis) => {
                        console.log('AI Analysis completed:', analysis);
                    }}
                />
            </div>
        </div>
    );
}
