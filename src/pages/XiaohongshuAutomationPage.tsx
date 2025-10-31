import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, Loader2, Settings, BarChart3, Calendar, Users, WifiOff, Database } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { xiaohongshuApi } from '@/api/xiaohongshu';
import { xiaohongshuDb } from '@/lib/xiaohongshu-db';
import { toast } from 'sonner';

interface UserConfig {
  productName: string;
  targetAudience: string;
  marketingGoal: 'brand' | 'sales' | 'engagement' | 'traffic';
  postFrequency: 'daily' | 'twice-daily' | 'high-freq';
  brandStyle: 'warm' | 'professional' | 'trendy' | 'funny';
  reviewMode: 'auto' | 'review' | 'edit';
}

interface AutomationStatus {
  isRunning: boolean;
  isLoggedIn: boolean;
  hasConfig: boolean;
  lastActivity?: string;
  uptime: number;
}

interface PerformanceStats {
  todayPosts: number;
  plannedPosts: number;
  weeklyReads: number;
  newFollowers: number;
  engagementRate: number;
}

interface BackendHealth {
  available: boolean;
  lastChecked?: Date;
  error?: string;
}

const XiaohongshuAutomationPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [xiaohongshuUserId, setXiaohongshuUserId] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isShowingQR, setIsShowingQR] = useState(false);
  const [qrLoginPolling, setQrLoginPolling] = useState<NodeJS.Timeout | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendHealth>({
    available: false,
  });
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus>({
    isRunning: false,
    isLoggedIn: false,
    hasConfig: false,
    uptime: 0
  });
  const [userConfig, setUserConfig] = useState<UserConfig>({
    productName: '',
    targetAudience: '',
    marketingGoal: 'brand',
    postFrequency: 'daily',
    brandStyle: 'warm',
    reviewMode: 'auto'
  });
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    todayPosts: 0,
    plannedPosts: 0,
    weeklyReads: 0,
    newFollowers: 0,
    engagementRate: 0
  });
  const [activities, setActivities] = useState<Array<{message: string, timestamp: string}>>([]);

  // 检查用户认证
  useEffect(() => {
    // 等待认证加载完成
    if (authLoading) return;

    if (!user) {
      toast.error('请先登录');
      navigate('/login');
      return;
    }

    initializeAutomation();
  }, [user, authLoading, navigate]);

  // 生成稳定的小红书用户ID
  const generateXiaohongshuUserId = (supabaseId: string): string => {
    // 使用Supabase ID的hash生成稳定的用户ID
    const cleanId = supabaseId.replace(/-/g, '').substring(0, 16);
    return `user_${cleanId}_prome`;
  };

  // 检查后端健康状态
  const checkBackendHealth = async (): Promise<boolean> => {
    try {
      const isHealthy = await xiaohongshuApi.healthCheck();
      setBackendHealth({
        available: isHealthy,
        lastChecked: new Date(),
      });
      return isHealthy;
    } catch (error) {
      console.error('Backend health check failed:', error);
      setBackendHealth({
        available: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  };

  // 初始化小红书自动化状态
  const initializeAutomation = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 生成兼容后端的用户ID格式
      const userId = generateXiaohongshuUserId(user.id);
      setXiaohongshuUserId(userId);
      console.log('🔍 初始化小红书自动化');
      console.log('📝 Supabase UUID:', user.id);
      console.log('📝 小红书用户ID:', userId);

      // 创建或获取用户映射
      await xiaohongshuDb.getOrCreateUserMapping(user.id, userId);
      console.log('✅ 用户映射已创建/获取');

      // 记录初始化活动
      await xiaohongshuDb.logActivity({
        supabase_uuid: user.id,
        xhs_user_id: userId,
        activity_type: 'system',
        message: '初始化小红书自动化系统',
      });

      // 检查后端健康状态
      const isBackendHealthy = await checkBackendHealth();

      if (!isBackendHealthy) {
        toast.warning('后端服务暂时不可用，将使用本地模式', {
          description: '部分功能可能受限，但您可以查看和编辑配置',
        });
      }

      // 从数据库加载状态
      const dbStatus = await xiaohongshuDb.getAutomationStatus(user.id);
      const dbProfile = await xiaohongshuDb.getUserProfile(user.id);

      // 如果后端可用，尝试获取实时状态
      if (isBackendHealthy) {
        try {
          const loginStatus = await xiaohongshuApi.checkLoginStatus(userId);
          const configStatus = await xiaohongshuApi.getConfiguration(userId);
          const runningStatus = await xiaohongshuApi.getAutomationStatus(userId);

          // 更新状态到数据库
          await xiaohongshuDb.upsertAutomationStatus({
            supabase_uuid: user.id,
            xhs_user_id: userId,
            is_logged_in: loginStatus.logged_in,
            has_config: !!configStatus.strategy,
            is_running: runningStatus.isRunning,
            last_activity: runningStatus.lastActivity,
            uptime_seconds: runningStatus.uptime || 0,
          });

          setAutomationStatus({
            isLoggedIn: loginStatus.logged_in,
            hasConfig: !!configStatus.strategy,
            isRunning: runningStatus.isRunning,
            lastActivity: runningStatus.lastActivity,
            uptime: runningStatus.uptime || 0,
          });

          if (configStatus.strategy) {
            setUserConfig(configStatus.strategy);
          }
        } catch (error) {
          console.warn('获取后端状态失败，使用数据库状态:', error);
          // 使用数据库状态作为后备
          if (dbStatus) {
            setAutomationStatus({
              isLoggedIn: dbStatus.is_logged_in || false,
              hasConfig: dbStatus.has_config || false,
              isRunning: dbStatus.is_running || false,
              lastActivity: dbStatus.last_activity,
              uptime: dbStatus.uptime_seconds || 0,
            });
          }
        }
      } else {
        // 后端不可用，使用数据库状态
        if (dbStatus) {
          setAutomationStatus({
            isLoggedIn: dbStatus.is_logged_in || false,
            hasConfig: dbStatus.has_config || false,
            isRunning: false, // 后端不可用时强制为false
            lastActivity: dbStatus.last_activity,
            uptime: dbStatus.uptime_seconds || 0,
          });
        }
      }

      // 加载用户配置
      if (dbProfile) {
        setUserConfig({
          productName: dbProfile.product_name,
          targetAudience: dbProfile.target_audience || '',
          marketingGoal: (dbProfile.marketing_goal as any) || 'brand',
          postFrequency: (dbProfile.post_frequency as any) || 'daily',
          brandStyle: (dbProfile.brand_style as any) || 'warm',
          reviewMode: (dbProfile.review_mode as any) || 'auto',
        });
      }

      // 加载活动记录
      await loadActivitiesFromDb();

    } catch (error) {
      console.error('初始化失败:', error);
      toast.error('初始化小红书自动化失败', {
        description: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setLoading(false);
    }
  };

  // 从数据库加载活动记录
  const loadActivitiesFromDb = async () => {
    if (!user) return;
    try {
      const logs = await xiaohongshuDb.getRecentActivities(user.id, 20);
      const formattedActivities = logs.map(log => ({
        message: log.message,
        timestamp: new Date(log.created_at!).toLocaleString('zh-CN'),
      }));
      setActivities(formattedActivities);
    } catch (error) {
      console.error('加载活动记录失败:', error);
    }
  };

  // 加载运营数据
  const loadPerformanceData = async () => {
    if (!xiaohongshuUserId) return;
    try {
      const stats = await xiaohongshuApi.getPerformanceStats(xiaohongshuUserId);
      setPerformanceStats(stats);
    } catch (error) {
      console.error('加载运营数据失败:', error);
    }
  };

  // 加载活动记录
  const loadActivities = async () => {
    if (!xiaohongshuUserId) return;
    try {
      const activityData = await xiaohongshuApi.getActivities(xiaohongshuUserId);
      setActivities(activityData);
    } catch (error) {
      console.error('加载活动记录失败:', error);
    }
  };

  // 停止二维码登录轮询
  const stopQRLoginPolling = () => {
    if (qrLoginPolling) {
      clearInterval(qrLoginPolling);
      setQrLoginPolling(null);
    }
  };

  // 开始二维码登录轮询
  const startQRLoginPolling = () => {
    stopQRLoginPolling(); // 先清除可能存在的定时器

    const interval = setInterval(async () => {
      try {
        console.log('🔍 轮询检查登录状态...');
        const result = await xiaohongshuApi.checkLoginStatus(xiaohongshuUserId);

        if (result.logged_in === true) {
          console.log('✅ 登录成功！');
          stopQRLoginPolling();

          setTimeout(() => {
            setIsShowingQR(false);
            setQrCodeUrl('');
            setAutomationStatus(prev => ({ ...prev, isLoggedIn: true }));
            toast.success('小红书账号绑定成功！');
          }, 1500);
        }
      } catch (error) {
        console.error('轮询登录状态失败:', error);
      }
    }, 3000); // 每3秒检查一次

    setQrLoginPolling(interval);
  };

  // 小红书自动登录 - 与原始页面保持一致
  const handleXHSLogin = async () => {
    if (!xiaohongshuUserId) {
      toast.error('用户ID未初始化，请刷新页面重试');
      return;
    }

    if (!backendHealth.available) {
      toast.error('后端服务不可用', {
        description: '请先确保后端服务正常运行后再尝试登录',
      });
      return;
    }

    try {
      console.log('🚀 启动自动登录...');

      // 显示二维码弹窗
      setIsShowingQR(true);
      setQrCodeUrl('');
      toast.info('正在生成二维码...');

      // 调用自动登录API - 使用正确的API
      const result = await xiaohongshuApi.startAutoLogin(xiaohongshuUserId);
      console.log('自动登录响应:', result);

      if (result.qrcode_url) {
        setQrCodeUrl(result.qrcode_url);
        toast.success('请使用小红书APP扫描二维码登录');

        // 开始轮询检查登录状态
        startQRLoginPolling();
      } else {
        throw new Error('未获取到二维码');
      }
    } catch (error) {
      console.error('自动登录失败:', error);
      setIsShowingQR(false);
      toast.error('获取二维码失败，请重试', {
        description: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  // 关闭二维码弹窗
  const closeQRModal = () => {
    setIsShowingQR(false);
    setQrCodeUrl('');
    stopQRLoginPolling();
  };

  // 提交配置并启动自动运营
  const handleSubmitConfig = async () => {
    if (!user) return;
    if (!userConfig.productName.trim()) {
      toast.error('请填写产品/服务信息');
      return;
    }

    try {
      setSubmitting(true);

      // 保存配置到数据库
      await xiaohongshuDb.upsertUserProfile({
        supabase_uuid: user.id,
        xhs_user_id: xiaohongshuUserId,
        product_name: userConfig.productName,
        target_audience: userConfig.targetAudience,
        marketing_goal: userConfig.marketingGoal,
        post_frequency: userConfig.postFrequency,
        brand_style: userConfig.brandStyle,
        review_mode: userConfig.reviewMode,
      });

      // 记录活动
      await xiaohongshuDb.logActivity({
        supabase_uuid: user.id,
        xhs_user_id: xiaohongshuUserId,
        activity_type: 'config',
        message: `配置已保存：${userConfig.productName}`,
        metadata: userConfig,
      });

      // 如果后端可用，尝试启动自动运营
      if (backendHealth.available) {
        try {
          const config = {
            ...userConfig,
            userId: xiaohongshuUserId,
          };

          await xiaohongshuApi.startAutomation(config);

          // 更新状态到数据库
          await xiaohongshuDb.upsertAutomationStatus({
            supabase_uuid: user.id,
            xhs_user_id: xiaohongshuUserId,
            has_config: true,
            is_running: true,
          });

          setAutomationStatus(prev => ({
            ...prev,
            hasConfig: true,
            isRunning: true,
          }));

          toast.success('配置已保存并启动自动运营！');

          // 开始加载运营数据
          await loadPerformanceData();
          await loadActivitiesFromDb();
        } catch (error) {
          console.error('启动自动运营失败:', error);
          toast.warning('配置已保存，但启动自动运营失败', {
            description: '您可以稍后在后端恢复时重试',
          });

          // 更新本地状态
          await xiaohongshuDb.upsertAutomationStatus({
            supabase_uuid: user.id,
            xhs_user_id: xiaohongshuUserId,
            has_config: true,
            is_running: false,
          });

          setAutomationStatus(prev => ({
            ...prev,
            hasConfig: true,
            isRunning: false,
          }));
        }
      } else {
        // 后端不可用，只保存配置
        await xiaohongshuDb.upsertAutomationStatus({
          supabase_uuid: user.id,
          xhs_user_id: xiaohongshuUserId,
          has_config: true,
          is_running: false,
        });

        setAutomationStatus(prev => ({
          ...prev,
          hasConfig: true,
          isRunning: false,
        }));

        toast.success('配置已保存！', {
          description: '后端服务恢复后即可启动自动运营',
        });
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      toast.error('保存配置失败，请重试', {
        description: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 暂停/恢复自动运营
  const handleToggleAutomation = async () => {
    try {
      if (automationStatus.isRunning) {
        await xiaohongshuApi.pauseAutomation(xiaohongshuUserId);
        setAutomationStatus(prev => ({ ...prev, isRunning: false }));
        toast.success('自动运营已暂停');
      } else {
        await xiaohongshuApi.resumeAutomation(xiaohongshuUserId);
        setAutomationStatus(prev => ({ ...prev, isRunning: true }));
        toast.success('自动运营已恢复');
      }
    } catch (error) {
      console.error('切换运营状态失败:', error);
      toast.error('操作失败，请重试');
    }
  };

  // 重置配置
  const handleResetConfig = async () => {
    if (!confirm('确定要重新配置吗？这将停止当前的自动运营。')) {
      return;
    }

    try {
      await xiaohongshuApi.resetConfiguration(xiaohongshuUserId);

      setAutomationStatus(prev => ({
        ...prev,
        hasConfig: false,
        isRunning: false
      }));

      setUserConfig({
        productName: '',
        targetAudience: '',
        marketingGoal: 'brand',
        postFrequency: 'daily',
        brandStyle: 'warm',
        reviewMode: 'auto'
      });

      toast.success('配置已重置');
    } catch (error) {
      console.error('重置配置失败:', error);
      toast.error('重置配置失败，请重试');
    }
  };

  // 定时刷新数据
  useEffect(() => {
    if (!automationStatus.isRunning) return;

    const interval = setInterval(() => {
      loadPerformanceData();
      loadActivities();
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, [automationStatus.isRunning]);

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      stopQRLoginPolling();
    };
  }, []);

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">正在加载小红书自动化...</p>
        </div>
      </div>
    );
  }

  // 设置页面
  if (!automationStatus.isLoggedIn || !automationStatus.hasConfig) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">🤖 小红书全自动运营系统</h1>
          <p className="text-muted-foreground">一次设置，终身自动 - 让AI为你打理一切</p>
        </div>

        {/* Backend Health Status */}
        {!backendHealth.available && (
          <Alert className="mb-6" variant="destructive">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>后端服务暂时不可用</AlertTitle>
            <AlertDescription>
              无法连接到小红书自动化服务器。您仍可以配置和保存设置，服务恢复后可以启动自动运营。
              <div className="mt-2 flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={checkBackendHealth}
                  className="text-xs"
                >
                  重新检测
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Database Status */}
        <Alert className="mb-6" variant="default">
          <Database className="h-4 w-4" />
          <AlertTitle>数据持久化已启用</AlertTitle>
          <AlertDescription>
            您的配置和活动记录将自动保存到数据库，确保数据安全可靠。
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {/* 步骤1：小红书账号绑定 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                小红书账号绑定
              </CardTitle>
              <CardDescription>
                需要绑定您的小红书账号以开始自动运营
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!automationStatus.isLoggedIn ? (
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      请点击下方按钮登录小红书账号。登录成功后，系统会自动检测到您的账号。
                    </AlertDescription>
                  </Alert>
                  <Button onClick={handleXHSLogin} className="w-full">
                    🔗 绑定小红书账号
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span>小红书账号已成功绑定</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 步骤2：产品配置 */}
          <Card className={!automationStatus.isLoggedIn ? 'opacity-50' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className={`w-8 h-8 ${automationStatus.isLoggedIn ? 'bg-purple-500' : 'bg-gray-400'} text-white rounded-full flex items-center justify-center font-bold text-sm`}>2</div>
                产品信息配置
              </CardTitle>
              <CardDescription>
                设置您的产品信息和营销目标
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="productName">产品/服务</Label>
                    <Input
                      id="productName"
                      value={userConfig.productName}
                      onChange={(e) => setUserConfig(prev => ({ ...prev, productName: e.target.value }))}
                      placeholder="例如：手工咖啡店"
                      disabled={!automationStatus.isLoggedIn}
                    />
                  </div>
                  <div>
                    <Label htmlFor="targetAudience">目标客户</Label>
                    <Input
                      id="targetAudience"
                      value={userConfig.targetAudience}
                      onChange={(e) => setUserConfig(prev => ({ ...prev, targetAudience: e.target.value }))}
                      placeholder="例如：25-35岁都市白领"
                      disabled={!automationStatus.isLoggedIn}
                    />
                  </div>
                  <div>
                    <Label htmlFor="marketingGoal">营销目标</Label>
                    <Select
                      value={userConfig.marketingGoal}
                      onValueChange={(value: any) => setUserConfig(prev => ({ ...prev, marketingGoal: value }))}
                      disabled={!automationStatus.isLoggedIn}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brand">品牌知名度</SelectItem>
                        <SelectItem value="sales">销售转化</SelectItem>
                        <SelectItem value="engagement">粉丝互动</SelectItem>
                        <SelectItem value="traffic">店铺引流</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="postFrequency">发布频率</Label>
                    <Select
                      value={userConfig.postFrequency}
                      onValueChange={(value: any) => setUserConfig(prev => ({ ...prev, postFrequency: value }))}
                      disabled={!automationStatus.isLoggedIn}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">每天1篇</SelectItem>
                        <SelectItem value="twice-daily">每天2篇</SelectItem>
                        <SelectItem value="high-freq">每天3-5篇</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="brandStyle">品牌风格</Label>
                    <Select
                      value={userConfig.brandStyle}
                      onValueChange={(value: any) => setUserConfig(prev => ({ ...prev, brandStyle: value }))}
                      disabled={!automationStatus.isLoggedIn}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warm">温暖治愈</SelectItem>
                        <SelectItem value="professional">专业权威</SelectItem>
                        <SelectItem value="trendy">时尚潮流</SelectItem>
                        <SelectItem value="funny">幽默风趣</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="reviewMode">审核模式</Label>
                    <Select
                      value={userConfig.reviewMode}
                      onValueChange={(value: any) => setUserConfig(prev => ({ ...prev, reviewMode: value }))}
                      disabled={!automationStatus.isLoggedIn}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">完全自动</SelectItem>
                        <SelectItem value="review">发布前审核</SelectItem>
                        <SelectItem value="edit">允许编辑</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleSubmitConfig}
                className="w-full mt-6"
                disabled={!automationStatus.isLoggedIn || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    启动中...
                  </>
                ) : (
                  '保存配置并启动自动运营'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 运营仪表板
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* 状态头部 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-1">🤖 自动运营中</h1>
              <p className="text-muted-foreground">Claude正在为您的{userConfig.productName}制定运营策略...</p>
            </div>
            <div className="text-right space-y-2">
              <Badge variant={automationStatus.isRunning ? "default" : "secondary"} className="mb-2">
                {automationStatus.isRunning ? "● 运行中" : "● 已暂停"}
              </Badge>
              <div className="text-sm text-muted-foreground">
                已运行 {Math.floor(automationStatus.uptime / 60)}分钟
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToggleAutomation}
                >
                  {automationStatus.isRunning ? '⏸️ 暂停' : '▶️ 恢复'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetConfig}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  重新配置
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 主要内容 */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">总览</TabsTrigger>
          <TabsTrigger value="analytics">数据分析</TabsTrigger>
          <TabsTrigger value="content">内容管理</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* 性能指标 */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">今日发布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {performanceStats.todayPosts} / {performanceStats.plannedPosts}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">本周阅读</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {performanceStats.weeklyReads}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">新增粉丝</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  +{performanceStats.newFollowers}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">互动率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {performanceStats.engagementRate}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 实时活动 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔴 实时活动
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {activities.length > 0 ? (
                  activities.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm">{activity.message}</span>
                      <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <div>🚀 系统正在运行中</div>
                    <div className="text-xs mt-1">等待执行任务或分析数据...</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                数据分析
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                📊 详细数据分析功能开发中...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                内容管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                📝 内容管理功能开发中...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                设置
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                ⚙️ 高级设置功能开发中...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 二维码登录模态框 */}
      {isShowingQR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96 max-w-sm mx-4">
            <CardHeader>
              <CardTitle className="text-center">扫码登录小红书</CardTitle>
              <CardDescription className="text-center">
                请使用小红书APP扫描下方二维码完成账号绑定
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              {qrCodeUrl ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <img
                      src={qrCodeUrl}
                      alt="小红书登录二维码"
                      className="w-48 h-48 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>📱 打开小红书APP</div>
                    <div>📷 扫描上方二维码</div>
                    <div>✅ 确认登录授权</div>
                  </div>
                </div>
              ) : (
                <div className="py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>正在生成二维码...</p>
                </div>
              )}
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={closeQRModal}
                  className="w-full"
                >
                  取消登录
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default XiaohongshuAutomationPage;