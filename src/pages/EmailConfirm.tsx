import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

const EmailConfirm = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        // 获取URL中的token和type参数
        const token = searchParams.get('token');
        const type = searchParams.get('type');

        if (!token || !type) {
          setStatus('error');
          setMessage('缺少验证参数');
          return;
        }

        // 处理邮件确认
        if (type === 'signup') {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'email'
          });

          if (error) {
            console.error('Email confirmation error:', error);
            setStatus('error');
            setMessage(error.message || '邮件验证失败');
          } else if (data.user) {
            setStatus('success');
            setMessage('邮件验证成功！正在跳转...');
            
            // 3秒后跳转到仪表板
            setTimeout(() => {
              navigate('/dashboard');
            }, 3000);
          }
        } else {
          // 处理其他类型的确认
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as any
          });

          if (error) {
            setStatus('error');
            setMessage(error.message || '验证失败');
          } else {
            setStatus('success');
            setMessage('验证成功！');
            setTimeout(() => {
              navigate('/dashboard');
            }, 3000);
          }
        }
      } catch (error) {
        console.error('Confirmation error:', error);
        setStatus('error');
        setMessage('验证过程中发生错误');
      }
    };

    confirmEmail();
  }, [searchParams, navigate]);

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
              <div className="text-sm text-gray-500">3秒后自动跳转到仪表板...</div>
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
              <button
                onClick={() => navigate('/register')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                返回注册页面
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailConfirm;