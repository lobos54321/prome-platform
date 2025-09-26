import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/lib/auth';
import { adminServicesAPI } from '@/lib/admin-services';
import { Check, CreditCard, ArrowLeft } from 'lucide-react';
import { RechargePackage, CustomRecharge } from '@/types';
import StripePaymentForm from '@/components/payments/StripePaymentForm';

export default function Purchase() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const packageId = searchParams.get('package');
  const isCustom = searchParams.get('custom') === 'true';
  const customAmount = searchParams.get('amount');

  const [selectedPackage, setSelectedPackage] = useState<RechargePackage | null>(null);
  const [customRecharge, setCustomRecharge] = useState<CustomRecharge | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(10000);
  const [customAmountInput, setCustomAmountInput] = useState<string>(customAmount || '');
  const [isLoading, setIsLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);

  const minimumUSD = 0.5; // 🔧 Stripe最低要求：50美分

  useEffect(() => {
    const initializePurchase = async () => {
      const user = authService.getCurrentUserSync();
      if (!user || !authService.isAuthenticated()) {
        // Redirect unauthenticated users to login page
        const redirectParams = new URLSearchParams();
        if (packageId) redirectParams.set('package', packageId);
        if (isCustom) {
          redirectParams.set('custom', 'true');
          if (customAmount) redirectParams.set('amount', customAmount);
        }
        navigate(`/login?redirect=/purchase&${redirectParams.toString()}`);
        return;
      }

      try {
        // Load exchange rate
        const rate = await adminServicesAPI.getExchangeRate();
        setExchangeRate(rate);

        if (packageId && !isCustom) {
          // Load selected package
          const packages = await adminServicesAPI.getRechargePackages();
          const pkg = packages.find(p => p.id === packageId);
          if (!pkg) {
            navigate('/pricing');
            return;
          }
          setSelectedPackage(pkg);
        } else if (isCustom && customAmount) {
          // Setup custom recharge
          const amount = parseFloat(customAmount);
          if (amount >= minimumUSD) {
            setCustomRecharge({
              usdAmount: amount,
              creditsAmount: Math.floor(amount * (rate / 10)) // rate is per $10
            });
          } else {
            navigate('/pricing');
            return;
          }
        } else {
          navigate('/pricing');
          return;
        }
      } catch (error) {
        console.error('Failed to initialize purchase:', error);
        navigate('/pricing');
      } finally {
        setIsLoading(false);
      }
    };

    initializePurchase();
  }, [navigate, packageId, isCustom, customAmount]);

  const updateCustomRecharge = (amount: string) => {
    setCustomAmountInput(amount);
    const amountNum = parseFloat(amount);
    if (!isNaN(amountNum) && amountNum >= minimumUSD) {
      setCustomRecharge({
        usdAmount: amountNum,
        creditsAmount: Math.floor(amountNum * (exchangeRate / 10))
      });
    } else {
      setCustomRecharge(null);
    }
  };

  const handlePurchase = () => {
    const purchaseData = selectedPackage || customRecharge;
    if (!purchaseData) {
      console.error('No purchase data available');
      return;
    }
    
    console.log('Initiating purchase:', purchaseData);
    setShowPayment(true);
  };

  const handlePaymentSuccess = (result: { paymentIntentId: string; creditsAdded: number }) => {
    console.log('Payment successful:', result);
    
    // 刷新用户余额
    authService.refreshBalance().then(() => {
      navigate('/dashboard?purchase=success');
    });
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">正在加载购买信息...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedPackage && !customRecharge) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">充值方案未找到</h1>
          <Button onClick={() => navigate('/pricing')}>返回充值页面</Button>
        </div>
      </div>
    );
  }

  const purchaseInfo = selectedPackage || customRecharge;
  const isPackagePurchase = !!selectedPackage;

  // 显示支付表单
  if (showPayment && purchaseInfo) {
    const amountInCents = Math.round(purchaseInfo.usdAmount * 100); // Convert to cents
    
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <Button 
              variant="ghost" 
              onClick={handlePaymentCancel}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回确认页面
            </Button>
            <h1 className="text-2xl font-bold mb-2">支付 {purchaseInfo.creditsAmount.toLocaleString()} 积分</h1>
            <p className="text-gray-600">金额: ${purchaseInfo.usdAmount} USD</p>
          </div>
          
          <StripePaymentForm
            amount={amountInCents}
            creditsAmount={purchaseInfo.creditsAmount}
            packageId={selectedPackage?.id}
            onSuccess={handlePaymentSuccess}
            onCancel={handlePaymentCancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">确认充值</h1>
          <p className="text-gray-600">请确认您的积分充值详情</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-500" />
                {isPackagePurchase ? selectedPackage!.name : '自定义充值'}
              </span>
              <span className="text-2xl font-bold text-green-600">
                ${purchaseInfo!.usdAmount}
              </span>
            </CardTitle>
            <CardDescription>
              {isPackagePurchase ? selectedPackage!.name : '自定义金额充值'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Credits Info */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 font-medium">您将获得积分：</span>
                  <span className="text-2xl font-bold text-blue-800">
                    {purchaseInfo!.creditsAmount.toLocaleString()} 积分
                  </span>
                </div>
                <div className="text-sm text-blue-600 mt-1">
                  汇率：1 USD = {(exchangeRate / 10).toLocaleString()} 积分
                </div>
              </div>

              {/* Custom amount input for custom recharge */}
              {!isPackagePurchase && (
                <div className="space-y-2">
                  <Label htmlFor="finalAmount">确认充值金额 (USD)</Label>
                  <Input
                    id="finalAmount"
                    type="number"
                    min={minimumUSD}
                    step="0.01"
                    value={customAmountInput}
                    onChange={(e) => updateCustomRecharge(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    最低充值金额为 ${minimumUSD}
                  </p>
                </div>
              )}

              {/* Features for package */}
              {isPackagePurchase && (
                <div>
                  <h4 className="font-medium mb-3">充值优势：</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                      <span>积分永不过期，可长期使用</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                      <span>按需使用，透明计费</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                      <span>支持所有AI服务功能</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                      <span>实时余额查看</span>
                    </li>
                  </ul>
                </div>
              )}
              
              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-medium">
                  <span>支付总额：</span>
                  <span className="text-green-600">${purchaseInfo!.usdAmount}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  获得 {purchaseInfo!.creditsAmount.toLocaleString()} 积分
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/pricing')} 
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回选择
          </Button>
          <Button 
            onClick={handlePurchase} 
            className="flex-1 bg-green-500 hover:bg-green-600"
            disabled={!isPackagePurchase && (!customRecharge || customRecharge.usdAmount < minimumUSD)}
          >
            确认充值 ${purchaseInfo!.usdAmount}
          </Button>
        </div>
      </div>
    </div>
  );
}