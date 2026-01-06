/**
 * PlatformSelector - 多平台发布选择组件
 * 
 * 在内容入库后显示，允许用户选择目标发布平台
 */

import React, { useState } from 'react';
import { publishApi } from '../../lib/publishApi';

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
