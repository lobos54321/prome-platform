import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface DatabaseStatus {
  connected: boolean;
  message: string;
  lastChecked: Date;
}

export function DatabaseStatusIndicator() {
  const [status, setStatus] = useState<DatabaseStatus>({
    connected: true,
    message: '数据库连接正常',
    lastChecked: new Date()
  });
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    // Listen for database errors
    const handleDatabaseError = (event: CustomEvent) => {
      const { error, operation } = event.detail;
      console.log('Database error detected:', error, operation);
      
      setStatus({
        connected: false,
        message: `数据库连接失败: ${operation} - 正在使用备用数据`,
        lastChecked: new Date()
      });
      setShowAlert(true);
      
      // Auto-hide after 10 seconds
      setTimeout(() => setShowAlert(false), 10000);
    };

    // Listen for database recovery
    const handleDatabaseRecover = (event: CustomEvent) => {
      console.log('Database connection recovered');
      
      setStatus({
        connected: true,
        message: '数据库连接已恢复',
        lastChecked: new Date()
      });
      setShowAlert(true);
      
      // Auto-hide after 5 seconds
      setTimeout(() => setShowAlert(false), 5000);
    };

    window.addEventListener('database-error', handleDatabaseError as EventListener);
    window.addEventListener('database-recover', handleDatabaseRecover as EventListener);

    return () => {
      window.removeEventListener('database-error', handleDatabaseError as EventListener);
      window.removeEventListener('database-recover', handleDatabaseRecover as EventListener);
    };
  }, []);

  if (!showAlert) {
    return null;
  }

  return (
    <Alert className={`fixed top-4 right-4 z-50 max-w-md ${status.connected ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
      <div className="flex items-center space-x-2">
        {status.connected ? (
          <Wifi className="h-4 w-4 text-green-600" />
        ) : (
          <WifiOff className="h-4 w-4 text-yellow-600" />
        )}
        <AlertDescription className="flex-1">
          {status.message}
        </AlertDescription>
        <button
          onClick={() => setShowAlert(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </Alert>
  );
}

// Helper function to emit database events
export function emitDatabaseError(operation: string, error: Error | unknown) {
  window.dispatchEvent(new CustomEvent('database-error', {
    detail: { operation, error }
  }));
}

export function emitDatabaseRecover() {
  window.dispatchEvent(new CustomEvent('database-recover', {
    detail: {}
  }));
}