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
  inputTokenPrice: number; // Price per 1000 input tokens in credits
  outputTokenPrice: number; // Price per 1000 output tokens in credits
  isActive: boolean;
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

// Webhook types
export interface WebhookPayload {
  conversation_id?: string;
  user_id?: string;
  query?: string;
  response?: {
    answer?: string;
  };
  model?: string;
  messages?: Array<{
    role: string;
    content: string;
  }>;
  app_name?: string;
  metadata?: {
    test_mode?: boolean;
    app_name?: string;
    user_id?: string;
    tags?: string[];
    [key: string]: unknown;
  };
}

// Enhanced Dify webhook types for token consumption monitoring
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
}

export interface DifyWebhookPayload {
  event: string;
  data: DifyMessageEndEvent | Record<string, unknown>;
  request_id?: string;
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