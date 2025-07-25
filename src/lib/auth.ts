import { User } from '@/types';
import { db } from './supabase';

// Authentication service using Supabase
class AuthService {
  private currentUser: User | null = null;
  private isInitialized: boolean = false;
  private isValidating: boolean = false;
  private validationPromise: Promise<User | null> | null = null;
  
  // Login with email and password
  async login(email: string, password: string): Promise<User> {
    try {
      // 先清除任何现有状态
      this.forceLogout();
      
      const user = await db.signIn(email, password);
      
      if (!user) {
        throw new Error('Login failed. Please check your credentials.');
      }
      
      this.currentUser = user;
      this.isInitialized = true;
      
      localStorage.setItem('currentUser', JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        balance: user.balance
      }));
      
      // 触发认证状态变更事件
      window.dispatchEvent(new CustomEvent('auth-state-changed', { 
        detail: { user } 
      }));
      
      return user;
    } catch (error) {
      // 登录失败时清除状态
      this.forceLogout();
      throw error;
    }
  }
  
  // Register new user
  async register(name: string, email: string, password: string): Promise<User> {
    try {
      // 先清除任何现有状态
      this.forceLogout();
      
      const user = await db.signUp(email, password, name);
      
      if (!user) {
        throw new Error('Registration failed. Please try again later.');
      }
      
      this.currentUser = user;
      this.isInitialized = true;
      
      localStorage.setItem('currentUser', JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        balance: user.balance
      }));
      
      // 触发认证状态变更事件
      window.dispatchEvent(new CustomEvent('auth-state-changed', { 
        detail: { user } 
      }));
      
      return user;
    } catch (error) {
      // 注册失败时清除状态
      this.forceLogout();
      throw error;
    }
  }
  
  // 异步获取当前用户 - 严格验证版本
  async getCurrentUser(): Promise<User | null> {
    // 如果已经有验证进程在运行，等待其完成
    if (this.validationPromise) {
      return this.validationPromise;
    }

    // 创建新的验证进程
    this.validationPromise = this.performUserValidation();
    
    try {
      const result = await this.validationPromise;
      return result;
    } finally {
      this.validationPromise = null;
    }
  }
  
  // 执行用户验证的核心逻辑
  private async performUserValidation(): Promise<User | null> {
    try {
      this.isValidating = true;
      
      // 首先验证 Supabase 会话
      const user = await db.getCurrentUser();
      
      if (user && user.id) {
        // 会话有效，更新用户信息
        this.currentUser = user;
        this.isInitialized = true;
        
        const userToStore = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          balance: user.balance
        };
        
        localStorage.setItem('currentUser', JSON.stringify(userToStore));
        
        console.log('Valid Supabase session found, user authenticated:', user.id);
        return user;
      } else {
        // 会话无效，立即清除所有用户状态
        console.log('No valid Supabase session, clearing user state');
        this.clearUserState();
        return null;
      }
    } catch (error) {
      console.warn('Failed to get user from Supabase:', error);
      // 任何错误都清除用户状态
      this.clearUserState();
      return null;
    } finally {
      this.isValidating = false;
    }
  }
  
  // 清除用户状态的统一方法
  private clearUserState(): void {
    this.currentUser = null;
    this.isInitialized = true;
    localStorage.removeItem('currentUser');
    
    // 触发认证状态变更事件
    window.dispatchEvent(new CustomEvent('auth-state-changed', { 
      detail: { user: null } 
    }));
  }
  
  // 同步版本 - 严格模式，优先使用缓存但会触发后台验证
  getCurrentUserSync(): User | null {
    // 如果正在验证中，返回当前缓存的用户
    if (this.isValidating) {
      return this.currentUser;
    }
    
    // 如果还没有初始化
    if (!this.isInitialized) {
      // 尝试从本地存储恢复，但立即触发验证
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        try {
          const storedUser = JSON.parse(stored);
          if (storedUser && storedUser.id) {
            this.currentUser = storedUser;
            
            // 立即在后台验证会话有效性
            this.validateSessionQuietly();
            
            return storedUser;
          }
        } catch (error) {
          console.warn('Failed to parse stored user data:', error);
          localStorage.removeItem('currentUser');
        }
      }
      
      this.isInitialized = true;
      return null;
    }
    
    // 如果已初始化，返回当前用户
    return this.currentUser;
  }

  // 静默验证会话
  private async validateSessionQuietly(): Promise<void> {
    if (this.isValidating || this.validationPromise) return;
    
    try {
      this.isValidating = true;
      const user = await db.getCurrentUser();
      
      if (!user && this.currentUser) {
        // 会话已失效，立即清除用户状态
        console.log('Session validation failed, clearing user state');
        this.clearUserState();
      } else if (user && user.id && this.currentUser) {
        // 更新用户信息
        this.currentUser = {
          ...this.currentUser,
          ...user
        };
        
        const userToStore = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          balance: user.balance
        };
        
        localStorage.setItem('currentUser', JSON.stringify(userToStore));
      } else if (!user && !this.currentUser) {
        // 都为空，确保状态一致
        this.clearUserState();
      }
    } catch (error) {
      console.warn('Session validation failed:', error);
      if (this.currentUser) {
        this.clearUserState();
      }
    } finally {
      this.isValidating = false;
    }
  }
  
  // Check if user is authenticated
  isAuthenticated(): boolean {
    const user = this.getCurrentUserSync();
    return user !== null && user.id !== undefined && user.id !== null && user.id !== '';
  }
  
  // Initialize auth state - 严格验证版本
  async initializeAuth(): Promise<User | null> {
    try {
      console.log('Initializing auth state...');
      
      // 首先清除可能的残留状态
      this.isInitialized = false;
      this.currentUser = null;
      
      // 不依赖本地缓存，直接进行服务器验证
      const user = await this.getCurrentUser();
      
      if (user && user.id) {
        console.log('Auth initialization successful, user found:', user.id);
        return user;
      } else {
        console.log('Auth initialization complete, no user found');
        this.clearUserState();
        return null;
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      this.clearUserState();
      return null;
    }
  }
  
  // Logout - 增强版本
  async logout(): Promise<void> {
    console.log('Starting logout process...');
    
    try {
      // 首先清除本地状态
      this.forceLogout();
      
      // 然后尝试服务器端退出
      await db.signOut();
      console.log('Server logout successful');
    } catch (error) {
      console.warn('Error during server logout:', error);
      // 即使服务器退出失败，本地状态已清除
    }
    
    // 确保页面状态重置
    setTimeout(() => {
      if (window.location.pathname !== '/auth/login') {
        window.location.href = '/auth/login';
      }
    }, 100);
  }
  
  // 强制清除所有认证状态
  forceLogout(): void {
    console.log('Force logout - clearing all auth state');
    
    // 停止任何正在进行的验证
    this.isValidating = false;
    this.validationPromise = null;
    this.currentUser = null;
    this.isInitialized = true;
    
    // 清除所有可能的存储
    try {
      localStorage.removeItem('currentUser');
      sessionStorage.removeItem('currentUser');
      
      // 清除 Supabase 认证令牌
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
        if (projectRef) {
          localStorage.removeItem(`sb-${projectRef}-auth-token`);
          sessionStorage.removeItem(`sb-${projectRef}-auth-token`);
        }
      }
      
      // 清除所有以 sb- 开头的键（Supabase 相关）
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
    } catch (error) {
      console.warn('Failed to clear auth tokens:', error);
    }
    
    // 触发认证状态变更事件
    window.dispatchEvent(new CustomEvent('auth-state-changed', { 
      detail: { user: null } 
    }));
  }
  
  // Update user balance
  async updateBalance(amount: number): Promise<number> {
    const user = await this.getCurrentUser();
    if (!user || !user.id) {
      throw new Error('No authenticated user found');
    }
    
    try {
      const newBalance = await db.updateUserBalance(user.id, amount);
      
      if (this.currentUser) {
        this.currentUser.balance = newBalance;
        
        const userToStore = {
          id: this.currentUser.id,
          name: this.currentUser.name,
          email: this.currentUser.email,
          role: this.currentUser.role,
          balance: newBalance
        };
        
        localStorage.setItem('currentUser', JSON.stringify(userToStore));
      }
      
      return newBalance;
    } catch (error) {
      console.warn('Failed to update balance:', error);
      throw error;
    }
  }
  
  // Get user by ID
  async getUserById(userId: string): Promise<User | null> {
    if (!userId) {
      console.warn('getUserById called with empty userId');
      return null;
    }
    
    try {
      return await db.getUserById(userId);
    } catch (error) {
      console.warn('Failed to get user by ID:', error);
      return null;
    }
  }
  
  // 安全的服务调用包装器
  async safeServiceCall<T>(
    serviceCall: (userId: string) => Promise<T>,
    defaultValue: T
  ): Promise<T> {
    try {
      const user = await this.getCurrentUser();
      if (!user || !user.id) {
        console.warn('Service call attempted without valid user');
        this.forceLogout();
        return defaultValue;
      }
      
      return await serviceCall(user.id);
    } catch (error) {
      console.warn('Service call failed:', error);
      return defaultValue;
    }
  }
}

export const authService = new AuthService();

// 页面加载时初始化认证状态
let initPromise: Promise<void> | null = null;

export async function initializeAuthOnLoad(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }
  
  initPromise = (async () => {
    try {
      console.log('Starting auth initialization on page load...');
      await authService.initializeAuth();
      console.log('Auth initialization completed');
    } catch (error) {
      console.error('Auth initialization failed:', error);
      authService.forceLogout();
    }
  })();
  
  return initPromise;
}

// 开发环境调试方法
if (import.meta.env.DEV) {
  (window as any).authService = authService;
  (window as any).forceLogout = () => {
    authService.forceLogout();
    window.location.reload();
  };
  (window as any).checkAuth = async () => {
    const user = await authService.getCurrentUser();
    console.log('Current user:', user);
    console.log('Is authenticated:', authService.isAuthenticated());
  };
}
