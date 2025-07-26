import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  PlusCircle, 
  AlertCircle, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  RotateCcw,
  Activity,
  Clock
} from 'lucide-react';
import { ModelConfig, PriceChangeLog } from '@/types';
import { adminServicesAPI } from '@/lib/admin-services';
import { toast } from '@/hooks/use-toast';

export default function ModelManagement() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [priceChangeLogs, setPriceChangeLogs] = useState<PriceChangeLog[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(10000);
  const [newModel, setNewModel] = useState<Partial<ModelConfig>>({
    modelName: '',
    inputTokenPrice: 50,
    outputTokenPrice: 100,
    isActive: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPriceImpactDialogOpen, setIsPriceImpactDialogOpen] = useState(false);
  const [priceImpactData, setPriceImpactData] = useState<any>(null);
  const [selectedModelForImpact, setSelectedModelForImpact] = useState<string>('');
  const [testInputPrice, setTestInputPrice] = useState<number>(0);
  const [testOutputPrice, setTestOutputPrice] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [modelConfigs, logs, rate] = await Promise.all([
        adminServicesAPI.getModelConfigs(),
        adminServicesAPI.getPriceChangeLogs(),
        adminServicesAPI.getExchangeRate()
      ]);
      
      setModels(modelConfigs);
      setPriceChangeLogs(logs);
      setExchangeRate(rate);
    } catch (err) {
      setError('加载数据失败: ' + (err as Error).message);
    }
  };

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!newModel.modelName || !newModel.inputTokenPrice || !newModel.outputTokenPrice) {
      setError('请填写完整的模型信息');
      return;
    }

    if (models.some(m => m.modelName.toLowerCase() === newModel.modelName!.toLowerCase())) {
      setError('模型名称已存在');
      return;
    }

    setIsLoading(true);
    try {
      const addedModel = await adminServicesAPI.addModelConfig({
        modelName: newModel.modelName!,
        inputTokenPrice: newModel.inputTokenPrice!,
        outputTokenPrice: newModel.outputTokenPrice!,
        isActive: newModel.isActive ?? true
      });
      
      setModels([...models, addedModel]);
      setNewModel({
        modelName: '',
        inputTokenPrice: 50,
        outputTokenPrice: 100,
        isActive: true
      });
      setIsAddDialogOpen(false);
      setSuccess('模型添加成功');
      
      // Reload logs to show the addition
      const logs = await adminServicesAPI.getPriceChangeLogs();
      setPriceChangeLogs(logs);
      
      toast({
        title: "模型添加成功",
        description: `${addedModel.modelName} 已添加到系统中`,
      });
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError('添加模型失败: ' + errorMessage);
      toast({
        title: "添加失败",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateModel = async (id: string, updates: Partial<ModelConfig>) => {
    setError('');
    setSuccess('');
    
    try {
      const updatedModel = await adminServicesAPI.updateModelConfig(id, updates);
      setModels(models.map(model => model.id === id ? updatedModel : model));
      setSuccess('模型更新成功');
      
      // Reload logs to show the update
      const logs = await adminServicesAPI.getPriceChangeLogs();
      setPriceChangeLogs(logs);
      
      toast({
        title: "模型更新成功",
        description: `${updatedModel.modelName} 的配置已更新`,
      });
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError('更新模型失败: ' + errorMessage);
      toast({
        title: "更新失败",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleDeleteModel = async (id: string) => {
    setError('');
    setSuccess('');
    
    const model = models.find(m => m.id === id);
    if (!model) return;
    
    if (!window.confirm(`确定要删除模型 "${model.modelName}" 吗？删除后不可恢复。`)) {
      return;
    }
    
    try {
      await adminServicesAPI.deleteModelConfig(id);
      setModels(models.filter(model => model.id !== id));
      setSuccess('模型删除成功');
      
      // Reload logs to show the deletion
      const logs = await adminServicesAPI.getPriceChangeLogs();
      setPriceChangeLogs(logs);
      
      toast({
        title: "模型删除成功",
        description: `${model.modelName} 已从系统中移除`,
      });
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError('删除模型失败: ' + errorMessage);
      toast({
        title: "删除失败",
        description: errorMessage,
        variant: "destructive"
      });
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