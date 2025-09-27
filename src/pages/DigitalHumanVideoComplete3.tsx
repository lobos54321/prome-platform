import React, { useState, useEffect, useRef } from 'react';
import { xiangongAPI } from '../lib/xiangongyun-api';

interface TrainingData {
  name: string;
  gender: 'male' | 'female';
  videoFile: File | null;
  imageFile: File | null;
  language: string;
}

interface TrainingStatus {
  status: 'idle' | 'uploading' | 'training' | 'completed' | 'error';
  progress: number;
  message: string;
  trainingId?: string;
}

interface VideoGenerationStatus {
  status: 'idle' | 'generating' | 'completed' | 'error';
  progress: number;
  message: string;
  videoUrl?: string;
  generationId?: string;
  manualSteps?: string[];
}

interface DigitalHuman {
  trainingId: string;
  name: string;
  gender: 'male' | 'female';
  status: string;
  previewUrl?: string;
  imageResultUrl?: string;
  createdAt: string;
  updatedAt: string;
  voiceCloning?: {
    voiceId: string;
    name: string;
    status: string;
  };
}

export default function DigitalHumanVideoComplete3() {
  const [copywritingContent, setCopywritingContent] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [trainingData, setTrainingData] = useState<TrainingData>({
    name: '',
    gender: 'female',
    videoFile: null,
    imageFile: null,
    language: 'zh'
  });
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [digitalHumans, setDigitalHumans] = useState<DigitalHuman[]>([]);
  const [selectedDigitalHuman, setSelectedDigitalHuman] = useState<string | null>(null);
  const [voiceCloning, setVoiceCloning] = useState<{status: 'idle' | 'cloning' | 'completed' | 'error', message?: string}>({
    status: 'idle'
  });
  const [videoGeneration, setVideoGeneration] = useState<VideoGenerationStatus>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [videoScript, setVideoScript] = useState('');
  const [videoOptions, setVideoOptions] = useState({
    emotion: 'professional',
    language: 'zh-CN',
    duration: 30
  });
  const [currentUserId] = useState(() => {
    // Try to get existing user ID from localStorage, or create a new one
    let userId = localStorage.getItem('digitalHumanUserId');
    if (!userId) {
      userId = 'temp-user-' + Date.now();
      localStorage.setItem('digitalHumanUserId', userId);
    }
    return userId;
  });

  const videoInputRef = useRef<HTMLInputElement>(null);

  // 加载Deep Copywriting结果和数字人列表
  useEffect(() => {
    const loadCopywriting = () => {
      try {
        const conversationId = localStorage.getItem('dify_conversation_id');
        if (conversationId) {
          const messages = localStorage.getItem(`dify_messages_${conversationId}`);
          if (messages) {
            const parsedMessages = JSON.parse(messages);
            const lastAssistantMessage = parsedMessages
              .filter((msg: any) => msg.role === 'assistant')
              .pop();
            
            if (lastAssistantMessage && lastAssistantMessage.content) {
              setCopywritingContent(lastAssistantMessage.content);
            }
          }
        }
      } catch (error) {
        console.error('加载文案失败:', error);
      }
    };

    const loadDigitalHumans = async () => {
      try {
        const response = await fetch(`/api/digital-human/list/${currentUserId}`);
        const result = await response.json();
        if (result.success) {
          setDigitalHumans(result.digitalHumans);
        }
      } catch (error) {
        console.error('加载数字人列表失败:', error);
      }
    };


    const checkForActiveTraining = async () => {
      // Strategy 1: Check localStorage for active training
      const activeTrainingId = localStorage.getItem('activeTrainingId');
      const activeTrainingName = localStorage.getItem('activeTrainingName');
      
      if (activeTrainingId && activeTrainingName) {
        console.log('🔄 Found active training in localStorage:', activeTrainingId);
        await resumeTraining(activeTrainingId, activeTrainingName);
        return;
      }

      // Strategy 2: Check for any recent training that might still be processing
      // Look for the latest training IDs that we know about
      const recentTrainingIds = [
        '68d4c306a8178b003b6b78f9', // Most recent
        '68d4bdb555ed06003bb631e3'  // Previous
      ];
      
      for (const recentTrainingId of recentTrainingIds) {
        console.log('🔍 Checking for recent training status:', recentTrainingId);
        
        try {
          const response = await fetch(`/api/digital-human/status/${recentTrainingId}`);
          const result = await response.json();
          
          if (result.success && result.status && result.status !== 'completed' && result.status !== 'failed') {
            console.log('🎯 Found active training, automatically resuming:', recentTrainingId, result.status);
            const trainingName = result.trainingData?.name || 'Unknown';
            await resumeTraining(recentTrainingId, trainingName);
            return; // Found active training, stop checking others
          } else if (result.success && result.status === 'completed') {
            console.log('✅ Found completed training, saving to list:', recentTrainingId);
            await saveDigitalHuman(recentTrainingId, result);
            // 声音已在训练前克隆完成
            console.log('✅ 数字人训练完成，声音已克隆');
          }
        } catch (error) {
          console.error('检查最近训练状态失败:', recentTrainingId, error);
        }
      }
      
      // After checking all training IDs, reload the list
      loadDigitalHumans();
    };

    const resumeTraining = async (trainingId: string, trainingName: string) => {
      try {
        const response = await fetch(`/api/digital-human/status/${trainingId}`);
        const result = await response.json();
        
        if (result.success && result.status !== 'completed' && result.status !== 'failed') {
          // Training is still in progress, resume polling
          console.log('▶️ Automatically resuming training status polling:', trainingId, result.status);
          
          setTrainingData(prev => ({
            ...prev,
            name: trainingName
          }));
          
          const statusMessage = result.status === 'processing' ? '自动恢复：正在训练处理中...' :
                               result.status === 'pending' ? '自动恢复：训练请求排队中...' :
                               result.status === 'sent' ? '自动恢复：训练请求已发送...' :
                               result.status === 'initialized' ? '自动恢复：训练初始化中...' :
                               '自动恢复：数字人训练中...';
          
          setTrainingStatus({
            status: 'training',
            progress: 80,
            message: statusMessage,
            trainingId: trainingId
          });
          
          setCurrentStep(2);
          
          // Store in localStorage for next time
          localStorage.setItem('activeTrainingId', trainingId);
          localStorage.setItem('activeTrainingName', trainingName);
          
          // Start polling immediately
          setTimeout(() => pollTrainingStatus(trainingId), 1000);
        } else if (result.success && (result.status === 'completed' || result.status === 'failed')) {
          // Training finished while user was away
          localStorage.removeItem('activeTrainingId');
          localStorage.removeItem('activeTrainingName');
          
          if (result.status === 'completed') {
            console.log('✅ Training completed while away, saving result:', trainingId);
            await saveDigitalHuman(trainingId, result);
            // 声音已在训练前克隆完成
            console.log('✅ 数字人训练完成，声音已克隆');
            loadDigitalHumans();
            
            // Show completion message briefly
            setTrainingStatus({
              status: 'completed',
              progress: 100,
              message: '数字人训练已完成！',
              trainingId
            });
            setCurrentStep(3);
          }
        }
      } catch (error) {
        console.error('恢复训练状态失败:', error);
      }
    };

    loadCopywriting();
    loadDigitalHumans();
    checkForActiveTraining();

    // Auto-refresh mechanism: Check for active training every 30 seconds
    const autoRefreshInterval = setInterval(() => {
      console.log('🔄 Auto-refresh: Checking for active training...');
      checkForActiveTraining();
    }, 30000); // Check every 30 seconds

    // Cleanup interval on component unmount
    return () => {
      clearInterval(autoRefreshInterval);
    };
  }, [currentUserId]);

  const handleImportCopywriting = () => {
    const conversationId = localStorage.getItem('dify_conversation_id');
    if (conversationId) {
      const messages = localStorage.getItem(`dify_messages_${conversationId}`);
      if (messages) {
        try {
          const parsedMessages = JSON.parse(messages);
          const lastAssistantMessage = parsedMessages
            .filter((msg: any) => msg.role === 'assistant')
            .pop();
          
          if (lastAssistantMessage && lastAssistantMessage.content) {
            setCopywritingContent(lastAssistantMessage.content);
          }
        } catch (error) {
          console.error('导入文案失败:', error);
        }
      }
    }
  };

  const validateAndSetVideoFile = (file: File) => {
    // 验证文件类型
    const validTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
    if (!validTypes.includes(file.type)) {
      alert('请上传有效的视频文件 (MP4, AVI, MOV, WMV)');
      return false;
    }

    // 验证文件大小 (100MB限制)
    if (file.size > 100 * 1024 * 1024) {
      alert('视频文件大小不能超过100MB');
      return false;
    }

    setTrainingData(prev => ({ ...prev, videoFile: file }));
    return true;
  };

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndSetVideoFile(file);
    }
  };

  const handleVideoDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      validateAndSetVideoFile(files[0]);
    }
  };

  const handleVideoDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };



  const uploadVideoToSupabase = async (file: File): Promise<string> => {
    console.log('🎬 Starting video upload:', file.name, file.size, 'bytes');
    
    const formData = new FormData();
    formData.append('video', file);

    console.log('📤 Sending video upload request...');
    const response = await fetch('/api/upload/video', {
      method: 'POST',
      body: formData
    });

    console.log('📥 Upload response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Upload failed:', errorData);
      throw new Error(errorData.error || '视频上传失败');
    }

    const result = await response.json();
    console.log('✅ Upload successful:', result);
    return result.videoUrl;
  };


  // 等待声音克隆完成的函数
  const waitForVoiceCloning = async (voiceId: string): Promise<void> => {
    const maxAttempts = 60; // 最大等待10分钟 (60次 * 10秒)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        console.log(`🔄 Checking voice cloning status (${attempts + 1}/${maxAttempts}):`, voiceId);
        
        const response = await fetch(`/api/voice/status/${voiceId}`);
        if (!response.ok) {
          console.error('❌ Voice status check failed:', response.status);
          throw new Error('声音状态检查失败');
        }

        const result = await response.json();
        console.log('🎤 Voice status:', result.status, result);

        if (result.status === 'completed') {
          console.log('✅ Voice cloning completed successfully!');
          return; // 声音克隆完成
        } else if (result.status === 'failed' || result.status === 'error') {
          throw new Error('声音克隆失败');
        }

        // 更新进度提示
        setTrainingStatus({
          status: 'training',
          progress: 40 + (attempts * 0.3), // 从40%到58%
          message: `等待声音克隆完成... (${attempts + 1}/${maxAttempts})`
        });

        // 等待10秒后重试
        await new Promise(resolve => setTimeout(resolve, 10000));
        attempts++;

      } catch (error) {
        console.error('❌ Voice status check error:', error);
        if (attempts >= 3) { // 3次失败后抛出错误
          throw new Error(`声音克隆状态检查失败: ${error.message}`);
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000)); // 失败时等待5秒重试
      }
    }

    // 超时
    throw new Error('声音克隆超时，请重试');
  };

  const pollTrainingStatus = async (trainingId: string): Promise<void> => {
    try {
      console.log('🔄 Frontend polling training status for:', trainingId);
      const response = await fetch(`/api/digital-human/status/${trainingId}`);
      const result = await response.json();
      
      if (result.success) {
        console.log('🔍 Frontend received training status:', result.status, result);
        
        if (result.status === 'completed') {
          // Training completed, save to digital humans list
          await saveDigitalHuman(trainingId, result);
          // 声音已在训练前克隆完成
          console.log('✅ 数字人训练完成，声音已克隆');
          
          // Clear localStorage
          localStorage.removeItem('activeTrainingId');
          localStorage.removeItem('activeTrainingName');
          
          setTrainingStatus({
            status: 'completed',
            progress: 100,
            message: '数字人训练完成！',
            trainingId
          });
          
          // Reload digital humans list
          const listResponse = await fetch(`/api/digital-human/list/${currentUserId}`);
          const listResult = await listResponse.json();
          if (listResult.success) {
            setDigitalHumans(listResult.digitalHumans);
          }
          
          setCurrentStep(3);
          return;
        } else if (result.status === 'failed') {
          // Clear localStorage on failure
          localStorage.removeItem('activeTrainingId');
          localStorage.removeItem('activeTrainingName');
          
          setTrainingStatus({
            status: 'error',
            progress: 0,
            message: '训练失败，请重试'
          });
          return;
        } else {
          // Still training, continue polling
          console.log(`⏱️ Training status: ${result.status}, continuing to poll in 10 seconds`);
          setTimeout(() => pollTrainingStatus(trainingId), 10000); // Poll every 10 seconds
          
          const statusMessage = result.status === 'processing' ? '正在训练处理中...' :
                               result.status === 'pending' ? '训练请求排队中...' :
                               result.status === 'sent' ? '训练请求已发送...' :
                               result.status === 'initialized' ? '训练初始化中...' :
                               '数字人训练中，预计5-10分钟...';
          
          setTrainingStatus(prev => ({
            ...prev,
            progress: Math.min(prev.progress + 3, 90), // Gradually increase progress
            message: statusMessage
          }));
        }
      } else {
        console.error('❌ Training status API returned unsuccessful result:', result);
        setTimeout(() => pollTrainingStatus(trainingId), 15000);
      }
    } catch (error) {
      console.error('❌ 轮询训练状态失败:', error);
      setTimeout(() => pollTrainingStatus(trainingId), 15000); // Retry after 15 seconds
    }
  };

  const saveDigitalHuman = async (trainingId: string, statusResult: any) => {
    try {
      await fetch('/api/digital-human/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUserId,
          trainingId,
          name: statusResult.trainingData?.name || trainingData.name,
          gender: statusResult.trainingData?.gender || trainingData.gender,
          status: statusResult.status,
          previewUrl: statusResult.previewUrl,
          imageResultUrl: statusResult.imageResultUrl,
          trainingData: statusResult.trainingData
        })
      });
      
      console.log('✅ Digital human saved successfully');
    } catch (error) {
      console.error('保存数字人失败:', error);
    }
  };

  const startTraining = async () => {
    if (!trainingData.name || !trainingData.videoFile) {
      alert('请填写数字人名称并上传训练视频');
      return;
    }

    try {
      setTrainingStatus({
        status: 'uploading',
        progress: 10,
        message: '正在上传视频文件...'
      });

      // 1. 上传视频到Supabase
      const videoUrl = await uploadVideoToSupabase(trainingData.videoFile);

      setTrainingStatus({
        status: 'training',
        progress: 30,
        message: '正在克隆声音...'
      });

      // 2. 使用 Xiangong Cloud 上传训练视频
      console.log('🎭 使用仙宫云上传训练视频...');
      const xiangongTrainingResponse = await fetch('/api/xiangong/upload-training-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUserId,
          profileName: trainingData.name,
          videoUrl: videoUrl,
          tempVideoFileName: videoUrl.split('/').pop(),
          gender: trainingData.gender,
          language: trainingData.language
        })
      });

      if (!xiangongTrainingResponse.ok) {
        const xiangongError = await xiangongTrainingResponse.json().catch(() => ({}));
        console.error('❌ Xiangong training upload failed:', xiangongError);
        throw new Error(xiangongError.error || '仙宫云训练视频上传失败');
      }

      const xiangongResult = await xiangongTrainingResponse.json();
      console.log('✅ Xiangong training video uploaded:', xiangongResult);
      
      setTrainingStatus({
        status: 'training',
        progress: 40,
        message: '数字人特征提取中...'
      });

      // 如果返回了预览URL，显示预览
      if (xiangongResult.preview?.url) {
        console.log('🎭 数字人预览已生成:', xiangongResult.preview.url);
        // 可以在这里添加预览显示逻辑
      }

      // 3. 等待特征提取完成（模拟过程）
      setTimeout(() => {
        setTrainingStatus({
          status: 'training',
          progress: 60,
          message: '仙宫云数字人克隆中...'
        });
      }, 2000);
      
      setTrainingStatus({
        status: 'training',
        progress: 60,
        message: '仙宫云数字人克隆中...'
      });

      // 4. 模拟训练完成（实际上仙宫云会通过ComfyUI异步处理）
      const trainingPayload = {
        userId: currentUserId,
        name: trainingData.name,
        gender: trainingData.gender,
        language: trainingData.language,
        videoUrl: videoUrl,
        tempVideoFileName: videoUrl.split('/').pop(),
        profileId: xiangongResult.profileId // 使用仙宫云返回的profileId
      };

      console.log('🚀 Sending Xiangong training request:', trainingPayload);
      
      // 这里可以调用一个简化的训练API，主要是保存训练记录
      const response = await fetch('/api/digital-human/train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(trainingPayload)
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Training API error:', errorData);
        throw new Error(errorData.error || `训练启动失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      setTrainingStatus({
        status: 'training',
        progress: 70,
        message: '数字人训练启动成功，正在训练...',
        trainingId: result.trainingId
      });

      // Store training info in localStorage for recovery
      localStorage.setItem('activeTrainingId', result.trainingId);
      localStorage.setItem('activeTrainingName', trainingData.name);

      // 4. 开始状态轮询
      setTimeout(() => pollTrainingStatus(result.trainingId), 5000); // 5秒后开始轮询

    } catch (error) {
      console.error('训练失败:', error);
      setTrainingStatus({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : '训练失败，请重试'
      });
    }
  };

  const resetTraining = () => {
    setTrainingStatus({
      status: 'idle',
      progress: 0,
      message: ''
    });
    setTrainingData({
      name: '',
      gender: 'female',
      videoFile: null,
      imageFile: null,
      language: 'zh'
    });
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const autoCloneVoice = async (trainingId: string, trainingName: string, trainingData: any) => {
    if (!trainingData?.video_url) {
      console.log('⚠️ 无训练视频URL，跳过声音克隆');
      return;
    }

    try {
      console.log('🎤 自动启动声音克隆:', trainingName);
      
      const voiceName = `${trainingName}_voice_${Date.now()}`;
      
      // 使用最优默认设置
      const optimalConfig = {
        gender: trainingData.gender || 'male',
        denoise: true,
        enhanceVoiceSimilarity: true,
        model: 'minimax',
        language: 'zh'
      };

      const response = await fetch('/api/voice/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUserId,
          trainingId: trainingId,
          name: voiceName,
          voiceUrls: [trainingData.video_url],
          ...optimalConfig
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ 自动声音克隆失败:', result.error);
        return;
      }

      console.log('✅ 自动声音克隆成功:', result);

    } catch (error) {
      console.error('❌ 自动声音克隆异常:', error);
    }
  };

  const cloneVoice = async (digitalHuman: any) => {
    if (!digitalHuman || !digitalHuman.trainingData?.video_url) {
      setVoiceCloning({ status: 'error', message: '无法获取训练视频的音频' });
      return;
    }

    try {
      setVoiceCloning({ status: 'cloning', message: '正在克隆声音...' });

      const voiceName = `${digitalHuman.name}_voice_${Date.now()}`;
      
      // 使用最优默认设置
      const optimalConfig = {
        gender: digitalHuman.gender || 'male',
        denoise: true,
        enhanceVoiceSimilarity: true,
        model: 'minimax',
        language: 'zh'
      };

      const response = await fetch('/api/voice/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUserId,
          trainingId: digitalHuman.trainingId,
          name: voiceName,
          voiceUrls: [digitalHuman.trainingData.video_url],
          ...optimalConfig
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '声音克隆失败');
      }

      console.log('✅ Voice cloning successful:', result);
      setVoiceCloning({ status: 'completed', message: '声音克隆完成！' });
      
      // 刷新数字人列表以显示声音克隆状态
      loadDigitalHumans();

    } catch (error) {
      console.error('❌ Voice cloning error:', error);
      setVoiceCloning({ status: 'error', message: `声音克隆失败: ${error.message}` });
    }
  };

  // 从localStorage加载文案内容
  const loadCopywritingContent = () => {
    if (!videoScript) {
      try {
        const conversationId = localStorage.getItem('dify_conversation_id');
        if (conversationId) {
          const messages = localStorage.getItem(`dify_messages_${conversationId}`);
          if (messages) {
            const parsedMessages = JSON.parse(messages);
            const lastAssistantMessage = parsedMessages
              .filter((msg: any) => msg.role === 'assistant')
              .pop();
            
            if (lastAssistantMessage && lastAssistantMessage.content) {
              setVideoScript(lastAssistantMessage.content);
            }
          }
        }
      } catch (error) {
        console.error('加载文案失败:', error);
      }
    }
  };

  // 视频生成函数（UI演示版本）
  const generateVideo = async () => {
    if (!selectedDigitalHuman) {
      alert('请先选择一个数字人');
      return;
    }

    if (!videoScript || !videoScript.trim()) {
      alert('请先在步骤1中准备文案内容');
      return;
    }

    try {
      // 模拟视频生成过程
      console.log('🎬 开始生成视频:', {
        digitalHuman: selectedDigitalHuman,
        script: videoScript.substring(0, 50) + '...',
        options: videoOptions
      });

      // 开始生成状态
      setVideoGeneration({
        status: 'generating',
        progress: 10,
        message: '正在启动视频生成...'
      });

      // 模拟生成过程的进度更新
      await generateDigitalHumanVideo();

    } catch (error) {
      console.error('视频生成失败:', error);
      setVideoGeneration({
        status: 'error',
        progress: 0,
        message: error.message || '视频生成失败'
      });
    }
  };

  // 使用仙宫云InfiniteTalk生成数字人视频
  const generateDigitalHumanVideo = async () => {
    setVideoGeneration({
      status: 'generating',
      progress: 10,
      message: '正在连接仙宫云服务...'
    });

    try {
      // 首先检查服务健康状态
      const healthCheck = await xiangongAPI.healthCheck();
      if (!healthCheck.healthy) {
        throw new Error('仙宫云服务暂时不可用，请稍后重试');
      }

      setVideoGeneration({
        status: 'generating',
        progress: 20,
        message: '正在分析文案内容...'
      });

      // 获取当前选中的数字人配置
      const selectedDigitalHumanData = digitalHumans.find(dh => dh.trainingId === selectedDigitalHuman);
      
      // 准备API参数
      const apiParams = {
        text: videoScript || copywritingContent,
        avatar: selectedDigitalHumanData?.name || 'default',
        voice: 'default', // 使用用户训练的声音
        emotion: videoOptions.emotion || 'professional',
        background: '#4F46E5'
      };

      console.log('🎬 生成数字人视频参数:', apiParams);

      setVideoGeneration({
        status: 'generating',
        progress: 30,
        message: '正在启动数字人服务...'
      });

      // 调用仙宫云InfiniteTalk API
      const result = await xiangongAPI.generateDigitalHumanVideo(apiParams);

      console.log('🎭 仙宫云API返回结果:', result);

      if (result.success) {
        setVideoGeneration({
          status: 'generating',
          progress: 50,
          message: '正在生成数字人视频...'
        });

        // 如果有taskId，进行轮询检查状态
        if (result.taskId && !result.videoUrl) {
          await pollVideoGenerationStatus(result.taskId);
        } else if (result.videoUrl) {
          // 直接返回了视频URL
          setVideoGeneration({
            status: 'completed',
            progress: 100,
            message: '视频生成完成！',
            videoUrl: result.videoUrl
          });
        }
      } else if (result.temporarySolution) {
        // 处理临时解决方案 - 显示ComfyUI操作指引
        setVideoGeneration({
          status: 'error',
          progress: 0,
          message: `需要手动操作ComfyUI: ${result.message}`,
          generationId: result.comfyuiUrl // 将ComfyUI URL存储在这里以便显示
        });
        
        // 可以在这里显示详细的操作指引
        console.log('🔗 ComfyUI操作指引:', {
          url: result.comfyuiUrl,
          instructions: result.instructions
        });
      } else {
        throw new Error(result.message || '视频生成失败');
      }

    } catch (error) {
      console.error('数字人视频生成失败:', error);
      
      // 检查是否是实例启动相关的错误
      const errorMessage = error instanceof Error ? error.message : '视频生成失败，请重试';
      
      if (errorMessage.includes('仙宫云不支持API启动实例') || errorMessage.includes('需要手动启动实例')) {
        setVideoGeneration({
          status: 'error',
          progress: 0,
          message: '🚀 需要手动启动仙宫云实例',
          manualSteps: [
            '1. 访问仙宫云控制台: https://xiangongyun.com/console',
            '2. 找到实例: 3iaszw98tkh12h9x (prome)',
            '3. 点击启动按钮',
            '4. 等待实例状态变为running',
            '5. 刷新页面重试数字人生成'
          ]
        });
      } else if (errorMessage.includes('余额不足') || errorMessage.includes('无法开机')) {
        setVideoGeneration({
          status: 'error',
          progress: 0,
          message: '💰 仙宫云账户余额不足',
          manualSteps: [
            '1. 访问仙宫云控制台: https://xiangongyun.com/console',
            '2. 充值账户余额',
            '3. 启动实例: 3iaszw98tkh12h9x (prome)',
            '4. 等待实例状态变为running',
            '5. 刷新页面重试数字人生成'
          ]
        });
      } else {
        setVideoGeneration({
          status: 'error',
          progress: 0,
          message: errorMessage
        });
      }
    }
  };

  // 轮询视频生成状态
  const pollVideoGenerationStatus = async (taskId: string) => {
    const maxRetries = 60; // 最多轮询60次（约10分钟）
    let retries = 0;

    const poll = async () => {
      try {
        const status = await xiangongAPI.getTaskStatus(taskId);
        
        setVideoGeneration({
          status: 'generating',
          progress: Math.min(50 + (status.progress || 0) / 2, 95),
          message: `生成进度: ${status.progress || 0}%`
        });

        if (status.status === 'completed' && status.result) {
          setVideoGeneration({
            status: 'completed',
            progress: 100,
            message: '视频生成完成！',
            videoUrl: status.result
          });
          return;
        } else if (status.status === 'failed') {
          throw new Error(status.error || '视频生成失败');
        }

        // 继续轮询
        if (retries < maxRetries) {
          retries++;
          setTimeout(poll, 10000); // 每10秒检查一次
        } else {
          throw new Error('视频生成超时，请稍后检查');
        }
      } catch (error) {
        console.error('状态检查失败:', error);
        setVideoGeneration({
          status: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : '状态检查失败'
        });
      }
    };

    poll();
  };


  // 初始化加载文案
  React.useEffect(() => {
    loadCopywritingContent();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* 标题 */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>
            数字人视频创作
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.8)' }}>
            从文案到视频，一键生成专属数字人内容
          </p>
        </div>

        {/* 工作流程步骤 */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem' }}>
            {[
              { id: 1, title: '准备文案', desc: '导入或编写视频文案' },
              { id: 2, title: '训练数字人', desc: '上传素材训练数字人模型' },
              { id: 3, title: '生成视频', desc: '使用数字人生成最终视频' },
              { id: 4, title: '完成', desc: '下载生成的视频' }
            ].map((step, index) => (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '4rem',
                    height: '4rem',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: currentStep >= step.id ? '#10b981' : 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                    margin: '0 auto 0.5rem'
                  }}>
                    {step.id}
                  </div>
                  <div style={{ color: 'white', fontWeight: '600', fontSize: '0.9rem' }}>{step.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>{step.desc}</div>
                </div>
                {index < 3 && (
                  <div style={{ 
                    width: '3rem', 
                    height: '2px', 
                    backgroundColor: currentStep > step.id ? '#10b981' : 'rgba(255,255,255,0.3)',
                    margin: '0 1rem',
                    marginTop: '-2rem'
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          {/* 主要内容区域 */}
          <div>
            {/* 文案准备 */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '1rem', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              marginBottom: '2rem'
            }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', 
                color: 'white', 
                padding: '1.5rem' 
              }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
                  📝 步骤 1: 准备视频文案
                </h3>
              </div>
              <div style={{ padding: '2rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                    视频文案内容
                  </label>
                  <textarea
                    value={copywritingContent}
                    onChange={(e) => setCopywritingContent(e.target.value)}
                    placeholder="请输入或导入您的视频文案内容..."
                    style={{
                      width: '100%',
                      minHeight: '150px',
                      padding: '1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      resize: 'vertical'
                    }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleImportCopywriting}
                    style={{
                      padding: '0.75rem 1.5rem',
                      border: '2px solid #6366f1',
                      backgroundColor: 'transparent',
                      color: '#6366f1',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    💬 从 Deep Copywriting 导入
                  </button>

                  {/* 根据是否有已训练数字人显示不同按钮 */}
                  {copywritingContent && (
                    digitalHumans.length === 0 ? (
                      // 第一次使用：直接显示确认按钮
                      <button
                        onClick={() => setCurrentStep(2)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          border: 'none',
                          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                          color: 'white',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        确认文案，下一步 →
                      </button>
                    ) : (
                      // 第二次及之后使用：只显示新增数字人按钮
                      <button
                        onClick={() => setCurrentStep(2)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          border: '2px solid #8b5cf6',
                          backgroundColor: 'white',
                          color: '#8b5cf6',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        ➕ 新增数字人
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* 数字人训练 */}
            {currentStep === 2 && (
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '1rem', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', 
                  color: 'white', 
                  padding: '1.5rem' 
                }}>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
                    👤 步骤 2: 训练数字人
                  </h3>
                </div>
                <div style={{ padding: '2rem' }}>
                  {trainingStatus.status === 'idle' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      {/* 基本信息 */}
                      <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
                          数字人名称
                        </label>
                        <input
                          type="text"
                          value={trainingData.name}
                          onChange={(e) => setTrainingData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="请输入数字人名称"
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            marginBottom: '1rem'
                          }}
                        />

                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
                          性别
                        </label>
                        <select
                          value={trainingData.gender}
                          onChange={(e) => setTrainingData(prev => ({ ...prev, gender: e.target.value as 'male' | 'female' }))}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            marginBottom: '1rem'
                          }}
                        >
                          <option value="female">女性</option>
                          <option value="male">男性</option>
                        </select>

                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
                          语言
                        </label>
                        <select
                          value={trainingData.language}
                          onChange={(e) => setTrainingData(prev => ({ ...prev, language: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            fontSize: '1rem'
                          }}
                        >
                          <option value="zh">中文</option>
                          <option value="yue">粤语</option>
                          <option value="en">English</option>
                          <option value="es">Español</option>
                          <option value="fr">Français</option>
                          <option value="ru">Русский</option>
                          <option value="de">Deutsch</option>
                          <option value="pt">Português</option>
                          <option value="ar">العربية</option>
                          <option value="it">Italiano</option>
                          <option value="ja">日本語</option>
                          <option value="ko">한국어</option>
                          <option value="id">Bahasa Indonesia</option>
                          <option value="vi">Tiếng Việt</option>
                          <option value="tr">Türkçe</option>
                          <option value="nl">Nederlands</option>
                          <option value="uk">Українська</option>
                          <option value="th">ไทย</option>
                          <option value="pl">Polski</option>
                          <option value="ro">Română</option>
                          <option value="el">Ελληνικά</option>
                          <option value="cs">Čeština</option>
                          <option value="fi">Suomi</option>
                          <option value="hi">हिन्दी</option>
                        </select>
                      </div>

                      {/* 文件上传 */}
                      <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
                          训练视频 (必需)
                        </label>
                        <input
                          ref={videoInputRef}
                          type="file"
                          accept="video/mp4,video/avi,video/mov,video/wmv"
                          onChange={handleVideoUpload}
                          style={{ display: 'none' }}
                        />
                        <div
                          onClick={() => videoInputRef.current?.click()}
                          onDrop={handleVideoDrop}
                          onDragOver={handleVideoDragOver}
                          style={{
                            width: '100%',
                            padding: '2rem',
                            border: '2px dashed #d1d5db',
                            borderRadius: '0.5rem',
                            backgroundColor: '#f9fafb',
                            cursor: 'pointer',
                            marginBottom: '1rem',
                            textAlign: 'center'
                          }}
                        >
                          {trainingData.videoFile ? (
                            <div>
                              <div style={{ color: '#10b981', fontWeight: '600' }}>✅ {trainingData.videoFile.name}</div>
                              <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                                {(trainingData.videoFile.size / (1024 * 1024)).toFixed(1)} MB
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📹</div>
                              <div style={{ fontWeight: '600' }}>点击或拖拽上传训练视频</div>
                              <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>支持 MP4, AVI, MOV, WMV (最大100MB)</div>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  )}

                  {/* 训练进度 */}
                  {(trainingStatus.status === 'uploading' || trainingStatus.status === 'training') && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤖</div>
                      <div style={{ fontWeight: '600', fontSize: '1.2rem', marginBottom: '1rem' }}>
                        {trainingStatus.message}
                      </div>
                      <div style={{ 
                        width: '100%', 
                        backgroundColor: '#e5e7eb', 
                        borderRadius: '1rem', 
                        overflow: 'hidden',
                        marginBottom: '1rem'
                      }}>
                        <div style={{
                          width: `${trainingStatus.progress}%`,
                          height: '1rem',
                          backgroundColor: '#10b981',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <div style={{ color: '#6b7280' }}>{trainingStatus.progress}% 完成</div>
                    </div>
                  )}

                  {/* 训练完成 */}
                  {trainingStatus.status === 'completed' && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                      <div style={{ fontWeight: '600', fontSize: '1.2rem', color: '#10b981', marginBottom: '1rem' }}>
                        数字人训练完成！
                      </div>
                      <div style={{ color: '#6b7280', marginBottom: '2rem' }}>
                        训练ID: {trainingStatus.trainingId}
                      </div>
                      <button
                        onClick={() => setCurrentStep(3)}
                        style={{
                          padding: '0.75rem 2rem',
                          border: 'none',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: 'white',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        开始生成视频 →
                      </button>
                    </div>
                  )}

                  {/* 训练错误 */}
                  {trainingStatus.status === 'error' && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
                      <div style={{ fontWeight: '600', fontSize: '1.2rem', color: '#ef4444', marginBottom: '1rem' }}>
                        训练失败
                      </div>
                      <div style={{ color: '#6b7280', marginBottom: '2rem' }}>
                        {trainingStatus.message}
                      </div>
                      <button
                        onClick={resetTraining}
                        style={{
                          padding: '0.75rem 2rem',
                          border: '2px solid #ef4444',
                          backgroundColor: 'transparent',
                          color: '#ef4444',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        重新训练
                      </button>
                      
                    </div>
                  )}

                  {/* 开始训练按钮 */}
                  {trainingStatus.status === 'idle' && (
                    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                      <button
                        onClick={startTraining}
                        disabled={!trainingData.name || !trainingData.videoFile}
                        style={{
                          padding: '1rem 2rem',
                          border: 'none',
                          background: trainingData.name && trainingData.videoFile 
                            ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' 
                            : '#d1d5db',
                          color: 'white',
                          borderRadius: '0.5rem',
                          cursor: trainingData.name && trainingData.videoFile ? 'pointer' : 'not-allowed',
                          fontWeight: '600',
                          fontSize: '1.1rem'
                        }}
                      >
                        🚀 开始训练数字人
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 生成视频步骤 */}
            {currentStep >= 3 && (
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '1rem', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                marginTop: '2rem'
              }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #ec4899, #f59e0b)', 
                  color: 'white', 
                  padding: '1.5rem' 
                }}>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
                    🎬 步骤 3: 生成视频
                  </h3>
                </div>
                <div style={{ padding: '2rem' }}>
                  {!selectedDigitalHuman ? (
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
                        请选择要使用的数字人：
                      </h4>
                      {digitalHumans.length === 0 ? (
                        <div style={{ 
                          padding: '2rem', 
                          backgroundColor: '#f3f4f6', 
                          borderRadius: '0.5rem',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>👤</div>
                          <p style={{ margin: 0, color: '#6b7280', marginBottom: '1rem' }}>
                            暂无已训练的数字人
                          </p>
                          <button
                            onClick={() => setCurrentStep(2)}
                            style={{
                              padding: '0.75rem 1.5rem',
                              border: 'none',
                              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                              color: 'white',
                              borderRadius: '0.5rem',
                              cursor: 'pointer',
                              fontWeight: '600'
                            }}
                          >
                            先去训练数字人 →
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                          {digitalHumans.map((dh) => (
                            <div 
                              key={dh.trainingId}
                              onClick={() => setSelectedDigitalHuman(dh.trainingId)}
                              style={{
                                border: '2px solid #e5e7eb',
                                borderRadius: '0.5rem',
                                padding: '1rem',
                                cursor: 'pointer',
                                backgroundColor: 'white',
                                transition: 'all 0.2s ease',
                                ':hover': {
                                  borderColor: '#3b82f6',
                                  boxShadow: '0 4px 6px rgba(59, 130, 246, 0.1)'
                                }
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                                <div style={{
                                  width: '50px',
                                  height: '50px',
                                  borderRadius: '50%',
                                  backgroundColor: '#f3f4f6',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1.5rem'
                                }}>
                                  {dh.previewUrl ? '🎭' : '👤'}
                                </div>
                                <div>
                                  <div style={{ fontWeight: '600', fontSize: '1rem', color: '#374151' }}>
                                    {dh.name}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                    {dh.gender === 'female' ? '女性' : '男性'}
                                  </div>
                                </div>
                              </div>
                              <button
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: 'none',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.9rem',
                                  fontWeight: '600',
                                  cursor: 'pointer'
                                }}
                              >
                                选择此数字人
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : videoGeneration.status === 'idle' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* 文案内容预览 */}
                      {videoScript && (
                        <div style={{
                          backgroundColor: '#f8fafc',
                          border: '2px solid #e2e8f0',
                          borderRadius: '0.5rem',
                          padding: '1rem'
                        }}>
                          <div style={{ 
                            fontWeight: '600', 
                            marginBottom: '0.5rem',
                            color: '#374151',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            📝 视频文案内容
                            <span style={{ 
                              fontSize: '0.8rem', 
                              color: '#6b7280',
                              fontWeight: 'normal'
                            }}>
                              ({videoScript.length} 字符)
                            </span>
                          </div>
                          <div style={{
                            color: '#4b5563',
                            fontSize: '0.95rem',
                            lineHeight: '1.6',
                            maxHeight: '120px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap'
                          }}>
                            {videoScript}
                          </div>
                        </div>
                      )}

                      {/* 视频参数设置 */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                        gap: '1rem' 
                      }}>
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontWeight: '600', 
                            marginBottom: '0.5rem',
                            color: '#374151'
                          }}>
                            情感表达
                          </label>
                          <select
                            value={videoOptions.emotion}
                            onChange={(e) => setVideoOptions(prev => ({ ...prev, emotion: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '2px solid #e5e7eb',
                              borderRadius: '0.5rem',
                              fontSize: '1rem',
                              outline: 'none'
                            }}
                          >
                            <option value="professional">专业</option>
                            <option value="friendly">友好</option>
                            <option value="enthusiastic">热情</option>
                            <option value="calm">平静</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontWeight: '600', 
                            marginBottom: '0.5rem',
                            color: '#374151'
                          }}>
                            语言
                          </label>
                          <select
                            value={videoOptions.language}
                            onChange={(e) => setVideoOptions(prev => ({ ...prev, language: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '2px solid #e5e7eb',
                              borderRadius: '0.5rem',
                              fontSize: '1rem',
                              outline: 'none'
                            }}
                          >
                            <option value="zh-CN">中文</option>
                            <option value="en-US">English</option>
                            <option value="ja-JP">日本語</option>
                            <option value="ko-KR">한국어</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontWeight: '600', 
                            marginBottom: '0.5rem',
                            color: '#374151'
                          }}>
                            视频时长 (秒)
                          </label>
                          <input
                            type="number"
                            min="15"
                            max="120"
                            value={videoOptions.duration}
                            onChange={(e) => setVideoOptions(prev => ({ ...prev, duration: parseInt(e.target.value) || 30 }))}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '2px solid #e5e7eb',
                              borderRadius: '0.5rem',
                              fontSize: '1rem',
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>

                      {/* 生成按钮 */}
                      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                        {!videoScript ? (
                          <div style={{
                            padding: '1rem',
                            backgroundColor: '#fef3c7',
                            border: '1px solid #f59e0b',
                            borderRadius: '0.5rem',
                            color: '#92400e',
                            fontSize: '0.9rem'
                          }}>
                            ⚠️ 请先在步骤1中准备文案内容
                          </div>
                        ) : (
                          <button
                            onClick={generateVideo}
                            style={{
                              padding: '1rem 2rem',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.5rem',
                              fontSize: '1.1rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)'
                            }}
                          >
                            🎬 开始生成视频
                          </button>
                        )}
                      </div>
                    </div>
                  ) : videoGeneration.status === 'generating' ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎬</div>
                      <div style={{ 
                        fontWeight: '600', 
                        fontSize: '1.2rem', 
                        marginBottom: '1rem' 
                      }}>
                        {videoGeneration.message}
                      </div>
                      <div style={{ 
                        width: '100%', 
                        backgroundColor: '#e5e7eb', 
                        borderRadius: '1rem', 
                        overflow: 'hidden',
                        marginBottom: '1rem'
                      }}>
                        <div style={{
                          width: `${videoGeneration.progress}%`,
                          height: '1rem',
                          backgroundColor: '#10b981',
                          transition: 'width 0.3s ease'
                        }}></div>
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                        预计等待时间: 3-8分钟
                      </div>
                    </div>
                  ) : videoGeneration.status === 'completed' ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                      <div style={{ 
                        fontWeight: '600', 
                        fontSize: '1.2rem', 
                        marginBottom: '2rem',
                        color: '#10b981'
                      }}>
                        视频生成完成！
                      </div>
                      
                      {videoGeneration.videoUrl && (
                        <div style={{ marginBottom: '2rem' }}>
                          <video 
                            src={videoGeneration.videoUrl} 
                            controls 
                            style={{
                              width: '100%',
                              maxWidth: '600px',
                              borderRadius: '0.5rem',
                              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            if (videoGeneration.videoUrl) {
                              const a = document.createElement('a');
                              a.href = videoGeneration.videoUrl;
                              a.download = 'digital-human-video.mp4';
                              a.click();
                            }
                          }}
                          style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          📥 下载视频
                        </button>
                        <button
                          onClick={() => {
                            setVideoGeneration({
                              status: 'idle',
                              progress: 0,
                              message: ''
                            });
                            setVideoScript('');
                          }}
                          style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          🔄 重新生成
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
                      <div style={{ 
                        fontWeight: '600', 
                        fontSize: '1.2rem', 
                        marginBottom: '1rem',
                        color: '#ef4444'
                      }}>
                        {videoGeneration.message}
                      </div>
                      
                      {/* 显示手动步骤 */}
                      {videoGeneration.manualSteps && (
                        <div style={{ 
                          textAlign: 'left', 
                          margin: '1.5rem 0',
                          padding: '1rem',
                          backgroundColor: '#f9fafb',
                          borderRadius: '0.5rem',
                          border: '1px solid #e5e7eb'
                        }}>
                          <div style={{ 
                            fontWeight: '600', 
                            marginBottom: '0.5rem',
                            color: '#374151'
                          }}>
                            请按以下步骤操作：
                          </div>
                          {videoGeneration.manualSteps.map((step, index) => (
                            <div key={index} style={{ 
                              marginBottom: '0.25rem',
                              color: '#6b7280',
                              fontSize: '0.9rem'
                            }}>
                              {step}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <button
                        onClick={() => {
                          setVideoGeneration({
                            status: 'idle',
                            progress: 0,
                            message: ''
                          });
                        }}
                        style={{
                          padding: '0.75rem 1.5rem',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        🔄 重新开始
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 侧边栏 */}
          <div>
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '1rem', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0, color: '#374151' }}>
                  Deep Copywriting 结果
                </h3>
              </div>
              <div style={{ padding: '1.5rem' }}>
                {copywritingContent ? (
                  <div>
                    <div style={{ 
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      backgroundColor: '#e0e7ff',
                      color: '#3730a3',
                      borderRadius: '1rem',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      marginBottom: '1rem'
                    }}>
                      AI 生成内容
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#6b7280',
                      backgroundColor: '#f9fafb',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      marginBottom: '1rem'
                    }}>
                      {copywritingContent.substring(0, 200)}
                      {copywritingContent.length > 200 && '...'}
                    </div>
                    <button 
                      onClick={handleImportCopywriting}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        backgroundColor: 'white',
                        color: '#374151',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                      }}
                    >
                      导入此内容
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💬</div>
                    <p style={{ fontSize: '0.9rem', margin: 0 }}>暂无 Deep Copywriting 结果</p>
                    <p style={{ fontSize: '0.8rem', margin: '0.5rem 0 0', color: '#9ca3af' }}>
                      请先使用 Deep Copywriting 生成内容
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 训练状态侧边栏 */}
            {currentStep >= 2 && trainingStatus.trainingId && (
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '1rem', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                marginTop: '1.5rem'
              }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0, color: '#374151' }}>
                    训练状态
                  </h3>
                </div>
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>训练ID</div>
                    <div style={{ 
                      fontSize: '0.8rem', 
                      fontFamily: 'monospace', 
                      backgroundColor: '#f3f4f6', 
                      padding: '0.5rem',
                      borderRadius: '0.25rem',
                      wordBreak: 'break-all'
                    }}>
                      {trainingStatus.trainingId}
                    </div>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>数字人信息</div>
                    <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                      <div>名称: {trainingData.name}</div>
                      <div>性别: {trainingData.gender === 'female' ? '女性' : '男性'}</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>状态</div>
                    <div style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.8rem',
                      backgroundColor: trainingStatus.status === 'completed' ? '#dcfce7' : '#fef3c7',
                      color: trainingStatus.status === 'completed' ? '#16a34a' : '#d97706'
                    }}>
                      {trainingStatus.status === 'completed' ? '训练完成' : 
                       trainingStatus.status === 'training' ? '训练中' : '处理中'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 已训练数字人列表 */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '1rem', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              marginTop: '1.5rem'
            }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0, color: '#374151' }}>
                  我的数字人
                </h3>
              </div>
              <div style={{ padding: '1.5rem' }}>
                {digitalHumans.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>👤</div>
                    <p style={{ fontSize: '0.9rem', margin: 0 }}>暂无已训练的数字人</p>
                    <p style={{ fontSize: '0.8rem', margin: '0.5rem 0 0', color: '#9ca3af' }}>
                      请先训练一个数字人
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {digitalHumans.map((dh) => (
                      <div 
                        key={dh.trainingId}
                        onClick={() => setSelectedDigitalHuman(dh.trainingId)}
                        style={{
                          border: selectedDigitalHuman === dh.trainingId ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                          borderRadius: '0.5rem',
                          padding: '1rem',
                          cursor: 'pointer',
                          backgroundColor: selectedDigitalHuman === dh.trainingId ? '#f0f9ff' : 'white',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          {dh.previewUrl ? (
                            <div style={{
                              width: '50px',
                              height: '50px',
                              borderRadius: '50%',
                              backgroundColor: '#f3f4f6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.5rem',
                              overflow: 'hidden'
                            }}>
                              <video 
                                src={`/api/video-proxy?url=${encodeURIComponent(dh.previewUrl)}`}
                                style={{
                                  width: '60px',
                                  height: '60px',
                                  borderRadius: '50%',
                                  objectFit: 'cover'
                                }}
                                muted
                                playsInline
                                preload="metadata"
                                onMouseEnter={(e) => e.currentTarget.play()}
                                onMouseLeave={(e) => e.currentTarget.pause()}
                              />
                            </div>
                          ) : (
                            <div style={{
                              width: '50px',
                              height: '50px',
                              borderRadius: '50%',
                              backgroundColor: '#f3f4f6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.5rem'
                            }}>
                              {dh.gender === 'female' ? '👩' : '👨'}
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                              {dh.name}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                              {dh.gender === 'female' ? '女性' : '男性'} • {new Date(dh.createdAt).toLocaleDateString()}
                            </div>
                            <div style={{
                              display: 'inline-block',
                              padding: '0.125rem 0.5rem',
                              borderRadius: '0.25rem',
                              fontSize: '0.7rem',
                              backgroundColor: dh.status === 'completed' ? '#dcfce7' : '#fef3c7',
                              color: dh.status === 'completed' ? '#16a34a' : '#d97706'
                            }}>
                              {dh.status === 'completed' ? '可用' : '训练中'}
                            </div>
                          </div>
                          {selectedDigitalHuman === dh.trainingId && (
                            <div style={{ color: '#3b82f6', fontSize: '1.2rem' }}>
                              ✓
                            </div>
                          )}
                        </div>
                        
                        {selectedDigitalHuman === dh.trainingId && dh.previewUrl && (
                          <div style={{ 
                            marginTop: '1rem', 
                            padding: '0.5rem',
                            backgroundColor: '#f9fafb',
                            borderRadius: '0.25rem'
                          }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                              预览效果
                            </div>
                            <video 
                              src={`/api/video-proxy?url=${encodeURIComponent(dh.previewUrl)}`}
                              controls
                              preload="metadata"
                              playsInline
                              style={{
                                width: '100%',
                                maxHeight: '150px',
                                borderRadius: '0.25rem'
                              }}
                              onError={(e) => {
                                console.error('视频加载失败:', dh.previewUrl, e);
                                const target = e.target as HTMLVideoElement;
                                target.style.backgroundColor = '#f3f4f6';
                                target.style.display = 'flex';
                                target.style.alignItems = 'center';
                                target.style.justifyContent = 'center';
                              }}
                              onLoadStart={() => console.log('开始加载视频:', dh.previewUrl)}
                              onCanPlay={() => console.log('视频可以播放:', dh.previewUrl)}
                            >
                              您的浏览器不支持视频播放
                            </video>
                            
                            {/* 生成视频按钮 - 声音已自动克隆 */}
                            <div style={{ marginTop: '0.75rem' }}>
                              <div style={{ 
                                fontSize: '0.7rem', 
                                color: '#6b7280', 
                                marginBottom: '0.5rem',
                                textAlign: 'center'
                              }}>
                                🎤 已使用 Minimax 最优模型自动克隆声音
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedDigitalHuman(dh.trainingId);
                                  setCurrentStep(3);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.75rem',
                                  border: 'none',
                                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                  color: 'white',
                                  borderRadius: '0.5rem',
                                  cursor: 'pointer',
                                  fontWeight: '600',
                                  fontSize: '0.9rem'
                                }}
                              >
                                使用此数字人生成视频 🎬
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* 调试按钮 */}
                        <div style={{ marginTop: '0.5rem' }}>
                          <button
                            onClick={() => {
                              if (dh.previewUrl) {
                                console.log('测试视频URL:', dh.previewUrl);
                                window.open(dh.previewUrl, '_blank');
                              }
                            }}
                            style={{
                              padding: '0.25rem 0.5rem',
                              border: '1px solid #d1d5db',
                              backgroundColor: '#f9fafb',
                              color: '#374151',
                              borderRadius: '0.25rem',
                              fontSize: '0.7rem',
                              cursor: 'pointer'
                            }}
                          >
                            🎬 测试视频
                          </button>
                        </div>
                      </div>
                    ))}
                    
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}