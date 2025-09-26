import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Video } from 'lucide-react';
import VideoCreationForm from '@/components/forms/VideoCreationForm';
import { useTranslation } from 'react-i18next';
// 注意：@n8n/chat的正确使用方式

interface VideoFormData {
  duration: string;
  productDescription: string;
  imageUrl: string;
  characterGender: string;
}

interface N8nFormOnlyProps {
  webhookUrl: string;
  onBack?: () => void;
  className?: string;
}

export default function N8nFormOnly({ webhookUrl, onBack, className = '' }: N8nFormOnlyProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    response?: any;
    videoUrl?: string;
    isProcessing?: boolean;
  } | null>(null);

  // 添加调试信息
  console.log('🔧 N8nFormOnly组件已挂载，webhookUrl:', webhookUrl);

  // 视频URL提取函数（支持Chat Trigger的各种响应格式）
  const extractVideoUrl = (text: string): string | null => {
    console.log('🔍 尝试提取视频URL，响应内容:', text);
    
    // 尝试多种可能的URL格式，包括Chat Trigger的特殊格式
    const urlPatterns = [
      // 直接的视频URL
      /https?:\/\/[^\s"'<>]+\.(?:mp4|avi|mov|wmv|flv|webm|mkv|MP4|AVI|MOV|WMV|FLV|WEBM|MKV)/gi,
      
      // JSON格式的各种字段名（匹配全小写finalvideourl）
      /"(?:videoUrl|finalvideoURL|finalvideourl|video_url|videoLink|downloadUrl|fileUrl|mediaUrl)"?\s*:\s*"([^"]+)"/gi,
      
      // Chat Trigger的text/output字段（根据文档说明）
      /"(?:text|output)"?\s*:\s*"(https?:\/\/[^\s"'<>]+\.(?:mp4|avi|mov|wmv|flv|webm|mkv)[^"]*)"/gi,
      
      // 可能在HTML或纯文本中的URL
      /(?:视频地址|下载链接|Video URL|Download|Link)[:：]\s*(https?:\/\/[^\s"'<>]+\.(?:mp4|avi|mov|wmv|flv|webm|mkv))/gi,
      
      // 纯文本中的视频URL
      /(https?:\/\/[^\s"'<>]+\.(?:mp4|avi|mov|wmv|flv|webm|mkv))/gi,
      
      // 任何包含视频扩展名的URL（最宽松的匹配）
      /"[^"]*"?\s*:\s*"([^"]*(?:mp4|avi|mov|wmv|flv|webm|mkv)[^"]*)"/gi
    ];

    for (const pattern of urlPatterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        const url = matches[0][1] || matches[0][0];
        // 验证URL格式
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
    console.log('🚀 使用N8n官方组件，收到表单数据:', formData);
    
    if (isSubmitting) {
      console.log('⏸️ 正在提交中，忽略重复请求');
      return;
    }
    
    setIsSubmitting(true);
    
    // 立即显示处理状态
    setSubmitResult({
      success: true,
      message: '✅ 请求已发送，AI正在为您创作视频...',
      response: '正在使用N8n官方组件处理您的请求...',
      isProcessing: true
    });

    try {
      console.log('📡 调用N8n官方createChat组件');
      
      // 使用N8n官方组件
      const chat = createChat({
        webhookUrl: webhookUrl,
        metadata: {
          duration: formData.duration,
          productDescription: formData.productDescription,
          imageUrl: formData.imageUrl,
          characterGender: formData.characterGender
        }
      });

      // 发送消息触发工作流
      const messageContent = `视频创作需求：
🎬 视频时长：${formData.duration}秒
📝 产品描述：${formData.productDescription}
🖼️ 产品图片：${formData.imageUrl}
👤 人物性别：${formData.characterGender}

请根据以上信息创建视频内容。`;

      console.log('📤 发送消息到N8n:', messageContent);
      
      // N8n官方组件会自动处理异步等待
      const result = await chat.sendMessage(messageContent);
      
      console.log('✅ N8n官方组件返回结果:', result);
      
      // 提取视频URL
      const videoUrl = extractVideoUrl(JSON.stringify(result));
      
      if (videoUrl) {
        console.log('🎉 成功提取视频URL:', videoUrl);
        setSubmitResult({
          success: true,
          message: '🎉 视频生成完成！',
          response: JSON.stringify(result, null, 2),
          videoUrl: videoUrl,
          isProcessing: false
        });
      } else {
        console.log('⚠️ 未找到视频URL，显示原始结果');
        setSubmitResult({
          success: true,
          message: '✅ 收到N8n响应，请检查结果',
          response: JSON.stringify(result, null, 2),
          isProcessing: false
        });
      }
      
    } catch (error) {
      console.error('❌ N8n官方组件调用失败:', error);
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

  const sendRequestToN8n = async (formData: VideoFormData) => {
    try {
      // 构建消息内容（与之前完全一致）
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

      console.log('📤 完整发送载荷:', JSON.stringify(payload, null, 2));
      console.log('📤 消息内容:', messageContent);

      // 发送请求到N8n（不设超时，让N8n自然完成）
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('📡 HTTP响应状态:', response.status, response.statusText);
      console.log('📡 响应headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const responseData = await response.text();
        console.log('✅ N8n工作流原始响应:', responseData);
        console.log('📏 响应长度:', responseData.length);
        console.log('📏 响应类型:', typeof responseData);

        // 解析响应查找视频URL
        let videoUrl = null;
        let parsedResponse = null;

        try {
          parsedResponse = JSON.parse(responseData);
          console.log('📊 成功解析JSON响应:', JSON.stringify(parsedResponse, null, 2));
          console.log('📊 JSON对象所有键:', Object.keys(parsedResponse));

          // 优先检查你的自定义字段名 finalvideoURL
          videoUrl = parsedResponse.finalvideoURL || 
                    parsedResponse.finalVideoURL ||
                    parsedResponse.finalVideoUrl ||
                    parsedResponse.videoUrl || parsedResponse.video_url || 
                    parsedResponse.downloadUrl || parsedResponse.download_url ||
                    parsedResponse.result || parsedResponse.output ||
                    parsedResponse.url || parsedResponse.link || 
                    parsedResponse.download || parsedResponse.file_url || 
                    parsedResponse.fileUrl;

          console.log('🔍 从字段提取的videoUrl:', videoUrl);

          // 处理N8n特殊格式 "视频地址：[URL]"
          if (parsedResponse.finalVideoUrl && typeof parsedResponse.finalVideoUrl === 'string') {
            const match = parsedResponse.finalVideoUrl.match(/视频地址[：:]\s*(https?:\/\/[^\s]+)/);
            if (match) {
              videoUrl = match[1];
              console.log('🎯 从finalVideoUrl提取到:', videoUrl);
            }
          }

          // 如果还没找到，在所有字符串值中查找视频URL
          if (!videoUrl) {
            Object.keys(parsedResponse).forEach(key => {
              const value = parsedResponse[key];
              if (typeof value === 'string' && value.includes('http') && 
                  (value.includes('.mp4') || value.includes('.mov') || value.includes('.avi'))) {
                console.log(`🔍 在字段 ${key} 中发现可能的视频URL:`, value);
                if (!videoUrl) videoUrl = value;
              }
            });
          }

        } catch (e) {
          console.log('📝 不是JSON格式，作为纯文本处理:', e);
          console.log('📄 原始文本内容:', responseData);
          
          // 直接在文本中查找视频URL
          const urlMatch = responseData.match(/https?:\/\/[^\s]+\.(mp4|mov|avi|m4v|webm)/gi);
          if (urlMatch && urlMatch.length > 0) {
            videoUrl = urlMatch[0];
            console.log('🎯 从文本中提取到视频URL:', videoUrl);
          }

          // 检查中文格式 "视频地址：[URL]"
          const chineseMatch = responseData.match(/视频地址[：:]\s*(https?:\/\/[^\s]+)/);
          if (chineseMatch) {
            videoUrl = chineseMatch[1];
            console.log('🎯 从中文格式提取到视频URL:', videoUrl);
          }

          // 检查任何包含http的行
          const lines = responseData.split('\n');
          lines.forEach((line, index) => {
            if (line.includes('http')) {
              console.log(`📄 第${index + 1}行包含http:`, line);
            }
          });
        }

        if (videoUrl) {
          // 成功找到视频URL - 直接完成
          console.log('🎉 视频生成完成！最终URL:', videoUrl);
          setSubmitResult({
            success: true,
            message: '🎉 视频生成完成！',
            response: responseData,
            videoUrl: videoUrl,
            isProcessing: false
          });
        } else {
          // 检查是否是AI Agent的taskId响应
          let hasTaskId = false;
          try {
            const parsedResponse = JSON.parse(responseData);
            if (parsedResponse && parsedResponse.data && parsedResponse.data.taskId) {
              hasTaskId = true;
              console.log('📋 检测到AI Agent taskId，开始轮询监听...');
            }
          } catch (e) {
            console.log('响应不是JSON格式，可能是其他类型的输出');
          }
          
          if (hasTaskId) {
            // AI Agent异步处理 - 开始轮询
            console.log('🔄 AI Agent正在处理，开始轮询检查结果...');
            setSubmitResult(prev => prev ? {
              ...prev,
              message: '🔄 AI Agent正在处理中，请等待...',
              response: `${prev.response}\n\nN8n响应: ${responseData}`,
              isProcessing: true
            } : {
              success: true,
              message: '🔄 AI Agent正在处理中，请等待...',
              response: responseData,
              isProcessing: true
            });
            
            // 临时禁用轮询避免500错误
            // startPollingForResult();
            console.log('⚠️ 轮询已暂时禁用，等待N8n架构修复');
          } else {
            // 非AI Agent节点，可能已经包含结果但格式不同
            console.log('🔍 非AI Agent响应，检查是否包含其他格式的结果...');
            console.log('📄 响应内容详细分析:', responseData);
            
            // 更宽松的检查 - 查看是否包含任何有用信息
            if (responseData && responseData.length > 50) {
              setSubmitResult(prev => prev ? {
                ...prev,
                message: '✅ 收到N8n响应，正在处理结果...',
                response: `${prev.response}\n\nN8n响应: ${responseData}`,
                isProcessing: true
              } : {
                success: true,
                message: '✅ 收到N8n响应，正在处理结果...',
                response: responseData,
                isProcessing: true
              });
              
              // 临时禁用轮询
              // startPollingForResult();
              console.log('⚠️ 轮询已暂时禁用');
            } else {
              setSubmitResult(prev => prev ? {
                ...prev,
                message: '⚠️ 收到空响应，继续等待...',
                response: `${prev.response}\n\nN8n响应: ${responseData}`,
                isProcessing: true
              } : {
                success: true,
                message: '⚠️ 收到空响应，继续等待...',
                response: responseData,
                isProcessing: true
              });
              
              // startPollingForResult();
              console.log('⚠️ 轮询已暂时禁用');
            }
          }
        }

      } else {
        const errorText = await response.text();
        console.log('❌ HTTP错误响应:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

    } catch (error) {
      console.error('❌ 发送到N8n失败:', error);
      
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      setSubmitResult(prev => prev ? {
        ...prev,
        message: `❌ 连接失败: ${errorMessage}`,
        response: `${prev.response}\n\n错误信息: ${error instanceof Error ? error.stack : String(error)}`,
        isProcessing: false
      } : {
        success: false,
        message: `❌ 连接失败: ${errorMessage}。请检查网络连接和N8n工作流状态。`,
        response: error instanceof Error ? error.stack : String(error),
        isProcessing: false
      });
    }
  };

  const startPollingForResult = () => {
    const pollInterval = 15000; // 每15秒查询一次
    const maxPollingTime = 900000; // 最多轮询15分钟
    const startTime = Date.now();
    
    console.log('🔄 开始轮询检查视频生成结果...');
    
    const poll = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed > maxPollingTime) {
        clearInterval(poll);
        console.log('⏰ 轮询超时，停止检查');
        setSubmitResult(prev => prev ? {
          ...prev,
          message: '⏰ 视频生成超时，请手动检查N8n工作流状态',
          isProcessing: false
        } : null);
        return;
      }
      
      try {
        // 发送查询请求检查是否有结果
        const querySessionId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const queryPayload = {
          action: "sendMessage",
          sessionId: querySessionId,
          chatInput: "请提供最新的视频生成结果"
        };
        
        console.log('🔍 轮询检查结果...', elapsed/1000, '秒');
        
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(queryPayload)
        });
        
        if (response.ok) {
          const responseData = await response.text();
          console.log('🔍 轮询响应原始数据:', responseData);
          const videoUrl = extractVideoUrl(responseData);
          
          if (videoUrl) {
            clearInterval(poll);
            console.log('🎉 轮询发现视频已生成！', videoUrl);
            setSubmitResult({
              success: true,
              message: '🎉 视频生成完成！',
              response: responseData,
              videoUrl: videoUrl,
              isProcessing: false
            });
          } else {
            console.log('⏳ 轮询中 - 尚未找到视频URL，继续等待...');
          }
        } else {
          console.log('❌ 轮询响应失败:', response.status, response.statusText);
        }
      } catch (error) {
        console.log('🔍 轮询查询失败，继续等待...', error);
      }
    }, pollInterval);
  };

  const startListeningForFinalResult = async (taskId: string) => {
    console.log('🔄 开始监听最终结果，TaskID:', taskId);
    
    const maxAttempts = 20; // 最多监听10分钟 (30秒 * 20) - 已弃用，使用新的轮询机制
    let attempts = 0;
    
    const checkForResult = async () => {
      attempts++;
      console.log(`📡 第${attempts}次检查最终结果...`);
      
      try {
        // 使用新的sessionId避免冲突
        const listenSessionId = `listen_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        // 根据是否有taskId调整查询内容
        const queryPayload = {
          action: "sendMessage",
          sessionId: listenSessionId,
          chatInput: taskId === 'unknown_timeout' 
            ? "请提供最新的视频生成结果"
            : `检查任务${taskId}的执行结果`
        };
        
        console.log('🔍 发送监听请求:', queryPayload);
        
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(queryPayload)
        });
        
        if (response.ok) {
          const responseData = await response.text();
          console.log(`📊 第${attempts}次监听响应:`, responseData);
          
          // 检查是否包含finalvideoURL
          let videoUrl = null;
          try {
            const parsedResponse = JSON.parse(responseData);
            videoUrl = parsedResponse.finalvideoURL || 
                      parsedResponse.finalVideoURL ||
                      parsedResponse.finalVideoUrl ||
                      parsedResponse.videoUrl || parsedResponse.video_url;
            
            console.log('🔍 监听中提取的videoUrl:', videoUrl);
          } catch (e) {
            // 检查文本响应
            const urlMatch = responseData.match(/https?:\/\/[^\s]+\.(mp4|mov|avi|m4v|webm)/gi);
            if (urlMatch && urlMatch.length > 0) {
              videoUrl = urlMatch[0];
              console.log('🎯 从监听文本中提取到视频URL:', videoUrl);
            }
          }
          
          if (videoUrl) {
            // 找到最终结果！
            console.log('🎉 监听到最终视频URL:', videoUrl);
            setSubmitResult({
              success: true,
              message: '🎉 视频生成完成！',
              response: responseData,
              videoUrl: videoUrl,
              isProcessing: false
            });
            setIsSubmitting(false);
            return; // 停止监听
          }
          
          // 更新进度显示
          setSubmitResult(prev => prev ? {
            ...prev,
            message: `🔄 AI Agent正在处理中... (第${attempts}/${maxAttempts}次检查)`,
            response: `TaskID: ${taskId}\n\n⏳ 检查进度：${attempts}/${maxAttempts}\n预计还需${Math.ceil((maxAttempts - attempts) * 30 / 60)}分钟\n\n最新响应：${responseData.substring(0, 200)}...`
          } : null);
          
        } else {
          console.log(`❌ 第${attempts}次监听失败: ${response.status}`);
        }
        
        // 继续监听
        if (attempts < maxAttempts) {
          console.log(`⏳ 第${attempts}次检查完成，30秒后继续...`);
          setTimeout(checkForResult, 30000); // 30秒后再次检查
        } else {
          console.log('⏰ 监听超时');
          setSubmitResult(prev => prev ? {
            ...prev,
            message: '⏰ 监听超时，但视频可能仍在后台生成。请稍后手动检查N8n工作流状态。',
            isProcessing: false
          } : null);
          setIsSubmitting(false);
        }
        
      } catch (error) {
        console.error(`❌ 第${attempts}次监听失败:`, error);
        if (attempts < maxAttempts) {
          setTimeout(checkForResult, 30000);
        } else {
          setSubmitResult(prev => prev ? {
            ...prev,
            message: '❌ 无法获取最终结果，请手动检查N8n工作流状态。',
            isProcessing: false
          } : null);
          setIsSubmitting(false);
        }
      }
    };
    
    // 首次检查延迟30秒，给AI Agent足够时间处理
    console.log('⏰ 30秒后开始第一次检查...');
    setTimeout(checkForResult, 30000);
  };

  const handleReset = () => {
    console.log('🔄 重置组件状态');
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
              <CardTitle>Real-Person Feedback Video Creation</CardTitle>
              <CardDescription>
                Create authentic customer testimonials and product reviews with AI-generated real person feedback
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 调试按钮 */}
          <div className="mb-4 p-3 bg-gray-100 rounded">
            <p className="text-sm text-gray-600 mb-2">调试信息: isSubmitting = {isSubmitting.toString()}</p>
            <button 
              onClick={handleReset}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
            >
              重置状态
            </button>
          </div>

          {/* 视频创作表单 */}
          <VideoCreationForm
            onSubmit={(data) => {
              console.log('🎯 N8nFormOnly接收到onSubmit调用，数据:', data);
              sendToN8n(data);
            }}
            isLoading={isSubmitting}
          />

          {/* 结果显示区域 */}
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

              {/* 处理中状态 */}
              {submitResult.success && !submitResult.videoUrl && submitResult.isProcessing && (
                <div className="bg-blue-50 p-4 rounded-lg mt-4 border-l-4 border-blue-500">
                  <div className="flex items-center mb-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                    <h4 className="font-semibold text-blue-800">🎬 AI正在为您创作视频...</h4>
                  </div>
                  <div className="bg-white p-3 rounded border border-blue-200 mb-3">
                    <p className="text-sm text-blue-700 font-medium mb-2">📋 处理进度：</p>
                    <ul className="text-sm text-blue-600 space-y-1">
                      <li>✅ 需求分析完成</li>
                      <li>✅ 视频脚本生成中</li>
                      <li>🔄 真人演员录制中</li>
                      <li>⏳ 视频后期制作中</li>
                    </ul>
                  </div>
                  <div className="text-sm text-blue-700 bg-blue-100 p-2 rounded">
                    <p><strong>⏱️ 预计时间：</strong> 2-15分钟</p>
                    <p><strong>💡 温馨提示：</strong> 请保持页面打开，生成完成后会自动显示下载链接</p>
                  </div>
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
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors mr-3"
                      >
                        📹 下载视频
                        <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <a 
                        href={submitResult.videoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        🎬 在线预览
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

                    <div className="text-xs text-green-600 bg-white p-2 rounded">
                      <strong>视频地址:</strong> {submitResult.videoUrl}
                    </div>
                  </div>
                </div>
              )}

              {/* 调试信息 */}
              {submitResult.response && (
                <div className="bg-gray-50 p-4 rounded-lg mt-4">
                  <h4 className="font-semibold mb-2">N8n工作流响应：</h4>
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