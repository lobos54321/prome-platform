import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  CreditCard, 
  Clock, 
  Plus, 
  DollarSign,
  ArrowRight,
  Search,
  RefreshCw
} from 'lucide-react';
import { TokenUsage, BillingRecord } from '@/types';
import { servicesAPI } from '@/lib/services';
import { authService } from '@/lib/auth';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/use-auth';

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();

  // Always declare hooks at top level
  const [usageRecords, setUsageRecords] = useState<TokenUsage[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  // Handle user authentication - only redirect if not loading and no user
  useEffect(() => {
    if (!isLoading && !user) {
      console.log('Dashboard: No user found after loading, redirecting to login');
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  // 加载数据时确保 catch 错误并 fallback - 移到所有 hooks 声明之后
  useEffect(() => {
    if (!user || !user.id) return;

    let cancelled = false;
    const loadData = async () => {
      try {
        const usage = await servicesAPI.getTokenUsage(user.id);
        const billing = await servicesAPI.getBillingRecords(user.id);
        if (!cancelled) {
          setUsageRecords(Array.isArray(usage) ? usage : []);
          setBillingRecords(Array.isArray(billing) ? billing : []);
        }
      } catch (error) {
        console.warn('Failed to load dashboard data:', error);
        if (!cancelled) {
          setUsageRecords([]);
          setBillingRecords([]);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // 🔧 修复：监听余额和token使用更新事件，实时刷新数据
  useEffect(() => {
    if (!user || !user.id) return;

    const handleBalanceUpdate = () => {
      console.log('[Dashboard] Balance updated, refreshing usage data...');
      // 重新加载usage和billing数据
      const refreshData = async () => {
        try {
          const usage = await servicesAPI.getTokenUsage(user.id);
          const billing = await servicesAPI.getBillingRecords(user.id);
          setUsageRecords(Array.isArray(usage) ? usage : []);
          setBillingRecords(Array.isArray(billing) ? billing : []);
          console.log('[Dashboard] ✅ Usage data refreshed after balance update');
        } catch (error) {
          console.warn('[Dashboard] Failed to refresh usage data:', error);
        }
      };
      refreshData();
    };

    // 监听余额更新事件
    window.addEventListener('balance-updated', handleBalanceUpdate);

    return () => {
      window.removeEventListener('balance-updated', handleBalanceUpdate);
    };
  }, [user]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('dashboard.verifying_identity', 'Verifying user identity...')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Early return if user is not available after loading
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('common.loading', 'Loading...')}</p>
          </div>
        </div>
      </div>
    );
  }

  // 计算统计数据
  const totalSpent = billingRecords.reduce((sum, record) => typeof record.amount === 'number' ? sum + record.amount : sum, 0);
  const currentMonthUsage = usageRecords
    .filter(record => {
      const recordDate = new Date(record.timestamp);
      const now = new Date();
      if (Number.isNaN(recordDate.getTime())) return false;
      return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, record) => typeof record.tokensUsed === 'number' ? sum + record.tokensUsed : sum, 0);

  // 搜索过滤
  const filteredUsage = usageRecords.filter(record => 
    (record.serviceId ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredBilling = billingRecords.filter(record => 
    (record.description ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 安全日期格式化
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const refreshBalance = async () => {
    if (!user || !user.id || isRefreshingBalance) return;
    
    try {
      setIsRefreshingBalance(true);
      console.log('Manual balance refresh requested...');
      await authService.refreshBalance();
      
      // 🔧 修复：同时刷新usage和billing数据
      console.log('[Dashboard] Refreshing usage data after manual balance refresh...');
      const usage = await servicesAPI.getTokenUsage(user.id);
      const billing = await servicesAPI.getBillingRecords(user.id);
      setUsageRecords(Array.isArray(usage) ? usage : []);
      setBillingRecords(Array.isArray(billing) ? billing : []);
      
      console.log('Manual balance and usage data refresh completed');
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50 relative overflow-hidden">
      {/* Kusama dots pattern */}
      <div 
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `
            radial-gradient(circle at 25% 25%, #06B6D4 3px, transparent 3px),
            radial-gradient(circle at 75% 15%, #3B82F6 2px, transparent 2px),
            radial-gradient(circle at 45% 85%, #A855F7 1.5px, transparent 1.5px),
            radial-gradient(circle at 85% 75%, #EC4899 2.5px, transparent 2.5px),
            radial-gradient(circle at 15% 65%, #22C55E 2px, transparent 2px)
          `,
          backgroundSize: '120px 120px, 100px 100px, 90px 90px, 130px 130px, 110px 110px'
        }}
      ></div>
      
      {/* Kandinsky geometric shapes */}
      <div className="absolute top-20 left-16 w-32 h-32 bg-gradient-to-br from-cyan-400/20 to-blue-400/20 rounded-full animate-pulse"></div>
      <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-br from-purple-400/15 to-pink-400/15 transform rotate-45 animate-bounce"></div>
      <div className="absolute bottom-32 left-1/4 w-40 h-20 bg-gradient-to-br from-blue-400/15 to-indigo-400/15 rounded-full animate-pulse delay-1000"></div>
      <div className="absolute bottom-40 right-1/3 w-28 h-28 bg-gradient-to-br from-green-400/20 to-teal-400/20 rounded-lg transform rotate-12 animate-bounce delay-500"></div>

      <div className="relative container mx-auto px-4 py-8 z-10">
        {/* Artistic Header */}
        <div className="mb-12">
          {/* Artistic divider */}
          <div className="flex justify-center mb-8 space-x-3">
            {[...Array(7)].map((_, i) => (
              <div 
                key={i}
                className="w-4 h-4 rounded-full animate-bounce"
                style={{
                  backgroundColor: ['#06B6D4', '#3B82F6', '#A855F7', '#EC4899', '#22C55E', '#F59E0B', '#EF4444'][i],
                  animationDelay: `${i * 150}ms`
                }}
              ></div>
            ))}
          </div>
          
          {/* Kandinsky-inspired icon */}
          <div className="relative w-28 h-28 mx-auto mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-3xl rotate-12 animate-pulse"></div>
            <div className="absolute inset-3 bg-white rounded-2xl flex items-center justify-center shadow-inner">
              <Activity className="h-12 w-12 text-cyan-600" />
            </div>
            
            {/* Floating artistic elements */}
            <div className="absolute -top-3 -right-3 w-6 h-6 bg-yellow-400 rounded-full animate-bounce"></div>
            <div className="absolute -bottom-3 -left-3 w-4 h-4 bg-pink-400 rounded-full animate-bounce delay-300"></div>
            <div className="absolute top-2 -right-6 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          </div>

          <h1 className="text-5xl font-bold mb-4 text-center">
            <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              {t('dashboard.title', 'Dashboard')}
            </span>
          </h1>
          <p className="text-2xl text-gray-700 mb-8 font-light text-center">
            <span className="bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
              {t('dashboard.subtitle', 'Manage your account and usage')}
            </span>
          </p>
        </div>

        {/* Stats Cards - Artistic Style */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Balance Card - Kandinsky Style */}
          <div className="group relative transform hover:scale-105 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-green-100/50 to-teal-50/50 rounded-3xl rotate-1 group-hover:rotate-2 transition-transform duration-300"></div>
            
            <Card className="relative bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-300 border border-white/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 p-6">
                <CardTitle className="text-lg font-bold text-gray-800">{t('dashboard.account_balance', 'Account Balance')}</CardTitle>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-green-100 rounded-full"
                    onClick={refreshBalance}
                    disabled={isRefreshingBalance}
                    title={t('dashboard.refresh_all_data', 'Refresh All Data')}
                  >
                    <RefreshCw className={`h-4 w-4 text-green-600 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
                  </Button>
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl rotate-12 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-3xl font-bold text-green-600 mb-3">
                  {user && typeof user.balance === 'number' ? Math.round(user.balance).toLocaleString() : '0'} {t('dashboard.credits', 'credits')}
                </div>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                  {t('dashboard.low_balance_warning', 'Low balance affects service usage')}
                </p>
                <Button 
                  size="sm" 
                  className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1" 
                  onClick={() => navigate('/pricing')}
                >
                  {t('dashboard.recharge_account', 'Recharge Account')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Usage Card - Kusama Style */}
          <div className="group relative transform hover:scale-105 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-purple-50/50 rounded-3xl -rotate-1 group-hover:-rotate-2 transition-transform duration-300"></div>
            
            <Card className="relative bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-300 border border-white/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 p-6">
                <CardTitle className="text-lg font-bold text-gray-800">{t('dashboard.monthly_token_usage', 'Monthly Token Usage')}</CardTitle>
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center group-hover:animate-pulse">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
                  <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-green-400 rounded-full animate-bounce delay-300"></div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-3xl font-bold text-blue-600 mb-3">{currentMonthUsage.toLocaleString()}</div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {t('dashboard.total_services_used', 'Total services used: {{count}}', { count: usageRecords.length })}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Total Spent Card - Mixed Style */}
          <div className="group relative transform hover:scale-105 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-100/50 to-pink-50/50 rounded-3xl rotate-2 group-hover:rotate-3 transition-transform duration-300"></div>
            
            <Card className="relative bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-300 border border-white/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 p-6">
                <CardTitle className="text-lg font-bold text-gray-800">{t('dashboard.total_consumed_credits', 'Total Consumed Credits')}</CardTitle>
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl rotate-45 group-hover:rotate-12 transition-transform duration-700 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                  <div className="absolute -top-2 -left-2 w-4 h-4 bg-blue-400 rounded-full animate-bounce delay-500"></div>
                  <div className="absolute -bottom-2 -right-2 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-3xl font-bold text-purple-600 mb-3">
                  {typeof totalSpent === 'number' ? Math.round(totalSpent).toLocaleString() : '0'} {t('dashboard.credits', 'credits')}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {t('dashboard.total_billing_records', 'Generated {{count}} billing records', { count: billingRecords.length })}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Artistic Tabs Section */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-gray-50/20 rounded-3xl rotate-1"></div>
          
          <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="relative w-full bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-6">
          <TabsList className="bg-gradient-to-r from-cyan-100 to-blue-100 rounded-2xl p-1">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white rounded-xl font-medium px-6 py-2 transition-all duration-300"
            >
              {t('dashboard.overview', 'Overview')}
            </TabsTrigger>
            <TabsTrigger 
              value="usage" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white rounded-xl font-medium px-6 py-2 transition-all duration-300"
            >
              {t('dashboard.usage_records', 'Usage Records')}
            </TabsTrigger>
          </TabsList>

          <div className="my-6">
            {activeTab === 'usage' && (
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                <Input
                  placeholder={t('dashboard.search_records', 'Search records...')}
                  className="pl-10 py-3 rounded-2xl border-2 border-cyan-200 focus:border-cyan-500 bg-white/90 text-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Quick Actions - Artistic Style */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-100/50 to-blue-50/50 rounded-3xl -rotate-1"></div>
                
                <Card className="relative bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50">
                  <CardHeader className="p-6">
                    <CardTitle className="text-2xl font-bold text-gray-800">{t('dashboard.quick_actions', 'Quick Actions')}</CardTitle>
                    <CardDescription className="text-lg text-gray-600">
                      {t('dashboard.quick_actions_subtitle', 'Quick access to common functions')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 p-6 pt-0">
                    <Button 
                      variant="outline" 
                      className="h-28 flex flex-col gap-3 rounded-2xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all duration-300 transform hover:scale-105" 
                      onClick={() => navigate('/')}
                    >
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
                          <Activity className="h-6 w-6 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-bounce"></div>
                      </div>
                      <span className="font-medium text-gray-700">{t('dashboard.browse_services', 'Browse Services')}</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-28 flex flex-col gap-3 rounded-2xl border-2 border-green-200 hover:border-green-400 hover:bg-green-50 transition-all duration-300 transform hover:scale-105" 
                      onClick={() => navigate('/pricing')}
                    >
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center">
                          <Plus className="h-6 w-6 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-pink-400 rounded-full animate-pulse"></div>
                      </div>
                      <span className="font-medium text-gray-700">{t('dashboard.recharge_account', 'Recharge Account')}</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-28 flex flex-col gap-3 col-span-2 rounded-2xl border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50 transition-all duration-300 transform hover:scale-105" 
                      onClick={() => navigate('/token-dashboard')}
                    >
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl rotate-12 flex items-center justify-center">
                          <Clock className="h-6 w-6 text-white" />
                        </div>
                        <div className="absolute -top-2 -left-2 w-4 h-4 bg-blue-400 rounded-full animate-bounce delay-300"></div>
                      </div>
                      <span className="font-medium text-gray-700">{t('dashboard.token_analysis', 'Token Analysis')}</span>
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Usage - Artistic Style */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-100/50 to-pink-50/50 rounded-3xl rotate-1"></div>
                
                <Card className="relative bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50">
                  <CardHeader className="p-6">
                    <CardTitle className="text-2xl font-bold text-gray-800">{t('dashboard.recent_usage', 'Recent Usage')}</CardTitle>
                    <CardDescription className="text-lg text-gray-600">
                      {t('dashboard.recent_usage_subtitle', 'Your recently used services')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6 pt-0">
                    {usageRecords.slice(0, 5).map((record, index) => (
                      <div key={index} className="group flex justify-between items-center p-4 rounded-2xl bg-gradient-to-r from-white/80 to-gray-50/80 hover:from-purple-50 hover:to-pink-50 transition-all duration-300 border border-gray-100 hover:border-purple-200">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              record.serviceId?.includes('dify') 
                                ? 'bg-gradient-to-br from-blue-500 to-cyan-500' 
                                : record.serviceId?.includes('workflow') 
                                  ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                                  : 'bg-gradient-to-br from-green-500 to-teal-500'
                            }`}>
                              <Activity className="h-5 w-5 text-white" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-bounce"></div>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">
                              {record.serviceId?.includes('dify') ? 'Deep-Copywriting' : 
                               record.serviceId?.includes('workflow') ? 'Auto-Video' : 
                               record.serviceId || 'ProMe Service'}
                            </p>
                            <p className="text-sm text-gray-500">{formatDate(record.timestamp)}</p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className="bg-white/90 border-purple-200 text-purple-700 font-medium px-3 py-1 rounded-full"
                        >
                          {record.tokensUsed} Tokens
                        </Badge>
                      </div>
                    ))}
                    {usageRecords.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Activity className="h-8 w-8 text-gray-500" />
                        </div>
                        <p className="text-gray-500 text-lg">
                          {t('dashboard.no_usage_records', 'No usage records')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="usage">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-cyan-50/50 rounded-3xl rotate-1"></div>
              
              <Card className="relative bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50">
                <CardHeader className="p-6">
                  <CardTitle className="text-2xl font-bold text-gray-800">{t('dashboard.usage_records', 'Usage Records')}</CardTitle>
                  <CardDescription className="text-lg text-gray-600">
                    {t('dashboard.recent_usage_subtitle', 'Your recently used services')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  {filteredUsage.length > 0 ? (
                    <div className="relative overflow-x-auto rounded-2xl border border-gray-200">
                      <table className="w-full text-sm text-left bg-white/90">
                        <thead className="bg-gradient-to-r from-cyan-50 to-blue-50 text-gray-700">
                          <tr>
                            <th className="px-6 py-4 font-bold">{t('dashboard.service', 'Service')}</th>
                            <th className="px-6 py-4 font-bold">{t('dashboard.session_id', 'Session ID')}</th>
                            <th className="px-6 py-4 font-bold">{t('dashboard.token_usage', 'Token Usage')}</th>
                            <th className="px-6 py-4 font-bold">{t('dashboard.credits_used', 'Credits Used')}</th>
                            <th className="px-6 py-4 font-bold">{t('dashboard.time', 'Time')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsage.map((record, index) => (
                            <tr key={index} className="border-b border-gray-100 hover:bg-gradient-to-r hover:from-cyan-50/50 hover:to-blue-50/50 transition-colors duration-200">
                              <td className="px-6 py-4 font-semibold text-gray-800">
                                <div className="flex items-center space-x-2">
                                  <div className={`w-3 h-3 rounded-full ${
                                    record.serviceId?.includes('dify') 
                                      ? 'bg-blue-500' 
                                      : record.serviceId?.includes('workflow') 
                                        ? 'bg-purple-500' 
                                        : 'bg-green-500'
                                  }`}></div>
                                  <span>
                                    {record.serviceId?.includes('dify') ? 'Deep-Copywriting' : 
                                     record.serviceId?.includes('workflow') ? 'Auto-Video' : 
                                     record.serviceId || 'ProMe Service'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                                {typeof record.sessionId === 'string' ? record.sessionId.substring(0, 8) + '...' : ''}
                              </td>
                              <td className="px-6 py-4 font-medium text-blue-600">
                                {typeof record.tokensUsed === 'number' ? record.tokensUsed.toLocaleString() : ''}
                              </td>
                              <td className="px-6 py-4 font-semibold text-red-600">
                                {typeof record.cost === 'number' ? Math.round(record.cost).toLocaleString() : '0'} {t('dashboard.credits', 'credits')}
                              </td>
                              <td className="px-6 py-4 text-gray-500 text-xs">
                                {formatDate(record.timestamp)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Search className="h-10 w-10 text-gray-500" />
                      </div>
                      <p className="text-gray-500 text-xl font-medium">
                        {searchTerm ? t('dashboard.no_matching_records', 'No matching usage records found') : t('dashboard.no_usage_records', 'No usage records')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

        </Tabs>
        </div>
        
        {/* Artistic footer */}
        <div className="mt-16 text-center">
          <div className="flex justify-center space-x-2 mb-6">
            {[...Array(7)].map((_, i) => (
              <div 
                key={i}
                className="w-3 h-3 rounded-full animate-bounce"
                style={{
                  backgroundColor: ['#06B6D4', '#3B82F6', '#A855F7', '#EC4899', '#22C55E', '#F59E0B', '#EF4444'][i],
                  animationDelay: `${i * 120}ms`
                }}
              ></div>
            ))}
          </div>
          <blockquote className="text-xl text-gray-600 italic font-light max-w-xl mx-auto">
            "Data tells stories, stories create experiences"
            <br />
            <span className="text-lg text-gray-400 not-italic">- ProMe Dashboard</span>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
