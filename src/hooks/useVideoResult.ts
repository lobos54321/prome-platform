import { useState, useEffect, useRef, useCallback } from 'react';

interface VideoResult {
  sessionId: string;
  videoUrl: string;
  status?: string;
  timestamp?: string;
}

interface UseVideoResultOptions {
  sessionId: string;
  onResult?: (result: VideoResult) => void;
  pollingInterval?: number;
  maxPollingTime?: number;
}

export function useVideoResult({
  sessionId,
  onResult,
  pollingInterval = 5000, // 5秒轮询一次
  maxPollingTime = 900000  // 15分钟超时
}: UseVideoResultOptions) {
  const [result, setResult] = useState<VideoResult | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // 开始轮询
  const startPolling = useCallback(() => {
    if (isPolling) return;
    
    console.log('🔄 开始轮询视频结果，sessionId:', sessionId);
    setIsPolling(true);
    setError(null);
    startTimeRef.current = Date.now();
    
    const poll = async () => {
      const elapsed = Date.now() - startTimeRef.current;
      
      // 检查是否超时
      if (elapsed > maxPollingTime) {
        console.log('⏰ 轮询超时，停止检查');
        stopPolling();
        setError('视频生成超时，请手动检查N8n工作流状态');
        return;
      }
      
      try {
        console.log('🔍 检查视频结果...', Math.floor(elapsed / 1000), '秒');
        
        // 调用后端API检查是否有结果
        const response = await fetch(`/api/video-result/check/${sessionId}`, {
          method: 'GET'
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.result) {
            console.log('🎉 获取到视频结果:', data.result);
            setResult(data.result);
            onResult?.(data.result);
            stopPolling();
            return;
          }
        }
        
        // 继续轮询
        pollingRef.current = setTimeout(poll, pollingInterval);
        
      } catch (error) {
        console.error('❌ 轮询检查失败:', error);
        // 继续轮询，不因单次失败而停止
        pollingRef.current = setTimeout(poll, pollingInterval);
      }
    };
    
    // 立即开始第一次检查
    poll();
  }, [sessionId, isPolling, maxPollingTime, pollingInterval, onResult]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    console.log('⏹️ 停止轮询视频结果');
    setIsPolling(false);
    
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // 重置状态
  const reset = () => {
    stopPolling();
    setResult(null);
    setError(null);
  };

  // 当sessionId变化时，重置状态
  useEffect(() => {
    if (sessionId && sessionId.trim() !== '') {
      console.log('📱 sessionId已更新，重置轮询状态:', sessionId);
      reset();
    }
  }, [sessionId]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return {
    result,
    isPolling,
    error,
    startPolling,
    stopPolling,
    reset
  };
}