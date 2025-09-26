import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Video, MessageSquare } from 'lucide-react';

interface N8nSimpleEmbedProps {
  webhookUrl: string;
  className?: string;
}

export default function N8nSimpleEmbed({ webhookUrl, className = '' }: N8nSimpleEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoResult, setVideoResult] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 直接插入N8n官方embed代码
    // 请将这里的脚本URL替换为你在N8n编辑器中看到的实际URL
    const embedHTML = `
      <script src="https://n8n-worker-k4m9.zeabur.app/chat-widget/v0.1.0/widget.js"></script>
      <n8n-chat
        url="${webhookUrl}"
        title="ProMe视频创作AI"
        accent-color="#8B5CF6"
        style="width: 100%; height: 500px;">
      </n8n-chat>
    `;

    containerRef.current.innerHTML = embedHTML;

    // 监听全局消息事件
    const handleMessage = (event: MessageEvent) => {
      console.log('📨 收到消息:', event.data);
      
      // 检查是否包含视频URL
      if (event.data && typeof event.data === 'object') {
        const videoUrl = event.data.videoUrl || event.data.url;
        if (videoUrl) {
          console.log('🎉 找到视频URL:', videoUrl);
          setVideoResult(videoUrl);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [webhookUrl]);

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
              <strong>💬 使用方法：</strong>
              <br />• 告诉AI你的产品信息（描述、图片URL、视频时长、人物性别）
              <br />• AI将生成真人反馈视频
              <br />• 等待2-5分钟即可获得下载链接
            </AlertDescription>
          </Alert>

          {/* N8n Embed容器 */}
          <div className="mb-6">
            <div 
              ref={containerRef} 
              className="bg-white rounded-lg"
            >
              {/* N8n chat widget will be inserted here */}
            </div>
          </div>

          {/* 视频结果显示 */}
          {videoResult && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="text-green-800">
                  <h4 className="font-semibold mb-2">🎉 视频生成完成！</h4>
                  <a 
                    href={videoResult} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    📹 下载视频
                  </a>
                  <p className="text-sm mt-2">
                    <strong>URL:</strong> {videoResult}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}