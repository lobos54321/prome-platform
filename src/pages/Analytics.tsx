import React, { useEffect, useState } from 'react';
import XiaohongshuAnalyticsDashboard from '@/components/XiaohongshuAnalyticsDashboard';
import { supabase } from '@/lib/supabase';

interface XhsAccount {
    id: string;
    xhs_account_id: string;
    alias?: string;
    is_default: boolean;
    account?: {
        id: string;
        nickname?: string;
        red_id?: string;
    };
}

export default function AnalyticsPage() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<XhsAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

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

    // 获取用户绑定的小红书账号
    useEffect(() => {
        if (!currentUser) return;

        const fetchAccounts = async () => {
            try {
                const BACKEND_URL = (import.meta as any).env?.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app';
                const response = await fetch(`${BACKEND_URL}/agent/accounts/list?supabaseUuid=${currentUser.id}`);
                const data = await response.json();

                if (data.success && data.data.accounts.length > 0) {
                    setAccounts(data.data.accounts);
                    // 默认选中第一个账号或默认账号
                    const defaultAccount = data.data.accounts.find((a: XhsAccount) => a.is_default);
                    setSelectedAccountId((defaultAccount || data.data.accounts[0]).xhs_account_id);
                } else {
                    // 没有绑定账号，使用 Supabase UUID 进行兼容（旧数据）
                    setSelectedAccountId(currentUser.id);
                }
            } catch (err) {
                console.error('Failed to fetch accounts:', err);
                // 降级：使用 Supabase UUID
                setSelectedAccountId(currentUser.id);
            }
        };

        fetchAccounts();
    }, [currentUser]);

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

    if (!selectedAccountId) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">📊 数据分析</h1>
                    <p className="text-gray-600 mt-2">查看小红书笔记表现和 AI 分析建议</p>

                    {/* 账号选择器 */}
                    {accounts.length > 1 && (
                        <div className="mt-4">
                            <label className="text-sm text-gray-600 mr-2">选择账号:</label>
                            <select
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                                className="px-3 py-1 border rounded-lg text-sm"
                            >
                                {accounts.map((acc) => (
                                    <option key={acc.xhs_account_id} value={acc.xhs_account_id}>
                                        {acc.alias || acc.account?.nickname || acc.account?.red_id || `账号 ${acc.xhs_account_id.substring(0, 8)}`}
                                        {acc.is_default ? ' (默认)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <XiaohongshuAnalyticsDashboard
                    userId={selectedAccountId}
                    supabaseClient={supabase}
                    onAnalysisComplete={(analysis) => {
                        console.log('AI Analysis completed:', analysis);
                    }}
                />
            </div>
        </div>
    );
}

