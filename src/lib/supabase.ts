import { createClient } from '@supabase/supabase-js';
import { User, BillingRecord, TokenUsage } from '@/types';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase configuration status:', supabaseUrl && supabaseKey ? 'Configured' : 'Not configured');
console.log('Supabase URL:', supabaseUrl);

const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

// Create Supabase client only if configured
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

// Database service class
class DatabaseService {
  // HELPER METHODS
  private async createUserProfileFallback(userId: string, email: string, name: string): Promise<User> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase not configured');
    }

    console.log('Creating user profile fallback for:', userId);
    
    try {
      const { data, error } = await supabase!
        .from('users')
        .insert([
          {
            id: userId,
            name: name,
            email: email,
            role: 'user',
            balance: 0,
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating user profile:', error);
        throw error;
      }

      console.log('User profile created successfully:', data);

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
      console.error('Failed to create user profile:', error);
      
      // 返回基本用户对象作为后备方案
      return {
        id: userId,
        name: name,
        email: email,
        role: 'user',
        avatarUrl: null,
        balance: 0,
        createdAt: new Date().toISOString(),
      };
    }
  }

  // AUTHENTICATION METHODS
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
      const { data: authData, error: authError } = await supabase!.auth.signUp({
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

      console.log('Auth registration successful:', authData.user.id);

      // 第二步：创建用户配置文件
      let user = null;
      try {
        const { data, error: userError } = await supabase!
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (userError && userError.code !== 'PGRST116') {
          console.warn('Error fetching user profile:', userError);
        }

        if (!data) {
          console.log('User profile not found, creating one...');
          user = await this.createUserProfileFallback(authData.user.id, email, name);
        } else {
          user = {
            id: data.id,
            name: data.name,
            email: data.email,
            role: data.role,
            avatarUrl: data.avatar_url,
            balance: data.balance,
            createdAt: data.created_at,
          };
        }
      } catch (profileError) {
        console.warn('User profile creation failed, creating fallback:', profileError);
        user = await this.createUserProfileFallback(authData.user.id, email, name);
      }

      // 第三步：注册成功后自动登录建立会话
      console.log('Auth registration successful, attempting auto-login...');
      const { data: loginData, error: loginError } = await supabase!.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        console.warn('Auto-login failed after registration:', loginError);
        // 即使自动登录失败，也返回成功（用户可以手动登录）
      } else {
        console.log('Auto-login successful after registration');
      }

      console.log('Registration process completed successfully');
      return user;
    } catch (error) {
      console.error('Error during registration:', error);
      return null;
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
      const { data: authData, error: authError } = await supabase!.auth.signInWithPassword({
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
        const { data, error: userError } = await supabase!
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
      console.log('Attempting to sign out from Supabase...');
      
      // 使用 signOut 的 scope: 'global' 确保完全退出
      const { error } = await supabase!.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error('Supabase signOut error:', error);
        throw error;
      }
      
      console.log('Supabase signOut successful');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!isSupabaseConfigured) {
      return null;
    }

    try {
      const { data: { user }, error } = await supabase!.auth.getUser();
      
      if (error) {
        console.error('Error getting current user from auth:', error);
        return null;
      }
      
      if (!user) {
        return null;
      }

      // 验证用户会话是否真的有效
      const { data: { session }, error: sessionError } = await supabase!.auth.getSession();
      
      if (sessionError || !session) {
        console.warn('No valid session found for user');
        return null;
      }

      // 尝试获取用户配置文件，如果失败则使用 auth 数据
      let userData = null;
      try {
        const { data, error: userError } = await supabase!
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

    if (!userId) {
      console.warn('getUserById called with empty userId');
      return null;
    }

    try {
      const { data, error } = await supabase!
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
      return amount;
    }

    if (!userId) {
      console.warn('updateUserBalance called with empty userId');
      return amount;
    }

    try {
      const { data, error } = await supabase!
        .from('users')
        .update({ balance: amount })
        .eq('id', userId)
        .select('balance')
        .single();

      if (error) throw error;

      return data.balance;
    } catch (error) {
      console.error('Error updating user balance:', error);
      return amount;
    }
  }

  // TOKEN USAGE METHODS
  async getTokenUsage(userId: string): Promise<TokenUsage[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    if (!userId) {
      console.warn('getTokenUsage called with empty userId');
      return [];
    }

    try {
      const { data, error } = await supabase!
        .from('token_usage')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting token usage:', error);
        // If the error is about missing created_at column, try with timestamp
        if (error.code === '42703' && error.message.includes('created_at')) {
          console.log('Fallback: trying with timestamp column');
          const { data: fallbackData, error: fallbackError } = await supabase!
            .from('token_usage')
            .select('*')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false });
          
          if (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
            return [];
          }
          
          return (fallbackData || []).map(item => ({
            id: item.id,
            userId: item.user_id,
            serviceId: item.service_id || item.service,
            tokensUsed: item.tokens_used,
            cost: item.cost,
            timestamp: item.timestamp || item.created_at || new Date().toISOString(),
            sessionId: item.session_id || '',
          }));
        }
        return [];
      }

      return (data || []).map(item => ({
        id: item.id,
        userId: item.user_id,
        serviceId: item.service_id || item.service,
        tokensUsed: item.tokens_used,
        cost: item.cost,
        timestamp: item.created_at || item.timestamp || new Date().toISOString(),
        sessionId: item.session_id || '',
      }));
    } catch (error) {
      console.error('Error getting token usage:', error);
      return [];
    }
  }

  async addTokenUsage(userId: string, service: string, tokensUsed: number, cost: number): Promise<TokenUsage | null> {
    if (!isSupabaseConfigured) {
      return null;
    }

    if (!userId) {
      console.warn('addTokenUsage called with empty userId');
      return null;
    }

    try {
      const { data, error } = await supabase!
        .from('token_usage')
        .insert([
          {
            user_id: userId,
            service_id: service,
            tokens_used: tokensUsed,
            cost,
            model: 'gpt-3.5-turbo', // Default model
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        serviceId: data.service_id,
        tokensUsed: data.tokens_used,
        cost: data.cost,
        timestamp: data.created_at,
        sessionId: '',
      };
    } catch (error) {
      console.error('Error adding token usage:', error);
      return null;
    }
  }

  // BILLING METHODS
  async getBillingRecords(userId: string): Promise<BillingRecord[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    if (!userId) {
      console.warn('getBillingRecords called with empty userId');
      return [];
    }

    try {
      const { data, error } = await supabase!
        .from('billing_records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting billing records:', error);
        // If the error is about missing created_at column, try with timestamp
        if (error.code === '42703' && error.message.includes('created_at')) {
          console.log('Fallback: trying with timestamp column for billing records');
          const { data: fallbackData, error: fallbackError } = await supabase!
            .from('billing_records')
            .select('*')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false });
          
          if (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
            return [];
          }
          
          return (fallbackData || []).map(item => ({
            id: item.id,
            userId: item.user_id,
            amount: item.amount,
            type: item.type,
            description: item.description,
            timestamp: item.timestamp || item.created_at || new Date().toISOString(),
            status: item.status,
          }));
        }
        return [];
      }

      return (data || []).map(item => ({
        id: item.id,
        userId: item.user_id,
        amount: item.amount,
        type: item.type,
        description: item.description,
        timestamp: item.created_at || item.timestamp || new Date().toISOString(),
        status: item.status,
      }));
    } catch (error) {
      console.error('Error getting billing records:', error);
      return [];
    }
  }

  async addBillingRecord(
    userId: string,
    type: 'charge' | 'refund',
    amount: number,
    description: string
  ): Promise<BillingRecord | null> {
    if (!isSupabaseConfigured) {
      return null;
    }

    if (!userId) {
      console.warn('addBillingRecord called with empty userId');
      return null;
    }

    try {
      const { data, error } = await supabase!
        .from('billing_records')
        .insert([
          {
            user_id: userId,
            type,
            amount,
            description,
            status: 'completed',
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        amount: data.amount,
        type: data.type,
        description: data.description,
        timestamp: data.created_at,
        status: data.status,
      };
    } catch (error) {
      console.error('Error adding billing record:', error);
      return null;
    }
  }
}

export const db = new DatabaseService();
export { isSupabaseConfigured };
export { supabase };
