import { supabase } from './supabase';
import { db } from './supabase';

/**
 * DifyTokenUsage interface representing token usage data from Dify API responses
 */
interface DifyTokenUsage {
  prompt_tokens: number;
  prompt_unit_price: string;
  prompt_price_unit: string;
  prompt_price: string;
  completion_tokens: number;
  completion_unit_price: string;
  completion_price_unit: string;
  completion_price: string;
  total_tokens: number;
  total_price: string;
  currency: string;
  latency: number;
}

/**
 * DifyRequest interface for making requests to Dify API
 */
interface DifyRequest {
  inputs?: Record<string, unknown>;
  query: string;
  response_mode: 'blocking' | 'streaming';
  conversation_id?: string;
  user?: string;
}

/**
 * DifyResponse interface representing responses from Dify API
 */
interface DifyResponse {
  answer?: string;
  metadata?: {
    usage?: DifyTokenUsage;
    [key: string]: unknown;
  };
  conversation_id?: string;
  [key: string]: unknown;
}

/**
 * Configuration for Dify API client
 */
interface DifyConfig {
  apiKey: string;
  baseUrl: string;
  appId?: string;
}

/**
 * DifyTokenTracker class - Handles token usage tracking for Dify API
 */
export class DifyTokenTracker {
  private config: DifyConfig;

  constructor(config: DifyConfig) {
    this.config = config;
  }

  /**
   * Send a completion request to Dify API and track token usage
   * @param userId User ID for token usage tracking
   * @param serviceId Service ID associated with this request
   * @param query The query to send to Dify
   * @param inputs Additional inputs for the request
   * @param testMode Whether this is a test request (won't be charged)
   * @returns The response from Dify API
   */
  async sendCompletionRequest(
    userId: string,
    serviceId: string,
    query: string,
    inputs: Record<string, unknown> = {},
    testMode = false
  ): Promise<DifyResponse> {
    try {
      // Generate request ID for tracking (替换 crypto.randomUUID)
      const randomPart = Math.random().toString(36).substring(2, 9);
      const timestampPart = Date.now().toString(36);
      const requestId = randomPart + timestampPart;

      // Prepare request payload
      const payload: DifyRequest = {
        inputs,
        query,
        response_mode: 'blocking',
        user: userId
      };

      // Send request to Dify API (修复模板字符串)
      const response = await fetch(this.config.baseUrl + '/completion-messages', {
        method: 'POST',
        headers: {
          // 修复模板字符串
          'Authorization': 'Bearer ' + this.config.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        // 修复模板字符串
        throw new Error('Dify API error: ' + response.status + ' ' + errorText);
      }

      const data: DifyResponse = await response.json();

      // Track token usage if available
      if (data?.metadata?.usage && !testMode) {
        await this.trackTokenUsage(
          userId,
          serviceId,
          '/completion-messages',
          data.metadata.usage,
          requestId
        );
      }

      return data;
    } catch (error) {
      console.error('Error sending completion request:', error);
      throw error;
    }
  }

  /**
   * Send a chat request to Dify API and track token usage
   * @param userId User ID for token usage tracking
   * @param serviceId Service ID associated with this request
   * @param query The query to send to Dify
   * @param conversationId Optional conversation ID for continuing a chat
   * @param inputs Additional inputs for the request
   * @param testMode Whether this is a test request (won't be charged)
   * @returns The response from Dify API
   */
  async sendChatRequest(
    userId: string,
    serviceId: string,
    query: string,
    conversationId?: string,
    inputs: Record<string, unknown> = {},
    testMode = false
  ): Promise<DifyResponse> {
    try {
      // Generate request ID for tracking (替换 crypto.randomUUID)
      const randomPart = Math.random().toString(36).substring(2, 9);
      const timestampPart = Date.now().toString(36);
      const requestId = randomPart + timestampPart;

      // Prepare request payload
      const payload: DifyRequest = {
        inputs,
        query,
        response_mode: 'blocking',
        user: userId,
        conversation_id: conversationId
      };

      // Send request to Dify API (修复模板字符串)
      const response = await fetch(this.config.baseUrl + '/chat-messages', {
        method: 'POST',
        headers: {
          // 修复模板字符串
          'Authorization': 'Bearer ' + this.config.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        // 修复模板字符串
        throw new Error('Dify API error: ' + response.status + ' ' + errorText);
      }

      const data: DifyResponse = await response.json();

      // Track token usage if available
      if (data?.metadata?.usage && !testMode) {
        await this.trackTokenUsage(
          userId,
          serviceId,
          '/chat-messages',
          data.metadata.usage,
          requestId,
          data.conversation_id
        );
      }

      return data;
    } catch (error) {
      console.error('Error sending chat request:', error);
      throw error;
    }
  }

  /**
   * Track token usage from Dify API responses
   */
  private async trackTokenUsage(
    userId: string,
    serviceId: string,
    endpoint: string,
    usage: DifyTokenUsage,
    requestId: string,
    conversationId?: string
  ): Promise<void> {
    try {
      // Get the model from the service
      const service = await db.getServiceById(serviceId);
      const model = service?.name || 'unknown';

      // Insert into token_usage table with detailed metrics
      const { error } = await supabase.from('token_usage').insert({
        user_id: userId,
        service_id: serviceId,
        tokens_used: usage.total_tokens,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        cost: parseFloat(usage.total_price),
        prompt_price: parseFloat(usage.prompt_price),
        completion_price: parseFloat(usage.completion_price),
        timestamp: new Date().toISOString(),
        // 修复模板字符串
        session_id: conversationId || 'req_' + Date.now(),
        request_id: requestId,
        endpoint,
        model,
        currency: usage.currency,
        latency: usage.latency
      });

      if (error) {
        console.error('Error tracking token usage:', error);
      }

      // Update user balance
      await db.updateUserBalance(userId, -parseFloat(usage.total_price));

      // Add billing record
      await db.addBillingRecord({
        userId,
        amount: parseFloat(usage.total_price),
        type: 'usage',
        // 修复模板字符串
        description: serviceId + ' - ' + usage.total_tokens + ' tokens used',
        timestamp: new Date().toISOString(),
        status: 'completed'
      });
    } catch (error) {
      console.error('Error tracking token usage:', error);
    }
  }

  /**
   * Extract token usage data from a Dify API response
   * Can be used with webhook or iframe message responses
   */
  extractTokenUsage(response: unknown): DifyTokenUsage | null {
    // Handle standard Dify API response
    if (typeof response === 'object' && response !== null) {
      const responseObj = response as Record<string, unknown>;
      // Check if response has metadata with usage
      if (responseObj.metadata && 
          typeof responseObj.metadata === 'object' && 
          responseObj.metadata !== null) {
        const metadata = responseObj.metadata as Record<string, unknown>;
        if (metadata.usage && typeof metadata.usage === 'object') {
          return metadata.usage as DifyTokenUsage;
        }
      }
      // Handle webhook format
      if (responseObj.response && 
          typeof responseObj.response === 'object' && 
          responseObj.response !== null) {
        const responseData = responseObj.response as Record<string, unknown>;
        if (responseData.metadata && 
            typeof responseData.metadata === 'object' && 
            responseData.metadata !== null) {
          const metadata = responseData.metadata as Record<string, unknown>;
          if (metadata.usage && typeof metadata.usage === 'object') {
            return metadata.usage as DifyTokenUsage;
          }
        }
      }
    }
    // Handle iframe message format
    if (typeof response === 'string') {
      try {
        const parsed = JSON.parse(response);
        return this.extractTokenUsage(parsed);
      } catch (e) {
        // Not valid JSON or doesn't contain usage data
      }
    }
    return null;
  }

  /**
   * Track token usage from iframe messages or webhook data
   * Use this method when integrating with Dify iframes or webhooks
   */
  async trackExternalTokenUsage(
    userId: string,
    serviceId: string,
    responseData: unknown,
    conversationId?: string
  ): Promise<boolean> {
    const usage = this.extractTokenUsage(responseData);
    if (!usage) {
      console.warn('No token usage data found in response');
      return false;
    }
    
    // 生成 request ID (替换 crypto.randomUUID)
    const randomPart = Math.random().toString(36).substring(2, 9);
    const timestampPart = Date.now().toString(36);
    const requestId = randomPart + timestampPart;
    
    const endpoint = conversationId ? '/chat-messages' : '/completion-messages';
    await this.trackTokenUsage(
      userId,
      serviceId,
      endpoint,
      usage,
      requestId,
      conversationId
    );
    return true;
  }

  /**
   * Get token usage summary for a user
   */
  async getTokenUsageSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    // Check if we're in test mode first
    const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
    
    // Check if Supabase is properly configured through environment variables
    const isSupabaseConfigured = 
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY &&
      !isTestMode;

    // Default values to return if not configured or error
    const defaultSummary = {
      total_prompt_tokens: 0,
      total_completion_tokens: 0,
      total_tokens: 0,
      total_cost: 0,
      average_tokens_per_request: 0,
      request_count: 0,
      currency: 'USD'
    };

    // If not configured or in test mode, return mock data
    if (!isSupabaseConfigured || isTestMode) {
      console.log('Supabase not configured or in test mode, returning mock data');
      return {
        total_prompt_tokens: 12500,
        total_completion_tokens: 8750,
        total_tokens: 21250,
        total_cost: 0.425,
        average_tokens_per_request: 850,
        request_count: 25,
        currency: 'USD'
      };
    }

    try {
      const { data, error } = await supabase.rpc('get_token_usage_summary', {
        user_id_param: userId,
        start_date_param: startDate?.toISOString(),
        end_date_param: endDate?.toISOString()
      });

      if (error) {
        // If RPC function doesn't exist, return default mock data
        if (error.code === '42883' || error.message?.includes('does not exist')) {
          console.log('RPC function get_token_usage_summary does not exist, returning mock data');
          return {
            total_prompt_tokens: 12500,
            total_completion_tokens: 8750,
            total_tokens: 21250,
            total_cost: 0.425,
            average_tokens_per_request: 850,
            request_count: 25,
            currency: 'USD'
          };
        }
        throw error;
      }

      // Return first row or default summary values
      return data?.[0] || defaultSummary;
    } catch (error) {
      console.error('Error getting token usage summary:', error);
      return defaultSummary;
    }
  }

  /**
   * Get token usage by service for a user
   */
  async getTokenUsageByService(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    // Check if we're in test mode first
    const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
    
    // Check if Supabase is properly configured
    const isSupabaseConfigured = 
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY &&
      !isTestMode;

    // If not configured or in test mode, return mock data
    if (!isSupabaseConfigured || isTestMode) {
      return [
        { service_id: 'chat-service', service_name: '聊天助手', total_tokens: 8500, total_cost: 0.17, request_count: 10 },
        { service_id: 'writing-service', service_name: '内容创作', total_tokens: 6200, total_cost: 0.124, request_count: 8 },
        { service_id: 'code-service', service_name: '代码助手', total_tokens: 4300, total_cost: 0.086, request_count: 5 },
        { service_id: 'document-qa', service_name: '文档问答', total_tokens: 2250, total_cost: 0.045, request_count: 2 }
      ];
    }

    try {
      const { data, error } = await supabase.rpc('get_token_usage_by_service', {
        user_id_param: userId,
        start_date_param: startDate?.toISOString(),
        end_date_param: endDate?.toISOString()
      });

      if (error) {
        // If RPC function doesn't exist, return default mock data
        if (error.code === '42883' || error.message?.includes('does not exist')) {
          console.log('RPC function get_token_usage_by_service does not exist, returning mock data');
          return [
            { service_id: 'chat-service', service_name: '聊天助手', total_tokens: 8500, total_cost: 0.17, request_count: 10 },
            { service_id: 'writing-service', service_name: '内容创作', total_tokens: 6200, total_cost: 0.124, request_count: 8 },
            { service_id: 'code-service', service_name: '代码助手', total_tokens: 4300, total_cost: 0.086, request_count: 5 },
            { service_id: 'document-qa', service_name: '文档问答', total_tokens: 2250, total_cost: 0.045, request_count: 2 }
          ];
        }
        throw error;
      }
      return data || [];
    } catch (error) {
      console.error('Error getting token usage by service:', error);
      return [];
    }
  }

  /**
   * Get token usage by model for a user
   */
  async getTokenUsageByModel(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    // Check if we're in test mode first
    const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
    
    // Check if Supabase is properly configured
    const isSupabaseConfigured = 
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY &&
      !isTestMode;

    // If not configured or in test mode, return mock data
    if (!isSupabaseConfigured || isTestMode) {
      return [
        { model: 'gpt-3.5-turbo', total_tokens: 9800, total_cost: 0.196, request_count: 12 },
        { model: 'gpt-4', total_tokens: 5400, total_cost: 0.162, request_count: 6 },
        { model: 'claude-2', total_tokens: 4200, total_cost: 0.042, request_count: 5 },
        { model: 'llama-2-70b', total_tokens: 1850, total_cost: 0.025, request_count: 2 }
      ];
    }

    try {
      const { data, error } = await supabase.rpc('get_token_usage_by_model', {
        user_id_param: userId,
        start_date_param: startDate?.toISOString(),
        end_date_param: endDate?.toISOString()
      });

      if (error) {
        // If RPC function doesn't exist, return default mock data
        if (error.code === '42883' || error.message?.includes('does not exist')) {
          console.log('RPC function get_token_usage_by_model does not exist, returning mock data');
          return [
            { model: 'gpt-3.5-turbo', total_tokens: 9800, total_cost: 0.196, request_count: 12 },
            { model: 'gpt-4', total_tokens: 5400, total_cost: 0.162, request_count: 6 },
            { model: 'claude-2', total_tokens: 4200, total_cost: 0.042, request_count: 5 },
            { model: 'llama-2-70b', total_tokens: 1850, total_cost: 0.025, request_count: 2 }
          ];
        }
        throw error;
      }
      return data || [];
    } catch (error) {
      console.error('Error getting token usage by model:', error);
      return [];
    }
  }

  /**
   * Get daily token usage data
   * This method aggregates token usage by day for visualization
   * @param userId User ID
   * @param startDate Start date for the query
   * @param endDate End date for the query
   * @returns Array of daily token usage data
   */
  async getDailyTokenUsage(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    // Check if we're in test mode first
    const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
    
    // Check if Supabase is properly configured
    const isSupabaseConfigured = 
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY &&
      !isTestMode;

    // If dates are not provided, default to last 30 days
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // If not configured or in test mode, generate mock daily data
    if (!isSupabaseConfigured || isTestMode) {
      interface DailyUsageData {
        date: string;
        prompt_tokens: number;
        completion_tokens: number;
        cost: number;
      }

      const mockData: DailyUsageData[] = [];
      const dayCount = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      
      for (let i = 0; i < dayCount; i++) {
        const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        const dateFormatted = dateKey.substring(5); // Format as MM-DD
        
        // Generate some random but plausible data with slight upward trend
        const baseFactor = 0.6 + (i / dayCount) * 0.8; // Increases slightly over time
        const randomFactor = 0.5 + Math.random(); // Add some randomness
        const promptTokens = Math.floor(300 * baseFactor * randomFactor);
        const completionTokens = Math.floor(200 * baseFactor * randomFactor);
        
        mockData.push({
          date: dateFormatted,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          cost: (promptTokens * 0.000002 + completionTokens * 0.000006)
        });
      }
      
      return mockData;
    }

    try {
      const { data, error } = await supabase
        .from('token_usage')
        .select('tokens_used, prompt_tokens, completion_tokens, cost, timestamp, created_at')
        .eq('user_id', userId)
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        // If timestamp column doesn't exist, try with created_at
        if (error.code === '42703') {
          const { data: dataAlt, error: errorAlt } = await supabase
            .from('token_usage')
            .select('tokens_used, prompt_tokens, completion_tokens, cost, created_at')
            .eq('user_id', userId)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .order('created_at', { ascending: true });
          
          if (errorAlt) throw errorAlt;
          
          // Process data with created_at column
          return this.processDailyData(dataAlt, start, end, 'created_at');
        }
        throw error;
      }

      // Process data with timestamp column
      return this.processDailyData(data, start, end, 'timestamp');
    } catch (error) {
      console.error('Error getting daily token usage:', error);
      return [];
    }
  }

  /**
   * Get detailed token usage records
   * This method fetches detailed records for the detailed data tab
   * @param userId User ID
   * @param startDate Start date for the query
   * @param endDate End date for the query
   * @param limit Maximum number of records to return
   * @param offset Pagination offset
   * @returns Object containing records and total count
   */
  async getDetailedTokenUsageRecords(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit = 20,
    offset = 0
  ) {
    // Check if we're in test mode first
    const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
    
    // Check if Supabase is properly configured
    const isSupabaseConfigured = 
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY &&
      !isTestMode;

    // If dates are not provided, default to last 30 days
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // If not configured or in test mode, return mock detailed records
    if (!isSupabaseConfigured || isTestMode) {
      // Generate mock records
      const models = ['gpt-3.5-turbo', 'gpt-4', 'claude-2', 'llama-2-70b'];
      const services = [
        {id: 'chat-service', name: '聊天助手'},
        {id: 'writing-service', name: '内容创作'},
        {id: 'code-service', name: '代码助手'},
        {id: 'document-qa', name: '文档问答'}
      ];

      const mockRecords = Array.from({ length: 50 }, (_, index) => {
        const timestamp = new Date(end.getTime() - Math.random() * (end.getTime() - start.getTime()));
        const serviceIndex = Math.floor(Math.random() * services.length);
        const promptTokens = Math.floor(Math.random() * 500) + 100;
        const completionTokens = Math.floor(Math.random() * 300) + 50;
        const model = models[Math.floor(Math.random() * models.length)];
        const cost = model === 'gpt-4' 
          ? (promptTokens * 0.00003 + completionTokens * 0.00006)
          : (promptTokens * 0.000002 + completionTokens * 0.000004);
          
        // 修复模板字符串
        const id = 'mock-' + index;

        return {
          id: id,
          service_id: services[serviceIndex].id,
          service_name: services[serviceIndex].name,
          tokens_used: promptTokens + completionTokens,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          cost,
          model,
          latency: Math.random() * 1.5 + 0.2,
          timestamp: timestamp.toISOString(),
          services: { name: services[serviceIndex].name }
        };
      });

      // Sort by timestamp descending
      mockRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply pagination
      const paginatedRecords = mockRecords.slice(offset, offset + limit);
      return {
        records: paginatedRecords,
        count: mockRecords.length
      };
    }

    try {
      const { data, error, count } = await supabase
        .from('token_usage')
        .select(`
          id, 
          service_id,
          tokens_used,
          prompt_tokens,
          completion_tokens,
          cost,
          model,
          latency,
          timestamp,
          created_at,
          services(name)
        `, { count: 'exact' })
        .eq('user_id', userId)
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString())
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        // If timestamp column doesn't exist, try with created_at
        if (error.code === '42703') {
          const { data: dataAlt, error: errorAlt, count: countAlt } = await supabase
            .from('token_usage')
            .select(`
              id, 
              service_id,
              tokens_used,
              prompt_tokens,
              completion_tokens,
              cost,
              model,
              latency,
              created_at,
              services(name)
            `, { count: 'exact' })
            .eq('user_id', userId)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
          
          if (errorAlt) throw errorAlt;
          
          return { 
            records: dataAlt?.map(item => ({
              ...item,
              timestamp: item.created_at, // Normalize to timestamp field
              service_name: item.services?.name || 'Unknown Service'
            })) || [],
            count: countAlt || 0
          };
        }
        throw error;
      }

      return { 
        records: data?.map(item => ({
          ...item,
          timestamp: item.timestamp || item.created_at, // Handle both
          service_name: item.services?.name || 'Unknown Service'
        })) || [],
        count: count || 0
      };
    } catch (error) {
      console.error('Error getting detailed token usage records:', error);
      return { records: [], count: 0 };
    }
  }

  /**
   * Track iframe message events for Dify
   * This method sets up a listener for iframe postMessage events containing token usage data
   * @param userId User ID for token usage tracking
   * @param serviceId Service ID associated with this iframe
   * @param iframeId ID of the iframe element to listen to
   * @returns A function to remove the event listener
   */
  monitorIframeTokenUsage(
    userId: string,
    serviceId: string,
    iframeId: string
  ): () => void {
    const handleMessage = async (event: MessageEvent) => {
      try {
        // Check origin matches Dify domain
        const difyOrigin = new URL(this.config.baseUrl).origin;
        if (event.origin !== difyOrigin) {
          return;
        }

        // Check if message contains token usage data
        const usage = this.extractTokenUsage(event.data);
        if (!usage) {
          return;
        }

        // Extract conversation ID if available
        let conversationId: string | undefined;
        try {
          if (event.data.conversation_id) {
            conversationId = event.data.conversation_id;
          } else if (event.data.response?.conversation_id) {
            conversationId = event.data.response.conversation_id;
          }
        } catch (e) {
          // No conversation ID available
        }

        // Track the token usage
        await this.trackExternalTokenUsage(
          userId,
          serviceId,
          event.data,
          conversationId
        );
      } catch (error) {
        console.error('Error processing iframe message:', error);
      }
    };

    // Add event listener
    window.addEventListener('message', handleMessage);

    // Return function to remove event listener
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }

  /**
   * Helper method to process daily data aggregation
   */
  private processDailyData(data: Record<string, unknown>[], start: Date, end: Date, timestampColumn: string) {
    interface DailyUsageData {
      date: string;
      prompt_tokens: number;
      completion_tokens: number;
      cost: number;
    }
    
    const dailyData: Record<string, DailyUsageData> = {};

    // Initialize all days in the range with zero values
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    for (let i = 0; i < dayCount; i++) {
      const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      const dateFormatted = dateKey.substring(5); // Format as MM-DD
      dailyData[dateKey] = {
        date: dateFormatted,
        prompt_tokens: 0,
        completion_tokens: 0,
        cost: 0
      };
    }

    // Aggregate data by day
    if (data) {
      data.forEach(item => {
        const timestamp = item[timestampColumn] || item.timestamp || item.created_at;
        const date = new Date(timestamp);
        const dateKey = date.toISOString().split('T')[0];
        if (dailyData[dateKey]) {
          dailyData[dateKey].prompt_tokens += item.prompt_tokens || 0;
          dailyData[dateKey].completion_tokens += item.completion_tokens || 0;
          dailyData[dateKey].cost += item.cost || 0;
        }
      });
    }

    return Object.values(dailyData);
  }
}

// Create default instance with environment variables
const defaultConfig: DifyConfig = {
  apiKey: import.meta.env.VITE_DIFY_API_KEY || '',
  baseUrl: import.meta.env.VITE_DIFY_API_URL || 'https://api.dify.ai/v1',
};

export const difyTokenTracker = new DifyTokenTracker(defaultConfig);
