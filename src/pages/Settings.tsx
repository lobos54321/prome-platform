import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CreditCard, ArrowRight } from 'lucide-react';
import { authService } from '@/lib/auth';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

export default function Settings() {
  const navigate = useNavigate();
  const user = authService.getCurrentUserSync(); // Use synchronous method
  const [activeTab, setActiveTab] = useState('profile');

  // Profile state
  const [profileForm, setProfileForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Payment state
  const [amount, setAmount] = useState('100');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [paymentError, setPaymentError] = useState('');

  // 安全地获得注册时间字符串
  const getCreatedAt = (createdAt: string | undefined) => {
    if (!createdAt) return '未知';
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) return '未知';
    return date.toLocaleDateString('zh-CN');
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileForm({
      ...profileForm,
      [e.target.name]: e.target.value
    });
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    // Password validation
    if (profileForm.newPassword) {
      if (profileForm.newPassword.length < 8) {
        setProfileError('新密码长度至少为8个字符');
        return;
      }

      if (profileForm.newPassword !== profileForm.confirmPassword) {
        setProfileError('两次输入的密码不一致');
        return;
      }
    }

    // In a real app, we would send this to the backend
    // For demo, just simulate success
    setTimeout(() => {
      setProfileSuccess('个人资料已更新');
    }, 1000);
  };

  // Stripe-only充值
  const handleStripeRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setPaymentSuccess('');
    setIsProcessing(true);

    if (!user || !user.id) {
      setPaymentError('用户信息无效，请重新登录');
      setIsProcessing(false);
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue < 5) {
      setPaymentError('请输入有效的充值金额（最少5元）');
      setIsProcessing(false);
      return;
    }

    try {
      // 1. 请求后端创建 Stripe session
      const res = await fetch('/api/payment/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountValue, // 单位：元/美元，看你后端怎么定义
          userId: user.id
        })
      });
      const data = await res.json();
      if (!data.sessionId) throw new Error(data.error || '无法获取支付会话');

      // 2. 跳转到 Stripe
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe加载失败');
      await stripe.redirectToCheckout({ sessionId: data.sessionId });
    } catch (error: unknown) {
      setPaymentError(error instanceof Error ? error.message : '支付异常');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">账户设置</h1>
        <p className="text-gray-600">管理您的个人资料和付款设置</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Account summary card */}
        <div className="md:w-1/3">
          <Card>
            <CardHeader>
              <CardTitle>账户摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">当前余额</p>
                <p className="text-2xl font-bold text-green-600">
                  ¥{typeof user.balance === 'number' ? user.balance.toFixed(2) : '0.00'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">账户类型</p>
                <p>{user.role === 'admin' ? '管理员' : '标准用户'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">注册时间</p>
                <p>{getCreatedAt(user.createdAt)}</p>
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                查看仪表板
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Settings tabs */}
        <div className="flex-1">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 mb-8">
              <TabsTrigger value="profile">个人资料</TabsTrigger>
              <TabsTrigger value="payment">账户充值</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>个人资料</CardTitle>
                  <CardDescription>更新您的个人信息和密码</CardDescription>
                </CardHeader>
                <form onSubmit={handleProfileSubmit}>
                  <CardContent className="space-y-4">
                    {profileError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{profileError}</AlertDescription>
                      </Alert>
                    )}
                    {profileSuccess && (
                      <Alert className="bg-green-50 border-green-200 text-green-800">
                        <AlertDescription>{profileSuccess}</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="name">姓名</Label>
                      <Input
                        id="name"
                        name="name"
                        value={profileForm.name ?? ''}
                        onChange={handleProfileChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">电子邮箱</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={profileForm.email ?? ''}
                        onChange={handleProfileChange}
                        disabled
                      />
                      <p className="text-xs text-gray-500">邮箱地址不可更改</p>
                    </div>

                    <div className="pt-4 border-t">
                      <h3 className="font-medium mb-4">更改密码</h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="currentPassword">当前密码</Label>
                          <Input
                            id="currentPassword"
                            name="currentPassword"
                            type="password"
                            value={profileForm.currentPassword}
                            onChange={handleProfileChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newPassword">新密码</Label>
                          <Input
                            id="newPassword"
                            name="newPassword"
                            type="password"
                            value={profileForm.newPassword}
                            onChange={handleProfileChange}
                          />
                          <p className="text-xs text-gray-500">密码长度至少为8个字符</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">确认新密码</Label>
                          <Input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            value={profileForm.confirmPassword}
                            onChange={handleProfileChange}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit">保存更改</Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>

            <TabsContent value="payment">
              <Card>
                <CardHeader>
                  <CardTitle>账户充值</CardTitle>
                  <CardDescription>为您的账户充值Token使用额度（仅支持 Stripe，信用卡/借记卡）</CardDescription>
                </CardHeader>
                <form onSubmit={handleStripeRecharge}>
                  <CardContent className="space-y-4">
                    {paymentError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{paymentError}</AlertDescription>
                      </Alert>
                    )}
                    {paymentSuccess && (
                      <Alert className="bg-green-50 border-green-200 text-green-800">
                        <AlertDescription>{paymentSuccess}</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="amount">充值金额 (¥)</Label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-md">
                          ¥
                        </span>
                        <Input
                          id="amount"
                          type="number"
                          min="5"
                          step="5"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="rounded-l-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 my-4">
                      {['50', '100', '200', '500'].map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant="outline"
                          className={amount === value ? 'border-blue-500 bg-blue-50' : ''}
                          onClick={() => setAmount(value)}
                        >
                          ¥{value}
                        </Button>
                      ))}
                    </div>

                    {/* Stripe only: 无支付方式选择 */}

                    <div className="bg-gray-50 p-4 rounded-md">
                      <div className="text-sm">
                        <div className="flex justify-between mb-2">
                          <span>充值金额</span>
                          <span>
                            ¥{!isNaN(parseFloat(amount)) ? parseFloat(amount).toFixed(2) : '0.00'}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-2 font-medium">
                          <span>总计支付</span>
                          <span>
                            ¥{!isNaN(parseFloat(amount)) ? parseFloat(amount).toFixed(2) : '0.00'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full" disabled={isProcessing}>
                      {isProcessing ? (
                        <>
                          <div className="animate-spin mr-2">⚪</div>
                          跳转至 Stripe...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          使用 Stripe 支付
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
