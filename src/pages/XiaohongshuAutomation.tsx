/**
 * XiaohongshuAutomation - 小红书全自动运营系统主页面
 *
 * 使用 Zustand Store 进行状态管理，支持两种视图：
 * 1. 单账号视图：Setup Wizard (3步设置) → Dashboard
 * 2. 矩阵视图：多账号管理面板
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { userMappingService } from '@/lib/xiaohongshu-user-mapping';
import { useXiaohongshuStore } from '@/stores/xiaohongshu-store';
import { SetupWizard } from '@/components/xiaohongshu/SetupWizard';
import { DashboardSection } from '@/components/xiaohongshu/DashboardSection';
import { MatrixDashboard } from '@/components/xiaohongshu/MatrixDashboard';
import { AccountSelector } from '@/components/xiaohongshu/AccountSelector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, LayoutGrid, User, LogOut, Settings } from 'lucide-react';
import { xiaohongshuSupabase } from '@/lib/xiaohongshu-supabase';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';

type ViewMode = 'single' | 'matrix';

export default function XiaohongshuAutomation() {
  const navigate = useNavigate();
  const user = authService.getCurrentUserSync();

  // Zustand store
  const { identity, data, ui, actions } = useXiaohongshuStore();
  const { supabaseUuid, xhsUserId } = identity;
  const { step } = ui;

  // Local UI state
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Prevent duplicate initialization
  const initRef = useRef(false);

  // Initialize on mount
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (initRef.current) return;
    initRef.current = true;

    initializePage();
  }, [user, navigate]);

  const initializePage = async () => {
    try {
      setLoading(true);
      setError('');

      if (!user?.id) {
        throw new Error('用户未登录');
      }

      // Get or create user ID mapping
      let userId: string | null = null;

      try {
        // Check for bound accounts first
        const BACKEND_URL = (import.meta as any).env?.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app';
        const response = await fetch(`${BACKEND_URL}/agent/accounts/list?supabaseUuid=${user.id}`);
        const accountData = await response.json();

        if (accountData.success && accountData.data.accounts.length > 0) {
          // Has bound accounts, use mapping service
          userId = await userMappingService.getOrCreateMapping(user.id);
        } else {
          // No accounts yet, still create mapping for future use
          userId = await userMappingService.getOrCreateMapping(user.id);
        }
      } catch (err) {
        console.warn('Failed to check accounts, creating mapping:', err);
        userId = await userMappingService.getOrCreateMapping(user.id);
      }

      // Initialize store with IDs
      await actions.initialize(user.id, userId || `temp_${user.id}`);

      // Load all data
      await actions.loadAll();
    } catch (err) {
      console.error('Initialize page error:', err);
      setError(err instanceof Error ? err.message : '初始化失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupComplete = () => {
    // Setup wizard completed, switch to dashboard
    actions.setStep('dashboard');
  };

  const handleReconfigure = async () => {
    if (!confirm('确定要重新配置吗？\n\n这将：\n- 停止当前的自动运营\n- 清除所有运营数据和策略\n- 保留您的登录状态\n\n您可以立即重新配置产品信息。')) {
      return;
    }

    try {
      setLoading(true);

      if (supabaseUuid && xhsUserId) {
        // Clear Supabase data
        await xiaohongshuSupabase.clearUserData(supabaseUuid).catch(console.error);

        // Reset backend
        const apiUrl = (import.meta as any).env?.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app';
        await fetch(`${apiUrl}/agent/auto/reset/${xhsUserId}`, {
          method: 'POST',
        }).catch(console.error);
      }

      // Reset store and go to setup
      actions.reset();
      if (supabaseUuid && xhsUserId) {
        await actions.initialize(supabaseUuid, xhsUserId);
      }
      actions.setStep('setup');

      alert('已清除运营数据！您可以重新配置产品信息。');
    } catch (err) {
      console.error('Reconfigure error:', err);
      setError('重新配置失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('确定要退出登录吗？这将清除所有本地数据和服务器端运营配置。')) {
      return;
    }

    try {
      if (supabaseUuid && xhsUserId) {
        // Clear Supabase data
        await xiaohongshuSupabase.clearUserData(supabaseUuid).catch(console.error);

        // Call backend logout
        const apiUrl = (import.meta as any).env?.VITE_XHS_API_URL || 'http://localhost:8080';
        await fetch(`${apiUrl}/agent/xiaohongshu/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: xhsUserId }),
        }).catch(console.error);
      }

      // Clear local storage
      localStorage.removeItem('xhs_logged_in');
      localStorage.setItem('lastLogoutTime', Date.now().toString());

      // Reset store
      actions.reset();

      // Re-initialize to go to setup
      if (user?.id) {
        const userId = await userMappingService.getOrCreateMapping(user.id);
        await actions.initialize(user.id, userId);
      }
    } catch (err) {
      console.error('Logout error:', err);
      setError('退出登录失败，请刷新页面重试');
    }
  };

  const handleRefresh = async () => {
    await actions.refresh();
  };

  // Check for test mode
  const isTestMode = (import.meta as any).env?.VITE_TEST_MODE === 'true';
  if (!user && !isTestMode) {
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
            小红书全自动运营系统
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

        {/* Top Toolbar */}
        {supabaseUuid && xhsUserId && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Account Selector */}
                  <AccountSelector
                    supabaseUuid={supabaseUuid}
                    onAccountChange={(account) => {
                      if (account) {
                        console.log('Switched to account:', account.nickname || account.id);
                        handleRefresh();
                      }
                    }}
                    onAddAccount={() => {
                      actions.setStep('setup');
                    }}
                  />

                  {/* Status Indicator */}
                  <div className="flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-2 ${
                      step === 'dashboard' ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'
                    }`}></span>
                    <span className={`text-sm ${
                      step === 'dashboard' ? 'text-green-600 font-medium' : 'text-yellow-600'
                    }`}>
                      {step === 'dashboard' ? '运营中' : '配置中'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex rounded-lg border border-gray-200 p-0.5">
                    <Button
                      variant={viewMode === 'matrix' ? 'default' : 'ghost'}
                      size="sm"
                      className="text-xs px-2"
                      onClick={() => setViewMode('matrix')}
                    >
                      <LayoutGrid className="w-3 h-3 mr-1" />
                      矩阵
                    </Button>
                    <Button
                      variant={viewMode === 'single' ? 'default' : 'ghost'}
                      size="sm"
                      className="text-xs px-2"
                      onClick={() => setViewMode('single')}
                    >
                      <User className="w-3 h-3 mr-1" />
                      单账号
                    </Button>
                  </div>

                  {/* Action Buttons */}
                  {step === 'dashboard' && viewMode === 'single' && (
                    <Button
                      onClick={handleReconfigure}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      重新配置
                    </Button>
                  )}
                  {step === 'dashboard' && (
                    <Button
                      onClick={handleLogout}
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                    >
                      <LogOut className="w-3 h-3 mr-1" />
                      退出登录
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content */}
        <div className="space-y-6">
          {/* Matrix View */}
          {viewMode === 'matrix' && supabaseUuid && (
            <MatrixDashboard
              supabaseUuid={supabaseUuid}
              userProfile={data.profile}
              onAddAccount={() => {
                setViewMode('single');
                actions.setStep('setup');
              }}
              onConfigureAccount={(account) => {
                console.log('Configure account:', account);
                setViewMode('single');
                actions.setStep('setup');
              }}
              onViewDetails={(account) => {
                console.log('View details:', account);
                setViewMode('single');
                actions.setStep('dashboard');
              }}
            />
          )}

          {/* Single Account View */}
          {viewMode === 'single' && (
            <>
              {/* Setup Wizard */}
              {step === 'setup' && supabaseUuid && (
                <SetupWizard onComplete={handleSetupComplete} />
              )}

              {/* Dashboard */}
              {step === 'dashboard' && supabaseUuid && xhsUserId && (
                <DashboardSection
                  supabaseUuid={supabaseUuid}
                  xhsUserId={xhsUserId}
                  automationStatus={data.status}
                  contentStrategy={data.strategy}
                  weeklyPlan={null}
                  userProfile={data.profile}
                  onRefresh={handleRefresh}
                  onReconfigure={handleReconfigure}
                  onLogout={handleLogout}
                />
              )}
            </>
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
