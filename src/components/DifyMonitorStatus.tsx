'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Activity, CircleCheck, CircleX, Zap } from 'lucide-react';
import { isDifyEnabled, getDifyUsageStats, DifyUsageStats } from '@/api/dify-api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function DifyMonitorStatus() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [usageStats, setUsageStats] = useState<DifyUsageStats>({
    totalMessages: 0,
    totalTokens: 0,
    totalConversations: 0,
    totalRequests: 0,
    promptTokens: 0,
    completionTokens: 0,
    lastUpdated: new Date().toISOString(),
  });
  
  useEffect(() => {
    // 检查Dify状态
    const checkDifyStatus = async () => {
      try {
        const enabled = isDifyEnabled();
        
        if (enabled) {
          setStatus('connected');
          // 获取使用统计
          const stats = await getDifyUsageStats();
          setUsageStats(stats);
        } else {
          setStatus('disconnected');
        }
      } catch (error) {
        console.error('Error checking Dify status:', error);
        setStatus('disconnected');
      }
    };
    
    checkDifyStatus();
    
    // 定期更新使用统计
    const intervalId = setInterval(async () => {
      if (isDifyEnabled()) {
        try {
          const stats = await getDifyUsageStats();
          setUsageStats(stats);
        } catch (error) {
          console.error('Error updating usage stats:', error);
        }
      }
    }, 30000); // 每30秒更新一次
    
    return () => clearInterval(intervalId);
  }, []);
  
  if (!isDifyEnabled()) {
    return null; // 如果Dify未启用，不显示组件
  }
  
  return (
    <div className="flex items-center gap-2">
      {status === 'loading' && (
        <Badge variant="outline" className="gap-1">
          <Activity className="h-3 w-3 animate-pulse" />
          <span>连接中...</span>
        </Badge>
      )}
      {status === 'connected' && (
        <>
          <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
            <CircleCheck className="h-3 w-3" />
            <span>Dify已连接</span>
          </Badge>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-help gap-1 bg-blue-50 text-blue-700 border-blue-200">
                <Zap className="h-3 w-3" />
                <span>{usageStats.totalTokens.toLocaleString()} tokens</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <p>总请求数: {usageStats.totalRequests.toLocaleString()}</p>
                <p>提示词tokens: {usageStats.promptTokens.toLocaleString()}</p>
                <p>补全tokens: {usageStats.completionTokens.toLocaleString()}</p>
                <p>总tokens: {usageStats.totalTokens.toLocaleString()}</p>
                <p>最后更新: {new Date(usageStats.lastUpdated).toLocaleString()}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </>
      )}
      {status === 'disconnected' && (
        <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 border-red-200">
          <CircleX className="h-3 w-3" />
          <span>Dify未连接</span>
        </Badge>
      )}
    </div>
  );
}

export default DifyMonitorStatus;
