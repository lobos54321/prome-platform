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
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto mb-16">
            {rechargePackages.map((pkg, index) => (
              <div key={pkg.id} className="group relative transform hover:scale-105 transition-all duration-500">
                <div className={`absolute inset-0 rounded-3xl ${
                  pkg.isPopular 
                    ? 'bg-gradient-to-br from-yellow-100/70 to-orange-50/70 rotate-2' 
                    : index % 2 === 0 
                      ? 'bg-gradient-to-br from-blue-100/50 to-cyan-50/50 rotate-1' 
                      : 'bg-gradient-to-br from-purple-100/50 to-pink-50/50 -rotate-1'
                  } group-hover:${pkg.isPopular ? 'rotate-3' : index % 2 === 0 ? 'rotate-2' : '-rotate-2'} transition-transform duration-300`}></div>
                
                <Card className="relative bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-300 border border-white/50">
                {pkg.isPopular && (
                  <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-center py-2 text-sm font-bold rounded-t-3xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/30 to-orange-400/30 animate-pulse"></div>
                    <span className="relative z-10">{t('pricing.popular', 'Popular')}</span>
                  </div>
                )}
                <CardHeader className="text-center p-8">
                  {/* Artistic price icon */}
                  <div className="relative w-16 h-16 mx-auto mb-4">
                    <div className={`absolute inset-0 rounded-2xl rotate-12 group-hover:rotate-45 transition-transform duration-700 ${
                      pkg.isPopular 
                        ? 'bg-gradient-to-br from-yellow-500 to-orange-500' 
                        : index % 2 === 0 
                          ? 'bg-gradient-to-br from-blue-500 to-cyan-500' 
                          : 'bg-gradient-to-br from-purple-500 to-pink-500'
                    }`}></div>
                    <div className="absolute inset-2 bg-white rounded-xl flex items-center justify-center shadow-inner">
                      <Zap className={`h-6 w-6 ${
                        pkg.isPopular 
                          ? 'text-orange-600' 
                          : index % 2 === 0 
                            ? 'text-blue-600' 
                            : 'text-purple-600'
                      }`} />
                    </div>
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full animate-bounce"></div>
                  </div>
                  
                  <CardTitle className="text-xl font-bold mb-3">{pkg.name}</CardTitle>
                  <CardDescription className="text-3xl font-bold text-green-600 mb-2">
                    ${pkg.usdAmount}
                  </CardDescription>
                  <div className="text-sm text-gray-600">
                    {t('pricing.calculate_credits', 'You will receive')} <span className="font-bold text-green-700">{pkg.creditsAmount.toLocaleString()}</span> {t('pricing.credits', 'credits')}
                  </div>
                </CardHeader>
                <CardContent className="text-center px-8">
                  <div className="text-sm text-gray-500 mb-3">
                    {t('pricing.about_per_credit', 'About 1 credit ≈')} <span className="font-medium">${(10 / exchangeRate).toFixed(4)}</span>
                  </div>
                  {pkg.discount && (
                    <div className="inline-flex items-center gap-1 bg-green-100 text-green-700 font-bold text-xs px-3 py-1 rounded-full">
                      <Check className="h-3 w-3" />
                      {t('pricing.best_value', 'Best Value')} {pkg.discount}%
                    </div>
                  )}
                </CardContent>
                <CardFooter className="p-8 pt-0">
                  <Button 
                    className={`w-full py-3 text-lg font-semibold rounded-2xl transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 ${
                      pkg.isPopular 
                        ? 'bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 hover:from-yellow-600 hover:via-orange-600 hover:to-yellow-700' 
                        : index % 2 === 0 
                          ? 'bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 hover:from-blue-600 hover:via-cyan-600 hover:to-blue-700' 
                          : 'bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 hover:from-purple-600 hover:via-pink-600 hover:to-purple-700'
                    } text-white`}
                    onClick={() => handleSelectPackage(pkg.id)}
                  >
                    {user ? t('pricing.purchase_now', 'Purchase Now') : t('pricing.login_to_purchase', 'Login to Purchase')}
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform" />
                  </Button>
                </CardFooter>
              </Card>
            </div>
            ))}
          </div>

          {/* Custom Amount - Artistic Style */}
          <div className="relative mb-12">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/50 to-purple-50/50 rounded-3xl rotate-1 transition-transform duration-300"></div>
            
            <Card className="relative bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 max-w-md mx-auto">
              <CardHeader className="text-center p-8">
                {/* Artistic custom icon */}
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full animate-pulse"></div>
                  <div className="absolute inset-3 bg-white rounded-full flex items-center justify-center shadow-inner">
                    <Zap className="h-8 w-8 text-indigo-600" />
                  </div>
                  <div className="absolute -top-3 -right-2 w-5 h-5 bg-yellow-400 rounded-full animate-bounce"></div>
                  <div className="absolute -bottom-2 -left-3 w-4 h-4 bg-green-400 rounded-full animate-pulse delay-500"></div>
                </div>
                
                <CardTitle className="text-2xl font-bold mb-3">
                  <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {t('pricing.custom_amount', 'Custom Amount')}
                  </span>
                </CardTitle>
                <CardDescription className="text-lg">{t('pricing.minimum_amount', 'Minimum amount')} <span className="font-bold text-indigo-600">${minimumUSD}</span></CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 px-8">
                <div className="space-y-3">
                  <Label htmlFor="customAmount" className="text-lg font-medium">{t('pricing.usd', 'USD')}</Label>
                  <Input
                    id="customAmount"
                    type="number"
                    min={minimumUSD}
                    step="0.01"
                    placeholder={`${t('pricing.minimum_amount', 'Minimum amount')} $${minimumUSD}`}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="text-lg p-4 rounded-2xl border-2 border-indigo-200 focus:border-indigo-500 bg-white/90"
                  />
                </div>
                {customCredits > 0 && (
                  <div className="bg-gradient-to-r from-green-50 to-teal-50 p-6 rounded-2xl text-center border border-green-200">
                    <p className="text-sm text-gray-700 mb-2">{t('pricing.calculate_credits', 'You will receive')}</p>
                    <p className="text-2xl font-bold text-green-600">
                      {customCredits.toLocaleString()} {t('pricing.credits', 'credits')}
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="p-8 pt-0">
                <Button 
                  className="w-full py-4 text-lg font-semibold rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-700 text-white transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
                  onClick={handleCustomRecharge}
                  disabled={!customAmount || parseFloat(customAmount) < minimumUSD}
                >
                  {t('pricing.purchase_credits', 'Purchase Credits')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Credits Usage Info - Artistic Style */}
          <div className="relative mb-16">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-100/50 to-slate-50/50 rounded-3xl -rotate-1 transition-transform duration-300"></div>
            
            <Card className="relative bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 max-w-6xl mx-auto">
              <CardHeader className="text-center p-8">
                <CardTitle className="text-3xl font-bold">
                  <span className="bg-gradient-to-r from-gray-700 to-slate-700 bg-clip-text text-transparent">
                    {t('pricing.usage_instructions', 'Credits Usage Instructions')}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <h4 className="text-xl font-bold text-gray-800 mb-6">{t('pricing.how_to_consume', 'How are credits consumed?')}</h4>
                    <ul className="space-y-4">
                      <li className="flex items-start group">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-4 mt-1 group-hover:scale-110 transition-transform">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-gray-700 leading-relaxed">{t('pricing.consume_auto', 'Automatically deducted when using AI services to generate content')}</span>
                      </li>
                      <li className="flex items-start group">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-4 mt-1 group-hover:scale-110 transition-transform">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-gray-700 leading-relaxed">{t('pricing.consume_model', 'Charged based on AI model used and content length generated')}</span>
                      </li>
                      <li className="flex items-start group">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-4 mt-1 group-hover:scale-110 transition-transform">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-gray-700 leading-relaxed">{t('pricing.consume_advanced', 'Advanced models consume more credits but provide better results')}</span>
                      </li>
                      <li className="flex items-start group">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-4 mt-1 group-hover:scale-110 transition-transform">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-gray-700 leading-relaxed">{t('pricing.consume_insufficient', 'You will be prompted to recharge when credits are insufficient')}</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xl font-bold text-gray-800 mb-6">{t('pricing.credits_advantages', 'Credits Advantages')}</h4>
                    <ul className="space-y-4">
                      <li className="flex items-start group">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-4 mt-1 group-hover:scale-110 transition-transform">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-gray-700 leading-relaxed">{t('pricing.advantage_paygo', 'Pay-as-you-go, no fixed monthly fees')}</span>
                      </li>
                      <li className="flex items-start group">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-4 mt-1 group-hover:scale-110 transition-transform">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-gray-700 leading-relaxed">{t('pricing.advantage_noexpiry', 'Credits never expire, can be used long-term')}</span>
                      </li>
                      <li className="flex items-start group">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-4 mt-1 group-hover:scale-110 transition-transform">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-gray-700 leading-relaxed">{t('pricing.advantage_transparent', 'Transparent billing, real-time balance viewing')}</span>
                      </li>
                      <li className="flex items-start group">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-4 mt-1 group-hover:scale-110 transition-transform">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-gray-700 leading-relaxed">{t('pricing.advantage_flexible', 'Support multiple recharge amounts, flexible and convenient')}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Artistic footer */}
        <div className="mt-20 text-center">
          <div className="flex justify-center space-x-2 mb-8">
            {[...Array(9)].map((_, i) => (
              <div 
                key={i}
                className="w-3 h-3 rounded-full animate-bounce"
                style={{
                  backgroundColor: ['#3B82F6', '#A855F7', '#F59E0B', '#EF4444', '#22C55E', '#EC4899', '#06B6D4', '#8B5CF6', '#F97316'][i],
                  animationDelay: `${i * 100}ms`
                }}
              ></div>
            ))}
          </div>
          
          <h2 className="text-3xl font-bold mb-6">
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              {t('pricing.questions_title', 'Still have questions?')}
            </span>
          </h2>
          <p className="mb-8 max-w-2xl mx-auto text-lg text-gray-700 leading-relaxed">
            {t('pricing.questions_subtitle', 'If you have any questions about our credit recharge system, or need enterprise-level custom solutions, please contact our customer service team')}
          </p>
          <Button 
            variant="outline" 
            size="lg"
            className="bg-white/90 backdrop-blur-sm border-2 border-blue-300 hover:bg-blue-50 text-blue-700 hover:text-blue-800 px-8 py-4 text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            {t('pricing.contact_support', 'Contact Support')}
            <ArrowRight className="ml-3 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}