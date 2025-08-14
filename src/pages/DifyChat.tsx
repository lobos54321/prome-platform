/**
 * Dify Chat Page
 * 
 * Main page for Dify native API chat interface with integrated token monitoring.
 * Now supports service-specific configurations for unified chat experience.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageSquare, 
  Zap, 
  Shield, 
  DollarSign,
  Users,
  TrendingUp,
  CheckCircle,
  Bot,
  ArrowLeft
} from 'lucide-react';
import { DifyChatInterface } from '@/components/chat/DifyChatInterface';
import { authService } from '@/lib/auth';
import { servicesAPI } from '@/lib/services';
import { User, Service } from '@/types';
import { toast } from 'sonner';

export default function DifyChat() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserAndService = async () => {
      try {
        // Load user
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);

        // Load service if serviceId is provided
        if (serviceId) {
          const serviceData = await servicesAPI.getService(serviceId);
          if (!serviceData) {
            toast.error('服务不存在或已下线');
            navigate('/services');
            return;
          }
          setService(serviceData);
        }
      } catch (error) {
        console.error('Failed to load user or service:', error);
        toast.error('加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserAndService();
  }, [serviceId, navigate]);

  // Check if Dify is configured
  // Support both chat apps (need APP_ID) and workflow apps (optional APP_ID)
  const isDifyConfigured = !!(
    import.meta.env.VITE_DIFY_API_URL &&
    import.meta.env.VITE_DIFY_API_KEY &&
    (import.meta.env.VITE_DIFY_APP_ID || true) // APP_ID optional for workflows
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!isDifyConfigured) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              ProMe AI聊天
            </CardTitle>
            <CardDescription>
              直接调用ProMe API的原生聊天界面
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Dify API未配置。请联系管理员设置以下环境变量：
                <ul className="mt-2 list-disc list-inside text-sm">
                  <li>VITE_DIFY_API_URL</li>
                  <li>VITE_DIFY_API_KEY</li>
                  <li>VITE_DIFY_APP_ID (仅聊天应用需要，工作流应用可选)</li>
                </ul>
                <div className="mt-2 text-xs text-gray-500">
                  💡 当前系统支持工作流模式，无需APP_ID即可使用
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back to services button if we have a serviceId */}
          {service && (
            <div className="mb-6">
              <Button 
                variant="outline" 
                onClick={() => navigate('/services')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                返回服务列表
              </Button>
            </div>
          )}

          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                {service ? (
                  <Bot className="h-8 w-8 text-blue-600" />
                ) : (
                  <MessageSquare className="h-8 w-8 text-blue-600" />
                )}
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {service ? service.name : 'ProMe AI聊天助手'}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {service 
                ? service.description 
                : '基于ProMe原生API的智能聊天界面，提供100%准确的Token监控和实时计费'
              }
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6 text-center">
                <Zap className="h-10 w-10 text-yellow-500 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">原生API集成</h3>
                <p className="text-sm text-gray-600">
                  直接调用Dify API，无iframe跨域限制，响应更快速
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Shield className="h-10 w-10 text-green-500 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">精确计费</h3>
                <p className="text-sm text-gray-600">
                  100%准确的Token使用监控，实时扣费无遗漏
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <TrendingUp className="h-10 w-10 text-blue-500 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">流式响应</h3>
                <p className="text-sm text-gray-600">
                  支持实时流式输出，提供更好的用户体验
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Login Required */}
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-4">请先登录</h3>
              <p className="text-gray-600 mb-6">
                {service 
                  ? `需要登录账户才能使用${service.name}并进行Token计费`
                  : '需要登录账户才能使用AI聊天功能并进行Token计费'
                }
              </p>
              <div className="flex gap-4 justify-center">
                <Button 
                  onClick={() => window.location.href = '/login'}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  立即登录
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/register'}
                >
                  注册账户
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Benefits */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-center mb-8">为什么选择原生API集成？</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">解决跨域限制</h4>
                  <p className="text-sm text-gray-600">
                    不再依赖iframe，完全避免跨域消息监听失败的问题
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">100%准确计费</h4>
                  <p className="text-sm text-gray-600">
                    直接获取API响应中的Token使用数据，计费精确到每个Token
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">更好的用户体验</h4>
                  <p className="text-sm text-gray-600">
                    支持流式响应、消息重试、对话管理等高级功能
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">实时余额监控</h4>
                  <p className="text-sm text-gray-600">
                    每次对话后立即更新账户余额，防止超额使用
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Back to services button if we have a service */}
        {service && (
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => navigate('/services')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              返回服务列表
            </Button>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {service ? (
                  <>
                    <Bot className="h-6 w-6 text-blue-600" />
                    {service.name}
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-6 w-6 text-blue-600" />
                    ProMe AI聊天
                  </>
                )}
                <Badge variant="secondary" className="ml-2">
                  <Zap className="h-3 w-3 mr-1" />
                  原生API
                </Badge>
              </h1>
              <p className="text-gray-600 mt-1">
                欢迎 {user.name}，当前余额: <span className="font-semibold text-green-600">{user.balance.toLocaleString()}</span> 积分
                {service && (
                  <span className="ml-2 text-sm">
                    • {service.description}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Badge variant="outline" className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                实时计费
              </Badge>
              {user.balance < 1000 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = '/pricing'}
                  className="text-orange-600 border-orange-200 hover:bg-orange-50"
                >
                  余额不足，去充值
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Chat Interface */}
        <div className="h-[calc(100vh-200px)] min-h-[600px]">
          <DifyChatInterface 
            className="h-full"
            showMetadata={false}
            enableStreaming={true}
            autoStartConversation={true}
            mode="workflow" // Enable workflow mode by default
            showWorkflowProgress={true}
            enableRetry={true}
            user={user} // 🔥 传递认证用户信息
            placeholder={service 
              ? `输入您的${service.name}需求...` 
              : "输入您的消息或工作流指令..."
            }
            welcomeMessage={service 
              ? `您好！我是${service.name}。${service.description}有什么可以帮助您的吗？`
              : "您好！我是您的AI助手。我支持普通聊天和复杂工作流处理。有什么可以帮助您的吗？"
            }
          />
        </div>
      </div>
    </div>
  );
}