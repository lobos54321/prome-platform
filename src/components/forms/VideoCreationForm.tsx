import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Video, 
  Clock, 
  FileText, 
  User, 
  Send, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ImageSelector from './ImageSelector';

interface VideoFormData {
  duration: string;
  productDescription: string;
  imageUrl: string;
  characterGender: string;
  language: string;
}

interface VideoCreationFormProps {
  onSubmit: (data: VideoFormData) => void;
  isLoading?: boolean;
  className?: string;
}

export interface VideoCreationFormRef {
  refreshCredits: () => void;
}

interface UserCredits {
  credits: number;
  hasEnoughCredits: boolean;
}

const VideoCreationForm = forwardRef<VideoCreationFormRef, VideoCreationFormProps>(({ onSubmit, isLoading = false, className = '' }, ref) => {
  console.log('🚀 VideoCreationForm 组件已加载', { onSubmit: !!onSubmit, isLoading, className });
  const { t } = useTranslation();
  const { user } = useAuth();
  const [formData, setFormData] = useState<VideoFormData>({
    duration: '16',
    productDescription: '',
    imageUrl: '',
    characterGender: '',
    language: 'en-US'
  });
  const [errors, setErrors] = useState<Partial<VideoFormData>>({});
  const [userCredits, setUserCredits] = useState<UserCredits>({ credits: 0, hasEnoughCredits: false });
  const [isCheckingCredits, setIsCheckingCredits] = useState(false);

  const validateImageUrl = (url: string): boolean => {
    if (!url) return false;
    const urlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;
    return urlPattern.test(url);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<VideoFormData> = {};

    if (!formData.duration) {
      newErrors.duration = t('video.validation_duration_required', 'Please select video duration');
    }

    if (!formData.productDescription.trim()) {
      newErrors.productDescription = t('video.validation_description_required', 'Please enter product description');
    } else if (formData.productDescription.trim().length < 10) {
      newErrors.productDescription = t('video.validation_description_min', 'Product description needs at least 10 characters');
    }

    if (!formData.imageUrl.trim()) {
      newErrors.imageUrl = t('video.validation_image_required', 'Please enter product image URL');
    } else if (!validateImageUrl(formData.imageUrl)) {
      newErrors.imageUrl = t('video.validation_image_invalid', 'Please enter a valid image URL (must end with .jpg, .jpeg, .png or .webp)');
    }

    if (!formData.characterGender) {
      newErrors.characterGender = t('video.validation_gender_required', 'Please select character gender');
    }

    if (!formData.language) {
      newErrors.language = t('video.validation_language_required', 'Please select video language');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🎯 Form submission started');
    console.log('📊 Current form state:', {
      formData,
      isLoading,
      userCredits,
      errors
    });
    
    if (isLoading) {
      console.log('⏸️ Form is submitting, ignoring duplicate click');
      return;
    }

    const isValid = validateForm();
    console.log('✅ Form validation result:', isValid);
    console.log('📝 Current errors after validation:', errors);
    
    if (isValid) {
      // Check credits before submission
      const requiredCredits = calculateCredits(formData.duration);
      console.log('💰 Credits check:', {
        required: requiredCredits,
        userCredits: userCredits
      });
      
      const hasEnough = await checkUserCredits(requiredCredits);
      console.log('💰 Credits sufficient:', hasEnough);
      
      if (!hasEnough) {
        console.log('❌ Insufficient credits, blocking submission');
        setErrors({ duration: t('video.insufficient_credits', 'Insufficient credits for this duration') });
        return;
      }
      
      console.log('📤 All checks passed, calling onSubmit with data:', formData);
      try {
        onSubmit(formData);
        console.log('✅ onSubmit called successfully');
      } catch (error) {
        console.error('❌ onSubmit call failed:', error);
      }
    } else {
      console.log('❌ Form validation failed, not submitting');
    }
  };

  const handleInputChange = (field: keyof VideoFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const calculateCredits = (duration: string): number => {
    const durationNum = parseInt(duration);
    const segments = Math.ceil(durationNum / 8);
    
    // Google Veo 3 Fast: $0.15/秒 * 1.2 = $0.18/秒 * 8秒 = $1.44 每8秒段
    // Nano Banana: $0.020 * 1.2 = $0.024 每次使用
    // 视频合并: $0.30 每个视频
    const costPerSegment = (0.18 * 8) + 0.024; // $1.464 每8秒段
    const mergingCost = 0.30; // 视频合并费用
    const totalCost = (costPerSegment * segments) + mergingCost;
    
    // 转换为积分 (10美金 = 10000积分)
    return Math.round(totalCost * 1000);
  };

  const checkUserCredits = async (requiredCredits: number): Promise<boolean> => {
    setIsCheckingCredits(true);
    try {
      const currentUser = user;
      if (!currentUser?.id) {
        console.warn('No authenticated user for credits check');
        return false;
      }
      
      const response = await fetch('/api/video/check-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUser.id, credits: requiredCredits }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.hasEnoughCredits;
      }
      return false;
    } catch (error) {
      console.error('Error checking credits:', error);
      return false;
    } finally {
      setIsCheckingCredits(false);
    }
  };

  const loadUserCredits = async () => {
    try {
      const currentUser = user;
      if (!currentUser?.id) {
        console.warn('No authenticated user for credits loading');
        setUserCredits({ credits: 0, hasEnoughCredits: false });
        return;
      }
      
      const response = await fetch(`/api/video/balance/${currentUser.id}`);
      if (response.ok) {
        const data = await response.json();
        const requiredCredits = calculateCredits(formData.duration);
        setUserCredits({
          credits: data.credits, // This comes from balance * 1000
          hasEnoughCredits: data.credits >= requiredCredits
        });
      }
    } catch (error) {
      console.error('Error loading user credits:', error);
    }
  };

  // Load user credits on component mount and when duration/user changes
  useEffect(() => {
    if (user?.id) {
      loadUserCredits();
    }
  }, [formData.duration, user?.id]);

  // Expose refresh function to parent component via ref
  useImperativeHandle(ref, () => ({
    refreshCredits: () => {
      console.log('🔄 Refreshing credits from external trigger');
      loadUserCredits();
    }
  }));

  const formatFormDataForN8n = (): string => {
    const credits = calculateCredits(formData.duration);
    return `${t('video.preview_request_title', 'Video Creation Request')}:

🎬 ${t('video.duration', 'Video Duration')}: ${formData.duration} ${t('video.seconds', 'seconds')}
💰 ${t('video.required_credits', 'Required Credits')}: ${credits}${t('video.credits_unit', ' credits')}
📝 ${t('video.product_description', 'Product Description')}: ${formData.productDescription}
🖼️ ${t('video.product_image', 'Product Image')}: ${formData.imageUrl}
👤 ${t('video.character_gender', 'Character Gender')}: ${formData.characterGender}
🌍 ${t('video.language', 'Video Language')}: ${formData.language}

${t('video.preview_footer', 'Please create video content based on the above information.')}`;
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center mb-4">
            <Video className="h-6 w-6 text-purple-600 mr-2" />
            <div>
              <CardTitle>{t('video.form_title', 'Video Creation Form')}</CardTitle>
              <CardDescription>{t('video.form_description', 'Please fill out the following 4 questions to create your video content')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => {
            console.log('📝 Form onSubmit directly triggered');
            handleSubmit(e);
          }} className="space-y-6">
            {/* 1. 视频时长 */}
            <div className="space-y-2">
              <Label className="flex items-center text-base font-semibold">
                <Clock className="h-4 w-4 mr-2 text-purple-600" />
                1. {t('video.duration', 'Video Duration')}
              </Label>
              <Select 
                value={formData.duration} 
                onValueChange={(value) => handleInputChange('duration', value)}
              >
                <SelectTrigger className={errors.duration ? 'border-red-500' : ''}>
                  <SelectValue placeholder={t('video.duration_placeholder', 'Select video duration')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8{t('video.seconds', 'sec')} (1764{t('video.credits_unit', ' credits')})</SelectItem>
                  <SelectItem value="16">16{t('video.seconds', 'sec')} (3528{t('video.credits_unit', ' credits')})</SelectItem>
                  <SelectItem value="24">24{t('video.seconds', 'sec')} (5292{t('video.credits_unit', ' credits')})</SelectItem>
                  <SelectItem value="32">32{t('video.seconds', 'sec')} (7056{t('video.credits_unit', ' credits')})</SelectItem>
                  <SelectItem value="40">40{t('video.seconds', 'sec')} (8820{t('video.credits_unit', ' credits')})</SelectItem>
                  <SelectItem value="48">48{t('video.seconds', 'sec')} (10584{t('video.credits_unit', ' credits')})</SelectItem>
                  <SelectItem value="56">56{t('video.seconds', 'sec')} (12348{t('video.credits_unit', ' credits')})</SelectItem>
                  <SelectItem value="64">64{t('video.seconds', 'sec')} (14112{t('video.credits_unit', ' credits')})</SelectItem>
                </SelectContent>
              </Select>
              {errors.duration && (
                <p className="text-sm text-red-500 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {errors.duration}
                </p>
              )}
              <p className="text-sm text-gray-500">
                {t('video.duration_hint', 'Fee includes: Google Veo 3 Fast + Nano Banana + video merging. Credits will be deducted after successful video generation.')}
              </p>
            </div>

            {/* 2. 产品描述 */}
            <div className="space-y-2">
              <Label className="flex items-center text-base font-semibold">
                <FileText className="h-4 w-4 mr-2 text-purple-600" />
                2. {t('video.product_description', 'Product Description')}
              </Label>
              <Textarea
                value={formData.productDescription}
                onChange={(e) => handleInputChange('productDescription', e.target.value)}
                placeholder={t('video.product_description_placeholder', 'Please describe your product features, advantages, etc. in detail...')}
                rows={4}
                className={errors.productDescription ? 'border-red-500' : ''}
              />
              {errors.productDescription && (
                <p className="text-sm text-red-500 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {errors.productDescription}
                </p>
              )}
              <p className="text-sm text-gray-500">
                {t('video.description_hint', 'The more detailed the description, the more accurate the generated video content. Please include the core selling points of your product.')}
              </p>
            </div>

            {/* 3. 产品图片 - 使用ImageSelector */}
            <ImageSelector
              value={formData.imageUrl}
              onChange={(imageUrl) => handleInputChange('imageUrl', imageUrl)}
              error={errors.imageUrl}
              className="space-y-2"
            />

            {/* 4. 人物性别 */}
            <div className="space-y-2">
              <Label className="flex items-center text-base font-semibold">
                <User className="h-4 w-4 mr-2 text-purple-600" />
                4. {t('video.character_gender', 'Character Gender')}
              </Label>
              <Select 
                value={formData.characterGender} 
                onValueChange={(value) => handleInputChange('characterGender', value)}
              >
                <SelectTrigger className={errors.characterGender ? 'border-red-500' : ''}>
                  <SelectValue placeholder={t('video.character_gender_placeholder', 'Select character gender')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t('video.gender_male', 'Male')}</SelectItem>
                  <SelectItem value="female">{t('video.gender_female', 'Female')}</SelectItem>
                  <SelectItem value="neutral">{t('video.gender_neutral', 'Neutral/Any')}</SelectItem>
                </SelectContent>
              </Select>
              {errors.characterGender && (
                <p className="text-sm text-red-500 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {errors.characterGender}
                </p>
              )}
              <p className="text-sm text-gray-500">{t('video.gender_hint', 'Choose the most suitable spokesperson gender for your product')}</p>
            </div>

            {/* 5. 视频语言 */}
            <div className="space-y-2">
              <Label className="flex items-center text-base font-semibold">
                <svg className="h-4 w-4 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                5. {t('video.language', 'Video Language')}
              </Label>
              <Select 
                value={formData.language} 
                onValueChange={(value) => handleInputChange('language', value)}
              >
                <SelectTrigger className={errors.language ? 'border-red-500' : ''}>
                  <SelectValue placeholder={t('video.language_placeholder', 'Select video language')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh-CN">中文</SelectItem>
                  <SelectItem value="en-US">English</SelectItem>
                  <SelectItem value="ja-JP">日本語</SelectItem>
                  <SelectItem value="ko-KR">한국어</SelectItem>
                  <SelectItem value="es-ES">Español</SelectItem>
                  <SelectItem value="fr-FR">Français</SelectItem>
                  <SelectItem value="de-DE">Deutsch</SelectItem>
                  <SelectItem value="it-IT">Italiano</SelectItem>
                  <SelectItem value="pt-BR">Português</SelectItem>
                  <SelectItem value="ru-RU">Русский</SelectItem>
                  <SelectItem value="ar-SA">العربية</SelectItem>
                  <SelectItem value="hi-IN">हिन्दी</SelectItem>
                  <SelectItem value="th-TH">ไทย</SelectItem>
                  <SelectItem value="vi-VN">Tiếng Việt</SelectItem>
                </SelectContent>
              </Select>
              {errors.language && (
                <p className="text-sm text-red-500 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {errors.language}
                </p>
              )}
              <p className="text-sm text-gray-500">{t('video.language_hint', 'Veo 3 Fast supports multiple languages, choose the most suitable language for your product')}</p>
            </div>

            {/* 预览生成的消息 */}
            {formData.productDescription && formData.imageUrl && formData.characterGender && formData.language && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  {t('video.preview_title', 'Information to be sent to AI:')}
                </h4>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap">{formatFormDataForN8n()}</pre>
              </div>
            )}

            {/* 积分余额显示 */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2 text-blue-800">
                {t('video.credits_balance', 'Current Credits Balance')}
              </h4>
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-blue-600">
                  {userCredits.credits.toLocaleString()} {t('video.credits_unit', 'credits')}
                </span>
                <span className="text-sm text-gray-600">
                  ≈ ${(userCredits.credits / 1000).toFixed(2)}
                </span>
              </div>
              {!userCredits.hasEnoughCredits && (
                <div className="mt-2 text-red-600 text-sm">
                  {t('video.insufficient_credits_warning', 'Insufficient credits for this video duration')}
                </div>
              )}
            </div>

            {/* 提交按钮 */}
            <Button 
              type="submit" 
              className={`w-full text-white ${userCredits.hasEnoughCredits ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-400 cursor-not-allowed'}`}
              size="lg"
              disabled={isLoading || !userCredits.hasEnoughCredits || isCheckingCredits}
              onClick={(e) => {
                console.log('🖱️ 按钮直接点击事件触发');
                console.log('🔍 当前isLoading:', isLoading);
                console.log('🔍 按钮是否disabled:', e.currentTarget.disabled);
                console.log('🔍 userCredits:', userCredits);
              }}
            >
              {isCheckingCredits ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t('video.checking_credits', 'Checking Credits...')}
                </>
              ) : isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t('video.submitted', 'Processing...')}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {userCredits.hasEnoughCredits 
                    ? t('video.send_to_ai', 'Send to AI to Create Video')
                    : t('video.insufficient_credits_button', 'Insufficient Credits')
                  }
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
});

VideoCreationForm.displayName = 'VideoCreationForm';

export default VideoCreationForm;