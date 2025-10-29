// 小红书自动化 API 服务
// 与 Zeabur 后端服务进行通信

const XIAOHONGSHU_API_BASE =
  import.meta.env.VITE_XIAOHONGSHU_API_BASE ||
  'https://xiaohongshu-automation-ai.zeabur.app';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface LoginStatusResponse {
  logged_in: boolean;
  user_info?: {
    username?: string;
    avatar?: string;
  };
}

interface UserConfiguration {
  userId: string;
  productName: string;
  targetAudience: string;
  marketingGoal: string;
  postFrequency: string;
  brandStyle: string;
  reviewMode: string;
}

interface PerformanceStats {
  todayPosts: number;
  plannedPosts: number;
  weeklyReads: number;
  newFollowers: number;
  engagementRate: number;
}

interface Activity {
  message: string;
  timestamp: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface AutomationStatus {
  isRunning: boolean;
  lastActivity?: string;
  uptime: number;
  nextScheduledTask?: string;
}

interface Strategy {
  keyThemes: string[];
  trendingTopics: string[];
  hashtags: string[];
  optimalTimes: string[];
}

interface WeekPlan {
  days: Array<{
    date: string;
    dayOfWeek: string;
    posts: Array<{
      theme: string;
      scheduledTime: string;
      type: string;
      status: 'pending' | 'ready' | 'published';
    }>;
  }>;
}

class XiaohongshuApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = XIAOHONGSHU_API_BASE;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, defaultOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API请求失败 [${endpoint}]:`, error);
      throw error;
    }
  }

  // 检查小红书登录状态
  async checkLoginStatus(userId: string): Promise<LoginStatusResponse> {
    const response = await this.request<ApiResponse<LoginStatusResponse>>(
      `/agent/xiaohongshu/login/status?userId=${userId}`
    );

    if (!response.success) {
      throw new Error(response.error || '检查登录状态失败');
    }

    return response.data || { logged_in: false };
  }

  // 小红书登出
  async logout(userId: string): Promise<void> {
    const response = await this.request<ApiResponse>(
      '/agent/xiaohongshu/logout',
      {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }
    );

    if (!response.success) {
      throw new Error(response.error || '登出失败');
    }
  }

  // 手动提交Cookie
  async submitManualCookies(
    userId: string,
    cookies: Array<{name: string, value: string, httpOnly?: boolean}>
  ): Promise<void> {
    const response = await this.request<ApiResponse>(
      '/agent/xiaohongshu/manual-cookies',
      {
        method: 'POST',
        body: JSON.stringify({ userId, cookies }),
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Cookie提交失败');
    }
  }

  // 获取用户配置
  async getConfiguration(userId: string): Promise<{strategy?: UserConfiguration}> {
    try {
      const response = await this.request<ApiResponse<{strategy: UserConfiguration}>>(
        `/agent/auto/strategy/${userId}`
      );

      return response.success ? response.data || {} : {};
    } catch (error) {
      console.error('获取配置失败:', error);
      return {};
    }
  }

  // 启动自动运营
  async startAutomation(config: UserConfiguration): Promise<void> {
    const response = await this.request<ApiResponse>(
      '/agent/auto/start',
      {
        method: 'POST',
        body: JSON.stringify(config),
      }
    );

    if (!response.success) {
      throw new Error(response.error || '启动自动运营失败');
    }
  }

  // 获取自动运营状态
  async getAutomationStatus(userId: string): Promise<AutomationStatus> {
    try {
      const response = await this.request<ApiResponse<AutomationStatus>>(
        `/agent/auto/status/${userId}`
      );

      return response.success ? (response.data || {
        isRunning: false,
        uptime: 0
      }) : {
        isRunning: false,
        uptime: 0
      };
    } catch (error) {
      console.error('获取运营状态失败:', error);
      return {
        isRunning: false,
        uptime: 0
      };
    }
  }

  // 暂停自动运营
  async pauseAutomation(userId: string): Promise<void> {
    const response = await this.request<ApiResponse>(
      '/agent/auto/pause',
      {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }
    );

    if (!response.success) {
      throw new Error(response.error || '暂停自动运营失败');
    }
  }

  // 恢复自动运营
  async resumeAutomation(userId: string): Promise<void> {
    const response = await this.request<ApiResponse>(
      '/agent/auto/resume',
      {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }
    );

    if (!response.success) {
      throw new Error(response.error || '恢复自动运营失败');
    }
  }

  // 重置配置
  async resetConfiguration(userId: string): Promise<void> {
    const response = await this.request<ApiResponse>(
      `/agent/auto/reset/${userId}`,
      {
        method: 'POST',
      }
    );

    if (!response.success) {
      throw new Error(response.error || '重置配置失败');
    }
  }

  // 获取性能统计
  async getPerformanceStats(userId: string): Promise<PerformanceStats> {
    try {
      const response = await this.request<ApiResponse<{stats: PerformanceStats}>>(
        `/agent/auto/stats/${userId}`
      );

      return response.success ? (response.data?.stats || {
        todayPosts: 0,
        plannedPosts: 0,
        weeklyReads: 0,
        newFollowers: 0,
        engagementRate: 0
      }) : {
        todayPosts: 0,
        plannedPosts: 0,
        weeklyReads: 0,
        newFollowers: 0,
        engagementRate: 0
      };
    } catch (error) {
      console.error('获取性能统计失败:', error);
      return {
        todayPosts: 0,
        plannedPosts: 0,
        weeklyReads: 0,
        newFollowers: 0,
        engagementRate: 0
      };
    }
  }

  // 获取活动记录
  async getActivities(userId: string): Promise<Activity[]> {
    try {
      const response = await this.request<ApiResponse<{activities: Activity[]}>>(
        `/agent/auto/activity/${userId}`
      );

      return response.success ? (response.data?.activities || []) : [];
    } catch (error) {
      console.error('获取活动记录失败:', error);
      return [];
    }
  }

  // 获取内容策略
  async getStrategy(userId: string): Promise<Strategy | null> {
    try {
      const response = await this.request<ApiResponse<{strategy: Strategy}>>(
        `/agent/auto/strategy/${userId}`
      );

      return response.success ? (response.data?.strategy || null) : null;
    } catch (error) {
      console.error('获取策略失败:', error);
      return null;
    }
  }

  // 获取周计划
  async getWeekPlan(userId: string): Promise<WeekPlan | null> {
    try {
      const response = await this.request<ApiResponse<{weeklyPlan: WeekPlan}>>(
        `/agent/auto/week-plan/${userId}`
      );

      return response.success ? (response.data?.weeklyPlan || null) : null;
    } catch (error) {
      console.error('获取周计划失败:', error);
      return null;
    }
  }

  // 获取今日计划
  async getTodayPlan(userId: string): Promise<any> {
    try {
      const response = await this.request<ApiResponse>(
        `/agent/auto/plan/${userId}`
      );

      return response.success ? response.data : null;
    } catch (error) {
      console.error('获取今日计划失败:', error);
      return null;
    }
  }

  // 健康检查
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request<any>('/health');
      return response.status === 'OK' || response.success;
    } catch (error) {
      console.error('健康检查失败:', error);
      return false;
    }
  }
}

// 创建并导出API服务实例
export const xiaohongshuApi = new XiaohongshuApiService();

// 导出类型定义
export type {
  ApiResponse,
  LoginStatusResponse,
  UserConfiguration,
  PerformanceStats,
  Activity,
  AutomationStatus,
  Strategy,
  WeekPlan,
};

// 导出服务类
export { XiaohongshuApiService };