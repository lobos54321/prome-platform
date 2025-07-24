

```typescript
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
    // Validate config inputs
    if (!config.apiKey) {
      console.warn('DifyTokenTracker: apiKey is empty');
    }
    if (!config.baseUrl) {
      console.warn('DifyTokenTracker: baseUrl is empty, using default');
    }
    
    this.config = {
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || 'https://api.dify.ai/v1',
      appId: config.appId
    };
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
    // Validate required inputs
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!serviceId) {
      throw new Error('Service ID is required');
    }
    if (!query) {
      throw new Error('Query is required');
    }

    try {
      // Generate request ID for tracking
      const requestId = crypto?.randomUUID ? crypto.randomUUID() : `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Prepare request payload
      const payload: DifyRequest = {
        inputs,
        query,
        response_mode: 'blocking',
        user: userId
      };

      // Send request to Dify API
      const response = await fetch(`${this.config.baseUrl}/completion-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dify API error: ${response.status} ${errorText}`);
      }

      const data: DifyResponse = await response.json();
      
      // Validate data structure before accessing properties
      if (data && typeof data === 'object') {
        // Track token usage if available
        if (data?.metadata?.usage && !testMode) {
          try {
            await this.trackTokenUsage(
              userId,
              serviceId,
              '/completion-messages',
              data.metadata.usage,
              requestId
            );
          } catch (trackError) {
            console.error('Error tracking token usage:', trackError);
          }
        }
      } else {
        console.warn('Dify API returned invalid data structure:', data);
      }

      return data || {};
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
    // Validate required inputs
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!serviceId) {
      throw new Error('Service ID is required');
    }
    if (!query) {
      throw new Error('Query is required');
    }

    try {
      // Generate request ID for tracking
      const requestId = crypto?.randomUUID ? crypto.randomUUID() : `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Prepare request payload
      const payload: DifyRequest = {
        inputs,
        query,
        response_mode: 'blocking',
        user: userId,
        conversation_id: conversationId
      };

      // Send request to Dify API
      const response = await fetch(`${this.config.baseUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dify API error: ${response.status} ${errorText}`);
      }

      const data: DifyResponse = await response.json();
      
      // Validate data structure before accessing properties
      if (data && typeof data === 'object') {
        // Track token usage if available
        if (data?.metadata?.usage && !testMode) {
          try {
            await this.trackTokenUsage(
              userId,
              serviceId,
              '/chat-messages',
              data.metadata.usage,
              requestId,
              data.conversation_id
            );
          } catch (trackError) {
            console.error('Error tracking token usage:', trackError);
          }
        }
      } else {
        console.warn('Dify API returned invalid data structure:', data);
      }

      return data || {};
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
    // Validate inputs
    if (!userId || !serviceId || !usage) {
      console.error('Missing required parameters for trackTokenUsage');
      return;
    }

    try {
      // Get the model from the service
      let model = 'unknown';
      try {
        const service = await db.getServiceById(serviceId);
        model = service?.name || 'unknown';
      } catch (serviceError) {
        console.warn('Failed to get service info:', serviceError);
      }

      // Validate usage data before accessing properties
      const totalTokens = usage.total_tokens || 0;
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      const totalPrice = usage.total_price ? parseFloat(usage.total_price) : 0;
      const promptPrice = usage.prompt_price ? parseFloat(usage.prompt_price) : 0;
      const completionPrice = usage.completion_price ? parseFloat(usage.completion_price) : 0;
      const currency = usage.currency || 'USD';
      const latency = usage.latency || 0;

      // Insert into token_usage table with detailed metrics
      const { error } = await supabase.from('token_usage').insert({
        user_id: userId,
        service_id: serviceId,
        tokens_used: totalTokens,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost: totalPrice,
        prompt_price: promptPrice,
        completion_price: completionPrice,
        timestamp: new Date().toISOString(),
        session_id: conversationId || `req_${Date.now()}`,
        request_id: requestId,
        endpoint,
        model,
        currency,
        latency
      });

      if (error) {
        console.error('Error tracking token usage:', error);
      }

      // Update user balance (only if cost is positive)
      if (totalPrice > 0) {
        try {
          await db.updateUserBalance(userId, -totalPrice);
        } catch (balanceError) {
          console.error('Error updating user balance:', balanceError);
        }

        // Add billing record
        try {
          await db.addBillingRecord({
            userId,
            amount: totalPrice,
            type: 'usage',
            description: `${serviceId} - ${totalTokens} tokens used`,
            timestamp: new Date().toISOString(),
            status: 'completed'
          });
        } catch (billingError) {
          console.error('Error adding billing record:', billingError);
        }
      }
    } catch (error) {
      console.error('Error tracking token usage:', error);
    }
  }

  /**
   * Extract token usage data from a Dify API response
   * Can be used with webhook or iframe message responses
   */
  extractTokenUsage(response: unknown): DifyTokenUsage | null {
    try {
      // Handle standard Dify API response
      if (typeof response === 'object' && response !== null) {
        const responseObj = response as Record<string, unknown>;
        
        // Check if response has metadata with usage
        if (responseObj.metadata && 
            typeof responseObj.metadata === 'object' && 
            responseObj.metadata !== null) {
          const metadata = responseObj.metadata as Record<string, unknown>;
          if (metadata.usage && typeof metadata.usage === 'object' && metadata.usage !== null) {
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
            if (metadata.usage && typeof metadata.usage === 'object' && metadata.usage !== null) {
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
          console.debug('Failed to parse JSON from response string:', e);
        }
      }
    } catch (error) {
      console.error('Error extracting token usage:', error);
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
    // Validate inputs
    if (!userId || !serviceId) {
      console.error('Missing required parameters for trackExternalTokenUsage');
      return false;
    }

    try {
      const usage = this.extractTokenUsage(responseData);
      if (!usage) {
        console.warn('No token usage data found in response');
        return false;
      }

      const requestId = crypto?.randomUUID ? crypto.randomUUID() : `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    } catch (error) {
      console.error('Error tracking external token usage:', error);
      return false;
    }
  }

  /**
   * Get token usage summary for a user
   */
  async getTokenUsageSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    // Validate userId
    if (!userId) {
      console.error('getTokenUsageSummary: userId is required');
      return {
        total_prompt_tokens: 0,
        total_completion_tokens: 0,
        total_tokens: 0,
        total_cost: 0,
        average_tokens_per_request: 0,
        request_count: 0,
        currency: 'USD'
      };
    }

    // Check if Supabase is properly configured through environment variables
    const isSupabaseConfigured = 
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY;

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

    // If not configured, return mock data
    if (!isSupabaseConfigured) {
      console.log('Supabase not configured, returning mock data');
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
        console.error('Error calling get_token_usage_summary RPC:', error);
        return defaultSummary;
      }

      // Return first row or default summary values
      const result = data?.[0] || defaultSummary;
      
      // Ensure all numeric fields are numbers
      return {
        total_prompt_tokens: Number(result.total_prompt_tokens) || 0,
        total_completion_tokens: Number(result.total_completion_tokens) || 0,
        total_tokens: Number(result.total_tokens) || 0,
        total_cost: Number(result.total_cost) || 0,
        average_tokens_per_request: Number(result.average_tokens_per_request) || 0,
        request_count: Number(result.request_count) || 0,
        currency: result.currency || 'USD'
      };
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
    // Validate userId
    if (!userId) {
      console.error('getTokenUsageByService: userId is required');
      return [];
    }

    // Check if Supabase is properly configured
    const isSupabaseConfigured = 
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY;

    // If not configured, return mock data
    if (!isSupabaseConfigured) {
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
        console.error('Error calling get_token_usage_by_service RPC:', error);
        return [];
      }

      // Ensure data is an array and validate each item
      if (Array.isArray(data)) {
        return data.map(item => ({
          service_id: item.service_id || '',
          service_name: item.service_name || 'Unknown Service',
          total_tokens: Number(item.total_tokens) || 0,
          total_cost: Number(item.total_cost) || 0,
          request_count: Number(item.request_count) || 0
        }));
      }

      return [];
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
    // Validate userId
    if (!userId) {
      console.error('getTokenUsageByModel: userId is required');
      return [];
    }

    // Check if Supabase is properly configured
    const isSupabaseConfigured = 
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY;

    // If not configured, return mock data
    if (!isSupabaseConfigured) {
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
        console.error('Error calling get_token_usage_by_model RPC:', error);
        return [];
      }

      // Ensure data is an array and validate each item
      if (Array.isArray(data)) {
        return data.map(item => ({
          model: item.model || 'unknown',
          total_tokens: Number(item.total_tokens) || 0,
          total_cost: Number(item.total_cost) || 0,
          request_count: Number(item.request_count) || 0
        }));
      }

      return [];
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
    // Validate userId
    if (!userId) {
      console.error('getDailyTokenUsage: userId is required');
      return [];
    }

    // Check if Supabase is properly configured
    const isSupabaseConfigured = 
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY;

    // If dates are not provided, default to last 30 days
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // If not configured, generate mock daily data
    if (!isSupabaseConfigured) {
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
        .select('tokens_used, prompt_tokens, completion_tokens, cost, timestamp')
        .eq('user_id', userId)
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching token usage data:', error);
        return [];
      }

      // Process data to group by day
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
      if (Array.isArray(data)) {
        data.forEach(item => {
          try {
            const date = new Date(item.timestamp);
            const dateKey = date.toISOString().split('T')[0];
            if (dailyData[dateKey]) {
              dailyData[dateKey].prompt_tokens += Number(item.prompt_tokens) || 0;
              dailyData[dateKey].completion_tokens += Number(item.completion_tokens) || 0;
              dailyData[dateKey].cost += Number(item.cost) || 0;
            }
          } catch (itemError) {
            console.warn('Error processing token usage item:', itemError);
          }
        });
      }

      return Object.values(dailyData);
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
    // Validate userId
    if (!userId) {
      console.error('getDetailedTokenUsageRecords: userId is required');
      return { records: [], count: 0 };
    }

    // Check if Supabase is properly configured
    const isSupabaseConfigured = 
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY;

    // If dates are not provided, default to last 30 days
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // If not configured, return mock detailed records
    if (!isSupabaseConfigured) {
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
          
        return {
          id: `mock-${index}`,
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
          services(name)
        `, { count: 'exact' })
        .eq('user_id', userId)
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString())
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching detailed token usage records:', error);
        return { records: [], count: 0 };
      }

      // Process records and ensure proper structure
      const records = Array.isArray(data) ? data.map(item => ({
        id: item.id || '',
        service_id: item.service_id || '',
        service_name: (item.services && item.services.name) || 'Unknown Service',
        tokens_used: Number(item.tokens_used) || 0,
        prompt_tokens: Number(item.prompt_tokens) || 0,
        completion_tokens: Number(item.completion_tokens) || 0,
        cost: Number(item.cost) || 0,
        model: item.model || 'unknown',
        latency: Number(item.latency) || 0,
        timestamp: item.timestamp || new Date().toISOString()
      })) : [];

      return { 
        records,
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
    // Validate inputs
    if (!userId || !serviceId || !iframeId) {
      console.error('monitorIframeTokenUsage: Missing required parameters');
      return () => {}; // Return noop function
    }

    const handleMessage = async (event: MessageEvent) => {
      try {
        // Validate event and config
        if (!event || !event.origin || !this.config.baseUrl) {
          return;
        }

        // Check origin matches Dify domain
        try {
          const difyOrigin = new URL(this.config.baseUrl).origin;
          if (event.origin !== difyOrigin) {
            return;
          }
        } catch (urlError) {
          console.warn('Failed to parse Dify base URL for origin check:', urlError);
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
          if (event.data && typeof event.data === 'object') {
            if (event.data.conversation_id) {
              conversationId = event.data.conversation_id;
            } else if (event.data.response?.conversation_id) {
              conversationId = event.data.response.conversation_id;
            }
          }
        } catch (e) {
          // No conversation ID available
          console.debug('No conversation ID found in message data');
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
}

// Create default instance with environment variables
const defaultConfig: DifyConfig = {
  apiKey: import.meta.env.VITE_DIFY_API_KEY || '',
  baseUrl: import.meta.env.VITE_DIFY_API_URL || 'https://api.dify.ai/v1',
};

// Validate environment variables
if (!defaultConfig.apiKey) {
  console.warn('VITE_DIFY_API_KEY is not set in environment variables');
}
if (!defaultConfig.baseUrl) {
  console.warn('VITE_DIFY_API_URL is not set in environment variables, using default');
}

export const difyTokenTracker = new DifyTokenTracker(defaultConfig);
```
