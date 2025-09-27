/**
 * 仙宫云API集成 - infinitetalk 和 indextts2
 */

interface XiangongConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
}

interface InfiniteTalkParams {
  text: string;
  avatar?: string;
  voice?: string;
  emotion?: string;
  background?: string;
}

interface IndexTTSParams {
  text: string;
  speaker_id?: number;
  language?: string;
  speed?: number;
  pitch?: number;
}

class XiangongYunAPI {
  private config: XiangongConfig;

  constructor() {
    this.config = {
      apiKey: import.meta.env.VITE_XIANGONG_API_KEY || 'miv4n5hh6313imnijhgqpzqbb0at3xxlm2l24x7r',
      baseUrl: import.meta.env.VITE_XIANGONG_BASE_URL || '', // 需要您提供实际的服务地址
      timeout: 30000 // 30秒超时
    };
  }

  /**
   * 通用API请求方法 - 通过后端代理
   */
  private async makeRequest(endpoint: string, data: any): Promise<any> {
    // 使用本地后端作为代理，避免跨域问题
    const url = endpoint;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `API请求失败 (${response.status})`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时，请稍后重试');
      }
      console.error(`仙宫云API请求失败 (${endpoint}):`, error);
      throw error;
    }
  }

  /**
   * InfiniteTalk - 数字人视频生成
   */
  async generateDigitalHumanVideo(params: InfiniteTalkParams): Promise<{
    success: boolean;
    taskId?: string;
    videoUrl?: string;
    message?: string;
    comfyuiUrl?: string;
    instructions?: string[];
    inputText?: string;
    temporarySolution?: any;
  }> {
    try {
      console.log('🎬 调用InfiniteTalk生成数字人视频...', params);

      const result = await this.makeRequest('/api/xiangong/infinitetalk', {
        text: params.text,
        avatar: params.avatar || 'default',
        voice: params.voice || 'default',
        emotion: params.emotion || 'neutral',
        background: params.background
      });

      console.log('✅ 仙宫云API响应:', result);

      // 处理临时解决方案响应
      if (result.temporarySolution) {
        console.log('🔗 检测到临时解决方案，提供ComfyUI直接访问');
        return {
          success: false,
          message: result.message || '请使用ComfyUI界面生成',
          comfyuiUrl: result.temporarySolution.comfyuiUrl,
          instructions: result.temporarySolution.instructions,
          inputText: result.temporarySolution.inputText,
          temporarySolution: result.temporarySolution
        };
      }

      if (result.success) {
        return {
          success: true,
          taskId: result.taskId,
          videoUrl: result.videoUrl,
          message: result.message || '数字人视频生成成功',
          comfyuiUrl: result.comfyuiUrl
        };
      } else {
        return {
          success: true,
          taskId: result.task_id,
          videoUrl: result.video_url || result.result_url,
          message: '数字人视频生成成功'
        };
      }
    } catch (error) {
      console.error('InfiniteTalk生成失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '数字人视频生成失败'
      };
    }
  }

  /**
   * IndexTTS2 - 语音合成
   */
  async generateSpeech(params: IndexTTSParams): Promise<{
    success: boolean;
    audioUrl?: string;
    audioBase64?: string;
    message?: string;
  }> {
    try {
      console.log('🔊 调用IndexTTS2合成语音...', params);

      const result = await this.makeRequest('/api/xiangong/indextts2', {
        text: params.text,
        speaker_id: params.speaker_id || 0,
        language: params.language || 'zh-CN',
        speed: params.speed || 1.0,
        pitch: params.pitch || 0.0
      });

      return {
        success: true,
        audioUrl: result.audio_url,
        audioBase64: result.audio_data,
        message: '语音合成成功'
      };
    } catch (error) {
      console.error('IndexTTS2合成失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '语音合成失败'
      };
    }
  }

  /**
   * 获取任务状态（轮询用）
   */
  async getTaskStatus(taskId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    result?: string;
    error?: string;
  }> {
    try {
      const result = await this.makeRequest('/api/task/status', { task_id: taskId });
      
      return {
        status: result.status,
        progress: result.progress,
        result: result.result_url || result.video_url,
        error: result.error
      };
    } catch (error) {
      console.error('获取任务状态失败:', error);
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : '获取状态失败'
      };
    }
  }

  /**
   * 设置服务地址（动态配置）
   */
  setServiceUrl(baseUrl: string): void {
    this.config.baseUrl = baseUrl;
    console.log('✅ 仙宫云服务地址已更新:', baseUrl);
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ healthy: boolean; services: string[] }> {
    try {
      const response = await fetch('/api/xiangong/health');
      const result = await response.json();
      return {
        healthy: result.healthy,
        services: result.services || []
      };
    } catch (error) {
      return {
        healthy: false,
        services: []
      };
    }
  }
}

// 创建单例实例
export const xiangongAPI = new XiangongYunAPI();

export default xiangongAPI;