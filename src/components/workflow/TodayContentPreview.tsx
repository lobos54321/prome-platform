'use client';

import React, { useState } from 'react';
import { FileText, Image as ImageIcon, Send, Clock, Eye, Edit2, RefreshCw, CheckCircle, ChevronDown, ChevronUp, Settings2, Sparkles } from 'lucide-react';
import { PlatformSelector } from '../publish/PlatformSelector';
import { PlatformVariantEditor, PLATFORM_RULES } from '../xiaohongshu/PlatformVariantEditor';

// 🔥 平台变体类型
interface PlatformVariant {
    platform: string;
    platformName: string;
    title: string;
    text: string;
    hashtags?: string[];
}

interface TodayContentPreviewProps {
    content?: {
        title: string;
        text: string;
        imageUrls?: string[];
        hashtags?: string[];
        scheduledTime?: string;
        engine?: string;
        status?: 'draft' | 'approved' | 'publishing' | 'published' | 'failed';
        variants?: Array<{
            type: string;
            platform?: string;       // 🔥 平台ID
            platformName?: string;   // 🔥 平台显示名称
            title: string;
            text: string;
            hashtags?: string[];
        }>;
    } | null;
    // 🔥 目标平台列表
    targetPlatforms?: string[];
    // 🔥 当前激活的平台（用于过滤显示）
    activePlatform?: string;
    // 🔥 重新生成平台变体的回调
    onRegeneratePlatformVariant?: (platform: string, prompt: string) => Promise<PlatformVariant | null>;
    onPublish?: () => Promise<void>;
    onEdit?: () => void;
    onRegenerate?: () => void;
    onSelectVariant?: (variant: { type: string; title: string; text: string }) => void;
    isPublishing?: boolean;
}

export const TodayContentPreview: React.FC<TodayContentPreviewProps> = ({
    content,
    targetPlatforms = ['xiaohongshu'],
    activePlatform,
    onRegeneratePlatformVariant,
    onPublish,
    onEdit,
    onRegenerate,
    onSelectVariant,
    isPublishing = false,
}) => {
    const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
    const [showPreview, setShowPreview] = useState(false);
    const [showPlatformSelector, setShowPlatformSelector] = useState(false);
    const [showPlatformVariantEditor, setShowPlatformVariantEditor] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);

    if (!content) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <FileText size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-medium">内容生成中...</p>
                <p className="text-xs mt-1">AI 正在创作今日笔记</p>
            </div>
        );
    }

    const activeContent = content.variants?.[selectedVariantIndex] || content;

    // 🔥 检测是否有平台变体（包含 platform 字段的变体）
    const allPlatformVariants: PlatformVariant[] = (content.variants || [])
        .filter(v => v.platform)
        .map(v => ({
            platform: v.platform!,
            platformName: v.platformName || PLATFORM_RULES[v.platform!]?.displayName || v.platform!,
            title: v.title,
            text: v.text,
            hashtags: v.hashtags,
        }));

    // 🔥 根据 activePlatform 过滤变体（如果指定了激活平台）
    const platformVariants: PlatformVariant[] = activePlatform
        ? allPlatformVariants.filter(v => v.platform === activePlatform)
        : allPlatformVariants;

    const hasPlatformVariants = platformVariants.length > 0;

    // 🔥 处理平台变体重新生成
    const handleRegeneratePlatformVariant = async (platform: string, prompt: string): Promise<PlatformVariant | null> => {
        if (!onRegeneratePlatformVariant) return null;

        setIsRegenerating(true);
        try {
            return await onRegeneratePlatformVariant(platform, prompt);
        } finally {
            setIsRegenerating(false);
        }
    };

    const getStatusBadge = () => {
        switch (content.status) {
            case 'draft':
                return <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs rounded-full">待审核</span>;
            case 'approved':
                return <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">已通过</span>;
            case 'publishing':
                return <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full">发布中</span>;
            case 'published':
                return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-xs rounded-full">已发布</span>;
            case 'failed':
                return <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-xs rounded-full">发布失败</span>;
            default:
                return null;
        }
    };

    // 🔥 平台变体编辑器视图
    if (showPlatformVariantEditor) {
        return (
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 text-white">
                            <Settings2 size={14} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-700">平台变体 Prompt 编辑</h3>
                    </div>
                    <button
                        onClick={() => setShowPlatformVariantEditor(false)}
                        className="text-sm text-slate-500 hover:text-slate-700"
                    >
                        返回内容预览
                    </button>
                </div>

                {/* Platform Variant Editor */}
                <div className="flex-1 overflow-y-auto p-4">
                    <PlatformVariantEditor
                        motherCopy={{ title: content.title, text: content.text }}
                        variants={platformVariants}
                        targetPlatforms={targetPlatforms}
                        onRegenerate={handleRegeneratePlatformVariant}
                        isGenerating={isRegenerating}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 text-white">
                        <FileText size={14} />
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-sm font-bold text-slate-700 leading-tight">今日内容产出</h3>
                        {content.engine && (
                            <span className="text-[9px] font-medium text-slate-400">Powered by {content.engine}</span>
                        )}
                    </div>
                    {getStatusBadge()}
                </div>
                <div className="flex items-center gap-2">
                    {/* 🔥 平台变体编辑入口 */}
                    {(hasPlatformVariants || targetPlatforms.length > 0) && (
                        <button
                            onClick={() => setShowPlatformVariantEditor(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                        >
                            <Sparkles size={12} />
                            编辑 Prompt
                        </button>
                    )}
                    {content.scheduledTime && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock size={12} />
                            <span>{new Date(content.scheduledTime).toLocaleTimeString('zh-CN', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 🔥 平台变体快捷预览（如果有） */}
            {hasPlatformVariants && (
                <div className="p-3 border-b border-slate-50 bg-gradient-to-r from-purple-50 to-pink-50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-600">
                            🌐 已生成 {platformVariants.length} 个平台变体
                        </span>
                        <button
                            onClick={() => setShowPlatformVariantEditor(true)}
                            className="text-xs text-purple-600 hover:text-purple-700"
                        >
                            查看详情 →
                        </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto">
                        {platformVariants.map((variant, index) => {
                            const rules = PLATFORM_RULES[variant.platform];
                            return (
                                <div
                                    key={index}
                                    className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs"
                                >
                                    <span className="mr-1">{rules?.icon || '📄'}</span>
                                    {variant.platformName}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 变体选择器 */}
            {content.variants && content.variants.length > 1 && !hasPlatformVariants && (
                <div className="p-3 border-b border-slate-50">
                    <div className="flex gap-2 overflow-x-auto">
                        {content.variants.map((variant, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setSelectedVariantIndex(index);
                                    onSelectVariant?.(variant);
                                }}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedVariantIndex === index
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {variant.type}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 内容预览 */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* 标题 */}
                <h4 className="text-base font-bold text-slate-800 mb-3 leading-snug">
                    {activeContent.title}
                </h4>

                {/* 正文 */}
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap mb-4">
                    {activeContent.text?.substring(0, 300)}
                    {activeContent.text?.length > 300 && '...'}
                </p>

                {/* 图片预览 */}
                {content.imageUrls && content.imageUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {content.imageUrls.slice(0, 6).map((url, i) => (
                            <div
                                key={i}
                                className="aspect-square rounded-lg overflow-hidden bg-slate-100"
                            >
                                <img
                                    src={url}
                                    alt={`图${i + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* 标签 */}
                {content.hashtags && content.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {content.hashtags.map((tag, i) => (
                            <span
                                key={i}
                                className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* 操作按钮 */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <div className="flex gap-2">
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                            <Edit2 size={14} />
                            编辑
                        </button>
                    )}
                    {onRegenerate && (
                        <button
                            onClick={onRegenerate}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                            <RefreshCw size={14} />
                            重新生成
                        </button>
                    )}
                </div>

                {/* 发布按钮 - 多平台选择 */}
                {content.status !== 'published' && (
                    <div className="mt-2">
                        {!showPlatformSelector ? (
                            <button
                                onClick={() => setShowPlatformSelector(true)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg shadow-rose-200 transition-all"
                            >
                                <Send size={16} />
                                🚀 发布到多平台
                                <ChevronDown size={16} />
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <button
                                    onClick={() => setShowPlatformSelector(false)}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <ChevronUp size={14} />
                                    收起
                                </button>
                                <PlatformSelector
                                    content={{
                                        // 🔥 使用选中的变体文案，而非原始母文案
                                        title: content.variants && content.variants.length > 0
                                            ? content.variants[selectedVariantIndex]?.title || content.title
                                            : content.title,
                                        content: content.variants && content.variants.length > 0
                                            ? content.variants[selectedVariantIndex]?.text || content.text || ''
                                            : content.text || '',
                                        images: content.imageUrls || [],
                                        tags: content.hashtags || []
                                    }}
                                    onPublishComplete={(platform, result) => {
                                        console.log(`Published to ${platform}:`, result);
                                        // 调用原来的 onPublish 刷新数据
                                        onPublish?.();
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {content.status === 'published' && (
                    <div className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-600 font-medium text-sm">
                        <CheckCircle size={16} />
                        已成功发布
                    </div>
                )}
            </div>
        </div>
    );
};

export default TodayContentPreview;
