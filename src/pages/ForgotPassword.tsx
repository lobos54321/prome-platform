import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { authService } from '@/lib/auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    if (!email) {
      setError('请输入邮箱地址');
      setIsLoading(false);
      return;
    }

    // 检查邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('请输入有效的邮箱地址');
      setIsLoading(false);
      return;
    }

    try {
      // 检查 Supabase 配置
      const isSupabaseConfigured = 
        import.meta.env.VITE_SUPABASE_URL && 
        import.meta.env.VITE_SUPABASE_ANON_KEY &&
        import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder-supabase-url.supabase.co';

      if (!isSupabaseConfigured) {
        setError('系统配置错误：认证服务未正确配置。请联系系统管理员。');
        return;
      }

      await authService.resetPassword(email);
      setEmailSent(true);
      setMessage('重置邮件已发送到您的邮箱，请查收并按照邮件中的说明重置密码。');
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.message?.includes('User not found')) {
        setError('该邮箱地址未注册');
      } else {
        setError('发送重置邮件失败，请稍后重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold">邮件已发送</CardTitle>
            <CardDescription>
              重置密码的邮件已发送到您的邮箱
            </CardDescription>
          </CardHeader>
          <CardContent>
            {message && (
              <Alert className="mb-4">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            <div className="text-center text-sm text-gray-600 space-y-2">
              <p>请检查您的邮箱（包括垃圾邮件文件夹）</p>
              <p>按照邮件中的说明重置您的密码</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Link to="/login" className="w-full">
              <Button className="w-full">
                返回登录
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              onClick={() => {
                setEmailSent(false);
                setMessage('');
                setEmail('');
              }}
              className="w-full"
            >
              重新发送
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <Link to="/login">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回登录
            </Button>
          </Link>
          <CardTitle className="text-2xl font-bold text-center">忘记密码</CardTitle>
          <CardDescription className="text-center">
            输入您的邮箱地址，我们将发送重置密码的链接
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="请输入您的邮箱地址"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? '发送中...' : '发送重置邮件'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center">
          <p className="text-sm text-gray-600">
            想起密码了？{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              立即登录
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}