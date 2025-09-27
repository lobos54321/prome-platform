import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { authService } from '@/lib/auth';

const AuthCallback = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('处理认证回调...');
        
        // 获取URL中的hash参数
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        console.log('回调参数:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type });

        if (accessToken && refreshToken) {
          // 设置会话
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error('设置会话错误:', error);
            setStatus('error');
            setMessage(error.message || '验证失败');
            return;
          }

          if (data.user) {
            console.log('用户验证成功:', data.user.email);
            
            // 更新认证服务状态
            await authService.initializeAuth();
            
            setStatus('success');
            setMessage('邮箱验证成功！正在跳转...');
            
            // 2秒后跳转到仪表板
            setTimeout(() => {
              navigate('/dashboard');
            }, 2000);
          }
        } else {
          // 尝试从URL参数获取
          const urlParams = new URLSearchParams(window.location.search);
          const token = urlParams.get('token');
          const type_param = urlParams.get('type');

          if (token && type_param) {
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: 'email'
            });

            if (error) {
              console.error('OTP验证错误:', error);
              setStatus('error');
              setMessage(error.message || '验证失败');
            } else if (data.user) {
              setStatus('success');
              setMessage('邮箱验证成功！正在跳转...');
              setTimeout(() => {
                navigate('/dashboard');
              }, 2000);
            }
          } else {
            console.log('没有找到验证参数，可能已经登录或验证失败');
            setStatus('error');
            setMessage('验证链接无效或已过期');
          }
        }
      } catch (error) {
        console.error('认证回调处理错误:', error);
        setStatus('error');
        setMessage('验证过程中发生错误');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">正在验证邮箱</h2>
              <p className="text-gray-600">请稍候...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="rounded-full h-12 w-12 bg-green-100 mx-auto mb-4 flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">验证成功</h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <div className="text-sm text-gray-500">2秒后自动跳转到仪表板...</div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="rounded-full h-12 w-12 bg-red-100 mx-auto mb-4 flex items-center justify-center">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">验证失败</h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/register')}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  返回注册页面
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  去登录页面
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;