import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Activity, CircleCheck, CircleX } from 'lucide-react';
import { isDifyEnabled } from '@/api/dify-api';
import { difyIframeMonitor } from '@/lib/dify-iframe-monitor';
import { authService } from '@/lib/auth';

export function DifyMonitorStatus() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [user, setUser] = useState(authService.getCurrentUserSync());

  useEffect(() => {
    // Check initial monitoring state
    setIsMonitoring(difyIframeMonitor.isCurrentlyListening());

    // Listen for auth state changes
    const handleAuthStateChange = (event: CustomEvent) => {
      const { user } = event.detail;
      setUser(user);
    };

    // Listen for monitoring state changes
    const handleTokenConsumed = () => {
      // Update monitoring state when we detect activity
      setIsMonitoring(difyIframeMonitor.isCurrentlyListening());
    };

    window.addEventListener('auth-state-changed', handleAuthStateChange as EventListener);
    window.addEventListener('token-consumed', handleTokenConsumed as EventListener);

    // Check monitoring state periodically (fallback)
    const interval = setInterval(() => {
      const currentState = difyIframeMonitor.isCurrentlyListening();
      if (currentState !== isMonitoring) {
        setIsMonitoring(currentState);
      }
    }, 5000);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChange as EventListener);
      window.removeEventListener('token-consumed', handleTokenConsumed as EventListener);
      clearInterval(interval);
    };
  }, [isMonitoring]);

  // Don't show if Dify is not enabled or user is not logged in
  if (!isDifyEnabled() || !user) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Activity className="h-4 w-4" />
      <span className="hidden sm:inline">Token监控:</span>
      <Badge 
        variant={isMonitoring ? "default" : "secondary"}
        className="flex items-center gap-1"
      >
        {isMonitoring ? (
          <>
            <CircleCheck className="h-3 w-3" />
            运行中
          </>
        ) : (
          <>
            <CircleX className="h-3 w-3" />
            已停止
          </>
        )}
      </Badge>
    </div>
  );
}