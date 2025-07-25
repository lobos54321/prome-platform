import { User } from '@/types';
import { db } from './supabase';

// Authentication service using Supabase
class AuthService {
  private currentUser: User | null = null;
  private isInitialized: boolean = false;
  private isValidating: boolean = false;
  
  // Login with email and password
  async login(email: string, password: string): Promise<User> {
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
    
    return user;
  }
  
  // Register new user
  async register(name: string, email: string, password: string): Promise<User> {
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
    
    return user;
  }
  
  // 异步获取当前用户 - 严格验证版本
  async getCurrentUser(): Promise<User | null> {
    if (this.isValidating) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.currentUser;
    }

    try {
      this.isValidating = true;
      
      // 首先验证 Supabase 会话
      const user = await db.getCurrentUser();
      
      if (user) {
        // 会话有效，更新用户信息
        this.currentUser = user;
        this.isInitialized = true;
        localStorage.setItem('currentUser', JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          balance: user.balance
        }));
        return user;
      } else {
        // 会话无效，立即清除所有用户状态
        console.log('No valid Supabase session, clearing user state');
        this.currentUser = null;
        this.isInitialized = true;
        localStorage.removeItem('currentUser');
        return null;
      }
    } catch (error) {
      console.warn('Failed to get user from Supabase:', error);
      // 任何错误都清除用户状态
      this.currentUser = null;
      this.isInitialized = true;
      localStorage.removeItem('currentUser');
      return null;
    } finally {
      this.isValidating = false;
    }
  }
  
  // 同步版本 - 严格模式，不依赖 localStorage
  getCurrentUserSync(): User | null {
    // 如果还没有初始化，先不返回任何用户
    if (!this.isInitialized) {
      // 在无痕模式下，localStorage 应该是空的
      // 如果有数据，可能是之前会话的残留
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        try {
          const storedUser = JSON.parse(stored);
          this.currentUser = storedUser;
          
          // 立即验证会话有效性
          this.validateSessionQuietly();
          
          return storedUser;
        } catch (error) {
          console.warn('Failed to parse stored user data:', error);
          localStorage.removeItem('currentUser');
        }
      }
      this.isInitialized = true;
    }
    
    return this.currentUser;
  }

  // 静默验证会话
  private async validateSessionQuietly(): Promise<void> {
    if (this.isValidating) return;
    
    try {
      this.isValidating = true;
      const user = await db.getCurrentUser();
      
      if (!user && this.currentUser) {
        // 会话已失效，立即清除用户状态
        console.log('Session validation failed, clearing user state');
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        
        // 触发页面重新渲染
        window.dispatchEvent(new CustomEvent('auth-state-changed', { 
          detail: { user: null } 
        }));
      } else if (user && this.currentUser) {
        // 更新用户信息
        this.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          balance: user.balance
        }));
      }
    } catch (error) {
      console.warn('Session validation failed:', error);
      if (this.currentUser) {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        
        window.dispatchEvent(new CustomEvent('auth-state-changed', { 
          detail: { user: null } 
        }));
      }
    } finally {
      this.isValidating = false;
    }
  }
  
  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getCurrentUserSync() !== null;
  }
  
  // Initialize auth state - 严格验证版本
  async initializeAuth(): Promise<User | null> {
    try {
      // 不依赖本地缓存，直接进行服务器验证
      const user = await this.getCurrentUser();
      return user;
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      this.currentUser = null;
      this.isInitialized = true;
      localStorage.removeItem('currentUser');
      return null;
    }
  }
  
  // Logout
  async logout(): Promise<void> {
    try {
      await db.signOut();
    } catch (error) {
      console.warn('Error during logout:', error);
    }
    
    this.currentUser = null;
    this.isInitialized = true;
    localStorage.removeItem('currentUser');
    
    window.dispatchEvent(new CustomEvent('auth-state-changed', { 
      detail: { user: null } 
    }));
  }
  
  // 强制清除所有认证状态
  forceLogout(): void {
    console.log('Force logout - clearing all auth state');
    this.currentUser = null;
    this.isInitialized = true;
    
    // 清除所有可能的存储
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    
    // 清除 Supabase 认证令牌
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
        if (projectRef) {
          localStorage.removeItem(`sb-${projectRef}-auth-token`);
          sessionStorage.removeItem(`sb-${projectRef}-auth-token`);
        }
      }
    } catch (error) {
      console.warn('Failed to clear Supabase auth tokens:', error);
    }
    
    window.dispatchEvent(new CustomEvent('auth-state-changed', { 
      detail: { user: null } 
    }));
  }
  
  // Update user balance
  async updateBalance(amount: number): Promise<number> {
    const user = this.getCurrentUserSync();
    if (!user) {
      throw new Error('No user is logged in');
    }
    
    try {
      const newBalance = await db.updateUserBalance(user.id, amount);
      
      if (this.currentUser) {
        this.currentUser.balance = newBalance;
        localStorage.setItem('currentUser', JSON.stringify({
          id: this.currentUser.id,
          name: this.currentUser.name,
          email: this.currentUser.email,
          role: this.currentUser.role,
          balance: newBalance
        }));
      }
      
      return newBalance;
    } catch (error) {
      console.warn('Failed to update balance:', error);
      return amount;
    }
  }
  
  // Get user by ID
  async getUserById(userId: string): Promise<User | null> {
    return await db.getUserById(userId);
  }
}

export const authService = new AuthService();

// 开发环境调试方法
if (import.meta.env.DEV) {
  (window as any).authService = authService;
  (window as any).forceLogout = () => {
    authService.forceLogout();
    window.location.reload();
  };
}
