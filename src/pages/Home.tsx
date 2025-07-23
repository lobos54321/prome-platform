import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Sparkles, Zap, Shield, BarChart3 } from 'lucide-react';
import { authService } from '@/lib/auth';

export default function Home() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const features = [
    {
      title: '灵活计费',
      description: '根据实际使用的API调用次数和处理数据量计费，真正做到用多少付多少',
      icon: <Zap className="h-12 w-12 text-blue-500" />
    },
    {
      title: '安全可靠',
      description: '企业级数据加密和安全保障，完善的隐私保护机制',
      icon: <Shield className="h-12 w-12 text-green-500" />
    },
    {
      title: '丰富模型',
      description: '支持多种主流AI大模型，满足各类应用场景需求',
      icon: <Sparkles className="h-12 w-12 text-purple-500" />
    },
    {
      title: '使用分析',
      description: '详细的使用量统计和费用分析，帮助优化成本',
      icon: <BarChart3 className="h-12 w-12 text-orange-500" />
    }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            ProMe
          </h1>
          <p className="text-xl md:text-2xl text-gray-700 mb-10 max-w-2xl mx-auto">
            Feed your feed to your AI, and let it feed you
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              size="lg"
              onClick={() => navigate(user ? '/services' : '/register')}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              {user ? '浏览服务' : '立即注册'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate('/pricing')}
            >
              查看价格
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">平台特色</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="pt-6 text-center">
                  <div className="mb-4 flex justify-center">{feature.icon}</div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">如何使用</h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-12">
            三步简单操作，快速接入AI能力
          </p>
          
          <div className="flex flex-col md:flex-row gap-8 justify-center items-center md:items-stretch">
            <div className="flex-1 max-w-xs text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">注册账号</h3>
              <p className="text-gray-600">创建您的平台账号，充值初始余额</p>
            </div>
            
            <div className="flex-1 max-w-xs text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">选择服务</h3>
              <p className="text-gray-600">从服务目录中选择您需要的AI服务</p>
            </div>
            
            <div className="flex-1 max-w-xs text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">按量付费</h3>
              <p className="text-gray-600">根据实际使用量自动计费，实时查看使用统计</p>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <Button 
              size="lg"
              onClick={() => navigate('/services')}
            >
              开始使用
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">准备好开始了吗？</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            加入我们的平台，使用先进的AI能力提升您的业务
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => navigate(user ? '/services' : '/register')}
          >
            {user ? '浏览服务' : '立即注册'}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
}