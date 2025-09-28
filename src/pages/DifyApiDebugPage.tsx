/**
 * Dify API调试页面 - 用于诊断usage数据问题
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface DebugTest {
  name: string;
  status?: number;
  success: boolean;
  data?: any;
  usageFound?: boolean;
  tokensFound?: boolean;
  tokensValue?: number;
  error?: string;
}

interface DebugResults {
  timestamp: string;
  testMessage: string;
  testUser: string;
  tests: DebugTest[];
}

export default function DifyApiDebugPage() {
  const [testMessage, setTestMessage] = useState('Hello, please generate a detailed response about artificial intelligence to test token usage.');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<DebugResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDebugTest = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/debug/dify-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: testMessage
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data);
      
      console.log('Debug test results:', data);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Debug test failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderUsageData = (data: any) => {
    if (!data) return <span className="text-gray-500">No data</span>;
    
    const usage = data.metadata?.usage || data.usage;
    if (!usage) return <span className="text-red-500">No usage data found</span>;
    
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Prompt Tokens: <span className="font-mono">{usage.prompt_tokens || 0}</span></div>
          <div>Completion Tokens: <span className="font-mono">{usage.completion_tokens || 0}</span></div>
          <div>Total Tokens: <span className="font-mono">{usage.total_tokens || 0}</span></div>
          <div>Total Price: <span className="font-mono">${usage.total_price || '0.0'}</span></div>
        </div>
        
        {usage.total_tokens === 0 && (
          <div className="text-red-600 text-sm font-medium">
            ⚠️ All token values are ZERO - This is the problem!
          </div>
        )}
      </div>
    );
  };

  const getStatusBadge = (test: DebugTest) => {
    if (!test.success) return <Badge variant="destructive">Failed</Badge>;
    if (test.tokensFound && test.tokensValue && test.tokensValue > 0) return <Badge variant="default">✅ Has Tokens</Badge>;
    if (test.usageFound) return <Badge variant="secondary">Has Usage (0 tokens)</Badge>;
    return <Badge variant="outline">No Usage Data</Badge>;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">🔍 Dify API 调试工具</h1>
          <p className="text-gray-600">诊断为什么Dify API返回零token使用数据</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>测试配置</CardTitle>
            <CardDescription>
              配置测试消息，然后运行调试来分析Dify API响应
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="testMessage">测试消息</Label>
              <Textarea
                id="testMessage"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="输入要发送给Dify的测试消息..."
                rows={3}
              />
            </div>
            
            <Button 
              onClick={runDebugTest} 
              disabled={isLoading || !testMessage.trim()}
              className="w-full"
            >
              {isLoading ? '🔍 正在测试...' : '🚀 运行Dify API调试测试'}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-red-800">
                <h3 className="font-semibold">❌ 测试失败</h3>
                <p className="mt-1">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {results && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>📊 测试结果总览</CardTitle>
                <CardDescription>
                  测试时间: {new Date(results.timestamp).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>测试消息:</strong> {results.testMessage.substring(0, 50)}...</div>
                  <div><strong>测试用户:</strong> {results.testUser}</div>
                  <div><strong>总测试数:</strong> {results.tests.length}</div>
                  <div><strong>成功数:</strong> {results.tests.filter(t => t.success).length}</div>
                </div>
              </CardContent>
            </Card>

            {results.tests.map((test, index) => (
              <Card key={index} className={test.success ? '' : 'border-red-200'}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {index + 1}. {test.name}
                    </CardTitle>
                    {getStatusBadge(test)}
                  </div>
                  {test.status && (
                    <CardDescription>
                      HTTP Status: {test.status}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {test.error ? (
                    <div className="text-red-600 bg-red-50 p-3 rounded">
                      <strong>错误:</strong> {test.error}
                    </div>
                  ) : (
                    <>
                      <div>
                        <h4 className="font-semibold mb-2">Usage Data Analysis:</h4>
                        {renderUsageData(test.data)}
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-semibold mb-2">Complete Response Data:</h4>
                        <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                          {JSON.stringify(test.data, null, 2)}
                        </pre>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* 诊断建议 */}
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-yellow-800">💡 诊断建议</CardTitle>
              </CardHeader>
              <CardContent className="text-yellow-800">
                <div className="space-y-2">
                  <p><strong>如果所有测试都显示0 tokens:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>检查Dify控制台中的应用配置</li>
                    <li>确认LLM节点已正确配置并启用</li>
                    <li>验证API密钥具有usage统计权限</li>
                    <li>检查Dify账户余额和计费状态</li>
                    <li>确认使用正确的应用类型 (Agent vs Chatflow vs Workflow)</li>
                  </ul>
                  
                  <p className="mt-4"><strong>下一步排查:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>登录Dify控制台查看usage统计页面</li>
                    <li>测试在Dify Web界面中的usage是否正常</li>
                    <li>联系Dify技术支持确认API配置</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}