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

// 检测插件是否安装
const isExtensionInstalled = (): boolean => {
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
      const status = await xiaohongshuAPI.checkLoginStatus(xhsUserId);

      if (status.isLoggedIn) {
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
        // ❌ 移除自动导入Cookie的逻辑
        // 退出登录后不应该自动重新登录
        // await tryAutoImport();
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
   * 插件登录：从浏览器已登录的小红书获取Cookie并同步到后端
   */
  const handleExtensionLogin = async () => {
    try {
      console.log('🔌 [LoginSection] 开始插件登录...');
      setChecking(true);

      // 1. 检查插件是否已安装
      const extensionInstalled = !!(window as any).__PROME_EXTENSION_INSTALLED__;
      if (!extensionInstalled) {
        onError('请先安装 Prome Chrome 插件，并在小红书网站登录后再试');
        return;
      }

      // 2. 调用后端的 autoImportCookies 接口（插件会自动注入Cookie）
      console.log('📡 [LoginSection] 调用 autoImportCookies...');
      const response = await xiaohongshuAPI.autoImportCookies(xhsUserId);
      console.log('📥 [LoginSection] autoImportCookies 响应:', response);

      if (response.success) {
        console.log('✅ [LoginSection] Cookie导入成功，检查登录状态');
        await checkLoginStatus();
      } else {
        // 如果Cookie导入失败，提示用户去小红书网站登录
        onError('请先在浏览器中打开 xiaohongshu.com 并登录，然后刷新此页面重试');
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
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <p className="font-medium">❌ 未检测到登录状态</p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handleExtensionLogin}
                      disabled={checking}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      {checking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          同步中...
                        </>
                      ) : (
                        '🔌 使用插件登录'
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-red-700">
                    提示：请确保已安装 Prome 插件，并在浏览器中登录过小红书
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
