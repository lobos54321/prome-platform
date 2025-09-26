/**
 * N8n集成诊断工具
 * 用于检查N8n工作流是否正常响应以及前端集成是否正确
 */

interface DiagnosticResult {
  step: string;
  success: boolean;
  message: string;
  details?: any;
  error?: string;
}

interface N8nDiagnosticReport {
  timestamp: string;
  webhookUrl: string;
  overallStatus: 'success' | 'partial' | 'failed';
  results: DiagnosticResult[];
  recommendations: string[];
}

export class N8nDiagnostic {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  /**
   * 执行完整的N8n诊断检查
   */
  async runFullDiagnostic(): Promise<N8nDiagnosticReport> {
    const results: DiagnosticResult[] = [];
    const recommendations: string[] = [];

    console.log('🔍 开始N8n诊断检查...');

    // 1. 检查URL格式
    results.push(await this.checkUrlFormat());

    // 2. 检查网络连通性
    results.push(await this.checkNetworkConnectivity());

    // 3. 检查OPTIONS预检请求
    results.push(await this.checkCorsPreflightStatus());

    // 4. 测试简单POST请求
    results.push(await this.testSimplePostRequest());

    // 5. 测试完整的聊天请求格式
    results.push(await this.testChatMessageFormat());

    // 6. 测试不同的数据格式
    results.push(await this.testMultipleDataFormats());

    // 计算整体状态
    const successCount = results.filter(r => r.success).length;
    const overallStatus = successCount === results.length ? 'success' : 
                         successCount > results.length / 2 ? 'partial' : 'failed';

    // 生成建议
    recommendations.push(...this.generateRecommendations(results));

    return {
      timestamp: new Date().toISOString(),
      webhookUrl: this.webhookUrl,
      overallStatus,
      results,
      recommendations
    };
  }

  private async checkUrlFormat(): Promise<DiagnosticResult> {
    try {
      const url = new URL(this.webhookUrl);
      const isValidN8nUrl = url.hostname.includes('n8n') || url.pathname.includes('webhook');
      
      return {
        step: 'URL格式检查',
        success: isValidN8nUrl,
        message: isValidN8nUrl ? 'URL格式正确' : 'URL格式可能有问题',
        details: {
          hostname: url.hostname,
          pathname: url.pathname,
          protocol: url.protocol
        }
      };
    } catch (error) {
      return {
        step: 'URL格式检查',
        success: false,
        message: 'URL格式无效',
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  private async checkNetworkConnectivity(): Promise<DiagnosticResult> {
    try {
      // 只检查主机是否可达，使用GET请求到根路径
      const url = new URL(this.webhookUrl);
      const baseUrl = `${url.protocol}//${url.hostname}`;
      
      const response = await fetch(baseUrl, {
        method: 'GET',
        mode: 'no-cors' // 避免CORS问题
      });

      return {
        step: '网络连通性检查',
        success: true,
        message: '网络连接正常',
        details: {
          baseUrl,
          responseType: response.type
        }
      };
    } catch (error) {
      return {
        step: '网络连通性检查',
        success: false,
        message: '网络连接失败',
        error: error instanceof Error ? error.message : '网络错误'
      };
    }
  }

  private async checkCorsPreflightStatus(): Promise<DiagnosticResult> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      return {
        step: 'CORS预检请求检查',
        success: response.ok,
        message: response.ok ? 'CORS配置正常' : `CORS配置问题 (${response.status})`,
        details: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries())
        }
      };
    } catch (error) {
      return {
        step: 'CORS预检请求检查',
        success: false,
        message: 'CORS预检失败',
        error: error instanceof Error ? error.message : 'CORS错误'
      };
    }
  }

  private async testSimplePostRequest(): Promise<DiagnosticResult> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: true, message: 'diagnostic test' })
      });

      const responseText = await response.text();
      
      return {
        step: '简单POST请求测试',
        success: response.status !== 404,
        message: response.ok ? '基础POST请求成功' : `请求失败 (${response.status})`,
        details: {
          status: response.status,
          statusText: response.statusText,
          responsePreview: responseText.substring(0, 200)
        }
      };
    } catch (error) {
      return {
        step: '简单POST请求测试',
        success: false,
        message: 'POST请求失败',
        error: error instanceof Error ? error.message : 'POST错误'
      };
    }
  }

  private async testChatMessageFormat(): Promise<DiagnosticResult> {
    try {
      const chatData = {
        action: "sendMessage",
        sessionId: `diagnostic_${Date.now()}`,
        chatInput: "测试消息：请回复任何内容以确认工作流正常运行"
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Instance-Id': '84d6fd9ee10b61931a6c88e38784cd77e15da6e05b6b01cbb7ff8ef09e5710a4'
        },
        body: JSON.stringify(chatData)
      });

      const responseText = await response.text();
      let parsedResponse;
      
      try {
        parsedResponse = JSON.parse(responseText);
      } catch {
        parsedResponse = responseText;
      }

      return {
        step: '聊天消息格式测试',
        success: response.ok,
        message: response.ok ? '聊天格式请求成功' : `聊天请求失败 (${response.status})`,
        details: {
          status: response.status,
          requestData: chatData,
          responseData: parsedResponse,
          isJson: typeof parsedResponse === 'object'
        }
      };
    } catch (error) {
      return {
        step: '聊天消息格式测试',
        success: false,
        message: '聊天格式测试失败',
        error: error instanceof Error ? error.message : '聊天测试错误'
      };
    }
  }

  private async testMultipleDataFormats(): Promise<DiagnosticResult> {
    const formats = [
      {
        name: '@n8n/chat标准格式',
        data: {
          action: "sendMessage",
          sessionId: `test_${Date.now()}`,
          chatInput: "格式测试"
        }
      },
      {
        name: '简化聊天格式',
        data: {
          chatInput: "格式测试"
        }
      },
      {
        name: '带时间戳格式',
        data: {
          sessionId: `test_${Date.now()}`,
          chatInput: "格式测试",
          timestamp: new Date().toISOString()
        }
      }
    ];

    const results = [];
    
    for (const format of formats) {
      try {
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(format.data)
        });
        
        results.push({
          format: format.name,
          status: response.status,
          success: response.ok
        });
      } catch (error) {
        results.push({
          format: format.name,
          error: error instanceof Error ? error.message : '未知错误',
          success: false
        });
      }
    }

    const successfulFormats = results.filter(r => r.success).length;
    
    return {
      step: '多格式数据测试',
      success: successfulFormats > 0,
      message: `${successfulFormats}/${formats.length} 种格式测试成功`,
      details: { results }
    };
  }

  private generateRecommendations(results: DiagnosticResult[]): string[] {
    const recommendations: string[] = [];
    
    // 检查URL问题
    const urlCheck = results.find(r => r.step === 'URL格式检查');
    if (!urlCheck?.success) {
      recommendations.push('❌ 检查N8n webhook URL格式是否正确');
    }

    // 检查网络问题
    const networkCheck = results.find(r => r.step === '网络连通性检查');
    if (!networkCheck?.success) {
      recommendations.push('❌ 检查N8n服务器是否运行，网络是否可达');
    }

    // 检查CORS问题
    const corsCheck = results.find(r => r.step === 'CORS预检请求检查');
    if (!corsCheck?.success) {
      recommendations.push('❌ 配置N8n服务器的CORS设置，允许来自前端域名的请求');
    }

    // 检查工作流问题
    const chatTest = results.find(r => r.step === '聊天消息格式测试');
    if (chatTest && !chatTest.success) {
      const status = chatTest.details?.status;
      if (status === 500) {
        recommendations.push('⚠️ N8n工作流内部错误 - 检查工作流配置、节点连接和变量设置');
        recommendations.push('💡 在N8n界面中手动测试工作流，查看执行日志');
      } else if (status === 404) {
        recommendations.push('❌ Webhook端点不存在 - 确认N8n工作流已激活且webhook触发器配置正确');
      }
    }

    // 检查格式兼容性
    const formatTest = results.find(r => r.step === '多格式数据测试');
    if (formatTest && !formatTest.success) {
      recommendations.push('⚠️ 数据格式不兼容 - 尝试调整发送到N8n的数据结构');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ 所有检查通过 - N8n集成配置正确');
    }

    return recommendations;
  }

  /**
   * 快速健康检查
   */
  async quickHealthCheck(): Promise<{ isHealthy: boolean; message: string }> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: "sendMessage",
          sessionId: `health_${Date.now()}`,
          chatInput: "健康检查"
        })
      });

      return {
        isHealthy: response.ok,
        message: response.ok ? 'N8n服务正常' : `N8n服务异常 (${response.status})`
      };
    } catch (error) {
      return {
        isHealthy: false,
        message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }
}

// 导出便捷函数
export const createN8nDiagnostic = (webhookUrl: string) => new N8nDiagnostic(webhookUrl);

export const runQuickN8nCheck = async (webhookUrl: string) => {
  const diagnostic = new N8nDiagnostic(webhookUrl);
  return await diagnostic.quickHealthCheck();
};