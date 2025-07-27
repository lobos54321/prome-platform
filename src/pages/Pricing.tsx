import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, CreditCard, Zap } from 'lucide-react';
import { authService } from '@/lib/auth';
import { tokenPricingEngine } from '@/lib/token-pricing-engine';

interface ChargeOption {
  id: string;
  amount: number; // USD amount
  credits: number; // Credits to receive
  popular?: boolean;
  bonus?: string;
}

export default function Pricing() {
  const navigate = useNavigate();
  const [exchangeRate, setExchangeRate] = useState(10000);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadExchangeRate = async () => {
      try {
        const rate = await tokenPricingEngine.getExchangeRate();
        setExchangeRate(rate);
      } catch (error) {
        console.error('Failed to load exchange rate:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadExchangeRate();
  }, []);

  const chargeOptions: ChargeOption[] = [
    {
      id: 'charge-5',
      amount: 5,
      credits: 5 * exchangeRate,
    },
    {
      id: 'charge-10',
      amount: 10,
      credits: 10 * exchangeRate,
    },
    {
      id: 'charge-25',
      amount: 25,
      credits: 25 * exchangeRate,
      popular: true,
      bonus: '推荐'
    },
    {
      id: 'charge-50',
      amount: 50,
      credits: 50 * exchangeRate,
    },
    {
      id: 'charge-100',
      amount: 100,
      credits: 100 * exchangeRate,
      bonus: '最优惠'
    }
  ];

  const handleSelectCharge = (chargeId: string) => {
    const user = authService.getCurrentUserSync();
    if (user && authService.isAuthenticated()) {
      // 已登录用户直接进入购买流程
      navigate(`/purchase?charge=${chargeId}`);
    } else {
      // 未登录用户引导到注册页面，并传递充值参数
      navigate(`/register?charge=${chargeId}`);
    }
  };

  const formatCredits = (credits: number) => {
    return credits.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/3 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">积分充值</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          选择充值金额，立即获得积分开始使用AI服务
        </p>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg inline-block">
          <p className="text-sm text-blue-700">
            <Zap className="inline h-4 w-4 mr-1" />
            当前汇率: 1美元 = {exchangeRate.toLocaleString()} 积分
          </p>
        </div>
      </div>

      {/* Charge Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
        {chargeOptions.map((option) => (
          <Card 
            key={option.id} 
            className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg ${
              option.popular ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => handleSelectCharge(option.id)}
          >
            {option.bonus && (
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                <Badge variant={option.popular ? "default" : "secondary"}>
                  {option.bonus}
                </Badge>
              </div>
            )}
            
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold">
                ${option.amount}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="text-center">
              <div className="mb-4">
                <div className="text-3xl font-bold text-blue-600">
                  {formatCredits(option.credits)}
                </div>
                <div className="text-sm text-gray-500">积分</div>
              </div>
              
              <Button 
                className="w-full" 
                variant={option.popular ? "default" : "outline"}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                立即充值
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Usage Instructions */}
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Check className="h-5 w-5 mr-2 text-green-500" />
              积分使用说明
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">如何使用积分？</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <ArrowRight className="h-4 w-4 mr-2 mt-0.5 text-blue-500" />
                    充值后积分将立即到账
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="h-4 w-4 mr-2 mt-0.5 text-blue-500" />
                    使用AI服务时自动扣除相应积分
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="h-4 w-4 mr-2 mt-0.5 text-blue-500" />
                    余额不足时会提示充值
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">充值说明</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <ArrowRight className="h-4 w-4 mr-2 mt-0.5 text-blue-500" />
                    支持信用卡和借记卡支付
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="h-4 w-4 mr-2 mt-0.5 text-blue-500" />
                    支付安全由Stripe保障
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="h-4 w-4 mr-2 mt-0.5 text-blue-500" />
                    积分永不过期
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
