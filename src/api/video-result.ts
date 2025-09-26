// 视频结果接收API端点
import express from 'express';

export interface VideoResultRequest {
  sessionId: string;
  videoUrl: string;
  status?: string;
  timestamp?: string;
}

// 存储活跃的会话和对应的回调函数
const activeCallbacks = new Map<string, (result: VideoResultRequest) => void>();

// 注册会话监听器
export function registerVideoCallback(sessionId: string, callback: (result: VideoResultRequest) => void) {
  console.log('📝 注册视频结果监听器:', sessionId);
  activeCallbacks.set(sessionId, callback);
  
  // 30分钟后自动清理
  setTimeout(() => {
    if (activeCallbacks.has(sessionId)) {
      console.log('🧹 清理过期的监听器:', sessionId);
      activeCallbacks.delete(sessionId);
    }
  }, 30 * 60 * 1000);
}

// 取消会话监听器
export function unregisterVideoCallback(sessionId: string) {
  console.log('❌ 取消视频结果监听器:', sessionId);
  activeCallbacks.delete(sessionId);
}

// 处理N8n工作流3发来的视频结果
export function handleVideoResult(req: express.Request, res: express.Response) {
  const { sessionId, videoUrl, status, timestamp } = req.body as VideoResultRequest;
  
  console.log('📥 收到N8n工作流3的视频结果:', {
    sessionId,
    videoUrl,
    status,
    timestamp
  });

  // 验证必填字段
  if (!sessionId || !videoUrl) {
    console.error('❌ 缺少必填字段:', req.body);
    return res.status(400).json({ 
      error: 'Missing required fields: sessionId, videoUrl' 
    });
  }

  // 查找对应的回调函数
  const callback = activeCallbacks.get(sessionId);
  
  if (callback) {
    console.log('✅ 找到对应的监听器，触发回调');
    
    try {
      // 触发前端回调
      callback({
        sessionId,
        videoUrl,
        status,
        timestamp
      });
      
      // 成功处理后清理监听器
      activeCallbacks.delete(sessionId);
      
      res.json({ 
        success: true, 
        message: 'Video result delivered successfully' 
      });
    } catch (error) {
      console.error('❌ 回调执行失败:', error);
      res.status(500).json({ 
        error: 'Failed to execute callback' 
      });
    }
  } else {
    console.log('⚠️ 未找到对应的监听器，可能已过期:', sessionId);
    res.json({ 
      success: false, 
      message: 'No active listener found for this session' 
    });
  }
}

// 获取当前活跃的会话列表（调试用）
export function getActiveSessions() {
  return Array.from(activeCallbacks.keys());
}