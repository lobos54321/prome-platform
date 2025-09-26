import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, ArrowRight, CreditCard, Zap } from 'lucide-react';
import { authService } from '@/lib/auth';
import { adminServicesAPI } from '@/lib/admin-services';
import { RechargePackage, User } from '@/types';
import { useTranslation } from 'react-i18next';

export default function Pricing() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(authService.getCurrentUserSync());
  const [rechargePackages, setRechargePackages] = useState<RechargePackage[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(10000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [customCredits, setCustomCredits] = useState<number>(0);

  const minimumUSD = 0.5; // 🔧 Stripe最低要求：50美分

  useEffect(() => {
    const loadData = async () => {
      try {
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
  }, []);

  // Calculate credits for custom amount
  useEffect(() => {
    const amount = parseFloat(customAmount);
    if (!isNaN(amount) && amount >= 0) {
      setCustomCredits(Math.floor(amount * (exchangeRate / 10))); // exchangeRate is per $10
    } else {
      setCustomCredits(0);
    }
  }, [customAmount, exchangeRate]);

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
      alert(t('pricing.insufficient_amount', 'Amount must be at least') + ` $${minimumUSD}`);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 relative overflow-hidden">
      {/* Kusama dots pattern */}
      <div 
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, #3B82F6 3px, transparent 3px),
            radial-gradient(circle at 80% 20%, #A855F7 2px, transparent 2px),
            radial-gradient(circle at 40% 70%, #F59E0B 1.5px, transparent 1.5px),
            radial-gradient(circle at 90% 80%, #EF4444 2.5px, transparent 2.5px),
            radial-gradient(circle at 10% 90%, #22C55E 2px, transparent 2px)
          `,
          backgroundSize: '100px 100px, 120px 120px, 80px 80px, 140px 140px, 90px 90px'
        }}
      ></div>
      
      {/* Kandinsky geometric shapes */}
      <div className="absolute top-20 left-16 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full animate-pulse"></div>
      <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-br from-yellow-400/15 to-red-400/15 transform rotate-45 animate-bounce"></div>
      <div className="absolute bottom-32 left-1/4 w-40 h-20 bg-gradient-to-br from-green-400/15 to-teal-400/15 rounded-full animate-pulse delay-1000"></div>
      <div className="absolute bottom-40 right-1/3 w-28 h-28 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-lg transform rotate-12 animate-bounce delay-500"></div>

      <div className="relative container mx-auto px-4 py-8 z-10">
        {/* Artistic Header */}
        <div className="text-center mb-12">
          {/* Artistic divider */}
          <div className="flex justify-center mb-8 space-x-3">
            {[...Array(7)].map((_, i) => (
              <div 
                key={i}
                className="w-4 h-4 rounded-full animate-bounce"
                style={{
                  backgroundColor: ['#3B82F6', '#A855F7', '#F59E0B', '#EF4444', '#22C55E', '#EC4899', '#06B6D4'][i],
                  animationDelay: `${i * 150}ms`
                }}
              ></div>
            ))}
          </div>
          
          {/* Kandinsky-inspired icon */}
          <div className="relative w-28 h-28 mx-auto mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-teal-500 rounded-3xl rotate-12 animate-pulse"></div>
            <div className="absolute inset-3 bg-white rounded-2xl flex items-center justify-center shadow-inner">
              <CreditCard className="h-12 w-12 text-green-600" />
            </div>
            
            {/* Floating artistic elements */}
            <div className="absolute -top-3 -right-3 w-6 h-6 bg-yellow-400 rounded-full animate-bounce"></div>
            <div className="absolute -bottom-3 -left-3 w-4 h-4 bg-pink-400 rounded-full animate-bounce delay-300"></div>
            <div className="absolute top-2 -right-6 w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
          </div>

          <h1 className="text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
              {t('pricing.title', 'Choose Your Plan')}
            </span>
          </h1>
          <p className="text-2xl text-gray-700 mb-8 font-light">
            <span className="bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
              {t('pricing.subtitle', 'Flexible pricing for your AI content generation needs')}
            </span>
          </p>
          {user && (
            <div className="mt-6 inline-flex items-center gap-3 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-lg border border-white/50">
              <CreditCard className="h-6 w-6 text-green-600" />
              <span className="text-green-700 font-medium">{t('pricing.current_balance', 'Current Balance')}:</span>
              <span className="font-bold text-green-800 text-lg">{user.balance?.toLocaleString() || 0} {t('pricing.credits', 'credits')}</span>
            </div>
          )}
        </div>

      <div className="w-full">
        {/* Preset Packages */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-12">
          {rechargePackages.map((pkg) => (
            <Card 
              key={pkg.id} 
              className={`${pkg.isPopular ? 'border-blue-500 shadow-lg transform scale-105' : ''} transition-all hover:shadow-md`}
            >
              {pkg.isPopular && (
                <div className="bg-blue-500 text-white text-center py-1 text-sm font-medium">
                  {t('pricing.popular', 'Popular')}
                </div>
              )}
              <CardHeader className="text-center">
                <CardTitle>{pkg.name}</CardTitle>
                <CardDescription className="text-2xl font-bold text-green-600">
                  ${pkg.usdAmount}
                </CardDescription>
                <div className="text-sm text-gray-600">
                  {t('pricing.calculate_credits', 'You will receive')} {pkg.creditsAmount.toLocaleString()} {t('pricing.credits', 'credits')}
                </div>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-sm text-gray-500 mb-2">
                  {t('pricing.about_per_credit', 'About 1 credit ≈')} ${(10 / exchangeRate).toFixed(4)}
                </div>
                {pkg.discount && (
                  <div className="text-xs text-green-600 font-medium">
                    {t('pricing.best_value', 'Best Value')} {pkg.discount}%
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  className={`w-full ${pkg.isPopular ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                  onClick={() => handleSelectPackage(pkg.id)}
                >
                  {user ? t('pricing.purchase_now', 'Purchase Now') : t('pricing.login_to_purchase', 'Login to Purchase')}
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
              {t('pricing.custom_amount', 'Custom Amount')}
            </CardTitle>
            <CardDescription>{t('pricing.minimum_amount', 'Minimum amount')} ${minimumUSD}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customAmount">{t('pricing.usd', 'USD')}</Label>
              <Input
                id="customAmount"
                type="number"
                min={minimumUSD}
                step="0.01"
                placeholder={`${t('pricing.minimum_amount', 'Minimum amount')} $${minimumUSD}`}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
              />
            </div>
            {customCredits > 0 && (
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <p className="text-sm text-gray-600">{t('pricing.calculate_credits', 'You will receive')}</p>
                <p className="text-lg font-bold text-green-600">
                  {customCredits.toLocaleString()} {t('pricing.credits', 'credits')}
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
              {t('pricing.purchase_credits', 'Purchase Credits')}
            </Button>
          </CardFooter>
        </Card>

        {/* Credits Usage Info */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>{t('pricing.usage_instructions', 'Credits Usage Instructions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">{t('pricing.how_to_consume', 'How are credits consumed?')}</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                    {t('pricing.consume_auto', 'Automatically deducted when using AI services to generate content')}
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                    {t('pricing.consume_model', 'Charged based on AI model used and content length generated')}
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                    {t('pricing.consume_advanced', 'Advanced models consume more credits but provide better results')}
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                    {t('pricing.consume_insufficient', 'You will be prompted to recharge when credits are insufficient')}
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3">{t('pricing.credits_advantages', 'Credits Advantages')}</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                    {t('pricing.advantage_paygo', 'Pay-as-you-go, no fixed monthly fees')}
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                    {t('pricing.advantage_noexpiry', 'Credits never expire, can be used long-term')}
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                    {t('pricing.advantage_transparent', 'Transparent billing, real-time balance viewing')}
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                    {t('pricing.advantage_flexible', 'Support multiple recharge amounts, flexible and convenient')}
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-20 text-center">
        <h2 className="text-2xl font-bold mb-4">{t('pricing.questions_title', 'Still have questions?')}</h2>
        <p className="mb-6 max-w-2xl mx-auto">
          {t('pricing.questions_subtitle', 'If you have any questions about our credit recharge system, or need enterprise-level custom solutions, please contact our customer service team')}
        </p>
        <Button variant="outline" size="lg">
          {t('pricing.contact_support', 'Contact Support')}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
