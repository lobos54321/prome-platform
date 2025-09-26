import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Video, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface N8nEmbedChatProps {
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

export default function N8nEmbedChat({ webhookUrl, onBack, className = '' }: N8nEmbedChatProps) {
  const { t } = useTranslation();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [videoResult, setVideoResult] = useState<{ url: string; message: string } | null>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // 避免重复加载脚本
    if (scriptLoadedRef.current) {
      initializeChatWidget();
      return;
    }

    // 从webhook URL提取N8n域名
    const url = new URL(webhookUrl);
    const n8nDomain = `${url.protocol}//${url.hostname}`;
    
    // 检查是否已存在脚本
    const existingScript = document.querySelector('script[src*="chat-widget"]');
    if (existingScript) {
      console.log('✅ N8n chat script already exists');
      setIsScriptLoaded(true);
      scriptLoadedRef.current = true;
      initializeChatWidget();
      return;
    }

    // 使用官方文档格式的脚本URL
    const script = document.createElement('script');
    script.src = `${n8nDomain}/chat-widget/v0.1.0/widget.js`;
    script.async = true;
    script.onload = () => {
      console.log('✅ N8n official chat widget script loaded');
      setIsScriptLoaded(true);
      scriptLoadedRef.current = true;
      setTimeout(initializeChatWidget, 100);
    };
    script.onerror = () => {
      console.error('❌ Failed to load N8n chat widget script');
      console.log('🔄 Trying fallback script URL...');
      // 尝试备用脚本地址
      const fallbackScript = document.createElement('script');
      fallbackScript.src = `${n8nDomain}/assets/chat-widget.js`;
      fallbackScript.async = true;
      fallbackScript.onload = () => {
        console.log('✅ N8n fallback script loaded');
        setIsScriptLoaded(true);
        scriptLoadedRef.current = true;
        setTimeout(initializeChatWidget, 100);
      };
      fallbackScript.onerror = () => {
        console.error('❌ Both script URLs failed');
      };
      document.head.appendChild(fallbackScript);
    };
    
    document.head.appendChild(script);

    return () => {
      // 清理时不移除脚本，因为可能被其他组件使用
    };
  }, [webhookUrl]);

  const initializeChatWidget = () => {
    if (!chatContainerRef.current) {
      console.warn('Chat container not ready');
      return;
    }

    console.log('🚀 初始化N8n Chat Widget...');

    // 创建n8n-chat元素 (官方方式)
    const chatHTML = `
      <n8n-chat
        webhook-url="${webhookUrl}"
        chat-input-key="chatInput"
        chat-session-key="sessionId"
        mode="embedded"
        target="iframe"
        style="width: 100%; height: 500px; border: 1px solid #e2e8f0; border-radius: 8px;">
      </n8n-chat>
    `;

    // 设置HTML内容
    chatContainerRef.current.innerHTML = chatHTML;

    // 等待元素创建完成后添加事件监听
    setTimeout(() => {
      const chatElement = chatContainerRef.current?.querySelector('n8n-chat');
      if (chatElement) {
        console.log('✅ N8n chat element found, adding event listeners');
        
        // 监听N8n chat消息事件
        chatElement.addEventListener('message', handleChatMessage);
        chatElement.addEventListener('response', handleChatMessage);
        
        // 如果有自定义事件监听
        if (window.addEventListener) {
          window.addEventListener('n8n-chat:message', handleChatMessage);
        }
      }
    }, 500);
  };

  const handleChatMessage = (event: any) => {
    console.log('📨 收到N8n聊天消息:', event);
    console.log('📨 事件详情:', event.detail);
    console.log('📨 事件数据:', event.data);

    try {
      let messageData = event.detail || event.data || event;
      
      console.log('🔍 处理消息数据:', messageData);

      // 如果是字符串，尝试解析为JSON
      if (typeof messageData === 'string') {
        try {
          messageData = JSON.parse(messageData);
        } catch {
          // 检查文本中是否包含视频URL
          const urlMatch = messageData.match(/https?:\/\/[^\s]+\.(mp4|mov|avi)/i);
          if (urlMatch) {
            console.log('🎉 从文本消息中找到视频URL:', urlMatch[0]);
            setVideoResult({
              url: urlMatch[0],
              message: messageData
            });
            return;
          }
        }
      }

      // 检查消息是否包含视频URL
      if (messageData && typeof messageData === 'object') {
        const videoUrl = messageData.videoUrl || messageData.video_url || 
                        messageData.downloadUrl || messageData.download_url ||
                        messageData.url || messageData.link || messageData.result;
        
        if (videoUrl) {
          console.log('🎉 找到视频URL:', videoUrl);
          setVideoResult({
            url: videoUrl,
            message: messageData.text || messageData.content || '✅ 视频生成完成！'
          });
        } else {
          console.log('🔍 未在消息中找到视频URL，字段:', Object.keys(messageData));
        }
      }
    } catch (error) {
      console.error('❌ 处理聊天消息时出错:', error);
    }
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
          {/* 使用指南 */}
          <Alert className="mb-6">
            <MessageSquare className="h-4 w-4" />
            <AlertDescription>
              <strong>💬 如何使用：</strong>
              <br />• 在下方聊天框中描述您的产品信息
              <br />• 包括：视频时长、产品描述、产品图片URL、人物性别偏好
              <br />• AI将根据您的输入生成真人反馈视频
              <br />• 视频生成通常需要2-5分钟，请耐心等待
            </AlertDescription>
          </Alert>

          {/* N8n官方Chat Widget */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">🤖 AI视频创作助手</h3>
            {!isScriptLoaded ? (
              <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">正在加载官方N8n聊天组件...</p>
                </div>
              </div>
            ) : (
              <div 
                ref={chatContainerRef} 
                className="bg-white rounded-lg shadow-sm"
              >
                {/* N8n chat widget will be inserted here */}
              </div>
            )}
          </div>

          {/* 视频结果显示 */}
          {videoResult && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="text-green-800">
                  <h4 className="font-semibold mb-2">🎉 视频生成完成！</h4>
                  <p className="mb-3">{videoResult.message}</p>
                  <div className="space-y-2">
                    <a 
                      href={videoResult.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors mr-3"
                    >
                      📹 下载视频
                      <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <a 
                      href={videoResult.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      🎬 在线预览
                    </a>
                  </div>
                  <p className="text-sm mt-2 text-green-700">
                    <strong>视频地址:</strong> {videoResult.url}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* 技术说明 */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">🔧 技术架构：</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 基于N8n官方Chat Trigger的embed模式</li>
              <li>• 工作流最后一个节点自动返回结果到前端</li>
              <li>• 无需复杂轮询，直接接收工作流输出</li>
              <li>• 支持实时消息监听和视频URL自动解析</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}