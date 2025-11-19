// ============================================
// xiaohongshumcp 后端 API 封装
// ============================================

import type { 
  LoginStatus, 
  QRCodeData, 
  APIResponse, 
  ProductConfig,
  AutomationStatus,
  ContentStrategy,
  WeeklyPlan
} from '@/types/xiaohongshu';
import { NetworkError, TimeoutError, APIError } from './xiaohongshu-errors';

/**
 * xiaohongshumcp 后端 API 服务
 */
export class XiaohongshuBackendAPI {
  private readonly baseURL = ((import.meta as any).env?.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app').replace(/\/$/, '');
  private readonly timeout = 30000; // 30秒

  /**
   * 通用请求方法
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const fullURL = new URL(endpoint, this.baseURL).toString();
    const method = options.method || 'GET';
    
    // 🔍 详细请求日志
    console.log(`📤 [BackendAPI] ${method} ${fullURL}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = { ...(options.headers as any) };
      // 仅在有body时设置Content-Type，避免部分GET接口返回HTML
      if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
      const response = await fetch(fullURL, { ...options, signal: controller.signal, headers });

      clearTimeout(timeoutId);

      // 🔍 响应日志
      console.log(`📥 [BackendAPI] ${response.status} ${fullURL}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`❌ [BackendAPI] Error Response:`, errorText);
        throw new APIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const ct = response.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const text = await response.text();
        console.error(`❌ [BackendAPI] Non-JSON response`, { url: fullURL, status: response.status, contentType: ct, preview: text.slice(0, 200) });
        throw new Error('响应不是JSON，请检查后端域名或路径');
      }
      const data = await response.json();
      console.log(`✅ [BackendAPI] Success:`, data);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // 🔍 错误详情日志
      console.error(`❌ [BackendAPI] Request Failed:`, {
        url: fullURL,
        method,
        error: error instanceof Error ? error.message : error
      });
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError('请求超时，请检查网络连接');
        }
        if (error.message.includes('Failed to fetch')) {
          throw new NetworkError('网络连接失败，请检查网络设置');
        }
        if (error instanceof APIError) {
          throw error;
        }
      }
      
      throw new Error('未知错误');
    }
  }

  // ============================================
  // 登录管理 API
  // ============================================

  /**
   * 获取验证二维码（二次验证）
   * 当登录需要二次验证时，获取验证页面的二维码
   */
  async getVerificationQRCode(userId: string): Promise<{
    hasVerification: boolean;
    qrcodeImage?: string;
    expiresIn?: number;
    message?: string;
  }> {
    try {
      const response = await this.request<any>(
        `/api/xiaohongshu/login/verification-qrcode?userId=${encodeURIComponent(userId)}`,
        { method: 'GET' }
      );

      // 后端返回格式: { available: bool, img: string, message: string }
      const data = response.success ? (response.data || response) : response;

      if (data) {
        // 映射后端字段到前端字段
        const hasVerification = data.available || data.hasVerification || false;
        const qrcodeImage = data.img || data.qrcodeImage || data.qrcode_image;

        console.log('🔐 [BackendAPI] 验证二维码响应:', {
          available: data.available,
          hasVerification,
          hasImg: !!qrcodeImage
        });

        return {
          hasVerification,
          qrcodeImage,
          expiresIn: data.expiresIn || data.expires_in,
          message: data.message,
        };
      }

      return { hasVerification: false };
    } catch (error) {
      console.error('❌ [BackendAPI] 获取验证二维码失败:', error);
      return { hasVerification: false };
    }
  }

  /**
   * 检查登录状态
   */
  async checkLoginStatus(userId: string): Promise<LoginStatus> {
    const response = await this.request<any>(
      `/api/xiaohongshu/login/status?userId=${encodeURIComponent(userId)}&force_qr=1`,
      { method: 'GET' }
    );
    
    // 适配后端响应结构：
    // this.request直接返回response body
    // 后端返回: { success: true, data: { logged_in: true 或 isLoggedIn: true, ... }, message: "..." }
    if (response.success && response.data) {
      // 兼容两种字段名：logged_in 和 isLoggedIn
      const isLoggedIn = response.data.isLoggedIn || response.data.logged_in || false;
      return {
        ...response.data,
        isLoggedIn: isLoggedIn, // 统一使用 isLoggedIn
      };
    }
    
    // 失败情况
    return { success: false, isLoggedIn: false };
  }

  /**
   * 自动登录（获取二维码）
   */
  async autoLogin(userId: string): Promise<QRCodeData> {
    const response = await this.request<any>(
      `/api/xiaohongshu/login/qrcode?userId=${encodeURIComponent(userId)}&force_qr=1`,
      { method: 'GET' }
    );
    
    // 适配后端响应结构：
    // this.request直接返回response body
    // 后端返回: { success: true, data: { img: "...", has_verification: bool, verification_img: "..." }, message: "..." }
    if (response && (response.data?.img || response.img)) {
      const data = response.data || response;
      const img = data.img;
      const hasVerification = data.has_verification || false;
      const verificationImg = data.verification_img;

      return {
        success: true,
        qrCode: img,
        message: response.message || '请扫码登录',
        // 验证二维码相关字段
        hasVerification,
        verificationQrCode: verificationImg,
      };
    }

    // 失败情况
    return {
      success: false,
      message: response.error || response.message || '获取二维码失败'
    };
  }

  /**
   * 手动提交Cookie
   */
  async submitManualCookies(userId: string, cookies: string): Promise<APIResponse> {
    return await this.request(
      '/agent/xiaohongshu/manual-cookies',
      {
        method: 'POST',
        body: JSON.stringify({ userId, cookies }),
      }
    );
  }

  /**
   * 自动导入Cookie（从inbox）
   */
  async autoImportCookies(userId: string): Promise<APIResponse> {
    return await this.request(
      '/agent/auto-import/manual',
      {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }
    );
  }

  /**
   * 检查退出登录保护状态
   */
  async checkLogoutStatus(userId: string): Promise<APIResponse<{ inProtection: boolean; remainingSeconds: number }>> {
    return await this.request(
      `/agent/xiaohongshu/logout-status?userId=${encodeURIComponent(userId)}`,
      { method: 'GET' }
    );
  }

  async resetLogoutProtection(userId: string): Promise<APIResponse<{ message: string }>> {
    return await this.request(
      '/agent/xiaohongshu/reset-logout-protection',
      { method: 'POST', body: JSON.stringify({ userId }) }
    );
  }

  // ============================================
  // 自动运营 API
  // ============================================

  /**
   * 启动自动运营
   */
  async startAutoOperation(userId: string, config: ProductConfig): Promise<APIResponse> {
    // 启动自动运营需要更长时间，设置 60 秒超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${this.baseURL}/agent/auto/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, ...config }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new APIError('启动超时，但操作可能仍在后台进行', 408);
      }
      throw error;
    }
  }

  /**
   * 获取自动化状态
   */
  async getAutomationStatus(userId: string): Promise<APIResponse<AutomationStatus>> {
    return await this.request(
      `/agent/auto/status/${encodeURIComponent(userId)}`,
      { method: 'GET' }
    );
  }

  /**
   * 获取内容策略
   */
  async getContentStrategy(userId: string): Promise<APIResponse<ContentStrategy>> {
    return await this.request(
      `/agent/auto/strategy/${encodeURIComponent(userId)}`,
      { method: 'GET' }
    );
  }

  /**
   * 获取周计划
   */
  async getWeeklyPlan(userId: string): Promise<APIResponse<WeeklyPlan>> {
    return await this.request(
      `/agent/auto/plan/${encodeURIComponent(userId)}`,
      { method: 'GET' }
    );
  }

  // ============================================
  // 系统管理 API
  // ============================================

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取用户资料（当前登录的小红书账号信息）
   */
  async getUserProfile(userId: string): Promise<APIResponse<any>> {
    return await this.request(
      `/agent/xiaohongshu/profile?userId=${encodeURIComponent(userId)}`,
      { method: 'GET' }
    );
  }

  /**
   * 批准发布内容
   */
  async approvePost(userId: string, postId: string): Promise<ApiResponse<any>> {
    try {
      console.log(`🚀 [BackendAPI] 批准发布 - userId: ${userId}, postId: ${postId}`);

      const response = await fetch(`${this.baseURL}/agent/auto/approve/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId: postId }), // 🔥 后端期望 taskId 字段
      });

      console.log(`📥 [BackendAPI] 批准发布响应状态: ${response.status}`);
      const data = await response.json();
      console.log(`📥 [BackendAPI] 批准发布响应数据:`, data);

      return {
        success: response.ok,
        data: data, // 🔥 返回完整数据，包含 jobId
        error: data.error
      };
    } catch (error) {
      console.error(`❌ [BackendAPI] 批准发布失败:`, error);
      return this.handleError(error);
    }
  }

  /**
   * 查询发布作业状态
   */
  async getPublishJobStatus(jobId: string, userId: string): Promise<ApiResponse<any>> {
    try {
      console.log(`📊 [BackendAPI] 查询作业状态 - jobId: ${jobId}, userId: ${userId}`);

      const response = await fetch(`${this.baseURL}/agent/auto/publish-status/${jobId}?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log(`📥 [BackendAPI] 作业状态:`, data);

      return { success: response.ok, data: data, error: data.error };
    } catch (error) {
      console.error(`❌ [BackendAPI] 查询作业状态失败:`, error);
      return this.handleError(error);
    }
  }

  /**
   * 重新生成内容
   */
  async regeneratePost(userId: string, postId: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseURL}/agent/auto/regenerate/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId }),
      });

      const data = await response.json();
      return { success: response.ok, data: data.data, error: data.error };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 退出登录 - 清除后端Cookie
   */
  async logout(userId: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseURL}/agent/xiaohongshu/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      return { success: response.ok, data: data.data, error: data.error };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 强制清除所有Cookie和状态 - 彻底退出登录
   * 调用 force-clear-cookies 端点，清理所有Cookie来源
   */
  async forceLogout(userId: string): Promise<ApiResponse<any>> {
    try {
      console.log(`🧹 [BackendAPI] 强制清除用户 ${userId} 的所有Cookie和状态`);
      
      const response = await fetch(`${this.baseURL}/agent/xiaohongshu/force-clear-cookies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ [BackendAPI] 强制清除成功:`, data);
      } else {
        console.error(`❌ [BackendAPI] 强制清除失败:`, data);
      }
      
      return { success: response.ok, data: data.data, error: data.error };
    } catch (error) {
      console.error(`❌ [BackendAPI] 强制清除异常:`, error);
      return this.handleError(error);
    }
  }

  /**
   * 重置自动运营
   */
  async resetAutoOperation(userId: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseURL}/agent/auto/reset/${userId}`, {
        method: 'POST',
      });

      const data = await response.json();
      return { success: response.ok, data: data.data, error: data.error };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 暂停自动运营
   */
  async pauseAutoOperation(userId: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseURL}/agent/auto/pause/${userId}`, {
        method: 'POST',
      });

      const data = await response.json();
      return { success: response.ok, data: data.data, error: data.error };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 恢复自动运营
   */
  async resumeAutoOperation(userId: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseURL}/agent/auto/resume/${userId}`, {
        method: 'POST',
      });

      const data = await response.json();
      return { success: response.ok, data: data.data, error: data.error };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 更新内容策略
   */
  async updateStrategy(userId: string, strategy: any): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseURL}/agent/auto/update-strategy/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(strategy),
      });

      const data = await response.json();
      return { success: response.ok, data: data.data, error: data.error };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 编辑内容
   */
  async editPost(userId: string, postId: string, updates: any): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseURL}/agent/auto/edit/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId, ...updates }),
      });

      const data = await response.json();
      return { success: response.ok, data: data.data, error: data.error };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// 导出单例
export const xiaohongshuAPI = new XiaohongshuBackendAPI();
