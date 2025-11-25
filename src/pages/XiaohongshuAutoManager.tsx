import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Settings,
  LogOut,
  Play,
  TrendingUp,
  Calendar,
  Clock,
  Activity,
  QrCode,
  Smartphone
} from 'lucide-react';
import { xhsClient } from '@/lib/xhs-worker';

// API 配置
const CLAUDE_API = import.meta.env.VITE_XHS_API_URL || 'http://localhost:8080';

interface UserConfig {
  productName: string;
  targetAudience: string;
  marketingGoal: string;
  postFrequency: string;
  brandStyle: string;
  reviewMode: string;
}

interface DashboardData {
  strategy?: any;
  weekPlan?: any;
  dailyTasks?: any[];
  activities?: any[];
  status?: any;
}

export default function XiaohongshuAutoManager() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(true);
  const [autoModeEnabled, setAutoModeEnabled] = useState(false);
  const [logoutProtection, setLogoutProtection] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(60);

  // QR Code Login State
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isWaitingForScan, setIsWaitingForScan] = useState(false);
  const [loginStatusMsg, setLoginStatusMsg] = useState<string>("");
  const [qrSecondsRemaining, setQrSecondsRemaining] = useState<number>(90);
  const [retryCount, setRetryCount] = useState<number>(0);

  // 配置表单
  const [config, setConfig] = useState<UserConfig>({
    productName: '',
    targetAudience: '',
    marketingGoal: 'brand-awareness',
    postFrequency: 'daily-2',
    brandStyle: 'professional',
    reviewMode: 'auto-publish'
  });

  // Dashboard 数据
  const [dashboardData, setDashboardData] = useState<DashboardData>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const loginCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const qrRefreshTimer = useRef<NodeJS.Timeout | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // 检查登录状态
  useEffect(() => {
    checkLoginStatus();
    return () => {
      stopPolling();
      stopLoginCheck();
      if (qrRefreshTimer.current) clearTimeout(qrRefreshTimer.current);
    };
  }, []);

  // 轮询数据
  useEffect(() => {
    if (autoModeEnabled && currentUser) {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [autoModeEnabled, currentUser]);

  // 退出登录倒计时
  useEffect(() => {
    if (logoutProtection && logoutCountdown > 0) {
      const timer = setTimeout(() => {
        setLogoutCountdown(logoutCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (logoutCountdown === 0) {
      setLogoutProtection(false);
      setLogoutCountdown(60);
    }
  }, [logoutProtection, logoutCountdown]);

  const checkLoginStatus = async () => {
    setIsLoading(true);
    try {
      // 检查是否在退出登录保护期
      const logoutTime = localStorage.getItem('lastLogoutTime');
      if (logoutTime) {
        const elapsed = Date.now() - parseInt(logoutTime);
        if (elapsed < 60000) { // 60秒内
          setLogoutProtection(true);
          setLogoutCountdown(Math.ceil((60000 - elapsed) / 1000));
          setIsLoading(false);
          return;
        } else {
          localStorage.removeItem('lastLogoutTime');
        }
      }

      // 从localStorage获取用户信息
      const storedUser = localStorage.getItem('currentXHSUser');
      if (storedUser) {
        setCurrentUser(storedUser);
        setIsLoggedIn(true);

        // 检查是否有保存的配置
        const savedConfig = localStorage.getItem(`userConfig_${storedUser}`);
        if (savedConfig) {
          setConfig(JSON.parse(savedConfig));
          setShowSetup(false);
          setAutoModeEnabled(true);
        }
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = () => {
    if (pollingInterval.current) return;

    fetchDashboardData(); // 立即获取一次
    pollingInterval.current = setInterval(() => {
      fetchDashboardData();
    }, 5000); // 每5秒更新
  };

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  // === QR Code Login Logic ===

  const handleStartLogin = async (attemptCount: number = 0) => {
    // CRITICAL: Stop all old polling/timers FIRST to prevent conflicts
    console.log('🛑 Stopping all old sessions before creating new QR...');
    stopLoginCheck();

    setIsLoading(true);
    setLoginStatusMsg("正在获取登录二维码...");
    try {
      // REUSE existing session ID from localStorage if available
      // This is CRITICAL for browser pool reuse on the backend
      let tempUserId = localStorage.getItem('xhs_session_id');

      if (!tempUserId) {
        tempUserId = `user_${Date.now()}`;
        localStorage.setItem('xhs_session_id', tempUserId);
        console.log(`🆕 Created new session ID: ${tempUserId}`);
      } else {
        console.log(`♻️ Reusing existing session ID from storage: ${tempUserId}`);
      }

      // Update ref for local usage
      currentUserIdRef.current = tempUserId;

      const res = await xhsClient.getLoginQRCode({
        userId: tempUserId,
      });

      if (res.qr_image) {
        setQrCode(res.qr_image);
        setIsWaitingForScan(true);
        setQrSecondsRemaining(90);
        setRetryCount(0); // Reset retry count on success
        setLoginStatusMsg("请使用小红书APP扫码登录");

        // Start polling for login status
        startLoginCheck(tempUserId);

        // Start 85-second auto-refresh timer
        if (qrRefreshTimer.current) clearTimeout(qrRefreshTimer.current);
        qrRefreshTimer.current = setTimeout(() => {
          console.log('QR code nearing expiration, auto-refreshing...');
          handleCancelLogin();
          handleStartLogin(0); // Refresh QR code
        }, 85000); // 85 seconds

      } else if (res.status === 'logged_in') {
        handleLoginSuccess(tempUserId, undefined);
      }
    } catch (error: any) {
      console.error("Login failed:", error);

      // Exponential backoff retry logic
      if (attemptCount < 3) {
        const delay = Math.pow(2, attemptCount) * 1000; // 1s, 2s, 4s
        setRetryCount(attemptCount + 1);
        setLoginStatusMsg(`获取失败，${delay / 1000}秒后重试... (第${attemptCount + 1}次)`);

        setTimeout(() => {
          handleStartLogin(attemptCount + 1);
        }, delay);
      } else {
        alert(`获取二维码失败: ${error.message}`);
        setLoginStatusMsg("");
        setRetryCount(0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startLoginCheck = (userId: string) => {
    // Clear any existing interval first
    if (loginCheckInterval.current) {
      console.log('🛑 Clearing existing login check interval');
      clearInterval(loginCheckInterval.current);
    }

    console.log(`✅ Starting login check for user: ${userId}`);
    loginCheckInterval.current = setInterval(async () => {
      try {
        // Verify we're still checking the right user
        if (currentUserIdRef.current !== userId) {
          console.log(`⚠️ UserID mismatch, stopping polling for ${userId}`);
          if (loginCheckInterval.current) clearInterval(loginCheckInterval.current);
          return;
        }

        const res = await xhsClient.checkLoginStatus(userId);

        // Handle different statuses from backend
        switch (res.status) {
          case 'success':
            // Login successful - stop polling and handle success
            console.log('✅ Login successful!', res);
            handleLoginSuccess(userId, res.cookies);
            break;

          case 'qr_expired':
            // QR code expired - auto refresh ONLY if this is still the current session
            if (currentUserIdRef.current === userId) {
              console.log('⏰ QR code expired, refreshing...');
              setLoginStatusMsg(`二维码已过期 (${res.seconds_elapsed}秒)，正在刷新...`);
              handleCancelLogin();
              handleStartLogin(0);
            }
            break;

          case 'waiting_scan':
            // Still waiting - update countdown
            if (res.seconds_remaining !== undefined) {
              setQrSecondsRemaining(res.seconds_remaining);
              setLoginStatusMsg(`等待扫码中 (${res.seconds_remaining}秒)`);
            }
            break;

          case 'not_found':
            // Session not found - stop polling silently (probably old session)
            console.warn(`⚠️ Session ${userId} not found on backend`);
            if (loginCheckInterval.current) clearInterval(loginCheckInterval.current);
            break;

          default:
            console.log('❓ Unknown status:', res.status);
        }
      } catch (error) {
        console.error("❌ Check status failed:", error);
      }
    }, 2000);
  };

  const stopLoginCheck = () => {
    if (loginCheckInterval.current) {
      clearInterval(loginCheckInterval.current);
      loginCheckInterval.current = null;
    }
    if (qrRefreshTimer.current) {
      clearTimeout(qrRefreshTimer.current);
      qrRefreshTimer.current = null;
    }
  };

  const handleLoginSuccess = (userId: string, cookies?: any) => {
    stopLoginCheck();
    setQrCode(null);
    setIsWaitingForScan(false);

    setCurrentUser(userId);
    setIsLoggedIn(true);
    localStorage.setItem('currentXHSUser', userId);

    // Save cookies if provided
    if (cookies) {
      console.log('Saving cookies:', cookies);
      localStorage.setItem(`xhs_cookies_${userId}`, JSON.stringify(cookies));
    }

    alert("登录成功！");
    setLoginStatusMsg("登录成功，即将跳转...");

    // Auto-transition to dashboard (show setup)
    setTimeout(() => {
      setShowSetup(true);
      setLoginStatusMsg("");
    }, 1500);
  };

  const handleCancelLogin = () => {
    stopLoginCheck();
    if (qrRefreshTimer.current) clearTimeout(qrRefreshTimer.current);
    setIsWaitingForScan(false);
    setQrCode(null);
    setLoginStatusMsg("");
    // Clear the session ID so next time we get a fresh browser
    currentUserIdRef.current = null;
    localStorage.removeItem('xhs_session_id'); // Clear from storage
    setQrSecondsRemaining(90);
  };

  // ===========================

  const fetchDashboardData = async () => {
    if (!currentUser) return;

    try {
      const [strategyRes, planRes, statusRes] = await Promise.all([
        fetch(`${CLAUDE_API}/agent/auto/strategy/${currentUser}`).catch(() => null),
        fetch(`${CLAUDE_API}/agent/auto/plan/${currentUser}`).catch(() => null),
        fetch(`${CLAUDE_API}/agent/auto/status/${currentUser}`).catch(() => null)
      ]);

      const newData: DashboardData = {};

      if (strategyRes?.ok) {
        const data = await strategyRes.json();
        newData.strategy = data.strategy;
      }

      if (planRes?.ok) {
        const data = await planRes.json();
        newData.dailyTasks = data.plan?.tasks || [];
      }

      if (statusRes?.ok) {
        const data = await statusRes.json();
        newData.status = data.data;
        newData.activities = data.data?.recentActivities || [];
      }

      setDashboardData(newData);
    } catch (error) {
      console.error('获取Dashboard数据失败:', error);
    }
  };

  const handleStartAutoMode = async () => {
    if (!currentUser) return;

    setIsGenerating(true);
    try {
      const response = await fetch(`${CLAUDE_API}/agent/auto/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser,
          productName: config.productName,
          targetAudience: config.targetAudience,
          marketingGoal: config.marketingGoal,
          postFrequency: config.postFrequency,
          brandStyle: config.brandStyle,
          reviewMode: config.reviewMode
        })
      });

      const result = await response.json();

      if (result.success) {
        // 保存配置
        localStorage.setItem(`userConfig_${currentUser}`, JSON.stringify(config));
        setAutoModeEnabled(true);
        setShowSetup(false);

        // 开始轮询数据
        startPolling();
      } else {
        alert(`启动失败: ${result.error || '未知错误'}`);
      }
    } catch (error: any) {
      console.error('启动自动运营失败:', error);
      alert(`启动失败: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('确定要退出登录吗？这将清除所有本地数据和服务器端运营配置。')) {
      return;
    }

    try {
      stopPolling();
      stopLoginCheck();

      if (currentUser) {
        // Close browser session on worker
        await xhsClient.closeSession(currentUser).catch(console.error);

        // Reset auto agent state
        await fetch(`${CLAUDE_API}/agent/auto/reset/${currentUser}`, {
          method: 'POST'
        }).catch(console.error);
      }

      localStorage.removeItem('currentXHSUser');
      localStorage.removeItem(`userConfig_${currentUser}`);
      localStorage.setItem('lastLogoutTime', Date.now().toString());

      setCurrentUser(null);
      setIsLoggedIn(false);
      setAutoModeEnabled(false);
      setShowSetup(true);
      setDashboardData({});
      setLogoutProtection(true);
      setLogoutCountdown(60);

      alert('已退出登录！\n\n⚠️ 为确保数据完全清理，系统将禁止新登录60秒。');

      // Reload to clear state cleanly
      window.location.reload();
    } catch (error) {
      console.error('退出登录失败:', error);
      alert('退出过程中遇到问题，请刷新页面重试');
    }
  };

  const handleReconfigure = async () => {
    if (!confirm('确定要重新配置吗？这将停止当前的自动运营并清除所有数据。')) {
      return;
    }

    try {
      stopPolling();
      setAutoModeEnabled(false);

      if (currentUser) {
        localStorage.removeItem(`userConfig_${currentUser}`);
        await fetch(`${CLAUDE_API}/agent/auto/reset/${currentUser}`, {
          method: 'POST'
        }).catch(console.error);
      }

      setConfig({
        productName: '',
        targetAudience: '',
        marketingGoal: 'brand-awareness',
        postFrequency: 'daily-2',
        brandStyle: 'professional',
        reviewMode: 'auto-publish'
      });

      setDashboardData({});
      setShowSetup(true);
    } catch (error) {
      console.error('重新配置失败:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (logoutProtection) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Clock className="w-16 h-16 mx-auto text-orange-500" />
              <h2 className="text-2xl font-bold text-orange-800">系统正在清理中</h2>
              <p className="text-orange-700">
                刚刚执行了退出登录，系统正在完全清理所有数据，为确保安全需要等待片刻
              </p>
              <div className="bg-orange-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-orange-800">剩余等待时间：</span>
                  <span className="text-2xl font-bold text-orange-900">{logoutCountdown} 秒</span>
                </div>
                <div className="w-full bg-orange-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(logoutCountdown / 60) * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-orange-600 text-sm">
                等待结束后系统将自动恢复登录功能
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>连接小红书账号</CardTitle>
          </CardHeader>
          <CardContent>
            {!qrCode ? (
              <div className="text-center space-y-6 py-8">
                <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                  <Smartphone className="w-10 h-10 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">扫码登录</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    请使用小红书APP扫描二维码登录。登录后，系统将自动获取您的账号权限以进行自动化发布。
                  </p>
                </div>
                <Button size="lg" onClick={handleStartLogin} className="bg-red-500 hover:bg-red-600">
                  <QrCode className="w-4 h-4 mr-2" />
                  获取登录二维码
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-6 py-8">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2">请扫码登录</h3>
                  <p className="text-sm text-muted-foreground">{loginStatusMsg}</p>
                </div>

                <div className="flex justify-center">
                  <div className="border-4 border-red-100 rounded-lg p-2">
                    <img
                      src={`data:image/png;base64,${qrCode}`}
                      alt="Login QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在等待扫码...
                </div>

                <Button variant="outline" onClick={handleCancelLogin}>
                  取消
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">🤖 小红书全自动运营系统</h1>
          <p className="text-muted-foreground">一次设置，终身自动 - 让Claude为你打理一切</p>
        </div>
        {!showSetup && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReconfigure}>
              <Settings className="w-4 h-4 mr-2" />
              重新配置
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </Button>
          </div>
        )}
      </div>

      {/* Setup Wizard */}
      {showSetup ? (
        <Card>
          <CardHeader>
            <CardTitle>📝 产品信息配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="productName">产品/服务名称 *</Label>
                <Input
                  id="productName"
                  placeholder="例如：智能手表、美容护肤品、在线课程..."
                  value={config.productName}
                  onChange={(e) => setConfig({ ...config, productName: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="targetAudience">目标受众 *</Label>
                <Textarea
                  id="targetAudience"
                  placeholder="例如：25-35岁都市白领女性，注重生活品质..."
                  value={config.targetAudience}
                  onChange={(e) => setConfig({ ...config, targetAudience: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="marketingGoal">营销目标</Label>
                <select
                  id="marketingGoal"
                  className="w-full border rounded-md p-2"
                  value={config.marketingGoal}
                  onChange={(e) => setConfig({ ...config, marketingGoal: e.target.value })}
                >
                  <option value="brand-awareness">品牌认知</option>
                  <option value="lead-generation">获客引流</option>
                  <option value="product-sales">产品销售</option>
                  <option value="community-building">社群建设</option>
                </select>
              </div>

              <div>
                <Label htmlFor="postFrequency">发布频率</Label>
                <select
                  id="postFrequency"
                  className="w-full border rounded-md p-2"
                  value={config.postFrequency}
                  onChange={(e) => setConfig({ ...config, postFrequency: e.target.value })}
                >
                  <option value="daily-1">每天1条</option>
                  <option value="daily-2">每天2条</option>
                  <option value="daily-3">每天3条</option>
                  <option value="weekly-7">每周7条</option>
                </select>
              </div>

              <div>
                <Label htmlFor="brandStyle">品牌风格</Label>
                <select
                  id="brandStyle"
                  className="w-full border rounded-md p-2"
                  value={config.brandStyle}
                  onChange={(e) => setConfig({ ...config, brandStyle: e.target.value })}
                >
                  <option value="professional">专业严谨</option>
                  <option value="friendly">亲切友好</option>
                  <option value="trendy">时尚潮流</option>
                  <option value="humorous">幽默风趣</option>
                </select>
              </div>

              <div>
                <Label htmlFor="reviewMode">审核模式</Label>
                <select
                  id="reviewMode"
                  className="w-full border rounded-md p-2"
                  value={config.reviewMode}
                  onChange={(e) => setConfig({ ...config, reviewMode: e.target.value })}
                >
                  <option value="manual-review">手动审核</option>
                  <option value="auto-publish">自动发布</option>
                </select>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleStartAutoMode}
              disabled={!config.productName || !config.targetAudience || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  正在生成运营策略...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  启动自动运营
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Dashboard */
        <div className="space-y-6">
          {/* Status Card */}
          <Card className={autoModeEnabled ? 'bg-green-50 border-green-200' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Activity className={`w-8 h-8 ${autoModeEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <h3 className="text-lg font-bold">
                      {autoModeEnabled ? '🟢 自动运营进行中' : '⏸️ 已暂停'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {config.productName} - {config.targetAudience?.substring(0, 30)}...
                    </p>
                  </div>
                </div>
                <Badge variant={autoModeEnabled ? 'default' : 'secondary'}>
                  {autoModeEnabled ? '运行中' : '已停止'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Strategy */}
          {dashboardData.strategy && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  AI 内容策略
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">关键主题</h4>
                    <div className="flex flex-wrap gap-2">
                      {dashboardData.strategy.keyThemes?.map((theme: string, i: number) => (
                        <Badge key={i} variant="outline">{theme}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">热门话题</h4>
                    <div className="flex flex-wrap gap-2">
                      {dashboardData.strategy.trendingTopics?.map((topic: string, i: number) => (
                        <Badge key={i} variant="outline">{topic}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Daily Tasks */}
          {dashboardData.dailyTasks && dashboardData.dailyTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  今日计划 ({dashboardData.dailyTasks.length} 条内容)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData.dailyTasks.slice(0, 3).map((task: any, i: number) => (
                    <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="flex-shrink-0">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{task.title}</h4>
                          <Badge variant={
                            task.status === 'completed' ? 'default' :
                              task.status === 'in-progress' ? 'secondary' : 'outline'
                          }>
                            {task.status === 'completed' ? '已完成' :
                              task.status === 'in-progress' ? '进行中' : '待发布'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {task.content?.substring(0, 100)}...
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>📅 {task.scheduledTime}</span>
                          <span>•</span>
                          <span>📝 {task.type}</span>
                          {task.image_urls?.length > 0 && (
                            <>
                              <span>•</span>
                              <span>🖼️ {task.image_urls.length} 张图片</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activities */}
          {dashboardData.activities && dashboardData.activities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>📊 实时活动</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dashboardData.activities.map((activity: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">{activity.timestamp}</span>
                      <span>{activity.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
