/**
 * ContentLibrary - 内容库组件
 * 
 * 显示所有生成的内容，支持发布、编辑、删除操作
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    FileText,
    Send,
    Edit2,
    Trash2,
    Image as ImageIcon,
    Clock,
    CheckCircle,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    RefreshCw
} from 'lucide-react';
import { PlatformSelector } from '@/components/publish/PlatformSelector';

interface ContentItem {
    id: string;
    title: string;
    content?: string;
    text?: string;
    imageUrls?: string[];
    image_urls?: string[];
    hashtags?: string[];
    tags?: string[];
    scheduledTime?: string;
    scheduled_time?: string;
    status?: 'draft' | 'pending' | 'in-progress' | 'publishing' | 'published' | 'failed';
}

interface ContentLibraryProps {
    items: ContentItem[];
    onPublish: (id: string) => Promise<void>;
    onEdit: (id: string) => void;
    onDelete: (id: string) => Promise<void>;
    onRegenerate?: (id: string) => Promise<void>;
}

export function ContentLibrary({
    items,
    onPublish,
    onEdit,
    onDelete,
    onRegenerate
}: ContentLibraryProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showPlatformSelector, setShowPlatformSelector] = useState<string | null>(null);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const getStatusBadge = (status?: string) => {
        switch (status) {
            case 'published':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        <CheckCircle size={12} />
                        已发布
                    </span>
                );
            case 'publishing':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        <RefreshCw size={12} className="animate-spin" />
                        发布中
                    </span>
                );
            case 'failed':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                        <AlertCircle size={12} />
                        失败
                    </span>
                );
            case 'pending':
            case 'in-progress':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                        <Clock size={12} />
                        待发布
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        草稿
                    </span>
                );
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确认删除此内容？此操作不可恢复。')) {
            return;
        }
        setLoadingId(id);
        try {
            await onDelete(id);
        } finally {
            setLoadingId(null);
        }
    };

    if (!items || items.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        📚 内容库
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                        <FileText size={48} className="mb-4 opacity-50" />
                        <p className="text-sm">暂无生成的内容</p>
                        <p className="text-xs mt-1">启动运营后，生成的内容将显示在这里</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    📚 内容库
                    <span className="text-sm font-normal text-gray-500">
                        ({items.length} 条内容)
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {items.map((item) => {
                        const contentText = item.content || item.text || '';
                        const images = item.imageUrls || item.image_urls || [];
                        const tags = item.hashtags || item.tags || [];
                        const scheduledTime = item.scheduledTime || item.scheduled_time;
                        const isExpanded = expandedId === item.id;
                        const showSelector = showPlatformSelector === item.id;

                        return (
                            <div
                                key={item.id}
                                className="border rounded-lg overflow-hidden bg-white hover:shadow-sm transition-shadow"
                            >
                                {/* 内容头部 */}
                                <div
                                    className="p-3 cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                {getStatusBadge(item.status)}
                                                {scheduledTime && (
                                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                                        <Clock size={10} />
                                                        {new Date(scheduledTime).toLocaleString('zh-CN', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="font-medium text-gray-900 truncate">
                                                {item.title || '无标题'}
                                            </h4>
                                            <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                                                {contentText.substring(0, 100)}
                                                {contentText.length > 100 && '...'}
                                            </p>
                                        </div>

                                        {/* 图片预览 */}
                                        {images.length > 0 && (
                                            <div className="flex-shrink-0 flex gap-1">
                                                {images.slice(0, 2).map((url, i) => (
                                                    <div
                                                        key={i}
                                                        className="w-12 h-12 rounded overflow-hidden bg-gray-100"
                                                    >
                                                        <img
                                                            src={url}
                                                            alt={`图片${i + 1}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ))}
                                                {images.length > 2 && (
                                                    <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                                                        +{images.length - 2}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <Button variant="ghost" size="sm" className="flex-shrink-0">
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </Button>
                                    </div>
                                </div>

                                {/* 展开详情 */}
                                {isExpanded && (
                                    <div className="border-t bg-gray-50 p-3">
                                        {/* 完整内容 */}
                                        <div className="mb-3">
                                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                                {contentText}
                                            </p>
                                        </div>

                                        {/* 标签 */}
                                        {tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {tags.map((tag, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full"
                                                    >
                                                        #{tag.replace(/^#/, '')}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* 图片完整预览 */}
                                        {images.length > 0 && (
                                            <div className="grid grid-cols-4 gap-2 mb-3">
                                                {images.map((url, i) => (
                                                    <div
                                                        key={i}
                                                        className="aspect-square rounded overflow-hidden bg-gray-100"
                                                    >
                                                        <img
                                                            src={url}
                                                            alt={`图片${i + 1}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* 操作按钮 */}
                                        <div className="flex items-center gap-2 pt-2 border-t">
                                            <Button
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowPlatformSelector(showSelector ? null : item.id);
                                                }}
                                                className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white"
                                            >
                                                <Send size={14} className="mr-1" />
                                                发布
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEdit(item.id);
                                                }}
                                            >
                                                <Edit2 size={14} className="mr-1" />
                                                编辑
                                            </Button>
                                            {onRegenerate && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRegenerate(item.id);
                                                    }}
                                                >
                                                    <RefreshCw size={14} className="mr-1" />
                                                    重新生成
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                disabled={loadingId === item.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(item.id);
                                                }}
                                            >
                                                <Trash2 size={14} className="mr-1" />
                                                删除
                                            </Button>
                                        </div>

                                        {/* 平台选择器 */}
                                        {showSelector && (
                                            <div className="mt-3 pt-3 border-t">
                                                <PlatformSelector
                                                    content={{
                                                        title: item.title,
                                                        content: contentText,
                                                        images: images,
                                                        tags: tags
                                                    }}
                                                    onPublishComplete={(platform, result) => {
                                                        console.log(`Published to ${platform}:`, result);
                                                        setShowPlatformSelector(null);
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

export default ContentLibrary;
