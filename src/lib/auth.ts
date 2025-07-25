import { User } from '@/types';
import { db } from './supabase';

// Authentication service using Supabase
class AuthService {
  private currentUser: User | null = null;
  private isInitialized: boolean = false;
  
  // Login with email and password
  async login(email: string, password: string): Promise<User> {
    const user = await db.signIn(email, password);
    
    if (!user) {
      throw new Error('Login failed. Please check your credentials.');
    }
    
    this.currentUser = user;
    this.isInitialized = true;
    
    // Store minimal user info in localStorage for UI state persistence
    localStorage.setItem('currentUser', JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      balance: user.balance
    }));
    
    return user;
  }
  
  // Register new user - 修复版本
  async register(name: string, email: string, password: string): Promise<User> {
    const user = await db.signUp(email, password, name);
    
    if (!user) {
      throw new Error('Registration failed. Please try again later.');
    }
    
    // 重要：注册后立即设置当前用户
    this.currentUser = user;
    this.isInitialized = true;
    
    // Store minimal user info in localStorage for UI state persistence
    localStorage.setItem('currentUser', JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      balance: user.balance
    }));
    
    return user;
  }
  
  // 异步获取当前用户 - 从服务器验证
  async getCurrentUser(): Promise<User | null> {
    // 如果已经有用户且在短时间内验证过，直接返回
    if (this.currentUser && this.isInitialized) {
      return this.currentUser;
    }

    // 尝试从 localStorage 恢复用户状态
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        const storedUser = JSON.parse(stored);
        this.currentUser = storedUser;
        this.isInitialized = true;
        
        // 异步验证服务器会话，但不阻塞返回
        this.validateSessionAsync().catch(err => {
          console.warn('Session validation failed:', err);
          // 如果验证失败，清除用户状态
          this.currentUser = null;
          this.isInitialized = false;
          localStorage.removeItem('currentUser');
        });
        
        return storedUser;
      }
    } catch (error) {
      console.warn('Failed to parse stored user data:', error);
      localStorage.removeItem('currentUser');
    }

    // 最后尝试从 Supabase 获取
    try {
      const user = await db.getCurrentUser();
      if (user) {
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
    } catch (error) {
      console.warn('Failed to get user from Supabase:', error);
    }
    
    // 清除无效数据
    this.currentUser = null;
    this.isInitialized = true; // 标记已初始化，避免重复查询
    localStorage.removeItem('currentUser');
    return null;
  }

  // 异步验证会话有效性
  private async validateSessionAsync(): Promise<void> {
    try {
      const user = await db.getCurrentUser();
      if (user && this.currentUser) {
        // 更新用户数据
        this.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          balance: user.balance
        }));
      } else if (!user && this.currentUser) {
        // 服务器会话已失效
        this.currentUser = null;
        localStorage.removeItem('currentUser');
      }
    } catch (error) {
      // 验证失败，清除本地状态
      if (this.currentUser) {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
      }
      throw error;
    }
  }
  
  // 同步版本 - 立即返回缓存的用户，不进行网络请求
  getCurrentUserSync(): User | null {
    // 如果还没有初始化，尝试从 localStorage 恢复
    if (!this.isInitialized) {
      try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
          const storedUser = JSON.parse(stored);
          this.currentUser = storedUser;
          this.isInitialized = true;
          return storedUser;
        }
      } catch (error) {
        console.warn('Failed to parse stored user data:', error);
        localStorage.removeItem('currentUser');
      }
      this.isInitialized = true;
    }
    
    return this.currentUser;
  }
  
  // Check if user is authenticated (synchronous)
  isAuthenticated(): boolean {
    return this.getCurrentUserSync() !== null;
  }
  
  // Initialize auth state on app startup
  async initializeAuth(): Promise<User | null> {
    try {
      // 优先使用本地缓存的用户信息，快速初始化界面
      const localUser = this.getCurrentUserSync();
      if (localUser) {
        // 异步验证会话，不阻塞界面
        setTimeout(() => {
          this.getCurrentUser().catch(err => {
            console.warn('Background session validation failed:', err);
          });
        }, 100);
        return localUser;
      }
      
      // 如果没有本地数据，从服务器获取
      const user = await this.getCurrentUser();
      return user;
    } catch (error) {
      console.error('Failed to initialize auth:', error);
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
    this.isInitialized = true; // 保持初始化状态，但清除用户
    localStorage.removeItem('currentUser');
  }
  
  // Update user balance
  async updateBalance(amount: number): Promise<number> {
    const user = this.getCurrentUserSync(); // 使用同步版本
    if (!user) {
      throw new Error('No user is logged in');
    }
    
    try {
      const newBalance = await db.updateUserBalance(user.id, amount);
      
      // Update current user in memory
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
      console.warn('Failed to update balance in database, updating locally:', error);
      // 如果数据库更新失败，至少在本地更新
      if (this.currentUser) {
        this.currentUser.balance = amount;
        localStorage.setItem('currentUser', JSON.stringify({
          id: this.currentUser.id,
          name: this.currentUser.name,
          email: this.currentUser.email,
          role: this.currentUser.role,
          balance: amount
        }));
      }
      return amount;
    }
  }
  
  // Get user by ID - useful for admin functions or webhook processing
  async getUserById(userId: string): Promise<User | null> {
    return await db.getUserById(userId);
  }
}

export const authService = new AuthService();
