import { authService } from './auth';
import { db } from './supabase';
import { Service, PricingRule, TokenUsage, BillingRecord } from '@/types';

// 安全的服务 API 包装器
class ServicesAPI {
  
  // 安全获取 Token 使用情况
  async getTokenUsage(userId?: string) {
    if (userId) {
      // 如果提供了 userId，直接使用
      try {
        return await db.getTokenUsage(userId);
      } catch (error) {
        console.warn('Failed to get token usage:', error);
        return [];
      }
    }
    
    // 否则使用安全调用
    return authService.safeServiceCall(
      (userId) => db.getTokenUsage(userId),
      []
    );
  }
  
  // 安全获取账单记录
  async getBillingRecords(userId?: string) {
    if (userId) {
      // 如果提供了 userId，直接使用
      try {
        return await db.getBillingRecords(userId);
      } catch (error) {
        console.warn('Failed to get billing records:', error);
        return [];
      }
    }
    
    // 否则使用安全调用
    return authService.safeServiceCall(
      (userId) => db.getBillingRecords(userId),
      []
    );
  }
  
  // 安全添加 Token 使用记录
  async addTokenUsage(service: string, tokensUsed: number, cost: number) {
    return authService.safeServiceCall(
      (userId) => db.addTokenUsage(userId, service, tokensUsed, cost),
      null
    );
  }
  
  // 安全添加账单记录
  async addBillingRecord(
    type: 'charge' | 'usage',
    amount: number,
    description: string
  ) {
    return authService.safeServiceCall(
      (userId) => db.addBillingRecord(userId, type, amount, description),
      null
    );
  }

  // 获取服务列表（模拟数据，因为您的项目中使用了这个方法）
  async getServices(): Promise<Service[]> {
    // 这里返回模拟数据，您可以根据实际需求修改
    return [
      {
        id: 'live-script-generator',
        name: '直播口播文案生成器',
        description: '为直播带货生成专业的口播文案，提升转化率',
        category: '直播',
        features: ['智能文案生成', '多风格选择', '实时预览'],
        pricePerToken: 0.01,
        popular: true,
        difyUrl: 'https://udify.app/chatbot/is3TxuUUaboPKblZ'
      },
      {
        id: 'short-video-script',
        name: '短视频口播脚本',
        description: '为短视频内容创作专业的口播脚本',
        category: '短视频',
        features: ['快速生成', '多平台适配', '时长控制'],
        pricePerToken: 0.008,
        popular: true,
        difyUrl: 'https://udify.app/chatbot/is3TxuUUaboPKblZ'
      },
      {
        id: 'content-writing',
        name: '智能写作助手',
        description: '基于AI的内容创作和文案生成服务',
        category: '内容创作',
        features: ['智能文案生成', '多风格适配', 'SEO优化'],
        pricePerToken: 0.02,
        popular: false,
        difyUrl: 'https://udify.app/chatbot/is3TxuUUaboPKblZ'
      },
      {
        id: 'code-assistant',
        name: '代码生成助手',
        description: '智能代码生成和调试服务',
        category: '开发工具',
        features: ['代码生成', '错误检测', '性能优化建议'],
        pricePerToken: 0.03,
        popular: false,
        difyUrl: 'https://udify.app/chatbot/is3TxuUUaboPKblZ'
      }
    ];
  }

  // 获取单个服务
  async getService(serviceId: string): Promise<Service | null> {
    const services = await this.getServices();
    return services.find(s => s.id === serviceId) || null;
  }

  // 获取定价规则（模拟数据）
  async getPricingRules(): Promise<PricingRule[]> {
    return [
      {
        id: '1',
        modelName: 'GPT-4',
        inputTokenPrice: 0.0001,
        outputTokenPrice: 0.0002,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '2', 
        modelName: 'GPT-3.5',
        inputTokenPrice: 0.00005,
        outputTokenPrice: 0.0001,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '3',
        modelName: 'Claude 3 Opus',
        inputTokenPrice: 0.00015,
        outputTokenPrice: 0.00025,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  // 添加定价规则
  async addPricingRule(rule: Omit<PricingRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<PricingRule> {
    const newRule: PricingRule = {
      ...rule,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return newRule;
  }

  // 更新定价规则
  async updatePricingRule(id: string, updates: Partial<PricingRule>): Promise<PricingRule> {
    const rules = await this.getPricingRules();
    const rule = rules.find(r => r.id === id);
    if (!rule) {
      throw new Error('Pricing rule not found');
    }
    
    const updatedRule = {
      ...rule,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return updatedRule;
  }

  // 删除定价规则
  async deletePricingRule(id: string): Promise<void> {
    // 模拟删除操作
    console.log('Deleting pricing rule:', id);
  }

  // AI聊天服务（模拟）
  async chat(messages: Record<string, unknown>[], settings: Record<string, unknown>): Promise<Record<string, unknown>> {
    // 模拟AI响应
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          content: '这是一个模拟的AI响应。在实际项目中，这里会调用真实的AI服务。',
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalCost: 0.015
          }
        });
      }, 1000);
    });
  }
}

// 导出实例，保持与现有代码的兼容性
export const servicesAPI = new ServicesAPI();

// 同时导出类，以备将来需要
export { ServicesAPI };
