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
import { AlertCircle, CheckCircle, Loader2, Settings, BarChart3, Calendar, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { xiaohongshuApi } from '@/api/xiaohongshu';
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

  // 初始化小红书自动化状态
  const initializeAutomation = async () => {
    try {
      setLoading(true);

      // 生成兼容后端的用户ID格式
      const userId = generateXiaohongshuUserId(user.id);
      setXiaohongshuUserId(userId);
      console.log('🔍 检查小红书自动化状态');
      console.log('📝 Supabase UUID:', user.id);
      console.log('📝 小红书用户ID:', userId);

      // 检查小红书登录状态
      const loginStatus = await xiaohongshuApi.checkLoginStatus(userId);
      console.log('📱 小红书登录状态:', loginStatus);

      // 检查是否有配置
      const configStatus = await xiaohongshuApi.getConfiguration(userId);
      console.log('⚙️ 配置状态:', configStatus);

      // 获取运营状态
      const runningStatus = await xiaohongshuApi.getAutomationStatus(userId);
      console.log('🤖 运营状态:', runningStatus);

      setAutomationStatus({
        isLoggedIn: loginStatus.logged_in,
        hasConfig: !!configStatus.strategy,
        isRunning: runningStatus.isRunning,
        lastActivity: runningStatus.lastActivity,
        uptime: runningStatus.uptime || 0
      });

      // 如果有配置，加载配置和数据
      if (configStatus.strategy) {
        setUserConfig(configStatus.strategy);
        await loadPerformanceData();
        await loadActivities();
      }

    } catch (error) {
      console.error('初始化失败:', error);
      toast.error('初始化小红书自动化失败');
    } finally {
      setLoading(false);
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
      toast.error('获取二维码失败，请重试');
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
    if (!userConfig.productName.trim()) {
      toast.error('请填写产品/服务信息');
      return;
    }

    try {
      setSubmitting(true);

      const config = {
        ...userConfig,
        userId: xiaohongshuUserId
      };

      // 保存配置并启动自动运营
      await xiaohongshuApi.startAutomation(config);

      setAutomationStatus(prev => ({
        ...prev,
        hasConfig: true,
        isRunning: true
      }));

      toast.success('自动运营已启动！');

      // 开始加载运营数据
      await loadPerformanceData();
      await loadActivities();

    } catch (error) {
      console.error('启动自动运营失败:', error);
      toast.error('启动自动运营失败，请重试');
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