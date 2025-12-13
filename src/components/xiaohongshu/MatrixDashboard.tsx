/**
 * 矩阵仪表盘 - 同时管理多个小红书账号
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AccountStatusCard } from './AccountStatusCard';
import {
    Play,
    Square,
    Plus,
    RefreshCw,
    BarChart3,
    Users,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface XhsAccount {
    id: string;
    xhs_session_hash: string;
    nickname?: string;
    red_id?: string;
    avatar_url?: string;
}

interface AccountBinding {
    id: string;
    supabase_uuid: string;
    xhs_account_id: string;
    alias?: string;
    is_default: boolean;
    account?: XhsAccount;
}

interface AccountStatus {
    accountId: string;
    isRunning: boolean;
    stats?: {
        totalViews?: number;
        totalLikes?: number;
        totalComments?: number;
        postsCount?: number;
    };
}

interface MatrixDashboardProps {
    supabaseUuid: string;
    backendUrl?: string;
    // 🔥 新增：用户配置（包含 productName 等）
    userProfile?: {
        product_name?: string;
        target_audience?: string;
        marketing_goal?: string;
        post_frequency?: string;
        brand_style?: string;
        review_mode?: string;
    } | null;
    onAddAccount: () => void;
    onConfigureAccount: (account: XhsAccount) => void;
    onViewDetails: (account: XhsAccount) => void;
}

export function MatrixDashboard({
    supabaseUuid,
    backendUrl = 'https://xiaohongshu-automation-ai.zeabur.app',
    userProfile,
    onAddAccount,
    onConfigureAccount,
    onViewDetails,
}: MatrixDashboardProps) {
    const { toast } = useToast();
    const [accounts, setAccounts] = useState<AccountBinding[]>([]);
    const [statuses, setStatuses] = useState<Map<string, AccountStatus>>(new Map());
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [batchLoading, setBatchLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 加载账号列表
    const loadAccounts = useCallback(async () => {
        try {
            setError(null);
            const response = await fetch(
                `${backendUrl}/agent/accounts/list?supabaseUuid=${supabaseUuid}`
            );
            const data = await response.json();

            if (data.success) {
                setAccounts(data.data.accounts);
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            console.error('Failed to load accounts:', err);
            setError('加载账号列表失败: ' + err.message);
        }
    }, [supabaseUuid, backendUrl]);

    // 加载所有账号状态
    const loadStatuses = useCallback(async () => {
        try {
            const response = await fetch(
                `${backendUrl}/agent/accounts/batch-status?supabaseUuid=${supabaseUuid}`
            );
            const data = await response.json();

            if (data.success) {
                const statusMap = new Map<string, AccountStatus>();
                data.data.statuses.forEach((status: AccountStatus) => {
                    statusMap.set(status.accountId, status);
                });
                setStatuses(statusMap);
            }
        } catch (err) {
            console.error('Failed to load statuses:', err);
        }
    }, [supabaseUuid, backendUrl]);

    // 初始化
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await loadAccounts();
            await loadStatuses();
            setLoading(false);
        };
        init();
    }, [loadAccounts, loadStatuses]);

    // 刷新
    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAccounts();
        await loadStatuses();
        setRefreshing(false);
        toast({ title: '已刷新' });
    };

    // 启动单个账号
    const handleStartAccount = async (accountId: string) => {
        // 🔥 检查是否有产品配置
        if (!userProfile?.product_name) {
            toast({
                title: '无法启动',
                description: '请先配置产品信息（productName）再启动自动运营',
                variant: 'destructive'
            });
            return;
        }

        setActionLoading(accountId);
        try {
            const response = await fetch(`${backendUrl}/agent/auto/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: accountId,
                    productName: userProfile.product_name,
                    targetAudience: userProfile.target_audience,
                    marketingGoal: userProfile.marketing_goal,
                    postFrequency: userProfile.post_frequency,
                    brandStyle: userProfile.brand_style,
                    reviewMode: userProfile.review_mode,
                }),
            });
            const data = await response.json();

            if (data.success) {
                toast({
                    title: '🚀 启动成功',
                    description: '正在后台生成内容策略（约2-5分钟）...'
                });

                // 🔥 立即刷新状态
                await loadStatuses();

                // 🔥 开始轮询等待生成完成
                pollForCompletion(accountId);
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            toast({ title: '启动失败', description: err.message, variant: 'destructive' });
        } finally {
            setActionLoading(null);
        }
    };

    // 🔥 轮询检查生成状态
    const pollForCompletion = async (accountId: string) => {
        const maxAttempts = 24; // 最多轮询2分钟（每5秒一次）
        let attempts = 0;

        const poll = async () => {
            try {
                const response = await fetch(`${backendUrl}/agent/auto/status/${accountId}`);
                const data = await response.json();

                if (data.success && data.data) {
                    const status = data.data.status || data.data.generationStatus;
                    console.log(`📊 [轮询] 账号 ${accountId} 状态:`, status);

                    // 如果生成完成或失败，停止轮询
                    if (status === 'completed' || status === 'idle' || status === 'failed') {
                        await loadStatuses();
                        if (status === 'completed' || status === 'idle') {
                            toast({
                                title: '✅ 策略生成完成',
                                description: '内容策略和周计划已就绪！'
                            });
                        } else {
                            toast({
                                title: '⚠️ 生成失败',
                                description: '请重试或检查配置',
                                variant: 'destructive'
                            });
                        }
                        return;
                    }

                    // 还在生成中，继续轮询
                    if (status === 'generating' && attempts < maxAttempts) {
                        attempts++;
                        setTimeout(poll, 5000);
                    }
                }
            } catch (err) {
                console.error('轮询状态失败:', err);
            }
        };

        // 延迟3秒后开始轮询（给后端一点时间）
        setTimeout(poll, 3000);
    };

    // 停止单个账号
    const handleStopAccount = async (accountId: string) => {
        setActionLoading(accountId);
        try {
            const response = await fetch(`${backendUrl}/agent/auto/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: accountId }),  // 🔥 后端期望 userId
            });
            const data = await response.json();

            if (data.success) {
                toast({ title: '已停止' });
                await loadStatuses();
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            toast({ title: '停止失败', description: err.message, variant: 'destructive' });
        } finally {
            setActionLoading(null);
        }
    };

    // 批量启动所有账号
    const handleBatchStart = async () => {
        if (!confirm(`确定要启动所有 ${accounts.length} 个账号吗？`)) return;

        setBatchLoading(true);
        try {
            const response = await fetch(`${backendUrl}/agent/accounts/batch-start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ supabaseUuid }),
            });
            const data = await response.json();

            if (data.success) {
                toast({
                    title: '批量启动成功',
                    description: `已启动 ${data.data.successCount} 个账号`
                });
                await loadStatuses();
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            toast({ title: '批量启动失败', description: err.message, variant: 'destructive' });
        } finally {
            setBatchLoading(false);
        }
    };

    // 批量停止所有账号
    const handleBatchStop = async () => {
        if (!confirm(`确定要停止所有运营中的账号吗？`)) return;

        setBatchLoading(true);
        try {
            const response = await fetch(`${backendUrl}/agent/accounts/batch-stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ supabaseUuid }),
            });
            const data = await response.json();

            if (data.success) {
                toast({
                    title: '批量停止成功',
                    description: `已停止 ${data.data.successCount} 个账号`
                });
                await loadStatuses();
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            toast({ title: '批量停止失败', description: err.message, variant: 'destructive' });
        } finally {
            setBatchLoading(false);
        }
    };

    // 设置默认账号
    const handleSetDefault = async (accountId: string) => {
        try {
            const response = await fetch(`${backendUrl}/agent/accounts/set-default`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ supabaseUuid, xhsAccountId: accountId }),
            });
            const data = await response.json();

            if (data.success) {
                toast({ title: '默认账号已设置' });
                await loadAccounts();
            }
        } catch (err: any) {
            toast({ title: '设置失败', description: err.message, variant: 'destructive' });
        }
    };

    // 统计数据
    const runningCount = Array.from(statuses.values()).filter(s => s.isRunning).length;
    const totalViews = Array.from(statuses.values()).reduce((sum, s) => sum + (s.stats?.totalViews || 0), 0);
    const totalLikes = Array.from(statuses.values()).reduce((sum, s) => sum + (s.stats?.totalLikes || 0), 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 错误提示 */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* 顶部统计 */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-purple-600" />
                            <CardTitle>账号矩阵</CardTitle>
                            <Badge variant="secondary">{accounts.length}/10</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={refreshing}
                            >
                                <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                                刷新
                            </Button>
                            <Button size="sm" onClick={onAddAccount}>
                                <Plus className="w-4 h-4 mr-1" />
                                添加账号
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
                            <div className="text-3xl font-bold text-purple-600">{accounts.length}</div>
                            <div className="text-sm text-gray-500">总账号</div>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                            <div className="text-3xl font-bold text-green-600">{runningCount}</div>
                            <div className="text-sm text-gray-500">运营中</div>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
                            <div className="text-3xl font-bold text-blue-600">{totalViews.toLocaleString()}</div>
                            <div className="text-sm text-gray-500">总阅读</div>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-red-50 to-pink-50 rounded-lg">
                            <div className="text-3xl font-bold text-red-500">{totalLikes.toLocaleString()}</div>
                            <div className="text-sm text-gray-500">总点赞</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 批量操作 */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">所有账号</h3>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleBatchStart}
                        disabled={batchLoading || accounts.length === 0}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                    >
                        {batchLoading ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4 mr-1" />
                        )}
                        全部启动
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleBatchStop}
                        disabled={batchLoading || runningCount === 0}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                        {batchLoading ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                            <Square className="w-4 h-4 mr-1" />
                        )}
                        全部停止
                    </Button>
                </div>
            </div>

            {/* 账号卡片网格 */}
            {accounts.length === 0 ? (
                <Card className="p-12 text-center">
                    <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">还没有绑定账号</h3>
                    <p className="text-gray-500 mb-4">添加您的小红书账号开始自动运营</p>
                    <Button onClick={onAddAccount}>
                        <Plus className="w-4 h-4 mr-1" />
                        添加第一个账号
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {accounts.map((binding) => {
                        const status = statuses.get(binding.xhs_account_id);
                        return (
                            <AccountStatusCard
                                key={binding.id}
                                account={binding.account!}
                                isRunning={status?.isRunning || false}
                                isDefault={binding.is_default}
                                stats={status?.stats}
                                isLoading={actionLoading === binding.xhs_account_id}
                                onStart={() => handleStartAccount(binding.xhs_account_id)}
                                onStop={() => handleStopAccount(binding.xhs_account_id)}
                                onConfigure={() => onConfigureAccount(binding.account!)}
                                onViewDetails={() => onViewDetails(binding.account!)}
                                onSetDefault={() => handleSetDefault(binding.xhs_account_id)}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default MatrixDashboard;
