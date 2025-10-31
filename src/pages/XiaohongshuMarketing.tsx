import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  LogIn,
  UserPlus,
  Send,
  Key,
  TrendingUp,
  FileText,
  BarChart
} from 'lucide-react';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-api';

export default function XiaohongshuMarketing() {
  const [activeTab, setActiveTab] = useState('auth');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  // 认证表单
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
    name: ''
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // 内容生成表单
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  useEffect(() => {
    // 检查是否已登录
    if (xiaohongshuAPI.isAuthenticated()) {
      setIsAuthenticated(true);
      loadUserInfo();
      setActiveTab('generate');
    }
  }, []);

  const loadUserInfo = async () => {
    try {
      const profileRes = await xiaohongshuAPI.getUserProfile();
      setUserInfo(profileRes.data);

      const statsRes = await xiaohongshuAPI.getUserStats();
      setStats(statsRes.data);
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  };

  const handleAuthInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAuthForm({
      ...authForm,
      [e.target.name]: e.target.value
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      const response = await xiaohongshuAPI.register(
        authForm.username,
        authForm.email,
        authForm.password,
        authForm.name
      );

      if (response.code === 201) {
        setAuthSuccess('注册成功！');
        setIsAuthenticated(true);
        setUserInfo(response.data.user);
        setTimeout(() => {
          setActiveTab('generate');
        }, 1000);
      }
    } catch (error: any) {
      setAuthError(error.message || '注册失败，请重试');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      const response = await xiaohongshuAPI.login(
        authForm.username,
        authForm.password
      );

      if (response.code === 200) {
        setAuthSuccess('登录成功！');
        setIsAuthenticated(true);
        setUserInfo(response.data.user);
        loadUserInfo();
        setTimeout(() => {
          setActiveTab('generate');
        }, 1000);
      }
    } catch (error: any) {
      setAuthError(error.message || '登录失败，请检查用户名和密码');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    xiaohongshuAPI.clearAuth();
    setIsAuthenticated(false);
    setUserInfo(null);
    setStats(null);
    setActiveTab('auth');
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setGenerateError('');
    setGeneratedContent('');

    try {
      const response = await xiaohongshuAPI.processWithApiKey(prompt);

      if (response.code === 200) {
        setGeneratedContent(response.data.content);
      } else {
        setGenerateError(response.message || '生成失败');
      }
    } catch (error: any) {
      setGenerateError(error.message || '生成失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">小红书自动运营</h1>
        <p className="text-muted-foreground">
          AI 驱动的小红书内容创作和运营平台
        </p>
      </div>

      {isAuthenticated && userInfo && (
        <Card className="mb-6 bg-gradient-to-r from-red-50 to-pink-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center text-white text-xl font-bold">
                  {userInfo.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="font-semibold text-lg">{userInfo.name}</p>
                  <p className="text-sm text-muted-foreground">{userInfo.email}</p>
                  <Badge variant="secondary" className="mt-1">
                    {userInfo.plan === 'free' ? '免费版' : userInfo.plan === 'pro' ? '专业版' : '企业版'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="flex items-center space-x-2 mb-1">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">API Key</span>
                  </div>
                  <code className="text-xs bg-white px-2 py-1 rounded border">
                    {userInfo.api_key?.substring(0, 20)}...
                  </code>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  退出登录
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="auth" disabled={isAuthenticated}>
            <LogIn className="h-4 w-4 mr-2" />
            认证
          </TabsTrigger>
          <TabsTrigger value="generate" disabled={!isAuthenticated}>
            <FileText className="h-4 w-4 mr-2" />
            内容生成
          </TabsTrigger>
          <TabsTrigger value="stats" disabled={!isAuthenticated}>
            <BarChart className="h-4 w-4 mr-2" />
            数据统计
          </TabsTrigger>
          <TabsTrigger value="settings" disabled={!isAuthenticated}>
            <TrendingUp className="h-4 w-4 mr-2" />
            设置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="auth" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* 登录表单 */}
            <Card>
              <CardHeader>
                <CardTitle>登录</CardTitle>
                <CardDescription>使用现有账号登录</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-username">用户名</Label>
                    <Input
                      id="login-username"
                      name="username"
                      value={authForm.username}
                      onChange={handleAuthInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">密码</Label>
                    <Input
                      id="login-password"
                      name="password"
                      type="password"
                      value={authForm.password}
                      onChange={handleAuthInputChange}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        登录中...
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        登录
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* 注册表单 */}
            <Card>
              <CardHeader>
                <CardTitle>注册</CardTitle>
                <CardDescription>创建新账号</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label htmlFor="register-username">用户名</Label>
                    <Input
                      id="register-username"
                      name="username"
                      value={authForm.username}
                      onChange={handleAuthInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-email">邮箱</Label>
                    <Input
                      id="register-email"
                      name="email"
                      type="email"
                      value={authForm.email}
                      onChange={handleAuthInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-name">姓名</Label>
                    <Input
                      id="register-name"
                      name="name"
                      value={authForm.name}
                      onChange={handleAuthInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-password">密码</Label>
                    <Input
                      id="register-password"
                      name="password"
                      type="password"
                      value={authForm.password}
                      onChange={handleAuthInputChange}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        注册中...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        注册
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {authError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}

          {authSuccess && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700">{authSuccess}</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI 内容生成</CardTitle>
              <CardDescription>
                输入您的需求，AI 将为您生成小红书内容
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <Label htmlFor="prompt">内容需求</Label>
                  <Textarea
                    id="prompt"
                    placeholder="例如：帮我生成一篇关于秋季护肤的小红书笔记，要包含产品推荐..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    required
                  />
                </div>
                <Button type="submit" disabled={generating} className="w-full">
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      生成内容
                    </>
                  )}
                </Button>
              </form>

              {generateError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{generateError}</AlertDescription>
                </Alert>
              )}

              {generatedContent && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <Label>生成的内容</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedContent)}
                    >
                      复制
                    </Button>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border">
                    <pre className="whitespace-pre-wrap text-sm">
                      {generatedContent}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">总使用次数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total_usage || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  本月使用次数
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">成功率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.success_rate ? `${stats.success_rate}%` : '100%'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  API 调用成功率
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">账户状态</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="text-lg">
                  {userInfo?.status === 'active' ? '正常' : '已停用'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  账户运行状态
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>使用历史</CardTitle>
              <CardDescription>最近的 API 调用记录</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                暂无历史记录
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API 配置</CardTitle>
              <CardDescription>管理您的 API 密钥和访问权限</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>API Key</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <Input
                    value={userInfo?.api_key || ''}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(userInfo?.api_key || '')}
                  >
                    复制
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  使用此 API Key 可以直接调用接口，无需登录
                </p>
              </div>

              <div>
                <Label>API 端点</Label>
                <Input
                  value="https://xiaohongshu-proxy-k8j5.zeabur.app/api/v1"
                  readOnly
                  className="mt-2 font-mono text-sm"
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  请妥善保管您的 API Key，不要泄露给他人
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
