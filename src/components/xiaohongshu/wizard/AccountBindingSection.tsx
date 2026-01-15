import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Chrome, Download, CheckCircle, ExternalLink, RefreshCw, LogOut, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { useXiaohongshuStore } from '@/stores/xiaohongshu-store';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';
import { xiaohongshuSupabase } from '@/lib/xiaohongshu-supabase';

// Detection helpers
const isChromeBrowser = (): boolean => {
  const userAgent = navigator.userAgent;
  return /Chrome/.test(userAgent) && !/Edge|Edg|OPR|Opera/.test(userAgent);
};

const isExtensionInstalled = (): boolean => {
  const marker = document.getElementById('prome-extension-installed');
  if (marker) return true;
  return !!(window as any).__PROME_EXTENSION_INSTALLED__;
};

const CHROME_DOWNLOAD_URL = 'https://www.google.com/chrome/';

interface AccountBindingSectionProps {
  onNext: () => void;
  onPrev: () => void;
}

export function AccountBindingSection({ onNext, onPrev }: AccountBindingSectionProps) {
  const { identity, actions } = useXiaohongshuStore();
  const { xhsUserId, supabaseUuid } = identity;

  // Local state
  const [setupStep, setSetupStep] = useState<'checking' | 'need-chrome' | 'need-extension' | 'ready'>('checking');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  // Logout protection state
  const [logoutProtection, setLogoutProtection] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [countdownTotal, setCountdownTotal] = useState(15);

  // Concurrency lock
  const bindingInFlight = useRef(false);

  // 1. Environment Detection
  useEffect(() => {
    const detectEnvironment = () => {
      const chromeDetected = isChromeBrowser();
      const extensionDetected = isExtensionInstalled();

      if (!chromeDetected) {
        setSetupStep('need-chrome');
        setChecking(false);
      } else if (!extensionDetected) {
        setSetupStep('need-extension');
        setChecking(false);
      } else {
        setSetupStep('ready');
      }
    };

    detectEnvironment();

    // Polling for extension installation
    const interval = setInterval(() => {
      if (isExtensionInstalled() && setupStep !== 'ready' && isChromeBrowser()) {
        setSetupStep('ready');
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [setupStep]);

  // 2. Check Login Status when Ready
  useEffect(() => {
    if (setupStep === 'ready' && xhsUserId) {
      checkLoginStatus();
      checkLogoutProtection();
    }
  }, [setupStep, xhsUserId]);

  // 3. Logout Protection Timer
  useEffect(() => {
    if (!logoutProtection) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setLogoutProtection(false);
          clearInterval(interval);
          return countdownTotal;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [logoutProtection]);

  const checkLogoutProtection = async () => {
    if (!xhsUserId) return;
    try {
      const response = await xiaohongshuAPI.checkLogoutStatus(xhsUserId);
      if (response.data?.inProtection) {
        setLogoutProtection(true);
        const sec = response.data.remainingSeconds || 15;
        setCountdown(sec);
        setCountdownTotal(sec);
      }
    } catch (error) {
      console.error('Check logout protection error:', error);
    }
  };

  const checkLoginStatus = async () => {
    if (!xhsUserId) return;

    try {
      setChecking(true);
      const workerUrl = ((import.meta as any).env?.VITE_XHS_WORKER_URL || 'https://xiaohongshu-worker.zeabur.app').replace(/\/$/, '');

      const response = await fetch(`${workerUrl}/api/v1/login/check-web/${encodeURIComponent(xhsUserId)}`);
      const status = await response.json();

      if (status.status === 'logged_in' || status.is_logged_in) {
        // Logged in
        setIsLoggedIn(true);

        // Try to sync latest cookies if extension is available (background sync)
        syncCookiesBackground(workerUrl);
      } else {
        setIsLoggedIn(false);
      }
    } catch (err) {
      console.error('Check login failed:', err);
    } finally {
      setChecking(false);
    }
  };

  const syncCookiesBackground = async (workerUrl: string) => {
    if (!isExtensionInstalled()) return;

    try {
      // Ask extension for cookies
      const cookieData = await new Promise<{ success: boolean; data?: { cookies: any[] } }>((resolve) => {
        const timeout = setTimeout(() => resolve({ success: false }), 3000);
        const handler = (event: MessageEvent) => {
          if (event.data?.type === 'SYNC_XHS_RESPONSE') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            resolve(event.data);
          }
        };
        window.addEventListener('message', handler);
        window.postMessage({ type: 'SYNC_XHS_REQUEST' }, '*');
      });

      if (cookieData.success && cookieData.data?.cookies) {
        // Sync to worker
        await fetch(`${workerUrl}/api/v1/login/sync-web`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: xhsUserId,
            cookies: cookieData.data.cookies,
            ua: navigator.userAgent
          })
        });
        console.log('Background cookie sync successful');
      }
    } catch (err) {
      // Ignore background sync errors
      console.warn('Background sync failed:', err);
    }
  };

  const handleExtensionSync = async () => {
    if (!xhsUserId || !supabaseUuid) {
      setError('系统错误：用户信息缺失');
      return;
    }

    try {
      setError('');
      setChecking(true);

      if (!isExtensionInstalled()) {
        setError('请先安装插件');
        return;
      }

      // 1. Get cookies from extension
      const result = await new Promise<{ success: boolean; data?: { cookies: any[] }; msg?: string }>((resolve) => {
        const timeout = setTimeout(() => resolve({ success: false, msg: '扩展响应超时，请刷新页面重试' }), 10000);
        const handler = (event: MessageEvent) => {
          if (event.data?.type === 'SYNC_XHS_RESPONSE') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            resolve(event.data);
          }
        };
        window.addEventListener('message', handler);
        window.postMessage({ type: 'SYNC_XHS_REQUEST' }, '*');
      });

      if (!result.success || !result.data?.cookies?.length) {
        setError('未获取到登录信息，请确保已在小红书创作者后台登录');
        return;
      }

      // 2. Sync to Worker
      const workerUrl = ((import.meta as any).env?.VITE_XHS_WORKER_URL || 'https://xiaohongshu-worker.zeabur.app').replace(/\/$/, '');
      const workerSecret = (import.meta as any).env?.VITE_WORKER_SECRET;

      const saveResponse = await fetch(`${workerUrl}/api/v1/login/sync-web`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(workerSecret ? { 'Authorization': `Bearer ${workerSecret}` } : {})
        },
        body: JSON.stringify({
          user_id: xhsUserId,
          cookies: result.data.cookies,
          ua: navigator.userAgent
        })
      });

      if (!saveResponse.ok) {
        throw new Error('保存登录信息失败');
      }

      // 3. Bind Account (Idempotent)
      if (!bindingInFlight.current) {
        bindingInFlight.current = true;
        try {
          // 使用环境变量获取后端URL
          const backendUrl = ((import.meta as any).env?.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app').replace(/\/$/, '');

          // Check existing
          const listRes = await fetch(`${backendUrl}/agent/accounts/list?supabaseUuid=${encodeURIComponent(supabaseUuid)}`);
          const listData = await listRes.json();

          if (!listData.success || !listData.data?.accounts?.length) {
             // Bind if not exists
             await fetch(`${backendUrl}/agent/accounts/bind`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                 supabaseUuid,
                 cookies: result.data.cookies,
                 isDefault: true,
                 accountInfo: {}
               })
             });
          }
        } finally {
          bindingInFlight.current = false;
        }
      }

      setIsLoggedIn(true);
      await actions.refresh(); // Refresh store data (might get account info)

    } catch (err) {
      console.error('Sync failed:', err);
      setError(err instanceof Error ? err.message : '同步失败');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    if (!xhsUserId || !confirm('确定要退出登录吗？这将清除所有保存的登录信息。')) return;

    try {
      setChecking(true);

      // 1. Force logout backend
      await xiaohongshuAPI.forceLogout(xhsUserId);

      // 2. Clear Supabase data
      if (supabaseUuid) {
        await xiaohongshuSupabase.clearUserData(supabaseUuid);
      }

      // 3. Local cleanup
      setIsLoggedIn(false);
      setLogoutProtection(true);
      setCountdown(15);
      setCountdownTotal(15);

      // Clear store status
      actions.reset();
      // Re-init with IDs but empty data
      if (supabaseUuid && xhsUserId) {
        actions.initialize(supabaseUuid, xhsUserId);
      }

    } catch (err) {
      console.error('Logout failed:', err);
      setError('退出登录失败');
    } finally {
      setChecking(false);
    }
  };

  // Render Helpers
  if (setupStep === 'need-chrome') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
           <h2 className="text-2xl font-bold text-gray-900">需要 Chrome 浏览器</h2>
           <p className="text-gray-500 mt-2">Prome 自动化需要 Chrome 浏览器环境</p>
        </div>
        <Card className="border-orange-200">
           <CardContent className="pt-6 text-center space-y-4">
             <Chrome className="w-16 h-16 text-orange-500 mx-auto" />
             <p className="text-lg font-medium">请使用 Chrome 浏览器访问此页面</p>
             <Button onClick={() => window.open(CHROME_DOWNLOAD_URL, '_blank')}>
               <Download className="mr-2 h-4 w-4" /> 下载 Chrome
             </Button>
           </CardContent>
        </Card>
      </div>
    );
  }

  if (setupStep === 'need-extension') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
           <h2 className="text-2xl font-bold text-gray-900">安装浏览器插件</h2>
           <p className="text-gray-500 mt-2">需要安装 Prome 助手插件来同步登录状态</p>
        </div>
        <Card className="border-purple-200">
           <CardContent className="pt-6 text-center space-y-6">
             <div className="flex justify-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                  <Download className="w-8 h-8 text-purple-600" />
                </div>
             </div>
             <div>
               <h3 className="text-lg font-medium mb-2">一键安装插件</h3>
               <p className="text-gray-500 max-w-md mx-auto">
                 下载插件压缩包，解压后在 Chrome 扩展管理页面(chrome://extensions)开启开发者模式并加载。
               </p>
             </div>

             <div className="flex flex-col items-center gap-4">
               <Button
                  size="lg"
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = '/prome-extension.zip';
                    link.download = 'prome-extension.zip';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
               >
                 <Download className="mr-2 h-5 w-5" />
                 下载插件 ZIP
               </Button>

               <div className="flex gap-4 text-sm text-gray-500">
                 <button className="hover:text-purple-600 underline" onClick={() => window.location.reload()}>
                    已安装？刷新页面
                 </button>
                 <button className="hover:text-purple-600 underline" onClick={() => setSetupStep('ready')}>
                    跳过检测 (仅调试)
                 </button>
               </div>
             </div>
           </CardContent>
        </Card>
        <div className="flex justify-start">
            <Button variant="ghost" onClick={onPrev}>
                <ArrowLeft className="mr-2 h-4 w-4" /> 上一步
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">绑定小红书账号</h2>
        <p className="text-gray-500 mt-2">
          {isLoggedIn ? '账号已成功绑定，可以开始运营' : '请登录并同步您的小红书账号'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isLoggedIn ? (
               <CheckCircle className="w-6 h-6 text-green-500" />
            ) : (
               <RefreshCw className={`w-6 h-6 text-blue-500 ${checking ? 'animate-spin' : ''}`} />
            )}
            {isLoggedIn ? '已连接' : '账号连接'}
          </CardTitle>
          <CardDescription>
            {isLoggedIn
              ? '您已成功登录，系统将自动使用此账号发布内容'
              : '请在新的标签页中登录小红书创作者中心，然后点击同步按钮'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {logoutProtection && (
             <Alert className="bg-orange-50 border-orange-200">
               <AlertDescription>
                 <span className="font-bold">正在清理旧数据... {countdown}s</span>
               </AlertDescription>
             </Alert>
          )}

          {!isLoggedIn ? (
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center py-8">
               <Button
                 size="lg"
                 className="w-full md:w-auto bg-red-500 hover:bg-red-600"
                 onClick={() => window.open('https://creator.xiaohongshu.com/', '_blank')}
               >
                 <ExternalLink className="mr-2 h-5 w-5" />
                 1. 打开小红书后台登录
               </Button>

               <Button
                 size="lg"
                 variant="outline"
                 className="w-full md:w-auto border-blue-500 text-blue-600 hover:bg-blue-50"
                 onClick={handleExtensionSync}
                 disabled={checking || logoutProtection}
               >
                 {checking ? (
                   <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                 ) : (
                   <RefreshCw className="mr-2 h-5 w-5" />
                 )}
                 2. 同步登录状态
               </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 space-y-4">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 px-6 py-3 rounded-full">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">账号状态正常</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={handleLogout}
                disabled={checking}
              >
                <LogOut className="mr-2 h-4 w-4" />
                解除绑定 / 退出登录
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between pt-6 border-t">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 上一步
        </Button>
        <Button
          onClick={onNext}
          disabled={!isLoggedIn || checking}
          className="bg-blue-600 hover:bg-blue-700"
        >
          下一步：运营偏好
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
