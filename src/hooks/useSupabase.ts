import { useEffect, useState } from 'react';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface UseSupabaseReturn {
  supabase: SupabaseClient;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const useSupabase = (): UseSupabaseReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取初始会话
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('获取会话失败:', error);
        } else {
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('会话初始化错误:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('认证状态变化:', event, session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('登出失败:', error);
        throw error;
      }
    } catch (error) {
      console.error('登出过程中发生错误:', error);
      throw error;
    }
  };

  return {
    supabase,
    user,
    loading,
    signOut,
  };
};

// 导出 supabase 客户端实例，供其他地方使用
export { supabase };