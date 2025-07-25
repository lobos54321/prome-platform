import { User } from '@/types';
import { db } from './supabase';

// Authentication service using Supabase
class AuthService {
  private currentUser: User | null = null;
  
  // Login with email and password
  async login(email: string, password: string): Promise<User> {
    const user = await db.signIn(email, password);
    
    if (!user) {
      throw new Error('Login failed. Please check your credentials.');
    }
    
    this.currentUser = user;
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
    
    // 重要：注册后立即设置当前用户，不等待数据库查询
    this.currentUser = user;
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
  
  // Get current user - 改进版本，优先使用内存中的用户
  async getCurrentUser(): Promise<User | null> {
    // 如果内存中有用户且在10分钟内设置过，直接返回
    if (this.currentUser) {
      return this.currentUser;
    }

    // 尝试从 localStorage 获取基本信息
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        const storedUser = JSON.parse(stored);
        // 如果有存储的用户信息，先使用它，然后异步更新
        this.currentUser = storedUser;
        
        // 异步尝试从 Supabase 获取最新信息
        this.refreshUserAsync().catch(err => {
          console.warn('Failed to refresh user data:', err);
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
    localStorage.removeItem('currentUser');
    return null;
  }

  // 异步刷新用户数据
  private async refreshUserAsync(): Promise<void> {
    try {
      const user = await db.getCurrentUser();
      if (user && this.currentUser) {
        // 更新内存中的用户数据
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
      // 静默失败，不影响用户体验
      console.warn('Background user refresh failed:', error);
    }
  }
  
  // Synchronous version - 优先返回内存或 localStorage 中的用户
  getCurrentUserSync(): User | null {
    // 优先返回内存中的用户
    if (this.currentUser) {
      return this.currentUser;
    }
    
    // 尝试从 localStorage 获取
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        const storedUser = JSON.parse(stored);
        this.currentUser = storedUser;
        return storedUser;
      }
    } catch (error) {
      console.warn('Failed to parse stored user data:', error);
      localStorage.removeItem('currentUser');
    }
    
    return null;
  }
  
  // Check if user is authenticated (synchronous)
  isAuthenticated(): boolean {
    return this.getCurrentUserSync() !== null;
  }
  
  // Initialize auth state on app startup
  async initializeAuth(): Promise<User | null> {
    try {
      // 先尝试从本地获取用户信息快速显示
      const localUser = this.getCurrentUserSync();
      if (localUser) {
        // 异步验证会话有效性
        setTimeout(() => {
          this.getCurrentUser().catch(err => {
            console.warn('Session validation failed:', err);
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
    localStorage.removeItem('currentUser');
  }
  
  // Update user balance
  async updateBalance(amount: number): Promise<number> {
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('No user is logged in');
    }
    
    try {
      const newBalance = await db.updateUserBalance(user.id, amount);
      
      // Update current user in memory
      if (this.currentUser) {
        this.currentUser.balance = newBalance;
        // Update localStorage
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
