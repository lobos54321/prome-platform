import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';
import { authService } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import ModelManagement from './Admin/ModelManagement';
import WebhookConfig from './Admin/WebhookConfig';
import PointsCalculator from './Admin/PointsCalculator';
import TokenConsumptionMonitor from './Admin/TokenConsumptionMonitor';

export default function Admin() {
  const navigate = useNavigate();
  const [user, setUser] = useState(authService.getCurrentUserSync());
  const [activeTab, setActiveTab] = useState('models');
  const [isLoading, setIsLoading] = useState(!user); // Show loading if no user initially
  const [authChecked, setAuthChecked] = useState(!!user); // Track if auth has been checked

  useEffect(() => {
    // If we don't have a user initially, try to get current user
    const initializeAuth = async () => {
      if (!user) {
        console.log('Admin page: No user found, checking auth...');
        try {
          const currentUser = await authService.getCurrentUser();
          console.log('Admin page: Auth check result:', currentUser ? 'User found' : 'No user');
          setUser(currentUser);
        } catch (error) {
          console.error('Admin page: Auth check failed:', error);
          setUser(null);
        } finally {
          setIsLoading(false);
          setAuthChecked(true);
        }
      } else {
        setAuthChecked(true);
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [user]);

  useEffect(() => {
    // Listen for auth state changes
    const handleAuthChange = (event: CustomEvent) => {
      console.log('Admin page: Auth state changed:', event.detail.user ? 'User logged in' : 'User logged out');
      setUser(event.detail.user);
      setAuthChecked(true);
      setIsLoading(false);
    };

    window.addEventListener('auth-state-changed', handleAuthChange as EventListener);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange as EventListener);
    };
  }, []);

  // Show loading state while checking authentication
  if (isLoading || !authChecked) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">验证管理员权限中...</p>
          </div>
        </div>
      </div>
    );
  }

  // Redirect non-authenticated users
  if (!user) {
    console.log('Admin page: No authenticated user, redirecting to login');
    navigate('/login');
    return null;
  }

  // Check admin privileges with detailed logging
  const userIsAdmin = isAdmin(user);
  console.log('Admin page: Checking admin status for user:', user.email, 'Is admin:', userIsAdmin);

  if (!userIsAdmin) {
    console.log('Admin page: User is not admin, showing access denied');
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            您没有访问管理后台的权限。只有管理员可以访问此页面。
            <div className="mt-2 text-sm opacity-75">
              当前账户: {user.email}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  console.log('Admin page: Access granted for admin user:', user.email);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <h1 className="text-3xl font-bold">管理后台</h1>
        </div>
        <p className="text-gray-600">平台管理和配置 • 仅限管理员访问</p>
        <div className="mt-2 text-sm text-gray-500">
          当前管理员：{user.email}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="models">模型管理</TabsTrigger>
          <TabsTrigger value="consumption">消耗监控</TabsTrigger>
          <TabsTrigger value="points">积分计算器</TabsTrigger>
          <TabsTrigger value="webhook">Webhook配置</TabsTrigger>
          <TabsTrigger value="users">用户管理</TabsTrigger>
          <TabsTrigger value="services">服务管理</TabsTrigger>
          <TabsTrigger value="stats">平台统计</TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <ModelManagement />
        </TabsContent>

        <TabsContent value="consumption">
          <TokenConsumptionMonitor />
        </TabsContent>
        
        <TabsContent value="points">
          <PointsCalculator />
        </TabsContent>
        
        <TabsContent value="webhook">
          <WebhookConfig />
        </TabsContent>

        <TabsContent value="users">
          <div className="text-center py-12">
            <p className="text-xl text-gray-500">用户管理功能正在开发中</p>
          </div>
        </TabsContent>

        <TabsContent value="services">
          <div className="text-center py-12">
            <p className="text-xl text-gray-500">服务管理功能正在开发中</p>
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <div className="text-center py-12">
            <p className="text-xl text-gray-500">平台统计功能正在开发中</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}