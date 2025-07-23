import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Clipboard, CheckCircle2, Copy, AlertCircle, LinkIcon, ShieldCheck } from 'lucide-react';
import { webhookHandler } from '@/lib/webhook';
import { authService } from '@/lib/auth';

export default function WebhookConfig() {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('setup');
  const [testResponse, setTestResponse] = useState<{success: boolean; message: string} | null>(null);
  const [apiKey, setApiKey] = useState(webhookHandler.getApiKey());
  const [newApiKey, setNewApiKey] = useState('');
  
  const user = authService.getCurrentUser();
  const isAdmin = user && user.role === 'admin';
  const webhookUrl = webhookHandler.getWebhookUrl();

  // Test request payload
  const samplePayload = {
    conversation_id: "conv_example",
    user_id: user?.id || "user_example",
    query: "为我的产品生成一个60秒的口播文案",
    response: {
      answer: "【60秒产品口播文案】\n\n[轻快背景音乐]\n\n[男声，热情洋溢]：厌倦了反复清洗却依然有异味的水杯？\n\n[音效：水流声]\n\n[男声，肯定语气]：全新推出的\"清净杯\"，采用特殊纳米抗菌材质，24小时持久抑菌，彻底告别异味困扰！\n\n[女声，惊喜]：哇！真的一点异味都没有！\n\n[男声]：不仅如此，清净杯还具备：\n- 304医用级不锈钢内胆\n- 12小时保温保冷功能\n- 一键开启的防漏设计\n\n[音效：轻松的\"叮\"声]\n\n[男声，亲切]：即日起，前100名购买者还将获得精美杯刷一套！\n\n[女声，热情]：清净杯，让您的每一口都是纯净享受！\n\n[男声，标语]：清净杯——喝水，就该这么简单！\n\n[音效：品牌音效]\n\n[男声]：添加屏幕下方二维码，立即购买！"
    },
    model: "gpt-4",
    metadata: {
      test_mode: true,
      app_name: "口播文案生成器",
      tags: ["产品", "广告", "60秒"]
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 3000);
  };

  const handleKeyChange = () => {
    if (isAdmin && newApiKey) {
      try {
        webhookHandler.updateApiKey(newApiKey);
        setApiKey(newApiKey);
        setNewApiKey('');
        setTestResponse({
          success: true,
          message: 'API密钥已成功更新'
        });
      } catch (error) {
        setTestResponse({
          success: false,
          message: error instanceof Error ? error.message : '更新API密钥失败'
        });
      }
    }
  };

  const handleTestWebhook = () => {
    try {
      webhookHandler.simulateWebhook(
        "测试口播文案",
        "这是一个通过webhook测试生成的口播文案内容。\n\n[开场白]\n各位听众朋友们，大家好！\n\n[正文]\n欢迎收听今天的节目。这是一段测试文本，用于验证webhook功能是否正常工作。\n\n[结束语]\n感谢您的收听，我们下期再会！",
        "GPT-4"
      );
      
      setTestResponse({
        success: true,
        message: '测试webhook已成功处理'
      });
    } catch (error) {
      setTestResponse({
        success: false,
        message: error instanceof Error ? error.message : 'webhook测试失败'
      });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Webhook配置</h1>
          <p className="text-gray-500">设置和管理Dify与ProMe的webhook集成</p>
        </div>
        <Badge variant={isAdmin ? "default" : "outline"}>
          {isAdmin ? '管理员' : '仅查看模式'}
        </Badge>
      </div>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="setup">配置说明</TabsTrigger>
          <TabsTrigger value="security">安全设置</TabsTrigger>
          <TabsTrigger value="testing">测试工具</TabsTrigger>
        </TabsList>
        
        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle>Webhook配置指南</CardTitle>
              <CardDescription>
                如何在Dify平台中设置webhook以连接到ProMe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="font-medium">1. Webhook URL</Label>
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
                <p className="text-sm text-gray-500">
                  这是您的webhook接收端点，需要在Dify应用中配置
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="font-medium">2. API密钥</Label>
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
                  将此API密钥添加到Dify的webhook配置中，作为身份验证
                </p>
              </div>
              
              <div className="border-t pt-6 mt-2">
                <h3 className="font-medium mb-4">在Dify中设置步骤</h3>
                <ol className="list-decimal pl-5 space-y-4">
                  <li>
                    <p>登录到您的Dify应用管理后台</p>
                  </li>
                  <li>
                    <p>选择您的口播文案应用，进入应用配置页面</p>
                  </li>
                  <li>
                    <p>点击"API & Webhook"标签页</p>
                  </li>
                  <li>
                    <p>找到"Webhook"部分，点击"添加Webhook"</p>
                  </li>
                  <li>
                    <p>在URL字段中粘贴上面的Webhook URL</p>
                  </li>
                  <li>
                    <p>将API密钥添加到"请求头"部分：</p>
                    <div className="bg-gray-100 p-2 rounded mt-1 font-mono text-sm">
                      x-api-key: {apiKey}
                    </div>
                  </li>
                  <li>
                    <p>选择事件触发条件：建议选择"完成响应后"</p>
                  </li>
                  <li>
                    <p>保存配置并启用webhook</p>
                  </li>
                </ol>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">
                查看详细文档
              </Button>
              <Button onClick={() => setActiveTab('testing')}>
                测试配置
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>安全设置</CardTitle>
              <CardDescription>
                管理webhook的安全配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isAdmin && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    您需要管理员权限才能更改安全设置
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="newApiKey">更新API密钥</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="newApiKey"
                    type="text"
                    placeholder="输入新的API密钥"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    disabled={!isAdmin}
                  />
                  <Button 
                    onClick={handleKeyChange}
                    disabled={!isAdmin || !newApiKey}
                  >
                    更新
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  API密钥用于验证来自Dify的请求，确保其安全并定期更换
                </p>
              </div>
              
              <div className="flex items-start space-x-2 pt-4">
                <ShieldCheck className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">安全最佳实践</h3>
                  <ul className="mt-2 space-y-2 text-sm text-gray-600">
                    <li>• 定期更换API密钥，尤其是在人员变动后</li>
                    <li>• 不要在客户端代码中暴露API密钥</li>
                    <li>• 监控webhook使用情况，检测异常活动</li>
                    <li>• 在生产环境中使用HTTPS确保数据传输安全</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="testing">
          <Card>
            <CardHeader>
              <CardTitle>测试工具</CardTitle>
              <CardDescription>
                验证您的webhook配置是否正常工作
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="font-medium">示例Dify请求负载</Label>
                <div className="bg-gray-100 p-3 rounded border overflow-x-auto">
                  <pre className="text-xs">{JSON.stringify(samplePayload, null, 2)}</pre>
                </div>
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(samplePayload, null, 2), 'payload')}
                  >
                    {copied === 'payload' ? (
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                    ) : (
                      <Clipboard className="h-4 w-4 mr-2" />
                    )}
                    复制示例
                  </Button>
                </div>
              </div>
              
              {testResponse && (
                <Alert
                  variant={testResponse.success ? "default" : "destructive"}
                  className={testResponse.success ? "bg-green-50 border-green-200" : ""}
                >
                  <AlertDescription className={testResponse.success ? "text-green-800" : ""}>
                    {testResponse.message}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="pt-4">
                <h3 className="font-medium mb-4">手动测试</h3>
                <div className="space-y-4">
                  <Button onClick={handleTestWebhook}>
                    发送测试请求
                  </Button>
                  <p className="text-sm text-gray-500">
                    这将模拟一个来自Dify的请求，验证您的webhook处理流程
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline"
                onClick={() => setTestResponse(null)}
              >
                清除测试结果
              </Button>
              <a href="https://dify.ai/docs/api-reference" target="_blank" rel="noopener">
                <Button variant="link" className="gap-1">
                  <LinkIcon className="h-4 w-4" />
                  Dify API文档
                </Button>
              </a>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}