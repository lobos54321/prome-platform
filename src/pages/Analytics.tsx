import React, { useEffect, useState } from 'react';
import XiaohongshuAnalyticsDashboard from '@/components/XiaohongshuAnalyticsDashboard';
import { supabase } from '@/lib/supabase';

export default function AnalyticsPage() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get authenticated user from Supabase
        supabase.auth.getSession().then(({ data: { session } }) => {
            setCurrentUser(session?.user || null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setCurrentUser(session?.user || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-700">请先登录</h2>
                    <p className="text-gray-500 mt-2">需要登录后才能查看数据分析</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">📊 数据分析</h1>
                    <p className="text-gray-600 mt-2">查看小红书笔记表现和 AI 分析建议</p>
                </div>

                <XiaohongshuAnalyticsDashboard
                    userId={currentUser.id}
                    supabaseClient={supabase}
                    onAnalysisComplete={(analysis) => {
                        console.log('AI Analysis completed:', analysis);
                    }}
                />
            </div>
        </div>
    );
}
