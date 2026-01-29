import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, ArrowLeft, Play, Target, Calendar, Palette, Eye, AlertCircle } from 'lucide-react';
import { useXiaohongshuStore } from '@/stores/xiaohongshu-store';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';
import { xiaohongshuSupabase } from '@/lib/xiaohongshu-supabase';
import { ContentModeConfig } from '../ContentModeConfig';
import { AgentProgressPanel } from '@/components/workflow';
import { WorkflowMode } from '@/types/workflow';
import type { UserProfile } from '@/types/xiaohongshu';

interface PreferencesSectionProps {
  onPrev: () => void;
  onComplete: () => void;
}

type MarketingGoal = 'brand' | 'sales' | 'traffic' | 'community';
type PostFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
type BrandStyle = 'professional' | 'warm' | 'humorous' | 'minimalist';
type ReviewMode = 'auto' | 'manual';

const MARKETING_GOALS: { value: MarketingGoal; label: string; description: string }[] = [
  { value: 'brand', label: '品牌曝光', description: '提升品牌知名度和影响力' },
  { value: 'sales', label: '销售转化', description: '直接推动产品销售' },
  { value: 'traffic', label: '引流获客', description: '获取更多潜在客户' },
  { value: 'community', label: '社群运营', description: '建立活跃的粉丝社群' },
];

const POST_FREQUENCIES: { value: PostFrequency; label: string; description: string }[] = [
  { value: 'daily', label: '每日', description: '每天发布 1 篇' },
  { value: 'weekly', label: '每周', description: '每周发布 2-3 篇' },
  { value: 'biweekly', label: '隔周', description: '每两周发布 1-2 篇' },
  { value: 'monthly', label: '每月', description: '每月发布 3-4 篇' },
];

const BRAND_STYLES: { value: BrandStyle; label: string; description: string }[] = [
  { value: 'professional', label: '专业', description: '专业权威的内容风格' },
  { value: 'warm', label: '温暖', description: '亲切友好的互动风格' },
  { value: 'humorous', label: '幽默', description: '轻松有趣的内容调性' },
  { value: 'minimalist', label: '简约', description: '简洁清晰的表达方式' },
];

const REVIEW_MODES: { value: ReviewMode; label: string; description: string }[] = [
  { value: 'manual', label: '手动审核', description: '每篇内容需要您确认后再发布' },
  { value: 'auto', label: '自动发布', description: '系统自动发布生成的内容' },
];

export function PreferencesSection({ onPrev, onComplete }: PreferencesSectionProps) {
  const { identity, data, actions } = useXiaohongshuStore();
  const { supabaseUuid, xhsUserId } = identity;

  // Local form state
  const [marketingGoal, setMarketingGoal] = useState<MarketingGoal>('brand');
  const [postFrequency, setPostFrequency] = useState<PostFrequency>('weekly');
  const [brandStyle, setBrandStyle] = useState<BrandStyle>('warm');
  const [reviewMode, setReviewMode] = useState<ReviewMode>('manual');
  const [contentMode, setContentMode] = useState<'IMAGE_TEXT' | 'UGC_VIDEO' | 'AVATAR_VIDEO'>('IMAGE_TEXT');

  // Content mode config data
  const [contentModeConfig, setContentModeConfig] = useState<{
    selectedModes: ('IMAGE_TEXT' | 'UGC_VIDEO' | 'AVATAR_VIDEO')[];
    avatarPhotoUrl?: string;
    voiceSampleUrl?: string;
    avatarVideoDuration?: number;
    ugcGender?: 'male' | 'female';
    ugcLanguage?: string;
    ugcDuration?: number;
  }>({ selectedModes: ['IMAGE_TEXT'] });

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Workflow state
  const [showProgressPanel, setShowProgressPanel] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [selectedWorkflowMode, setSelectedWorkflowMode] = useState<WorkflowMode>(WorkflowMode.IMAGE_TEXT);

  // Load initial data from profile
  useEffect(() => {
    const loadData = async () => {
      if (!supabaseUuid) return;

      try {
        setLoading(true);
        const profile = data.profile;

        if (profile) {
          setMarketingGoal((profile.marketing_goal as MarketingGoal) || 'brand');
          setPostFrequency((profile.post_frequency as PostFrequency) || 'weekly');
          setBrandStyle((profile.brand_style as BrandStyle) || 'warm');
          setReviewMode((profile.review_mode as ReviewMode) || 'manual');

          if (profile.content_mode_preference) {
            const mode = profile.content_mode_preference as 'IMAGE_TEXT' | 'UGC_VIDEO' | 'AVATAR_VIDEO';
            setContentMode(mode);
            setContentModeConfig(prev => ({ ...prev, selectedModes: [mode] }));

            // Set workflow mode
            switch (mode) {
              case 'UGC_VIDEO':
                setSelectedWorkflowMode(WorkflowMode.UGC_VIDEO);
                break;
              case 'AVATAR_VIDEO':
                setSelectedWorkflowMode(WorkflowMode.AVATAR_VIDEO);
                break;
              default:
                setSelectedWorkflowMode(WorkflowMode.IMAGE_TEXT);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load preferences:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabaseUuid, data.profile]);

  const handleContentModeChange = (config: any) => {
    setContentModeConfig(config);
    if (config.selectedModes.length > 0) {
      const mode = config.selectedModes[0];
      setContentMode(mode);

      switch (mode) {
        case 'UGC_VIDEO':
          setSelectedWorkflowMode(WorkflowMode.UGC_VIDEO);
          break;
        case 'AVATAR_VIDEO':
          setSelectedWorkflowMode(WorkflowMode.AVATAR_VIDEO);
          break;
        default:
          setSelectedWorkflowMode(WorkflowMode.IMAGE_TEXT);
      }
    }
  };

  const handleStartOperation = async () => {
    if (!supabaseUuid || !xhsUserId) {
      setError('系统错误：用户信息缺失');
      return;
    }

    const productName = data.profile?.product_name;
    if (!productName) {
      setError('产品信息不完整，请返回重新配置');
      return;
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      setSaving(true);
      setError('');

      // 1. Save preferences to profile
      const profileUpdates: Partial<UserProfile> = {
        supabase_uuid: supabaseUuid,
        xhs_user_id: xhsUserId,
        marketing_goal: marketingGoal,
        post_frequency: postFrequency,
        brand_style: brandStyle,
        review_mode: reviewMode,
        content_mode_preference: contentMode,
        avatar_photo_url: contentModeConfig.avatarPhotoUrl,
        voice_sample_url: contentModeConfig.voiceSampleUrl,
        avatar_video_duration: contentModeConfig.avatarVideoDuration,
        ugc_gender: contentModeConfig.ugcGender,
        ugc_language: contentModeConfig.ugcLanguage,
        ugc_duration: contentModeConfig.ugcDuration,
      };

      await xiaohongshuSupabase.saveUserProfile(profileUpdates);
      await actions.updateProfile(profileUpdates);

      // 2. Start automation via backend API
      const response = await xiaohongshuAPI.startAutoOperation(xhsUserId, {
        productName: productName,
        targetAudience: data.profile?.target_audience || '',
        marketingGoal: marketingGoal,
        postFrequency: postFrequency,
        brandStyle: brandStyle,
        reviewMode: reviewMode,
        taskId,
        contentModePreference: contentMode,
        targetPlatforms: data.profile?.target_platforms || ['xiaohongshu'],
      });

      if (!response.success) {
        throw new Error(response.message || '启动失败');
      }

      // 3. Update automation status in Supabase
      await xiaohongshuSupabase.saveAutomationStatus({
        supabase_uuid: supabaseUuid,
        xhs_user_id: xhsUserId,
        is_running: true,
        is_logged_in: true,
        has_config: true,
        last_activity: new Date().toISOString(),
        uptime_seconds: 0,
      });

      // 4. Log activity
      await xiaohongshuSupabase.addActivityLog({
        supabase_uuid: supabaseUuid,
        xhs_user_id: xhsUserId,
        activity_type: 'start',
        message: '从设置向导启动自动运营',
        metadata: {
          productName,
          mode: contentMode,
          taskId,
        },
      });

      // 5. Update store workflow state
      actions.startWorkflow(selectedWorkflowMode, taskId);

      // 6. Show progress panel
      setCurrentTaskId(taskId);
      setShowProgressPanel(true);
    } catch (err) {
      console.error('Start operation failed:', err);
      setError(err instanceof Error ? err.message : '启动失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleWorkflowComplete = () => {
    setShowProgressPanel(false);
    setCurrentTaskId(null);
    actions.completeWorkflow();
    onComplete();
  };

  // Render progress panel if workflow is running
  if (showProgressPanel) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <AgentProgressPanel
          taskId={currentTaskId || undefined}
          mode={selectedWorkflowMode}
          supabaseUuid={supabaseUuid || undefined}
          productName={data.profile?.product_name}
          marketingGoal={marketingGoal}
          postFrequency={postFrequency}
          targetPlatforms={data.profile?.target_platforms || ['xiaohongshu']}
          onRegeneratePlatformVariant={async (platform, prompt) => {
            console.log(`🔄 重新生成 ${platform} 平台变体...`);
            const result = await xiaohongshuAPI.regeneratePlatformVariant(platform, prompt);
            if (result.success && result.data) {
              return result.data;
            }
            console.error('重新生成变体失败:', result.error);
            return null;
          }}
          onClose={() => {
            setShowProgressPanel(false);
            setCurrentTaskId(null);
            actions.cancelWorkflow();
          }}
          onComplete={handleWorkflowComplete}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">运营偏好设置</h2>
        <p className="text-gray-500 mt-2">
          选择您的营销目标和内容风格，系统将为您定制专属策略
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Marketing Goal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5 text-blue-500" />
              营销目标
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={marketingGoal}
              onValueChange={(v) => setMarketingGoal(v as MarketingGoal)}
              className="space-y-2"
            >
              {MARKETING_GOALS.map((goal) => (
                <div
                  key={goal.value}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    marketingGoal === goal.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setMarketingGoal(goal.value)}
                >
                  <RadioGroupItem value={goal.value} id={`goal-${goal.value}`} />
                  <div className="flex-1">
                    <Label htmlFor={`goal-${goal.value}`} className="font-medium cursor-pointer">
                      {goal.label}
                    </Label>
                    <p className="text-xs text-gray-500">{goal.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Post Frequency */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-green-500" />
              发布频率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={postFrequency}
              onValueChange={(v) => setPostFrequency(v as PostFrequency)}
              className="space-y-2"
            >
              {POST_FREQUENCIES.map((freq) => (
                <div
                  key={freq.value}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    postFrequency === freq.value
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setPostFrequency(freq.value)}
                >
                  <RadioGroupItem value={freq.value} id={`freq-${freq.value}`} />
                  <div className="flex-1">
                    <Label htmlFor={`freq-${freq.value}`} className="font-medium cursor-pointer">
                      {freq.label}
                    </Label>
                    <p className="text-xs text-gray-500">{freq.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Brand Style */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="w-5 h-5 text-purple-500" />
              品牌调性
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={brandStyle}
              onValueChange={(v) => setBrandStyle(v as BrandStyle)}
              className="space-y-2"
            >
              {BRAND_STYLES.map((style) => (
                <div
                  key={style.value}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    brandStyle === style.value
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setBrandStyle(style.value)}
                >
                  <RadioGroupItem value={style.value} id={`style-${style.value}`} />
                  <div className="flex-1">
                    <Label htmlFor={`style-${style.value}`} className="font-medium cursor-pointer">
                      {style.label}
                    </Label>
                    <p className="text-xs text-gray-500">{style.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Review Mode */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="w-5 h-5 text-orange-500" />
              发布方式
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={reviewMode}
              onValueChange={(v) => setReviewMode(v as ReviewMode)}
              className="space-y-2"
            >
              {REVIEW_MODES.map((mode) => (
                <div
                  key={mode.value}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    reviewMode === mode.value
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setReviewMode(mode.value)}
                >
                  <RadioGroupItem value={mode.value} id={`review-${mode.value}`} />
                  <div className="flex-1">
                    <Label htmlFor={`review-${mode.value}`} className="font-medium cursor-pointer">
                      {mode.label}
                    </Label>
                    <p className="text-xs text-gray-500">{mode.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      </div>

      {/* Content Mode Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">内容形式偏好</CardTitle>
          <CardDescription>
            选择您希望系统生成的内容类型
          </CardDescription>
        </CardHeader>
        <CardContent>
          {supabaseUuid && (
            <ContentModeConfig
              supabaseUuid={supabaseUuid}
              initialModes={[contentMode]}
              initialAvatarPhoto={data.profile?.avatar_photo_url}
              initialVoiceSample={data.profile?.voice_sample_url}
              initialAvatarVideoDuration={data.profile?.avatar_video_duration}
              initialUgcGender={data.profile?.ugc_gender as 'male' | 'female' | undefined}
              initialUgcLanguage={data.profile?.ugc_language}
              initialUgcDuration={data.profile?.ugc_duration}
              onConfigChange={handleContentModeChange}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 上一步
        </Button>
        <Button
          onClick={handleStartOperation}
          disabled={saving}
          size="lg"
          className="px-8 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在启动...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              启动运营
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
