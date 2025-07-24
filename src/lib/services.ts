import { Service, TokenUsage, BillingRecord, PricingRule } from '@/types';
import { db } from './supabase';

// Services API implementation using Supabase database
class ServicesAPI {
  // Get all services
  async getServices(): Promise<Service[]> {
    try {
      const services = await db.getServices();
      // db.getServices() already returns [] on error, but we can log for debugging
      return services || [];
    } catch (error) {
      console.error('ServicesAPI: Error in getServices:', error);
      return [];
    }
  }

  // Get a specific service by ID
  async getService(serviceId: string): Promise<Service | null> {
    // Basic input validation
    if (!serviceId) {
      console.error('ServicesAPI: getService called with empty serviceId');
      return null;
    }

    try {
      const service = await db.getServiceById(serviceId);
      // db.getServiceById() already returns null on error/not found
      return service || null;
    } catch (error) {
      console.error(`ServicesAPI: Error in getService(${serviceId}):`, error);
      return null;
    }
  }

  // Get token usage records for a user
  async getTokenUsage(userId: string): Promise<TokenUsage[]> {
    // Basic input validation
    if (!userId) {
      console.error('ServicesAPI: getTokenUsage called with empty userId');
      return [];
    }

    try {
      const usage = await db.getTokenUsage(userId);
      // db.getTokenUsage() already returns [] on error
      return usage || [];
    } catch (error) {
      console.error(`ServicesAPI: Error in getTokenUsage(${userId}):`, error);
      return [];
    }
  }

  // Get billing records for a user
  async getBillingRecords(userId: string): Promise<BillingRecord[]> {
    // Basic input validation
    if (!userId) {
      console.error('ServicesAPI: getBillingRecords called with empty userId');
      return [];
    }

    try {
      const records = await db.getBillingRecords(userId);
      // db.getBillingRecords() already returns [] on error
      return records || [];
    } catch (error) {
      console.error(`ServicesAPI: Error in getBillingRecords(${userId}):`, error);
      return [];
    }
  }

  // Get pricing rules
  async getPricingRules(): Promise<PricingRule[]> {
    try {
      const rules = await db.getPricingRules();
      // db.getPricingRules() already returns [] on error
      return rules || [];
    } catch (error) {
      console.error('ServicesAPI: Error in getPricingRules:', error);
      return [];
    }
  }

  // Update pricing rule (admin function)
  async updatePricingRule(id: string, updates: Partial<PricingRule>): Promise<PricingRule | null> {
    // Basic input validation
    if (!id) {
      console.error('ServicesAPI: updatePricingRule called with empty id');
      return null;
    }

    try {
      const updatedRule = await db.updatePricingRule(id, updates);
      // db.updatePricingRule() already returns null on error
      return updatedRule || null;
    } catch (error) {
      console.error(`ServicesAPI: Error in updatePricingRule(${id}):`, error);
      return null;
    }
  }
  
  // Add pricing rule (admin function)
  async addPricingRule(rule: Omit<PricingRule, 'id'>): Promise<PricingRule | null> {
    // Basic input validation could be added here if needed
    // e.g., check if rule object has required fields

    try {
      const newRule = await db.addPricingRule(rule);
      // db.addPricingRule() already returns null on error
      return newRule || null;
    } catch (error) {
      console.error('ServicesAPI: Error in addPricingRule:', error);
      return null;
    }
  }
  
  // Delete pricing rule (admin function)
  async deletePricingRule(id: string): Promise<boolean> {
    // Basic input validation
    if (!id) {
      console.error('ServicesAPI: deletePricingRule called with empty id');
      return false;
    }

    try {
      await db.deletePricingRule(id);
      // If we reach here without exception, deletion was successful
      return true;
    } catch (error) {
      console.error(`ServicesAPI: Error in deletePricingRule(${id}):`, error);
      // Return false to indicate failure
      return false;
    }
  }

  // Add token usage record
  async addTokenUsage(usage: Omit<TokenUsage, 'id'>): Promise<TokenUsage | null> {
    // Basic input validation could be added here if needed
    // e.g., check if usage object has required fields

    try {
      const newUsage = await db.addTokenUsage(usage);
      // db.addTokenUsage() already returns null on error
      return newUsage || null;
    } catch (error) {
      console.error('ServicesAPI: Error in addTokenUsage:', error);
      return null;
    }
  }

  // Add billing record
  async addBillingRecord(record: Omit<BillingRecord, 'id'>): Promise<BillingRecord | null> {
    // Basic input validation could be added here if needed
    // e.g., check if record object has required fields

    try {
      const newRecord = await db.addBillingRecord(record);
      // db.addBillingRecord() already returns null on error
      return newRecord || null;
    } catch (error) {
      console.error('ServicesAPI: Error in addBillingRecord:', error);
      return null;
    }
  }
}

export const servicesAPI = new ServicesAPI();
