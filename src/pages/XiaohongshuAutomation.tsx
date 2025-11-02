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
            console.log('✅ 后端有数据！切换到Dashboard');
            // 🔥 后端有数据，直接显示Dashboard，不管Supabase中是否有profile
            if (strategyRes.success && (strategyRes as any).strategy) {
              setContentStrategy((strategyRes as any).strategy);
            }
            if (planRes.success && (planRes as any).plan) {
              const plan = (planRes as any).plan;
              // 🔥 检查plan结构：后端返回{date, tasks}，前端需要{plan_data: {monday, ...}}
              // 如果plan没有plan_data字段，暂时不设置weeklyPlan
              if (plan.plan_data) {
                setWeeklyPlan(plan);
              } else {
                console.warn('⚠️ [XHS] 后端返回的plan格式不匹配，暂不显示周计划');
                setWeeklyPlan(null);
              }
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
      // 使用传入的userId参数，如果没有则使用state中的xhsUserId
      const effectiveUserId = userId || xhsUserId;
      
      if (!effectiveUserId) {
        console.warn('⚠️ xhsUserId 为空，无法加载数据');
        return;
      }

      console.log(`📊 [loadDashboardData] 从后端API获取数据，userId: ${effectiveUserId}`);

      // ✅ 方案A：直接从后端API获取实时数据（不从Supabase获取）
      const [strategyRes, planRes] = await Promise.all([
        xiaohongshuAPI.getContentStrategy(effectiveUserId).catch(err => {
          console.warn('获取strategy失败:', err);
          return { success: false, data: null };
        }),
        xiaohongshuAPI.getWeeklyPlan(effectiveUserId).catch(err => {
          console.warn('获取plan失败:', err);
          return { success: false, data: null };
        }),
      ]);

      console.log('📊 [loadDashboardData] Strategy结果:', strategyRes.success ? '✅ 成功' : '❌ 失败');
      console.log('📊 [loadDashboardData] Plan结果:', planRes.success ? '✅ 成功' : '❌ 失败');

      if (strategyRes.success && strategyRes.data) {
        setContentStrategy(strategyRes.data);
        console.log('✅ 已设置 contentStrategy');
      } else {
        console.log('⚠️ 没有获取到 strategy 数据');
      }

      if (planRes.success && planRes.data) {
        setWeeklyPlan(planRes.data);
        console.log('✅ 已设置 weeklyPlan');
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
