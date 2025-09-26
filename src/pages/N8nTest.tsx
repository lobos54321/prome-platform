import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function N8nTest() {
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

  const testWebhook = async () => {
    setIsLoading(true);
    setTestResult('Testing webhook...');

    try {
      console.log('Testing webhook URL:', n8nWebhookUrl);
      
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sendMessage',
          sessionId: 'test-session',
          chatInput: 'Hello, this is a test message'
        })
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (response.ok) {
        const data = await response.text();
        setTestResult(`✅ Success! Response: ${data}`);
      } else {
        setTestResult(`❌ Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Webhook test error:', error);
      setTestResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testDynamicImport = async () => {
    try {
      console.log('Testing dynamic import of @n8n/chat...');
      const { createChat } = await import('@n8n/chat');
      console.log('✅ @n8n/chat imported successfully:', createChat);
      
      // Test creating a chat instance
      console.log('Testing createChat function...');
      const testDiv = document.createElement('div');
      testDiv.id = 'test-chat-container';
      document.body.appendChild(testDiv);

      const chatInstance = createChat({
        webhookUrl: n8nWebhookUrl,
        target: testDiv
      });

      console.log('✅ Chat instance created:', chatInstance);
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(testDiv);
      }, 2000);

      setTestResult(prev => prev + '\n✅ @n8n/chat library loaded and createChat worked!');
    } catch (error) {
      console.error('Dynamic import test error:', error);
      setTestResult(prev => prev + `\n❌ @n8n/chat import error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    testDynamicImport();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>N8n Integration Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Configuration</h3>
              <div className="bg-gray-100 p-4 rounded">
                <p><strong>Webhook URL:</strong> {n8nWebhookUrl || 'Not configured'}</p>
                <p><strong>Integration Enabled:</strong> {import.meta.env.VITE_ENABLE_N8N_INTEGRATION}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Webhook Test</h3>
              <Button 
                onClick={testWebhook} 
                disabled={isLoading || !n8nWebhookUrl}
                className="mb-4"
              >
                {isLoading ? 'Testing...' : 'Test Webhook Connection'}
              </Button>
              
              {testResult && (
                <div className="bg-gray-100 p-4 rounded">
                  <pre className="whitespace-pre-wrap text-sm">{testResult}</pre>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Debug Information</h3>
              <div className="bg-gray-100 p-4 rounded text-sm">
                <p><strong>Environment:</strong> {import.meta.env.MODE}</p>
                <p><strong>Base URL:</strong> {import.meta.env.BASE_URL}</p>
                <p><strong>Dev Server:</strong> {import.meta.env.DEV ? 'Yes' : 'No'}</p>
                <p><strong>Current URL:</strong> {window.location.href}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Console Logs</h3>
              <p className="text-sm text-gray-600">Check the browser console (F12) for detailed logs</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}