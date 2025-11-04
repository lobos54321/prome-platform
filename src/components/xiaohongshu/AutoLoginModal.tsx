import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';
import { Loader2 } from 'lucide-react';

interface AutoLoginModalProps {
  isOpen: boolean;
  qrCode: string | null;
  xhsUserId: string;
  onLoginSuccess: () => void;
  onClose: () => void;
}

export function AutoLoginModal({
  isOpen,
  qrCode,
  xhsUserId,
  onLoginSuccess,
  onClose,
}: AutoLoginModalProps) {
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState('请使用小红书App扫描二维码');
  const [timeoutSeconds, setTimeoutSeconds] = useState(120);

  const checkLoginStatus = useCallback(async () => {
    if (!xhsUserId || checking) return;

    try {
      setChecking(true);
      console.log('🔍 [AutoLoginModal] 开始检查登录状态...');
      const status = await xiaohongshuAPI.checkLoginStatus(xhsUserId);
      console.log('📊 [AutoLoginModal] 登录状态结果:', status);
      
      if (status.isLoggedIn) {
        console.log('✅ [AutoLoginModal] 检测到登录成功！');
        setStatusMessage('✅ 登录成功！');
        setTimeout(() => {
          onLoginSuccess();
          onClose();
        }, 1000);
      } else {
        console.log('⏳ [AutoLoginModal] 还未登录，继续等待...');
        setStatusMessage('等待扫码登录...');
      }
    } catch (error) {
      console.error('❌ [AutoLoginModal] Check login status error:', error);
      setStatusMessage('检查登录状态失败，请重试');
    } finally {
      setChecking(false);
    }
  }, [xhsUserId, checking, onLoginSuccess, onClose]);

  useEffect(() => {
    if (!isOpen || !xhsUserId) return;

    const interval = setInterval(checkLoginStatus, 3000);
    
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-purple-700">
            📱 扫码登录
          </DialogTitle>
          <DialogDescription className="text-center">
            请使用小红书App扫描下方二维码
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {qrCode ? (
            <div className="bg-gray-100 rounded-xl p-4 flex items-center justify-center min-h-[300px]">
              <img 
                src={qrCode} 
                alt="登录二维码" 
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
              'text-gray-600'
            }`}>
              {statusMessage}
            </p>
            
            {timeoutSeconds > 0 && !statusMessage.includes('成功') && (
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
