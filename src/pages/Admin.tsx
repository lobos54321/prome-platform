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

export default function Admin() {
  const navigate = useNavigate();
  const [user, setUser] = useState(authService.getCurrentUserSync());
  const [activeTab, setActiveTab] = useState('models');

  useEffect(() => {
    // Listen for auth state changes
    const handleAuthChange = (event: CustomEvent) => {
      setUser(event.detail.user);
    };

    window.addEventListener('auth-state-changed', handleAuthChange as EventListener);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange as EventListener);
    };
  }, []);

  // Redirect non-admin users
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
          <TabsTrigger value="points">积分计算器</TabsTrigger>
          <TabsTrigger value="webhook">Webhook配置</TabsTrigger>
          <TabsTrigger value="users">用户管理</TabsTrigger>
          <TabsTrigger value="services">服务管理</TabsTrigger>
          <TabsTrigger value="stats">平台统计</TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <ModelManagement />
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