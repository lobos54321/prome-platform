import { ModelConfig, PriceChangeLog, ExchangeRateHistory, PointsConfig, RechargePackage } from '@/types';
import { isAdmin, requireAdmin } from './admin';
import { authService } from './auth';

// Admin Services API for managing pricing, models, and system configuration
class AdminServicesAPI {
  private modelConfigs: ModelConfig[] = [];
  private priceChangeLogs: PriceChangeLog[] = [];
  private exchangeRateHistory: ExchangeRateHistory[] = [];
  private currentExchangeRate: number = 10000; // Default: 10000 points = 1 USD
  private rechargePackages: RechargePackage[] = [];

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Initialize with some default model configurations
    this.modelConfigs = [
      {
        id: '1',
        modelName: 'GPT-4',
        inputTokenPrice: 50, // 50 credits per 1000 input tokens
        outputTokenPrice: 100, // 100 credits per 1000 output tokens
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'lobos54321@gmail.com'
      },
      {
        id: '2',
        modelName: 'GPT-3.5-Turbo',
        inputTokenPrice: 20, // 20 credits per 1000 input tokens
        outputTokenPrice: 40, // 40 credits per 1000 output tokens
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'lobos54321@gmail.com'
      },
      {
        id: '3',
        modelName: 'Claude-3-Opus',
        inputTokenPrice: 30, // 30 credits per 1000 input tokens
        outputTokenPrice: 60, // 60 credits per 1000 output tokens
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'lobos54321@gmail.com'
      }
    ];

    // Initialize default recharge packages
    this.rechargePackages = [
      {
        id: '1',
        name: 'Basic Plan',
        usdAmount: 10,
        creditsAmount: 10000,
        isPopular: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'lobos54321@gmail.com'
      },
      {
        id: '2',
        name: 'Popular Plan',
        usdAmount: 25,
        creditsAmount: 25000,
        isPopular: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'lobos54321@gmail.com'
      },
      {
        id: '3',
        name: 'Advanced Plan',
        usdAmount: 50,
        creditsAmount: 50000,
        isPopular: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'lobos54321@gmail.com'
      },
      {
        id: '4',
        name: 'Professional Plan',
        usdAmount: 100,
        creditsAmount: 100000,
        isPopular: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'lobos54321@gmail.com'
      }
    ];
  }

  private logPriceChange(
    modelId: string,
    modelName: string,
    changeType: PriceChangeLog['changeType'],
    oldValue: number | boolean,
    newValue: number | boolean,
    reason?: string
  ) {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);

    const log: PriceChangeLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      modelId,
      modelName,
      changeType,
      oldValue,
      newValue,
      adminEmail: user!.email,
      reason,
      timestamp: new Date().toISOString()
    };

    this.priceChangeLogs.unshift(log);
    console.log('Price change logged:', log);
  }

  private logExchangeRateChange(oldRate: number, newRate: number, reason?: string) {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);

    const log: ExchangeRateHistory = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      oldRate,
      newRate,
      adminEmail: user!.email,
      reason,
      timestamp: new Date().toISOString()
    };

    this.exchangeRateHistory.unshift(log);
    console.log('Exchange rate change logged:', log);
  }

  // Model Configuration Management
  async getModelConfigs(): Promise<ModelConfig[]> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);
    return [...this.modelConfigs];
  }

  async getModelConfig(id: string): Promise<ModelConfig | null> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);
    return this.modelConfigs.find(config => config.id === id) || null;
  }

  async addModelConfig(config: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<ModelConfig> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);

    const newConfig: ModelConfig = {
      ...config,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user!.email
    };

    this.modelConfigs.push(newConfig);
    
    // Log the addition
    this.logPriceChange(
      newConfig.id,
      newConfig.modelName,
      'input_price',
      0,
      newConfig.inputTokenPrice,
      `Model ${newConfig.modelName} added to system`
    );

    return newConfig;
  }

  async updateModelConfig(id: string, updates: Partial<ModelConfig>): Promise<ModelConfig> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);

    const configIndex = this.modelConfigs.findIndex(config => config.id === id);
    if (configIndex === -1) {
      throw new Error('Model configuration not found');
    }

    const oldConfig = this.modelConfigs[configIndex];
    const updatedConfig = {
      ...oldConfig,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Log changes
    if (updates.inputTokenPrice !== undefined && updates.inputTokenPrice !== oldConfig.inputTokenPrice) {
      this.logPriceChange(
        id,
        oldConfig.modelName,
        'input_price',
        oldConfig.inputTokenPrice,
        updates.inputTokenPrice,
        'Input token price updated'
      );
    }

    if (updates.outputTokenPrice !== undefined && updates.outputTokenPrice !== oldConfig.outputTokenPrice) {
      this.logPriceChange(
        id,
        oldConfig.modelName,
        'output_price',
        oldConfig.outputTokenPrice,
        updates.outputTokenPrice,
        'Output token price updated'
      );
    }

    if (updates.isActive !== undefined && updates.isActive !== oldConfig.isActive) {
      this.logPriceChange(
        id,
        oldConfig.modelName,
        'status',
        oldConfig.isActive,
        updates.isActive,
        `Model ${updates.isActive ? 'activated' : 'deactivated'}`
      );
    }

    this.modelConfigs[configIndex] = updatedConfig;
    return updatedConfig;
  }

  async deleteModelConfig(id: string): Promise<void> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);

    const configIndex = this.modelConfigs.findIndex(config => config.id === id);
    if (configIndex === -1) {
      throw new Error('Model configuration not found');
    }

    const config = this.modelConfigs[configIndex];
    this.modelConfigs.splice(configIndex, 1);

    // Log deletion
    this.logPriceChange(
      id,
      config.modelName,
      'status',
      true,
      false,
      `Model ${config.modelName} deleted from system`
    );
  }

  // Exchange Rate Management
  async getExchangeRate(): Promise<number> {
    return this.currentExchangeRate;
  }

  async updateExchangeRate(newRate: number, reason?: string): Promise<number> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);

    const oldRate = this.currentExchangeRate;
    this.currentExchangeRate = newRate;

    // Log the change
    this.logExchangeRateChange(oldRate, newRate, reason);

    return newRate;
  }

  // Price Change History
  async getPriceChangeLogs(modelId?: string, limit: number = 50): Promise<PriceChangeLog[]> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);

    let logs = [...this.priceChangeLogs];
    
    if (modelId) {
      logs = logs.filter(log => log.modelId === modelId);
    }

    return logs.slice(0, limit);
  }

  async getExchangeRateHistory(limit: number = 20): Promise<ExchangeRateHistory[]> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);

    return this.exchangeRateHistory.slice(0, limit);
  }

  // Rollback functionality
  async rollbackPriceChange(logId: string): Promise<void> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);

    const log = this.priceChangeLogs.find(l => l.id === logId);
    if (!log) {
      throw new Error('Price change log not found');
    }

    const config = this.modelConfigs.find(c => c.id === log.modelId);
    if (!config) {
      throw new Error('Model configuration not found');
    }

    // Rollback the change
    switch (log.changeType) {
      case 'input_price':
        await this.updateModelConfig(log.modelId, { 
          inputTokenPrice: log.oldValue as number 
        });
        break;
      case 'output_price':
        await this.updateModelConfig(log.modelId, { 
          outputTokenPrice: log.oldValue as number 
        });
        break;
      case 'status':
        await this.updateModelConfig(log.modelId, { 
          isActive: log.oldValue as boolean 
        });
        break;
      case 'exchange_rate':
        await this.updateExchangeRate(
          log.oldValue as number, 
          `Rollback from rate ${log.newValue} to ${log.oldValue}`
        );
        break;
    }
  }

  // Cost calculation utilities
  calculateCostInCredits(modelName: string, inputTokens: number, outputTokens: number): number {
    const config = this.modelConfigs.find(c => c.modelName === modelName && c.isActive);
    if (!config) {
      throw new Error(`Model ${modelName} not found or inactive`);
    }

    const inputCost = (inputTokens / 1000) * config.inputTokenPrice;
    const outputCost = (outputTokens / 1000) * config.outputTokenPrice;
    
    return Math.ceil(inputCost + outputCost); // Round up to nearest credit
  }

  calculateCostInUSD(modelName: string, inputTokens: number, outputTokens: number): number {
    const costInCredits = this.calculateCostInCredits(modelName, inputTokens, outputTokens);
    return costInCredits / this.currentExchangeRate;
  }

  convertUSDToCredits(usdAmount: number): number {
    return Math.floor(usdAmount * this.currentExchangeRate);
  }

  convertCreditsToUSD(credits: number): number {
    return credits / this.currentExchangeRate;
  }

  // Price impact analysis
  async analyzePriceImpact(modelId: string, newInputPrice?: number, newOutputPrice?: number): Promise<{
    currentCost: { credits: number; usd: number };
    newCost: { credits: number; usd: number };
    percentageChange: number;
    sampleScenarios: Array<{
      scenario: string;
      inputTokens: number;
      outputTokens: number;
      currentCost: number;
      newCost: number;
      difference: number;
    }>;
  }> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);

    const config = this.modelConfigs.find(c => c.id === modelId);
    if (!config) {
      throw new Error('Model configuration not found');
    }

    // Sample scenarios for impact analysis
    const scenarios = [
      { scenario: '简单对话', inputTokens: 100, outputTokens: 50 },
      { scenario: '中等任务', inputTokens: 500, outputTokens: 300 },
      { scenario: '复杂任务', inputTokens: 1500, outputTokens: 1000 },
      { scenario: '大型项目', inputTokens: 5000, outputTokens: 3000 }
    ];

    const currentInputPrice = config.inputTokenPrice;
    const currentOutputPrice = config.outputTokenPrice;
    const testInputPrice = newInputPrice ?? currentInputPrice;
    const testOutputPrice = newOutputPrice ?? currentOutputPrice;

    // Calculate for 1000 tokens (standard comparison)
    const currentCostCredits = (1000 / 1000) * currentInputPrice + (500 / 1000) * currentOutputPrice;
    const newCostCredits = (1000 / 1000) * testInputPrice + (500 / 1000) * testOutputPrice;
    
    const percentageChange = ((newCostCredits - currentCostCredits) / currentCostCredits) * 100;

    const sampleScenarios = scenarios.map(scenario => {
      const currentCost = (scenario.inputTokens / 1000) * currentInputPrice + 
                         (scenario.outputTokens / 1000) * currentOutputPrice;
      const newCost = (scenario.inputTokens / 1000) * testInputPrice + 
                     (scenario.outputTokens / 1000) * testOutputPrice;
      
      return {
        ...scenario,
        currentCost: Math.ceil(currentCost),
        newCost: Math.ceil(newCost),
        difference: Math.ceil(newCost - currentCost)
      };
    });

    return {
      currentCost: {
        credits: Math.ceil(currentCostCredits),
        usd: currentCostCredits / this.currentExchangeRate
      },
      newCost: {
        credits: Math.ceil(newCostCredits),
        usd: newCostCredits / this.currentExchangeRate
      },
      percentageChange,
      sampleScenarios
    };
  }

  // Recharge Package Management
  async getRechargePackages(): Promise<RechargePackage[]> {
    // Public method - no admin check needed for viewing packages
    return this.rechargePackages.filter(pkg => pkg.isActive);
  }

  async getAllRechargePackages(): Promise<RechargePackage[]> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);
    return [...this.rechargePackages];
  }

  async getRechargePackage(id: string): Promise<RechargePackage | null> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);
    return this.rechargePackages.find(pkg => pkg.id === id) || null;
  }

  async addRechargePackage(pkg: Omit<RechargePackage, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<RechargePackage> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);

    const newPackage: RechargePackage = {
      ...pkg,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user!.email
    };

    this.rechargePackages.push(newPackage);
    return newPackage;
  }

  async updateRechargePackage(id: string, updates: Partial<RechargePackage>): Promise<RechargePackage> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);

    const pkgIndex = this.rechargePackages.findIndex(pkg => pkg.id === id);
    if (pkgIndex === -1) {
      throw new Error('Recharge package not found');
    }

    const updatedPackage = {
      ...this.rechargePackages[pkgIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.rechargePackages[pkgIndex] = updatedPackage;
    return updatedPackage;
  }

  async deleteRechargePackage(id: string): Promise<void> {
    const user = authService.getCurrentUserSync();
    requireAdmin(user);

    const pkgIndex = this.rechargePackages.findIndex(pkg => pkg.id === id);
    if (pkgIndex === -1) {
      throw new Error('Recharge package not found');
    }

    this.rechargePackages.splice(pkgIndex, 1);
  }
}

export const adminServicesAPI = new AdminServicesAPI();