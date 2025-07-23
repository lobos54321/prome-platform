import { Service, TokenUsage, BillingRecord, PricingRule } from '@/types';
import { db } from './supabase';

// Services API implementation using Supabase database
class ServicesAPI {
  // Get all services
  async getServices(): Promise<Service[]> {
    return await db.getServices();
  }

  // Get a specific service by ID
  async getService(serviceId: string): Promise<Service | null> {
    return await db.getServiceById(serviceId);
  }

  // Get token usage records for a user
  async getTokenUsage(userId: string): Promise<TokenUsage[]> {
    return await db.getTokenUsage(userId);
  }

  // Get billing records for a user
  async getBillingRecords(userId: string): Promise<BillingRecord[]> {
    return await db.getBillingRecords(userId);
  }

  // Get pricing rules
  async getPricingRules(): Promise<PricingRule[]> {
    return await db.getPricingRules();
  }

  // Update pricing rule (admin function)
  async updatePricingRule(id: string, updates: Partial<PricingRule>): Promise<PricingRule | null> {
    return await db.updatePricingRule(id, updates);
  }
  
  // Add pricing rule (admin function)
  async addPricingRule(rule: Omit<PricingRule, 'id'>): Promise<PricingRule | null> {
    return await db.addPricingRule(rule);
  }
  
  // Delete pricing rule (admin function)
  async deletePricingRule(id: string): Promise<void> {
    await db.deletePricingRule(id);
  }

  // Add token usage record
  async addTokenUsage(usage: Omit<TokenUsage, 'id'>): Promise<TokenUsage | null> {
    return await db.addTokenUsage(usage);
  }

  // Add billing record
  async addBillingRecord(record: Omit<BillingRecord, 'id'>): Promise<BillingRecord | null> {
    return await db.addBillingRecord(record);
  }
}

export const servicesAPI = new ServicesAPI();