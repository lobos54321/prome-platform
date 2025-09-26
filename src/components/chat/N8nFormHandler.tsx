import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, ArrowLeft, MessageSquare } from 'lucide-react';
import VideoCreationForm from '@/components/forms/VideoCreationForm';
import { useTranslation } from 'react-i18next';

interface VideoFormData {
  duration: string;
  productDescription: string;
  imageUrl: string;
  characterGender: string;
}

interface N8nFormHandlerProps {
  webhookUrl: string;
  onBack?: () => void;
  className?: string;
}

export default function N8nFormHandler({ webhookUrl, onBack, className = '' }: N8nFormHandlerProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    response?: any;
    videoUrl?: string;
    isProcessing?: boolean;
  } | null>(null);
  
  const chatRef = useRef<any>(null);
  const [isChatReady, setIsChatReady] = useState(false);

  // 初始化N8n Chat连接
  useEffect(() => {
    // 提取N8n基础URL和工作流信息
    const baseUrl = webhookUrl.replace(/\/webhook\/.*$/, '');
    
    console.log('🔗 初始化N8n Chat连接:', baseUrl);
    
    // 创建WebSocket连接或使用N8n Chat API
    initializeN8nChat(baseUrl);
    
    return () => {
      // 清理连接
      if (chatRef.current && chatRef.current.destroy) {
        chatRef.current.destroy();
      }
    };
  }, [webhookUrl]);

  const initializeN8nChat = async (baseUrl: string) => {
    try {
      console.log('🚀 建立N8n Chat连接...');
      setIsChatReady(true);
    } catch (error) {
      console.error('❌ N8n Chat连接失败:', error);
    }
  };

  // 智能等待最终结果
  const startWaitingForFinalResult = async (taskId: string | null) => {
    console.log('🔄 开始智能等待最终结果...');
    
    // 重新启动加载状态
    setIsSubmitting(true);
    
    const pollInterval = 15000; // 15秒间隔，给AI Agent足够时间
    const maxAttempts = 20; // 最多5分钟 (15s * 20 = 300s)
    let attempts = 0;
    
    const waitAndCheck = async () => {
      attempts++;
      console.log(`📡 第${attempts}次检查最终结果...`);
      
      try {
        // 使用相同的sessionId发送查询请求
        let sessionId = localStorage.getItem('n8n_session_id');
        if (!sessionId) {
          sessionId = `video_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          localStorage.setItem('n8n_session_id', sessionId);
        }

        // 发送查询请求，希望获得包含videoUrl的响应
        const queryPayload = {
          action: "sendMessage",
          sessionId: sessionId,
          chatInput: taskId ? `查询任务${taskId}的执行结果` : "请提供视频生成的最终结果"
        };
        
        console.log('🔍 发送结果查询请求:', queryPayload);
        
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(queryPayload)
        });
        
        if (response.ok) {
          const responseData = await response.text();
          console.log('📊 查询响应 (第' + attempts + '次):', responseData);
          console.log('📊 查询响应长度:', responseData.length);
          console.log('📊 查询响应类型:', typeof responseData);
          
          // 检查是否包含videoUrl
          let videoUrl = null;
          try {
            const parsedResponse = JSON.parse(responseData);
            console.log('📋 解析的JSON对象:', JSON.stringify(parsedResponse, null, 2));
            
            videoUrl = parsedResponse.videoUrl || parsedResponse.video_url || 
                      parsedResponse.downloadUrl || parsedResponse.download_url ||
                      parsedResponse.result || parsedResponse.output ||
                      parsedResponse.finalVideoUrl || parsedResponse.url ||
                      parsedResponse.link || parsedResponse.download ||
                      parsedResponse.file_url || parsedResponse.fileUrl;
            
            console.log('🔍 从字段提取的videoUrl:', videoUrl);
            
            // 处理N8n特殊格式
            if (parsedResponse.finalVideoUrl && typeof parsedResponse.finalVideoUrl === 'string') {
              const match = parsedResponse.finalVideoUrl.match(/视频地址[：:]\s*(https?:\/\/[^\s]+)/);
              if (match) {
                videoUrl = match[1];
                console.log('🎯 从finalVideoUrl提取到:', videoUrl);
              }
            }
            
            // 如果还没找到，尝试在所有字符串值中查找URL
            if (!videoUrl) {
              Object.keys(parsedResponse).forEach(key => {
                const value = parsedResponse[key];
                if (typeof value === 'string' && (value.includes('http') && (value.includes('.mp4') || value.includes('.mov') || value.includes('.avi')))) {
                  console.log(`🔍 在字段 ${key} 中发现可能的视频URL:`, value);
                  if (!videoUrl) videoUrl = value;
                }
              });
            }
          } catch (e) {
            console.log('📝 不是JSON格式，检查文本内容:', e);
            // 检查文本响应
            const urlMatch = responseData.match(/https?:\/\/[^\s]+\.(mp4|mov|avi)/gi);
            if (urlMatch && urlMatch.length > 0) {
              videoUrl = urlMatch[0];
              console.log('🎯 从文本中提取到视频URL:', videoUrl);
            }
            
            // 检查是否是N8n的文本格式响应 "视频地址：[URL]"
            const match = responseData.match(/视频地址[：:]\s*(https?:\/\/[^\s]+)/);
            if (match) {
              videoUrl = match[1];
              console.log('🎯 从中文格式提取到视频URL:', videoUrl);
            }
          }
          
          if (videoUrl) {
            // 找到最终结果！
            console.log('🎉 找到最终视频URL:', videoUrl);
            setSubmitResult({
              success: true,
              message: '🎉 视频生成完成！',
              response: responseData,
              videoUrl: videoUrl,
              isProcessing: false
            });
            setIsSubmitting(false); // 重置按钮状态
            return; // 停止轮询
          }
          
          // 检查是否有错误信息
          if (responseData.includes('失败') || responseData.includes('错误') || responseData.includes('error')) {
            console.log('❌ 检测到错误信息');
            setSubmitResult({
              success: false,
              message: '❌ 视频生成过程中出现错误',
              response: responseData,
              isProcessing: false
            });
            setIsSubmitting(false); // 重置按钮状态
            return; // 停止轮询
          }
        }
        
        // 继续等待
        if (attempts < maxAttempts) {
          console.log(`⏳ 第${attempts}次检查完成，${pollInterval/1000}秒后继续...`);
          
          // 更新进度显示
          setSubmitResult(prev => prev ? {
            ...prev,
            message: `🔄 AI Agent正在处理中... (第${attempts}/${maxAttempts}次检查)`,
            response: `${prev.response}\n\n⏳ 检查进度：${attempts}/${maxAttempts} - 预计还需${Math.ceil((maxAttempts - attempts) * pollInterval / 60000)}分钟`
          } : null);
          
          setTimeout(waitAndCheck, pollInterval);
        } else {
          console.log('⏰ 检查超时，但视频可能仍在生成中');
          setSubmitResult(prev => prev ? {
            ...prev,
            message: '⏰ 监控超时，但视频可能仍在后台生成。请稍后手动检查N8n工作流状态。',
            isProcessing: false
          } : null);
          setIsSubmitting(false); // 重置按钮状态
        }
        
      } catch (error) {
        console.error(`❌ 第${attempts}次检查失败:`, error);
        if (attempts < maxAttempts) {
          setTimeout(waitAndCheck, pollInterval);
        } else {
          setSubmitResult(prev => prev ? {
            ...prev,
            message: '❌ 无法获取最终结果，请手动检查N8n工作流状态。',
            isProcessing: false
          } : null);
          setIsSubmitting(false); // 重置按钮状态
        }
      }
    };
    
    // 首次等待稍长一些，给AI Agent足够时间处理
    console.log('⏰ 等待30秒后开始第一次检查...');
    setTimeout(waitAndCheck, 30000);
  };

  const sendToN8n = async (formData: VideoFormData) => {
    console.log('🚀 sendToN8n function called with data:', formData);
    console.log('🔗 Using webhook URL:', webhookUrl);
    console.log('🔧 Current state - isSubmitting:', isSubmitting);
    console.log('🔧 Current state - submitResult:', submitResult);
    
    setIsSubmitting(true);
    setSubmitResult(null);
    
    console.log('✅ State updated - isSubmitting set to true');

    let shouldResetInFinally = true; // 控制是否在finally中重置状态

    try {
      // 基于N8n返回的配置，使用正确的数据格式
      const messageContent = `视频创作需求：
🎬 视频时长：${formData.duration}秒
📝 产品描述：${formData.productDescription}
🖼️ 产品图片：${formData.imageUrl}
👤 人物性别：${formData.characterGender}

请根据以上信息创建视频内容。`;

      // 生成或获取持久化的sessionId
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

      // 设置初始状态 - 等待完整工作流响应
      setSubmitResult({
        success: true,
        message: '✅ 请求已发送，正在等待AI处理您的视频创作需求...',
        response: JSON.stringify(payload, null, 2),
        isProcessing: true
      });

      console.log('🔄 等待N8n工作流完成，保持连接直到收到最终结果...');
      
      // 不设置任何超时，让N8n自然完成并返回结果
      // N8n Chat Trigger会保持连接直到工作流完成
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
        // 不使用 signal: controller.signal，让连接自然保持
      });

      console.log('📡 响应状态:', response.status);
      
      if (response.ok) {
        const responseData = await response.text();
        console.log('✅ N8n工作流完成，收到最终响应');
        console.log('📄 最终响应数据:', responseData);
        console.log('📏 响应长度:', responseData.length);
        
        // 解析最终响应，查找视频URL
        let parsedResponse = null;
        let videoUrl = null;
        
        try {
          parsedResponse = JSON.parse(responseData);
          console.log('📊 解析的JSON响应:', parsedResponse);
          
          // 检查N8n子工作流返回的标准格式 {"videoUrl": "https://..."}
          if (parsedResponse.videoUrl) {
            videoUrl = parsedResponse.videoUrl;
            console.log('🎥 找到标准videoUrl字段:', videoUrl);
          }
          
          // 检查其他可能的字段
          if (!videoUrl) {
            videoUrl = parsedResponse.video_url || 
                      parsedResponse.downloadUrl || parsedResponse.download_url ||
                      parsedResponse.result || parsedResponse.output ||
                      parsedResponse.finalVideoUrl;
          }
          
          // 如果是N8n的finalVideoUrl格式 "视频地址：[URL]"，提取实际URL
          if (parsedResponse.finalVideoUrl && typeof parsedResponse.finalVideoUrl === 'string') {
            const match = parsedResponse.finalVideoUrl.match(/视频地址[：:]\s*(https?:\/\/[^\s]+)/);
            if (match) {
              videoUrl = match[1];
              console.log('🎥 从finalVideoUrl提取到视频地址:', videoUrl);
            }
          }
          
        } catch (e) {
          console.log('📝 响应不是JSON格式，检查文本内容');
          
          // 如果不是JSON，检查是否直接是URL
          if (responseData.includes('http') && (responseData.includes('.mp4') || responseData.includes('.mov'))) {
            videoUrl = responseData.trim();
            console.log('🎥 响应直接包含视频URL:', videoUrl);
          }
          
          // 检查是否是N8n的文本格式响应 "视频地址：[URL]"
          const match = responseData.match(/视频地址[：:]\s*(https?:\/\/[^\s]+)/);
          if (match) {
            videoUrl = match[1];
            console.log('🎥 从文本响应提取到视频地址:', videoUrl);
          }
        }
        
        if (videoUrl) {
          // 成功收到视频URL
          console.log('🎉 视频生成完成！最终URL:', videoUrl);
          setSubmitResult({
            success: true,
            message: '🎉 视频生成完成！',
            response: responseData,
            videoUrl: videoUrl,
            isProcessing: false
          });
        } else {
          // 检查是否是AI Agent的Streaming进度消息
          let isProgressMessage = false;
          let taskId = null;
          let progressContent = '';
          
          try {
            const parsedResponse = JSON.parse(responseData);
            
            // 检查是否是包含taskId的进度消息 (AI Agent Streaming第一步)
            if (parsedResponse.code === 200 && parsedResponse.data && parsedResponse.data.taskId) {
              taskId = parsedResponse.data.taskId;
              isProgressMessage = true;
              progressContent = 'AI正在规划视频生成任务...';
              console.log('📋 收到AI Agent规划消息，taskId:', taskId);
            }
            // 检查是否是其他进度消息格式
            else if (parsedResponse.msg === 'success' || parsedResponse.role === 'assistant') {
              isProgressMessage = true;
              progressContent = parsedResponse.content || parsedResponse.msg || '视频生成中，请稍等...';
              console.log('📝 收到AI Agent进度消息:', progressContent);
            }
          } catch (e) {
            // 可能是纯文本进度消息
            if (responseData && !responseData.includes('http')) {
              isProgressMessage = true;
              progressContent = responseData;
              console.log('📄 收到文本进度消息:', progressContent);
            }
          }
          
          if (isProgressMessage) {
            // 这是进度消息，开始轮询等待最终结果
            console.log('⏳ 识别为进度消息，开始智能等待最终结果...');
            setSubmitResult({
              success: true,
              message: '🔄 AI Agent正在处理中...',
              response: `${progressContent}\n\n📋 处理状态：\n• AI已接收任务并开始规划\n• 正在调用视频生成子工作流\n• 预计2-5分钟完成\n\n原始响应：\n${responseData}`,
              isProcessing: true
            });
            
            // 启动智能等待机制
            shouldResetInFinally = false; // 不在finally中重置，由轮询函数管理
            if (taskId) {
              console.log('🎯 使用taskId启动结果监控:', taskId);
              startWaitingForFinalResult(taskId);
            } else {
              console.log('⏱️ 使用时间间隔等待最终结果');
              startWaitingForFinalResult(null);
            }
            
            return;
          } else {
            // 这不是进度消息，但也没有videoUrl，可能是配置问题
            console.log('❓ 收到非进度消息但无videoUrl');
            setSubmitResult({
              success: false,
              message: '⚠️ 收到了响应但未找到视频URL，请检查N8n子工作流的输出格式。',
              response: responseData,
              isProcessing: false
            });
          }
        }
      } else if (response.status === 500) {
        const errorText = await response.text();
        console.log('❌ N8n workflow error:', errorText);
        
        setSubmitResult({
          success: false,
          message: '❌ N8n工作流执行出错，请检查工作流配置。',
          response: errorText
        });
      } else {
        const errorText = await response.text();
        console.log('❌ HTTP错误响应:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
    } catch (error) {
      console.error('❌ N8n请求失败:', error);
      
      setSubmitResult({
        success: false,
        message: `❌ 连接失败: ${error instanceof Error ? error.message : '未知错误'}。请检查网络连接和N8n工作流状态。`,
        response: error instanceof Error ? error.stack : String(error)
      });
    } finally {
      if (shouldResetInFinally) {
        console.log('🔧 Finally块：重置isSubmitting状态');
        setIsSubmitting(false);
      } else {
        console.log('🔧 Finally块：跳过重置isSubmitting，由轮询函数管理');
      }
    }
  };

  const handleReset = () => {
    console.log('🔄 Resetting form state');
    setSubmitResult(null);
    setIsSubmitting(false);
  };

  const handleForceReset = () => {
    console.log('🚨 Force resetting all states');
    setSubmitResult(null);
    setIsSubmitting(false);
  };

  return (
    <div className={className}>
      <VideoCreationForm
        onSubmit={sendToN8n}
        isLoading={isSubmitting}
      />
      
      {/* 强制重置按钮 - 仅在卡住时显示 */}
      {isSubmitting && !submitResult && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-yellow-800">请求正在处理中...</h4>
              <p className="text-sm text-yellow-700">如果长时间无响应，可以强制重置</p>
            </div>
            <Button 
              onClick={handleForceReset} 
              variant="outline" 
              size="sm"
              className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
            >
              强制重置
            </Button>
          </div>
        </div>
      )}
      
      {/* 状态显示区域 */}
      {submitResult && (
        <div className="mt-6">
          <Card>
            <CardContent className="pt-6">
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

              {submitResult.success && !submitResult.videoUrl && (
                <div className="bg-blue-50 p-4 rounded-lg mt-4">
                  <h4 className="font-semibold text-blue-800 mb-2">
                    {submitResult.isProcessing ? '⏳ 视频生成中...' : '✅ 处理状态：'}
                  </h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• AI Agent正在处理您的视频创作需求</li>
                    <li>• 处理时间通常为2-5分钟</li>
                    {submitResult.isProcessing && (
                      <li>• 🔄 智能监控：自动检测AI Agent Streaming消息</li>
                    )}
                    <li>• 生成完成后会自动显示下载链接</li>
                    <li>• 请保持页面打开，不要刷新或关闭</li>
                  </ul>
                  
                  {submitResult.isProcessing && (
                    <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        <span className="text-sm text-blue-800">智能等待：处理AI Agent Streaming，自动获取最终结果...</span>
                      </div>
                      <div className="mt-2 text-xs text-blue-600">
                        💡 方案B：忽略进度消息，只认包含videoUrl的消息为最终成功
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 视频生成完成 - 显示下载链接 */}
              {submitResult.success && submitResult.videoUrl && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200 mt-4">
                  <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    🎉 视频生成完成！
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded border">
                      <p className="text-sm text-gray-600 mb-2">您的视频已准备就绪：</p>
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
                    </div>
                    
                    <div className="text-sm text-green-700">
                      <p className="font-medium mb-1">💡 使用建议：</p>
                      <ul className="space-y-1 ml-4">
                        <li>• 右键点击"下载视频"可保存到本地</li>
                        <li>• 视频适合社交媒体分享和营销推广</li>
                        <li>• 建议在使用前预览确认效果</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {!submitResult.success && submitResult && (
                <div className="bg-yellow-50 p-4 rounded-lg mt-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">调试信息：</h4>
                  <p className="text-sm text-yellow-700 mb-2">
                    如果问题持续，请检查：
                  </p>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• N8n工作流是否已启动并激活</li>
                    <li>• Webhook URL是否正确</li>
                    <li>• 网络连接是否正常</li>
                    <li>• 查看浏览器控制台获取详细错误信息</li>
                  </ul>
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
                
                {submitResult.success && (
                  <Button 
                    onClick={() => window.open(webhookUrl.replace('/webhook/', '/workflow/'), '_blank')}
                    variant="outline"
                    className="flex-1"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    查看N8n工作流
                  </Button>
                )}
                
                {submitResult.success && submitResult.isProcessing && (
                  <Button 
                    onClick={() => window.open('https://n8n-worker-k4m9.zeabur.app/workflow/DdWZ4pp46LPTTEdl', '_blank')}
                    variant="outline"
                    className="flex-1 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    🔍 检查执行状态
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}