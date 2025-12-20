'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Sparkles, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ 类型定义 ============

interface CopyVariantBase {
    type: string;  // 使用宽松类型兼容后端数据
    title: string;
    text: string;
    estimatedWords?: number;
}

interface CopyVariantsData {
    motherCopy: { title: string; text: string };
    variants?: CopyVariantBase[];
    segments?: CopyVariantBase[];
}

interface VariantSelectorProps {
    /** 变体或拆分数据 */
    copyVariants: CopyVariantsData | null;
    /** 金句列表 */
    goldenQuotes?: string[];
    /** 文案策略 */
    copyStrategy?: 'variant' | 'split';
    /** 是否为审核模式 (true=用户选择, false=自动选择) */
    reviewMode?: boolean;
    /** 选中变体后的回调 */
    onSelectVariant?: (variant: { title: string; text: string; type: string }) => void;
    /** 当前选中的变体索引 */
    selectedIndex?: number;
}

// ============ 变体类型标签 ============

const variantTypeLabels: Record<string, { label: string; color: string }> = {
    hook: { label: '钩子型', color: 'bg-purple-100 text-purple-700' },
    emotion: { label: '情感型', color: 'bg-pink-100 text-pink-700' },
    benefit: { label: '利益型', color: 'bg-green-100 text-green-700' },
    comparison: { label: '对比型', color: 'bg-orange-100 text-orange-700' },
    story: { label: '故事型', color: 'bg-blue-100 text-blue-700' },
    intro: { label: '引入', color: 'bg-gray-100 text-gray-700' },
    main: { label: '主体', color: 'bg-indigo-100 text-indigo-700' },
    conclusion: { label: '总结', color: 'bg-teal-100 text-teal-700' },
    detail: { label: '细节', color: 'bg-amber-100 text-amber-700' },
    cta: { label: '号召', color: 'bg-red-100 text-red-700' },
};

// ============ 组件 ============

export function VariantSelector({
    copyVariants,
    goldenQuotes = [],
    copyStrategy,
    reviewMode = true,
    onSelectVariant,
    selectedIndex = 0,
}: VariantSelectorProps) {
    const [expanded, setExpanded] = useState(false);
    const [localSelectedIndex, setLocalSelectedIndex] = useState(selectedIndex);

    // 没有变体数据时不显示
    if (!copyVariants) {
        return null;
    }

    const items = copyVariants.variants || copyVariants.segments || [];
    const isVariantMode = copyStrategy === 'variant' || !!copyVariants.variants;

    // 自动模式下不显示选择器（使用第一个）
    if (!reviewMode && items.length > 0) {
        return null;
    }

    const handleSelect = (index: number) => {
        setLocalSelectedIndex(index);
        const item = items[index];
        if (item && onSelectVariant) {
            onSelectVariant({
                title: item.title,
                text: item.text,
                type: item.type,
            });
        }
    };

    return (
        <div className="space-y-3">
            {/* 金句展示 */}
            {goldenQuotes.length > 0 && (
                <div className="p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2 mb-2">
                        <Quote className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-800">
                            金句摘录 ({goldenQuotes.length})
                        </span>
                    </div>
                    <div className="space-y-1">
                        {goldenQuotes.slice(0, 3).map((quote, i) => (
                            <p key={i} className="text-sm text-yellow-900 italic">
                                「{quote}」
                            </p>
                        ))}
                    </div>
                </div>
            )}

            {/* 变体/拆分选择器 */}
            {items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                    {/* 头部 */}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            <span className="font-medium text-sm">
                                {isVariantMode ? `${items.length} 个变体版本` : `${items.length} 个内容片段`}
                            </span>
                            <Badge variant="outline" className="text-xs">
                                {isVariantMode ? '选择最适合的' : '可拆分发布'}
                            </Badge>
                        </div>
                        {expanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                    </button>

                    {/* 展开的变体列表 */}
                    {expanded && (
                        <div className="divide-y">
                            {items.map((item, index) => {
                                const typeInfo = variantTypeLabels[item.type] || {
                                    label: item.type,
                                    color: 'bg-gray-100 text-gray-700',
                                };
                                const isSelected = localSelectedIndex === index;

                                return (
                                    <div
                                        key={index}
                                        className={cn(
                                            'p-3 cursor-pointer transition-colors',
                                            isSelected
                                                ? 'bg-blue-50 border-l-4 border-blue-500'
                                                : 'hover:bg-gray-50'
                                        )}
                                        onClick={() => handleSelect(index)}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge className={cn('text-xs', typeInfo.color)}>
                                                    {typeInfo.label}
                                                </Badge>
                                                <span className="font-medium text-sm line-clamp-1">
                                                    {item.title}
                                                </span>
                                            </div>
                                            {isSelected && (
                                                <Badge className="bg-blue-500 text-white text-xs">
                                                    已选择
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 line-clamp-2">
                                            {item.text}
                                        </p>
                                        {item.estimatedWords && (
                                            <span className="text-xs text-gray-400 mt-1 block">
                                                约 {item.estimatedWords} 字
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* 折叠状态下显示当前选中 */}
                    {!expanded && items[localSelectedIndex] && (
                        <div className="p-3 bg-white border-t">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge
                                    className={cn(
                                        'text-xs',
                                        variantTypeLabels[items[localSelectedIndex].type]?.color ||
                                        'bg-gray-100'
                                    )}
                                >
                                    {variantTypeLabels[items[localSelectedIndex].type]?.label ||
                                        items[localSelectedIndex].type}
                                </Badge>
                                <span className="font-medium text-sm">
                                    {items[localSelectedIndex].title}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">
                                {items[localSelectedIndex].text}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* 使用选中变体按钮 */}
            {reviewMode && items.length > 0 && onSelectVariant && (
                <Button
                    onClick={() => handleSelect(localSelectedIndex)}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    size="sm"
                >
                    <Sparkles className="w-4 h-4 mr-2" />
                    使用选中的{isVariantMode ? '变体' : '片段'}
                </Button>
            )}
        </div>
    );
}

export default VariantSelector;
