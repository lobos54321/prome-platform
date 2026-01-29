/**
 * XManager - X/Twitter 平台管理页面
 *
 * 根据用户配置状态和任务状态决定显示内容：
 * - 有进行中的任务 → 显示 AgentProgressPanel
 * - 已配置完成 → 显示管理界面
 * - 未配置 → /auto (配置向导)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Twitter, Construction, Rocket, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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

export default function XManager() {
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
            // 检查任务是否属于 X 平台且未过期（超过 2 小时自动清除）
            if (task.platform === 'x') {
              const taskAge = Date.now() - new Date(task.startedAt).getTime();
              if (taskAge < 2 * 60 * 60 * 1000) {
                console.log('🔄 检测到进行中的 X 任务，恢复进度面板:', task.taskId);
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
                console.log('⏰ X 任务已过期，清除');
                localStorage.removeItem('prome_active_task');
              }
            }
          } catch (e) {
            console.warn('解析任务状态失败:', e);
            localStorage.removeItem('prome_active_task');
          }
        }

        // 没有进行中的任务，显示默认界面
        setChecking(false);
      } catch (error) {
        console.error('检查配置状态失败:', error);
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
          targetPlatforms={['x']}
          onReconfigure={() => {
            if (confirm('确定要重新配置吗？这将中断当前任务。')) {
              localStorage.removeItem('prome_active_task');
              navigate('/auto');
            }
          }}
          onClose={() => {
            localStorage.removeItem('prome_active_task');
            setActiveTask(null);
          }}
          onComplete={(result) => {
            console.log('X Workflow completed:', result);
            localStorage.removeItem('prome_active_task');
            setActiveTask(null);
          }}
        />
      </div>
    );
  }

  // 显示加载状态
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          <p className="text-gray-600">正在加载...</p>
        </div>
      </div>
    );
  }

  // 默认显示管理界面（目前是"即将推出"占位符）
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/auto')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-black rounded-lg">
            <Twitter className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">X / Twitter 管理</h1>
            <p className="text-gray-500 text-sm">管理您的 X 平台内容发布</p>
          </div>
        </div>
      </div>

      <Card className="border-2 border-dashed border-gray-300">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full">
              <Construction className="h-12 w-12 text-gray-600" />
            </div>
          </div>
          <CardTitle className="text-xl">功能开发中</CardTitle>
          <Badge variant="secondary" className="mt-2">
            <Rocket className="h-3 w-3 mr-1" />
            即将推出
          </Badge>
        </CardHeader>
        <CardContent className="text-center space-y-4 pb-8">
          <p className="text-gray-600 max-w-md mx-auto">
            X/Twitter 平台的完整管理功能正在开发中。目前您可以通过自动运营功能创建和发布内容。
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <Button
              onClick={() => navigate('/auto')}
              className="bg-black hover:bg-gray-800"
            >
              <Twitter className="h-4 w-4 mr-2" />
              返回自动运营
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              查看仪表盘
            </Button>
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">即将支持的功能</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 推文自动发布与定时</li>
              <li>• 内容日历管理</li>
              <li>• 互动数据分析</li>
              <li>• AI 智能回复建议</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
