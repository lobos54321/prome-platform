/**
 * TwitterLoginSection - Twitter/X 登录组件
 *
 * 支持两种登录方式：
 * 1. Chrome 扩展同步 Cookie（推荐）
 * 2. 用户名密码登录（备选）
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    CheckCircle2,
    XCircle,
    Loader2,
    RefreshCw,
    Chrome,
    User,
    Lock,
    AlertCircle,
} from 'lucide-react';
import { twitterClient } from '@/lib/twitter-worker';

interface TwitterLoginSectionProps {
    userId: string;
    supabaseUuid: string;
    onLoginStatusChange?: (isLoggedIn: boolean) => void;
}

export function TwitterLoginSection({
    userId,
    supabaseUuid,
    onLoginStatusChange,
}: TwitterLoginSectionProps) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastSynced, setLastSynced] = useState<string | null>(null);

    // 用户名密码登录状态
    const [showCredentials, setShowCredentials] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loggingIn, setLoggingIn] = useState(false);

    // 检查登录状态
    const checkLoginStatus = useCallback(async () => {
        try {
            setChecking(true);
            setError(null);

            const result = await twitterClient.checkWebLogin(userId);

            if (result.logged_in) {
                setIsLoggedIn(true);
                setLastSynced(result.last_synced || null);
                onLoginStatusChange?.(true);
            } else {
                setIsLoggedIn(false);
                onLoginStatusChange?.(false);
            }
        } catch (err) {
            console.error('Failed to check Twitter login:', err);
            setError('无法连接到 Twitter Worker 服务');
            setIsLoggedIn(false);
            onLoginStatusChange?.(false);
        } finally {
            setChecking(false);
        }
    }, [userId, onLoginStatusChange]);

    // 初始检查
    useEffect(() => {
        checkLoginStatus();
    }, [checkLoginStatus]);

    // 监听扩展消息
    useEffect(() => {
        const handleExtensionMessage = async (event: MessageEvent) => {
            if (event.data?.type === 'TWITTER_COOKIES_SYNC') {
                console.log('📩 Received Twitter cookies from extension');
                const { cookies, userAgent } = event.data;

                try {
                    const result = await twitterClient.syncCookies({
                        userId,
                        cookies,
                        userAgent,
                    });

                    if (result.status === 'success') {
                        setIsLoggedIn(true);
                        setLastSynced(new Date().toISOString());
                        onLoginStatusChange?.(true);
                    }
                } catch (err) {
                    console.error('Failed to sync Twitter cookies:', err);
                    setError('Cookie 同步失败');
                }
            }
        };

        window.addEventListener('message', handleExtensionMessage);
        return () => window.removeEventListener('message', handleExtensionMessage);
    }, [userId, onLoginStatusChange]);

    // 用户名密码登录
    const handleCredentialLogin = async () => {
        if (!username.trim() || !password.trim()) {
            setError('请输入用户名和密码');
            return;
        }

        try {
            setLoggingIn(true);
            setError(null);

            const result = await twitterClient.login({
                userId,
                username: username.trim(),
                password,
            });

            // 后端返回 task_id 表示异步任务已启动
            if (result.status === 'started' && result.task_id) {
                // 轮询任务状态
                const pollTaskStatus = async (retries = 60) => {
                    if (retries <= 0) {
                        setError('登录超时，请重试');
                        setLoggingIn(false);
                        return;
                    }

                    try {
                        const taskStatus = await twitterClient.checkLoginTaskStatus(result.task_id);

                        if (taskStatus.status === 'completed' && taskStatus.logged_in) {
                            setIsLoggedIn(true);
                            setShowCredentials(false);
                            setLoggingIn(false);
                            onLoginStatusChange?.(true);
                        } else if (taskStatus.status === 'failed') {
                            setError(taskStatus.error || '登录失败');
                            setLoggingIn(false);
                        } else if (taskStatus.status === 'pending' || taskStatus.status === 'processing') {
                            // 继续轮询
                            setTimeout(() => pollTaskStatus(retries - 1), 3000);
                        } else {
                            setTimeout(() => pollTaskStatus(retries - 1), 3000);
                        }
                    } catch (err) {
                        console.error('Failed to check task status:', err);
                        setTimeout(() => pollTaskStatus(retries - 1), 3000);
                    }
                };

                // 开始轮询（每3秒一次，最多3分钟）
                pollTaskStatus();
            } else if (result.status === 'success') {
                // 直接成功（如果后端改为同步模式）
                setIsLoggedIn(true);
                setShowCredentials(false);
                setLoggingIn(false);
                onLoginStatusChange?.(true);
            } else if (result.status === '2fa_required') {
                setError('需要两步验证，请使用 Chrome 扩展方式登录');
                setLoggingIn(false);
            } else {
                setError(result.msg || '登录失败');
                setLoggingIn(false);
            }
        } catch (err) {
            console.error('Twitter login failed:', err);
            setError('登录请求失败');
            setLoggingIn(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">𝕏</span>
                    Twitter/X 登录
                </CardTitle>
                <CardDescription>
                    连接您的 Twitter 账号以启用自动发布功能
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* 登录状态 */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                        {checking ? (
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        ) : isLoggedIn ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                            <p className="font-medium">
                                {checking ? '检查中...' : isLoggedIn ? '已登录' : '未登录'}
                            </p>
                            {lastSynced && (
                                <p className="text-xs text-gray-500">
                                    上次同步: {new Date(lastSynced).toLocaleString()}
                                </p>
                            )}
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={checkLoginStatus}
                        disabled={checking}
                    >
                        <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                {/* 错误提示 */}
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* 登录方式 */}
                {!isLoggedIn && !checking && (
                    <div className="space-y-4">
                        {/* Chrome 扩展方式 */}
                        <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Chrome className="h-5 w-5 text-blue-500" />
                                <span className="font-medium">Chrome 扩展登录</span>
                                <Badge variant="secondary">推荐</Badge>
                            </div>
                            <p className="text-sm text-gray-500 mb-3">
                                使用 Prome 扩展自动同步您的 Twitter 登录状态，安全便捷
                            </p>
                            <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1 mb-4">
                                <li>安装 Prome Chrome 扩展</li>
                                <li>在浏览器中登录 Twitter/X</li>
                                <li>扩展将自动同步登录状态</li>
                            </ol>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    // 向扩展发送同步请求
                                    window.postMessage({ type: 'PROME_REQUEST_TWITTER_COOKIES' }, '*');
                                }}
                            >
                                <Chrome className="h-4 w-4 mr-2" />
                                请求同步 Cookie
                            </Button>
                        </div>

                        {/* 用户名密码登录 */}
                        <div className="p-4 border rounded-lg">
                            <button
                                className="flex items-center gap-2 w-full text-left"
                                onClick={() => setShowCredentials(!showCredentials)}
                            >
                                <User className="h-5 w-5 text-gray-500" />
                                <span className="font-medium">用户名密码登录</span>
                                <Badge variant="outline" className="ml-auto">
                                    备选
                                </Badge>
                            </button>

                            {showCredentials && (
                                <div className="mt-4 space-y-4">
                                    <Alert>
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            如果您启用了两步验证，此方式可能无法使用，请使用扩展登录
                                        </AlertDescription>
                                    </Alert>

                                    <div className="space-y-2">
                                        <Label htmlFor="twitter-username">用户名/邮箱/手机号</Label>
                                        <Input
                                            id="twitter-username"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="@username 或 email@example.com"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="twitter-password">密码</Label>
                                        <div className="relative">
                                            <Input
                                                id="twitter-password"
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="••••••••"
                                            />
                                            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full"
                                        onClick={handleCredentialLogin}
                                        disabled={loggingIn}
                                    >
                                        {loggingIn ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                登录中...
                                            </>
                                        ) : (
                                            '登录'
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 已登录状态 */}
                {isLoggedIn && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-700">
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="font-medium">Twitter 账号已连接</span>
                        </div>
                        <p className="text-sm text-green-600 mt-2">
                            您可以使用自动发布功能了
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
