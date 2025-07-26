import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { authService } from '@/lib/auth';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDebugInfo('');
    
    // 检查 Supabase 配置
    const isSupabaseConfigured = 
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY &&
      import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder-supabase-url.supabase.co';

    if (!isSupabaseConfigured) {
      setError('系统配置错误：Supabase 未正确配置。请联系系统管理员。');
      setDebugInfo(`配置状态: URL=${import.meta.env.VITE_SUPABASE_URL ? '已设置' : '未设置'}, KEY=${import.meta.env.VITE_SUPABASE_ANON_KEY ? '已设置' : '未设置'}`);
      return;
    }
    
    if (!agreedTerms) {
      setError('请同意服务条款和隐私政策');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (formData.password.length < 8) {
      setError('密码长度至少为8个字符');
      return;
    }

    // 检查邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('请输入有效的邮箱地址');
      return;
    }
    
    setIsLoading(true);
    setDebugInfo('正在注册用户...');

    try {
      console.log('Starting registration process...');
      const user = await authService.register(formData.email, formData.password, formData.name);
      
      if (user) {
        setDebugInfo('注册成功！正在跳转...');
        // 给用户一点时间看到成功消息
        setTimeout(() => {
          navigate('/services');
        }, 1000);
      } else {
        setError('注册失败：无法创建用户账户。请检查邮箱是否已被使用。');
        setDebugInfo('注册返回空用户对象');
      }
    } catch (err: unknown) {
      console.error('Registration error:', err);
      
      let errorMessage = '注册失败，请稍后重试';
      
      if (err instanceof Error) {
        if (err.message?.includes('already registered')) {
          errorMessage = '该邮箱已被注册，请使用其他邮箱或直接登录';
        } else if (err.message?.includes('Invalid email')) {
          errorMessage = '邮箱格式不正确，请检查后重试';
        } else if (err.message?.includes('Password should be at least')) {
          errorMessage = '密码长度不足，请设置至少8位密码';
        } else if (err.message?.includes('relation "users" does not exist')) {
          errorMessage = '系统数据库配置错误，请联系管理员';
          setDebugInfo('数据库表未创建');
        } else if (err.message?.includes('duplicate key')) {
          errorMessage = '该邮箱已被注册，请使用其他邮箱';
        }
      }
      
      setError(errorMessage);
      setDebugInfo(`错误详情: ${err.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">创建账号</CardTitle>
          <CardDescription>
            注册Dify商业化平台账号
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                {debugInfo && (
                  <details className="mt-2 text-xs">
                    <summary>调试信息</summary>
                    <pre className="mt-1 whitespace-pre-wrap">{debugInfo}</pre>
                  </details>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          {debugInfo && !error && (
            <Alert className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {debugInfo}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                name="name"
                placeholder="您的名字"
                required
                value={formData.name}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="terms" 
                checked={agreedTerms}
                onCheckedChange={(checked) => setAgreedTerms(checked as boolean)}
                disabled={isLoading}
              />
              <label
                htmlFor="terms"
                className="text-sm text-gray-600"
              >
                我同意{' '}
                <Link to="/terms" className="text-blue-600 hover:underline">
                  服务条款
                </Link>
                {' '}和{' '}
                <Link to="/privacy" className="text-blue-600 hover:underline">
                  隐私政策
                </Link>
              </label>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  注册中...
                </>
              ) : (
                '注册'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-600">
            已有账号?{' '}
            <Link to="/login" className="text-blue-600 hover:underline">
              立即登录
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
