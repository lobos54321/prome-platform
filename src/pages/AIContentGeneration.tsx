import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bot, Loader2 } from 'lucide-react';
import { servicesAPI } from '@/lib/services';
import { authService } from '@/lib/auth';
import { Service } from '@/types';

export default function AIContentGeneration() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = authService.getCurrentUser();

  useEffect(() => {
    const loadService = async () => {
      if (!serviceId) {
        setError('服务ID未找到');
        setLoading(false);
        return;
      }

      try {
        const serviceData = await servicesAPI.getService(serviceId);
        if (!serviceData) {
          setError('未找到对应的服务');
          setLoading(false);
          return;
        }
        setService(serviceData);
      } catch (err) {
        console.error('Error loading service:', err);
        setError('加载服务信息失败');
      } finally {
        setLoading(false);
      }
    };

    loadService();
  }, [serviceId]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">出错了</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => navigate('/services')}>
              返回服务目录
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!service) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/services')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>返回服务目录</span>
              </Button>
              <div className="flex items-center space-x-2">
                <div className="rounded-full bg-blue-100 p-2">
                  <Bot className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">{service.name}</h1>
                  <p className="text-sm text-gray-600">{service.description}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">{service.category}</Badge>
              <Badge className="bg-green-100 text-green-800">
                ¥{service.pricePerToken}/Token
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat Interface */}
      <div className="container mx-auto px-4 py-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bot className="h-5 w-5" />
              <span>AI 内容生成</span>
            </CardTitle>
            <CardDescription>
              使用AI助手生成高质量的{service.category}内容。开始对话，描述您的需求，AI会为您生成专业的文案。
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative">
              <iframe
                src="https://udify.app/chatbot/is3TxuUUaboPKblZ"
                style={{ 
                  width: '100%', 
                  height: '700px', 
                  minHeight: '700px',
                  border: 'none',
                  borderRadius: '0 0 8px 8px'
                }}
                allow="microphone"
                title={`${service.name} - AI助手`}
                onLoad={() => {
                  console.log('Dify chatbot loaded successfully');
                }}
                onError={(e) => {
                  console.error('Error loading Dify chatbot:', e);
                }}
              />
              
              {/* Loading overlay - could be enhanced with a skeleton loader */}
              <div className="absolute inset-0 bg-gray-100 flex items-center justify-center opacity-0 transition-opacity duration-300 pointer-events-none">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">正在加载AI助手...</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Features */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {service.features.map((feature, index) => (
            <Card key={index} className="text-center">
              <CardContent className="pt-6">
                <Badge variant="outline" className="mb-2">
                  {feature}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Usage Tips */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">使用提示</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">📝 描述需求</h4>
                <p className="text-gray-600">
                  清晰描述您的内容需求，包括目标受众、产品特点、风格偏好等。
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">🎯 明确目标</h4>
                <p className="text-gray-600">
                  说明内容的使用场景和预期效果，AI会为您生成更精准的文案。
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">🔄 优化调整</h4>
                <p className="text-gray-600">
                  如果生成的内容不满意，可以提供具体的修改建议进行优化。
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">💡 创意发散</h4>
                <p className="text-gray-600">
                  可以要求AI提供多个版本的文案，选择最适合的进行使用。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}