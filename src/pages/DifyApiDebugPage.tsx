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
import { testDirectDifyAPI } from '@/utils/directDifyTest';
import { validateDifyConfig } from '@/utils/difyConfigValidator';
import { testDifferentHeaders } from '@/utils/difyHeaderTester';

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
  const [directResults, setDirectResults] = useState<any>(null);
  const [isDirectLoading, setIsDirectLoading] = useState(false);
  const [configResults, setConfigResults] = useState<any>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [headerResults, setHeaderResults] = useState<any>(null);
  const [isHeaderLoading, setIsHeaderLoading] = useState(false);

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

  const runDirectTest = async () => {
    setIsDirectLoading(true);
    setError(null);
    setDirectResults(null);

    try {
      console.log('🔍 Starting direct Dify API test...');
      const results = await testDirectDifyAPI();
      setDirectResults(results);
      console.log('✅ Direct test completed:', results);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Direct test failed');
      console.error('❌ Direct test failed:', err);
    } finally {
      setIsDirectLoading(false);
    }
  };

  const runConfigValidation = async () => {
    setIsConfigLoading(true);
    setError(null);
    setConfigResults(null);

    try {
      console.log('🔍 Starting Dify config validation...');
      const results = await validateDifyConfig();
      setConfigResults(results);
      console.log('✅ Config validation completed:', results);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Config validation failed');
      console.error('❌ Config validation failed:', err);
    } finally {
      setIsConfigLoading(false);
    }
  };

  const runHeaderTest = async () => {
    setIsHeaderLoading(true);
    setError(null);
    setHeaderResults(null);

    try {
      console.log('🔍 Starting header combination test...');
      const results = await testDifferentHeaders();
      setHeaderResults(results);
      console.log('✅ Header test completed:', results);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Header test failed');
      console.error('❌ Header test failed:', err);
    } finally {
      setIsHeaderLoading(false);
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                onClick={runConfigValidation} 
                disabled={isConfigLoading}
                variant="secondary"
                className="w-full"
              >
                {isConfigLoading ? '🔍 验证中...' : '⚙️ 验证Dify配置'}
              </Button>
              
              <Button 
                onClick={runHeaderTest} 
                disabled={isHeaderLoading}
                variant="outline"
                className="w-full"
              >
                {isHeaderLoading ? '🔍 测试中...' : '📋 测试请求头组合'}
              </Button>
              
              <Button 
                onClick={runDirectTest} 
                disabled={isDirectLoading}
                variant="outline"
                className="w-full"
              >
                {isDirectLoading ? '🔍 直接测试中...' : '🎯 直接调用Dify API'}
              </Button>
              
              <Button 
                onClick={runDebugTest} 
                disabled={isLoading || !testMessage.trim()}
                className="w-full"
              >
                {isLoading ? '🔍 正在测试...' : '🚀 通过代理服务器测试'}
              </Button>
            </div>
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

        {headerResults && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-800">📋 请求头测试结果</CardTitle>
              <CardDescription>
                测试不同header组合对token数据的影响
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {headerResults.tests?.map((test: any, index: number) => (
                  <div key={index} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{test.name}</h4>
                      <div className="flex gap-2">
                        <Badge variant={test.success ? "default" : "destructive"}>
                          {test.success ? '✅ 成功' : '❌ 失败'}
                        </Badge>
                        {test.success && test.tokenValue > 0 && (
                          <Badge variant="default" className="bg-green-600">
                            🎉 有Token数据
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {test.success && (
                      <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                        <div>Tokens: <span className="font-mono">{test.tokenValue}</span></div>
                        <div>Price: <span className="font-mono">${test.priceValue}</span></div>
                      </div>
                    )}
                    
                    <details>
                      <summary className="cursor-pointer text-sm text-gray-600">查看请求头</summary>
                      <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-32">
                        {JSON.stringify(test.headers, null, 2)}
                      </pre>
                    </details>
                    
                    {test.success && test.fullResponse && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-gray-600">查看完整响应</summary>
                        <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-40">
                          {JSON.stringify(test.fullResponse, null, 2)}
                        </pre>
                      </details>
                    )}
                    
                    {!test.success && (
                      <div className="text-red-600 text-sm">
                        <strong>错误:</strong> {test.error}
                      </div>
                    )}
                  </div>
                ))}
                
                {/* 成功案例总结 */}
                {headerResults.tests?.filter((t: any) => t.success && t.tokenValue > 0).length > 0 && (
                  <div className="bg-green-100 border border-green-300 rounded p-3">
                    <h4 className="font-semibold text-green-800 mb-2">🎉 找到有效的header配置!</h4>
                    {headerResults.tests
                      ?.filter((t: any) => t.success && t.tokenValue > 0)
                      ?.map((t: any, i: number) => (
                        <div key={i} className="text-green-700 text-sm">
                          • <strong>{t.name}</strong>: {t.tokenValue} tokens, ${t.priceValue}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {configResults && (
          <Card className="border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle className="text-purple-800">⚙️ Dify配置验证结果</CardTitle>
              <CardDescription>
                环境变量和API配置的详细验证
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>API URL:</strong> {configResults.config?.apiUrl}</div>
                  <div><strong>App ID:</strong> {configResults.config?.appId}</div>
                  <div><strong>API Key:</strong> {configResults.config?.apiKey?.substring(0, 12)}...</div>
                  <div><strong>Enabled:</strong> {configResults.config?.enabled}</div>
                </div>
                
                <Separator />
                
                {configResults.tests?.map((test: any, index: number) => (
                  <div key={index} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{test.name}</h4>
                      <Badge variant={test.success ? "default" : "destructive"}>
                        {test.success ? '✅ 通过' : '❌ 失败'}
                      </Badge>
                    </div>
                    
                    <details>
                      <summary className="cursor-pointer text-sm text-gray-600">查看详细信息</summary>
                      <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-40">
                        {JSON.stringify(test.details, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {directResults && (
          <div className="space-y-4">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800">🎯 直接Dify API调用结果</CardTitle>
                <CardDescription>
                  绕过代理服务器，直接调用Dify API的结果
                </CardDescription>
              </CardHeader>
              <CardContent>
                {directResults.tests?.map((test: any, index: number) => (
                  <Card key={index} className="mb-4">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{test.name}</CardTitle>
                        <Badge variant={test.success ? "default" : "destructive"}>
                          {test.success ? '✅ 成功' : '❌ 失败'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {test.success ? (
                        <div className="space-y-3">
                          {test.usageAnalysis && (
                            <>
                              <h5 className="font-semibold">Usage Analysis:</h5>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>Has Usage: {test.usageAnalysis.hasUsage ? '✅' : '❌'}</div>
                                <div>Has Tokens: {test.usageAnalysis.hasTokens ? '✅' : '❌'}</div>
                                <div>Token Value: {test.usageAnalysis.tokenValue}</div>
                                <div>Price Value: ${test.usageAnalysis.priceValue}</div>
                              </div>
                              
                              {test.usageAnalysis.tokenValue === 0 && (
                                <div className="text-red-600 bg-red-50 p-2 rounded text-sm">
                                  ⚠️ 直接调用Dify API也返回0 tokens - 确认Dify配置问题
                                </div>
                              )}
                              
                              {test.usageAnalysis.tokenValue > 0 && (
                                <div className="text-green-600 bg-green-50 p-2 rounded text-sm">
                                  ✅ 直接调用获得了真实token数据 - 代理服务器有问题
                                </div>
                              )}
                            </>
                          )}
                          
                          <details className="mt-3">
                            <summary className="cursor-pointer font-medium">查看完整响应</summary>
                            <pre className="text-xs bg-gray-100 p-3 rounded mt-2 overflow-auto max-h-60">
                              {JSON.stringify(test.data, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : (
                        <div className="text-red-600">
                          <strong>错误:</strong> {test.error}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </div>
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
                <CardTitle className="text-yellow-800">💡 问题诊断和解决方案</CardTitle>
              </CardHeader>
              <CardContent className="text-yellow-800">
                <div className="space-y-4">
                  
                  {/* 根据测试结果提供针对性建议 */}
                  {directResults && results && (
                    <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
                      <h4 className="font-semibold text-blue-800 mb-2">🔍 对比分析结果:</h4>
                      {directResults.tests?.[0]?.usageAnalysis?.tokenValue > 0 ? (
                        <div className="text-green-700">
                          <p>✅ <strong>直接调用Dify API有token数据</strong> - 问题在于代理服务器</p>
                          <p className="text-sm mt-1">建议检查Express服务器的API代理逻辑和响应处理</p>
                        </div>
                      ) : (
                        <div className="text-red-700">
                          <p>❌ <strong>直接调用Dify API也没有token数据</strong> - 问题在于Dify配置</p>
                          <p className="text-sm mt-1">需要检查Dify应用本身的配置</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div>
                    <p><strong>📋 系统性排查清单:</strong></p>
                    <div className="mt-2 space-y-2">
                      <details className="border rounded p-2">
                        <summary className="cursor-pointer font-medium">1. Dify应用配置检查</summary>
                        <ul className="list-disc list-inside space-y-1 ml-4 mt-2 text-sm">
                          <li>确认应用类型：Chatbot/Agent/Workflow</li>
                          <li>检查是否有LLM节点且已正确连接</li>
                          <li>验证LLM模型是否为付费模型 (非免费模型)</li>
                          <li>确认模型提供商配置正确</li>
                        </ul>
                      </details>
                      
                      <details className="border rounded p-2">
                        <summary className="cursor-pointer font-medium">2. Dify账户设置检查</summary>
                        <ul className="list-disc list-inside space-y-1 ml-4 mt-2 text-sm">
                          <li>检查账户余额和credits</li>
                          <li>验证API密钥权限 (包括usage统计权限)</li>
                          <li>确认计费设置已启用</li>
                          <li>检查usage统计功能是否开启</li>
                        </ul>
                      </details>
                      
                      <details className="border rounded p-2">
                        <summary className="cursor-pointer font-medium">3. API调用方式检查</summary>
                        <ul className="list-disc list-inside space-y-1 ml-4 mt-2 text-sm">
                          <li>确认使用正确的API端点</li>
                          <li>验证请求头和参数格式</li>
                          <li>检查是否缺少必要的请求参数</li>
                          <li>测试不同的response_mode</li>
                        </ul>
                      </details>
                      
                      <details className="border rounded p-2">
                        <summary className="cursor-pointer font-medium">4. 代理服务器检查</summary>
                        <ul className="list-disc list-inside space-y-1 ml-4 mt-2 text-sm">
                          <li>检查Express代理是否正确转发请求</li>
                          <li>验证响应数据是否被正确解析</li>
                          <li>确认没有中间处理导致数据丢失</li>
                          <li>检查错误处理和fallback逻辑</li>
                        </ul>
                      </details>
                    </div>
                  </div>
                  
                  <div className="bg-orange-50 p-3 rounded border-l-4 border-orange-400">
                    <h4 className="font-semibold text-orange-800 mb-2">🚀 立即行动建议:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-orange-700 text-sm">
                      <li>先运行"直接调用Dify API"测试</li>
                      <li>如果直接调用有数据，重点检查代理服务器</li>
                      <li>如果直接调用也没数据，重点检查Dify配置</li>
                      <li>在Dify Web界面测试相同消息的token消耗</li>
                      <li>对比Web界面和API的usage数据差异</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}