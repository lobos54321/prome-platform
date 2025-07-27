import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCircle2, InfoIcon } from 'lucide-react';
import { authService } from '@/lib/auth';

export default function WebhookConfig() {
  const [copied, setCopied] = useState<string | null>(null);
  
  const user = authService.getCurrentUser();
  const isAdmin = user && user.role === 'admin';
  
  // Simple webhook configuration - using environment variables instead of complex UI
  const webhookUrl = `${window.location.origin}/api/webhook/dify`;
  const apiKey = import.meta.env.VITE_WEBHOOK_API_KEY || 'prome_wh_key_default';

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 3000);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Webhook配置</h1>
          <p className="text-gray-500">Dify集成的基本配置信息</p>
        </div>
        <Badge variant={isAdmin ? "default" : "outline"}>
          {isAdmin ? '管理员' : '仅查看模式'}
        </Badge>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Dify Webhook 集成</CardTitle>
          <CardDescription>
            简化的webhook配置，用于接收Dify的消息回调
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Webhook集成是可选的。如果您不使用Dify平台，可以忽略此配置。
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="font-medium">Webhook URL</label>
              <div className="flex items-center space-x-2">
                <div className="bg-gray-100 p-2 rounded flex-1 font-mono text-sm border">
                  {webhookUrl}
                </div>
                <Button 
                  size="icon" 
                  variant="outline"
                  onClick={() => copyToClipboard(webhookUrl, 'url')}
                >
                  {copied === 'url' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="font-medium">API密钥</label>
              <div className="flex items-center space-x-2">
                <div className="bg-gray-100 p-2 rounded flex-1 font-mono text-sm border">
                  {apiKey}
                </div>
                <Button 
                  size="icon" 
                  variant="outline"
                  onClick={() => copyToClipboard(apiKey, 'apiKey')}
                >
                  {copied === 'apiKey' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                在环境变量 VITE_WEBHOOK_API_KEY 中配置API密钥
              </p>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">基本使用说明</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• 在Dify中配置上述webhook URL和API密钥</p>
              <p>• 系统将自动接收和处理消息回调</p>
              <p>• 如果不需要Dify集成，可以禁用此功能</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}