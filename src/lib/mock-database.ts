/**
 * Mock database service for testing token monitoring system
 * This simulates database operations when Supabase is not configured
 */

import { User, ModelConfig, TokenUsage, BillingRecord } from '@/types';

// Mock data storage
let mockUsers: User[] = [
  {
    id: 'mock-user-1',
    name: 'Test Admin',
    email: 'lobos54321@gmail.com',
    role: 'admin',
    balance: 100000,
    createdAt: new Date().toISOString()
  }
];

let mockModelConfigs: ModelConfig[] = [
  {
    id: 'mock-gpt4',
    modelName: 'gpt-4',
    inputTokenPrice: 0.03,
    outputTokenPrice: 0.06,
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
  }
];

let mockTokenUsage: TokenUsage[] = [];
let mockBillingRecords: BillingRecord[] = [];
let mockExchangeRate = 10000;

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
    totalCost: number,
    conversationId?: string,
    messageId?: string
  ): Promise<TokenUsage | null> {
    
    const usage: TokenUsage = {
      id: `mock-usage-${Date.now()}`,
      userId,
      serviceId: 'dify',
      tokensUsed: totalTokens,
      cost: totalCost,
      timestamp: new Date().toISOString(),
      sessionId: conversationId || ''
    };

    mockTokenUsage.push(usage);
    console.log('[MockDB] Added token usage:', modelName, totalTokens, 'tokens');
    return usage;
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