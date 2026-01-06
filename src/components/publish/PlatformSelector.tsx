/**
 * PlatformSelector - 多平台发布选择组件
 * 
 * 在内容入库后显示，允许用户选择目标发布平台
 */

import React, { useState } from 'react';
import { useXiaohongshuPublish } from '../../hooks/useXiaohongshuPublish';
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

    // 小红书发布 Hook
    const {
        hasExtension,
        confirmAndPublish: publishToXiaohongshu,
        downloadExtension,
        openPublishPage
    } = useXiaohongshuPublish({
        onSuccess: (result) => {
            setPublishStatus(prev => ({ ...prev, xiaohongshu: 'completed' }));
            onPublishComplete?.('xiaohongshu', result);
        },
        onError: () => {
            setPublishStatus(prev => ({ ...prev, xiaohongshu: 'failed' }));
        }
    });

    const togglePlatform = (platformId: string) => {
        const platform = PLATFORMS.find(p => p.id === platformId);
        if (!platform?.enabled) return;

        setSelectedPlatforms(prev =>
            prev.includes(platformId)
                ? prev.filter(id => id !== platformId)
                : [...prev, platformId]
        );
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

            setPublishStatus(prev => ({ ...prev, [platformId]: 'publishing' }));

            if (platformId === 'xiaohongshu') {
                // 检查插件
                if (!hasExtension) {
                    const install = window.confirm(
                        '未检测到 Prome 助手插件。\n\n需要安装插件才能自动发布内容。\n\n点击「确定」下载插件。'
                    );
                    if (install) {
                        downloadExtension();
                    }
                    setPublishStatus(prev => ({ ...prev, xiaohongshu: 'failed' }));
                    continue;
                }

                // 打开发布页面
                openPublishPage(content.video ? 'video' : 'image');

                // 发布
                await publishToXiaohongshu({
                    title: content.title,
                    content: content.content,
                    images: content.images,
                    video: content.video,
                    tags: content.tags
                });
            } else {
                // Skyvern 发布
                try {
                    console.log(`[Skyvern] Publishing to ${platformId}`);
                    const result = await publishApi.publishViaSkyvern(platformId);
                    if (result.success) {
                        setPublishStatus(prev => ({ ...prev, [platformId]: 'publishing' }));
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
