/**
 * XiaohongshuAutomation - 智能路由 + 任务恢复
 *
 * 根据用户配置状态和任务状态决定显示内容：
 * - 有进行中的任务 → 显示 AgentProgressPanel
 * - 已配置完成 → /xiaohongshu-manager (运营管理)
 * - 未配置 → /auto (配置向导)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { AgentProgressPanel } from '@/components/workflow';
import { WorkflowMode } from '@/types/workflow';

interface ActiveTask {
  taskId: string;
  platform: string;
  mode: WorkflowMode;
  supabaseUuid: string;
  xhsUserId: string;
  startedAt: string;
}

export default function XiaohongshuAutomation() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const checkUserConfig = async () => {
      try {
        // 🔥 首先检查是否有进行中的任务
        const savedTask = localStorage.getItem('prome_active_task');
        if (savedTask) {
          try {
            const task = JSON.parse(savedTask) as ActiveTask;
            // 检查任务是否过期（超过 2 小时自动清除）
            const taskAge = Date.now() - new Date(task.startedAt).getTime();
            if (taskAge < 2 * 60 * 60 * 1000) {
              console.log('🔄 检测到进行中的任务，恢复进度面板:', task.taskId);
              setActiveTask(task);

              // 加载用户配置用于进度面板显示
              const { data: profile } = await supabase
                .from('xhs_user_profiles')
                .select('*')
                .eq('supabase_uuid', task.supabaseUuid)
                .single();

              if (profile) {
                setUserProfile(profile);
              }

              setChecking(false);
              return;
            } else {
              // 任务过期，清除
              console.log('⏰ 任务已过期，清除');
              localStorage.removeItem('prome_active_task');
            }
          } catch (e) {
            console.warn('解析任务状态失败:', e);
            localStorage.removeItem('prome_active_task');
          }
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          // 未登录，跳转到配置页面（会显示登录提示）
          navigate('/auto', { replace: true });
          return;
        }

        // 检查用户是否已完成配置
        const { data: profile } = await supabase
          .from('xhs_user_profiles')
          .select('product_name, target_audience, target_platforms')
          .eq('supabase_uuid', session.user.id)
          .single();

        if (profile?.product_name && profile?.target_audience && profile?.target_platforms?.includes('xiaohongshu')) {
          // 已完成配置，跳转到管理页面
          console.log('✅ 用户已配置，跳转到管理页面');
          navigate('/xiaohongshu-manager', { replace: true });
        } else {
          // 未完成配置，跳转到配置向导
          console.log('📝 用户未配置，跳转到配置向导');
          navigate('/auto', { replace: true });
        }
      } catch (error) {
        console.error('检查配置状态失败:', error);
        // 出错时默认跳转到配置页面
        navigate('/auto', { replace: true });
      } finally {
        setChecking(false);
      }
    };

    checkUserConfig();
  }, [navigate]);

  // 🔥 有进行中的任务，显示进度面板
  if (activeTask) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <AgentProgressPanel
          taskId={activeTask.taskId}
          mode={activeTask.mode}
          supabaseUuid={activeTask.supabaseUuid}
          productName={userProfile?.product_name}
          marketingGoal={userProfile?.marketing_goal}
          postFrequency={userProfile?.post_frequency}
          targetPlatforms={userProfile?.target_platforms || ['xiaohongshu']}
          onReconfigure={() => {
            if (confirm('确定要重新配置吗？这将中断当前任务。')) {
              localStorage.removeItem('prome_active_task');
              navigate('/auto');
            }
          }}
          onClose={() => {
            localStorage.removeItem('prome_active_task');
            navigate('/xiaohongshu-manager', { replace: true });
          }}
          onComplete={(result) => {
            console.log('Workflow completed:', result);
            localStorage.removeItem('prome_active_task');
            navigate('/xiaohongshu-manager', { replace: true });
          }}
        />
      </div>
    );
  }

  // 显示加载状态
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <p className="text-gray-600">正在加载...</p>
        </div>
      </div>
    );
  }

  return null;
}
