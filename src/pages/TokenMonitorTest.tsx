import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { difyIframeMonitor, TokenConsumptionEvent } from '@/lib/dify-iframe-monitor';
import { authService } from '@/lib/auth';
import { AlertCircle, Play, Square, RefreshCw } from 'lucide-react';

export default function TokenMonitorTest() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [user, setUser] = useState(authService.getCurrentUserSync());
  const [events, setEvents] = useState<TokenConsumptionEvent[]>([]);
  const [balance, setBalance] = useState(user?.balance || 0);
  const [status, setStatus] = useState(difyIframeMonitor.getStatus());

  useEffect(() => {
    // Update monitoring status
    setIsMonitoring(difyIframeMonitor.isCurrentlyListening());
    setStatus(difyIframeMonitor.getStatus());

    // Listen for auth changes
    const handleAuthChange = (event: CustomEvent) => {
      const { user: newUser } = event.detail;
      setUser(newUser);
      setBalance(newUser?.balance || 0);
    };

    // Listen for balance updates
    const handleBalanceUpdate = (event: CustomEvent) => {
      const { balance: newBalance } = event.detail;
      setBalance(newBalance);
    };

    // Listen for token consumption
    const handleTokenConsumed = (event: CustomEvent) => {
      const { event: tokenEvent } = event.detail;
      setEvents(prev => [tokenEvent, ...prev.slice(0, 9)]); // Keep last 10 events
    };

    window.addEventListener('auth-state-changed', handleAuthChange as EventListener);
    window.addEventListener('balance-updated', handleBalanceUpdate as EventListener);
    window.addEventListener('token-consumed', handleTokenConsumed as EventListener);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange as EventListener);
      window.removeEventListener('balance-updated', handleBalanceUpdate as EventListener);
      window.removeEventListener('token-consumed', handleTokenConsumed as EventListener);
    };
  }, []);

  const startMonitoring = () => {
    if (!user) {
      alert('Please log in to start monitoring');
      return;
    }

    difyIframeMonitor.startListening(user.id);
    setIsMonitoring(true);
    setStatus(difyIframeMonitor.getStatus());
  };

  const stopMonitoring = () => {
    difyIframeMonitor.stopListening();
    setIsMonitoring(false);
    setStatus(difyIframeMonitor.getStatus());
  };

  const simulateTokenUsage = async () => {
    if (!user) {
      alert('Please log in to simulate token usage');
      return;
    }

    try {
      await difyIframeMonitor.simulateTokenConsumption(
        user.id,
        'gpt-4',
        1500,
        800
      );
      setStatus(difyIframeMonitor.getStatus());
    } catch (error) {
      console.error('Failed to simulate token usage:', error);
      alert('Failed to simulate token usage. Check console for details.');
    }
  };

  const refreshStatus = () => {
    setStatus(difyIframeMonitor.getStatus());
    setBalance(user?.balance || 0);
  };

  const postTestMessage = () => {
    // Simulate a message from an iframe
    const mockEvent = {
      event: 'message_end',
      data: {
        conversation_id: `test_conv_${Date.now()}`,
        message_id: `test_msg_${Date.now()}`,
        user_id: user?.id,
        model_name: 'gpt-3.5-turbo',
        input_tokens: 1000,
        output_tokens: 500,
        total_tokens: 1500,
        timestamp: new Date().toISOString()
      }
    };

    // Post message to window (simulating iframe communication)
    window.postMessage(mockEvent, window.location.origin);
    console.log('Posted test message:', mockEvent);
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Token Monitor Test</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please log in to access the token monitoring test page.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Token Monitor Test</h1>
          <p className="text-gray-600">Test and debug the Dify iframe token monitoring system</p>
        </div>
        <Button onClick={refreshStatus} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="font-medium text-sm">Name</label>
              <p>{user.name}</p>
            </div>
            <div>
              <label className="font-medium text-sm">Email</label>
              <p>{user.email}</p>
            </div>
            <div>
              <label className="font-medium text-sm">Role</label>
              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                {user.role}
              </Badge>
            </div>
            <div>
              <label className="font-medium text-sm">Balance</label>
              <p className="text-lg font-semibold text-green-600">{balance} credits</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monitor Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Monitor Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Badge variant={isMonitoring ? "default" : "secondary"}>
              {isMonitoring ? 'Monitoring Active' : 'Monitoring Stopped'}
            </Badge>
            
            {isMonitoring ? (
              <Button onClick={stopMonitoring} variant="destructive" size="sm">
                <Square className="h-4 w-4 mr-2" />
                Stop Monitoring
              </Button>
            ) : (
              <Button onClick={startMonitoring} size="sm">
                <Play className="h-4 w-4 mr-2" />
                Start Monitoring
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="font-medium text-sm">Model Configs Loaded</label>
              <p>{status.modelConfigsLoaded}</p>
            </div>
            <div>
              <label className="font-medium text-sm">Exchange Rate</label>
              <p>{status.exchangeRate}</p>
            </div>
            <div>
              <label className="font-medium text-sm">Events Processed</label>
              <p>{status.processedEventsCount}</p>
            </div>
          </div>

          <div className="space-x-2">
            <Button onClick={simulateTokenUsage} variant="outline">
              Simulate Token Usage
            </Button>
            <Button onClick={postTestMessage} variant="outline">
              Post Test Message
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Token Consumption Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-gray-500">No events captured yet. Try simulating token usage or posting a test message.</p>
          ) : (
            <div className="space-y-2">
              {events.map((event, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{event.modelName}</div>
                      <div className="text-sm text-gray-600">
                        {event.inputTokens} input + {event.outputTokens} output = {event.totalTokens} total tokens
                      </div>
                      <div className="text-xs text-gray-500">
                        {event.conversationId} • {event.messageId}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-xs overflow-auto">
              {JSON.stringify(status, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}