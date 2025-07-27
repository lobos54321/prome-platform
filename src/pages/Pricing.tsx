import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Zap, Star, DollarSign, Coins } from 'lucide-react';
import { authService } from '@/lib/auth';
import { db } from '@/lib/supabase';

interface RechargeOption {
  id: string;
  amount: number; // USD amount
  credits: number; // Credits amount
  popular?: boolean;
  bonus?: number; // Bonus credits
}

export default function Pricing() {
  const navigate = useNavigate();
  const [exchangeRate, setExchangeRate] = useState<number>(10000);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadExchangeRate = async () => {
      try {
        const rate = await db.getCurrentExchangeRate();
        setExchangeRate(rate);
      } catch (error) {
        console.error('Failed to load exchange rate:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadExchangeRate();
  }, []);

  const rechargeOptions: RechargeOption[] = [
    {
      id: 'starter',
      amount: 5,
      credits: 5 * exchangeRate,
    },
    {
      id: 'basic',
      amount: 10,
      credits: 10 * exchangeRate,
    },
    {
      id: 'popular',
      amount: 25,
      credits: 25 * exchangeRate,
      popular: true,
    },
    {
      id: 'pro',
      amount: 50,
      credits: 50 * exchangeRate,
    },
    {
      id: 'enterprise',
      amount: 100,
      credits: 100 * exchangeRate,
      bonus: Math.round(100 * exchangeRate * 0.1), // 10% bonus
    },
  ];

  const handleRecharge = (option: RechargeOption) => {
    const user = authService.getCurrentUserSync();
    if (user && authService.isAuthenticated()) {
      // Logged in user goes to purchase flow
      navigate(`/purchase?amount=${option.amount}&credits=${option.credits}`);
    } else {
      // Non-logged in user goes to registration with recharge intent
      navigate(`/register?recharge=${option.amount}`);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Coins className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">积分充值</h1>
        </div>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto">
          选择充值金额，获得积分来使用ProMe智能创作平台的各项AI服务
        </p>
      </div>

      {/* Exchange Rate Info */}
      <div className="max-w-md mx-auto mb-8">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <span className="text-lg font-medium">当前汇率</span>
            </div>
            <div className="text-center mt-2">
              <span className="text-2xl font-bold text-blue-600">1 美元</span>
              <span className="text-gray-600 mx-2">=</span>
              <span className="text-2xl font-bold text-blue-600">{exchangeRate.toLocaleString()} 积分</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recharge Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
        {rechargeOptions.map((option) => (
          <Card
            key={option.id}
            className={`relative transition-all duration-200 hover:shadow-lg ${
              option.popular ? 'border-blue-500 shadow-md' : ''
            }`}
          >
            {option.popular && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <Badge className="bg-blue-500 hover:bg-blue-600">
                  <Star className="h-3 w-3 mr-1" />
                  推荐
                </Badge>
              </div>
            )}

            <CardHeader className="text-center pb-4">
              <CardTitle className="text-3xl font-bold text-blue-600">
                ${option.amount}
              </CardTitle>
              <CardDescription>
                美元充值
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <Separator />
              
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center space-x-1">
                  <Coins className="h-4 w-4 text-gray-500" />
                  <span className="text-lg font-semibold">
                    {option.credits.toLocaleString()}
                  </span>
                  <span className="text-gray-500">积分</span>
                </div>
                
                {option.bonus && (
                  <div className="text-sm text-green-600 font-medium">
                    + {option.bonus.toLocaleString()} 积分奖励
                  </div>
                )}
              </div>

              <Separator />

              <Button
                onClick={() => handleRecharge(option)}
                className="w-full"
                variant={option.popular ? 'default' : 'outline'}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                立即充值
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Usage Instructions */}
      <div className="max-w-4xl mx-auto mt-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>积分使用说明</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">💳 如何充值</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 选择充值金额</li>
                  <li>• 通过Stripe安全支付</li>
                  <li>• 积分实时到账</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">🚀 如何使用</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 使用AI服务时自动扣费</li>
                  <li>• 实时显示剩余积分</li>
                  <li>• 余额不足时提醒充值</li>
                </ul>
              </div>
            </div>
            
            <Separator />
            
            <div className="text-center">
              <p className="text-sm text-gray-500">
                积分永不过期 • 安全支付 • 透明计费
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
