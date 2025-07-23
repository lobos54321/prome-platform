import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlusCircle, AlertCircle, Trash2 } from 'lucide-react';
import { PricingRule } from '@/types';
import { servicesAPI } from '@/lib/services';

export default function ModelManagement() {
  const [models, setModels] = useState<PricingRule[]>([]);
  const [newModel, setNewModel] = useState<Partial<PricingRule>>({
    modelName: '',
    inputTokenPrice: 0.0001,
    outputTokenPrice: 0.0002,
    isActive: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const pricingRules = await servicesAPI.getPricingRules();
        setModels(pricingRules);
      } catch (err) {
        setError('加载模型数据失败');
      }
    };
    
    loadModels();
  }, []);

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!newModel.modelName) {
      setError('请输入模型名称');
      return;
    }

    if (models.some(m => m.modelName === newModel.modelName)) {
      setError('模型名称已存在');
      return;
    }

    setIsLoading(true);
    try {
      // In a real app, we would call an API to create the model
      const addedModel = await servicesAPI.addPricingRule({
        modelName: newModel.modelName,
        inputTokenPrice: Number(newModel.inputTokenPrice) || 0.0001,
        outputTokenPrice: Number(newModel.outputTokenPrice) || 0.0002,
        isActive: newModel.isActive === undefined ? true : newModel.isActive
      });
      
      setModels([...models, addedModel]);
      setNewModel({
        modelName: '',
        inputTokenPrice: 0.0001,
        outputTokenPrice: 0.0002,
        isActive: true
      });
      setSuccess('模型添加成功');
    } catch (err) {
      setError('添加模型失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateModel = async (id: string, updates: Partial<PricingRule>) => {
    setError('');
    setSuccess('');
    
    try {
      const updatedModel = await servicesAPI.updatePricingRule(id, updates);
      setModels(models.map(model => model.id === id ? updatedModel : model));
      setSuccess('模型更新成功');
    } catch (err) {
      setError('更新模型失败');
    }
  };

  const handleDeleteModel = async (id: string) => {
    setError('');
    setSuccess('');
    
    if (!window.confirm('确定要删除此模型吗？删除后不可恢复。')) {
      return;
    }
    
    try {
      // In a real app, we would call an API to delete the model
      await servicesAPI.deletePricingRule(id);
      setModels(models.filter(model => model.id !== id));
      setSuccess('模型删除成功');
    } catch (err) {
      setError('删除模型失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">模型管理</h2>
          <p className="text-muted-foreground">管理可用的AI模型及其价格</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="bg-green-50 border-green-200 text-green-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>添加新模型</CardTitle>
          <CardDescription>添加新的AI模型并设置Token价格</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddModel} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modelName">模型名称</Label>
                <Input
                  id="modelName"
                  value={newModel.modelName}
                  onChange={(e) => setNewModel({...newModel, modelName: e.target.value})}
                  placeholder="例如：GPT-4, Claude 3, DeepSeek"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="isActive">状态</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={newModel.isActive}
                    onCheckedChange={(checked) => setNewModel({...newModel, isActive: checked})}
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    {newModel.isActive ? '启用' : '禁用'}
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inputTokenPrice">输入Token价格（元/1K tokens）</Label>
                <Input
                  id="inputTokenPrice"
                  type="number"
                  min="0"
                  step="0.00001"
                  value={newModel.inputTokenPrice}
                  onChange={(e) => setNewModel({...newModel, inputTokenPrice: parseFloat(e.target.value)})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outputTokenPrice">输出Token价格（元/1K tokens）</Label>
                <Input
                  id="outputTokenPrice"
                  type="number"
                  min="0"
                  step="0.00001"
                  value={newModel.outputTokenPrice}
                  onChange={(e) => setNewModel({...newModel, outputTokenPrice: parseFloat(e.target.value)})}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {isLoading ? '添加中...' : '添加模型'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>现有模型</CardTitle>
          <CardDescription>管理和更新现有模型的价格和状态</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left">模型名称</th>
                  <th className="px-4 py-3 text-left">输入Token价格</th>
                  <th className="px-4 py-3 text-left">输出Token价格</th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr key={model.id} className="border-b">
                    <td className="px-4 py-3">{model.modelName}</td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.00001"
                        value={model.inputTokenPrice}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          handleUpdateModel(model.id, { inputTokenPrice: value });
                        }}
                        className="w-24"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.00001"
                        value={model.outputTokenPrice}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          handleUpdateModel(model.id, { outputTokenPrice: value });
                        }}
                        className="w-24"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={model.isActive}
                        onCheckedChange={(checked) => {
                          handleUpdateModel(model.id, { isActive: checked });
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteModel(model.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">删除</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}