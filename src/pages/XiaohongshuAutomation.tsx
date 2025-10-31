import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { userMappingService } from '@/lib/xiaohongshu-user-mapping';
import { xiaohongshuSupabase } from '@/lib/xiaohongshu-supabase';
import { LoginSection } from '@/components/xiaohongshu/LoginSection';
import { ConfigSection } from '@/components/xiaohongshu/ConfigSection';
import { DashboardSection } from '@/components/xiaohongshu/DashboardSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import type { UserProfile, AutomationStatus, ContentStrategy, WeeklyPlan } from '@/types/xiaohongshu';

type Step = 'login' | 'config' | 'dashboard';

export default function XiaohongshuAutomation() {
  const navigate = useNavigate();
  const user = authService.getCurrentUserSync();

  const [currentStep, setCurrentStep] = useState<Step>('login');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [supabaseUuid, setSupabaseUuid] = useState<string | null>(null);
  const [xhsUserId, setXhsUserId] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [contentStrategy, setContentStrategy] = useState<ContentStrategy | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    initializePage();
  }, [user, navigate]);

  const initializePage = async () => {
    try {
      setLoading(true);
      setError('');

      if (!user?.id) {
        throw new Error('用户未登录');
      }

      setSupabaseUuid(user.id);

      const userId = await userMappingService.getOrCreateMapping(user.id);
      setXhsUserId(userId);

      const [profile, status] = await Promise.all([
        xiaohongshuSupabase.getUserProfile(user.id),
        xiaohongshuSupabase.getAutomationStatus(user.id),
      ]);

      setUserProfile(profile);
      setAutomationStatus(status);

      if (status?.is_running) {
        setCurrentStep('dashboard');
        await loadDashboardData(user.id);
      } else if (profile) {
        setCurrentStep('config');
      } else {
        setCurrentStep('login');
      }
    } catch (err) {
      console.error('Initialize page error:', err);
      setError(err instanceof Error ? err.message : '初始化失败');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async (uuid: string) => {
    try {
      const [strategy, plan] = await Promise.all([
        xiaohongshuSupabase.getContentStrategy(uuid),
        xiaohongshuSupabase.getCurrentWeekPlan(uuid),
      ]);

      setContentStrategy(strategy);
      setWeeklyPlan(plan);
    } catch (err) {
      console.error('Load dashboard data error:', err);
    }
  };

  const handleLoginSuccess = async () => {
    if (!supabaseUuid) return;

    try {
      const profile = await xiaohongshuSupabase.getUserProfile(supabaseUuid);
      setUserProfile(profile);

      if (profile) {
        setCurrentStep('config');
      } else {
        setCurrentStep('config');
      }
    } catch (err) {
      console.error('Handle login success error:', err);
      setCurrentStep('config');
    }
  };

  const handleConfigSaved = (profile: UserProfile) => {
    setUserProfile(profile);
  };

  const handleStartOperation = async () => {
    if (!supabaseUuid) return;

    try {
      setCurrentStep('dashboard');
      await loadDashboardData(supabaseUuid);
      
      const status = await xiaohongshuSupabase.getAutomationStatus(supabaseUuid);
      setAutomationStatus(status);
    } catch (err) {
      console.error('Handle start operation error:', err);
    }
  };

  const handleRefresh = async () => {
    if (!supabaseUuid) return;

    try {
      const status = await xiaohongshuSupabase.getAutomationStatus(supabaseUuid);
      setAutomationStatus(status);
    } catch (err) {
      console.error('Handle refresh error:', err);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
          <p className="text-gray-600">正在加载...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center text-gray-800 mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            🤖 小红书全自动运营系统
          </h1>
          <p className="text-lg opacity-90">一次设置，终身自动 - 让AI为你打理一切</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Content */}
        <div className="space-y-6">
          {/* Step 1: Login */}
          {(currentStep === 'login') && supabaseUuid && xhsUserId && (
            <LoginSection
              supabaseUuid={supabaseUuid}
              xhsUserId={xhsUserId}
              onLoginSuccess={handleLoginSuccess}
              onError={setError}
            />
          )}

          {/* Step 2: Config */}
          {(currentStep === 'config' || currentStep === 'dashboard') && supabaseUuid && xhsUserId && (
            <ConfigSection
              supabaseUuid={supabaseUuid}
              xhsUserId={xhsUserId}
              initialConfig={userProfile}
              onConfigSaved={handleConfigSaved}
              onStartOperation={handleStartOperation}
            />
          )}

          {/* Step 3: Dashboard */}
          {currentStep === 'dashboard' && supabaseUuid && xhsUserId && (
            <DashboardSection
              supabaseUuid={supabaseUuid}
              xhsUserId={xhsUserId}
              automationStatus={automationStatus}
              contentStrategy={contentStrategy}
              weeklyPlan={weeklyPlan}
              onRefresh={handleRefresh}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>由 Claude AI 驱动 | 安全可靠的自动化运营</p>
        </div>
      </div>
    </div>
  );
}
