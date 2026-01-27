/**
 * PlatformSelector - 多平台发布选择组件
 *
 * 在内容入库后显示，允许用户选择目标发布平台
 * 包含 Chrome 浏览器检测和插件安装引导流程
 */

import React, { useState, useEffect, useCallback } from 'react';
import { publishApi } from '../../lib/publishApi';
import { twitterClient } from '../../lib/twitter-worker';

// 插件下载地址
const EXTENSION_DOWNLOAD_URL = '/prome-extension.zip';

// 🔥 内联 X 登录表单组件
function XLoginForm({ userId, onLoginSuccess }: { userId: string; onLoginSuccess: () => void }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            setError('请输入用户名和密码');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            setStatusMessage('正在启动登录...');

            const result = await twitterClient.login({
                userId,
                username: username.trim(),
                password,
            });

            if (result.status === 'started' && result.task_id) {
                setStatusMessage('浏览器正在登录 Twitter，请稍候...');

                // 轮询任务状态
                const pollTaskStatus = async (retries = 60) => {
                    if (retries <= 0) {
                        setError('登录超时，请重试');
                        setLoading(false);
                        setStatusMessage(null);
                        return;
                    }

                    try {
                        const taskStatus = await twitterClient.checkLoginTaskStatus(result.task_id);

                        if (taskStatus.status === 'completed' && taskStatus.logged_in) {
                            setStatusMessage('登录成功！');
                            setLoading(false);
                            onLoginSuccess();
                        } else if (taskStatus.status === 'failed') {
                            setError(taskStatus.error || '登录失败');
                            setLoading(false);
                            setStatusMessage(null);
                        } else {
                            setTimeout(() => pollTaskStatus(retries - 1), 3000);
                        }
                    } catch (err) {
                        setTimeout(() => pollTaskStatus(retries - 1), 3000);
                    }
                };

                pollTaskStatus();
            } else if (result.status === 'success') {
                setStatusMessage('登录成功！');
                setLoading(false);
                onLoginSuccess();
            } else {
                setError(result.msg || '登录失败');
                setLoading(false);
                setStatusMessage(null);
            }
        } catch (err: any) {
            console.error('Twitter login failed:', err);
            setError(err.message || '登录请求失败');
            setLoading(false);
            setStatusMessage(null);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* 错误提示 */}
            {error && (
                <div style={{
                    padding: '0.75rem',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '0.375rem',
                    color: '#dc2626',
                    fontSize: '0.875rem'
                }}>
                    ❌ {error}
                </div>
            )}

            {/* 状态提示 */}
            {statusMessage && (
                <div style={{
                    padding: '0.75rem',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '0.375rem',
                    color: '#2563eb',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    {loading && <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>}
                    {statusMessage}
                </div>
            )}

            {/* 用户名输入 */}
            <div>
                <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.25rem',
                    color: '#374151'
                }}>
                    用户名 / 邮箱 / 手机号
                </label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="@username 或 email@example.com"
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                    }}
                />
            </div>

            {/* 密码输入 */}
            <div>
                <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.25rem',
                    color: '#374151'
                }}>
                    密码
                </label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                    }}
                />
            </div>

            {/* 登录按钮 */}
            <button
                onClick={handleLogin}
                disabled={loading}
                style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: loading ? '#9ca3af' : '#1d9bf0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                }}
            >
                {loading ? (
                    <>
                        <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                        登录中...
                    </>
                ) : (
                    <>𝕏 登录 Twitter</>
                )}
            </button>

            {/* 提示信息 */}
            <p style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                margin: 0,
                lineHeight: '1.5'
            }}>
                ⚠️ 如果您启用了两步验证(2FA)，此方式可能无法使用。
                <br />
                登录后，系统将通过浏览器自动化完成 Twitter 发布。
            </p>
        </div>
    );
}

// 海外平台配置
export interface Platform {
    id: string;
    name: string;
    icon: string;
    enabled: boolean;
    method: 'chrome_extension' | 'skyvern';
    status?: 'pending' | 'publishing' | 'completed' | 'failed';
    postUrl?: string;
}

export const PLATFORMS: Platform[] = [
    {
        id: 'xiaohongshu',
        name: '小红书',
        icon: '📕',
        enabled: true,
        method: 'chrome_extension'
    },
    {
        id: 'x',
        name: 'X (Twitter)',
        icon: '𝕏',
        enabled: true, // ✅ Twitter Worker 集成
        method: 'chrome_extension'
    },
    {
        id: 'tiktok',
        name: 'TikTok',
        icon: '🎵',
        enabled: true, // ✅ Skyvern 集成
        method: 'skyvern'
    },
    {
        id: 'instagram',
        name: 'Instagram',
        icon: '📷',
        enabled: true, // ✅ Skyvern 集成
        method: 'skyvern'
    },
    {
        id: 'youtube',
        name: 'YouTube Shorts',
        icon: '▶️',
        enabled: false, // 待实现
        method: 'skyvern'
    },
    {
        id: 'threads',
        name: 'Threads',
        icon: '📱',
        enabled: false, // 待实现
        method: 'skyvern'
    },
    {
        id: 'pinterest',
        name: 'Pinterest',
        icon: '📌',
        enabled: false, // 待实现
        method: 'skyvern'
    }
];

interface PlatformSelectorProps {
    content: {
        title: string;
        content: string;
        images?: string[];
        video?: string;
        tags?: string[];
    };
    onPublishComplete?: (platform: string, result: any) => void;
}

export function PlatformSelector({ content, onPublishComplete }: PlatformSelectorProps) {
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['xiaohongshu']);
    const [publishStatus, setPublishStatus] = useState<Record<string, Platform['status']>>({});
    const [isPublishing, setIsPublishing] = useState(false);

    // 🔥 Chrome 和插件检测状态
    const [isChrome, setIsChrome] = useState(false);
    const [hasExtension, setHasExtension] = useState(false);
    const [checkingExtension, setCheckingExtension] = useState(true);

    // 🔥 X/Twitter 登录状态
    const [xLoggedIn, setXLoggedIn] = useState(false);
    const [checkingXLogin, setCheckingXLogin] = useState(false);
    const [showXLogin, setShowXLogin] = useState(false);
    const userId = localStorage.getItem('userId') || 'anonymous';

    // 检查 X 登录状态
    const checkXLoginStatus = useCallback(async () => {
        try {
            setCheckingXLogin(true);
            const result = await twitterClient.checkWebLogin(userId);
            setXLoggedIn(result.logged_in);
        } catch (err) {
            console.error('Failed to check X login:', err);
            setXLoggedIn(false);
        } finally {
            setCheckingXLogin(false);
        }
    }, [userId]);

    // 初始检查 X 登录状态
    useEffect(() => {
        checkXLoginStatus();
    }, [checkXLoginStatus]);

    // 检测 Chrome 浏览器和插件
    useEffect(() => {
        // 检测是否是 Chrome
        const isChromeBrowser = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        setIsChrome(isChromeBrowser);

        // 检测插件是否安装（插件会在页面注入标记元素）
        const checkExtension = () => {
            const marker = document.getElementById('prome-extension-installed');
            setHasExtension(!!marker);
            setCheckingExtension(false);
        };

        // 初始检测
        setTimeout(checkExtension, 500);

        // 持续检测（用户可能安装后刷新）
        const interval = setInterval(checkExtension, 2000);
        return () => clearInterval(interval);
    }, []);

    // 下载插件
    const downloadExtension = () => {
        window.open(EXTENSION_DOWNLOAD_URL, '_blank');
    };

    const togglePlatform = (platformId: string) => {
        const platform = PLATFORMS.find(p => p.id === platformId);
        if (!platform?.enabled) return;

        setSelectedPlatforms(prev =>
            prev.includes(platformId)
                ? prev.filter(id => id !== platformId)
                : [...prev, platformId]
        );
    };

    // 🔥 小红书发布 - 直接与插件通信
    const publishToXiaohongshu = async () => {
        // 检查插件是否安装
        const extensionMarker = document.getElementById('prome-extension-installed');
        if (!extensionMarker) {
            alert('❌ 未检测到 Prome 助手插件！\n\n请确保已安装插件并刷新页面。\n\n如需安装，请在 Chrome 扩展商店搜索 "Prome 助手"。');
            return false;
        }

        if (!window.confirm('确认发布此内容到小红书？\n\n将通过浏览器插件自动发布。')) {
            return false;
        }

        setPublishStatus(prev => ({ ...prev, xiaohongshu: 'publishing' }));

        // 🔥 解析内容 - 如果是 JSON 字符串，提取其中的 text 字段
        let parsedTitle = content.title;
        let parsedContent = content.content || '';
        let parsedTags = content.tags || [];

        // 检查 content.content 是否是 JSON 字符串
        if (parsedContent.trim().startsWith('{') || parsedContent.trim().startsWith('```json')) {
            try {
                // 移除可能的 markdown 代码块
                let jsonStr = parsedContent
                    .replace(/^```json\s*/i, '')
                    .replace(/```\s*$/i, '')
                    .trim();

                const jsonData = JSON.parse(jsonStr);
                console.log('[PlatformSelector] Parsed JSON content:', jsonData);

                // 提取字段
                parsedTitle = jsonData.title || parsedTitle;
                parsedContent = jsonData.text || jsonData.content || parsedContent;

                // 提取 hashtags
                if (jsonData.hashtags && Array.isArray(jsonData.hashtags)) {
                    parsedTags = jsonData.hashtags;
                }
            } catch (e) {
                console.log('[PlatformSelector] Content is not valid JSON, using as-is');
            }
        }

        // 🔥 小红书字数限制：控制在 850 字以内（留一些余量给 hashtags）
        const XHS_MAX_CHARS = 850;
        if (parsedContent.length > XHS_MAX_CHARS) {
            console.log(`[PlatformSelector] Truncating content from ${parsedContent.length} to ${XHS_MAX_CHARS} chars`);
            parsedContent = parsedContent.substring(0, XHS_MAX_CHARS) + '...';
        }

        // 构建发布数据 - 🔥 字段名必须与 content.js executePublish 期望的一致
        const publishData = {
            taskId: Date.now().toString(),  // content.js 需要 taskId
            title: parsedTitle,
            content: parsedContent,
            images: content.images || [],   // content.js 期望 images 而非 imageUrls
            tags: parsedTags,               // content.js 期望 tags 而非 hashtags
            video: content.video || null,   // content.js 期望 video 而非 videoUrl
        };

        console.log('[PlatformSelector] Sending publish task to extension:', publishData);

        // 设置监听器等待插件响应
        const publishPromise = new Promise<{ success: boolean; message: string }>((resolve, reject) => {
            const timeout = setTimeout(() => {
                window.removeEventListener('message', handleResponse);
                reject(new Error('插件响应超时（5分钟），请确保插件已启用'));
            }, 300000);

            const handleResponse = (event: MessageEvent) => {
                if (event.source !== window) return;

                if (event.data.type === 'PROME_PUBLISH_ACKNOWLEDGED') {
                    console.log('[PlatformSelector] Extension acknowledged:', event.data);
                }

                if (event.data.type === 'PROME_PUBLISH_RESULT') {
                    console.log('[PlatformSelector] Received publish result:', event.data);
                    clearTimeout(timeout);
                    window.removeEventListener('message', handleResponse);
                    resolve(event.data);
                }
            };

            window.addEventListener('message', handleResponse);
        });

        // 发送发布任务到插件
        window.postMessage({
            type: 'PROME_PUBLISH_TASK',
            data: publishData
        }, '*');

        alert(
            `📝 发布任务已发送到插件！\n\n` +
            `插件将自动：\n` +
            `1. 打开小红书发布页面\n` +
            `2. 填写内容并发布\n\n` +
            `请保持浏览器窗口打开。`
        );

        try {
            const result = await publishPromise;
            if (result.success) {
                setPublishStatus(prev => ({ ...prev, xiaohongshu: 'completed' }));
                onPublishComplete?.('xiaohongshu', result);
                alert('✅ 发布成功！');
                return true;
            } else {
                setPublishStatus(prev => ({ ...prev, xiaohongshu: 'failed' }));
                alert(`❌ 发布失败：${result.message || '未知错误'}`);
                return false;
            }
        } catch (error: any) {
            console.error('[PlatformSelector] Publish error:', error);
            setPublishStatus(prev => ({ ...prev, xiaohongshu: 'failed' }));
            alert(`❌ 发布失败：${error.message}`);
            return false;
        }
    };

    // 🔥 X/Twitter 发布 - 通过 Twitter Worker 服务
    const publishToX = async () => {
        // 检查登录状态
        try {
            const loginStatus = await twitterClient.checkWebLogin(userId);
            if (!loginStatus.logged_in) {
                // 显示登录界面而不是仅弹出提示
                setShowXLogin(true);
                return false;
            }

            if (!window.confirm('确认发布此内容到 X/Twitter？')) {
                return false;
            }

            setPublishStatus(prev => ({ ...prev, x: 'publishing' }));

            // 解析内容
            let parsedContent = content.content || '';
            let parsedTags = content.tags || [];

            // 检查是否是 JSON 字符串
            if (parsedContent.trim().startsWith('{') || parsedContent.trim().startsWith('```json')) {
                try {
                    let jsonStr = parsedContent
                        .replace(/^```json\s*/i, '')
                        .replace(/```\s*$/i, '')
                        .trim();

                    const jsonData = JSON.parse(jsonStr);
                    parsedContent = jsonData.text || jsonData.content || parsedContent;
                    if (jsonData.hashtags && Array.isArray(jsonData.hashtags)) {
                        parsedTags = jsonData.hashtags;
                    }
                } catch (e) {
                    console.log('[PlatformSelector] Content is not valid JSON, using as-is');
                }
            }

            // Twitter 字数限制：280 字符
            const TWITTER_MAX_CHARS = 280;
            let tweetText = parsedContent;

            // 添加 hashtags
            if (parsedTags.length > 0) {
                const hashtagStr = parsedTags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ');
                if (tweetText.length + hashtagStr.length + 1 <= TWITTER_MAX_CHARS) {
                    tweetText = `${tweetText}\n${hashtagStr}`;
                }
            }

            // 截断到 280 字符
            if (tweetText.length > TWITTER_MAX_CHARS) {
                tweetText = tweetText.substring(0, TWITTER_MAX_CHARS - 3) + '...';
            }

            // 发布推文
            const result = await twitterClient.publish({
                userId,
                cookies: loginStatus.cookies || '',
                text: tweetText,
                mediaUrls: content.images,
            });

            if (result.status === 'started' || result.task_id) {
                // 轮询状态
                const taskId = result.task_id;
                const pollStatus = async (retries = 30) => {
                    if (retries <= 0) {
                        setPublishStatus(prev => ({ ...prev, x: 'failed' }));
                        return;
                    }
                    try {
                        const status = await twitterClient.getPublishStatus(taskId);
                        if (status.status === 'completed') {
                            setPublishStatus(prev => ({ ...prev, x: 'completed' }));
                            onPublishComplete?.('x', { taskId });
                            alert('✅ 推文发布成功！');
                        } else if (status.status === 'failed') {
                            setPublishStatus(prev => ({ ...prev, x: 'failed' }));
                            alert(`❌ 推文发布失败：${status.error || '未知错误'}`);
                        } else {
                            setTimeout(() => pollStatus(retries - 1), 3000);
                        }
                    } catch {
                        setTimeout(() => pollStatus(retries - 1), 3000);
                    }
                };

                alert('📝 推文正在发布中...\n\n请稍候，发布完成后会通知您。');
                pollStatus();
                return true;
            } else {
                throw new Error(result.msg || '发布失败');
            }
        } catch (error: any) {
            console.error('[PlatformSelector] X publish error:', error);
            setPublishStatus(prev => ({ ...prev, x: 'failed' }));
            alert(`❌ X 发布失败：${error.message}`);
            return false;
        }
    };

    const handlePublish = async () => {
        if (selectedPlatforms.length === 0) {
            alert('请至少选择一个发布平台');
            return;
        }

        setIsPublishing(true);

        for (const platformId of selectedPlatforms) {
            const platform = PLATFORMS.find(p => p.id === platformId);
            if (!platform) continue;

            if (platformId === 'xiaohongshu') {
                await publishToXiaohongshu();
            } else if (platformId === 'x') {
                await publishToX();
            } else {
                // Skyvern 发布
                try {
                    console.log(`[Skyvern] Publishing to ${platformId}`);
                    setPublishStatus(prev => ({ ...prev, [platformId]: 'publishing' }));
                    const result = await publishApi.publishViaSkyvern(platformId);
                    if (result.success) {
                        // 轮询状态
                        const checkStatus = async () => {
                            const status = await publishApi.checkSkyvernStatus(platformId);
                            if (status.status === 'completed') {
                                setPublishStatus(prev => ({ ...prev, [platformId]: 'completed' }));
                                onPublishComplete?.(platformId, { url: status.postUrl });
                            } else if (status.status === 'failed') {
                                setPublishStatus(prev => ({ ...prev, [platformId]: 'failed' }));
                            } else {
                                setTimeout(checkStatus, 5000);
                            }
                        };
                        setTimeout(checkStatus, 5000);
                    } else {
                        setPublishStatus(prev => ({ ...prev, [platformId]: 'failed' }));
                    }
                } catch (error) {
                    console.error(`[Skyvern] Failed to publish to ${platformId}:`, error);
                    setPublishStatus(prev => ({ ...prev, [platformId]: 'failed' }));
                }
            }
        }

        setIsPublishing(false);
    };

    const getStatusIcon = (status?: Platform['status']) => {
        switch (status) {
            case 'publishing': return '⏳';
            case 'completed': return '✅';
            case 'failed': return '❌';
            default: return '';
        }
    };

    return (
        <div style={{
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '0.5rem',
            border: '1px solid #e5e7eb'
        }}>
            <h4 style={{
                fontSize: '1rem',
                fontWeight: '600',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                🚀 发布到平台
            </h4>

            {/* 🔥 Chrome/插件安装引导 */}
            {checkingExtension ? (
                <div style={{
                    padding: '1rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '0.5rem',
                    textAlign: 'center',
                    marginBottom: '1rem'
                }}>
                    <span style={{ color: '#6b7280' }}>⏳ 正在检测插件...</span>
                </div>
            ) : !isChrome ? (
                /* 不是 Chrome 浏览器 - 显示下载 Chrome 提示 */
                <div style={{
                    padding: '1rem',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '0.5rem',
                    marginBottom: '1rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                        <div style={{ flex: 1 }}>
                            <h5 style={{ fontWeight: '600', color: '#991b1b', marginBottom: '0.5rem' }}>
                                请使用 Chrome 浏览器
                            </h5>
                            <p style={{ fontSize: '0.875rem', color: '#7f1d1d', marginBottom: '0.75rem' }}>
                                小红书发布功能需要使用 Chrome 浏览器配合 Prome 助手插件。
                            </p>
                            <button
                                onClick={() => window.open('https://www.google.com/chrome/', '_blank')}
                                style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#4285f4',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                🌐 下载 Chrome 浏览器
                            </button>
                        </div>
                    </div>
                </div>
            ) : !hasExtension ? (
                /* Chrome 浏览器但未安装插件 - 显示安装插件提示 */
                <div style={{
                    padding: '1rem',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fcd34d',
                    borderRadius: '0.5rem',
                    marginBottom: '1rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🔌</span>
                        <div style={{ flex: 1 }}>
                            <h5 style={{ fontWeight: '600', color: '#92400e', marginBottom: '0.5rem' }}>
                                安装 Prome 助手插件
                            </h5>
                            <p style={{ fontSize: '0.875rem', color: '#78350f', marginBottom: '0.75rem' }}>
                                点击下载插件，然后在 Chrome 扩展管理页面加载解压后的文件夹。
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button
                                    onClick={downloadExtension}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.375rem',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    📥 一键下载插件
                                </button>
                                <button
                                    onClick={() => window.open('chrome://extensions/', '_blank')}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: 'white',
                                        color: '#374151',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '0.375rem',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    ⚙️ 打开扩展管理
                                </button>
                            </div>
                            <div style={{
                                marginTop: '0.75rem',
                                fontSize: '0.75rem',
                                color: '#92400e',
                                backgroundColor: '#fef3c7',
                                padding: '0.5rem',
                                borderRadius: '0.25rem'
                            }}>
                                <strong>安装步骤：</strong>
                                <ol style={{ margin: '0.25rem 0 0 1rem', paddingLeft: '0' }}>
                                    <li>下载并解压插件文件</li>
                                    <li>打开 Chrome 扩展管理页面</li>
                                    <li>开启"开发者模式"</li>
                                    <li>点击"加载已解压的扩展程序"</li>
                                    <li>选择解压后的插件文件夹</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* ✅ Chrome 和插件都已安装 - 显示就绪状态 */
                <div style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: '0.375rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#047857'
                }}>
                    ✅ Prome 助手插件已就绪
                </div>
            )}

            {/* 平台选择 */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginBottom: '1rem'
            }}>
                {PLATFORMS.map(platform => (
                    <button
                        key={platform.id}
                        onClick={() => togglePlatform(platform.id)}
                        disabled={!platform.enabled || isPublishing}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.5rem 0.75rem',
                            border: selectedPlatforms.includes(platform.id)
                                ? '2px solid #3b82f6'
                                : '1px solid #d1d5db',
                            borderRadius: '0.5rem',
                            backgroundColor: selectedPlatforms.includes(platform.id)
                                ? '#eff6ff'
                                : 'white',
                            cursor: platform.enabled ? 'pointer' : 'not-allowed',
                            opacity: platform.enabled ? 1 : 0.5,
                            fontSize: '0.875rem'
                        }}
                    >
                        <span>{platform.icon}</span>
                        <span>{platform.name}</span>
                        <span>{getStatusIcon(publishStatus[platform.id])}</span>
                        {/* X 平台登录状态指示 */}
                        {platform.id === 'x' && (
                            <span style={{
                                fontSize: '0.75rem',
                                color: xLoggedIn ? '#10b981' : '#f59e0b',
                                marginLeft: '0.25rem'
                            }}>
                                {checkingXLogin ? '⏳' : xLoggedIn ? '✓' : '⚠'}
                            </span>
                        )}
                        {!platform.enabled && (
                            <span style={{
                                fontSize: '0.75rem',
                                color: '#9ca3af',
                                marginLeft: '0.25rem'
                            }}>
                                (即将)
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* 🔥 X/Twitter 登录模态框 - 使用固定定位确保可见和可滚动 */}
            {(showXLogin || (selectedPlatforms.includes('x') && !xLoggedIn && !checkingXLogin)) && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '0.75rem',
                        width: '100%',
                        maxWidth: '420px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '1rem 1.25rem',
                            backgroundColor: '#1d9bf0',
                            color: 'white',
                            borderRadius: '0.75rem 0.75rem 0 0'
                        }}>
                            <span style={{ fontWeight: '600', fontSize: '1.1rem' }}>𝕏 登录 X/Twitter</span>
                            <button
                                onClick={() => {
                                    setShowXLogin(false);
                                    setSelectedPlatforms(prev => prev.filter(p => p !== 'x'));
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '1.5rem',
                                    padding: '0.25rem',
                                    lineHeight: 1
                                }}
                            >
                                ×
                            </button>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <XLoginForm
                                userId={userId}
                                onLoginSuccess={() => {
                                    setXLoggedIn(true);
                                    setShowXLogin(false);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 发布按钮 */}
            <button
                onClick={handlePublish}
                disabled={isPublishing || selectedPlatforms.length === 0}
                style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: isPublishing ? '#9ca3af' : '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: isPublishing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                }}
            >
                {isPublishing ? (
                    <>
                        <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                        发布中...
                    </>
                ) : (
                    <>
                        🚀 发布到 {selectedPlatforms.length} 个平台
                    </>
                )}
            </button>

            {/* 发布状态 */}
            {Object.keys(publishStatus).length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                    <h5 style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                        发布状态:
                    </h5>
                    {Object.entries(publishStatus).map(([platformId, status]) => {
                        const platform = PLATFORMS.find(p => p.id === platformId);
                        return (
                            <div key={platformId} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.875rem',
                                marginBottom: '0.25rem'
                            }}>
                                <span>{platform?.icon}</span>
                                <span>{platform?.name}:</span>
                                <span>{getStatusIcon(status)}</span>
                                <span style={{
                                    color: status === 'completed' ? '#10b981' :
                                        status === 'failed' ? '#ef4444' : '#6b7280'
                                }}>
                                    {status === 'publishing' ? '发布中...' :
                                        status === 'completed' ? '已发布' :
                                            status === 'failed' ? '发布失败' : '等待发布'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default PlatformSelector;
