import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2, Package, Target, Globe2, Sparkles, Play } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MaterialUpload } from '@/components/xiaohongshu/MaterialUpload';
import { ContentModeStep } from '@/components/xiaohongshu/ContentModeStep';
import { userMappingService } from '@/lib/xiaohongshu-user-mapping';
import { PlatformSwitcher } from '@/components/ui/PlatformSwitcher';

// 平台列表
const PLATFORMS = [
    { id: 'xiaohongshu', name: '小红书', icon: '📕', status: 'ready', description: '中国领先的生活方式社区' },
    { id: 'x', name: 'X (Twitter)', icon: '𝕏', status: 'coming_soon', description: '全球实时社交媒体' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵', status: 'coming_soon', description: '短视频娱乐平台' },
    { id: 'threads', name: 'Threads', icon: '📱', status: 'coming_soon', description: 'Meta 文字社交应用' },
    { id: 'youtube', name: 'YouTube', icon: '▶️', status: 'coming_soon', description: '全球最大视频平台' },
];

type Step = 'config' | 'platforms' | 'content-mode' | 'redirect';

interface ProductConfig {
    productName: string;
    targetAudience: string;
    region: string;
    marketingGoal: 'brand' | 'sales' | 'traffic' | 'community';
    postsPerDay: number; // 1-10 篇/天
    brandStyle: 'professional' | 'warm' | 'humorous' | 'minimalist';
    reviewMode: 'auto' | 'manual';
    materialImages: string[];
    materialDocuments: string[];
    materialAnalysis: string;
    // 🔥 新增：舆情开关
    enableSentiment: boolean;
}

export default function AutoMarketing() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState<Step>('config');
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // 产品配置状态
    const [config, setConfig] = useState<ProductConfig>({
        productName: '',
        targetAudience: '',
        region: '',
        marketingGoal: 'brand',
        postsPerDay: 1,
        brandStyle: 'warm',
        reviewMode: 'manual',
        materialImages: [],
        materialDocuments: [],
        materialAnalysis: '',
        // 🔥 默认启用舆情分析
        enableSentiment: true,
    });

    // 选中的平台
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

    // 🔥 当前激活的平台（多平台切换时使用）
    const [activePlatform, setActivePlatform] = useState<string>('');

    // 🔥 用于 ContentModeStep 的 xhsUserId
    const [xhsUserId, setXhsUserId] = useState<string>('');

    // 🔥 用户配置（从数据库加载，传给 ContentModeStep）
    const [userProfile, setUserProfile] = useState<any>(null);

    // 获取当前用户 + 加载已保存的配置
    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setCurrentUser(session?.user || null);
            if (session?.user) {
                // 获取或创建 xhsUserId
                try {
                    const userId = await userMappingService.getOrCreateMapping(session.user.id);
                    setXhsUserId(userId);
                } catch (err) {
                    console.error('Failed to get xhsUserId:', err);
                }

                // 🔥 加载已保存的用户配置
                try {
                    const { data: profile } = await supabase
                        .from('xhs_user_profiles')
                        .select('*')
                        .eq('supabase_uuid', session.user.id)
                        .single();

                    if (profile) {
                        console.log('✅ 已加载用户配置:', profile.product_name);
                        setUserProfile(profile);

                        // 恢复配置状态
                        setConfig({
                            productName: profile.product_name || '',
                            targetAudience: profile.target_audience || '',
                            region: profile.region || '',
                            marketingGoal: profile.marketing_goal || 'brand',
                            postsPerDay: profile.posts_per_day || 1,
                            brandStyle: profile.brand_style || 'warm',
                            reviewMode: profile.review_mode || 'manual',
                            materialImages: profile.material_images || [],
                            materialDocuments: profile.material_documents || [],
                            materialAnalysis: profile.material_analysis || '',
                            enableSentiment: true, // 默认启用
                        });

                        // 恢复已选平台
                        if (profile.target_platforms && profile.target_platforms.length > 0) {
                            setSelectedPlatforms(profile.target_platforms);
                            setActivePlatform(profile.target_platforms[0]);
                        }

                        // 🔥 根据已保存的数据决定初始步骤
                        if (profile.product_name && profile.target_audience) {
                            // 有产品配置
                            if (profile.target_platforms && profile.target_platforms.length > 0) {
                                // 有平台选择 -> 直接进入 content-mode
                                setCurrentStep('content-mode');
                            } else {
                                // 没有平台选择 -> 进入平台选择
                                setCurrentStep('platforms');
                            }
                        }
                        // 否则保持在 config 步骤
                    }
                } catch (err) {
                    console.log('首次使用，无已保存配置');
                }
            }
            setLoading(false);
        });
    }, []);

    // 是否需要登录
    if (!loading && !currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CardTitle>🔐 请先登录</CardTitle>
                        <CardDescription>登录后开始自动化营销</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button className="w-full" onClick={() => navigate('/login')}>
                            前往登录
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 验证产品配置
    const validateConfig = () => {
        if (!config.productName.trim()) {
            setError('请输入产品/服务名称');
            return false;
        }
        if (!config.targetAudience.trim()) {
            setError('请输入目标客户群体');
            return false;
        }
        return true;
    };

    // 保存配置并进入下一步
    const handleSaveConfig = async () => {
        setError('');
        if (!validateConfig()) return;

        try {
            setSaving(true);

            // 1. 保存到 global_product_profiles (ConfigSection 读取这个表)
            const { error: globalError } = await supabase
                .from('global_product_profiles')
                .upsert({
                    supabase_uuid: currentUser.id,
                    product_name: config.productName,
                    target_audience: config.targetAudience,
                    region: config.region,
                    material_images: config.materialImages,
                    material_documents: config.materialDocuments,
                    material_analysis: config.materialAnalysis,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'supabase_uuid' });

            if (globalError) {
                console.error('保存全局配置失败:', globalError);
                // 继续执行，不阻断流程
            }

            // 2. 保存到 xhs_user_profiles (平台偏好)
            const { error: saveError } = await supabase
                .from('xhs_user_profiles')
                .upsert({
                    supabase_uuid: currentUser.id,
                    xhs_user_id: 'pending', // 待绑定
                    product_name: config.productName,
                    target_audience: config.targetAudience,
                    region: config.region,
                    marketing_goal: config.marketingGoal,
                    brand_style: config.brandStyle,
                    posts_per_day: config.postsPerDay,  // 🔥 新增：每日发布篇数
                    material_images: config.materialImages,
                    material_documents: config.materialDocuments,
                    material_analysis: config.materialAnalysis,
                    post_frequency: 'daily',
                    review_mode: config.reviewMode,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'supabase_uuid' });

            if (saveError) {
                throw new Error(saveError.message);
            }

            console.log('✅ 配置已保存到两个表');

            // 进入平台选择步骤
            setCurrentStep('platforms');

        } catch (err) {
            setError(err instanceof Error ? err.message : '保存失败');
        } finally {
            setSaving(false);
        }
    };

    // 选择平台
    const togglePlatform = (platformId: string) => {
        const platform = PLATFORMS.find(p => p.id === platformId);
        if (platform?.status !== 'ready') return;

        setSelectedPlatforms(prev =>
            prev.includes(platformId)
                ? prev.filter(p => p !== platformId)
                : [...prev, platformId]
        );
    };

    // 进入平台运营
    const handleStartPlatform = async () => {
        if (selectedPlatforms.length === 0) {
            setError('请选择至少一个平台');
            return;
        }

        try {
            // 🔥 保存选择的平台到数据库，供后续变体生成使用
            await supabase
                .from('xhs_user_profiles')
                .update({
                    target_platforms: selectedPlatforms,
                    updated_at: new Date().toISOString(),
                })
                .eq('supabase_uuid', currentUser.id);

            console.log('✅ 目标平台已保存:', selectedPlatforms);

            // 🔥 加载用户配置传给 ContentModeStep
            const { data: profile } = await supabase
                .from('xhs_user_profiles')
                .select('*')
                .eq('supabase_uuid', currentUser.id)
                .single();

            if (profile) {
                setUserProfile(profile);
            }

            // 🔥 设置初始激活平台（默认第一个）
            setActivePlatform(selectedPlatforms[0]);

        } catch (err) {
            console.error('保存平台选择失败:', err);
            // 继续执行，不阻断流程
        }

        // 🔥 进入内容形式选择步骤
        // 多平台时使用 PlatformSwitcher 切换，单平台时直接显示该平台
        setCurrentStep('content-mode');
    };

    // 素材更新处理
    const handleMaterialsChange = (materials: { images: string[]; documents: string[]; analysis: string }) => {
        setConfig(prev => ({
            ...prev,
            materialImages: materials.images,
            materialDocuments: materials.documents,
            materialAnalysis: materials.analysis,
        }));
    };

    // 步骤指示器
    const StepIndicator = () => {
        const steps = [
            { key: 'config', label: '产品配置', icon: Package },
            { key: 'platforms', label: '选择平台', icon: Globe2 },
            { key: 'content-mode', label: '开始运营', icon: Play },
        ];

        const currentIndex = steps.findIndex(s => s.key === currentStep);

        return (
            <div className="flex items-center justify-center gap-4 mb-8">
                {steps.map((step, index) => {
                    const isActive = currentStep === step.key;
                    const isPast = index < currentIndex;
                    const Icon = step.icon;

                    return (
                        <div key={step.key} className="flex items-center gap-2">
                            {index > 0 && (
                                <div className={`w-12 h-0.5 ${isPast ? 'bg-green-500' : 'bg-gray-200'}`} />
                            )}
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${isActive
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                                : isPast
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-500'
                                }`}>
                                {isPast ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                <span className="font-medium">{step.label}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* 页面标题 */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center justify-center gap-2">
                        <Sparkles className="w-8 h-8 text-purple-500" />
                        AI 智能营销自动化
                    </h1>
                    <p className="text-gray-600 mt-2">一次配置，多平台自动运营</p>
                </div>

                {/* 步骤指示器 */}
                <StepIndicator />

                {/* 错误提示 */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-center">
                        {error}
                    </div>
                )}

                {/* Step 1: 产品配置 */}
                {currentStep === 'config' && (
                    <Card className="shadow-xl border-0">
                        <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-t-lg">
                            <CardTitle className="flex items-center gap-2">
                                <Package className="w-6 h-6" />
                                Step 1: 产品配置
                            </CardTitle>
                            <CardDescription className="text-purple-100">
                                告诉我们您的产品信息，AI 将为您定制营销策略
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="productName">产品/服务名称 *</Label>
                                    <Input
                                        id="productName"
                                        value={config.productName}
                                        onChange={(e) => setConfig(prev => ({ ...prev, productName: e.target.value }))}
                                        placeholder="例如：艺站美术培训"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="region">目标地区</Label>
                                    <Input
                                        id="region"
                                        value={config.region}
                                        onChange={(e) => setConfig(prev => ({ ...prev, region: e.target.value }))}
                                        placeholder="例如：武汉、Sydney、California"
                                    />
                                    <p className="text-xs text-muted-foreground">可选，用于舆情分析定位热点</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="targetAudience">目标客户群体 *</Label>
                                <Textarea
                                    id="targetAudience"
                                    value={config.targetAudience}
                                    onChange={(e) => setConfig(prev => ({ ...prev, targetAudience: e.target.value }))}
                                    placeholder="例如：6-12岁儿童家长，关注孩子艺术教育..."
                                    rows={3}
                                />
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>营销目标</Label>
                                    <Select
                                        value={config.marketingGoal}
                                        onValueChange={(v: any) => setConfig(prev => ({ ...prev, marketingGoal: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="brand">🎯 品牌宣传</SelectItem>
                                            <SelectItem value="sales">💰 销售转化</SelectItem>
                                            <SelectItem value="traffic">📈 流量获取</SelectItem>
                                            <SelectItem value="community">👥 社区建设</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>每日发布篇数</Label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            min="1"
                                            max="10"
                                            value={config.postsPerDay}
                                            onChange={(e) => setConfig(prev => ({ ...prev, postsPerDay: parseInt(e.target.value) }))}
                                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                        />
                                        <span className="w-16 text-center font-bold text-purple-600 bg-purple-50 rounded-lg py-2">
                                            {config.postsPerDay} 篇/天
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">滑动选择每天发布 1-10 篇内容</p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>品牌风格</Label>
                                    <Select
                                        value={config.brandStyle}
                                        onValueChange={(v: any) => setConfig(prev => ({ ...prev, brandStyle: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="professional">👔 专业权威</SelectItem>
                                            <SelectItem value="warm">🤗 温暖亲切</SelectItem>
                                            <SelectItem value="humorous">😄 幽默有趣</SelectItem>
                                            <SelectItem value="minimalist">✨ 简约高级</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>审核模式</Label>
                                    <Select
                                        value={config.reviewMode}
                                        onValueChange={(v: any) => setConfig(prev => ({ ...prev, reviewMode: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="auto">🤖 自动发布</SelectItem>
                                            <SelectItem value="manual">👁️ 人工审核</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* 🔥 舆情分析开关 */}
                                <div className="space-y-2">
                                    <Label>舆情热点分析</Label>
                                    <div
                                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                                            config.enableSentiment
                                                ? 'bg-orange-50 border-orange-200'
                                                : 'bg-gray-50 border-gray-200'
                                        }`}
                                        onClick={() => setConfig(prev => ({ ...prev, enableSentiment: !prev.enableSentiment }))}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{config.enableSentiment ? '🔥' : '⏸️'}</span>
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {config.enableSentiment ? '已启用舆情分析' : '舆情分析已关闭'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {config.enableSentiment
                                                        ? '自动获取热门话题和关键词（每天缓存）'
                                                        : '使用 AI 智能创作，不分析市场热点'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${
                                            config.enableSentiment ? 'bg-orange-500' : 'bg-gray-300'
                                        }`}>
                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                                config.enableSentiment ? 'translate-x-6' : 'translate-x-0'
                                            }`} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 产品素材：文档+图片+视频 */}
                            <div className="pt-4 border-t">
                                <div className="mb-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        📦 产品素材
                                    </h3>
                                    <p className="text-sm text-muted-foreground">上传文档、图片、视频，然后 AI 分析</p>
                                </div>
                                <MaterialUpload
                                    supabaseUuid={currentUser?.id || ''}
                                    initialImages={config.materialImages}
                                    initialDocuments={config.materialDocuments}
                                    initialAnalysis={config.materialAnalysis}
                                    onMaterialsChange={handleMaterialsChange}
                                    compact={true}
                                />
                            </div>

                            {/* 下一步按钮 */}
                            <div className="flex justify-end pt-4">
                                <Button
                                    onClick={handleSaveConfig}
                                    disabled={saving}
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            保存中...
                                        </>
                                    ) : (
                                        <>
                                            保存并选择平台
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: 平台选择 */}
                {currentStep === 'platforms' && (
                    <Card className="shadow-xl border-0">
                        <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-t-lg">
                            <CardTitle className="flex items-center gap-2">
                                <Globe2 className="w-6 h-6" />
                                Step 2: 选择目标平台
                            </CardTitle>
                            <CardDescription className="text-blue-100">
                                选择您想要自动运营的社交媒体平台
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            {/* 产品配置摘要 */}
                            <div className="mb-6 p-4 bg-purple-50 rounded-lg">
                                <div className="flex items-center gap-2 text-purple-700 font-medium mb-2">
                                    <CheckCircle2 className="w-5 h-5" />
                                    产品配置已保存
                                </div>
                                <p className="text-sm text-purple-600">
                                    <strong>{config.productName}</strong> · {config.region || '全球'} · {
                                        config.marketingGoal === 'brand' ? '品牌宣传' :
                                            config.marketingGoal === 'sales' ? '销售转化' :
                                                config.marketingGoal === 'traffic' ? '流量获取' : '社区建设'
                                    }
                                </p>
                            </div>

                            {/* 平台列表 */}
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {PLATFORMS.map(platform => {
                                    const isSelected = selectedPlatforms.includes(platform.id);
                                    const isReady = platform.status === 'ready';

                                    return (
                                        <div
                                            key={platform.id}
                                            onClick={() => togglePlatform(platform.id)}
                                            className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${!isReady
                                                ? 'opacity-60 cursor-not-allowed bg-gray-50 border-gray-200'
                                                : isSelected
                                                    ? 'border-purple-500 bg-purple-50 shadow-lg'
                                                    : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                                                }`}
                                        >
                                            {/* 选中标记 */}
                                            {isSelected && (
                                                <div className="absolute top-2 right-2">
                                                    <CheckCircle2 className="w-6 h-6 text-purple-500" />
                                                </div>
                                            )}

                                            {/* 即将推出标记 */}
                                            {!isReady && (
                                                <Badge className="absolute top-2 right-2 bg-gray-500">
                                                    即将推出
                                                </Badge>
                                            )}

                                            <div className="text-3xl mb-2">{platform.icon}</div>
                                            <h3 className="font-bold text-lg">{platform.name}</h3>
                                            <p className="text-sm text-gray-500">{platform.description}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 操作按钮 */}
                            <div className="flex justify-between pt-6 mt-6 border-t">
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentStep('config')}
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    返回修改
                                </Button>

                                <Button
                                    onClick={handleStartPlatform}
                                    disabled={selectedPlatforms.length === 0}
                                    className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                                >
                                    下一步
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 3: 内容形式偏好 + 启动运营 */}
                {currentStep === 'content-mode' && currentUser && xhsUserId && (
                    <div className="space-y-4">
                        {/* 🔥 多平台切换器 - 当选择多个平台时显示 */}
                        {selectedPlatforms.length > 1 && (
                            <PlatformSwitcher
                                platforms={selectedPlatforms}
                                activePlatform={activePlatform}
                                onPlatformChange={setActivePlatform}
                                className="sticky top-4 z-10"
                            />
                        )}

                        <ContentModeStep
                            supabaseUuid={currentUser.id}
                            xhsUserId={xhsUserId}
                            userProfile={userProfile}
                            activePlatform={activePlatform || selectedPlatforms[0]}
                            enableSentiment={config.enableSentiment}
                            onComplete={() => {
                                // 🔥 运营完成后跳转到对应平台的管理页面
                                const platform = activePlatform || selectedPlatforms[0] || 'xiaohongshu';
                                const platformRoutes: Record<string, string> = {
                                    xiaohongshu: '/xiaohongshu-manager',
                                    x: '/x',
                                    tiktok: '/tiktok',
                                    threads: '/threads',
                                    youtube: '/youtube',
                                };
                                navigate(platformRoutes[platform] || '/xiaohongshu-manager');
                            }}
                            onViewDashboard={() => {
                                // 🔥 查看仪表盘也跳转到对应平台
                                const platform = activePlatform || selectedPlatforms[0] || 'xiaohongshu';
                                const platformRoutes: Record<string, string> = {
                                    xiaohongshu: '/xiaohongshu-manager',
                                    x: '/x',
                                    tiktok: '/tiktok',
                                    threads: '/threads',
                                    youtube: '/youtube',
                                };
                                navigate(platformRoutes[platform] || '/xiaohongshu-manager');
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
