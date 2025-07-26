import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ArrowRight } from 'lucide-react';
import { servicesAPI } from '@/lib/services';
import { authService } from '@/lib/auth';
import { PricingRule } from '@/types';

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  highlight: boolean;
  tokenAmount: number;
}

export default function Pricing() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('plans');
  const [modelPrices, setModelPrices] = useState<PricingRule[]>([]);

  // Token calculator state
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [inputTokens, setInputTokens] = useState<number>(1000);
  const [outputTokens, setOutputTokens] = useState<number>(1000);
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  
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
      highlight: false,
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
      highlight: true,
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
      highlight: false,
      tokenAmount: 2000000
    }
  ];

  useEffect(() => {
    const loadPrices = async () => {
      const prices = await servicesAPI.getPricingRules();
      setModelPrices(prices);
      if (prices.length > 0) {
        setSelectedModel(prices[0].modelName);
      }
    };
    
    loadPrices();
  }, []);

  const calculatePrice = () => {
    const modelPrice = modelPrices.find(p => p.modelName === selectedModel);
    if (!modelPrice) return;
    
    const inputCost = (inputTokens / 1000) * modelPrice.inputTokenPrice;
    const outputCost = (outputTokens / 1000) * modelPrice.outputTokenPrice;
    setCalculatedPrice(inputCost + outputCost);
  };

  const handleSelectPlan = (planId: string) => {
    const user = authService.getCurrentUserSync();
    if (user && authService.isAuthenticated()) {
      // 已登录用户直接进入购买流程
      navigate(`/purchase?plan=${planId}`);
    } else {
      // 未登录用户引导到注册页面，并传递方案参数
      navigate(`/register?plan=${planId}`);
    }
  };

  useEffect(() => {
    if (selectedModel) {
      calculatePrice();
    }
  }, [selectedModel, inputTokens, outputTokens]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">价格方案</h1>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto">
          选择适合您需求的方案，立即开始使用ProMe智能创作平台
        </p>
      </div>

      <Tabs defaultValue="plans" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-center mb-8">
          <TabsList>
            <TabsTrigger value="plans">套餐价格</TabsTrigger>
            <TabsTrigger value="calculator">Token计算器</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="plans">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card 
                key={plan.id} 
                className={`${plan.highlight ? 'border-blue-500 shadow-lg' : ''}`}
              >
                {plan.highlight && (
                  <div className="bg-blue-500 text-white text-center py-1 text-sm font-medium">
                    最受欢迎
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">¥{plan.price}</span>
                    <span className="text-gray-500"> / 月</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className={`w-full ${plan.highlight ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    选择方案
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="calculator">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Token费用计算器</CardTitle>
              <CardDescription>估算您的API使用成本</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="model">选择模型</Label>
                <Select 
                  value={selectedModel} 
                  onValueChange={setSelectedModel}
                >
                  <SelectTrigger id="model">
                    <SelectValue placeholder="选择AI模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelPrices.map((model) => (
                      <SelectItem key={model.id} value={model.modelName}>
                        {model.modelName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inputTokens">输入Token数量</Label>
                  <Input
                    id="inputTokens"
                    type="number"
                    min="0"
                    value={inputTokens}
                    onChange={(e) => setInputTokens(parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-gray-500">每1000字约等于700-800 tokens</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outputTokens">输出Token数量</Label>
                  <Input
                    id="outputTokens"
                    type="number"
                    min="0"
                    value={outputTokens}
                    onChange={(e) => setOutputTokens(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              
              {calculatedPrice !== null && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">估算费用</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-600">模型</p>
                      <p>{selectedModel}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">总Token</p>
                      <p>{(inputTokens + outputTokens).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">输入费用</p>
                      <p>
                        ¥{Number(
                          (inputTokens / 1000) *
                          (modelPrices.find(p => p.modelName === selectedModel)?.inputTokenPrice || 0)
                        ).toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">输出费用</p>
                      <p>
                        ¥{Number(
                          (outputTokens / 1000) *
                          (modelPrices.find(p => p.modelName === selectedModel)?.outputTokenPrice || 0)
                        ).toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <div className="border-t mt-2 pt-2">
                    <div className="flex justify-between font-medium">
                      <span>总费用</span>
                      <span className="text-blue-600">
                        ¥{typeof calculatedPrice === 'number' ? calculatedPrice.toFixed(4) : '0.0000'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setInputTokens(1000);
                  setOutputTokens(1000);
                }}
              >
                重置
              </Button>
              <Button onClick={calculatePrice}>
                计算费用
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-20 text-center">
        <h2 className="text-2xl font-bold mb-4">还有疑问？</h2>
        <p className="mb-6 max-w-2xl mx-auto">
          如果您对我们的价格方案有任何疑问，或需要自定义企业方案，请联系我们的销售团队
        </p>
        <Button variant="outline" size="lg">
          联系销售
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
