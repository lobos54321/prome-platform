import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authService } from '@/lib/auth';
import ModelManagement from './Admin/ModelManagement';
import WebhookConfig from './Admin/WebhookConfig';

export default function Admin() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [activeTab, setActiveTab] = useState('models');

  // Redirect non-admin users
  if (!user || user.role !== 'admin') {
    navigate('/');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">管理后台</h1>
        <p className="text-gray-600">平台管理和配置</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="models">模型管理</TabsTrigger>
          <TabsTrigger value="webhook">Webhook配置</TabsTrigger>
          <TabsTrigger value="users">用户管理</TabsTrigger>
          <TabsTrigger value="services">服务管理</TabsTrigger>
          <TabsTrigger value="stats">平台统计</TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <ModelManagement />
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