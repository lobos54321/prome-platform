import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';
import ModelManagement from './Admin/ModelManagement';
import TokenConsumptionMonitor from './Admin/TokenConsumptionMonitor';
import PointsCalculator from './Admin/PointsCalculator';
import WebhookConfig from './Admin/WebhookConfig';

export default function AdminDemo() {
  const [activeTab, setActiveTab] = useState('consumption');

  // Mock admin user for demo
  const mockAdmin = {
    id: 'demo-admin-123',
    name: 'Demo Admin',
    email: 'admin@demo.com',
    role: 'admin' as const,
    balance: 10000,
    createdAt: new Date().toISOString()
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <h1 className="text-3xl font-bold">管理后台演示</h1>
        </div>
        <p className="text-gray-600">Dify Token 消耗监控系统 • 演示环境</p>
        <div className="mt-2 text-sm text-gray-500">
          演示管理员：{mockAdmin.email}
        </div>
        <Alert className="mt-4 bg-blue-50 border-blue-200">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            这是一个演示环境，显示的是模拟数据。在生产环境中，这些功能会连接到真实的数据库和 Dify API。
          </AlertDescription>
        </Alert>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="consumption">🔍 消耗监控</TabsTrigger>
          <TabsTrigger value="models">⚙️ 模型管理</TabsTrigger>
          <TabsTrigger value="points">🧮 积分计算器</TabsTrigger>
          <TabsTrigger value="webhook">🔗 Webhook配置</TabsTrigger>
        </TabsList>

        <TabsContent value="consumption">
          <TokenConsumptionMonitor />
        </TabsContent>

        <TabsContent value="models">
          <ModelManagement />
        </TabsContent>
        
        <TabsContent value="points">
          <PointsCalculator />
        </TabsContent>
        
        <TabsContent value="webhook">
          <WebhookConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}