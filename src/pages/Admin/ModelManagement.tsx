import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, InfoIcon } from 'lucide-react';
import { isDifyEnabled } from '@/api/dify-api';

interface SimpleModelConfig {
  id: string;
  name: string;
  inputPrice: number;
  outputPrice: number;
  isActive: boolean;
}

export default function ModelManagement() {
  const [models, setModels] = useState<SimpleModelConfig[]>([
    { id: '1', name: 'GPT-4', inputPrice: 0.05, outputPrice: 0.1, isActive: true },
    { id: '2', name: 'GPT-3.5-Turbo', inputPrice: 0.02, outputPrice: 0.04, isActive: true },
    { id: '3', name: 'Claude-3', inputPrice: 0.03, outputPrice: 0.06, isActive: false }
  ]);
  const [newModelName, setNewModelName] = useState('');
  const [newInputPrice, setNewInputPrice] = useState(0.05);
  const [newOutputPrice, setNewOutputPrice] = useState(0.1);

  const addModel = () => {
    if (!newModelName.trim()) return;
    
    const newModel: SimpleModelConfig = {
      id: Date.now().toString(),
      name: newModelName,
      inputPrice: newInputPrice,
      outputPrice: newOutputPrice,
      isActive: true
    };
    
    setModels([...models, newModel]);
    setNewModelName('');
    setNewInputPrice(0.05);
    setNewOutputPrice(0.1);
  };

  const toggleModel = (id: string) => {
    setModels(models.map(model => 
      model.id === id ? { ...model, isActive: !model.isActive } : model
    ));
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">模型管理</h2>
          <p className="text-gray-500">管理AI模型配置和定价</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5" />
              添加新模型
            </CardTitle>
            <CardDescription>
              配置新的AI模型和定价
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
                <Label htmlFor="inputPrice">输入价格 (积分/token)</Label>
                <Input
                  id="inputPrice"
                  type="number"
                  step="0.01"
                  value={newInputPrice}
                  onChange={(e) => setNewInputPrice(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outputPrice">输出价格 (积分/token)</Label>
                <Input
                  id="outputPrice"
                  type="number"
                  step="0.01"
                  value={newOutputPrice}
                  onChange={(e) => setNewOutputPrice(Number(e.target.value))}
                />
              </div>
            </div>
            
            <Button onClick={addModel} className="w-full">
              添加模型
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>现有模型</CardTitle>
            <CardDescription>
              管理已配置的AI模型
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {models.map((model) => (
                <div key={model.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium">{model.name}</div>
                      <div className="text-sm text-gray-500">
                        输入: {model.inputPrice} • 输出: {model.outputPrice}
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
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}