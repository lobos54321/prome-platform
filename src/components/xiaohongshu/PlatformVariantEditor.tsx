/**
 * PlatformVariantEditor - 平台变体文案编辑器
 *
 * 功能：
 * 1. 左侧显示每个平台的变体文案
 * 2. 右侧显示该平台的 prompt 编辑器
 * 3. 用户可以修改 prompt 后重新生成变体
 * 4. 默认 prompt 模板包含平台规则
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Settings2,
    RefreshCw,
    Copy,
    Check,
    ChevronRight,
    Sparkles,
    FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ 平台规则定义 ============

export interface PlatformCopyRules {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    maxLength: number;
    style: string;
    tone: string;
    hashtagStyle: string;
    specialRules: string[];
}

export const PLATFORM_RULES: Record<string, PlatformCopyRules> = {
    xiaohongshu: {
        id: 'xiaohongshu',
        name: 'xiaohongshu',
        displayName: '小红书',
        icon: '📕',
        maxLength: 1000,
        style: '生活方式分享、情感共鸣、种草安利',
        tone: '亲切真诚、有温度、像朋友分享',
        hashtagStyle: '热门话题标签 + 产品相关标签，5-10个',
        specialRules: [
            '开头要有吸引力的钩子',
            '使用emoji增加趣味性',
            '分段清晰，每段2-3句',
            '结尾要有互动引导（求赞、评论、收藏）',
            '避免硬广，要像真实用户分享',
        ],
    },
    x: {
        id: 'x',
        name: 'x',
        displayName: 'X (Twitter)',
        icon: '𝕏',
        maxLength: 280,
        style: '简洁有力、观点鲜明、引发讨论',
        tone: '直接、专业、有洞察力',
        hashtagStyle: '1-3个精准话题标签',
        specialRules: [
            '开头直接抛出核心观点',
            '语言要精炼，每个字都要有价值',
            '可以使用线程(Thread)展开长内容',
            '适当使用数据或金句增加说服力',
            '结尾可以提问引发讨论',
        ],
    },
    tiktok: {
        id: 'tiktok',
        name: 'tiktok',
        displayName: 'TikTok',
        icon: '🎵',
        maxLength: 300,
        style: '活力有趣、挑战互动、潮流感',
        tone: '年轻活泼、有趣、有感染力',
        hashtagStyle: '热门挑战标签 + 利基标签，3-5个',
        specialRules: [
            '开头3秒要抓住注意力',
            '文案要配合视频节奏',
            '使用流行梗和热门音乐参考',
            '鼓励用户参与挑战或互动',
            '结尾要有明确的行动号召',
        ],
    },
    instagram: {
        id: 'instagram',
        name: 'instagram',
        displayName: 'Instagram',
        icon: '📷',
        maxLength: 2200,
        style: '视觉美学、生活方式、灵感分享',
        tone: '优雅、有品味、启发性',
        hashtagStyle: '混合使用热门标签和利基标签，10-30个',
        specialRules: [
            '第一句要吸引人停下滑动',
            '可以讲述图片背后的故事',
            '使用分段和emoji提高可读性',
            '标签放在文案最后或第一条评论',
            '英文为主，可适当使用其他语言',
        ],
    },
    youtube: {
        id: 'youtube',
        name: 'youtube',
        displayName: 'YouTube',
        icon: '▶️',
        maxLength: 5000,
        style: '详细描述、SEO优化、价值导向',
        tone: '专业、有深度、教育性',
        hashtagStyle: 'SEO关键词 + 品牌标签，3-5个',
        specialRules: [
            '标题要包含关键词且吸引点击',
            '描述前100字最重要（折叠前可见）',
            '包含时间戳方便跳转',
            '添加相关链接和资源',
            '使用关键词但避免堆砌',
        ],
    },
    threads: {
        id: 'threads',
        name: 'threads',
        displayName: 'Threads',
        icon: '📱',
        maxLength: 500,
        style: '随性真实、对话感强、碎片化',
        tone: '轻松、平视、像在发短信',
        hashtagStyle: '少量标签或无标签，1-3个',
        specialRules: [
            '像在和朋友发短信',
            '鼓励回复和引用',
            '可以使用连载形式',
            '适合碎片化思考分享',
            '图片配文要简洁',
        ],
    },
};

// ============ 默认 Prompt 模板生成 ============

export function generateDefaultPrompt(
    platform: PlatformCopyRules,
    motherCopy: { title: string; text: string }
): string {
    return `你是一位专业的${platform.displayName}平台内容创作专家。

## 母文案（原始内容）
标题：${motherCopy.title}
正文：${motherCopy.text}

## 平台规则
- 平台：${platform.displayName}
- 风格：${platform.style}
- 语调：${platform.tone}
- 字数限制：${platform.maxLength}字以内
- 标签策略：${platform.hashtagStyle}

## 特殊要求
${platform.specialRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

## 任务
请根据以上母文案和平台规则，生成一篇适合${platform.displayName}平台的变体文案。

要求：
1. 保持母文案的核心信息和卖点
2. 完全符合${platform.displayName}平台的风格和规则
3. 语言自然流畅，像真实用户创作
4. 包含合适的标签

请直接输出变体文案，格式如下：
【标题】
[变体标题]

【正文】
[变体正文]

【标签】
[#标签1 #标签2 ...]`;
}

// ============ 组件 Props ============

interface PlatformVariant {
    platform: string;
    platformName: string;
    title: string;
    text: string;
    hashtags?: string[];
}

interface PlatformVariantEditorProps {
    /** 母文案 */
    motherCopy: { title: string; text: string };
    /** 平台变体列表 */
    variants: PlatformVariant[];
    /** 目标平台列表 */
    targetPlatforms: string[];
    /** 重新生成变体的回调 */
    onRegenerate?: (platform: string, prompt: string) => Promise<PlatformVariant | null>;
    /** 选择变体的回调 */
    onSelectVariant?: (variant: PlatformVariant) => void;
    /** 是否正在生成 */
    isGenerating?: boolean;
}

// ============ 组件实现 ============

export function PlatformVariantEditor({
    motherCopy,
    variants,
    targetPlatforms,
    onRegenerate,
    onSelectVariant,
    isGenerating = false,
}: PlatformVariantEditorProps) {
    const [activeTab, setActiveTab] = useState(targetPlatforms[0] || 'xiaohongshu');
    const [showPromptEditor, setShowPromptEditor] = useState(false);
    const [prompts, setPrompts] = useState<Record<string, string>>({});
    const [regenerating, setRegenerating] = useState<string | null>(null);
    const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

    // 初始化每个平台的默认 prompt
    useEffect(() => {
        const initialPrompts: Record<string, string> = {};
        targetPlatforms.forEach(platformId => {
            const rules = PLATFORM_RULES[platformId];
            if (rules) {
                initialPrompts[platformId] = generateDefaultPrompt(rules, motherCopy);
            }
        });
        setPrompts(initialPrompts);
    }, [targetPlatforms, motherCopy]);

    // 获取当前平台的变体
    const getCurrentVariant = (platformId: string): PlatformVariant | undefined => {
        return variants.find(v => v.platform === platformId);
    };

    // 复制文案到剪贴板
    const handleCopy = async (variant: PlatformVariant) => {
        const text = `${variant.title}\n\n${variant.text}${variant.hashtags?.length ? '\n\n' + variant.hashtags.join(' ') : ''}`;
        await navigator.clipboard.writeText(text);
        setCopiedPlatform(variant.platform);
        setTimeout(() => setCopiedPlatform(null), 2000);
    };

    // 重新生成变体
    const handleRegenerate = async (platformId: string) => {
        if (!onRegenerate) return;

        setRegenerating(platformId);
        try {
            const prompt = prompts[platformId];
            await onRegenerate(platformId, prompt);
        } finally {
            setRegenerating(null);
        }
    };

    // 更新 prompt
    const updatePrompt = (platformId: string, newPrompt: string) => {
        setPrompts(prev => ({
            ...prev,
            [platformId]: newPrompt,
        }));
    };

    // 重置 prompt 到默认值
    const resetPrompt = (platformId: string) => {
        const rules = PLATFORM_RULES[platformId];
        if (rules) {
            setPrompts(prev => ({
                ...prev,
                [platformId]: generateDefaultPrompt(rules, motherCopy),
            }));
        }
    };

    return (
        <Card className="w-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        平台变体文案
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPromptEditor(!showPromptEditor)}
                        className={cn(showPromptEditor && 'bg-purple-50 border-purple-300')}
                    >
                        <Settings2 className="w-4 h-4 mr-2" />
                        {showPromptEditor ? '隐藏 Prompt' : '编辑 Prompt'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {/* 母文案展示 */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">母文案</span>
                    </div>
                    <p className="text-sm font-medium">{motherCopy.title}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{motherCopy.text}</p>
                </div>

                {/* 平台 Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
                        {targetPlatforms.map(platformId => {
                            const rules = PLATFORM_RULES[platformId];
                            if (!rules) return null;
                            const variant = getCurrentVariant(platformId);

                            return (
                                <TabsTrigger
                                    key={platformId}
                                    value={platformId}
                                    className="flex items-center gap-1.5 data-[state=active]:bg-purple-100"
                                >
                                    <span>{rules.icon}</span>
                                    <span className="hidden sm:inline">{rules.displayName}</span>
                                    {variant && (
                                        <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                                            ✓
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>

                    {targetPlatforms.map(platformId => {
                        const rules = PLATFORM_RULES[platformId];
                        if (!rules) return null;
                        const variant = getCurrentVariant(platformId);
                        const isThisRegenerating = regenerating === platformId;

                        return (
                            <TabsContent key={platformId} value={platformId} className="mt-4">
                                <div className={cn(
                                    'grid gap-4',
                                    showPromptEditor ? 'lg:grid-cols-2' : 'grid-cols-1'
                                )}>
                                    {/* 左侧：变体文案展示 */}
                                    <div className="space-y-3">
                                        {/* 平台规则提示 */}
                                        <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-lg">{rules.icon}</span>
                                                <span className="font-medium text-blue-800">{rules.displayName}</span>
                                                <Badge variant="outline" className="text-xs">
                                                    ≤{rules.maxLength}字
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-blue-600">
                                                风格：{rules.style}
                                            </p>
                                        </div>

                                        {/* 变体内容 */}
                                        {variant ? (
                                            <div className="p-4 bg-white rounded-lg border-2 border-purple-200">
                                                <div className="flex items-start justify-between mb-2">
                                                    <h4 className="font-medium text-gray-900">
                                                        {variant.title}
                                                    </h4>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleCopy(variant)}
                                                        className="shrink-0"
                                                    >
                                                        {copiedPlatform === platformId ? (
                                                            <Check className="w-4 h-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="w-4 h-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                                    {variant.text}
                                                </p>
                                                {variant.hashtags && variant.hashtags.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-1">
                                                        {variant.hashtags.map((tag, i) => (
                                                            <Badge
                                                                key={i}
                                                                variant="secondary"
                                                                className="text-xs"
                                                            >
                                                                {tag}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="mt-3 text-xs text-gray-400">
                                                    {variant.text.length} 字
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-center">
                                                <p className="text-gray-500">
                                                    暂无 {rules.displayName} 平台的变体文案
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-3"
                                                    onClick={() => handleRegenerate(platformId)}
                                                    disabled={isThisRegenerating || isGenerating}
                                                >
                                                    <Sparkles className="w-4 h-4 mr-2" />
                                                    生成变体
                                                </Button>
                                            </div>
                                        )}

                                        {/* 操作按钮 */}
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRegenerate(platformId)}
                                                disabled={isThisRegenerating || isGenerating}
                                                className="flex-1"
                                            >
                                                <RefreshCw className={cn(
                                                    'w-4 h-4 mr-2',
                                                    isThisRegenerating && 'animate-spin'
                                                )} />
                                                {isThisRegenerating ? '生成中...' : '重新生成'}
                                            </Button>
                                            {variant && onSelectVariant && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => onSelectVariant(variant)}
                                                    className="flex-1 bg-purple-500 hover:bg-purple-600"
                                                >
                                                    使用此变体
                                                    <ChevronRight className="w-4 h-4 ml-1" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* 右侧：Prompt 编辑器 */}
                                    {showPromptEditor && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-700">
                                                    生成 Prompt
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => resetPrompt(platformId)}
                                                    className="text-xs"
                                                >
                                                    重置为默认
                                                </Button>
                                            </div>
                                            <Textarea
                                                value={prompts[platformId] || ''}
                                                onChange={(e) => updatePrompt(platformId, e.target.value)}
                                                className="min-h-[300px] text-xs font-mono"
                                                placeholder="输入生成 prompt..."
                                            />
                                            <div className="text-xs text-gray-400">
                                                提示：修改 prompt 后点击「重新生成」应用更改
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        );
                    })}
                </Tabs>
            </CardContent>
        </Card>
    );
}

export default PlatformVariantEditor;
