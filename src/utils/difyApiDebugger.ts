/**
 * Dify API调试器 - 诊断为什么没有获取到真实的usage数据
 */

export interface DifyDebugResult {
  timestamp: string;
  endpoint: string;
  requestPayload: any;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody: any;
  usageAnalysis: {
    hasMetadata: boolean;
    hasUsage: boolean;
    hasTokens: boolean;
    hasPricing: boolean;
    usageData: any;
    issues: string[];
    recommendations: string[];
  };
}

export class DifyApiDebugger {
  private static debugHistory: DifyDebugResult[] = [];

  /**
   * 调试Dify API调用并分析响应
   */
  static async debugApiCall(
    endpoint: string,
    payload: any,
    apiUrl: string,
    apiKey: string
  ): Promise<DifyDebugResult> {
    const timestamp = new Date().toISOString();
    console.log(`🔍 [Dify Debug] Starting API call to ${endpoint}...`);
    
    let responseStatus = 0;
    let responseHeaders: Record<string, string> = {};
    let responseBody: any = null;
    let usageAnalysis: any = {
      hasMetadata: false,
      hasUsage: false,
      hasTokens: false,
      hasPricing: false,
      usageData: null,
      issues: [],
      recommendations: []
    };

    try {
      // 1. 构建正确的请求
      const fullUrl = `${apiUrl}${endpoint}`;
      
      console.log(`🔍 [Dify Debug] Making request to: ${fullUrl}`);
      console.log(`🔍 [Dify Debug] Request payload:`, JSON.stringify(payload, null, 2));
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      responseStatus = response.status;
      
      // 2. 分析响应头
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      console.log(`🔍 [Dify Debug] Response status: ${responseStatus}`);
      console.log(`🔍 [Dify Debug] Response headers:`, responseHeaders);
      
      // 3. 分析响应体
      if (response.ok) {
        responseBody = await response.json();
        console.log(`🔍 [Dify Debug] Response body:`, JSON.stringify(responseBody, null, 2));
        
        // 4. 详细分析usage数据
        usageAnalysis = this.analyzeUsageData(responseBody);
      } else {
        const errorText = await response.text();
        responseBody = { error: errorText };
        usageAnalysis.issues.push(`API call failed with status ${responseStatus}`);
        usageAnalysis.recommendations.push('Check API key and endpoint configuration');
      }

    } catch (error) {
      console.error(`🔍 [Dify Debug] Request failed:`, error);
      usageAnalysis.issues.push(`Network error: ${error.message}`);
      usageAnalysis.recommendations.push('Check network connectivity and API URL');
    }

    const result: DifyDebugResult = {
      timestamp,
      endpoint,
      requestPayload: payload,
      responseStatus,
      responseHeaders,
      responseBody,
      usageAnalysis
    };

    // 保存调试历史
    this.debugHistory.unshift(result);
    if (this.debugHistory.length > 20) {
      this.debugHistory = this.debugHistory.slice(0, 20);
    }

    // 输出详细诊断
    this.printDiagnostics(result);
    
    return result;
  }

  /**
   * 分析usage数据结构
   */
  private static analyzeUsageData(responseBody: any) {
    const analysis = {
      hasMetadata: false,
      hasUsage: false,
      hasTokens: false,
      hasPricing: false,
      usageData: null,
      issues: [],
      recommendations: []
    };

    if (!responseBody) {
      analysis.issues.push('No response body received');
      return analysis;
    }

    // 检查metadata结构
    if (responseBody.metadata) {
      analysis.hasMetadata = true;
      console.log(`✅ [Usage Analysis] Found metadata`);
      
      // 检查usage字段
      if (responseBody.metadata.usage) {
        analysis.hasUsage = true;
        analysis.usageData = responseBody.metadata.usage;
        console.log(`✅ [Usage Analysis] Found usage data:`, analysis.usageData);
        
        // 检查token数据
        const usage = responseBody.metadata.usage;
        if (usage.total_tokens && usage.total_tokens > 0) {
          analysis.hasTokens = true;
          console.log(`✅ [Usage Analysis] Found tokens: ${usage.total_tokens}`);
        } else {
          analysis.issues.push('total_tokens is 0 or missing');
          analysis.recommendations.push('Check if Dify app has LLM nodes configured');
        }
        
        // 检查价格数据
        if (usage.total_price && parseFloat(usage.total_price) > 0) {
          analysis.hasPricing = true;
          console.log(`✅ [Usage Analysis] Found pricing: ${usage.total_price}`);
        } else {
          analysis.issues.push('total_price is 0 or missing');
          analysis.recommendations.push('Check Dify account billing configuration');
          analysis.recommendations.push('Verify API key has pricing access permissions');
        }
        
        // 详细token分析
        if (usage.prompt_tokens === 0 && usage.completion_tokens === 0) {
          analysis.issues.push('Both prompt_tokens and completion_tokens are 0');
          analysis.recommendations.push('Verify LLM nodes are actually processing in the workflow');
          analysis.recommendations.push('Check if the app is using cached responses');
        }
        
      } else {
        analysis.issues.push('metadata.usage field is missing');
        analysis.recommendations.push('Ensure the Dify app is configured to return usage statistics');
      }
    } else {
      analysis.issues.push('metadata field is missing from response');
      analysis.recommendations.push('Check if using the correct Dify API endpoint');
      analysis.recommendations.push('Verify the app type supports usage tracking');
    }

    // 检查是否有其他可能的usage字段位置
    if (responseBody.usage) {
      console.log(`🔍 [Usage Analysis] Found alternative usage location:`, responseBody.usage);
      if (!analysis.hasUsage) {
        analysis.usageData = responseBody.usage;
        analysis.hasUsage = true;
      }
    }

    return analysis;
  }

  /**
   * 打印详细诊断信息
   */
  private static printDiagnostics(result: DifyDebugResult) {
    console.log(`\n🔍 ===== DIFY API DIAGNOSTIC REPORT =====`);
    console.log(`⏰ Timestamp: ${result.timestamp}`);
    console.log(`📍 Endpoint: ${result.endpoint}`);
    console.log(`📊 Status: ${result.responseStatus}`);
    
    const analysis = result.usageAnalysis;
    
    console.log(`\n📋 Usage Data Analysis:`);
    console.log(`  ✅ Has Metadata: ${analysis.hasMetadata}`);
    console.log(`  ✅ Has Usage: ${analysis.hasUsage}`);
    console.log(`  ✅ Has Tokens: ${analysis.hasTokens}`);
    console.log(`  ✅ Has Pricing: ${analysis.hasPricing}`);
    
    if (analysis.usageData) {
      console.log(`\n💾 Usage Data Details:`);
      console.log(`  🔢 Prompt Tokens: ${analysis.usageData.prompt_tokens || 0}`);
      console.log(`  🔢 Completion Tokens: ${analysis.usageData.completion_tokens || 0}`);
      console.log(`  🔢 Total Tokens: ${analysis.usageData.total_tokens || 0}`);
      console.log(`  💰 Total Price: ${analysis.usageData.total_price || 'N/A'}`);
      console.log(`  💱 Currency: ${analysis.usageData.currency || 'N/A'}`);
    }
    
    if (analysis.issues.length > 0) {
      console.log(`\n🚨 Issues Found:`);
      analysis.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
    }
    
    if (analysis.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      analysis.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }
    
    console.log(`\n🔍 ===== END DIAGNOSTIC REPORT =====\n`);
  }

  /**
   * 获取调试历史
   */
  static getDebugHistory(): DifyDebugResult[] {
    return [...this.debugHistory];
  }

  /**
   * 生成完整的诊断报告
   */
  static generateReport(): string {
    const recentDebugs = this.debugHistory.slice(0, 5);
    
    if (recentDebugs.length === 0) {
      return '📋 No debugging data available. Call debugApiCall() first.';
    }

    let report = `
🔍 DIFY API 调试报告
========================

📊 最近 ${recentDebugs.length} 次API调用分析:

`;

    recentDebugs.forEach((debug, i) => {
      const analysis = debug.usageAnalysis;
      const status = debug.responseStatus === 200 ? '✅' : '❌';
      
      report += `
${i + 1}. ${status} ${debug.endpoint} (${debug.responseStatus})
   ⏰ ${new Date(debug.timestamp).toLocaleString()}
   📊 Usage: ${analysis.hasUsage ? '✅' : '❌'} | Tokens: ${analysis.hasTokens ? '✅' : '❌'} | Pricing: ${analysis.hasPricing ? '✅' : '❌'}
`;

      if (analysis.usageData) {
        report += `   💾 Data: ${analysis.usageData.total_tokens || 0} tokens, $${analysis.usageData.total_price || 0}\n`;
      }

      if (analysis.issues.length > 0) {
        report += `   ⚠️  Issues: ${analysis.issues.slice(0, 2).join(', ')}\n`;
      }
    });

    // 总结常见问题
    const allIssues = recentDebugs.flatMap(d => d.usageAnalysis.issues);
    const commonIssues = allIssues.reduce((acc, issue) => {
      acc[issue] = (acc[issue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(commonIssues).length > 0) {
      report += `\n🔥 常见问题:
`;
      Object.entries(commonIssues)
        .sort(([,a], [,b]) => b - a)
        .forEach(([issue, count]) => {
          report += `   • ${issue} (出现 ${count} 次)\n`;
        });
    }

    // 关键建议
    report += `
💡 关键检查项目:
   1. 检查Dify控制台中的应用配置
   2. 确认LLM节点已正确配置并启用
   3. 验证API密钥具有usage统计权限
   4. 检查Dify账户余额和计费状态
   5. 确认使用正确的API端点 (/chat-messages vs /workflows/run)

📋 生成时间: ${new Date().toLocaleString()}
`;

    return report;
  }

  /**
   * 清空调试历史
   */
  static clearHistory() {
    this.debugHistory = [];
    console.log('🔍 [Dify Debug] History cleared');
  }
}

// 在开发环境中暴露到全局
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).DifyApiDebugger = DifyApiDebugger;
}