/**
 * Mock database service for testing token monitoring system
 * This simulates database operations when Supabase is not configured
 */

import { User, ModelConfig, TokenUsage, BillingRecord } from '@/types';

// Mock data storage
const mockUsers: User[] = [
  {
    id: 'mock-user-1',
    name: 'Test Admin',
    email: 'lobos54321@gmail.com',
    role: 'admin',
    balance: 100000,
    createdAt: new Date().toISOString()
  }
];

const mockModelConfigs: ModelConfig[] = [
  {
    id: 'mock-gpt4',
    modelName: 'gpt-4',
    inputTokenPrice: 0.05,    // 🎯 设置有利润的价格
    outputTokenPrice: 0.10,   // 🎯 比原价高66%获取利润
    serviceType: 'ai_model',
    isActive: true,
    autoCreated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  },
  {
    id: 'mock-gpt4-turbo',
    modelName: 'gpt-4-turbo',
    inputTokenPrice: 0.01,
    outputTokenPrice: 0.03,
    serviceType: 'ai_model',
    isActive: true,
    autoCreated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  },
  {
    id: 'mock-gpt35',
    modelName: 'gpt-3.5-turbo',
    inputTokenPrice: 0.001,
    outputTokenPrice: 0.002,
    serviceType: 'ai_model',
    isActive: true,
    autoCreated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  },
  {
    id: 'mock-claude-3-sonnet',
    modelName: 'claude-3-sonnet-20240229',
    inputTokenPrice: 0.003,
    outputTokenPrice: 0.015,
    serviceType: 'ai_model',
    isActive: true,
    autoCreated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  },
  {
    id: 'mock-claude-3-haiku',
    modelName: 'claude-3-haiku-20240307',
    inputTokenPrice: 0.00025,
    outputTokenPrice: 0.00125,
    serviceType: 'ai_model',
    isActive: true,
    autoCreated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  },
  {
    id: 'mock-gemini-pro',
    modelName: 'gemini-pro',
    inputTokenPrice: 0.0005,
    outputTokenPrice: 0.0015,
    serviceType: 'ai_model',
    isActive: true,
    autoCreated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  }
];

let mockTokenUsage: TokenUsage[] = [];
let mockBillingRecords: BillingRecord[] = [];
const mockExchangeRate = 10000;

// Initialize with some sample token usage data for testing
const initializeSampleData = () => {
  const sampleTokenUsage: TokenUsage[] = [
    {
      id: 'sample-1',
      userId: 'mock-user-1',
      serviceId: 'dify',
      tokensUsed: 3599,
      cost: 0.0113,
      timestamp: '2025-01-29T13:43:22.000Z',
      sessionId: 'session-1'
    },
    {
      id: 'sample-2', 
      userId: 'mock-user-1',
      serviceId: 'dify',
      tokensUsed: 2156,
      cost: 0.0068,
      timestamp: '2025-01-29T13:40:15.000Z',
      sessionId: 'session-2'
    },
    {
      id: 'sample-3',
      userId: 'mock-user-1', 
      serviceId: 'dify',
      tokensUsed: 1895,
      cost: 0.0052,
      timestamp: '2025-01-29T13:35:10.000Z',
      sessionId: 'session-3'
    }
  ];
  
  mockTokenUsage.push(...sampleTokenUsage);
};

// Initialize sample data
initializeSampleData();

export class MockDatabaseService {
  
  // Model configuration methods
  async getModelConfigs(): Promise<ModelConfig[]> {
    console.log('[MockDB] Getting model configs:', mockModelConfigs.length);
    return [...mockModelConfigs];
  }

  async addModelConfig(
    modelName: string,
    inputTokenPrice: number,
    outputTokenPrice: number,
    adminId: string,
    serviceType: 'ai_model' | 'digital_human' | 'workflow' | 'custom' = 'ai_model',
    workflowCost?: number,
    autoCreated: boolean = false
  ): Promise<ModelConfig | null> {
    
    // Check if model already exists
    const existing = mockModelConfigs.find(c => c.modelName.toLowerCase() === modelName.toLowerCase());
    if (existing) {
      console.log('[MockDB] Model already exists:', modelName);
      return existing;
    }

    const newConfig: ModelConfig = {
      id: `mock-${Date.now()}`,
      modelName,
      inputTokenPrice,
      outputTokenPrice,
      serviceType,
      workflowCost,
      isActive: true,
      autoCreated,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: adminId
    };

    mockModelConfigs.push(newConfig);
    console.log('[MockDB] Added model config:', modelName);
    return newConfig;
  }

  // Exchange rate methods
  async getCurrentExchangeRate(): Promise<number> {
    console.log('[MockDB] Getting exchange rate:', mockExchangeRate);
    return mockExchangeRate;
  }

  // User methods
  async getUserById(userId: string): Promise<User | null> {
    const user = mockUsers.find(u => u.id === userId);
    console.log('[MockDB] Getting user by ID:', userId, user ? 'found' : 'not found');
    return user || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = mockUsers.find(u => u.email === email);
    console.log('[MockDB] Getting user by email:', email, user ? 'found' : 'not found');
    return user || null;
  }

  async updateUserBalance(userId: string, newBalance: number): Promise<number> {
    const user = mockUsers.find(u => u.id === userId);
    if (user) {
      user.balance = newBalance;
      console.log('[MockDB] Updated user balance:', userId, newBalance);
      return newBalance;
    }
    throw new Error('User not found');
  }

  // Token usage methods
  async addTokenUsageWithModel(
    userId: string,
    modelName: string,
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
    inputCost: number,
    outputCost: number,
    totalCostInCredits: number, // 🔧 重命名：明确这是积分成本
    conversationId?: string,
    messageId?: string
  ): Promise<TokenUsage | null> {
    
    // Generate session_id with fallback to conversationId or generate a unique one
    const sessionId = conversationId || `mock_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const usage: TokenUsage = {
      id: `mock-usage-${Date.now()}`,
      userId,
      serviceId: 'dify',
      tokensUsed: totalTokens,
      cost: totalCostInCredits,
      timestamp: new Date().toISOString(),
      sessionId
    };

    mockTokenUsage.push(usage);
    console.log('[MockDB] Added token usage:', modelName, totalTokens, 'tokens');
    return usage;
  }

  async getTokenUsageByModel(modelName: string): Promise<Array<{
    id: string;
    userId: string;
    modelName: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    conversationId?: string;
    messageId?: string;
    timestamp: string;
  }>> {
    // For mock data, we'll simulate some usage based on the model name
    console.log('[MockDB] Getting token usage by model:', modelName);
    
    // Return filtered mock data (for now, we'll return a few sample entries)
    const mockUsageData = mockTokenUsage
      .filter(usage => usage.serviceId === 'dify') // Filter Dify-related usage
      .map(usage => ({
        id: usage.id,
        userId: usage.userId,
        modelName: modelName,
        inputTokens: Math.floor(usage.tokensUsed * 0.7), // Simulate input tokens (~70%)
        outputTokens: Math.floor(usage.tokensUsed * 0.3), // Simulate output tokens (~30%)
        totalTokens: usage.tokensUsed,
        inputCost: usage.cost * 0.4, // Simulate input cost
        outputCost: usage.cost * 0.6, // Simulate output cost  
        totalCost: usage.cost,
        conversationId: `conv_${usage.id}`,
        messageId: `msg_${usage.id}`,
        timestamp: usage.timestamp,
      }));
    
    return mockUsageData;
  }

  // Balance management
  async deductUserBalance(
    userId: string,
    amount: number,
    description: string
  ): Promise<{ success: boolean; newBalance: number; message: string }> {
    
    const user = mockUsers.find(u => u.id === userId);
    if (!user) {
      console.log('[MockDB] User not found for balance deduction:', userId);
      return { success: false, newBalance: 0, message: 'User not found' };
    }

    if (user.balance < amount) {
      console.log('[MockDB] Insufficient balance:', user.balance, '<', amount);
      return { 
        success: false, 
        newBalance: user.balance, 
        message: 'Insufficient balance' 
      };
    }

    user.balance -= amount;
    
    // Add billing record
    const billing: BillingRecord = {
      id: `mock-billing-${Date.now()}`,
      userId,
      amount,
      type: 'usage',
      description,
      timestamp: new Date().toISOString(),
      status: 'completed'
    };
    
    mockBillingRecords.push(billing);
    
    console.log('[MockDB] Deducted balance:', amount, 'new balance:', user.balance);
    return { 
      success: true, 
      newBalance: user.balance, 
      message: 'Balance deducted successfully' 
    };
  }

  // Admin methods
  async addCreditsToAdmin(
    adminEmail: string,
    creditsToAdd: number,
    description: string = 'Admin credit addition'
  ): Promise<{ success: boolean; newBalance: number; message: string }> {
    
    const user = mockUsers.find(u => u.email === adminEmail);
    if (!user) {
      console.log('[MockDB] User not found for credit addition:', adminEmail);
      return { 
        success: false, 
        newBalance: 0, 
        message: `User with email ${adminEmail} not found` 
      };
    }

    user.balance += creditsToAdd;
    
    // Add billing record
    const billing: BillingRecord = {
      id: `mock-billing-${Date.now()}`,
      userId: user.id,
      amount: creditsToAdd,
      type: 'charge',
      description,
      timestamp: new Date().toISOString(),
      status: 'completed'
    };
    
    mockBillingRecords.push(billing);
    
    console.log('[MockDB] Added credits:', creditsToAdd, 'new balance:', user.balance);
    return { 
      success: true, 
      newBalance: user.balance, 
      message: `Successfully added ${creditsToAdd} credits to ${adminEmail}` 
    };
  }

  // Billing methods
  async addBillingRecord(
    userId: string,
    type: 'charge' | 'usage',
    amount: number,
    description: string
  ): Promise<BillingRecord | null> {
    
    const billing: BillingRecord = {
      id: `mock-billing-${Date.now()}`,
      userId,
      amount,
      type,
      description,
      timestamp: new Date().toISOString(),
      status: 'completed'
    };
    
    mockBillingRecords.push(billing);
    console.log('[MockDB] Added billing record:', type, amount);
    return billing;
  }

  // Token consumption monitoring methods
  async getTokenConsumptionStats(): Promise<{
    totalConsumptions: number;
    totalCreditsDeducted: number;
  }> {
    const totalConsumptions = mockTokenUsage.length;
    
    // Calculate total credits deducted by converting USD cost to credits
    const totalUsdCost = mockTokenUsage.reduce((sum, record) => sum + (record.cost || 0), 0);
    const totalCreditsDeducted = Math.round(totalUsdCost * mockExchangeRate);
    
    console.log('[MockDB] Token consumption stats:', totalConsumptions, 'consumptions,', totalCreditsDeducted, 'credits deducted');
    
    return { 
      totalConsumptions, 
      totalCreditsDeducted 
    };
  }

  async getDetailedTokenConsumptionRecords(): Promise<Array<{
    id: string;
    timestamp: string;
    userEmail: string;
    service: string;
    tokens: number;
    costUsd: number;
    credits: number;
    model?: string;
  }>> {
    // Transform mock token usage data to the required format
    const records = mockTokenUsage.map(record => {
      const user = mockUsers.find(u => u.id === record.userId);
      return {
        id: record.id,
        timestamp: record.timestamp,
        userEmail: user?.email || 'unknown@example.com',
        service: 'dify-workflow',
        tokens: record.tokensUsed,
        costUsd: record.cost || 0,
        credits: Math.round((record.cost || 0) * mockExchangeRate),
        model: 'gpt-3.5-turbo', // Default model for mock data
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 100); // Limit to recent 100 records

    console.log('[MockDB] Retrieved', records.length, 'detailed token consumption records');
    return records;
  }

  // Debug methods
  getMockData() {
    return {
      users: mockUsers,
      modelConfigs: mockModelConfigs,
      tokenUsage: mockTokenUsage,
      billingRecords: mockBillingRecords,
      exchangeRate: mockExchangeRate
    };
  }

  resetMockData() {
    mockTokenUsage = [];
    mockBillingRecords = [];
    // Reset user balances
    mockUsers.forEach(user => {
      if (user.email === 'lobos54321@gmail.com') {
        user.balance = 100000;
      }
    });
    console.log('[MockDB] Reset mock data');
  }
}

export const mockDb = new MockDatabaseService();