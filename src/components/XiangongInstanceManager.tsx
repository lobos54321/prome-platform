/**
 * 仙宫云实例管理界面
 * 显示实例状态、手动控制启停、监控服务健康
 */

import React, { useState, useEffect } from 'react';

interface InstanceStatus {
  instanceId: string;
  status: string;
  lastActivity?: string;
  services?: string[];
}

const XiangongInstanceManager: React.FC = () => {
  const [instanceStatus, setInstanceStatus] = useState<InstanceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-10), `[${timestamp}] ${message}`]);
  };

  const fetchInstanceStatus = async () => {
    try {
      const response = await fetch('/api/xiangong/instance/status');
      const result = await response.json();
      
      if (result.success) {
        setInstanceStatus({
          instanceId: '3iaszw98tkh12h9x',
          status: result.data.status || 'unknown',
          lastActivity: new Date().toLocaleString(),
          services: ['infinitetalk', 'indextts2']
        });
        addLog(`实例状态: ${result.data.status}`);
      } else {
        throw new Error(result.error || '获取状态失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '获取状态失败');
      addLog(`❌ 获取状态失败: ${error}`);
    }
  };

  const startInstance = async () => {
    setIsLoading(true);
    setError(null);
    addLog('🚀 启动实例...');
    
    try {
      const response = await fetch('/api/xiangong/instance/start', { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        addLog('✅ 启动命令发送成功');
        setTimeout(() => {
          fetchInstanceStatus();
        }, 5000);
      } else {
        throw new Error(result.error || '启动失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '启动失败');
      addLog(`❌ 启动失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const stopInstance = async () => {
    setIsLoading(true);
    setError(null);
    addLog('⏸️ 停止实例...');
    
    try {
      const response = await fetch('/api/xiangong/instance/stop', { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        addLog('✅ 停止命令发送成功');
        setTimeout(() => {
          fetchInstanceStatus();
        }, 5000);
      } else {
        throw new Error(result.error || '停止失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '停止失败');
      addLog(`❌ 停止失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testServices = async () => {
    addLog('🔍 测试服务连接...');
    
    const services = [
      { name: 'InfiniteTalk', url: 'https://3iaszw98tkh12h9x-7860.container.x-gpu.com' },
      { name: 'IndexTTS2', url: 'https://3iaszw98tkh12h9x-8000.container.x-gpu.com' }
    ];
    
    for (const service of services) {
      try {
        const response = await fetch(service.url, { mode: 'no-cors' });
        addLog(`✅ ${service.name} 服务可访问`);
      } catch (error) {
        addLog(`⚠️ ${service.name} 连接失败`);
      }
    }
  };

  useEffect(() => {
    fetchInstanceStatus();
    const interval = setInterval(fetchInstanceStatus, 30000); // 每30秒更新
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running': return '#10B981';
      case 'stopped': return '#6B7280';
      case 'starting': return '#F59E0B';
      case 'stopping': return '#EF4444';
      case 'error': return '#DC2626';
      default: return '#9CA3AF';
    }
  };

  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running': return '运行中';
      case 'stopped': return '已停止';
      case 'starting': return '启动中';
      case 'stopping': return '停止中';
      case 'error': return '错误';
      default: return '未知';
    }
  };

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '2rem auto', 
      padding: '2rem',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <h2 style={{ 
        fontSize: '1.5rem', 
        fontWeight: 'bold', 
        marginBottom: '1.5rem',
        color: '#1F2937'
      }}>
        🎬 仙宫云实例管理
      </h2>

      {/* 实例状态卡片 */}
      <div style={{ 
        backgroundColor: '#F9FAFB', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        marginBottom: '1.5rem',
        border: '1px solid #E5E7EB'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
              实例 ID: {instanceStatus?.instanceId || '3iaszw98tkh12h9x'}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: getStatusColor(instanceStatus?.status || 'unknown')
              }} />
              <span style={{ fontSize: '0.9rem', color: '#6B7280' }}>
                状态: {getStatusText(instanceStatus?.status || 'unknown')}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={fetchInstanceStatus}
              disabled={isLoading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem'
              }}
            >
              🔄 刷新
            </button>
          </div>
        </div>
      </div>

      {/* 控制按钮 */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={startInstance}
          disabled={isLoading || instanceStatus?.status === 'running'}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: instanceStatus?.status === 'running' ? '#9CA3AF' : '#10B981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: (isLoading || instanceStatus?.status === 'running') ? 'not-allowed' : 'pointer',
            fontWeight: '500'
          }}
        >
          🚀 启动实例
        </button>
        
        <button
          onClick={stopInstance}
          disabled={isLoading || instanceStatus?.status !== 'running'}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: instanceStatus?.status !== 'running' ? '#9CA3AF' : '#EF4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: (isLoading || instanceStatus?.status !== 'running') ? 'not-allowed' : 'pointer',
            fontWeight: '500'
          }}
        >
          ⏸️ 停止实例
        </button>
        
        <button
          onClick={testServices}
          disabled={isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#8B5CF6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontWeight: '500'
          }}
        >
          🔍 测试服务
        </button>
      </div>

      {/* 服务链接 */}
      <div style={{ 
        backgroundColor: '#F3F4F6', 
        padding: '1rem', 
        borderRadius: '8px', 
        marginBottom: '1.5rem' 
      }}>
        <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
          📡 服务访问地址
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>
            <strong>InfiniteTalk:</strong>{' '}
            <a 
              href="https://3iaszw98tkh12h9x-7860.container.x-gpu.com" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#3B82F6', textDecoration: 'underline' }}
            >
              https://3iaszw98tkh12h9x-7860.container.x-gpu.com
            </a>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>
            <strong>IndexTTS2:</strong>{' '}
            <a 
              href="https://3iaszw98tkh12h9x-8000.container.x-gpu.com" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#3B82F6', textDecoration: 'underline' }}
            >
              https://3iaszw98tkh12h9x-8000.container.x-gpu.com
            </a>
          </div>
        </div>
      </div>

      {/* 错误显示 */}
      {error && (
        <div style={{ 
          backgroundColor: '#FEF2F2', 
          border: '1px solid #FECACA', 
          color: '#DC2626', 
          padding: '1rem', 
          borderRadius: '8px', 
          marginBottom: '1.5rem' 
        }}>
          ❌ {error}
        </div>
      )}

      {/* 操作日志 */}
      <div style={{ 
        backgroundColor: '#1F2937', 
        color: '#F9FAFB', 
        padding: '1rem', 
        borderRadius: '8px', 
        fontFamily: 'monospace', 
        fontSize: '0.75rem',
        maxHeight: '200px',
        overflowY: 'auto'
      }}>
        <h4 style={{ color: '#D1D5DB', marginBottom: '0.5rem' }}>📝 操作日志</h4>
        {logs.length === 0 ? (
          <div style={{ color: '#9CA3AF' }}>暂无日志...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={{ marginBottom: '0.25rem' }}>
              {log}
            </div>
          ))
        )}
      </div>

      <div style={{ 
        marginTop: '1rem', 
        padding: '0.75rem', 
        backgroundColor: '#EFF6FF', 
        border: '1px solid #DBEAFE', 
        borderRadius: '6px', 
        fontSize: '0.875rem', 
        color: '#1E40AF' 
      }}>
        💡 <strong>提示:</strong> 实例会在闲置 30 分钟后自动停止以节省成本。首次使用时会自动启动。
      </div>
    </div>
  );
};

export default XiangongInstanceManager;