/**
 * 仙宫云实例自动化管理系统
 * 实现实例的自动启动、停止和生命周期管理
 */

interface XiangongInstance {
  instanceId: string;
  name: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  lastActivity: Date;
  ports: number[];
  services: string[];
}

interface XiangongConfig {
  apiKey: string;
  instanceId: string;
  apiBaseUrl: string;
}

class XiangongInstanceManager {
  private config: XiangongConfig;
  private instance: XiangongInstance;
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000; // 30分钟
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    this.config = {
      apiKey: process.env.VITE_XIANGONG_API_KEY || 'miv4n5hh6313imnijhgqpzqbb0at3xxlm2l24x7r',
      instanceId: '3iaszw98tkh12h9x',
      apiBaseUrl: 'https://api-playground.xiangongyun.com'
    };

    this.instance = {
      instanceId: this.config.instanceId,
      name: 'prome',
      status: 'stopped',
      lastActivity: new Date(),
      ports: [7860, 8000], // infinitetalk, indextts2
      services: ['infinitetalk', 'indextts2']
    };

    this.startHealthCheck();
  }

  /**
   * 调用仙宫云管理API
   */
  private async callXiangongAPI(endpoint: string, method = 'GET', body?: any): Promise<any> {
    const url = `${this.config.apiBaseUrl}${endpoint}`;
    
    try {
      console.log(`🔗 调用仙宫云API: ${method} ${url}`);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API调用失败 (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ API调用成功:`, result);
      return result;
    } catch (error) {
      console.error(`❌ API调用失败:`, error);
      throw error;
    }
  }

  /**
   * 启动实例
   */
  async startInstance(): Promise<void> {
    if (this.instance.status === 'running') {
      console.log(`✅ 实例已在运行`);
      this.updateActivity();
      return;
    }

    if (this.instance.status === 'starting') {
      console.log(`⏳ 实例正在启动中...`);
      return;
    }

    try {
      this.instance.status = 'starting';
      console.log(`🚀 启动仙宫云实例: ${this.instance.instanceId}`);

      // 调用启动API
      await this.callXiangongAPI(`/open/instances/${this.instance.instanceId}/start`, 'POST');

      // 等待实例启动
      await this.waitForInstanceReady();

      this.instance.status = 'running';
      this.updateActivity();
      
      console.log(`✅ 实例启动成功`);
    } catch (error) {
      this.instance.status = 'error';
      console.error(`❌ 实例启动失败:`, error);
      throw error;
    }
  }

  /**
   * 停止实例
   */
  async stopInstance(): Promise<void> {
    if (this.instance.status === 'stopped') {
      console.log(`⏹️ 实例已停止`);
      return;
    }

    if (this.instance.status === 'stopping') {
      console.log(`⏳ 实例正在停止中...`);
      return;
    }

    try {
      this.instance.status = 'stopping';
      console.log(`⏸️ 停止仙宫云实例: ${this.instance.instanceId}`);

      // 调用停止API
      await this.callXiangongAPI(`/open/instances/${this.instance.instanceId}/stop`, 'POST');

      this.instance.status = 'stopped';
      console.log(`⏹️ 实例已停止`);
    } catch (error) {
      this.instance.status = 'error';
      console.error(`❌ 实例停止失败:`, error);
      throw error;
    }
  }

  /**
   * 获取实例状态
   */
  async getInstanceStatus(): Promise<any> {
    try {
      const status = await this.callXiangongAPI(`/open/instances/${this.instance.instanceId}`);
      
      // 更新本地状态
      if (status.status) {
        this.instance.status = this.mapStatusFromAPI(status.status);
      }
      
      return status;
    } catch (error) {
      console.error(`❌ 获取实例状态失败:`, error);
      return null;
    }
  }

  /**
   * 映射API状态到本地状态
   */
  private mapStatusFromAPI(apiStatus: string): XiangongInstance['status'] {
    switch (apiStatus.toLowerCase()) {
      case 'running': return 'running';
      case 'stopped': return 'stopped';
      case 'starting': return 'starting';
      case 'stopping': return 'stopping';
      default: return 'error';
    }
  }

  /**
   * 等待实例准备就绪
   */
  private async waitForInstanceReady(maxRetries = 30): Promise<void> {
    console.log(`⏳ 等待实例启动...`);
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const status = await this.getInstanceStatus();
        
        if (status && status.status === 'running') {
          // 额外等待服务启动
          await this.waitForServicesReady();
          return;
        }
        
        console.log(`⏳ 启动中... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // 等待10秒
      } catch (error) {
        console.log(`⚠️ 状态检查失败，继续等待...`);
      }
    }
    
    throw new Error('实例启动超时');
  }

  /**
   * 等待服务准备就绪
   */
  private async waitForServicesReady(): Promise<void> {
    console.log(`🔍 等待服务启动...`);
    
    const serviceUrls = [
      `https://${this.instance.instanceId}-7860.container.x-gpu.com`,
      `https://${this.instance.instanceId}-8000.container.x-gpu.com`
    ];
    
    // 等待至少有一个服务可用
    for (let i = 0; i < 20; i++) {
      for (const url of serviceUrls) {
        try {
          const response = await fetch(url, { 
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          });
          
          if (response.status < 500) { // 非服务器错误即可
            console.log(`✅ 服务已启动: ${url}`);
            return;
          }
        } catch (error) {
          // 继续检查
        }
      }
      
      console.log(`⏳ 等待服务启动... (${i + 1}/20)`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
    }
    
    console.log(`⚠️ 服务启动可能需要更多时间，但实例已运行`);
  }

  /**
   * 确保实例运行（智能启动）
   */
  async ensureInstanceRunning(): Promise<void> {
    const status = await this.getInstanceStatus();
    
    if (!status || status.status !== 'running') {
      console.log(`🔄 实例未运行，自动启动...`);
      await this.startInstance();
    } else {
      console.log(`✅ 实例正在运行`);
      this.instance.status = 'running';
      this.updateActivity();
    }
  }

  /**
   * 更新活动时间
   */
  updateActivity(): void {
    this.instance.lastActivity = new Date();
    console.log(`🕐 更新活动时间: ${this.instance.lastActivity.toLocaleTimeString()}`);
  }

  /**
   * 健康检查和自动停机
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (this.instance.status !== 'running' || this.isShuttingDown) {
        return;
      }
      
      const now = new Date().getTime();
      const idleTime = now - this.instance.lastActivity.getTime();
      
      if (idleTime > this.IDLE_TIMEOUT) {
        console.log(`⏰ 实例闲置超过30分钟，自动停止...`);
        this.isShuttingDown = true;
        
        try {
          await this.stopInstance();
        } catch (error) {
          console.error(`自动停止实例失败:`, error);
        } finally {
          this.isShuttingDown = false;
        }
      }
    }, 60000); // 每分钟检查一次
  }

  /**
   * 获取服务URL
   */
  getServiceUrls(): { infinitetalk: string; indextts2: string } {
    return {
      infinitetalk: `https://${this.instance.instanceId}-7860.container.x-gpu.com`,
      indextts2: `https://${this.instance.instanceId}-8000.container.x-gpu.com`
    };
  }

  /**
   * 获取实例信息
   */
  getInstanceInfo(): XiangongInstance {
    return { ...this.instance };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// 导出单例实例
export const xiangongInstanceManager = new XiangongInstanceManager();
export default xiangongInstanceManager;