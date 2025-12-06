/**
 * 账号状态卡片 - 显示单个小红书账号的运营状态
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Play,
    Square,
    Settings,
    BarChart3,
    User,
    Eye,
    Heart,
    MessageCircle,
    Star,
    Loader2
} from 'lucide-react';

interface AccountStats {
    totalViews?: number;
    totalLikes?: number;
    totalComments?: number;
    postsCount?: number;
}

interface AccountStatusCardProps {
    account: {
        id: string;
        nickname?: string;
        red_id?: string;
        avatar_url?: string;
    };
    isRunning: boolean;
    isDefault?: boolean;
    stats?: AccountStats;
    isLoading?: boolean;
    onStart: () => void;
    onStop: () => void;
    onConfigure: () => void;
    onViewDetails: () => void;
    onSetDefault: () => void;
}

export function AccountStatusCard({
    account,
    isRunning,
    isDefault = false,
    stats,
    isLoading = false,
    onStart,
    onStop,
    onConfigure,
    onViewDetails,
    onSetDefault,
}: AccountStatusCardProps) {
    const displayName = account.nickname || account.red_id || `账号 ${account.id.substring(0, 8)}`;

    return (
        <Card className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${isRunning ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
            }`}>
            {/* 运行状态指示条 */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${isRunning ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gray-200'
                }`} />

            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* 头像 */}
                        {account.avatar_url ? (
                            <img
                                src={account.avatar_url}
                                alt=""
                                className="w-12 h-12 rounded-full border-2 border-white shadow-md"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-red-500 flex items-center justify-center shadow-md">
                                <User className="w-6 h-6 text-white" />
                            </div>
                        )}

                        <div>
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">{displayName}</CardTitle>
                                {isDefault && (
                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                )}
                            </div>
                            {account.red_id && (
                                <p className="text-sm text-gray-500">@{account.red_id}</p>
                            )}
                        </div>
                    </div>

                    {/* 状态徽章 */}
                    <Badge
                        variant={isRunning ? 'default' : 'secondary'}
                        className={isRunning ? 'bg-green-500 hover:bg-green-600' : ''}
                    >
                        {isRunning ? (
                            <>
                                <span className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                                运营中
                            </>
                        ) : '已停止'}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* 数据统计 */}
                {stats && (
                    <div className="grid grid-cols-4 gap-2 p-3 bg-gray-50 rounded-lg">
                        <div className="text-center">
                            <div className="flex items-center justify-center text-gray-400 mb-1">
                                <Eye className="w-4 h-4" />
                            </div>
                            <div className="text-lg font-semibold text-gray-700">
                                {stats.totalViews?.toLocaleString() || '-'}
                            </div>
                            <div className="text-xs text-gray-500">阅读</div>
                        </div>
                        <div className="text-center">
                            <div className="flex items-center justify-center text-red-400 mb-1">
                                <Heart className="w-4 h-4" />
                            </div>
                            <div className="text-lg font-semibold text-gray-700">
                                {stats.totalLikes?.toLocaleString() || '-'}
                            </div>
                            <div className="text-xs text-gray-500">点赞</div>
                        </div>
                        <div className="text-center">
                            <div className="flex items-center justify-center text-blue-400 mb-1">
                                <MessageCircle className="w-4 h-4" />
                            </div>
                            <div className="text-lg font-semibold text-gray-700">
                                {stats.totalComments?.toLocaleString() || '-'}
                            </div>
                            <div className="text-xs text-gray-500">评论</div>
                        </div>
                        <div className="text-center">
                            <div className="flex items-center justify-center text-purple-400 mb-1">
                                <BarChart3 className="w-4 h-4" />
                            </div>
                            <div className="text-lg font-semibold text-gray-700">
                                {stats.postsCount || '-'}
                            </div>
                            <div className="text-xs text-gray-500">笔记</div>
                        </div>
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex gap-2">
                    {isRunning ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={onStop}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                                <Square className="w-4 h-4 mr-1" />
                            )}
                            停止
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            className="flex-1 bg-green-500 hover:bg-green-600"
                            onClick={onStart}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                                <Play className="w-4 h-4 mr-1" />
                            )}
                            启动
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onConfigure}
                    >
                        <Settings className="w-4 h-4" />
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onViewDetails}
                    >
                        <BarChart3 className="w-4 h-4" />
                    </Button>

                    {!isDefault && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onSetDefault}
                            title="设为默认"
                        >
                            <Star className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default AccountStatusCard;
