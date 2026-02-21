import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';
import { authService } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import ModelManagement from './Admin/ModelManagement';
import TokenConsumptionMonitor from './Admin/TokenConsumptionMonitor';
import RechargePackageManagement from './Admin/RechargePackageManagement';
import AdminDebugTools from './Admin/AdminDebugTools';
import { WorkflowDiagnostics } from '@/components/WorkflowDiagnostics';

export default function Admin() {
  const navigate = useNavigate();
  const [user, setUser] = useState(authService.getCurrentUserSync());
  const [activeTab, setActiveTab] = useState('models');
  const [isLoading, setIsLoading] = useState(true);
  
  // Check if Dify integration is enabled via environment variable
  const isDifyEnabled = import.meta.env.VITE_ENABLE_DIFY_INTEGRATION === 'true';

  useEffect(() => {
    // Initialize auth state and set loading
    const initializeAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to get current user:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const handleAuthChange = (event: CustomEvent) => {
      setUser(event.detail.user);
      setIsLoading(false);
    };

    window.addEventListener('auth-state-changed', handleAuthChange as EventListener);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange as EventListener);
    };
  }, []);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">验证管理员权限...</p>
          </div>
        </div>
      </div>
    );
  }

  // Redirect non-authenticated users
  if (!user) {
    navigate('/login');
    return null;
  }

  if (!isAdmin(user)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            您没有访问管理后台的权限。只有管理员可以访问此页面。
            <br />
            <span className="text-sm text-gray-600 mt-2 block">
              当前用户：{user.email}
            </span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

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
          <TabsTrigger value="recharge">充值方案</TabsTrigger>
          {isDifyEnabled && <TabsTrigger value="consumption">消耗监控</TabsTrigger>}
          {isDifyEnabled && <TabsTrigger value="workflow-diagnostics">工作流诊断</TabsTrigger>}
          <TabsTrigger value="users">用户管理</TabsTrigger>
          <TabsTrigger value="services">服务管理</TabsTrigger>
          <TabsTrigger value="stats">平台统计</TabsTrigger>
          <TabsTrigger value="debug">调试工具</TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <ModelManagement />
        </TabsContent>

        <TabsContent value="recharge">
          <RechargePackageManagement />
        </TabsContent>

        {isDifyEnabled && (
          <TabsContent value="consumption">
            <TokenConsumptionMonitor />
          </TabsContent>
        )}

        {isDifyEnabled && (
          <TabsContent value="workflow-diagnostics">
            <WorkflowDiagnostics />
          </TabsContent>
        )}

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

        <TabsContent value="debug">
          <AdminDebugTools />
        </TabsContent>
      </Tabs>
    </div>
  );
}