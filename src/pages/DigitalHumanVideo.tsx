/**
 * Digital Human Video Page
 * 
 * Digital human cloning system using Xiangong Cloud (仙宫云)
 * Upload video → Clone appearance and voice → Input text → Generate personalized videos
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Video,
  User,
  Wand2,
  Clock,
  Download,
  ArrowRight,
  MessageSquare,
  Image as ImageIcon,
  FileText,
  Play,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Upload
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { DigitalHumanVideoForm } from '@/components/forms/DigitalHumanVideoForm';

interface CopywritingResult {
  id: string;
  content: string;
  title?: string;
  generatedAt: Date;
  tokens?: number;
}

export default function DigitalHumanVideo() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [copywritingResults, setCopywritingResults] = useState<CopywritingResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<CopywritingResult | null>(null);
  
  // Load recent copywriting results from localStorage or conversation history
  useEffect(() => {
    const loadCopywritingResults = () => {
      try {
        // Get recent Dify conversation history that contains copywriting content
        const conversationId = localStorage.getItem('dify_conversation_id');
        const conversationHistory = localStorage.getItem(`dify_messages_${conversationId}`);
        
        if (conversationHistory) {
          const messages = JSON.parse(conversationHistory);
          const copywritingMessages = messages
            .filter((msg: any) => 
              msg.type === 'assistant' && 
              msg.content && 
              msg.content.length > 100 && // Likely copywriting content
              !msg.content.includes('COMPLETENESS:') // Filter out system messages
            )
            .slice(-5) // Get last 5 results
            .map((msg: any, index: number) => ({
              id: `msg_${msg.id || index}`,
              content: msg.content,
              title: msg.content.slice(0, 50) + '...',
              generatedAt: new Date(msg.created_at || Date.now()),
              tokens: msg.metadata?.tokens || 0
            }));
          
          setCopywritingResults(copywritingMessages);
        }
      } catch (error) {
        console.error('Error loading copywriting results:', error);
      }
    };

    loadCopywritingResults();
  }, []);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-4">请先登录</h3>
            <p className="text-gray-600 mb-6">
              需要登录账户才能使用数字人视频生成功能
            </p>
            <div className="flex gap-4 justify-center">
              <Button 
                onClick={() => window.location.href = '/login'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                立即登录
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/register'}
              >
                注册账户
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 relative overflow-hidden">
      {/* Artistic background patterns */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            radial-gradient(circle at 25% 25%, #8B5CF6 3px, transparent 3px),
            radial-gradient(circle at 75% 75%, #EC4899 2px, transparent 2px),
            radial-gradient(circle at 50% 10%, #F59E0B 2.5px, transparent 2.5px)
          `,
          backgroundSize: '120px 120px, 100px 100px, 80px 80px'
        }}
      ></div>
      
      {/* Floating geometric shapes */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full animate-pulse"></div>
      <div className="absolute top-40 right-16 w-24 h-24 bg-gradient-to-br from-orange-400/15 to-red-400/15 transform rotate-45 animate-bounce"></div>
      <div className="absolute bottom-32 left-1/4 w-40 h-20 bg-gradient-to-br from-purple-400/15 to-blue-400/15 rounded-full animate-pulse delay-1000"></div>

      <div className="relative container mx-auto px-4 py-8 z-10">
        <div className="max-w-7xl mx-auto">
          
          {/* Artistic Page Header */}
          <div className="text-center mb-12">
            {/* Dancing dots */}
            <div className="flex justify-center mb-8 space-x-2">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i}
                  className="w-4 h-4 rounded-full animate-bounce"
                  style={{
                    backgroundColor: ['#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#06B6D4'][i],
                    animationDelay: `${i * 200}ms`
                  }}
                ></div>
              ))}
            </div>
            
            {/* Icon with artistic elements */}
            <div className="relative w-32 h-32 mx-auto mb-8">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl rotate-12 animate-pulse"></div>
              <div className="absolute inset-4 bg-white rounded-2xl flex items-center justify-center shadow-inner">
                <Video className="h-16 w-16 text-purple-600" />
              </div>
              
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-orange-400 rounded-full animate-bounce flex items-center justify-center">
                <Wand2 className="h-4 w-4 text-white" />
              </div>
              <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-pink-400 rounded-full animate-bounce delay-300 flex items-center justify-center">
                <User className="h-3 w-3 text-white" />
              </div>
            </div>

            <h1 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
                Digital Human Videos
              </span>
            </h1>
            <p className="text-2xl text-gray-700 mb-8 font-light max-w-3xl mx-auto">
              <span className="bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
                上传视频训练专属数字人，克隆您的形象和声音，生成个性化营销视频
              </span>
            </p>

            {/* Integration badge */}
            <div className="flex justify-center mb-8">
              <Badge variant="secondary" className="px-6 py-2 text-sm bg-white/80 backdrop-blur-sm">
                <Wand2 className="h-4 w-4 mr-2" />
                基于仙宫云 InfiniteTalk + IndexTTS2
              </Badge>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid lg:grid-cols-2 gap-8">
            
            {/* Left Column: Copywriting Results */}
            <div className="space-y-6">
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                    <FileText className="h-6 w-6 mr-3 text-purple-600" />
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
                        className="flex items-center gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        去创建文案
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {copywritingResults.map((result) => (
                        <div 
                          key={result.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedResult?.id === result.id
                              ? 'bg-purple-50 border-purple-200 ring-2 ring-purple-200'
                              : 'bg-gray-50 hover:bg-purple-25 border-gray-200'
                          }`}
                          onClick={() => setSelectedResult(result)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm text-gray-900">
                              {result.title}
                            </h4>
                            {selectedResult?.id === result.id && (
                              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mb-2">
                            {result.generatedAt.toLocaleDateString()} • 
                            {result.tokens ? ` ${result.tokens} tokens` : ''}
                          </p>
                          <p className="text-sm text-gray-700 line-clamp-2">
                            {result.content.slice(0, 120)}...
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Features showcase */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-gradient-to-br from-purple-100/80 to-pink-100/80 backdrop-blur-sm border-white/50">
                  <CardContent className="p-4 text-center">
                    <Clock className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                    <h3 className="font-semibold text-sm mb-1">快速生成</h3>
                    <p className="text-xs text-gray-600">3-5分钟完成视频</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-100/80 to-red-100/80 backdrop-blur-sm border-white/50">
                  <CardContent className="p-4 text-center">
                    <Download className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                    <h3 className="font-semibold text-sm mb-1">高清输出</h3>
                    <p className="text-xs text-gray-600">1080p专业质量</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Right Column: Video Generation Form */}
            <div>
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                    <Play className="h-6 w-6 mr-3 text-purple-600" />
                    数字人视频生成
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedResult ? (
                    <DigitalHumanVideoForm
                      selectedCopywriting={selectedResult}
                      onVideoGenerated={(videoUrl) => {
                        console.log('Video generated:', videoUrl);
                      }}
                    />
                  ) : (
                    <DigitalHumanVideoForm
                      selectedCopywriting={{ 
                        id: 'manual', 
                        content: '', 
                        title: '手动输入文案', 
                        generatedAt: new Date() 
                      }}
                      onVideoGenerated={(videoUrl) => {
                        console.log('Video generated:', videoUrl);
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Bottom info section */}
          <div className="mt-16">
            <Card className="bg-gradient-to-r from-purple-100/50 to-pink-100/50 backdrop-blur-sm border-white/50">
              <CardContent className="p-8">
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-4">
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      数字人克隆生成流程
                    </span>
                  </h3>
                  <div className="grid md:grid-cols-3 gap-8 mt-8">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload className="h-8 w-8 text-white" />
                      </div>
                      <h4 className="font-semibold mb-2">1. 上传训练视频</h4>
                      <p className="text-sm text-gray-600">上传您的高清视频素材，系统将提取数字人特征和声音</p>
                    </div>
                    <div className="text-center">
                      <div className="w-16 h-16 bg-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Wand2 className="h-8 w-8 text-white" />
                      </div>
                      <h4 className="font-semibold mb-2">2. AI特征克隆</h4>
                      <p className="text-sm text-gray-600">使用InfiniteTalk和IndexTTS2克隆您的形象和声音特征</p>
                    </div>
                    <div className="text-center">
                      <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Video className="h-8 w-8 text-white" />
                      </div>
                      <h4 className="font-semibold mb-2">3. 个性化视频</h4>
                      <p className="text-sm text-gray-600">输入文案内容，生成您专属的个性化数字人营销视频</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}