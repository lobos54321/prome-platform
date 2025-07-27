import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, InfoIcon, Loader2, Save, DollarSign } from 'lucide-react';
import { isDifyEnabled } from '@/api/dify-api';
import { authService } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { ModelConfig } from '@/types';
import { toast } from 'sonner';

export default function ModelManagement() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [newModelName, setNewModelName] = useState('');
  const [newInputPrice, setNewInputPrice] = useState(0.05);
  const [newOutputPrice, setNewOutputPrice] = useState(0.1);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (isDifyEnabled()) {
      loadData();
    }
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const modelConfigs = await db.getModelConfigs();
      setModels(modelConfigs);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('加载数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const addModel = async () => {
    if (!newModelName.trim()) {
      toast.error('请输入模型名称');
      return;
    }

    try {
      setIsAdding(true);
      const user = await authService.getCurrentUser();
      if (!user) {
        toast.error('用户认证失败');
        return;
      }

      const newModel = await db.addModelConfig(
        newModelName.trim(),
        newInputPrice,
        newOutputPrice,
        user.id
      );

      if (newModel) {
        setModels([newModel, ...models]);
        setNewModelName('');
        setNewInputPrice(0.05);
        setNewOutputPrice(0.1);
        toast.success('模型添加成功');
      } else {
        toast.error('添加模型失败');
      }
    } catch (error) {
      console.error('Error adding model:', error);
      toast.error('添加模型失败');
    } finally {
      setIsAdding(false);
    }
  };

  const toggleModel = async (id: string) => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        toast.error('用户认证失败');
        return;
      }

      const model = models.find(m => m.id === id);
      if (!model) return;

      const updatedModel = await db.updateModelConfig(
        id,
        { isActive: !model.isActive },
        user.id
      );

      if (updatedModel) {
        setModels(models.map(m => m.id === id ? updatedModel : m));
        toast.success(`模型已${updatedModel.isActive ? '启用' : '禁用'}`);
      } else {
        toast.error('更新模型状态失败');
      }
    } catch (error) {
      console.error('Error toggling model:', error);
      toast.error('更新模型状态失败');
    }
  };

  if (!isDifyEnabled()) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">模型管理</h2>
            <p className="text-gray-500">Dify集成已禁用</p>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <InfoIcon className="h-5 w-5" />
              模型管理不可用
            </CardTitle>
            <CardDescription>
              Dify集成功能已禁用，无法管理模型配置
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                要启用此功能，请在环境变量中设置 VITE_ENABLE_DIFY_INTEGRATION=true
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">模型管理</h2>
            <p className="text-gray-500">加载中...</p>
          </div>
        </div>
        
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">模型管理</h2>
          <p className="text-gray-500">管理AI模型配置和定价</p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5" />
                添加新模型
              </CardTitle>
              <CardDescription>
                配置新的AI模型和定价 (价格单位: USD/1000 tokens)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modelName">模型名称</Label>
                <Input
                  id="modelName"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="例如: GPT-4"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inputPrice">输入价格 (USD/1000 tokens)</Label>
                  <Input
                    id="inputPrice"
                    type="number"
                    step="0.001"
                    min="0"
                    value={newInputPrice}
                    onChange={(e) => setNewInputPrice(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outputPrice">输出价格 (USD/1000 tokens)</Label>
                  <Input
                    id="outputPrice"
                    type="number"
                    step="0.001"
                    min="0"
                    value={newOutputPrice}
                    onChange={(e) => setNewOutputPrice(Number(e.target.value))}
                  />
                </div>
              </div>
              
              <Button onClick={addModel} className="w-full" disabled={isAdding}>
                {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                添加模型
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>现有模型</CardTitle>
              <CardDescription>
                管理已配置的AI模型 ({models.length} 个模型)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {models.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>暂无模型配置</p>
                    <p className="text-sm">请添加第一个模型配置</p>
                  </div>
                ) : (
                  models.map((model) => (
                    <div key={model.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium">{model.modelName}</div>
                          <div className="text-sm text-gray-500">
                            输入: ${model.inputTokenPrice}/1K • 输出: ${model.outputTokenPrice}/1K
                          </div>
                          <div className="text-xs text-gray-400">
                            约 {Math.round(model.inputTokenPrice * exchangeRate)} / {Math.round(model.outputTokenPrice * exchangeRate)} 积分/1K tokens
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={model.isActive ? "default" : "secondary"}>
                          {model.isActive ? '已启用' : '已禁用'}
                        </Badge>
                        <Switch
                          checked={model.isActive}
                          onCheckedChange={() => toggleModel(model.id)}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}