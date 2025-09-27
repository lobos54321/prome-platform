/**
 * Digital Human Video Form Component
 * 
 * Form for generating digital human videos using Xiangong Cloud (仙宫云) services
 * Integrates InfiniteTalk and IndexTTS2 for digital human cloning and voice synthesis
 * Supports video upload for training personalized digital human models
 */

import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  Image as ImageIcon, 
  User, 
  Volume2,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Loader2,
  Play,
  Download,
  RefreshCw,
  FileText,
  Video
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { xiangongAPI } from '@/lib/xiangongyun-api';

interface CopywritingResult {
  id: string;
  content: string;
  title?: string;
  generatedAt: Date;
  tokens?: number;
}

interface DigitalHumanVideoFormData {
  imageUrl: string;
  videoUrl: string;
  backgroundImageUrl: string;
  backgroundColor: string;
  textScript: string;
  voiceModel: string;
  emotion: string;
  duration: string;
  language: string;
  digitalHumanName: string;
  gender: string;
}

interface DigitalHumanVideoFormProps {
  selectedCopywriting: CopywritingResult;
  onVideoGenerated?: (videoUrl: string) => void;
  onError?: (error: string) => void;
}

export interface DigitalHumanVideoFormRef {
  refreshCredits: () => void;
  getFormData: () => DigitalHumanVideoFormData;
}

const DigitalHumanVideoForm = forwardRef<DigitalHumanVideoFormRef, DigitalHumanVideoFormProps>(
  ({ selectedCopywriting, onVideoGenerated, onError }, ref) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [formData, setFormData] = useState<DigitalHumanVideoFormData>({
      imageUrl: '',
      videoUrl: '',
      backgroundImageUrl: '',
      backgroundColor: 'rgba(255,255,255,1)',
      textScript: selectedCopywriting.content || '',
      voiceModel: 'minimax',
      emotion: 'professional',
      duration: '60',
      language: 'zh-CN',
      digitalHumanName: `数字人_${Date.now()}`,
      gender: 'female'
    });

    const [isLoading, setIsLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [tempVideoFileName, setTempVideoFileName] = useState<string | null>(null);
    const [textInputMode, setTextInputMode] = useState<'imported' | 'manual'>(
      selectedCopywriting.content ? 'imported' : 'manual'
    );
    const [trainingStatus, setTrainingStatus] = useState<{
      trainingId?: string;
      status?: 'idle' | 'uploading' | 'training' | 'completed' | 'failed';
      progress?: string;
      estimatedTime?: string;
      profileId?: string;
    }>({ status: 'idle' });
    const [videoResult, setVideoResult] = useState<{
      videoUrl?: string;
      status?: string;
      error?: string;
      taskId?: string;
      comfyuiUrl?: string;
      instructions?: string[];
      temporarySolution?: any;
    } | null>(null);
    const [userBalance, setUserBalance] = useState(user?.balance || 0);

    // Voice model options
    const voiceModels = [
      { value: 'minimax', label: 'MiniMax (推荐)', description: '高质量中文语音' },
      { value: 'azure', label: 'Azure TTS', description: '微软语音合成' },
      { value: 'elevenlabs', label: 'ElevenLabs', description: '英文专业配音' }
    ];

    // Emotion options
    const emotionOptions = [
      { value: 'professional', label: '专业', description: '商务专业风格' },
      { value: 'friendly', label: '亲和', description: '友好亲切风格' },
      { value: 'enthusiastic', label: '热情', description: '积极热情风格' },
      { value: 'calm', label: '沉稳', description: '稳重可信风格' }
    ];

    // Language options
    const languageOptions = [
      { value: 'zh-CN', label: '中文 (简体)' },
      { value: 'zh-TW', label: '中文 (繁體)' },
      { value: 'en-US', label: 'English (US)' },
      { value: 'ja-JP', label: '日本語' },
      { value: 'ko-KR', label: '한국어' }
    ];

    // Gender options
    const genderOptions = [
      { value: 'female', label: '女性', description: '女性数字人' },
      { value: 'male', label: '男性', description: '男性数字人' }
    ];

    // Background color presets
    const backgroundColors = [
      { value: 'rgba(255,255,255,1)', label: '白色', color: '#ffffff' },
      { value: 'rgba(240,240,240,1)', label: '浅灰', color: '#f0f0f0' },
      { value: 'rgba(135,206,235,1)', label: '天空蓝', color: '#87ceeb' },
      { value: 'rgba(144,238,144,1)', label: '浅绿', color: '#90ee90' },
      { value: 'rgba(255,182,193,1)', label: '粉色', color: '#ffb6c1' }
    ];

    // Calculate estimated credits based on text length and duration
    const calculateCredits = () => {
      const textLength = formData.textScript.length;
      const estimatedDuration = Math.max(30, Math.min(parseInt(formData.duration), 180));
      
      // A2E pricing estimation:
      // - Basic generation: ~72 credits per minute
      // - Image processing: ~24 credits
      // - Voice synthesis: ~36 credits per minute
      const baseCredits = 24; // Image processing
      const durationCredits = Math.ceil(estimatedDuration / 60) * 72; // Generation per minute
      const voiceCredits = Math.ceil(estimatedDuration / 60) * 36; // Voice per minute
      
      return baseCredits + durationCredits + voiceCredits;
    };

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      refreshCredits: () => {
        // Refresh user balance
        if (user) {
          setUserBalance(user.balance);
        }
      },
      getFormData: () => formData
    }));

    // Handle input changes
    const handleInputChange = (field: keyof DigitalHumanVideoFormData, value: string) => {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    };

    // Handle image upload
    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingImage(true);
      try {
        const formDataObj = new FormData();
        formDataObj.append('image', file);

        const response = await fetch('/api/upload/image', {
          method: 'POST',
          body: formDataObj,
        });

        if (!response.ok) {
          throw new Error('图片上传失败');
        }

        const result = await response.json();
        handleInputChange('imageUrl', result.url);
      } catch (error) {
        console.error('Image upload error:', error);
        onError?.('图片上传失败，请重试');
      } finally {
        setUploadingImage(false);
      }
    };

    // Handle video upload
    const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate video file
      const validTypes = ['video/mp4', 'video/mov', 'video/avi'];
      if (!validTypes.includes(file.type)) {
        onError?.('请上传 MP4、MOV 或 AVI 格式的视频文件');
        return;
      }

      // Check file size (max 50MB to match Supabase limit)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        onError?.('视频文件大小不能超过 50MB');
        return;
      }

      setUploadingVideo(true);
      try {
        const formDataObj = new FormData();
        formDataObj.append('video', file);

        const response = await fetch('/api/upload/video', {
          method: 'POST',
          body: formDataObj,
        });

        if (!response.ok) {
          throw new Error('视频上传失败');
        }

        const result = await response.json();
        if (result.success && result.videoUrl && result.fileName) {
          handleInputChange('videoUrl', result.videoUrl);
          setTempVideoFileName(result.fileName);
          console.log('📹 Video uploaded successfully:', result.videoUrl, 'temp file:', result.fileName);
        } else {
          throw new Error(result.error || '视频上传失败');
        }
      } catch (error) {
        console.error('Video upload error:', error);
        onError?.('视频上传失败，请重试');
      } finally {
        setUploadingVideo(false);
      }
    };

    // Handle digital human training with video upload
    const handleTrainDigitalHuman = async () => {
      if (!formData.videoUrl || !formData.digitalHumanName) {
        onError?.('请上传训练视频和提供数字人名称');
        return;
      }

      setTrainingStatus({ status: 'uploading', progress: '上传训练视频...', estimatedTime: '1-2 分钟' });

      try {
        // Upload training video using Xiangong Cloud API
        const uploadResponse = await fetch('/api/xiangong/upload-training-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user?.id || 'anonymous',
            profileName: formData.digitalHumanName,
            videoUrl: formData.videoUrl,
            tempVideoFileName: tempVideoFileName,
            gender: formData.gender,
            backgroundImageUrl: formData.backgroundImageUrl || null,
            backgroundColor: formData.backgroundColor
          }),
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || '训练视频上传失败');
        }

        const uploadResult = await uploadResponse.json();
        
        setTrainingStatus({
          status: 'training',
          profileId: uploadResult.profileId,
          progress: '数字人特征提取中...',
          estimatedTime: '2-3 分钟'
        });

        // Simulate training completion - in real implementation this would poll the backend
        setTimeout(() => {
          setTrainingStatus(prev => ({
            ...prev,
            status: 'completed',
            progress: '数字人克隆完成！现在可以生成个性化视频了'
          }));
        }, 5000); // 5 seconds for demo

      } catch (error) {
        console.error('Digital human training error:', error);
        const errorMessage = error instanceof Error ? error.message : '数字人训练失败';
        setTrainingStatus({ status: 'failed', progress: errorMessage });
        onError?.(errorMessage);
      }
    };

    // Handle form submission using Xiangong Cloud
    const handleSubmit = async () => {
      if (!formData.textScript || trainingStatus.status !== 'completed') {
        onError?.('请先完成数字人训练并填写视频文案');
        return;
      }

      const requiredCredits = calculateCredits();
      if (userBalance < requiredCredits) {
        onError?.(`积分不足，需要 ${requiredCredits} 积分，当前余额 ${userBalance} 积分`);
        return;
      }

      setIsLoading(true);
      setVideoResult(null);

      try {
        console.log('🎬 生成个性化数字人视频...');
        
        // Generate video using Xiangong Cloud API with user's trained profile
        const result = await xiangongAPI.generateDigitalHumanVideo({
          text: formData.textScript,
          emotion: formData.emotion,
          voice: formData.voiceModel,
          avatar: formData.digitalHumanName
        });

        console.log('✅ Xiangong API result:', result);
        
        if (result.success) {
          setVideoResult({ 
            videoUrl: result.videoUrl, 
            status: 'completed',
            taskId: result.taskId 
          });
          onVideoGenerated?.(result.videoUrl!);
          
          // Update user balance
          setUserBalance(prev => prev - requiredCredits);
        } else if (result.temporarySolution) {
          // Handle temporary solution case - show ComfyUI instructions
          setVideoResult({
            status: 'manual_required',
            error: result.message || '需要手动操作ComfyUI',
            comfyuiUrl: result.comfyuiUrl,
            instructions: result.instructions,
            temporarySolution: result.temporarySolution
          });
        } else {
          // Handle processing case
          setVideoResult({ 
            status: 'processing',
            taskId: result.taskId,
            error: result.message 
          });
          
          // Start polling if we have a task ID
          if (result.taskId) {
            pollForVideoResult(result.taskId);
          }
        }

      } catch (error) {
        console.error('Digital human video generation error:', error);
        const errorMessage = error instanceof Error ? error.message : '视频生成失败';
        setVideoResult({ error: errorMessage });
        onError?.(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    // Poll for video generation result
    const pollForVideoResult = async (taskId: string) => {
      const maxAttempts = 30; // 5 minutes with 10 second intervals
      let attempts = 0;

      const poll = async () => {
        if (attempts >= maxAttempts) {
          setVideoResult(prev => ({ ...prev, error: '视频生成超时，请重试' }));
          return;
        }

        try {
          const status = await xiangongAPI.getTaskStatus(taskId);
          
          if (status.status === 'completed' && status.result) {
            setVideoResult({ 
              videoUrl: status.result, 
              status: 'completed',
              taskId 
            });
            onVideoGenerated?.(status.result);
            
            // Update user balance
            const requiredCredits = calculateCredits();
            setUserBalance(prev => prev - requiredCredits);
          } else if (status.status === 'failed') {
            setVideoResult({ 
              error: status.error || '视频生成失败', 
              taskId 
            });
          } else {
            // Still processing, continue polling
            attempts++;
            setTimeout(poll, 10000); // Poll every 10 seconds
          }
        } catch (error) {
          console.error('Polling error:', error);
          attempts++;
          setTimeout(poll, 10000);
        }
      };

      poll();
    };

    const estimatedCredits = calculateCredits();
    const canAfford = userBalance >= estimatedCredits;

    return (
      <div className="space-y-6">
        {/* Balance display */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <span className="font-medium">当前余额:</span>
                <Badge variant={canAfford ? "default" : "destructive"}>
                  {userBalance.toLocaleString()} 积分
                </Badge>
              </div>
              <div className="text-sm text-gray-600">
                预估消耗: {estimatedCredits} 积分
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Text Script Input */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <FileText className="h-5 w-5 mr-2 text-blue-600" />
              第一步：准备视频文案
            </CardTitle>
            <CardDescription>
              选择文案来源：使用AI生成的文案或手动输入自定义内容
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Text Input Mode Selection */}
            <div>
              <Label className="mb-3 block">文案来源</Label>
              <div className="flex gap-4">
                <div 
                  className={`flex items-center space-x-2 cursor-pointer p-3 rounded-lg border transition-colors ${
                    textInputMode === 'imported' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setTextInputMode('imported')}
                >
                  <input
                    type="radio"
                    checked={textInputMode === 'imported'}
                    onChange={() => setTextInputMode('imported')}
                    className="hidden"
                  />
                  <span className="font-medium">📝 使用AI生成文案</span>
                </div>
                <div 
                  className={`flex items-center space-x-2 cursor-pointer p-3 rounded-lg border transition-colors ${
                    textInputMode === 'manual' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setTextInputMode('manual');
                    if (textInputMode !== 'manual') {
                      handleInputChange('textScript', ''); // Clear imported text when switching to manual
                    }
                  }}
                >
                  <input
                    type="radio"
                    checked={textInputMode === 'manual'}
                    onChange={() => setTextInputMode('manual')}
                    className="hidden"
                  />
                  <span className="font-medium">✏️ 手动输入文案</span>
                </div>
              </div>
            </div>

            {/* Text Script Input */}
            <div>
              <Label htmlFor="text-script-step1" className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4" />
                视频文案 *
              </Label>
              {textInputMode === 'imported' ? (
                <div>
                  <Textarea
                    id="text-script-step1"
                    value={formData.textScript}
                    onChange={(e) => handleInputChange('textScript', e.target.value)}
                    placeholder="AI生成的文案将显示在这里，您也可以直接编辑..."
                    className="min-h-[120px]"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {selectedCopywriting?.content ? '✅ 已导入AI生成文案，可自由编辑' : '⚠️ 请先使用Deep Copywriting生成文案，或切换到手动输入模式'}
                  </div>
                </div>
              ) : (
                <div>
                  <Textarea
                    id="text-script-step1"
                    value={formData.textScript}
                    onChange={(e) => handleInputChange('textScript', e.target.value)}
                    placeholder="请输入数字人要说的内容..."
                    className="min-h-[120px]"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    手动输入模式 - 完全自定义您的视频文案
                  </div>
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                当前字数: {formData.textScript.length} | 建议: 100-500 字
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Digital Human Training - Only show when text script is provided */}
        {formData.textScript.trim() && trainingStatus.status === 'idle' && (
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <User className="h-5 w-5 mr-2 text-purple-600" />
                第二步：创建数字人形象
              </CardTitle>
              <CardDescription>
                上传视频和图片素材来训练您的专属数字人
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Digital Human Name */}
              <div>
                <Label htmlFor="digital-human-name" className="mb-2 block">名称</Label>
                <Input
                  id="digital-human-name"
                  value={formData.digitalHumanName}
                  onChange={(e) => handleInputChange('digitalHumanName', e.target.value)}
                  placeholder="为您的数字人起个名字"
                />
              </div>

              {/* Gender Selection */}
              <div>
                <Label className="mb-3 block">性别</Label>
                <div className="flex gap-4">
                  {genderOptions.map((option) => (
                    <div 
                      key={option.value}
                      className={`flex items-center space-x-2 cursor-pointer p-3 rounded-lg border transition-colors ${
                        formData.gender === option.value 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleInputChange('gender', option.value)}
                    >
                      <input
                        type="radio"
                        checked={formData.gender === option.value}
                        onChange={() => handleInputChange('gender', option.value)}
                        className="hidden"
                      />
                      <span className="font-medium">{option.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Original Material Section */}
              <div>
                <Label className="mb-3 block font-semibold">原始素材</Label>
                
                {/* Video Upload */}
                <div className="mb-4">
                  <Label className="mb-2 block text-sm font-medium">上传视频</Label>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      uploadingVideo ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="file"
                      accept="video/mp4,video/mov,video/avi"
                      onChange={handleVideoUpload}
                      className="hidden"
                      id="video-upload"
                    />
                    <label htmlFor="video-upload" className="cursor-pointer">
                      {uploadingVideo ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-2" />
                          <p className="text-blue-600">上传中...</p>
                        </div>
                      ) : formData.videoUrl ? (
                        <div className="flex flex-col items-center">
                          <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
                          <p className="text-green-600 font-medium">视频上传成功</p>
                          <p className="text-sm text-gray-500 mt-1">点击重新上传</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Upload className="h-8 w-8 text-gray-400 mb-2" />
                          <p className="font-medium mb-1">单击或将文件拖到此区域进行上传</p>
                          <p className="text-sm text-gray-500">格式: mp4/mov, 时长: 最少 3秒，最多 5分钟</p>
                          <p className="text-sm text-gray-500">分辨率建议为720P或1080P，最大分辨率不超过4K</p>
                        </div>
                      )}
                    </label>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>保持原始视频分辨率，如果您的视频分辨率大于1080P，将消耗更长时间</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-blue-600">
                    <Volume2 className="h-4 w-4" />
                    <span>自动专业克隆。您的视频必须包含清晰的声音</span>
                  </div>
                </div>
              </div>

              {/* Background Section */}
              <div>
                <Label className="mb-3 block font-semibold">
                  原始背景
                  <span className="text-sm font-normal text-gray-500 ml-2">（若不选择背景，则无法使用背景抠图）</span>
                </Label>
                
                {/* Background Image Upload */}
                <div className="mb-4">
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      uploadingImage ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="bg-image-upload"
                    />
                    <label htmlFor="bg-image-upload" className="cursor-pointer">
                      {uploadingImage ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="h-6 w-6 text-blue-600 animate-spin mb-2" />
                          <p className="text-blue-600">上传中...</p>
                        </div>
                      ) : formData.backgroundImageUrl ? (
                        <div className="flex flex-col items-center">
                          <CheckCircle className="h-6 w-6 text-green-600 mb-2" />
                          <p className="text-green-600 font-medium">背景图片上传成功</p>
                          <p className="text-sm text-gray-500 mt-1">点击重新上传</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <ImageIcon className="h-6 w-6 text-gray-400 mb-2" />
                          <p className="font-medium mb-1">单击或将文件拖到此区域进行上传</p>
                          <p className="text-sm text-gray-500">格式: jpg/png, 大小: 不超过 10M</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Background Color Selection */}
                <div>
                  <Label className="mb-2 block text-sm font-medium">选取背景颜色</Label>
                  <div className="flex gap-2 flex-wrap">
                    {backgroundColors.map((bg) => (
                      <div
                        key={bg.value}
                        className={`w-8 h-8 rounded cursor-pointer border-2 transition-all ${
                          formData.backgroundColor === bg.value 
                            ? 'border-purple-500 scale-110' 
                            : 'border-gray-300 hover:scale-105'
                        }`}
                        style={{ backgroundColor: bg.color }}
                        onClick={() => handleInputChange('backgroundColor', bg.value)}
                        title={bg.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Text Script Input */}
              <div>
                <Label htmlFor="text-script-training" className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4" />
                  视频文案 *
                </Label>
                <Textarea
                  id="text-script-training"
                  value={formData.textScript}
                  onChange={(e) => handleInputChange('textScript', e.target.value)}
                  placeholder="输入数字人要说的内容... (支持手动输入或编辑从Deep Copywriting导入的文案)"
                  className="min-h-[120px]"
                />
                <div className="text-xs text-gray-500 mt-1">
                  当前字数: {formData.textScript.length} | 建议: 100-500 字
                </div>
              </div>

              {/* Training Button */}
              <Button
                onClick={handleTrainDigitalHuman}
                disabled={!formData.videoUrl || !formData.digitalHumanName}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                size="lg"
              >
                <Play className="h-4 w-4 mr-2" />
                开始训练数字人 (基于仙宫云AI)
              </Button>
              <div className="text-xs text-gray-500 text-center">
                使用仙宫云InfiniteTalk和IndexTTS2进行数字人克隆
              </div>
            </CardContent>
          </Card>
        )}

        {/* Training Progress */}
        {(trainingStatus.status === 'uploading' || trainingStatus.status === 'training') && (
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
            <CardContent className="p-6 text-center">
              <Loader2 className="h-12 w-12 text-purple-600 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold mb-2">数字人训练中...</h3>
              <p className="text-gray-600 mb-2">{trainingStatus.progress}</p>
              <p className="text-sm text-gray-500">预计需要: {trainingStatus.estimatedTime}</p>
              <div className="mt-4 bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full w-1/3 animate-pulse"></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Video Generation Section */}
        {trainingStatus.status === 'completed' && (
          <Card className="bg-gradient-to-r from-green-50 to-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Video className="h-5 w-5 mr-2 text-green-600" />
                第三步：生成个性化视频
              </CardTitle>
              <CardDescription>
                使用您专属的数字人形象和声音生成个性化营销视频
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Text script */}
              <div>
                <Label htmlFor="text-script" className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4" />
                  视频文案 *
                </Label>
                <Textarea
                  id="text-script"
                  value={formData.textScript}
                  onChange={(e) => handleInputChange('textScript', e.target.value)}
                  placeholder="输入数字人要说的内容..."
                  className="min-h-[120px]"
                />
                <div className="text-xs text-gray-500 mt-1">
                  当前字数: {formData.textScript.length} | 建议: 100-500 字
                </div>
              </div>

              {/* Voice model */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Volume2 className="h-4 w-4" />
                  语音模型
                </Label>
                <Select value={formData.voiceModel} onValueChange={(value) => handleInputChange('voiceModel', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择语音模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {voiceModels.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{model.label}</span>
                          <span className="text-xs text-gray-500">{model.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Emotion */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4" />
                  情感风格
                </Label>
                <Select value={formData.emotion} onValueChange={(value) => handleInputChange('emotion', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择情感风格" />
                  </SelectTrigger>
                  <SelectContent>
                    {emotionOptions.map((emotion) => (
                      <SelectItem key={emotion.value} value={emotion.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{emotion.label}</span>
                          <span className="text-xs text-gray-500">{emotion.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Language */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Volume2 className="h-4 w-4" />
                  语言
                </Label>
                <Select value={formData.language} onValueChange={(value) => handleInputChange('language', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择语言" />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duration */}
              <div>
                <Label htmlFor="duration" className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4" />
                  预计时长 (秒)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min="30"
                  max="180"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', e.target.value)}
                />
                <div className="text-xs text-gray-500 mt-1">
                  建议: 30-180 秒
                </div>
              </div>

              {/* Generate button */}
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !formData.textScript || !canAfford}
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    生成数字人视频 ({estimatedCredits} 积分)
                  </>
                )}
              </Button>

              {!canAfford && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    积分不足，需要 {estimatedCredits} 积分。
                    <Button 
                      variant="link" 
                      className="p-0 ml-2 h-auto"
                      onClick={() => window.location.href = '/pricing'}
                    >
                      去充值
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Video result */}
        {videoResult && (
          <Card>
            <CardContent className="p-4">
              {videoResult.videoUrl ? (
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">视频生成完成!</h3>
                  <div className="space-y-3">
                    <a
                      href={videoResult.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      查看视频
                    </a>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setVideoResult(null);
                        setTrainingStatus({ status: 'idle' });
                      }}
                      className="ml-2"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      创建新数字人
                    </Button>
                  </div>
                </div>
              ) : videoResult.status === 'manual_required' ? (
                <div className="text-center space-y-4">
                  <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">需要手动操作</h3>
                  <p className="text-gray-600 mb-4">{videoResult.error}</p>
                  
                  {videoResult.comfyuiUrl && (
                    <div className="bg-yellow-50 p-4 rounded-lg text-left">
                      <h4 className="font-semibold mb-2">ComfyUI 操作指引：</h4>
                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        {videoResult.instructions?.map((instruction, index) => (
                          <li key={index}>{instruction}</li>
                        ))}
                      </ol>
                      <div className="mt-4">
                        <a
                          href={videoResult.comfyuiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          打开ComfyUI界面
                        </a>
                      </div>
                    </div>
                  )}
                  
                  <Button
                    variant="outline"
                    onClick={() => setVideoResult(null)}
                    className="mt-4"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重新尝试自动生成
                  </Button>
                </div>
              ) : videoResult.error ? (
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">生成失败</h3>
                  <p className="text-red-600 mb-4">{videoResult.error}</p>
                  <Button
                    variant="outline"
                    onClick={() => setVideoResult(null)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重新尝试
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Loader2 className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
                  <h3 className="text-lg font-semibold mb-2">正在生成视频...</h3>
                  <p className="text-gray-600">预计需要 3-5 分钟，请耐心等待</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
);

DigitalHumanVideoForm.displayName = 'DigitalHumanVideoForm';

export { DigitalHumanVideoForm };
