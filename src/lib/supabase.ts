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

  // AUTH METHODS
  async signUp(email: string, password: string, name: string): Promise<User | null> {
    // Return null immediately if not configured
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured - cannot register user');
      return null;
    }

    try {
      console.log('Attempting to register user:', email);

      // Register with Supabase Auth
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

      console.log('Auth user created:', authData.user.id);

      // Wait a moment for the auth user to be fully created
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create user profile in the users table
      const userProfile = {
        id: authData.user.id,
        name,
        email,
        role: 'user',
        balance: 50,
        created_at: new Date().toISOString(),
      };

      console.log('Creating user profile:', userProfile);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert(userProfile)
        .select()
        .single();

      if (userError) {
        console.error('User profile creation error:', userError);
        // If user profile creation fails, try to clean up auth user
        try {
          await supabase.auth.admin.deleteUser(authData.user.id);
        } catch (cleanupError) {
          console.error('Failed to cleanup auth user:', cleanupError);
        }
        throw userError;
      }

      if (!userData) {
        console.error('No user data returned from profile creation');
        return null;
      }

      console.log('User profile created successfully:', userData);

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
      console.error('Error signing up:', error);
      // Return more specific error information
      if (error.message?.includes('duplicate key')) {
        console.error('User already exists');
      } else if (error.message?.includes('relation "users" does not exist')) {
        console.error('Users table does not exist - database setup required');
      }
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

      // Get user profile from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (userError) {
        console.error('User profile fetch error:', userError);
        throw userError;
      }
      
      if (!userData) {
        console.error('No user profile found');
        return null;
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

      // Get user profile from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error getting user profile:', userError);
        return null;
      }
      
      if (!userData) {
        return null;
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
        .single();

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
        .single();

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
        .single();

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
  async getTokenUsage(userId: string): Promise<TokenUsage[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('token_usage')
        .select(`
          *,
          services(name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data?.map(usage => ({
        id: usage.id,
        userId: usage.user_id,
        serviceId: usage.service_id,
        serviceName: usage.services?.name || 'Unknown Service',
        tokensUsed: usage.tokens_used,
        cost: usage.cost,
        model: usage.model,
        createdAt: usage.created_at,
      })) || [];
    } catch (error) {
      console.error('Error getting token usage:', error);
      return [];
    }
  }

  // BILLING METHODS
  async getBillingRecords(userId: string): Promise<BillingRecord[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('billing_records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data?.map(record => ({
        id: record.id,
        userId: record.user_id,
        amount: record.amount,
        type: record.type,
        status: record.status,
        description: record.description,
        createdAt: record.created_at,
      })) || [];
    } catch (error) {
      console.error('Error getting billing records:', error);
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
        .order('model', { ascending: true });

      if (error) throw error;
      return data?.map(rule => ({
        id: rule.id,
        model: rule.model,
        promptTokenPrice: rule.prompt_token_price,
        completionTokenPrice: rule.completion_token_price,
        currency: rule.currency,
        isActive: rule.is_active,
        createdAt: rule.created_at,
      })) || [];
    } catch (error) {
      console.error('Error getting pricing rules:', error);
      return [];
    }
  }

  async updatePricingRule(id: string, updates: Partial<PricingRule>): Promise<PricingRule | null> {
    if (!isSupabaseConfigured) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('pricing_rules')
        .update({
          prompt_token_price: updates.promptTokenPrice,
          completion_token_price: updates.completionTokenPrice,
          currency: updates.currency,
          is_active: updates.isActive,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        model: data.model,
        promptTokenPrice: data.prompt_token_price,
        completionTokenPrice: data.completion_token_price,
        currency: data.currency,
        isActive: data.is_active,
        createdAt: data.created_at,
      };
    } catch (error) {
      console.error('Error updating pricing rule:', error);
      return null;
    }
  }
}

// Export database instance
export const db = new Database();

