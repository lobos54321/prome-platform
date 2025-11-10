import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { userMappingService } from '@/lib/xiaohongshu-user-mapping';
import { xiaohongshuSupabase } from '@/lib/xiaohongshu-supabase';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';
import { LoginSection } from '@/components/xiaohongshu/LoginSection';
import { ConfigSection } from '@/components/xiaohongshu/ConfigSection';
import { DashboardSection } from '@/components/xiaohongshu/DashboardSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    console.log('🚀 [XHS] initializePage 开始执行');

    try {
      console.log('🚀 [XHS] 设置loading状态');
      setLoading(true);
      setError('');

      console.log('🚀 [XHS] 检查用户登录状态, user:', user);
      if (!user?.id) {
        console.error('❌ [XHS] 用户未登录');
        throw new Error('用户未登录');
      }

      console.log('🚀 [XHS] 设置 supabaseUuid:', user.id);
      setSupabaseUuid(user.id);

      console.log('🚀 [XHS] 准备调用 getOrCreateMapping');
      const userId = await userMappingService.getOrCreateMapping(user.id);
      console.log('✅ [XHS] getOrCreateMapping 返回:', userId);
      setXhsUserId(userId);

      // 🔥 关键修复：先检查登录状态和退出保护期
      console.log('🔒 [XHS] 检查登录状态和退出保护...');
      try {
        // 1. 先检查退出保护状态
        const logoutStatus = await xiaohongshuAPI.checkLogoutStatus(userId);
        if (logoutStatus.data?.inProtection) {
          console.log('⚠️ [XHS] 用户在退出保护期内，停止所有初始化');
          setError(`退出保护期：请等待 ${logoutStatus.data.remainingSeconds} 秒后重新登录`);
          setLoading(false);
          setCurrentStep('login');
          return; // 🔥 立即返回，不执行任何后续操作
        }

        // 2. 检查登录状态
        const loginStatus = await xiaohongshuAPI.checkLoginStatus(userId);
        console.log('🔍 [XHS] 登录状态检查结果:', loginStatus);

        // 🔥 如果在保护期或未登录，立即停止
        if (loginStatus.inProtection || !loginStatus.isLoggedIn) {
          console.log('⚠️ [XHS] 用户未登录或在保护期，停止初始化');
          setLoading(false);
          setCurrentStep('login');
          return; // 🔥 立即返回，不加载任何数据
        }

        console.log('✅ [XHS] 已登录且不在保护期，继续初始化');
      } catch (statusCheckError) {
        console.error('❌ [XHS] 状态检查失败:', statusCheckError);
        // 🔥 检查失败时，为安全起见，不加载数据，显示登录界面
        setError('检查登录状态失败，请刷新页面重试');
        setLoading(false);
        setCurrentStep('login');
        return; // 🔥 立即返回
      }

      // 🔥 只有通过所有检查后，才加载数据
      const [profile, status] = await Promise.all([
        xiaohongshuSupabase.getUserProfile(user.id),
        xiaohongshuSupabase.getAutomationStatus(user.id),
      ]);

      setUserProfile(profile);
      setAutomationStatus(status);

      // 🔥 修复：检查后端是否有数据，即使Supabase中没有is_running状态
      // 因为后端重启后可能从文件恢复了数据，但Supabase状态未同步
      if (status?.is_running) {
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
                console.warn('⚠️ [XHS] 检测到退出保护期，忽略后端数据，显示登录界面');
                setError(`退出保护期：请等待 ${logoutCheckAgain.data.remainingSeconds} 秒后重新登录`);
                setLoading(false);
                setCurrentStep('login');
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
                supabase_uuid: user.id,
                xhs_user_id: userId,
                product_name: '未配置', // 从后端数据推断或使用默认值
                product_description: '',
                target_audience: '',
                brand_tone: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          } else {
            console.log('⚠️ 后端无数据，显示配置页面');
            // 后端也没数据
            if (profile) {
              setCurrentStep('config');
            } else {
              setCurrentStep('login');
            }
          }
        } catch (err) {
          console.error('检查后端数据失败:', err);
          // 出错时按原逻辑处理
          if (profile) {
            setCurrentStep('config');
          } else {
            setCurrentStep('login');
          }
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
    } catch (err) {
      console.error('❌ Load dashboard data error:', err);
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
      // 立即切换到dashboard并显示加载状态
      setCurrentStep('dashboard');
      setLoading(true);
      
      // 显示提示信息
      alert('🚀 自动运营已启动！\n\n系统正在后台生成内容，这需要2-5分钟时间。\n\n页面将自动刷新数据，请耐心等待。');
      
      // 等待5秒让后端开始处理
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 开始轮询数据 - 最多100次，每10秒一次 = 1000秒（约16分钟）
      const maxAttempts = 100;
      let attempts = 0;
      
      const pollData = async (): Promise<boolean> => {
        attempts++;
        console.log(`🔄 [${new Date().toLocaleTimeString()}] 数据轮询第 ${attempts}/${maxAttempts} 次尝试`);
        
        try {
          // 从后端API获取数据
          const statusRes = await fetch(`${process.env.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app'}/agent/auto/status/${xhsUserId}`);
          
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            console.log('✅ 获取到运营状态:', statusData);
            
            if (statusData.success && statusData.data) {
              // 加载完整的Dashboard数据（传入xhsUserId以确保有值）
              await loadDashboardData(supabaseUuid, xhsUserId || undefined);
              
              // 更新状态
              const status = await xiaohongshuSupabase.getAutomationStatus(supabaseUuid);
              if (status) {
                setAutomationStatus(status);
                console.log('✅ 数据加载成功！');
                return true; // 成功获取到数据
              }
            }
          } else if (statusRes.status === 404) {
            console.log('⏳ 数据尚未生成，继续等待...');
          }
        } catch (err) {
          console.warn(`⚠️ 轮询失败 (${attempts}/${maxAttempts}):`, err);
        }
        
        return false;
      };
      
      // 第一次尝试
      const success = await pollData();
      
      if (!success && attempts < maxAttempts) {
        // 如果第一次失败，继续轮询
        console.log('🔄 开始持续轮询，每10秒检查一次，最多持续1000秒');
        
        const interval = setInterval(async () => {
          const result = await pollData();
          
          if (result) {
            clearInterval(interval);
            setLoading(false);
            alert('✅ 自动运营启动成功！\n\n内容已生成完毕，可以在Dashboard查看详情。');
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            setLoading(false);
            alert('⚠️ 数据加载超时\n\n后台可能还在处理中，请稍后手动刷新页面查看。\n\n如果长时间没有数据，请检查后端日志。');
          }
        }, 10000); // 每10秒轮询一次
        
        // 保存interval ID以便在组件卸载时清理
        return () => clearInterval(interval);
      } else if (success) {
        setLoading(false);
        alert('✅ 自动运营启动成功！\n\n内容已生成完毕。');
      } else {
        setLoading(false);
      }
      
    } catch (err) {
      console.error('Handle start operation error:', err);
      setError('启动自动运营失败: ' + (err instanceof Error ? err.message : String(err)));
      setLoading(false);
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
    if (!confirm('确定要退出登录吗？这将清除所有本地数据和服务器端运营配置。')) {
      return;
    }

    try {
      // 调用后端清除Cookie
      if (supabaseUuid && xhsUserId) {
        console.log('🧹 [Logout] 开始清理...');

        // 1. 清除 Supabase 数据
        await xiaohongshuSupabase.clearUserData(supabaseUuid).catch(console.error);

        // 2. 🔥 调用 MCP Router 的完整 logout 端点（清理所有Cookie文件，包括Go后端的 /app/data/cookies.json）
        const response = await fetch(`${process.env.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app'}/api/xiaohongshu/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: xhsUserId }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ [Logout] MCP Router 完整清理成功:', result);
          console.log('🔒 [Logout] 所有Cookie文件已删除，包括Go后端的cookies.json');
        } else {
          console.error('❌ [Logout] MCP Router 清理失败');
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
      
      // 🔥 不刷新页面，直接停留在登录界面
      // 后端已经清除了数据，60秒保护期后可以重新登录
      setError(''); // 清除错误信息
      setLoading(false); // 停止加载状态
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

        {/* 🔥 全局顶部工具栏 - 始终可见 */}
        {supabaseUuid && xhsUserId && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-2 ${
                      currentStep === 'dashboard' ? 'bg-green-400' :
                      currentStep === 'config' ? 'bg-yellow-400 animate-pulse' :
                      'bg-gray-400 animate-pulse'
                    }`}></span>
                    <span className={`text-sm ${
                      currentStep === 'dashboard' ? 'text-green-600 font-medium' :
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
                  {currentStep === 'dashboard' && (
                    <Button
                      onClick={handleReconfigure}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      ⚙️ 重新配置
                    </Button>
                  )}
                  {currentStep !== 'login' && (
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
          {/* Step 1: Login */}
          {(currentStep === 'login') && supabaseUuid && xhsUserId && (
            <LoginSection
              supabaseUuid={supabaseUuid}
              xhsUserId={xhsUserId}
              onLoginSuccess={handleLoginSuccess}
              onError={setError}
              onLogout={() => {
                // 🔥 退出登录后，重置所有状态
                console.log('🔄 [Page] 收到退出登录通知，重置状态');
                setCurrentStep('login');
                setContentStrategy(null);
                setWeeklyPlan(null);
                setAutomationStatus(null);
                setUserProfile(null);
                setError(''); // 清除错误信息
                setLoading(false); // 停止加载状态
                // 🔥 不刷新页面，直接停留在登录界面
                // 后端已经清除了数据，60秒保护期后可以重新登录
              }}
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
