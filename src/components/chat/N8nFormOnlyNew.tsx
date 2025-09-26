import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, Video, AlertCircle, History, Trash2, ExternalLink } from 'lucide-react';
import VideoCreationForm, { VideoCreationFormRef } from '@/components/forms/VideoCreationForm';
import { useTranslation } from 'react-i18next';
import { useVideoResult } from '@/hooks/useVideoResult';
import { SupabaseVideoHistoryManager, VideoRecord } from '@/lib/supabaseVideoHistory';
import { DataMigration } from '@/lib/migrateToSupabase';

interface VideoFormData {
  duration: string;
  productDescription: string;
  imageUrl: string;
  characterGender: string;
  language: string;
}

interface N8nFormOnlyProps {
  webhookUrl: string;
  onBack?: () => void;
  className?: string;
}

export default function N8nFormOnlyNew({ webhookUrl, onBack, className = '' }: N8nFormOnlyProps) {
  console.log('🏁 N8nFormOnlyNew component loaded - if you see this log, the correct component is being used');
  const { t } = useTranslation();
  const { user } = useAuth();
  const videoFormRef = useRef<VideoCreationFormRef>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [videoHistory, setVideoHistory] = useState<VideoRecord[]>([]);
  const [currentRecord, setCurrentRecord] = useState<VideoRecord | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    response?: any;
    videoUrl?: string;
    isProcessing?: boolean;
  } | null>(null);

  // Use polling hook
  const { result: videoResult, isPolling, error: pollingError, startPolling, stopPolling, reset: resetPolling } = useVideoResult({
    sessionId: sessionId || '',
    onResult: async (result) => {
      console.log('📥 Polling received video result:', result);
      
      // Extract video URL
      const videoUrl = extractVideoUrl(result.videoUrl || JSON.stringify(result));
      
      if (videoUrl) {
        console.log('🎉 Successfully extracted video URL:', videoUrl);
        
        // Update current record with video URL
        if (currentRecord) {
          await SupabaseVideoHistoryManager.updateRecord(currentRecord.id, {
            videoUrl: videoUrl,
            isCompleted: true
          });
          const updatedHistory = await SupabaseVideoHistoryManager.getHistory();
          setVideoHistory(updatedHistory);
        }
        
        setSubmitResult({
          success: true,
          message: t('video.generation_complete', '🎉 Video generation complete!'),
          response: JSON.stringify(result, null, 2),
          videoUrl: videoUrl,
          isProcessing: false
        });
        
        // Refresh credits display after video completion
        console.log('🔄 Video completed, refreshing credits display...');
        videoFormRef.current?.refreshCredits();
      } else {
        console.log('⚠️ Video URL not found, showing original result');
        setSubmitResult({
          success: true,
          message: t('video.result_received', '✅ Video result received, please check result'),
          response: JSON.stringify(result, null, 2),
          isProcessing: false
        });
      }
      
      setIsSubmitting(false);
    }
  });

  // Load video history on component mount
  useEffect(() => {
    const loadHistory = async () => {
      // Check if migration is needed
      if (DataMigration.needsMigration()) {
        console.log('🔄 检测到localStorage数据，开始迁移到Supabase...');
        const migrationResult = await DataMigration.migrateToSupabase();
        
        if (migrationResult.success) {
          console.log(`✅ 迁移成功: ${migrationResult.migratedCount} 条记录已迁移到Supabase`);
        } else {
          console.log(`⚠️ 迁移部分成功: ${migrationResult.migratedCount}/${migrationResult.totalCount} 条记录`);
        }
      }
      
      const history = await SupabaseVideoHistoryManager.getHistory();
      setVideoHistory(history);
    };
    loadHistory();
  }, []);

  // Automatically start polling when sessionId is set
  useEffect(() => {
    if (sessionId && sessionId.trim() !== '' && submitResult?.isProcessing) {
      console.log('🔄 sessionId set, preparing to start polling:', sessionId);
      // Delay to ensure state is updated
      setTimeout(() => {
        console.log('🚀 Starting to poll video results:', sessionId);
        startPolling();
      }, 100);
    }
  }, [sessionId, submitResult?.isProcessing, startPolling]);

  // Video URL extraction function
  const extractVideoUrl = (text: string): string | null => {
    console.log('🔍 Attempting to extract video URL from response:', text);
    
    const urlPatterns = [
      // URLs with prefixes (e.g., "Video URL: https://...")
      /(?:视频地址：|Video URL:|URL:|Link:)?\s*(https?:\/\/[^\s"'<>]+\.(?:mp4|avi|mov|wmv|flv|webm|mkv))/gi,
      // 直接的视频URL
      /https?:\/\/[^\s"'<>]+\.(?:mp4|avi|mov|wmv|flv|webm|mkv)/gi,
      // JSON格式的各种字段名
      /"(?:videoUrl|finalvideoURL|finalvideourl|video_url|videoLink|downloadUrl|fileUrl|mediaUrl)"?\s*:\s*"([^"]+)"/gi,
      // text/output字段中的URL
      /"(?:text|output)"?\s*:\s*"(https?:\/\/[^\s"'<>]+\.(?:mp4|avi|mov|wmv|flv|webm|mkv)[^"]*)"/gi,
    ];

    for (const pattern of urlPatterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        const url = matches[0][1] || matches[0][0];
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          console.log('✅ Found video URL:', url);
          return url;
        }
      }
    }

    console.log('❌ Video URL not found');
    return null;
  };

  // Calculate credits needed for video generation
  const calculateVideoCredits = (duration: string): number => {
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

  const sendToN8n = async (formData: VideoFormData) => {
    console.log('🚀 使用三工作流架构发送请求:', formData);
    
    if (isSubmitting) {
      console.log('⏸️ 正在提交中，忽略重复请求');
      return;
    }

    // 步骤1: 检查并扣除积分（专门用于视频生成，不影响Deep Copywriting系统）
    const requiredCredits = calculateVideoCredits(formData.duration);
    const currentSessionId = `form_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    console.log('💰 Video generation credits calculation:', {
      duration: formData.duration,
      requiredCredits,
      sessionId: currentSessionId
    });

    try {
      // Reserve balance for video generation (using existing balance system)
      const reserveResponse = await fetch('/api/video/reserve-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id || 'anonymous-user',
          credits: requiredCredits,
          sessionId: currentSessionId,
          duration: parseInt(formData.duration),
          metadata: {
            type: 'video_generation',
            formData: formData,
            user: user ? { id: user.id, email: user.email, name: user.name } : null,
            timestamp: new Date().toISOString()
          }
        }),
      });

      if (!reserveResponse.ok) {
        const errorData = await reserveResponse.json();
        console.error('❌ Credits reservation failed:', errorData);
        
        setSubmitResult({
          success: false,
          message: `❌ ${errorData.error || '积分不足，无法生成视频'}`,
          response: '请充值积分后重试',
          isProcessing: false
        });
        return;
      }

      const reserveData = await reserveResponse.json();
      console.log('✅ Credits reserved successfully:', reserveData);

    } catch (error) {
      console.error('❌ Credits reservation error:', error);
      setSubmitResult({
        success: false,
        message: '❌ 积分系统错误，请稍后重试',
        response: '无法连接到积分服务',
        isProcessing: false
      });
      return;
    }

    // 步骤2: 创建视频记录
    const newRecord = await SupabaseVideoHistoryManager.addRecord({
      videoUrl: '',
      imageUrl: formData.imageUrl,
      productDescription: formData.productDescription,
      characterGender: formData.characterGender,
      duration: formData.duration
    });
    
    setCurrentRecord(newRecord);
    const updatedHistory = await SupabaseVideoHistoryManager.getHistory();
    setVideoHistory(updatedHistory);
    
    setIsSubmitting(true);
    setSessionId(currentSessionId);
    
    // 立即显示处理状态
    setSubmitResult({
      success: true,
      message: '✅ 请求已发送，AI正在为您创作视频...',
      response: '使用新的三工作流异步架构处理您的请求...',
      isProcessing: true
    });

    try {

      // 构建表格化消息内容（适配Chat Trigger格式）
      const messageContent = `视频创作需求表单：

| 字段 | 值 |
|------|-----|
| 🎬 视频时长 | ${formData.duration}秒 |
| 📝 产品描述 | ${formData.productDescription} |
| 🖼️ 图片链接 | ${formData.imageUrl} |
| 👤 人物性别 | ${formData.characterGender} |
| 🌍 视频语言 | ${formData.language} |

请根据以上表单信息创建视频内容。`;

      console.log('📤 发送载荷到N8n Chat Trigger，sessionId:', currentSessionId);
      console.log('🌐 即将发送请求到:', webhookUrl);
      
      // 发送到Chat Trigger（使用正确的Chat格式，添加超时）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sendMessage',
          sessionId: currentSessionId,
          chatInput: messageContent,
          // Add callback URL for video completion webhook  
          callbackUrl: `${import.meta.env.VITE_CALLBACK_DOMAIN || 'https://www.prome.live'}/api/video/webhook/complete`,
          // Add metadata with duration and language for N8N workflow
          metadata: {
            duration: formData.duration,
            productDescription: formData.productDescription,
            imageUrl: formData.imageUrl,
            characterGender: formData.characterGender,
            language: formData.language
          }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('📡 Response status:', response.status, response.statusText);
      console.log('📡 Response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP错误详情:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const responseText = await response.text();
      console.log('📡 原始响应内容:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('✅ N8n工作流1立即响应:', result);
      } catch (parseError) {
        console.error('❌ JSON解析失败:', parseError);
        console.log('📡 响应不是有效JSON:', responseText);
        result = { message: responseText };
      }
      
      // 更新处理状态，显示立即响应
      console.log('🎯 CHECKPOINT 1: 即将设置submitResult');
      setSubmitResult({
        success: true,
        message: result.message || '✅ 请求已接收，正在生成视频...',
        response: JSON.stringify(result, null, 2),
        isProcessing: true
      });
      console.log('🎯 CHECKPOINT 2: submitResult已设置');
      
      // 直接启动轮询（先重置状态）
      console.log('🔄 现在直接启动轮询，sessionId:', currentSessionId);
      console.log('📊 轮询状态检查 - isPolling:', isPolling);
      
      // 先停止之前的轮询，然后启动新的
      stopPolling();
      setTimeout(() => {
        console.log('🚀 重新启动轮询');
        startPolling();
      }, 100);
      
    } catch (error) {
      console.error('❌ N8n请求发送失败:', error);
      
      setSubmitResult({
        success: false,
        message: `❌ 请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
        response: error instanceof Error ? error.stack : String(error),
        isProcessing: false
      });
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    console.log('🔄 重置组件状态');
    
    // 停止轮询并重置状态
    stopPolling();
    resetPolling();
    setSessionId(null);
    setSubmitResult(null);
    setIsSubmitting(false);
    setCurrentRecord(null);
    
    // Refresh video history
    const refreshedHistory = await SupabaseVideoHistoryManager.getHistory();
    setVideoHistory(refreshedHistory);
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-bold text-center">
            <Video className="h-8 w-8 mr-3 text-purple-600" />
{t('n8n.video_agent_title', 'ProMe-UGC Real-Person Feedback Video Agent')}
          </CardTitle>
          <div className="text-center">
            <p className="text-lg text-gray-600 mb-2">{t('n8n.video_agent_subtitle', 'Let your product speak through real voices')}</p>
          </div>
        </CardHeader>
        <CardContent>
          {/* 视频创作表单 */}
          <VideoCreationForm
            ref={videoFormRef}
            onSubmit={sendToN8n}
            isLoading={isSubmitting}
          />

          {/* 视频历史记录 */}
          {videoHistory.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <History className="h-5 w-5 mr-2 text-purple-600" />
                  {t('n8n.video_history', 'Video History')} ({videoHistory.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? t('n8n.hide_history', 'Hide') : t('n8n.show_history', 'Show History')}
                </Button>
              </div>
              
              {showHistory && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {videoHistory.map((record) => (
                    <div key={record.id} className="bg-gray-50 p-4 rounded-lg border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <img
                              src={record.imageUrl}
                              alt="Product"
                              className="w-12 h-12 object-cover rounded mr-3"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            <div>
                              <h4 className="font-medium text-gray-900 text-sm">{record.title}</h4>
                              <p className="text-xs text-gray-500">
                                {record.createdAt.toLocaleDateString()} • {record.duration}s • {record.characterGender}
                              </p>
                            </div>
                          </div>
                          
                          {record.isCompleted && record.videoUrl ? (
                            <div className="flex items-center space-x-2">
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                ✅ {t('n8n.completed', 'Completed')}
                              </span>
                              <a
                                href={record.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 flex items-center"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                {t('n8n.watch', 'Watch')}
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              ⏳ {t('n8n.processing', 'Processing...')}
                            </span>
                          )}
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await SupabaseVideoHistoryManager.deleteRecord(record.id);
                            const updatedHistory = await SupabaseVideoHistoryManager.getHistory();
                            setVideoHistory(updatedHistory);
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 结果显示区域 */}
          {submitResult && (
            <div className="mt-6">
              <Alert className={submitResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-start">
                  {submitResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <AlertDescription className={`font-medium ${submitResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      {submitResult.message}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>

              {/* 处理中状态 */}
              {submitResult.success && !submitResult.videoUrl && (submitResult.isProcessing || isPolling) && (
                <div className="bg-blue-50 p-4 rounded-lg mt-4 border-l-4 border-blue-500">
                  <div className="flex items-center mb-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                    <h4 className="font-semibold text-blue-800">🎬 {t('n8n.processing', 'Video Generation in Progress...')}</h4>
                  </div>
                  <div className="text-sm text-blue-700 bg-blue-100 p-2 rounded">
                    <p><strong>⏱️ {t('n8n.estimated_time', 'Estimated Time')}:</strong> {t('n8n.time_range', '5-10 minutes')}</p>
                    <p><strong>💡 {t('n8n.suggestion', 'Suggestion')}:</strong> {t('n8n.take_break', 'Grab a coffee and relax! We\'ll have your video ready soon.')}</p>
                    <p><strong>🔄 {t('n8n.current_status', 'Status')}:</strong> {isPolling ? t('n8n.checking_results', 'Checking video results...') : t('n8n.generating_video', 'AI is generating your video...')}</p>
                    {pollingError && <p><strong>⚠️ {t('n8n.polling_error', 'Polling Error')}:</strong> {pollingError}</p>}
                  </div>
                </div>
              )}

              {/* 视频生成完成 */}
              {submitResult.success && submitResult.videoUrl && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200 mt-4">
                  <h4 className="font-semibold text-green-800 mb-3">🎉 {t('n8n.video_completed', 'Video Generation Completed!')}</h4>
                  
                  <div className="bg-white p-3 rounded border border-green-200 mb-3">
                    <p className="text-sm text-green-700 mb-2">📥 {t('n8n.download_link', 'Download Link')}:</p>
                    <a 
                      href={submitResult.videoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline break-all"
                    >
                      {submitResult.videoUrl}
                    </a>
                  </div>
                  
                  <div className="flex gap-2">
                    <a 
                      href={submitResult.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer" 
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      🎬 {t('n8n.watch_video', 'Watch Video')}
                    </a>
                    <button 
                      onClick={handleReset}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      🔄 {t('n8n.create_new_video', 'Create New Video')}
                    </button>
                  </div>
                </div>
              )}

              {/* 隐藏响应详情，用户不需要看到技术细节 */}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}