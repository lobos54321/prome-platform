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
  private readonly baseURL = 'https://xiaohongshu-automation-ai.zeabur.app';
  private readonly timeout = 30000; // 30秒

  /**
   * 通用请求方法
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new APIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
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
   * 检查登录状态
   */
  async checkLoginStatus(userId: string): Promise<LoginStatus> {
    const response = await this.request<LoginStatus>(
      `/agent/xiaohongshu/login/status?userId=${encodeURIComponent(userId)}`,
      { method: 'GET' }
    );
    return response.data || { success: false, isLoggedIn: false };
  }

  /**
   * 自动登录（获取二维码）
   */
  async autoLogin(userId: string): Promise<QRCodeData> {
    const response = await this.request<QRCodeData>(
      '/agent/xiaohongshu/auto-login',
      {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }
    );
    return response.data || { success: false };
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

  // ============================================
  // 自动运营 API
  // ============================================

  /**
   * 启动自动运营
   */
  async startAutoOperation(userId: string, config: ProductConfig): Promise<APIResponse> {
    return await this.request(
      '/agent/auto/start',
      {
        method: 'POST',
        body: JSON.stringify({ userId, ...config }),
      }
    );
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
}

// 导出单例
export const xiaohongshuAPI = new XiaohongshuBackendAPI();
