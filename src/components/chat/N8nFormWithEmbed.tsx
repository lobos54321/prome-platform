import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Video, MessageSquare } from 'lucide-react';
import VideoCreationForm from '@/components/forms/VideoCreationForm';
import { useTranslation } from 'react-i18next';

interface VideoFormData {
  duration: string;
  productDescription: string;
  imageUrl: string;
  characterGender: string;
}

interface N8nFormWithEmbedProps {
  webhookUrl: string;
  onBack?: () => void;
  className?: string;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'n8n-chat': any;
    }
  }
}

export default function N8nFormWithEmbed({ webhookUrl, onBack, className = '' }: N8nFormWithEmbedProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    response?: any;
    videoUrl?: string;
  } | null>(null);
  const [useFormMode, setUseFormMode] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [chatReady, setChatReady] = useState(false);

  // 初始化N8n Chat Widget
  useEffect(() => {
    if (!useFormMode && chatContainerRef.current) {
      initializeN8nChat();
    }
  }, [useFormMode, webhookUrl]);

  const initializeN8nChat = () => {
    if (!chatContainerRef.current) return;

    console.log('🚀 初始化N8n官方Chat Widget...');

    // 获取N8n域名以构建正确的脚本URL
    const url = new URL(webhookUrl);
    const n8nDomain = `${url.protocol}//${url.hostname}`;

    // 加载官方N8n chat widget脚本
    const script = document.createElement('script');
    script.src = `${n8nDomain}/chat-widget/v0.1.0/widget.js`;
    script.onload = () => {
      console.log('✅ N8n chat widget script loaded');
      
      // 创建N8n chat元素
      const chatHTML = `
        <n8n-chat
          url="${webhookUrl}"
          title="ProMe视频创作AI"
          accent-color="#8B5CF6"
          style="width: 100%; height: 500px;">
        </n8n-chat>
      `;

      if (chatContainerRef.current) {
        chatContainerRef.current.innerHTML = chatHTML;
        setChatReady(true);
        
        // 监听聊天消息
        setTimeout(() => {
          const chatElement = chatContainerRef.current?.querySelector('n8n-chat');
          if (chatElement) {
            chatElement.addEventListener('message', handleChatMessage);
          }
        }, 1000);
      }
    };
    script.onerror = () => {
      console.error('❌ Failed to load N8n chat widget script');
    };
    
    // 检查脚本是否已存在
    const existingScript = document.querySelector(`script[src="${script.src}"]`);
    if (!existingScript) {
      document.head.appendChild(script);
    } else {
      // 脚本已存在，直接初始化
      const chatHTML = `
        <n8n-chat
          url="${webhookUrl}"
          title="ProMe视频创作AI"
          accent-color="#8B5CF6"
          style="width: 100%; height: 500px;">
        </n8n-chat>
      `;
      if (chatContainerRef.current) {
        chatContainerRef.current.innerHTML = chatHTML;
        setChatReady(true);
      }
    }
  };

  const handleChatMessage = (event: any) => {
    console.log('📨 收到N8n聊天消息:', event.detail);
    
    try {
      const messageData = event.detail;
      
      // 检查消息是否包含视频URL
      if (messageData && typeof messageData === 'object') {
        const videoUrl = messageData.videoUrl || messageData.video_url || 
                        messageData.downloadUrl || messageData.download_url ||
                        messageData.url || messageData.link;
        
        if (videoUrl) {
          console.log('🎉 找到视频URL:', videoUrl);
          setSubmitResult({
            success: true,
            message: '🎉 视频生成完成！',
            videoUrl: videoUrl
          });
        }
      }
    } catch (error) {
      console.error('❌ 处理聊天消息时出错:', error);
    }
  };

  const sendToN8n = async (formData: VideoFormData) => {
    console.log('🚀 表单提交，发送数据到N8n:', formData);
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // 构建消息内容
      const messageContent = `视频创作需求：
🎬 视频时长：${formData.duration}秒
📝 产品描述：${formData.productDescription}
🖼️ 产品图片：${formData.imageUrl}
👤 人物性别：${formData.characterGender}

请根据以上信息创建视频内容。`;

      // 生成sessionId
      let sessionId = localStorage.getItem('n8n_session_id');
      if (!sessionId) {
        sessionId = `video_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('n8n_session_id', sessionId);
      }

      const payload = {
        action: "sendMessage",
        sessionId: sessionId,
        chatInput: messageContent
      };

      console.log('📤 发送数据到N8n:', payload);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const responseData = await response.text();
        console.log('✅ N8n响应:', responseData);

        // 解析响应查找视频URL
        let videoUrl = null;
        try {
          const parsedResponse = JSON.parse(responseData);
          videoUrl = parsedResponse.videoUrl || parsedResponse.video_url || 
                    parsedResponse.downloadUrl || parsedResponse.download_url ||
                    parsedResponse.url || parsedResponse.link;
        } catch (e) {
          // 检查文本响应
          const urlMatch = responseData.match(/https?:\/\/[^\s]+\.(mp4|mov|avi)/i);
          if (urlMatch) {
            videoUrl = urlMatch[0];
          }
        }

        if (videoUrl) {
          setSubmitResult({
            success: true,
            message: '🎉 视频生成完成！',
            response: responseData,
            videoUrl: videoUrl
          });
        } else {
          setSubmitResult({
            success: true,
            message: '✅ 请求已发送，AI正在处理中...',
            response: responseData
          });
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ 发送到N8n失败:', error);
      setSubmitResult({
        success: false,
        message: `❌ 连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
        response: error instanceof Error ? error.stack : String(error)
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitResult(null);
    setIsSubmitting(false);
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center mb-4">
            <Video className="h-6 w-6 text-purple-600 mr-2" />
            <div>
              <CardTitle>ProMe-UGC Real-Person Feedback Video Agent</CardTitle>
              <CardDescription>
                Let your product speak through real voices
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 模式切换 */}
          <div className="mb-6">
            <div className="flex items-center space-x-4">
              <Button
                variant={useFormMode ? "default" : "outline"}
                onClick={() => setUseFormMode(true)}
                className="flex items-center"
              >
                📝 表单模式
              </Button>
              <Button
                variant={!useFormMode ? "default" : "outline"}
                onClick={() => setUseFormMode(false)}
                className="flex items-center"
              >
                💬 聊天模式
              </Button>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {useFormMode ? '填写表单快速创建视频' : '与AI自由对话创建视频'}
            </p>
          </div>

          {/* 表单模式 */}
          {useFormMode && (
            <VideoCreationForm
              onSubmit={sendToN8n}
              isLoading={isSubmitting}
            />
          )}

          {/* 聊天模式 */}
          {!useFormMode && (
            <div className="space-y-4">
              <Alert>
                <MessageSquare className="h-4 w-4" />
                <AlertDescription>
                  <strong>💬 聊天模式：</strong>
                  <br />• 直接与AI对话描述您的视频需求
                  <br />• AI会引导您提供必要信息（时长、描述、图片、性别）
                  <br />• 更自然的交互体验
                </AlertDescription>
              </Alert>

              <div 
                ref={chatContainerRef} 
                className="bg-white rounded-lg border"
              >
                {!chatReady && (
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                      <p className="text-gray-600">正在加载N8n聊天组件...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 结果显示 */}
          {submitResult && (
            <div className="mt-6">
              <Alert className={submitResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-center">
                  {submitResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  )}
                  <AlertDescription className={submitResult.success ? 'text-green-800' : 'text-red-800'}>
                    {submitResult.message}
                  </AlertDescription>
                </div>
              </Alert>

              {/* 视频结果 */}
              {submitResult.success && submitResult.videoUrl && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200 mt-4">
                  <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    🎉 视频生成完成！
                  </h4>
                  
                  <div className="space-y-3">
                    <a 
                      href={submitResult.videoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      📹 下载视频
                      <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    
                    <p className="text-sm text-green-700">
                      <strong>视频地址:</strong> {submitResult.videoUrl}
                    </p>
                  </div>
                </div>
              )}

              {submitResult.response && (
                <div className="bg-gray-50 p-4 rounded-lg mt-4">
                  <h4 className="font-semibold mb-2">AI响应：</h4>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto max-h-32">
                    {submitResult.response}
                  </pre>
                </div>
              )}

              <div className="flex space-x-3 mt-4">
                <Button onClick={handleReset} variant="outline" className="flex-1">
                  创建新视频
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}