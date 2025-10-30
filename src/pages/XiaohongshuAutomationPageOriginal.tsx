import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

// 完整移植原始页面 xiaohongshu-automation-ai.zeabur.app/auto-manager.html
// 包含所有步骤：登录检查、产品配置、自动运营仪表板

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
        const step2 = document.getElementById('step2');

        if (loginStatus) loginStatus.classList.add('hidden');

        if (data.success && data.data && data.data.logged_in === true) {
          if (loginSuccess) loginSuccess.classList.remove('hidden');
          if (loginError) loginError.classList.add('hidden');
          if (step2) {
            step2.classList.remove('opacity-50');
            step2.querySelector('button')?.removeAttribute('disabled');
          }
        } else {
          if (loginError) loginError.classList.remove('hidden');
          if (loginSuccess) loginSuccess.classList.add('hidden');
          if (step2) {
            step2.classList.add('opacity-50');
            step2.querySelector('button')?.setAttribute('disabled', 'true');
          }
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

    // 保存配置并启动自动运营
    (window as any).saveConfiguration = async function() {
      try {
        const productName = (document.getElementById('productName') as HTMLInputElement)?.value;
        const targetAudience = (document.getElementById('targetAudience') as HTMLInputElement)?.value;
        const marketingGoal = (document.getElementById('marketingGoal') as HTMLSelectElement)?.value;
        const postFrequency = (document.getElementById('postFrequency') as HTMLSelectElement)?.value;
        const brandStyle = (document.getElementById('brandStyle') as HTMLSelectElement)?.value;
        const reviewMode = (document.getElementById('reviewMode') as HTMLSelectElement)?.value;

        if (!productName || !targetAudience) {
          toast.error('请填写产品/服务和目标客户');
          return;
        }

        const config = {
          userId: xiaohongshuUserId,
          productName,
          targetAudience,
          marketingGoal,
          postFrequency,
          brandStyle,
          reviewMode
        };

        console.log('保存配置:', config);

        const response = await fetch(`${CLAUDE_API}/agent/auto/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });

        const result = await response.json();

        if (result.success) {
          // 隐藏设置向导，显示仪表板
          const setupWizard = document.getElementById('setupWizard');
          const dashboard = document.getElementById('autoManagerDashboard');

          if (setupWizard) setupWizard.classList.add('hidden');
          if (dashboard) dashboard.classList.remove('hidden');

          toast.success('🚀 自动运营已启动！');

          // 开始加载运营数据
          (window as any).loadDashboardData();
        } else {
          toast.error(result.error || '启动失败');
        }
      } catch (error) {
        console.error('保存配置失败:', error);
        toast.error('保存配置失败，请重试');
      }
    };

    // 加载仪表板数据
    (window as any).loadDashboardData = async function() {
      try {
        // 获取策略数据
        const strategyResponse = await fetch(`${CLAUDE_API}/agent/auto/strategy/${xiaohongshuUserId}`);
        const strategy = await strategyResponse.json();

        if (strategy.success && strategy.data) {
          const aiStrategy = document.getElementById('aiStrategy');
          if (aiStrategy) {
            aiStrategy.innerHTML = `
              <div class="space-y-2">
                <div><strong>关键主题:</strong> ${strategy.data.keyThemes?.join(', ') || 'N/A'}</div>
                <div><strong>内容类型:</strong> ${strategy.data.contentTypes?.join(', ') || 'N/A'}</div>
                <div><strong>最佳时间:</strong> ${strategy.data.optimalTimes?.join(', ') || 'N/A'}</div>
                <div><strong>热门话题:</strong> ${strategy.data.trendingTopics?.join(', ') || 'N/A'}</div>
              </div>
            `;
          }
        }

        // 获取本周计划
        const planResponse = await fetch(`${CLAUDE_API}/agent/auto/week-plan/${xiaohongshuUserId}`);
        const plan = await planResponse.json();

        if (plan.success && plan.data) {
          const weekPlan = document.getElementById('weekPlan');
          if (weekPlan && plan.data.days) {
            weekPlan.innerHTML = plan.data.days.map((day: any) => `
              <div class="border rounded p-3">
                <div class="font-medium">${day.dayOfWeek} ${day.date}</div>
                <div class="text-sm text-gray-600">${day.posts?.length || 0} 篇内容</div>
              </div>
            `).join('');
          }
        }

        // 获取今日任务
        const tasksResponse = await fetch(`${CLAUDE_API}/agent/auto/tasks/${xiaohongshuUserId}`);
        const tasks = await tasksResponse.json();

        if (tasks.success && tasks.data) {
          const todayTasks = document.getElementById('todayTasks');
          if (todayTasks && tasks.data.tasks) {
            todayTasks.innerHTML = tasks.data.tasks.map((task: any) => `
              <div class="flex items-center justify-between p-3 border rounded">
                <div>
                  <div class="font-medium">${task.title}</div>
                  <div class="text-sm text-gray-600">${task.scheduledTime || ''}</div>
                </div>
                <span class="text-xs px-2 py-1 rounded ${
                  task.status === 'ready' ? 'bg-green-100 text-green-800' :
                  task.status === 'planned' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }">${task.status}</span>
              </div>
            `).join('');
          }
        }

      } catch (error) {
        console.error('加载仪表板数据失败:', error);
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

    (window as any).backToSetup = function() {
      const setupWizard = document.getElementById('setupWizard');
      const dashboard = document.getElementById('autoManagerDashboard');

      if (setupWizard) setupWizard.classList.remove('hidden');
      if (dashboard) dashboard.classList.add('hidden');
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

          {/* Step 2: Product Info */}
          <div id="step2" className="rounded-2xl p-8 shadow-xl opacity-50" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 bg-gray-400 text-white rounded-full flex items-center justify-center font-bold mr-4">2</div>
              <h2 className="text-2xl font-bold">🎯 设置产品和目标</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">产品/服务</label>
                  <input type="text" id="productName" placeholder="例如：手工咖啡店"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">目标客户</label>
                  <input type="text" id="targetAudience" placeholder="例如：25-35岁都市白领"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">营销目标</label>
                  <select id="marketingGoal" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                    <option value="brand">品牌知名度</option>
                    <option value="sales">销售转化</option>
                    <option value="engagement">粉丝互动</option>
                    <option value="traffic">店铺引流</option>
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">发布频率</label>
                  <select id="postFrequency" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                    <option value="daily">每天1篇</option>
                    <option value="twice-daily">每天2篇</option>
                    <option value="high-freq">每天3-5篇</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">品牌风格</label>
                  <select id="brandStyle" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                    <option value="warm">温暖治愈</option>
                    <option value="professional">专业权威</option>
                    <option value="trendy">时尚潮流</option>
                    <option value="funny">幽默风趣</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">审核模式</label>
                  <select id="reviewMode" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                    <option value="auto">完全自动</option>
                    <option value="review">发布前审核</option>
                    <option value="edit">允许编辑</option>
                  </select>
                </div>
              </div>
            </div>
            <button onClick={() => (window as any).saveConfiguration()} className="w-full mt-6 bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 px-6 rounded-lg transition" disabled>
              保存配置并启动自动运营
            </button>
          </div>
        </div>

        {/* Auto Manager Dashboard */}
        <div id="autoManagerDashboard" className="hidden space-y-6">
          {/* Status Header */}
          <div className="rounded-2xl p-6 shadow-xl" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">🤖 自动运营中</h2>
                <p className="text-gray-600" id="autoStatusText">Claude正在为您的产品规划内容...</p>
              </div>
              <div className="text-right">
                <div className="text-white px-4 py-2 rounded-lg font-medium mb-2" style={{ background: 'linear-gradient(90deg, #10b981, #059669, #10b981)', backgroundSize: '200% 100%', animation: 'flow 3s ease-in-out infinite' }}>
                  <span className="animate-pulse">●</span> 运行中
                </div>
                <div className="text-sm text-gray-500" id="runningTime">已运行 0分钟</div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => (window as any).backToSetup()} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded transition">
                    ⚙️ 重新配置
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* AI Planning Panel */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Content Strategy */}
            <div className="rounded-xl p-6 shadow-lg" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
              <h3 className="text-lg font-bold mb-4 flex items-center">🧠 内容策略</h3>
              <div id="aiStrategy" className="space-y-3 text-sm">
                <div className="text-center py-6 text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mb-2"></div>
                  <div>AI正在分析中...</div>
                </div>
              </div>
            </div>

            {/* Week Plan */}
            <div className="rounded-xl p-6 shadow-lg" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
              <h3 className="text-lg font-bold mb-4 flex items-center">📅 本周计划</h3>
              <div id="weekPlan" className="space-y-3 text-sm">
                <div className="text-center py-6 text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mb-2"></div>
                  <div>正在制定计划...</div>
                </div>
              </div>
            </div>

            {/* Today Tasks */}
            <div className="rounded-xl p-6 shadow-lg" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
              <h3 className="text-lg font-bold mb-4 flex items-center">📝 今日任务</h3>
              <div id="todayTasks" className="space-y-3 text-sm">
                <div className="text-center py-6 text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mb-2"></div>
                  <div>正在安排任务...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .loading {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #3498db;
          border-radius: 50%;
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes flow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
};

export default XiaohongshuAutomationPageOriginal;