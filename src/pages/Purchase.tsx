import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authService } from '@/lib/auth';
import { Check } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  tokenAmount: number;
}

export default function Purchase() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan');

  const plans: PricingPlan[] = [
    {
      id: 'basic',
      name: '基础版',
      price: 99,
      description: '适合个人用户和小型团队',
      features: [
        '100,000 Tokens',
        '所有基础口播文案服务',
        '标准模型访问权限',
        '邮件支持'
      ],
      tokenAmount: 100000
    },
    {
      id: 'pro',
      name: '专业版',
      price: 299,
      description: '适合中型内容创作团队',
      features: [
        '500,000 Tokens',
        '所有高级口播文案服务',
        '优先模型访问权限',
        '优先技术支持'
      ],
      tokenAmount: 500000
    },
    {
      id: 'enterprise',
      name: '企业版',
      price: 899,
      description: '适合大型企业和媒体公司',
      features: [
        '2,000,000 Tokens',
        '所有专业口播文案服务',
        'API访问权限',
        '专属客户经理'
      ],
      tokenAmount: 2000000
    }
  ];

  const selectedPlan = plans.find(p => p.id === planId);

  useEffect(() => {
    const user = authService.getCurrentUserSync();
    if (!user || !authService.isAuthenticated()) {
      // 未登录用户重定向到登录页面
      navigate(`/login?redirect=/purchase&plan=${planId}`);
    }
  }, [navigate, planId]);

  if (!selectedPlan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">方案未找到</h1>
          <Button onClick={() => navigate('/pricing')}>返回价格页面</Button>
        </div>
      </div>
    );
  }

  const handlePurchase = () => {
    // TODO: 实现实际的支付流程
    console.log('Processing purchase for plan:', selectedPlan.id);
    // 这里可以集成Stripe或其他支付服务
    alert('购买功能正在开发中，请联系客服完成购买。');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">确认购买</h1>
          <p className="text-gray-600">请确认您选择的方案详情</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              {selectedPlan.name}
              <span className="text-2xl font-bold">¥{selectedPlan.price}/月</span>
            </CardTitle>
            <CardDescription>{selectedPlan.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">包含功能：</h4>
                <ul className="space-y-2">
                  {selectedPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-medium">
                  <span>总计：</span>
                  <span className="text-blue-600">¥{selectedPlan.price}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  包含 {selectedPlan.tokenAmount.toLocaleString()} Tokens
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button variant="outline" onClick={() => navigate('/pricing')} className="flex-1">
            返回选择
          </Button>
          <Button onClick={handlePurchase} className="flex-1 bg-blue-500 hover:bg-blue-600">
            确认购买
          </Button>
        </div>
      </div>
    </div>
  );
}