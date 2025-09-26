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
      
      if (user && user.id && typeof user.id === 'string' && user.id.trim() !== '') {
        this.currentUser = user;
        this.isInitialized = true;
        
        try {
          const userToStore = {
            id: user.id,
            name: user.name || 'User',
            email: user.email || email,
            role: user.role || 'user',
            balance: typeof user.balance === 'number' ? user.balance : 0
          };
          
          localStorage.setItem('currentUser', JSON.stringify(userToStore));
        } catch (storageError) {
          console.warn('Failed to store user data in localStorage:', storageError);
        }
        
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
      
      if (user && user.id && typeof user.id === 'string' && user.id.trim() !== '') {
        this.currentUser = user;
        this.isInitialized = true;
        
        try {
          const userToStore = {
            id: user.id,
            name: user.name || name || 'User',
            email: user.email || email,
            role: user.role || 'user',
            balance: typeof user.balance === 'number' ? user.balance : 0
          };
          
          localStorage.setItem('currentUser', JSON.stringify(userToStore));
        } catch (storageError) {
          console.warn('Failed to store user data in localStorage:', storageError);
        }
        
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
      
      // 在测试模式下跳过验证
      const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
      const isNonAdminTest = import.meta.env.VITE_NON_ADMIN_TEST === 'true';
      const isProblematicUserTest = import.meta.env.VITE_PROBLEMATIC_USER_TEST === 'true';
      
      if (isTestMode || isNonAdminTest || isProblematicUserTest) {
        console.log('Test mode enabled - skipping session validation');
        return;
      }
      
      const user = await db.getCurrentUser();
      
      if (!user && this.currentUser) {
        // 增加更严格的验证条件，避免误清除状态
        console.log('Session validation detected no server user, checking auth state...');
        
        // 检查是否是网络错误或临时问题，而不是真正的认证失败
        // 如果本地有用户信息且最近更新过，给一定容错时间
        const storedUser = localStorage.getItem('currentUser');
        const shouldClearState = !storedUser || 
          (this.currentUser && !this.currentUser.id) ||
          (this.currentUser && typeof this.currentUser.id !== 'string') ||
          (this.currentUser && this.currentUser.id.trim() === '');
        
        if (shouldClearState) {
          console.log('Session validation failed, clearing user state');
          this.clearUserState();
          // 触发认证状态变更事件
          window.dispatchEvent(new CustomEvent('auth-state-changed', { 
            detail: { user: null } 
          }));
        } else {
          console.log('Session validation inconclusive, retaining user state temporarily');
        }
      } else if (user && user.id && typeof user.id === 'string' && user.id.trim() !== '' && this.currentUser) {
        // 更新用户信息 - 确保所有必需的属性都存在
        this.currentUser = {
          ...this.currentUser,
          ...user,
          id: user.id,
          name: user.name || this.currentUser.name || 'User',
          email: user.email || this.currentUser.email || '',
          role: user.role || this.currentUser.role || 'user',
          balance: typeof user.balance === 'number' ? user.balance : (this.currentUser.balance || 0)
        };
        
        try {
          const userToStore = {
            id: this.currentUser.id,
            name: this.currentUser.name,
            email: this.currentUser.email,
            role: this.currentUser.role,
            balance: this.currentUser.balance
          };
          
          localStorage.setItem('currentUser', JSON.stringify(userToStore));
        } catch (storageError) {
          console.warn('Failed to update localStorage during session validation:', storageError);
        }
      } else if (!user && !this.currentUser) {
        // 都为空，确保状态一致
        this.clearUserState();
      }
    } catch (error) {
      console.warn('Session validation encountered error:', error);
      // 只有在明确的认证错误时才清除状态，网络错误等不清除
      if (error instanceof Error && 
          (error.message.includes('unauthorized') || 
           error.message.includes('invalid') ||
           error.message.includes('expired'))) {
        console.log('Detected auth-related error, clearing user state');
        if (this.currentUser) {
          this.clearUserState();
          // 触发认证状态变更事件
          window.dispatchEvent(new CustomEvent('auth-state-changed', { 
            detail: { user: null } 
          }));
        }
      } else {
        console.log('Network or other error during validation, retaining current state');
      }
    } finally {
      this.isValidating = false;
    }
  }
  
  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.currentUser !== null && 
           this.currentUser !== undefined && 
           this.currentUser.id !== undefined && 
           this.currentUser.id !== null && 
           typeof this.currentUser.id === 'string' && 
           this.currentUser.id.trim() !== '';
  }
  
  // Initialize auth state - 只在应用启动时调用一次
  async initializeAuth(): Promise<User | null> {
    // 如果已经初始化过，直接返回当前用户
    if (this.isInitialized) {
      return this.currentUser;
    }

    try {
      console.log('Initializing auth state...');
      
      // Check if we want to test the specific problematic user ID from the issue
      const isProblematicUserTest = import.meta.env.VITE_PROBLEMATIC_USER_TEST === 'true';
      if (isProblematicUserTest) {
        console.log('Problematic user test mode enabled - using specific user ID from issue');
        this.currentUser = {
          id: '9dee4891-89a6-44ee-8fe8-69097846e97d',
          name: 'User',
          email: 'user@example.com',
          role: 'user',
          avatarUrl: null,
          balance: 1000, // The balance mentioned in the problem statement
          createdAt: new Date().toISOString(),
        };
        this.isInitialized = true;
        return this.currentUser;
      }
      
      // Check if we want to test non-admin user first
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

      // Production mode: attempt real authentication with enhanced session recovery
      await this.attemptSessionRecovery();
      
      this.isInitialized = true;
      return this.currentUser;
    } catch (error) {
      console.warn('Auth initialization encountered error:', error);
      // Don't throw - just mark as initialized with no user
      this.clearUserState();
      return null;
    }
  }

  // Enhanced session recovery for production use
  private async attemptSessionRecovery(): Promise<void> {
    console.log('Attempting session recovery in production mode...');
    
    try {
      // First, try to restore from localStorage with validation
      const localUser = this.tryRestoreFromLocalStorage();
      if (localUser) {
        this.currentUser = localUser;
        console.log('User restored from localStorage:', localUser.id);
        
        // Validate session in background without blocking UI
        this.validateAndRefreshSession();
        return;
      }

      // If no local user, attempt fresh authentication from server
      const serverUser = await this.tryServerSessionRecovery();
      if (serverUser) {
        this.currentUser = serverUser;
        this.storeUserLocally(serverUser);
        console.log('User session recovered from server:', serverUser.id);
        return;
      }

      // No valid session found
      console.log('No valid session found during recovery');
      this.clearUserState();
      
    } catch (error) {
      console.warn('Session recovery failed:', error);
      this.clearUserState();
    }
  }

  private tryRestoreFromLocalStorage(): User | null {
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (!storedUser) return null;

      const parsedUser = JSON.parse(storedUser);
      if (!this.isValidUserObject(parsedUser)) {
        console.warn('Invalid stored user data, clearing cache');
        localStorage.removeItem('currentUser');
        return null;
      }

      return parsedUser;
    } catch (error) {
      console.warn('Failed to parse stored user data:', error);
      localStorage.removeItem('currentUser');
      return null;
    }
  }

  private async tryServerSessionRecovery(): Promise<User | null> {
    try {
      console.log('Attempting server session recovery...');
      const user = await db.getCurrentUser();
      
      if (user && this.isValidUserObject(user)) {
        return user;
      }
      
      return null;
    } catch (error) {
      console.warn('Server session recovery failed:', error);
      return null;
    }
  }

  private isValidUserObject(user: unknown): user is User {
    return user && 
           typeof user === 'object' &&
           typeof user.id === 'string' && 
           user.id.trim() !== '' &&
           typeof user.email === 'string' &&
           typeof user.name === 'string' &&
           typeof user.role === 'string';
  }

  private storeUserLocally(user: User): void {
    try {
      const userToStore = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        balance: user.balance
      };
      localStorage.setItem('currentUser', JSON.stringify(userToStore));
    } catch (error) {
      console.warn('Failed to store user locally:', error);
    }
  }

  private async validateAndRefreshSession(): Promise<void> {
    // Run validation in background without affecting UI
    setTimeout(async () => {
      try {
        const freshUser = await db.getCurrentUser();
        if (freshUser && this.currentUser && freshUser.id === this.currentUser.id) {
          // Update user data if needed
          if (freshUser.balance !== this.currentUser.balance) {
            this.currentUser.balance = freshUser.balance;
            this.storeUserLocally(this.currentUser);
            
            // Trigger balance update event
            window.dispatchEvent(new CustomEvent('balance-updated', { 
              detail: { balance: freshUser.balance } 
            }));
          }
        } else if (!freshUser && this.currentUser) {
          // Session expired
          console.log('Session expired during background validation');
          this.clearUserState();
          window.dispatchEvent(new CustomEvent('auth-state-changed', { 
            detail: { user: null } 
          }));
        }
      } catch (error) {
        console.warn('Background session validation failed:', error);
        // Don't clear user state on network errors
      }
    }, 2000); // Wait 2 seconds before validating
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
  
  // Update user balance
  async updateBalance(amount: number): Promise<number> {
    const user = this.getCurrentUserSync();
    if (!user || !user.id || typeof user.id !== 'string' || user.id.trim() === '') {
      throw new Error('No authenticated user found');
    }
    
    try {
      const newBalance = await db.updateUserBalance(user.id, amount);
      
      if (this.currentUser && this.currentUser.id === user.id) {
        this.currentUser.balance = newBalance;
        
        try {
          const userToStore = {
            id: this.currentUser.id,
            name: this.currentUser.name,
            email: this.currentUser.email,
            role: this.currentUser.role,
            balance: newBalance
          };
          
          localStorage.setItem('currentUser', JSON.stringify(userToStore));
        } catch (storageError) {
          console.warn('Failed to update localStorage after balance update:', storageError);
        }
        
        // Trigger balance update event
        window.dispatchEvent(new CustomEvent('balance-updated', { 
          detail: { balance: newBalance } 
        }));
      }
      
      return newBalance;
    } catch (error) {
      console.warn('Failed to update balance:', error);
      throw error;
    }
  }

  // Force refresh user balance from database
  async refreshBalance(): Promise<number> {
    const user = this.getCurrentUserSync();
    if (!user || !user.id || typeof user.id !== 'string' || user.id.trim() === '') {
      throw new Error('No authenticated user found');
    }
    
    try {
      console.log('Refreshing balance from database for user:', user.id);
      
      // Get fresh user data from database
      const freshUser = await db.getUserById(user.id);
      if (!freshUser) {
        console.warn('User not found in database during balance refresh');
        return this.currentUser?.balance || 0;
      }
      
      const newBalance = typeof freshUser.balance === 'number' ? freshUser.balance : 0;
      
      // Update current user balance
      if (this.currentUser && this.currentUser.id === user.id) {
        this.currentUser.balance = newBalance;
        
        try {
          const userToStore = {
            id: this.currentUser.id,
            name: this.currentUser.name,
            email: this.currentUser.email,
            role: this.currentUser.role,
            balance: newBalance
          };
          
          localStorage.setItem('currentUser', JSON.stringify(userToStore));
          console.log('Balance refreshed successfully:', newBalance);
        } catch (storageError) {
          console.warn('Failed to update localStorage after balance refresh:', storageError);
        }
        
        // Trigger balance update event
        window.dispatchEvent(new CustomEvent('balance-updated', { 
          detail: { balance: newBalance } 
        }));
      }
      
      return newBalance;
    } catch (error) {
      console.error('Failed to refresh balance:', error);
      return this.currentUser?.balance || 0;
    }
  }
  
  // Get user by ID
  async getUserById(userId: string): Promise<User | null> {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.warn('getUserById called with invalid userId:', userId);
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
      if (!user || !user.id || typeof user.id !== 'string' || user.id.trim() === '') {
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
