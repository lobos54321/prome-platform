'use client';

import React, { useState } from 'react';
import { FileText, Image as ImageIcon, Send, Clock, Eye, Edit2, RefreshCw, CheckCircle } from 'lucide-react';

interface TodayContentPreviewProps {
    content?: {
        title: string;
        text: string;
        imageUrls?: string[];
        hashtags?: string[];
        scheduledTime?: string;
        status?: 'draft' | 'approved' | 'publishing' | 'published' | 'failed';
        variants?: Array<{
            type: string;
            title: string;
            text: string;
        }>;
    } | null;
    onPublish?: () => Promise<void>;
    onEdit?: () => void;
    onRegenerate?: () => void;
    onSelectVariant?: (variant: { type: string; title: string; text: string }) => void;
    isPublishing?: boolean;
}

export const TodayContentPreview: React.FC<TodayContentPreviewProps> = ({
    content,
    onPublish,
    onEdit,
    onRegenerate,
    onSelectVariant,
    isPublishing = false,
}) => {
    const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
    const [showPreview, setShowPreview] = useState(false);

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

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 text-white">
                        <FileText size={14} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">今日内容</h3>
                    {getStatusBadge()}
                </div>
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

            {/* 变体选择器 */}
            {content.variants && content.variants.length > 1 && (
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

                {/* 发布按钮 */}
                {onPublish && content.status !== 'published' && (
                    <button
                        onClick={onPublish}
                        disabled={isPublishing || content.status === 'publishing'}
                        className={`w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-bold text-sm transition-all ${isPublishing || content.status === 'publishing'
                                ? 'bg-slate-300 cursor-not-allowed'
                                : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg shadow-rose-200'
                            }`}
                    >
                        {isPublishing || content.status === 'publishing' ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                发布中...
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                发布到小红书
                            </>
                        )}
                    </button>
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
