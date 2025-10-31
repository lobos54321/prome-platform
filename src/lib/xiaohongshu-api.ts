// 小红书 API 服务
const XIAOHONGSHU_API_BASE = 'https://xiaohongshu-automation-ai.zeabur.app/api/v1';

// 超时配置
const REQUEST_TIMEOUT = 30000; // 30秒
const MAX_RETRIES = 2;

// 带超时的fetch
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接或稍后重试');
    }
    throw error;
  }
}

export interface XiaohongshuAuthResponse {
  code: number;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      username: string;
      email: string;
      name: string;
      avatar: string;
      status: string;
      plan: string;
      api_key: string;
      created_at: string;
    };
  };
}

export interface XiaohongshuProcessRequest {
  prompt: string;
  user_id?: string;
}

export interface XiaohongshuProcessResponse {
  code: number;
  message: string;
  data: {
    content: string;
    metadata?: any;
  };
}

class XiaohongshuAPI {
  private token: string | null = null;
  private apiKey: string | null = null;

  constructor() {
    // 从 localStorage 读取 token 和 apiKey
    this.token = localStorage.getItem('xiaohongshu_token');
    this.apiKey = localStorage.getItem('xiaohongshu_api_key');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('xiaohongshu_token', token);
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    localStorage.setItem('xiaohongshu_api_key', apiKey);
  }

  getToken() {
    return this.token;
  }

  getApiKey() {
    return this.apiKey;
  }

  clearAuth() {
    this.token = null;
    this.apiKey = null;
    localStorage.removeItem('xiaohongshu_token');
    localStorage.removeItem('xiaohongshu_api_key');
  }

  // 注册用户
  async register(username: string, email: string, password: string, name: string): Promise<XiaohongshuAuthResponse> {
    try {
      const response = await fetchWithTimeout(`${XIAOHONGSHU_API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password, name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || '注册失败');
      }

      const data = await response.json();
      if (data.code === 201) {
        this.setToken(data.data.token);
        this.setApiKey(data.data.user.api_key);
      }
      return data;
    } catch (error: any) {
      console.error('注册失败:', error);
      throw new Error(error.message || '注册失败，请检查网络连接');
    }
  }

  // 登录
  async login(username: string, password: string): Promise<XiaohongshuAuthResponse> {
    try {
      const response = await fetchWithTimeout(`${XIAOHONGSHU_API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || '登录失败');
      }

      const data = await response.json();
      if (data.code === 200) {
        this.setToken(data.data.token);
        this.setApiKey(data.data.user.api_key);
      }
      return data;
    } catch (error: any) {
      console.error('登录失败:', error);
      throw new Error(error.message || '登录失败，请检查网络连接');
    }
  }

  // 处理小红书请求（使用 JWT Token）
  async processWithToken(prompt: string): Promise<XiaohongshuProcessResponse> {
    if (!this.token) {
      throw new Error('请先登录');
    }

    try {
      const response = await fetchWithTimeout(`${XIAOHONGSHU_API_BASE}/xiaohongshu/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({ prompt }),
      }, 60000); // 内容生成使用60秒超时

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || '请求失败');
      }

      return await response.json();
    } catch (error: any) {
      console.error('处理请求失败:', error);
      throw new Error(error.message || '请求失败，请检查网络连接');
    }
  }

  // 处理小红书请求（使用 API Key）
  async processWithApiKey(prompt: string): Promise<XiaohongshuProcessResponse> {
    if (!this.apiKey) {
      throw new Error('API Key 未设置');
    }

    try {
      const response = await fetchWithTimeout(`${XIAOHONGSHU_API_BASE}/xiaohongshu/api/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ prompt }),
      }, 60000); // 内容生成使用60秒超时

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || '请求失败');
      }

      return await response.json();
    } catch (error: any) {
      console.error('处理请求失败:', error);
      throw new Error(error.message || '请求失败，请检查网络连接');
    }
  }

  // 获取用户信息
  async getUserProfile() {
    if (!this.token) {
      throw new Error('请先登录');
    }

    const response = await fetch(`${XIAOHONGSHU_API_BASE}/user/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error('获取用户信息失败');
    }

    return await response.json();
  }

  // 获取用户统计信息
  async getUserStats() {
    if (!this.token) {
      throw new Error('请先登录');
    }

    const response = await fetch(`${XIAOHONGSHU_API_BASE}/user/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error('获取统计信息失败');
    }

    return await response.json();
  }

  // 检查是否已登录
  isAuthenticated(): boolean {
    return !!this.token || !!this.apiKey;
  }
}

export const xiaohongshuAPI = new XiaohongshuAPI();
