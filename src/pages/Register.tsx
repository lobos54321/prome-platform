import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Loader2 } from 'lucide-react';
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
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
    
    setIsLoading(true);
    try {
      await authService.register(formData.name, formData.email, formData.password);
      navigate('/services');
    } catch (err) {
      setError('注册失败，请稍后重试或更换邮箱');
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
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="terms" 
                checked={agreedTerms}
                onCheckedChange={(checked) => setAgreedTerms(checked as boolean)}
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