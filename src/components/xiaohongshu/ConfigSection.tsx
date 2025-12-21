import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Play, CheckCircle } from 'lucide-react';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';
import { xiaohongshuSupabase } from '@/lib/xiaohongshu-supabase';
import { MaterialUpload } from './MaterialUpload';
import { ContentModeConfig } from './ContentModeConfig';
import { AgentProgressPanel } from '@/components/workflow';
import { WorkflowMode } from '@/types/workflow';
import type { UserProfile, GlobalProductProfile } from '@/types/xiaohongshu';

interface ConfigSectionProps {
  supabaseUuid: string;
  xhsUserId: string;
  initialConfig?: UserProfile | null;
  onConfigSaved: (profile: UserProfile) => void;
  onStartOperation: () => void;
}

export function ConfigSection({
  supabaseUuid,
  xhsUserId,
  initialConfig,
  onConfigSaved,
  onStartOperation,
}: ConfigSectionProps) {
  const [productName, setProductName] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [marketingGoal, setMarketingGoal] = useState<'brand' | 'sales' | 'traffic' | 'community'>('brand');
  const [postFrequency, setPostFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('daily');
  const [brandStyle, setBrandStyle] = useState<'professional' | 'warm' | 'humorous' | 'minimalist'>('warm');
  const [reviewMode, setReviewMode] = useState<'auto' | 'manual'>('auto');

  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // 素材上传状态 (全局产品配置)
  const [materialImages, setMaterialImages] = useState<string[]>([]);
  const [materialDocuments, setMaterialDocuments] = useState<string[]>([]);
  const [materialAnalysis, setMaterialAnalysis] = useState<string>('');

  // 地区字段 (全局产品配置)
  const [region, setRegion] = useState<string>('');

  // 产品描述 (全局产品配置新字段)
  const [productDescription, setProductDescription] = useState<string>('');

  // 产品特色 (全局产品配置新字段)
  const [productFeatures, setProductFeatures] = useState<string>('');

  // 内容形式配置
  type ContentMode = 'IMAGE_TEXT' | 'UGC_VIDEO' | 'AVATAR_VIDEO';
  const [contentAutoMode, setContentAutoMode] = useState(false);
  const [selectedContentModes, setSelectedContentModes] = useState<ContentMode[]>(['IMAGE_TEXT']);
  const [avatarPhotoUrl, setAvatarPhotoUrl] = useState('');
  const [voiceSampleUrl, setVoiceSampleUrl] = useState('');
  const [avatarVideoDuration, setAvatarVideoDuration] = useState(150); // 默认2.5分钟
  const [ugcGender, setUgcGender] = useState<'male' | 'female'>('female');
  const [ugcLanguage, setUgcLanguage] = useState('zh-CN');
  const [ugcDuration, setUgcDuration] = useState(60);

  // Agent 进度面板
  const [showProgressPanel, setShowProgressPanel] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // 加载全局产品配置
  useEffect(() => {
    const loadGlobalProduct = async () => {
      try {
        const globalProduct = await xiaohongshuSupabase.getGlobalProductProfile(supabaseUuid);
        if (globalProduct) {
          setProductName(globalProduct.product_name);
          setProductDescription(globalProduct.product_description || '');
          setTargetAudience(globalProduct.target_audience || '');
          setMaterialImages(globalProduct.material_images || []);
          setMaterialDocuments(globalProduct.material_documents || []);
          setMaterialAnalysis(globalProduct.material_analysis || '');
          setRegion(globalProduct.region || '');
          setProductFeatures(globalProduct.product_features || '');
        }
      } catch (err) {
        console.error('Failed to load global product profile:', err);
      }
    };
    loadGlobalProduct();
  }, [supabaseUuid]);

  // 加载平台偏好配置
  useEffect(() => {
    if (initialConfig) {
      // 平台偏好字段
      setMarketingGoal(initialConfig.marketing_goal);
      setPostFrequency(initialConfig.post_frequency);
      setBrandStyle(initialConfig.brand_style);
      setReviewMode(initialConfig.review_mode);
      // 内容形式配置
      setAvatarPhotoUrl(initialConfig.avatar_photo_url || '');
      setVoiceSampleUrl(initialConfig.voice_sample_url || '');
      setAvatarVideoDuration(initialConfig.avatar_video_duration || 150);
      if (initialConfig.content_mode_preference) {
        setSelectedContentModes([initialConfig.content_mode_preference]);
      }
      setUgcGender(initialConfig.ugc_gender || 'female');
      setUgcLanguage(initialConfig.ugc_language || 'zh-CN');
      setUgcDuration(initialConfig.ugc_duration || 60);
      setSaved(true);
    }
  }, [initialConfig]);

  // 素材更新处理
  const handleMaterialsChange = (materials: {
    images: string[];
    documents: string[];
    analysis: string;
  }) => {
    setMaterialImages(materials.images);
    setMaterialDocuments(materials.documents);
    setMaterialAnalysis(materials.analysis);
    setSaved(false); // 标记为未保存
  };

  const validateForm = (): boolean => {
    if (!productName.trim()) {
      setError('请输入产品/服务名称');
      return false;
    }
    if (!targetAudience.trim()) {
      setError('请输入目标客户群体');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    setError('');

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      // 1. 保存全局产品配置
      const globalProduct: Partial<GlobalProductProfile> = {
        supabase_uuid: supabaseUuid,
        product_name: productName,
        product_description: productDescription,
        product_features: productFeatures,
        target_audience: targetAudience,
        material_images: materialImages,
        material_documents: materialDocuments,
        material_analysis: materialAnalysis,
        region: region || undefined,
      };
      await xiaohongshuSupabase.saveGlobalProductProfile(globalProduct);

      // 2. 保存平台偏好配置
      const platformPrefs: Partial<UserProfile> = {
        supabase_uuid: supabaseUuid,
        xhs_user_id: xhsUserId,
        product_name: productName, // 向后兼容
        target_audience: targetAudience, // 向后兼容
        marketing_goal: marketingGoal,
        post_frequency: postFrequency,
        brand_style: brandStyle,
        review_mode: reviewMode,
        content_mode_preference: selectedContentModes[0],
        avatar_photo_url: avatarPhotoUrl || undefined,
        voice_sample_url: voiceSampleUrl || undefined,
        avatar_video_duration: avatarVideoDuration,
        ugc_gender: ugcGender,
        ugc_language: ugcLanguage,
        ugc_duration: ugcDuration,
      };
      await xiaohongshuSupabase.saveUserProfile(platformPrefs);

      await xiaohongshuSupabase.addActivityLog({
        supabase_uuid: supabaseUuid,
        xhs_user_id: xhsUserId,
        activity_type: 'config',
        message: '保存产品配置',
        metadata: { globalProduct, platformPrefs },
      });

      setSaved(true);

      const savedProfile = await xiaohongshuSupabase.getUserProfile(supabaseUuid);
      if (savedProfile) {
        onConfigSaved(savedProfile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleStartOperation = async () => {
    setError('');

    if (!validateForm()) {
      return;
    }

    // 🔧 检查是否已绑定小红书账号
    if (!xhsUserId || xhsUserId === 'temp_user' || xhsUserId.startsWith('virtual_')) {
      setError('请先绑定小红书账号后再启动自动运营。点击返回账号页面进行扫码登录。');
      return;
    }

    try {
      setStarting(true);

      // 🔥 自动保存配置（如果尚未保存）
      if (!saved) {
        // 保存全局产品配置
        const globalProduct: Partial<GlobalProductProfile> = {
          supabase_uuid: supabaseUuid,
          product_name: productName,
          product_description: productDescription,
          target_audience: targetAudience,
          material_images: materialImages,
          material_documents: materialDocuments,
          material_analysis: materialAnalysis,
          region: region || undefined,
        };
        await xiaohongshuSupabase.saveGlobalProductProfile(globalProduct);

        // 保存平台偏好配置
        const platformPrefs: Partial<UserProfile> = {
          supabase_uuid: supabaseUuid,
          xhs_user_id: xhsUserId,
          product_name: productName,
          target_audience: targetAudience,
          marketing_goal: marketingGoal,
          post_frequency: postFrequency,
          brand_style: brandStyle,
          review_mode: reviewMode,
          content_mode_preference: selectedContentModes[0],
          avatar_photo_url: avatarPhotoUrl || undefined,
          voice_sample_url: voiceSampleUrl || undefined,
          ugc_gender: ugcGender,
          ugc_language: ugcLanguage,
          ugc_duration: ugcDuration,
        };
        await xiaohongshuSupabase.saveUserProfile(platformPrefs);

        await xiaohongshuSupabase.addActivityLog({
          supabase_uuid: supabaseUuid,
          xhs_user_id: xhsUserId,
          activity_type: 'config',
          message: '自动保存产品配置',
          metadata: { globalProduct, platformPrefs },
        });

        setSaved(true);

        const savedProfile = await xiaohongshuSupabase.getUserProfile(supabaseUuid);
        if (savedProfile) {
          onConfigSaved(savedProfile);
        }
      }

      // 启动自动运营
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setCurrentTaskId(taskId);

      // 🔥 立即显示进度面板
      setShowProgressPanel(true);

      const response = await xiaohongshuAPI.startAutoOperation(xhsUserId, {
        productName,
        targetAudience,
        marketingGoal,
        postFrequency,
        brandStyle,
        reviewMode,
        taskId, // 传递任务ID
      });

      if (response.success) {
        await xiaohongshuSupabase.saveAutomationStatus({
          supabase_uuid: supabaseUuid,
          xhs_user_id: xhsUserId,
          is_running: true,
          is_logged_in: true,
          has_config: true,
          last_activity: new Date().toISOString(),
          uptime_seconds: 0,
        });

        await xiaohongshuSupabase.addActivityLog({
          supabase_uuid: supabaseUuid,
          xhs_user_id: xhsUserId,
          activity_type: 'start',
          message: '启动自动运营',
          metadata: { productName, marketingGoal, postFrequency, taskId },
        });

        onStartOperation();
      } else {
        setError(response.message || '启动失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动自动运营失败');
    } finally {
      setStarting(false);
    }
  };

  // 获取工作流模式
  const getWorkflowMode = (): WorkflowMode => {
    const mode = selectedContentModes[0] || 'IMAGE_TEXT';
    switch (mode) {
      case 'UGC_VIDEO': return WorkflowMode.UGC_VIDEO;
      case 'AVATAR_VIDEO': return WorkflowMode.AVATAR_VIDEO;
      default: return WorkflowMode.IMAGE_TEXT;
    }
  };

  // 如果显示进度面板，渲染全屏进度视图
  if (showProgressPanel) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <AgentProgressPanel
          taskId={currentTaskId || undefined}
          mode={getWorkflowMode()}
          onClose={() => {
            setShowProgressPanel(false);
          }}
          onComplete={(result) => {
            console.log('Workflow completed:', result);
            setShowProgressPanel(false);
          }}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold">
            2
          </div>
          📝 产品信息配置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="productName">产品/服务名称 *</Label>
            <Input
              id="productName"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="例如：手工咖啡、编程课程..."
              disabled={saving || starting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetAudience">目标客户群体 *</Label>
            <Input
              id="targetAudience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="例如：25-35岁女性白领..."
              disabled={saving || starting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">目标地区</Label>
            <Input
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="输入目标地区，如: 武汉、Sydney、California"
              disabled={saving || starting}
            />
            <p className="text-xs text-muted-foreground">可选，用于舆情分析定位热点</p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="productFeatures">产品特色</Label>
            <Textarea
              id="productFeatures"
              value={productFeatures}
              onChange={(e) => setProductFeatures(e.target.value)}
              placeholder="描述产品的核心卖点、差异化优势、独特价值主张..."
              rows={3}
              disabled={saving || starting}
            />
            <p className="text-xs text-muted-foreground">产品的独特亮点，用于AI生成内容策略</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="marketingGoal">营销目标</Label>
            <Select value={marketingGoal} onValueChange={(v: any) => setMarketingGoal(v)} disabled={saving || starting}>
              <SelectTrigger id="marketingGoal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brand">品牌宣传</SelectItem>
                <SelectItem value="sales">销售转化</SelectItem>
                <SelectItem value="traffic">流量获取</SelectItem>
                <SelectItem value="community">社区建设</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="postFrequency">发布频率</Label>
            <Select value={postFrequency} onValueChange={(v: any) => setPostFrequency(v)} disabled={saving || starting}>
              <SelectTrigger id="postFrequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">每日一篇</SelectItem>
                <SelectItem value="weekly">每周2-3篇</SelectItem>
                <SelectItem value="biweekly">每两周一篇</SelectItem>
                <SelectItem value="monthly">每月一篇</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brandStyle">品牌风格</Label>
            <Select value={brandStyle} onValueChange={(v: any) => setBrandStyle(v)} disabled={saving || starting}>
              <SelectTrigger id="brandStyle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">专业严谨</SelectItem>
                <SelectItem value="warm">温暖亲切</SelectItem>
                <SelectItem value="humorous">幽默风趣</SelectItem>
                <SelectItem value="minimalist">简约大气</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reviewMode">审核模式</Label>
            <Select value={reviewMode} onValueChange={(v: any) => setReviewMode(v)} disabled={saving || starting}>
              <SelectTrigger id="reviewMode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">自动发布</SelectItem>
                <SelectItem value="manual">人工审核</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 素材上传组件 */}
        <div className="pt-4 border-t">
          <MaterialUpload
            supabaseUuid={supabaseUuid}
            initialImages={materialImages}
            initialDocuments={materialDocuments}
            initialAnalysis={materialAnalysis}
            onMaterialsChange={handleMaterialsChange}
          />
        </div>

        {/* 内容形式配置 */}
        <div className="pt-4 border-t">
          <ContentModeConfig
            supabaseUuid={supabaseUuid}
            initialModes={selectedContentModes}
            initialAutoMode={contentAutoMode}
            initialAvatarPhoto={avatarPhotoUrl}
            initialVoiceSample={voiceSampleUrl}
            initialAvatarVideoDuration={avatarVideoDuration}
            initialUgcGender={ugcGender}
            initialUgcLanguage={ugcLanguage}
            initialUgcDuration={ugcDuration}
            onConfigChange={(config) => {
              setContentAutoMode(config.autoMode);
              setSelectedContentModes(config.selectedModes);
              setAvatarPhotoUrl(config.avatarPhotoUrl || '');
              setVoiceSampleUrl(config.voiceSampleUrl || '');
              setAvatarVideoDuration(config.avatarVideoDuration || 150);
              setUgcGender(config.ugcGender || 'female');
              setUgcLanguage(config.ugcLanguage || 'zh-CN');
              setUgcDuration(config.ugcDuration || 60);
              setSaved(false);
            }}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {saved && !error && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              配置已保存！
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving || starting}
            variant="outline"
            className="flex-1"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                保存配置
              </>
            )}
          </Button>

          <Button
            onClick={handleStartOperation}
            disabled={!productName.trim() || !targetAudience.trim() || saving || starting}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
          >
            {starting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                启动中...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                启动自动运营
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
