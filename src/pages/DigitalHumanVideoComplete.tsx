/**
 * Digital Human Video Complete Page - Based on A2E UI Design
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Video,
  FileText,
  Upload,
  Play,
  Loader2,
  CheckCircle,
  User,
  Image,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface FormData {
  // User info
  digitalHumanName: string;
  gender: 'male' | 'female';
  
  // Content
  textScript: string;
  
  // Media files
  videoFile: File | null;
  videoUrl: string;
  backgroundImageFile: File | null;
  backgroundImageUrl: string;
  backgroundColor: string;
  
  // Options
  keepOriginalResolution: boolean;
  professionalCloning: boolean;
}

export default function DigitalHumanVideoComplete() {
  const { user } = useAuth();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const backgroundImageInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormData>({
    digitalHumanName: user?.email || `数字人_${Date.now()}`,
    gender: 'female',
    textScript: '',
    videoFile: null,
    videoUrl: '',
    backgroundImageFile: null,
    backgroundImageUrl: '',
    backgroundColor: '#ffffff',
    keepOriginalResolution: false,
    professionalCloning: true
  });

  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingResult, setTrainingResult] = useState<{
    success?: boolean;
    trainingId?: string;
    error?: string;
  } | null>(null);

  // Load copywriting from localStorage
  useState(() => {
    const loadCopywriting = () => {
      try {
        const conversationId = localStorage.getItem('dify_conversation_id');
        if (!conversationId) return;

        const conversationHistory = localStorage.getItem(`dify_messages_${conversationId}`);
        if (!conversationHistory) return;

        const messages = JSON.parse(conversationHistory);
        const lastMessage = messages
          .filter((m: any) => m.role === 'assistant' && m.content && m.content.length > 50)
          .pop();

        if (lastMessage) {
          setFormData(prev => ({ ...prev, textScript: lastMessage.content }));
        }
      } catch (error) {
        console.error('Failed to load copywriting:', error);
      }
    };
    loadCopywriting();
  });

  // Handle input changes
  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle video upload
  const handleVideoUpload = async (file: File) => {
    // Validate file
    const validTypes = ['video/mp4', 'video/mov'];
    if (!validTypes.includes(file.type)) {
      alert('请上传 MP4 或 MOV 格式的视频文件');
      return;
    }

    // Check file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('视频文件大小不能超过 100MB');
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
      if (result.success && result.videoUrl) {
        setFormData(prev => ({
          ...prev,
          videoFile: file,
          videoUrl: result.videoUrl
        }));
        console.log('✅ Video uploaded:', result.videoUrl);
      } else {
        throw new Error(result.error || '视频上传失败');
      }
    } catch (error) {
      console.error('Video upload error:', error);
      alert('视频上传失败，请重试');
    } finally {
      setUploadingVideo(false);
    }
  };

  // Handle background image upload
  const handleBackgroundImageUpload = async (file: File) => {
    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      alert('请上传 JPG 或 PNG 格式的图片文件');
      return;
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('图片文件大小不能超过 10MB');
      return;
    }

    setUploadingBackground(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('image', file);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formDataObj,
      });

      if (!response.ok) {
        throw new Error('图片上传失败');
      }

      const result = await response.json();
      if (result.success && result.imageUrl) {
        setFormData(prev => ({
          ...prev,
          backgroundImageFile: file,
          backgroundImageUrl: result.imageUrl
        }));
        console.log('✅ Background image uploaded:', result.imageUrl);
      } else {
        throw new Error(result.error || '图片上传失败');
      }
    } catch (error) {
      console.error('Background image upload error:', error);
      alert('图片上传失败，请重试');
    } finally {
      setUploadingBackground(false);
    }
  };

  // Handle A2E training
  const handleStartTraining = async () => {
    // Validate required fields
    if (!formData.textScript.trim()) {
      alert('请输入视频文案');
      return;
    }

    if (!formData.videoUrl) {
      alert('请上传训练视频');
      return;
    }

    if (!formData.digitalHumanName.trim()) {
      alert('请输入数字人名称');
      return;
    }

    setIsTraining(true);
    setTrainingResult(null);

    try {
      const response = await fetch('/api/digital-human/train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id || 'anonymous',
          name: formData.digitalHumanName,
          imageUrl: formData.backgroundImageUrl || null, // Use background image as avatar if provided
          videoUrl: formData.videoUrl,
          gender: formData.gender,
          backgroundImageUrl: formData.backgroundImageUrl,
          backgroundColor: formData.backgroundColor,
          textScript: formData.textScript // Include text script for future video generation
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '数字人训练失败');
      }

      const result = await response.json();
      setTrainingResult({
        success: true,
        trainingId: result.trainingId
      });

      console.log('✅ Digital human training started:', result);
    } catch (error) {
      console.error('Training error:', error);
      setTrainingResult({
        error: error instanceof Error ? error.message : '训练失败'
      });
    } finally {
      setIsTraining(false);
    }
  };

  // Color options for background
  const colorOptions = [
    { value: '#ffffff', label: '白色', color: '#ffffff' },
    { value: '#000000', label: '黑色', color: '#000000' },
    { value: '#ff0000', label: '红色', color: '#ff0000' },
    { value: '#00ff00', label: '绿色', color: '#00ff00' },
    { value: '#0000ff', label: '蓝色', color: '#0000ff' },
    { value: '#ffff00', label: '黄色', color: '#ffff00' },
    { value: '#ff00ff', label: '紫色', color: '#ff00ff' },
    { value: '#00ffff', label: '青色', color: '#00ffff' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
              视频数字人
            </h1>
            <p className="text-gray-600">
              使用 A2E API 训练您的专属数字人
            </p>
          </div>

          <div className="space-y-6">
            
            {/* User Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">名称</Label>
                    <Input
                      id="name"
                      value={formData.digitalHumanName}
                      onChange={(e) => handleInputChange('digitalHumanName', e.target.value)}
                      placeholder="请输入数字人名称"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>性别</Label>
                    <div className="flex gap-4 mt-2">
                      <div 
                        className={`flex items-center space-x-2 cursor-pointer p-3 rounded-lg border transition-colors ${
                          formData.gender === 'female' 
                            ? 'border-purple-500 bg-purple-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleInputChange('gender', 'female')}
                      >
                        <span>女</span>
                      </div>
                      <div 
                        className={`flex items-center space-x-2 cursor-pointer p-3 rounded-lg border transition-colors ${
                          formData.gender === 'male' 
                            ? 'border-purple-500 bg-purple-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleInputChange('gender', 'male')}
                      >
                        <span>男</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Text Script */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  视频文案
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.textScript}
                  onChange={(e) => handleInputChange('textScript', e.target.value)}
                  placeholder="请输入数字人要说的内容..."
                  className="min-h-[120px]"
                />
                <div className="text-xs text-gray-500 mt-1">
                  当前字数: {formData.textScript.length} | 建议: 100-500 字
                </div>
              </CardContent>
            </Card>

            {/* Video Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Video className="h-5 w-5 mr-2" />
                  原始素材
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>上传视频</Label>
                    <div 
                      className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
                      onClick={() => videoInputRef.current?.click()}
                    >
                      {uploadingVideo ? (
                        <div className="flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mr-2" />
                          <span>上传中...</span>
                        </div>
                      ) : formData.videoFile ? (
                        <div className="flex items-center justify-center">
                          <CheckCircle className="h-8 w-8 text-green-500 mr-2" />
                          <span className="text-green-600">{formData.videoFile.name}</span>
                        </div>
                      ) : (
                        <div>
                          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 mb-2">单击或将文件拖到此区域进行上传</p>
                          <p className="text-sm text-gray-500">
                            格式: mp4/mov, 时长: 最少 3秒，最多 5分钟<br/>
                            分辨率建议为720P或1080P，最大分辨率不超过4K
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/mov"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleVideoUpload(file);
                      }}
                      className="hidden"
                    />
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="keep-resolution"
                        checked={formData.keepOriginalResolution}
                        onCheckedChange={(checked) => handleInputChange('keepOriginalResolution', checked)}
                      />
                      <Label htmlFor="keep-resolution" className="text-sm">
                        保持原始视频分辨率，如果您的视频分辨率大于1080P，将消耗更长时间
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="professional-cloning"
                        checked={formData.professionalCloning}
                        onCheckedChange={(checked) => handleInputChange('professionalCloning', checked)}
                      />
                      <Label htmlFor="professional-cloning" className="text-sm">
                        自动专业克隆。您的视频必须包含清晰的声音 (100)
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Background Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Image className="h-5 w-5 mr-2" />
                  原始背景
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  （若不选择背景，则无法使用背景抠图）
                </p>
                
                <div className="space-y-4">
                  {/* Background Image Upload */}
                  <div>
                    <Label>上传图片</Label>
                    <div 
                      className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                      onClick={() => backgroundImageInputRef.current?.click()}
                    >
                      {uploadingBackground ? (
                        <div className="flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                          <span>上传中...</span>
                        </div>
                      ) : formData.backgroundImageFile ? (
                        <div className="flex items-center justify-center">
                          <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
                          <span className="text-green-600">{formData.backgroundImageFile.name}</span>
                        </div>
                      ) : (
                        <div>
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-600 mb-1">单击或将文件拖到此区域进行上传</p>
                          <p className="text-sm text-gray-500">
                            格式: jpg/png, 大小: 不超过 10M
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={backgroundImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleBackgroundImageUpload(file);
                      }}
                      className="hidden"
                    />
                  </div>

                  {/* Background Color */}
                  <div>
                    <Label>选取背景颜色</Label>
                    <div className="grid grid-cols-8 gap-2 mt-2">
                      {colorOptions.map((option) => (
                        <div
                          key={option.value}
                          className={`w-10 h-10 rounded cursor-pointer border-2 ${
                            formData.backgroundColor === option.value
                              ? 'border-purple-500'
                              : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: option.color }}
                          onClick={() => handleInputChange('backgroundColor', option.value)}
                          title={option.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Training Button */}
            <Card>
              <CardContent className="p-6">
                <Button
                  onClick={handleStartTraining}
                  disabled={isTraining || !formData.videoUrl || !formData.textScript.trim()}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="lg"
                >
                  {isTraining ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      训练中...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      开始训练数字人
                    </>
                  )}
                </Button>

                {/* Training Result */}
                {trainingResult && (
                  <div className="mt-4">
                    {trainingResult.success ? (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          数字人训练已开始！训练ID: {trainingResult.trainingId}
                          <br />
                          预计需要 5-10 分钟完成训练。
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="border-red-200 bg-red-50">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                          {trainingResult.error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}