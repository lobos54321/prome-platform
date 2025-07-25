import { createClient } from '@supabase/supabase-js';
import { User, Service, TokenUsage, BillingRecord, PricingRule, Script, WebhookPayload } from '@/types';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-supabase-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Create client with fallback mechanism to handle empty or invalid URL
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Check if Supabase is properly configured
const isSupabaseConfigured = 
  import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder-supabase-url.supabase.co' &&
  import.meta.env.VITE_SUPABASE_ANON_KEY !== 'placeholder-anon-key';

// Console log to help debugging
console.log('Supabase configuration status:', isSupabaseConfigured ? 'Configured' : 'Not configured');
console.log('Supabase URL:', supabaseUrl);

// Database service for ProMe application
export class Database {
  // Expose supabase client for other modules
  get supabase() {
    return supabase;
  }

  // 检查表是否存在的方法
  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      // 如果没有错误，表存在
      return !error;
    } catch (error) {
      console.error(`Table ${tableName} check failed:`, error);
      return false;
    }
  }

  // 等待用户配置文件创建的辅助方法 - 改进版
  private async waitForUserProfile(userId: string, maxRetries: number = 5): Promise<User | null> {
    // 首先检查 users 表是否存在
    const tableExists = await this.checkTableExists('users');
    if (!tableExists) {
      console.error('Users table does not exist or is not accessible');
      return null;
    }

    for (let i = 0; i < maxRetries; i++) {
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle(); // 使用 maybeSingle 避免 "more than one row" 错误

        if (!userError && userData) {
          console.log(`User profile found after ${i + 1} attempts:`, userData);
          return {
            id: userData.id,
            name: userData.name,
            email: userData.email,
            role: userData.role,
            avatarUrl: userData.avatar_url,
            balance: userData.balance,
            createdAt: userData.created_at,
          };
        }

        if (userError) {
          console.error(`Database error on attempt ${i + 1}:`, userError);
          // 如果是 500 错误或表不存在，直接跳出循环
          if (userError.message.includes('500') || userError.message.includes('relation') || userError.message.includes('table')) {
            console.error('Database table issue detected, stopping retries');
            break;
          }
        }

        // 较短的等待时间，减少用户等待
        const waitTime = Math.min(2000 * (i + 1), 5000);
        console.log(`User profile not found, retrying in ${waitTime}ms... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } catch (error) {
        console.warn(`Attempt ${i + 1} failed:`, error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    return null;
  }

  // 手动创建用户配置文件的兜底方法 - 改进版
  private async createUserProfileFallback(userId: string, email: string, name: string): Promise<User | null> {
    try {
      console.log('Attempting to create user profile manually as fallback...');
      
      // 先检查表是否存在
      const tableExists = await this.checkTableExists('users');
      if (!tableExists) {
        console.error('Cannot create user profile: users table does not exist');
        return null;
      }

      const { data: userData, error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: email,
          name: name,
          role: 'user',
          balance: 0,
          created_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (insertError) {
        console.error('Manual user profile creation failed:', insertError);
        return null;
      }

      if (!userData) {
        console.error('No data returned from user profile creation');
        return null;
      }

      console.log('User profile created manually:', userData);
      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        avatarUrl: userData.avatar_url,
        balance: userData.balance,
        createdAt: userData.created_at,
      };
    } catch (error) {
      console.error('Error in manual user profile creation:', error);
      return null;
    }
  }

  // 简化版的注册方法 - 只做认证，不依赖 users 表
  async signUp(email: string, password: string, name: string): Promise<User | null> {
    // Return null immediately if not configured
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured - cannot register user');
      return null;
    }

    try {
      console.log('Starting registration process...');
      console.log('Attempting to register user:', email);

      // 第一步：使用 Supabase Auth 注册
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: 'user'
          }
        }
      });
      
      if (authError) {
        console.error('Auth registration error:', authError);
        throw authError;
      }
      
      if (!authData.user) {
        console.error('No user returned from auth signup');
        return null;
      }

      console.log('Auth user created successfully:', authData.user.id);

      // 第二步：尝试创建用户配置文件，但不依赖它成功
      let user: User | null = null;
      
      try {
        // 尝试等待触发器创建用户配置文件
        user = await this.waitForUserProfile(authData.user.id);
        
        // 如果触发器失败，尝试手动创建
        if (!user) {
          console.warn('Trigger failed, attempting manual creation...');
          user = await this.createUserProfileFallback(authData.user.id, email, name);
        }
      } catch (profileError) {
        console.warn('User profile creation failed, but auth user exists:', profileError);
      }

      // 第三步：注册成功后自动登录建立会话
      console.log('Auth registration successful, attempting auto-login...');
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        console.warn('Auto-login failed after registration:', loginError);
        // 即使自动登录失败，也返回成功（用户可以手动登录）
      } else if (loginData.user) {
        console.log('Auto-login successful after registration:', loginData.user.id);
      }

      // 如果没有用户配置文件，创建一个基本的用户对象
      if (!user) {
        console.log('Creating basic user object from auth data');
        user = {
          id: authData.user.id,
          name: name,
          email: email,
          role: 'user',
          avatarUrl: null,
          balance: 0,
          createdAt: new Date().toISOString(),
        };
      }

      console.log('Registration completed successfully:', user);
      return user;

    } catch (error) {
      console.error('Error during registration process:', error);
      throw error;
    }
  }

  async signIn(email: string, password: string): Promise<User | null> {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured - cannot sign in user');
      return null;
    }

    try {
      console.log('Attempting to sign in user:', email);

      // Login with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('Auth login error:', authError);
        throw authError;
      }
      
      if (!authData.user) {
        console.error('No user returned from auth signin');
        return null;
      }

      console.log('Auth login successful:', authData.user.id);

      // 尝试获取用户配置文件，如果失败则创建基本用户对象
      let userData = null;
      try {
        const { data, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (!userError && data) {
          userData = data;
        }
      } catch (error) {
        console.warn('Could not fetch user profile, using auth data:', error);
      }

      // 如果没有找到用户配置文件，使用 auth 数据创建基本用户对象
      if (!userData) {
        console.log('Creating basic user object from auth data');
        return {
          id: authData.user.id,
          name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'User',
          email: authData.user.email || email,
          role: 'user',
          avatarUrl: null,
          balance: 0,
          createdAt: authData.user.created_at || new Date().toISOString(),
        };
      }

      console.log('User profile fetched successfully:', userData);

      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        avatarUrl: userData.avatar_url,
        balance: userData.balance,
        createdAt: userData.created_at,
      };
    } catch (error) {
      console.error('Error signing in:', error);
      return null;
    }
  }

  async signOut(): Promise<void> {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured - cannot sign out');
      return;
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!isSupabaseConfigured) {
      return null;
    }

    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Error getting current user from auth:', error);
        return null;
      }
      
      if (!user) {
        return null;
      }

      // 尝试获取用户配置文件，如果失败则使用 auth 数据
      let userData = null;
      try {
        const { data, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (!userError && data) {
          userData = data;
        }
      } catch (error) {
        console.warn('Could not fetch user profile, using auth data:', error);
      }

      // 如果没有找到用户配置文件，使用 auth 数据
      if (!userData) {
        return {
          id: user.id,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          role: 'user',
          avatarUrl: null,
          balance: 0,
          createdAt: user.created_at || new Date().toISOString(),
        };
      }

      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        avatarUrl: userData.avatar_url,
        balance: userData.balance,
        createdAt: userData.created_at,
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // USER METHODS
  async getUserById(userId: string): Promise<User | null> {
    if (!isSupabaseConfigured) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        avatarUrl: data.avatar_url,
        balance: data.balance,
        createdAt: data.created_at,
      };
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  async updateUserBalance(userId: string, amount: number): Promise<number> {
    if (!isSupabaseConfigured) {
      return 0;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .update({ balance: amount })
        .eq('id', userId)
        .select('balance')
        .maybeSingle();

      if (error) throw error;
      return data?.balance || 0;
    } catch (error) {
      console.error('Error updating user balance:', error);
      return 0;
    }
  }

  // SERVICE METHODS
  async getServices(): Promise<Service[]> {
    if (!isSupabaseConfigured) {
      // Return mock data when not configured
      return [
        {
          id: 'mock-service-1',
          name: '智能写作助手',
          description: '基于AI的内容创作和文案生成服务',
          category: '内容创作',
          price: 0.02,
          priceUnit: 'per token',
          isActive: true,
          features: ['智能文案生成', '多风格适配', 'SEO优化'],
          modelSupported: ['GPT-4', 'GPT-3.5-turbo'],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'mock-service-2',
          name: '代码生成助手',
          description: '智能代码生成和调试服务',
          category: '开发工具',
          price: 0.03,
          priceUnit: 'per token',
          isActive: true,
          features: ['代码生成', '错误检测', '性能优化建议'],
          modelSupported: ['GPT-4', 'Claude-2'],
          createdAt: new Date().toISOString(),
        }
      ];
    }

    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data?.map(service => ({
        id: service.id,
        name: service.name,
        description: service.description,
        category: service.category,
        price: service.price,
        priceUnit: service.price_unit,
        isActive: service.is_active,
        features: service.features || [],
        modelSupported: service.model_supported || [],
        createdAt: service.created_at,
      })) || [];
    } catch (error) {
      console.error('Error getting services:', error);
      return [];
    }
  }

  async getServiceById(serviceId: string): Promise<Service | null> {
    if (!isSupabaseConfigured) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        price: data.price,
        priceUnit: data.price_unit,
        isActive: data.is_active,
        features: data.features || [],
        modelSupported: data.model_supported || [],
        createdAt: data.created_at,
      };
    } catch (error) {
      console.error('Error getting service by ID:', error);
      return null;
    }
  }

  // TOKEN USAGE METHODS
  async recordTokenUsage(usage: Omit<TokenUsage, 'id' | 'createdAt'>): Promise<TokenUsage | null> {
    if (!isSupabaseConfigured) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('token_usage')
        .insert({
          user_id: usage.userId,
          service_id: usage.serviceId,
          tokens_used: usage.tokensUsed,
          cost: usage.cost,
          created_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        serviceId: data.service_id,
        tokensUsed: data.tokens_used,
        cost: data.cost,
        createdAt: data.created_at,
      };
    } catch (error) {
      console.error('Error recording token usage:', error);
      return null;
    }
  }

  async getUserTokenUsage(userId: string, limit: number = 50): Promise<TokenUsage[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('token_usage')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data?.map(usage => ({
        id: usage.id,
        userId: usage.user_id,
        serviceId: usage.service_id,
        tokensUsed: usage.tokens_used,
        cost: usage.cost,
        createdAt: usage.created_at,
      })) || [];
    } catch (error) {
      console.error('Error getting user token usage:', error);
      return [];
    }
  }

  // BILLING METHODS
  async recordBilling(billing: Omit<BillingRecord, 'id' | 'createdAt'>): Promise<BillingRecord | null> {
    if (!isSupabaseConfigured) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('billing_records')
        .insert({
          user_id: billing.userId,
          amount: billing.amount,
          type: billing.type,
          description: billing.description,
          status: billing.status,
          created_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        amount: data.amount,
        type: data.type,
        description: data.description,
        status: data.status,
        createdAt: data.created_at,
      };
    } catch (error) {
      console.error('Error recording billing:', error);
      return null;
    }
  }

  async getUserBilling(userId: string, limit: number = 50): Promise<BillingRecord[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('billing_records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data?.map(billing => ({
        id: billing.id,
        userId: billing.user_id,
        amount: billing.amount,
        type: billing.type,
        description: billing.description,
        status: billing.status,
        createdAt: billing.created_at,
      })) || [];
    } catch (error) {
      console.error('Error getting user billing:', error);
      return [];
    }
  }

  // PRICING METHODS
  async getPricingRules(): Promise<PricingRule[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data?.map(rule => ({
        id: rule.id,
        serviceId: rule.service_id,
        tier: rule.tier,
        minTokens: rule.min_tokens,
        maxTokens: rule.max_tokens,
        pricePerToken: rule.price_per_token,
        isActive: rule.is_active,
        createdAt: rule.created_at,
      })) || [];
    } catch (error) {
      console.error('Error getting pricing rules:', error);
      return [];
    }
  }

  // WEBHOOK METHODS
  async processWebhook(payload: WebhookPayload): Promise<boolean> {
    if (!isSupabaseConfigured) {
      return false;
    }

    try {
      // Record the webhook call
      const { error } = await supabase
        .from('webhook_logs')
        .insert({
          event_type: payload.type,
          payload: payload,
          processed_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error logging webhook:', error);
        return false;
      }

      // Process different webhook types
      switch (payload.type) {
        case 'user.created':
          // Handle user creation webhook
          break;
        case 'payment.completed':
          // Handle payment completion
          break;
        default:
          console.log('Unknown webhook type:', payload.type);
      }

      return true;
    } catch (error) {
      console.error('Error processing webhook:', error);
      return false;
    }
  }
}

export const db = new Database();

