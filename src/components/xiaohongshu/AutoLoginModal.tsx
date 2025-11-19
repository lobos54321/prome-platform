import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';
import { Loader2, AlertTriangle } from 'lucide-react';

interface AutoLoginModalProps {
  isOpen: boolean;
  qrCode: string | null;
  xhsUserId: string;
  onLoginSuccess: () => void;
  onClose: () => void;
  initialVerificationQrCode?: string | null;
  hasInitialVerification?: boolean;
}

type LoginStage = 'qrcode' | 'verification' | 'success';

export function AutoLoginModal({
  isOpen,
  qrCode,
  xhsUserId,
  onLoginSuccess,
  onClose,
  initialVerificationQrCode,
  hasInitialVerification,
}: AutoLoginModalProps) {
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState('请使用小红书App扫描二维码');
  const [timeoutSeconds, setTimeoutSeconds] = useState(120);

  // 验证二维码状态
  const [loginStage, setLoginStage] = useState<LoginStage>('qrcode');
  const [verificationQRCode, setVerificationQRCode] = useState<string | null>(null);
  const [verificationExpiresIn, setVerificationExpiresIn] = useState(60);

  // 当前显示的登录二维码（可能会在验证后更新）
  const [currentLoginQRCode, setCurrentLoginQRCode] = useState<string | null>(null);

  // 重新获取登录二维码（验证成功后调用）
  const fetchLoginQRCode = useCallback(async () => {
    try {
      console.log('🔄 [AutoLoginModal] 重新获取登录二维码...');
      const response = await xiaohongshuAPI.autoLogin(xhsUserId);

      if (response.success && response.qrCode) {
        console.log('✅ [AutoLoginModal] 获取到新的登录二维码');
        // 清除验证二维码，显示登录二维码
        setVerificationQRCode(null);
        setCurrentLoginQRCode(response.qrCode);
        setLoginStage('qrcode');
        setStatusMessage('请使用小红书App扫描二维码登录');
        setTimeoutSeconds(120);
        setVerificationExpiresIn(60); // 重置验证倒计时

        // 检查新响应中是否还有验证码
        if (response.hasVerification && response.verificationQrCode) {
          console.log('⚠️ [AutoLoginModal] 检测到需要验证！');
          setLoginStage('verification');
          setVerificationQRCode(response.verificationQrCode);
          setVerificationExpiresIn(60);
          setStatusMessage('⚠️ 需要验证，请扫描下方二维码');
        }
      }
    } catch (error) {
      console.error('❌ [AutoLoginModal] 获取登录二维码失败:', error);
    }
  }, [xhsUserId]);

  const checkLoginStatus = useCallback(async () => {
    if (!xhsUserId || checking) return;

    try {
      setChecking(true);
      console.log('🔍 [AutoLoginModal] 开始检查登录状态...');

      // 检查登录状态
      const status = await xiaohongshuAPI.checkLoginStatus(xhsUserId);
      console.log('📊 [AutoLoginModal] 登录状态结果:', status);

      if (status.isLoggedIn) {
        console.log('✅ [AutoLoginModal] 检测到登录成功！');
        setLoginStage('success');
        setStatusMessage('✅ 登录成功！');
        setTimeout(() => {
          onLoginSuccess();
          onClose();
        }, 1000);
      } else {
        // 无论在哪个阶段，都要检查是否需要验证
        const verifyData = await xiaohongshuAPI.getVerificationQRCode(xhsUserId);
        console.log('🔍 [AutoLoginModal] 检查验证状态:', verifyData);

        if (verifyData.hasVerification && verifyData.qrcodeImage) {
          // 检测到需要验证，切换到验证阶段
          if (loginStage !== 'verification') {
            console.log('⚠️ [AutoLoginModal] 检测到需要验证！切换到验证阶段');
            setLoginStage('verification');
            setVerificationExpiresIn(60);
          }
          setVerificationQRCode(verifyData.qrcodeImage);
          setStatusMessage('⚠️ 需要安全验证，请扫描下方二维码');
        } else if (loginStage === 'verification') {
          // 验证二维码消失了，说明用户已经扫描验证二维码
          // 但不代表登录成功，继续等待登录状态检查
          console.log('ℹ️ [AutoLoginModal] 验证二维码已消失，等待登录完成...');
          setStatusMessage('验证已完成，等待登录...');
          // 保持在验证阶段，不要重新获取登录二维码
        } else {
          // 普通等待状态
          setStatusMessage('等待扫码登录...');
        }
      }
    } catch (error) {
      console.error('❌ [AutoLoginModal] Check login status error:', error);
      setStatusMessage('检查登录状态失败，请重试');
    } finally {
      setChecking(false);
    }
  }, [xhsUserId, checking, onLoginSuccess, onClose, loginStage, fetchLoginQRCode]);

  // 重置状态当 Modal 打开时
  useEffect(() => {
    if (isOpen) {
      // 检查是否有初始验证二维码
      if (hasInitialVerification && initialVerificationQrCode) {
        console.log('🔐 [AutoLoginModal] 初始化为验证阶段');
        setLoginStage('verification');
        setVerificationQRCode(initialVerificationQrCode);
        setVerificationExpiresIn(60);
        setTimeoutSeconds(120);
        setStatusMessage('⚠️ 请先扫描验证二维码完成安全验证');
      } else {
        console.log('📱 [AutoLoginModal] 初始化为登录阶段');
        setLoginStage('qrcode');
        setVerificationQRCode(null);
        setVerificationExpiresIn(60);
        setTimeoutSeconds(120);
        setStatusMessage('请使用小红书App扫描二维码登录');
      }
      setCurrentLoginQRCode(null);
    }
  }, [isOpen, hasInitialVerification, initialVerificationQrCode]);

  // 主轮询逻辑
  useEffect(() => {
    if (!isOpen || !xhsUserId) return;

    const interval = setInterval(checkLoginStatus, 2000); // 改为2秒更快响应

    const timeout = setTimeout(() => {
      setStatusMessage('⏰ 二维码已过期，请重新获取');
      clearInterval(interval);
    }, 120000);

    const countdown = setInterval(() => {
      setTimeoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdown);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      clearInterval(countdown);
    };
  }, [isOpen, xhsUserId, checkLoginStatus]);

  // 验证二维码倒计时
  useEffect(() => {
    if (loginStage !== 'verification') return;

    const verifyCountdown = setInterval(() => {
      setVerificationExpiresIn((prev) => {
        if (prev <= 1) {
          clearInterval(verifyCountdown);
          setStatusMessage('⏰ 验证二维码已过期，请刷新页面重试');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(verifyCountdown);
  }, [loginStage]);

  // 当前显示的二维码
  // 优先使用动态获取的登录二维码（验证成功后更新），否则使用初始prop
  const currentQRCode = loginStage === 'verification'
    ? verificationQRCode
    : (currentLoginQRCode || qrCode);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-purple-700">
            {loginStage === 'verification' ? '🔐 安全验证' : '📱 扫码登录'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {loginStage === 'verification'
              ? '检测到需要二次验证，请扫描下方二维码'
              : '请使用小红书App扫描下方二维码'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 验证二维码警告 */}
          {loginStage === 'verification' && (
            <Alert className="bg-orange-50 border-orange-200">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <div className="space-y-1">
                  <p className="font-medium">⚠️ 需要二次验证</p>
                  <p className="text-sm">
                    请在 <span className="font-bold text-red-600">{verificationExpiresIn}</span> 秒内扫描下方二维码完成验证
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* 二维码显示 */}
          {currentQRCode ? (
            <div className={`rounded-xl p-4 flex items-center justify-center min-h-[300px] ${
              loginStage === 'verification' ? 'bg-orange-50 border-2 border-orange-300' : 'bg-gray-100'
            }`}>
              <img
                src={currentQRCode}
                alt={loginStage === 'verification' ? '验证二维码' : '登录二维码'}
                className="max-w-full max-h-[280px] rounded-lg"
              />
            </div>
          ) : (
            <div className="bg-gray-100 rounded-xl p-4 flex items-center justify-center min-h-[300px]">
              <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
            </div>
          )}

          <div className="text-center space-y-2">
            <p className={`text-sm font-medium ${
              statusMessage.includes('成功') ? 'text-green-600' :
              statusMessage.includes('过期') || statusMessage.includes('失败') ? 'text-red-600' :
              loginStage === 'verification' ? 'text-orange-600' :
              'text-gray-600'
            }`}>
              {statusMessage}
            </p>

            {/* 倒计时显示 */}
            {loginStage === 'verification' && verificationExpiresIn > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-red-600 font-bold">
                  ⏰ 验证二维码剩余: {verificationExpiresIn} 秒
                </p>
                <div className="w-full bg-orange-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(verificationExpiresIn / 60) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {loginStage === 'qrcode' && timeoutSeconds > 0 && !statusMessage.includes('成功') && (
              <p className="text-xs text-gray-500">
                二维码有效期: {Math.floor(timeoutSeconds / 60)}:{(timeoutSeconds % 60).toString().padStart(2, '0')}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full text-gray-500 hover:text-gray-700 text-sm underline"
          >
            取消
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
