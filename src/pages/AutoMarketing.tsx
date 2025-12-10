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
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2, Package, Target, Globe2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MaterialUpload } from '@/components/xiaohongshu/MaterialUpload';

// 平台列表
const PLATFORMS = [
    { id: 'xiaohongshu', name: '小红书', icon: '📕', status: 'ready', description: '中国领先的生活方式社区' },
    { id: 'x', name: 'X (Twitter)', icon: '𝕏', status: 'coming_soon', description: '全球实时社交媒体' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵', status: 'coming_soon', description: '短视频娱乐平台' },
    { id: 'threads', name: 'Threads', icon: '📱', status: 'coming_soon', description: 'Meta 文字社交应用' },
    { id: 'youtube', name: 'YouTube', icon: '▶️', status: 'coming_soon', description: '全球最大视频平台' },
];

type Step = 'config' | 'platforms' | 'redirect';

interface ProductConfig {
    productName: string;
    targetAudience: string;
    region: string;
    marketingGoal: 'brand' | 'sales' | 'traffic' | 'community';
    postFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    brandStyle: 'professional' | 'warm' | 'humorous' | 'minimalist';
    reviewMode: 'auto' | 'manual';
    materialImages: string[];
    materialDocuments: string[];
    materialAnalysis: string;
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
        postFrequency: 'daily',
        brandStyle: 'warm',
        reviewMode: 'manual',
        materialImages: [],
        materialDocuments: [],
        materialAnalysis: '',
    });

    // 选中的平台
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

    // 获取当前用户
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setCurrentUser(session?.user || null);
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

            // 保存到 Supabase user_profiles
            const { error: saveError } = await supabase
                .from('user_profiles')
                .upsert({
                    supabase_uuid: currentUser.id,
                    xhs_user_id: 'pending', // 待绑定
                    product_name: config.productName,
                    target_audience: config.targetAudience,
                    region: config.region,
                    marketing_goal: config.marketingGoal,
                    brand_style: config.brandStyle,
                    material_images: config.materialImages,
                    material_documents: config.materialDocuments,
                    material_analysis: config.materialAnalysis,
                    post_frequency: config.postFrequency,
                    review_mode: config.reviewMode,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'supabase_uuid' });

            if (saveError) {
                throw new Error(saveError.message);
            }

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
    const handleStartPlatform = () => {
        if (selectedPlatforms.length === 0) {
            setError('请选择至少一个平台');
            return;
        }

        // 目前只支持小红书，直接跳转
        if (selectedPlatforms.includes('xiaohongshu')) {
            navigate('/xiaohongshu');
        }
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
    const StepIndicator = () => (
        <div className="flex items-center justify-center gap-4 mb-8">
            {[
                { key: 'config', label: '产品配置', icon: Package },
                { key: 'platforms', label: '选择平台', icon: Globe2 },
            ].map((step, index) => {
                const isActive = currentStep === step.key;
                const isPast = (currentStep === 'platforms' && step.key === 'config');
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
                                    <Label>发布频率</Label>
                                    <Select
                                        value={config.postFrequency}
                                        onValueChange={(v: any) => setConfig(prev => ({ ...prev, postFrequency: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="daily">📅 每日一篇</SelectItem>
                                            <SelectItem value="weekly">📆 每周2-3篇</SelectItem>
                                            <SelectItem value="biweekly">🗓️ 每两周一篇</SelectItem>
                                            <SelectItem value="monthly">📅 每月一篇</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                            </div>

                            {/* 素材上传 */}
                            <div className="pt-4 border-t">
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
                                    开始运营
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
