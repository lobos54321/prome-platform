/**
 * PlatformSelector - 多平台发布选择组件
 * 
 * 在内容入库后显示，允许用户选择目标发布平台
 * 包含 Chrome 浏览器检测和插件安装引导流程
 */

import React, { useState, useEffect } from 'react';
import { publishApi } from '../../lib/publishApi';

// 插件下载地址
const EXTENSION_DOWNLOAD_URL = '/prome-extension.zip';

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

        // 构建发布数据
        const publishData = {
            title: content.title,
            content: content.content || '',
            imageUrls: content.images || [],
            hashtags: content.tags || [],
            publishType: content.video ? 'video' : 'image',
            videoUrl: content.video || null
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
