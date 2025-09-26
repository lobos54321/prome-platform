import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Video } from 'lucide-react';
import VideoCreationForm from '@/components/forms/VideoCreationForm';
import { useTranslation } from 'react-i18next';
import { useVideoResult } from '@/hooks/useVideoResult';

interface VideoFormData {
  duration: string;
  productDescription: string;
  imageUrl: string;
  characterGender: string;
}

interface N8nFormSimpleProps {
  webhookUrl: string;
  onBack?: () => void;
  className?: string;
}

export default function N8nFormSimple({ webhookUrl, onBack, className = '' }: N8nFormSimpleProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    response?: any;
    videoUrl?: string;
    isProcessing?: boolean;
  } | null>(null);

  // 使用视频结果监听Hook
  const { result: videoResult, isPolling, error: pollingError, startPolling, reset } = useVideoResult({
    sessionId: currentSessionId,
    onResult: (result) => {
      console.log('🎉 收到视频结果回调:', result);
      setSubmitResult({
        success: true,
        message: '🎉 视频生成完成！',
        response: JSON.stringify(result, null, 2),
        videoUrl: result.videoUrl,
        isProcessing: false
      });
    },
    pollingInterval: 5000, // 5秒轮询一次
    maxPollingTime: 900000 // 15分钟超时
  });

  // 视频URL提取函数
  const extractVideoUrl = (text: string): string | null => {
    console.log('🔍 尝试提取视频URL，响应内容:', text);
    
    const urlPatterns = [
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
          console.log('✅ 找到视频URL:', url);
          return url;
        }
      }
    }

    console.log('❌ 未找到视频URL');
    return null;
  };

  const sendToN8n = async (formData: VideoFormData) => {
    console.log('🚀 使用简化HTTP调用方式，表单数据:', formData);
    
    if (isSubmitting) {
      console.log('⏸️ 正在提交中，忽略重复请求');
      return;
    }
    
    setIsSubmitting(true);
    
    // 立即显示处理状态
    setSubmitResult({
      success: true,
      message: '✅ 请求已发送，AI正在为您创作视频...',
      response: '正在发送请求到N8n工作流...',
      isProcessing: true
    });

    try {
      // 生成会话ID
      const sessionId = `form_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      setCurrentSessionId(sessionId);
      
      // 构建消息内容
      const messageContent = `视频创作需求：
🎬 视频时长：${formData.duration}秒
📝 产品描述：${formData.productDescription}
🖼️ 产品图片：${formData.imageUrl}
👤 人物性别：${formData.characterGender}

请根据以上信息创建视频内容。`;

      // 构建请求载荷（按照N8n Chat Trigger的格式，包含metadata）
      const payload = {
        action: "sendMessage",
        sessionId: sessionId,
        chatInput: messageContent,
        // 添加metadata字段，就像官方嵌入方式一样
        metadata: {
          duration: formData.duration,
          productDescription: formData.productDescription,
          imageUrl: formData.imageUrl,
          characterGender: formData.characterGender
        }
      };

      console.log('📤 发送载荷到N8n，sessionId:', sessionId, payload);

      // 发送请求到N8n（不设超时，让它自然完成）
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('📡 HTTP响应状态:', response.status, response.statusText);

      if (response.ok) {
        const responseData = await response.text();
        console.log('✅ N8n响应原始数据:', responseData);
        
        // 立即启动轮询监听视频结果
        console.log('🔄 开始轮询监听视频结果，sessionId:', sessionId);
        startPolling();
        
        // 更新状态为等待中
        setSubmitResult({
          success: true,
          message: '🔄 请求已发送，等待工作流3回调结果...',
          response: responseData,
          isProcessing: true
        });
        
      } else {
        const errorText = await response.text();
        console.error('❌ HTTP错误响应:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
    } catch (error) {
      console.error('❌ 发送到N8n失败:', error);
      setSubmitResult({
        success: false,
        message: `❌ 请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
        response: error instanceof Error ? error.stack : String(error),
        isProcessing: false
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    console.log('🔄 重置组件状态');
    setSubmitResult(null);
    setIsSubmitting(false);
    setCurrentSessionId('');
    reset(); // 重置轮询状态
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-bold text-center">
            <Video className="h-8 w-8 mr-3 text-purple-600" />
            ProMe-UGC 真人反馈视频智能体
          </CardTitle>
          <div className="text-center">
            <p className="text-lg text-gray-600 mb-2">让您的产品通过真实声音发声</p>
            <p className="text-sm text-gray-500">使用HTTP直接调用 + metadata传递</p>
          </div>
        </CardHeader>
        <CardContent>
          {/* 视频创作表单 */}
          <VideoCreationForm
            onSubmit={sendToN8n}
            isLoading={isSubmitting}
          />

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
              {submitResult.success && !submitResult.videoUrl && submitResult.isProcessing && (
                <div className="bg-blue-50 p-4 rounded-lg mt-4 border-l-4 border-blue-500">
                  <div className="flex items-center mb-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                    <h4 className="font-semibold text-blue-800">🎬 视频正在生成中...</h4>
                  </div>
                  <div className="text-sm text-blue-700 bg-blue-100 p-2 rounded">
                    <p><strong>⏱️ 预计时间：</strong> 2-15分钟</p>
                    <p><strong>💡 温馨提示：</strong> 请手动检查N8n工作流执行状态</p>
                  </div>
                </div>
              )}

              {/* 视频生成完成 */}
              {submitResult.success && submitResult.videoUrl && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200 mt-4">
                  <h4 className="font-semibold text-green-800 mb-3">🎉 视频生成完成！</h4>
                  
                  <div className="bg-white p-3 rounded border border-green-200 mb-3">
                    <p className="text-sm text-green-700 mb-2">📥 下载链接：</p>
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
                      🎬 观看视频
                    </a>
                    <button 
                      onClick={handleReset}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      🔄 创建新视频
                    </button>
                  </div>
                </div>
              )}

              {/* 响应详情 */}
              {submitResult.response && (
                <div className="mt-4">
                  <details className="bg-gray-50 p-3 rounded cursor-pointer">
                    <summary className="font-medium text-gray-700 mb-2">N8n响应详情</summary>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-2 rounded border overflow-auto max-h-40">
                      {submitResult.response}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}