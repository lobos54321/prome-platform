import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Send, Mic, AlertCircle, Bot, UserCircle, RefreshCw, Download, Copy, Settings } from 'lucide-react';
import { Service, TokenUsage } from '@/types';
import { servicesAPI } from '@/lib/services';
import { authService } from '@/lib/auth';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatSettings {
  model: string;
  temperature: number;
  testMode: boolean;
  saveHistory: boolean;
  maxTokens: number;
}

export default function Chat() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [service, setService] = useState<Service | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [lastUsage, setLastUsage] = useState<TokenUsage | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>({
    model: 'GPT-4',
    temperature: 0.7,
    testMode: true, // Default to test mode for easier testing
    saveHistory: true,
    maxTokens: 1000
  });

  const availableModels = [
    'GPT-4', 'GPT-4o', 'GPT-3.5', 
    'Claude 3 Opus', 'Claude 3 Sonnet', 'Claude 3 Haiku',
    'DeepSeek R1', '火山方舟 V3'
  ];
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const loadService = async () => {
      try {
        if (!serviceId) return;
        const serviceData = await servicesAPI.getService(serviceId);
        if (!serviceData) {
          setError('服务不存在或已下线');
          return;
        }
        setService(serviceData);
        
        // Initialize with a system message
        setMessages([
          {
            id: 'system-1',
            role: 'system',
            content: `你是${serviceData.name}，专注于生成口播文案的AI助手。你会提供专业、自然、流畅的口播内容。`,
            timestamp: new Date()
          }
        ]);
      } catch (error) {
        setError('加载服务信息失败');
      }
    };
    
    loadService();
  }, [serviceId, user, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const simulateTokenUsage = (text: string) => {
    // Simulate token counting - rough approximation
    const tokenCount = Math.ceil(text.length / 4);
    return tokenCount;
  };

  const simulateResponse = async (userMessage: string): Promise<string> => {
    // Simulate waiting for API response
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate a response based on the service type
    if (service?.id === 'broadcast-script') {
      return `以下是根据您的需求生成的口播文案：\n\n【开场】\n亲爱的观众朋友们，大家好！\n\n【正文】\n${userMessage}的核心内容已经为您精心组织成易于播报的段落。文案语言流畅自然，适合直接口播使用，添加了适当的停顿标记和语气提示。\n\n【结尾】\n感谢您的收听，我们下期再会！`;
    } 
    else if (service?.id === 'voice-optimization') {
      return `已为您优化的口播稿：\n\n${userMessage}\n\n【优化要点】\n• 添加了停顿标记 (/) 帮助控制语速和节奏\n• 调整了语句长度，确保每句话在一次呼吸内可以完成\n• 标注了重音词 (*) 以增强表现力\n• 简化了复杂句式，提高可读性`;
    }
    else if (service?.id === 'ad-script-generator') {
      return `【30秒广告脚本】\n\n[轻快的背景音乐渐入]\n\n旁白(热情洋溢)：想让您的产品脱颖而出吗？\n\n[停顿2秒]\n\n旁白(确信)：${userMessage}是您的最佳选择！我们提供优质服务，价格实惠，客户满意度高达98%！\n\n[音效：清脆的铃声]\n\n旁白(亲切)：现在拨打屏幕下方电话，前100名顾客还可获得超值赠品！\n\n[音乐渐强后渐弱]\n\n旁白(有力)：${userMessage} - 让选择变得简单！`;
    }
    else {
      return `已收到您关于"${userMessage}"的请求，这是专业口播稿版本：\n\n[专业播音腔调]\n${userMessage}\n\n以上内容已经过语言优化，添加了适当的停顿和语气变化，适合直接用于口播。`;
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isGenerating) return;
    
    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);
    setError('');
    
    try {
      // Simulate token usage for user message
      const userTokens = simulateTokenUsage(input);
      
      // Simulate AI response
      const responseText = await simulateResponse(input);
      
      // Simulate token usage for AI response
      const assistantTokens = simulateTokenUsage(responseText);
      const totalTokens = userTokens + assistantTokens;
      
      // Add assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Calculate cost
      const cost = totalTokens * (service?.pricePerToken || 0.0002) / 1000;
      
      // Create usage record
      if (!settings.testMode) {
        const usage: TokenUsage = {
          id: `usage-${Date.now()}`,
          userId: user?.id || '',
          serviceId: service?.name || '',
          tokensUsed: totalTokens,
          cost: cost,
          timestamp: new Date().toISOString(),
          sessionId: `session-${serviceId}-${Date.now()}`
        };
        
        await servicesAPI.addTokenUsage(usage);
        await authService.updateBalance(-cost);
        setLastUsage(usage);
      } else {
        // Just display the would-be usage in test mode
        setLastUsage({
          id: `test-${Date.now()}`,
          userId: user?.id || '',
          serviceId: service?.name || '',
          tokensUsed: totalTokens,
          cost: cost,
          timestamp: new Date().toISOString(),
          sessionId: `test-session-${serviceId}-${Date.now()}`
        });
      }
    } catch (err) {
      setError('生成回复时出错，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearConversation = () => {
    if (window.confirm('确定要清空当前会话吗？')) {
      setMessages([
        {
          id: 'system-1',
          role: 'system',
          content: `你是${service?.name}，专注于生成口播文案的AI助手。你会提供专业、自然、流畅的口播内容。`,
          timestamp: new Date()
        }
      ]);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadChat = () => {
    const chatText = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`)
      .join('\n\n');
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `propen-chat-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left sidebar with service info */}
        <div className="lg:w-1/4">
          <div className="sticky top-20">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="rounded-full bg-gray-100 p-2">
                    <Bot className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="font-semibold text-lg">{service?.name || '加载中...'}</h2>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  {service?.description || ''}
                </p>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {service?.features.map((feature, index) => (
                    <Badge key={index} variant="secondary">
                      {feature}
                    </Badge>
                  ))}
                </div>
                
                <div className="border-t pt-4 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    设置
                  </Button>
                </div>
                
                {showSettings && (
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>AI 模型</Label>
                      <Select
                        value={settings.model}
                        onValueChange={(value) => setSettings({...settings, model: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModels.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>温度 ({typeof settings.temperature === 'number' ? settings.temperature.toFixed(1) : '0.0'})</Label>
                      </div>
                      <Slider
                        min={0}
                        max={1}
                        step={0.1}
                        value={[settings.temperature]}
                        onValueChange={(values) => setSettings({...settings, temperature: values[0]})}
                      />
                      <p className="text-xs text-gray-500">
                        较低值使输出更确定，较高值使输出更随机
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="testMode"
                        checked={settings.testMode}
                        onCheckedChange={(checked) => setSettings({...settings, testMode: checked})}
                      />
                      <Label htmlFor="testMode">测试模式（不消耗余额）</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="saveHistory"
                        checked={settings.saveHistory}
                        onCheckedChange={(checked) => setSettings({...settings, saveHistory: checked})}
                      />
                      <Label htmlFor="saveHistory">保存聊天记录</Label>
                    </div>
                  </div>
                )}
                
                {lastUsage && (
                  <div className="border-t mt-4 pt-4 text-sm">
                    <p className="font-medium mb-2">上次请求</p>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">使用Token数：</span>
                      <span>{lastUsage.tokensUsed.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">费用：</span>
                      <span className={settings.testMode ? "text-blue-600" : "text-green-600"}>
                        {settings.testMode ? '(测试)' : ''} ¥{typeof lastUsage.cost === 'number' ? lastUsage.cost.toFixed(4) : '0.0000'}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Main chat area */}
        <div className="flex-1">
          <Card className="mb-4 min-h-[500px] flex flex-col">
            <CardContent className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-4 min-h-[450px]">
                {/* Welcome message if no messages yet */}
                {messages.length <= 1 && (
                  <div className="flex flex-col items-center justify-center h-[450px] text-center p-8">
                    <Bot className="h-16 w-16 text-blue-500 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">欢迎使用 {service?.name}</h3>
                    <p className="text-gray-600 mb-6 max-w-md">
                      输入您的文本内容，我将为您生成专业的口播文案。测试模式已开启，您可以免费体验此功能。
                    </p>
                  </div>
                )}
                
                {/* Chat messages */}
                {messages.filter(m => m.role !== 'system').map((message) => (
                  <div 
                    key={message.id} 
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`rounded-lg p-4 max-w-3/4 whitespace-pre-wrap ${
                        message.role === 'user' 
                          ? 'bg-blue-100 text-blue-900' 
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center mb-2">
                        {message.role === 'user' ? (
                          <>
                            <span className="font-medium mr-auto">您</span>
                            <UserCircle className="h-5 w-5" />
                          </>
                        ) : (
                          <>
                            <Bot className="h-5 w-5 mr-2" />
                            <span className="font-medium">{service?.name}</span>
                          </>
                        )}
                      </div>
                      <p>{message.content}</p>
                      {message.role === 'assistant' && (
                        <div className="flex justify-end mt-2 space-x-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7"
                            onClick={() => copyToClipboard(message.content)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </CardContent>
          </Card>
          
          {/* Input area */}
          <div className="relative">
            <Textarea
              placeholder="输入您的文本内容..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="min-h-[100px] pr-20"
              disabled={isGenerating}
            />
            <div className="absolute bottom-3 right-3 flex space-x-2">
              <Button 
                size="icon" 
                variant="outline" 
                onClick={clearConversation}
                disabled={messages.length <= 1 || isGenerating}
                className="rounded-full h-8 w-8"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="outline" 
                onClick={downloadChat}
                disabled={messages.length <= 1}
                className="rounded-full h-8 w-8"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                onClick={handleSendMessage}
                disabled={!input.trim() || isGenerating}
                className="rounded-full h-8 w-8"
              >
                {isGenerating ? (
                  <span className="animate-spin">
                    <RefreshCw className="h-4 w-4" />
                  </span>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          {settings.testMode && (
            <div className="mt-4">
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-800">
                  测试模式已开启，使用AI服务不会消耗账户余额，仅用于功能体验。
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
