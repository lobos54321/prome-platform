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

  const handleReconfigure = async () => {
    if (!confirm('确定要重新配置吗？这将停止当前的自动运营并清除所有数据。')) {
      return;
    }

    try {
      if (supabaseUuid && xhsUserId) {
        // 调用后端API停止运营
        await xiaohongshuSupabase.clearUserData(supabaseUuid).catch(console.error);
        
        // 调用后端重置自动运营
        const response = await fetch(`${process.env.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app'}/agent/auto/reset/${xhsUserId}`, {
          method: 'POST',
        });
        
        if (response.ok) {
          console.log('✅ 后端运营已停止');
        }
      }

      // 重置状态
      setUserProfile(null);
      setAutomationStatus(null);
      setContentStrategy(null);
      setWeeklyPlan(null);
      setCurrentStep('config');
    } catch (err) {
      console.error('Reconfigure error:', err);
      setError('重新配置失败，请刷新页面重试');
    }
  };

  const handleLogout = async () => {
    if (!confirm('确定要退出登录吗？这将清除所有本地数据和服务器端运营配置。')) {
      return;
    }

    try {
      // 调用后端清除Cookie
      if (supabaseUuid && xhsUserId) {
        await xiaohongshuSupabase.clearUserData(supabaseUuid).catch(console.error);
        
        // 调用后端退出登录API
        const response = await fetch(`${process.env.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app'}/agent/xiaohongshu/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: xhsUserId }),
        });
        
        if (response.ok) {
          console.log('✅ 后端Cookie已清除');
        }
      }

      // 清除本地存储
      localStorage.removeItem('xhs_logged_in');
      localStorage.removeItem('lastLogoutTime');
      localStorage.setItem('lastLogoutTime', Date.now().toString());

      // 重置所有状态
      setUserProfile(null);
      setAutomationStatus(null);
      setContentStrategy(null);
      setWeeklyPlan(null);
      setCurrentStep('login');

      alert('已退出登录！\n\n⚠️ 为确保数据完全清理，系统将禁止新登录60秒。');
      
      // 刷新页面
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error('Logout error:', err);
      setError('退出登录失败，请刷新页面重试');
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
              onReconfigure={handleReconfigure}
              onLogout={handleLogout}
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
