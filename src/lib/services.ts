import { authService } from './auth';
import { db } from './supabase';

// 安全的服务 API 包装器
export class ServicesAPI {
  
  // 安全获取 Token 使用情况
  static async getTokenUsage() {
    return authService.safeServiceCall(
      (userId) => db.getTokenUsage(userId),
      []
    );
  }
  
  // 安全获取账单记录
  static async getBillingRecords() {
    return authService.safeServiceCall(
      (userId) => db.getBillingRecords(userId),
      []
    );
  }
  
  // 安全添加 Token 使用记录
  static async addTokenUsage(service: string, tokensUsed: number, cost: number) {
    return authService.safeServiceCall(
      (userId) => db.addTokenUsage(userId, service, tokensUsed, cost),
      null
    );
  }
  
  // 安全添加账单记录
  static async addBillingRecord(
    type: 'charge' | 'refund',
    amount: number,
    description: string
  ) {
    return authService.safeServiceCall(
      (userId) => db.addBillingRecord(userId, type, amount, description),
      null
    );
  }
}
