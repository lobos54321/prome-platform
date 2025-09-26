import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { authService } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
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
    setIsLoading(true);
    
    try {
      const user = await authService.login(formData.email, formData.password);
      
      if (user) {
        console.log('Login successful for user:', user.email);
        
        // 智能重定向：管理员用户跳转到管理后台，普通用户跳转到控制台
        if (isAdmin(user)) {
          console.log('Redirecting admin user to admin panel');
          navigate('/admin');
        } else {
          console.log('Redirecting regular user to dashboard');
          navigate('/dashboard');
        }
      } else {
        setError(t('errors.authentication_failed', 'Authentication failed'));
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(t('errors.authentication_failed', 'Authentication failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">{t('auth.login', 'Login')}</CardTitle>
          <CardDescription>
            {t('auth.email', 'Email')} and {t('auth.password', 'Password')}
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
              <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('auth.password', 'Password')}</Label>
                <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                  {t('auth.forgot_password', 'Forgot Password?')}
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? `${t('auth.login', 'Login')}...` : t('auth.login', 'Login')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-600">
            {t('auth.dont_have_account', "Don't have an account?")}{' '}
            <Link to="/register" className="text-blue-600 hover:underline">
              {t('auth.sign_up', 'Sign Up')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}