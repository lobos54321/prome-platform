import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

// 直接基于原始页面 xiaohongshu-automation-ai.zeabur.app/auto-manager.html
// 避免重复造轮子，保持已验证的功能

const XiaohongshuAutomationPageOriginal: React.FC = () => {
  const { user } = useAuth();
  const [xiaohongshuUserId, setXiaohongshuUserId] = useState<string>('');

  // API基础URL
  const CLAUDE_API = 'https://xiaohongshu-automation-ai.zeabur.app';

  // 生成稳定的小红书用户ID
  const generateXiaohongshuUserId = (supabaseId: string): string => {
    const cleanId = supabaseId.replace(/-/g, '').substring(0, 16);
    return `user_${cleanId}_prome`;
  };

  useEffect(() => {
    if (user?.id) {
      const userId = generateXiaohongshuUserId(user.id);
      setXiaohongshuUserId(userId);
      console.log('🔍 用户ID映射:', { supabase: user.id, xiaohongshu: userId });
    }
  }, [user]);

  // 直接使用原始页面的HTML结构和JavaScript逻辑
  useEffect(() => {
    if (!xiaohongshuUserId) return;

    // 将原始页面的JavaScript函数注入到window对象
    (window as any).currentUser = xiaohongshuUserId;
    (window as any).CLAUDE_API = CLAUDE_API;

    // 原始页面的核心函数
    (window as any).checkLoginStatus = async function() {
      try {
        const response = await fetch(`${CLAUDE_API}/agent/xiaohongshu/login/status?userId=${xiaohongshuUserId}`);
        const data = await response.json();

        const loginStatus = document.getElementById('loginStatus');
        const loginSuccess = document.getElementById('loginSuccess');
        const loginError = document.getElementById('loginError');

        if (loginStatus) loginStatus.classList.add('hidden');

        if (data.success && data.data && data.data.logged_in === true) {
          if (loginSuccess) loginSuccess.classList.remove('hidden');
          if (loginError) loginError.classList.add('hidden');
        } else {
          if (loginError) loginError.classList.remove('hidden');
          if (loginSuccess) loginSuccess.classList.add('hidden');
        }
      } catch (error) {
        console.error('登录状态检查失败:', error);
        const loginError = document.getElementById('loginError');
        if (loginError) loginError.classList.remove('hidden');
      }
    };

    // 原始页面的自动登录函数
    (window as any).startAutoLogin = async function() {
      try {
        const qrModal = document.getElementById('qrLoginModal');
        const qrContainer = document.getElementById('qrCodeContainer');
        const qrStatus = document.getElementById('qrStatus');

        if (qrModal) qrModal.classList.remove('hidden');
        if (qrContainer) qrContainer.innerHTML = '<div class="loading"></div>';
        if (qrStatus) qrStatus.textContent = '正在生成二维码...';

        const response = await fetch(`${CLAUDE_API}/agent/xiaohongshu/auto-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: xiaohongshuUserId })
        });

        const result = await response.json();
        console.log('自动登录响应:', result);

        if (result.success && result.data && result.data.qrcode_url) {
          if (qrContainer) {
            qrContainer.innerHTML = `<img src="${result.data.qrcode_url}" alt="登录二维码" class="max-w-full rounded-lg">`;
          }
          if (qrStatus) {
            qrStatus.innerHTML = '✨ <span class="text-purple-600 font-medium">请使用小红书App扫描二维码登录</span>';
          }

          // 开始轮询
          (window as any).startQRLoginPolling();
        } else {
          if (qrContainer) qrContainer.innerHTML = '<p class="text-red-600">❌ 二维码生成失败</p>';
          if (qrStatus) qrStatus.textContent = result.error || '请稍后重试';
        }
      } catch (error) {
        console.error('自动登录失败:', error);
        toast.error('获取二维码失败，请重试');
      }
    };

    // 二维码登录轮询
    (window as any).qrLoginPollingInterval = null;
    (window as any).startQRLoginPolling = function() {
      (window as any).stopQRLoginPolling();

      (window as any).qrLoginPollingInterval = setInterval(async () => {
        try {
          const response = await fetch(`${CLAUDE_API}/agent/xiaohongshu/login/status?userId=${xiaohongshuUserId}`);
          const result = await response.json();

          if (result.success && result.data && result.data.logged_in === true) {
            const qrStatus = document.getElementById('qrStatus');
            if (qrStatus) {
              qrStatus.innerHTML = '✅ <span class="text-green-600 font-bold">登录成功！</span>';
            }

            setTimeout(() => {
              (window as any).closeQRModal();
              (window as any).checkLoginStatus();
              toast.success('小红书账号绑定成功！');
            }, 1500);
          }
        } catch (error) {
          console.error('轮询登录状态失败:', error);
        }
      }, 3000);
    };

    (window as any).stopQRLoginPolling = function() {
      if ((window as any).qrLoginPollingInterval) {
        clearInterval((window as any).qrLoginPollingInterval);
        (window as any).qrLoginPollingInterval = null;
      }
    };

    (window as any).closeQRModal = function() {
      const qrModal = document.getElementById('qrLoginModal');
      if (qrModal) qrModal.classList.add('hidden');
      (window as any).stopQRLoginPolling();
    };

    // 初始化检查登录状态
    (window as any).checkLoginStatus();

    // 清理函数
    return () => {
      (window as any).stopQRLoginPolling();
    };
  }, [xiaohongshuUserId]);

  if (!user) {
    return <div className="text-center">请先登录</div>;
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">🤖 小红书全自动运营系统</h1>
          <p className="text-lg opacity-90">一次设置，终身自动 - 让Claude为你打理一切</p>
        </div>

        {/* Setup Wizard */}
        <div id="setupWizard" className="space-y-6">
          {/* Step 1: Login Check */}
          <div id="step1" className="rounded-2xl p-8 shadow-xl" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold mr-4">1</div>
              <h2 className="text-2xl font-bold">📱 登录状态检查</h2>
            </div>

            <div className="text-center space-y-4">
              <div id="loginStatus" className="text-lg text-gray-600">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                正在检查登录状态...
              </div>
              <div id="loginSuccess" className="hidden">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-green-800 font-medium mb-2">✅ 已成功登录小红书</p>
                  <p className="text-green-700 text-sm mb-3">可以继续配置产品信息开始运营</p>
                </div>
              </div>
              <div id="loginError" className="hidden">
                <div className="bg-red-50 p-4 rounded-lg space-y-3">
                  <p className="text-red-800 font-medium">❌ 未检测到登录状态</p>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <button
                      onClick={() => (window as any).startAutoLogin()}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium py-2 px-6 rounded-lg transition shadow-md hover:shadow-lg"
                    >
                      🚀 一键自动登录
                    </button>
                  </div>
                </div>
              </div>

              {/* 二维码弹窗 */}
              <div id="qrLoginModal" className="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                  <div className="text-center space-y-4">
                    <h3 className="text-2xl font-bold text-purple-700">📱 扫码登录</h3>
                    <p className="text-gray-600">请使用小红书App扫描下方二维码</p>
                    <div id="qrCodeContainer" className="bg-gray-100 rounded-xl p-4 min-h-[300px] flex items-center justify-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                    <div id="qrStatus" className="text-sm text-gray-500"></div>
                    <button
                      onClick={() => (window as any).closeQRModal()}
                      className="text-gray-500 hover:text-gray-700 underline"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default XiaohongshuAutomationPageOriginal;