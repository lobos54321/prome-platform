import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Loader2,
  ArrowLeft,
  RefreshCw,
  Network,
  Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { N8nDiagnostic, runQuickN8nCheck } from '@/utils/n8n-diagnostic';

interface DiagnosticResult {
  step: string;
  success: boolean;
  message: string;
  details?: any;
  error?: string;
}

interface DiagnosticReport {
  timestamp: string;
  webhookUrl: string;
  overallStatus: 'success' | 'partial' | 'failed';
  results: DiagnosticResult[];
  recommendations: string[];
}

export default function N8nDiagnostic() {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [quickStatus, setQuickStatus] = useState<{isHealthy: boolean; message: string} | null>(null);

  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

  const runQuickCheck = async () => {
    if (!webhookUrl) {
      setQuickStatus({
        isHealthy: false,
        message: 'N8n Webhook URL未配置'
      });
      return;
    }

    setIsRunning(true);
    try {
      const result = await runQuickN8nCheck(webhookUrl);
      setQuickStatus(result);
    } catch (error) {
      setQuickStatus({
        isHealthy: false,
        message: `检查失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runFullDiagnostic = async () => {
    if (!webhookUrl) {
      alert('请先配置N8n Webhook URL');
      return;
    }

    setIsRunning(true);
    setReport(null);
    
    try {
      const diagnostic = new N8nDiagnostic(webhookUrl);
      const result = await diagnostic.runFullDiagnostic();
      setReport(result);
    } catch (error) {
      console.error('诊断执行失败:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-5 w-5 text-green-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">正常</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800">部分异常</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">异常</Badge>;
      default:
        return <Badge variant="secondary">未知</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* 页面头部 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/chat/n8n')}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回N8n聊天
            </Button>
            <div className="flex items-center">
              <Network className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">N8n集成诊断</h1>
                <p className="text-gray-600">检查N8n工作流连接状态和配置问题</p>
              </div>
            </div>
          </div>
        </div>

        {/* 配置信息 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              当前配置
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <strong>Webhook URL:</strong>
                <code className="ml-2 px-2 py-1 bg-gray-100 rounded text-sm">
                  {webhookUrl || '未配置'}
                </code>
              </div>
              <div>
                <strong>N8n集成状态:</strong>
                <Badge className="ml-2" variant={webhookUrl ? "default" : "destructive"}>
                  {webhookUrl ? '已启用' : '未启用'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 快速检查 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>快速健康检查</CardTitle>
            <CardDescription>
              快速检查N8n服务是否响应
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-4">
              <Button 
                onClick={runQuickCheck}
                disabled={isRunning || !webhookUrl}
                className="flex items-center"
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                快速检查
              </Button>
              
              <Button 
                onClick={runFullDiagnostic}
                disabled={isRunning || !webhookUrl}
                variant="outline"
                className="flex items-center"
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                完整诊断
              </Button>
            </div>

            {quickStatus && (
              <Alert className={quickStatus.isHealthy ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-center">
                  {quickStatus.isHealthy ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                  )}
                  <AlertDescription className={quickStatus.isHealthy ? 'text-green-800' : 'text-red-800'}>
                    {quickStatus.message}
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 完整诊断报告 */}
        {report && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>完整诊断报告</CardTitle>
                  <CardDescription>
                    执行时间: {new Date(report.timestamp).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <span>整体状态:</span>
                  {getStatusBadge(report.overallStatus)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 检查步骤结果 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">检查步骤</h3>
                <div className="space-y-3">
                  {report.results.map((result, index) => (
                    <div 
                      key={index}
                      className={`p-4 rounded-lg border ${
                        result.success 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start">
                          {getStatusIcon(result.success)}
                          <div className="ml-3">
                            <h4 className="font-medium">{result.step}</h4>
                            <p className={`text-sm ${
                              result.success ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {result.message}
                            </p>
                            {result.error && (
                              <p className="text-xs text-red-600 mt-1">
                                错误: {result.error}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {result.details && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                            查看详细信息
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 建议和解决方案 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">建议和解决方案</h3>
                <div className="space-y-2">
                  {report.recommendations.map((recommendation, index) => (
                    <Alert key={index}>
                      <AlertDescription>
                        {recommendation}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>

              {/* 技术信息 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">技术信息</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Webhook URL:</strong>
                      <br />
                      <code className="text-xs break-all">{report.webhookUrl}</code>
                    </div>
                    <div>
                      <strong>检查时间:</strong>
                      <br />
                      {new Date(report.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 帮助信息 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>故障排除指南</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold">常见问题:</h4>
                <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
                  <li><strong>500错误:</strong> N8n工作流内部错误，检查工作流配置和节点连接</li>
                  <li><strong>404错误:</strong> Webhook端点不存在，确认工作流已激活</li>
                  <li><strong>CORS错误:</strong> 跨域配置问题，检查N8n服务器CORS设置</li>
                  <li><strong>网络错误:</strong> 服务器不可达，检查URL和网络连接</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold">检查清单:</h4>
                <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
                  <li>N8n工作流是否已保存并激活</li>
                  <li>Chat Trigger节点是否正确配置</li>
                  <li>工作流是否有足够的执行权限</li>
                  <li>环境变量VITE_N8N_WEBHOOK_URL是否正确设置</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}