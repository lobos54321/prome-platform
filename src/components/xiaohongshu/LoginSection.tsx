import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle, LogOut } from 'lucide-react';
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
  justLoggedOut?: boolean; // 🔥 新增
}

export function LoginSection({
  supabaseUuid,
  xhsUserId,
  onLoginSuccess,
  onError,
  onLogout,
  justLoggedOut = false, // 🔥 默认为 false
}: LoginSectionProps) {
  const [checking, setChecking] = useState(!justLoggedOut); // 🔥 如果刚退出，初始不检查
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCookieForm, setShowCookieForm] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [initialVerificationQrCode, setInitialVerificationQrCode] = useState<string | null>(null);
  const [hasInitialVerification, setHasInitialVerification] = useState(false);
  const [logoutProtection, setLogoutProtection] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [countdownTotal, setCountdownTotal] = useState(15);

  useEffect(() => {
    // 🔥 如果刚退出登录，跳过初始检查
    if (justLoggedOut) {
      console.log('🛑 [LoginSection] 刚退出登录，跳过初始检查');
      setChecking(false);
      return;
    }
    checkLoginStatus();
    checkLogoutProtection();
  }, [xhsUserId, justLoggedOut]);

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

  const handleAutoLogin = async () => {
    try {
      console.log('🎯 [LoginSection] handleAutoLogin 被调用，userId:', xhsUserId);
      setChecking(true);

      console.log('📡 [LoginSection] 正在调用 xiaohongshuAPI.autoLogin...');
      const response = await xiaohongshuAPI.autoLogin(xhsUserId);
      console.log('📥 [LoginSection] autoLogin 响应:', response);

      if (response.success && response.qrCode) {
        console.log('✅ [LoginSection] 获取到二维码，长度:', response.qrCode?.length);
        setQrCode(response.qrCode);

        // 检查是否有验证二维码
        if (response.hasVerification && response.verificationQrCode) {
          console.log('🔐 [LoginSection] 检测到需要验证二维码');
          setInitialVerificationQrCode(response.verificationQrCode);
          setHasInitialVerification(true);
        } else {
          console.log('ℹ️ [LoginSection] 无需验证二维码');
          setInitialVerificationQrCode(null);
          setHasInitialVerification(false);
        }

        console.log('🚪 [LoginSection] 打开二维码模态框');
        setShowQRModal(true);
      } else {
        console.error('❌ [LoginSection] autoLogin 返回失败:', response.message);
        onError(response.message || '获取二维码失败');
      }
    } catch (error) {
      console.error('❌ [LoginSection] autoLogin 异常:', error);
      onError(error instanceof Error ? error.message : '自动登录失败');
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
                      onClick={handleAutoLogin}
                      disabled={checking}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      {checking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          处理中...
                        </>
                      ) : (
                        '🚀 一键自动登录'
                      )}
                    </Button>
                    {logoutProtection && (
                      <Button
                        onClick={async () => {
                          try {
                            const r = await xiaohongshuAPI.resetLogoutProtection(xhsUserId);
                            setLogoutProtection(false);
                            setCountdown(countdownTotal);
                          } catch (e) { }
                        }}
                        variant="outline"
                        disabled={checking}
                      >
                        立即解除保护
                      </Button>
                    )}
                    <Button
                      onClick={() => setShowCookieForm(true)}
                      variant="outline"
                      disabled={checking}
                    >
                      🔧 手动导入Cookie
                    </Button>
                  </div>
                  <p className="text-sm text-red-700">
                    提示：推荐使用一键自动登录，更安全便捷
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
