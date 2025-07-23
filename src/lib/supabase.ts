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
  import.meta.env.VITE_SUPABASE_ANON_KEY;

// Console log to help debugging
console.log('Supabase configuration status:', isSupabaseConfigured ? 'Configured' : 'Not configured');

// Database service for ProMe application
export class Database {
  // AUTH METHODS
  
  async signUp(email: string, password: string, name: string): Promise<User | null> {
    try {
      // Register with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: 'user',
            balance: 50, // Welcome bonus
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) return null;

      // Create user profile in the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          name,
          email,
          role: 'user',
          balance: 50,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (userError) throw userError;
      
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
      return null;
    }
  }

  async signIn(email: string, password: string): Promise<User | null> {
    try {
      // Login with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) return null;

      // Get user profile from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (userError) throw userError;
      
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
    await supabase.auth.signOut();
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return null;

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (error) throw error;
      
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

  async updateUserBalance(userId: string, amount: number): Promise<number> {
    try {
      // First get current balance
      const { data: userData, error: getUserError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

      if (getUserError) throw getUserError;

      const newBalance = userData.balance + amount;

      // Update balance
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('id', userId)
        .select('balance')
        .single();

      if (updateError) throw updateError;

      return updatedUser.balance;
    } catch (error) {
      console.error('Error updating user balance:', error);
      throw error;
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
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
      console.error('Error getting user by id:', error);
      return null;
    }
  }

  // SERVICE METHODS

  async getServices(): Promise<Service[]> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*');

      if (error) throw error;

      return data.map(service => ({
        id: service.id,
        name: service.name,
        description: service.description,
        category: service.category,
        features: service.features,
        pricePerToken: service.price_per_token,
        popular: service.popular,
        difyUrl: service.dify_url,
      }));
    } catch (error) {
      console.error('Error getting services:', error);
      return [];
    }
  }

  async getServiceById(serviceId: string): Promise<Service | null> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        features: data.features,
        pricePerToken: data.price_per_token,
        popular: data.popular,
        difyUrl: data.dify_url,
      };
    } catch (error) {
      console.error('Error getting service by id:', error);
      return null;
    }
  }

  // TOKEN USAGE METHODS

  async getTokenUsage(userId: string): Promise<TokenUsage[]> {
    try {
      const { data, error } = await supabase
        .from('token_usage')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      return data.map(usage => ({
        id: usage.id,
        userId: usage.user_id,
        serviceId: usage.service_id,
        tokensUsed: usage.tokens_used,
        cost: usage.cost,
        timestamp: usage.timestamp,
        sessionId: usage.session_id,
      }));
    } catch (error) {
      console.error('Error getting token usage:', error);
      return [];
    }
  }

  async addTokenUsage(usage: Omit<TokenUsage, 'id'>): Promise<TokenUsage | null> {
    try {
      const { data, error } = await supabase
        .from('token_usage')
        .insert({
          user_id: usage.userId,
          service_id: usage.serviceId,
          tokens_used: usage.tokensUsed,
          cost: usage.cost,
          timestamp: usage.timestamp,
          session_id: usage.sessionId,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        serviceId: data.service_id,
        tokensUsed: data.tokens_used,
        cost: data.cost,
        timestamp: data.timestamp,
        sessionId: data.session_id,
      };
    } catch (error) {
      console.error('Error adding token usage:', error);
      return null;
    }
  }

  // BILLING METHODS

  async getBillingRecords(userId: string): Promise<BillingRecord[]> {
    try {
      const { data, error } = await supabase
        .from('billing_records')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      return data.map(record => ({
        id: record.id,
        userId: record.user_id,
        amount: record.amount,
        type: record.type,
        description: record.description,
        timestamp: record.timestamp,
        status: record.status,
      }));
    } catch (error) {
      console.error('Error getting billing records:', error);
      return [];
    }
  }

  async addBillingRecord(record: Omit<BillingRecord, 'id'>): Promise<BillingRecord | null> {
    try {
      const { data, error } = await supabase
        .from('billing_records')
        .insert({
          user_id: record.userId,
          amount: record.amount,
          type: record.type,
          description: record.description,
          timestamp: record.timestamp,
          status: record.status,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        amount: data.amount,
        type: data.type,
        description: data.description,
        timestamp: data.timestamp,
        status: data.status,
      };
    } catch (error) {
      console.error('Error adding billing record:', error);
      return null;
    }
  }

  // PRICING METHODS

  async getPricingRules(): Promise<PricingRule[]> {
    try {
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*');

      if (error) throw error;

      return data.map(rule => ({
        id: rule.id,
        modelName: rule.model_name,
        inputTokenPrice: rule.input_token_price,
        outputTokenPrice: rule.output_token_price,
        isActive: rule.is_active,
      }));
    } catch (error) {
      console.error('Error getting pricing rules:', error);
      return [];
    }
  }

  async updatePricingRule(id: string, updates: Partial<PricingRule>): Promise<PricingRule | null> {
    try {
      const updateData: Record<string, unknown> = {};
      
      if (updates.modelName !== undefined) updateData.model_name = updates.modelName;
      if (updates.inputTokenPrice !== undefined) updateData.input_token_price = updates.inputTokenPrice;
      if (updates.outputTokenPrice !== undefined) updateData.output_token_price = updates.outputTokenPrice;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

      const { data, error } = await supabase
        .from('pricing_rules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        modelName: data.model_name,
        inputTokenPrice: data.input_token_price,
        outputTokenPrice: data.output_token_price,
        isActive: data.is_active,
      };
    } catch (error) {
      console.error('Error updating pricing rule:', error);
      return null;
    }
  }

  async addPricingRule(rule: Omit<PricingRule, 'id'>): Promise<PricingRule | null> {
    try {
      const { data, error } = await supabase
        .from('pricing_rules')
        .insert({
          model_name: rule.modelName,
          input_token_price: rule.inputTokenPrice,
          output_token_price: rule.outputTokenPrice,
          is_active: rule.isActive,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        modelName: data.model_name,
        inputTokenPrice: data.input_token_price,
        outputTokenPrice: data.output_token_price,
        isActive: data.is_active,
      };
    } catch (error) {
      console.error('Error adding pricing rule:', error);
      return null;
    }
  }

  async deletePricingRule(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('pricing_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting pricing rule:', error);
      throw error;
    }
  }

  // SCRIPT METHODS

  async saveScript(script: Omit<Script, 'id'>): Promise<Script | null> {
    try {
      const { data, error } = await supabase
        .from('scripts')
        .insert({
          user_id: script.userId,
          title: script.title,
          content: script.content,
          service_type: script.serviceType,
          created_at: script.createdAt,
          test_mode: script.testMode,
          model: script.model,
          tags: script.tags,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        content: data.content,
        serviceType: data.service_type,
        createdAt: data.created_at,
        testMode: data.test_mode,
        model: data.model,
        tags: data.tags,
      };
    } catch (error) {
      console.error('Error saving script:', error);
      return null;
    }
  }

  async getScriptsByUser(userId: string): Promise<Script[]> {
    try {
      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      return data.map(script => ({
        id: script.id,
        userId: script.user_id,
        title: script.title,
        content: script.content,
        serviceType: script.service_type,
        createdAt: script.created_at,
        testMode: script.test_mode,
        model: script.model,
        tags: script.tags,
      }));
    } catch (error) {
      console.error('Error getting scripts by user:', error);
      return [];
    }
  }

  // WEBHOOK METHODS

  async processWebhook(payload: WebhookPayload, apiKey: string): Promise<{success: boolean; message: string; scriptId?: string}> {
    try {
      // First validate the API key
      const { data: apiKeyData, error: apiKeyError } = await supabase
        .from('api_keys')
        .select('*')
        .eq('key', apiKey)
        .single();

      if (apiKeyError || !apiKeyData) {
        return { 
          success: false, 
          message: 'Invalid API key' 
        };
      }

      // Extract user ID from payload or default
      const userId = payload.user_id || payload.metadata?.user_id || 'anonymous';
      
      // Extract content from response
      let content = '';
      let title = '';
      
      if (payload.response) {
        content = payload.response.answer || '';
        title = payload.query || '未命名脚本';
      } else if (payload.messages) {
        // Find the assistant's message
        const assistantMessage = payload.messages.find(m => m.role === 'assistant');
        if (assistantMessage) {
          content = assistantMessage.content || '';
        }
        // Use the last user message as the title
        const userMessages = payload.messages.filter(m => m.role === 'user');
        if (userMessages.length > 0) {
          title = userMessages[userMessages.length - 1].content.substring(0, 50) + '...';
        }
      }

      if (!content) {
        return { 
          success: false, 
          message: 'No content found in payload' 
        };
      }

      const isTestMode = payload.metadata?.test_mode === true;
      
      // Calculate tokens (simple approximation)
      const tokensUsed = Math.ceil(content.length / 4);
      
      // Get model pricing
      const { data: pricingData, error: pricingError } = await supabase
        .from('pricing_rules')
        .select('*')
        .eq('model_name', payload.model || 'default')
        .eq('is_active', true)
        .single();
        
      if (pricingError) {
        console.warn('Model pricing not found, using default pricing');
      }
      
      const outputTokenPrice = pricingData?.output_token_price || 0.005;
      const cost = (tokensUsed * outputTokenPrice) / 1000;

      // Save the script
      const script = await this.saveScript({
        userId,
        title,
        content,
        serviceType: payload.app_name || payload.metadata?.app_name || 'webhook-script',
        createdAt: new Date().toISOString(),
        testMode: isTestMode,
        model: payload.model || 'unknown',
        tags: payload.metadata?.tags || [],
      });

      if (!script) {
        return {
          success: false,
          message: 'Failed to save script'
        };
      }

      // If not in test mode, record usage and update balance
      if (!isTestMode && userId !== 'anonymous') {
        // Add token usage record
        await this.addTokenUsage({
          userId,
          serviceId: script.serviceType,
          tokensUsed,
          cost,
          timestamp: new Date().toISOString(),
          sessionId: `webhook_${payload.conversation_id || Date.now()}`
        });

        // Add billing record
        await this.addBillingRecord({
          userId,
          amount: cost,
          type: 'usage',
          description: `${script.serviceType} - ${script.title.substring(0, 30)}...`,
          timestamp: new Date().toISOString(),
          status: 'completed'
        });

        // Update user balance
        await this.updateUserBalance(userId, -cost);

        // Check if balance is low
        const user = await this.getUserById(userId);
        if (user && user.balance < 10) {
          // In a real app, send notification
          console.log(`Low balance notification for user ${userId}`);
        }
      }

      return {
        success: true,
        message: 'Webhook processed successfully',
        scriptId: script.id
      };
    } catch (error) {
      console.error('Error processing webhook:', error);
      return {
        success: false,
        message: `Error processing webhook: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const db = new Database();