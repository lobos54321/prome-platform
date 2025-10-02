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
import { useTranslation } from 'react-i18next';

export default function DifyChat() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 🚧 开发中遮罩开关 - 设置为 false 可显示完整界面
  const showUnderDevelopmentOverlay = false;

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

    // 🔧 添加余额更新事件监听器，确保两个余额显示同步
    const handleBalanceUpdate = (event: CustomEvent) => {
      console.log('🔥 [DifyChat] Received balance-updated event:', {
        currentBalance: user?.balance,
        newBalance: event.detail.balance,
        eventDetail: event.detail,
        userId: user?.id,
        timestamp: new Date().toISOString()
      });
      
      // 只更新余额，不影响conversation_id状态
      if (event.detail.balance !== undefined && typeof event.detail.balance === 'number') {
        setUser(prev => prev ? { ...prev, balance: event.detail.balance } : null);
        console.log('✅ [DifyChat] Header balance updated:', event.detail.balance);
      }
    };

    window.addEventListener('balance-updated', handleBalanceUpdate as EventListener);

    return () => {
      window.removeEventListener('balance-updated', handleBalanceUpdate as EventListener);
    };

  }, [serviceId, navigate, user?.id]); // 添加user?.id依赖以确保事件处理器正确绑定

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
              Deep-Copywriting
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
              {service ? service.name : 'Deep-Copywriting'}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {service 
                ? service.description 
                : t('features.native_api_description', 'Direct Dify API calls, no iframe cross-origin restrictions, faster response')
              }
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6 text-center">
                <Zap className="h-10 w-10 text-yellow-500 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">{t('features.native_api_integration', 'Native API Integration')}</h3>
                <p className="text-sm text-gray-600">
                  {t('features.native_api_description', 'Direct Dify API calls, no iframe cross-origin restrictions, faster response')}
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
            <h2 className="text-2xl font-bold text-center mb-8">{t('features.why_native_api', 'Why choose native API integration?')}</h2>
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
                  <h4 className="font-semibold mb-1">{t('features.hundred_percent_billing', '100% Accurate Billing')}</h4>
                  <p className="text-sm text-gray-600">
                    {t('features.hundred_percent_description', 'Direct access to token usage data from API response, billing accurate to each token')}
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
                  <h4 className="font-semibold mb-1">{t('features.real_time_balance_monitoring', 'Real-time Balance Monitoring')}</h4>
                  <p className="text-sm text-gray-600">
                    {t('features.balance_monitoring_description', 'Update account balance immediately after each conversation, prevent overuse')}
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 relative overflow-hidden">
      {/* 🚧 开发中遮罩层 */}
      {showUnderDevelopmentOverlay && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 z-50 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <div className="text-6xl mb-6">🚧</div>
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Deep-Copywriting
              </h1>
              <p className="text-xl text-gray-600 mb-8">深度专业性个人IP文案</p>
            </div>
            
            <Alert className="bg-yellow-50 border-yellow-200 shadow-lg">
              <AlertDescription className="text-center text-yellow-800 font-medium text-lg py-4">
                🚧 该功能正在开发中，即将上线<br/>
                Under Development, Coming Soon
              </AlertDescription>
            </Alert>

            <div className="mt-8 text-center text-gray-500 text-sm">
              <p>我们正在努力完善这个功能</p>
              <p>敬请期待！</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Kusama dots pattern */}
      <div 
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, #3B82F6 3px, transparent 3px),
            radial-gradient(circle at 80% 20%, #A855F7 2px, transparent 2px),
            radial-gradient(circle at 40% 70%, #F59E0B 1.5px, transparent 1.5px),
            radial-gradient(circle at 90% 80%, #EF4444 2.5px, transparent 2.5px),
            radial-gradient(circle at 10% 90%, #22C55E 2px, transparent 2px)
          `,
          backgroundSize: '100px 100px, 120px 120px, 80px 80px, 140px 140px, 90px 90px'
        }}
      ></div>
      
      {/* Kandinsky geometric shapes */}
      <div className="absolute top-20 left-16 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full animate-pulse"></div>
      <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-br from-yellow-400/15 to-red-400/15 transform rotate-45 animate-bounce"></div>
      <div className="absolute bottom-32 left-1/4 w-40 h-20 bg-gradient-to-br from-green-400/15 to-teal-400/15 rounded-full animate-pulse delay-1000"></div>
      <div className="absolute bottom-40 right-1/3 w-28 h-28 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-lg transform rotate-12 animate-bounce delay-500"></div>

      <div className="relative container mx-auto px-4 py-8 z-10">
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

        {/* Artistic Page Header */}
        <div className="mb-8">
          <div className="text-center">
            {/* Artistic divider */}
            <div className="flex justify-center mb-8 space-x-3">
              {[...Array(7)].map((_, i) => (
                <div 
                  key={i}
                  className="w-4 h-4 rounded-full animate-bounce"
                  style={{
                    backgroundColor: ['#3B82F6', '#A855F7', '#F59E0B', '#EF4444', '#22C55E', '#EC4899', '#06B6D4'][i],
                    animationDelay: `${i * 150}ms`
                  }}
                ></div>
              ))}
            </div>
            
            {/* Kandinsky-inspired icon */}
            <div className="relative w-28 h-28 mx-auto mb-8">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl rotate-12 animate-pulse"></div>
              <div className="absolute inset-3 bg-white rounded-2xl flex items-center justify-center shadow-inner">
                <MessageSquare className="h-12 w-12 text-blue-600" />
              </div>
              
              {/* Floating artistic elements */}
              <div className="absolute -top-3 -right-3 w-6 h-6 bg-yellow-400 rounded-full animate-bounce"></div>
              <div className="absolute -bottom-3 -left-3 w-4 h-4 bg-pink-400 rounded-full animate-bounce delay-300"></div>
              <div className="absolute top-2 -right-6 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            </div>

            <h1 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Deep-Copywriting
              </span>
            </h1>
            <p className="text-2xl text-gray-700 mb-8 font-light">
              <span className="bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
                {t('chat.deep_copywriting_subtitle', '深度专业性个人IP文案')}
              </span>
            </p>
          </div>

            <div className="flex items-center gap-4">
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

        {/* Main Chat Interface - Artistic Style */}
        <div className="relative">
          {/* Kusama dots overlay for chat area */}
          <div 
            className="absolute inset-0 rounded-3xl opacity-10 pointer-events-none"
            style={{
              backgroundImage: `
                radial-gradient(circle at 30% 20%, #3B82F6 2px, transparent 2px),
                radial-gradient(circle at 70% 80%, #06B6D4 1.5px, transparent 1.5px)
              `,
              backgroundSize: '60px 60px, 80px 80px'
            }}
          ></div>
          
          <div className="relative bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 p-8 h-[calc(100vh-300px)] min-h-[600px]">
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
              : t('chat.dify_welcome_message_new', '使用诀窍：为了创建有效的营销文案，我需要收集4个关键信息：\n\n1. **您的产品**: 您要推广的产品或服务是什么？\n2. **产品特色**: 您的产品有哪些主要特色或优势？\n3. **目标受众**: 您的目标客户群体是谁？\n4. **内容长度**: 您需要多少字的文案？\n\n请分享这些详细信息来开始创建您的营销内容！')
            }
          />
          </div>
        </div>
        
        {/* Artistic footer */}
        <div className="mt-16 text-center">
          <div className="flex justify-center space-x-2 mb-4">
            {[...Array(9)].map((_, i) => (
              <div 
                key={i}
                className="w-3 h-3 rounded-full animate-bounce"
                style={{
                  backgroundColor: ['#3B82F6', '#A855F7', '#F59E0B', '#EF4444', '#22C55E', '#EC4899', '#06B6D4', '#8B5CF6', '#F97316'][i],
                  animationDelay: `${i * 100}ms`
                }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}