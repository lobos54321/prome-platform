/**
 * Dify API监控和调试工具
 * 用于诊断Dify API返回的usage数据问题
 */

export interface DifyApiDiagnostics {
  timestamp: string;
  conversationId?: string;
  messageId?: string;
  apiEndpoint: string;
  requestHeaders: Record<string, string>;
  responseData: any;
  usageData: any;
  issues: string[];
  recommendations: string[];
}

export class DifyApiMonitor {
  private static diagnosticsHistory: DifyApiDiagnostics[] = [];
  
  /**
   * 记录Dify API调用的详细信息用于调试
   */
  static logApiCall(
    endpoint: string,
    headers: Record<string, string>,
    responseData: any,
    usageData: any,
    conversationId?: string,
    messageId?: string
  ): DifyApiDiagnostics {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // 检查usage数据的完整性
    if (!usageData) {
      issues.push('响应中缺少usage数据');
      recommendations.push('检查Dify API端点是否正确配置为返回usage信息');
    } else {
      // 检查token数据
      if (!usageData.prompt_tokens || usageData.prompt_tokens === 0) {
        issues.push('prompt_tokens为0或缺失');
      }
      if (!usageData.completion_tokens || usageData.completion_tokens === 0) {
        issues.push('completion_tokens为0或缺失');  
      }
      if (!usageData.total_tokens || usageData.total_tokens === 0) {
        issues.push('total_tokens为0或缺失');
      }
      
      // 检查价格数据
      if (!usageData.total_price || parseFloat(usageData.total_price) === 0) {
        issues.push('total_price为0或缺失');
        recommendations.push('检查Dify账户是否配置了正确的模型定价');
      }
      if (!usageData.prompt_price || parseFloat(usageData.prompt_price) === 0) {
        issues.push('prompt_price为0或缺失');
      }
      if (!usageData.completion_price || parseFloat(usageData.completion_price) === 0) {
        issues.push('completion_price为0或缺失');
      }
      
      // 检查数据一致性
      const totalFromParts = (parseInt(usageData.prompt_tokens) || 0) + (parseInt(usageData.completion_tokens) || 0);
      const declaredTotal = parseInt(usageData.total_tokens) || 0;
      if (totalFromParts !== declaredTotal && declaredTotal !== 0) {
        issues.push(`token总数不一致: 计算=${totalFromParts}, 声明=${declaredTotal}`);
      }
    }
    
    // 检查API配置
    if (!headers['Authorization'] || !headers['Authorization'].includes('Bearer')) {
      issues.push('API密钥格式可能不正确');
      recommendations.push('确认Authorization header格式: Bearer <your-api-key>');
    }
    
    // 通用建议
    if (issues.length > 0) {
      recommendations.push('检查Dify控制台中的API调用日志');
      recommendations.push('验证工作流中的LLM节点是否正确配置');
      recommendations.push('确认Dify账户余额充足');
    }
    
    const diagnostics: DifyApiDiagnostics = {
      timestamp: new Date().toISOString(),
      conversationId,
      messageId,
      apiEndpoint: endpoint,
      requestHeaders: headers,
      responseData,
      usageData,
      issues,
      recommendations
    };
    
    // 保存到历史记录（最多保留最近50条）
    this.diagnosticsHistory.unshift(diagnostics);
    if (this.diagnosticsHistory.length > 50) {
      this.diagnosticsHistory = this.diagnosticsHistory.slice(0, 50);
    }
    
    // 输出诊断信息
    if (issues.length > 0) {
      console.error('🚨 [Dify API 诊断] 发现问题:', {
        endpoint,
        conversationId,
        issues,
        recommendations,
        详细数据: diagnostics
      });
    } else {
      console.log('✅ [Dify API 诊断] API调用正常');
    }
    
    return diagnostics;
  }
  
  /**
   * 获取诊断历史记录
   */
  static getDiagnosticsHistory(): DifyApiDiagnostics[] {
    return [...this.diagnosticsHistory];
  }
  
  /**
   * 生成Dify API问题排查报告
   */
  static generateTroubleshootingReport(): string {
    const recentIssues = this.diagnosticsHistory
      .slice(0, 10)
      .filter(d => d.issues.length > 0);
    
    if (recentIssues.length === 0) {
      return '✅ 最近的API调用没有发现问题';
    }
    
    const commonIssues: Record<string, number> = {};
    const commonRecommendations: Set<string> = new Set();
    
    recentIssues.forEach(d => {
      d.issues.forEach(issue => {
        commonIssues[issue] = (commonIssues[issue] || 0) + 1;
      });
      d.recommendations.forEach(rec => {
        commonRecommendations.add(rec);
      });
    });
    
    const sortedIssues = Object.entries(commonIssues)
      .sort(([,a], [,b]) => b - a)
      .map(([issue, count]) => `• ${issue} (出现${count}次)`);
    
    return `
🚨 Dify API 问题排查报告

📊 最近${recentIssues.length}次API调用发现的问题:
${sortedIssues.join('\n')}

🔧 建议的解决方案:
${Array.from(commonRecommendations).map(rec => `• ${rec}`).join('\n')}

📋 详细调试步骤:
1. 登录Dify控制台查看API调用日志
2. 检查工作流配置中的LLM节点设置
3. 验证API密钥权限和账户余额
4. 测试简单的API调用确认基础连接
5. 如问题持续，联系Dify技术支持

最后更新: ${new Date().toISOString()}
    `.trim();
  }
  
  /**
   * 清空诊断历史
   */
  static clearHistory(): void {
    this.diagnosticsHistory = [];
    console.log('[Dify API Monitor] 诊断历史已清空');
  }
}

/**
 * 用于开发者控制台的全局调试工具
 */
declare global {
  interface Window {
    DifyDebug: {
      monitor: typeof DifyApiMonitor;
      getReport: () => string;
      clearHistory: () => void;
    };
  }
}

// 在开发环境中暴露调试工具到全局
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.DifyDebug = {
    monitor: DifyApiMonitor,
    getReport: () => DifyApiMonitor.generateTroubleshootingReport(),
    clearHistory: () => DifyApiMonitor.clearHistory()
  };
}