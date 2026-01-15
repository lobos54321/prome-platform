import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowRight, Package } from 'lucide-react';
import { useXiaohongshuStore } from '@/stores/xiaohongshu-store';
import { xiaohongshuSupabase } from '@/lib/xiaohongshu-supabase';
import { MaterialUpload } from '../MaterialUpload';
import type { GlobalProductProfile, UserProfile } from '@/types/xiaohongshu';

interface ProductConfigSectionProps {
  onNext: () => void;
}

export function ProductConfigSection({ onNext }: ProductConfigSectionProps) {
  // Store state
  const { identity, data, actions } = useXiaohongshuStore();
  const supabaseUuid = identity.supabaseUuid;

  // Local form state
  const [productName, setProductName] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [region, setRegion] = useState('');
  const [productFeatures, setProductFeatures] = useState('');
  const [productDescription, setProductDescription] = useState('');

  // Materials state
  const [materialImages, setMaterialImages] = useState<string[]>([]);
  const [materialDocuments, setMaterialDocuments] = useState<string[]>([]);
  const [materialAnalysis, setMaterialAnalysis] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (!supabaseUuid) return;

      try {
        setLoading(true);
        // Try to load GlobalProductProfile first
        const globalProduct = await xiaohongshuSupabase.getGlobalProductProfile(supabaseUuid);

        if (globalProduct) {
          setProductName(globalProduct.product_name || '');
          setProductDescription(globalProduct.product_description || '');
          setTargetAudience(globalProduct.target_audience || '');
          setProductFeatures(globalProduct.product_features || '');
          setRegion(globalProduct.region || '');
          setMaterialImages(globalProduct.material_images || []);
          setMaterialDocuments(globalProduct.material_documents || []);
          setMaterialAnalysis(globalProduct.material_analysis || '');
        } else if (data.profile) {
          // Fallback to existing UserProfile data if global profile doesn't exist
          setProductName(data.profile.product_name || '');
          setTargetAudience(data.profile.target_audience || '');
          setRegion(data.profile.region || '');
        }
      } catch (err) {
        console.error('Failed to load product config:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabaseUuid, data.profile]);

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

  const handleNext = async () => {
    setError('');

    if (!validateForm()) {
      return;
    }

    if (!supabaseUuid) {
      setError('系统错误：未获取到用户ID');
      return;
    }

    try {
      setSaving(true);

      // 1. Save GlobalProductProfile (全局产品配置)
      const globalProduct: Partial<GlobalProductProfile> = {
        supabase_uuid: supabaseUuid,
        product_name: productName,
        product_description: productDescription,
        product_features: productFeatures,
        target_audience: targetAudience,
        region: region || undefined,
        material_images: materialImages,
        material_documents: materialDocuments,
        material_analysis: materialAnalysis,
      };

      await xiaohongshuSupabase.saveGlobalProductProfile(globalProduct);

      // 2. 准备 UserProfile 更新数据
      const userProfileUpdates: Partial<UserProfile> = {
        product_name: productName,
        target_audience: targetAudience,
        region: region || undefined,
      };

      // 3. 先保存到数据库，成功后再更新 Store (保证数据一致性)
      if (identity.xhsUserId) {
        const platformPrefs: Partial<UserProfile> = {
            supabase_uuid: supabaseUuid,
            xhs_user_id: identity.xhsUserId,
            ...userProfileUpdates
        };
        await xiaohongshuSupabase.saveUserProfile(platformPrefs);
      }

      // 4. 数据库保存成功后，更新 Store
      await actions.updateProfile(userProfileUpdates);

      // Proceed to next step
      onNext();
    } catch (err) {
      console.error('Save failed:', err);
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">产品基础信息</h2>
        <p className="text-gray-500 mt-2">
          告诉我们您的产品或服务信息，AI 将为您定制专属的营销内容
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Basic Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="w-5 h-5 text-blue-500" />
                基本信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productName">产品/服务名称 *</Label>
                <Input
                  id="productName"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="例如：手工咖啡、编程课程..."
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetAudience">目标客户群体 *</Label>
                <Input
                  id="targetAudience"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="例如：25-35岁女性白领..."
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">目标地区 (可选)</Label>
                <Input
                  id="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="例如：上海、Sydney..."
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">用于精准定位地域性流量和热点</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productFeatures">产品特色/卖点</Label>
                <Textarea
                  id="productFeatures"
                  value={productFeatures}
                  onChange={(e) => setProductFeatures(e.target.value)}
                  placeholder="您的产品有哪些独特优势？解决什么痛点？"
                  rows={4}
                  disabled={saving}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Materials */}
        <div className="space-y-6">
          <Card className="h-full flex flex-col">
             <CardHeader>
              <CardTitle className="text-lg">素材资料</CardTitle>
              <CardDescription>
                上传产品图片或文档，AI 将自动提取关键信息
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {supabaseUuid && (
                <MaterialUpload
                  supabaseUuid={supabaseUuid}
                  initialImages={materialImages}
                  initialDocuments={materialDocuments}
                  initialAnalysis={materialAnalysis}
                  onMaterialsChange={(materials) => {
                    setMaterialImages(materials.images);
                    setMaterialDocuments(materials.documents);
                    setMaterialAnalysis(materials.analysis);
                  }}
                  compact={true}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end pt-6 border-t">
        <Button
          onClick={handleNext}
          disabled={saving || !productName.trim() || !targetAudience.trim()}
          size="lg"
          className="w-full md:w-auto px-8 bg-blue-600 hover:bg-blue-700"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              下一步：绑定账号
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
