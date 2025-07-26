import { db } from './supabase';
import { User } from '@/types';

class AuthService {
  private currentUser: User | null = null;
  private isInitialized = false;
  private isValidating = false;

  // Get current user synchronously (from memory)
  getCurrentUserSync(): User | null {
    return this.currentUser;
  }

  // Get current user asynchronously (with validation)
  async getCurrentUser(): Promise<User | null> {
    // 如果还没初始化，先初始化
    if (!this.isInitialized) {
      return await this.initializeAuth();
    }

    // 如果有缓存的用户，先返回，然后静默验证
    if (this.currentUser) {
      // 静默验证会话（不阻塞返回）
      this.validateSessionQuietly();
      return this.currentUser;
    }

    // 没有缓存用户，进行完整验证
    try {
      const user = await db.getCurrentUser();
      
      if (user && user.id) {
        this.currentUser = user;
        this.isInitialized = true;
        
        // 缓存用户信息
        const userToStore = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          balance: user.balance
        };
        
        localStorage.setItem('currentUser', JSON.stringify(userToStore));
        return user;
      } else {
        console.log('No valid Supabase session, clearing user state');
        this.clearUserState();
        return null;
      }
    } catch (error) {
      console.error('Error getting current user from auth:', error);
      console.log('No valid Supabase session, clearing user state');
      this.clearUserState();
      return null;
    }
  }

  private clearUserState(): void {
    this.currentUser = null;
    this.isInitialized = true; // 标记为已初始化，避免重复检查
    
    try {
      localStorage.removeItem('currentUser');
      
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
      console.warn('Failed to clear user state:', error);
    }
  }

  // Login
  async login(email: string, password: string): Promise<User | null> {
    try {
      const user = await db.signIn(email, password);
      
      if (user && user.id) {
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
        
        // 触发认证状态变更事件
        window.dispatchEvent(new CustomEvent('auth-state-changed', { 
          detail: { user } 
        }));
        
        return user;
      }
      
      return null;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  // Register
  async register(email: string, password: string, name: string): Promise<User | null> {
    try {
      const user = await db.signUp(email, password, name);
      
      if (user && user.id) {
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
        
        // 触发认证状态变更事件
        window.dispatchEvent(new CustomEvent('auth-state-changed', { 
          detail: { user } 
        }));
        
        return user;
      }
      
      return null;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
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
        this.clearUserState();
        // 触发认证状态变更事件
        window.dispatchEvent(new CustomEvent('auth-state-changed', { 
          detail: { user: null } 
        }));
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
        // 触发认证状态变更事件
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
    return this.currentUser !== null && this.currentUser.id !== undefined && this.currentUser.id !== null && this.currentUser.id !== '';
  }
  
  // Initialize auth state - 只在应用启动时调用一次
  async initializeAuth(): Promise<User | null> {
    // 如果已经初始化过，直接返回当前用户
    if (this.isInitialized) {
      return this.currentUser;
    }

    try {
      console.log('Initializing auth state...');
      
      // Check if we're in test mode
      const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
      if (isTestMode) {
        console.log('Test mode enabled - using mock admin user');
        this.currentUser = {
          id: 'admin-user-123',
          name: 'Admin User',
          email: 'lobos54321@gmail.com',
          role: 'admin',
          avatarUrl: null,
          balance: 100,
          createdAt: new Date().toISOString(),
        };
        this.isInitialized = true;
        return this.currentUser;
      }
      
      // Check if we want to test non-admin user
      const isNonAdminTest = import.meta.env.VITE_NON_ADMIN_TEST === 'true';
      if (isNonAdminTest) {
        console.log('Non-admin test mode enabled - using mock regular user');
        this.currentUser = {
          id: 'user-123',
          name: 'Regular User',
          email: 'user@example.com',
          role: 'user',
          avatarUrl: null,
          balance: 50,
          createdAt: new Date().toISOString(),
        };
        this.isInitialized = true;
        return this.currentUser;
      }
      
      // 首先尝试从本地存储恢复用户信息
      try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser && parsedUser.id) {
            this.currentUser = parsedUser;
            // 标记为已初始化，但稍后会静默验证
            this.isInitialized = true;
            
            // 静默验证会话（不阻塞初始化）
            this.validateSessionQuietly();
            
            console.log('Auth initialization successful, user restored from cache:', parsedUser.id);
            return this.currentUser;
          }
        }
      } catch (error) {
        console.warn('Failed to parse stored user data:', error);
        localStorage.removeItem('currentUser');
      }
      
      // 如果没有缓存用户，尝试从服务器获取
      const user = await db.getCurrentUser();
      
      if (user && user.id) {
        this.currentUser = user;
        
        const userToStore = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          balance: user.balance
        };
        
        localStorage.setItem('currentUser', JSON.stringify(userToStore));
        console.log('Auth initialization successful, user found:', user.id);
      } else {
        console.log('Auth initialization complete, no user found');
        this.clearUserState();
      }
      
      this.isInitialized = true;
      return this.currentUser;
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      this.clearUserState();
      return null;
    }
  }
  
  // Logout - 修复路由跳转问题
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
    
    // 确保页面状态重置 - 修复：跳转到正确的路径
    setTimeout(() => {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }, 100);
  }
  
  // 强制清除所有认证状态
  forceLogout(): void {
    console.log('Force logout - clearing all auth state');
    
    // 停止任何正在进行的验证
    this.isValidating = false;
    
    // 清除用户状态
    this.clearUserState();
    
    // 清除localStorage中的认证相关数据
    try {
      localStorage.removeItem('currentUser');
      
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

  // Reset password
  async resetPassword(email: string): Promise<void> {
    try {
      await db.resetPassword(email);
      console.log('Password reset email sent successfully');
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw error;
    }
  }
  
  // Update user balance
  async updateBalance(amount: number): Promise<number> {
    const user = this.getCurrentUserSync();
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
      const user = this.getCurrentUserSync();
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

// 开发环境调试方法
if (import.meta.env.DEV) {
  (window as Record<string, unknown>).authService = authService;
  (window as Record<string, unknown>).forceLogout = () => {
    authService.forceLogout();
    window.location.reload();
  };
  (window as Record<string, unknown>).checkAuth = async () => {
    const user = authService.getCurrentUserSync();
    console.log('Current user:', user);
    console.log('Is authenticated:', authService.isAuthenticated());
  };
}
