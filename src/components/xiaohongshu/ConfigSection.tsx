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
import type { UserProfile } from '@/types/xiaohongshu';

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

  useEffect(() => {
    if (initialConfig) {
      setProductName(initialConfig.product_name);
      setTargetAudience(initialConfig.target_audience || '');
      setMarketingGoal(initialConfig.marketing_goal);
      setPostFrequency(initialConfig.post_frequency);
      setBrandStyle(initialConfig.brand_style);
      setReviewMode(initialConfig.review_mode);
      setSaved(true);
    }
  }, [initialConfig]);

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
      
      const profile: Partial<UserProfile> = {
        supabase_uuid: supabaseUuid,
        xhs_user_id: xhsUserId,
        product_name: productName,
        target_audience: targetAudience,
        marketing_goal: marketingGoal,
        post_frequency: postFrequency,
        brand_style: brandStyle,
        review_mode: reviewMode,
      };

      await xiaohongshuSupabase.saveUserProfile(profile);
      
      await xiaohongshuSupabase.addActivityLog({
        supabase_uuid: supabaseUuid,
        xhs_user_id: xhsUserId,
        activity_type: 'config',
        message: '保存产品配置',
        metadata: profile,
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
    
    if (!saved) {
      setError('请先保存配置');
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setStarting(true);

      const response = await xiaohongshuAPI.startAutoOperation(xhsUserId, {
        productName,
        targetAudience,
        marketingGoal,
        postFrequency,
        brandStyle,
        reviewMode,
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
          metadata: { productName, marketingGoal, postFrequency },
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

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {saved && !error && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              配置已保存！可以启动自动运营了。
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
            disabled={!saved || saving || starting}
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
