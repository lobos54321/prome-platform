/**
 * 小红书自动化系统 - API 封装层
 * 与后端服务 xiaohongshu-automation-ai 通信
 */

// ============================================
// API 配置
// ============================================

const API_BASE = 'https://xiaohongshu-automation-ai.zeabur.app';

// ============================================
// TypeScript 接口定义
// ============================================

export interface LoginStatusResponse {
  success: boolean;
  data?: {
    logged_in: boolean;
    user_id?: string;
  };
  error?: string;
}

export interface AutoLoginResponse {
  success: boolean;
  status?: 'already_logged_in' | 'qr_code_generated' | 'auto_detected';
  data?: {
    qrcode_url?: string;
    cookieCount?: number;
  };
  error?: string;
}

export interface LogoutStatusResponse {
  success: boolean;
  data?: {
    inGlobalLogoutState: boolean;
    remainingSeconds: number;
  };
  error?: string;
}

export interface Cookie {
  name: string;
  value: string;
  httpOnly?: boolean;
}

export interface ManualCookiesResponse {
  success: boolean;
  error?: string;
}

export interface AutoImportResponse {
  success: boolean;
  data?: {
    cookieCount?: number;
  };
  error?: string;
}

export interface Strategy {
  key_themes?: string[];
  trending_topics?: string[];
  hashtags?: string[];
  optimal_times?: string[];
}

export interface StrategyResponse {
  success: boolean;
  strategy?: Strategy;
  error?: string;
}

export interface Plan {
  theme?: string;
  title?: string;
  content?: string;
  scheduled_time?: string;
}

export interface PlanResponse {
  success: boolean;
  plan?: Plan[];
  error?: string;
}

export interface AutoConfig {
  productName: string;
  targetAudience: string;
  marketingGoal: string;
  postFrequency: string;
  brandStyle: string;
  reviewMode: string;
}

export interface StartAutoModeResponse {
  success: boolean;
  error?: string;
}

export interface AutoStatus {
  is_running: boolean;
  uptime_seconds?: number;
  next_scheduled_task?: string;
  last_activity?: string;
}

export interface AutoStatusResponse {
  success: boolean;
  status?: AutoStatus;
  error?: string;
}

// ============================================
// 通用请求封装
// ============================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  console.log(`[XHS API] ${options.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    
    console.log(`[XHS API] Response:`, data);
    
    return data as T;
  } catch (error) {
    console.error(`[XHS API] Error:`, error);
    throw error;
  }
}

// ============================================
// 登录相关 API
// ============================================

/**
 * 检查登录状态
 */
export async function checkLoginStatus(userId: string): Promise<LoginStatusResponse> {
  return apiRequest<LoginStatusResponse>(
    `/agent/xiaohongshu/login/status?userId=${encodeURIComponent(userId)}`
  );
}

/**
 * 启动自动登录（生成二维码）
 */
export async function startAutoLogin(userId: string): Promise<AutoLoginResponse> {
  return apiRequest<AutoLoginResponse>(
    '/agent/xiaohongshu/auto-login',
    {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }
  );
}

/**
 * 手动提交 Cookie
 */
export async function submitManualCookies(
  userId: string,
  cookies: Cookie[]
): Promise<ManualCookiesResponse> {
  return apiRequest<ManualCookiesResponse>(
    '/agent/xiaohongshu/manual-cookies',
    {
      method: 'POST',
      body: JSON.stringify({ userId, cookies }),
    }
  );
}

/**
 * 检查退出保护状态
 */
export async function checkLogoutStatus(): Promise<LogoutStatusResponse> {
  return apiRequest<LogoutStatusResponse>('/agent/xiaohongshu/logout-status');
}

/**
 * 自动导入 Cookie
 */
export async function autoImportCookies(userId: string): Promise<AutoImportResponse> {
  return apiRequest<AutoImportResponse>(
    '/agent/auto-import/manual',
    {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }
  );
}

/**
 * 清除 Cookie（退出登录）
 */
export async function clearCookies(userId: string): Promise<ManualCookiesResponse> {
  return apiRequest<ManualCookiesResponse>(
    '/agent/xiaohongshu/clear-cookies',
    {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }
  );
}

// ============================================
// 自动运营相关 API
// ============================================

/**
 * 获取内容策略
 */
export async function getStrategy(userId: string): Promise<StrategyResponse> {
  return apiRequest<StrategyResponse>(
    `/agent/auto/strategy/${encodeURIComponent(userId)}`
  );
}

/**
 * 获取本周计划
 */
export async function getPlan(userId: string): Promise<PlanResponse> {
  return apiRequest<PlanResponse>(
    `/agent/auto/plan/${encodeURIComponent(userId)}`
  );
}

/**
 * 启动自动运营
 */
export async function startAutoMode(
  userId: string,
  config: AutoConfig
): Promise<StartAutoModeResponse> {
  return apiRequest<StartAutoModeResponse>(
    '/agent/auto/start',
    {
      method: 'POST',
      body: JSON.stringify({
        userId,
        ...config,
      }),
    }
  );
}

/**
 * 获取自动运营状态
 */
export async function getAutoStatus(userId: string): Promise<AutoStatusResponse> {
  return apiRequest<AutoStatusResponse>(
    `/agent/auto/status/${encodeURIComponent(userId)}`
  );
}

/**
 * 健康检查
 */
export async function healthCheck(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>('/health');
}