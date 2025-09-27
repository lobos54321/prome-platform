/**
 * Digital Human Video Page - Simple Working Version
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Video,
  FileText,
  Upload,
  Play,
  Loader2,
  CheckCircle,
  User
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface CopywritingResult {
  id: string;
  content: string;
  title?: string;
  generatedAt: Date;
  tokens?: number;
}

export default function DigitalHumanVideoSimple() {
  const { user } = useAuth();
  const [copywritingResults, setCopywritingResults] = useState<CopywritingResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<CopywritingResult | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    textScript: '',
    digitalHumanName: `数字人_${Date.now()}`,
    imageFile: null as File | null,
    videoFile: null as File | null
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; videoUrl?: string; error?: string } | null>(null);

  // Load copywriting results from localStorage
  useEffect(() => {
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
              title: `文案 ${index + 1}`,
              generatedAt: new Date(message.created_at || Date.now()),
              tokens: message.content.length
            });
          }
        });

        setCopywritingResults(results);
        if (results.length > 0) {
          setSelectedResult(results[0]);
          setFormData(prev => ({ ...prev, textScript: results[0].content }));
        }
      } catch (error) {
        console.error('Failed to load copywriting results:', error);
      }
    };

    loadCopywritingResults();
  }, []);

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle file uploads
  const handleFileChange = (field: 'imageFile' | 'videoFile', file: File | null) => {
    setFormData(prev => ({ ...prev, [field]: file }));
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.textScript.trim()) {
      setResult({ error: '请输入视频文案' });
      return;
    }

    if (!formData.imageFile || !formData.videoFile) {
      setResult({ error: '请上传头像图片和训练视频' });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock success response
      setResult({
        success: true,
        videoUrl: 'https://example.com/generated-video.mp4'
      });
      
    } catch (error) {
      setResult({ error: '视频生成失败，请重试' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
              Digital Human Videos
            </h1>
            <p className="text-gray-600 text-lg">
              将您的文案转换为专业数字人视频演示
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column - Copywriting Results */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    最近的文案作品
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {copywritingResults.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">暂无文案内容</p>
                      <p className="text-sm text-gray-500 mb-4">
                        请先使用 Deep Copywriting 生成文案内容
                      </p>
                      <Button 
                        variant="outline"
                        onClick={() => window.location.href = '/chat/dify'}
                      >
                        去创建文案
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {copywritingResults.slice(0, 5).map((result) => (
                        <div 
                          key={result.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedResult?.id === result.id 
                              ? 'border-purple-500 bg-purple-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => {
                            setSelectedResult(result);
                            setFormData(prev => ({ ...prev, textScript: result.content }));
                          }}
                        >
                          <div className="font-medium text-sm mb-1">{result.title}</div>
                          <div className="text-xs text-gray-500 line-clamp-2">
                            {result.content.substring(0, 100)}...
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {result.generatedAt.toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Video Generation */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Video className="h-5 w-5 mr-2" />
                    数字人视频生成
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* Step 1: Text Script */}
                  <div>
                    <Label htmlFor="text-script" className="text-base font-medium mb-3 block">
                      第一步：视频文案
                    </Label>
                    <Textarea
                      id="text-script"
                      value={formData.textScript}
                      onChange={(e) => handleInputChange('textScript', e.target.value)}
                      placeholder="请输入数字人要说的内容..."
                      className="min-h-[120px]"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      当前字数: {formData.textScript.length} | 建议: 100-500 字
                    </div>
                  </div>

                  {/* Step 2: Upload Materials */}
                  {formData.textScript.trim() && (
                    <>
                      <div>
                        <Label className="text-base font-medium mb-3 block">
                          第二步：上传素材
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="digital-human-name" className="mb-2 block">数字人名称</Label>
                            <Input
                              id="digital-human-name"
                              value={formData.digitalHumanName}
                              onChange={(e) => handleInputChange('digitalHumanName', e.target.value)}
                              placeholder="为您的数字人起个名字"
                            />
                          </div>
                          <div></div>
                          <div>
                            <Label htmlFor="image-upload" className="mb-2 block">头像图片</Label>
                            <Input
                              id="image-upload"
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileChange('imageFile', e.target.files?.[0] || null)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="video-upload" className="mb-2 block">训练视频</Label>
                            <Input
                              id="video-upload"
                              type="file"
                              accept="video/*"
                              onChange={(e) => handleFileChange('videoFile', e.target.files?.[0] || null)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Generate */}
                      <div>
                        <Button
                          onClick={handleSubmit}
                          disabled={isProcessing || !formData.textScript.trim() || !formData.imageFile || !formData.videoFile}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                          size="lg"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              生成中...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              生成数字人视频
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  )}

                  {/* Result */}
                  {result && (
                    <div className="mt-6">
                      {result.success ? (
                        <Alert className="border-green-200 bg-green-50">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                              <span className="text-green-800">视频生成成功！</span>
                              <Button size="sm" className="mt-2 sm:mt-0">
                                下载视频
                              </Button>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Alert className="border-red-200 bg-red-50">
                          <AlertDescription className="text-red-800">
                            {result.error}
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
    </div>
  );
}