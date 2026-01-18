/**
 * XiaohongshuAutomation - 智能路由
 *
 * 根据用户配置状态决定跳转目标：
 * - 已配置完成 → /xiaohongshu-manager (运营管理)
 * - 未配置 → /auto (配置向导)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function XiaohongshuAutomation() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkUserConfig = async () => {
      try {
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
