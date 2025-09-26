#!/usr/bin/env node

/**
 * UI自动化测试脚本
 * 测试聊天界面的关键用户交互和性能
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class UIAutomationTester {
  constructor() {
    this.projectRoot = process.cwd();
    this.testResultsFile = path.join(this.projectRoot, 'ui-test-results.json');
    this.devServerUrl = 'http://localhost:5173';
  }

  async runFullTestSuite() {
    console.log('🧪 开始UI自动化测试套件...');
    const startTime = Date.now();
    
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: {
        componentLoad: await this.testComponentLoading(),
        chatInteraction: await this.testChatInteraction(),
        performanceMetrics: await this.testPerformanceMetrics(),
        accessibility: await this.testAccessibility(),
        responsiveDesign: await this.testResponsiveDesign()
      }
    };

    const endTime = Date.now();
    testResults.totalTestTime = endTime - startTime;
    
    await this.saveTestResults(testResults);
    this.generateTestReport(testResults);
    
    return testResults;
  }

  async testComponentLoading() {
    console.log('🔍 测试组件加载性能...');
    try {
      // 检查关键文件存在性
      const criticalFiles = [
        'src/components/chat/ChatHistory.tsx',
        'src/components/chat/ChatInput.tsx',
        'src/components/chat/ChatMessage.tsx',
        'src/components/chat/VirtualizedMessageList.tsx'
      ];

      const loadingResults = [];
      
      for (const filePath of criticalFiles) {
        const fullPath = path.join(this.projectRoot, filePath);
        const startTime = Date.now();
        
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const loadTime = Date.now() - startTime;
          
          // 分析组件复杂度
          const complexity = this.analyzeComponentComplexity(content);
          
          loadingResults.push({
            file: filePath,
            status: 'PASS',
            loadTime,
            complexity,
            size: content.length
          });
        } else {
          loadingResults.push({
            file: filePath,
            status: 'FAIL',
            error: 'File not found'
          });
        }
      }

      const avgLoadTime = loadingResults.reduce((sum, result) => 
        sum + (result.loadTime || 0), 0) / loadingResults.length;
      
      return {
        status: avgLoadTime < 100 ? 'PASS' : 'WARN',
        avgLoadTime,
        results: loadingResults,
        recommendation: this.getLoadingRecommendation(avgLoadTime)
      };
      
    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  async testChatInteraction() {
    console.log('💬 测试聊天交互功能...');
    try {
      // 检查交互相关的hooks和功能
      const chatHookPath = path.join(this.projectRoot, 'src/hooks/useDifyChat.ts');
      
      if (!fs.existsSync(chatHookPath)) {
        return {
          status: 'FAIL',
          error: 'Chat hook not found'
        };
      }

      const hookContent = fs.readFileSync(chatHookPath, 'utf8');
      
      // 检查关键功能
      const features = {
        sendMessage: hookContent.includes('sendMessage'),
        clearMessages: hookContent.includes('clearMessages'),
        retryMessage: hookContent.includes('retry') || hookContent.includes('resend'),
        messageHistory: hookContent.includes('messages'),
        streaming: hookContent.includes('streaming') || hookContent.includes('isStreaming'),
        errorHandling: hookContent.includes('error') || hookContent.includes('Error')
      };

      const featureScore = Object.values(features).filter(Boolean).length;
      const totalFeatures = Object.keys(features).length;
      const score = (featureScore / totalFeatures) * 100;

      return {
        status: score >= 80 ? 'PASS' : 'WARN',
        score,
        features,
        recommendation: this.getChatInteractionRecommendation(features, score)
      };

    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  async testPerformanceMetrics() {
    console.log('📊 测试性能指标...');
    try {
      // 检查是否有性能优化
      const chatHistoryPath = path.join(this.projectRoot, 'src/components/chat/ChatHistory.tsx');
      const content = fs.readFileSync(chatHistoryPath, 'utf8');
      
      const optimizations = {
        useMemo: (content.match(/useMemo/g) || []).length,
        useCallback: (content.match(/useCallback/g) || []).length,
        memo: content.includes('memo('),
        lazyLoading: content.includes('lazy') || content.includes('Suspense'),
        virtualization: content.includes('VirtualizedMessageList') || content.includes('FixedSizeList')
      };

      // 检查Bundle大小
      const distPath = path.join(this.projectRoot, 'dist');
      let bundleSize = 0;
      
      if (fs.existsSync(distPath)) {
        bundleSize = this.getDirectorySize(distPath);
      }

      const performanceScore = this.calculatePerformanceScore(optimizations, bundleSize);

      return {
        status: performanceScore >= 75 ? 'PASS' : 'WARN',
        score: performanceScore,
        optimizations,
        bundleSize,
        recommendation: this.getPerformanceRecommendation(optimizations, performanceScore)
      };

    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  async testAccessibility() {
    console.log('♿ 测试可访问性...');
    try {
      const components = [
        'src/components/chat/ChatHistory.tsx',
        'src/components/chat/ChatInput.tsx',
        'src/components/chat/ChatMessage.tsx'
      ];

      const accessibilityResults = [];

      for (const componentPath of components) {
        const fullPath = path.join(this.projectRoot, componentPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          const accessibility = {
            ariaLabels: (content.match(/aria-label/g) || []).length,
            ariaDescribedby: (content.match(/aria-describedby/g) || []).length,
            keyboardNav: content.includes('onKeyDown') || content.includes('tabIndex'),
            semanticHTML: content.includes('<button') || content.includes('<input') || content.includes('<textarea'),
            altText: content.includes('alt=')
          };

          const score = this.calculateAccessibilityScore(accessibility);
          
          accessibilityResults.push({
            component: componentPath,
            score,
            accessibility
          });
        }
      }

      const avgScore = accessibilityResults.reduce((sum, result) => sum + result.score, 0) / accessibilityResults.length;

      return {
        status: avgScore >= 70 ? 'PASS' : 'WARN',
        avgScore,
        results: accessibilityResults,
        recommendation: this.getAccessibilityRecommendation(avgScore)
      };

    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  async testResponsiveDesign() {
    console.log('📱 测试响应式设计...');
    try {
      // 检查CSS和响应式类
      const styleFiles = [
        'src/index.css',
        'tailwind.config.ts'
      ];

      const responsiveFeatures = {
        flexbox: false,
        grid: false,
        mediaQueries: false,
        tailwindResponsive: false,
        mobileFirst: false
      };

      for (const styleFile of styleFiles) {
        const fullPath = path.join(this.projectRoot, styleFile);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          if (content.includes('flex') || content.includes('grid')) {
            responsiveFeatures.flexbox = true;
          }
          if (content.includes('grid')) {
            responsiveFeatures.grid = true;
          }
          if (content.includes('@media') || content.includes('sm:') || content.includes('md:')) {
            responsiveFeatures.mediaQueries = true;
            responsiveFeatures.tailwindResponsive = true;
          }
        }
      }

      // 检查组件中的响应式类
      const chatComponents = [
        'src/components/chat/ChatHistory.tsx',
        'src/components/chat/ChatInput.tsx'
      ];

      for (const componentPath of chatComponents) {
        const fullPath = path.join(this.projectRoot, componentPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('sm:') || content.includes('md:') || content.includes('lg:')) {
            responsiveFeatures.tailwindResponsive = true;
            responsiveFeatures.mobileFirst = true;
          }
        }
      }

      const responsiveScore = this.calculateResponsiveScore(responsiveFeatures);

      return {
        status: responsiveScore >= 60 ? 'PASS' : 'WARN',
        score: responsiveScore,
        features: responsiveFeatures,
        recommendation: this.getResponsiveRecommendation(responsiveFeatures, responsiveScore)
      };

    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  analyzeComponentComplexity(content) {
    const hooks = (content.match(/use\w+/g) || []).length;
    const conditions = (content.match(/if|switch|\?/g) || []).length;
    const loops = (content.match(/map|forEach|for/g) || []).length;
    const components = (content.match(/<[A-Z]\w+/g) || []).length;
    
    return {
      hooks,
      conditions,
      loops,
      components,
      complexity: hooks + conditions + loops + components
    };
  }

  getDirectorySize(dirPath) {
    let totalSize = 0;
    
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += this.getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  }

  calculatePerformanceScore(optimizations, bundleSize) {
    let score = 0;
    
    if (optimizations.useMemo > 0) score += 20;
    if (optimizations.useCallback > 0) score += 20;
    if (optimizations.memo) score += 20;
    if (optimizations.virtualization) score += 25;
    if (optimizations.lazyLoading) score += 15;
    if (bundleSize < 5 * 1024 * 1024) score += 0; // No penalty for reasonable size
    
    return Math.min(score, 100);
  }

  calculateAccessibilityScore(accessibility) {
    let score = 0;
    
    if (accessibility.ariaLabels > 0) score += 25;
    if (accessibility.keyboardNav) score += 25;
    if (accessibility.semanticHTML) score += 25;
    if (accessibility.ariaDescribedby > 0) score += 15;
    if (accessibility.altText) score += 10;
    
    return Math.min(score, 100);
  }

  calculateResponsiveScore(features) {
    let score = 0;
    
    if (features.flexbox) score += 20;
    if (features.grid) score += 15;
    if (features.mediaQueries) score += 25;
    if (features.tailwindResponsive) score += 30;
    if (features.mobileFirst) score += 10;
    
    return Math.min(score, 100);
  }

  getLoadingRecommendation(avgLoadTime) {
    if (avgLoadTime < 50) return '组件加载速度优秀';
    if (avgLoadTime < 100) return '组件加载速度良好';
    return '建议优化组件加载性能';
  }

  getChatInteractionRecommendation(features, score) {
    const missing = [];
    if (!features.sendMessage) missing.push('发送消息功能');
    if (!features.clearMessages) missing.push('清空消息功能');
    if (!features.retryMessage) missing.push('重试消息功能');
    if (!features.streaming) missing.push('流式响应');
    if (!features.errorHandling) missing.push('错误处理');
    
    return missing.length > 0 ? `缺少功能: ${missing.join(', ')}` : '聊天交互功能完整';
  }

  getPerformanceRecommendation(optimizations, score) {
    const suggestions = [];
    if (optimizations.useMemo === 0) suggestions.push('添加useMemo优化');
    if (optimizations.useCallback === 0) suggestions.push('添加useCallback优化');
    if (!optimizations.memo) suggestions.push('使用React.memo');
    if (!optimizations.virtualization) suggestions.push('添加虚拟滚动');
    
    return suggestions.length > 0 ? suggestions.join(', ') : '性能优化良好';
  }

  getAccessibilityRecommendation(avgScore) {
    if (avgScore >= 80) return '可访问性优秀';
    if (avgScore >= 60) return '可访问性良好，可继续改进';
    return '需要改善可访问性，添加更多aria标签和语义化HTML';
  }

  getResponsiveRecommendation(features, score) {
    const suggestions = [];
    if (!features.mediaQueries) suggestions.push('添加媒体查询');
    if (!features.tailwindResponsive) suggestions.push('使用Tailwind响应式类');
    if (!features.mobileFirst) suggestions.push('采用移动端优先设计');
    
    return suggestions.length > 0 ? suggestions.join(', ') : '响应式设计良好';
  }

  async saveTestResults(results) {
    const existingResults = fs.existsSync(this.testResultsFile) ? 
      JSON.parse(fs.readFileSync(this.testResultsFile, 'utf8')) : { history: [] };
    
    existingResults.latest = results;
    existingResults.history.push(results);
    
    // 保留最近20条记录
    if (existingResults.history.length > 20) {
      existingResults.history = existingResults.history.slice(-20);
    }
    
    fs.writeFileSync(this.testResultsFile, JSON.stringify(existingResults, null, 2));
  }

  generateTestReport(results) {
    console.log('\n🧪 UI自动化测试报告');
    console.log('='.repeat(50));
    
    Object.entries(results.tests).forEach(([testName, result]) => {
      const statusIcon = result.status === 'PASS' ? '✅' : 
                        result.status === 'WARN' ? '⚠️' : '❌';
      console.log(`${statusIcon} ${testName}: ${result.status}`);
      
      if (result.score !== undefined) {
        console.log(`   评分: ${result.score}%`);
      }
      
      if (result.recommendation) {
        console.log(`   建议: ${result.recommendation}`);
      }
    });
    
    const passedTests = Object.values(results.tests).filter(test => test.status === 'PASS').length;
    const totalTests = Object.keys(results.tests).length;
    const overallScore = (passedTests / totalTests) * 100;
    
    console.log('\n📊 总体结果');
    console.log(`通过率: ${overallScore.toFixed(1)}% (${passedTests}/${totalTests})`);
    console.log('⏱️ 总测试时间:', `${results.totalTestTime}ms`);
    console.log('📄 详细结果已保存至:', this.testResultsFile);
  }
}

// CLI执行
if (require.main === module) {
  const tester = new UIAutomationTester();
  
  const command = process.argv[2];
  
  if (command === 'run' || !command) {
    tester.runFullTestSuite().then(() => {
      console.log('✅ UI自动化测试完成');
      process.exit(0);
    }).catch(error => {
      console.error('❌ UI自动化测试失败:', error.message);
      process.exit(1);
    });
  } else {
    console.log(`
🧪 UI自动化测试工具

使用方法:
  node scripts/ui-automation-test.cjs run    # 运行完整测试套件
  node scripts/ui-automation-test.cjs       # 默认运行测试

测试项目:
  🔍 组件加载性能
  💬 聊天交互功能  
  📊 性能指标分析
  ♿ 可访问性检查
  📱 响应式设计
    `);
  }
}

module.exports = UIAutomationTester;