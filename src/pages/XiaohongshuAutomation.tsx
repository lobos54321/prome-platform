import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { userMappingService } from '@/lib/xiaohongshu-user-mapping';
import { xiaohongshuSupabase } from '@/lib/xiaohongshu-supabase';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';
import { LoginSection } from '@/components/xiaohongshu/LoginSection';
import { ConfigSection } from '@/components/xiaohongshu/ConfigSection';
import { DashboardSection } from '@/components/xiaohongshu/DashboardSection';
import { AccountSelector } from '@/components/xiaohongshu/AccountSelector';
import { AccountManager } from '@/components/xiaohongshu/AccountManager';
import { MatrixDashboard } from '@/components/xiaohongshu/MatrixDashboard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, LayoutGrid, User } from 'lucide-react';
import type { UserProfile, AutomationStatus, ContentStrategy, WeeklyPlan } from '@/types/xiaohongshu';

type Step = 'config' | 'accounts' | 'dashboard';
type ViewMode = 'single' | 'matrix';

export default function XiaohongshuAutomation() {
  console.log('🚀 [XiaohongshuAutomation] 组件被调用');

  // Emergency test mode check removed - always load full interface
  console.log('🚀 [XiaohongshuAutomation] Loading full interface...');

  console.log('⚠️ [XiaohongshuAutomation] 未进入emergency test mode，继续正常流程');

  const navigate = useNavigate();
  const user = authService.getCurrentUserSync();

  const [currentStep, setCurrentStep] = useState<Step>('config'); // 默认显示配置页面
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [supabaseUuid, setSupabaseUuid] = useState<string | null>(null);
  const [xhsUserId, setXhsUserId] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [contentStrategy, setContentStrategy] = useState<ContentStrategy | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [justLoggedOut, setJustLoggedOut] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('matrix'); // 默认显示矩阵视图

  // 🔥 防止账号切换时重复调用 initializePage
  const lastAccountIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Force test mode for now to allow access
    if (!user) {
      navigate('/login');
      return;
    }

    initializePage();
  }, [user, navigate]);

  const initializePage = async () => {
    console.log('🚀 [XHS] initializePage 开始执行');

    try {
      console.log('🚀 [XHS] 设置loading状态');
      setLoading(true);
      setError('');

      // 🔥 测试模式：跳过所有API调用，直接显示配置页面
      const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
      if (isTestMode) {
        console.log('🧪 [XHS] 测试模式：跳过初始化API调用');
        setSupabaseUuid('test-user-id');
        setXhsUserId('test-xhs-user');
        setLoading(false);
        setCurrentStep('config');
        return;
      }

      console.log('🚀 [XHS] 检查用户登录状态, user:', user);
      if (!user?.id) {
        console.error('❌ [XHS] 用户未登录');
        throw new Error('用户未登录');
      }

      console.log('🚀 [XHS] 设置 supabaseUuid:', user.id);
      setSupabaseUuid(user.id);

      // 🔥 新流程：先加载产品配置，不检查小红书登录状态
      // 获取用户ID映射（如果有绑定账号的话）
      let userId: string | null = null;
      let hasBindedAccounts = false;

      try {
        const BACKEND_URL = (import.meta as any).env?.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app';
        const response = await fetch(`${BACKEND_URL}/agent/accounts/list?supabaseUuid=${user.id}`);
        const data = await response.json();

        if (data.success && data.data.accounts.length > 0) {
          hasBindedAccounts = true;
          const defaultAccount = data.data.accounts.find((a: any) => a.is_default);
          // 🔥 注意：xhs_account_id 是账号 UUID，不是 cookies 存储的 ID
          // cookies 存储在 user_xxx_prome 格式下，所以 xhsUserId 应使用 userMappingService
          const accountId = (defaultAccount || data.data.accounts[0]).xhs_account_id;
          console.log('✅ [XHS] 找到绑定账号:', accountId);
          // 🔥 仍然使用 userMappingService 来获取正确的 cookie session ID
          userId = await userMappingService.getOrCreateMapping(user.id);
          console.log('✅ [XHS] 使用 cookie session ID:', userId);
        } else {
          console.log('📋 [XHS] 未找到绑定账号，用户需要先配置产品再添加账号');
          // 即使没有账号也创建映射用于后续流程
          userId = await userMappingService.getOrCreateMapping(user.id);
        }
      } catch (accountErr) {
        console.log('⚠️ [XHS] 获取账号失败，继续显示配置页面:', accountErr);
        userId = await userMappingService.getOrCreateMapping(user.id);
      }

      if (userId) {
        setXhsUserId(userId);
      }

      // 🔥 加载用户配置（产品信息）
      const profile = await xiaohongshuSupabase.getUserProfile(user.id);
      setUserProfile(profile);

      // 🔥 新流程决策：
      // 1. 如果有配置 + 有绑定账号 + 正在运营 → dashboard
      // 2. 如果有配置 + 有绑定账号 + 未运营 → accounts (可以启动运营)
      // 3. 如果有配置 + 无绑定账号 → accounts (需要添加账号)
      // 4. 如果无配置 → config (需要先配置产品)

      if (!profile?.product_name) {
        console.log('📋 [XHS] 未配置产品信息，显示配置页面');
        setLoading(false);
        setCurrentStep('config');
        return;
      }

      // 有配置，检查是否有绑定账号
      if (!hasBindedAccounts) {
        console.log('📋 [XHS] 已配置产品，但未绑定账号，显示账号页面');
        setLoading(false);
        setCurrentStep('accounts');
        return;
      }

      // 有配置且有账号，检查运营状态
      console.log('✅ [XHS] 已配置产品且有账号，检查运营状态...');

      // 获取运营状态
      const status = await xiaohongshuSupabase.getAutomationStatus(user.id);
      setAutomationStatus(status);

      // 🔥 修复：检查后端是否有数据，即使Supabase中没有is_running状态
      // 因为后端重启后可能从文件恢复了数据，但Supabase状态未同步
      if (status?.is_running && userId) {
        // Supabase显示正在运行，直接加载Dashboard
        setCurrentStep('dashboard');
        await loadDashboardData(user.id, userId);
      } else {
        // Supabase没有运行状态，尝试从后端API检查是否有历史数据
        console.log('📊 Supabase无运行状态，检查后端是否有数据...');

        try {
          // 尝试获取后端数据
          const [strategyRes, planRes] = await Promise.all([
            xiaohongshuAPI.getContentStrategy(userId).catch(() => ({ success: false })),
            xiaohongshuAPI.getWeeklyPlan(userId).catch(() => ({ success: false })),
          ]);

          console.log('🔍 [XHS] Strategy响应:', strategyRes);
          console.log('🔍 [XHS] Plan响应:', planRes);

          // 🔥 注意：后端返回的是 {success, strategy} 或 {success, plan}，不是 {success, data}
          const hasBackendData = (strategyRes.success && (strategyRes as any).strategy) || (planRes.success && (planRes as any).plan);

          if (hasBackendData) {
            console.log('✅ 后端有数据！但再次确认不在退出保护期...');

            // 🔥 再次检查退出保护期（防御性检查）
            try {
              const logoutCheckAgain = await xiaohongshuAPI.checkLogoutStatus(userId);
              if (logoutCheckAgain.data?.inProtection) {
                console.warn('⚠️ [XHS] 检测到退出保护期，忽略后端数据，显示账号界面');
                setError(`退出保护期：请等待 ${logoutCheckAgain.data.remainingSeconds} 秒后重新登录`);
                setLoading(false);
                setCurrentStep('accounts');
                return;
              }
            } catch (err) {
              console.warn('⚠️ [XHS] 二次退出保护检查失败，继续加载数据');
            }

            console.log('✅ 确认不在保护期，切换到Dashboard');
            // 🔥 后端有数据，直接显示Dashboard，不管Supabase中是否有profile
            if (strategyRes.success && (strategyRes as any).strategy) {
              setContentStrategy((strategyRes as any).strategy);
            }
            if (planRes.success && (planRes as any).plan) {
              const plan = (planRes as any).plan;
              // 🔥 始终设置plan，因为DashboardSection需要plan.tasks来显示内容预览
              // 即使plan格式不符合WeeklyPlan（缺少plan_data），WeeklyPlanCard会显示"暂无计划数据"
              // 但plan.tasks仍然可以用于ContentPreviewCard和ReadyQueueCard
              console.log('📅 [XHS] 设置plan数据:', plan);
              setWeeklyPlan(plan);
            }

            // 🔥 强制显示dashboard - 因为后端是唯一数据源
            setCurrentStep('dashboard');

            // 🔥 如果Supabase没有profile，创建一个虚拟profile以满足UI需要
            if (!profile) {
              console.log('📝 创建虚拟profile以支持Dashboard显示');
              setUserProfile({
                id: 'temp-' + user.id,
                supabase_uuid: user.id,
                xhs_user_id: userId!,
                product_name: '未配置',
                target_audience: null,
                marketing_goal: 'brand',
                post_frequency: 'daily',
                brand_style: 'warm',
                review_mode: 'manual',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          } else {
            console.log('⚠️ 后端无数据，显示配置页面');
            // 后端也没数据
            // 无配置，显示配置页面
            setCurrentStep('config');
          }
        } catch (err) {
          console.error('检查后端数据失败:', err);
          // 出错时按原逻辑处理
          // 出错时显示配置页面
          setCurrentStep('config');
        }
      }
    } catch (err) {
      console.error('Initialize page error:', err);
      setError(err instanceof Error ? err.message : '初始化失败');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async (uuid: string, userId?: string) => {
    try {
      console.log(`📊 [loadDashboardData] 从Supabase获取数据，uuid: ${uuid}`);

      // ✅ 方案B：从Supabase读取数据显示（后端已写入Supabase）
      const [strategy, plan] = await Promise.all([
        xiaohongshuSupabase.getContentStrategy(uuid).catch(err => {
          console.warn('获取strategy失败:', err);
          return null;
        }),
        xiaohongshuSupabase.getCurrentWeekPlan(uuid).catch(err => {
          console.warn('获取plan失败:', err);
          return null;
        }),
      ]);

      console.log('📊 [loadDashboardData] Strategy结果:', strategy ? '✅ 有数据' : '⚠️ 无数据');
      console.log('📊 [loadDashboardData] Plan结果:', plan ? '✅ 有数据' : '⚠️ 无数据');

      if (strategy) {
        setContentStrategy(strategy);
        console.log('✅ 已设置 contentStrategy:', strategy);
      } else {
        console.log('⚠️ 没有获取到 strategy 数据');
      }

      if (plan) {
        setWeeklyPlan(plan);
        console.log('✅ 已设置 weeklyPlan:', plan);
      } else {
        console.log('⚠️ 没有获取到 plan 数据');
      }
      setLoading(false); // 🔥 Ensure loading is cleared after data load
    } catch (err) {
      console.error('❌ Load dashboard data error:', err);
      // Ensure loading is cleared even on error
      setLoading(false);
    }
  };

  const handleLoginSuccess = async () => {
    if (!supabaseUuid) return;

    try {
      console.log('🔄 [LoginSuccess] 登录成功，准备跳转...');

      // 🔥 NOTE: We skip the profile fetch from xhs-worker because:
      // 1. XHS API rejects requests from server IP (different from user's browser IP)
      // 2. Profile info (avatar, nickname) is nice-to-have, not required for publishing
      // 3. The failing profile fetch was causing infinite loops

      // Just wait briefly for account binding to propagate
      console.log('⏳ [LoginSuccess] 等待账号数据生效...');
      const BACKEND_URL = (import.meta as any).env?.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app';

      let accountFound = false;
      for (let i = 0; i < 3; i++) { // 🔥 Reduced from 5 to 3 attempts
        try {
          const response = await fetch(`${BACKEND_URL}/agent/accounts/list?supabaseUuid=${supabaseUuid}`);
          const data = await response.json();
          if (data.success && data.data.accounts.length > 0) {
            console.log('✅ [LoginSuccess] 账号数据已确认生效！');
            accountFound = true;
            break;
          }
        } catch (err) {
          console.warn('轮询账号列表失败:', err);
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!accountFound) {
        console.warn('⚠️ [LoginSuccess] 账号未立即检测到，但继续跳转（可能稍后生效）');
      }

      const profile = await xiaohongshuSupabase.getUserProfile(supabaseUuid);
      setUserProfile(profile);

      // 登录成功且有配置，强制进入Dashboard
      if (profile?.product_name) {
        console.log('🚀 [LoginSuccess] 强制跳转 Dashboard');
        setCurrentStep('dashboard');
        if (xhsUserId) loadDashboardData(supabaseUuid, xhsUserId);
      } else {
        // 无配置才去配置页
        setCurrentStep('config');
      }
    } catch (err) {
      console.error('Handle login success error:', err);
      // 🔥 On error, still try to proceed instead of looping
      setCurrentStep('config');
    }
  };

  const handleConfigSaved = (profile: UserProfile) => {
    setUserProfile(profile);
  };

  const handleStartOperation = async () => {
    if (!supabaseUuid) return;

    // 🔥 不要在这里切换 step 或显示 alert
    // ConfigSection 内部会显示 AgentProgressPanel
    // 这里只需要记录日志
    console.log('🚀 [XHS] handleStartOperation 被调用，进度面板将在 ConfigSection 中显示');

    // 可选：记录后台开始处理
    // 实际的进度面板和状态管理在 ConfigSection 中完成
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
    if (!confirm('确定要重新配置吗？\n\n这将：\n✅ 停止当前的自动运营\n✅ 清除所有运营数据和策略\n✅ 保留您的登录状态（无需重新扫码）\n\n您可以立即重新配置产品信息。')) {
      return;
    }

    try {
      setLoading(true);

      if (supabaseUuid && xhsUserId) {
        // 1. 清除Supabase数据
        console.log('🧹 清除Supabase数据...');
        await xiaohongshuSupabase.clearUserData(supabaseUuid).catch(console.error);

        // 2. 调用后端重置自动运营（清除策略、计划等）
        console.log('🧹 调用后端重置API...');
        const response = await fetch(`${process.env.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app'}/agent/auto/reset/${xhsUserId}`, {
          method: 'POST',
        });

        if (response.ok) {
          console.log('✅ 后端运营数据已清除');
        } else {
          console.warn('⚠️ 后端重置失败，状态码:', response.status);
        }
      }

      // 3. 重置前端状态（但保留登录状态）
      console.log('🧹 重置前端状态...');
      setUserProfile(null);
      setAutomationStatus(null);
      setContentStrategy(null);
      setWeeklyPlan(null);
      setCurrentStep('config');

      console.log('✅ 重新配置完成，返回配置页面');
      alert('✅ 已清除运营数据！\n\n您可以重新配置产品信息。\n\n您的登录状态已保留，无需重新扫码。');

    } catch (err) {
      console.error('Reconfigure error:', err);
      setError('重新配置失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    // 🔥 Remove double confirm - DashboardSection already confirms
    // if (!confirm('确定要退出登录吗？这将清除所有本地数据和服务器端运营配置。')) {
    //   return;
    // }

    try {
      // 调用后端清除Cookie
      if (supabaseUuid && xhsUserId) {
        console.log('🧹 [Logout] 开始清理...');

        // 1. 清除 Supabase 数据
        await xiaohongshuSupabase.clearUserData(supabaseUuid).catch(console.error);

        // 2. 🔥 调用 Claude Agent Service 的 logout 端点
        // Use env var with localhost fallback for development
        const apiUrl = process.env.VITE_XHS_API_URL || 'http://localhost:8080';
        const logoutUrl = `${apiUrl}/agent/xiaohongshu/logout`;
        console.log(`🔄 [Logout] 准备调用 logout API: ${logoutUrl}`);

        try {
          const response = await fetch(logoutUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: xhsUserId }),
          });

          if (response.ok) {
            console.log('✅ [Logout] MCP Router 完整清理成功');
          } else {
            console.error('❌ [Logout] MCP Router 清理失败');
          }
        } catch (fetchError) {
          console.error('❌ [Logout] Fetch 调用失败:', fetchError);
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

      // 🔥 关键修复：设置 justLoggedOut 标志，防止 LoginSection 自动重新登录
      // 并且不要刷新页面，避免触发 initializePage 循环
      setJustLoggedOut(true);
      setCurrentStep('accounts');
      // 注意：我们需要通过某种方式将 justLoggedOut 传递给 LoginSection
      // 这里我们使用一个临时状态或通过 props 传递
      // 由于 LoginSection 是在 render 中渲染的，我们可以添加一个 state
    } catch (err) {
      console.error('Logout error:', err);
      setError('退出登录失败，请刷新页面重试');
    }
  };

  // 在测试模式下绕过用户检查
  const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
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

        {/* 🔥 全局顶部工具栏 - 始终可见 */}
        {supabaseUuid && xhsUserId && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* 账号选择器 - 支持多账号切换 */}
                  <AccountSelector
                    supabaseUuid={supabaseUuid}
                    onAccountChange={(account) => {
                      if (account) {
                        const accountId = account.id;

                        // 🔥 幂等检查：如果账号没变，不要重新初始化
                        if (lastAccountIdRef.current === accountId) {
                          console.log('ℹ️ [XHS] 账号未变化，跳过 initializePage:', accountId);
                          return;
                        }

                        console.log('🔄 切换到账号:', account.nickname || account.id);
                        lastAccountIdRef.current = accountId;

                        // 🔥 只刷新数据，不要重新 setLoading(true) 整个页面
                        loadDashboardData(supabaseUuid!, xhsUserId!);
                      }
                    }}
                    onAddAccount={() => {
                      // 点击添加账号时，跳转到账号管理
                      setCurrentStep('accounts');
                    }}
                  />

                  <div className="flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-2 ${currentStep === 'dashboard' ? 'bg-green-400' :
                      currentStep === 'config' ? 'bg-yellow-400 animate-pulse' :
                        'bg-gray-400 animate-pulse'
                      }`}></span>
                    <span className={`text-sm ${currentStep === 'dashboard' ? 'text-green-600 font-medium' :
                      currentStep === 'config' ? 'text-yellow-600' :
                        'text-gray-600'
                      }`}>
                      {currentStep === 'dashboard' ? '运营中' :
                        currentStep === 'config' ? '配置中' :
                          '未登录'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {/* 视图切换按钮 */}
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

                  {currentStep === 'dashboard' && viewMode === 'single' && (
                    <Button
                      onClick={handleReconfigure}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      ⚙️ 重新配置
                    </Button>
                  )}
                  {currentStep !== 'config' && (
                    <Button
                      onClick={handleLogout}
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                    >
                      🚪 退出登录
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content */}
        <div className="space-y-6">
          {/* 矩阵视图 - 同时管理所有账号 */}
          {viewMode === 'matrix' && supabaseUuid && (
            <MatrixDashboard
              supabaseUuid={supabaseUuid}
              userProfile={userProfile}
              onAddAccount={() => {
                setViewMode('single');
                setCurrentStep('accounts');
              }}
              onConfigureAccount={(account) => {
                console.log('配置账号:', account);
                setViewMode('single');
                setCurrentStep('config');
              }}
              onViewDetails={(account) => {
                console.log('查看详情:', account);
                setViewMode('single');
                setCurrentStep('dashboard');
              }}
            />
          )}

          {/* 单账号视图 */}
          {viewMode === 'single' && (
            <>
              {/* Step 1: Config - 产品配置 */}
              {(currentStep === 'config') && supabaseUuid && (
                <ConfigSection
                  supabaseUuid={supabaseUuid}
                  xhsUserId={xhsUserId || ''}
                  initialConfig={userProfile}
                  onConfigSaved={(profile) => {
                    handleConfigSaved(profile);
                    // 配置保存后进入账号管理步骤
                    setCurrentStep('accounts');
                  }}
                  onStartOperation={handleStartOperation}
                />
              )}

              {/* Step 2: Accounts - 添加/管理账号 */}
              {(currentStep === 'accounts') && supabaseUuid && xhsUserId && (
                <>
                  {/* 显示产品配置摘要 */}
                  {userProfile?.product_name && (
                    <Card className="mb-4">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-semibold">产品: {userProfile.product_name}</h3>
                            <p className="text-sm text-muted-foreground">{userProfile.target_audience}</p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setCurrentStep('config')}>
                            修改配置
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 账号矩阵管理组件 */}
                  <AccountManager
                    supabaseUuid={supabaseUuid}
                    productName={userProfile?.product_name}
                    targetAudience={userProfile?.target_audience || ''}
                    marketingGoal={userProfile?.marketing_goal}
                    materialAnalysis={userProfile?.material_analysis}
                    onAddAccount={() => {
                      // 触发登录流程添加新账号
                      console.log('👤 [Page] 添加新账号');
                    }}
                    onStrategyGenerated={(personas) => {
                      console.log('🤖 [Page] AI策略已生成:', personas);
                    }}
                  />

                  {/* 登录/账号管理组件 - 用于添加新账号 */}
                  <LoginSection
                    supabaseUuid={supabaseUuid}
                    xhsUserId={xhsUserId}
                    onLoginSuccess={() => {
                      // 登录成功后刷新账号列表和用户信息
                      handleLoginSuccess();
                      // 重新初始化以获取新绑定的账号ID
                      initializePage();
                      // 注意：initializePage 也是异步的，它最终会根据状态决定跳转
                      // 所以这里不需要强制 setCurrentStep('dashboard')，依靠 initializePage 的逻辑即可
                      // 但为了UI即时反馈，可以设为 loading
                      setLoading(true);
                    }}
                    onError={setError}
                    onLogout={() => {
                      console.log('🔄 [Page] 收到退出登录通知，重置状态');
                      setCurrentStep('accounts');
                      setContentStrategy(null);
                      setWeeklyPlan(null);
                      setAutomationStatus(null);
                      setError('');
                      setLoading(false);
                      setJustLoggedOut(true);
                    }}
                    justLoggedOut={justLoggedOut}
                  />
                </>
              )}

              {/* Step 3: Dashboard - 显示配置和运营状态 */}
              {(currentStep === 'dashboard') && supabaseUuid && xhsUserId && (
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
