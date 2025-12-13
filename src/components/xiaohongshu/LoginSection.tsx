import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle, LogOut, Chrome, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { AutoLoginModal } from './AutoLoginModal';
import { ManualCookieForm } from './ManualCookieForm';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';
import { xiaohongshuSupabase } from '@/lib/xiaohongshu-supabase';

interface LoginSectionProps {
  supabaseUuid: string;
  xhsUserId: string;
  onLoginSuccess: () => void;
  onError: (error: string) => void;
  onLogout?: () => void;
  justLoggedOut?: boolean;
}

// 检测是否为 Chrome 浏览器
const isChromeBrowser = (): boolean => {
  const userAgent = navigator.userAgent;
  return /Chrome/.test(userAgent) && !/Edge|Edg|OPR|Opera/.test(userAgent);
};

// 检测插件是否安装（bridge.js 会注入 #prome-extension-installed 元素）
const isExtensionInstalled = (): boolean => {
  // 方法1：检查 DOM 元素（bridge.js 注入的标识）
  const marker = document.getElementById('prome-extension-installed');
  if (marker) return true;

  // 方法2：兼容旧版（检查全局变量）
  return !!(window as any).__PROME_EXTENSION_INSTALLED__;
};

// 插件下载链接
const EXTENSION_DOWNLOAD_URL = 'https://github.com/lobos54321/prome-extension/releases/latest';
const CHROME_DOWNLOAD_URL = 'https://www.google.com/chrome/';

export function LoginSection({
  supabaseUuid,
  xhsUserId,
  onLoginSuccess,
  onError,
  onLogout,
  justLoggedOut = false,
}: LoginSectionProps) {
  const [checking, setChecking] = useState(!justLoggedOut);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCookieForm, setShowCookieForm] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [initialVerificationQrCode, setInitialVerificationQrCode] = useState<string | null>(null);
  const [hasInitialVerification, setHasInitialVerification] = useState(false);
  const [logoutProtection, setLogoutProtection] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [countdownTotal, setCountdownTotal] = useState(15);

  // 🔥 浏览器和插件检测状态
  const [isChrome, setIsChrome] = useState(true);
  const [hasExtension, setHasExtension] = useState(false);
  const [setupStep, setSetupStep] = useState<'checking' | 'need-chrome' | 'need-extension' | 'need-xhs-login' | 'ready'>('checking');

  // 检测浏览器和插件
  useEffect(() => {
    const detectEnvironment = () => {
      const chromeDetected = isChromeBrowser();
      const extensionDetected = isExtensionInstalled();

      console.log('🔍 [LoginSection] 环境检测:', { chromeDetected, extensionDetected });

      setIsChrome(chromeDetected);
      setHasExtension(extensionDetected);

      if (!chromeDetected) {
        setSetupStep('need-chrome');
      } else if (!extensionDetected) {
        setSetupStep('need-extension');
      } else {
        setSetupStep('ready');
      }
    };

    detectEnvironment();

    // 定期检测插件（用户可能在后台安装）
    const interval = setInterval(() => {
      if (isExtensionInstalled() && !hasExtension) {
        setHasExtension(true);
        setSetupStep('ready');
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [hasExtension]);

  useEffect(() => {
    // 🔥 如果刚退出登录，跳过初始检查
    if (justLoggedOut) {
      console.log('🛑 [LoginSection] 刚退出登录，跳过初始检查');
      setChecking(false);
      return;
    }

    // 只有环境就绪且有插件时才检查登录状态
    if (setupStep === 'ready') {
      checkLoginStatus();
      checkLogoutProtection();
    }
  }, [xhsUserId, justLoggedOut, setupStep]);

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

  const checkLoginStatus = async () => {
    try {
      setChecking(true);

      // 按架构设计：auth/login 由 xhs-worker 负责
      const workerUrl = ((import.meta as any).env?.VITE_XHS_WORKER_URL || 'https://xiaohongshu-worker.zeabur.app').replace(/\/$/, '');

      // 从 xhs-worker 检查登录状态（检查已保存的 Cookie）
      const workerResponse = await fetch(`${workerUrl}/api/v1/login/check-web/${encodeURIComponent(xhsUserId)}`);
      const workerStatus = await workerResponse.json();

      console.log('🔍 [LoginSection] xhs-worker 登录状态:', workerStatus);

      if (workerStatus.status === 'logged_in' || workerStatus.is_logged_in) {
        // 🔥 关键修复：即使 Worker 显示已登录，也要同步最新的 Cookie
        // 因为浏览器的 Cookie 可能比 Worker 保存的更新（例如 web_session）
        console.log('🔄 [LoginSection] Worker 显示已登录，同步最新 Cookie...');

        if (isExtensionInstalled()) {
          try {
            // 请求扩展获取最新 Cookie
            const cookiePromise = new Promise<{ success: boolean; data?: { cookies: any[]; ua: string }; msg?: string }>((resolve) => {
              const timeout = setTimeout(() => {
                resolve({ success: false, msg: '扩展响应超时' });
              }, 5000);

              const handler = (event: MessageEvent) => {
                if (event.source !== window) return;
                if (event.data?.type === 'SYNC_XHS_RESPONSE') {
                  clearTimeout(timeout);
                  window.removeEventListener('message', handler);
                  resolve(event.data);
                }
              };
              window.addEventListener('message', handler);
              window.postMessage({ type: 'SYNC_XHS_REQUEST' }, '*');
            });

            const result = await cookiePromise;

            if (result.success && result.data?.cookies?.length) {
              console.log('✅ [LoginSection] 获取到最新 Cookie:', result.data.cookies.length, '个');

              // 检查是否有 web_session
              const hasWebSession = result.data.cookies.some((c: any) => c.name === 'web_session');
              console.log('🔍 [LoginSection] 是否有 web_session:', hasWebSession);

              // 同步到 Worker
              await fetch(`${workerUrl}/api/v1/login/sync-web`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_id: xhsUserId,
                  cookies: result.data.cookies,
                  ua: navigator.userAgent
                })
              });
              console.log('✅ [LoginSection] Cookie 已同步到 Worker');
            }
          } catch (syncError) {
            console.warn('⚠️ [LoginSection] Cookie 同步失败，继续使用 Worker 现有数据:', syncError);
          }
        }

        setIsLoggedIn(true);
        await xiaohongshuSupabase.addActivityLog({
          supabase_uuid: supabaseUuid,
          xhs_user_id: xhsUserId,
          activity_type: 'login',
          message: '登录状态检查成功',
          metadata: {},
        });
        onLoginSuccess();
      } else {
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Check login error:', error);
      onError(error instanceof Error ? error.message : '登录检查失败');
    } finally {
      setChecking(false);
    }
  };

  const checkLogoutProtection = async () => {
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

  const tryAutoImport = async () => {
    try {
      const response = await xiaohongshuAPI.autoImportCookies(xhsUserId);
      if (response.success) {
        await checkLoginStatus();
      }
    } catch (error) {
      console.error('Auto import cookies error:', error);
    }
  };

  /**
   * 插件登录：从浏览器扩展获取Cookie并同步到后端
   */
  const handleExtensionLogin = async () => {
    try {
      console.log('🔌 [LoginSection] 开始插件登录...');
      setChecking(true);

      // 1. 检查插件是否已安装（使用统一的检测方法）
      if (!isExtensionInstalled()) {
        onError('请先安装 Prome Chrome 插件，并在小红书网站登录后再试');
        return;
      }

      // 2. 通过 postMessage 向扩展请求 Cookie
      console.log('📡 [LoginSection] 向扩展请求Cookie...');

      const cookiePromise = new Promise<{ success: boolean; data?: { cookies: any[]; ua: string }; msg?: string }>((resolve) => {
        // 设置超时
        const timeout = setTimeout(() => {
          resolve({ success: false, msg: '扩展响应超时，请刷新页面重试' });
        }, 10000);

        // 监听扩展响应
        const handler = (event: MessageEvent) => {
          if (event.source !== window) return;
          if (event.data?.type === 'SYNC_XHS_RESPONSE') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            console.log('📥 [LoginSection] 收到扩展响应:', event.data);
            resolve(event.data);
          }
        };
        window.addEventListener('message', handler);

        // 发送请求给扩展
        window.postMessage({ type: 'SYNC_XHS_REQUEST' }, '*');
      });

      const result = await cookiePromise;

      if (!result.success || !result.data?.cookies?.length) {
        console.log('❌ [LoginSection] 未获取到Cookie:', result);
        onError('请先在浏览器中打开 creator.xiaohongshu.com 并登录，然后点击同步');
        return;
      }

      console.log('✅ [LoginSection] 获取到Cookie:', result.data.cookies.length, '个');

      // 3. 将 Cookie 发送到 xhs-worker 后端保存（按架构设计：auth 归 xhs-worker 负责）
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

      const saveResult = await saveResponse.json();
      console.log('📥 [LoginSection] 保存Cookie响应:', saveResult);

      if (saveResult.success || saveResponse.ok) {
        console.log('✅ [LoginSection] Cookie保存成功');

        // 🔥 关键修复：绑定账号到用户（带幂等检查）
        const BACKEND_URL = (import.meta as any).env?.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app';

        try {
          // 1) 幂等检查：如果已有绑定账号，跳过 bind
          console.log('🔍 [LoginSection] 检查是否已有绑定账号...');
          const listResponse = await fetch(`${BACKEND_URL}/agent/accounts/list?supabaseUuid=${encodeURIComponent(supabaseUuid)}`);
          const listData = await listResponse.json().catch(() => null);

          if (listData?.success && Array.isArray(listData?.data?.accounts) && listData.data.accounts.length > 0) {
            console.log('ℹ️ [LoginSection] 已存在绑定账号，跳过 bind:', listData.data.accounts.length, '个');
            // 账号已存在，直接继续
          } else {
            // 2) 执行 bind
            console.log('🔗 [LoginSection] 绑定账号到用户...');
            const bindResponse = await fetch(`${BACKEND_URL}/agent/accounts/bind`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                supabaseUuid: supabaseUuid,
                cookies: result.data.cookies,
                isDefault: true,
                accountInfo: {}
              })
            });

            const bindText = await bindResponse.text();
            let bindResult: any = null;
            try { bindResult = JSON.parse(bindText); } catch { /* ignore */ }

            console.log('📥 [LoginSection] 绑定账号响应:', bindResult || bindText);

            if (!bindResponse.ok || !bindResult?.success) {
              const errorMsg = bindResult?.error || bindResult?.detail || `账号绑定失败 (HTTP ${bindResponse.status})`;
              console.error('❌ [LoginSection] 账号绑定失败:', errorMsg);
              // 🔥 显示错误给用户，而不是静默继续
              onError(`Cookie 已同步，但账号绑定失败: ${errorMsg}`);
              return;
            }

            console.log('✅ [LoginSection] 账号绑定成功');
          }
        } catch (bindError) {
          console.error('❌ [LoginSection] 账号绑定请求异常:', bindError);
          // 网络错误等也要提示用户
          onError(`账号绑定请求失败: ${bindError instanceof Error ? bindError.message : String(bindError)}`);
          return;
        }

        await checkLoginStatus();
      } else {
        onError(saveResult.error || saveResult.detail || '保存Cookie失败');
      }
    } catch (error) {
      console.error('❌ [LoginSection] 插件登录失败:', error);
      onError('登录失败，请确保已在浏览器中登录小红书');
    } finally {
      setChecking(false);
    }
  };

  const handleQRLoginSuccess = async () => {
    setShowQRModal(false);
    await checkLoginStatus();
  };

  const handleManualCookieSuccess = async () => {
    setShowCookieForm(false);
    await checkLoginStatus();
  };

  const handleLogout = async () => {
    if (!confirm('确定要退出登录吗？这将清除所有保存的登录信息。')) {
      return;
    }

    try {
      console.log('🧹 [Logout] 开始强制清除所有Cookie和状态...');

      // 🔥 1. 调用后端强制清除所有Cookie
      const backendAPI = new (await import('@/lib/xiaohongshu-backend-api')).XiaohongshuBackendAPI();
      const forceLogoutResult = await backendAPI.forceLogout(xhsUserId);

      if (forceLogoutResult.success) {
        console.log('✅ [Logout] 后端强制清除成功');
      } else {
        console.warn('⚠️ [Logout] 后端强制清除失败，但继续前端清理');
      }

      // 🔥 2. 清除 Supabase 数据（Strategy, Plan, Status）
      console.log('🧹 [Logout] 清除 Supabase 数据...');
      try {
        await xiaohongshuSupabase.clearUserData(supabaseUuid);
        console.log('✅ [Logout] Supabase 数据清除成功');
      } catch (supabaseError) {
        console.warn('⚠️ [Logout] Supabase 数据清除失败:', supabaseError);
      }

      // 🔥 3. 记录退出日志
      await xiaohongshuSupabase.addActivityLog({
        supabase_uuid: supabaseUuid,
        xhs_user_id: xhsUserId,
        activity_type: 'login',
        message: '用户退出登录（强制清除）',
        metadata: { forceCleanup: true },
      });

      // 🔥 4. 清除前端状态
      setIsLoggedIn(false);
      setLogoutProtection(true);
      setCountdown(15);
      setCountdownTotal(15);

      // 🔥 5. 清除 localStorage 中的小红书相关数据
      console.log('🧹 [Logout] 清除 localStorage...');
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('xhs') || key.includes('xiaohongshu'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ [Logout] 移除 localStorage: ${key}`);
      });

      console.log('✅ [Logout] 退出登录完成，60秒保护期开始');
      console.log('⏰ [Logout] 60秒后可以重新登录');

      // 🔥 6. 通知父组件刷新页面
      if (onLogout) {
        onLogout();
      } else {
        // 如果没有提供回调，直接刷新页面
        window.location.reload();
      }

    } catch (error) {
      console.error('❌ [Logout] 退出登录失败:', error);
      onError('退出登录失败');
    }
  };

  // 🔥 设置向导 - 需要 Chrome
  if (setupStep === 'need-chrome') {
    return (
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Chrome className="h-6 w-6 text-orange-500" />
            需要 Chrome 浏览器
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-orange-50 border-orange-200">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <p className="font-medium mb-2">Prome 自动化需要 Chrome 浏览器和 Prome 插件才能运行</p>
              <p className="text-sm">请先下载并安装 Google Chrome 浏览器，然后在 Chrome 中打开此页面。</p>
            </AlertDescription>
          </Alert>
          <div className="flex gap-3">
            <Button
              onClick={() => window.open(CHROME_DOWNLOAD_URL, '_blank')}
              className="bg-gradient-to-r from-blue-500 to-blue-600"
            >
              <Download className="mr-2 h-4 w-4" />
              下载 Chrome 浏览器
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 🔥 设置向导 - 需要插件 (极简版)
  if (setupStep === 'need-extension') {
    return (
      <Card className="border-purple-200">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Download className="h-6 w-6 text-purple-500" />
            一键安装 Prome 插件
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ✅ Chrome 浏览器已就绪
            </AlertDescription>
          </Alert>

          <p className="text-gray-600">
            点击下方按钮安装 Prome 插件，安装后页面将自动刷新。
          </p>

          <Button
            onClick={() => {
              // 直接下载 ZIP 文件
              const downloadLink = document.createElement('a');
              downloadLink.href = '/prome-extension.zip';
              downloadLink.download = 'prome-extension.zip';
              document.body.appendChild(downloadLink);
              downloadLink.click();
              document.body.removeChild(downloadLink);

              // 显示简单的安装说明
              setTimeout(() => {
                alert(`✅ 下载已开始！

安装步骤：
1. 解压下载的 ZIP 文件
2. 打开 chrome://extensions
3. 打开右上角"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择解压后的文件夹

完成后刷新此页面即可！`);
              }, 500);
            }}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 h-12 text-lg"
          >
            <Download className="mr-2 h-5 w-5" />
            立即安装插件
          </Button>

          <div className="flex gap-2 justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              已安装？刷新检测
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-600"
              onClick={() => {
                setHasExtension(true);
                setSetupStep('ready');
              }}
            >
              已安装但检测失败？跳过
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (checking && !logoutProtection) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <span className="ml-3 text-gray-600">正在检查登录状态...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              📱 登录状态检查
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {logoutProtection ? (
            <Alert className="bg-orange-50 border-orange-200">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <div className="space-y-2">
                  <p className="font-medium">⏳ 系统正在清理中</p>
                  <p className="text-sm">
                    刚刚执行了退出登录，系统正在完全清理所有数据，为确保安全需要等待片刻
                  </p>
                  <div className="mt-2 text-sm font-bold">
                    剩余等待时间：{countdown} 秒
                  </div>
                  <div className="w-full bg-orange-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${(countdown / countdownTotal) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ) : isLoggedIn ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-800 font-medium mb-1">
                      ✅ 已成功登录小红书
                    </p>
                    <p className="text-green-700 text-sm">
                      可以继续配置产品信息开始运营
                    </p>
                  </div>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    退出登录
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                <div className="space-y-3">
                  <p className="font-medium text-blue-800">🔐 请先登录小红书</p>
                  <p className="text-sm text-blue-700">
                    点击下方按钮打开小红书创作者后台，登录后回到此页面点击"同步登录状态"
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => {
                        window.open('https://creator.xiaohongshu.com/', '_blank');
                      }}
                      className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      打开小红书后台登录
                    </Button>
                    <Button
                      onClick={handleExtensionLogin}
                      disabled={checking}
                      variant="outline"
                      className="border-purple-300 text-purple-600 hover:bg-purple-50"
                    >
                      {checking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          同步中...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          同步登录状态
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-blue-600">
                    ✅ 插件已检测到 | 登录后点击"同步登录状态"即可自动完成
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <AutoLoginModal
        isOpen={showQRModal}
        qrCode={qrCode}
        xhsUserId={xhsUserId}
        onLoginSuccess={handleQRLoginSuccess}
        onClose={() => setShowQRModal(false)}
        initialVerificationQrCode={initialVerificationQrCode}
        hasInitialVerification={hasInitialVerification}
      />

      <ManualCookieForm
        isOpen={showCookieForm}
        xhsUserId={xhsUserId}
        onSubmitSuccess={handleManualCookieSuccess}
        onCancel={() => setShowCookieForm(false)}
      />
    </>
  );
}
