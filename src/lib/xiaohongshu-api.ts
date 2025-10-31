// 小红书 API 服务
const XIAOHONGSHU_API_BASE = 'https://xiaohongshu-proxy-k8j5.zeabur.app/api/v1';

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
    const response = await fetch(`${XIAOHONGSHU_API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password, name }),
    });

    if (!response.ok) {
      throw new Error('注册失败');
    }

    const data = await response.json();
    if (data.code === 201) {
      this.setToken(data.data.token);
      this.setApiKey(data.data.user.api_key);
    }
    return data;
  }

  // 登录
  async login(username: string, password: string): Promise<XiaohongshuAuthResponse> {
    const response = await fetch(`${XIAOHONGSHU_API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error('登录失败');
    }

    const data = await response.json();
    if (data.code === 200) {
      this.setToken(data.data.token);
      this.setApiKey(data.data.user.api_key);
    }
    return data;
  }

  // 处理小红书请求（使用 API Key）
  async processWithApiKey(prompt: string): Promise<XiaohongshuProcessResponse> {
    if (!this.apiKey) {
      throw new Error('API Key 未设置');
    }

    const response = await fetch(`${XIAOHONGSHU_API_BASE}/xiaohongshu/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error('请求失败');
    }

    return await response.json();
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
