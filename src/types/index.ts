// User types
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'user' | 'admin';
  balance: number;
  createdAt: string;
}

// Points Configuration types
export interface PointsConfig {
  id: string;
  exchangeRate: number; // points per USD (e.g., 10000 points = 1 USD)
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string; // Admin who created this config
}

export interface PointsConsumptionRule {
  id: string;
  functionName: string;
  pointsPerToken: number;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Model Configuration types
export interface ModelConfig {
  id: string;
  modelName: string;
  inputTokenPrice: number; // Price per 1000 input tokens in USD
  outputTokenPrice: number; // Price per 1000 output tokens in USD
  serviceType: 'ai_model' | 'digital_human' | 'workflow' | 'custom'; // Type of service
  workflowCost?: number; // Fixed cost per workflow execution (for non-token services)
  isActive: boolean;
  autoCreated: boolean; // Indicates if this was auto-created by the system
  createdAt: string;
  updatedAt: string;
  createdBy: string; // Admin who configured this model
}

// Price Change Log types
export interface PriceChangeLog {
  id: string;
  modelId: string;
  modelName: string;
  changeType: 'input_price' | 'output_price' | 'status' | 'exchange_rate';
  oldValue: number | boolean;
  newValue: number | boolean;
  adminEmail: string;
  reason?: string;
  timestamp: string;
}

// Exchange Rate History
export interface ExchangeRateHistory {
  id: string;
  oldRate: number;
  newRate: number;
  adminEmail: string;
  reason?: string;
  timestamp: string;
}

// Service types
export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  features: string[];
  pricePerToken: number;
  popular: boolean;
  difyUrl: string;
}

// Usage types
export interface TokenUsage {
  id: string;
  userId: string;
  serviceId: string;
  tokensUsed: number;
  cost: number;
  timestamp: string;
  sessionId: string;
}

// Billing types
export interface BillingRecord {
  id: string;
  userId: string;
  amount: number;
  type: 'charge' | 'usage';
  description: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
}

// Pricing types
export interface PricingRule {
  id: string;
  modelName: string;
  inputTokenPrice: number;
  outputTokenPrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Enhanced Dify iframe types for token consumption monitoring
export interface DifyMessageEndEvent {
  event: 'message_end';
  conversation_id: string;
  message_id: string;
  user_id?: string;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  timestamp: string;
  metadata?: {
    [key: string]: unknown;
  };
  // Support for real Dify usage format
  usage?: {
    prompt_tokens: number;
    prompt_unit_price?: string;
    prompt_price_unit?: string;
    prompt_price?: string;
    completion_tokens: number;
    completion_unit_price?: string;
    completion_price_unit?: string;
    completion_price?: string;
    total_tokens: number;
    total_price?: string;
    currency?: string;
    latency?: number;
  };
  finish_reason?: string;
  files?: unknown[];
}

// New Dify workflow_finished event type for actual token monitoring
export interface DifyWorkflowFinishedEvent {
  event: 'workflow_finished';
  conversation_id: string;
  message_id: string;
  data: {
    total_tokens: number;
    metadata: {
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        prompt_price: string; // USD price as string
        completion_price: string; // USD price as string 
        total_price: string; // USD price as string
        currency: string; // e.g., "USD"
      };
    };
  };
}

// Real Dify event format based on user testing at udify.app
export interface DifyRealUsageEvent {
  event?: string; // May be missing in real events
  conversation_id?: string;
  message_id?: string;
  usage: {
    prompt_tokens: number;
    prompt_unit_price?: string;
    prompt_price_unit?: string;
    prompt_price: string;
    completion_tokens: number;
    completion_unit_price?: string;
    completion_price_unit?: string;
    completion_price: string;
    total_tokens: number;
    total_price: string;
    currency: string;
    latency?: number;
  };
  finish_reason?: string;
  files?: unknown[];
}

// Dify iframe ready message - sent when iframe initializes
export interface DifyReadyEvent {
  type: 'dify-chatbot-iframe-ready';
}

// Generic Dify event interface to support both 'event' and 'type' fields
export interface DifyGenericEvent {
  event?: string; // Legacy field
  type?: string;  // New field used by Dify
  [key: string]: unknown;
}

// Points consumption tracking types
export interface PointsConsumption {
  id: string;
  userId: string;
  serviceId: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  pointsDeducted: number;
  conversationId?: string;
  messageId?: string;
  requestId?: string;
  timestamp: string;
  status: 'completed' | 'failed' | 'pending';
}

// Balance check and estimation types
export interface BalanceCheck {
  hasEnoughBalance: boolean;
  currentBalance: number;
  estimatedCost: number;
  requiredBalance: number;
  message?: string;
}

export interface CostEstimation {
  modelName: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  estimatedInputCost: number;
  estimatedOutputCost: number;
  estimatedTotalCost: number;
  estimatedPoints: number;
}

// Script types
export interface Script {
  id: string;
  userId: string;
  title: string;
  content: string;
  serviceType: string;
  createdAt: string;
  testMode: boolean;
  model: string;
  tags: string[];
}

// Recharge Package types
export interface RechargePackage {
  id: string;
  name: string;
  usdAmount: number;
  creditsAmount: number;
  isPopular?: boolean;
  discount?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Custom Recharge types
export interface CustomRecharge {
  usdAmount: number;
  creditsAmount: number;
}