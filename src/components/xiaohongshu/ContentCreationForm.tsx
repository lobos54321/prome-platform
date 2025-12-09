/**
 * 内容创作表单 - 统一信息收集
 * 用于生成文案和视频/图文内容
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Sparkles,
    FileText,
    Video,
    Image,
    Loader2,
    Check,
    ChevronRight,
    Zap,
    User,
    Target,
    Clock,
} from 'lucide-react';
import type {
    ContentFormat,
    VideoType,
    MarketingGoal,
    VideoConfig,
    ContentCreationRequest,
    CopywriteResult
} from '@/types/content';
import { VIDEO_TYPE_CONFIG, UGC_CREDITS } from '@/types/content';
import type { UserProfile } from '@/types/xiaohongshu';

interface ContentCreationFormProps {
    supabaseUuid: string;
    userProfile?: UserProfile | null;
    accountId?: string;
    accountPersona?: string;
    onContentGenerated?: (result: any) => void;
}

export function ContentCreationForm({
    supabaseUuid,
    userProfile,
    accountId,
    accountPersona,
    onContentGenerated,
}: ContentCreationFormProps) {
    // Step tracking
    const [currentStep, setCurrentStep] = useState<'setup' | 'format' | 'generating' | 'result'>('setup');

    // 产品信息 (从 userProfile 导入)
    const [productName, setProductName] = useState('');
    const [productDescription, setProductDescription] = useState('');
    const [targetAudience, setTargetAudience] = useState('');
    const [productImages, setProductImages] = useState<string[]>([]);
    const [materialAnalysis, setMaterialAnalysis] = useState('');

    // 文案参数
    const [marketingGoal, setMarketingGoal] = useState<MarketingGoal>('awareness');
    const [wordCount, setWordCount] = useState(500);

    // 内容形式
    const [contentFormat, setContentFormat] = useState<ContentFormat>('image_text');
    const [videoType, setVideoType] = useState<VideoType>('ugc_n8n');
    const [videoDuration, setVideoDuration] = useState<16 | 24 | 32>(16);
    const [videoGender, setVideoGender] = useState<'male' | 'female'>('female');
    const [videoLanguage, setVideoLanguage] = useState<'zh-CN' | 'en-US' | 'ja-JP'>('zh-CN');

    // 状态
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [copywriteResult, setCopywriteResult] = useState<CopywriteResult | null>(null);

    // 从 userProfile 导入数据
    useEffect(() => {
        if (userProfile) {
            setProductName(userProfile.product_name || '');
            setTargetAudience(userProfile.target_audience || '');
            setProductImages(userProfile.material_images || []);
            setMaterialAnalysis(userProfile.material_analysis || '');
        }
    }, [userProfile]);

    // 计算预估算力
    const calculateCredits = (): number => {
        if (contentFormat === 'image_text') return 0;

        if (videoType === 'ugc_n8n') {
            return UGC_CREDITS[videoDuration];
        }

        const config = VIDEO_TYPE_CONFIG[videoType];
        return Math.ceil(config.creditsPerMinute * (videoDuration / 60));
    };

    // 生成内容
    const handleGenerate = async () => {
        setError('');
        setGenerating(true);
        setCopywriteResult(null);

        try {
            const request: ContentCreationRequest = {
                productName,
                productDescription,
                targetAudience,
                productImages,
                materialAnalysis,
                marketingGoal,
                wordCount,
                platform: 'xiaohongshu',
                contentFormat,
                videoType: contentFormat === 'video' ? videoType : undefined,
                videoConfig: contentFormat === 'video' ? {
                    duration: videoDuration,
                    gender: videoGender,
                    language: videoLanguage,
                } : undefined,
                accountId,
                accountPersona,
            };

            // 调用 API 生成内容
            const response = await fetch('/api/content/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supabase_uuid: supabaseUuid,
                    ...request,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setCopywriteResult(data.copywrite);
                setCurrentStep('result');
                onContentGenerated?.(data);
            } else {
                throw new Error(data.error || '生成失败');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '生成失败');
        } finally {
            setGenerating(false);
        }
    };

    // 渲染产品信息步骤
    const renderSetupStep = () => (
        <div className="space-y-4">
            {/* 导入提示 */}
            {userProfile && (
                <Alert className="bg-green-50 border-green-200">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                        已从产品配置导入 {productImages.length > 0 ? `(含 ${productImages.length} 张图片)` : ''}
                    </AlertDescription>
                </Alert>
            )}

            {/* 产品名称 */}
            <div className="space-y-2">
                <Label>产品/服务名称</Label>
                <Input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="例如：艺站美术培训"
                />
            </div>

            {/* 产品描述 */}
            <div className="space-y-2">
                <Label>产品详细描述</Label>
                <Textarea
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    placeholder="详细描述产品特点、优势、解决什么问题、有什么成功案例..."
                    rows={4}
                />
                <p className="text-xs text-muted-foreground">
                    描述越详细，生成的文案越精准
                </p>
            </div>

            {/* 目标受众 */}
            <div className="space-y-2">
                <Label>目标受众</Label>
                <Input
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="例如：25-40岁关注孩子教育的家长"
                />
            </div>

            {/* 营销目标 */}
            <div className="space-y-2">
                <Label>营销目标</Label>
                <RadioGroup
                    value={marketingGoal}
                    onValueChange={(v) => setMarketingGoal(v as MarketingGoal)}
                    className="flex gap-4"
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="awareness" id="awareness" />
                        <Label htmlFor="awareness" className="cursor-pointer">提高认知</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="consideration" id="consideration" />
                        <Label htmlFor="consideration" className="cursor-pointer">解决疑惑</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="conversion" id="conversion" />
                        <Label htmlFor="conversion" className="cursor-pointer">直接销售</Label>
                    </div>
                </RadioGroup>
            </div>

            {/* 文案字数 */}
            <div className="space-y-2">
                <Label>文案字数</Label>
                <Select
                    value={String(wordCount)}
                    onValueChange={(v) => setWordCount(Number(v))}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="300">300字 (简短)</SelectItem>
                        <SelectItem value="500">500字 (标准)</SelectItem>
                        <SelectItem value="800">800字 (详细)</SelectItem>
                        <SelectItem value="1000">1000字+ (深度)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* 下一步按钮 */}
            <Button
                onClick={() => setCurrentStep('format')}
                className="w-full"
                disabled={!productName || !productDescription}
            >
                下一步：选择内容形式
                <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
    );

    // 渲染内容形式选择
    const renderFormatStep = () => (
        <div className="space-y-4">
            {/* 内容形式选择 */}
            <div className="space-y-3">
                <Label>选择内容形式</Label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setContentFormat('image_text')}
                        className={`p-4 rounded-lg border-2 transition-all ${contentFormat === 'image_text'
                                ? 'border-pink-500 bg-pink-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <Image className="h-8 w-8 mx-auto mb-2 text-pink-500" />
                        <div className="font-medium">图文笔记</div>
                        <div className="text-xs text-muted-foreground">0 算力</div>
                    </button>

                    <button
                        onClick={() => setContentFormat('video')}
                        className={`p-4 rounded-lg border-2 transition-all ${contentFormat === 'video'
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <Video className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                        <div className="font-medium">视频内容</div>
                        <div className="text-xs text-muted-foreground">需要算力</div>
                    </button>
                </div>
            </div>

            {/* 视频选项 */}
            {contentFormat === 'video' && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    {/* 视频类型 */}
                    <div className="space-y-2">
                        <Label>视频类型</Label>
                        <Select
                            value={videoType}
                            onValueChange={(v) => setVideoType(v as VideoType)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(VIDEO_TYPE_CONFIG).map(([type, config]) => (
                                    <SelectItem key={type} value={type}>
                                        <div className="flex items-center gap-2">
                                            <span>{config.name}</span>
                                            <Badge variant="outline" className="text-xs">
                                                {config.creditsPerMinute}算力/分钟
                                            </Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {VIDEO_TYPE_CONFIG[videoType].description}
                        </p>
                    </div>

                    {/* 视频时长 */}
                    <div className="space-y-2">
                        <Label>视频时长</Label>
                        <RadioGroup
                            value={String(videoDuration)}
                            onValueChange={(v) => setVideoDuration(Number(v) as 16 | 24 | 32)}
                            className="flex gap-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="16" id="d16" />
                                <Label htmlFor="d16">16秒</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="24" id="d24" />
                                <Label htmlFor="d24">24秒</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="32" id="d32" />
                                <Label htmlFor="d32">32秒</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* 人物性别 */}
                    <div className="space-y-2">
                        <Label>人物性别</Label>
                        <RadioGroup
                            value={videoGender}
                            onValueChange={(v) => setVideoGender(v as 'male' | 'female')}
                            className="flex gap-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="female" id="female" />
                                <Label htmlFor="female">女</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="male" id="male" />
                                <Label htmlFor="male">男</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* 语言 */}
                    <div className="space-y-2">
                        <Label>视频语言</Label>
                        <Select
                            value={videoLanguage}
                            onValueChange={(v) => setVideoLanguage(v as any)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="zh-CN">中文</SelectItem>
                                <SelectItem value="en-US">英文</SelectItem>
                                <SelectItem value="ja-JP">日语</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 算力预估 */}
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm">预估算力消耗</span>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800">
                            {calculateCredits()} 算力
                        </Badge>
                    </div>
                </div>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* 按钮组 */}
            <div className="flex gap-3">
                <Button
                    variant="outline"
                    onClick={() => setCurrentStep('setup')}
                    className="flex-1"
                >
                    上一步
                </Button>
                <Button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600"
                >
                    {generating ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            生成中...
                        </>
                    ) : (
                        <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            开始生成
                        </>
                    )}
                </Button>
            </div>
        </div>
    );

    // 渲染结果
    const renderResultStep = () => (
        <div className="space-y-4">
            {copywriteResult && (
                <>
                    {/* 标题 */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            生成标题
                        </Label>
                        <div className="p-3 bg-gray-50 rounded-lg font-medium">
                            {copywriteResult.title}
                        </div>
                    </div>

                    {/* 完整文案 */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            完整文案 ({copywriteResult.wordCount}字)
                        </Label>
                        <div className="p-3 bg-gray-50 rounded-lg whitespace-pre-wrap text-sm max-h-64 overflow-y-auto">
                            {copywriteResult.fullContent}
                        </div>
                    </div>

                    {/* 标签 */}
                    <div className="flex flex-wrap gap-2">
                        {copywriteResult.hashtags.map((tag, i) => (
                            <Badge key={i} variant="secondary">#{tag}</Badge>
                        ))}
                    </div>
                </>
            )}

            {/* 按钮 */}
            <div className="flex gap-3">
                <Button
                    variant="outline"
                    onClick={() => {
                        setCurrentStep('setup');
                        setCopywriteResult(null);
                    }}
                    className="flex-1"
                >
                    重新生成
                </Button>
                <Button className="flex-1">
                    <Check className="mr-2 h-4 w-4" />
                    确认并添加到队列
                </Button>
            </div>
        </div>
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-pink-500" />
                    AI 内容创作
                    {accountPersona && (
                        <Badge variant="outline" className="ml-2">
                            <User className="h-3 w-3 mr-1" />
                            {accountPersona}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* 步骤指示器 */}
                <div className="flex items-center gap-2 mb-6">
                    {['setup', 'format', 'result'].map((step, i) => (
                        <div
                            key={step}
                            className={`flex items-center gap-2 ${currentStep === step ? 'text-pink-600' : 'text-gray-400'
                                }`}
                        >
                            <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${currentStep === step
                                        ? 'bg-pink-500 text-white'
                                        : currentStep === 'result' || (currentStep === 'format' && i === 0)
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-200'
                                    }`}
                            >
                                {currentStep === 'result' || (currentStep === 'format' && i === 0) ? (
                                    <Check className="h-3 w-3" />
                                ) : (
                                    i + 1
                                )}
                            </div>
                            <span className="text-sm hidden sm:inline">
                                {step === 'setup' ? '产品信息' : step === 'format' ? '内容形式' : '生成结果'}
                            </span>
                            {i < 2 && <ChevronRight className="h-4 w-4" />}
                        </div>
                    ))}
                </div>

                {/* 步骤内容 */}
                {currentStep === 'setup' && renderSetupStep()}
                {(currentStep === 'format' || currentStep === 'generating') && renderFormatStep()}
                {currentStep === 'result' && renderResultStep()}
            </CardContent>
        </Card>
    );
}
