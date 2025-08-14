import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle, Zap, Shield, Clock, Star, Users, Award } from 'lucide-react';
import { authService } from '@/lib/auth';
import { User } from '@/types';

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // 使用同步方法获取当前用户，避免重复的异步调用
        const currentUser = authService.getCurrentUserSync();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to get current user:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    // 监听认证状态变化
    const handleAuthChange = (event: CustomEvent) => {
      setUser(event.detail.user);
    };

    window.addEventListener('auth-state-changed', handleAuthChange as EventListener);
    
    initializeAuth();

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange as EventListener);
    };
  }, []);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            ProMe AI 服务平台
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            连接 ProMe AI 应用与专业服务，提供高效、可靠的人工智能解决方案
          </p>
          
          {/* 动态按钮区域 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            {user ? (
              <>
                <Button 
                  size="lg" 
                  onClick={() => navigate('/services')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
                >
                  浏览服务
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="px-8 py-3"
                >
                  我的仪表板
                </Button>
              </>
            ) : (
              <>
                <Button 
                  size="lg" 
                  onClick={() => navigate('/register')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
                >
                  立即注册
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="px-8 py-3"
                >
                  用户登录
                </Button>
              </>
            )}
          </div>
          
          {/* 用户状态显示 */}
          {user && (
            <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto mb-8">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <p className="text-gray-700 font-medium">欢迎回来，{user.name}!</p>
              </div>
              <p className="text-sm text-gray-500">当前余额: ¥{user.balance?.toFixed(2) || '0.00'}</p>
              {user.role === 'admin' && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    <Award className="h-3 w-3 mr-1" />
                    管理员
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="text-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <Zap className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">高效智能</h3>
            <p className="text-gray-600">基于先进的AI技术，提供快速准确的服务响应</p>
          </div>
          
          <div className="text-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">安全可靠</h3>
            <p className="text-gray-600">企业级安全保障，保护您的数据和隐私</p>
          </div>
          
          <div className="text-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <Clock className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">24/7服务</h3>
            <p className="text-gray-600">全天候在线服务，随时满足您的需求</p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">平台数据</h2>
            <p className="text-gray-600">值得信赖的AI服务平台</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-blue-600 mr-2" />
                <span className="text-3xl font-bold text-gray-900">10,000+</span>
              </div>
              <p className="text-gray-600">活跃用户</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <Star className="h-8 w-8 text-blue-600 mr-2" />
                <span className="text-3xl font-bold text-gray-900">4.8</span>
              </div>
              <p className="text-gray-600">用户评分</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-blue-600 mr-2" />
                <span className="text-3xl font-bold text-gray-900">99.9%</span>
              </div>
              <p className="text-gray-600">服务可用性</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            准备开始使用AI服务了吗？
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            立即注册，体验智能化的专业服务，提升您的工作效率
          </p>
          
          {!user && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => navigate('/register')}
                className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3"
              >
                免费注册
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate('/pricing')}
                className="border-white text-white hover:bg-white hover:text-blue-600 px-8 py-3"
              >
                查看定价
              </Button>
            </div>
          )}
          
          {user && (
            <Button 
              size="lg"
              onClick={() => navigate('/services')}
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3"
            >
              开始使用服务
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
