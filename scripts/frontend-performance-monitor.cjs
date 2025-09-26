#!/usr/bin/env node

/**
 * 前端性能监控脚本
 * 用于实时监控项目性能指标和用户体验
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FrontendPerformanceMonitor {
  constructor() {
    this.projectRoot = process.cwd();
    this.metricsFile = path.join(this.projectRoot, 'frontend-performance-metrics.json');
    this.thresholds = {
      bundleSize: 3 * 1024 * 1024, // 3MB
      buildTime: 30000, // 30秒
      componentLoadTime: 1000, // 1秒
      memoryUsage: 100 * 1024 * 1024 // 100MB
    };
  }

  async runPerformanceCheck() {
    console.log('🔍 开始前端性能检查...');
    const startTime = Date.now();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      checks: {
        bundleAnalysis: await this.analyzeBundleSize(),
        buildPerformance: await this.measureBuildTime(),
        componentOptimization: await this.checkComponentOptimization(),
        memoryAnalysis: await this.analyzeMemoryUsage()
      }
    };

    const endTime = Date.now();
    metrics.totalCheckTime = endTime - startTime;
    
    await this.saveMetrics(metrics);
    this.generateReport(metrics);
    
    return metrics;
  }

  async analyzeBundleSize() {
    console.log('📦 分析Bundle大小...');
    try {
      // 检查dist目录
      const distPath = path.join(this.projectRoot, 'dist');
      if (!fs.existsSync(distPath)) {
        console.log('⚠️ 未找到dist目录，执行构建...');
        execSync('npm run build', { stdio: 'pipe' });
      }

      const files = this.getFileSizes(distPath);
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      
      const largestFiles = files
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);

      return {
        status: totalSize < this.thresholds.bundleSize ? 'PASS' : 'WARN',
        totalSize,
        largestFiles,
        recommendation: this.getBundleSizeRecommendation(largestFiles)
      };
    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  async measureBuildTime() {
    console.log('⏱️ 测量构建时间...');
    try {
      const startTime = Date.now();
      execSync('npm run build', { stdio: 'pipe' });
      const buildTime = Date.now() - startTime;
      
      return {
        status: buildTime < this.thresholds.buildTime ? 'PASS' : 'WARN',
        buildTime,
        recommendation: buildTime > this.thresholds.buildTime ? 
          '构建时间超过阈值，建议优化构建配置' : '构建性能良好'
      };
    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  async checkComponentOptimization() {
    console.log('⚛️ 检查组件优化...');
    try {
      const chatHistoryPath = path.join(this.projectRoot, 'src/components/chat/ChatHistory.tsx');
      const content = fs.readFileSync(chatHistoryPath, 'utf8');
      
      const optimizations = {
        useMemo: (content.match(/useMemo/g) || []).length,
        useCallback: (content.match(/useCallback/g) || []).length,
        memo: content.includes('memo('),
        virtualScroll: content.includes('virtualizeThreshold')
      };

      const score = this.calculateOptimizationScore(optimizations);
      
      return {
        status: score >= 75 ? 'PASS' : 'WARN',
        score,
        optimizations,
        recommendation: this.getOptimizationRecommendation(optimizations, score)
      };
    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  async analyzeMemoryUsage() {
    console.log('🧠 分析内存使用...');
    try {
      const memUsage = process.memoryUsage();
      
      return {
        status: memUsage.heapUsed < this.thresholds.memoryUsage ? 'PASS' : 'WARN',
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        recommendation: this.getMemoryRecommendation(memUsage)
      };
    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  getFileSizes(dirPath) {
    const files = [];
    
    const readDir = (currentPath) => {
      const items = fs.readdirSync(currentPath);
      
      items.forEach(item => {
        const fullPath = path.join(currentPath, item);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          readDir(fullPath);
        } else {
          files.push({
            path: path.relative(this.projectRoot, fullPath),
            size: stats.size,
            sizeFormatted: this.formatBytes(stats.size)
          });
        }
      });
    };
    
    readDir(dirPath);
    return files;
  }

  calculateOptimizationScore(optimizations) {
    let score = 0;
    if (optimizations.useMemo > 0) score += 25;
    if (optimizations.useCallback > 0) score += 25;
    if (optimizations.memo) score += 25;
    if (optimizations.virtualScroll) score += 25;
    return score;
  }

  getBundleSizeRecommendation(largestFiles) {
    const recommendations = [];
    
    largestFiles.forEach(file => {
      if (file.size > 500 * 1024) { // 500KB
        if (file.path.includes('icons')) {
          recommendations.push(`🎯 ${file.path}: 建议实施图标懒加载`);
        } else if (file.path.includes('.js')) {
          recommendations.push(`📦 ${file.path}: 建议代码分割`);
        }
      }
    });
    
    return recommendations.length > 0 ? recommendations : ['Bundle大小在合理范围内'];
  }

  getOptimizationRecommendation(optimizations, score) {
    const recommendations = [];
    
    if (optimizations.useMemo === 0) {
      recommendations.push('添加useMemo优化计算密集型操作');
    }
    if (optimizations.useCallback === 0) {
      recommendations.push('添加useCallback优化事件处理函数');
    }
    if (!optimizations.memo) {
      recommendations.push('使用React.memo优化组件重渲染');
    }
    if (!optimizations.virtualScroll) {
      recommendations.push('为长列表实施虚拟滚动');
    }
    
    return recommendations.length > 0 ? recommendations : ['组件优化良好'];
  }

  getMemoryRecommendation(memUsage) {
    if (memUsage.heapUsed > this.thresholds.memoryUsage) {
      return '内存使用过高，建议检查内存泄漏';
    }
    return '内存使用正常';
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async saveMetrics(metrics) {
    const existingMetrics = fs.existsSync(this.metricsFile) ? 
      JSON.parse(fs.readFileSync(this.metricsFile, 'utf8')) : { history: [] };
    
    existingMetrics.latest = metrics;
    existingMetrics.history.push(metrics);
    
    // 保留最近50条记录
    if (existingMetrics.history.length > 50) {
      existingMetrics.history = existingMetrics.history.slice(-50);
    }
    
    fs.writeFileSync(this.metricsFile, JSON.stringify(existingMetrics, null, 2));
  }

  generateReport(metrics) {
    console.log('\n📊 前端性能检查报告');
    console.log('='.repeat(50));
    
    Object.entries(metrics.checks).forEach(([checkName, result]) => {
      const statusIcon = result.status === 'PASS' ? '✅' : 
                        result.status === 'WARN' ? '⚠️' : '❌';
      console.log(`${statusIcon} ${checkName}: ${result.status}`);
      
      if (result.recommendation) {
        if (Array.isArray(result.recommendation)) {
          result.recommendation.forEach(rec => console.log(`  ${rec}`));
        } else {
          console.log(`  ${result.recommendation}`);
        }
      }
    });
    
    console.log('\n⏱️ 总检查时间:', `${metrics.totalCheckTime}ms`);
    console.log('📄 详细指标已保存至:', this.metricsFile);
  }

  async startMonitoring(interval = 15 * 60 * 1000) { // 15分钟
    console.log(`🔄 启动性能监控 (间隔: ${interval / 1000 / 60}分钟)`);
    
    const runCheck = async () => {
      try {
        await this.runPerformanceCheck();
      } catch (error) {
        console.error('❌ 性能检查失败:', error.message);
      }
    };
    
    // 立即运行一次
    await runCheck();
    
    // 定期运行
    setInterval(runCheck, interval);
  }
}

// CLI执行
if (require.main === module) {
  const monitor = new FrontendPerformanceMonitor();
  
  const command = process.argv[2];
  
  if (command === 'monitor') {
    monitor.startMonitoring();
  } else if (command === 'check') {
    monitor.runPerformanceCheck().then(() => {
      console.log('✅ 性能检查完成');
      process.exit(0);
    }).catch(error => {
      console.error('❌ 性能检查失败:', error.message);
      process.exit(1);
    });
  } else {
    console.log(`
🎯 前端性能监控工具

使用方法:
  node scripts/frontend-performance-monitor.js check    # 执行一次性能检查
  node scripts/frontend-performance-monitor.js monitor # 启动持续监控

功能:
  📦 Bundle大小分析
  ⏱️ 构建性能测试  
  ⚛️ 组件优化检查
  🧠 内存使用分析
    `);
  }
}

module.exports = FrontendPerformanceMonitor;