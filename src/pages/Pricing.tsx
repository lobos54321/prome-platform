import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ArrowRight, CreditCard, Zap } from 'lucide-react';
import { servicesAPI } from '@/lib/services';
import { authService } from '@/lib/auth';
import { adminServicesAPI } from '@/lib/admin-services';
import { isAdmin } from '@/lib/admin';
import { PricingRule, RechargePackage, User } from '@/types';

export default function Pricing() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(authService.getCurrentUserSync());
  const [activeTab, setActiveTab] = useState('packages');
  const [modelPrices, setModelPrices] = useState<PricingRule[]>([]);
  const [rechargePackages, setRechargePackages] = useState<RechargePackage[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(10000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [customCredits, setCustomCredits] = useState<number>(0);

  // Token calculator state (admin only)
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [inputTokens, setInputTokens] = useState<number>(1000);
  const [outputTokens, setOutputTokens] = useState<number>(1000);
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);

  const isUserAdmin = isAdmin(user);
  const minimumUSD = 5;

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load pricing rules for admin token calculator
        if (isUserAdmin) {
          const prices = await servicesAPI.getPricingRules();
          setModelPrices(prices);
          if (prices.length > 0) {
            setSelectedModel(prices[0].modelName);
          }
        }

        // Load recharge packages for all users
        const packages = await adminServicesAPI.getRechargePackages();
        setRechargePackages(packages);

        // Load exchange rate
        const rate = await adminServicesAPI.getExchangeRate();
        setExchangeRate(rate);
      } catch (error) {
        console.error('Failed to load pricing data:', error);
      }
    };
    
    loadData();

    // Listen for auth state changes
    const handleAuthChange = (event: CustomEvent) => {
      setUser(event.detail.user);
    };

    window.addEventListener('auth-state-changed', handleAuthChange as EventListener);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange as EventListener);
    };
  }, [isUserAdmin]);

  // Calculate credits for custom amount
  useEffect(() => {
    const amount = parseFloat(customAmount);
    if (!isNaN(amount) && amount >= 0) {
      setCustomCredits(Math.floor(amount * (exchangeRate / 10))); // exchangeRate is per $10
    } else {
      setCustomCredits(0);
    }
  }, [customAmount, exchangeRate]);

  const calculatePrice = () => {
    const modelPrice = modelPrices.find(p => p.modelName === selectedModel);
    if (!modelPrice) return;
    
    const inputCost = (inputTokens / 1000) * modelPrice.inputTokenPrice;
    const outputCost = (outputTokens / 1000) * modelPrice.outputTokenPrice;
    setCalculatedPrice(inputCost + outputCost);
  };

  const handleSelectPackage = (packageId: string) => {
    const user = authService.getCurrentUserSync();
    if (user && authService.isAuthenticated()) {
      // Already logged in user goes directly to purchase flow
      navigate(`/purchase?package=${packageId}`);
    } else {
      // Redirect unlogged users to registration page with package parameter
      navigate(`/register?package=${packageId}`);
    }
  };

  const handleCustomRecharge = () => {
    const amount = parseFloat(customAmount);
    if (amount < minimumUSD) {
      alert(`最低充值金额为 $${minimumUSD}`);
      return;
    }

    const user = authService.getCurrentUserSync();
    if (user && authService.isAuthenticated()) {
      // Already logged in user goes directly to purchase flow
      navigate(`/purchase?custom=true&amount=${amount}`);
    } else {
      // Redirect unlogged users to registration page with custom amount
      navigate(`/register?custom=true&amount=${amount}`);
    }
  };

  useEffect(() => {
    if (selectedModel && isUserAdmin) {
      calculatePrice();
    }
  }, [selectedModel, inputTokens, outputTokens, isUserAdmin]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">积分充值</h1>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto">
          选择适合您需求的积分充值方案，立即开始使用ProMe智能创作平台
        </p>
        {user && (
          <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <span className="text-blue-700">当前积分余额：</span>
            <span className="font-semibold text-blue-800">{user.balance?.toLocaleString() || 0} 积分</span>
          </div>
        )}
      </div>

      <Tabs defaultValue="packages" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-center mb-8">
          <TabsList>
            <TabsTrigger value="packages">积分充值</TabsTrigger>
            {isUserAdmin && <TabsTrigger value="calculator">Token计算器</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="packages">
          {/* Preset Packages */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-12">
            {rechargePackages.map((pkg) => (
              <Card 
                key={pkg.id} 
                className={`${pkg.isPopular ? 'border-blue-500 shadow-lg transform scale-105' : ''} transition-all hover:shadow-md`}
              >
                {pkg.isPopular && (
                  <div className="bg-blue-500 text-white text-center py-1 text-sm font-medium">
                    推荐方案
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle>{pkg.name}</CardTitle>
                  <CardDescription className="text-2xl font-bold text-green-600">
                    ${pkg.usdAmount}
                  </CardDescription>
                  <div className="text-sm text-gray-600">
                    获得 {pkg.creditsAmount.toLocaleString()} 积分
                  </div>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-sm text-gray-500 mb-2">
                    约 1 积分 ≈ ${(10 / exchangeRate).toFixed(4)}
                  </div>
                  {pkg.discount && (
                    <div className="text-xs text-green-600 font-medium">
                      节省 {pkg.discount}%
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button 
                    className={`w-full ${pkg.isPopular ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                    onClick={() => handleSelectPackage(pkg.id)}
                  >
                    立即充值
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Custom Amount */}
          <Card className="max-w-md mx-auto mb-8">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                自定义充值
              </CardTitle>
              <CardDescription>输入任意金额进行充值（最低 ${minimumUSD}）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customAmount">充值金额 (USD)</Label>
                <Input
                  id="customAmount"
                  type="number"
                  min={minimumUSD}
                  step="0.01"
                  placeholder={`最低 $${minimumUSD}`}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
              </div>
              {customCredits > 0 && (
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-sm text-gray-600">您将获得</p>
                  <p className="text-lg font-bold text-green-600">
                    {customCredits.toLocaleString()} 积分
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full"
                onClick={handleCustomRecharge}
                disabled={!customAmount || parseFloat(customAmount) < minimumUSD}
              >
                自定义充值
              </Button>
            </CardFooter>
          </Card>

          {/* Credits Usage Info */}
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle>积分使用说明</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">如何消耗积分？</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                      使用AI服务生成内容时自动扣除
                    </li>
                    <li className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                      根据所使用的AI模型和生成内容长度计费
                    </li>
                    <li className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                      更高级的模型消耗更多积分，效果更好
                    </li>
                    <li className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                      积分余额不足时会提示充值
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-3">积分优势</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                      按需付费，无需固定月费
                    </li>
                    <li className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                      积分永不过期，可长期使用
                    </li>
                    <li className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                      透明计费，实时查看余额
                    </li>
                    <li className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                      支持多种充值金额，灵活便捷
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isUserAdmin && (
          <TabsContent value="calculator">
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle>Token费用计算器</CardTitle>
                <CardDescription>管理员专用 - 估算API使用成本</CardDescription>
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
                          {Number(
                            (inputTokens / 1000) *
                            (modelPrices.find(p => p.modelName === selectedModel)?.inputTokenPrice || 0)
                          ).toFixed(0)} 积分
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">输出费用</p>
                        <p>
                          {Number(
                            (outputTokens / 1000) *
                            (modelPrices.find(p => p.modelName === selectedModel)?.outputTokenPrice || 0)
                          ).toFixed(0)} 积分
                        </p>
                      </div>
                    </div>
                    <div className="border-t mt-2 pt-2">
                      <div className="flex justify-between font-medium">
                        <span>总费用</span>
                        <span className="text-blue-600">
                          {typeof calculatedPrice === 'number' ? Math.ceil(calculatedPrice) : 0} 积分
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>约合</span>
                        <span>
                          ${typeof calculatedPrice === 'number' ? (calculatedPrice / (exchangeRate / 10)).toFixed(4) : '0.0000'}
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
        )}
      </Tabs>

      <div className="mt-20 text-center">
        <h2 className="text-2xl font-bold mb-4">还有疑问？</h2>
        <p className="mb-6 max-w-2xl mx-auto">
          如果您对我们的积分充值有任何疑问，或需要企业级定制方案，请联系我们的客服团队
        </p>
        <Button variant="outline" size="lg">
          联系客服
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
