/**
 * Digital Human Video Final Page - Beautiful UI with Complete Workflow
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Video,
  FileText,
  Upload,
  Play,
  Loader2,
  CheckCircle,
  User,
  Image,
  ArrowRight,
  Wand2,
  Download,
  RefreshCw,
  MessageSquare,
  Palette,
  Settings,
  Clock,
  Star
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface CopywritingResult {
  id: string;
  content: string;
  title?: string;
  generatedAt: Date;
}

interface WorkflowStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  icon: any;
}

export default function DigitalHumanVideoFinal() {
  const { user } = useAuth();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  // Workflow steps
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { id: 1, title: '准备文案', description: '导入或编写视频文案', status: 'active', icon: FileText },
    { id: 2, title: '训练数字人', description: '上传素材训练数字人模型', status: 'pending', icon: User },
    { id: 3, title: '生成视频', description: '使用数字人生成最终视频', status: 'pending', icon: Video },
    { id: 4, title: '完成', description: '下载生成的视频', status: 'pending', icon: Download }
  ]);

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Content
    textScript: '',
    textSource: 'manual' as 'imported' | 'manual',
    
    // Step 2: Training
    digitalHumanName: user?.email?.split('@')[0] || `数字人_${Date.now()}`,
    gender: 'female' as 'male' | 'female',
    videoFile: null as File | null,
    videoUrl: '',
    backgroundFile: null as File | null,
    backgroundUrl: '',
    backgroundColor: '#4F46E5',
    
    // Step 3: Generation
    voiceModel: 'natural',
    emotion: 'professional',
    language: 'zh-CN'
  });

  // States
  const [currentStep, setCurrentStep] = useState(1);
  const [copywritingResults, setCopywritingResults] = useState<CopywritingResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState('');

  // Load copywriting results on mount
  useEffect(() => {
    loadCopywritingResults();
  }, []);

  const loadCopywritingResults = () => {
    try {
      const conversationId = localStorage.getItem('dify_conversation_id');
      if (!conversationId) return;

      const conversationHistory = localStorage.getItem(`dify_messages_${conversationId}`);
      if (!conversationHistory) return;

      const messages = JSON.parse(conversationHistory);
      const results: CopywritingResult[] = [];

      messages.forEach((message: any, index: number) => {
        if (message.role === 'assistant' && message.content && message.content.length > 50) {
          results.push({
            id: `result_${index}`,
            content: message.content,
            title: `AI文案 ${results.length + 1}`,
            generatedAt: new Date(message.created_at || Date.now())
          });
        }
      });

      setCopywritingResults(results.slice(0, 3)); // Show latest 3 results
      
      // Auto-import first result if available
      if (results.length > 0 && !formData.textScript) {
        setFormData(prev => ({
          ...prev,
          textScript: results[0].content,
          textSource: 'imported'
        }));
      }
    } catch (error) {
      console.error('Failed to load copywriting results:', error);
    }
  };

  // Update step status
  const updateStepStatus = (stepId: number, status: WorkflowStep['status']) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  // Handle input changes
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Import copywriting result
  const importCopywriting = (result: CopywritingResult) => {
    setFormData(prev => ({
      ...prev,
      textScript: result.content,
      textSource: 'imported'
    }));
  };

  // Handle file uploads
  const handleVideoUpload = async (file: File) => {
    if (!file) return;

    setIsProcessing(true);
    setUploadProgress(0);

    try {
      const formDataObj = new FormData();
      formDataObj.append('video', file);

      const response = await fetch('/api/upload/video', {
        method: 'POST',
        body: formDataObj,
      });

      if (!response.ok) throw new Error('上传失败');

      const result = await response.json();
      if (result.success) {
        setFormData(prev => ({
          ...prev,
          videoFile: file,
          videoUrl: result.videoUrl
        }));
        setUploadProgress(100);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('视频上传失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackgroundUpload = async (file: File) => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('image', file);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formDataObj,
      });

      if (!response.ok) throw new Error('上传失败');

      const result = await response.json();
      if (result.success) {
        setFormData(prev => ({
          ...prev,
          backgroundFile: file,
          backgroundUrl: result.imageUrl
        }));
      }
    } catch (error) {
      console.error('Background upload error:', error);
      alert('背景图片上传失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle workflow progression
  const handleNextStep = async () => {
    if (currentStep === 1) {
      // Validate step 1
      if (!formData.textScript.trim()) {
        alert('请输入或导入视频文案');
        return;
      }
      updateStepStatus(1, 'completed');
      updateStepStatus(2, 'active');
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Validate and start training
      if (!formData.videoUrl) {
        alert('请上传训练视频');
        return;
      }
      await startTraining();
    } else if (currentStep === 3) {
      // Start video generation
      await generateVideo();
    }
  };

  const startTraining = async () => {
    setIsProcessing(true);
    updateStepStatus(2, 'active');
    setTrainingProgress(0);

    try {
      const response = await fetch('/api/digital-human/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 'anonymous',
          name: formData.digitalHumanName,
          imageUrl: formData.backgroundUrl || null,
          videoUrl: formData.videoUrl,
          gender: formData.gender,
          backgroundImageUrl: formData.backgroundUrl,
          backgroundColor: formData.backgroundColor
        }),
      });

      if (!response.ok) throw new Error('训练失败');

      // Simulate training progress
      const progressInterval = setInterval(() => {
        setTrainingProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            updateStepStatus(2, 'completed');
            updateStepStatus(3, 'active');
            setCurrentStep(3);
            setIsProcessing(false);
            return 100;
          }
          return prev + 10;
        });
      }, 500);

    } catch (error) {
      console.error('Training error:', error);
      updateStepStatus(2, 'error');
      setIsProcessing(false);
    }
  };

  const generateVideo = async () => {
    setIsProcessing(true);
    updateStepStatus(3, 'active');
    setGenerationProgress(0);

    try {
      const response = await fetch('/api/digital-human/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 'anonymous',
          textScript: formData.textScript,
          voiceModel: formData.voiceModel,
          emotion: formData.emotion,
          language: formData.language
        }),
      });

      if (!response.ok) throw new Error('生成失败');

      // Simulate generation progress
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            updateStepStatus(3, 'completed');
            updateStepStatus(4, 'completed');
            setCurrentStep(4);
            setFinalVideoUrl('https://example.com/generated-video.mp4');
            setIsProcessing(false);
            return 100;
          }
          return prev + 8;
        });
      }, 400);

    } catch (error) {
      console.error('Generation error:', error);
      updateStepStatus(3, 'error');
      setIsProcessing(false);
    }
  };

  const backgroundColors = [
    { name: '深蓝', value: '#4F46E5' },
    { name: '紫色', value: '#7C3AED' },
    { name: '粉色', value: '#EC4899' },
    { name: '绿色', value: '#10B981' },
    { name: '橙色', value: '#F59E0B' },
    { name: '红色', value: '#EF4444' },
    { name: '灰色', value: '#6B7280' },
    { name: '黑色', value: '#1F2937' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6">
              <Wand2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
              AI 数字人视频创作
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              使用先进的 AI 技术，将您的文案转化为专业的数字人视频演示
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-12">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`flex flex-col items-center ${index > 0 ? 'ml-4' : ''}`}>
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300
                      ${step.status === 'completed' 
                        ? 'bg-green-100 border-green-500 text-green-600' 
                        : step.status === 'active'
                        ? 'bg-blue-100 border-blue-500 text-blue-600 animate-pulse'
                        : step.status === 'error'
                        ? 'bg-red-100 border-red-500 text-red-600'
                        : 'bg-gray-100 border-gray-300 text-gray-400'
                      }
                    `}>
                      {step.status === 'completed' ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : (
                        <step.icon className="h-6 w-6" />
                      )}
                    </div>
                    <div className="text-center mt-2">
                      <div className={`font-medium text-sm ${
                        step.status === 'active' ? 'text-blue-600' : 
                        step.status === 'completed' ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 max-w-24">
                        {step.description}
                      </div>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <ArrowRight className="h-5 w-5 text-gray-300 mx-6 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Sidebar - Deep Copywriting Results */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center text-lg">
                    <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
                    AI 生成文案
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {copywritingResults.length > 0 ? (
                    <div className="space-y-3">
                      {copywritingResults.map((result, index) => (
                        <div 
                          key={result.id}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                            formData.textScript === result.content && formData.textSource === 'imported'
                              ? 'border-blue-500 bg-blue-50 shadow-sm' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => importCopywriting(result)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
                              {result.title}
                            </Badge>
                            {formData.textScript === result.content && formData.textSource === 'imported' && (
                              <CheckCircle className="h-4 w-4 text-blue-500" />
                            )}
                          </div>
                          <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">
                            {result.content.substring(0, 120)}...
                          </p>
                          <div className="text-xs text-gray-500 mt-2">
                            {result.generatedAt.toLocaleDateString('zh-CN')}
                          </div>
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => window.location.href = '/chat/dify'}
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        生成更多文案
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">暂无 AI 生成的文案</p>
                      <Button 
                        onClick={() => window.location.href = '/chat/dify'}
                        className="bg-gradient-to-r from-blue-600 to-purple-600"
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        开始创作文案
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2">
              <div className="space-y-6">
                
                {/* Step 1: Content Preparation */}
                {currentStep >= 1 && (
                  <Card className={`shadow-lg border-0 transition-all duration-300 ${
                    currentStep === 1 ? 'ring-2 ring-blue-500 bg-blue-50/50' : 'bg-white/80 backdrop-blur-sm'
                  }`}>
                    <CardHeader>
                      <CardTitle className="flex items-center text-xl">
                        <FileText className="h-6 w-6 mr-3 text-blue-600" />
                        第一步：准备视频文案
                        {steps[0].status === 'completed' && (
                          <CheckCircle className="h-5 w-5 ml-2 text-green-600" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      
                      {/* Content Source Tabs */}
                      <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => setFormData(prev => ({ ...prev, textSource: 'imported' }))}
                          className={`flex-1 py-2 px-4 rounded-md transition-all duration-200 ${
                            formData.textSource === 'imported'
                              ? 'bg-white text-blue-600 shadow-sm font-medium'
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          <Wand2 className="h-4 w-4 inline mr-2" />
                          导入 AI 文案
                        </button>
                        <button
                          onClick={() => setFormData(prev => ({ ...prev, textSource: 'manual' }))}
                          className={`flex-1 py-2 px-4 rounded-md transition-all duration-200 ${
                            formData.textSource === 'manual'
                              ? 'bg-white text-blue-600 shadow-sm font-medium'
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          <FileText className="h-4 w-4 inline mr-2" />
                          手动输入
                        </button>
                      </div>

                      {/* Text Input */}
                      <div>
                        <Label htmlFor="text-script" className="text-base font-medium mb-3 block">
                          视频文案内容
                        </Label>
                        <Textarea
                          id="text-script"
                          value={formData.textScript}
                          onChange={(e) => handleInputChange('textScript', e.target.value)}
                          placeholder={
                            formData.textSource === 'imported' 
                              ? "请从左侧选择一个 AI 生成的文案，或直接在此编辑..." 
                              : "请输入数字人要说的内容..."
                          }
                          className="min-h-[140px] text-base leading-relaxed"
                        />
                        <div className="flex justify-between items-center mt-2">
                          <div className="text-sm text-gray-500">
                            当前字数: {formData.textScript.length} | 建议: 100-500 字
                          </div>
                          {formData.textSource === 'imported' && (
                            <Badge variant="outline" className="text-xs">
                              <Wand2 className="h-3 w-3 mr-1" />
                              AI 生成
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Next Button */}
                      {currentStep === 1 && (
                        <Button 
                          onClick={handleNextStep}
                          disabled={!formData.textScript.trim()}
                          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                          size="lg"
                        >
                          下一步：训练数字人
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Step 2: Digital Human Training */}
                {currentStep >= 2 && (
                  <Card className={`shadow-lg border-0 transition-all duration-300 ${
                    currentStep === 2 ? 'ring-2 ring-blue-500 bg-blue-50/50' : 'bg-white/80 backdrop-blur-sm'
                  }`}>
                    <CardHeader>
                      <CardTitle className="flex items-center text-xl">
                        <User className="h-6 w-6 mr-3 text-purple-600" />
                        第二步：训练数字人模型
                        {steps[1].status === 'completed' && (
                          <CheckCircle className="h-5 w-5 ml-2 text-green-600" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      
                      {/* Basic Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label className="text-base font-medium mb-2 block">数字人名称</Label>
                          <Input
                            value={formData.digitalHumanName}
                            onChange={(e) => handleInputChange('digitalHumanName', e.target.value)}
                            className="text-base"
                          />
                        </div>
                        <div>
                          <Label className="text-base font-medium mb-3 block">性别</Label>
                          <div className="flex gap-3">
                            {[
                              { value: 'female', label: '女性', icon: '👩' },
                              { value: 'male', label: '男性', icon: '👨' }
                            ].map((option) => (
                              <button
                                key={option.value}
                                onClick={() => handleInputChange('gender', option.value)}
                                className={`flex items-center px-4 py-2 rounded-lg border-2 transition-all duration-200 ${
                                  formData.gender === option.value
                                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                }`}
                              >
                                <span className="mr-2 text-lg">{option.icon}</span>
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Video Upload */}
                      <div>
                        <Label className="text-base font-medium mb-3 block">训练视频</Label>
                        <div 
                          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200"
                          onClick={() => videoInputRef.current?.click()}
                        >
                          {formData.videoFile ? (
                            <div className="flex items-center justify-center">
                              <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
                              <div>
                                <p className="font-medium text-green-700">{formData.videoFile.name}</p>
                                <p className="text-sm text-gray-500">
                                  {(formData.videoFile.size / 1024 / 1024).toFixed(1)} MB
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <p className="text-lg font-medium text-gray-700 mb-2">上传训练视频</p>
                              <p className="text-sm text-gray-500">
                                支持 MP4、MOV 格式 | 时长 3秒-5分钟 | 最大 50MB
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

                      {/* Background Settings */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label className="text-base font-medium mb-3 block">背景图片（可选）</Label>
                          <div 
                            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-all duration-200"
                            onClick={() => backgroundInputRef.current?.click()}
                          >
                            {formData.backgroundFile ? (
                              <div className="flex items-center justify-center">
                                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                                <span className="text-sm font-medium text-green-700">
                                  {formData.backgroundFile.name}
                                </span>
                              </div>
                            ) : (
                              <div>
                                <Image className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-600">点击上传背景图</p>
                              </div>
                            )}
                          </div>
                          <input
                            ref={backgroundInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleBackgroundUpload(file);
                            }}
                            className="hidden"
                          />
                        </div>

                        <div>
                          <Label className="text-base font-medium mb-3 block">背景颜色</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {backgroundColors.map((color) => (
                              <button
                                key={color.value}
                                onClick={() => handleInputChange('backgroundColor', color.value)}
                                className={`w-12 h-12 rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                                  formData.backgroundColor === color.value 
                                    ? 'border-gray-800 ring-2 ring-offset-2 ring-gray-300' 
                                    : 'border-gray-300'
                                }`}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Training Progress */}
                      {isProcessing && currentStep === 2 && (
                        <div className="bg-blue-50 rounded-xl p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                              <Loader2 className="h-5 w-5 text-blue-600 animate-spin mr-2" />
                              <span className="font-medium text-blue-800">正在训练数字人模型...</span>
                            </div>
                            <span className="text-sm text-blue-600">{trainingProgress}%</span>
                          </div>
                          <Progress value={trainingProgress} className="h-2" />
                        </div>
                      )}

                      {/* Next Button */}
                      {currentStep === 2 && !isProcessing && (
                        <Button 
                          onClick={handleNextStep}
                          disabled={!formData.videoUrl}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                          size="lg"
                        >
                          开始训练数字人
                          <Play className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Step 3: Video Generation */}
                {currentStep >= 3 && (
                  <Card className={`shadow-lg border-0 transition-all duration-300 ${
                    currentStep === 3 ? 'ring-2 ring-blue-500 bg-blue-50/50' : 'bg-white/80 backdrop-blur-sm'
                  }`}>
                    <CardHeader>
                      <CardTitle className="flex items-center text-xl">
                        <Video className="h-6 w-6 mr-3 text-pink-600" />
                        第三步：生成数字人视频
                        {steps[2].status === 'completed' && (
                          <CheckCircle className="h-5 w-5 ml-2 text-green-600" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      
                      {/* Generation Settings */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-sm font-medium mb-2 block">语音模型</Label>
                          <select
                            value={formData.voiceModel}
                            onChange={(e) => handleInputChange('voiceModel', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg"
                          >
                            <option value="natural">自然语音</option>
                            <option value="professional">专业播报</option>
                            <option value="friendly">亲和语音</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-sm font-medium mb-2 block">情感风格</Label>
                          <select
                            value={formData.emotion}
                            onChange={(e) => handleInputChange('emotion', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg"
                          >
                            <option value="professional">专业</option>
                            <option value="friendly">友善</option>
                            <option value="enthusiastic">热情</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-sm font-medium mb-2 block">语言</Label>
                          <select
                            value={formData.language}
                            onChange={(e) => handleInputChange('language', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg"
                          >
                            <option value="zh-CN">中文（普通话）</option>
                            <option value="en-US">English (US)</option>
                            <option value="ja-JP">日本語</option>
                          </select>
                        </div>
                      </div>

                      {/* Generation Progress */}
                      {isProcessing && currentStep === 3 && (
                        <div className="bg-pink-50 rounded-xl p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                              <Loader2 className="h-5 w-5 text-pink-600 animate-spin mr-2" />
                              <span className="font-medium text-pink-800">正在生成数字人视频...</span>
                            </div>
                            <span className="text-sm text-pink-600">{generationProgress}%</span>
                          </div>
                          <Progress value={generationProgress} className="h-2" />
                        </div>
                      )}

                      {/* Generate Button */}
                      {currentStep === 3 && !isProcessing && (
                        <Button 
                          onClick={handleNextStep}
                          className="w-full bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-700 hover:to-red-700"
                          size="lg"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          生成数字人视频
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Step 4: Final Result */}
                {currentStep >= 4 && (
                  <Card className="shadow-lg border-0 bg-gradient-to-r from-green-50 to-blue-50">
                    <CardHeader>
                      <CardTitle className="flex items-center text-xl text-green-700">
                        <CheckCircle className="h-6 w-6 mr-3" />
                        视频生成完成！
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                          <Download className="h-10 w-10 text-green-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-green-700 mb-4">
                          您的数字人视频已生成完成！
                        </h3>
                        <p className="text-gray-600 mb-6">
                          视频已使用最新的 AI 技术生成，质量优秀，可直接使用
                        </p>
                        <div className="flex gap-4 justify-center">
                          <Button 
                            onClick={() => window.open(finalVideoUrl, '_blank')}
                            className="bg-gradient-to-r from-green-600 to-blue-600"
                            size="lg"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            下载视频
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => {
                              setCurrentStep(1);
                              setFormData(prev => ({ ...prev, textScript: '' }));
                              setSteps(prev => prev.map((step, index) => ({
                                ...step,
                                status: index === 0 ? 'active' : 'pending'
                              })));
                            }}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            制作新视频
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}