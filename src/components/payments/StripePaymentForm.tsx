import { useState, useEffect } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { stripeService } from '@/lib/stripe-service';
import { authService } from '@/lib/auth';
import { toast } from 'sonner';

interface StripePaymentFormProps {
  amount: number; // USD cents
  creditsAmount: number;
  packageId?: string;
  onSuccess?: (result: { paymentIntentId: string; creditsAdded: number }) => void;
  onCancel?: () => void;
}

function CheckoutForm({ amount, creditsAmount, packageId, onSuccess, onCancel }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingEmail, setBillingEmail] = useState('');
  const [billingName, setBillingName] = useState('');

  useEffect(() => {
    // 预填用户信息
    const user = authService.getCurrentUser();
    if (user?.email) {
      setBillingEmail(user.email);
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      setError('Payment system not ready. Please try again.');
      return;
    }

    setLoading(true);

    try {
      // 确认支付
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || 'Failed to submit payment information');
        return;
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/purchase?success=true`,
          payment_method_data: {
            billing_details: {
              email: billingEmail || undefined,
              name: billingName || undefined,
            },
          },
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment failed');
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        toast.success('Payment successful! Credits are being added to your account.');
        
        // 验证支付并添加积分
        const user = authService.getCurrentUser();
        if (user) {
          const addCreditsResult = await stripeService.addCreditsToUser(user.id, creditsAmount);
          
          if (addCreditsResult.success) {
            onSuccess?.({
              paymentIntentId: paymentIntent.id,
              creditsAdded: creditsAmount
            });
          } else {
            setError('Payment succeeded but credits could not be added. Please contact support.');
          }
        } else {
          setError('User session not found. Please log in again.');
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (cents: number) => (cents / 100).toFixed(2);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          完成支付
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 支付信息摘要 */}
          <div className="bg-blue-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">积分数量:</span>
              <span className="text-sm">{creditsAmount.toLocaleString()} 积分</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">支付金额:</span>
              <span className="text-sm font-bold">${formatAmount(amount)} USD</span>
            </div>
          </div>

          {/* 账单信息 */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="billing-email">邮箱地址</Label>
              <Input
                id="billing-email"
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <div>
              <Label htmlFor="billing-name">姓名 (可选)</Label>
              <Input
                id="billing-name"
                type="text"
                value={billingName}
                onChange={(e) => setBillingName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          </div>

          {/* Stripe Payment Element */}
          <div className="border rounded-lg p-4">
            <PaymentElement
              options={{
                layout: 'tabs',
              }}
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="flex-1"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={!stripe || loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  支付 ${formatAmount(amount)}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function StripePaymentForm(props: StripePaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);

  useEffect(() => {
    const initializePayment = async () => {
      try {
        // 检查Stripe配置
        const configured = await stripeService.isConfigured();
        setStripeConfigured(configured);
        
        if (!configured) {
          setError('支付系统未配置。请联系管理员。');
          setLoading(false);
          return;
        }

        // 创建支付意图
        const user = authService.getCurrentUser();
        if (!user) {
          setError('请先登录后再进行充值。');
          setLoading(false);
          return;
        }

        const result = await stripeService.createPaymentIntent({
          amount: props.amount,
          creditsAmount: props.creditsAmount,
          userId: user.id,
          packageId: props.packageId,
        });

        setClientSecret(result.clientSecret);
      } catch (err) {
        console.error('Failed to initialize payment:', err);
        setError(err instanceof Error ? err.message : '初始化支付失败，请重试。');
      } finally {
        setLoading(false);
      }
    };

    initializePayment();
  }, [props.amount, props.creditsAmount, props.packageId]);

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">初始化支付...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !stripeConfigured) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error || '支付系统未配置'}
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-2">
            <Button onClick={props.onCancel} variant="outline" className="flex-1">
              返回
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!clientSecret) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              无法创建支付会话，请稍后重试。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Elements 
      stripe={stripeService['stripePromise']} 
      options={{ clientSecret }}
    >
      <CheckoutForm {...props} />
    </Elements>
  );
}